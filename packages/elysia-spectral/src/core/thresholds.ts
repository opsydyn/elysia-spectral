import type { LintRunResult, LintSeverity, SeverityThreshold } from '../types';

const severityRank: Record<LintSeverity, number> = {
  error: 0,
  warn: 1,
  info: 2,
  hint: 3,
};

const thresholdRank: Record<Exclude<SeverityThreshold, 'never'>, number> = {
  error: 0,
  warn: 1,
  info: 2,
  hint: 3,
};

export class OpenApiLintThresholdError extends Error {
  constructor(
    readonly threshold: SeverityThreshold,
    readonly result: LintRunResult,
  ) {
    super(buildThresholdMessage(threshold, result));
    this.name = 'OpenApiLintThresholdError';
  }
}

export const exceedsThreshold = (
  severity: LintSeverity,
  threshold: SeverityThreshold,
): boolean => {
  if (threshold === 'never') {
    return false;
  }

  return severityRank[severity] <= thresholdRank[threshold];
};

export const shouldFail = (
  result: LintRunResult,
  threshold: SeverityThreshold,
): boolean => {
  if (threshold === 'never') {
    return false;
  }

  return result.findings.some((finding) =>
    exceedsThreshold(finding.severity, threshold),
  );
};

export const enforceThreshold = (
  result: LintRunResult,
  threshold: SeverityThreshold,
): void => {
  if (shouldFail(result, threshold)) {
    throw new OpenApiLintThresholdError(threshold, result);
  }
};

const buildThresholdMessage = (
  threshold: SeverityThreshold,
  result: LintRunResult,
): string => {
  const topFindings = result.findings
    .filter((finding) => exceedsThreshold(finding.severity, threshold))
    .slice(0, 5)
    .map((finding) => {
      const operation =
        finding.operation?.method && finding.operation?.path
          ? ` ${finding.operation.method.toUpperCase()} ${finding.operation.path}`
          : '';

      return `[${finding.severity}] ${finding.code}${operation}: ${finding.message}`;
    });

  const lines = [
    `OpenAPI lint failed at threshold "${threshold}".`,
    `Summary: ${result.summary.error} error(s), ${result.summary.warn} warning(s), ${result.summary.info} info finding(s), ${result.summary.hint} hint(s).`,
  ];

  if (topFindings.length > 0) {
    lines.push('Top findings:');
    lines.push(...topFindings);
  }

  return lines.join('\n');
};
