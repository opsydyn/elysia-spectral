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
    const sourceLabel = `app.handle(Request) at ${this.specPath}`;

    try {
      const response = await this.app.handle(inProcessRequest);
      if (response.ok) {
        return await parseSpecResponse(response, sourceLabel, this.specPath);
      }

      if (this.options?.baseUrl) {
        return await this.fetchViaLoopback();
      }

      const body = await safeReadBody(response);
      throw new PublicSpecProviderError(
        [
          `Unable to load OpenAPI JSON from ${this.specPath} via ${sourceLabel}: received ${describeResponse(response)}${body ? ` with body ${body}.` : '.'}`,
          `Fix: ensure @elysiajs/openapi is mounted and exposing "${this.specPath}", or update source.specPath to the correct OpenAPI JSON route.`,
        ].join(' '),
      );
    } catch (error) {
      if (this.options?.baseUrl) {
        return await this.fetchViaLoopback(error);
      }

      if (error instanceof PublicSpecProviderError) {
        throw error;
      }

      throw new PublicSpecProviderError(
        [
          `Unable to resolve OpenAPI JSON from ${this.specPath} via ${sourceLabel}.`,
          'Fix: ensure the app can serve the configured OpenAPI JSON route, or set source.baseUrl if the document is only reachable over HTTP.',
        ].join(' '),
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
        [
          `Unable to load OpenAPI JSON from ${url}: received ${describeResponse(response)}${body ? ` with body ${body}.` : '.'}`,
          'Fix: ensure the HTTP endpoint is reachable and returns the generated OpenAPI JSON, or update source.baseUrl/source.specPath.',
        ].join(' '),
        { cause },
      );
    }

    return parseSpecResponse(response, url, this.specPath);
  }
}

const parseSpecResponse = async (
  response: Response,
  sourceLabel: string,
  specPath: string,
): Promise<unknown> => {
  const body = await response.text();

  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw new PublicSpecProviderError(
      [
        `Unable to parse OpenAPI JSON from ${sourceLabel}: response was not valid JSON${body.trim() ? ` (body preview: ${formatBodyPreview(body)}).` : '.'}`,
        `Fix: ensure the configured endpoint for "${specPath}" returns the generated OpenAPI document as JSON.`,
      ].join(' '),
      { cause: error },
    );
  }
};

const ensureTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value : `${value}/`;

const safeReadBody = async (response: Response): Promise<string> => {
  try {
    const body = await response.text();

    return body.trim() ? formatBodyPreview(body) : '';
  } catch {
    return '';
  }
};

const describeResponse = (response: Response): string =>
  response.statusText
    ? `${response.status} ${response.statusText}`
    : String(response.status);

const formatBodyPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 120) {
    return JSON.stringify(normalized);
  }

  return JSON.stringify(`${normalized.slice(0, 117)}...`);
};
