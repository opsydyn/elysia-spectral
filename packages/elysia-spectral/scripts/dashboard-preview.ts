import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { spectralPlugin } from '../src/index';

const mode = (process.env.MODE ?? 'happy') as 'happy' | 'unhappy';
const unhappy = mode === 'unhappy';
const port = unhappy ? 4101 : 4100;

const app = new Elysia()
  .use(
    openapi({
      documentation: {
        info: {
          title: unhappy ? 'Spectral Tester — Unhappy' : 'Spectral Tester',
          version: '1.0.0',
          description: unhappy
            ? 'Intentionally broken routes to exercise lint findings.'
            : 'Demo app with fully documented routes.',
        },
        tags: [{ name: 'Users', description: 'User operations' }],
      },
    }),
  )
  .use(
    spectralPlugin({
      failOn: unhappy ? 'warn' : 'error',
      startup: { mode: unhappy ? 'report' : 'enforce' },
      output: { console: false },
      healthcheck: { path: '/api-lint/health' },
      dashboard: { path: '/api-lint/dashboard' },
    }),
  )
  .get('/users', () => [{ id: '1', name: 'Ada Lovelace' }], {
    tags: ['Users'],
    detail: { summary: 'List users', operationId: 'listUsers' },
    response: {
      200: t.Array(t.Object({ id: t.String(), name: t.String() }), {
        description: 'Users',
      }),
    },
  });

if (unhappy) {
  app.get('/broken', () => ({ ok: true }));
}

app.listen(port, () => {
  console.log(`http://localhost:${port}/api-lint/dashboard`);
});
