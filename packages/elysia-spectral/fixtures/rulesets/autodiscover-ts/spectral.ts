export default {
  extends: ['spectral:oas'],
  rules: {
    'sample-autodiscover-ts-tags': {
      description: 'Require tags through autodiscovered TS ruleset.',
      severity: 'warn',
      given: '$.paths[*][get,put,post,delete,options,head,patch,trace]',
      then: {
        field: 'tags',
        function: 'schema',
        functionOptions: {
          schema: {
            type: 'array',
            minItems: 1,
          },
        },
      },
    },
  },
};
