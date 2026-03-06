# TypeScript Style Guide (Derived from `source/*.ts`)

This guide captures the prevailing style in this repository and sets the default direction for refactoring and new code.

## 1) General
- Prefer readability over cleverness.
- Keep behavior explicit; avoid hidden side effects.
- Favor consistency with existing module patterns unless a file is being fully modernized.

## 2) File Preamble and Imports
- Use spellchecker guards where needed:
  - `/* spellchecker: disable */`
  - imports/constants
  - `/* spellchecker: enable */`
- Group imports in this order, separated by a blank line:
  1. External packages (`webgl-operate`, npm deps)
  2. Internal modules (`./...`)
  3. Assets/data imports (json, shader/font assets)
- Prefer single quotes in import specifiers.
- Keep one import per line for local modules.

## 3) Formatting
- Indentation: 4 spaces.
- Line endings: LF.
- Always use semicolons.
- Use trailing commas in multiline object/array literals and enum members.
- Keep braces on the same line for declarations and control flow.
- Add a blank line between logical blocks; avoid dense vertical packing.

## 4) Naming
- `PascalCase`: classes, enums, exported types.
- `camelCase`: functions, methods, locals, parameters.
- Private/protected fields: leading underscore (e.g., `_layoutLinearization`).
- Constants: `UPPER_SNAKE_CASE` for true constants (`POINT_SIZE`), otherwise `camelCase`/`readonly`.

## 5) TypeScript Typing
- Type everything public/protected (params + returns).
- Prefer explicit return types on non-trivial functions.
- Prefer concrete unions and enums over `any`.
- Use `Array<T>` consistently in this codebase (preferred over `T[]` for uniformity with existing source).
- Use non-null assertions (`!`) only when invariants are clear and local.

## 6) Classes and APIs
- Keep exported API surfaces explicit (`export class`, `export interface`, namespace enums where already used).
- Use getters/setters for validated state transitions.
- Keep constructors lightweight; move heavier setup into dedicated methods where possible.
- For static utility logic, prefer `static` methods over free functions when strongly tied to one domain type.
- Avoid free functions that are tightly coupled to classes, use static member functions if needed
- Namespaces are good to group free functions

## 7) Error Handling and Assertions
- Use `auxiliaries.assert` for invariant checks in performance-critical/internal paths.
- Throw `Error` with concrete messages for invalid API usage or impossible states.
- Never fail silently for invalid input in new/refactored code.

## 8) Comments and Documentation
- Use JSDoc for exported/public members and non-obvious internal logic.
- Keep comments factual and short; explain intent/invariants, not syntax.
- Maintain existing `@todo` markers only when actionable; remove stale todos during refactors.

## 9) Control Flow and Data Handling
- Prefer early returns to reduce nesting.
- Keep range and boundary checks explicit.
- Preserve contiguous-range and index-space invariants with helper functions.
- Reuse precomputed data (prefix sums, mappings) instead of recomputing inside loops.

## 10) Layout/Geometry Code Conventions
- Keep coordinate operations numerically safe:
  - guard divisions,
  - clamp where needed,
  - avoid NaN propagation.
- Validate partition outputs before recursion (non-empty, contiguous, bounded).
- Ensure recursive algorithms guarantee progress on every step.

## 11) Testing Expectations (for refactoring/new code)
- Add/extend Vitest coverage for:
  - normal scenarios,
  - skewed/degenerate inputs,
  - regression paths for previously observed bugs.
- For geometry/layout outputs, test invariants (valid rects, containment, continuity) rather than brittle exact coordinates.

## 12) Refactoring Priorities
When touching legacy areas, prefer small, safe improvements in this order:
1. Correctness and invariant safety.
2. Deterministic behavior on edge cases.
3. Clear typing and API contracts.
4. Performance (remove avoidable recomputation/allocation).
5. Cosmetic formatting consistency.

## 13) Polyfill
The polyfill layer is considered legacy code and should not be part of automated review and refactoring.

## 14) Validation Strategy
- Distinguish schema validation (setters) from semantic reference validation (cross-reference consistency).
- Keep setters focused on shape and local constraints; avoid throwing semantic reference errors there.
- Centralize unresolved-reference checks in `Configuration.validateReferences()`.
- Call `validateReferences()` at explicit processing boundaries (for example, before layout/resolve work in `Visualization.update()`).
- Reference-validation errors must remain actionable and section-specific, e.g. `Configuration validation failed for 'layout': unknown buffer reference 'buffer:weights'.`.

## 15) Type Predicates
- Use `value is Type` predicates for runtime guards that also narrow types (especially for reference detection).
- Keep predicates side-effect free.
- Route semantic failures through dedicated error helpers after predicate checks.

## 16) Validation-First Testing
- Test schema validation failures and semantic reference failures in separate test cases.
- Add order-insensitive scenarios where references are set before/after definitions and validate in one consolidated pass.
- Include explicit regression tests for unresolved references at each config boundary (`layout`, `bufferViews`, `geometry`, `labels`).
