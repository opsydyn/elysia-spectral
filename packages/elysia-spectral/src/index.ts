import type { RulesetDefinition } from '@stoplight/spectral-core';
import type {
  LoadedRuleset,
  LoadResolvedRulesetOptions,
  RulesetResolverInput,
} from './core';
import type { LintRunResult } from './types';

export type {
  LoadedRuleset,
  LoadResolvedRulesetOptions,
  ResolvedRulesetCandidate,
  RulesetResolver,
  RulesetResolverContext,
  RulesetResolverInput,
} from './core';
export { RulesetLoadError } from './core/ruleset-load-error';
export {
  createOpenApiLintRuntime,
  OpenApiLintArtifactWriteError,
} from './core/runtime';
export {
  enforceThreshold,
  OpenApiLintThresholdError,
  shouldFail,
} from './core/thresholds';
export { spectralPlugin } from './plugin';
export { presets, recommended, server, strict } from './presets';
export type {
  ArtifactWriteFailureMode,
  LintFinding,
  LintRunResult,
  LintRunSource,
  LintSeverity,
  OpenApiLintArtifacts,
  OpenApiLintRuntime,
  OpenApiLintRuntimeFailure,
  OpenApiLintRuntimeStatus,
  OpenApiLintSink,
  OpenApiLintSinkContext,
  PresetName,
  SeverityThreshold,
  SpectralLogger,
  SpectralPluginOptions,
  StartupLintMode,
} from './types';

export const loadRuleset = async (
  input?: RulesetResolverInput,
  baseDirOrOptions: string | LoadResolvedRulesetOptions = process.cwd(),
): Promise<RulesetDefinition> => {
  const module = await import('./core/load-ruleset');
  return await module.loadRuleset(input, baseDirOrOptions);
};

export const loadResolvedRuleset = async (
  input?: RulesetResolverInput,
  baseDirOrOptions: string | LoadResolvedRulesetOptions = process.cwd(),
): Promise<LoadedRuleset> => {
  const module = await import('./core/load-ruleset');
  return await module.loadResolvedRuleset(input, baseDirOrOptions);
};

export const lintOpenApi = async (
  spec: Record<string, unknown>,
  ruleset: RulesetDefinition,
): Promise<LintRunResult> => {
  const module = await import('./core/lint-openapi');
  return await module.lintOpenApi(spec, ruleset);
};
