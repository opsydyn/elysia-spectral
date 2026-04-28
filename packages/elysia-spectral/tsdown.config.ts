import { readFile } from 'node:fs/promises';
import { defineConfig } from 'tsdown';

const TEXT_PREFIX = '\0text:';
const TEXT_EXTENSIONS = ['.css', '.client.js'];

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
        return {
          id: `${TEXT_PREFIX}${resolved.id}.txt`,
          moduleSideEffects: false,
        };
      },
      async load(id) {
        if (!id.startsWith(TEXT_PREFIX)) return null;
        const filePath = id.slice(TEXT_PREFIX.length, -'.txt'.length);
        const source = await readFile(filePath, 'utf8');
        return `export default ${JSON.stringify(source)};`;
      },
    },
  ],
});
