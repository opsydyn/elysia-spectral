# elysia-spectral roadmap

## purpose

this roadmap turns the current v0.1 implementation into an extensible, production-grade OpenAPI linting plugin for Elysia without breaking the core design constraint: stay thin, rely on `@elysiajs/openapi`, and avoid building a separate contract system.

## current state

the repository already has a working v0.1:

- startup linting exists
- threshold-based failure exists
- local YAML and in-memory rulesets exist
- console and JSON outputs exist
- OpenAPI snapshot output exists
- a reusable runtime exists for CI and tests
- an optional lint endpoint exists for cached and fresh checks
- tests are passing for the current scope

the current limitations are structural, not cosmetic:

- route exposure is too implicit for production use
- runtime state is too small for operational use
- ruleset loading is too narrow for team-scale customization
- outputs are artifact flags, not extensible sinks
- the built-in ruleset is useful but too light for serious API governance

## target state

the target v1 should look like this:

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

## milestone 0.2

goal: make the current plugin safe and predictable enough for wider internal use.

scope:

- make the healthcheck endpoint opt-in instead of effectively on by default
- separate startup linting from endpoint exposure in the options model
- align docs with real behavior and supported defaults
- add tests for disabled endpoint behavior and startup-only behavior
- add tests for misconfigured spec path and invalid OpenAPI JSON responses

acceptance criteria:

- no route is added unless explicitly configured
- startup lint can be enabled without exposing any endpoint
- README and examples match runtime behavior exactly
- failure messages for spec resolution are actionable

why this comes first:

- this is the highest-value safety fix with the smallest design surface
- it removes the biggest production surprise before adding more features

## milestone 0.3

goal: make the runtime operationally credible.

scope:

- expand runtime state to include status, startedAt, completedAt, durationMs, lastSuccess, lastFailure, and source information
- add single-flight protection so concurrent fresh runs do not trigger duplicate lint executions
- add explicit execution modes such as `startup`, `manual`, and `off`
- support non-fatal and fatal artifact write policies
- improve console output so summaries stay short while failures remain debuggable

acceptance criteria:

- repeated fresh requests during a run share the same in-flight execution
- runtime state is queryable and useful for debugging
- CI can fail on report write failures when configured
- local development stays ergonomic and does not regress

why this matters:

- production-grade tooling needs runtime behavior that is observable and deterministic under load

## milestone 0.4

goal: make policy and output extensible without bloating the plugin.

scope:

- replace the fixed `output` model with sink-style output abstractions
- introduce a ruleset resolver pipeline instead of only local YAML loading
- support rulesets from:
  - package default preset
  - local YAML
  - imported object
  - local JS or TS module
- support built-in sinks for:
  - console
  - JSON artifact
  - spec snapshot
  - SARIF
- preserve the simple top-level API by mapping convenience options onto the new engine interfaces

acceptance criteria:

- current simple usage remains supported
- advanced users can add new ruleset and output strategies without patching core runtime code
- SARIF output works in CI systems that consume code scanning artifacts

why this matters:

- this is the main extensibility breakpoint between a useful plugin and a platform-quality library

## milestone 0.5

goal: ship stronger first-party governance presets.

scope:

- add preset policy packs:
  - `recommended`
  - `server`
  - `strict`
- strengthen rules around:
  - operation summaries
  - descriptions
  - tags
  - operationId presence and consistency
  - response schema coverage
  - reusable error model expectations
  - examples where they materially improve downstream generation
- document which rules are style-focused versus contract-quality-focused

acceptance criteria:

- a team can adopt the plugin with a preset and get meaningful lint value without authoring a custom ruleset first
- presets are documented with rationale and expected false-positive tradeoffs
- unhappy-path fixtures prove the stricter rules catch real issues

why this matters:

- a production-grade linting package needs an opinionated default path, not just raw Spectral plumbing

## milestone 0.6

goal: make CI and downstream tooling first-class.

scope:

- add a documented CI entrypoint built around the core runtime
- add stable result metadata suitable for PR annotations and artifact retention
- add optional JUnit output if needed by common CI systems
- document contract snapshot workflows for OpenAPI diff review
- document post-lint chaining into downstream generation such as Bruno or SDK workflows

acceptance criteria:

- CI usage is documented as a supported primary workflow, not just an example
- outputs are stable enough for automation across multiple repositories
- downstream tooling flows can be composed after successful lint runs

why this matters:

- `project.md` explicitly targets CI friendliness and downstream tooling, so the package should support that as a first-class path

## milestone 1.0

goal: stabilize the architecture and package boundaries.

scope:

- split the codebase into clear layers if the added surface justifies it:
  - engine/core
  - Elysia plugin adapter
  - preset packages or preset modules
- lock a stable public API for:
  - plugin options
  - runtime execution
  - result model
  - sink and resolver extension points
- audit defaults for backwards compatibility and safe production behavior
- publish migration notes from v0.1-style configuration to v1 configuration

acceptance criteria:

- the public API can be versioned confidently
- extension points are documented and tested
- the package remains thin from the point of view of Elysia users

## recommended implementation order

1. fix safety defaults and option clarity in 0.2
2. harden runtime behavior in 0.3
3. add extensibility seams in 0.4
4. strengthen policy value in 0.5
5. formalize CI and downstream workflows in 0.6
6. stabilize and package for v1.0

## explicit non-goals

these should stay out unless the product direction changes:

- generating OpenAPI independently of `@elysiajs/openapi`
- mutating specs to auto-fix lint findings
- shipping a general API governance UI
- supporting every Spectral feature directly in the top-level plugin API
- turning the package into a remote spec crawler

## next concrete actions

the next high-leverage implementation tasks are:

1. change endpoint exposure so it is opt-in only
2. redesign the options shape around execution mode versus exposure mode
3. add tests for misconfigured spec resolution and disabled endpoints
4. introduce richer runtime state and in-flight run deduplication
5. design sink and ruleset resolver interfaces before adding new output types

## done definition for the next release

the next release is successful if:

- production defaults are safe
- the docs match the actual behavior
- runtime behavior is more observable
- the path to extensibility is visible in the code structure, not just in notes
