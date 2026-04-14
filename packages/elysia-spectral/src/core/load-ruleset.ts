import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  RulesetDefinition,
  RulesetFunction,
  RulesetFunctionWithValidator,
} from '@stoplight/spectral-core';
import spectralFunctions from '@stoplight/spectral-functions';
import spectralRulesets from '@stoplight/spectral-rulesets';
import YAML from 'yaml';
import defaultRuleset from '../rulesets/default-ruleset';

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

const functionMap = {
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
} as const;

type AvailableFunctionMap = Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: Spectral's generic function types use any
  RulesetFunction<any, any> | RulesetFunctionWithValidator<any, any>
>;

const extendsMap: Partial<Record<string, RulesetDefinition>> = {
  'spectral:oas': oas as unknown as RulesetDefinition,
};

const autodiscoverRulesetFilenames = [
  'spectral.yaml',
  'spectral.yml',
  'spectral.ts',
  'spectral.mts',
  'spectral.cts',
  'spectral.js',
  'spectral.mjs',
  'spectral.cjs',
  'spectral.config.yaml',
  'spectral.config.yml',
  'spectral.config.ts',
  'spectral.config.mts',
  'spectral.config.cts',
  'spectral.config.js',
  'spectral.config.mjs',
  'spectral.config.cjs',
] as const;

export type LoadedRuleset = {
  ruleset: RulesetDefinition;
  source?: {
    path: string;
    autodiscovered: boolean;
    mergedWithDefault: boolean;
  };
};

export type ResolvedRulesetCandidate = {
  ruleset: unknown;
  source?: LoadedRuleset['source'];
};

export type RulesetResolverInput =
  | string
  | RulesetDefinition
  | Record<string, unknown>
  | undefined;

export type RulesetResolverContext = {
  baseDir: string;
  defaultRuleset: RulesetDefinition;
  mergeAutodiscoveredWithDefault: boolean;
};

export type RulesetResolver = (
  input: RulesetResolverInput,
  context: RulesetResolverContext,
) => Promise<ResolvedRulesetCandidate | undefined>;

export type LoadResolvedRulesetOptions = {
  baseDir?: string;
  resolvers?: RulesetResolver[];
  mergeAutodiscoveredWithDefault?: boolean;
};

export class RulesetLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RulesetLoadError';

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export const loadRuleset = async (
  input?: RulesetResolverInput,
  baseDirOrOptions: string | LoadResolvedRulesetOptions = process.cwd(),
): Promise<RulesetDefinition> => {
  return (await loadResolvedRuleset(input, baseDirOrOptions)).ruleset;
};

export const loadResolvedRuleset = async (
  input?: RulesetResolverInput,
  baseDirOrOptions: string | LoadResolvedRulesetOptions = process.cwd(),
): Promise<LoadedRuleset> => {
  const options = normalizeLoadResolvedRulesetOptions(baseDirOrOptions);
  const context: RulesetResolverContext = {
    baseDir: options.baseDir,
    defaultRuleset,
    mergeAutodiscoveredWithDefault: options.mergeAutodiscoveredWithDefault,
  };

  for (const resolver of options.resolvers) {
    const loaded = await resolver(input, context);
    if (loaded) {
      const normalized = {
        ruleset: normalizeRulesetDefinition(loaded.ruleset),
      } as LoadedRuleset;

      if (loaded.source) {
        normalized.source = loaded.source;
      }

      return normalized;
    }
  }

  if (input === undefined) {
    return { ruleset: defaultRuleset };
  }

  throw new RulesetLoadError('Ruleset input could not be resolved.');
};

const normalizeLoadResolvedRulesetOptions = (
  value: string | LoadResolvedRulesetOptions,
): Required<LoadResolvedRulesetOptions> => {
  if (typeof value === 'string') {
    return {
      baseDir: value,
      resolvers: defaultRulesetResolvers,
      mergeAutodiscoveredWithDefault: true,
    };
  }

  return {
    baseDir: value.baseDir ?? process.cwd(),
    resolvers: value.resolvers ?? defaultRulesetResolvers,
    mergeAutodiscoveredWithDefault:
      value.mergeAutodiscoveredWithDefault ?? true,
  };
};

const resolveAutodiscoveredRuleset: RulesetResolver = async (
  input,
  context,
) => {
  if (input !== undefined) {
    return undefined;
  }

  const autodiscoveredPath = await findAutodiscoveredRulesetPath(
    context.baseDir,
  );
  if (!autodiscoveredPath) {
    return undefined;
  }

  const loaded = await loadResolvedPathRuleset(autodiscoveredPath, context);
  if (!context.mergeAutodiscoveredWithDefault) {
    return {
      ...loaded,
      source: {
        path: autodiscoveredPath,
        autodiscovered: true,
        mergedWithDefault: false,
      },
    };
  }

  return {
    ruleset: mergeRulesets(context.defaultRuleset, loaded.ruleset),
    source: {
      path: autodiscoveredPath,
      autodiscovered: true,
      mergedWithDefault: true,
    },
  };
};

