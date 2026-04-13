import type { LintFinding, LintRunResult, SpectralLogger } from '../types';
import {
  formatDivider,
  formatHeading,
  formatFindingTitle,
  formatKey,
  formatPassCard,
  formatSectionHeading,
  formatStatusBadge,
  formatSpecReference,
  formatSummaryCounts,
} from './terminal-format';

const defaultLogger: SpectralLogger = {
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export const resolveLogger = (logger?: SpectralLogger): SpectralLogger =>
  logger ?? defaultLogger;

export const reportToConsole = (
  result: LintRunResult,
  logger: SpectralLogger = defaultLogger,
): void => {
  const failed = result.summary.error > 0;
  const summaryLine = [
    formatHeading('OPENAPI LINT'),
    formatStatusBadge(failed ? 'fail' : 'pass'),
    formatSummaryCounts(result.summary),
  ].join('  ');

  if (result.summary.total === 0) {
    logger.info(formatPassCard(result.summary));
    return;
  }

  if (result.summary.error > 0) {
    logger.error(summaryLine);
  } else {
    logger.warn(summaryLine);
  }

  logger.info(formatDivider());

  const sections = [
    {
      severity: 'error' as const,
      title: `ERRORS (${result.summary.error})`,
      findings: result.findings.filter((finding) => finding.severity === 'error'),
    },
    {
      severity: 'warn' as const,
      title: `WARNINGS (${result.summary.warn})`,
      findings: result.findings.filter((finding) => finding.severity === 'warn'),
    },
    {
      severity: 'info' as const,
      title: `INFO (${result.summary.info})`,
      findings: result.findings.filter((finding) => finding.severity === 'info'),
    },
    {
      severity: 'hint' as const,
      title: `HINTS (${result.summary.hint})`,
      findings: result.findings.filter((finding) => finding.severity === 'hint'),
    },
  ].filter((section) => section.findings.length > 0);

  for (const section of sections) {
    logger.info(formatSectionHeading(section.title, section.severity));
    logger.info(formatDivider());

    for (const finding of section.findings) {
      logFinding(finding, logger, result.artifacts?.specSnapshotPath);
    }
  }

  logger.info(
    [
      formatHeading('SUMMARY'),
      formatStatusBadge(failed ? 'fail' : 'pass'),
      formatSummaryCounts(result.summary),
    ].join('  '),
  );
};

const logFinding = (
  finding: LintFinding,
  logger: SpectralLogger,
  specSnapshotPath?: string,
): void => {
  const specReference = buildSpecReference(finding, specSnapshotPath);
  const title = formatFindingTitle(finding);

  switch (finding.severity) {
    case 'error':
      logger.error(title);
      break;
    case 'warn':
      logger.warn(title);
      break;
    default:
      logger.info(title);
      break;
  }

  logger.info(`  ${formatKey('issue')} ${finding.message}`);

  if (finding.recommendation) {
    logger.info(`  ${formatKey('fix')}   ${finding.recommendation}`);
  }

  if (specReference) {
    logger.info(`  ${formatKey('spec')}  ${formatSpecReference(specReference)}`);
  }

  logger.info(formatDivider());
};

const buildSpecReference = (
  finding: LintFinding,
  specSnapshotPath?: string,
): string | undefined => {
  if (!finding.documentPointer) {
    return specSnapshotPath;
  }

  if (!specSnapshotPath) {
    return `openapi.json#${finding.documentPointer}`;
  }

  return `${specSnapshotPath}#${finding.documentPointer}`;
};
