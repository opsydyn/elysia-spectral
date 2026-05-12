import type { RulesetDefinition } from '@stoplight/spectral-core';
import type { LintRunResult } from '../types';
import { loadRuleset } from './load-ruleset';
import { normalizeFindings } from './normalize-findings';
import { getSpectralConstructor } from './stoplight-runtime';

export const lintOpenApi = async (
  spec: Record<string, unknown>,
  ruleset: RulesetDefinition,
): Promise<LintRunResult> => {
  const [Spectral, resolvedRuleset] = await Promise.all([
    getSpectralConstructor(),
    loadRuleset(ruleset, { baseDir: process.cwd() }),
  ]);

  const spectral = new Spectral();
  spectral.setRuleset(resolvedRuleset);

  const findings = await spectral.run(spec, {
    ignoreUnknownFormat: false,
  });

  return normalizeFindings(findings, spec);
};
