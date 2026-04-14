import type { RulesetDefinition } from '@stoplight/spectral-core';
import spectralFunctions from '@stoplight/spectral-functions';
import spectralRulesets from '@stoplight/spectral-rulesets';

const { schema, truthy } = spectralFunctions;
const { oas } = spectralRulesets;

const operationSelector =
  '$.paths[*][get,put,post,delete,options,head,patch,trace]';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Checks that all 4xx/5xx responses declare application/problem+json as
 * their content type, conforming to RFC 9457 Problem Details for HTTP APIs.
 */
const checkProblemDetails = (
  operation: unknown,
): Array<{ message: string; path: string[] }> | undefined => {
  if (!isRecord(operation) || !isRecord(operation.responses)) return;

  const results: Array<{ message: string; path: string[] }> = [];

  for (const [statusCode, response] of Object.entries(operation.responses)) {
    const code = Number(statusCode);
    if (!Number.isFinite(code) || code < 400) continue;
    if (!isRecord(response)) continue;

    const content = response.content;
    if (!isRecord(content) || !('application/problem+json' in content)) {
      results.push({
        message: `${statusCode} error response should use "application/problem+json" content type (RFC 9457 Problem Details).`,
        path: ['responses', statusCode],
      });
    }
  }

  return results.length > 0 ? results : undefined;
};

/**
 * Full API governance preset. Suitable for teams with formal API governance
 * requirements, public API programs, or downstream client generation pipelines.
 *
 * Tightens server:
 * - All elysia rules and operation metadata rules escalated to error
 * - info-contact at warn (API ownership should be declared)
 * - oas3-api-servers at error (server declaration is required)
 * - rfc9457-problem-details at warn (error responses should use Problem Details)
 */
export const strict: RulesetDefinition = {
  extends: [[oas as unknown as RulesetDefinition, 'recommended']],
  rules: {
    'oas3-api-servers': 'error',
    'info-contact': 'warn',
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
    'operation-description': 'error',
    'operation-operationId': 'error',
    'operation-success-response': 'error',
    'rfc9457-problem-details': {
      description:
        'Error responses (4xx, 5xx) should use RFC 9457 Problem Details (application/problem+json).',
      message: '{{error}}',
      severity: 'warn',
      given: operationSelector,
      then: { function: checkProblemDetails },
    },
  },
};
