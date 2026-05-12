import { afterAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import fc from 'fast-check';
import type { SpectralPluginOptions } from '../../src/types';

type RootModule = typeof import('../../src');

type PackedConsumerFixture = {
  consumerDir: string;
  env: NodeJS.ProcessEnv;
  rootModule: RootModule;
  cleanup: () => Promise<void>;
};

const execFileAsync = promisify(execFile);
const maxBuffer = 10 * 1024 * 1024;
const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const versionDirPattern = /^v?(\d+)\.(\d+)\.(\d+)$/u;

const compareVersionNamesDescending = (left: string, right: string): number => {
  const leftMatch = versionDirPattern.exec(left);
  const rightMatch = versionDirPattern.exec(right);

  if (!leftMatch || !rightMatch) {
    return right.localeCompare(left, undefined, { numeric: true });
  }

  const leftParts = leftMatch.slice(1).map((part) => Number(part));
  const rightParts = rightMatch.slice(1).map((part) => Number(part));

  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    const delta = rightPart - leftPart;

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const uniqueStrings = (values: Iterable<string | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
};

const getLatestNvmBinDir = async (): Promise<string | undefined> => {
  const homeDir = process.env.HOME;

  if (!homeDir) {
    return undefined;
  }

  const versionsDir = path.join(homeDir, '.nvm', 'versions', 'node');

  try {
    const entries = await readdir(versionsDir, { withFileTypes: true });
    const versionNames = entries
      .filter(
        (entry) => entry.isDirectory() && versionDirPattern.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort(compareVersionNamesDescending);

    const latestVersion = versionNames.at(0);

    return latestVersion
      ? path.join(versionsDir, latestVersion, 'bin')
      : undefined;
  } catch {
    return undefined;
  }
};

const createSmokeTestEnv = async (): Promise<NodeJS.ProcessEnv> => {
  const homeDir = process.env.HOME;
  const latestNvmBinDir = await getLatestNvmBinDir();
  const existingPathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry.length > 0);

  const pathEntries = uniqueStrings([
    process.env.NVM_BIN,
    latestNvmBinDir,
    homeDir ? path.join(homeDir, '.bun', 'bin') : undefined,
    path.dirname(process.execPath),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    ...existingPathEntries,
  ]);

  return {
    ...process.env,
    PATH: pathEntries.join(path.delimiter),
  };
};

const routePathArb = fc
  .array(
    fc.constantFrom(
      'health',
      'lint',
      'dashboard',
      'api',
      'users',
      'status',
      'openapi',
      'docs',
    ),
    { minLength: 1, maxLength: 4 },
  )
  .map((segments) => `/${segments.join('/')}`);

const tokenArb = fc
  .array(
    fc.constantFrom(
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '-',
    ),
    { minLength: 8, maxLength: 16 },
  )
  .map((segments) => segments.join(''));

const pluginOptionsArb = fc.record({
  preset: fc.option(fc.constantFrom('recommended', 'server', 'strict'), {
    nil: undefined,
  }),
  failOn: fc.option(fc.constantFrom('error', 'warn', 'info', 'hint', 'never'), {
    nil: undefined,
  }),
  enabled: fc.option(fc.boolean(), { nil: undefined }),
  startup: fc.option(
    fc.record({
      mode: fc.option(fc.constantFrom('enforce', 'report', 'off'), {
        nil: undefined,
      }),
    }),
    { nil: undefined },
  ),
  healthcheck: fc.option(
    fc.oneof(
      fc.constant(false),
      fc.record({
        path: fc.option(routePathArb, { nil: undefined }),
      }),
    ),
    { nil: undefined },
  ),
  dashboard: fc.option(
    fc.oneof(
      fc.constant(false),
      fc.record({
        path: fc.option(routePathArb, { nil: undefined }),
        bearerToken: fc.option(tokenArb, { nil: undefined }),
      }),
    ),
    { nil: undefined },
  ),
  output: fc.option(
    fc.record({
      console: fc.option(fc.boolean(), { nil: undefined }),
      jsonReportPath: fc.option(fc.constant('./artifacts/openapi-lint.json'), {
        nil: undefined,
      }),
      junitReportPath: fc.option(
        fc.constant('./artifacts/openapi-lint.junit.xml'),
        {
          nil: undefined,
        },
      ),
      sarifReportPath: fc.option(
        fc.constant('./artifacts/openapi-lint.sarif'),
        {
          nil: undefined,
        },
      ),
      specSnapshotPath: fc.option(
        fc.oneof(
          fc.constant(true),
          fc.constant('./artifacts/openapi-snapshot.json'),
        ),
        { nil: undefined },
      ),
      brunoCollectionPath: fc.option(
        fc.constantFrom('./artifacts/bruno.yml', './artifacts/bruno.json'),
        {
          nil: undefined,
        },
      ),
      pretty: fc.option(fc.boolean(), { nil: undefined }),
      artifactWriteFailures: fc.option(fc.constantFrom('warn', 'error'), {
        nil: undefined,
      }),
    }),
    { nil: undefined },
  ),
  source: fc.option(
    fc.record({
      specPath: fc.option(routePathArb, { nil: undefined }),
      baseUrl: fc.option(
        fc.constantFrom('http://127.0.0.1:3000', 'http://localhost:3000'),
        { nil: undefined },
      ),
    }),
    { nil: undefined },
  ),
});

const pruneUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => pruneUndefined(entry));
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).flatMap(([key, entry]) =>
      entry === undefined ? [] : [[key, pruneUndefined(entry)]],
    );

    return Object.fromEntries(entries);
  }

  return value;
};

