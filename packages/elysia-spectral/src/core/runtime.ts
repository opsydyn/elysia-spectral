import path from 'node:path';
import type { AnyElysia } from 'elysia';
import { resolveReporter } from '../output/console-reporter';
import { createOutputSinks } from '../output/sinks';
import { presets } from '../presets';
import { PublicSpecProvider } from '../providers/public-spec-provider';
import type {
  LintRunResult,
  LintRunSource,
  OpenApiLintArtifacts,
  OpenApiLintRuntime,
  OpenApiLintRuntimeFailure,
  SpectralPluginOptions,
  StartupLintMode,
} from '../types';
import { lintOpenApi } from './lint-openapi';
import { loadResolvedRuleset } from './load-ruleset';
import { enforceThreshold, shouldFail } from './thresholds';

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
    async run(app: AnyElysia, source: LintRunSource = 'manual') {
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

          const loadedRuleset = await loadResolvedRuleset(options.ruleset, {
            ...(options.preset
              ? { defaultRuleset: presets[options.preset] }
              : {}),
          });

          if (loadedRuleset.source?.autodiscovered) {
            const base = options.preset
              ? `"${options.preset}" preset`
              : 'package default ruleset';
            reporter.ruleset(
              `OpenAPI lint autodiscovered ruleset ${loadedRuleset.source.path} and merged it with the ${base}.`,
            );
          } else if (options.preset && !loadedRuleset.source?.path) {
            reporter.ruleset(`OpenAPI lint using "${options.preset}" preset.`);
          } else if (loadedRuleset.source?.path) {
            reporter.ruleset(
              `OpenAPI lint loaded ruleset ${loadedRuleset.source.path}.`,
            );
          }

          const result = await lintOpenApi(spec, loadedRuleset.ruleset);
          result.source = source;
          result.failOn = options.failOn ?? 'error';
          result.ok = !shouldFail(result, result.failOn);
          await writeOutputSinks(
            result,
            spec,
            options,
            artifactWriteFailureMode,
          );

          runtime.latest = result;
          finalizeRuntimeRun(runtime, startedAt);
          result.durationMs = runtime.durationMs;

          reporter.complete('OpenAPI lint completed.');
          enforceThreshold(result, options.failOn ?? 'error');

          runtime.status = 'passed';
          runtime.lastSuccess = result;
          return result;
        } catch (error) {
          runtime.status = 'failed';
          runtime.lastFailure = toRuntimeFailure(error);
          if (runtime.durationMs === null) {
            finalizeRuntimeRun(runtime, startedAt);
          }
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

const relativiseArtifacts = (
  artifacts: Partial<OpenApiLintArtifacts>,
): Partial<OpenApiLintArtifacts> => {
  const cwd = process.cwd();
  const result: Partial<OpenApiLintArtifacts> = {};
  for (const [key, value] of Object.entries(artifacts)) {
    if (typeof value === 'string' && path.isAbsolute(value)) {
      const rel = path.relative(cwd, value);
      result[key as keyof OpenApiLintArtifacts] = rel.startsWith('.')
        ? rel
        : `./${rel}`;
    } else {
      result[key as keyof OpenApiLintArtifacts] = value;
    }
  }
  return result;
};

const mergeArtifacts = (
  current: OpenApiLintArtifacts | undefined,
  next: Partial<OpenApiLintArtifacts>,
): OpenApiLintArtifacts => ({
  ...current,
  ...relativiseArtifacts(next),
});

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
