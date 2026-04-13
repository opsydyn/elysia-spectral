import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { createOpenApiLintRuntime } from '../../src/core/runtime';
import { OpenApiLintThresholdError } from '../../src/core/thresholds';

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

    await expect(runtime.run(app)).rejects.toBeInstanceOf(
      OpenApiLintThresholdError,
    );
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
      await runtime.run(app);

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
});
