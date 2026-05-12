export class RulesetLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RulesetLoadError';

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
