import { readFile } from 'node:fs/promises';
import { defineConfig } from 'tsdown';

const TEXT_PREFIX = '\0inline-text:';
const TEXT_EXTENSIONS = ['.css', '.client.js'];
const textModulePaths = new Map<string, string>();

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
  },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  plugins: [
    {
      name: 'inline-text-imports',
      async resolveId(source, importer) {
        if (!importer || !TEXT_EXTENSIONS.some((ext) => source.endsWith(ext))) {
          return null;
        }
        const resolved = await this.resolve(source, importer, {
          skipSelf: true,
        });
        if (!resolved) return null;
        const token = `${textModulePaths.size}`;
        textModulePaths.set(token, resolved.id);
        return {
          id: `${TEXT_PREFIX}${token}.mjs`,
          moduleSideEffects: false,
        };
      },
      async load(id) {
        if (!id.startsWith(TEXT_PREFIX)) return null;
        const token = id.slice(TEXT_PREFIX.length, -'.mjs'.length);
        const filePath = textModulePaths.get(token);
        if (!filePath) return null;
        const source = await readFile(filePath, 'utf8');
        return {
          code: `export default ${JSON.stringify(source)};`,
          moduleType: 'js',
        };
      },
    },
  ],
});
