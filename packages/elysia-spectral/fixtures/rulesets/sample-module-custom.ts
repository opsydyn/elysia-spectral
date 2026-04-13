const startsWithPrefix = (
  input: unknown,
  options: { prefix: string },
): Array<{ message: string }> | void => {
  if (typeof input !== 'string') {
    return [{ message: 'OperationId must be a string.' }];
  }

  if (!input.startsWith(options.prefix)) {
    return [
      {
        message: `OperationId must start with "${options.prefix}".`,
      },
    ];
  }
};

export const functions = {
  startsWithPrefix,
};

export const ruleset = {
  extends: ['spectral:oas'],
  rules: {
    'sample-module-custom-operation-id-prefix': {
      description: 'Require a custom operationId prefix through a module rule.',
      severity: 'warn',
      given: '$.paths[*][get,put,post,delete,options,head,patch,trace]',
      then: {
        field: 'operationId',
        function: 'startsWithPrefix',
        functionOptions: {
          prefix: 'fetch',
        },
      },
    },
  },
};