const setupPackedConsumerFixture = async (): Promise<PackedConsumerFixture> => {
  const artifactsDir = path.resolve(packageDir, 'artifacts/test');
  await mkdir(artifactsDir, { recursive: true });

  const tempDir = await mkdtemp(path.join(artifactsDir, 'package-smoke-'));
  const unpackDir = path.join(tempDir, 'unpack');
  const consumerDir = path.join(tempDir, 'consumer');
  const scopeDir = path.join(consumerDir, 'node_modules', '@opsydyn');
  const env = await createSmokeTestEnv();

  await execFileAsync('bun', ['run', 'build'], {
    cwd: packageDir,
    env,
    maxBuffer,
  });

  const { stdout } = await execFileAsync('npm', ['pack', '--json'], {
    cwd: packageDir,
    env,
    maxBuffer,
  });
  const packEntries = JSON.parse(stdout) as Array<{ filename: string }>;
  const tarballPath = path.resolve(packageDir, packEntries[0]?.filename ?? '');

  await mkdir(unpackDir, { recursive: true });
  await mkdir(scopeDir, { recursive: true });
  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'elysia-spectral-package-smoke',
        private: true,
        type: 'module',
      },
      null,
      2,
    ),
  );

  await execFileAsync('tar', ['-xzf', tarballPath, '-C', unpackDir], {
    cwd: packageDir,
    env,
    maxBuffer,
  });
  await rename(
    path.join(unpackDir, 'package'),
    path.join(scopeDir, 'elysia-spectral'),
  );

  const rootModule = (await import(
    pathToFileURL(path.join(scopeDir, 'elysia-spectral', 'dist', 'index.mjs'))
      .href
  )) as RootModule;

  return {
    consumerDir,
    env,
    rootModule,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
      await rm(tarballPath, { force: true });
    },
  };
};

const fixturePromise = setupPackedConsumerFixture();

afterAll(async () => {
  const fixture = await fixturePromise;
  await fixture.cleanup();
});

const lastNonEmptyLine = (value: string): string => {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const lastLine = lines.at(-1);
  if (!lastLine) {
    throw new Error(
      `Expected command output, received: ${JSON.stringify(value)}`,
    );
  }

  return lastLine;
};

const packageImportScript = [
  "Promise.all([import('@opsydyn/elysia-spectral'), import('@opsydyn/elysia-spectral/core')])",
  '  .then(([module, coreModule]) => {',
  "    const runtime = module.createOpenApiLintRuntime({ startup: { mode: 'off' } });",
  '    const plugin = module.spectralPlugin({ enabled: false });',
  '    console.log(JSON.stringify({',
  '      rootExports: Object.keys(module).sort(),',
  '      coreExports: Object.keys(coreModule).sort(),',
  '      spectralPlugin: typeof module.spectralPlugin,',
  '      createOpenApiLintRuntime: typeof module.createOpenApiLintRuntime,',
  '      loadRuleset: typeof module.loadRuleset,',
  '      loadResolvedRuleset: typeof module.loadResolvedRuleset,',
  '      lintOpenApi: typeof module.lintOpenApi,',
  '      shouldFail: typeof module.shouldFail,',
  '      enforceThreshold: typeof module.enforceThreshold,',
  '      presets: typeof module.presets,',
  '      strict: typeof module.strict,',
  '      coreLoadResolvedRuleset: typeof coreModule.loadResolvedRuleset,',
  '      coreShouldFail: typeof coreModule.shouldFail,',
  '      coreEnforceThreshold: typeof coreModule.enforceThreshold,',
  '      coreDefaultRulesetResolversIsArray: Array.isArray(coreModule.defaultRulesetResolvers),',
  '      coreDefaultRulesetResolversLength: Array.isArray(coreModule.defaultRulesetResolvers) ? coreModule.defaultRulesetResolvers.length : -1,',
  '      runtimeStatus: runtime.status,',
  '      runtimeRun: typeof runtime.run,',
  '      runtimeLatest: runtime.latest,',
  '      pluginTruthy: Boolean(plugin),',
  '    }));',
  '  })',
  '  .catch((error) => {',
  '    console.error(error);',
  '    process.exit(1);',
  '  });',
].join('\n');

