import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { createOpenApiLintRuntime } from '../../src/core/runtime';
import { OpenApiLintThresholdError } from '../../src/core/thresholds';
import { PublicSpecProviderError } from '../../src/providers/public-spec-provider';

describe('createOpenApiLintRuntime', () => {
  it('lints a generated public OpenAPI document through app.handle', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Test API',
              version: '1.0.0',
            },
            tags: [{ name: 'Users', description: 'User operations' }],
          },
        }),
      )
      .get('/users', () => [{ id: '1' }], {
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
            }),
          ),
        },
        detail: {
          summary: 'List users',
          description: 'Returns the set of users.',
          operationId: 'listUsers',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: { console: false },
      failOn: 'error',
    });

    const result = await runtime.run(app);
    expect(result.summary.error).toBe(0);
    expect(runtime.status).toBe('passed');
    expect(runtime.running).toBe(false);
    expect(runtime.startedAt).not.toBeNull();
    expect(runtime.completedAt).not.toBeNull();
    expect(runtime.durationMs).not.toBeNull();
    expect(runtime.durationMs).toBeGreaterThanOrEqual(0);
    expect(runtime.latest).toBe(result);
    expect(runtime.lastSuccess).toBe(result);
    expect(runtime.lastFailure).toBeNull();
  });

  it('fails when warning-level findings are promoted to the threshold', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Test API',
              version: '1.0.0',
            },
          },
        }),
      )
      .get('/users', () => [{ id: '1' }], {
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
            }),
          ),
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: { console: false },
      failOn: 'warn',
    });

    try {
      await runtime.run(app);
      throw new Error('Expected runtime.run to fail at warn threshold.');
    } catch (error) {
      expect(error).toBeInstanceOf(OpenApiLintThresholdError);
      expect(runtime.status).toBe('failed');
      expect(runtime.running).toBe(false);
      expect(runtime.startedAt).not.toBeNull();
      expect(runtime.completedAt).not.toBeNull();
      expect(runtime.durationMs).not.toBeNull();
      expect(runtime.latest?.summary.warn).toBeGreaterThan(0);
      expect(runtime.lastSuccess).toBeNull();
      expect(runtime.lastFailure?.name).toBe('OpenApiLintThresholdError');
      expect(runtime.lastFailure?.message).toContain(
        'OpenAPI lint failed at threshold "warn".',
      );
    }
  });

  it('writes the generated OpenAPI JSON snapshot relative to the consuming app root', async () => {
    const snapshotPath = './artifacts/test/openapi-snapshot.json';
    const resolvedSnapshotPath = path.resolve(process.cwd(), snapshotPath);

    await rm(path.dirname(resolvedSnapshotPath), {
      recursive: true,
      force: true,
    });

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Snapshot API',
              version: '1.0.0',
            },
            tags: [{ name: 'Users', description: 'User operations' }],
          },
        }),
      )
      .get('/users', () => [{ id: '1' }], {
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
            }),
          ),
        },
        detail: {
          summary: 'List users',
          description: 'Returns users for snapshot testing.',
          operationId: 'listUsersSnapshot',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: {
        console: false,
        specSnapshotPath: snapshotPath,
      },
      failOn: 'error',
    });

    try {
      const result = await runtime.run(app);

      const snapshot = JSON.parse(
        await readFile(resolvedSnapshotPath, 'utf8'),
      ) as {
        openapi: string;
        info: { title: string };
        paths: Record<string, unknown>;
      };

      expect(snapshot.openapi.startsWith('3.')).toBe(true);
      expect(snapshot.info.title).toBe('Runtime Snapshot API');
      expect(snapshot.paths['/users']).toBeDefined();
      expect(result.artifacts?.specSnapshotPath).toBe(resolvedSnapshotPath);
    } finally {
      await rm(path.dirname(resolvedSnapshotPath), {
        recursive: true,
        force: true,
      });
    }
  });

  it('can derive the snapshot filename from the consuming app package name', async () => {
    const snapshotPath = path.resolve(
      process.cwd(),
      'elysia-spectral.open-api.json',
    );

    await rm(snapshotPath, { force: true });

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Derived Snapshot API',
              version: '1.0.0',
            },
            tags: [{ name: 'Users', description: 'User operations' }],
          },
        }),
      )
      .get('/users', () => [{ id: '1' }], {
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
            }),
          ),
        },
        detail: {
          summary: 'List users',
          description: 'Returns users for derived snapshot testing.',
          operationId: 'listUsersDerivedSnapshot',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: {
        console: false,
        specSnapshotPath: true,
      },
      failOn: 'error',
    });

    try {
      await runtime.run(app);

      const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as {
        info: { title: string };
      };

      expect(snapshot.info.title).toBe('Runtime Derived Snapshot API');
    } finally {
      await rm(snapshotPath, { force: true });
    }
  });

  it('returns an actionable error when source.specPath is misconfigured', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Misconfigured Spec API',
              version: '1.0.0',
            },
            tags: [{ name: 'Users', description: 'User operations' }],
          },
        }),
      )
      .get('/users', () => [{ id: '1' }], {
        response: {
          200: t.Array(
            t.Object({
              id: t.String(),
            }),
          ),
        },
        detail: {
          summary: 'List users',
          description: 'Returns users for misconfigured spec path testing.',
          operationId: 'listUsersMisconfiguredSpecPath',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: { console: false },
      source: {
        specPath: '/missing-openapi-json',
      },
    });

    try {
      await runtime.run(app);
      throw new Error('Expected runtime.run to fail for a bad source.specPath.');
    } catch (error) {
      expect(error).toBeInstanceOf(PublicSpecProviderError);
      expect(runtime.status).toBe('failed');
      expect(runtime.running).toBe(false);
      expect(runtime.startedAt).not.toBeNull();
      expect(runtime.completedAt).not.toBeNull();
      expect(runtime.durationMs).not.toBeNull();
      expect(runtime.latest).toBeNull();
      expect(runtime.lastSuccess).toBeNull();
      expect(runtime.lastFailure?.name).toBe('PublicSpecProviderError');

      const message =
        error instanceof Error ? error.message : String(error);

      expect(message).toContain(
        'Unable to load OpenAPI JSON from /missing-openapi-json',
      );
      expect(message).toContain(
        'Fix: ensure @elysiajs/openapi is mounted and exposing "/missing-openapi-json", or update source.specPath to the correct OpenAPI JSON route.',
      );
    }
  });

  it('returns an actionable error when the configured OpenAPI endpoint does not return JSON', async () => {
    const app = new Elysia().get('/broken-openapi-json', () => 'not json');

    const runtime = createOpenApiLintRuntime({
      output: { console: false },
      source: {
        specPath: '/broken-openapi-json',
      },
    });

    try {
      await runtime.run(app);
      throw new Error(
        'Expected runtime.run to fail when the configured spec endpoint is not JSON.',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PublicSpecProviderError);
      expect(runtime.status).toBe('failed');
      expect(runtime.running).toBe(false);
      expect(runtime.startedAt).not.toBeNull();
      expect(runtime.completedAt).not.toBeNull();
      expect(runtime.durationMs).not.toBeNull();
      expect(runtime.latest).toBeNull();
      expect(runtime.lastSuccess).toBeNull();
      expect(runtime.lastFailure?.name).toBe('PublicSpecProviderError');

      const message =
        error instanceof Error ? error.message : String(error);

      expect(message).toContain(
        'Unable to parse OpenAPI JSON from app.handle(Request) at /broken-openapi-json',
      );
      expect(message).toContain('body preview: "not json"');
      expect(message).toContain(
        'Fix: ensure the configured endpoint for "/broken-openapi-json" returns the generated OpenAPI document as JSON.',
      );
    }
  });
});
