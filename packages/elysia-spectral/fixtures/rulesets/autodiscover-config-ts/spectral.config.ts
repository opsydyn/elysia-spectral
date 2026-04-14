export default {
  extends: ['spectral:oas'],
  rules: {
    'sample-autodiscover-config-description': {
      description:
        'Require descriptions through autodiscovered config TS ruleset.',
      severity: 'warn',
      given: '$.paths[*][get,put,post,delete,options,head,patch,trace]',
      then: {
        field: 'description',
        function: 'truthy',
      },
    },
  },
};
