import { openapi } from '@elysiajs/openapi';
import { Elysia, t } from 'elysia';

export type SyntheticAppOptions = {
  operationCount: number;
  title?: string;
};

export const buildSyntheticApp = ({
  operationCount,
  title = 'Synthetic Benchmark API',
}: SyntheticAppOptions) => {
  let app: ReturnType<typeof base> = base(title);

  for (let index = 0; index < operationCount; index += 1) {
    app = mountResource(app, index);
  }

  return app;
};

const base = (title: string) =>
  new Elysia().use(
    openapi({
      documentation: {
        info: { title, version: '1.0.0' },
        tags: [{ name: 'Resources', description: 'Synthetic resources.' }],
      },
    }),
  );

const itemSchema = t.Object({
  id: t.String(),
  name: t.String(),
  createdAt: t.String(),
});

const mountResource = <App extends ReturnType<typeof base>>(
  app: App,
  index: number,
) => {
  const resource = `resource${index}`;

  return app
    .get(`/${resource}`, () => [], {
      response: { 200: t.Array(itemSchema) },
      detail: {
        summary: `List ${resource}`,
        description: `Returns all ${resource} items.`,
        operationId: `list${capitalize(resource)}`,
        tags: ['Resources'],
      },
    })
    .get(
      `/${resource}/:id`,
      () => ({
        id: '1',
        name: 'example',
        createdAt: new Date().toISOString(),
      }),
      {
        response: { 200: itemSchema },
        detail: {
          summary: `Get ${resource}`,
          description: `Returns a single ${resource} item by id.`,
          operationId: `get${capitalize(resource)}`,
          tags: ['Resources'],
        },
      },
    );
};

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);
