import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import {
  enforceThreshold,
  OpenApiLintThresholdError,
  shouldFail,
} from '../../src/core/thresholds';
import type {
  LintFinding,
  LintRunResult,
  LintSeverity,
  SeverityThreshold,
} from '../../src/types';

const severityArb = fc.constantFrom<LintSeverity>(
  'error',
  'warn',
  'info',
  'hint',
);

const thresholdArb = fc.constantFrom<SeverityThreshold>(
  'error',
  'warn',
  'info',
  'hint',
  'never',
);

const findingArb: fc.Arbitrary<LintFinding> = fc.record({
  code: fc.string({ minLength: 1, maxLength: 32 }),
  message: fc.string({ maxLength: 64 }),
  severity: severityArb,
  path: fc.array(fc.oneof(fc.string({ maxLength: 8 }), fc.nat()), {
    maxLength: 5,
  }),
  documentPointer: fc.string({ maxLength: 32 }),
});

const resultArb: fc.Arbitrary<LintRunResult> = fc
  .array(findingArb, { maxLength: 25 })
  .map((findings) => {
    const summary = findings.reduce(
      (current, finding) => {
        current[finding.severity] += 1;
        current.total += 1;
        return current;
      },
      { error: 0, warn: 0, info: 0, hint: 0, total: 0 },
    );

    return {
      ok: summary.error === 0,
      generatedAt: new Date().toISOString(),
      source: 'manual',
      failOn: 'error',
      durationMs: null,
      summary,
      findings,
    };
  });

const orderedThresholds: SeverityThreshold[] = [
  'error',
  'warn',
  'info',
  'hint',
];

describe('thresholds (property-based)', () => {
  it("shouldFail with 'never' is always false", () => {
    fc.assert(
      fc.property(resultArb, (result) => {
        expect(shouldFail(result, 'never')).toBe(false);
      }),
    );
  });

  it('shouldFail is monotonic: failing at a stricter threshold implies failing at all looser ones', () => {
    fc.assert(
      fc.property(resultArb, (result) => {
        for (let index = 0; index < orderedThresholds.length - 1; index += 1) {
          const stricter = orderedThresholds[index] as SeverityThreshold;
          const looser = orderedThresholds[index + 1] as SeverityThreshold;
          if (shouldFail(result, stricter)) {
            expect(shouldFail(result, looser)).toBe(true);
          }
        }
      }),
    );
  });

  it('shouldFail at "hint" is true iff there is at least one finding', () => {
    fc.assert(
      fc.property(resultArb, (result) => {
        expect(shouldFail(result, 'hint')).toBe(result.findings.length > 0);
      }),
    );
  });

  it('enforceThreshold throws iff shouldFail returns true', () => {
    fc.assert(
      fc.property(resultArb, thresholdArb, (result, threshold) => {
        const willFail = shouldFail(result, threshold);
        try {
          enforceThreshold(result, threshold);
          expect(willFail).toBe(false);
        } catch (error) {
          expect(willFail).toBe(true);
          expect(error).toBeInstanceOf(OpenApiLintThresholdError);
          expect((error as OpenApiLintThresholdError).threshold).toBe(
            threshold,
          );
          expect((error as OpenApiLintThresholdError).result).toBe(result);
        }
      }),
    );
  });
});
