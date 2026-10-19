# US House maps: proportional, neutral and enacted seats

A static map of every US congressional district. For each state with more than one seat it puts three seat counts side by side:

1. Vote-proportional. Seats in proportion to the state's two-party vote.
2. Neutral-map median. The median and the 5th to 95th percentile of Democratic seats over 5,000 simulated maps from the ALARM Project.
3. Enacted maps. The seats from the map that voters use on November 3, 2026.

All three count the same votes. These are the 2016 and 2020 presidential results added together, per voting district, from the ALARM Project's data. California, Hawaii, Maine and Oregon have them per census tract, Iowa and West Virginia per county. West Virginia uses 2020 only. The difference between Vote-proportional and Neutral-map median is the geographic effect. The difference between Neutral-map median and Enacted maps is the drawing effect.

Alaska, Delaware, North Dakota, South Dakota, Vermont and Wyoming have one at-large seat each, so there is nothing to compare.

The design is in `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md`. `data/sources.md` lists the map and legal status for each state.

## Requirements

- Windows with Python 3.12, Node.js 24 and pnpm 10 (`corepack enable` installs the version in `package.json`).
- GNU Make, optional. Install it with `winget install ezwinports.make`. Every step also runs without Make.
- About 2.5 GB of free disk space for the downloads.

## Setup

In PowerShell, from the repository root:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
pnpm install --frozen-lockfile
```

## Run the pipeline

Activate the environment so that `python` points to `.venv`. In PowerShell run `.venv\Scripts\Activate.ps1`, in Command Prompt `.venv\Scripts\activate.bat`. Then:

```powershell
make all
```

This runs the four steps in order. Without Make:

```powershell
$env:PYTHONUTF8=1
python pipeline/01_download.py
python pipeline/02_join.py
python pipeline/03_metrics.py
python pipeline/04_export.py
```

Downloads go to `data/raw/`. Set `GERRY_DATA_DIR` to use another folder, for example one copy shared by several worktrees. Intermediate files go to `data/interim/`. Git ignores both folders.

The pipeline writes `site/public/data/results.json`, `site/public/data/map.topojson` and `docs/validation.md`. These files are in git, so the site works without running the pipeline.

## Tests

```powershell
make test
```

Without Make, run `python -m pytest`, `pnpm test` and `pnpm typecheck`. Tests marked `data` need the downloads. pytest skips them when the files are missing.

## Build and view the site

The site is TypeScript, built with Vite into plain static files:

```powershell
pnpm dev        # development server with reload on http://127.0.0.1:8000
pnpm build      # writes the static site to dist/
pnpm preview    # serves dist/ on http://127.0.0.1:8000
```

`dist/` holds `index.html`, one script, one style sheet, the fonts, the images and the two data files. Copy it to any static host. Asset paths are relative, so it also works from a subfolder. With Make, `make build` and `make serve` do the same as `pnpm build` and serving `dist/`. `node tools/check_site.mjs` runs the browser checks against `dist/` in headless Edge or Chrome.

The frontend lives in `site/`:

- `index.html`: the page and its static text.
- `src/main.ts`: the entry point. `src/app/` loads the data and wires the page, `src/lib/` builds every text and number without touching the DOM, `src/ui/` draws with D3 and the DOM, and `src/types.ts` describes `results.json` and `map.topojson`.
- `src/styles/`: the style sheet in parts, with the color tokens in `tokens.css`.
- `public/`: files copied as they are, such as the data, the images and the license texts.
- `test/`: `node --test` tests in TypeScript, run by `pnpm test`.

The page opens with two key findings under the title. Then come four numbered chapters: a map in three views (Democratic share, drawing effect, close races) with a record per state (01), the national count three ways, with a short explainer that plays by itself, a waffle of the House of 435 seats and a slider for the national vote share (02), close districts, redraws since 2024, political control and the Senate in 2026 (03), and the method, with the drawing effect at every point of the slider and the details folded (04). `#TX` in the address opens a state; `#method` opens the method.

## Sources and licenses

- ALARM Project, 50-State Redistricting Simulations, Harvard Dataverse, doi:10.7910/DVN/SLCD3E, version 15. CC0 1.0.
- ALARM census-2020 files, with election data from the Voting and Election Science Team. The election data is CC BY 4.0, the census-2020 files are CC BY-SA 4.0.
- US Census Bureau block equivalency files for the 118th, 119th and 120th Congress, P.L. 94-171 redistricting data, TIGER/Line files and cartographic boundary files. Public domain.
- MIT Election Data and Science Lab, U.S. President 1976-2024, Harvard Dataverse, doi:10.7910/DVN/42MVDX, version 10.1. CC0 1.0. The Senate block takes the 2016 and 2020 votes of the six states with one seat from it, and the site the national two-party shares of 2016, 2020 and 2024.
- U.S. Senate, lists of Class II and Class III senators and the party division, as of October 13, 2026: the seats on the ballot in 2026 and who holds the others (`data/sources.md`, Senate section).
- D3 and topojson-client, ISC license. Vite bundles them from npm; their license texts are in `site/public/licenses/`.
- Public Sans and Source Serif 4, SIL Open Font License 1.1. Vite bundles the latin subset from the `@fontsource-variable` packages; their license texts are in `site/public/licenses/`.
- The site footer credits the Geodienst of the University of Groningen, with its logo from `site/public/img/geodienst.svg` and a link to https://rug.nl/geo.
