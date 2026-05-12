import type {
  RulesetDefinition,
  RulesetFunction,
  RulesetFunctionWithValidator,
} from '@stoplight/spectral-core';

type SpectralCoreModule = typeof import('@stoplight/spectral-core');
type SpectralConstructor = SpectralCoreModule['Spectral'];

export type AvailableFunctionMap = Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: Spectral's generic function types use any
  RulesetFunction<any, any> | RulesetFunctionWithValidator<any, any>
>;

type StoplightRuntimeBindings = {
  Spectral: SpectralConstructor;
  extendsMap: Partial<Record<string, RulesetDefinition>>;
  functionMap: AvailableFunctionMap;
};

let runtimeBindingsPromise: Promise<StoplightRuntimeBindings> | null = null;

const loadStoplightRuntimeBindings =
  async (): Promise<StoplightRuntimeBindings> => {
    const [
      spectralCore,
      { default: spectralFunctions },
      { default: spectralRulesets },
    ] = await Promise.all([
      import('@stoplight/spectral-core'),
      import('@stoplight/spectral-functions'),
      import('@stoplight/spectral-rulesets'),
    ]);

    const {
      alphabetical,
      casing,
      defined,
      enumeration,
      falsy,
      length,
      or,
      pattern,
      schema,
      truthy,
      undefined: undefinedFunction,
      unreferencedReusableObject,
      xor,
    } = spectralFunctions;
    const { oas } = spectralRulesets;

    return {
      Spectral: spectralCore.Spectral,
      extendsMap: {
        'spectral:oas': oas as unknown as RulesetDefinition,
      },
      functionMap: {
        alphabetical,
        casing,
        defined,
        enumeration,
        falsy,
        length,
        or,
        pattern,
        schema,
        truthy,
        undefined: undefinedFunction,
        unreferencedReusableObject,
        xor,
      },
    };
  };

const getStoplightRuntimeBindings =
  async (): Promise<StoplightRuntimeBindings> => {
    if (runtimeBindingsPromise === null) {
      runtimeBindingsPromise = loadStoplightRuntimeBindings();
    }

    return await runtimeBindingsPromise;
  };

export const getBuiltInFunctionMap = async (): Promise<AvailableFunctionMap> =>
  (await getStoplightRuntimeBindings()).functionMap;

export const getExtendsMap = async (): Promise<
  Partial<Record<string, RulesetDefinition>>
> => (await getStoplightRuntimeBindings()).extendsMap;

export const getSpectralConstructor = async (): Promise<SpectralConstructor> =>
  (await getStoplightRuntimeBindings()).Spectral;
