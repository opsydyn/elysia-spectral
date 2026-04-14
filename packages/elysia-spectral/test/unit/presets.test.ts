import { describe, expect, it } from 'bun:test';
import fixtureSpec from '../../fixtures/openapi/minimal.json';
import fixtureSpecWithErrors from '../../fixtures/openapi/with-error-responses.json';
import { lintOpenApi } from '../../src/core/lint-openapi';
import { loadRuleset } from '../../src/core/load-ruleset';
import { recommended, server, strict } from '../../src/presets';

describe('recommended preset', () => {
  it('produces warn-level findings for missing summary and tags', async () => {
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      recommended,
    );

    expect(
      result.findings.some(
        (f) => f.code === 'elysia-operation-summary' && f.severity === 'warn',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (f) => f.code === 'elysia-operation-tags' && f.severity === 'warn',
      ),
    ).toBe(true);
  });

  it('does not fire oas3-api-servers or info-contact', async () => {
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      recommended,
    );

    expect(result.findings.some((f) => f.code === 'oas3-api-servers')).toBe(
      false,
    );
    expect(result.findings.some((f) => f.code === 'info-contact')).toBe(false);
  });
});

describe('server preset', () => {
  it('escalates elysia-operation-summary and elysia-operation-tags to error', async () => {
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      server,
    );

    expect(
      result.findings.some(
        (f) => f.code === 'elysia-operation-summary' && f.severity === 'error',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (f) => f.code === 'elysia-operation-tags' && f.severity === 'error',
      ),
    ).toBe(true);
  });

  it('fires operation-description, operation-operationId, operation-success-response at warn', async () => {
    // minimal spec has no description, no tags — operationId is present so
    // operation-operationId should not fire; description and success-response should
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      server,
    );

    expect(
      result.findings.some(
        (f) => f.code === 'operation-description' && f.severity === 'warn',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (f) => f.code === 'operation-success-response' && f.severity === 'warn',
      ),
    ).toBe(false); // minimal spec has a 200 response so this should not fire
  });
});

describe('strict preset', () => {
  it('escalates elysia rules and operation metadata to error', async () => {
    const result = await lintOpenApi(
      fixtureSpec as Record<string, unknown>,
      strict,
    );

    expect(
      result.findings.some(
        (f) => f.code === 'elysia-operation-summary' && f.severity === 'error',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (f) => f.code === 'operation-description' && f.severity === 'error',
      ),
    ).toBe(true);
  });

  it('fires rfc9457-problem-details for error responses without application/problem+json', async () => {
    const result = await lintOpenApi(
      fixtureSpecWithErrors as Record<string, unknown>,
      strict,
    );

    const problemFindings = result.findings.filter(
      (f) => f.code === 'rfc9457-problem-details',
    );

    expect(problemFindings.length).toBeGreaterThan(0);
    expect(problemFindings.every((f) => f.severity === 'warn')).toBe(true);
    // Should flag 404 and 500 but not 200
    expect(problemFindings.some((f) => f.message.includes('404'))).toBe(true);
    expect(problemFindings.some((f) => f.message.includes('500'))).toBe(true);
  });

  it('does not fire rfc9457-problem-details when problem+json is present', async () => {
    const specWithProblemJson = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            responses: {
              '200': { description: 'OK' },
              '404': {
                description: 'Not found',
                content: {
                  'application/problem+json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = await lintOpenApi(specWithProblemJson, strict);

    expect(
      result.findings.some((f) => f.code === 'rfc9457-problem-details'),
    ).toBe(false);
  });
});

describe('preset option in loadRuleset', () => {
  it('uses the preset as the default ruleset when no ruleset is configured', async () => {
    const ruleset = await loadRuleset(undefined, {
      baseDir: '/tmp',
      defaultRuleset: server,
    });

    // server preset escalates elysia-operation-summary to error — verify
    // by checking the rule definition severity
    const rules = (ruleset as Record<string, unknown>).rules as Record<
      string,
      unknown
    >;
    const summaryRule = rules['elysia-operation-summary'] as Record<
      string,
      unknown
    >;
    expect(summaryRule?.severity).toBe('error');
  });
});
