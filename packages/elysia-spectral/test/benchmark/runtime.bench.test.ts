import { describe, it } from 'bun:test';
import { createOpenApiLintRuntime } from '../../src/core/runtime';
import { buildSyntheticApp } from './build-synthetic-app';

const shouldRun = process.env.RUN_BENCH === '1';
const describeBench = shouldRun ? describe : describe.skip;

const sizes = [10, 100, 500] as const;
const runsPerSize = 3;

describeBench('runtime.run benchmark', () => {
  for (const size of sizes) {
    it(`lints ${size} operations × ${runsPerSize} runs`, async () => {
      const app = buildSyntheticApp({ operationCount: size });
      const runtime = createOpenApiLintRuntime({
        output: { console: false },
        failOn: 'never',
      });

      const samples: number[] = [];
      const rssBefore = process.memoryUsage().rss;

      for (let attempt = 0; attempt < runsPerSize; attempt += 1) {
        const started = performance.now();
        await runtime.run(app);
        samples.push(performance.now() - started);
      }

      const rssAfter = process.memoryUsage().rss;
      report(size, samples, rssAfter - rssBefore);
    });
  }
});

const report = (size: number, samples: number[], rssDeltaBytes: number) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const rssDeltaMb = rssDeltaBytes / 1024 / 1024;

  console.log(
    `[bench] ops=${size.toString().padStart(3)} runs=${samples.length} ` +
      `min=${min.toFixed(1)}ms mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms ` +
      `rssΔ=${rssDeltaMb.toFixed(1)}MB`,
  );
};
