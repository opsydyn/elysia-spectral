import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import type { LintFinding, LintRunResult, LintSeverity } from '../types';
import { getFindingRecommendation } from './finding-guidance';

const httpMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

export const normalizeFindings = (
  diagnostics: ISpectralDiagnostic[],
  spec: unknown,
): LintRunResult => {
  const findings = diagnostics.map((diagnostic) =>
    normalizeFinding(diagnostic, spec),
  );

  const summary = findings.reduce(
    (current, finding) => {
      current[finding.severity] += 1;
      current.total += 1;
      return current;
    },
    {
      error: 0,
      warn: 0,
      info: 0,
      hint: 0,
      total: 0,
    },
  );

  return {
    ok: summary.error === 0,
    generatedAt: new Date().toISOString(),
    summary,
    findings,
  };
};

const normalizeFinding = (
  diagnostic: ISpectralDiagnostic,
  spec: unknown,
): LintFinding => {
  const path = [...diagnostic.path];
  const finding: LintFinding = {
    code: String(diagnostic.code),
    message: diagnostic.message,
    severity: toLintSeverity(diagnostic.severity),
    path,
    documentPointer: toDocumentPointer(path),
  };

  const recommendation = getFindingRecommendation(
    String(diagnostic.code),
    diagnostic.message,
  );
  if (recommendation) {
    finding.recommendation = recommendation;
  }

  if (diagnostic.source !== undefined) {
    finding.source = diagnostic.source;
  }

  if (diagnostic.range) {
    finding.range = {
      start: diagnostic.range.start,
      end: diagnostic.range.end,
    };
  }

  const operation = inferOperation(path, spec);
  if (operation) {
    finding.operation = operation;
  }

  return finding;
};

const toLintSeverity = (severity: number): LintSeverity => {
  switch (severity) {
    case 0:
      return 'error';
    case 1:
      return 'warn';
    case 2:
      return 'info';
    default:
      return 'hint';
  }
};

const toDocumentPointer = (path: Array<string | number>): string => {
  if (path.length === 0) {
    return '';
  }

  return `/${path
    .map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/')}`;
};

const inferOperation = (
  path: Array<string | number>,
  spec: unknown,
): LintFinding['operation'] | undefined => {
  if (path[0] !== 'paths') {
    return undefined;
  }

  const routePath = typeof path[1] === 'string' ? path[1] : undefined;
  const method =
    typeof path[2] === 'string' && httpMethods.has(path[2])
      ? path[2]
      : undefined;

  if (!routePath && !method) {
    return undefined;
  }

  const operationRecord =
    routePath && method
      ? getNestedValue(spec, ['paths', routePath, method])
      : undefined;

  const operation: NonNullable<LintFinding['operation']> = {};

  if (routePath !== undefined) {
    operation.path = routePath;
  }

  if (method !== undefined) {
    operation.method = method;
  }

  if (
    operationRecord &&
    typeof operationRecord === 'object' &&
    'operationId' in operationRecord
  ) {
    operation.operationId = String(
      (operationRecord as { operationId?: unknown }).operationId,
    );
  }

  return operation;
};

const getNestedValue = (
  value: unknown,
  path: Array<string | number>,
): unknown => {
  let current = value;

  for (const segment of path) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string | number, unknown>)[segment];
  }

  return current;
};