const resolvePathRuleset: RulesetResolver = async (input, context) => {
  if (typeof input !== 'string') {
    return undefined;
  }

  return await loadResolvedPathRuleset(input, context);
};

const resolveInlineRuleset: RulesetResolver = async (input) => {
  if (input === undefined || typeof input === 'string') {
    return undefined;
  }

  return { ruleset: normalizeRulesetDefinition(input) };
};

export const defaultRulesetResolvers: RulesetResolver[] = [
  resolveAutodiscoveredRuleset,
  resolvePathRuleset,
  resolveInlineRuleset,
];

const loadResolvedPathRuleset = async (
  inputPath: string,
  context: RulesetResolverContext,
): Promise<LoadedRuleset> => {
  const resolvedPath = path.resolve(context.baseDir, inputPath);

  if (isYamlRulesetPath(resolvedPath)) {
    return {
      ruleset: await loadYamlRuleset(resolvedPath),
      source: {
        path: inputPath,
        autodiscovered: false,
        mergedWithDefault: false,
      },
    };
  }

  if (!isModuleRulesetPath(resolvedPath)) {
    throw new RulesetLoadError(
      `Unsupported ruleset path: ${inputPath}. Supported local rulesets are .yaml, .yml, .js, .mjs, .cjs, .ts, .mts, and .cts.`,
    );
  }

  return {
    ruleset: await loadModuleRuleset(resolvedPath),
    source: {
      path: inputPath,
      autodiscovered: false,
      mergedWithDefault: false,
    },
  };
};

