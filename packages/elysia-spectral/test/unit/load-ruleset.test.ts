import { describe, expect, it } from 'bun:test';
import fixtureSpec from '../../fixtures/openapi/minimal.json';
import { lintOpenApi } from '../../src/core/lint-openapi';
import { loadResolvedRuleset, loadRuleset } from '../../src/core/load-ruleset';

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

  it('loads a local TS ruleset module from the default export', async () => {
    const ruleset = await loadRuleset(
      './fixtures/rulesets/sample-module-default.ts',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-module-default-summary',
      ),
    ).toBe(true);
  });

  it('loads a local TS ruleset module from a named ruleset export', async () => {
    const ruleset = await loadRuleset(
      './fixtures/rulesets/sample-module-named.ts',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-module-named-tags',
      ),
    ).toBe(true);
  });

  it('loads custom function exports from a local TS ruleset module', async () => {
    const ruleset = await loadRuleset(
      './fixtures/rulesets/sample-module-custom.ts',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) =>
          finding.code === 'sample-module-custom-operation-id-prefix',
      ),
    ).toBe(true);
  });

  it('autodiscovers a repo-level spectral.yaml ruleset when no ruleset is configured', async () => {
    const ruleset = await loadRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-yaml',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-autodiscover-yaml-summary',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.code === 'elysia-operation-tags',
      ),
    ).toBe(true);
  });

  it('autodiscovers a repo-level spectral.ts ruleset when no ruleset is configured', async () => {
    const ruleset = await loadRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-ts',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-autodiscover-ts-tags',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.code === 'elysia-operation-summary',
      ),
    ).toBe(true);
  });

  it('autodiscovers a repo-level spectral.config.ts ruleset when no ruleset is configured', async () => {
    const ruleset = await loadRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-config-ts',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(result.summary.warn).toBeGreaterThan(0);
    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-autodiscover-config-description',
      ),
    ).toBe(true);
  });

  it('returns metadata for autodiscovered repo-level rulesets', async () => {
    const loaded = await loadResolvedRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-yaml',
    );

    expect(loaded.source).toEqual({
      path: './spectral.yaml',
      autodiscovered: true,
      mergedWithDefault: true,
    });
  });

  it('supports a custom resolver pipeline', async () => {
    const customRuleset = {
      extends: ['spectral:oas'],
      rules: {
        'custom-resolver-summary': {
          description: 'Require operation summaries through a custom resolver.',
          message: 'Operation summary is required by the custom resolver.',
          severity: 'warn',
          given: '$.paths[*][get,put,post,delete,options,head,patch,trace]',
          then: {
            field: 'summary',
            function: 'truthy',
          },
        },
      },
    };

    const ruleset = await loadRuleset('virtual://ruleset', {
      resolvers: [
        async (input) =>
          input === 'virtual://ruleset'
            ? { ruleset: customRuleset }
            : undefined,
      ],
    });

    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(
      result.findings.some(
        (finding) => finding.code === 'custom-resolver-summary',
      ),
    ).toBe(true);
  });

  it('merges object-form severity override of an extends-inherited rule without rejecting it', async () => {
    // Regression: { severity: warn } object form for a spectral:oas rule was passed
    // directly into the merged ruleset, causing Spectral to reject it as an incomplete
    // rule definition (missing given/then). The fix normalises it to the bare string.
    const ruleset = await loadRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-severity-override',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    // operation-tags override should survive — the fixture spec triggers it
    expect(
      result.findings.some((finding) => finding.code === 'operation-tags'),
    ).toBe(true);
  });

  it('merges object-form severity override of a default-ruleset rule without clobbering its definition', async () => {
    // Regression: { severity: error } for elysia-operation-summary replaced the full
    // rule definition (given/then) in the merged rules, causing Spectral to reject it.
    // The fix deep-merges the partial override with the base rule.
    const ruleset = await loadRuleset(
      undefined,
      './fixtures/rulesets/autodiscover-severity-override',
    );
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      ruleset,
    );

    expect(
      result.findings.some(
        (finding) => finding.code === 'elysia-operation-summary',
      ),
    ).toBe(true);
  });

  it('can skip default-rule merging for autodiscovered rulesets', async () => {
    const loaded = await loadResolvedRuleset(undefined, {
      baseDir: './fixtures/rulesets/autodiscover-yaml',
      mergeAutodiscoveredWithDefault: false,
    });

    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      loaded.ruleset,
    );

    expect(
      result.findings.some(
        (finding) => finding.code === 'sample-autodiscover-yaml-summary',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.code === 'elysia-operation-tags',
      ),
    ).toBe(false);
    expect(loaded.source).toEqual({
      path: './spectral.yaml',
      autodiscovered: true,
      mergedWithDefault: false,
    });
  });
});
