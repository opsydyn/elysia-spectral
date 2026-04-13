import type { RulesetDefinition } from '@stoplight/spectral-core';
import type { AnyElysia } from 'elysia';

export type SeverityThreshold = 'error' | 'warn' | 'info' | 'hint' | 'never';

export type LintSeverity = 'error' | 'warn' | 'info' | 'hint';

export type SpectralLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type SpectralPluginOptions = {
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
    specSnapshotPath?: string | true;
    pretty?: boolean;
  };
  source?: {
    specPath?: string;
    baseUrl?: string;
  };
  enabled?: boolean | ((env: Record<string, string | undefined>) => boolean);
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
  summary: {
    error: number;
    warn: number;
    info: number;
    hint: number;
    total: number;
  };
  artifacts?: {
    jsonReportPath?: string;
    specSnapshotPath?: string;
  };
  findings: LintFinding[];
};

export interface SpecProvider {
  getSpec(): Promise<unknown>;
}

export type OpenApiLintRuntime = {
  latest: LintRunResult | null;
  run: (app: AnyElysia) => Promise<LintRunResult>;
};
