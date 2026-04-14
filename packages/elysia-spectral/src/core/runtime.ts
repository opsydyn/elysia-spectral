import type { AnyElysia } from 'elysia';
import { resolveReporter } from '../output/console-reporter';
import { createOutputSinks } from '../output/sinks';
import { PublicSpecProvider } from '../providers/public-spec-provider';
import type {
  LintRunResult,
  OpenApiLintArtifacts,
  OpenApiLintRuntime,
  OpenApiLintRuntimeFailure,
  SpectralPluginOptions,
  StartupLintMode,
} from '../types';
import { lintOpenApi } from './lint-openapi';
import { loadResolvedRuleset } from './load-ruleset';
import { enforceThreshold } from './thresholds';

export const createOpenApiLintRuntime = (
  options: SpectralPluginOptions = {},
): OpenApiLintRuntime => {
  const reporter = resolveReporter(options.logger);
  const artifactWriteFailureMode =
    options.output?.artifactWriteFailures ?? 'warn';
  let inFlight: Promise<LintRunResult> | null = null;

  const runtime: OpenApiLintRuntime = {
    status: 'idle',
    startedAt: null,
    completedAt: null,
    durationMs: null,
    latest: null,
    lastSuccess: null,
    lastFailure: null,
    running: false,
    async run(app: AnyElysia) {
      if (inFlight) {
        return await inFlight;
      }

      inFlight = (async () => {
        const startedAt = new Date();
        runtime.running = true;
        runtime.status = 'running';
        runtime.startedAt = startedAt.toISOString();
        runtime.completedAt = null;
        runtime.durationMs = null;
        reporter.start('OpenAPI lint started.');

        try {
          const provider = new PublicSpecProvider(app, options.source);
          const spec = (await provider.getSpec()) as Record<string, unknown>;

          const loadedRuleset = await loadResolvedRuleset(options.ruleset);
          if (loadedRuleset.source?.autodiscovered) {
            reporter.ruleset(
              `OpenAPI lint autodiscovered ruleset ${loadedRuleset.source.path} and merged it with the package default ruleset.`,
            );
          } else if (loadedRuleset.source?.path) {
            reporter.ruleset(`OpenAPI lint loaded ruleset ${loadedRuleset.source.path}.`);
          }

          const result = await lintOpenApi(spec, loadedRuleset.ruleset);
          await writeOutputSinks(result, spec, options, artifactWriteFailureMode);

          runtime.latest = result;

          reporter.complete('OpenAPI lint completed.');
          enforceThreshold(result, options.failOn ?? 'error');

          runtime.status = 'passed';
          runtime.lastSuccess = result;
          finalizeRuntimeRun(runtime, startedAt);
          return result;
        } catch (error) {
          runtime.status = 'failed';
          runtime.lastFailure = toRuntimeFailure(error);
          finalizeRuntimeRun(runtime, startedAt);
          throw error;
        }
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

const finalizeRuntimeRun = (
  runtime: OpenApiLintRuntime,
  startedAt: Date,
): void => {
  const completedAt = new Date();
  runtime.completedAt = completedAt.toISOString();
  runtime.durationMs = completedAt.getTime() - startedAt.getTime();
};

const toRuntimeFailure = (error: unknown): OpenApiLintRuntimeFailure => ({
  name: error instanceof Error ? error.name : 'Error',
  message: error instanceof Error ? error.message : String(error),
  generatedAt: new Date().toISOString(),
});

export class OpenApiLintArtifactWriteError extends Error {
  constructor(
    readonly artifact: string,
    readonly cause: unknown,
  ) {
    super(
      `OpenAPI lint could not write ${artifact}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'OpenApiLintArtifactWriteError';
  }
}

const handleArtifactWriteFailure = (
  artifact: string,
  error: unknown,
  mode: 'warn' | 'error',
  reporter: ReturnType<typeof resolveReporter>,
): void => {
  const wrappedError = new OpenApiLintArtifactWriteError(artifact, error);

  if (mode === 'error') {
    throw wrappedError;
  }

  reporter.warn(wrappedError.message);
};

const writeOutputSinks = async (
  result: LintRunResult,
  spec: Record<string, unknown>,
  options: SpectralPluginOptions,
  artifactWriteFailureMode: 'warn' | 'error',
): Promise<void> => {
  const reporter = resolveReporter(options.logger);
  const sinks = createOutputSinks(options);

  for (const sink of sinks) {
    try {
      const artifacts = await sink.write(result, {
        spec,
        logger: reporter,
      });

      if (artifacts) {
        result.artifacts = mergeArtifacts(result.artifacts, artifacts);
      }
    } catch (error) {
      if (sink.kind === 'artifact') {
        handleArtifactWriteFailure(
          sink.name,
          error,
          artifactWriteFailureMode,
          reporter,
        );
        continue;
      }

      throw error;
    }
  }
};

const mergeArtifacts = (
  current: OpenApiLintArtifacts | undefined,
  next: Partial<OpenApiLintArtifacts>,
): OpenApiLintArtifacts => ({
  ...current,
  ...next,
});

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
