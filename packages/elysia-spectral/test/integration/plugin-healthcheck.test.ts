import { describe, expect, it } from 'bun:test';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { spectralPlugin } from '../../src/plugin';

describe('spectralPlugin healthcheck', () => {
  it('returns 200 and cached lint results after startup', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Healthcheck API',
              version: '1.0.0',
            },
            tags: [{ name: 'Users', description: 'User operations' }],
          },
        }),
      )
      .use(
        spectralPlugin({
          output: { console: false },
          failOn: 'error',
          healthcheck: { path: '/health/openapi-lint' },
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
          description: 'Returns users.',
          operationId: 'listUsers',
          tags: ['Users'],
        },
      })
      .listen(0);

    try {
      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/health/openapi-lint`,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.result.summary.total).toBe(0);
    } finally {
      await app.stop();
    }
  });

  it('returns 503 for threshold failures and can force a fresh lint run', async () => {
    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Healthcheck API',
              version: '1.0.0',
            },
          },
        }),
      )
      .use(
        spectralPlugin({
          output: { console: false },
          failOn: 'warn',
          enabled: false,
          healthcheck: { path: '/health/openapi-lint' },
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
      })
      .listen(0);

    try {
      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/health/openapi-lint?fresh=1`,
      );
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.cached).toBe(false);
      expect(body.result.summary.warn).toBeGreaterThan(0);
    } finally {
      await app.stop();
    }
  });

  it('can report startup failures without blocking boot when startup.mode is "report"', async () => {
    const warnings: string[] = [];

    const app = new Elysia()
      .use(
        openapi({
          documentation: {
            info: {
              title: 'Healthcheck API',
              version: '1.0.0',
            },
          },
        }),
      )
      .use(
        spectralPlugin({
          output: { console: false },
          failOn: 'warn',
          startup: { mode: 'report' },
          logger: {
            info: () => {},
            warn: (message) => warnings.push(message),
            error: () => {},
          },
          healthcheck: { path: '/health/openapi-lint' },
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
      })
      .listen(0);

    try {
      let response: Response | null = null;
      let body: {
        ok: boolean;
        cached: boolean;
        result: { summary: { warn: number } };
      } = {
        ok: false,
        cached: false,
        result: { summary: { warn: 0 } },
      };

      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(
          `http://127.0.0.1:${app.server?.port}/health/openapi-lint`,
        );
        body = await response.json();

        if (body.cached) {
          break;
        }

        await Bun.sleep(25);
      }

      expect(response?.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.cached).toBe(true);
      expect(body.result.summary.warn).toBeGreaterThan(0);
      expect(warnings).toContain(
        'OpenAPI lint exceeded the "warn" threshold, but startup is continuing because startup.mode is "report".',
      );
    } finally {
      await app.stop();
    }
  });
});
