# Tax Diagram Studio (Starter Clone)

This repository contains a starter implementation inspired by:
https://jyen2k.github.io/tax-diagram-tool/

## What's implemented

- Entity palette updated to match the provided legend colors/shapes (including U.S./foreign entities, individual, unrelated, branch).
- Relationship modes (select, equity line, debt arrow).
- SVG workspace with drag-to-move entities and drag blank space to pan.
- Selection panel to edit entity and relationship labels.
- Shape stacking control (1–6) to represent multiple entities as noted in the legend.
- Local save/load (up to 5 diagrams) with `localStorage`.
- Export to SVG and PNG.
- Equity lines now support straight/elbow connectors, editable text labels, line color/style controls, and optional arrowheads at either end.

## Run locally

Because this is a static site, open `index.html` directly in your browser or serve it:

```bash
python3 -m http.server 4173
```

Then visit: `http://localhost:4173`
