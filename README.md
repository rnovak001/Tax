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

This repo includes a minimal, end-to-end PowerPoint workflow in `powerpoint-plugin/`:

- `LegendRibbon.bas` (VBA callbacks for all ribbon buttons)
- `customUI14.xml` (Ribbon XML using Office 2010 customUI namespace)
- `build.ps1` (injects ribbon XML into a `.pptm` automatically)

### Default standard shape size

- Height: **0.71 in**
- Width: **2.12 in**

### Quick start (no RibbonX Editor)

1. In desktop PowerPoint, create and save a blank macro-enabled presentation, e.g. `C:\temp\LegendTest.pptm`.
2. Open VBA editor (`Alt+F11`) and import `powerpoint-plugin/LegendRibbon.bas` into that presentation.
3. Run the build script from this repo to inject the ribbon XML:

```powershell
# from repository root
pwsh ./powerpoint-plugin/build.ps1 -InputPptm "C:\temp\LegendTest.pptm"
```

Optional output path:

```powershell
pwsh ./powerpoint-plugin/build.ps1 -InputPptm "C:\temp\LegendTest.pptm" -OutputPptm "C:\temp\LegendTest.ribbon.pptm"
```

4. Close and reopen the output `.pptm` in PowerPoint, then enable macros.
5. You should see the **Org Chart Legend** tab with all legend shape/line buttons.

