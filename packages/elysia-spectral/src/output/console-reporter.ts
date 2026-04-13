import type { LintFinding, LintRunResult, SpectralLogger } from '../types';

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
  const summaryLine = `OpenAPI lint: ${result.summary.error} error(s), ${result.summary.warn} warning(s), ${result.summary.info} info finding(s), ${result.summary.hint} hint(s).`;

  if (result.summary.total === 0) {
    logger.info('OpenAPI lint passed with 0 findings.');
    return;
  }

  if (result.summary.error > 0) {
    logger.error(summaryLine);
  } else {
    logger.warn(summaryLine);
  }

  for (const finding of result.findings) {
    logFinding(finding, logger);
  }
};

const logFinding = (finding: LintFinding, logger: SpectralLogger): void => {
  const location =
    finding.operation?.method && finding.operation?.path
      ? `${finding.operation.method.toUpperCase()} ${finding.operation.path}`
      : (finding.documentPointer ?? '(document)');

  const message = `[${finding.severity}] ${finding.code} ${location} ${finding.message}`;

  switch (finding.severity) {
    case 'error':
      logger.error(message);
      break;
    case 'warn':
      logger.warn(message);
      break;
    default:
      logger.info(message);
      break;
  }
};
