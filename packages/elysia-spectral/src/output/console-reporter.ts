import signale from 'signale';
import type { LintFinding, LintRunResult, SpectralLogger } from '../types';
import {
  formatCompactSummaryCounts,
  formatDivider,
  formatFindingTitle,
  formatKey,
  formatPassCard,
  formatSectionHeading,
  formatSpecReference,
  formatSummaryCounts,
} from './terminal-format';

type SpectralReporter = SpectralLogger & {
  log: (message: string) => void;
  note: (message: string) => void;
  start: (message: string) => void;
  complete: (message: string) => void;
  success: (message: string) => void;
  awaiting: (message: string) => void;
  artifact: (message: string) => void;
  ruleset: (message: string) => void;
  report: (message: string) => void;
  hype: (message: string) => void;
};

type CustomReporterType = 'artifact' | 'ruleset' | 'report' | 'hype';

const { Signale } = signale;

const defaultSignale = new Signale<CustomReporterType>({
  scope: 'elysia-spectral',
  interactive: false,
  types: {
    artifact: {
      badge: '◆',
      color: 'cyan',
      label: 'artifact',
      logLevel: 'info',
    },
    ruleset: {
      badge: '◌',
      color: 'blue',
      label: 'ruleset',
      logLevel: 'info',
    },
    report: {
      badge: '↺',
      color: 'magenta',
      label: 'report',
      logLevel: 'warn',
    },
    hype: {
      badge: '▲',
      color: 'magenta',
      label: 'hype',
      logLevel: 'info',
    },
  },
});

const defaultReporter: SpectralReporter = {
  info: (message) => defaultSignale.log(message),
  warn: (message) => defaultSignale.warn(message),
  error: (message) => defaultSignale.error(message),
  log: (message) => defaultSignale.log(message),
  note: (message) => defaultSignale.note(message),
  start: (message) => defaultSignale.start(message),
  complete: (message) => defaultSignale.complete(message),
  success: (message) => defaultSignale.success(message),
  awaiting: (message) => defaultSignale.await(message),
  artifact: (message) => defaultSignale.artifact(message),
  ruleset: (message) => defaultSignale.ruleset(message),
  report: (message) => defaultSignale.report(message),
  hype: (message) => defaultSignale.hype(message),
};

export const resolveLogger = (logger?: SpectralLogger): SpectralLogger =>
  resolveReporter(logger);

export const resolveReporter = (logger?: SpectralLogger): SpectralReporter => {
  if (!logger) {
    return defaultReporter;
  }

  return {
    ...logger,
    log: (message) => logger.info(message),
    note: (message) => logger.info(message),
    start: (message) => logger.info(message),
    complete: (message) => logger.info(message),
    success: (message) => logger.info(message),
    awaiting: (message) => logger.info(message),
    artifact: (message) => logger.info(message),
    ruleset: (message) => logger.info(message),
    report: (message) => logger.warn(message),
    hype: (message) => logger.info(message),
  };
};

export const reportToConsole = (
  result: LintRunResult,
  logger: SpectralLogger = defaultReporter,
): void => {
  const reporter = resolveReporter(logger);
  const summaryCounts = formatSummaryCounts(result.summary);

  if (result.summary.total === 0) {
    reporter.success('OpenAPI lint passed.');
    reporter.note(formatCompactSummaryCounts(result.summary));
    reporter.hype(formatPassCard(result.summary));
    return;
  }

  if (result.summary.error > 0) {
    reporter.error(`OpenAPI lint found contract failures. ${summaryCounts}`);
  } else {
    reporter.warn(`OpenAPI lint found warnings. ${summaryCounts}`);
  }

  reporter.log(formatDivider());

  const sections = [
    {
      severity: 'error' as const,
      title: `ERRORS (${result.summary.error})`,
      findings: result.findings.filter(
        (finding) => finding.severity === 'error',
      ),
    },
    {
      severity: 'warn' as const,
      title: `WARNINGS (${result.summary.warn})`,
      findings: result.findings.filter(
        (finding) => finding.severity === 'warn',
      ),
    },
    {
      severity: 'info' as const,
      title: `INFO (${result.summary.info})`,
      findings: result.findings.filter(
        (finding) => finding.severity === 'info',
      ),
    },
    {
      severity: 'hint' as const,
      title: `HINTS (${result.summary.hint})`,
      findings: result.findings.filter(
        (finding) => finding.severity === 'hint',
      ),
    },
  ].filter((section) => section.findings.length > 0);

  for (const section of sections) {
    reporter.log(formatSectionHeading(section.title, section.severity));
    reporter.log(formatDivider());

    for (const finding of section.findings) {
      logFinding(finding, reporter, result.artifacts?.specSnapshotPath);
    }
  }

  reporter.note(`Summary: ${summaryCounts}`);
};

const logFinding = (
  finding: LintFinding,
  reporter: SpectralReporter,
  specSnapshotPath?: string,
): void => {
  const specReference = buildSpecReference(finding, specSnapshotPath);
  const title = formatFindingTitle(finding);
  reporter.log(title);

  reporter.log(`  ${formatKey('issue')} ${finding.message}`);

  if (finding.recommendation) {
    reporter.log(`  ${formatKey('fix')}   ${finding.recommendation}`);
  }

  if (specReference) {
    reporter.log(
      `  ${formatKey('spec')}  ${formatSpecReference(specReference)}`,
    );
  }

  reporter.log(formatDivider());
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
