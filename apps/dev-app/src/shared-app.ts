import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { spectralPlugin } from 'elysia-spectral';

type ExampleMode = 'happy' | 'unhappy';

const defaultPortByMode: Record<ExampleMode, number> = {
  happy: 3000,
  unhappy: 3001,
};

export const createExampleApp = (mode: ExampleMode) => {
  const unhappy = mode === 'unhappy';

  const app = new Elysia()
    .use(
      openapi({
        documentation: {
          info: {
            title: unhappy
              ? 'elysia-spectral unhappy dev app'
              : 'elysia-spectral dev app',
            version: '0.1.0',
          },
          tags: [
            {
              name: unhappy ? 'Dev' : 'Users',
              description: unhappy
                ? 'Development fixture operations'
                : 'User operations',
            },
          ],
        },
      }),
    )
    .use(
      spectralPlugin({
        failOn: unhappy ? 'warn' : 'error',
        startup: {
          mode: unhappy ? 'report' : 'enforce',
        },
        output: {
          jsonReportPath: unhappy
            ? './artifacts/openapi-lint-unhappy.json'
            : './artifacts/openapi-lint.json',
          specSnapshotPath: true,
        },
        healthcheck: {
          path: '/health/openapi-lint',
        },
      }),
    )
    .get(
      '/',
      () => ({
        service: unhappy
          ? 'elysia-spectral-unhappy-dev-app'
          : 'elysia-spectral-dev-app',
        openapi: '/openapi',
        spec: '/openapi/json',
        healthcheck: '/health/openapi-lint',
        ...(unhappy ? { intentionallyBrokenRoute: '/broken-users' } : {}),
      }),
      {
        response: {
          200: unhappy
            ? t.Object({
                service: t.String(),
                openapi: t.String(),
                spec: t.String(),
                healthcheck: t.String(),
                intentionallyBrokenRoute: t.String(),
              })
            : t.Object({
                service: t.String(),
                openapi: t.String(),
                spec: t.String(),
                healthcheck: t.String(),
              }),
        },
        detail: {
          summary: unhappy
            ? 'Show unhappy dev endpoints'
            : 'Show dev endpoints',
          description: unhappy
            ? 'Return the local endpoints exposed by the intentionally failing dev fixture app.'
            : 'Return the local endpoints exposed by the dev fixture app.',
          operationId: unhappy ? 'getUnhappyDevEndpoints' : 'getDevEndpoints',
          tags: [unhappy ? 'Dev' : 'Users'],
        },
      },
    )
    .get('/users', () => [{ id: '1', name: 'Ada Lovelace' }], {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
          }),
        ),
      },
      detail: {
        summary: 'List users',
        description: unhappy
          ? 'Return all users from the unhappy dev fixture endpoint.'
          : 'Return all users from the dev fixture endpoint.',
        operationId: unhappy ? 'listUsersUnhappyFixture' : 'listUsers',
        tags: [unhappy ? 'Dev' : 'Users'],
      },
    });

  if (unhappy) {
    return app.get('/broken-users', () => [
      { id: '2', name: 'Broken Example' },
    ]);
  }

  return app;
};

export const startExampleApp = (mode: ExampleMode) => {
  const port = Number(process.env.PORT ?? defaultPortByMode[mode]);
  const unhappy = mode === 'unhappy';
  const app = createExampleApp(mode).listen(port);

  console.log(
    `${unhappy ? 'elysia-spectral unhappy dev app' : 'elysia-spectral dev app'} running at http://localhost:${app.server?.port}`,
  );
  console.log(`OpenAPI UI: http://localhost:${app.server?.port}/openapi`);
  console.log(
    `OpenAPI JSON: http://localhost:${app.server?.port}/openapi/json`,
  );
  console.log(
    `Healthcheck: http://localhost:${app.server?.port}/health/openapi-lint`,
  );

  if (unhappy) {
    console.log(
      `Broken route: http://localhost:${app.server?.port}/broken-users`,
    );
  }

  console.log('Spec snapshot: ./elysia-spectral-dev-app.open-api.json');

  return app;
};
