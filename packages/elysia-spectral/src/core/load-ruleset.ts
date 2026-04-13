import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RulesetDefinition } from '@stoplight/spectral-core';
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

const extendsMap: Record<string, RulesetDefinition> = {
  'spectral:oas': oas as unknown as RulesetDefinition,
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
  input?: string | RulesetDefinition | Record<string, unknown>,
): Promise<RulesetDefinition> => {
  if (!input) {
    return defaultRuleset;
  }

  if (typeof input === 'string') {
    const resolvedPath = path.resolve(process.cwd(), input);

    if (!resolvedPath.endsWith('.yaml') && !resolvedPath.endsWith('.yml')) {
      throw new RulesetLoadError(
        `Unsupported ruleset path: ${input}. v0.1 supports local YAML rulesets only.`,
      );
    }

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
  }

  return normalizeRulesetDefinition(input);
};

const normalizeRulesetDefinition = (input: unknown): RulesetDefinition => {
  if (!isRecord(input)) {
    throw new RulesetLoadError('Ruleset must be an object.');
  }

  const normalized: Record<string, unknown> = { ...input };

  if ('extends' in normalized) {
    normalized.extends = normalizeExtends(normalized.extends);
  }

  if ('rules' in normalized) {
    normalized.rules = normalizeRules(normalized.rules);
  }

  return normalized as RulesetDefinition;
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

const normalizeRules = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const entries = Object.entries(value).map(([ruleName, ruleValue]) => [
    ruleName,
    normalizeRule(ruleValue),
  ]);
  return Object.fromEntries(entries);
};

const normalizeRule = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };

  if ('then' in normalized) {
    normalized.then = normalizeThen(normalized.then);
  }

  return normalized;
};

const normalizeThen = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeThenEntry(entry));
  }

  return normalizeThenEntry(value);
};

const normalizeThenEntry = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };

  if (typeof normalized.function === 'string') {
    const resolved =
      functionMap[normalized.function as keyof typeof functionMap];

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
