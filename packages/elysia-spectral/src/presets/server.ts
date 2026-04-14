import type { RulesetDefinition } from '@stoplight/spectral-core';
import spectralFunctions from '@stoplight/spectral-functions';
import spectralRulesets from '@stoplight/spectral-rulesets';

const { schema, truthy } = spectralFunctions;
const { oas } = spectralRulesets;

const operationSelector =
  '$.paths[*][get,put,post,delete,options,head,patch,trace]';

/**
 * Production API quality preset. Suitable as a CI gate for teams shipping
 * public or internal APIs where contract quality matters.
 *
 * Tightens recommended:
 * - elysia-operation-summary and elysia-operation-tags escalated to error
 * - operation-description, operation-operationId, operation-success-response at warn
 * - oas3-api-servers at warn (servers should be declared in production specs)
 */
export const server: RulesetDefinition = {
  extends: [[oas as unknown as RulesetDefinition, 'recommended']],
  rules: {
    'oas3-api-servers': 'warn',
    'info-contact': 'off',
    'elysia-operation-summary': {
      description:
        'Operations should define a summary for generated docs and clients.',
      severity: 'error',
      given: operationSelector,
      then: { field: 'summary', function: truthy },
    },
    'elysia-operation-tags': {
      description:
        'Operations should declare at least one tag for grouping and downstream tooling.',
      severity: 'error',
      given: operationSelector,
      then: {
        field: 'tags',
        function: schema,
        functionOptions: { schema: { type: 'array', minItems: 1 } },
      },
    },
    'operation-description': 'warn',
    'operation-operationId': 'warn',
    'operation-success-response': 'warn',
  },
};
