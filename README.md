# Tax Diagram Studio (Starter Clone)

This repository contains a starter implementation inspired by:
https://jyen2k.github.io/tax-diagram-tool/

## What's implemented

- Entity palette updated to match the provided legend colors/shapes (including U.S./foreign entities, individual, unrelated, branch).
- U.S. Corporation entities now default to a white fill.
- Relationship modes (select, equity line, debt arrow).
- SVG workspace with drag-to-move entities and drag blank space to pan.
- Selection panel to edit entity and relationship labels.
- Shape stacking control (1–6) to represent multiple entities as noted in the legend.
- Local save/load (up to 5 diagrams) with `localStorage`.
- Export to SVG and PNG.
- Visual refresh with a Bain-inspired executive look (deep blue hero, premium card layout, cleaner typography).
- Equity lines now support straight/elbow connectors, editable text labels, line color/style controls, and optional arrowheads at either end.
- Equity lines are fully editable (text label, color, straight/elbow connector, arrowheads, and optional dashed style) and move dynamically when entities are repositioned.

## Run locally

Because this is a static site, open `index.html` directly in your browser or serve it:

```bash
python3 -m http.server 4173
```

Then visit: `http://localhost:4173`
