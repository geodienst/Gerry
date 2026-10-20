# Some votes are more equal than others

A static map of every US congressional district. For each state with more than one seat it puts three seat counts side by side:

1. Vote-proportional. Seats in proportion to the state's two-party vote.
2. Neutral-map median. The median and the 5th to 95th percentile of Democratic seats over 5,000 simulated maps from the ALARM Project.
3. Enacted maps. The seats from the map that voters use on November 3, 2026.

All three count the same votes. These are the 2016 and 2020 presidential results added together, per voting district, from the ALARM Project's data. California, Hawaii, Maine and Oregon have them per census tract, Iowa and West Virginia per county. West Virginia uses 2020 only. The difference between Vote-proportional and Neutral-map median is the geographic effect. The difference between Neutral-map median and Enacted maps is the drawing effect.

Alaska, Delaware, North Dakota, South Dakota, Vermont and Wyoming have one at-large seat each, so there is nothing to compare.

The design is in `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md`. `data/sources.md` lists the map and legal status for each state.

## How the code is organized

Two parts with one contract between them: a Python pipeline turns the source data into `site/public/data/results.json` and `site/public/data/map.topojson`, and a TypeScript site, built with Vite into static files, reads those two files.

```text
pipeline/              the data pipeline, four steps run in order
  01_download.py       downloads every source file and checks it against data/manifest.json
  02_join.py           votes per voting district -> census blocks -> districts, and ALARM's 5,000 plans per state
  03_metrics.py        seats, the neutral-map median and band, efficiency gap and mean-median; writes docs/validation.md
  04_export.py         writes site/public/data/results.json and site/public/data/map.topojson
  config.yaml          per state the map, its status, the block file and the vote basis; the source URLs
  gerry/               the package the steps share: config, sources, blocks, units, ensemble, metrics, validation, export
site/                  the site: index.html with the page and its static text, and src/, public/ and test/
  src/                 TypeScript. lib/ builds every number and sentence without touching the page (format, model,
                       chapters, extensions, axes, colors, hash, text, tour); ui/ draws them with D3 and the DOM (map,
                       charts, sheet, outcomes, byvote, decide, tour, share, fullscreen); app/ loads the data and wires
                       the map chapter; main.ts is the entry point; types.ts describes results.json and map.topojson
  src/styles/          the style sheet in parts, in the order of the cascade, with the color tokens in tokens.css
  public/              copied as they are: the pipeline's output in data/, the images and the license texts
  test/                unit tests in TypeScript for node --test
dist/                  the built site, written by pnpm build; not in git
tests/                 pytest for the pipeline
tools/                 check_site.mjs runs the built site in a headless Edge or Chrome (groups in site_checks.mjs);
                       compare_state_files.py compares Census block files with the states' own files
data/                  sources.md, manifest.json (pinned downloads), crosscheck/ (PlanScore), validation_notes.yaml;
                       raw/ and interim/ hold the downloads and intermediate files and are not in git
docs/                  design specs and plans (superpowers/), the validation report, research notes
```

## Requirements

- Windows with Python 3.12, Node.js 24 and pnpm 10. `corepack enable` installs the pnpm version that `package.json` names.
- GNU Make, optional. Install it with `winget install ezwinports.make`. Every step also runs without Make.
- About 2.5 GB of free disk space for the downloads.

## Setup

In PowerShell, from the repository root:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
pnpm install --frozen-lockfile
```

`requirements-dev.txt` adds ruff to `requirements.txt`. The pipeline alone needs only `requirements.txt`.

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

## Tests, lint and checks

| What | Command | Without Make |
|---|---|---|
| Python tests | `make test-py` | `python -m pytest` |
| TypeScript unit tests | `make test-js` | `pnpm test` |
| Both | `make test` | |
| Lint | `make lint` | `python -m ruff check .`, `pnpm lint` and `pnpm typecheck` |
| The site in a browser | `make check-site` | `node tools/check_site.mjs` |

Tests marked `data` need the downloads; pytest skips them when the files are missing. The unit test of the page size measures `dist/` and skips without a build. The browser checks serve `dist/` themselves, so build first, and drive a headless Edge or Chrome: layout at phone and desktop widths, dark mode, keyboard order, full screen, the share links, and that the page makes no requests to other hosts. `node tools/check_site.mjs --only map,sheet` runs some groups; `--shots <folder>` writes screenshots.

GitHub Actions (`.github/workflows/ci.yml`) runs all of this on every push and pull request. Lint, the typecheck and the unit tests run on Linux. The browser checks run on Windows with Edge, because they measure the layout to the pixel against the fonts the site uses there.

## Reproducibility

Every download is pinned in `data/manifest.json` by size and sha256; a file that changed at its source stops the pipeline with a message. Census regenerated its block file for the 120th Congress on October 6, 2026 without Missouri's blocked map, so the pipeline takes that one map from a byte-for-byte copy of the August 31 file, a release file of this repository. `data/sources.md` explains each source and `docs/validation.md` lists the checks of every run.

## Build and view the site

```powershell
pnpm dev        # development server with reload on http://127.0.0.1:8000
pnpm build      # writes the static site to dist/
pnpm preview    # serves dist/ on http://127.0.0.1:8000
```

`dist/` holds `index.html`, one script, one style sheet, the images, the license texts and the two data files. Copy it to any static host. Asset paths are relative, so it also works from a subfolder. With Make, `make build` and `make serve` do the same as `pnpm build` and serving `dist/`.

The page opens with three key findings under the title. Then come four numbered chapters: the national count three ways, with a short explainer that plays by itself, a waffle of the House of 435 seats and a slider for the national vote share (01), a map in three views (Democratic share, drawing effect, close races) with a column beside it that follows the view and a record per state (02), close districts, redraws since 2024, political control and the Senate in 2026 (03), and the method, with the drawing effect at every point of the slider and the details folded (04). `#TX` in the address opens a state, `?count=neutral&vote=49.2#outcomes` opens chapter 01 on a count and a vote share, and `#method` opens the method.

## Sources and licenses

- ALARM Project, 50-State Redistricting Simulations, Harvard Dataverse, doi:10.7910/DVN/SLCD3E, version 15. CC0 1.0.
- ALARM census-2020 files, with election data from the Voting and Election Science Team. The election data is CC BY 4.0, the census-2020 files are CC BY-SA 4.0.
- US Census Bureau block equivalency files for the 118th, 119th and 120th Congress, P.L. 94-171 redistricting data, TIGER/Line files and cartographic boundary files. Public domain.
- MIT Election Data and Science Lab, U.S. President 1976-2024, Harvard Dataverse, doi:10.7910/DVN/42MVDX, version 10.1. CC0 1.0. The Senate block takes the 2016 and 2020 votes of the six states with one seat from it, and the site the national two-party shares of 2016, 2020 and 2024.
- U.S. Senate, lists of Class II and Class III senators and the party division, as of October 17, 2026: the seats on the ballot in 2026 and who holds the others (`data/sources.md`, Senate section).
- D3 and topojson-client, ISC license. Vite bundles them from npm; their license texts are in `site/public/licenses/`.
- The site footer credits the Geodienst of the University of Groningen, with its logo from `site/public/img/geodienst.svg` and a link to https://rug.nl/geo.
