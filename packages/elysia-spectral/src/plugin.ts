import { type AnyElysia, Elysia } from 'elysia';
import { createOpenApiLintRuntime, resolveStartupMode } from './core/runtime';
import { OpenApiLintThresholdError, shouldFail } from './core/thresholds';
import { resolveReporter } from './output/console-reporter';
import { renderDashboard } from './output/dashboard';
import type { SpectralPluginOptions } from './types';

export const spectralPlugin = (options: SpectralPluginOptions = {}) => {
  const runtime = createOpenApiLintRuntime(options);
  const hostAppRef: { current: AnyElysia | null } = { current: null };
  const reporter = resolveReporter(options.logger);

  let plugin = new Elysia({ name: '@opsydyn/elysia-spectral' })
    .state('openApiLint', runtime)
    .onStart(async (context) => {
      const app = ((context as { app?: AnyElysia }).app ??
        context) as AnyElysia;
      hostAppRef.current = app;

      const startupMode = resolveStartupMode(options);

      if (startupMode === 'off') {
        return;
      }

      try {
        await runtime.run(app, 'startup');
      } catch (error) {
        if (
          startupMode === 'report' &&
          error instanceof OpenApiLintThresholdError
        ) {
          reporter.report(
            `OpenAPI lint exceeded the "${options.failOn ?? 'error'}" threshold, but startup is continuing because startup.mode is "report".`,
          );
          return;
        }

        throw error;
      }
    });

  if (options.healthcheck) {
    const healthcheckPath = options.healthcheck.path ?? '/__openapi/health';

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
            ? (runtime.latest ?? (await runtime.run(currentApp, 'healthcheck')))
            : await runtime.run(currentApp, 'healthcheck');

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

  if (options.dashboard) {
    const dashboardPath = options.dashboard.path ?? '/__openapi/dashboard';
    const bearerToken = options.dashboard.bearerToken;

    plugin = plugin.get(
      dashboardPath,
      async ({ request, set }) => {
        if (bearerToken) {
          const header = request.headers.get('authorization') ?? '';
          const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
          if (provided !== bearerToken) {
            set.status = 401;
            set.headers['www-authenticate'] = 'Bearer realm="elysia-spectral"';
            set.headers['content-type'] = 'text/plain; charset=utf-8';
            return 'Unauthorized';
          }
        }

        const fresh = new URL(request.url).searchParams.get('fresh') === '1';
        const threshold = options.failOn ?? 'error';
        const currentApp = hostAppRef.current;

        set.headers['content-type'] = 'text/html; charset=utf-8';

        if (!currentApp) {
          set.status = 503;
          return renderDashboard({
            result: null,
            threshold,
            cached: false,
            error: 'OpenAPI lint runtime is not initialized yet.',
            refreshPath: dashboardPath,
          });
        }

        try {
          const usedCache = !fresh && runtime.latest !== null;
          const result = usedCache
            ? runtime.latest
            : await runtime.run(currentApp, 'manual');

          return renderDashboard({
            result,
            threshold,
            cached: usedCache,
            refreshPath: dashboardPath,
          });
        } catch (error) {
          if (error instanceof OpenApiLintThresholdError) {
            return renderDashboard({
              result: error.result,
              threshold,
              cached: false,
              refreshPath: dashboardPath,
            });
          }

          set.status = 500;
          return renderDashboard({
            result: null,
            threshold,
            cached: false,
            error: error instanceof Error ? error.message : String(error),
            refreshPath: dashboardPath,
          });
        }
      },
      {
        detail: {
          hide: true,
          summary: 'OpenAPI lint dashboard',
        },
      },
    );
  }

  return plugin;
};
