import { describe, expect, it } from 'bun:test';
import { enforceThreshold, exceedsThreshold } from '../../src/core/thresholds';
import type { LintRunResult } from '../../src/types';

const createResult = (): LintRunResult => ({
  ok: false,
  generatedAt: new Date().toISOString(),
  source: 'manual',
  summary: {
    error: 0,
    warn: 1,
    info: 0,
    hint: 0,
    total: 1,
  },
  findings: [
    {
      code: 'example-warning',
      message: 'warning message',
      severity: 'warn',
      path: ['paths', '/users', 'get'],
      documentPointer: '/paths/~1users/get',
      operation: {
        method: 'get',
        path: '/users',
      },
    },
  ],
});

describe('thresholds', () => {
  it('compares severities correctly', () => {
    expect(exceedsThreshold('error', 'warn')).toBe(true);
    expect(exceedsThreshold('info', 'warn')).toBe(false);
    expect(exceedsThreshold('hint', 'never')).toBe(false);
  });

  it('throws when findings meet the configured threshold', () => {
    expect(() => enforceThreshold(createResult(), 'warn')).toThrow();
  });

  it('does not throw when threshold is never', () => {
    expect(() => enforceThreshold(createResult(), 'never')).not.toThrow();
  });
});
