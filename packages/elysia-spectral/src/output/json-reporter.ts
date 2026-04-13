import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LintRunResult } from '../types';

const DEFAULT_SPEC_SNAPSHOT_FILENAME = 'open-api.json';

const writeJsonArtifact = async (
  artifactPath: string,
  payload: unknown,
  pretty = true,
): Promise<string> => {
  const resolvedPath = path.resolve(process.cwd(), artifactPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(
    resolvedPath,
    `${JSON.stringify(payload, null, pretty ? 2 : 0)}\n`,
    'utf8',
  );

  return resolvedPath;
};

export const writeJsonReport = async (
  reportPath: string,
  result: LintRunResult,
  pretty = true,
): Promise<string> => writeJsonArtifact(reportPath, result, pretty);

export const writeSpecSnapshot = async (
  snapshotPath: string,
  spec: unknown,
  pretty = true,
): Promise<string> => writeJsonArtifact(snapshotPath, spec, pretty);

const sanitizePackageNameForFilename = (packageName: string): string =>
  packageName.replace(/^@/, '').replace(/\//g, '-');

export const resolveDefaultSpecSnapshotPath = async (): Promise<string> => {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      name?: unknown;
    };

    if (typeof packageJson.name === 'string' && packageJson.name.length > 0) {
      return `./${sanitizePackageNameForFilename(packageJson.name)}.open-api.json`;
    }
  } catch {
    // Fall back to a generic filename when the host app has no readable package.json.
  }

  return `./${DEFAULT_SPEC_SNAPSHOT_FILENAME}`;
};