const expectedRootExports = [
  'OpenApiLintArtifactWriteError',
  'OpenApiLintThresholdError',
  'RulesetLoadError',
  'createOpenApiLintRuntime',
  'enforceThreshold',
  'lintOpenApi',
  'loadResolvedRuleset',
  'loadRuleset',
  'presets',
  'recommended',
  'server',
  'shouldFail',
  'spectralPlugin',
  'strict',
] as const;

const expectedCoreExports = [
  'OpenApiLintArtifactWriteError',
  'OpenApiLintThresholdError',
  'RulesetLoadError',
  'createOpenApiLintRuntime',
  'defaultRulesetResolvers',
  'enforceThreshold',
  'lintOpenApi',
  'loadResolvedRuleset',
  'loadRuleset',
  'shouldFail',
] as const;

describe('packed package import smoke', () => {
  it('imports the packed package under Bun and Node without triggering a lint run', async () => {
    const { consumerDir, env } = await fixturePromise;

    const bunRun = await execFileAsync('bun', ['-e', packageImportScript], {
      cwd: consumerDir,
      env,
      maxBuffer,
    });
    const nodeRun = await execFileAsync('node', ['-e', packageImportScript], {
      cwd: consumerDir,
      env,
      maxBuffer,
    });

    const bunPayload = JSON.parse(lastNonEmptyLine(bunRun.stdout)) as {
      rootExports: string[];
      coreExports: string[];
      spectralPlugin: string;
      createOpenApiLintRuntime: string;
      loadRuleset: string;
      loadResolvedRuleset: string;
      lintOpenApi: string;
      shouldFail: string;
      enforceThreshold: string;
      presets: string;
      strict: string;
      coreLoadResolvedRuleset: string;
      coreShouldFail: string;
      coreEnforceThreshold: string;
      coreDefaultRulesetResolversIsArray: boolean;
      coreDefaultRulesetResolversLength: number;
      runtimeStatus: string;
      runtimeRun: string;
      runtimeLatest: unknown;
      pluginTruthy: boolean;
    };
    const nodePayload = JSON.parse(
      lastNonEmptyLine(nodeRun.stdout),
    ) as typeof bunPayload;

    for (const payload of [bunPayload, nodePayload]) {
      expect(payload.rootExports).toEqual([...expectedRootExports]);
      expect(payload.coreExports).toEqual([...expectedCoreExports]);
      expect(payload.spectralPlugin).toBe('function');
      expect(payload.createOpenApiLintRuntime).toBe('function');
      expect(payload.loadRuleset).toBe('function');
      expect(payload.loadResolvedRuleset).toBe('function');
      expect(payload.lintOpenApi).toBe('function');
      expect(payload.shouldFail).toBe('function');
      expect(payload.enforceThreshold).toBe('function');
      expect(payload.presets).toBe('object');
      expect(payload.strict).toBe('object');
      expect(payload.coreLoadResolvedRuleset).toBe('function');
      expect(payload.coreShouldFail).toBe('function');
      expect(payload.coreEnforceThreshold).toBe('function');
      expect(payload.coreDefaultRulesetResolversIsArray).toBe(true);
      expect(payload.coreDefaultRulesetResolversLength).toBeGreaterThan(0);
      expect(payload.runtimeStatus).toBe('idle');
      expect(payload.runtimeRun).toBe('function');
      expect(payload.runtimeLatest).toBeNull();
      expect(payload.pluginTruthy).toBe(true);
    }
  }, 30_000);

  it('constructs packaged root exports across property-based option combinations', async () => {
    const { rootModule } = await fixturePromise;

    await fc.assert(
      fc.asyncProperty(pluginOptionsArb, async (rawOptions) => {
        const options = pruneUndefined(rawOptions) as SpectralPluginOptions;
        const runtime = rootModule.createOpenApiLintRuntime(options);
        const plugin = rootModule.spectralPlugin(options);

        expect(runtime.status).toBe('idle');
        expect(runtime.running).toBe(false);
        expect(runtime.latest).toBeNull();
        expect(runtime.lastSuccess).toBeNull();
        expect(runtime.lastFailure).toBeNull();
        expect(typeof runtime.run).toBe('function');
        expect(Boolean(plugin)).toBe(true);
        expect(typeof rootModule.loadRuleset).toBe('function');
        expect(typeof rootModule.loadResolvedRuleset).toBe('function');
        expect(typeof rootModule.lintOpenApi).toBe('function');
        expect(typeof rootModule.shouldFail).toBe('function');
        expect(typeof rootModule.enforceThreshold).toBe('function');
        expect(rootModule.presets).toBeDefined();
        expect(rootModule.recommended).toBeDefined();
        expect(rootModule.server).toBeDefined();
        expect(rootModule.strict).toBeDefined();
      }),
      {
        numRuns: 40,
      },
    );
  }, 10_000);
});
