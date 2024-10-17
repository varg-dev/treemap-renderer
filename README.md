# VARG Treemap Renderer

This package provides a WebGL treemap renderer for websites and web environments that builds upon the webgl-operate rendering middleware.

# Setup

This project uses `npm` (tested with 22, lower versions may work too) for setup.

```bash
nvm use 22
npm install
```

# Development

```bash
npm run build:dev
```

# Integration and Usage

As there is currently no npm package published, we suggest to add this project as a submodule or copy the source code into your own project.

Example using git:
```bash
git submodule add git@github.com:varg-dev/treemap-renderer.git
cd treemap-renderer
npm install
npm run build
```

Example integration into an own npm package as dev dependency:
```json
{
    /* ... */
    "devDependencies": {
        /* ... */
        "treemap-renderer": "file:deps/treemap-renderer",
        /* ... */
    },
    /* ... */
}
```

# Features

The treemaps that this renderer currently supports a as follows:
* Treemap Layout:
  * Packing Layout:
    * Code City Layout
  * Splitting Layout:
    * Strip Treemap
    * Snake Treemap
  * Node Sorting
  * Margins between Nodes
* Color Mappings:
  * Colorbrewer Color Schemes
  * Explicit Colors
* Height Mapping
* Emphasis
* Labeling

There are far more features and variations imaginable, already researched, and planned to be integrated later.
If you want a feature integrated, please feel free to [open an issue](https://github.com/varg-dev/treemap-renderer/issues/new/choose).

# Config

Internally, the treemap renderer expects a configuration object to be filled.
This configuration object is build from multiple visualization-phase-specific sub-objects, namely:

* `topology`: Information about nodes and their hierarchical structure
* `buffers`: Raw data that will be transformed for visual mapping
* `bufferViews`: Transformations from raw data that can be used for visual mapping
* `colors`: Information on the used color mappings
* `layout`: Treemap layout configuration
* `geometry`: Information on the desired geometrical mapping (e.g., height)
* `labels`: Node labels to display on screen

Minimal config:
```json
{
    "topology": {
        "format": "tupled",
        "semantics": "parent-id-id",
        "edges": [ [ -1, 0 ]]
    },
    "buffers": {
        "weights": [ 1.0 ]
    },
    "layout": {
        "algorithm": "strip",
        "weight": "buffer:weights"
    }
}
```

Example config:
```json
{

}
```

However, instead of filling this config directly - which can be bothersome concerning the topology -, there are a number of configuration frontends that can be used for an easier setup of a treemap.

# Config Frontends

## From CSV with Explicit Hierarchy through Edges

## From CSV with Implicit Hierarchy in Identifier

Read: File paths

## From CSV with Groupings building Hierarchy

# Contact

This treemap renderer was developed by a group of students and researchers having the following affiliations:
* Computer Graphics Research Group at Hasso Plattner Institute, Digital Engineering Faculty, University of Potsdam
* CG Internals

Current Maintainer: Willy Scheibel ([willy.scheibel@hpi.uni-potsdam.de](mailto:willy.scheibel@hpi.uni-potsdam.de))
