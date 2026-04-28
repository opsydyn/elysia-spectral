import { describe, expect, it } from 'bun:test';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { spectralPlugin } from '../../src/plugin';

const buildApp = (pluginOptions: Parameters<typeof spectralPlugin>[0]) =>
  new Elysia()
    .use(
      openapi({
        documentation: {
          info: { title: 'Dashboard Test API', version: '1.0.0' },
          tags: [{ name: 'Users', description: 'User operations' }],
        },
      }),
    )
    .use(spectralPlugin(pluginOptions))
    .get('/users', () => [{ id: '1' }], {
      response: { 200: t.Array(t.Object({ id: t.String() })) },
      detail: {
        summary: 'List users',
        description: 'Returns users.',
        operationId: 'listUsers',
        tags: ['Users'],
      },
    });

describe('spectralPlugin dashboard', () => {
  it('does not expose a dashboard route unless configured', async () => {
    const app = buildApp({ output: { console: false } }).listen(0);

    try {
      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/__openapi/dashboard`,
      );
      expect(response.status).toBe(404);
    } finally {
      app.stop();
    }
  });

  it('renders an HTML dashboard at the configured path', async () => {
    const app = buildApp({
      output: { console: false },
      dashboard: {},
      failOn: 'never',
    }).listen(0);

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (app.store.openApiLint.latest !== null) break;
        await Bun.sleep(25);
      }

      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/__openapi/dashboard`,
      );
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(body.startsWith('<!doctype html>')).toBe(true);
      expect(body).toContain('OpenAPI Lint');
      expect(body).toContain('Re-run');
      expect(body).toMatch(/banner-(pass|fail)/);
    } finally {
      app.stop();
    }
  });

  it('honours a custom dashboard path', async () => {
    const app = buildApp({
      output: { console: false },
      dashboard: { path: '/__lint' },
      failOn: 'never',
    }).listen(0);

    try {
      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/__lint`,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('OpenAPI Lint');
    } finally {
      app.stop();
    }
  });

  it('escapes HTML-unsafe content in finding messages', async () => {
    const app = buildApp({
      output: {
        console: false,
        sinks: [
          {
            name: 'inject',
            write(result) {
              result.findings.push({
                code: 'xss-test',
                message: '<script>alert(1)</script>',
                severity: 'warn',
                path: ['paths'],
                documentPointer: '/paths',
              });
              result.summary.warn += 1;
              result.summary.total += 1;
              return undefined;
            },
          },
        ],
      },
      dashboard: {},
      failOn: 'never',
    }).listen(0);

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (app.store.openApiLint.latest !== null) break;
        await Bun.sleep(25);
      }

      const response = await fetch(
        `http://127.0.0.1:${app.server?.port}/__openapi/dashboard`,
      );
      const body = await response.text();

      expect(body).not.toContain('<script>alert(1)</script>');
      expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    } finally {
      app.stop();
    }
  });
});
