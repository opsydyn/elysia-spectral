import type {
  LintRunResult,
  OpenApiLintArtifacts,
  OpenApiLintSink,
  OpenApiLintSinkContext,
  SpectralPluginOptions,
} from '../types';
import { reportToConsole, resolveReporter } from './console-reporter';
import { resolveDefaultSpecSnapshotPath, writeJsonReport, writeSpecSnapshot } from './json-reporter';
import { writeJunitReport } from './junit-reporter';
import { writeSarifReport } from './sarif-reporter';

type BuiltInSink = {
  name: string;
  kind: 'artifact' | 'report' | 'custom';
  write: (
    result: LintRunResult,
    context: OpenApiLintSinkContext,
  ) => Promise<void | Partial<OpenApiLintArtifacts>>;
};

export const createOutputSinks = (
  options: SpectralPluginOptions,
): BuiltInSink[] => {
  const reporter = resolveReporter(options.logger);
  const sinks: BuiltInSink[] = [];
  const configuredSpecSnapshotPath = options.output?.specSnapshotPath;
  const configuredJsonReportPath = options.output?.jsonReportPath;
  const configuredJunitReportPath = options.output?.junitReportPath;
  const configuredSarifReportPath = options.output?.sarifReportPath;

  if (configuredSpecSnapshotPath) {
    sinks.push({
      name: 'spec snapshot',
      kind: 'artifact',
      async write(_result, context) {
        const snapshotTarget =
          configuredSpecSnapshotPath === true
            ? await resolveDefaultSpecSnapshotPath()
            : configuredSpecSnapshotPath;
        const writtenSpecSnapshotPath = await writeSpecSnapshot(
          snapshotTarget,
          context.spec,
          options.output?.pretty !== false,
        );

        reporter.artifact(
          `OpenAPI lint wrote spec snapshot to ${writtenSpecSnapshotPath}.`,
        );

        return { specSnapshotPath: writtenSpecSnapshotPath };
      },
    });
  }

  if (configuredJsonReportPath) {
    sinks.push({
      name: 'JSON report',
      kind: 'artifact',
      async write(result) {
        const writtenJsonReportPath = await writeJsonReport(
          configuredJsonReportPath,
          result,
          options.output?.pretty !== false,
        );

        reporter.artifact(
          `OpenAPI lint wrote JSON report to ${writtenJsonReportPath}.`,
        );

        return { jsonReportPath: writtenJsonReportPath };
      },
    });
  }

  if (configuredJunitReportPath) {
    sinks.push({
      name: 'JUnit report',
      kind: 'artifact',
      async write(result) {
        const writtenJunitReportPath = await writeJunitReport(
          configuredJunitReportPath,
          result,
        );

        reporter.artifact(
          `OpenAPI lint wrote JUnit report to ${writtenJunitReportPath}.`,
        );

        return { junitReportPath: writtenJunitReportPath };
      },
    });
  }

  if (configuredSarifReportPath) {
    sinks.push({
      name: 'SARIF report',
      kind: 'artifact',
      async write(result) {
        const writtenSarifReportPath = await writeSarifReport(
          configuredSarifReportPath,
          result,
          options.output?.pretty !== false,
        );

        reporter.artifact(
          `OpenAPI lint wrote SARIF report to ${writtenSarifReportPath}.`,
        );

        return { sarifReportPath: writtenSarifReportPath };
      },
    });
  }

  for (const sink of options.output?.sinks ?? []) {
    sinks.push({
      name: sink.name,
      kind: 'custom',
      write: async (result, context) =>
        await Promise.resolve(sink.write(result, context)),
    });
  }

  if (options.output?.console !== false) {
    sinks.push({
      name: 'console',
      kind: 'report',
      async write(result) {
        reportToConsole(result, reporter);
      },
    });
  }

  return sinks;
};
