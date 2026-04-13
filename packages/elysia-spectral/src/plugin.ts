import { type AnyElysia, Elysia } from 'elysia';
import { createOpenApiLintRuntime, isEnabled } from './core/runtime';
import { OpenApiLintThresholdError, shouldFail } from './core/thresholds';
import type { SpectralPluginOptions } from './types';

export const spectralPlugin = (options: SpectralPluginOptions = {}) => {
  const runtime = createOpenApiLintRuntime(options);
  const hostAppRef: { current: AnyElysia | null } = { current: null };

  let plugin = new Elysia({ name: 'elysia-spectral' })
    .state('openApiLint', runtime)
    .onStart(async (context) => {
      const app = ((context as { app?: AnyElysia }).app ??
        context) as AnyElysia;
      hostAppRef.current = app;

      if (!isEnabled(options)) {
        return;
      }

      await runtime.run(app);
    });

  if (options.healthcheck !== false) {
    const healthcheckPath = options.healthcheck?.path ?? '/__openapi/health';

    plugin = plugin.get(
      healthcheckPath,
      async ({ request, set }) => {
        const fresh = new URL(request.url).searchParams.get('fresh') === '1';
        const threshold = options.failOn ?? 'error';

        const currentApp = hostAppRef.current;
        if (!currentApp) {
          set.status = 503;
          return {
            ok: false,
            cached: false,
            threshold,
            error: 'OpenAPI lint runtime is not initialized yet.',
          };
        }

        try {
          const usedCache =
            !fresh && (runtime.latest !== null || runtime.running);
          const result = usedCache
            ? runtime.latest ?? (await runtime.run(currentApp))
            : await runtime.run(currentApp);

          if (result === null) {
            set.status = 500;
            return {
              ok: false,
              cached: false,
              threshold,
              error: 'OpenAPI lint returned no result.',
            };
          }

          const healthy = !shouldFail(result, threshold);

          set.status = healthy ? 200 : 503;
          return {
            ok: healthy,
            cached: usedCache,
            threshold,
            result,
          };
        } catch (error) {
          if (error instanceof OpenApiLintThresholdError) {
            set.status = 503;
            return {
              ok: false,
              cached: false,
              threshold,
              result: error.result,
              error: error.message,
            };
          }

          set.status = 500;
          return {
            ok: false,
            cached: false,
            threshold,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        detail: {
          hide: true,
          summary: 'OpenAPI lint healthcheck',
        },
      },
    );
  }

  return plugin;
};
