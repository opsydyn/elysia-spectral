import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { brunoToOpenCollection, openApiToBruno } from '@usebruno/converters';
import YAML from 'yaml';

const isYamlPath = (filePath: string): boolean =>
  filePath.endsWith('.yml') || filePath.endsWith('.yaml');

export const writeBrunoCollection = async (
  outputPath: string,
  spec: Record<string, unknown>,
): Promise<string> => {
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const collection = openApiToBruno(spec);

  const content = isYamlPath(outputPath)
    ? YAML.stringify(brunoToOpenCollection(collection))
    : JSON.stringify(collection, null, 2);

  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, content, 'utf8');

  return resolvedPath;
};
