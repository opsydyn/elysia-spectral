import type { AnyElysia } from 'elysia';
import type { SpectralPluginOptions } from '../types';

type SpecProvider = {
  getSpec(): Promise<unknown>;
};

export type PublicSpecProviderOptions = SpectralPluginOptions['source'];

export abstract class BaseSpecProvider implements SpecProvider {
  constructor(
    protected readonly app: AnyElysia,
    protected readonly options: PublicSpecProviderOptions = {},
  ) {}

  abstract getSpec(): Promise<unknown>;

  protected get specPath(): string {
    return normalizeSpecPath(this.options?.specPath ?? '/openapi/json');
  }
}

export const normalizeSpecPath = (value: string): string => {
  if (value.length === 0) {
    return '/openapi/json';
  }

  return value.startsWith('/') ? value : `/${value}`;
};

export const createInProcessRequest = (specPath: string): Request =>
  new Request(new URL(specPath, 'http://localhost').toString());
