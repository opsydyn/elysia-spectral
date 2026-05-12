# @opsydyn/elysia-spectral roadmap

## purpose

this roadmap turns the current `v0.1` implementation into an extensible, production-grade OpenAPI linting plugin for Elysia without breaking the core design constraint: stay thin, rely on `@elysiajs/openapi`, and avoid building a separate contract system.

## current state

the repository is now beyond the original earliest `v0.1` baseline.

implemented today:

- startup linting
- threshold-based failure
- startup modes: `enforce`, `report`, and `off`
- opt-in healthcheck endpoint for cached and fresh runs
- opt-in HTML dashboard endpoint
- repo-level ruleset autodiscovery
- local YAML rulesets
- local JS and TS ruleset modules
- in-memory rulesets
- custom function exports from module rulesets
- first-party governance presets: `recommended`, `server`, `strict`
- formal ruleset resolver pipeline
- sink abstractions with built-in and custom output sinks
- console output with package-owned formatting
- JSON report output
- self-describing JSON report metadata:
  - `failOn`
  - `durationMs`
  - relative artifact paths
- JUnit report output
- SARIF report output
- Bruno collection output
- OpenAPI snapshot output
- artifact write failure policy: warn or error
- reusable runtime for CI and tests
- runtime observability fields:
  - `status`
  - `startedAt`
  - `completedAt`
  - `durationMs`
  - `latest`
  - `lastSuccess`
  - `lastFailure`
- actionable spec-resolution errors
- single-flight run deduplication
- lazy Stoplight loading that avoids import-time ruleset initialisation
- packed Bun/Node import smoke coverage and fresh-runner CI matrix validation

remaining work is now primarily about `1.0` stabilization rather than missing product features:

- lock stable public API and package boundaries
- audit backwards compatibility and safe production defaults
- publish migration notes for the `1.0` transition

## target state

the target `v1` should look like this:

- thin Elysia plugin adapter
- reusable lint engine that can run in app startup, CI, or manual tooling
- pluggable spec providers, ruleset resolvers, and output sinks
- safe production defaults with explicit opt-in runtime exposure
- stronger first-party policy presets for real API teams
- stable machine-readable outputs for CI and governance workflows

## guiding decisions

- keep Elysia route schemas as the source of truth
- keep linting read-only
- prefer public OpenAPI surfaces over framework internals
- make prod behavior explicit and low-overhead by default
- separate engine concerns from framework adapter concerns
- optimize for CI determinism and operator clarity

## milestone status

### milestone 0.2

goal: make the plugin safe and predictable enough for wider internal use.

status: complete

completed:

- healthcheck route is opt-in
- startup linting is separated from route exposure
- docs and examples match the current defaults
- tests cover startup-only behavior and disabled endpoint behavior
- tests cover misconfigured spec path and invalid OpenAPI JSON responses
- failure messages for spec resolution are actionable

remaining:

- none

acceptance status:

- no route is added unless explicitly configured: complete
- startup lint can be enabled without exposing any endpoint: complete
- README and examples match runtime behavior exactly: complete
- failure messages for spec resolution are actionable: complete

### milestone 0.3

goal: make the runtime operationally credible.

status: complete

completed:

- runtime state includes `status`, `startedAt`, `completedAt`, `durationMs`, `lastSuccess`, and `lastFailure`
- single-flight protection prevents duplicate concurrent runs
- startup execution modes are explicit
- artifact write failure policy supports warn or error
- console output is significantly more legible and package-owned
- startup report mode is package-owned rather than app-owned

remaining:

- no blocking implementation work remains in `0.3`; richer healthcheck metadata and finer-grained run-source labels are optional future enhancements.

acceptance status:

- repeated fresh requests during a run share the same in-flight execution: complete
- runtime state is queryable and useful for debugging: complete
- CI can fail on report write failures when configured: complete
- local development stays ergonomic and does not regress: complete

### milestone 0.4

goal: make policy and output extensible without bloating the plugin.

status: complete

completed:

