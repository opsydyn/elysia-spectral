import { describe, expect, it } from 'bun:test';
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import fc from 'fast-check';
import { normalizeFindings } from '../../src/core/normalize-findings';

const severityNumberArb = fc.integer({ min: 0, max: 3 });

const pathSegmentArb = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.nat({ max: 50 }),
);

const diagnosticArb: fc.Arbitrary<ISpectralDiagnostic> = fc.record({
  code: fc.oneof(fc.string({ minLength: 1, maxLength: 24 }), fc.nat()),
  message: fc.string({ maxLength: 64 }),
  path: fc.array(pathSegmentArb, { maxLength: 6 }),
  severity: severityNumberArb,
  range: fc.constant({
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  }),
});

const severityNumberToName = ['error', 'warn', 'info', 'hint'] as const;

describe('normalizeFindings (property-based)', () => {
  it('summary.total equals findings.length', () => {
    fc.assert(
      fc.property(fc.array(diagnosticArb, { maxLength: 30 }), (diagnostics) => {
        const result = normalizeFindings(diagnostics, {});
        expect(result.summary.total).toBe(result.findings.length);
      }),
    );
  });

  it('per-severity counts sum to summary.total', () => {
    fc.assert(
      fc.property(fc.array(diagnosticArb, { maxLength: 30 }), (diagnostics) => {
        const { summary } = normalizeFindings(diagnostics, {});
        const sum = summary.error + summary.warn + summary.info + summary.hint;
        expect(sum).toBe(summary.total);
      }),
    );
  });

  it('every finding severity matches the diagnostic severity number', () => {
    fc.assert(
      fc.property(fc.array(diagnosticArb, { maxLength: 30 }), (diagnostics) => {
        const result = normalizeFindings(diagnostics, {});
        result.findings.forEach((finding, index) => {
          const expected =
            severityNumberToName[diagnostics[index]?.severity ?? 0];
          expect(finding.severity).toBe(expected ?? 'hint');
        });
      }),
    );
  });

  it('documentPointer escapes ~ as ~0 and / as ~1 for every segment', () => {
    fc.assert(
      fc.property(fc.array(diagnosticArb, { maxLength: 15 }), (diagnostics) => {
        const result = normalizeFindings(diagnostics, {});
        result.findings.forEach((finding) => {
          if (finding.path.length === 0) {
            expect(finding.documentPointer).toBe('');
            return;
          }

          const expected = `/${finding.path
            .map((segment) =>
              String(segment).replace(/~/g, '~0').replace(/\//g, '~1'),
            )
            .join('/')}`;
          expect(finding.documentPointer).toBe(expected);
        });
      }),
    );
  });

  it('result.ok is true iff there are zero error-severity findings', () => {
    fc.assert(
      fc.property(fc.array(diagnosticArb, { maxLength: 30 }), (diagnostics) => {
        const result = normalizeFindings(diagnostics, {});
        expect(result.ok).toBe(result.summary.error === 0);
      }),
    );
  });
});
