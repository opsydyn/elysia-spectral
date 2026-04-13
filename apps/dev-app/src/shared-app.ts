import path from 'node:path';
import { styleText } from 'node:util';
import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';
import { spectralPlugin } from 'elysia-spectral';

type ExampleMode = 'happy' | 'unhappy';

const defaultPortByMode: Record<ExampleMode, number> = {
  happy: 3000,
  unhappy: 3001,
};

export const createExampleApp = (mode: ExampleMode) => {
  const unhappy = mode === 'unhappy';

  const app = new Elysia()
    .use(
      openapi({
        documentation: {
          info: {
            title: unhappy
              ? 'elysia-spectral unhappy dev app'
              : 'elysia-spectral dev app',
            version: '0.1.0',
          },
          tags: [
            {
              name: unhappy ? 'Dev' : 'Users',
              description: unhappy
                ? 'Development fixture operations'
                : 'User operations',
            },
          ],
        },
      }),
    )
    .use(
      spectralPlugin({
        failOn: unhappy ? 'warn' : 'error',
        enabled: !unhappy,
        output: {
          console: !unhappy,
          jsonReportPath: unhappy
            ? './artifacts/openapi-lint-unhappy.json'
            : './artifacts/openapi-lint.json',
          specSnapshotPath: true,
        },
        healthcheck: {
          path: '/health/openapi-lint',
        },
      }),
    )
    .get(
      '/',
      () => ({
        service: unhappy
          ? 'elysia-spectral-unhappy-dev-app'
          : 'elysia-spectral-dev-app',
        openapi: '/openapi',
        spec: '/openapi/json',
        healthcheck: unhappy
          ? '/health/openapi-lint?fresh=1'
          : '/health/openapi-lint',
        ...(unhappy ? { intentionallyBrokenRoute: '/broken-users' } : {}),
      }),
      {
        response: {
          200: unhappy
            ? t.Object({
                service: t.String(),
                openapi: t.String(),
                spec: t.String(),
                healthcheck: t.String(),
                intentionallyBrokenRoute: t.String(),
              })
            : t.Object({
                service: t.String(),
                openapi: t.String(),
                spec: t.String(),
                healthcheck: t.String(),
              }),
        },
        detail: {
          summary: unhappy
            ? 'Show unhappy dev endpoints'
            : 'Show dev endpoints',
          description: unhappy
            ? 'Return the local endpoints exposed by the intentionally failing dev fixture app.'
            : 'Return the local endpoints exposed by the dev fixture app.',
          operationId: unhappy ? 'getUnhappyDevEndpoints' : 'getDevEndpoints',
          tags: [unhappy ? 'Dev' : 'Users'],
        },
      },
    )
    .get('/users', () => [{ id: '1', name: 'Ada Lovelace' }], {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
          }),
        ),
      },
      detail: {
        summary: 'List users',
        description: unhappy
          ? 'Return all users from the unhappy dev fixture endpoint.'
          : 'Return all users from the dev fixture endpoint.',
        operationId: unhappy ? 'listUsersUnhappyFixture' : 'listUsers',
        tags: [unhappy ? 'Dev' : 'Users'],
      },
    });

  if (unhappy) {
    return app.get('/broken-users', () => [
      { id: '2', name: 'Broken Example' },
    ]);
  }

  return app;
};

export const startExampleApp = (mode: ExampleMode) => {
  const port = Number(process.env.PORT ?? defaultPortByMode[mode]);
  const unhappy = mode === 'unhappy';
  const app = createExampleApp(mode).listen(port);

  console.log(
    `${unhappy ? 'elysia-spectral unhappy dev app' : 'elysia-spectral dev app'} running at http://localhost:${app.server?.port}`,
  );
  console.log(`OpenAPI UI: http://localhost:${app.server?.port}/openapi`);
  console.log(
    `OpenAPI JSON: http://localhost:${app.server?.port}/openapi/json`,
  );
  console.log(
    `Healthcheck: http://localhost:${app.server?.port}${unhappy ? '/health/openapi-lint?fresh=1' : '/health/openapi-lint'}`,
  );

  if (unhappy) {
    console.log(
      `Broken route: http://localhost:${app.server?.port}/broken-users`,
    );
    void logUnhappyLintFeedback(app.server?.port);
  }

  console.log('Spec snapshot: ./elysia-spectral-dev-app.open-api.json');

  return app;
};

type UnhappyLintResponse = {
  ok: boolean;
  cached: boolean;
  threshold: string;
  error?: string;
  result?: {
    summary: {
      error: number;
      warn: number;
      info: number;
      hint: number;
      total: number;
    };
    artifacts?: {
      specSnapshotPath?: string;
    };
    findings: Array<{
      code: string;
      message: string;
      severity: string;
      documentPointer?: string;
      recommendation?: string;
      operation?: {
        method?: string;
        path?: string;
      };
    }>;
  };
};

