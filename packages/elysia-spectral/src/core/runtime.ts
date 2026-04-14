import type { AnyElysia } from 'elysia';
import { reportToConsole, resolveLogger } from '../output/console-reporter';
import {
  resolveDefaultSpecSnapshotPath,
  writeJsonReport,
  writeSpecSnapshot,
} from '../output/json-reporter';
import { PublicSpecProvider } from '../providers/public-spec-provider';
import type {
  LintRunResult,
  OpenApiLintRuntime,
  SpectralPluginOptions,
  StartupLintMode,
} from '../types';
import { lintOpenApi } from './lint-openapi';
import { loadResolvedRuleset } from './load-ruleset';
import { enforceThreshold } from './thresholds';

export const createOpenApiLintRuntime = (
  options: SpectralPluginOptions = {},
): OpenApiLintRuntime => {
  const logger = resolveLogger(options.logger);
  let inFlight: Promise<LintRunResult> | null = null;

  const runtime: OpenApiLintRuntime = {
    latest: null,
    running: false,
    async run(app: AnyElysia) {
      if (inFlight) {
        return await inFlight;
      }

      inFlight = (async () => {
        runtime.running = true;
        logger.info('OpenAPI lint started.');

        const provider = new PublicSpecProvider(app, options.source);
        const spec = (await provider.getSpec()) as Record<string, unknown>;
        let snapshotPath: string | undefined;
        let reportPath: string | undefined;

        if (options.output?.specSnapshotPath) {
          try {
            const snapshotTarget =
              options.output.specSnapshotPath === true
                ? await resolveDefaultSpecSnapshotPath()
                : options.output.specSnapshotPath;
            snapshotPath = await writeSpecSnapshot(
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

        const loadedRuleset = await loadResolvedRuleset(options.ruleset);
        if (loadedRuleset.source?.autodiscovered) {
          logger.info(
            `OpenAPI lint autodiscovered ruleset ${loadedRuleset.source.path} and merged it with the package default ruleset.`,
          );
        } else if (loadedRuleset.source?.path) {
          logger.info(
            `OpenAPI lint loaded ruleset ${loadedRuleset.source.path}.`,
          );
        }

        const result = await lintOpenApi(spec, loadedRuleset.ruleset);
        if (snapshotPath) {
          result.artifacts = {
            specSnapshotPath: snapshotPath,
          };
        }

        runtime.latest = result;

        if (options.output?.jsonReportPath) {
          try {
            reportPath = await writeJsonReport(
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

        if (reportPath) {
          result.artifacts = {
            ...result.artifacts,
            jsonReportPath: reportPath,
          };
        }

        if (options.output?.console !== false) {
          reportToConsole(result, logger);
        }

        logger.info('OpenAPI lint completed.');
        enforceThreshold(result, options.failOn ?? 'error');
        return result;
      })();

      try {
        return await inFlight;
      } finally {
        runtime.running = false;
        inFlight = null;
      }
    },
  };

  return runtime;
};

export const isEnabled = (options: SpectralPluginOptions = {}): boolean => {
  return resolveStartupMode(options) !== 'off';
};

export const resolveStartupMode = (
  options: SpectralPluginOptions = {},
): StartupLintMode => {
  if (options.startup?.mode) {
    return options.startup.mode;
  }

  if (typeof options.enabled === 'function') {
    return options.enabled(process.env) ? 'enforce' : 'off';
  }

  return options.enabled === false ? 'off' : 'enforce';
};
