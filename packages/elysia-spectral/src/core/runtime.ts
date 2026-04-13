import type { AnyElysia } from 'elysia';
import { reportToConsole, resolveLogger } from '../output/console-reporter';
import {
  resolveDefaultSpecSnapshotPath,
  writeJsonReport,
  writeSpecSnapshot,
} from '../output/json-reporter';
import { PublicSpecProvider } from '../providers/public-spec-provider';
import type { OpenApiLintRuntime, SpectralPluginOptions } from '../types';
import { lintOpenApi } from './lint-openapi';
import { loadRuleset } from './load-ruleset';
import { enforceThreshold } from './thresholds';

export const createOpenApiLintRuntime = (
  options: SpectralPluginOptions = {},
): OpenApiLintRuntime => {
  const logger = resolveLogger(options.logger);

  const runtime: OpenApiLintRuntime = {
    latest: null,
    async run(app: AnyElysia) {
      logger.info('OpenAPI lint started.');

      const provider = new PublicSpecProvider(app, options.source);
      const spec = (await provider.getSpec()) as Record<string, unknown>;

      if (options.output?.specSnapshotPath) {
        try {
          const snapshotTarget =
            options.output.specSnapshotPath === true
              ? await resolveDefaultSpecSnapshotPath()
              : options.output.specSnapshotPath;
          const snapshotPath = await writeSpecSnapshot(
            snapshotTarget,
            spec,
            options.output.pretty !== false,
          );
          logger.info(`OpenAPI lint wrote spec snapshot to ${snapshotPath}.`);
        } catch (error) {
          logger.warn(
            `OpenAPI lint could not write spec snapshot: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const ruleset = await loadRuleset(options.ruleset);
      const result = await lintOpenApi(spec, ruleset);

      runtime.latest = result;

      if (options.output?.jsonReportPath) {
        try {
          const reportPath = await writeJsonReport(
            options.output.jsonReportPath,
            result,
            options.output.pretty !== false,
          );
          logger.info(`OpenAPI lint wrote JSON report to ${reportPath}.`);
        } catch (error) {
          logger.warn(
            `OpenAPI lint could not write JSON report: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (options.output?.console !== false) {
        reportToConsole(result, logger);
      }

      enforceThreshold(result, options.failOn ?? 'error');

      logger.info('OpenAPI lint completed.');
      return result;
    },
  };

  return runtime;
};

export const isEnabled = (options: SpectralPluginOptions = {}): boolean => {
  if (typeof options.enabled === 'function') {
    return options.enabled(process.env);
  }

  return options.enabled ?? true;
};
