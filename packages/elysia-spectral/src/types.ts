import type { RulesetDefinition } from '@stoplight/spectral-core';
import type { AnyElysia } from 'elysia';

export type PresetName = 'recommended' | 'server' | 'strict';

export type SeverityThreshold = 'error' | 'warn' | 'info' | 'hint' | 'never';

export type LintSeverity = 'error' | 'warn' | 'info' | 'hint';

export type StartupLintMode = 'enforce' | 'report' | 'off';

export type OpenApiLintRuntimeStatus = 'idle' | 'running' | 'passed' | 'failed';

export type LintRunSource = 'startup' | 'healthcheck' | 'manual';

export type ArtifactWriteFailureMode = 'warn' | 'error';

export type SpectralLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type OpenApiLintArtifacts = {
  jsonReportPath?: string;
  junitReportPath?: string;
  sarifReportPath?: string;
  specSnapshotPath?: string;
  brunoCollectionPath?: string;
};

export type OpenApiLintSinkContext = {
  spec: Record<string, unknown>;
  logger: SpectralLogger;
};

export type OpenApiLintSink = {
  name: string;
  write: (
    result: LintRunResult,
    context: OpenApiLintSinkContext,
  ) =>
    | undefined
    | Partial<OpenApiLintArtifacts>
    | Promise<undefined | Partial<OpenApiLintArtifacts>>;
};

export type SpectralPluginOptions = {
  preset?: PresetName;
  ruleset?: string | RulesetDefinition | Record<string, unknown>;
  failOn?: SeverityThreshold;
  healthcheck?:
    | false
    | {
        path?: string;
      };
  output?: {
    console?: boolean;
    jsonReportPath?: string;
    junitReportPath?: string;
    sarifReportPath?: string;
    specSnapshotPath?: string | true;
    brunoCollectionPath?: string;
    pretty?: boolean;
    artifactWriteFailures?: ArtifactWriteFailureMode;
    sinks?: OpenApiLintSink[];
  };
  source?: {
    specPath?: string;
    baseUrl?: string;
  };
  enabled?: boolean | ((env: Record<string, string | undefined>) => boolean);
  startup?: {
    mode?: StartupLintMode;
  };
  logger?: SpectralLogger;
};

export type LintFinding = {
  code: string;
  message: string;
  severity: LintSeverity;
  path: Array<string | number>;
  documentPointer?: string;
  recommendation?: string;
  source?: string;
  range?: {
    start?: { line: number; character: number };
    end?: { line: number; character: number };
  };
  operation?: {
    method?: string;
    path?: string;
    operationId?: string;
  };
};

export type LintRunResult = {
  ok: boolean;
  generatedAt: string;
  source: LintRunSource;
  summary: {
    error: number;
    warn: number;
    info: number;
    hint: number;
    total: number;
  };
  artifacts?: OpenApiLintArtifacts;
  findings: LintFinding[];
};

export interface SpecProvider {
  getSpec(): Promise<unknown>;
}

export type OpenApiLintRuntimeFailure = {
  name: string;
  message: string;
  generatedAt: string;
};

export type OpenApiLintRuntime = {
  status: OpenApiLintRuntimeStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  latest: LintRunResult | null;
  lastSuccess: LintRunResult | null;
  lastFailure: OpenApiLintRuntimeFailure | null;
  running: boolean;
  run: (app: AnyElysia, source?: LintRunSource) => Promise<LintRunResult>;
};
