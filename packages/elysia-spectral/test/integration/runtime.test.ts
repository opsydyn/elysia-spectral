import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import {
  OpenApiLintArtifactWriteError,
  createOpenApiLintRuntime,
} from '../../src/core/runtime';
import { OpenApiLintThresholdError } from '../../src/core/thresholds';
import { PublicSpecProviderError } from '../../src/providers/public-spec-provider';
import type { LintRunResult } from '../../src/types';

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
      'opsydyn-elysia-spectral.open-api.json',
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

  it('writes a SARIF report as a built-in output sink', async () => {
    const sarifPath = './artifacts/test/openapi-lint.sarif';
    const resolvedSarifPath = path.resolve(process.cwd(), sarifPath);

    await rm(resolvedSarifPath, { force: true });

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime SARIF API',
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
      output: {
        console: false,
        sarifReportPath: sarifPath,
      },
      failOn: 'never',
    });

    try {
      const result = await runtime.run(app);
      const sarif = JSON.parse(await readFile(resolvedSarifPath, 'utf8')) as {
        version: string;
        runs: Array<{
          automationDetails?: {
            id: string;
          };
          originalUriBaseIds?: {
            '%SRCROOT%': {
              uri: string;
            };
          };
          tool: {
            driver: {
              name: string;
              rules?: Array<{
                helpUri?: string;
              }>;
            };
          };
          results: Array<{
            ruleId: string;
            level: string;
            ruleIndex?: number;
          }>;
        }>;
      };

      expect(result.artifacts?.sarifReportPath).toBe(resolvedSarifPath);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0]?.automationDetails?.id).toBe(
        '@opsydyn/elysia-spectral/openapi-lint',
      );
      expect(sarif.runs[0]?.originalUriBaseIds?.['%SRCROOT%']?.uri).toContain(
        'file://',
      );
      expect(sarif.runs[0]?.tool.driver.name).toBe('@opsydyn/elysia-spectral');
      expect(sarif.runs[0]?.tool.driver.rules?.[0]?.helpUri).toBe(
        'https://github.com/stoplightio/spectral',
      );
      expect(sarif.runs[0]?.results.length).toBeGreaterThan(0);
      expect(typeof sarif.runs[0]?.results[0]?.ruleId).toBe('string');
      expect(sarif.runs[0]?.results[0]?.level).toMatch(/error|warning|note/);
      expect(typeof sarif.runs[0]?.results[0]?.ruleIndex).toBe('number');
    } finally {
      await rm(resolvedSarifPath, { force: true });
    }
  });

  it('writes a JUnit report as a built-in output sink', async () => {
    const junitPath = './artifacts/test/openapi-lint.junit.xml';
    const resolvedJunitPath = path.resolve(process.cwd(), junitPath);

    await rm(resolvedJunitPath, { force: true });

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime JUnit API',
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
      output: {
        console: false,
        junitReportPath: junitPath,
      },
      failOn: 'never',
    });

    try {
      const result = await runtime.run(app);
      const junit = await readFile(resolvedJunitPath, 'utf8');

      expect(result.artifacts?.junitReportPath).toBe(resolvedJunitPath);
      expect(junit).toContain('<testsuite name="OpenAPI lint"');
      expect(junit).toContain('<failure type="warn"');
      expect(junit).toContain('Issue:');
    } finally {
      await rm(resolvedJunitPath, { force: true });
    }
  });

  it('supports custom output sinks', async () => {
    let capturedSpec: Record<string, unknown> | null = null;
    let capturedResult: LintRunResult | null = null;

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Custom Sink API',
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
          description: 'Returns users for custom sink testing.',
          operationId: 'listUsersCustomSink',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: {
        console: false,
        sinks: [
          {
            name: 'capture',
            write(result, context) {
              capturedResult = result;
              capturedSpec = context.spec;

              return {
                sarifReportPath: 'memory://capture.sarif',
              };
            },
          },
        ],
      },
      failOn: 'error',
    });

    const result = await runtime.run(app);

    if (!capturedSpec || !capturedResult) {
      throw new Error('Expected custom sink to capture both spec and result.');
    }

    const resolvedSpec = capturedSpec as Record<string, unknown>;
    const resolvedResult = capturedResult as LintRunResult;

    expect(resolvedResult).toBe(result);
    expect(typeof resolvedSpec.openapi).toBe('string');
    expect(result.artifacts?.sarifReportPath).toBe('memory://capture.sarif');
  });

  it('warns and continues when artifact writes fail in warn mode', async () => {
    const warnings: string[] = [];
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Artifact Warning API',
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
          description: 'Returns users for artifact write warning testing.',
          operationId: 'listUsersArtifactWarning',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: {
        console: false,
        jsonReportPath: '.',
        artifactWriteFailures: 'warn',
      },
      logger: {
        info: () => {},
        warn: (message) => warnings.push(message),
        error: () => {},
      },
      failOn: 'error',
    });

    const result = await runtime.run(app);

    expect(result.summary.error).toBe(0);
    expect(runtime.status).toBe('passed');
    expect(runtime.lastSuccess).toBe(result);
    expect(
      warnings.some((message) =>
        message.includes('OpenAPI lint could not write JSON report:'),
      ),
    ).toBe(true);
  });

  it('fails the run when artifact writes fail in error mode', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Runtime Artifact Error API',
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
          description: 'Returns users for artifact write error testing.',
          operationId: 'listUsersArtifactError',
          tags: ['Users'],
        },
      });

    const runtime = createOpenApiLintRuntime({
      output: {
        console: false,
        specSnapshotPath: '.',
        artifactWriteFailures: 'error',
      },
      failOn: 'error',
    });

    try {
      await runtime.run(app);
      throw new Error(
        'Expected runtime.run to fail when artifactWriteFailures is "error".',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(OpenApiLintArtifactWriteError);
      expect(runtime.status).toBe('failed');
      expect(runtime.running).toBe(false);
      expect(runtime.latest).toBeNull();
      expect(runtime.lastSuccess).toBeNull();
      expect(runtime.lastFailure?.name).toBe('OpenApiLintArtifactWriteError');
      expect(runtime.lastFailure?.message).toContain(
        'OpenAPI lint could not write spec snapshot:',
      );
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
      throw new Error(
        'Expected runtime.run to fail for a bad source.specPath.',
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

      const message = error instanceof Error ? error.message : String(error);

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

      const message = error instanceof Error ? error.message : String(error);

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
