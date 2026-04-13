export const ruleset = {
  extends: ['spectral:oas'],
  rules: {
    'sample-module-named-tags': {
      description:
        'Require route tags through a named TS module ruleset export.',
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
