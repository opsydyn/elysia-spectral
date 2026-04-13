const ruleset = {
  extends: ['spectral:oas'],
  rules: {
    'sample-module-default-summary': {
      description: 'Require route summaries through a TS module ruleset.',
      severity: 'warn',
      given: '$.paths[*][get,put,post,delete,options,head,patch,trace]',
      then: {
        field: 'summary',
        function: 'truthy',
      },
    },
  },
};

export default ruleset;
