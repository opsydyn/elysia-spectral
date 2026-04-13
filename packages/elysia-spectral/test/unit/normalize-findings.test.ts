import { describe, expect, it } from 'bun:test';
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import { normalizeFindings } from '../../src/core/normalize-findings';

const diagnostic: ISpectralDiagnostic = {
  code: 'operation-description',
  message: 'Operation "description" must be present and non-empty string.',
  path: ['paths', '/users', 'get', 'summary'],
  severity: 1,
  range: {
    start: { line: 4, character: 2 },
    end: { line: 4, character: 9 },
  },
};

describe('normalizeFindings', () => {
  it('builds document pointers and infers operation metadata', () => {
    const result = normalizeFindings([diagnostic], {
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
          },
        },
      },
    });

    expect(result.summary.warn).toBe(1);
    expect(result.findings[0]?.documentPointer).toBe(
      '/paths/~1users/get/summary',
    );
    expect(result.findings[0]?.operation).toEqual({
      method: 'get',
      path: '/users',
      operationId: 'listUsers',
    });
    expect(result.findings[0]?.recommendation).toBe(
      'Add detail.description with a short user-facing explanation of what the route does.',
    );
  });
});
