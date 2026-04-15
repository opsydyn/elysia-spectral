declare module '@usebruno/converters' {
  export function openApiToBruno(
    spec: Record<string, unknown>,
  ): Record<string, unknown>;

  export function brunoToOpenCollection(
    collection: Record<string, unknown>,
  ): Record<string, unknown>;
}
