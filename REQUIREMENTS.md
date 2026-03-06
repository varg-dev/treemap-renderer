# Domain Requirements (Functional Requirements)

## Scope
This library provides a WebGL-based treemap visualization stack with three core layers:
1. configuration-driven data model
2. layout/geometry generation
3. interactive rendering pipeline

## Interfacing approaches
1. Programmatic API: import `Visualization`, `Renderer`, and `Configuration` from the package entry.
2. Direct config assembly: build `Configuration` sections (`topology`, `buffers`, `bufferViews`, `colors`, `layout`, `geometry`, `labels`) and assign to `visualization.configuration`.
3. JSON interchange: use `Configuration.toJSON()` and parse JSON config objects for save/load flows.
4. CSV frontends in examples: parse tabular data and generate config automatically (explicit-ID mode, implicit-ID mode, path-based mode, grouped-node mode, and file-based mode).
5. Initialization helper: call `initialize(canvasOrId)` to create the webgl-operate canvas and defaults for antialiasing, clear color, event blocker, and controller defaults.
6. 2D/3D dual rendering mode: instantiate `Visualization(VisualizationType.VISUALIZATION_2D)` or default 3D mode.

## Supported feature set
1. Topology ingestion
2. Topology sources are supplied as tree edges in interleaved or tupled arrays.
3. Topology semantics support parent-id-id and parent-index-id interpretation.
4. Hierarchy construction accepts single-root trees and supports explicit inner-node and leaf-node ordering.
5. Sorting strategies are supported as part of layout preprocessing.

## Layout and structure generation
1. Layout algorithms:
2. Strip layout
3. Snake layout
4. Hilbert layout
5. Moore layout
6. Code City layout
7. Weight-based layout weighting (`layout.weight` buffer reference).
8. Sibling margin controls with absolute and relative modes.
9. Parent padding controls with absolute, relative, and mixed modes.
10. Accessory padding controls with absolute/relative mode, direction, area threshold, and target aspect ratio.
11. Optional aspect ratio setting for root canvas-space target.
12. Node sorting in preprocessing:
13. Keep order
14. Ascending/descending by weight
15. Ascending/descending by node identifier
16. Ascending/descending by external sort buffer

## Data and attribute handling
1. Raw buffer definitions support numeric and typed array inputs.
2. Supported typed sources include native buffers for `uint8`, `int8`, `uint16`, `int16`, `uint32`, `int32`, `float32`, `float64`, and number arrays.
3. Source buffers use linearization metadata (topology order and explicit id/index mappings).
4. Buffer views support transformation chains:
5. normalization (`zero-to-max`, `min-to-max`, `sign-agnostic-max`, `diverging`)
6. propagation (`sum`, `average`, `min`, `max`, `median`, `closest-to-zero`, `closest-to-infinity`)
7. value transforms (`fill-invalid`, `mask`, `clamp`, `threshold`, `compare`)
8. generic transform operations (`add`, `subtract`, `multiply`, `divide`, `pow`, `sqrt`, `abs`, `callback`, etc.)
9. callback iteration modes:
10. top-down, depth-first, leaf-only, bottom-up
11. `range-transform`, `normalize`, and derived view output caching through normalization mapping.

## Geometry and visual encoding
1. Parent-layer rendering with color map and root visibility control.
2. Leaf-layer rendering with:
3. external height input
4. optional area scaling
5. external color values
6. leaf color mapping and optional `colorsNormalized` flag.
7. Emphasis system with outline and highlight node sets plus outline width.
8. Height mapping with either explicit numeric scale or approach-driven estimator.
9. Color system supports:
10. explicit color triples/quads/hex values
11. color arrays and preset color sets from integrated palettes.
12. Label system supports:
13. explicit name maps
14. optional additional label sets
15. top-k filters for inner nodes and per-metric ranking
16. adaptive label placement and automatic overlap handling.

## Interaction and rendering runtime
1. Navigation and camera controls support rotate, pan, and zoom (mouse/touch mappings implemented for pan/hover/select behaviors).
2. Exposed camera mutators for scripted camera updates.
3. Event stream hooks for node enter, move, leave, and select.
4. Node picking by screen coordinates and world coordinate lookup.
5. Multi-pass renderer chain with:
6. inner node quad pass
7. leaf cuboid pass
8. leaf/inner label passes
9. label background and point passes
10. optional readback and accumulation passes.
11. Anti-aliasing via multi-frame accumulation and adjustable sampling scale.

## Examples and integration use cases
1. Direct config editing example: paste full JSON, live-apply and serialize using `toJSON()`.
2. CSV-driven examples:
3. explicit-id datasets (ids + parents columns),
4. implicit path/file-path datasets,
5. grouped-node mode,
6. nominal/diverging value variants,
7. local file-backed CSV flows.
8. Typical use cases:
9. hierarchical KPI or metric exploration,
10. software/package or file-system layout inspection,
11. research prototyping of layout and mapping variants,
12. comparative visual analytics scenarios.

## Implementation constraints expected in this project
1. Topology and data are validated through schema validation and explicit reference checks.
2. Reference integrity requires consistent `buffer:` and `color:` references across sections.
3. Render-updates are lazy and delta-driven using alteration tracking on configuration and geometry.
4. Geometry is the single payload passed from visualization logic into renderer; renderer operates on generated geometry buffers.
5. Changes to config should remain incremental and reset alteration state after processing.