- repo-root rulesets are the primary customization path
- current simple usage remains supported
- local YAML, JS, TS, and in-memory rulesets work
- module rulesets can export custom functions
- autodiscovery and default-rule merging are implemented
- fixed `output` model replaced with named sink abstractions
- ruleset loading formalized as a resolver pipeline with pluggable `RulesetResolver` functions
- SARIF output built in as the first non-JSON machine-readable sink
- JUnit output built in for CI test result consumers
- custom output sinks supported via `options.output.sinks` without patching runtime code

acceptance criteria:

- a team can drop `spectral.yaml` at the app or repo root and use it without extra package wiring: complete
- current simple usage remains supported: complete
- advanced users can add new ruleset and output strategies without patching core runtime code: complete
- SARIF output works in CI systems that consume code scanning artifacts: complete

### milestone 0.5

goal: ship stronger first-party governance presets.

status: complete

completed:

- `recommended`, `server`, and `strict` presets shipped
- RFC 9457 Problem Details enforcement in `strict` via custom Spectral function
- `preset` option in plugin and runtime
- `LintRunSource` metadata added to `LintRunResult` (`startup`, `healthcheck`, `manual`)
- README updated with preset comparison table, RFC 9457 standards reference, and What Is Elysia? section

### milestone 0.6

goal: make CI and downstream tooling first-class.

status: complete

completed:

- reusable core runtime works in CI and tests
- JSON, SARIF, and JUnit outputs available
- artifact write policy can enforce CI correctness
- documented CI entrypoint (`createOpenApiLintRuntime`) as a primary workflow
- documented GitHub Actions integration for SARIF code scanning and JUnit test reporters
- documented OpenAPI snapshot drift detection with `git diff --exit-code`

completed (late additions):

- Bruno collection generation via `output.brunoCollectionPath` using `@usebruno/converters`
- documented downstream codegen chaining into `openapi-ts` with drift detection
- API surface audit: removed `normalizeFindings`, `isEnabled`, `exceedsThreshold`, `SpecProvider` from public exports
- `LintRunResult.ok` now reflects configured `failOn` threshold rather than hardcoded `error === 0`
- fresh-runner CI coverage for the full test suite and packed import smoke path on Ubuntu and macOS

### milestone 0.7

goal: make `LintRunResult` self-describing for production teams and CI consumers.

status: complete

completed:

- `LintRunResult` includes `failOn` and `durationMs`
- persisted JSON reports serialise the completed result model after runtime timing is stamped
- artifact paths in `result.artifacts` are relative to `process.cwd()` in serialised results
- tests cover self-describing JSON report fields and portable artifact paths

acceptance criteria:

- `openapi-lint.json` includes `durationMs`, `failOn`, and relative artifact paths: complete
- reports generated on different machines retain the same portable shape and relative path semantics: complete
- existing tests pass with the updated fixture/result model: complete

### milestone 1.0

goal: stabilize the architecture and package boundaries.

status: future

planned scope:

- split the codebase into clearer layers if justified:
  - engine/core
  - Elysia plugin adapter
  - preset packages or preset modules
- lock a stable public API for:
  - plugin options
  - runtime execution
  - result model
  - sink and resolver extension points
- audit defaults for backwards compatibility and safe production behavior
- publish migration notes from `v0.1` style configuration to `v1`

## recommended implementation order

1. stabilize public API surface and package boundaries for `1.0`
2. audit backwards compatibility and safe production defaults
3. publish migration notes from pre-`1.0` configuration to `v1`

## explicit non-goals

these should stay out unless the product direction changes:

- generating OpenAPI independently of `@elysiajs/openapi`
- mutating specs to auto-fix lint findings
- shipping a general API governance UI
- supporting every Spectral feature directly in the top-level plugin API
- turning the package into a remote spec crawler

## next concrete actions

the next high-leverage implementation tasks are now:

1. stabilize public API surface and package boundaries for `1.0`
2. audit backwards compatibility and safe production defaults before `1.0`
3. publish migration notes from pre-1.0 configuration to `v1`
