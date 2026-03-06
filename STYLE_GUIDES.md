# TypeScript Style Guide (Derived from `source/*.ts`)

This guide captures the prevailing style-only guidance in this repository for refactoring and new code.

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
- Prefer explicit return types on non-trivial functions.
- Prefer concrete unions and enums over `any`.
- Use `Array<T>` consistently in this codebase.
- Use non-null assertions (`!`) only when invariants are clear and local.

## 6) Classes and APIs
- Keep exported API surfaces explicit (`export class`, `export interface`, namespace enums where already used).
- Use getters/setters for validated state transitions.
- Keep constructors lightweight; move heavier setup into dedicated methods where possible.
- For static utility logic, prefer `static` methods over free functions when strongly tied to one domain type.
- Avoid free functions that are tightly coupled to classes; use static member functions if needed.
- Namespaces are useful to group free functions.

## 7) Comments and Documentation
- Use JSDoc for exported/public members and non-obvious internal logic.
- Keep comments factual and short; explain intent/invariants, not syntax.
- Maintain existing `@todo` markers only when actionable; remove stale todos during refactors.

## 8) Polyfill
The polyfill layer is considered legacy code and should not be part of automated review and refactoring.

For validation contracts, behavior requirements, testing policy, and algorithm invariants, use `REQUIREMENTS.md`.
