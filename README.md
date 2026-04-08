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

## PowerPoint ribbon plugin (legend inserter)

A VBA-based PowerPoint plugin scaffold is included in `powerpoint-plugin/`:

- `powerpoint-plugin/LegendRibbon.xml` adds a dedicated **Org Chart Legend** ribbon tab with:
  - shape buttons matching the legend,
  - line-type buttons matching the legend,
  - size controls (`Set Standard Size` and `Reset to .71 x 2.12`).
- `powerpoint-plugin/LegendRibbon.bas` contains all callback code to insert preformatted shapes/lines on the active slide.

### Default standard shape size

- Height: **0.71 in**
- Width: **2.12 in**

This default is used for rectangular/triangle shapes and can be changed from the ribbon via `Set Standard Size`.

### Install into PowerPoint (VBA add-in workflow)

1. Open PowerPoint, then create/open a macro-enabled presentation (`.pptm`) or add-in (`.ppam`).
2. Import `powerpoint-plugin/LegendRibbon.bas` into the VBA project:
   - `Alt+F11` → right-click project → `Import File...`.
3. Use the **Office Custom UI Editor** (or RibbonX editor) to attach `powerpoint-plugin/LegendRibbon.xml` as `customUI14.xml` in the file package.
4. Save, close, reopen PowerPoint, and enable macros.
5. You should now see the **Org Chart Legend** ribbon tab.
