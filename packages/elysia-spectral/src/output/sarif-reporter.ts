import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LintFinding, LintRunResult } from '../types';

const SARIF_SCHEMA_URI =
  'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/schemas/sarif-schema-2.1.0.json';

export const writeSarifReport = async (
  reportPath: string,
  result: LintRunResult,
  pretty = true,
): Promise<string> => {
  const resolvedPath = path.resolve(process.cwd(), reportPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(
    resolvedPath,
    `${JSON.stringify(buildSarifReport(result), null, pretty ? 2 : 0)}\n`,
    'utf8',
  );

  return resolvedPath;
};

export const buildSarifReport = (
  result: LintRunResult,
): Record<string, unknown> => {
  const defaultArtifactPath =
    result.artifacts?.specSnapshotPath &&
    result.artifacts.specSnapshotPath.length > 0
      ? toSarifArtifactUri(result.artifacts.specSnapshotPath)
      : 'openapi.json';
  const rulesById = buildSarifRules(result.findings);

  return {
    $schema: SARIF_SCHEMA_URI,
    version: '2.1.0',
    runs: [
      {
        automationDetails: {
          id: '@opsydyn/elysia-spectral/openapi-lint',
        },
        originalUriBaseIds: {
          '%SRCROOT%': {
            uri: pathToFileURL(`${process.cwd()}${path.sep}`).href,
          },
        },
        tool: {
          driver: {
            name: '@opsydyn/elysia-spectral',
            informationUri: 'https://github.com/stoplightio/spectral',
            rules: [...rulesById.values()],
          },
        },
        results: result.findings.map((finding) =>
          buildSarifResult(finding, defaultArtifactPath, rulesById),
        ),
      },
    ],
  };
};

const buildSarifRules = (
  findings: LintFinding[],
): Map<string, Record<string, unknown>> => {
  const findingsById = new Map<string, LintFinding>();

  for (const finding of findings) {
    if (!findingsById.has(finding.code)) {
      findingsById.set(finding.code, finding);
    }
  }

  return new Map(
    [...findingsById.values()].map((finding) => [
      finding.code,
      {
        id: finding.code,
        name: finding.code,
        shortDescription: {
          text: finding.message,
        },
        helpUri: 'https://github.com/stoplightio/spectral',
        defaultConfiguration: {
          level: toSarifLevel(finding.severity),
        },
        help: finding.recommendation
          ? {
              text: finding.recommendation,
            }
          : undefined,
        properties: {
          tags: ['openapi', 'spectral', finding.severity],
        },
      },
    ]),
  );
};

const buildSarifResult = (
  finding: LintFinding,
  defaultArtifactPath: string,
  rulesById: Map<string, Record<string, unknown>>,
): Record<string, unknown> => {
  const location = buildSarifLocation(finding, defaultArtifactPath);

  return {
    ruleId: finding.code,
    ruleIndex: [...rulesById.keys()].indexOf(finding.code),
    level: toSarifLevel(finding.severity),
    message: {
      text: finding.message,
    },
    locations: location ? [location] : undefined,
    partialFingerprints: {
      primaryLocationLineHash: [
        finding.code,
        finding.documentPointer ?? '(document)',
        finding.message,
      ].join(':'),
    },
    properties: {
      severity: finding.severity,
      documentPointer: finding.documentPointer,
      operationId: finding.operation?.operationId,
    },
  };
};

const buildSarifLocation = (
  finding: LintFinding,
  defaultArtifactPath: string,
): Record<string, unknown> | undefined => {
  const region =
    finding.range?.start && finding.range?.end
      ? {
          startLine: finding.range.start.line + 1,
          startColumn: finding.range.start.character + 1,
          endLine: finding.range.end.line + 1,
          endColumn: finding.range.end.character + 1,
        }
      : undefined;

  const uri = defaultArtifactPath;

  if (!uri) {
    return undefined;
  }

  return {
    physicalLocation: {
      artifactLocation: {
        uri,
        uriBaseId: '%SRCROOT%',
      },
      region,
    },
    logicalLocations: finding.operation?.path
      ? [
          {
            name:
              finding.operation.method && finding.operation.path
                ? `${finding.operation.method.toUpperCase()} ${finding.operation.path}`
                : finding.operation.path,
            fullyQualifiedName: finding.operation.operationId,
          },
        ]
      : undefined,
  };
};

const toSarifLevel = (
  severity: LintFinding['severity'],
): 'error' | 'warning' | 'note' => {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    default:
      return 'note';
  }
};

const toSarifArtifactUri = (value: string): string => {
  if (!path.isAbsolute(value)) {
    return value;
  }

  return path.relative(process.cwd(), value) || path.basename(value);
};
