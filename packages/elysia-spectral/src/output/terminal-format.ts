import path from 'node:path';
import { styleText } from 'node:util';
import type { LintFinding, LintRunResult, LintSeverity } from '../types';

const severityStyles: Record<LintSeverity, Parameters<typeof styleText>[0]> = {
  error: ['bold', 'white', 'bgRed'],
  warn: ['bold', 'black', 'bgYellow'],
  info: ['bold', 'cyan'],
  hint: ['bold', 'gray'],
};

export const formatSeverityLabel = (severity: LintSeverity): string =>
  ` ${styleText(severityStyles[severity], severity.toUpperCase())} `;

export const formatMuted = (value: string): string => styleText('gray', value);

export const formatHeading = (value: string): string =>
  styleText(['bold', 'white', 'bgCyan'], ` ${value} `);

export const formatStatusBadge = (status: 'pass' | 'fail'): string =>
  status === 'pass'
    ? styleText(['bold', 'white', 'bgGreen'], ' PASS ')
    : styleText(['bold', 'white', 'bgRed'], ' FAIL ');

export const formatPassCard = (summary: LintRunResult['summary']): string => {
  const lines = [
    `${styleText(['bold', 'white'], 'OPENAPI LINT')}  ${styleText(['bold', 'white', 'bgGreen'], 'PASS')}`,
    `${styleText(['bold', 'green'], String(summary.error))} errors  ${styleText(['bold', 'green'], String(summary.warn))} warns  ${styleText(['bold', 'green'], String(summary.info))} info`,
    styleText(['bold', 'green'], 'SPEC IS TIGHT, SHIP IT RIGHT'),
  ];

  return styleText('green', buildCard(lines));
};

export const formatSectionHeading = (
  value: string,
  severity?: LintSeverity,
): string => {
  if (!severity) {
    return styleText(['bold', 'white', 'bgBlue'], ` ${value} `);
  }

  switch (severity) {
    case 'error':
      return styleText(['bold', 'white', 'bgRed'], ` ${value} `);
    case 'warn':
      return styleText(['bold', 'black', 'bgYellow'], ` ${value} `);
    case 'info':
      return styleText(['bold', 'white', 'bgBlue'], ` ${value} `);
    case 'hint':
      return styleText(['bold', 'white', 'bgBlack'], ` ${value} `);
  }
};

export const formatKey = (
  kind: 'issue' | 'fix' | 'spec' | 'threshold',
): string => {
  switch (kind) {
    case 'issue':
      return styleText(['bold', 'cyan'], 'Issue');
    case 'fix':
      return styleText(['bold', 'green'], 'Fix');
    case 'spec':
      return styleText(['bold', 'magenta'], 'Spec');
    case 'threshold':
      return styleText(['bold', 'yellow'], 'Threshold');
  }
};

export const formatDivider = (): string =>
  styleText(
    'gray',
    '------------------------------------------------------------',
  );

export const formatCount = (
  value: number,
  severity: 'error' | 'warn' | 'info' | 'hint',
): string => {
  switch (severity) {
    case 'error':
      return styleText(['bold', 'red'], String(value));
    case 'warn':
      return styleText(['bold', 'yellow'], String(value));
    case 'info':
      return styleText(['bold', 'cyan'], String(value));
    default:
      return styleText(['bold', 'gray'], String(value));
  }
};

export const formatSummaryCounts = (
  summary: LintRunResult['summary'],
): string =>
  [
    `${formatCount(summary.error, 'error')} error(s)`,
    `${formatCount(summary.warn, 'warn')} warning(s)`,
    `${formatCount(summary.info, 'info')} info finding(s)`,
    `${formatCount(summary.hint, 'hint')} hint(s)`,
  ].join('  ');

export const formatCompactSummaryCounts = (
  summary: LintRunResult['summary'],
): string =>
  [
    `${formatCount(summary.error, 'error')} errors`,
    `${formatCount(summary.warn, 'warn')} warnings`,
    `${formatCount(summary.info, 'info')} info`,
    `${formatCount(summary.hint, 'hint')} hints`,
  ].join('  ');

export const formatSpecReference = (value: string): string => {
  const [filePath, pointer] = value.split('#', 2);
  if (!filePath) {
    return value;
  }

  const shortPath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath) || path.basename(filePath)
    : filePath;

  return pointer ? `${shortPath}#${pointer}` : shortPath;
};

export const formatFindingTitle = (
  finding: Pick<
    LintFinding,
    'code' | 'severity' | 'operation' | 'documentPointer'
  >,
): string => {
  const location =
    finding.operation?.method && finding.operation?.path
      ? `${finding.operation.method.toUpperCase()} ${finding.operation.path}`
      : (finding.documentPointer ?? '(document)');

  return `${formatSeverityLabel(finding.severity)} ${styleText('bold', finding.code)}  ${location}`;
};

const buildCard = (lines: string[]): string => {
  const innerWidth =
    Math.max(...lines.map((line) => stripAnsi(line).length)) + 2;
  const top = `┌${'─'.repeat(innerWidth)}┐`;
  const bottom = `└${'─'.repeat(innerWidth)}┘`;
  const body = lines.map((line) => padCardLine(line, innerWidth));

  return [top, ...body, bottom].join('\n');
};

const padCardLine = (content: string, innerWidth: number): string => {
  const plainLength = stripAnsi(content).length;
  const padding = Math.max(innerWidth - plainLength - 1, 0);

  return `│ ${content}${' '.repeat(padding)}│`;
};

const stripAnsi = (value: string): string =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence requires the ESC control character
  value.replace(/\u001B\[[0-9;]*m/g, '');
