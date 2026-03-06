
# Non-functional Requirements (Implementation Constraints)

## Dependencies
Core dependencies are:
- npm
- TypeScript
- vite
- WebGL
- webgl-operate

## Architecture
Modules:
- `treemap-renderer`: The visualization and rendering library
- `tests`: The tests of the library
- `examples`: a self-hostable entrypoint to a website with an overview to the library along several demonstrators

## Validation and Safety
- Separate schema validation (setters) from semantic/reference validation.
- Keep setters focused on local shape constraints and schema-level validation.
- Centralize unresolved-reference checks in `Configuration.validateReferences()`.
- Call `Configuration.validateReferences()` at explicit processing boundaries before layout/resolve work (for example in `Visualization.update()`).
- Keep validation errors actionable and section-specific, with concrete messages including the section and unknown reference.
- Use dedicated error helpers for semantic failures and surface them instead of silently ignoring invalid input in new/refactored paths.
- Do not fail silently for invalid input in new/refactored code.

## Type Modeling and Contracts
- Use runtime type predicates (`value is Type`) for validation and narrowing.
- Keep type predicates side-effect free.
- Preserve existing public API semantics while ensuring clear contracts.

## Layout and Geometry Correctness
- Preserve contiguous-range and index-space invariants in layout/topology-related code.
- Validate partition outputs before recursion (non-empty, contiguous, bounded).
- Ensure recursive algorithms make progress on every step.
- Guard coordinate/math operations to avoid invalid numeric states (`NaN`, divide-by-zero risks) and clamp where needed.
- Guarantee layout geometry invariants (valid rects, containment, continuity) before accepting results.
- Do not recompute expensive data in hot loops when precomputed structures (e.g., prefix sums, mappings) are available.

## Testing Requirements
- Test schema validation failures and semantic reference failures in separate test cases.
- Include order-insensitive reference-resolution scenarios where sections are provided before/after dependent definitions and validated in a consolidated pass.
- Include explicit unresolved-reference regression tests at each config boundary (`layout`, `bufferViews`, `geometry`, `labels`).
- Extend tests for normal scenarios, skewed/degenerate inputs, and previously observed regression paths.

## Refactoring and Evolution
- When refactoring legacy areas, prioritize:
  1. Correctness and invariant safety
  2. Deterministic edge-case behavior
  3. Clear typing and API contracts
  4. Performance improvements
  5. Formatting consistency

# Non-Functional Requirements
- Favor deterministic and understandable behavior in all APIs.
- Keep behavior explicit; avoid hidden side effects.
- Prefer code readability over cleverness.
- Favor consistency with established project patterns.
- Keep code changes minimal and safe unless a file is fully modernized.
