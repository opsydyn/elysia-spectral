import { describe, expect, it } from 'bun:test';
import fixtureSpec from '../../fixtures/openapi/minimal.json';
import { lintOpenApi } from '../../src/core/lint-openapi';
import { loadRuleset } from '../../src/core/load-ruleset';

describe('loadRuleset', () => {
  it('loads a local YAML ruleset and uses built-in function mappings', async () => {
    const ruleset = await loadRuleset('./fixtures/rulesets/sample.yaml');
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-operation-summary',
      ),
    ).toBe(true);
  });
});
