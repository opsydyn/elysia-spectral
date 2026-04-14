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
- repo-level ruleset autodiscovery
- local YAML rulesets
- local JS and TS ruleset modules
- in-memory rulesets
- custom function exports from module rulesets
- console output with package-owned formatting
- JSON report output
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

remaining limitations are now more architectural than functional:

- output handling is still convenience flags rather than sink abstractions
- ruleset resolution is flexible but not yet a formal resolver pipeline
- first-party policy presets are still light
- CI outputs are still oriented around JSON artifacts rather than broader machine-consumable formats
- the codebase is still one package even though core/plugin/preset responsibilities are becoming clearer

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

status: mostly complete

completed:

- healthcheck route is opt-in
- startup linting is separated from route exposure
- docs and examples match the current defaults
- tests cover startup-only behavior and disabled endpoint behavior
- tests cover misconfigured spec path and invalid OpenAPI JSON responses
- failure messages for spec resolution are actionable

remaining:

- no major remaining implementation work in `0.2`

acceptance status:

- no route is added unless explicitly configured: complete
- startup lint can be enabled without exposing any endpoint: complete
- README and examples match runtime behavior exactly: complete
- failure messages for spec resolution are actionable: complete

### milestone 0.3

goal: make the runtime operationally credible.

status: mostly complete

completed:

- runtime state includes `status`, `startedAt`, `completedAt`, `durationMs`, `lastSuccess`, and `lastFailure`
- single-flight protection prevents duplicate concurrent runs
- startup execution modes are explicit
- artifact write failure policy supports warn or error
- console output is significantly more legible and package-owned
- startup report mode is package-owned rather than app-owned

remaining:

- decide whether the healthcheck should expose richer runtime metadata directly
- decide whether run source metadata should be tracked explicitly, for example `startup`, `fresh-healthcheck`, or `manual`
- optional final console polish to unify the `report` continuation line even further with the full report block

acceptance status:

- repeated fresh requests during a run share the same in-flight execution: complete
- runtime state is queryable and useful for debugging: complete
- CI can fail on report write failures when configured: complete
- local development stays ergonomic and does not regress: complete

### milestone 0.4

goal: make policy and output extensible without bloating the plugin.

status: partial foundation complete

already complete:

- repo-root rulesets are the primary customization path
- current simple usage remains supported
- local YAML, JS, TS, and in-memory rulesets work
- module rulesets can export custom functions
- autodiscovery and default-rule merging are implemented

not yet complete:

- replace the fixed `output` model with sink-style abstractions
- formalize a ruleset resolver pipeline instead of just richer loader behavior
- support built-in SARIF output
- expose extension points cleanly enough that users can add new output or resolver strategies without patching runtime code

acceptance criteria:

- a team can drop `spectral.yaml` at the app or repo root and use it without extra package wiring: complete
- current simple usage remains supported: complete
- advanced users can add new ruleset and output strategies without patching core runtime code: not yet complete
- SARIF output works in CI systems that consume code scanning artifacts: not yet complete

### milestone 0.5

goal: ship stronger first-party governance presets.

status: not started in earnest

planned scope:

- add preset policy packs:
  - `recommended`
  - `server`
  - `strict`
- strengthen rules around:
  - operation summaries
  - descriptions
  - tags
  - `operationId` presence and consistency
  - response schema coverage
  - reusable error model expectations
  - examples where they materially improve downstream generation
- document which rules are style-focused versus contract-quality-focused

### milestone 0.6

goal: make CI and downstream tooling first-class.

status: partially enabled, not yet formalized

already present:

- reusable core runtime works in CI and tests
- JSON output and spec snapshots are available
- artifact write policy can enforce CI correctness

not yet formalized:

- documented CI entrypoint as a primary workflow
- stable machine-oriented formats beyond JSON
- optional JUnit output if needed
- documented snapshot and diff workflows
- documented chaining into downstream generation or contract tooling

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

1. finish the remaining runtime polish in `0.3`
2. formalize extensibility seams in `0.4`
3. strengthen first-party policy value in `0.5`
4. formalize CI and downstream workflows in `0.6`
5. stabilize architecture and packaging for `1.0`

## explicit non-goals

these should stay out unless the product direction changes:

- generating OpenAPI independently of `@elysiajs/openapi`
- mutating specs to auto-fix lint findings
- shipping a general API governance UI
- supporting every Spectral feature directly in the top-level plugin API
- turning the package into a remote spec crawler

## next concrete actions

the next high-leverage implementation tasks are now:

1. design sink-style output interfaces behind the current convenience options
2. add SARIF output as the first non-JSON machine-readable sink
3. formalize ruleset resolution as a resolver pipeline rather than just an enriched loader
4. define the first preset set for `recommended`, `server`, and `strict`
5. document CI as a primary supported workflow using `createOpenApiLintRuntime`
6. optionally add explicit runtime source metadata such as `startup`, `healthcheck`, or `manual`

## done definition for the next release

the next release after `v0.1` is successful if:

- the roadmap matches the real implementation state
- output and ruleset extensibility have a visible path in code, not just notes
- the package can emit at least one additional CI-oriented machine-readable format
- the first preset story is concrete enough to start implementation
