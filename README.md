# US House maps: proportional, neutral and enacted seats

A static map of every US congressional district. For each state with more than one seat it puts three seat counts side by side:

1. Vote-proportional. Seats in proportion to the state's two-party vote.
2. Neutral-map median. The median and the 5th to 95th percentile of Democratic seats over 5,000 simulated maps from the ALARM Project.
3. Enacted maps. The seats from the map that voters use on November 3, 2026.

All three count the same votes. These are the 2016 and 2020 presidential results added together, per voting district, from the ALARM Project's data. California, Hawaii, Maine and Oregon have them per census tract, Iowa and West Virginia per county. West Virginia uses 2020 only. The difference between Vote-proportional and Neutral-map median is the geographic effect. The difference between Neutral-map median and Enacted maps is the drawing effect.

Alaska, Delaware, North Dakota, South Dakota, Vermont and Wyoming have one at-large seat each, so there is nothing to compare.

The design is in `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md`. `data/sources.md` lists the map and legal status for each state.

## Requirements

- Windows with Python 3.12 and Node.js 24.
- GNU Make, optional. Install it with `winget install ezwinports.make`. Every step also runs without Make.
- About 2.5 GB of free disk space for the downloads.

## Setup

In PowerShell, from the repository root:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
npm ci
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

The pipeline writes `site/data/results.json`, `site/data/map.topojson` and `docs/validation.md`. These files are in git, so the site works without running the pipeline.

## Tests

```powershell
make test
```

Without Make, run `python -m pytest` and `npm test`. Tests marked `data` need the downloads. pytest skips them when the files are missing.

## View the site

```powershell
make serve
```

Then open http://127.0.0.1:8000. Without Make, run `python -m http.server 8000 --bind 127.0.0.1 --directory site`.

The page has four numbered chapters: the national count three ways with a waffle of the House of 435 seats and a slider for the national vote share (01), a map in three views (Democratic share, drawing effect, close races) with a record per state (02), what the maps decide for the House, the Senate, close districts and redraws (03), and the method, folded (04). `#TX` in the address opens a state; `#method` opens the method.

## Sources and licenses

- ALARM Project, 50-State Redistricting Simulations, Harvard Dataverse, doi:10.7910/DVN/SLCD3E, version 15. CC0 1.0.
- ALARM census-2020 files, with election data from the Voting and Election Science Team. The election data is CC BY 4.0, the census-2020 files are CC BY-SA 4.0.
- US Census Bureau block equivalency files for the 118th, 119th and 120th Congress, P.L. 94-171 redistricting data, TIGER/Line files and cartographic boundary files. Public domain.
- MIT Election Data and Science Lab, U.S. President 1976-2024, Harvard Dataverse, doi:10.7910/DVN/42MVDX, version 10.1. CC0 1.0. The Senate block takes the 2016 and 2020 votes of the six states with one seat from it.
- D3 and topojson-client, ISC license. Copies with their license files are in `site/vendor/`.
- The site footer credits the Geodienst of the University of Groningen, with its logo from `site/img/geodienst.svg` and a link to https://rug.nl/geo.
