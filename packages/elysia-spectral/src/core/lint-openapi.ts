import type { RulesetDefinition } from '@stoplight/spectral-core';
import spectralCore from '@stoplight/spectral-core';
import type { LintRunResult } from '../types';
import { normalizeFindings } from './normalize-findings';

const { Spectral } = spectralCore;

export const lintOpenApi = async (
  spec: Record<string, unknown>,
  ruleset: RulesetDefinition,
): Promise<LintRunResult> => {
  const spectral = new Spectral();
  spectral.setRuleset(ruleset);

  const findings = await spectral.run(spec, {
    ignoreUnknownFormat: false,
  });

  return normalizeFindings(findings, spec);
};
