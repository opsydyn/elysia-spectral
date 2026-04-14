import type { RulesetDefinition } from '@stoplight/spectral-core';
import spectralFunctions from '@stoplight/spectral-functions';
import spectralRulesets from '@stoplight/spectral-rulesets';

const { schema, truthy } = spectralFunctions;
const { oas } = spectralRulesets;

const operationSelector =
  '$.paths[*][get,put,post,delete,options,head,patch,trace]';

/**
 * Baseline quality preset. Equivalent to the package default ruleset.
 *
 * - Extends spectral:oas/recommended
 * - elysia-operation-summary and elysia-operation-tags at warn
 * - oas3-api-servers and info-contact disabled (local-dev friendly)
 */
export const recommended: RulesetDefinition = {
  extends: [[oas as unknown as RulesetDefinition, 'recommended']],
  rules: {
    'oas3-api-servers': 'off',
    'info-contact': 'off',
    'elysia-operation-summary': {
      description:
        'Operations should define a summary for generated docs and clients.',
      severity: 'warn',
      given: operationSelector,
      then: { field: 'summary', function: truthy },
    },
    'elysia-operation-tags': {
      description:
        'Operations should declare at least one tag for grouping and downstream tooling.',
      severity: 'warn',
      given: operationSelector,
      then: {
        field: 'tags',
        function: schema,
        functionOptions: { schema: { type: 'array', minItems: 1 } },
      },
    },
  },
};
