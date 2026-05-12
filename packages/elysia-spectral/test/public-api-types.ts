import type {
  ArtifactWriteFailureMode,
  LintFinding,
  LintRunResult,
  LintRunSource,
  LintSeverity,
  LoadedRuleset,
  LoadResolvedRulesetOptions,
  OpenApiLintArtifacts,
  OpenApiLintRuntime,
  OpenApiLintRuntimeFailure,
  OpenApiLintRuntimeStatus,
  OpenApiLintSink,
  OpenApiLintSinkContext,
  PresetName,
  ResolvedRulesetCandidate,
  RulesetResolver,
  RulesetResolverContext,
  RulesetResolverInput,
  SeverityThreshold,
  SpectralLogger,
  SpectralPluginOptions,
  StartupLintMode,
} from '../src';

type RootPublicTypeSmoke = {
  presetName: PresetName;
  severityThreshold: SeverityThreshold;
  lintSeverity: LintSeverity;
  startupMode: StartupLintMode;
  runtimeStatus: OpenApiLintRuntimeStatus;
  lintRunSource: LintRunSource;
  artifactWriteFailureMode: ArtifactWriteFailureMode;
  logger: SpectralLogger;
  artifacts: OpenApiLintArtifacts;
  sinkContext: OpenApiLintSinkContext;
  sink: OpenApiLintSink;
  options: SpectralPluginOptions;
  finding: LintFinding;
  runResult: LintRunResult;
  runtimeFailure: OpenApiLintRuntimeFailure;
  runtime: OpenApiLintRuntime;
  loadedRuleset: LoadedRuleset;
  loadResolvedRulesetOptions: LoadResolvedRulesetOptions;
  resolvedRulesetCandidate: ResolvedRulesetCandidate;
  rulesetResolver: RulesetResolver;
  rulesetResolverContext: RulesetResolverContext;
  rulesetResolverInput: RulesetResolverInput;
};

export type PublicTypeSmokeCheck = RootPublicTypeSmoke;