const findAutodiscoveredRulesetPath = async (
  baseDir: string,
): Promise<string | undefined> => {
  for (const filename of autodiscoverRulesetFilenames) {
    const candidatePath = path.resolve(baseDir, filename);

    try {
      await access(candidatePath);
      return `./${filename}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return undefined;
};

const loadYamlRuleset = async (
  resolvedPath: string,
): Promise<RulesetDefinition> => {
  let fileContents: string;
  try {
    fileContents = await readFile(resolvedPath, 'utf8');
  } catch (error) {
    throw new RulesetLoadError(`Unable to read ruleset at ${resolvedPath}.`, {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(fileContents);
  } catch (error) {
    throw new RulesetLoadError(
      `Unable to parse YAML ruleset at ${resolvedPath}.`,
      { cause: error },
    );
  }

  return normalizeRulesetDefinition(parsed);
};

const loadModuleRuleset = async (
  resolvedPath: string,
): Promise<RulesetDefinition> => {
  let imported: unknown;
  try {
    imported = await import(pathToFileURL(resolvedPath).href);
  } catch (error) {
    throw new RulesetLoadError(
      `Unable to import module ruleset at ${resolvedPath}.`,
      { cause: error },
    );
  }

  const resolvedRuleset = resolveModuleRulesetValue(imported);
  if (resolvedRuleset === undefined) {
    throw new RulesetLoadError(
      `Module ruleset at ${resolvedPath} must export a ruleset as the default export or a named "ruleset" export.`,
    );
  }

  const availableFunctions = {
    ...functionMap,
    ...resolveModuleFunctions(imported),
  };

  return normalizeRulesetDefinition(resolvedRuleset, availableFunctions);
};

const resolveModuleRulesetValue = (imported: unknown): unknown => {
  if (!isRecord(imported)) {
    return undefined;
  }

  if ('default' in imported) {
    return imported.default;
  }

  if ('ruleset' in imported) {
    return imported.ruleset;
  }

  return undefined;
};

const resolveModuleFunctions = (imported: unknown): AvailableFunctionMap => {
  if (!isRecord(imported) || !('functions' in imported)) {
    return {};
  }

  const { functions } = imported;
  if (!isRecord(functions)) {
    throw new RulesetLoadError(
      'Module ruleset "functions" export must be an object map of function names to Spectral functions.',
    );
  }

  const entries = Object.entries(functions).filter(
    ([, value]) => typeof value === 'function',
  );

  return Object.fromEntries(entries) as AvailableFunctionMap;
};

const isYamlRulesetPath = (value: string): boolean =>
  value.endsWith('.yaml') || value.endsWith('.yml');

const isModuleRulesetPath = (value: string): boolean =>
  value.endsWith('.js') ||
  value.endsWith('.mjs') ||
  value.endsWith('.cjs') ||
  value.endsWith('.ts') ||
  value.endsWith('.mts') ||
  value.endsWith('.cts');

const normalizeRulesetDefinition = (
  input: unknown,
  availableFunctions: AvailableFunctionMap = functionMap,
): RulesetDefinition => {
  if (!isRecord(input)) {
    throw new RulesetLoadError('Ruleset must be an object.');
  }

  const normalized: Record<string, unknown> = { ...input };

  if ('extends' in normalized) {
    normalized.extends = normalizeExtends(normalized.extends);
  }

  if ('rules' in normalized) {
    normalized.rules = normalizeRules(normalized.rules, availableFunctions);
  }

  return normalized as RulesetDefinition;
};

const mergeRuleEntry = (base: unknown, override: unknown): unknown => {
  // Primitive (string, number, false): valid Spectral severity shorthand, pass through
  if (!isRecord(override)) {
    return override;
  }

  // Full rule definition: has given or then, replace entirely
  if ('given' in override || 'then' in override) {
    return override;
  }

  // Partial override object (no given, no then)
  if (isRecord(base) && ('given' in base || 'then' in base)) {
    // Base is a full rule — deep-merge to preserve given/then
    return { ...base, ...override };
  }

  // No base full rule (rule comes from extends). Normalise a single-field
  // { severity: X } object to the bare severity string so Spectral treats it
  // as a valid inherited-rule override rather than an incomplete rule definition.
  const keys = Object.keys(override);
  if (keys.length === 1 && keys[0] === 'severity') {
    return override.severity;
  }

  return override;
};

const mergeRulesets = (
  baseRuleset: RulesetDefinition,
  overrideRuleset: RulesetDefinition,
): RulesetDefinition => {
  const mergedBase = baseRuleset as Record<string, unknown>;
  const mergedOverride = overrideRuleset as Record<string, unknown>;

  const baseRules = isRecord(mergedBase.rules) ? mergedBase.rules : {};
  const overrideRules = isRecord(mergedOverride.rules)
    ? mergedOverride.rules
    : {};

  const mergedRules: Record<string, unknown> = { ...baseRules };
  for (const [name, overrideRule] of Object.entries(overrideRules)) {
    mergedRules[name] = mergeRuleEntry(baseRules[name], overrideRule);
  }

  const baseExtends = toExtendsArray(mergedBase.extends);
  const overrideExtends = toExtendsArray(mergedOverride.extends);
  const mergedExtends = [...baseExtends, ...overrideExtends];

  const merged: Record<string, unknown> = {
    ...mergedBase,
    ...mergedOverride,
  };

  delete merged.extends;
  delete merged.rules;

  if (mergedExtends.length > 0) {
    merged.extends = mergedExtends;
  }

  if (Object.keys(mergedRules).length > 0) {
    merged.rules = mergedRules;
  }

  return merged as RulesetDefinition;
};

const toExtendsArray = (value: unknown): unknown[] => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? [...value] : [value];
};

const normalizeExtends = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return resolveExtendsEntry(value);
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) => {
    if (typeof entry === 'string') {
      return resolveExtendsEntry(entry);
    }

    if (
      Array.isArray(entry) &&
      entry.length >= 1 &&
      typeof entry[0] === 'string'
    ) {
      return [resolveExtendsEntry(entry[0]), entry[1]];
    }

    return entry;
  });
};

const resolveExtendsEntry = (value: string): RulesetDefinition => {
  const resolved = extendsMap[value];

  if (!resolved) {
    throw new RulesetLoadError(
      `Unsupported ruleset extend target: ${value}. v0.1 supports spectral:oas.`,
    );
  }

  return resolved;
};

const normalizeRules = (
  value: unknown,
  availableFunctions: AvailableFunctionMap,
): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const entries = Object.entries(value).map(([ruleName, ruleValue]) => [
    ruleName,
    normalizeRule(ruleValue, availableFunctions),
  ]);
  return Object.fromEntries(entries);
};

const normalizeRule = (
  value: unknown,
  availableFunctions: AvailableFunctionMap,
): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };

  if ('then' in normalized) {
    normalized.then = normalizeThen(normalized.then, availableFunctions);
  }

  return normalized;
};

const normalizeThen = (
  value: unknown,
  availableFunctions: AvailableFunctionMap,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeThenEntry(entry, availableFunctions));
  }

  return normalizeThenEntry(value, availableFunctions);
};

const normalizeThenEntry = (
  value: unknown,
  availableFunctions: AvailableFunctionMap,
): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };

  if (typeof normalized.function === 'string') {
    const resolved = availableFunctions[normalized.function];

    if (!resolved) {
      throw new RulesetLoadError(
        `Unsupported Spectral function: ${String(normalized.function)}.`,
      );
    }

    normalized.function = resolved;
  }

  return normalized;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
