const guidanceByCode: Record<string, string> = {
  'elysia-operation-summary':
    'Add detail.summary to the Elysia route options so generated docs and clients have a short operation label.',
  'elysia-operation-tags':
    'Add detail.tags with at least one stable tag, for example [\'Users\'] or [\'Dev\'].',
  'operation-description':
    'Add detail.description with a short user-facing explanation of what the route does.',
  'operation-tags':
    'Add a non-empty detail.tags array on the route so the OpenAPI operation is grouped consistently.',
};

export const getFindingRecommendation = (
  code: string,
  message: string,
): string | undefined => {
  const direct = guidanceByCode[code];
  if (direct) {
    return direct;
  }

  if (
    code === 'oas3-schema' &&
    message.includes('required property "responses"')
  ) {
    return 'Add a response schema to the route, for example response: { 200: t.Object(...) } or response: { 200: t.Array(...) }.';
  }

  if (code.startsWith('operation-')) {
    return 'Add the missing operation metadata under detail on the Elysia route options.';
  }

  return undefined;
};
