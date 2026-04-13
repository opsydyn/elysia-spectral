# AGENTS.md

## Scope

This repository is a Bun monorepo for the `elysia-spectral` package and its example Elysia app.

## Workspace Map

- `packages/elysia-spectral`: publishable Spectral plugin package
- `apps/dev-app`: example Elysia app used for docs, manual testing, and unhappy-path validation

Package-specific documentation lives in `packages/elysia-spectral/README.md`.

## Preferred Commands

Run commands from the repository root unless there is a clear reason to scope work to a single workspace.

Fresh clones require dependency installation before any Bun workspace script will work.

```bash
bun install
```

After install, the common root commands are:

```bash
bun run lint
bun run lint:fix
bun run dev
bun run dev:unhappy
bun run test
bun run build
bun run typecheck
```

The root `dev` scripts intentionally enforce workspace boundaries:

- `bun run dev` builds `packages/elysia-spectral` first, then starts `apps/dev-app`
- `bun run dev:unhappy` builds `packages/elysia-spectral` first, then starts the unhappy-path fixture app

Use individual workspace scripts only for workspace-local work.

If `bun run dev` fails with `/bin/bash: tsdown: command not found`, dependencies have not been installed yet in the workspace. Run `bun install` from the repo root first.

## Dev App Notes

The example app lives in `apps/dev-app`.

- happy app: `http://localhost:3000`
- unhappy app: `http://localhost:3001`
- OpenAPI UI: `/openapi`
- OpenAPI JSON: `/openapi/json`
- lint healthcheck: `/health/openapi-lint`

Expected generated artifacts:

- happy lint report: `apps/dev-app/artifacts/openapi-lint.json`
- unhappy lint report: `apps/dev-app/artifacts/openapi-lint-unhappy.json`
- derived OpenAPI snapshot: `apps/dev-app/elysia-spectral-dev-app.open-api.json`

OpenAPI snapshots are derived from the example app package name and land in the app root.

## Repo Conventions

- Biome is configured at the repo root and enforced via `bun run lint`.
- Match the existing formatter style: spaces for indentation, single quotes in JS/TS, semicolons enabled.
- Keep the publishable package free of embedded dev routes; dev-only routes belong in `apps/dev-app`.
- The example app consumes the workspace package and is the place for docs, manual validation, and unhappy-path testing.

## Release Notes

`release-please` manages semver releases for `packages/elysia-spectral`.

- `fix:` commits trigger patch releases
- `feat:` commits trigger minor releases
- `feat!:` or a `BREAKING CHANGE:` footer triggers major releases

Release configuration lives in:

- `release-please-config.json`
- `.release-please-manifest.json`
- `.github/workflows/release-please.yml`