const logUnhappyLintFeedback = async (port: number | undefined) => {
  if (!port) {
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/health/openapi-lint?fresh=1`,
    );
    const body = (await response.json()) as UnhappyLintResponse;

    if (!body.result || body.result.findings.length === 0) {
      return;
    }

    console.log('');
    console.log(
      [
        styleText(['bold', 'white', 'bgCyan'], ' OPENAPI LINT FEEDBACK '),
        formatStatusBadge(body.result.summary.error > 0 ? 'fail' : 'pass'),
        formatSummaryCounts(body.result.summary),
      ].join('  '),
    );
    console.log(formatDivider());

    const sections = [
      {
        severity: 'error' as const,
        title: `ERRORS (${body.result.summary.error})`,
        findings: body.result.findings.filter((finding) => finding.severity === 'error'),
      },
      {
        severity: 'warn' as const,
        title: `WARNINGS (${body.result.summary.warn})`,
        findings: body.result.findings.filter((finding) => finding.severity === 'warn'),
      },
      {
        severity: 'info' as const,
        title: `INFO (${body.result.summary.info})`,
        findings: body.result.findings.filter((finding) => finding.severity === 'info'),
      },
      {
        severity: 'hint' as const,
        title: `HINTS (${body.result.summary.hint})`,
        findings: body.result.findings.filter((finding) => finding.severity === 'hint'),
      },
    ].filter((section) => section.findings.length > 0);

    for (const section of sections) {
      console.log(formatSectionHeading(section.title, section.severity));
      console.log(formatDivider());

      for (const finding of section.findings) {
        const specReference =
          finding.documentPointer && body.result.artifacts?.specSnapshotPath
            ? `${body.result.artifacts.specSnapshotPath}#${finding.documentPointer}`
            : finding.documentPointer;

        console.log(formatFindingTitle(finding));
        console.log(`  ${formatKey('issue')} ${finding.message}`);

        if (finding.recommendation) {
          console.log(`  ${formatKey('fix')}   ${finding.recommendation}`);
        }

        if (specReference) {
          console.log(
            `  ${formatKey('spec')}  ${formatSpecReference(specReference)}`,
          );
        }

        console.log(formatDivider());
      }
    }

    if (body.error) {
      console.log(`  ${formatKey('threshold')} ${body.threshold}`);
      console.log('Why startup is still running: unhappy mode disables startup failure and runs lint on demand.');
    }

    console.log(
      [
        styleText(['bold', 'white', 'bgCyan'], ' SUMMARY '),
        formatStatusBadge(body.result.summary.error > 0 ? 'fail' : 'pass'),
        formatSummaryCounts(body.result.summary),
      ].join('  '),
    );
    console.log('');
  } catch (error) {
    console.warn(
      `Unable to fetch unhappy lint feedback: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const formatSeverityLabel = (severity: string): string => {
  switch (severity) {
    case 'error':
      return ` ${styleText(['bold', 'white', 'bgRed'], 'ERROR')} `;
    case 'warn':
      return ` ${styleText(['bold', 'black', 'bgYellow'], 'WARN')} `;
    case 'info':
      return ` ${styleText(['bold', 'white', 'bgBlue'], 'INFO')} `;
    default:
      return ` ${styleText(['bold', 'white', 'bgBlack'], 'HINT')} `;
  }
};

const formatFindingTitle = (finding: NonNullable<UnhappyLintResponse['result']>['findings'][number]): string => {
  const location =
    finding.operation?.method && finding.operation?.path
      ? `${finding.operation.method.toUpperCase()} ${finding.operation.path}`
      : (finding.documentPointer ?? '(document)');

  return `${formatSeverityLabel(finding.severity)} ${styleText('bold', finding.code)}  ${location}`;
};

const formatKey = (
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

const formatDivider = (): string =>
  styleText('gray', '------------------------------------------------------------');

const formatSectionHeading = (
  value: string,
  severity: 'error' | 'warn' | 'info' | 'hint',
): string => {
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

const formatCount = (
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

const formatStatusBadge = (status: 'pass' | 'fail'): string =>
  status === 'pass'
    ? styleText(['bold', 'white', 'bgGreen'], ' PASS ')
    : styleText(['bold', 'white', 'bgRed'], ' FAIL ');

const formatSummaryCounts = (
  summary: NonNullable<UnhappyLintResponse['result']>['summary'],
): string =>
  [
    `${formatCount(summary.error, 'error')} error(s)`,
    `${formatCount(summary.warn, 'warn')} warning(s)`,
    `${formatCount(summary.info, 'info')} info finding(s)`,
    `${formatCount(summary.hint, 'hint')} hint(s)`,
  ].join('  ');

const formatSpecReference = (value: string): string => {
  const [filePath, pointer] = value.split('#', 2);
  if (!filePath) {
    return value;
  }

  const shortPath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath) || path.basename(filePath)
    : filePath;

  return pointer ? `${shortPath}#${pointer}` : shortPath;
};
