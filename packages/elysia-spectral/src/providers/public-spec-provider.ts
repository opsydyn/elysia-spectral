import type { AnyElysia } from 'elysia';
import { BaseSpecProvider, createInProcessRequest } from './spec-provider';

export class PublicSpecProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'PublicSpecProviderError';

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class PublicSpecProvider extends BaseSpecProvider {
  constructor(
    app: AnyElysia,
    options: ConstructorParameters<typeof BaseSpecProvider>[1] = {},
  ) {
    super(app, options);
  }

  async getSpec(): Promise<unknown> {
    const inProcessRequest = createInProcessRequest(this.specPath);

    try {
      const response = await this.app.handle(inProcessRequest);
      if (response.ok) {
        return await parseSpecResponse(response, `in-process ${this.specPath}`);
      }

      if (this.options?.baseUrl) {
        return await this.fetchViaLoopback();
      }

      const body = await safeReadBody(response);
      throw new PublicSpecProviderError(
        `OpenAPI JSON endpoint ${this.specPath} returned ${response.status}${body ? `: ${body}` : ''}.`,
      );
    } catch (error) {
      if (this.options?.baseUrl) {
        return await this.fetchViaLoopback(error);
      }

      if (error instanceof PublicSpecProviderError) {
        throw error;
      }

      throw new PublicSpecProviderError(
        `Unable to resolve OpenAPI JSON endpoint ${this.specPath} with app.handle(Request).`,
        { cause: error },
      );
    }
  }

  private async fetchViaLoopback(cause?: unknown): Promise<unknown> {
    const baseUrl = this.options?.baseUrl;
    if (!baseUrl) {
      throw new PublicSpecProviderError(
        'Loopback fetch requires source.baseUrl.',
        { cause },
      );
    }

    const url = new URL(this.specPath, ensureTrailingSlash(baseUrl)).toString();
    const response = await fetch(url);

    if (!response.ok) {
      const body = await safeReadBody(response);
      throw new PublicSpecProviderError(
        `OpenAPI JSON endpoint ${url} returned ${response.status}${body ? `: ${body}` : ''}.`,
        { cause },
      );
    }

    return parseSpecResponse(response, url);
  }
}

const parseSpecResponse = async (
  response: Response,
  sourceLabel: string,
): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    throw new PublicSpecProviderError(
      `OpenAPI JSON endpoint ${sourceLabel} did not return valid JSON.`,
      { cause: error },
    );
  }
};

const ensureTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value : `${value}/`;

const safeReadBody = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
};
