# elysia-spectral dev app

Workspace example app used for local plugin development, docs, and unhappy-path validation.

Run the happy and unhappy dev flows from the monorepo root when possible. The root scripts build the workspace package first, then start this app.

## Scripts

```bash
bun run dev
bun run dev:unhappy
bun run typecheck
```

## Endpoints

- Happy app: `http://localhost:3000`
- Unhappy app: `http://localhost:3001`
- OpenAPI UI: `/openapi`
- OpenAPI JSON: `/openapi/json`
- Lint healthcheck: `/health/openapi-lint`

## Output Artifacts

- Happy lint report: `./artifacts/openapi-lint.json`
- Unhappy lint report: `./artifacts/openapi-lint-unhappy.json`
- Derived snapshot: `./elysia-spectral-dev-app.open-api.json`