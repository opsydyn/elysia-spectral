import path from 'node:path';
import type {
  LintRunResult,
  OpenApiLintArtifacts,
  OpenApiLintSinkContext,
  SpectralPluginOptions,
} from '../types';
import { writeBrunoCollection } from './bruno-reporter';
import { reportToConsole, resolveReporter } from './console-reporter';
import {
  resolveDefaultSpecSnapshotPath,
  writeJsonReport,
  writeSpecSnapshot,
} from './json-reporter';
import { writeJunitReport } from './junit-reporter';
import { writeSarifReport } from './sarif-reporter';

type BuiltInSink = {
  name: string;
  kind: 'artifact' | 'report' | 'custom';
  phase: 'pre-finalize' | 'post-finalize';
  write: (
    result: LintRunResult,
    context: OpenApiLintSinkContext,
  ) => Promise<undefined | Partial<OpenApiLintArtifacts>>;
};

const relativiseArtifactPath = (artifactPath: string): string => {
  const resolvedPath = path.resolve(process.cwd(), artifactPath);
  const relativePath = path.relative(process.cwd(), resolvedPath);

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
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
      phase: 'pre-finalize',
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

  if (configuredJunitReportPath) {
    sinks.push({
      name: 'JUnit report',
      kind: 'artifact',
      phase: 'pre-finalize',
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

  const configuredBrunoCollectionPath = options.output?.brunoCollectionPath;

  if (configuredBrunoCollectionPath) {
    sinks.push({
      name: 'Bruno collection',
      kind: 'artifact',
      phase: 'pre-finalize',
      async write(_result, context) {
        const writtenPath = await writeBrunoCollection(
          configuredBrunoCollectionPath,
          context.spec,
        );

        reporter.artifact(
          `OpenAPI lint wrote Bruno collection to ${writtenPath}.`,
        );

        return { brunoCollectionPath: writtenPath };
      },
    });
  }

  if (configuredSarifReportPath) {
    sinks.push({
      name: 'SARIF report',
      kind: 'artifact',
      phase: 'pre-finalize',
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
      phase: 'post-finalize',
      write: async (result, context) =>
        (await Promise.resolve(sink.write(result, context))) as
          | Partial<OpenApiLintArtifacts>
          | undefined,
    });
  }

  if (configuredJsonReportPath) {
    sinks.push({
      name: 'JSON report',
      kind: 'artifact',
      phase: 'post-finalize',
      async write(result) {
        const reportResult: LintRunResult = {
          ...result,
          artifacts: {
            ...(result.artifacts ?? {}),
            jsonReportPath: relativiseArtifactPath(configuredJsonReportPath),
          },
        };

        const writtenJsonReportPath = await writeJsonReport(
          configuredJsonReportPath,
          reportResult,
          options.output?.pretty !== false,
        );

        reporter.artifact(
          `OpenAPI lint wrote JSON report to ${writtenJsonReportPath}.`,
        );

        return { jsonReportPath: writtenJsonReportPath };
      },
    });
  }

  if (options.output?.console !== false) {
    sinks.push({
      name: 'console',
      kind: 'report',
      phase: 'post-finalize',
      async write(result) {
        reportToConsole(result, reporter);
        return undefined;
      },
    });
  }

  return sinks;
};
