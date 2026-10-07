# Gerrymandering map implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een statische kaart die per staat en landelijk Proportional, Neutral baseline en Enacted naast elkaar zet, gevoed door een reproduceerbare Python-pijplijn.

**Architecture:** Vier genummerde scripts in `pipeline/` (download, join, metrics, export) rond een getest pakket `pipeline/gerry/`. Stemmen per eenheid uit ALARM's `map.rds` gaan via Census-blokken naar de districten van november 2026; de neutrale band komt uit ALARM's stats-bestanden (Dataverse v15). De uitvoer is één `results.json` en één `map.topojson` voor een statische D3-site.

**Tech Stack:** Python 3.12 (pandas 3, numpy, pyarrow, geopandas, pyogrio, pyyaml, rdata, openpyxl, pytest), Node 24 (mapshaper, d3, topojson-client; JavaScript-tests met `node --test "site/js/*.test.js"`), GNU Make op Windows.

Ontwerp: `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md` (hierna "de spec"). Onderzoek: `docs/research/`. Status per staat: `data/sources.md`.

## Global Constraints

- Werk in de worktree `C:\projects\Gerry\.worktrees\pipeline-setup` op branch `feature/pipeline-setup`. Commit na elke taak. Commitberichten in het Engels, zonder `Co-Authored-By`-regel.
- Elke sessie eindigt met de push-commando's voor de feature branch (CLAUDE.md).
- Python 3.12 uit `.venv` (`.venv\Scripts\python.exe`); nooit `python3`. Scripts starten als bestand: `python pipeline/02_join.py`.
- `PYTHONUTF8=1` bij elke run. Tekstbestanden openen met `encoding="utf-8"`, behalve P.L. 94-171 (`encoding="latin-1"`).
- Alle GEOID's, unit-ID's, draws en districtcodes zijn tekst. Districtcodes hebben twee tekens met voorloopnul (`"09"`). Nooit naar een getal omzetten.
- Het landelijke CD120-bestand lezen met de C-engine van pandas (`engine="c"`), `usecols=["GEOID","CDFP"]`, `dtype=str`. De pyarrow-engine is verboden: die haalt voorloopnullen weg.
- Unit tests gebruiken geen netwerk en geen bestanden uit de datamap. Tests die echte data nodig hebben krijgen `@pytest.mark.data` en worden overgeslagen als de bestanden ontbreken.
- De datamap is `GERRY_DATA_DIR` of anders `data/raw/`. Tussenresultaten in `data/interim/`. Beide staan in `.gitignore`.
- Stembasis: `pre_16` + `pre_20`, stemmen opgeteld; West Virginia alleen `pre_20`.
- `CheckError` gebruikt state `"US"` voor controles die niet over één staat gaan.
- Zichtbare tekst (site, noot-teksten, README) in het Engels, zonder em-dashes, zonder partijdige of emotionele woorden, en door de unslop-skill.
- Twijfel over een databron of definitie: stoppen en vragen aan de eigenaar, niet gokken.
- Op Windows `npx` niet via `subprocess` aanroepen; mapshaper starten als `node node_modules/mapshaper/bin/mapshaper`.

## File structure

```
pipeline/
  config.yaml                  alle instellingen (schema in "Interfaces")
  gerry/__init__.py
  gerry/config.py              Config laden en valideren, paden
  gerry/sources.py             Dataverse-API, downloadplan, fetch met manifest
  gerry/rds.py                 ALARM .rds-bestanden lezen met rdata
  gerry/units.py               stemmen per eenheid uit map.rds, eenheid-ID's, kolomkeuze, blokgewichten, composiet
  gerry/blocks.py              P.L. 94-171, blokbestanden, verdelen en optellen
  gerry/ensemble.py            stats-bestanden naar stemmen per district per plan
  gerry/checks.py              CheckError en alle pijplijncontroles, sources.md-lezer
  gerry/metrics.py             rekenregels uit hoofdstuk 5 van de spec
  gerry/validation.py          docs/validation.md opbouwen
  gerry/geometry.py            GeoPackage, Missouri, omtrek, mapshaper
  gerry/export.py              noot-teksten en results.json
  01_download.py
  02_join.py
  03_metrics.py
  04_export.py
tools/compare_state_files.py   eenmalige vergelijking CD120 met bestanden van staten
tests/
  test_smoke.py                vastgepinde pakketten, pakket gerry (Task 0.1)
  test_makefile.py             vorm van de Makefile (Task 0.3)
  test_config.py               config.py en het echte config.yaml (Task 0.4, 1.15)
  test_checks_sources.py       CheckError en de lezer van sources.md (Task 0.5)
  test_sources.py              downloads, manifest, Dataverse, downloadplan (Task 1.1, 1.2, 1.12)
  test_download_script.py      01_download.py (Task 1.3, 1.12)
  test_rds.py                  rds.py (Task 1.4)
  test_units.py                units.py (Task 1.5, 1.15)
  test_blocks.py               blocks.py (Task 1.7, 1.8, 1.13, 1.14)
  test_ensemble.py             ensemble.py (Task 1.9, 1.17)
  test_checks.py               datacontroles (Task 1.10, 1.16, 1.17)
  test_join.py                 02_join.py (Task 1.18)
  test_metrics.py              metrics.py (Task 2.1 tot en met 2.10)
  test_metrics_step.py         03_metrics.py (Task 2.11, 2.12)
  test_metrics_data.py         referentiegetallen op echte data, marker data (Task 2.11)
  test_validation.py           validation.py (Task 2.12)
  test_planscore_crosscheck.py PlanScore (Task 2.13), overgeslagen zolang planscore.csv ontbreekt
  test_dra_crosscheck.py       DRA (Task 2.14), overgeslagen zolang dra.csv ontbreekt
  test_export.py               export.py (Task 3.1, 3.2)
  test_geometry.py             geometry.py (Task 3.3)
  test_check_geometry.py       check_geometry (Task 3.4)
  test_check_map_ids.py        check_map_ids (Task 3.5)
  test_compare_state_files.py  tools/compare_state_files.py (Task 3.6)
  fixtures/dataverse_v15_files.json   Dataverse-lijst, ingekort tot 6 bestanden (Task 1.2)
data/manifest.json             checksums van downloads (in git)
data/sources.md                status en bronnen per staat (in git)
data/crosscheck/planscore.csv  met de hand (Task 2.13, in git)
data/crosscheck/dra.csv        met de hand (Task 2.14, in git)
data/crosscheck/state_files.csv  door tools/compare_state_files.py (Task 3.6, in git)
data/validation_notes.yaml     verklaringen van overschrijdingen (in git)
data/interim/                  tussenresultaten, niet in git (zie "Bestanden tussen de stappen")
docs/validation.md             gegenereerd rapport (in git)
docs/superpowers/specs/YYYY-MM-DD-site-design.md   ontwerp van de site (Task 4.3)
docs/superpowers/plans/YYYY-MM-DD-site.md          plan voor de site (Task 4.3)
site/                          de pagina's zelf (index.html, CSS, modules) komen uit het siteplan van Task 4.3
site/js/format.js              opmaak van getallen (Task 4.1)
site/js/format.test.js         node --test (Task 4.1)
site/js/vendor.test.js         versies en licenties in site/vendor (Task 0.2)
site/js/contract.test.js       contract tussen pijplijnuitvoer en site (Task 4.2)
site/data/results.json         gegenereerd (in git)
site/data/map.topojson         gegenereerd (in git)
site/vendor/                   d3, topojson-client en licenties (in git)
.gitignore                     data/raw/ en data/interim/
Makefile
package.json
package-lock.json
pytest.ini
requirements.txt
README.md
```

## Interfaces

Dit is het contract tussen de taken. Namen, typen en kolommen hieronder zijn bindend; een taak die ervan afwijkt, past eerst dit hoofdstuk aan.

### Datamap (relatief aan `data_dir()`)

```
alarm/{ST}_cd_2020_stats.csv          44 staten, Dataverse v15, ?format=original
alarm/{ST}_cd_2020_map.rds            44 staten, Dataverse v15: stemmen, VAP, bevolking en cd_2020 per eenheid
census_vest/{st}_2020_block.csv        ca, hi, me, or (st = kleine letters): alleen gewichten binnen een tract
census/cd118.zip
census/cd120.zip
census/pl/{st}2020.pl.zip              alle 44 staten
census/tiger/tlgpkg_2026_us_legislative.gpkg.zip
census/tiger/tlgpkg_2026_us_legislative.gpkg   uitgepakt door load_districts (workdir = census/tiger)
census/tiger/tl_2025_29_cd119.zip
census/tiger/cb_2025_us_state_500k.zip
state_files/                           cache van tools/compare_state_files.py (Task 3.6)
```

Het downloadplan (`plan_downloads`) telt 141 bestanden: 44 stats-bestanden, 44 keer `map.rds`, de 4 blokbestanden van census-vest, `cd118.zip`, `cd120.zip`, 44 P.L.-bestanden en 3 TIGER-bestanden. De VTD-bestanden van census-vest uit taak 1.3 mogen op schijf blijven staan; de pijplijn leest ze niet meer.

`data/manifest.json`: object met per sleutel (bovenstaand relatief pad, met `/`) `{"url": str, "size": int, "sha256": str}`. Het uitgepakte `.gpkg` en `state_files/` staan er niet in. Het heeft alleen regels voor bestanden in het downloadplan; `01_download` haalt andere regels weg.

`data/sources.md`: regel 1 is de titel; de eerste tekstregel eronder begint met `Status checked on YYYY-MM-DD`, en die datum is gelijk aan `status_checked` in `config.yaml`.

### config.yaml

```yaml
status_checked: 2026-10-03
census_vest_commit: 243c8a8134ecf8151777a9388c48323e274767e2   # alleen de blokbestanden van CA, HI, ME en OR
ensemble:
  name: alarm_v15
  doi: doi:10.7910/DVN/SLCD3E
  version: 15
  notes:                      # alleen staten met noten van deze ensembleset
    AL: [vra_constraint, vra_filter_with_votes, alarm_rerun_unpublished]
  fill:                       # invulwaarden voor core_preservation_prior_map
    NM: {reference_map: "...", consequence: "..."}
sources:
  dataverse_api: https://dataverse.harvard.edu/api
  cd118: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2023/118-congressional-district-bef/cd118.zip
  cd120: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip
  pl94171: https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/{folder}/{st}2020.pl.zip
  census_vest: https://raw.githubusercontent.com/alarm-redist/census-2020/{commit}/census-vest-2020/{st}_2020_{kind}.csv
  tiger_gpkg: https://www2.census.gov/geo/tiger/TGRGPKG26/tlgpkg_2026_us_legislative.gpkg.zip
  tiger_mo_cd119: https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip
  cb_states: https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip
states:
  MO:
    name: Missouri
    fips: "29"
    seats: 8
    map_name: HB 2909 of 2022          # gelijk aan de linktekst in data/sources.md
    status: In effect                  # In effect | Challenged
    source_label: Redistricting Data Hub
    source_url: https://redistrictingdatahub.org/dataset/2022-missouri-congressional-districts-approved-plan/
    bef: cd118                         # cd120 | cd118
    elections: [pre_16, pre_20]
    unit_kind: vtd                     # vtd | tract | county
    extra_maps:                        # optioneel
      mo_hb1: {name: HB 1 of 2025, status: Blocked, bef: cd120, source_label: "...", source_url: "..."}
    notes: [blocked_map]               # optioneel; noten van de staat zelf
at_large:
  AK: {name: Alaska, fips: "02"}
```

`{folder}` is de staatsnaam met spaties vervangen door `_` (bijvoorbeeld `West_Virginia`). `{kind}` is altijd `block`: van census-vest haalt de pijplijn alleen de blokbestanden van CA, HI, ME en OR, als gewicht binnen een tract. `census_vest_commit` geldt alleen voor die blokbestanden.

`unit_kind` volgt de eenheden van ALARM's `map.rds`: `tract` voor CA, HI, ME en OR, `county` voor IA en WV, `vtd` voor de andere 38 staten (ook NH).

`extra_maps` en `notes` per staat zijn optioneel; de lader maakt van een ontbrekende waarde `()`. `ensemble.notes` noemt alleen staten met noten: gebruik `cfg.ensemble.notes.get(postal, ())`. `source_label` staat zichtbaar op de site; `check_sources_md` vergelijkt het niet met `data/sources.md`.

### Python-modules

```python
# gerry/config.py
REPO_ROOT: Path                                  # Path(__file__).resolve().parents[2]
STATUS_VALUES = ("In effect", "Challenged", "Blocked", "At-large")
ENSEMBLE_NOTE_KEYS = ("vra_constraint", "core_preservation_prior_map", "core_preservation_2010",
    "competitiveness_rule", "vra_filter_with_votes", "vra_filter_bvap",
    "alarm_rerun_unpublished", "alarm_method_update_pending")
STATE_NOTE_KEYS = ("adopted_after_2024_election", "composite_2020_only", "blocked_map")
COMPUTED_NOTE_KEYS = ("narrow_ensemble",)
class ConfigError(ValueError): ...
@dataclass(frozen=True)
class ExtraMap: id: str; name: str; status: str; bef: str; source_label: str; source_url: str
@dataclass(frozen=True)
class StateConfig:
    postal: str; name: str; fips: str; seats: int; map_name: str; status: str
    source_label: str; source_url: str; bef: str; elections: tuple[str, ...]
    unit_kind: str; extra_maps: tuple[ExtraMap, ...]; notes: tuple[str, ...]   # unit_kind: vtd | tract | county
@dataclass(frozen=True)
class AtLargeState: postal: str; name: str; fips: str
@dataclass(frozen=True)
class EnsembleConfig: name: str; doi: str; version: int
    notes: dict[str, tuple[str, ...]]; fill: dict[str, dict[str, str]]   # notes: alleen staten met noten
@dataclass(frozen=True)
class Config:
    status_checked: date; census_vest_commit: str; ensemble: EnsembleConfig; sources: dict[str, str]
    states: dict[str, StateConfig]; at_large: dict[str, AtLargeState]
def data_dir() -> Path
def interim_dir() -> Path
def load_config(path: Path | None = None) -> Config

# gerry/sources.py
USER_AGENT = "gerry-pipeline/1.0"               # Dataverse geeft HTTP 403 op de standaardwaarde van urllib
TIMEOUT = 120                                   # seconden per verbindingspoging
@dataclass(frozen=True)
class Download: key: str; url: str; size: int | None; md5: str | None
class DownloadError(RuntimeError): ...
class Manifest:
    def __init__(self, path: Path): ...
    def get(self, key: str) -> dict | None: ...
    def record(self, key: str, url: str, size: int, sha256: str) -> None: ...
    def prune(self, keep: Iterable[str]) -> list[str]: ...   # haalt regels buiten keep weg, geeft hun sleutels gesorteerd; schrijft niet
    def save(self) -> None: ...
def open_session() -> urllib.request.OpenerDirector   # opener die USER_AGENT stuurt
# session in dataverse_files en fetch: elk object met .open(url, timeout=...); None geeft open_session()
def dataverse_files(api_base: str, doi: str, version: int, session=None) -> dict[str, dict]
    # bestandsnaam -> {"id": int, "size": int, "md5": str, "tabular": bool}; size = originalFileSize bij tabulair, anders filesize
def plan_downloads(cfg: Config, dv_files: dict[str, dict]) -> list[Download]
    # 141 bestanden, in deze volgorde: stats (44), alarm/{ST}_cd_2020_map.rds (44), blokbestanden van census-vest
    # voor CA, HI, ME en OR (4), cd118.zip, cd120.zip, P.L. 94-171 (44), TIGER (3)
def fetch(dl: Download, root: Path, manifest: Manifest, retries: int = 3, wait: float = 5.0, session=None) -> Path

# pipeline/01_download.py [--only ST ...] [--dry-run]
# haalt manifestregels weg die niet in het volledige plan staan, ook met --only; --dry-run noemt ze zonder te schrijven
def state_of(key: str) -> str | None             # postcode van een bestand per staat, None voor gedeelde bestanden
def select(plan: list[Download], only: list[str]) -> list[Download]

# gerry/rds.py
def read_rds_table(path: Path) -> pd.DataFrame   # alle niet-geometrische kolommen van een redist_map

# gerry/units.py
ID_LENGTH = {"vtd": 11, "tract": 11, "county": 5}   # county + VTD-code; tract-GEOID; county-FIPS
class UnitsError(ValueError): ...
def select_columns(columns: Iterable[str], election: str) -> tuple[str, str]   # (dem, rep)
def unit_ids(table: pd.DataFrame, st: StateConfig, counties: pd.DataFrame | None = None) -> pd.Series
    # naam unit_id, in de volgorde van de tabel: GEOID; zonder GEOID de kolom tract (CA, HI) of de countynaam,
    # opgezocht in counties (IA, kolommen county_id en name); in VTD-staten moet GEOID == GEOID[:5] + vtd
    # UnitsError bij: geen ID-kolom, lege of dubbele ID, verkeerde lengte of FIPS, countynaam zonder precies één treffer
def load_units(st: StateConfig, root: Path, counties: pd.DataFrame | None = None) -> pd.DataFrame
    # uit alarm/{ST}_cd_2020_map.rds; kolommen: unit_id (str), vap, pop (int64), cd_2020 (str 2, district van
    # ALARM's referentiekaart), d_<e>, r_<e> (float64) per verkiezing
    # .attrs["empty_vote_fields"], .attrs["empty_vote_units"]: lege stemvelden die 0 werden
def read_block_votes(st: StateConfig, root: Path) -> pd.DataFrame
    # census_vest/{st}_2020_block.csv (tractstaten): index block_id, d_<e>, r_<e> (float64); lege velden worden 0
    # .attrs["empty_vote_fields"], .attrs["empty_vote_units"]: lege velden en de blokken waarin ze staan
def add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame  # voegt d, r toe

# gerry/blocks.py
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "NAME": 87, "POP100": 90,
                 "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}
class BlocksError(ValueError): ...              # kapotte blokbestanden en fouten bij het koppelen
def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame
    # st = postcode, hoofd- of kleine letters ("nv" of "NV")
    # block_id (str 15), vap (int64), pop (int64, POP100), vtd (str 6), lat (float64), lon (float64)
    # controleert som vap en som pop == staatsrecord
def read_pl_counties(zip_path: Path, st: str) -> pd.DataFrame
    # county_id (str 5), name (str, "Adair County"); één rij per SUMLEV 050-record
def read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series
    # index block_id (str 15), waarde district (str 2), naam "district"
    # cd120: NationalCD120.txt wordt één keer per proces gelezen en bewaard (lru_cache)
def unit_of_block(blocks: pd.DataFrame, unit_kind: str, fips: str) -> pd.Series
    # index block_id, naam unit_id, waarde de sleutel: vtd GEOCODE[:5] + VTD-code (lege VTD-code is een fout),
    # tract GEOCODE[:11], county GEOCODE[:5]; een sleutel hoeft geen eenheid van map.rds te zijn (water)
def block_weighted(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series,
                   district_of: pd.Series, vote_cols: Sequence[str],
                   weights: pd.DataFrame | None = None) -> pd.DataFrame
    # kolommen district + vote_cols; ZZ-blokken eerst weg; met weights per stemkolom naar het blokgewicht binnen
    # de eenheid, is dat 0 of zonder weights naar blok-VAP, zonder VAP naar aantal blokken
    # weights: index block_id, een kolom per stemkolom (read_block_votes); een blok zonder gewicht is een fout
    # .attrs: split_units, zero_vap_units, zero_vap_split_units, units_without_blocks, weight_fallback_units (int),
    #         block_count_votes (float, stemmen van gesplitste eenheden die naar aantal blokken gingen)
def whole_unit(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series,
               district_of: pd.Series, vote_cols: Sequence[str]) -> pd.DataFrame

# gerry/ensemble.py
N_PLANS = 5000
REFERENCE_DRAW = "cd_2020"                      # ALARM's referentiekaart, geen plan van het ensemble
def read_stats(path: Path) -> pd.DataFrame
def district_votes(stats: pd.DataFrame, st: StateConfig) -> tuple[pd.DataFrame, pd.DataFrame]
    # (ensemble, reference); kolommen state, draw, district, d_<e>, r_<e>, d, r
def reference_labels(stats: pd.DataFrame, map_pop: pd.Series, postal: str) -> dict[str, str]
    # cd_2020-label in het stats-bestand -> label in map.rds met precies dezelfde bevolking (map_pop: "01" -> int)
    # nul of meer treffers, of twee labels met dezelfde treffer: CheckError("reference_labels", postal, ...)

# gerry/checks.py
class CheckError(RuntimeError):
    def __init__(self, check: str, state: str, detail: str): ...
    # attributen .check, .state, .detail; str(err) == f"{check} failed for {state}: {detail}"
    # state: een postcode, "AL,MO" bij meer staten, "US" bij een controle die niet over één staat gaat
def check_units_linked(units, unit_of, district_of, state) -> None
def check_vap_pop(units, blocks, unit_of, state) -> tuple[int, int]
    # controle vap_pop: per eenheid blok-VAP == vap en POP100 == pop van map.rds; blokken waarvan de sleutel
    # geen eenheid is, hebben VAP 0 en bevolking 0; geeft (aantal van die blokken, aantal van hun sleutels)
def check_reference_labels(labels, district_of, pop, state, min_share: float = 0.97) -> float
    # controle reference_labels: elk label van cd_2020 in map.rds overlapt (bevolking, zonder ZZ) het meest met
    # het CD118-district met dezelfde code; geeft het aandeel van de bevolking met dezelfde code
def check_conservation(units, district_totals, vote_cols, state, rel_tol: float = 1e-9) -> None
def check_ensemble_totals(ensemble, units, elections, seats, state) -> None
def check_district_count(district_totals, seats, state) -> None
def check_geoids(block_ids, fips, state) -> None
def check_geometry(districts, blocks, district_of, state, min_share: float = 0.999) -> float
    # aandeel blokken waarvan het interne punt in het district ligt dat het blokbestand noemt
def check_map_ids(topo: dict, results: dict) -> None
    # map.topojson heeft precies de districten en staten van results.json, plus de at-large staten
def parse_sources_md(path: Path) -> dict
    # {"status_checked": date, "multi": {ST: row}, "blocked": {ST: [row, ...]}, "at_large": {ST: row}}
    # row = {"map_name": str, "url": str | None, "status": str, "pipeline_file": str}, plus "seats": int in multi en at_large
def check_sources_md(cfg: Config, path: Path) -> None

# pipeline/02_join.py [--states ST ...]
@dataclass
class StateResult: units: pd.DataFrame; enacted: pd.DataFrame; ensemble: pd.DataFrame; reference: pd.DataFrame; log: dict
    # units: unit_id, vap, pop, d_<e>, r_<e>, d, r; reference: draw cd_2020 met de districtlabels van map.rds
def maps_of(st: StateConfig) -> list[tuple[str, str]]   # (map_id, bef): enacted, extra_maps, check_2022
def join_state(cfg: Config, postal: str, root: Path) -> StateResult
def replace_states(old: pd.DataFrame | None, new: pd.DataFrame, states: set[str]) -> pd.DataFrame
def write_outputs(results: dict[str, StateResult], cfg: Config, out_dir: Path, partial: bool) -> None
# regel per staat: <ST>: <n> units (<n> without VAP), <n> blocks, enacted map splits <n> units
#   (<n> without VAP, <x> votes by block count), <n> plans, <t> s

# gerry/metrics.py
class TieError(ValueError):
    def __init__(self, message: str, positions: Sequence[int] = ()): ...   # attribuut positions: tuple[int, ...]
CUM_TOLERANCE = 1e-9                            # marge op cumulatieve kansen
def dem_wins(d, r, d20=None, r20=None) -> np.ndarray          # bool per district, met de gelijkspelregel
def largest_remainder(d_votes: float, r_votes: float, seats: int) -> int
def seats_by_plan(ensemble: pd.DataFrame) -> pd.Series        # draw -> aantal D-zetels
def distribution(seat_samples, seats: int) -> np.ndarray       # lengte seats+1, aantallen
def sample_percentile(samples, q: float) -> int                # inverse verdelingsfunctie, q in [0, 100]
def pmf_percentile(pmf, q: float) -> int
def position(samples, value: int) -> dict                      # fewer, equal, more, midrank
def pmf_position(pmf, value: int) -> dict
def effects(proportional: int, median: int, enacted: int) -> dict   # geographic, drawing
def outside_band(enacted: int, p5: int, p95: int) -> bool
def efficiency_gap(d, r, dem_win) -> float
def mean_median(shares) -> float | None
def linear_band(values) -> dict                                # median, p5, p95
def sorted_band(share_matrix: np.ndarray) -> dict              # p5, p50, p95 als lijsten
def convolve(pmfs: Sequence[np.ndarray]) -> np.ndarray
def is_narrow(dist_counts) -> bool                             # grootste aandeel >= 0,95

# pipeline/03_metrics.py
HOUSE_SEATS = 435
def state_metrics(st, d_total, r_total, enacted, ensemble) -> dict
def state_checks(st, enacted, ensemble, reference) -> dict
def national_metrics(states, at_large) -> dict   # CheckError("house_total", "US", ...) als het geen 435 zetels zijn
def compute(cfg, idir) -> dict
def main() -> None                               # schrijft metrics.json en docs/validation.md

# gerry/validation.py
SHARE_TOLERANCE = 0.005                          # 0,5 procentpunt
EXPECTED_PLANS = 5000
CHECK_KEYS = ("cd118_vs_alarm", "whole_unit", "plans", "planscore_reproduction", "planscore", "dra", "state_files")
PLANSCORE_COLUMNS = ("state", "election", "url", "accessed", "same_map", "planscore_eg_pct",
    "planscore_favors", "district", "dem_votes", "rep_votes")
DRA_COLUMNS = ("state", "map_name", "url", "accessed", "district", "dem", "rep")
STATE_FILES_COLUMNS = ("state", "map", "source_kind", "source_url", "retrieved", "blocks_census", "blocks_state",
    "only_census", "only_state", "blocks_matching", "share_blocks", "share_vap", "district_mapping",
    "one_to_one", "result")                      # tools/compare_state_files.py importeert deze tuple
def load_notes(path: Path) -> dict[tuple[str, str], str]           # (staat, controle) -> verklaring
def read_crosscheck(path: Path, columns: Sequence[str]) -> pd.DataFrame | None   # None als het bestand ontbreekt
def planscore_comparison(df: pd.DataFrame) -> list[dict]
    # per staat en verkiezing: state, election, url, accessed, same_map, planscore, tolerance, reproduced, equal_turnout
def equal_turnout_gap(d, r, dem_win) -> float     # EG-formule voor gelijke opkomst, positief gunstig voor Republikeinen
def build_report(metrics: dict, crosscheck_dir: Path, notes_path: Path) -> str

# gerry/geometry.py
GPKG_LAYER = "Congressional Districts"           # met spatie, veld CD120FP
MAPSHAPER_JS: Path                               # REPO_ROOT / "node_modules/mapshaper/bin/mapshaper"
STATE_POSTAL: dict[str, str]                     # FIPS -> postcode, 50 staten
def load_districts(gpkg_zip: Path, mo_zip: Path, workdir: Path) -> "gpd.GeoDataFrame"   # id, state, geometry (EPSG:4326)
def national_outline(cb_zip: Path) -> "gpd.GeoDataFrame"
def mapshaper_cmd(args: Sequence[str]) -> list[str]           # ["node", <repo>/node_modules/mapshaper/bin/mapshaper, *args]
def build_topojson(districts_path: Path, outline_path: Path, out_path: Path, simplify_pct: float) -> Path

# gerry/export.py
NOTE_TEXTS: dict[str, str]
NATIONAL_FIELDS = ("seats", "proportional", "enacted", "neutral", "position", "effects", "outside_band")
STATE_FIELDS = ("d_share", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
    "eg", "mm", "districts", "sorted")
def resolve_notes(postal: str, cfg: Config, computed: Sequence[str]) -> list[dict]   # [{"key", "text"}]
def build_results(metrics: dict, cfg: Config, generated: str) -> dict
    # CheckError met check export_states, export_seats, export_districts of export_blocked_map

# pipeline/04_export.py
SIMPLIFY_PCT = 3                                 # constante hier, niet in config.yaml
MAX_MAP_BYTES = 1_000_000
HOUSE_SEATS = 435
SITE_DATA = REPO_ROOT / "site" / "data"
def check_all_geometry(cfg, districts, root) -> None
def main() -> None
    # volgorde: check_sources_md, build_results, 435 zetels, geometrie laden, check_geometry voor 44 staten,
    # mapshaper, grootte onder 1 MB, check_map_ids, pas dan schrijven naar site/data/

# tools/compare_state_files.py [ST ...]
SOURCES: dict[str, dict]                         # per staat fips, map, kind (block_file | shapes), url, ...
def compare_assignments(census: pd.Series, official: pd.Series, vap: pd.Series | None = None) -> dict
def result_text(kind: str, r: dict) -> str
def make_row(postal: str, src: dict, retrieved: str, result: dict) -> dict   # sleutels = STATE_FILES_COLUMNS
```

### Site-modules

```js
// site/js/format.js (ES-module; package.json heeft "type": "module")
export function roundHalfUp(value, decimals, shift = 0)  // -> string, half-up op de decimale waarde
export function share(fraction)        // -> "54.8%" | "49.95%" | "just under 50%" | "just over 50%" | "exactly 50%"
export function planShare(fraction)    // -> "62%" | "<1%" | ">99%" | "0%" | "100%"
export function advantage(value)       // number | null -> "4.2 points toward Republicans" | "less than 0.05 points either way" | "Not defined for two districts"
export function seats(n)               // -> "17"
export function effect(n)              // geheel getal, positief = meer D-zetels -> "R+6" | "D+3" | "0" (Task 6.1 van het siteplan)
export function effectWords(n)         // -> "6 seats toward Republicans" | "1 seat toward Democrats" | "no difference"
export function effectLine(n)          // -> "R+6 · 6 seats toward Republicans" | "0 · no difference"
export function count(n)               // -> "5,000"
export function percentLabel(fraction) // -> "35%" (assen en legenda's)
export function longDate(iso)          // "2026-10-03" -> "October 3, 2026"
```

### Gereedschap

- `package.json`: `"type": "module"`, devDependencies `d3` 7.9.0, `mapshaper` 0.7.77, `topojson-client` 3.1.0. `npm test` draait `node --test "site/js/*.test.js"` (`node --test site/js` werkt niet in Node 24). `npm run vendor` kopieert d3, topojson-client en hun licenties naar `site/vendor/`.
- `Makefile`: `download`, `join`, `metrics`, `export`, `test`, `all` en `serve`, plus de hulpdoelen `test-py` (`$(PY) -m pytest`) en `test-js` (`node --test "site/js/*.test.js"`). `test` draait beide. `serve` is `$(PY) -m http.server 8000 --bind 127.0.0.1 --directory site`. Elk recept is één commando zonder shell-gereedschap.
- `requirements.txt`: geopandas 1.2.0, numpy 2.5.3, openpyxl 3.1.5 (voor de `.xlsx`-blokbestanden in Task 3.6), pandas 3.0.6, pyarrow 25.0.1, pyogrio 0.13.0, pytest 9.1.1, pyyaml 6.0.3, rdata 1.1.0.
- `pytest.ini`: `testpaths = tests`, `pythonpath = pipeline`, `--strict-markers`, marker `data`.

### Bestanden tussen de stappen (`data/interim/`)

- `units/{ST}.parquet`: `unit_id`, `vap`, `pop`, `d_<e>`, `r_<e>`, `d`, `r` (uit `map.rds`, zonder `cd_2020`).
- `enacted_districts.parquet`: `state`, `map_id` (`enacted`, `mo_hb1`, `check_2022`), `method` (`block`, `whole_unit`), `district`, `d_<e>`/`r_<e>` voor `pre_16` en `pre_20` (leeg voor WV `pre_16`), `d`, `r`. Verplicht per staat: `check_2022` met `block` (CD118, ook voor Missouri), en voor `enacted` en elke extra kaart zowel `block` als `whole_unit`. `03_metrics` stopt met een `CheckError` als een van die rijen ontbreekt.
- `ensemble_districts.parquet`: `state`, `draw`, `district`, dezelfde stemkolommen.
- `alarm_reference.parquet`: `state`, `district`, dezelfde stemkolommen (rijen `draw == "cd_2020"`, met de districtlabels van `map.rds`, gesorteerd op district).
- `join_log.json`: per staat een object met de tellingen `units`, `empty_vote_fields`, `empty_vote_units` (lege stemvelden in `map.rds`), `empty_weight_fields` (lege velden in het blokbestand van census-vest, 0 buiten de tractstaten), `blocks`, `units_zero_vap`, `unlinked_blocks` en `unlinked_keys` (blokken en sleutels zonder eenheid in `map.rds`, uit `check_vap_pop`) en `plans` (int); `reference_share` (float, uit `check_reference_labels`); `reference_labels` (`{stats-label: map-label}`, alleen de labels die veranderen); en `maps` (`{map_id: {"split_units", "zero_vap_units", "zero_vap_split_units", "units_without_blocks", "weight_fallback_units": int, "block_count_votes": float}}`, de tellingen van `block_weighted` per kaart).
- `metrics.json`: `{"national": {...}, "states": {ST: {...}}, "checks": {...}}`.
  - Per staat precies de numerieke velden van `results.json` uit hoofdstuk 7 van de spec (`d_share`, `proportional`, `enacted`, `neutral`, `position`, `effects`, `outside_band`, `eg`, `mm`, `districts`, `sorted`, `blocked_map` zonder `name`/`status`/`source`) plus `computed_notes` (lijst van sleutels). `districts[].d` en `.r` zijn onafgeronde kommagetallen; `mm` is `null` bij twee districten, nooit NaN.
  - `national`: `seats`, `proportional`, `enacted`, `neutral`, `position`, `effects`, `outside_band`, plus `single_seat` [{`postal`, `fips`, `name`}]. Het rapport gebruikt `single_seat`; `build_results` neemt alleen de andere zeven velden over en bouwt `single_seat` opnieuw uit `config.yaml`.
  - `checks`: `plans` {ST: int}; `ties` {ST: {`ensemble`, `enacted`}}; `cd118_vs_alarm` {ST: {`districts`: [{`district`, `ours`, `alarm`}], `seats_ours`, `seats_alarm`}}; `whole_unit` {ST: [{`map_id`, `district`, `block`, `whole`, `block_dem`, `whole_dem`}]}; `pre_20` {ST: {district: aandeel D in 2020}}; `join_log` (de inhoud van `join_log.json`); `totals` {`district_seats`, `at_large`}.
- `districts.geojson`, `outline.geojson`, `map.topojson`: geometrie van `04_export`, vóór het kopiëren naar `site/data/`. `map_check.svg`: de visuele controle van Task 3.5.

### docs/validation.md

`build_report` schrijft precies één samenvattingsregel `**Open items: <n>.** Pending: <m>.`: n is het aantal overschrijdingen zonder verklaring in `data/validation_notes.yaml`, m het aantal ontbrekende kruiscontrolebestanden in `data/crosscheck/`. Task 3.6 en 4.4 zoeken op deze letterlijke tekst; `03_metrics.py` drukt hem af zonder sterretjes. Een district waar de hele-eenheidstoewijzing een andere winnaar geeft dan de blokverdeling, blijft open tot het verklaard is (hoofdstuk 6 van de spec).

### Uitvoer voor de site

- `site/data/results.json`: de vorm uit hoofdstuk 7 van de spec. `04_export` rondt alleen stemmen af (`d` en `r` per district, half-up op hele getallen). Aandelen, de kansen in `dist` en `position` blijven ruwe floats.
- `site/data/map.topojson`: `id`, `state` en `postal` staan in `properties` (mapshaper zonder `id-field=`). Laag `districts`: `id` (FIPS plus district, `"4809"`) en `state` (postcode); de staten met één zetel zijn één district `<fips>00`. Laag `states`: `id` (FIPS) en `postal`.

### Referentiegetallen uit de haalbaarheidscontrole

Integratietests (`@pytest.mark.data`) controleren deze uitkomsten:

| Staat | Proportional | Enacted | Verdeling D-zetels over 5.000 plannen | Mediaan | p5 | p95 |
|---|---|---|---|---|---|---|
| NV | 2 | 3 | 1:13, 2:1901, 3:3086 | 3 | 2 | 3 |
| TX | 18 | 11 | 12:1, 13:1, 14:62, 15:264, 16:1027, 17:1197, 18:1213, 19:755, 20:452, 21:28 | 17 | 15 | 20 |
| CA | 34 | 48 | 43:112, 44:763, 45:3258, 46:802, 47:58, 48:7 | 45 | 44 | 46 |
| IA | 2 | 0 | 0:78, 1:3214, 2:1708 | 1 | 1 | 2 |
| WV | 1 | 0 | 0:5000 | 0 | 0 | 0 |
| UT | 2 | 1 | 0:1387, 1:3613 | 1 | 0 | 1 |
| NC | 7 | 3 | 3:1, 4:156, 5:1752, 6:1875, 7:1118, 8:98 | 6 | 5 | 7 |
| LA | 2 | 1 | 0:1, 1:4989, 2:10 | 1 | 1 | 1 |

Nevada, Enacted per district (blokverdeling): 01 0,547901; 02 0,436352; 03 0,534711; 04 0,548082. Nevada CD118 tegen ALARM `cd_2020`: grootste verschil 0,00042.

## Phases

1. Fase 0: opzet (taken 0.x).
2. Fase 1: data (taken 1.1 tot en met 1.11) en fase 1b: ALARM's kaartbestand als stembron (taken 1.12 tot en met 1.18). Taak 1.18 vervangt taak 1.11.
3. Fase 2: metrieken en controlerapport (taken 2.x).
4. Fase 3: export en eenmalige vergelijking (taken 3.x).
5. Fase 4: site, voor zover de spec het vastlegt (taken 4.x). Het visuele ontwerp volgt in een aparte sessie met de frontend-design skill, met een eigen plan.

## Phase 0: opzet

Na deze fase draaien `pytest` en `npm test`, staan d3 en topojson-client in `site/vendor/`, staat elke staat in `pipeline/config.yaml`, en controleert `check_sources_md` dat `config.yaml` en `data/sources.md` overeenkomen.

Alle commando's draaien in PowerShell vanuit de worktree-root `C:\projects\Gerry\.worktrees\pipeline-setup`. Git staat hier op `core.autocrlf=true`; de code leest regeleinden met `splitlines()` en werkt dus met CRLF en LF.

### Task 0.1: Python-omgeving en testrunner

**Files:**
- Create: `requirements.txt`
- Create: `pytest.ini`
- Create: `pipeline/gerry/__init__.py`
- Create: `tests/test_smoke.py`
- Modify: `.gitignore` (regel `data/interim/` onder `data/raw/`)

**Interfaces:**
- Consumes: niets.
- Produces: `.venv` met Python 3.12 en de vastgepinde pakketten. `pytest.ini` met `testpaths = tests`, `pythonpath = pipeline`, `--strict-markers` en de marker `data`. Het pakket `gerry`, in tests te importeren als `import gerry`.

De implementer maakt `.venv` zelf aan, in de worktree. Niets systeembreed installeren: geen `pip install --user`, geen globale pakketten, geen `python3`.

- [ ] **Step 1: Maak de virtuele omgeving**

Run: `py -3.12 -m venv .venv`

Run: `.venv\Scripts\python --version`

Expected: `Python 3.12.x` (op deze machine 3.12.10).

- [ ] **Step 2: Schrijf `requirements.txt`**

Exacte versies, de nieuwste op PyPI op 5 oktober 2026. Pip haalt shapely, pyproj, xarray en et-xmlfile mee als afhankelijkheden.

`openpyxl` staat erin omdat `pandas.read_excel` het nodig heeft voor de `.xlsx`-blokbestanden van Ohio en Missouri HB 1, die `tools/compare_state_files.py` in Task 3.6 leest (hoofdstuk 9 van de spec). Task 3.6 past `requirements.txt` daarom niet meer aan.

```text
geopandas==1.2.0
numpy==2.5.3
openpyxl==3.1.5
pandas==3.0.6
pyarrow==25.0.1
pyogrio==0.13.0
pytest==9.1.1
pyyaml==6.0.3
rdata==1.1.0
```

- [ ] **Step 3: Installeer de pakketten**

Run: `.venv\Scripts\python -m pip install -r requirements.txt`

Expected: een regel die begint met `Successfully installed` en onder meer noemt: `geopandas-1.2.0`, `openpyxl-3.1.5`, `pandas-3.0.6`, `pyarrow-25.0.1`, `pyogrio-0.13.0`, `rdata-1.1.0` en `shapely-2.1.2`. Een melding over een nieuwere pip mag je negeren.

- [ ] **Step 4: Schrijf `pytest.ini`**

```ini
[pytest]
testpaths = tests
pythonpath = pipeline
addopts = --strict-markers
markers =
    data: needs downloaded files in the data folder; skipped when they are missing
```

- [ ] **Step 5: Schrijf de smoke-test `tests/test_smoke.py`**

De test faalt als een geïnstalleerde versie afwijkt van `requirements.txt`. Pas bij een upgrade beide bestanden samen aan.

```python
"""Smoke test: the pinned packages import and the gerry package is on the path."""
import importlib
import sys

import pytest

PINNED = {
    "geopandas": "1.2.0",
    "numpy": "2.5.3",
    "openpyxl": "3.1.5",
    "pandas": "3.0.6",
    "pyarrow": "25.0.1",
    "pyogrio": "0.13.0",
    "pytest": "9.1.1",
    "rdata": "1.1.0",
    "yaml": "6.0.3",
}


def test_python_is_3_12():
    assert sys.version_info[:2] == (3, 12)


@pytest.mark.parametrize("module, version", sorted(PINNED.items()))
def test_pinned_version(module, version):
    assert importlib.import_module(module).__version__ == version


def test_gerry_package_is_importable():
    gerry = importlib.import_module("gerry")
    assert gerry.__file__ is not None, "pipeline/gerry/__init__.py is missing"
    assert gerry.__file__.replace("\\", "/").endswith("pipeline/gerry/__init__.py")
```

- [ ] **Step 6: Draai de test en zie hem falen**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_smoke.py -v`

Expected: `1 failed, 10 passed`. `test_gerry_package_is_importable` faalt met `ModuleNotFoundError: No module named 'gerry'`.

- [ ] **Step 7: Maak het pakket `pipeline/gerry/__init__.py`**

```python
"""Shared, tested code for the gerrymandering map pipeline."""
```

- [ ] **Step 8: Draai de test opnieuw**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_smoke.py -v`

Expected: `11 passed`.

- [ ] **Step 9: Zet `data/interim/` in `.gitignore`**

Voeg direct onder de regel `data/raw/` de regel `data/interim/` toe. Het blok wordt:

```text
# Raw data is never committed; it is reproducible via the download scripts
data/raw/
data/interim/
```

Run: `git check-ignore data/interim/x.parquet`

Expected: `data/interim/x.parquet`.

- [ ] **Step 10: Commit**

```powershell
git add requirements.txt pytest.ini .gitignore pipeline/gerry/__init__.py tests/test_smoke.py
git commit -m "Set up Python environment and pytest"
```

### Task 0.2: Node-gereedschap en vendored bibliotheken

**Files:**
- Create: `package.json`
- Create: `package-lock.json` (door `npm install`)
- Create: `site/js/vendor.test.js`
- Create: `site/vendor/d3.min.js`, `site/vendor/d3.LICENSE.txt`, `site/vendor/topojson-client.min.js`, `site/vendor/topojson-client.LICENSE.txt` (door `npm run vendor`)

**Interfaces:**
- Consumes: niets.
- Produces: `node_modules/mapshaper/bin/mapshaper` (0.7.77) voor `gerry/geometry.py` (`mapshaper_cmd`). `npm test` draait `node --test "site/js/*.test.js"`. `site/vendor/d3.min.js` (d3 7.9.0, UMD, global `d3`) en `site/vendor/topojson-client.min.js` (3.1.0, global `topojson`) voor de site. `package.json` heeft `"type": "module"`: elk `.js`-bestand onder `site/js/` is een ES-module.

Twee bewuste keuzes:

- `node --test site/js` werkt niet in Node 24. Node laadt een map als argument als module en faalt met `Cannot find module`. Het testscript gebruikt daarom het patroon `"site/js/*.test.js"`. Node vouwt het patroon zelf uit, ook onder cmd.exe. Zonder testbestanden geeft het `tests 0` en exit code 0. De spec (hoofdstuk 8 en 9) en de plankop gebruiken hetzelfde patroon.
- Zonder `"type": "module"` waarschuwt Node bij elk testbestand met `MODULE_TYPELESS_PACKAGE_JSON`.

- [ ] **Step 1: Controleer Node**

Run: `node --version`

Expected: `v24.x` (op deze machine v24.18.0, npm 11.16.0).

- [ ] **Step 2: Schrijf `package.json`**

Het script `vendor` kopieert met `node -e` en `fs.copyFileSync`, zonder shell-gereedschap.

```json
{
  "name": "gerry",
  "version": "0.0.0",
  "private": true,
  "description": "Static map that compares proportional, neutral and enacted House seat counts by state",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "vendor": "node -e \"const fs=require('fs');fs.mkdirSync('site/vendor',{recursive:true});for(const[f,t]of[['d3/dist/d3.min.js','d3.min.js'],['d3/LICENSE','d3.LICENSE.txt'],['topojson-client/dist/topojson-client.min.js','topojson-client.min.js'],['topojson-client/LICENSE','topojson-client.LICENSE.txt']])fs.copyFileSync('node_modules/'+f,'site/vendor/'+t)\"",
    "test": "node --test \"site/js/*.test.js\""
  },
  "devDependencies": {
    "d3": "7.9.0",
    "mapshaper": "0.7.77",
    "topojson-client": "3.1.0"
  }
}
```

- [ ] **Step 3: Schrijf de test `site/js/vendor.test.js`**

De test controleert dat de kopieën in `site/vendor/` de versie uit `package.json` hebben, met licentie. Hij heeft `node_modules` niet nodig, dus hij werkt ook op een verse checkout.

```js
// The vendored libraries in site/vendor match the versions pinned in package.json.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const pinned = JSON.parse(readFileSync(root('package.json'), 'utf8')).devDependencies;

for (const name of ['d3', 'topojson-client']) {
  test(`${name}: vendored copy is version ${pinned[name]} with its license`, () => {
    const script = root(`site/vendor/${name}.min.js`);
    assert.ok(existsSync(script), `${script} missing; run npm run vendor`);
    const banner = readFileSync(script, 'utf8').split('\n', 1)[0];
    assert.match(banner, new RegExp(` v${pinned[name].replaceAll('.', '\\.')} `), banner);
    const license = readFileSync(root(`site/vendor/${name}.LICENSE.txt`), 'utf8');
    assert.match(license, /Permission to use, copy, modify/);
  });
}
```

- [ ] **Step 4: Draai de test en zie hem falen**

Run: `npm test`

Expected: `fail 2`, met de melding `site\vendor\d3.min.js missing; run npm run vendor`.

- [ ] **Step 5: Installeer de pakketten**

Run: `npm install`

Expected: `node_modules/` en `package-lock.json` bestaan. npm meldt twee dingen die je zo laat:

- `npm warn allow-scripts` voor `better-sqlite3` en `msgpackr-extract`. Keur die scripts niet goed. Het zijn native onderdelen voor GeoPackage-ondersteuning en snelheid. De omzetting van GeoJSON naar TopoJSON werkt zonder; dat is getest met mapshaper 0.7.77.
- `npm audit` meldt kwetsbaarheden in `file-type` en `image-size` (via `@ngageoint/geopackage`). Draai geen `npm audit fix --force`: dat zet mapshaper terug naar 0.6.13. Mapshaper verwerkt alleen onze eigen bestanden, lokaal. De eigenaar beslist of deze meldingen geaccepteerd worden (zie "Open punten voor de eigenaar" onderaan dit plan). Noem ze in je verslag van deze taak.

Run: `node node_modules/mapshaper/bin/mapshaper -v`

Expected: `0.7.77`.

- [ ] **Step 6: Kopieer de bibliotheken naar `site/vendor/`**

Run: `npm run vendor`

Run: `Get-ChildItem site\vendor | Select-Object Name, Length`

Expected: vier bestanden: `d3.LICENSE.txt` (731), `d3.min.js` (279706), `topojson-client.LICENSE.txt` (734), `topojson-client.min.js` (7169).

- [ ] **Step 7: Draai de test opnieuw**

Run: `npm test`

Expected: `pass 2`, `fail 0`.

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json site/vendor site/js/vendor.test.js
git commit -m "Add Node tooling and vendored d3 and topojson-client"
```

### Task 0.3: Makefile en README

**Files:**
- Create: `tests/test_makefile.py`
- Create: `Makefile`
- Create: `README.md`

**Interfaces:**
- Consumes: `pytest.ini` (Task 0.1), het npm-testpatroon (Task 0.2).
- Produces: de targets `download`, `join`, `metrics`, `export`, `test`, `all` en `serve`, plus de hulptargets `test-py` en `test-js`. Elke receptregel is één commando zonder shell-gereedschap. `serve` start `http.server` op 127.0.0.1:8000 met `site/` als map.

Make staat niet op deze machine. De tests hieronder controleren de vorm van de Makefile; het echte `make`-commando komt in Step 7, nadat de eigenaar Make heeft geïnstalleerd.

- [ ] **Step 1: Schrijf de test `tests/test_makefile.py`**

```python
"""The Makefile keeps to the Windows rules from chapter 9 of the spec."""
import re
from pathlib import Path

MAKEFILE = Path(__file__).resolve().parents[1] / "Makefile"
TARGETS = ("all", "download", "join", "metrics", "export", "test", "serve")
# Shell tools and chaining that break under cmd.exe, plus commands the project bans.
FORBIDDEN = ("&&", "||", ";", "rm ", "cp ", "mv ", "mkdir ", "source ", "cd ", "python3", "npx")


def makefile_lines() -> list[str]:
    return MAKEFILE.read_text(encoding="utf-8").splitlines()


def recipe_lines() -> list[str]:
    return [line[1:] for line in makefile_lines() if line.startswith("\t")]


def test_all_targets_exist():
    targets = {m.group(1) for line in makefile_lines() if (m := re.match(r"^([a-z-]+):", line))}
    assert set(TARGETS) <= targets


def test_python_and_utf8_settings():
    lines = makefile_lines()
    assert "PY ?= python" in lines
    assert "export PYTHONUTF8 := 1" in lines


def test_recipes_are_tab_indented():
    assert not [line for line in makefile_lines() if line.startswith(" ")]


def test_recipes_use_no_shell_tools():
    for line in recipe_lines():
        for token in FORBIDDEN:
            assert token not in line, f"{token!r} in recipe {line!r}"


def test_python_recipes_use_py_variable():
    python_lines = [line for line in recipe_lines() if not line.startswith("node ")]
    assert python_lines
    assert all(line.startswith("$(PY) ") for line in python_lines)
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_makefile.py -v`

Expected: `5 failed`, alle vijf met `FileNotFoundError` op `Makefile`.

- [ ] **Step 3: Schrijf de `Makefile`**

Elke receptregel begint met een tab, niet met spaties. Controleer dat na het plakken; `test_recipes_are_tab_indented` vangt het ook.

```make
# Run from the repository root after activating .venv.
# Every recipe is one command without shell tools, so it runs the same under
# cmd.exe and sh on Windows.

PY ?= python
export PYTHONUTF8 := 1

.PHONY: all download join metrics export test test-py test-js serve

all: download join metrics export

download:
	$(PY) pipeline/01_download.py

join:
	$(PY) pipeline/02_join.py

metrics:
	$(PY) pipeline/03_metrics.py

export:
	$(PY) pipeline/04_export.py

test: test-py test-js

test-py:
	$(PY) -m pytest

test-js:
	node --test "site/js/*.test.js"

serve:
	$(PY) -m http.server 8000 --bind 127.0.0.1 --directory site
```

- [ ] **Step 4: Draai de test opnieuw**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_makefile.py -v`

Expected: `5 passed`.

- [ ] **Step 5: Schrijf `README.md`**

Zichtbare tekst: Engels, geen em-dashes, door de unslop-skill gehaald.

````markdown
# US House maps: proportional, neutral and enacted seats

A static map of every US congressional district. For each state with more than one seat it puts three seat counts side by side:

1. Proportional. Seats in proportion to the state's two-party vote.
2. Neutral baseline. The median and the 5th to 95th percentile of Democratic seats over 5,000 simulated maps from the ALARM Project.
3. Enacted. The seats from the map that voters use on November 3, 2026.

All three count the same votes. These are the 2016 and 2020 presidential results added together, by precinct. West Virginia uses 2020 only, by county. The difference between Proportional and Neutral baseline is the geographic effect. The difference between Neutral baseline and Enacted is the drawing effect.

Alaska, Delaware, North Dakota, South Dakota, Vermont and Wyoming have one seat each. They have no districts, so there is nothing to compare.

The design is in `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md`. The map and legal status for each state is in `data/sources.md`.

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

Without Make, run `python -m pytest` and `npm test`. Tests marked `data` need the downloads and are skipped when the files are missing.

## View the site

```powershell
make serve
```

Then open http://127.0.0.1:8000. Without Make, run `python -m http.server 8000 --bind 127.0.0.1 --directory site`.

## Sources and licenses

- ALARM Project, 50-State Redistricting Simulations, Harvard Dataverse, doi:10.7910/DVN/SLCD3E, version 15. CC0 1.0.
- ALARM census-2020 files, with election data from the Voting and Election Science Team. The election data is CC BY 4.0, the census-2020 files are CC BY-SA 4.0.
- US Census Bureau block equivalency files for the 118th and 120th Congress, P.L. 94-171 redistricting data, TIGER/Line files and cartographic boundary files. Public domain.
- D3 and topojson-client, ISC license. Copies with their license files are in `site/vendor/`.
````

- [ ] **Step 6: Draai alle Python-tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest`

Expected: `16 passed`.

- [ ] **Step 7: Draai de Makefile met Make**

Run: `make --version`

Staat Make er niet ("make is not recognized"), vraag de eigenaar dan om precies deze ene stap in een eigen terminal en wacht op het resultaat:

```powershell
winget install ezwinports.make
```

Daarna een nieuwe PowerShell openen in de worktree, zodat `make` op het PATH staat. Zet dan `.venv\Scripts` vooraan het PATH; dat doet hetzelfde als activeren, zonder uitvoeringsbeleid voor scripts:

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make -n all`

Expected: vier regels, `python pipeline/01_download.py` tot en met `python pipeline/04_export.py`. De scripts bestaan nog niet; `-n` drukt alleen af.

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make test`

Expected: pytest meldt `16 passed`, daarna `node --test` met `pass 2`. Exit code 0.

- [ ] **Step 8: Commit**

```powershell
git add Makefile README.md tests/test_makefile.py
git commit -m "Add Makefile and README"
```

### Task 0.4: config.yaml en gerry/config.py

**Files:**
- Create: `pipeline/gerry/config.py`
- Create: `pipeline/config.yaml`
- Create: `tests/test_config.py`

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces (bindend, zie "Interfaces" in de plankop):
  - `REPO_ROOT: Path`, `STATUS_VALUES`, `ENSEMBLE_NOTE_KEYS`, `STATE_NOTE_KEYS`, `COMPUTED_NOTE_KEYS`.
  - `class ConfigError(ValueError)`.
  - De frozen dataclasses `ExtraMap`, `StateConfig`, `AtLargeState`, `EnsembleConfig`, `AlignEntry`, `Config` met precies de velden uit het contract.
  - `data_dir() -> Path`: `GERRY_DATA_DIR` (opgelost tot absoluut pad) of `REPO_ROOT / "data" / "raw"`.
  - `interim_dir() -> Path`: `REPO_ROOT / "data" / "interim"`. Maakt de map niet aan; wie schrijft, maakt hem aan.
  - `load_config(path: Path | None = None) -> Config`: leest standaard `REPO_ROOT / "pipeline" / "config.yaml"` en gooit `ConfigError` bij elk ontbrekend veld, onbekend veld of ongeldige waarde.
  - `cfg.ensemble.notes` bevat alleen staten met noten. Gebruik `cfg.ensemble.notes.get(postal, ())`.
  - In `config.yaml` zijn `extra_maps` en `notes` per staat optioneel; leeg betekent `()`.

Wat `load_config` controleert:

- Bovenaan precies de sleutels `status_checked`, `census_vest_commit`, `ensemble`, `align_to_alarm`, `sources`, `states`, `at_large`.
- `status_checked` is een datum (YAML `2026-10-03`), `census_vest_commit` 40 hexadecimale tekens.
- Per staat: postcode van twee hoofdletters, alle verplichte velden, geen onbekende velden. `fips` is tekst van twee cijfers (in YAML tussen aanhalingstekens). `seats` is een geheel getal van minstens 2. `status` is `In effect` of `Challenged`. `bef` is `cd120` of `cd118`. `unit_source` is `vtd`, `block` of `rds_county`. `elections` is een niet-lege lijst zonder dubbelen in de vorm `pre_16`. URL's beginnen met `https://`. `notes` komen uit `STATE_NOTE_KEYS`.
- Extra kaarten: id in kleine letters, niet `enacted` of `check_2022` (die zijn `map_id`'s in `enacted_districts.parquet`). `status` is `Blocked`.
- Ensemble: `doi` begint met `doi:`. Noten alleen voor staten in `states`, sleutels uit `ENSEMBLE_NOTE_KEYS`. `fill` dekt precies de staten met `core_preservation_prior_map`, elk met `reference_map` en `consequence`.
- `align_to_alarm`: staat bestaat, elke unit is tekst met lengte `unit_len` en begint met de FIPS-code van de staat.
- `sources` heeft precies de acht sleutels uit het contract.
- Geen postcode zowel in `states` als in `at_large`; geen FIPS-code dubbel.

Het totaal van 429 zetels en de zes at-large staten zijn eigenschappen van het echte bestand. Die staan in de tests, niet in de lader, zodat tests met kleine configs mogelijk blijven.

- [ ] **Step 1: Schrijf de tests voor de lader (eerste deel van `tests/test_config.py`)**

```python
"""Tests for gerry.config: the loader on small configs, then the real config.yaml."""
from datetime import date
from pathlib import Path

import pytest
import yaml

from gerry.config import (
    ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, ConfigError, ExtraMap,
    data_dir, interim_dir, load_config,
)

SOURCE_KEYS = ("dataverse_api", "cd118", "cd120", "pl94171", "census_vest",
               "tiger_gpkg", "tiger_mo_cd119", "cb_states")


def minimal() -> dict:
    """A small valid config: two multi-seat states and one at-large state."""
    return {
        "status_checked": date(2026, 10, 3),
        "census_vest_commit": "243c8a8134ecf8151777a9388c48323e274767e2",
        "ensemble": {
            "name": "alarm_v15",
            "doi": "doi:10.7910/DVN/SLCD3E",
            "version": 15,
            "notes": {"NM": ["core_preservation_prior_map"], "MO": ["vra_constraint", "vra_filter_bvap"]},
            "fill": {"NM": {"reference_map": "the 2021 map", "consequence": "It is closer to zero."}},
        },
        "align_to_alarm": [],
        "sources": {key: f"https://example.org/{key}" for key in SOURCE_KEYS},
        "states": {
            "MO": {
                "name": "Missouri", "fips": "29", "seats": 8, "map_name": "HB 2909 of 2022",
                "status": "In effect", "source_label": "Redistricting Data Hub",
                "source_url": "https://example.org/mo-2022", "bef": "cd118",
                "elections": ["pre_16", "pre_20"], "unit_source": "vtd",
                "extra_maps": {"mo_hb1": {
                    "name": "HB 1 of 2025", "status": "Blocked", "bef": "cd120",
                    "source_label": "Redistricting Data Hub", "source_url": "https://example.org/mo-2025"}},
                "notes": ["blocked_map"],
            },
            "NM": {
                "name": "New Mexico", "fips": "35", "seats": 3, "map_name": "SB 1 of 2021",
                "status": "In effect", "source_label": "New Mexico Legislature",
                "source_url": "https://example.org/nm", "bef": "cd120",
                "elections": ["pre_16", "pre_20"], "unit_source": "vtd",
            },
        },
        "at_large": {"VT": {"name": "Vermont", "fips": "50"}},
    }


def write(tmp_path: Path, raw: dict) -> Path:
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    return path


def test_minimal_config_loads_with_types(tmp_path):
    cfg = load_config(write(tmp_path, minimal()))
    assert cfg.status_checked == date(2026, 10, 3)
    assert cfg.ensemble.version == 15
    assert cfg.ensemble.notes["MO"] == ("vra_constraint", "vra_filter_bvap")
    assert cfg.ensemble.fill["NM"]["reference_map"] == "the 2021 map"
    mo = cfg.states["MO"]
    assert (mo.postal, mo.fips, mo.seats, mo.bef) == ("MO", "29", 8, "cd118")
    assert mo.elections == ("pre_16", "pre_20")
    assert mo.notes == ("blocked_map",)
    assert mo.extra_maps == (ExtraMap(
        id="mo_hb1", name="HB 1 of 2025", status="Blocked", bef="cd120",
        source_label="Redistricting Data Hub", source_url="https://example.org/mo-2025"),)
    assert cfg.states["NM"].extra_maps == ()
    assert cfg.states["NM"].notes == ()
    assert cfg.at_large["VT"].fips == "50"
    assert cfg.align_to_alarm == ()


def set_path(raw: dict, path: str, value) -> None:
    """Set raw[a][b][c] = value for path 'a.b.c'; value None deletes the key."""
    *parents, last = path.split(".")
    node = raw
    for key in parents:
        node = node[key]
    if value is None:
        del node[last]
    else:
        node[last] = value


BAD_VALUES = [
    ("states.NM.status", "Blocked", "status"),
    ("states.NM.bef", "cd119", "bef"),
    ("states.NM.unit_source", "tract", "unit_source"),
    ("states.NM.fips", 35, "fips"),
    ("states.NM.seats", 1, "seats"),
    ("states.NM.elections", [], "elections"),
    ("states.NM.elections", ["pre_2020"], "elections"),
    ("states.NM.notes", ["vra_constraint"], "unknown note keys"),
    ("states.NM.seat", 3, "unknown keys"),
    ("states.NM.map_name", None, "missing keys"),
    ("states.NM.source_url", "http://example.org/nm", "https"),
    ("states.MO.extra_maps.mo_hb1.status", "In effect", "status"),
    ("states.MO.extra_maps.mo_hb1.bef", "cd118x", "bef"),
    ("ensemble.notes.MO", ["packing"], "unknown note keys"),
    ("ensemble.notes.TX", ["vra_constraint"], "not in states"),
    ("ensemble.fill", {}, "core_preservation_prior_map"),
    ("ensemble.fill.MO", {"reference_map": "x", "consequence": "y"}, "core_preservation_prior_map"),
    ("ensemble.doi", "10.7910/DVN/SLCD3E", "doi"),
    ("status_checked", "October 3", "status_checked"),
    ("census_vest_commit", "main", "census_vest_commit"),
    ("sources.cd120", None, "missing keys"),
    ("at_large.NM", {"name": "New Mexico", "fips": "35"}, "both list"),
    ("at_large.VT.fips", "29", "more than once"),
]


@pytest.mark.parametrize("path, value, message", BAD_VALUES)
def test_invalid_config_raises(tmp_path, path, value, message):
    raw = minimal()
    set_path(raw, path, value)
    with pytest.raises(ConfigError, match=message):
        load_config(write(tmp_path, raw))


@pytest.mark.parametrize("units, message", [
    (["0604900030"], "length 11"),        # ten characters
    (["06049000300"], "starting with 35"),  # California tract in a New Mexico entry
])
def test_align_entry_units_are_checked(tmp_path, units, message):
    raw = minimal()
    raw["align_to_alarm"] = [{"state": "NM", "rds": "alarm/NM_cd_2020_map.rds",
                              "unit_column": "tract", "unit_len": 11, "units": units}]
    with pytest.raises(ConfigError, match=message):
        load_config(write(tmp_path, raw))


def test_repo_root_holds_the_pipeline():
    assert (REPO_ROOT / "pipeline" / "gerry" / "config.py").is_file()


def test_data_dir_defaults_to_data_raw(monkeypatch):
    monkeypatch.delenv("GERRY_DATA_DIR", raising=False)
    assert data_dir() == REPO_ROOT / "data" / "raw"


def test_data_dir_follows_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("GERRY_DATA_DIR", str(tmp_path))
    assert data_dir() == tmp_path.resolve()


def test_interim_dir():
    assert interim_dir() == REPO_ROOT / "data" / "interim"
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py -v`

Expected: fout bij het verzamelen: `ModuleNotFoundError: No module named 'gerry.config'`.

- [ ] **Step 3: Schrijf `pipeline/gerry/config.py`**

```python
"""Load and validate pipeline/config.yaml, and derive the repository paths."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT: Path = Path(__file__).resolve().parents[2]

STATUS_VALUES = ("In effect", "Challenged", "Blocked", "At-large")
ENSEMBLE_NOTE_KEYS = (
    "vra_constraint", "core_preservation_prior_map", "core_preservation_2010",
    "competitiveness_rule", "vra_filter_with_votes", "vra_filter_bvap",
    "alarm_rerun_unpublished", "alarm_method_update_pending",
)
STATE_NOTE_KEYS = ("adopted_after_2024_election", "composite_2020_only", "blocked_map")
COMPUTED_NOTE_KEYS = ("narrow_ensemble",)

_STATE_STATUS = ("In effect", "Challenged")
_EXTRA_MAP_STATUS = ("Blocked",)
_BEF = ("cd120", "cd118")
_UNIT_SOURCES = ("vtd", "block", "rds_county")
_FILL_KEYS = ("reference_map", "consequence")
_RESERVED_MAP_IDS = ("enacted", "check_2022")
_SOURCE_KEYS = (
    "dataverse_api", "cd118", "cd120", "pl94171", "census_vest",
    "tiger_gpkg", "tiger_mo_cd119", "cb_states",
)
_TOP_KEYS = (
    "status_checked", "census_vest_commit", "ensemble", "align_to_alarm",
    "sources", "states", "at_large",
)
_STATE_REQUIRED = (
    "name", "fips", "seats", "map_name", "status", "source_label", "source_url",
    "bef", "elections", "unit_source",
)
_STATE_KEYS = _STATE_REQUIRED + ("extra_maps", "notes")
_EXTRA_MAP_KEYS = ("name", "status", "bef", "source_label", "source_url")
_ELECTION = re.compile(r"[a-z]{3}_\d{2}")
_POSTAL = re.compile(r"[A-Z]{2}")


class ConfigError(ValueError):
    """config.yaml misses a field or holds a value outside the allowed set."""


@dataclass(frozen=True)
class ExtraMap:
    id: str
    name: str
    status: str
    bef: str
    source_label: str
    source_url: str


@dataclass(frozen=True)
class StateConfig:
    postal: str
    name: str
    fips: str
    seats: int
    map_name: str
    status: str
    source_label: str
    source_url: str
    bef: str
    elections: tuple[str, ...]
    unit_source: str
    extra_maps: tuple[ExtraMap, ...]
    notes: tuple[str, ...]


@dataclass(frozen=True)
class AtLargeState:
    postal: str
    name: str
    fips: str


@dataclass(frozen=True)
class EnsembleConfig:
    name: str
    doi: str
    version: int
    notes: dict[str, tuple[str, ...]]
    fill: dict[str, dict[str, str]]


@dataclass(frozen=True)
class AlignEntry:
    state: str
    rds: str
    unit_column: str
    unit_len: int
    units: tuple[str, ...]


@dataclass(frozen=True)
class Config:
    status_checked: date
    census_vest_commit: str
    ensemble: EnsembleConfig
    align_to_alarm: tuple[AlignEntry, ...]
    sources: dict[str, str]
    states: dict[str, StateConfig]
    at_large: dict[str, AtLargeState]


def data_dir() -> Path:
    """GERRY_DATA_DIR if set, else data/raw in the repository."""
    value = os.environ.get("GERRY_DATA_DIR", "").strip()
    if value:
        return Path(value).expanduser().resolve()
    return REPO_ROOT / "data" / "raw"


def interim_dir() -> Path:
    """data/interim in the repository. Callers create it when they write."""
    return REPO_ROOT / "data" / "interim"


def load_config(path: Path | None = None) -> Config:
    """Read config.yaml (default pipeline/config.yaml) and validate every field."""
    path = REPO_ROOT / "pipeline" / "config.yaml" if path is None else Path(path)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    _mapping(raw, "config.yaml")
    _only_keys(raw, _TOP_KEYS, "config.yaml", required=_TOP_KEYS)

    states_raw = _mapping(raw["states"], "states")
    states = {postal: _state(postal, value) for postal, value in states_raw.items()}
    at_large_raw = _mapping(raw["at_large"], "at_large")
    at_large = {postal: _at_large(postal, value) for postal, value in at_large_raw.items()}

    both = sorted(set(states) & set(at_large))
    if both:
        raise ConfigError(f"states and at_large both list {both}")
    fips = [s.fips for s in states.values()] + [s.fips for s in at_large.values()]
    dupes = sorted({f for f in fips if fips.count(f) > 1})
    if dupes:
        raise ConfigError(f"fips used more than once: {dupes}")

    return Config(
        status_checked=_date(raw["status_checked"], "status_checked"),
        census_vest_commit=_commit(raw["census_vest_commit"]),
        ensemble=_ensemble(raw["ensemble"], states),
        align_to_alarm=_align(raw["align_to_alarm"], states),
        sources=_sources(raw["sources"]),
        states=states,
        at_large=at_large,
    )


# --- helpers ---------------------------------------------------------------

def _mapping(value: Any, where: str) -> dict:
    if not isinstance(value, dict):
        raise ConfigError(f"{where}: expected a mapping, got {type(value).__name__}")
    return value


def _only_keys(raw: dict, allowed: tuple[str, ...], where: str, required: tuple[str, ...]) -> None:
    unknown = sorted(str(k) for k in raw if k not in allowed)
    if unknown:
        raise ConfigError(f"{where}: unknown keys {unknown}")
    missing = [k for k in required if k not in raw]
    if missing:
        raise ConfigError(f"{where}: missing keys {missing}")


def _text(raw: dict, key: str, where: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{where}.{key}: expected non-empty text, got {value!r}")
    return value


def _choice(raw: dict, key: str, where: str, allowed: tuple[str, ...]) -> str:
    value = _text(raw, key, where)
    if value not in allowed:
        raise ConfigError(f"{where}.{key}: {value!r} is not one of {list(allowed)}")
    return value


def _url(raw: dict, key: str, where: str) -> str:
    value = _text(raw, key, where)
    if not value.startswith("https://"):
        raise ConfigError(f"{where}.{key}: expected an https URL, got {value!r}")
    return value


def _fips(raw: dict, where: str) -> str:
    value = raw.get("fips")
    if not isinstance(value, str) or not re.fullmatch(r"\d{2}", value):
        raise ConfigError(f"{where}.fips: expected two digits as quoted text, got {value!r}")
    return value


def _postal(postal: Any, where: str) -> str:
    if not isinstance(postal, str) or not _POSTAL.fullmatch(postal):
        raise ConfigError(f"{where}: {postal!r} is not a two-letter postal code")
    return postal


def _int(value: Any, where: str, minimum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ConfigError(f"{where}: expected an integer of at least {minimum}, got {value!r}")
    return value


def _keys(values: Any, allowed: tuple[str, ...], where: str) -> tuple[str, ...]:
    if values is None:
        return ()
    if not isinstance(values, list):
        raise ConfigError(f"{where}: expected a list, got {values!r}")
    unknown = [v for v in values if v not in allowed]
    if unknown:
        raise ConfigError(f"{where}: unknown note keys {unknown}")
    if len(set(values)) != len(values):
        raise ConfigError(f"{where}: a note key appears twice in {values}")
    return tuple(values)


def _date(value: Any, where: str) -> date:
    if isinstance(value, datetime) or not isinstance(value, date):
        raise ConfigError(f"{where}: expected a date like 2026-10-03, got {value!r}")
    return value


def _commit(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ConfigError(f"census_vest_commit: expected a 40-character commit hash, got {value!r}")
    return value


def _state(postal: Any, raw: Any) -> StateConfig:
    where = f"states.{_postal(postal, 'states')}"
    _mapping(raw, where)
    _only_keys(raw, _STATE_KEYS, where, required=_STATE_REQUIRED)
    elections = raw["elections"]
    if (not isinstance(elections, list) or not elections
            or any(not isinstance(e, str) or not _ELECTION.fullmatch(e) for e in elections)
            or len(set(elections)) != len(elections)):
        raise ConfigError(f"{where}.elections: expected a list like [pre_16, pre_20], got {elections!r}")
    extra_raw = raw.get("extra_maps") or {}
    _mapping(extra_raw, f"{where}.extra_maps")
    return StateConfig(
        postal=postal,
        name=_text(raw, "name", where),
        fips=_fips(raw, where),
        seats=_int(raw["seats"], f"{where}.seats", 2),
        map_name=_text(raw, "map_name", where),
        status=_choice(raw, "status", where, _STATE_STATUS),
        source_label=_text(raw, "source_label", where),
        source_url=_url(raw, "source_url", where),
        bef=_choice(raw, "bef", where, _BEF),
        elections=tuple(elections),
        unit_source=_choice(raw, "unit_source", where, _UNIT_SOURCES),
        extra_maps=tuple(_extra_map(k, v, f"{where}.extra_maps") for k, v in extra_raw.items()),
        notes=_keys(raw.get("notes"), STATE_NOTE_KEYS, f"{where}.notes"),
    )


def _extra_map(map_id: Any, raw: Any, where: str) -> ExtraMap:
    if not isinstance(map_id, str) or not re.fullmatch(r"[a-z0-9_]+", map_id) or map_id in _RESERVED_MAP_IDS:
        raise ConfigError(f"{where}: {map_id!r} is not a valid map id")
    where = f"{where}.{map_id}"
    _mapping(raw, where)
    _only_keys(raw, _EXTRA_MAP_KEYS, where, required=_EXTRA_MAP_KEYS)
    return ExtraMap(
        id=map_id,
        name=_text(raw, "name", where),
        status=_choice(raw, "status", where, _EXTRA_MAP_STATUS),
        bef=_choice(raw, "bef", where, _BEF),
        source_label=_text(raw, "source_label", where),
        source_url=_url(raw, "source_url", where),
    )


def _at_large(postal: Any, raw: Any) -> AtLargeState:
    where = f"at_large.{_postal(postal, 'at_large')}"
    _mapping(raw, where)
    _only_keys(raw, ("name", "fips"), where, required=("name", "fips"))
    return AtLargeState(postal=postal, name=_text(raw, "name", where), fips=_fips(raw, where))


def _ensemble(raw: Any, states: dict[str, StateConfig]) -> EnsembleConfig:
    where = "ensemble"
    _mapping(raw, where)
    keys = ("name", "doi", "version", "notes", "fill")
    _only_keys(raw, keys, where, required=keys)
    doi = _text(raw, "doi", where)
    if not doi.startswith("doi:"):
        raise ConfigError(f"ensemble.doi: expected 'doi:...', got {doi!r}")

    notes: dict[str, tuple[str, ...]] = {}
    for postal, values in _mapping(raw["notes"] or {}, "ensemble.notes").items():
        if postal not in states:
            raise ConfigError(f"ensemble.notes: {postal!r} is not in states")
        notes[postal] = _keys(values, ENSEMBLE_NOTE_KEYS, f"ensemble.notes.{postal}")

    fill: dict[str, dict[str, str]] = {}
    for postal, values in _mapping(raw["fill"] or {}, "ensemble.fill").items():
        w = f"ensemble.fill.{postal}"
        _mapping(values, w)
        _only_keys(values, _FILL_KEYS, w, required=_FILL_KEYS)
        fill[postal] = {k: _text(values, k, w) for k in _FILL_KEYS}

    need_fill = {p for p, keys_ in notes.items() if "core_preservation_prior_map" in keys_}
    if need_fill != set(fill):
        raise ConfigError(
            "ensemble.fill must cover exactly the states with core_preservation_prior_map: "
            f"missing {sorted(need_fill - set(fill))}, extra {sorted(set(fill) - need_fill)}"
        )
    return EnsembleConfig(
        name=_text(raw, "name", where),
        doi=doi,
        version=_int(raw["version"], "ensemble.version", 1),
        notes=notes,
        fill=fill,
    )


def _align(raw: Any, states: dict[str, StateConfig]) -> tuple[AlignEntry, ...]:
    if raw is None:
        return ()
    if not isinstance(raw, list):
        raise ConfigError("align_to_alarm: expected a list")
    entries = []
    keys = ("state", "rds", "unit_column", "unit_len", "units")
    for i, item in enumerate(raw):
        where = f"align_to_alarm[{i}]"
        _mapping(item, where)
        _only_keys(item, keys, where, required=keys)
        postal = _text(item, "state", where)
        if postal not in states:
            raise ConfigError(f"{where}.state: {postal!r} is not in states")
        unit_len = _int(item["unit_len"], f"{where}.unit_len", 1)
        units = item["units"]
        if not isinstance(units, list) or not units:
            raise ConfigError(f"{where}.units: expected a non-empty list")
        for unit in units:
            if (not isinstance(unit, str) or len(unit) != unit_len
                    or not unit.startswith(states[postal].fips)):
                raise ConfigError(
                    f"{where}.units: {unit!r} must be quoted text of length {unit_len} "
                    f"starting with {states[postal].fips}"
                )
        entries.append(AlignEntry(
            state=postal,
            rds=_text(item, "rds", where),
            unit_column=_text(item, "unit_column", where),
            unit_len=unit_len,
            units=tuple(units),
        ))
    return tuple(entries)


def _sources(raw: Any) -> dict[str, str]:
    _mapping(raw, "sources")
    _only_keys(raw, _SOURCE_KEYS, "sources", required=_SOURCE_KEYS)
    return {key: _url(raw, key, "sources") for key in _SOURCE_KEYS}
```

- [ ] **Step 4: Draai de tests opnieuw**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py -v`

Expected: `30 passed`.

- [ ] **Step 5: Voeg de tests voor het echte bestand toe (tweede deel van `tests/test_config.py`)**

Plak dit onder het eerste deel. De verwachte staatslijsten komen uit de notentabel in hoofdstuk 5 van de spec.

```python
# --- the real pipeline/config.yaml ------------------------------------------

AT_LARGE = {"AK", "DE", "ND", "SD", "VT", "WY"}
BLOCK_STATES = {"CA", "HI", "ME", "OR"}
# Spec chapter 5, notes table: which states get which note.
ENSEMBLE_NOTES = {
    "vra_constraint": {"AL", "AZ", "CA", "FL", "GA", "LA", "MI", "MO", "MS", "NC", "OH", "RI", "SC", "TX", "WA"},
    "core_preservation_prior_map": {"LA", "NM", "UT"},
    "core_preservation_2010": {"KS", "NE"},
    "competitiveness_rule": {"AZ", "CO"},
    "vra_filter_with_votes": {"AL", "SC"},
    "vra_filter_bvap": {"MO"},
    "alarm_rerun_unpublished": {"AL", "CO", "KS", "MI", "MS", "NC", "NY", "OH", "PA", "SC", "WA"},
    "alarm_method_update_pending": {"CA", "FL", "TX"},
}
STATE_NOTES = {
    "adopted_after_2024_election": {"CA", "FL", "LA", "NC", "OH", "TN", "TX", "UT"},
    "composite_2020_only": {"WV"},
    "blocked_map": {"MO"},
}


@pytest.fixture(scope="module")
def cfg():
    return load_config()


def test_real_config_has_44_states_with_429_seats(cfg):
    assert len(cfg.states) == 44
    assert sum(s.seats for s in cfg.states.values()) == 429
    assert all(postal == s.postal for postal, s in cfg.states.items())


def test_real_config_has_six_at_large_states(cfg):
    assert set(cfg.at_large) == AT_LARGE


def test_real_config_status_values(cfg):
    assert {s.status for s in cfg.states.values()} <= {"In effect", "Challenged"}
    extra = [m for s in cfg.states.values() for m in s.extra_maps]
    assert [(m.id, m.status, m.bef) for m in extra] == [("mo_hb1", "Blocked", "cd120")]


def test_real_config_ensemble_notes_match_spec(cfg):
    for key, expected in ENSEMBLE_NOTES.items():
        got = {postal for postal, keys in cfg.ensemble.notes.items() if key in keys}
        assert got == expected, key
    assert {k for keys in cfg.ensemble.notes.values() for k in keys} <= set(ENSEMBLE_NOTE_KEYS)


def test_real_config_state_notes_match_spec(cfg):
    for key, expected in STATE_NOTES.items():
        assert {p for p, s in cfg.states.items() if key in s.notes} == expected, key
    assert {k for s in cfg.states.values() for k in s.notes} <= set(STATE_NOTE_KEYS)


def test_real_config_fill_for_core_preservation(cfg):
    assert set(cfg.ensemble.fill) == ENSEMBLE_NOTES["core_preservation_prior_map"]
    assert cfg.ensemble.fill["NM"]["reference_map"] == "the 2021 map"


def test_real_config_bef_and_unit_source(cfg):
    assert {p for p, s in cfg.states.items() if s.bef == "cd118"} == {"MO"}
    assert {s.bef for s in cfg.states.values()} == {"cd120", "cd118"}
    assert {p for p, s in cfg.states.items() if s.unit_source == "block"} == BLOCK_STATES
    assert {p for p, s in cfg.states.items() if s.unit_source == "rds_county"} == {"WV"}
    vtd = {p for p, s in cfg.states.items() if s.unit_source == "vtd"}
    assert len(vtd) == 39 and "IA" in vtd


def test_real_config_elections(cfg):
    assert cfg.states["WV"].elections == ("pre_20",)
    others = {s.elections for p, s in cfg.states.items() if p != "WV"}
    assert others == {("pre_16", "pre_20")}


def test_real_config_globals(cfg):
    assert cfg.status_checked >= date(2026, 10, 3)  # moves forward with every status re-check
    assert cfg.ensemble.name == "alarm_v15" and cfg.ensemble.version == 15
    assert [(a.state, a.unit_column, a.units) for a in cfg.align_to_alarm] == [
        ("CA", "tract", ("06049000300", "06093000200"))]
```

- [ ] **Step 6: Draai de tests en zie de nieuwe falen**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py -v`

Expected: `30 passed, 9 errors`. De negen nieuwe tests geven `FileNotFoundError` op `pipeline\config.yaml`.

- [ ] **Step 7: Schrijf `pipeline/config.yaml`**

Bronnen per veld:

- `name`, `fips`: Census.
- `seats`, `map_name` (precies de linktekst), `status`, `source_url` (precies de link-URL) en `bef` (kolom "Pipeline file", in kleine letters): `data/sources.md`.
- `source_label`: de uitgever van de link, zichtbaar op de site. Voor de ArcGIS-links is de uitgever op 5 oktober 2026 opgezocht in de metadata van de dienst: IA (Iowa Legislative Services Agency), ME (Maine Office of GIS), NV (Nevada Legislative Counsel Bureau), OK (Oklahoma House of Representatives), RI (Rhode Island Department of State).
- `unit_source`: `block` voor CA, HI, ME en OR, `rds_county` voor WV, anders `vtd` (ook IA).
- `elections`: `[pre_16, pre_20]`, West Virginia `[pre_20]`.
- `notes` per staat en `ensemble.notes` en `ensemble.fill`: de notentabel en de tabel met invulwaarden in hoofdstuk 5 van de spec.
- `align_to_alarm`: hoofdstuk 3 en 4 van de spec. De kolom in `CA_cd_2020_map.rds` heet `tract`.

```yaml
# Pipeline settings. Schema: "Interfaces" in docs/superpowers/plans/2026-10-05-gerrymandering-map.md.
# map_name, status, seats, bef and source_url must match data/sources.md
# (checked by gerry.checks.check_sources_md).

status_checked: 2026-10-03
census_vest_commit: 243c8a8134ecf8151777a9388c48323e274767e2

ensemble:
  name: alarm_v15
  doi: doi:10.7910/DVN/SLCD3E
  version: 15
  # Notes that belong to this ensemble set (spec chapter 5, notes table).
  notes:
    AL: [vra_constraint, vra_filter_with_votes, alarm_rerun_unpublished]
    AZ: [vra_constraint, competitiveness_rule]
    CA: [vra_constraint, alarm_method_update_pending]
    CO: [competitiveness_rule, alarm_rerun_unpublished]
    FL: [vra_constraint, alarm_method_update_pending]
    GA: [vra_constraint]
    KS: [core_preservation_2010, alarm_rerun_unpublished]
    LA: [vra_constraint, core_preservation_prior_map]
    MI: [vra_constraint, alarm_rerun_unpublished]
    MO: [vra_constraint, vra_filter_bvap]
    MS: [vra_constraint, alarm_rerun_unpublished]
    NC: [vra_constraint, alarm_rerun_unpublished]
    NE: [core_preservation_2010]
    NM: [core_preservation_prior_map]
    NY: [alarm_rerun_unpublished]
    OH: [vra_constraint, alarm_rerun_unpublished]
    PA: [alarm_rerun_unpublished]
    RI: [vra_constraint]
    SC: [vra_constraint, vra_filter_with_votes, alarm_rerun_unpublished]
    TX: [vra_constraint, alarm_method_update_pending]
    UT: [core_preservation_prior_map]
    WA: [vra_constraint, alarm_rerun_unpublished]
  # Fill values for core_preservation_prior_map.
  fill:
    NM:
      reference_map: "the 2021 map"
      consequence: "The current map is that 2021 map, so the drawing effect shown here is probably closer to zero than it should be."
    LA:
      reference_map: "the 2022 map"
      consequence: "The current map, adopted in 2026, largely follows the 2022 lines, so the drawing effect shown here is probably closer to zero than it should be."
    UT:
      reference_map: "the legislature's 2021 map"
      consequence: "A court replaced that map in 2025 with the current map. We cannot say in which direction this rule shifts the drawing effect shown here."

# Units whose votes in the unit file differ from the data ALARM summed for the
# ensembles. units.py scales the block votes in these tracts to ALARM's totals.
align_to_alarm:
  - state: CA
    rds: alarm/CA_cd_2020_map.rds
    unit_column: tract
    unit_len: 11
    units: ["06049000300", "06093000200"]

sources:
  dataverse_api: https://dataverse.harvard.edu/api
  cd118: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2023/118-congressional-district-bef/cd118.zip
  cd120: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip
  pl94171: https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/{folder}/{st}2020.pl.zip
  census_vest: https://raw.githubusercontent.com/alarm-redist/census-2020/{commit}/census-vest-2020/{st}_2020_{kind}.csv
  tiger_gpkg: https://www2.census.gov/geo/tiger/TGRGPKG26/tlgpkg_2026_us_legislative.gpkg.zip
  tiger_mo_cd119: https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip
  cb_states: https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip

states:
  AL:
    name: Alabama
    fips: "01"
    seats: 7
    map_name: "Livingston Congressional Plan 3-2023"
    status: Challenged
    source_label: "Alabama Secretary of State"
    source_url: https://www.sos.alabama.gov/sites/default/files/2026-5-14/Livingston%20Congressional%20Plan%203-2023%20Legal%20Description.pdf
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  AZ:
    name: Arizona
    fips: "04"
    seats: 9
    map_name: "Independent Redistricting Commission map v14.0"
    status: In effect
    source_label: "Arizona Independent Redistricting Commission"
    source_url: https://redistricting-irc-az.hub.arcgis.com/pages/official-maps
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  AR:
    name: Arkansas
    fips: "05"
    seats: 4
    map_name: "Acts 1114 and 1116 of 2021"
    status: In effect
    source_label: "Arkansas GIS Office"
    source_url: https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Boundaries/FeatureServer/6
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  CA:
    name: California
    fips: "06"
    seats: 52
    map_name: "AB 604 (Proposition 50)"
    status: Challenged
    source_label: "California State Assembly Elections Committee"
    source_url: https://aelc.assembly.ca.gov/proposed-congressional-map
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: block
    notes: [adopted_after_2024_election]
  CO:
    name: Colorado
    fips: "08"
    seats: 8
    map_name: "Independent Congressional Redistricting Commission plan"
    status: In effect
    source_label: "Colorado Independent Redistricting Commissions"
    source_url: https://redistricting.colorado.gov/content/congressional-final-approved
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  CT:
    name: Connecticut
    fips: "09"
    seats: 5
    map_name: "Special master plan"
    status: In effect
    source_label: "Connecticut General Assembly"
    source_url: https://www.cga.ct.gov/rr/tfs/20210401_2021%20Redistricting%20Project/cmaps.asp
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  FL:
    name: Florida
    fips: "12"
    seats: 28
    map_name: "EOGPCRP2026 (HB 1-D)"
    status: Challenged
    source_label: "Florida Senate"
    source_url: https://www.flsenate.gov/Session/Redistricting/Congressional
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  GA:
    name: Georgia
    fips: "13"
    seats: 14
    map_name: "December 2023 remedial plan (SB 3EX)"
    status: Challenged
    source_label: "Georgia Legislative and Congressional Reapportionment Office"
    source_url: https://www.legis.ga.gov/joint-office/reapportionment
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  HI:
    name: Hawaii
    fips: "15"
    seats: 2
    map_name: "Reapportionment Commission plan"
    status: In effect
    source_label: "Hawaii Office of Elections"
    source_url: https://elections.hawaii.gov/about-us/boards-and-commissions/reapportionment/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: block
  ID:
    name: Idaho
    fips: "16"
    seats: 2
    map_name: "Commission for Reapportionment plan"
    status: In effect
    source_label: "Idaho Legislature"
    source_url: https://legislature.idaho.gov/redistricting/2021/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  IL:
    name: Illinois
    fips: "17"
    seats: 17
    map_name: "HB 1291 of 2021"
    status: Challenged
    source_label: "Redistricting Data Hub"
    source_url: https://redistrictingdatahub.org/dataset/2021-illinois-congressional-districts-approved-plan/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  IN:
    name: Indiana
    fips: "18"
    seats: 9
    map_name: "HEA 1581 of 2021"
    status: In effect
    source_label: "Indiana Geographic Information Office"
    source_url: https://gisdata.in.gov/server/rest/services/Hosted/Congressional_Districts_of_Indiana_Current/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  IA:
    name: Iowa
    fips: "19"
    seats: 4
    map_name: "SF 621, LSA Plan 2"
    status: In effect
    source_label: "Iowa Legislative Services Agency"
    source_url: https://services2.arcgis.com/KhKjlwEBlPJd6v51/arcgis/rest/services/RedistrictingPlan2/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  KS:
    name: Kansas
    fips: "20"
    seats: 4
    map_name: "SB 355, Ad Astra 2"
    status: In effect
    source_label: "Kansas Legislative Research Department"
    source_url: https://klrd.gov/redistricting/enacted-plans-2022/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  KY:
    name: Kentucky
    fips: "21"
    seats: 6
    map_name: "SB 3 of 2022"
    status: In effect
    source_label: "Kentucky General Assembly"
    source_url: https://apps.legislature.ky.gov/record/22RS/sb3.html
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  LA:
    name: Louisiana
    fips: "22"
    seats: 6
    map_name: "SB 121 of 2026 (Act 2)"
    status: Challenged
    source_label: "Louisiana Legislature"
    source_url: https://redist.legis.la.gov/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  ME:
    name: Maine
    fips: "23"
    seats: 2
    map_name: "LD 1739 of 2021"
    status: In effect
    source_label: "Maine Office of GIS"
    source_url: https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/MaineVotingDistricts2021USCongress/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: block
  MD:
    name: Maryland
    fips: "24"
    seats: 8
    map_name: "SB 1012 of 2022"
    status: In effect
    source_label: "Redistricting Data Hub"
    source_url: https://redistrictingdatahub.org/dataset/2021-maryland-us-congressional-adopted-plan/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  MA:
    name: Massachusetts
    fips: "25"
    seats: 9
    map_name: "Chapter 93 of the Acts of 2021"
    status: In effect
    source_label: "MassGIS"
    source_url: https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/Congress118/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  MI:
    name: Michigan
    fips: "26"
    seats: 13
    map_name: "Independent Citizens Redistricting Commission, Chestnut plan"
    status: In effect
    source_label: "State of Michigan GIS Open Data"
    source_url: https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/michigan_geographic_framework/MapServer/23
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  MN:
    name: Minnesota
    fips: "27"
    seats: 8
    map_name: "Court plan C2022 with the 2022 CD7/CD8 fix"
    status: In effect
    source_label: "Minnesota Legislative Coordinating Commission"
    source_url: https://gis.lcc.mn.gov/redist2020/cong20.php?plname=C2022&pltype=court
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  MS:
    name: Mississippi
    fips: "28"
    seats: 4
    map_name: "HB 384 of 2022"
    status: In effect
    source_label: "Redistricting Data Hub"
    source_url: https://redistrictingdatahub.org/dataset/2022-mississippi-congressional-districts-approved-plan/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  MO:
    name: Missouri
    fips: "29"
    seats: 8
    map_name: "HB 2909 of 2022"
    status: In effect
    source_label: "Redistricting Data Hub"
    source_url: https://redistrictingdatahub.org/dataset/2022-missouri-congressional-districts-approved-plan/
    bef: cd118
    elections: [pre_16, pre_20]
    unit_source: vtd
    extra_maps:
      mo_hb1:
        name: "HB 1 of 2025"
        status: Blocked
        bef: cd120
        source_label: "Redistricting Data Hub"
        source_url: https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/
    notes: [blocked_map]
  MT:
    name: Montana
    fips: "30"
    seats: 2
    map_name: "Districting and Apportionment Commission plan"
    status: In effect
    source_label: "Montana Districting and Apportionment Commission"
    source_url: https://mtredistricting.gov/congressional-maps/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NE:
    name: Nebraska
    fips: "31"
    seats: 3
    map_name: "LB 1 of 2021"
    status: In effect
    source_label: "State of Nebraska GIS"
    source_url: https://gis.ne.gov/Enterprise/rest/services/PoliticalBoundaries_2021/FeatureServer/1
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NV:
    name: Nevada
    fips: "32"
    seats: 4
    map_name: "SB 1 of 2021"
    status: In effect
    source_label: "Nevada Legislative Counsel Bureau"
    source_url: https://services9.arcgis.com/UU5yXg9PV67U0ebq/arcgis/rest/services/2021Congressional_Final_SB1_Amd2/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NH:
    name: New Hampshire
    fips: "33"
    seats: 2
    map_name: "Special master plan"
    status: In effect
    source_label: "NH GRANIT"
    source_url: https://ftp.granit.unh.edu/GRANIT_Data/Vector_Data/Administrative_and_Political_Boundaries/d-congressional/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NJ:
    name: New Jersey
    fips: "34"
    seats: 12
    map_name: "Congressional Redistricting Commission plan"
    status: In effect
    source_label: "New Jersey Office of GIS"
    source_url: https://njogis-newjersey.opendata.arcgis.com/datasets/2d5a9cbb86da4519899ff56e4d094f4c_1/about
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NM:
    name: New Mexico
    fips: "35"
    seats: 3
    map_name: "SB 1 of 2021"
    status: In effect
    source_label: "New Mexico Legislature"
    source_url: https://www.nmlegis.gov/Redistricting2021/Maps_And_Data
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NY:
    name: New York
    fips: "36"
    seats: 26
    map_name: "2024 plan"
    status: In effect
    source_label: "New York Legislative Task Force on Demographic Research and Reapportionment"
    source_url: https://latfor.state.ny.us/maps/?sec=2024_congress
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  NC:
    name: North Carolina
    fips: "37"
    seats: 14
    map_name: "SL 2025-95 (SB 249)"
    status: Challenged
    source_label: "North Carolina General Assembly"
    source_url: https://webservices.ncleg.gov/ViewBillDocument/2025/7669/0/SL%202025-95%20-%20Block%20Assignment%20File
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  OH:
    name: Ohio
    fips: "39"
    seats: 15
    map_name: "Ohio Redistricting Commission plan"
    status: In effect
    source_label: "Ohio Secretary of State"
    source_url: https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  OK:
    name: Oklahoma
    fips: "40"
    seats: 5
    map_name: "HB 1002X of 2021"
    status: In effect
    source_label: "Oklahoma House of Representatives"
    source_url: https://www.arcgis.com/home/item.html?id=7aeb90448393499c8367cd426ff511d1
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  OR:
    name: Oregon
    fips: "41"
    seats: 6
    map_name: "SB 881 of 2021"
    status: In effect
    source_label: "Oregon GEOHub"
    source_url: https://geohub.oregon.gov/datasets/oregon-geo::congressional-districts
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: block
  PA:
    name: Pennsylvania
    fips: "42"
    seats: 17
    map_name: "Carter plan"
    status: In effect
    source_label: "Pennsylvania Legislative Reapportionment Commission"
    source_url: https://www.redistricting.state.pa.us/maps/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  RI:
    name: Rhode Island
    fips: "44"
    seats: 2
    map_name: "S 2162 / H 7323 of 2022"
    status: In effect
    source_label: "Rhode Island Department of State"
    source_url: https://services3.arcgis.com/KZcv0G0UvX0bPG3L/arcgis/rest/services/RI_Congressional_Districts_as_of_2022_/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  SC:
    name: South Carolina
    fips: "45"
    seats: 7
    map_name: "S. 865 of 2022"
    status: In effect
    source_label: "South Carolina Senate"
    source_url: https://redistricting.scsenate.gov/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  TN:
    name: Tennessee
    fips: "47"
    seats: 9
    map_name: "HB 7003 / SB 7004 of 2026"
    status: Challenged
    source_label: "Tennessee Comptroller of the Treasury"
    source_url: https://comptroller.tn.gov/maps/u-s--congress-districts.html
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  TX:
    name: Texas
    fips: "48"
    seats: 38
    map_name: "PLANC2333 (HB 4)"
    status: Challenged
    source_label: "Texas Legislative Council"
    source_url: https://data.capitol.texas.gov/dataset/planc2333
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  UT:
    name: Utah
    fips: "49"
    seats: 4
    map_name: "Court-adopted Map 1"
    status: Challenged
    source_label: "Utah Geospatial Resource Center"
    source_url: https://gis.utah.gov/products/sgid/political/us-congressional-districts/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
    notes: [adopted_after_2024_election]
  VA:
    name: Virginia
    fips: "51"
    seats: 11
    map_name: "2021 Supreme Court of Virginia plan"
    status: In effect
    source_label: "Virginia Division of Legislative Services"
    source_url: https://www.virginiaredistricting.org/
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  WA:
    name: Washington
    fips: "53"
    seats: 10
    map_name: "Redistricting Commission plan as amended"
    status: In effect
    source_label: "Washington State Redistricting Commission"
    source_url: https://www.redistricting.wa.gov/district-maps-handouts.html
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd
  WV:
    name: West Virginia
    fips: "54"
    seats: 2
    map_name: "SB 3033 of 2021"
    status: In effect
    source_label: "West Virginia Legislature"
    source_url: https://www.wvlegislature.gov/redistricting.cfm
    bef: cd120
    elections: [pre_20]
    unit_source: rds_county
    notes: [composite_2020_only]
  WI:
    name: Wisconsin
    fips: "55"
    seats: 8
    map_name: "Least-change plan, Johnson v. WEC"
    status: Challenged
    source_label: "Wisconsin Legislative Technology Services Bureau"
    source_url: https://gis-ltsb.hub.arcgis.com/datasets/e0c6f0979bc04c56b346042e34497f9e_0/about
    bef: cd120
    elections: [pre_16, pre_20]
    unit_source: vtd

at_large:
  AK: {name: Alaska, fips: "02"}
  DE: {name: Delaware, fips: "10"}
  ND: {name: North Dakota, fips: "38"}
  SD: {name: South Dakota, fips: "46"}
  VT: {name: Vermont, fips: "50"}
  WY: {name: Wyoming, fips: "56"}
```

- [ ] **Step 8: Draai de tests opnieuw**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py -v`

Expected: `39 passed`.

- [ ] **Step 9: Draai alle Python-tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest`

Expected: `55 passed`.

- [ ] **Step 10: Commit**

```powershell
git add pipeline/config.yaml pipeline/gerry/config.py tests/test_config.py
git commit -m "Add pipeline config for all states with validating loader"
```

### Task 0.5: checks.py, eerste deel: de lezer van sources.md

**Files:**
- Create: `pipeline/gerry/checks.py`
- Create: `tests/test_checks_sources.py`

**Interfaces:**
- Consumes: `Config`, `StateConfig`, `ExtraMap`, `load_config()` en `REPO_ROOT` uit `gerry/config.py` (Task 0.4); `data/sources.md` (in git).
- Produces:
  - `class CheckError(RuntimeError)` met `__init__(self, check: str, state: str, detail: str)`. Attributen `.check`, `.state`, `.detail`. Bericht: `"{check} failed for {state}: {detail}"`. `state` is `"US"` als de controle niet over één staat gaat (zoals de datumregel en de opbouw van `sources.md`), en postcodes gescheiden door komma's (`"AL,MO"`) als het er meer zijn. Latere taken voegen hun controles toe aan dit bestand en gebruiken dezelfde klasse.
  - `parse_sources_md(path: Path) -> dict`: `{"status_checked": date, "multi": {ST: row}, "blocked": {ST: [row, ...]}, "at_large": {ST: row}}`. Een row is `{"map_name": str, "url": str | None, "status": str, "pipeline_file": str}`, in `multi` en `at_large` plus `"seats": int`. `url` is `None` als de kaartcel geen link heeft.
  - `check_sources_md(cfg: Config, path: Path) -> None`: gooit `CheckError("sources_md", ...)` met alle verschillen in één melding.

Regels uit hoofdstuk 6 van de spec, zo uitgewerkt:

- Alleen de eerste tabel onder de koppen `## Multi-seat states`, `## Blocked maps` en `## At-large states` telt. Alle andere tabellen negeert de lezer.
- Kolommen op kopnaam: `State`, `Seats` (niet in "Blocked maps"), `Status`, `Pipeline file`, en precies één kolom die `Map` heet of met `Map ` begint ("Map for Nov 3, 2026").
- Kaartnaam is de linktekst als de cel precies één link is, anders de celtekst. Een cel met een link plus andere tekst is een fout.
- "De datum in de eerste regel": regel 1 is de titel, dus de lezer neemt de eerste tekstregel onder de titel. Die moet beginnen met `Status checked on YYYY-MM-DD`.
- Vergeleken per rij, exact: `seats` met `StateConfig.seats`, `map_name` met `map_name`, `url` met `source_url`, `status` met `status`, `pipeline_file` met `bef.upper()`.
- Rijen onder "Blocked maps" horen bij `extra_maps` van die staat, gekoppeld op kaartnaam (`ExtraMap.name`). Ze vergelijken `map_name`, `url`, `status` en `pipeline_file` (`ExtraMap.bef.upper()`).
- At-large rijen moeten precies zijn: Seats `1`, kaart `At large` zonder link, Status `At-large`, Pipeline file `CD120`. De postcodes moeten gelijk zijn aan `cfg.at_large`.

- [ ] **Step 1: Schrijf de tests `tests/test_checks_sources.py`**

De tests lezen het echte `data/sources.md` en schrijven gewijzigde kopieën naar `tmp_path`. `change_cell()` wijzigt één cel, gevonden op tabel, staat en kolomnaam. De tests hangen dus niet af van de huidige statussen of de huidige datum en blijven werken na de statuscontrole vlak voor publicatie (Task 4.4).

```python
"""Tests for CheckError and the data/sources.md reader in gerry.checks.

The tests read the real data/sources.md and change one cell at a time in a copy.
They do not depend on the current statuses or date, so they keep working after
a status re-check.
"""
import re
from datetime import date, timedelta
from pathlib import Path

import pytest

from gerry.checks import CheckError, check_sources_md, parse_sources_md
from gerry.config import REPO_ROOT, load_config

SOURCES_MD = REPO_ROOT / "data" / "sources.md"


def real_text() -> str:
    return SOURCES_MD.read_text(encoding="utf-8")


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "sources.md"
    path.write_text(text, encoding="utf-8")
    return path


def split(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def table_start(lines: list[str], heading: str) -> int:
    """Index of the header row of the first table under '## heading'."""
    i = lines.index(f"## {heading}") + 1
    while not lines[i].startswith("|"):
        i += 1
    return i


def change_cell(text: str, heading: str, postal: str, column: str, change) -> str:
    """Apply change(old_cell) -> new_cell to one cell. column 'Map' matches 'Map...'."""
    lines = text.splitlines()
    i = table_start(lines, heading)
    header = split(lines[i])
    col = next(k for k, h in enumerate(header) if h == column or (column == "Map" and h.startswith("Map")))
    for j in range(i + 2, len(lines)):
        if not lines[j].startswith("|"):
            break
        cells = split(lines[j])
        if cells[header.index("State")] == postal:
            cells[col] = change(cells[col])
            lines[j] = "| " + " | ".join(cells) + " |"
            return "\n".join(lines) + "\n"
    raise AssertionError(f"no row for {postal} under {heading}")


def swap_columns(text: str, heading: str, a: str, b: str) -> str:
    """Swap two columns of the first table under '## heading', header and rows."""
    lines = text.splitlines()
    i = table_start(lines, heading)
    header = split(lines[i])
    ia, ib = header.index(a), header.index(b)
    while i < len(lines) and lines[i].startswith("|"):
        cells = split(lines[i])
        cells[ia], cells[ib] = cells[ib], cells[ia]
        lines[i] = "| " + " | ".join(cells) + " |"
        i += 1
    return "\n".join(lines) + "\n"


def test_check_error_carries_its_parts():
    err = CheckError("vap", "NV", "block VAP 10 differs from unit VAP 11")
    assert (err.check, err.state, err.detail) == ("vap", "NV", "block VAP 10 differs from unit VAP 11")
    assert str(err) == "vap failed for NV: block VAP 10 differs from unit VAP 11"
    assert isinstance(err, RuntimeError)


def test_parse_real_sources_md():
    parsed = parse_sources_md(SOURCES_MD)
    assert parsed["status_checked"] >= date(2026, 10, 3)
    assert len(parsed["multi"]) == 44
    assert sum(row["seats"] for row in parsed["multi"].values()) == 429
    tx = parsed["multi"]["TX"]
    assert tx["seats"] == 38
    assert tx["map_name"] == "PLANC2333 (HB 4)"
    assert tx["url"] == "https://data.capitol.texas.gov/dataset/planc2333"
    assert tx["pipeline_file"] == "CD120"
    assert tx["status"] in {"In effect", "Challenged"}
    assert parsed["multi"]["MO"]["pipeline_file"] == "CD118"
    [hb1] = parsed["blocked"]["MO"]
    assert hb1["map_name"] == "HB 1 of 2025"
    assert hb1["url"] == "https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/"
    assert set(parsed["blocked"]) == {"MO"}
    assert set(parsed["at_large"]) == {"AK", "DE", "ND", "SD", "VT", "WY"}
    assert parsed["at_large"]["VT"] == {
        "seats": 1, "map_name": "At large", "url": None, "status": "At-large", "pipeline_file": "CD120",
    }


def test_real_sources_md_matches_real_config():
    check_sources_md(load_config(), SOURCES_MD)


def test_columns_are_found_by_header_name(tmp_path):
    text = swap_columns(real_text(), "Multi-seat states", "Status", "Pipeline file")
    assert "| Pipeline file | Status |" in text
    check_sources_md(load_config(), write(tmp_path, text))


def test_tables_under_other_headings_are_ignored(tmp_path):
    text = real_text() + (
        "\n## Notes per state\n\n| State | Seats | Map | Status | Pipeline file |\n"
        "|---|---|---|---|---|\n| XX | 9 | Some map | Blocked | CD118 |\n"
    )
    parsed = parse_sources_md(write(tmp_path, text))
    assert "XX" not in parsed["multi"] and "XX" not in parsed["blocked"] and "XX" not in parsed["at_large"]
    check_sources_md(load_config(), write(tmp_path, text))


def other_status(value: str) -> str:
    return "Challenged" if value == "In effect" else "In effect"


MISMATCHES = [
    # (table heading, state, column, change to the cell, state in the error, words in the detail)
    ("Multi-seat states", "MO", "Status", other_status, "MO", "status"),
    ("Multi-seat states", "NV", "Seats", lambda v: str(int(v) + 1), "NV", "seats"),
    ("Multi-seat states", "MO", "Pipeline file", lambda v: "CD120" if v == "CD118" else "CD118",
     "MO", "pipeline_file"),
    ("Multi-seat states", "AL", "Map", lambda v: v.replace("](", " changed](", 1), "AL", "map_name"),
    ("Multi-seat states", "TX", "Map", lambda v: v[:-1] + "x)", "TX", "url"),
    ("Blocked maps", "MO", "Status", lambda v: "In effect", "MO", "status"),
    ("Blocked maps", "MO", "Map", lambda v: v.replace("](", " changed](", 1), "MO", "extra_maps"),
    ("At-large states", "VT", "Status", lambda v: "In effect", "VT", "status"),
]


@pytest.mark.parametrize("heading, postal, column, change, state, words", MISMATCHES)
def test_mismatch_raises(tmp_path, heading, postal, column, change, state, words):
    text = change_cell(real_text(), heading, postal, column, change)
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text))
    assert info.value.check == "sources_md"
    assert info.value.state == state
    assert words in info.value.detail


def test_date_mismatch_raises(tmp_path):
    text = real_text()
    found = re.search(r"Status checked on (\d{4}-\d{2}-\d{2})", text)
    later = (date.fromisoformat(found.group(1)) + timedelta(days=1)).isoformat()
    text = text.replace(found.group(0), f"Status checked on {later}", 1)
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text))
    assert info.value.state == "US"
    assert later in info.value.detail


def test_missing_row_raises(tmp_path):
    text = real_text()
    ks_line = next(line for line in text.splitlines(keepends=True) if line.startswith("| KS |"))
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text.replace(ks_line, "")))
    assert info.value.state == "KS"
    assert "no row" in info.value.detail


def test_missing_heading_raises(tmp_path):
    text = real_text().replace("## Blocked maps", "## Blocked plans")
    with pytest.raises(CheckError, match="Blocked maps"):
        parse_sources_md(write(tmp_path, text))


def test_map_cell_with_link_and_text_raises(tmp_path):
    text = change_cell(real_text(), "Multi-seat states", "NM", "Map", lambda v: v + " and amendments")
    with pytest.raises(CheckError) as info:
        parse_sources_md(write(tmp_path, text))
    assert info.value.state == "NM"
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py -v`

Expected: fout bij het verzamelen: `ModuleNotFoundError: No module named 'gerry.checks'`.

- [ ] **Step 3: Schrijf `pipeline/gerry/checks.py`**

```python
"""Pipeline checks. Every failed check raises CheckError naming the check, the state and the values."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from gerry.config import Config


class CheckError(RuntimeError):
    """A pipeline check failed. The pipeline stops; the message names check, state and values."""

    def __init__(self, check: str, state: str, detail: str):
        self.check = check
        self.state = state
        self.detail = detail
        super().__init__(f"{check} failed for {state}: {detail}")


# --- data/sources.md ---------------------------------------------------------

_SECTIONS = {"multi": "Multi-seat states", "blocked": "Blocked maps", "at_large": "At-large states"}
_DATE_LINE = re.compile(r"Status checked on (\d{4}-\d{2}-\d{2})\b")
_LINK = re.compile(r"\[([^\]]+)\]\(([^()\s]+)\)")
_AT_LARGE_ROW = {"seats": 1, "map_name": "At large", "url": None, "status": "At-large", "pipeline_file": "CD120"}


def parse_sources_md(path: Path) -> dict:
    """Read the date line and the three status tables of data/sources.md.

    Returns {"status_checked": date, "multi": {ST: row}, "blocked": {ST: [row, ...]},
    "at_large": {ST: row}}. A row is {"map_name", "url", "status", "pipeline_file"}
    plus "seats" (int) in "multi" and "at_large". "url" is None when the map cell has no link.
    """
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    body = [line for line in lines if line.strip() and not line.startswith("#")]
    match = _DATE_LINE.match(body[0]) if body else None
    if match is None:
        raise CheckError("sources_md", "US", "the first line under the title does not start with "
                         "'Status checked on YYYY-MM-DD'")
    parsed: dict = {"status_checked": date.fromisoformat(match.group(1))}
    for key, heading in _SECTIONS.items():
        header, cells = _table(lines, heading)
        rows = [_row(header, raw, heading, with_seats=key != "blocked") for raw in cells]
        if key == "blocked":
            grouped: dict[str, list[dict]] = {}
            for postal, row in rows:
                grouped.setdefault(postal, []).append(row)
            parsed[key] = grouped
        else:
            seen: dict[str, dict] = {}
            for postal, row in rows:
                if postal in seen:
                    raise CheckError("sources_md", postal, f"two rows under '{heading}'")
                seen[postal] = row
            parsed[key] = seen
    return parsed


def check_sources_md(cfg: Config, path: Path) -> None:
    """config.yaml and data/sources.md must agree on every compared field (spec chapter 6)."""
    parsed = parse_sources_md(path)
    problems: list[tuple[str, str]] = []

    if parsed["status_checked"] != cfg.status_checked:
        problems.append(("US", f"sources.md says status checked on {parsed['status_checked']}, "
                               f"config.yaml status_checked is {cfg.status_checked}"))

    multi = parsed["multi"]
    for postal in sorted(set(cfg.states) | set(multi)):
        if postal not in cfg.states:
            problems.append((postal, "row under 'Multi-seat states' but not in config.yaml states"))
        elif postal not in multi:
            problems.append((postal, "in config.yaml states but no row under 'Multi-seat states'"))
        else:
            st = cfg.states[postal]
            expected = {"seats": st.seats, "map_name": st.map_name, "url": st.source_url,
                        "status": st.status, "pipeline_file": st.bef.upper()}
            problems += _compare(postal, multi[postal], expected)

    blocked = parsed["blocked"]
    for postal in sorted(set(blocked) | {p for p, s in cfg.states.items() if s.extra_maps}):
        rows = {row["map_name"]: row for row in blocked.get(postal, [])}
        maps = {m.name: m for m in cfg.states[postal].extra_maps} if postal in cfg.states else {}
        for name in sorted(set(rows) - set(maps)):
            problems.append((postal, f"blocked map {name!r} in sources.md but not in config.yaml extra_maps"))
        for name in sorted(set(maps) - set(rows)):
            problems.append((postal, f"extra map {name!r} in config.yaml but no row under 'Blocked maps'"))
        for name in sorted(set(rows) & set(maps)):
            m = maps[name]
            expected = {"map_name": m.name, "url": m.source_url, "status": m.status,
                        "pipeline_file": m.bef.upper()}
            problems += _compare(postal, rows[name], expected)

    at_large = parsed["at_large"]
    for postal in sorted(set(cfg.at_large) | set(at_large)):
        if postal not in cfg.at_large:
            problems.append((postal, "row under 'At-large states' but not in config.yaml at_large"))
        elif postal not in at_large:
            problems.append((postal, "in config.yaml at_large but no row under 'At-large states'"))
        else:
            problems += _compare(postal, at_large[postal], _AT_LARGE_ROW)

    if problems:
        states = ",".join(sorted({postal for postal, _ in problems}))
        raise CheckError("sources_md", states, "; ".join(f"{p}: {d}" for p, d in problems))


def _compare(postal: str, row: dict, expected: dict) -> list[tuple[str, str]]:
    return [(postal, f"{field}: sources.md has {row[field]!r}, config.yaml has {want!r}")
            for field, want in expected.items() if row[field] != want]


def _cells(line: str) -> list[str]:
    inner = line.strip()
    inner = inner[1:] if inner.startswith("|") else inner
    inner = inner[:-1] if inner.endswith("|") else inner
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", inner)]


def _table(lines: list[str], heading: str) -> tuple[list[str], list[dict[str, str]]]:
    """Header and rows ({header: cell}) of the first table under '## heading'."""
    starts = [i for i, line in enumerate(lines) if line.strip() == f"## {heading}"]
    if len(starts) != 1:
        raise CheckError("sources_md", "US", f"expected one heading '## {heading}', found {len(starts)}")
    table: list[str] = []
    for line in lines[starts[0] + 1:]:
        if line.startswith("#"):
            break
        if line.startswith("|"):
            table.append(line)
        elif table:
            break
    if len(table) < 2 or not all(re.fullmatch(r":?-{3,}:?", c) for c in _cells(table[1])):
        raise CheckError("sources_md", "US", f"no table under '## {heading}'")
    header = _cells(table[0])
    rows = []
    for line in table[2:]:
        cells = _cells(line)
        if len(cells) != len(header):
            raise CheckError("sources_md", "US", f"row under '{heading}' has {len(cells)} cells, "
                                                 f"header has {len(header)}: {line}")
        rows.append(dict(zip(header, cells)))
    return header, rows


def _column(header: list[str], raw: dict, name: str, heading: str) -> str:
    if name not in header:
        raise CheckError("sources_md", "US", f"table under '{heading}' has no column '{name}'")
    return raw[name]


def _row(header: list[str], raw: dict, heading: str, with_seats: bool) -> tuple[str, dict]:
    postal = _column(header, raw, "State", heading)
    if not re.fullmatch(r"[A-Z]{2}", postal):
        raise CheckError("sources_md", "US", f"'{postal}' under '{heading}' is not a postal code")
    map_columns = [h for h in header if h == "Map" or h.startswith("Map ")]
    if len(map_columns) != 1:
        raise CheckError("sources_md", "US", f"table under '{heading}' needs one column named 'Map...', "
                                             f"found {map_columns}")
    cell = raw[map_columns[0]]
    link = _LINK.fullmatch(cell)
    if link:
        map_name, url = link.group(1), link.group(2)
    elif "[" in cell or "](" in cell:
        raise CheckError("sources_md", postal, f"map cell is neither one link nor plain text: {cell!r}")
    else:
        map_name, url = cell, None
    row = {"map_name": map_name, "url": url, "status": _column(header, raw, "Status", heading),
           "pipeline_file": _column(header, raw, "Pipeline file", heading)}
    if with_seats:
        seats = _column(header, raw, "Seats", heading)
        if not seats.isdigit():
            raise CheckError("sources_md", postal, f"Seats is not a whole number: {seats!r}")
        row = {"seats": int(seats), **row}
    return postal, row
```

- [ ] **Step 4: Draai de tests opnieuw**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py -v`

Expected: `17 passed`.

- [ ] **Step 5: Draai alle Python-tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest`

Expected: `72 passed`.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/checks.py tests/test_checks_sources.py
git commit -m "Add CheckError and the sources.md consistency check"
```

## Phase 1: data

Deze fase haalt alle bronbestanden op en maakt de tussenbestanden uit het contract: stemmen per eenheid, stemmen per district voor de vastgestelde kaarten (blokverdeling en hele eenheden), de ensembles en ALARM's referentiekaart. Daarna kan `03_metrics` alles uitrekenen zonder ruwe data te lezen.

De taken 1.1 tot en met 1.10 staan hieronder zoals ze zijn uitgevoerd. Fase 1b (taken 1.12 tot en met 1.18) maakt ALARM's `map.rds` de stembron voor alle 44 staten en past een deel van die taken aan; de tabel aan het begin van fase 1b zegt welke. Taak 1.11 wordt niet uitgevoerd; taak 1.18 vervangt haar. Namen als `unit_source`, `align_to_alarm`, `AlignEntry` en `check_vap` in de taken 1.1 tot en met 1.11 bestaan na fase 1b niet meer. Het contract in de plankop beschrijft de stand na fase 1b.

Wat fase 0 al levert en wat deze fase aanneemt:

- `.venv` met de pakketten uit `requirements.txt` (pandas 3, numpy, pyarrow, pyyaml, rdata, pytest). Fase 1 heeft geen extra pakket nodig: downloads gaan via `urllib` uit de standaardbibliotheek.
- `pipeline/gerry/__init__.py` en `pipeline/gerry/config.py` volgens het contract, met `REPO_ROOT`, `data_dir()`, `interim_dir()`, `load_config()` en de dataclasses.
- `pipeline/config.yaml` met alle 44 staten. `unit_source` is `vtd` voor 38 staten plus IA, `block` voor CA, HI, ME en OR, en `rds_county` voor WV. WV heeft `elections: [pre_20]`, MO heeft `bef: cd118` en `extra_maps.mo_hb1` met `bef: cd120`. Taak 1.15 vervangt `unit_source` door `unit_kind`, met `vtd` voor 38 staten, `tract` voor CA, HI, ME en OR, en `county` voor IA en WV.
- `pipeline/gerry/checks.py` uit taak 0.5, met `class CheckError(RuntimeError)`: `CheckError(check, state, detail)`, attributen `.check`, `.state`, `.detail`, tekst `"{check} failed for {state}: {detail}"`. Daarnaast `parse_sources_md` en `check_sources_md`. Fase 1 voegt in taak 1.10, 1.16 en 1.17 de datacontroles aan dit bestand toe en gebruikt overal deze `CheckError`, met een postcode als staat.
- `pytest.ini` met `testpaths = tests`, `pythonpath = pipeline`, `--strict-markers` en de marker `data`.
- `.gitignore` met `data/raw/` en `data/interim/`.

Taak 1.3 haalt de echte data op. Vanaf taak 1.4 draaien de datatests (`@pytest.mark.data`) dus echt. Zonder data worden ze overgeslagen.

Alle commando's draaien in PowerShell vanuit de root van de worktree. Zet aan het begin van elke sessie:

```powershell
$env:PYTHONUTF8=1
```

### Task 1.1: Downloads met manifest en controles

**Files:**
- Create: `pipeline/gerry/sources.py`
- Test: `tests/test_sources.py`

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces (in `gerry/sources.py`):
  - `@dataclass(frozen=True) class Download: key: str; url: str; size: int | None; md5: str | None`
  - `class DownloadError(RuntimeError)`
  - `class Manifest: __init__(path: Path); get(key: str) -> dict | None; record(key: str, url: str, size: int, sha256: str) -> None; save() -> None`
  - `fetch(dl: Download, root: Path, manifest: Manifest, retries: int = 3, wait: float = 5.0, session=None) -> Path`
  - Aanvulling op het contract: `USER_AGENT = "gerry-pipeline/1.0"`, `TIMEOUT = 120` (seconden) en `open_session() -> urllib.request.OpenerDirector`. `session` is elk object met `.open(url, timeout=...)`.

Regels voor `fetch`, uit hoofdstuk 3 van de spec:

- Staat het bestand er al en klopt het met `data/manifest.json` (grootte en sha256), dan slaat `fetch` het over. Zonder manifestregel telt een bestand alleen als gecontroleerd als Dataverse grootte en md5 geeft en die kloppen; dan schrijft `fetch` de manifestregel erbij.
- Anders downloadt `fetch` naar `<naam>.part`, controleert grootte en md5 (alleen bekend bij Dataverse) en hernoemt met `os.replace`. Bij een netwerkfout of een verkeerde grootte of md5 volgt een nieuwe poging na `wait` seconden, tot `retries` pogingen.
- Heeft het manifest al een regel en geeft de download een andere sha256, dan stopt `fetch` met een `DownloadError` die de URL noemt. Het `.part`-bestand gaat weg en het manifest blijft zoals het was.
- `fetch` stuurt altijd `User-Agent: gerry-pipeline/1.0`. Dataverse geeft HTTP 403 op de standaardwaarde `Python-urllib/3.12` (gecontroleerd op 5 oktober 2026).

De tests gebruiken een lokale `http.server` in een thread op 127.0.0.1. Ze gaan niet het internet op.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_sources.py`:

```python
import hashlib
import http.server
import json
import threading
from collections import Counter
from pathlib import Path

import pytest

from gerry import sources
from gerry.sources import Download, DownloadError, Manifest, fetch


class LocalServer:
    """HTTP server on 127.0.0.1 that serves files from `root` and records each request."""

    def __init__(self, root: Path):
        self.root = root
        self.hits = Counter()      # path without leading "/" and without query -> number of GETs
        self.requests = []         # full request paths, query included
        self.user_agents = []
        self.failures = {}         # path -> number of 503 answers before the file is served
        self.routes = {}           # path -> bytes, served instead of a file
        srv = self

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(root), **kwargs)

            def do_GET(self):
                path = self.path.split("?", 1)[0].lstrip("/")
                srv.hits[path] += 1
                srv.requests.append(self.path)
                srv.user_agents.append(self.headers.get("User-Agent"))
                if srv.failures.get(path, 0) > 0:
                    srv.failures[path] -= 1
                    self.send_error(503)
                    return
                if path in srv.routes:
                    body = srv.routes[path]
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                super().do_GET()

            def log_message(self, *args):
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def url(self, path: str) -> str:
        return f"{self.base}/{path}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture
def server(tmp_path):
    root = tmp_path / "srv"
    root.mkdir()
    srv = LocalServer(root)
    yield srv
    srv.close()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def publish(server: LocalServer, name: str, content: bytes) -> Download:
    """Put a file on the server; return a Census-style download (no size or md5 known)."""
    (server.root / name).write_bytes(content)
    return Download(key=f"census/{name}", url=server.url(name), size=None, md5=None)


def test_manifest_starts_empty_without_file(tmp_path):
    assert Manifest(tmp_path / "manifest.json").get("census/cd120.zip") is None


def test_manifest_saves_sorted_and_reloads(tmp_path):
    path = tmp_path / "data" / "manifest.json"
    m = Manifest(path)
    m.record("census/b.zip", "https://example.org/b.zip", 3, "bb")
    m.record("census/a.zip", "https://example.org/a.zip", 5, "aa")
    m.save()
    text = path.read_text(encoding="utf-8")
    assert text.endswith("\n")
    assert list(json.loads(text)) == ["census/a.zip", "census/b.zip"]
    assert Manifest(path).get("census/a.zip") == {"url": "https://example.org/a.zip", "size": 5, "sha256": "aa"}


def test_fetch_downloads_and_records_sha256(tmp_path, server):
    content = b"GEOID,CDFP\n320019601001000,02\n"
    dl = publish(server, "cd.txt", content)
    manifest = Manifest(tmp_path / "manifest.json")
    path = fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert path == tmp_path / "raw" / "census" / "cd.txt"
    assert path.read_bytes() == content
    assert not (tmp_path / "raw" / "census" / "cd.txt.part").exists()
    assert manifest.get("census/cd.txt") == {"url": dl.url, "size": len(content), "sha256": sha256(content)}


def test_fetch_skips_a_verified_file(tmp_path, server):
    dl = publish(server, "cd.txt", b"abc")
    manifest = Manifest(tmp_path / "manifest.json")
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert server.hits["cd.txt"] == 1


def test_fetch_replaces_a_damaged_file(tmp_path, server):
    dl = publish(server, "cd.txt", b"abc")
    manifest = Manifest(tmp_path / "manifest.json")
    path = fetch(dl, tmp_path / "raw", manifest, wait=0)
    path.write_bytes(b"abX")
    fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert path.read_bytes() == b"abc"
    assert server.hits["cd.txt"] == 2


def test_fetch_stops_when_the_source_changed(tmp_path, server):
    dl = publish(server, "cd.txt", b"new content")
    manifest = Manifest(tmp_path / "manifest.json")
    manifest.record(dl.key, dl.url, 11, sha256(b"old content"))
    with pytest.raises(DownloadError, match=dl.url):
        fetch(dl, tmp_path / "raw", manifest, wait=0)
    assert not (tmp_path / "raw" / "census" / "cd.txt").exists()
    assert not (tmp_path / "raw" / "census" / "cd.txt.part").exists()
    assert manifest.get(dl.key)["sha256"] == sha256(b"old content")


def test_fetch_checks_size_and_md5_from_dataverse(tmp_path, server):
    content = b"draw,district\ncd_2020,1\n"
    (server.root / "stats.csv").write_bytes(content)
    manifest = Manifest(tmp_path / "manifest.json")
    good = Download("alarm/NV_cd_2020_stats.csv", server.url("stats.csv"), len(content), md5(content))
    assert fetch(good, tmp_path / "raw", manifest, wait=0).read_bytes() == content
    bad = Download("alarm/UT_cd_2020_stats.csv", server.url("stats.csv"), len(content), "0" * 32)
    with pytest.raises(DownloadError, match="md5"):
        fetch(bad, tmp_path / "raw", manifest, retries=2, wait=0)
    assert not (tmp_path / "raw" / "alarm" / "UT_cd_2020_stats.csv").exists()
    assert manifest.get(bad.key) is None


def test_fetch_accepts_existing_file_with_matching_md5(tmp_path, server):
    content = b"x" * 10
    dl = Download("alarm/WV_cd_2020_map.rds", server.url("map.rds"), 10, md5(content))
    target = tmp_path / "raw" / "alarm" / "WV_cd_2020_map.rds"
    target.parent.mkdir(parents=True)
    target.write_bytes(content)
    manifest = Manifest(tmp_path / "manifest.json")
    assert fetch(dl, tmp_path / "raw", manifest, wait=0) == target
    assert server.hits["map.rds"] == 0
    assert manifest.get(dl.key) == {"url": dl.url, "size": 10, "sha256": sha256(content)}


def test_fetch_retries_with_wait(tmp_path, server, monkeypatch):
    sleeps = []
    monkeypatch.setattr(sources.time, "sleep", sleeps.append)
    dl = publish(server, "cd.txt", b"abc")
    server.failures["cd.txt"] = 2
    fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), retries=3, wait=5.0)
    assert server.hits["cd.txt"] == 3
    assert sleeps == [5.0, 5.0]


def test_fetch_gives_up_after_the_last_attempt(tmp_path, server, monkeypatch):
    monkeypatch.setattr(sources.time, "sleep", lambda seconds: None)
    dl = publish(server, "cd.txt", b"abc")
    server.failures["cd.txt"] = 5
    with pytest.raises(DownloadError, match="3 attempts"):
        fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), retries=3, wait=5.0)
    assert server.hits["cd.txt"] == 3


def test_fetch_sends_its_own_user_agent(tmp_path, server):
    # Dataverse answers 403 to the default "Python-urllib" user agent.
    dl = publish(server, "cd.txt", b"abc")
    fetch(dl, tmp_path / "raw", Manifest(tmp_path / "m.json"), wait=0)
    assert server.user_agents == [sources.USER_AGENT]
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py -v
```

Verwacht: `ERROR tests/test_sources.py` met `ImportError: cannot import name 'sources' from 'gerry'`.

- [ ] **Step 3: Schrijf de implementatie**

`pipeline/gerry/sources.py`:

```python
"""Downloads with size, md5 and sha256 checks, recorded in data/manifest.json (spec chapter 3)."""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import shutil
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

USER_AGENT = "gerry-pipeline/1.0"   # Dataverse answers 403 to the default "Python-urllib/3.x"
TIMEOUT = 120                       # seconds per connection attempt
CHUNK = 1 << 20


@dataclass(frozen=True)
class Download:
    key: str            # path relative to the data directory, with "/"
    url: str
    size: int | None    # expected size in bytes, known for Dataverse files only
    md5: str | None     # expected md5, known for Dataverse files only


class DownloadError(RuntimeError):
    pass


class Manifest:
    """data/manifest.json: {key: {"url", "size", "sha256"}} for every downloaded file."""

    def __init__(self, path: Path):
        self.path = Path(path)
        if self.path.exists():
            self._entries = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self._entries = {}

    def get(self, key: str) -> dict | None:
        return self._entries.get(key)

    def record(self, key: str, url: str, size: int, sha256: str) -> None:
        self._entries[key] = {"url": url, "size": int(size), "sha256": sha256}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(dict(sorted(self._entries.items())), indent=2) + "\n"
        tmp = self.path.with_name(self.path.name + ".part")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, self.path)


def open_session() -> urllib.request.OpenerDirector:
    """The default `session`: a urllib opener that sends USER_AGENT."""
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener


def _digests(path: Path) -> tuple[int, str, str]:
    """(size, md5, sha256) of a file, read once."""
    md5, sha = hashlib.md5(), hashlib.sha256()
    size = 0
    with open(path, "rb") as fh:
        while block := fh.read(CHUNK):
            size += len(block)
            md5.update(block)
            sha.update(block)
    return size, md5.hexdigest(), sha.hexdigest()


def _expected_problem(dl: Download, size: int, md5: str) -> str | None:
    """Mismatch with the size and md5 that Dataverse publishes, or None."""
    if dl.size is not None and size != dl.size:
        return f"size {size}, expected {dl.size}"
    if dl.md5 is not None and md5 != dl.md5:
        return f"md5 {md5}, expected {dl.md5}"
    return None


def _is_verified(path: Path, dl: Download, entry: dict | None) -> tuple[bool, int, str]:
    """An existing file counts as verified if it matches the manifest entry, or (without
    an entry) the Dataverse size and md5. A Census or GitHub file without entry is not."""
    size, md5, sha = _digests(path)
    if _expected_problem(dl, size, md5) is not None:
        return False, size, sha
    if entry is not None:
        return (size == entry["size"] and sha == entry["sha256"]), size, sha
    return dl.md5 is not None, size, sha


def fetch(dl: Download, root: Path, manifest: Manifest, retries: int = 3, wait: float = 5.0,
          session=None) -> Path:
    """Download `dl` to root/dl.key unless a verified copy is there. Records sha256 in the manifest.

    `session` is an object with .open(url, timeout=...) such as urllib's OpenerDirector."""
    target = Path(root) / dl.key
    entry = manifest.get(dl.key)
    if target.exists():
        ok, size, sha = _is_verified(target, dl, entry)
        if ok:
            if entry is None:
                manifest.record(dl.key, dl.url, size, sha)
            return target
    session = session or open_session()
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(target.name + ".part")
    last_error = ""
    for attempt in range(1, retries + 1):
        try:
            with session.open(dl.url, timeout=TIMEOUT) as response, open(part, "wb") as fh:
                shutil.copyfileobj(response, fh, CHUNK)
            size, md5, sha = _digests(part)
            problem = _expected_problem(dl, size, md5)
        except (OSError, http.client.HTTPException) as exc:
            problem = f"{type(exc).__name__}: {exc}"
        if problem is None:
            break
        last_error = problem
        part.unlink(missing_ok=True)
        if attempt < retries:
            time.sleep(wait)
    else:
        raise DownloadError(f"{dl.url}: failed after {retries} attempts; last error: {last_error}")
    if entry is not None and (sha != entry["sha256"] or size != entry["size"]):
        part.unlink()
        raise DownloadError(
            f"{dl.url}: content differs from data/manifest.json ({dl.key}: size {entry['size']}, "
            f"sha256 {entry['sha256']}; downloaded size {size}, sha256 {sha}). The file at the source "
            "has changed. Find out why before you remove the entry from the manifest.")
    os.replace(part, target)
    manifest.record(dl.key, dl.url, size, sha)
    return target
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py -v
```

Verwacht: `11 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/sources.py tests/test_sources.py
git commit -m "Add downloads with manifest and checksum checks"
```

### Task 1.2: Dataverse-lijst en downloadplan

**Files:**
- Modify: `pipeline/gerry/sources.py` (functies onderaan erbij)
- Modify: `tests/test_sources.py` (importregels en tests onderaan)
- Create: `tests/fixtures/dataverse_v15_files.json`

**Interfaces:**
- Consumes: `Download`, `DownloadError`, `open_session`, `TIMEOUT` uit taak 1.1; `Config`, `StateConfig`, `EnsembleConfig`, `AlignEntry` uit `gerry/config.py` (fase 0).
- Produces:
  - `dataverse_files(api_base: str, doi: str, version: int, session=None) -> dict[str, dict]`: bestandsnaam naar `{"id": int, "size": int, "md5": str, "tabular": bool}`. `size` is `originalFileSize` bij tabulaire bestanden en anders `filesize`.
  - `plan_downloads(cfg: Config, dv_files: dict[str, dict]) -> list[Download]`: elk bestand uit "Datamap" in het contract, in deze volgorde: stats-bestanden, `.rds`-bestanden, census-vest, `cd118.zip` en `cd120.zip`, P.L. 94-171, TIGER.

Wat we weten van de API (opgevraagd op 5 oktober 2026):

- `GET {api}/datasets/:persistentId/versions/15/files?persistentId=doi:10.7910/DVN/SLCD3E` geeft `{"status": "OK", "totalCount": 348, "data": [...]}` met alle 348 bestanden in één antwoord. `dataverse_files` controleert dat `totalCount` gelijk is aan het aantal regels, zodat een afgekapte lijst opvalt.
- Bij een ingelezen tabel (`tabularData: true`, de `.tab`-bestanden) is `md5` de md5 van de oorspronkelijke CSV. Gecontroleerd voor NV, LA, CA, WV, IA, UT, TX en NC: de md5 van het bestand van `?format=original` is gelijk aan `md5` uit de API, en de grootte aan `originalFileSize`.
- Downloadadres: `{api}/access/datafile/{id}`, met `?format=original` voor tabulaire bestanden.
- `.rds`-bestanden: `alarm/{ST}_cd_2020_map.rds` voor elke staat met `unit_source: rds_county` (WV), plus de `rds` van elke regel in `align_to_alarm` (CA).
- Census-vest: alleen voor `vtd` en `block`. WV haalt zijn stemmen uit de `.rds`, want het VTD-bestand mist stemmen voor 13 county's.

De fixture is de echte API-respons ingekort tot 6 van de 348 bestanden. De velden zijn ongewijzigd.

- [ ] **Step 1: Maak de fixture**

`tests/fixtures/dataverse_v15_files.json`:

```json
{"status": "OK", "totalCount": 6, "data": [
{"description": "2020 California Congressional Districts", "label": "CA_cd_2020_map.rds", "restricted": false, "directoryLabel": "CA_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6391062, "persistentId": "", "filename": "CA_cd_2020_map.rds", "contentType": "application/octet-stream", "friendlyType": "Unknown", "filesize": 2117872, "description": "2020 California Congressional Districts", "storageIdentifier": "s3://dvn-cloud:182372a2596-5d353298365e", "rootDataFileId": -1, "md5": "e227564fe85c6729d49aa49e90019ecf", "checksum": {"type": "MD5", "value": "e227564fe85c6729d49aa49e90019ecf"}, "tabularData": false, "creationDate": "2022-07-25", "publicationDate": "2022-07-26", "directoryLabel": "CA_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}},
{"description": "2020 California Congressional Districts", "label": "CA_cd_2020_stats.tab", "restricted": false, "directoryLabel": "CA_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6392648, "persistentId": "", "filename": "CA_cd_2020_stats.tab", "contentType": "text/tab-separated-values", "friendlyType": "Tab-Delimited", "filesize": 75748013, "description": "2020 California Congressional Districts", "storageIdentifier": "s3://dvn-cloud:1823bde1a15-ef6d0ff5827b", "originalFileFormat": "text/csv", "originalFormatLabel": "Comma Separated Values", "originalFileSize": 75228117, "originalFileName": "CA_cd_2020_stats.csv", "UNF": "UNF:6:dtvmVPqPLiyE07sQVAuwHQ==", "rootDataFileId": -1, "md5": "ffd1cb0dbc4f62b1c710ef6186170ea9", "checksum": {"type": "MD5", "value": "ffd1cb0dbc4f62b1c710ef6186170ea9"}, "tabularData": true, "creationDate": "2022-07-26", "publicationDate": "2022-07-26", "directoryLabel": "CA_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}},
{"description": "2020 Nevada Congressional Districts", "label": "NV_cd_2020_doc.html", "restricted": false, "directoryLabel": "NV_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6431359, "persistentId": "", "filename": "NV_cd_2020_doc.html", "contentType": "text/html", "friendlyType": "HTML", "filesize": 5129, "description": "2020 Nevada Congressional Districts", "storageIdentifier": "s3://dvn-cloud:182d64357e7-02e616aecd47", "rootDataFileId": 6380431, "previousDataFileId": 6380431, "md5": "0f1188b12332ee07ed98bea603e2578d", "checksum": {"type": "MD5", "value": "0f1188b12332ee07ed98bea603e2578d"}, "tabularData": false, "creationDate": "2022-08-25", "publicationDate": "2022-08-25", "directoryLabel": "NV_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}},
{"description": "2020 Nevada Congressional Districts", "label": "NV_cd_2020_stats.tab", "restricted": false, "directoryLabel": "NV_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6392701, "persistentId": "", "filename": "NV_cd_2020_stats.tab", "contentType": "text/tab-separated-values", "friendlyType": "Tab-Delimited", "filesize": 7297593, "description": "2020 Nevada Congressional Districts", "storageIdentifier": "s3://dvn-cloud:1823c0c94ea-9cce2b0529e6", "originalFileFormat": "text/csv", "originalFormatLabel": "Comma Separated Values", "originalFileSize": 7257601, "originalFileName": "NV_cd_2020_stats.csv", "UNF": "UNF:6:OZDlddZuaPxqTRE9PG4Mag==", "rootDataFileId": -1, "md5": "10f038a740da8bf18a18a5fbd33f8f2e", "checksum": {"type": "MD5", "value": "10f038a740da8bf18a18a5fbd33f8f2e"}, "tabularData": true, "creationDate": "2022-07-26", "publicationDate": "2022-07-26", "directoryLabel": "NV_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}},
{"description": "2020 West Virginia Congressional Districts", "label": "WV_cd_2020_map.rds", "restricted": false, "directoryLabel": "WV_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6380448, "persistentId": "", "filename": "WV_cd_2020_map.rds", "contentType": "application/octet-stream", "friendlyType": "Unknown", "filesize": 17740, "description": "2020 West Virginia Congressional Districts", "storageIdentifier": "s3://dvn-cloud:18204b4ab78-cb0679aac21a", "rootDataFileId": -1, "md5": "40ecd77e6862f5d5605951fcb75aeb8f", "checksum": {"type": "MD5", "value": "40ecd77e6862f5d5605951fcb75aeb8f"}, "tabularData": false, "creationDate": "2022-07-15", "publicationDate": "2022-07-26", "directoryLabel": "WV_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}},
{"label": "WV_cd_2020_stats.tab", "restricted": false, "directoryLabel": "WV_cd_2020", "version": 1, "datasetVersionId": 344563, "dataFile": {"id": 6392761, "persistentId": "", "filename": "WV_cd_2020_stats.tab", "contentType": "text/tab-separated-values", "friendlyType": "Tab-Delimited", "filesize": 2178561, "storageIdentifier": "s3://dvn-cloud:1823c7e4580-45f0a5a81ec7", "originalFileFormat": "text/csv", "originalFormatLabel": "Comma Separated Values", "originalFileSize": 2158565, "originalFileName": "WV_cd_2020_stats.csv", "UNF": "UNF:6:S27liKbkkoAFCPXezz+/hQ==", "rootDataFileId": -1, "md5": "e4d14ea21a0130bf01c0fbea17be9806", "checksum": {"type": "MD5", "value": "e4d14ea21a0130bf01c0fbea17be9806"}, "tabularData": true, "creationDate": "2022-07-26", "publicationDate": "2022-07-26", "directoryLabel": "WV_cd_2020", "lastUpdateTime": "2026-02-19T18:27:59Z", "fileAccessRequest": false}}
]}
```

- [ ] **Step 2: Schrijf de falende tests**

Vervang de importregels bovenaan `tests/test_sources.py`:

```python
import hashlib
import http.server
import json
import threading
from collections import Counter
from pathlib import Path

import pytest

from gerry import sources
from gerry.sources import Download, DownloadError, Manifest, fetch
```

door:

```python
import hashlib
import http.server
import json
import threading
from collections import Counter
from datetime import date
from pathlib import Path

import pytest

from gerry import sources
from gerry.config import AlignEntry, Config, EnsembleConfig, StateConfig
from gerry.sources import Download, DownloadError, Manifest, fetch
```

Voeg onderaan `tests/test_sources.py` toe:

```python
# ---- Task 1.2: Dataverse listing and the download plan ----

FIXTURE = Path(__file__).parent / "fixtures" / "dataverse_v15_files.json"
LISTING = "api/datasets/:persistentId/versions/15/files"
DOI = "doi:10.7910/DVN/SLCD3E"


def test_dataverse_files_reads_the_version_listing(server):
    server.routes[LISTING] = FIXTURE.read_bytes()
    files = sources.dataverse_files(server.url("api"), DOI, 15)
    assert server.requests == [f"/{LISTING}?persistentId={DOI}"]
    assert len(files) == 6
    # tabular file: size of the original CSV, not of the ingested .tab
    assert files["NV_cd_2020_stats.tab"] == {
        "id": 6392701, "size": 7257601, "md5": "10f038a740da8bf18a18a5fbd33f8f2e", "tabular": True}
    assert files["WV_cd_2020_map.rds"] == {
        "id": 6380448, "size": 17740, "md5": "40ecd77e6862f5d5605951fcb75aeb8f", "tabular": False}


def test_dataverse_files_rejects_an_incomplete_listing(server):
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["totalCount"] = 348
    server.routes[LISTING] = json.dumps(payload).encode()
    with pytest.raises(DownloadError, match="348"):
        sources.dataverse_files(server.url("api"), DOI, 15)


def test_dataverse_files_rejects_an_error_status(server):
    server.routes[LISTING] = b'{"status": "ERROR", "message": "Version not found"}'
    with pytest.raises(DownloadError, match="Version not found"):
        sources.dataverse_files(server.url("api"), DOI, 15)


def make_state(postal, name, fips, seats, unit_source, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name=name, fips=fips, seats=seats, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_source=unit_source, extra_maps=(), notes=())


API = "https://dataverse.harvard.edu/api"
COMMIT = "243c8a8134ecf8151777a9388c48323e274767e2"
SOURCES = {
    "dataverse_api": API,
    "cd118": "https://www2.census.gov/x/cd118.zip",
    "cd120": "https://www2.census.gov/x/cd120.zip",
    "pl94171": "https://www2.census.gov/pl/{folder}/{st}2020.pl.zip",
    "census_vest": "https://raw.githubusercontent.com/alarm-redist/census-2020/{commit}/census-vest-2020/{st}_2020_{kind}.csv",
    "tiger_gpkg": "https://www2.census.gov/geo/tiger/TGRGPKG26/tlgpkg_2026_us_legislative.gpkg.zip",
    "tiger_mo_cd119": "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_29_cd119.zip",
    "cb_states": "https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip",
}


def small_config():
    return Config(
        status_checked=date(2026, 10, 3),
        census_vest_commit=COMMIT,
        ensemble=EnsembleConfig(name="alarm_v15", doi=DOI, version=15, notes={}, fill={}),
        align_to_alarm=(AlignEntry(state="CA", rds="alarm/CA_cd_2020_map.rds", unit_column="tract",
                                   unit_len=11, units=("06049000300", "06093000200")),),
        sources=SOURCES,
        states={"NV": make_state("NV", "Nevada", "32", 4, "vtd"),
                "CA": make_state("CA", "California", "06", 52, "block"),
                "WV": make_state("WV", "West Virginia", "54", 2, "rds_county", elections=("pre_20",))},
        at_large={},
    )


DV_FILES = {
    "CA_cd_2020_map.rds": {"id": 6391062, "size": 2117872, "md5": "e227564fe85c6729d49aa49e90019ecf", "tabular": False},
    "CA_cd_2020_stats.tab": {"id": 6392648, "size": 75228117, "md5": "ffd1cb0dbc4f62b1c710ef6186170ea9", "tabular": True},
    "NV_cd_2020_stats.tab": {"id": 6392701, "size": 7257601, "md5": "10f038a740da8bf18a18a5fbd33f8f2e", "tabular": True},
    "WV_cd_2020_map.rds": {"id": 6380448, "size": 17740, "md5": "40ecd77e6862f5d5605951fcb75aeb8f", "tabular": False},
    "WV_cd_2020_stats.tab": {"id": 6392761, "size": 2158565, "md5": "e4d14ea21a0130bf01c0fbea17be9806", "tabular": True},
}


def test_plan_downloads_follows_the_data_dir_layout():
    plan = sources.plan_downloads(small_config(), DV_FILES)
    vest = f"https://raw.githubusercontent.com/alarm-redist/census-2020/{COMMIT}/census-vest-2020"
    assert plan == [
        Download("alarm/CA_cd_2020_stats.csv", f"{API}/access/datafile/6392648?format=original",
                 75228117, "ffd1cb0dbc4f62b1c710ef6186170ea9"),
        Download("alarm/NV_cd_2020_stats.csv", f"{API}/access/datafile/6392701?format=original",
                 7257601, "10f038a740da8bf18a18a5fbd33f8f2e"),
        Download("alarm/WV_cd_2020_stats.csv", f"{API}/access/datafile/6392761?format=original",
                 2158565, "e4d14ea21a0130bf01c0fbea17be9806"),
        Download("alarm/CA_cd_2020_map.rds", f"{API}/access/datafile/6391062",
                 2117872, "e227564fe85c6729d49aa49e90019ecf"),
        Download("alarm/WV_cd_2020_map.rds", f"{API}/access/datafile/6380448",
                 17740, "40ecd77e6862f5d5605951fcb75aeb8f"),
        Download("census_vest/ca_2020_block.csv", f"{vest}/ca_2020_block.csv", None, None),
        Download("census_vest/nv_2020_vtd.csv", f"{vest}/nv_2020_vtd.csv", None, None),
        Download("census/cd118.zip", "https://www2.census.gov/x/cd118.zip", None, None),
        Download("census/cd120.zip", "https://www2.census.gov/x/cd120.zip", None, None),
        Download("census/pl/ca2020.pl.zip", "https://www2.census.gov/pl/California/ca2020.pl.zip", None, None),
        Download("census/pl/nv2020.pl.zip", "https://www2.census.gov/pl/Nevada/nv2020.pl.zip", None, None),
        Download("census/pl/wv2020.pl.zip", "https://www2.census.gov/pl/West_Virginia/wv2020.pl.zip", None, None),
        Download("census/tiger/tlgpkg_2026_us_legislative.gpkg.zip", SOURCES["tiger_gpkg"], None, None),
        Download("census/tiger/tl_2025_29_cd119.zip", SOURCES["tiger_mo_cd119"], None, None),
        Download("census/tiger/cb_2025_us_state_500k.zip", SOURCES["cb_states"], None, None),
    ]


def test_plan_downloads_names_a_missing_dataverse_file():
    files = {k: v for k, v in DV_FILES.items() if k != "WV_cd_2020_map.rds"}
    with pytest.raises(DownloadError, match="WV_cd_2020_map.rds"):
        sources.plan_downloads(small_config(), files)
```

- [ ] **Step 3: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py -v
```

Verwacht: `5 failed, 11 passed`, met `AttributeError: module 'gerry.sources' has no attribute 'dataverse_files'` en `... has no attribute 'plan_downloads'`.

- [ ] **Step 4: Schrijf de implementatie**

Voeg onderaan `pipeline/gerry/sources.py` toe:

```python
def dataverse_files(api_base: str, doi: str, version: int, session=None) -> dict[str, dict]:
    """File name -> {"id", "size", "md5", "tabular"} for one published version of a dataset.

    For ingested tables Dataverse serves the original CSV with ?format=original; its size is
    originalFileSize. The md5 is that of the original upload in both cases."""
    url = f"{api_base}/datasets/:persistentId/versions/{version}/files?persistentId={doi}"
    session = session or open_session()
    try:
        with session.open(url, timeout=TIMEOUT) as response:
            payload = json.load(response)
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise DownloadError(f"{url}: {type(exc).__name__}: {exc}") from exc
    if payload.get("status") != "OK":
        raise DownloadError(f"{url}: status {payload.get('status')}: {payload.get('message')}")
    items = payload["data"]
    if payload.get("totalCount", len(items)) != len(items):
        raise DownloadError(f"{url}: listing has {len(items)} of {payload['totalCount']} files")
    files: dict[str, dict] = {}
    for item in items:
        df = item["dataFile"]
        tabular = bool(df.get("tabularData"))
        name = df["filename"]
        if name in files:
            raise DownloadError(f"{url}: file name {name} occurs twice")
        files[name] = {"id": int(df["id"]), "size": int(df["originalFileSize"] if tabular else df["filesize"]),
                       "md5": df["md5"], "tabular": tabular}
    return files


def _dataverse_download(cfg, dv_files: dict[str, dict], name: str, key: str) -> Download:
    f = dv_files.get(name)
    if f is None:
        raise DownloadError(f"{name} is not in {cfg.ensemble.doi} version {cfg.ensemble.version}")
    url = f"{cfg.sources['dataverse_api']}/access/datafile/{f['id']}"
    if f["tabular"]:
        url += "?format=original"
    return Download(key, url, f["size"], f["md5"])


def plan_downloads(cfg, dv_files: dict[str, dict]) -> list[Download]:
    """Every file the pipeline reads, keyed by its path in the data directory (Interfaces, "Datamap")."""
    src = cfg.sources
    postals = sorted(cfg.states)
    plan = [_dataverse_download(cfg, dv_files, f"{p}_cd_2020_stats.tab", f"alarm/{p}_cd_2020_stats.csv")
            for p in postals]
    rds_keys = {f"alarm/{p}_cd_2020_map.rds" for p in postals if cfg.states[p].unit_source == "rds_county"}
    rds_keys |= {entry.rds for entry in cfg.align_to_alarm}
    plan += [_dataverse_download(cfg, dv_files, key.rsplit("/", 1)[1], key) for key in sorted(rds_keys)]
    for p in postals:
        kind = cfg.states[p].unit_source
        if kind in ("vtd", "block"):
            st = p.lower()
            url = src["census_vest"].format(commit=cfg.census_vest_commit, st=st, kind=kind)
            plan.append(Download(f"census_vest/{st}_2020_{kind}.csv", url, None, None))
    plan.append(Download("census/cd118.zip", src["cd118"], None, None))
    plan.append(Download("census/cd120.zip", src["cd120"], None, None))
    for p in postals:
        folder = cfg.states[p].name.replace(" ", "_")
        st = p.lower()
        plan.append(Download(f"census/pl/{st}2020.pl.zip", src["pl94171"].format(folder=folder, st=st), None, None))
    for name in ("tiger_gpkg", "tiger_mo_cd119", "cb_states"):
        url = src[name]
        plan.append(Download(f"census/tiger/{url.rsplit('/', 1)[1]}", url, None, None))
    keys = [dl.key for dl in plan]
    if len(set(keys)) != len(keys):
        raise DownloadError("download plan has duplicate keys")
    return plan
```

- [ ] **Step 5: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py -v
```

Verwacht: `16 passed`.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/sources.py tests/test_sources.py tests/fixtures/dataverse_v15_files.json
git commit -m "Add Dataverse file listing and download plan"
```

### Task 1.3: Downloadscript en de echte download

**Files:**
- Create: `pipeline/01_download.py`
- Test: `tests/test_download_script.py`
- Create (gegenereerd): `data/manifest.json`

**Interfaces:**
- Consumes: `REPO_ROOT`, `data_dir()`, `load_config()` (fase 0); `Download`, `DownloadError`, `Manifest`, `dataverse_files`, `fetch`, `open_session`, `plan_downloads` (taken 1.1 en 1.2).
- Produces:
  - `pipeline/01_download.py [--only ST ...] [--dry-run]`, met `state_of(key: str) -> str | None` en `select(plan: list[Download], only: list[str]) -> list[Download]`.
  - Alle 138 bestanden uit "Datamap" in `data_dir()`, en `data/manifest.json` met een regel per bestand.

`--only NV WV` beperkt de bestanden per staat (`alarm/`, `census_vest/`, `census/pl/`) tot die staten. Gedeelde bestanden (`cd118.zip`, `cd120.zip`, TIGER) blijven erbij. `--dry-run` toont het plan zonder te downloaden. Het script stopt bij de eerste `DownloadError` en bewaart het manifest tot dat moment. Een nieuwe run gaat verder: gecontroleerde bestanden slaat het over.

De scriptnaam begint met een cijfer, dus de test laadt het bestand met `importlib`.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_download_script.py`:

```python
import importlib.util
import sys
from pathlib import Path

from gerry.sources import Download

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "01_download.py"


def load_script():
    """Import pipeline/01_download.py (its name starts with a digit, so no normal import)."""
    spec = importlib.util.spec_from_file_location("download_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def dl(key: str) -> Download:
    return Download(key, f"https://example.org/{key}", None, None)


PLAN = [dl("alarm/NV_cd_2020_stats.csv"), dl("alarm/WV_cd_2020_map.rds"), dl("census_vest/nv_2020_vtd.csv"),
        dl("census/cd120.zip"), dl("census/pl/nv2020.pl.zip"), dl("census/pl/wv2020.pl.zip"),
        dl("census/tiger/tl_2025_29_cd119.zip")]


def test_state_of_reads_the_postal_code_from_the_key():
    script = load_script()
    assert script.state_of("alarm/WV_cd_2020_map.rds") == "WV"
    assert script.state_of("census_vest/nv_2020_vtd.csv") == "NV"
    assert script.state_of("census/pl/nv2020.pl.zip") == "NV"
    assert script.state_of("census/tiger/tl_2025_29_cd119.zip") is None
    assert script.state_of("census/cd120.zip") is None


def test_select_without_only_keeps_everything():
    assert load_script().select(PLAN, []) == PLAN


def test_select_keeps_shared_files_and_the_named_states():
    keys = [d.key for d in load_script().select(PLAN, ["nv"])]
    assert keys == ["alarm/NV_cd_2020_stats.csv", "census_vest/nv_2020_vtd.csv", "census/cd120.zip",
                    "census/pl/nv2020.pl.zip", "census/tiger/tl_2025_29_cd119.zip"]
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_download_script.py -v
```

Verwacht: `3 failed`, met `FileNotFoundError: [Errno 2] No such file or directory: '...\\pipeline\\01_download.py'`.

- [ ] **Step 3: Schrijf het script**

`pipeline/01_download.py`:

```python
"""Step 1: download every source file into the data directory (spec chapter 3).

Usage: python pipeline/01_download.py [--only ST [ST ...]] [--dry-run]

Files that are already there and match data/manifest.json (or the Dataverse md5) are kept.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from gerry.config import REPO_ROOT, data_dir, load_config
from gerry.sources import Download, DownloadError, Manifest, dataverse_files, fetch, open_session, plan_downloads

MANIFEST = REPO_ROOT / "data" / "manifest.json"
PER_STATE_DIRS = ("alarm/", "census_vest/", "census/pl/")


def state_of(key: str) -> str | None:
    """Postal code of a per-state file; None for files every state uses."""
    if key.startswith(PER_STATE_DIRS):
        return key.rsplit("/", 1)[1][:2].upper()
    return None


def select(plan: list[Download], only: list[str]) -> list[Download]:
    """With --only: the files of those states plus the shared files."""
    if not only:
        return plan
    wanted = {s.upper() for s in only}
    return [dl for dl in plan if state_of(dl.key) is None or state_of(dl.key) in wanted]


def _stamp(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    st = path.stat()
    return st.st_size, st.st_mtime_ns


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", nargs="+", default=[], metavar="ST", help="postal codes, e.g. NV WV")
    parser.add_argument("--dry-run", action="store_true", help="list the planned files and stop")
    args = parser.parse_args(argv)

    cfg = load_config()
    unknown = sorted({s.upper() for s in args.only} - set(cfg.states))
    if unknown:
        parser.error(f"not a multi-seat state in config.yaml: {', '.join(unknown)}")
    root = data_dir()
    session = open_session()
    print(f"Data directory: {root}")
    try:
        dv_files = dataverse_files(cfg.sources["dataverse_api"], cfg.ensemble.doi, cfg.ensemble.version,
                                   session=session)
        plan = select(plan_downloads(cfg, dv_files), args.only)
    except DownloadError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    if args.dry_run:
        for dl in plan:
            print(f"{dl.key}  {dl.size if dl.size is not None else ''}")
        known = sum(dl.size for dl in plan if dl.size is not None)
        print(f"{len(plan)} files planned, {known:,} bytes known in advance (Dataverse)")
        return 0

    manifest = Manifest(MANIFEST)
    counts = {"downloaded": 0, "present": 0}
    total_bytes = 0
    start = time.monotonic()
    for i, dl in enumerate(plan, 1):
        before = _stamp(root / dl.key)
        print(f"[{i:3d}/{len(plan)}] {dl.key} ", end="", flush=True)
        try:
            path = fetch(dl, root, manifest, session=session)
        except DownloadError as exc:
            manifest.save()
            print("FAILED")
            print(f"ERROR {exc}", file=sys.stderr)
            return 1
        manifest.save()
        size = path.stat().st_size
        total_bytes += size
        status = "present" if _stamp(path) == before else "downloaded"
        counts[status] += 1
        print(f"{status} ({size / 1e6:,.1f} MB)")
    minutes = (time.monotonic() - start) / 60
    print(f"{len(plan)} files: {counts['downloaded']} downloaded, {counts['present']} present, "
          f"{total_bytes:,} bytes, {minutes:.1f} min")
    recorded = sum(1 for dl in plan if manifest.get(dl.key) is not None)
    print(f"Manifest {MANIFEST} has entries for {recorded} of these files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_download_script.py -v
```

Verwacht: `3 passed`.

- [ ] **Step 5: Bekijk het plan zonder te downloaden**

```powershell
.venv\Scripts\python pipeline/01_download.py --dry-run
```

Verwacht: eerst `Data directory: ...\data\raw` (of de map uit `GERRY_DATA_DIR`), dan 138 regels van `alarm/AL_cd_2020_stats.csv  12350384` tot `census/tiger/cb_2025_us_state_500k.zip`, en als laatste regel:

```
138 files planned, 779,563,361 bytes known in advance (Dataverse)
```

Een ander aantal betekent dat `config.yaml` niet 44 staten heeft, of niet precies één `rds_county`-staat en één `align_to_alarm`-regel. Zoek dat eerst uit.

- [ ] **Step 6: Download alles (ongeveer 2,5 GB)**

Wil de eigenaar de data buiten de worktree bewaren, zet dan eerst `$env:GERRY_DATA_DIR` op die map. Anders komt alles in `data\raw`.

```powershell
.venv\Scripts\python pipeline/01_download.py
```

Verwacht: per bestand een regel als `[  1/138] alarm/AL_cd_2020_stats.csv downloaded (12.4 MB)`, en aan het eind:

```
138 files: 138 downloaded, 0 present, 2,510,910,107 bytes, <minuten> min
Manifest ...\data\manifest.json has entries for 138 of these files
```

Breekt de run af door een netwerkfout, start hem dan opnieuw. Stopt hij met `content differs from data/manifest.json`, dan is een bestand bij de bron veranderd: niets weggooien, de melding aan de eigenaar voorleggen.

- [ ] **Step 7: Controleer aantallen en groottes**

```powershell
$root = if ($env:GERRY_DATA_DIR) { $env:GERRY_DATA_DIR } else { "data\raw" }
Get-ChildItem $root -Recurse -File | Group-Object { $_.Directory.Name } | ForEach-Object { "{0} {1} {2}" -f $_.Name, $_.Count, ($_.Group | Measure-Object Length -Sum).Sum }
Get-ChildItem $root -Recurse -Filter *.part
(Get-Content data\manifest.json -Raw | ConvertFrom-Json).PSObject.Properties.Name.Count
```

Verwacht (de volgorde van de eerste vijf regels kan verschillen), daarna geen `.part`-bestanden en als laatste `138`:

```
alarm 46 779563361
census_vest 43 119711775
census 2 83169131
pl 44 1275194689
tiger 3 253271151
138
```

De groottes van de Census- en GitHub-bestanden komen uit HEAD-verzoeken van 5 oktober 2026; de Dataverse-groottes uit de API. Wijkt een Census-bestand af, dan is het na die datum bij de bron vervangen. Stop dan en vraag de eigenaar of de nieuwe versie gebruikt mag worden.

- [ ] **Step 8: Draai het script nog een keer**

```powershell
.venv\Scripts\python pipeline/01_download.py
```

Verwacht: elke regel eindigt op `present (...)`, en de samenvatting is `138 files: 0 downloaded, 138 present, 2,510,910,107 bytes, ...`. Dit duurt een paar minuten, omdat het script van elk bestand de sha256 opnieuw uitrekent.

- [ ] **Step 9: Commit**

```powershell
git status --short
git add pipeline/01_download.py tests/test_download_script.py data/manifest.json
git commit -m "Add download script and record manifest of all source files"
```

`git status --short` mag geen bestanden onder `data/raw/` tonen.

### Task 1.4: ALARM-tabellen uit .rds lezen

**Files:**
- Create: `pipeline/gerry/rds.py`
- Test: `tests/test_rds.py`

**Interfaces:**
- Consumes: `data_dir()` (fase 0), de bestanden `alarm/WV_cd_2020_map.rds` en `alarm/CA_cd_2020_map.rds` (taak 1.3) voor de datatests.
- Produces: `read_rds_table(path: Path) -> pd.DataFrame`: alle atomaire kolommen van een `redist_map` (tekst als `str`, gehele getallen als `int64`, kommagetallen als `float64`, logisch als `bool`). Lijstkolommen zoals `geometry` en `adj` vallen weg. R's NA wordt een ontbrekende waarde (`Int64`/`boolean` bij gehele en logische kolommen).

De code is overgenomen uit het proefscript `map_to_pandas.py` van de haalbaarheidscontrole en gebruikt de parser van het pakket `rdata`. Wat we in de echte bestanden zagen: WV heeft 55 county's met `GEOID` (5 tekens) en `county` (3 tekens). CA heeft 9.129 tracts met de kolom `tract` (11 tekens). In ALARM's tabel van California hebben de twee tracts van `align_to_alarm` in alle vier stemkolommen 0 stemmen.

De unit tests maken kleine `.rds`-bestanden met `rdata.write_rds`. Tekstkolommen moeten dan `dtype=object` hebben; de `str`-dtype van pandas 3 kan `rdata` niet schrijven.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_rds.py`:

```python
import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import data_dir
from gerry.rds import read_rds_table


def test_reads_atomic_columns_and_skips_list_columns(tmp_path):
    path = tmp_path / "map.rds"
    # A named list like a redist_map: text, numbers and a list column (as geometry and adj are).
    rdata.write_rds(path, {
        "GEOID": np.array(["54001", "54003"], dtype=object),
        "vap": np.array([9895.0, 44965.0]),
        "cd_2020": np.array([1, 2], dtype=np.int32),
        "adj": [np.array([1], dtype=np.int32), np.array([0], dtype=np.int32)],
    })
    table = read_rds_table(path)
    assert list(table.columns) == ["GEOID", "vap", "cd_2020"]
    assert table["GEOID"].tolist() == ["54001", "54003"]
    assert table["vap"].dtype == np.float64
    assert table["cd_2020"].dtype == np.int64
    assert table["cd_2020"].tolist() == [1, 2]


def test_r_missing_values_become_pandas_missing_values(tmp_path):
    path = tmp_path / "na.rds"
    rdata.write_rds(path, pd.DataFrame({
        "cd": pd.array([1, None], dtype="Int32"),
        "muni": pd.Series(["53000", None], dtype=object),
    }))
    table = read_rds_table(path)
    assert table["cd"].dtype == "Int64"
    assert table["cd"].isna().tolist() == [False, True]
    assert table["muni"].isna().tolist() == [False, True]


WV_MAP = data_dir() / "alarm" / "WV_cd_2020_map.rds"
CA_MAP = data_dir() / "alarm" / "CA_cd_2020_map.rds"


@pytest.mark.data
@pytest.mark.skipif(not WV_MAP.exists(), reason="needs alarm/WV_cd_2020_map.rds")
def test_west_virginia_map_has_55_counties():
    table = read_rds_table(WV_MAP)
    assert len(table) == 55
    assert table["GEOID"].str.len().eq(5).all() and table["GEOID"].str.startswith("54").all()
    assert "geometry" not in table.columns and "adj" not in table.columns
    assert round(table["pre_20_dem_bid"].sum()) == 235984
    assert round(table["pre_20_rep_tru"].sum()) == 545382


@pytest.mark.data
@pytest.mark.skipif(not CA_MAP.exists(), reason="needs alarm/CA_cd_2020_map.rds")
def test_california_map_has_9129_tracts():
    table = read_rds_table(CA_MAP)
    assert len(table) == 9129
    assert table["tract"].str.len().eq(11).all() and table["tract"].is_unique
    # The two tracts of align_to_alarm: ALARM's tract data has no votes there.
    votes = table.set_index("tract").loc[["06049000300", "06093000200"],
                                         ["pre_16_dem_cli", "pre_16_rep_tru", "pre_20_dem_bid", "pre_20_rep_tru"]]
    assert (votes == 0).all().all()
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_rds.py -v
```

Verwacht: `ERROR tests/test_rds.py` met `ModuleNotFoundError: No module named 'gerry.rds'`.

- [ ] **Step 3: Schrijf de implementatie**

`pipeline/gerry/rds.py`:

```python
"""Read the attribute table of an ALARM redist_map (.rds) in Python, without R.

Uses the low-level parser of the `rdata` package. Only atomic columns (text, integer, double,
logical) are returned; list columns such as `geometry` and `adj` are skipped.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import rdata

_T = rdata.parser.RObjectType
_R_NA_INTEGER = np.iinfo(np.int32).min    # R stores NA_integer_ and NA (logical) as this value


def _attributes(obj) -> dict:
    """R attribute pairlist -> {name: object}."""
    out = {}
    cur = obj.attributes
    while cur is not None and cur.info.type == _T.LIST:
        tag = cur.tag
        if tag is not None and tag.info.type == _T.REF:
            tag = tag.referenced_object
        out[tag.value.value.decode("utf-8")] = cur.value[0]
        cur = cur.value[1]
    return out


def _strings(obj) -> list[str | None]:
    return [x.value.decode("utf-8") if x.value is not None else None for x in obj.value]


def _column(obj):
    """Atomic R vector -> numpy array or pandas extension array; None for other types."""
    kind = obj.info.type
    if kind == _T.STR:
        return pd.array(_strings(obj), dtype="str")
    if kind == _T.REAL:
        return np.asarray(obj.value, dtype=np.float64)
    if kind in (_T.INT, _T.LGL):
        values = np.asarray(obj.value).astype(np.int64)
        missing = values == _R_NA_INTEGER
        if kind == _T.LGL:
            return pd.arrays.BooleanArray(values != 0, missing) if missing.any() else values != 0
        return pd.arrays.IntegerArray(values, missing) if missing.any() else values
    return None


def read_rds_table(path: Path) -> pd.DataFrame:
    """All atomic columns of the data frame in an .rds file, in their original order."""
    obj = rdata.parser.parse_file(Path(path)).object
    attrs = _attributes(obj)
    if obj.info.type != _T.VEC or "names" not in attrs:
        raise ValueError(f"{path}: not a data frame or named list")
    columns = {}
    for name, col in zip(_strings(attrs["names"]), obj.value):
        values = _column(col)
        if values is not None:
            columns[name] = values
    return pd.DataFrame(columns)
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_rds.py -v
```

Verwacht: `4 passed`. Zonder data: `2 passed, 2 skipped`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/rds.py tests/test_rds.py
git commit -m "Read ALARM rds tables without R"
```

### Task 1.5: Stemmen per eenheid

**Files:**
- Create: `pipeline/gerry/units.py`
- Test: `tests/test_units.py`

**Interfaces:**
- Consumes: `StateConfig` (fase 0), `read_rds_table` (taak 1.4).
- Produces (in `gerry/units.py`):
  - `class UnitsError(ValueError)`
  - `select_columns(columns: Iterable[str], election: str) -> tuple[str, str]`: `(dem, rep)`, precies één treffer voor `^<election>_dem_` en voor `^<election>_rep_`, anders `UnitsError`.
  - `load_units(st: StateConfig, root: Path) -> pd.DataFrame`: kolommen `unit_id` (str), `vap` (int64), en per verkiezing `d_<e>`, `r_<e>` (float64), in de volgorde van `st.elections`. Aanvulling: `.attrs["empty_vote_fields"]` en `.attrs["empty_vote_units"]` tellen de lege stemvelden die 0 werden.
  - `add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame`: kopie met `d` en `r` erbij.

Bronnen per `unit_source`:

- `vtd`: `census_vest/{st}_2020_vtd.csv`, id-kolom `GEOID20` (11 tekens, soms met een koppelteken, zoals `32003008-03`).
- `block`: `census_vest/{st}_2020_block.csv`, id-kolom `GEOID20` (15 tekens).
- `rds_county`: `alarm/{ST}_cd_2020_map.rds`. De id-kolom is de enige tekstkolom waarvan elke waarde 5 tekens heeft, met de FIPS-code begint en uniek is. In WV is dat `GEOID`.

Lege stemvelden worden 0 en komen in het log, voor elke bron (spec, koppelregels). In California zijn dat 8 velden in 2 blokken zonder bevolking; in de VTD-bestanden van NV, TX, UT, IA, NC en LA geen. Een `vap` die geen geheel getal is, ontbrekende id's en dubbele id's geven een `UnitsError`.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_units.py`:

```python
import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import StateConfig
from gerry.units import UnitsError, add_composite, load_units, select_columns


def make_state(postal, fips, unit_source, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips=fips, seats=2, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_source=unit_source, extra_maps=(), notes=())


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ---- select_columns ----

def test_select_columns_returns_the_dem_and_rep_column():
    cols = ["GEOID20", "pre_16_rep_tru", "pre_16_dem_cli", "uss_16_dem_cor", "pre_20_dem_bid", "pre_20_rep_tru"]
    assert select_columns(cols, "pre_16") == ("pre_16_dem_cli", "pre_16_rep_tru")


def test_select_columns_matches_only_at_the_start():
    cols = ["pre_20_dem_bid", "pre_20_rep_tru", "xpre_20_dem_a", "sos_r20_rep_b"]
    assert select_columns(cols, "pre_20") == ("pre_20_dem_bid", "pre_20_rep_tru")


def test_select_columns_without_a_match_fails():
    with pytest.raises(UnitsError, match="pre_16"):
        select_columns(["pre_20_dem_bid", "pre_20_rep_tru"], "pre_16")


def test_select_columns_with_two_matches_fails():
    with pytest.raises(UnitsError, match="pre_16_dem_cli, pre_16_dem_oth"):
        select_columns(["pre_16_dem_cli", "pre_16_dem_oth", "pre_16_rep_tru"], "pre_16")


# ---- load_units ----

VTD_CSV = """GEOID20,state,county,vtd,pop,vap,pre_16_rep_tru,pre_16_dem_cli,uss_16_dem_x,uss_16_rep_y,pre_20_dem_bid,pre_20_rep_tru
01001000010,AL,Autauga County,000010,1741,1334,529.2,164.7,1,2,172.8,510.4
01003008-03,AL,Baldwin County,008-03,10,8,2.5,1.5,1,2,3,4
"""


def test_load_units_reads_a_vtd_file(tmp_path):
    write(tmp_path / "census_vest" / "al_2020_vtd.csv", VTD_CSV)
    units = load_units(make_state("AL", "01", "vtd"), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["01001000010", "01003008-03"]   # text, leading zero kept
    assert units["vap"].dtype == np.int64 and units["vap"].tolist() == [1334, 8]
    assert units["d_pre_16"].tolist() == [164.7, 1.5]
    assert units["r_pre_20"].dtype == np.float64 and units["r_pre_20"].tolist() == [510.4, 4.0]
    assert units.attrs["empty_vote_fields"] == 0


BLOCK_CSV = """GEOID20,state,county,pop,vap,pre_16_dem_cli,pre_16_rep_tru,pre_20_dem_bid,pre_20_rep_tru,arv_16
060014001001000,CA,Alameda County,0,0,0,0,0,0,NA
060490003001452,CA,Modoc County,0,0,NA,NA,NA,NA,NA
060014001001001,CA,Alameda County,12,10,2.5,1.25,3,1,0
"""


def test_load_units_sets_empty_vote_fields_of_a_block_file_to_zero(tmp_path, caplog):
    write(tmp_path / "census_vest" / "ca_2020_block.csv", BLOCK_CSV)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        units = load_units(make_state("CA", "06", "block"), tmp_path)
    assert units["unit_id"].tolist() == ["060014001001000", "060490003001452", "060014001001001"]
    assert units.loc[1, ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]].tolist() == [0.0, 0.0, 0.0, 0.0]
    assert units.attrs["empty_vote_fields"] == 4
    assert units.attrs["empty_vote_units"] == 1
    assert "CA: 4 empty vote fields in 1 units set to 0" in caplog.text


def test_load_units_rejects_duplicate_unit_ids(tmp_path):
    write(tmp_path / "census_vest" / "al_2020_vtd.csv", VTD_CSV + VTD_CSV.splitlines()[1] + "\n")
    with pytest.raises(UnitsError, match="01001000010"):
        load_units(make_state("AL", "01", "vtd"), tmp_path)


def write_county_map(path, ids, vap=(9895.0, 44965.0)):
    path.parent.mkdir(parents=True, exist_ok=True)
    rdata.write_rds(path, {
        "GEOID": np.array(ids, dtype=object),
        "NAME": np.array(["Monroe County, West Virginia", "Jefferson County, West Virginia"], dtype=object),
        "state": np.array(["WV", "WV"], dtype=object),
        "county": np.array(["063", "037"], dtype=object),
        "vap": np.array(vap),
        "pre_20_rep_tru": np.array([5068.0, 15033.0]),
        "pre_20_dem_bid": np.array([1345.0, 12127.0]),
        "adj": [np.array([1], dtype=np.int32), np.array([0], dtype=np.int32)],
    })


def test_load_units_reads_counties_from_the_alarm_map(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["54063", "54037"])
    units = load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["54063", "54037"]
    assert units["vap"].tolist() == [9895, 44965]
    assert units["d_pre_20"].tolist() == [1345.0, 12127.0]


def test_load_units_needs_one_county_id_column(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["Monroe", "Jefferson"])
    with pytest.raises(UnitsError, match="county GEOID"):
        load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)


def test_load_units_rejects_fractional_vap(tmp_path):
    write_county_map(tmp_path / "alarm" / "WV_cd_2020_map.rds", ["54063", "54037"], vap=(9895.5, 44965.0))
    with pytest.raises(UnitsError, match="vap"):
        load_units(make_state("WV", "54", "rds_county", elections=("pre_20",)), tmp_path)


# ---- add_composite ----

def test_add_composite_sums_two_elections():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_16": [10.0], "r_pre_16": [20.0], "d_pre_20": [1.5], "r_pre_20": [2.5]})
    out = add_composite(df, ["pre_16", "pre_20"])
    # d = 10 + 1.5, r = 20 + 2.5
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (11.5, 22.5)
    assert "d" not in df.columns


def test_add_composite_with_one_election_copies_it():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_20": [1345.0], "r_pre_20": [5068.0]})
    out = add_composite(df, ["pre_20"])
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (1345.0, 5068.0)
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_units.py -v
```

Verwacht: `ERROR tests/test_units.py` met `ModuleNotFoundError: No module named 'gerry.units'`.

- [ ] **Step 3: Schrijf de implementatie**

`pipeline/gerry/units.py`:

```python
"""Votes per unit (VTD, block or county): column choice, loading, align_to_alarm and the composite."""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

import pandas as pd

from gerry.rds import read_rds_table

log = logging.getLogger(__name__)


class UnitsError(ValueError):
    pass


def select_columns(columns: Iterable[str], election: str) -> tuple[str, str]:
    """(dem, rep): the one column matching ^<election>_dem_ and the one matching ^<election>_rep_."""
    columns = list(columns)
    found = []
    for party in ("dem", "rep"):
        pattern = re.compile(rf"^{re.escape(election)}_{party}_")
        hits = [c for c in columns if pattern.match(c)]
        if len(hits) != 1:
            raise UnitsError(f"{election}: expected one column matching ^{election}_{party}_, "
                             f"found {len(hits)}: {', '.join(hits) or 'none'}")
        found.append(hits[0])
    return found[0], found[1]


def _county_id_column(table: pd.DataFrame, st) -> str:
    """The one text column that holds 5-character county GEOIDs of this state."""
    hits = []
    for name in table.columns:
        col = table[name]
        if (pd.api.types.is_string_dtype(col) and col.notna().all() and col.str.len().eq(5).all()
                and col.str.startswith(st.fips).all() and col.is_unique):
            hits.append(name)
    if len(hits) != 1:
        raise UnitsError(f"{st.postal}: expected one county GEOID column (5 characters, starting with "
                         f"{st.fips}) in {st.postal}_cd_2020_map.rds, found {hits}")
    return hits[0]


def _read_table(st, root: Path) -> tuple[pd.DataFrame, str]:
    """Raw unit table and the name of its id column."""
    if st.unit_source in ("vtd", "block"):
        path = Path(root) / "census_vest" / f"{st.postal.lower()}_2020_{st.unit_source}.csv"
        header = pd.read_csv(path, nrows=0, encoding="utf-8").columns
        wanted = ["GEOID20", "vap"] + [c for e in st.elections for c in select_columns(header, e)]
        return pd.read_csv(path, usecols=wanted, dtype={"GEOID20": str}, encoding="utf-8"), "GEOID20"
    if st.unit_source == "rds_county":
        table = read_rds_table(Path(root) / "alarm" / f"{st.postal}_cd_2020_map.rds")
        return table, _county_id_column(table, st)
    raise UnitsError(f"{st.postal}: unknown unit_source {st.unit_source!r}")


def load_units(st, root: Path) -> pd.DataFrame:
    """unit_id (str), vap (int64) and d_<e>, r_<e> (float64) for each election of the state.

    Empty vote fields become 0; their number is in .attrs["empty_vote_fields"] and
    .attrs["empty_vote_units"], and in the log."""
    table, id_col = _read_table(st, root)
    ids = table[id_col]
    if ids.isna().any():
        raise UnitsError(f"{st.postal}: {int(ids.isna().sum())} units without id in column {id_col}")
    dup = ids[ids.duplicated()]
    if len(dup):
        raise UnitsError(f"{st.postal}: duplicate unit ids: {', '.join(dup.head(5))}")
    vap = table["vap"]
    if vap.isna().any() or (vap % 1 != 0).any():
        raise UnitsError(f"{st.postal}: vap is missing or not a whole number in some units")
    out = pd.DataFrame({"unit_id": ids.astype(str), "vap": vap.round().astype("int64")})
    for e in st.elections:
        dem, rep = select_columns(table.columns, e)
        out[f"d_{e}"] = table[dem].astype("float64")
        out[f"r_{e}"] = table[rep].astype("float64")
    vote_cols = [f"{p}_{e}" for e in st.elections for p in ("d", "r")]
    empty = out[vote_cols].isna()
    n_fields, n_units = int(empty.sum().sum()), int(empty.any(axis=1).sum())
    out[vote_cols] = out[vote_cols].fillna(0.0)
    if n_fields:
        log.info("%s: %d empty vote fields in %d units set to 0", st.postal, n_fields, n_units)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_units}
    return out


def add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame:
    """Copy of df with d = sum of d_<e> and r = sum of r_<e> over the elections."""
    out = df.copy()
    out.attrs = dict(df.attrs)
    out["d"] = out[[f"d_{e}" for e in elections]].sum(axis=1)
    out["r"] = out[[f"r_{e}" for e in elections]].sum(axis=1)
    return out
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_units.py -v
```

Verwacht: `12 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/units.py tests/test_units.py
git commit -m "Load votes per unit for VTD, block and county units"
```

### Task 1.6: align_to_alarm

**Files:**
- Modify: `pipeline/gerry/units.py` (functie onderaan erbij)
- Modify: `tests/test_units.py` (importregels en tests onderaan)

**Interfaces:**
- Consumes: `AlignEntry`, `data_dir()` (fase 0); `read_rds_table` (taak 1.4); `load_units`, `select_columns`, `UnitsError` (taak 1.5).
- Produces: `align_to_alarm(units: pd.DataFrame, alarm_table: pd.DataFrame, entry: AlignEntry, elections: Sequence[str]) -> tuple[pd.DataFrame, pd.DataFrame]`: de geschaalde kopie van `units`, en een tabel met de kolommen `column`, `before`, `after`, één rij per stemkolom (`d_pre_16`, `r_pre_16`, ...), opgeteld over `entry.units`.

Per eenheid in `entry.units` (een tract) en per stemkolom: de stemmen van alle blokken met `unit_id[:entry.unit_len] == tract` worden vermenigvuldigd met `ALARM-totaal / bloktotaal`. ALARM's kolom vindt `select_columns` in de `.rds`-tabel. Hebben de blokken 0 stemmen en ALARM niet, dan is schalen onmogelijk: `UnitsError`.

In California heeft ALARM's tracttabel in beide tracts 0 stemmen. De stap zet de blokstemmen daar dus op 0. Het verschil per kolom is precies het getal uit de spec: 429,9 (D 2016), 1.431,4 (R 2016), 552,4 (D 2020) en 1.716,2 (R 2020). Daarna zijn de staatstotalen van het blokbestand gelijk aan die van ALARM's tracttabel.

- [ ] **Step 1: Schrijf de falende tests**

Vervang de importregels bovenaan `tests/test_units.py`:

```python
import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import StateConfig
from gerry.units import UnitsError, add_composite, load_units, select_columns
```

door:

```python
import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.config import AlignEntry, StateConfig, data_dir
from gerry.rds import read_rds_table
from gerry.units import UnitsError, add_composite, align_to_alarm, load_units, select_columns
```

Voeg onderaan `tests/test_units.py` toe:

```python
# ---- align_to_alarm (Task 1.6) ----

TRACT_ENTRY = AlignEntry(state="CA", rds="alarm/CA_cd_2020_map.rds", unit_column="tract", unit_len=11,
                         units=("06049000300",))


def block_units():
    return pd.DataFrame({
        "unit_id": ["060490003001000", "060490003001001", "060490003001452", "060014001001000"],
        "vap": [10, 30, 0, 5],
        "d_pre_16": [10.0, 30.0, 0.0, 7.0],
        "r_pre_16": [20.0, 20.0, 0.0, 9.0],
    })


def test_align_scales_each_column_to_the_tract_total():
    alarm = pd.DataFrame({"tract": ["06049000300", "06001400100"],
                          "pre_16_dem_cli": [20.0, 7.0], "pre_16_rep_tru": [40.0, 9.0]})
    units = block_units()
    out, diff = align_to_alarm(units, alarm, TRACT_ENTRY, ["pre_16"])
    # d: blocks in the tract hold 10 + 30 = 40, ALARM has 20, factor 0.5: 10 -> 5, 30 -> 15.
    # r: blocks hold 20 + 20 = 40, ALARM has 40, factor 1. The block outside the tract is untouched.
    assert out["d_pre_16"].tolist() == [5.0, 15.0, 0.0, 7.0]
    assert out["r_pre_16"].tolist() == [20.0, 20.0, 0.0, 9.0]
    assert diff.to_dict("records") == [{"column": "d_pre_16", "before": 40.0, "after": 20.0},
                                       {"column": "r_pre_16", "before": 40.0, "after": 40.0}]
    assert units["d_pre_16"].tolist() == [10.0, 30.0, 0.0, 7.0]


def test_align_to_a_zero_total_empties_the_tract():
    alarm = pd.DataFrame({"tract": ["06049000300"], "pre_16_dem_cli": [0.0], "pre_16_rep_tru": [0.0]})
    out, diff = align_to_alarm(block_units(), alarm, TRACT_ENTRY, ["pre_16"])
    assert out["d_pre_16"].tolist() == [0.0, 0.0, 0.0, 7.0]
    assert diff["after"].tolist() == [0.0, 0.0]


def test_align_needs_the_tract_in_the_alarm_table():
    alarm = pd.DataFrame({"tract": ["06001400100"], "pre_16_dem_cli": [7.0], "pre_16_rep_tru": [9.0]})
    with pytest.raises(UnitsError, match="06049000300"):
        align_to_alarm(block_units(), alarm, TRACT_ENTRY, ["pre_16"])


def test_align_cannot_scale_zero_votes_up():
    units = block_units()
    units["d_pre_16"] = [0.0, 0.0, 0.0, 7.0]
    alarm = pd.DataFrame({"tract": ["06049000300"], "pre_16_dem_cli": [5.0], "pre_16_rep_tru": [40.0]})
    with pytest.raises(UnitsError, match="no d_pre_16 votes"):
        align_to_alarm(units, alarm, TRACT_ENTRY, ["pre_16"])


CA_BLOCKS = data_dir() / "census_vest" / "ca_2020_block.csv"
CA_MAP = data_dir() / "alarm" / "CA_cd_2020_map.rds"


@pytest.mark.data
@pytest.mark.skipif(not (CA_BLOCKS.exists() and CA_MAP.exists()), reason="needs the California unit files")
def test_align_california_matches_the_spec():
    st = make_state("CA", "06", "block")
    entry = AlignEntry(state="CA", rds="alarm/CA_cd_2020_map.rds", unit_column="tract", unit_len=11,
                       units=("06049000300", "06093000200"))
    units = load_units(st, data_dir())
    alarm = read_rds_table(CA_MAP)
    out, diff = align_to_alarm(units, alarm, entry, st.elections)
    assert diff["column"].tolist() == ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    # Spec chapter 4: ALARM's tract data has 429.9, 1431.4, 552.4 and 1716.2 votes fewer.
    assert (diff["before"] - diff["after"]).round(1).tolist() == [429.9, 1431.4, 552.4, 1716.2]
    # After the step the block file and ALARM's tract table have the same statewide totals.
    for col, alarm_col in zip(diff["column"], ["pre_16_dem_cli", "pre_16_rep_tru", "pre_20_dem_bid", "pre_20_rep_tru"]):
        assert abs(out[col].sum() - alarm[alarm_col].sum()) < 0.5
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_units.py -v
```

Verwacht: `ERROR tests/test_units.py` met `ImportError: cannot import name 'align_to_alarm' from 'gerry.units'`.

- [ ] **Step 3: Schrijf de implementatie**

Voeg onderaan `pipeline/gerry/units.py` toe:

```python
def align_to_alarm(units: pd.DataFrame, alarm_table: pd.DataFrame, entry,
                   elections: Sequence[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Scale the unit votes inside each of entry.units, per column, to ALARM's total for that unit.

    Returns (scaled copy of units, table with columns column, before, after summed over entry.units)."""
    out = units.copy()
    out.attrs = dict(units.attrs)
    key = out["unit_id"].str[: entry.unit_len]
    listed = alarm_table[alarm_table[entry.unit_column].isin(entry.units)]
    counts = listed[entry.unit_column].value_counts()
    wrong = [u for u in entry.units if counts.get(u, 0) != 1]
    if wrong:
        raise UnitsError(f"{entry.state}: expected one row per unit in column {entry.unit_column} "
                         f"of {entry.rds}: {', '.join(wrong)}")
    alarm = listed.set_index(entry.unit_column)
    rows = []
    for e in elections:
        dem, rep = select_columns(alarm_table.columns, e)
        for col, alarm_col in ((f"d_{e}", dem), (f"r_{e}", rep)):
            before = after = 0.0
            for unit in entry.units:
                inside = key == unit
                if not inside.any():
                    raise UnitsError(f"{entry.state}: no units inside {unit}")
                current = float(out.loc[inside, col].sum())
                target = float(alarm.at[unit, alarm_col])
                if current == 0 and target != 0:
                    raise UnitsError(f"{entry.state}: {unit} has no {col} votes to scale to {target}")
                if current != 0:
                    out.loc[inside, col] = out.loc[inside, col] * (target / current)
                before += current
                after += target
            rows.append({"column": col, "before": before, "after": after})
            log.info("%s: align_to_alarm %s %.1f -> %.1f", entry.state, col, before, after)
    return out, pd.DataFrame(rows, columns=["column", "before", "after"])
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_units.py -v
```

Verwacht: `17 passed`. De datatest `test_align_california_matches_the_spec` duurt een paar seconden.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/units.py tests/test_units.py
git commit -m "Align California block votes with ALARM tract totals"
```

### Task 1.7: Blokken en blokbestanden lezen

**Files:**
- Create: `pipeline/gerry/blocks.py`
- Test: `tests/test_blocks.py`

**Interfaces:**
- Consumes: `data_dir()` (fase 0); `census/pl/nv2020.pl.zip`, `census/cd120.zip`, `census/cd118.zip` (taak 1.3) voor de datatests.
- Produces (in `gerry/blocks.py`):
  - `PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "POP100": 90, "INTPTLAT": 92, "INTPTLON": 93}` en `PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}`
  - Aanvulling op het contract: `class BlocksError(ValueError)` voor fouten in de blokbestanden en bij het koppelen.
  - `read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame`: kolommen `block_id` (str, 15 tekens), `vap` (int64), `vtd` (str, 6 tekens of leeg), `lat`, `lon` (float64).
  - `read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series`: index `block_id`, waarde de districtscode (2 tekens, ook `ZZ`), naam `district`.

`read_pl_blocks` leest de zip zonder uit te pakken. Uit `{st}geo2020.pl` (scheidingsteken `|`, geen header, latin-1, geen aanhalingstekens) de records met SUMLEV 750; uit `{st}000022020.pl` LOGRECNO en P0030001. Bij het inlezen controleert de functie de veldposities: GEOCODE heeft 15 tekens, VAP is nergens groter dan POP100, en de som van VAP over de blokken is gelijk aan het staatsrecord (SUMLEV 040). In Nevada is het VTD-veld 77 voor alle 57.409 blokken gelijk aan de VTD-code uit Census' block assignment file.

`read_bef` voor `cd120` leest `NationalCD120.txt` één keer per proces (8.174.955 rijen, ongeveer 5 seconden) met de C-engine, `usecols=["GEOID","CDFP"]` en `dtype=str`, en verdeelt het naar de eerste twee tekens van GEOID. Voor `cd118` leest het `{fips}_{postal}_CD118.txt` met `skipinitialspace=True`, omdat de header `GEOID, CDFP` een spatie heeft. CD120 en CD118 hebben voor elke staat evenveel blokken, en `ZZ` komt alleen voor in CT, IL en NH. Voor de acht staten uit de haalbaarheidscontrole is dat aantal ook gelijk aan het aantal blokken in P.L. 94-171.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_blocks.py`:

```python
import zipfile

import numpy as np
import pandas as pd
import pytest

from gerry.blocks import PL_GEO_FIELDS, BlocksError, read_bef, read_pl_blocks
from gerry.config import data_dir


# ---- P.L. 94-171 fixtures: geo header with 97 fields, segment 2 with 152 fields ----

def geo_line(sumlev, logrecno, geocode, vtd="", pop100="0", lat="+39.0000000", lon="-117.0000000", name=""):
    fields = [""] * 97
    fields[0], fields[1] = "PLST", "NV"
    fields[PL_GEO_FIELDS["SUMLEV"]] = sumlev
    fields[PL_GEO_FIELDS["LOGRECNO"]] = logrecno
    fields[PL_GEO_FIELDS["GEOCODE"]] = geocode
    fields[PL_GEO_FIELDS["VTD"]] = vtd
    fields[PL_GEO_FIELDS["POP100"]] = pop100
    fields[PL_GEO_FIELDS["INTPTLAT"]] = lat
    fields[PL_GEO_FIELDS["INTPTLON"]] = lon
    fields[87] = name
    return "|".join(fields)


def seg2_line(logrecno, vap):
    return "|".join(["PLST", "NV", "000", "02", logrecno, str(vap)] + ["0"] * 146)


def make_pl_zip(path, state_vap=8, block2_pop="0"):
    geo = [
        geo_line("040", "0000001", "32", pop100="10", name="Nevada"),
        geo_line("050", "0000002", "32001", pop100="10", name="Doña Ana County"),   # latin-1 byte
        geo_line("750", "0000003", "320010001001000", vtd="000010", pop100="10", lat="+39.5", lon="-117.25"),
        geo_line("750", "0000004", "320010001001001", vtd="008-03", pop100=block2_pop),
    ]
    seg2 = [seg2_line("0000001", state_vap), seg2_line("0000002", 8), seg2_line("0000003", 8),
            seg2_line("0000004", 0)]
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("nvgeo2020.pl", ("\r\n".join(geo) + "\r\n").encode("latin-1"))
        zf.writestr("nv000022020.pl", ("\r\n".join(seg2) + "\r\n").encode("latin-1"))
    return path


def test_read_pl_blocks_returns_blocks_with_vap(tmp_path):
    blocks = read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip"), "nv")
    assert list(blocks.columns) == ["block_id", "vap", "vtd", "lat", "lon"]
    assert blocks["block_id"].tolist() == ["320010001001000", "320010001001001"]
    assert blocks["vap"].dtype == np.int64 and blocks["vap"].tolist() == [8, 0]
    assert blocks["vtd"].tolist() == ["000010", "008-03"]
    assert blocks["lat"].tolist() == [39.5, 39.0] and blocks["lon"].tolist() == [-117.25, -117.0]


def test_read_pl_blocks_checks_the_state_record(tmp_path):
    with pytest.raises(BlocksError, match="8.*9"):
        read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip", state_vap=9), "nv")


def test_read_pl_blocks_rejects_vap_above_population(tmp_path):
    # block 1 has POP100 10 and VAP 8; with POP100 5 the field positions must be wrong
    path = make_pl_zip(tmp_path / "nv2020.pl.zip")
    with zipfile.ZipFile(path) as zf:
        geo = zf.read("nvgeo2020.pl").decode("latin-1").replace("|10|", "|5|")
        seg2 = zf.read("nv000022020.pl")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("nvgeo2020.pl", geo.encode("latin-1"))
        zf.writestr("nv000022020.pl", seg2)
    with pytest.raises(BlocksError, match="POP100"):
        read_pl_blocks(path, "nv")


# ---- block equivalency files ----

def make_cd120_zip(path):
    text = ("GEOID,STATEFP,COUNTYFP,TRACTCE,BLOCKCE,CDFP\r\n"
            "010010201001000,01,001,020100,1000,07\r\n"
            "010010201001001,01,001,020100,1001,02\r\n"
            "320010001001000,32,001,000100,1000,02\r\n"
            "090019900000100,09,001,990000,0100,ZZ\r\n")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("NationalCD120.txt", text)
        zf.writestr("CD120_01.txt", "not read")
    return path


def test_read_bef_cd120_keeps_leading_zeros(tmp_path):
    bef = read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd120", "01", "AL")
    assert bef.name == "district" and bef.index.name == "block_id"
    assert bef.to_dict() == {"010010201001000": "07", "010010201001001": "02"}


def test_read_bef_cd120_keeps_zz(tmp_path):
    bef = read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd120", "09", "CT")
    assert bef.to_dict() == {"090019900000100": "ZZ"}


def test_read_bef_cd118_reads_the_state_file(tmp_path):
    path = tmp_path / "cd118.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("29_MO_CD118.txt", "GEOID, CDFP\r\n290019501001000,06\r\n290019501001001,06\r\n")
        zf.writestr("32_NV_CD118.txt", "GEOID, CDFP\r\n320010001001000,02\r\n")
    bef = read_bef(path, "cd118", "29", "MO")
    assert bef.to_dict() == {"290019501001000": "06", "290019501001001": "06"}


def test_read_bef_rejects_an_unknown_kind(tmp_path):
    with pytest.raises(BlocksError, match="cd119"):
        read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd119", "01", "AL")


NV_PL = data_dir() / "census" / "pl" / "nv2020.pl.zip"
CD120 = data_dir() / "census" / "cd120.zip"
CD118 = data_dir() / "census" / "cd118.zip"


@pytest.mark.data
@pytest.mark.skipif(not NV_PL.exists(), reason="needs census/pl/nv2020.pl.zip")
def test_nevada_blocks():
    blocks = read_pl_blocks(NV_PL, "nv")
    assert len(blocks) == 57409
    assert blocks["vap"].sum() == 2413326
    assert blocks["block_id"].str.len().eq(15).all() and blocks["vtd"].str.len().eq(6).all()


@pytest.mark.data
@pytest.mark.skipif(not (CD120.exists() and CD118.exists()), reason="needs census/cd120.zip and cd118.zip")
def test_nevada_block_equivalency_files():
    cd120 = read_bef(CD120, "cd120", "32", "NV")
    cd118 = read_bef(CD118, "cd118", "32", "NV")
    assert len(cd120) == 57409
    assert cd120.value_counts().sort_index().to_dict() == {"01": 7655, "02": 27405, "03": 7124, "04": 15225}
    assert cd118.sort_index().equals(cd120.sort_index())   # Nevada has not redrawn since 2021
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -v
```

Verwacht: `ERROR tests/test_blocks.py` met `ModuleNotFoundError: No module named 'gerry.blocks'`.

- [ ] **Step 3: Schrijf de implementatie**

`pipeline/gerry/blocks.py`:

```python
"""Census blocks: P.L. 94-171 (VAP, VTD code, interior point) and the block equivalency files."""
from __future__ import annotations

import csv
import functools
import zipfile
from pathlib import Path

import pandas as pd

# 0-based field positions in the pipe-delimited 2020 P.L. 94-171 files
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "POP100": 90, "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}


class BlocksError(ValueError):
    pass


def _read_pipe(zf: zipfile.ZipFile, member: str, fields: dict[str, int]) -> pd.DataFrame:
    with zf.open(member) as fh:
        table = pd.read_csv(fh, sep="|", header=None, usecols=sorted(fields.values()), dtype=str,
                            encoding="latin-1", keep_default_na=False, quoting=csv.QUOTE_NONE, engine="c")
    return table.rename(columns={pos: name for name, pos in fields.items()})


def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame:
    """block_id (str 15), vap (int64), vtd (str), lat, lon (float64) for every block (SUMLEV 750).

    Read from the zip without extracting. The block VAP must add up to the state record (SUMLEV 040)."""
    st = st.lower()
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st}geo2020.pl", PL_GEO_FIELDS)
        seg2 = _read_pipe(zf, f"{st}000022020.pl", PL_SEG2_FIELDS)
    if not seg2["LOGRECNO"].is_unique:
        raise BlocksError(f"{st}: LOGRECNO is not unique in segment 2")
    vap_of = pd.to_numeric(seg2.set_index("LOGRECNO")["P0030001"]).astype("int64")
    state = geo[geo["SUMLEV"] == "040"]
    blocks = geo[geo["SUMLEV"] == "750"]
    if len(state) != 1 or blocks.empty:
        raise BlocksError(f"{st}: expected one state record and some blocks, found {len(state)} and {len(blocks)}")
    vap = blocks["LOGRECNO"].map(vap_of)
    if vap.isna().any():
        raise BlocksError(f"{st}: {int(vap.isna().sum())} blocks have no segment 2 record")
    out = pd.DataFrame({
        "block_id": blocks["GEOCODE"].to_numpy(),
        "vap": vap.astype("int64").to_numpy(),
        "vtd": blocks["VTD"].to_numpy(),
        "lat": pd.to_numeric(blocks["INTPTLAT"]).to_numpy(),
        "lon": pd.to_numeric(blocks["INTPTLON"]).to_numpy(),
    })
    pop = pd.to_numeric(blocks["POP100"]).to_numpy()
    if not out["block_id"].str.len().eq(15).all() or not out["block_id"].is_unique:
        raise BlocksError(f"{st}: block GEOCODE is not a unique 15-character code")
    if (out["vap"].to_numpy() > pop).any():
        raise BlocksError(f"{st}: VAP above POP100 in {int((out['vap'].to_numpy() > pop).sum())} blocks; "
                          "check PL_GEO_FIELDS and PL_SEG2_FIELDS")
    state_vap = int(vap_of[state["LOGRECNO"].iloc[0]])
    if int(out["vap"].sum()) != state_vap:
        raise BlocksError(f"{st}: block VAP adds up to {int(out['vap'].sum())}, state record says {state_vap}")
    return out


@functools.lru_cache(maxsize=1)
def _national_cd120(zip_path: str) -> dict[str, pd.DataFrame]:
    """NationalCD120.txt, read once and split by state FIPS (first two GEOID characters)."""
    with zipfile.ZipFile(zip_path) as zf, zf.open("NationalCD120.txt") as fh:
        table = pd.read_csv(fh, engine="c", usecols=["GEOID", "CDFP"], dtype=str, keep_default_na=False)
    return {fips: part for fips, part in table.groupby(table["GEOID"].str[:2], sort=False)}


def read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series:
    """Block -> district code for one state. cd120: national file; cd118: {fips}_{postal}_CD118.txt."""
    if kind == "cd120":
        table = _national_cd120(str(Path(zip_path).resolve())).get(fips)
        if table is None:
            raise BlocksError(f"{postal}: no blocks with FIPS {fips} in {zip_path}")
    elif kind == "cd118":
        with zipfile.ZipFile(zip_path) as zf, zf.open(f"{fips}_{postal}_CD118.txt") as fh:
            # the header is "GEOID, CDFP", with a space
            table = pd.read_csv(fh, engine="c", usecols=["GEOID", "CDFP"], dtype=str, keep_default_na=False,
                                skipinitialspace=True)
    else:
        raise BlocksError(f"{postal}: unknown block equivalency file {kind!r}")
    geoid, cdfp = table["GEOID"], table["CDFP"]
    if not (geoid.str.len().eq(15).all() and geoid.str.startswith(fips).all() and geoid.is_unique):
        raise BlocksError(f"{postal}: {kind} GEOIDs are not unique 15-character codes starting with {fips}")
    if not cdfp.str.len().eq(2).all():
        raise BlocksError(f"{postal}: {kind} has district codes that are not 2 characters")
    return pd.Series(cdfp.to_numpy(), index=pd.Index(geoid.to_numpy(), name="block_id"), name="district")
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -v
```

Verwacht: `9 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/blocks.py tests/test_blocks.py
git commit -m "Read P.L. 94-171 blocks and block equivalency files"
```

### Task 1.8: Van eenheden naar districten

**Files:**
- Modify: `pipeline/gerry/blocks.py` (importregels en functies onderaan)
- Modify: `tests/test_blocks.py` (importregels en tests onderaan)

**Interfaces:**
- Consumes: `BlocksError`, de uitvoer van `read_pl_blocks` en `read_bef` (taak 1.7); een eenhedentabel zoals `load_units` plus `add_composite` die maken (taak 1.5).
- Produces:
  - `unit_of_block(blocks: pd.DataFrame, unit_source: str, fips: str) -> pd.Series`: index `block_id`, waarde `unit_id`, naam `unit_id`.
  - `block_weighted(units, blocks, unit_of, district_of, vote_cols) -> pd.DataFrame`: kolom `district` plus `vote_cols`, één rij per district van de kaart (zonder `ZZ`), gesorteerd. Aanvulling: `.attrs` met `split_units`, `zero_vap_units`, `zero_vap_split_units` en `units_without_blocks`.
  - `whole_unit(units, blocks, unit_of, district_of, vote_cols) -> pd.DataFrame`: dezelfde vorm.

Regels (spec, koppelregels):

- `unit_of_block`: `vtd` geeft GEOCODE[:5] + VTD-code, en een blok zonder VTD-code is een fout. `block` geeft het blok zelf, `rds_county` de county (GEOCODE[:5]).
- Blokken met district `ZZ` vallen eerst weg. Een eenheid met stemmen zonder overgebleven blok is een fout; een eenheid zonder stemmen en zonder blok komt in `units_without_blocks`. Een blok dat in het blokbestand ontbreekt, is een fout.
- `block_weighted`: de stemmen van een eenheid gaan naar haar blokken naar verhouding van de blok-VAP; heeft de eenheid geen VAP, dan naar verhouding van het aantal blokken.
- `whole_unit`: een eenheid gaat in haar geheel naar het district met de meeste blok-VAP, dan de meeste blokken, dan de laagste districtscode.

- [ ] **Step 1: Schrijf de falende tests**

Vervang de importregels bovenaan `tests/test_blocks.py`:

```python
import zipfile

import numpy as np
import pandas as pd
import pytest

from gerry.blocks import PL_GEO_FIELDS, BlocksError, read_bef, read_pl_blocks
from gerry.config import data_dir
```

door:

```python
import zipfile

import numpy as np
import pandas as pd
import pytest

from gerry.blocks import (PL_GEO_FIELDS, BlocksError, block_weighted, read_bef, read_pl_blocks, unit_of_block,
                          whole_unit)
from gerry.config import data_dir
```

Voeg onderaan `tests/test_blocks.py` toe:

```python
# ---- Task 1.8: blocks to units, votes to districts ----

def pl_blocks(ids, vtds=None, vaps=None):
    n = len(ids)
    return pd.DataFrame({"block_id": ids, "vap": vaps or [0] * n, "vtd": vtds or [""] * n,
                         "lat": [0.0] * n, "lon": [0.0] * n})


def test_unit_of_block_for_vtd_states_is_county_plus_vtd():
    blocks = pl_blocks(["320010001001000", "320039501001000"], vtds=["000010", "008-03"])
    unit_of = unit_of_block(blocks, "vtd", "32")
    assert unit_of.index.name == "block_id"
    assert unit_of.to_dict() == {"320010001001000": "32001000010", "320039501001000": "32003008-03"}


def test_unit_of_block_rejects_a_blank_vtd_code():
    blocks = pl_blocks(["320010001001000", "320010001001001"], vtds=["000010", "      "])
    with pytest.raises(BlocksError, match="320010001001001"):
        unit_of_block(blocks, "vtd", "32")


def test_unit_of_block_for_block_states_is_the_block():
    blocks = pl_blocks(["060014001001000"])
    assert unit_of_block(blocks, "block", "06").to_dict() == {"060014001001000": "060014001001000"}


def test_unit_of_block_for_county_units_is_the_county():
    blocks = pl_blocks(["540630001001000", "540370001001000"])
    assert unit_of_block(blocks, "rds_county", "54").tolist() == ["54063", "54037"]


def test_unit_of_block_rejects_blocks_of_another_state():
    with pytest.raises(BlocksError, match="32"):
        unit_of_block(pl_blocks(["060014001001000"]), "block", "32")


VOTES = ["d", "r"]


def weighted_case():
    # U1: VAP 30 in two districts. U2: no VAP, three blocks. U3: one block in 02 and one ZZ block.
    blocks = pl_blocks(["b1", "b2", "b3", "b4", "b5", "b6", "b7"], vaps=[10, 20, 0, 0, 0, 5, 5])
    unit_of = pd.Series(["U1", "U1", "U2", "U2", "U2", "U3", "U3"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "01", "02", "02", "02", "ZZ"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 10],
                          "d": [30.0, 6.0, 10.0], "r": [60.0, 0.0, 10.0]})
    return units, blocks, unit_of, district_of


def test_block_weighted_splits_by_vap_and_by_block_count():
    out = block_weighted(*weighted_case(), VOTES)
    # 01: U1 gets 10/30 of (30, 60) = (10, 20); U2 has no VAP, 1 of 3 blocks: (2, 0).
    # 02: U1 20/30 = (20, 40); U2 2 of 3 blocks = (4, 0); U3 all of (10, 10) since ZZ goes first.
    assert out["district"].tolist() == ["01", "02"]
    assert out["d"].tolist() == pytest.approx([12.0, 34.0])
    assert out["r"].tolist() == pytest.approx([20.0, 50.0])
    assert out.attrs == {"split_units": 2, "zero_vap_units": 1, "zero_vap_split_units": 1,
                         "units_without_blocks": 0}


def test_block_weighted_needs_a_block_for_every_unit_with_votes():
    units, blocks, unit_of, district_of = weighted_case()
    district_of["b6"] = "ZZ"
    with pytest.raises(BlocksError, match="U3"):
        block_weighted(units, blocks, unit_of, district_of, VOTES)


def test_block_weighted_logs_a_unit_without_votes_or_blocks():
    units, blocks, unit_of, district_of = weighted_case()
    district_of["b6"] = "ZZ"
    units.loc[2, ["d", "r"]] = 0.0
    out = block_weighted(units, blocks, unit_of, district_of, VOTES)
    assert out.attrs["units_without_blocks"] == 1
    assert out["d"].sum() == pytest.approx(36.0)


def test_block_weighted_needs_every_block_in_the_equivalency_file():
    units, blocks, unit_of, district_of = weighted_case()
    with pytest.raises(BlocksError, match="b7"):
        block_weighted(units, blocks, unit_of, district_of.drop("b7"), VOTES)


def test_whole_unit_assigns_by_vap_then_blocks_then_lowest_district():
    blocks = pl_blocks([f"b{i}" for i in range(1, 11)], vaps=[10, 20, 0, 0, 0, 5, 5, 5, 5, 0])
    unit_of = pd.Series(["A", "A", "B", "B", "B", "C", "C", "D", "D", "D"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "01", "02", "02", "01", "03", "03", "02", "02"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["A", "B", "C", "D"], "vap": [30, 0, 10, 10],
                          "d": [1.0, 3.0, 5.0, 7.0], "r": [2.0, 4.0, 6.0, 8.0]})
    out = whole_unit(units, blocks, unit_of, district_of, VOTES)
    # A -> 02 (VAP 20 against 10). B has no VAP -> 02 (two blocks against one).
    # C: VAP 5 and 5, one block each -> 01, the lowest. D: VAP 5 and 5 -> 02 (two blocks against one).
    assert out["district"].tolist() == ["01", "02", "03"]
    assert out["d"].tolist() == [5.0, 11.0, 0.0]
    assert out["r"].tolist() == [6.0, 14.0, 0.0]
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -v
```

Verwacht: `ERROR tests/test_blocks.py` met `ImportError: cannot import name 'block_weighted' from 'gerry.blocks'`.

- [ ] **Step 3: Schrijf de implementatie**

Vervang de importregels bovenaan `pipeline/gerry/blocks.py`:

```python
"""Census blocks: P.L. 94-171 (VAP, VTD code, interior point) and the block equivalency files."""
from __future__ import annotations

import csv
import functools
import zipfile
from pathlib import Path

import pandas as pd
```

door:

```python
"""Census blocks: P.L. 94-171 (VAP, VTD code, interior point) and the block equivalency files."""
from __future__ import annotations

import csv
import functools
import zipfile
from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd
```

Voeg onderaan `pipeline/gerry/blocks.py` toe:

```python
def unit_of_block(blocks: pd.DataFrame, unit_source: str, fips: str) -> pd.Series:
    """block_id -> unit_id. vtd: county GEOID + VTD code; block: the block; rds_county: the county."""
    ids = blocks["block_id"]
    if not ids.str.startswith(fips).all():
        raise BlocksError(f"blocks that do not start with FIPS {fips}, e.g. {ids[~ids.str.startswith(fips)].iloc[0]}")
    if unit_source == "vtd":
        blank = blocks["vtd"].str.strip() == ""
        if blank.any():
            raise BlocksError(f"{fips}: {int(blank.sum())} blocks without VTD code, e.g. {ids[blank].iloc[0]}")
        units = ids.str[:5] + blocks["vtd"]
    elif unit_source == "block":
        units = ids
    elif unit_source == "rds_county":
        units = ids.str[:5]
    else:
        raise BlocksError(f"unknown unit_source {unit_source!r}")
    return pd.Series(units.to_numpy(), index=pd.Index(ids.to_numpy(), name="block_id"), name="unit_id")


def _linked_blocks(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str]) -> tuple[pd.DataFrame, pd.DataFrame, list[str], int]:
    """Blocks outside ZZ with unit_id and district, the votes per unit, the district codes of the map,
    and the number of units without votes and without blocks. Units with votes must keep a block."""
    b = pd.DataFrame({"block_id": blocks["block_id"].to_numpy(), "vap": blocks["vap"].to_numpy()})
    b["unit_id"] = b["block_id"].map(unit_of)
    b["district"] = b["block_id"].map(district_of)
    for col, source in (("unit_id", "unit_of"), ("district", "the block equivalency file")):
        missing = b.loc[b[col].isna(), "block_id"]
        if len(missing):
            raise BlocksError(f"{len(missing)} blocks missing from {source}, e.g. {missing.iloc[0]}")
    b = b[b["district"] != "ZZ"]
    votes = units.set_index("unit_id")[list(vote_cols)]
    has_votes = (votes != 0).any(axis=1)
    linked = votes.index.isin(b["unit_id"].unique())
    orphans = votes.index[has_votes.to_numpy() & ~linked]
    if len(orphans):
        raise BlocksError(f"{len(orphans)} units with votes have no block outside ZZ, e.g. {orphans[0]}")
    without_blocks = int((~has_votes.to_numpy() & ~linked).sum())
    b = b[b["unit_id"].isin(votes.index)]
    districts = sorted(set(district_of.unique()) - {"ZZ"})
    return b, votes, districts, without_blocks


def block_weighted(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str]) -> pd.DataFrame:
    """Votes per district: each unit's votes go to its blocks by block VAP, or by block count
    if the unit has no VAP. Counts for the log are in .attrs."""
    b, votes, districts, without_blocks = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per_unit = b.groupby("unit_id").agg(unit_vap=("vap", "sum"), n_blocks=("vap", "size"))
    b = b.join(per_unit, on="unit_id")
    has_vap = (b["unit_vap"] > 0).to_numpy()
    weight = np.where(has_vap, b["vap"].to_numpy() / np.where(has_vap, b["unit_vap"].to_numpy(), 1),
                      1.0 / b["n_blocks"].to_numpy())
    block_votes = votes.loc[b["unit_id"]].to_numpy() * weight[:, None]
    totals = (pd.DataFrame(block_votes, columns=list(vote_cols)).groupby(b["district"].to_numpy()).sum()
              .reindex(districts, fill_value=0.0))
    out = totals.rename_axis("district").reset_index()
    n_districts = b.groupby("unit_id")["district"].nunique()
    split = n_districts.index[n_districts > 1]
    zero_vap = per_unit.index[per_unit["unit_vap"] == 0]
    out.attrs = {"split_units": len(split), "zero_vap_units": len(zero_vap),
                 "zero_vap_split_units": int(split.isin(zero_vap).sum()), "units_without_blocks": without_blocks}
    return out


def whole_unit(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
               vote_cols: Sequence[str]) -> pd.DataFrame:
    """Votes per district with each unit wholly in one district: most block VAP, then most blocks,
    then the lowest district code."""
    b, votes, districts, _ = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per = b.groupby(["unit_id", "district"]).agg(vap=("vap", "sum"), n=("vap", "size")).reset_index()
    per = per.sort_values(["unit_id", "vap", "n", "district"], ascending=[True, False, False, True])
    choice = per.drop_duplicates("unit_id").set_index("unit_id")["district"]
    totals = votes.loc[choice.index].groupby(choice.to_numpy()).sum().reindex(districts, fill_value=0.0)
    return totals.rename_axis("district").reset_index()
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -v
```

Verwacht: `19 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/blocks.py tests/test_blocks.py
git commit -m "Assign unit votes to districts by block VAP and by whole unit"
```

### Task 1.9: Ensembles uit de stats-bestanden

**Files:**
- Create: `pipeline/gerry/ensemble.py`
- Test: `tests/test_ensemble.py`

**Interfaces:**
- Consumes: `StateConfig`, `data_dir()` (fase 0, taak 0.4); `CheckError(check: str, state: str, detail: str)` uit `gerry/checks.py` (fase 0, taak 0.5; tekst `"{check} failed for {state}: {detail}"`); `select_columns`, `add_composite` (taak 1.5).
- Produces (in `gerry/ensemble.py`): `N_PLANS = 5000`, `REFERENCE_DRAW = "cd_2020"` (aanvullingen op het contract), `read_stats(path: Path) -> pd.DataFrame` en `district_votes(stats: pd.DataFrame, st: StateConfig) -> tuple[pd.DataFrame, pd.DataFrame]`: `(ensemble, reference)` met de kolommen `state`, `draw`, `district`, `d_<e>`, `r_<e>`, `d`, `r`.

Wat we weten van de stats-bestanden: R schrijft getallen met spaties ervoor, dus `skipinitialspace=True`. `draw` is tekst: `cd_2020` voor ALARM's referentiekaart (de kaart van 2022), daarna de plannen. De nummers lopen niet altijd van 1 tot 5000 (TX begint bij 2, NC springt van 2500 naar 10001, UT mist 2501 tot 3000), dus selecteren we op `draw != "cd_2020"`. Districtnummers worden tekst van twee tekens.

Structuurcontroles (`CheckError`, check `ensemble_structure`): elk plan heeft precies de districten 01 tot en met `seats`, één keer; elk plan komt één keer voor; er zijn precies 5.000 plannen; de referentiekaart heeft dezelfde vorm. Een lege stemwaarde geeft check `ensemble_votes`.

`CheckError` staat al in `pipeline/gerry/checks.py` (taak 0.5). Deze taak verandert dat bestand niet.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_ensemble.py`:

```python
import pandas as pd
import pytest

from gerry.checks import CheckError
from gerry.config import StateConfig, data_dir
from gerry.ensemble import N_PLANS, district_votes, read_stats


def make_state(postal="NV", seats=2, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips="32", seats=seats, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_source="vtd", extra_maps=(), notes=())


def write_stats(path, draws, seats=2, skip=None):
    """ALARM-style stats file: values padded with spaces as R's format() writes them.
    `skip` = (draw, district) to leave out."""
    lines = ["draw,district,total_pop,chain,pre_16_dem_cli,pre_16_rep_tru,uss_16_dem_x,pre_20_dem_bid,pre_20_rep_tru"]
    for k in range(1, seats + 1):
        lines.append(f'cd_2020,{k},  1000,"NA",  {100 + k},   {200 + k},  5,  {300 + k},   {400 + k}')
    for draw in draws:
        for k in range(1, seats + 1):
            if (draw, k) != skip:
                lines.append(f"{draw},{k},  1000, 1,  {10 + k},   {20 + k},  5,  {30 + k},   {40 + k}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_read_stats_keeps_draw_as_text(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=[2, 3]))
    assert stats["draw"].tolist()[:3] == ["cd_2020", "cd_2020", "2"]
    assert stats["pre_16_dem_cli"].tolist()[:2] == [101, 102]


def test_district_votes_splits_ensemble_and_reference(tmp_path):
    # Draw ids start at 2, as in Texas: what counts is 5,000 distinct draws.
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(2, N_PLANS + 2)))
    ensemble, reference = district_votes(stats, make_state())
    cols = ["state", "draw", "district", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"]
    assert list(ensemble.columns) == cols and list(reference.columns) == cols
    assert len(ensemble) == 2 * N_PLANS
    assert ensemble["draw"].iloc[0] == "2" and ensemble["draw"].iloc[-1] == "5001"
    assert reference.to_dict("records") == [
        # d = 101 + 301, r = 201 + 401
        {"state": "NV", "draw": "cd_2020", "district": "01", "d_pre_16": 101.0, "r_pre_16": 201.0,
         "d_pre_20": 301.0, "r_pre_20": 401.0, "d": 402.0, "r": 602.0},
        {"state": "NV", "draw": "cd_2020", "district": "02", "d_pre_16": 102.0, "r_pre_16": 202.0,
         "d_pre_20": 302.0, "r_pre_20": 402.0, "d": 404.0, "r": 604.0},
    ]


def test_district_votes_with_one_election(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS + 1)))
    ensemble, _ = district_votes(stats, make_state(postal="WV", elections=("pre_20",)))
    assert list(ensemble.columns) == ["state", "draw", "district", "d_pre_20", "r_pre_20", "d", "r"]
    assert ensemble[["d", "r"]].iloc[0].tolist() == [31.0, 41.0]


def test_district_votes_needs_every_district_in_every_plan(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS + 1), skip=(17, 2)))
    with pytest.raises(CheckError, match="draw 17"):
        district_votes(stats, make_state())


def test_district_votes_needs_5000_plans(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=range(1, N_PLANS)))
    with pytest.raises(CheckError, match="4999 plans"):
        district_votes(stats, make_state())


def test_district_votes_rejects_a_repeated_draw(tmp_path):
    stats = read_stats(write_stats(tmp_path / "s.csv", draws=[*range(1, N_PLANS + 1), 9]))
    with pytest.raises(CheckError, match="draw 9"):
        district_votes(stats, make_state())


NV_STATS = data_dir() / "alarm" / "NV_cd_2020_stats.csv"


@pytest.mark.data
@pytest.mark.skipif(not NV_STATS.exists(), reason="needs alarm/NV_cd_2020_stats.csv")
def test_nevada_ensemble_matches_the_feasibility_check():
    ensemble, reference = district_votes(read_stats(NV_STATS), make_state(seats=4))
    assert len(ensemble) == 4 * N_PLANS and len(reference) == 4
    seats = (ensemble["d"] > ensemble["r"]).groupby(ensemble["draw"]).sum()
    assert seats.value_counts().sort_index().to_dict() == {1: 13, 2: 1901, 3: 3086}
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_ensemble.py -v
```

Verwacht: `ERROR tests/test_ensemble.py` met `ModuleNotFoundError: No module named 'gerry.ensemble'`.

- [ ] **Step 3: Schrijf de implementatie**

`pipeline/gerry/ensemble.py`:

```python
"""ALARM stats files: votes per district per plan for the ensemble and for ALARM's reference map."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from gerry.checks import CheckError
from gerry.units import add_composite, select_columns

N_PLANS = 5000
REFERENCE_DRAW = "cd_2020"   # the map in effect in 2022, not part of the ensemble


def read_stats(path: Path) -> pd.DataFrame:
    """The stats CSV. R pads numbers with spaces, hence skipinitialspace. Draw ids are text."""
    return pd.read_csv(path, skipinitialspace=True, dtype={"draw": str}, low_memory=False, encoding="utf-8")


def _district_codes(values: pd.Series, postal: str) -> pd.Series:
    numbers = pd.to_numeric(values)
    if numbers.isna().any() or (numbers % 1 != 0).any():
        raise CheckError("ensemble_structure", postal, "district numbers are not whole numbers")
    return numbers.astype("int64").map("{:02d}".format)


def _check_plans(plans: pd.DataFrame, seats: int, postal: str, label: str) -> None:
    """Each draw has the districts 01..seats exactly once."""
    expected = {f"{k:02d}" for k in range(1, seats + 1)}
    odd = plans[~plans["district"].isin(expected)]
    if len(odd):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {odd['draw'].iloc[0]} has district {odd['district'].iloc[0]}")
    twice = plans[plans.duplicated(["draw", "district"])]
    if len(twice):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {twice['draw'].iloc[0]} has district {twice['district'].iloc[0]} twice")
    rows = plans.groupby("draw").size()
    short = rows[rows != seats]
    if len(short):
        raise CheckError("ensemble_structure", postal,
                         f"{label} draw {short.index[0]} has {short.iloc[0]} districts, expected {seats}")


def district_votes(stats: pd.DataFrame, st) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(ensemble, reference) with columns state, draw, district, d_<e>, r_<e>, d, r."""
    out = pd.DataFrame({"state": st.postal, "draw": stats["draw"].astype(str).str.strip(),
                        "district": _district_codes(stats["district"], st.postal)})
    for e in st.elections:
        dem, rep = select_columns(stats.columns, e)
        for col, source in ((f"d_{e}", dem), (f"r_{e}", rep)):
            values = pd.to_numeric(stats[source])
            if values.isna().any():
                raise CheckError("ensemble_votes", st.postal, f"{source} has {int(values.isna().sum())} empty values")
            out[col] = values.astype("float64")
    out = add_composite(out, st.elections)
    is_reference = out["draw"] == REFERENCE_DRAW
    ensemble = out[~is_reference].reset_index(drop=True)
    reference = out[is_reference].reset_index(drop=True)
    _check_plans(ensemble, st.seats, st.postal, "ensemble")
    _check_plans(reference, st.seats, st.postal, "reference")
    if reference.empty:
        raise CheckError("ensemble_structure", st.postal, f"no rows with draw {REFERENCE_DRAW}")
    n_plans = ensemble["draw"].nunique()
    if n_plans != N_PLANS:
        raise CheckError("ensemble_structure", st.postal, f"{n_plans} plans, expected {N_PLANS}")
    return ensemble, reference
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_ensemble.py -v
```

Verwacht: `7 passed`. De datatest geeft voor Nevada de verdeling uit de referentietabel: 1:13, 2:1901, 3:3086.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/ensemble.py tests/test_ensemble.py
git commit -m "Read ALARM stats files into ensemble and reference votes"
```

### Task 1.10: Datacontroles

**Files:**
- Modify: `pipeline/gerry/checks.py` (importregels en functies onderaan)
- Test: `tests/test_checks.py`

**Interfaces:**
- Consumes: `CheckError` en de rest van `pipeline/gerry/checks.py` uit taak 0.5 (tekst `"{check} failed for {state}: {detail}"`); de vormen van `load_units`, `read_pl_blocks`, `unit_of_block`, `read_bef`, `block_weighted` en `district_votes` (taken 1.5 tot en met 1.9).
- Produces (in `gerry/checks.py`, allemaal `-> None`, met `CheckError` bij een overschrijding):
  - `check_units_linked(units, unit_of, district_of, state)`: elke eenheid met stemmen heeft minstens één blok buiten `ZZ`.
  - `check_vap(units, blocks, unit_of, state)`: opgetelde blok-VAP per eenheid is gelijk aan `vap` in het eenhedenbestand; blokken met VAP die bij geen eenheid horen zijn een fout. Bij blokstaten is dit de controle per blok.
  - `check_conservation(units, district_totals, vote_cols, state, rel_tol: float = 1e-9)`: per stemkolom is de som over de districten gelijk aan de som over de eenheden.
  - `check_ensemble_totals(ensemble, units, elections, seats, state)`: per plan en per verkiezingskolom, vóór de composiet, |plantotaal − eenhedentotaal| ≤ 0,5 × `seats`.
  - `check_district_count(district_totals, seats, state)`: precies de districten 01 tot en met `seats`.
  - `check_geoids(block_ids, fips, state)`: unieke tekst van 15 cijfers die met de FIPS-code begint.

In de haalbaarheidscontrole bleef de grootste afwijking van `check_ensemble_totals` binnen de grens (NC 3,7 bij 7, LA 2,7 bij 3). Overschrijdt een staat de grens, dan stopt de pijplijn en zoeken we de oorzaak uit voordat we iets aanpassen.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_checks.py`:

```python
import pandas as pd
import pytest

from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap)


def units_table():
    return pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 5],
                         "d_pre_20": [30.0, 6.0, 0.0], "r_pre_20": [60.0, 0.0, 0.0],
                         "d": [30.0, 6.0, 0.0], "r": [60.0, 0.0, 0.0]})


def blocks_table():
    return pd.DataFrame({"block_id": ["b1", "b2", "b3", "b4"], "vap": [10, 20, 0, 5]})


UNIT_OF = pd.Series(["U1", "U1", "U2", "U3"], index=["b1", "b2", "b3", "b4"])
DISTRICT_OF = pd.Series(["01", "02", "01", "ZZ"], index=["b1", "b2", "b3", "b4"])


# ---- check_units_linked ----

def test_units_linked_passes_when_units_with_votes_have_a_block():
    # U3 has only a ZZ block, but no votes
    check_units_linked(units_table(), UNIT_OF, DISTRICT_OF, "NV")


def test_units_linked_fails_for_a_unit_with_votes_in_zz_only():
    district_of = DISTRICT_OF.copy()
    district_of["b3"] = "ZZ"
    with pytest.raises(CheckError, match="units_linked failed for NV.*U2"):
        check_units_linked(units_table(), UNIT_OF, district_of, "NV")


def test_units_linked_fails_for_a_unit_with_votes_without_blocks():
    units = pd.concat([units_table(), pd.DataFrame({"unit_id": ["U4"], "vap": [0], "d_pre_20": [1.0],
                                                    "r_pre_20": [0.0], "d": [1.0], "r": [0.0]})],
                      ignore_index=True)
    with pytest.raises(CheckError, match="U4"):
        check_units_linked(units, UNIT_OF, DISTRICT_OF, "NV")


# ---- check_vap ----

def test_vap_passes_when_blocks_add_up_to_units():
    check_vap(units_table(), blocks_table(), UNIT_OF, "NV")


def test_vap_fails_when_a_unit_differs():
    blocks = blocks_table()
    blocks.loc[1, "vap"] = 21
    with pytest.raises(CheckError, match="vap failed for NV.*U1.*30.*31"):
        check_vap(units_table(), blocks, UNIT_OF, "NV")


def test_vap_fails_for_block_vap_outside_the_unit_file():
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5"], "vap": [3]})], ignore_index=True)
    unit_of = pd.concat([UNIT_OF, pd.Series(["U9"], index=["b5"])])
    with pytest.raises(CheckError, match="U9"):
        check_vap(units_table(), blocks, unit_of, "NV")


# ---- check_conservation ----

def test_conservation_passes_within_tolerance():
    totals = pd.DataFrame({"district": ["01", "02"], "d": [12.0, 24.0 + 1e-9]})
    check_conservation(units_table(), totals, ["d"], "NV")


def test_conservation_fails_when_votes_go_missing():
    totals = pd.DataFrame({"district": ["01", "02"], "d": [12.0, 23.9]})
    with pytest.raises(CheckError, match="conservation failed for NV: d"):
        check_conservation(units_table(), totals, ["d"], "NV")


# ---- check_ensemble_totals ----

def ensemble_table(draw2_d):
    # two plans with two districts; unit totals are d_pre_20 36, r_pre_20 60
    return pd.DataFrame({"draw": ["1", "1", "2", "2"], "district": ["01", "02", "01", "02"],
                         "d_pre_20": [20.0, 16.0, 20.0, draw2_d], "r_pre_20": [30.0, 30.0, 30.0, 30.0]})


def test_ensemble_totals_pass_within_half_a_vote_per_district():
    # limit 0.5 * 2 districts = 1 vote; draw 2 is 1 vote off
    check_ensemble_totals(ensemble_table(17.0), units_table(), ["pre_20"], 2, "NV")


def test_ensemble_totals_fail_beyond_the_limit():
    with pytest.raises(CheckError, match="ensemble_totals failed for NV: d_pre_20.*draw 2"):
        check_ensemble_totals(ensemble_table(17.5), units_table(), ["pre_20"], 2, "NV")


# ---- check_district_count ----

def test_district_count_passes_for_01_to_seats():
    check_district_count(pd.DataFrame({"district": ["02", "01"]}), 2, "NV")


def test_district_count_fails_for_a_missing_district():
    with pytest.raises(CheckError, match="district_count failed for NV"):
        check_district_count(pd.DataFrame({"district": ["01", "03"]}), 2, "NV")


# ---- check_geoids ----

def test_geoids_pass_for_15_digit_text_with_state_fips():
    check_geoids(pd.Series(["010010201001000", "010010201001001"]), "01", "AL")


@pytest.mark.parametrize("ids", [["10010201001000"], ["320010201001000"], ["01001020100100A"],
                                 ["010010201001000", "010010201001000"]])
def test_geoids_fail_for_bad_ids(ids):
    with pytest.raises(CheckError, match="geoids failed for AL"):
        check_geoids(pd.Series(ids), "01", "AL")


def test_geoids_fail_for_numbers():
    with pytest.raises(CheckError, match="text"):
        check_geoids(pd.Series([10010201001000]), "01", "AL")
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py -v
```

Verwacht: `ERROR tests/test_checks.py` met `ImportError: cannot import name 'check_conservation' from 'gerry.checks'`.

- [ ] **Step 3: Schrijf de implementatie**

Vervang de importregels bovenaan `pipeline/gerry/checks.py` (zoals taak 0.5 ze schreef):

```python
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from gerry.config import Config
```

door:

```python
from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import pandas as pd

from gerry.config import Config
```

Voeg onderaan `pipeline/gerry/checks.py` toe, na de functies van taak 0.5:

```python
def _vote_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c in ("d", "r") or c.startswith(("d_", "r_"))]


def check_units_linked(units: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series, state: str) -> None:
    """Every unit with votes has at least one block outside ZZ."""
    district = district_of.reindex(unit_of.index)
    linked = set(unit_of[district.notna() & (district != "ZZ")])
    has_votes = (units[_vote_columns(units)] != 0).any(axis=1)
    bad = units.loc[has_votes & ~units["unit_id"].isin(linked), "unit_id"]
    if len(bad):
        raise CheckError("units_linked", state,
                         f"{len(bad)} units with votes have no block outside ZZ, e.g. {bad.iloc[0]}")


def check_vap(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, state: str) -> None:
    """Block VAP (P0030001) summed per unit equals the VAP in the unit file."""
    by_unit = blocks["vap"].groupby(blocks["block_id"].map(unit_of).to_numpy()).sum()
    expected = units.set_index("unit_id")["vap"]
    got = by_unit.reindex(expected.index, fill_value=0)
    bad = expected.index[(got != expected).to_numpy()]
    if len(bad):
        first = bad[0]
        raise CheckError("vap", state, f"{len(bad)} units differ, e.g. {first}: unit file {int(expected[first])}, "
                                       f"blocks {int(got[first])}")
    outside = by_unit[~by_unit.index.isin(expected.index) & (by_unit > 0).to_numpy()]
    if len(outside):
        raise CheckError("vap", state, f"{len(outside)} block units with VAP are not in the unit file, "
                                       f"e.g. {outside.index[0]} ({int(outside.iloc[0])})")


def check_conservation(units: pd.DataFrame, district_totals: pd.DataFrame, vote_cols: Sequence[str],
                       state: str, rel_tol: float = 1e-9) -> None:
    """The district totals of a map add up to the unit totals, per vote column."""
    for col in vote_cols:
        want, got = float(units[col].sum()), float(district_totals[col].sum())
        if abs(got - want) > rel_tol * max(abs(want), 1.0):
            raise CheckError("conservation", state, f"{col}: districts {got:.6f}, units {want:.6f}")


def check_ensemble_totals(ensemble: pd.DataFrame, units: pd.DataFrame, elections: Sequence[str], seats: int,
                          state: str) -> None:
    """Per plan and per election column: |plan total - unit total| <= 0.5 x seats (ALARM rounds per district)."""
    limit = 0.5 * seats
    cols = [f"{p}_{e}" for e in elections for p in ("d", "r")]
    plan_totals = ensemble.groupby("draw")[cols].sum()
    for col in cols:
        want = float(units[col].sum())
        deviation = (plan_totals[col] - want).abs()
        worst = deviation.idxmax()
        if deviation[worst] > limit:
            raise CheckError("ensemble_totals", state,
                             f"{col}: draw {worst} has {plan_totals.at[worst, col]:.1f}, units {want:.1f}, "
                             f"difference {deviation[worst]:.1f} above {limit}")


def check_district_count(district_totals: pd.DataFrame, seats: int, state: str) -> None:
    """The map has exactly the districts 01..seats."""
    got = sorted(district_totals["district"])
    if got != [f"{k:02d}" for k in range(1, seats + 1)]:
        raise CheckError("district_count", state, f"districts {', '.join(got)}; expected 01 to {seats:02d}")


def check_geoids(block_ids: pd.Series, fips: str, state: str) -> None:
    """Block GEOIDs are unique text of 15 digits that starts with the state FIPS code."""
    ids = pd.Series(block_ids)
    if not pd.api.types.is_string_dtype(ids):
        raise CheckError("geoids", state, f"block ids are not text but {ids.dtype}")
    ok = ids.str.fullmatch(r"\d{15}") & ids.str.startswith(fips)
    if not ok.all():
        raise CheckError("geoids", state, f"{int((~ok).sum())} block ids are not 15 digits starting with {fips}, "
                                          f"e.g. {ids[~ok].iloc[0]}")
    if not ids.is_unique:
        raise CheckError("geoids", state, f"block id {ids[ids.duplicated()].iloc[0]} occurs twice")
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py -v
```

Verwacht: `18 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/checks.py tests/test_checks.py
git commit -m "Add data checks for units, VAP, conservation and ensembles"
```

### Task 1.11: 02_join.py

**Vervangen door taak 1.18. Niet uitvoeren.**

**Files:**
- Create: `pipeline/02_join.py`
- Test: `tests/test_join.py`
- Create (gegenereerd, niet in git): `data/interim/units/{ST}.parquet`, `enacted_districts.parquet`, `ensemble_districts.parquet`, `alarm_reference.parquet`, `join_log.json`

**Interfaces:**
- Consumes: alles uit de taken 1.4 tot en met 1.10; `load_config()`, `data_dir()`, `interim_dir()` (fase 0, taak 0.4); `CheckError` (fase 0, taak 0.5).
- Produces: `pipeline/02_join.py [--states ST ...]` en de tussenbestanden uit het contract:
  - `units/{ST}.parquet`: `unit_id`, `vap`, `d_<e>`, `r_<e>`, `d`, `r` (na `align_to_alarm`).
  - `enacted_districts.parquet`: `state`, `map_id` (`enacted`, `mo_hb1`, `check_2022`), `method` (`block`, `whole_unit`), `district`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d`, `r`. Voor WV zijn de `pre_16`-kolommen leeg.
  - `ensemble_districts.parquet`: `state`, `draw`, `district`, dezelfde stemkolommen.
  - `alarm_reference.parquet`: `state`, `district`, dezelfde stemkolommen (de rijen met `draw == "cd_2020"`, zonder de kolom `draw`).
  - `join_log.json`, per staat: `units`, `empty_vote_fields`, `empty_vote_units`, `align_to_alarm` (lijst van `{column, before, after}`), `blocks`, `units_zero_vap`, `maps` (per `map_id` de tellingen van `block_weighted`: `split_units`, `zero_vap_units`, `zero_vap_split_units`, `units_without_blocks`) en `plans`.
  - Functies in het script (voor de tests): `maps_of(st) -> list[tuple[str, str]]`, `join_state(cfg, postal, root) -> StateResult`, `replace_states(old, new, states) -> pd.DataFrame`, `write_outputs(results, cfg, out_dir, partial) -> None`.

Per staat doet `join_state`: eenheden laden, `align_to_alarm` voor de regels van die staat, composiet, blokken lezen, `check_geoids`, eenheid per blok, `check_vap`. Dan per kaart (`enacted` uit `bef`, de `extra_maps`, en `check_2022` uit CD118): `check_units_linked`, en per methode de districtstotalen met `check_conservation` en `check_district_count`. Tot slot de ensembles met `check_ensemble_totals` op de plannen en op de referentiekaart.

Zonder `--states` schrijft het script alle bestanden opnieuw. Met `--states` vervangt het alleen de rijen van die staten. Faalt een controle, dan schrijft het niets, meldt `ERROR <ST>: <check> failed for <ST>: ...` (bijvoorbeeld `ERROR NV: vap failed for NV: ...`) en stopt met code 1. Een ontbrekend bestand geeft `ERROR <ST>: missing <pad>; run pipeline/01_download.py first`.

- [ ] **Step 1: Schrijf de falende tests**

`tests/test_join.py`:

```python
import importlib.util
import sys
from pathlib import Path

import pandas as pd
import pytest

from gerry.config import data_dir, load_config

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "02_join.py"


def load_script():
    """Import pipeline/02_join.py (its name starts with a digit, so no normal import)."""
    spec = importlib.util.spec_from_file_location("join_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module      # dataclasses look the module up here
    spec.loader.exec_module(module)
    return module


def test_replace_states_keeps_other_states_and_column_order():
    old = pd.DataFrame({"state": ["AL", "NV", "NV"], "district": ["01", "01", "02"], "d": [1.0, 2.0, 3.0]})
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    out = load_script().replace_states(old, new, {"NV"})
    assert out.to_dict("records") == [{"state": "AL", "district": "01", "d": 1.0},
                                      {"state": "NV", "district": "01", "d": 9.0}]


def test_replace_states_without_old_file():
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    assert load_script().replace_states(None, new, {"NV"}).equals(new)


def test_maps_of_lists_enacted_extra_and_check_map():
    cfg = load_config()
    join = load_script()
    assert join.maps_of(cfg.states["NV"]) == [("enacted", "cd120"), ("check_2022", "cd118")]
    assert join.maps_of(cfg.states["MO"]) == [("enacted", "cd118"), ("mo_hb1", "cd120"), ("check_2022", "cd118")]


NV_FILES = [data_dir() / p for p in ("census_vest/nv_2020_vtd.csv", "census/pl/nv2020.pl.zip", "census/cd120.zip",
                                     "census/cd118.zip", "alarm/NV_cd_2020_stats.csv")]


def shares(frame):
    frame = frame.set_index("district")
    return frame["d"] / (frame["d"] + frame["r"])


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in NV_FILES), reason="needs the Nevada files")
def test_nevada_join_reproduces_the_reference_numbers():
    result = load_script().join_state(load_config(), "NV", data_dir())
    enacted = result.enacted
    pick = lambda map_id, method: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
    block = shares(pick("enacted", "block"))
    # plan skeleton, "Referentiegetallen": Nevada, Enacted per district (block method)
    assert block.round(6).to_dict() == {"01": 0.547901, "02": 0.436352, "03": 0.534711, "04": 0.548082}
    whole = shares(pick("enacted", "whole_unit"))
    assert ((whole > 0.5) == (block > 0.5)).all()
    # CD118 against ALARM's cd_2020: largest difference 0.00042
    reference = shares(result.reference)
    assert round(float((shares(pick("check_2022", "block")) - reference).abs().max()), 5) == 0.00042
    assert result.log["units"] == 2102 and result.log["blocks"] == 57409
    assert result.log["maps"]["enacted"]["split_units"] == 40
    assert len(result.ensemble) == 20000 and result.ensemble["draw"].nunique() == 5000
    assert list(result.units.columns) == ["unit_id", "vap", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"]
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_join.py -v
```

Verwacht: `4 failed`, met `FileNotFoundError: [Errno 2] No such file or directory: '...\\pipeline\\02_join.py'`.

- [ ] **Step 3: Schrijf het script**

`pipeline/02_join.py`:

```python
"""Step 2: votes per unit -> blocks -> districts, plus ALARM's plans; writes data/interim/ (spec chapter 4).

Usage: python pipeline/02_join.py [--states ST [ST ...]]

Without --states all states are joined and the interim files are rewritten. With --states only those
states are joined and their rows replace the earlier rows in the interim files.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from gerry.blocks import BlocksError, block_weighted, read_bef, read_pl_blocks, unit_of_block, whole_unit
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap)
from gerry.config import data_dir, interim_dir, load_config
from gerry.ensemble import district_votes, read_stats
from gerry.rds import read_rds_table
from gerry.units import UnitsError, add_composite, align_to_alarm, load_units

METHODS = {"block": block_weighted, "whole_unit": whole_unit}


@dataclass
class StateResult:
    units: pd.DataFrame       # unit_id, vap, d_<e>, r_<e>, d, r
    enacted: pd.DataFrame     # state, map_id, method, district, vote columns
    ensemble: pd.DataFrame    # state, draw, district, vote columns
    reference: pd.DataFrame   # state, district, vote columns (draw cd_2020)
    log: dict


def maps_of(st) -> list[tuple[str, str]]:
    """(map_id, block equivalency file): the enacted map, extra maps, and the 2022 map for the check."""
    return [("enacted", st.bef), *((m.id, m.bef) for m in st.extra_maps), ("check_2022", "cd118")]


def join_state(cfg, postal: str, root: Path) -> StateResult:
    st = cfg.states[postal]
    vote_cols = [f"{p}_{e}" for e in st.elections for p in ("d", "r")] + ["d", "r"]
    units = load_units(st, root)
    log = {"units": len(units), "empty_vote_fields": units.attrs["empty_vote_fields"],
           "empty_vote_units": units.attrs["empty_vote_units"], "align_to_alarm": []}
    for entry in cfg.align_to_alarm:
        if entry.state == postal:
            units, diff = align_to_alarm(units, read_rds_table(root / entry.rds), entry, st.elections)
            log["align_to_alarm"] += diff.to_dict("records")
    units = add_composite(units, st.elections)

    blocks = read_pl_blocks(root / "census" / "pl" / f"{postal.lower()}2020.pl.zip", postal.lower())
    check_geoids(blocks["block_id"], st.fips, postal)
    unit_of = unit_of_block(blocks, st.unit_source, st.fips)
    check_vap(units, blocks, unit_of, postal)
    log.update({"blocks": len(blocks), "units_zero_vap": int((units["vap"] == 0).sum()), "maps": {}})

    rows = []
    for map_id, bef in maps_of(st):
        district_of = read_bef(root / "census" / f"{bef}.zip", bef, st.fips, postal)
        check_units_linked(units, unit_of, district_of, postal)
        for method, assign in METHODS.items():
            totals = assign(units, blocks, unit_of, district_of, vote_cols)
            check_conservation(units, totals, vote_cols, postal)
            check_district_count(totals, st.seats, postal)
            if method == "block":
                log["maps"][map_id] = dict(totals.attrs)
            rows.append(totals.assign(state=postal, map_id=map_id, method=method))
    enacted = pd.concat(rows, ignore_index=True)

    ensemble, reference = district_votes(read_stats(root / "alarm" / f"{postal}_cd_2020_stats.csv"), st)
    check_ensemble_totals(ensemble, units, st.elections, st.seats, postal)
    check_ensemble_totals(reference, units, st.elections, st.seats, postal)
    log["plans"] = int(ensemble["draw"].nunique())
    return StateResult(units, enacted, ensemble, reference.drop(columns="draw"), log)


def replace_states(old: pd.DataFrame | None, new: pd.DataFrame, states: set[str]) -> pd.DataFrame:
    """Rows of `old` for other states, then the rows of `new`, sorted by state (stable)."""
    if old is None:
        return new
    combined = pd.concat([old[~old["state"].isin(states)], new], ignore_index=True)
    return combined.sort_values("state", kind="stable").reset_index(drop=True)


def _ordered(frames: list[pd.DataFrame], key_cols: list[str], vote_cols: list[str]) -> pd.DataFrame:
    return pd.concat(frames, ignore_index=True).reindex(columns=key_cols + vote_cols)


def write_outputs(results: dict[str, StateResult], cfg, out_dir: Path, partial: bool) -> None:
    elections = list(dict.fromkeys(e for st in cfg.states.values() for e in st.elections))
    vote_cols = [f"{p}_{e}" for e in elections for p in ("d", "r")] + ["d", "r"]
    (out_dir / "units").mkdir(parents=True, exist_ok=True)
    for postal, res in results.items():
        res.units.to_parquet(out_dir / "units" / f"{postal}.parquet", index=False)
    tables = {
        "enacted_districts.parquet": _ordered([r.enacted for r in results.values()],
                                              ["state", "map_id", "method", "district"], vote_cols),
        "ensemble_districts.parquet": _ordered([r.ensemble for r in results.values()],
                                               ["state", "draw", "district"], vote_cols),
        "alarm_reference.parquet": _ordered([r.reference for r in results.values()], ["state", "district"], vote_cols),
    }
    states = set(results)
    for name, table in tables.items():
        path = out_dir / name
        old = pd.read_parquet(path) if partial and path.exists() else None
        replace_states(old, table, states).to_parquet(path, index=False)
    log_path = out_dir / "join_log.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if partial and log_path.exists() else {}
    log.update({postal: res.log for postal, res in results.items()})
    log_path.write_text(json.dumps(dict(sorted(log.items())), indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--states", nargs="+", default=[], metavar="ST", help="postal codes, e.g. NV WV")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="  %(message)s", stream=sys.stdout)
    cfg = load_config()
    states = [s.upper() for s in args.states] or sorted(cfg.states)
    unknown = sorted(set(states) - set(cfg.states))
    if unknown:
        parser.error(f"not a multi-seat state in config.yaml: {', '.join(unknown)}")
    root = data_dir()
    results = {}
    for postal in states:
        start = time.monotonic()
        try:
            res = join_state(cfg, postal, root)
        except (CheckError, UnitsError, BlocksError) as exc:
            print(f"ERROR {postal}: {exc}", file=sys.stderr)
            return 1
        except FileNotFoundError as exc:
            print(f"ERROR {postal}: missing {exc.filename}; run pipeline/01_download.py first", file=sys.stderr)
            return 1
        results[postal] = res
        split = res.log["maps"]["enacted"]
        print(f"{postal}: {res.log['units']} units ({res.log['units_zero_vap']} without VAP), "
              f"{res.log['blocks']} blocks, enacted map splits {split['split_units']} units "
              f"({split['zero_vap_split_units']} without VAP), {res.log['plans']} plans, "
              f"{time.monotonic() - start:.1f} s", flush=True)
    write_outputs(results, cfg, interim_dir(), partial=bool(args.states))
    print(f"Wrote {len(results)} states to {interim_dir()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_join.py -v
```

Verwacht: `4 passed`. De integratietest voor Nevada vindt de referentiegetallen uit het plan: per district 0,547901, 0,436352, 0,534711 en 0,548082, dezelfde winnaars met hele eenheden, en 0,00042 als grootste verschil tussen CD118 en ALARM's `cd_2020`.

- [ ] **Step 5: Draai de join voor alle 44 staten**

```powershell
.venv\Scripts\python pipeline/02_join.py
```

Dit duurt ongeveer vijf minuten; California alleen al ongeveer een minuut. Verwacht: één regel per staat in alfabetische volgorde, met voor California eerst de logregels, en aan het eind `Wrote 44 states to ...\data\interim`. Deze acht regels zijn gecontroleerd op de echte bestanden (de tijden verschillen):

```
  CA: 8 empty vote fields in 2 units set to 0
  CA: align_to_alarm d_pre_16 429.9 -> 0.0
  CA: align_to_alarm r_pre_16 1431.4 -> 0.0
  CA: align_to_alarm d_pre_20 552.4 -> 0.0
  CA: align_to_alarm r_pre_20 1716.2 -> 0.0
CA: 519723 units (144154 without VAP), 519723 blocks, enacted map splits 0 units (0 without VAP), 5000 plans, 57.7 s
IA: 2536 units (14 without VAP), 175199 blocks, enacted map splits 0 units (0 without VAP), 5000 plans, 3.2 s
LA: 3540 units (9 without VAP), 142874 blocks, enacted map splits 10 units (0 without VAP), 5000 plans, 3.0 s
NC: 2666 units (0 without VAP), 236638 blocks, enacted map splits 21 units (0 without VAP), 5000 plans, 4.5 s
NV: 2102 units (295 without VAP), 57409 blocks, enacted map splits 40 units (3 without VAP), 5000 plans, 1.3 s
TX: 9007 units (240 without VAP), 668757 blocks, enacted map splits 360 units (1 without VAP), 5000 plans, 14.2 s
UT: 2745 units (151 without VAP), 71207 blocks, enacted map splits 7 units (0 without VAP), 5000 plans, 1.7 s
WV: 55 units (0 without VAP), 72558 blocks, enacted map splits 0 units (0 without VAP), 5000 plans, 1.3 s
```

Het aantal blokken in elke regel komt uit P.L. 94-171 en hoort gelijk te zijn aan het aantal in CD120 en CD118 hieronder. Die twee zijn voor alle 44 staten gecontroleerd, P.L. 94-171 voor de acht staten hierboven.

| Staat | Blokken | Staat | Blokken | Staat | Blokken | Staat | Blokken |
|---|---|---|---|---|---|---|---|
| AL | 185976 | IL | 369978 | MS | 112241 | OR | 130807 |
| AR | 136422 | IN | 204568 | MT | 88417 | PA | 336985 |
| AZ | 155444 | KS | 172529 | NC | 236638 | RI | 25649 |
| CA | 519723 | KY | 132662 | NE | 119103 | SC | 146844 |
| CO | 140345 | LA | 142874 | NH | 31948 | TN | 179717 |
| CT | 49926 | MA | 107278 | NJ | 137972 | TX | 668757 |
| FL | 390066 | MD | 83827 | NM | 107215 | UT | 71207 |
| GA | 232717 | ME | 47138 | NV | 57409 | VA | 163491 |
| HI | 14732 | MI | 254730 | NY | 288819 | WA | 158093 |
| IA | 175199 | MN | 198705 | OH | 276428 | WI | 203059 |
| ID | 81879 | MO | 253632 | OK | 180154 | WV | 72558 |

Stopt een staat met een fout, pas dan geen code of drempel aan om de controle te laten slagen. Noteer de melding en vraag de eigenaar (CLAUDE.md: twijfel over een databron, stop en vraag). Mogelijke oorzaken die we nog niet op echte data zagen, omdat de haalbaarheidscontrole acht staten dekte:

- `blocks without VTD code` in een VTD-staat. De spec noemt dat een fout. ALARM gebruikt voor zulke blokken county + `000000` (gezien in het VTD-bestand van WV).
- `expected one column matching ^pre_16_dem_` in een eenheden- of stats-bestand.
- `ensemble_totals` boven de grens, bijvoorbeeld in Maine, waar het blokbestand van ALARM nieuwer is dan de stats-bestanden.

- [ ] **Step 6: Controleer de tussenbestanden**

```powershell
.venv\Scripts\python -c "import pandas as pd; d='data/interim/'; print(len(pd.read_parquet(d+'enacted_districts.parquet')), len(pd.read_parquet(d+'ensemble_districts.parquet')), len(pd.read_parquet(d+'alarm_reference.parquet')))"
(Get-ChildItem data\interim\units\*.parquet).Count
```

Verwacht: `1732 2145000 429` en `44`. Enacted: (enacted plus check_2022) × 2 methoden × 429 districten = 1.716 rijen, plus 2 × 8 voor `mo_hb1`. Ensembles: 429 × 5.000.

- [ ] **Step 7: Draai alle tests**

```powershell
.venv\Scripts\python -m pytest -v
```

Verwacht: alle tests slagen. Fase 1 voegt 88 tests toe, waarvan 7 datatests; die worden nu niet overgeslagen, want de data staan er.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/02_join.py tests/test_join.py
git commit -m "Add join step writing interim files for all states"
```

`data/interim/` staat in `.gitignore` en komt niet in de commit.

## Phase 1b: ALARM's kaartbestand als stembron

Op 6 oktober 2026 besloot de eigenaar dat de stemmen per eenheid voor alle 44 staten uit ALARM's `{ST}_cd_2020_map.rds` komen (Dataverse doi:10.7910/DVN/SLCD3E, versie 15). In taak 1.11 stopte `check_ensemble_totals` op ME, MI en NJ, omdat de bestanden van census-vest andere stemmen hebben dan de data waarmee ALARM de stats-bestanden optelde. Met `map.rds` sluiten de staatstotalen per plan in alle 44 staten aan, en zijn VAP en bevolking per eenheid gelijk aan de som over de blokken uit P.L. 94-171. Twee onafhankelijke controles op de echte data kwamen tot dezelfde uitkomst.

Wat deze fase verandert (de spec is al bijgewerkt, hoofdstuk 2 tot en met 4 en 6):

- **Stembron.** `map.rds` voor alle 44 staten. De blokbestanden van census-vest (CA, HI, ME, OR) blijven, maar alleen als gewicht binnen een tract. De VTD-bestanden van census-vest gebruiken we niet meer; `01_download` haalt hun regels uit `data/manifest.json`.
- **Soort eenheid.** `unit_kind` in `config.yaml` vervangt `unit_source`: `tract` voor CA, HI, ME en OR, `county` voor IA en WV, `vtd` voor de andere 38 (ook NH). `align_to_alarm` en `AlignEntry` verdwijnen. De stemmen per tract komen nu rechtstreeks uit ALARM, dus er valt niets meer te schalen.
- **Eenheid-ID's.** `GEOID`; zonder `GEOID` de kolom `tract` (CA, HI) of, in Iowa, de countynaam opgezocht in de countyrecords van P.L. 94-171. In VTD-staten moet `GEOID` gelijk zijn aan `GEOID[:5]` plus de kolom `vtd`.
- **Sleutel van een blok.** VTD: GEOCODE[:5] + VTD-code; tract: GEOCODE[:11]; county: GEOCODE[:5]. Een sleutel die bij geen eenheid hoort (water dat ALARM wegliet), moet VAP 0 en bevolking 0 hebben.
- **Verdelen.** In VTD- en countystaten zoals voorheen naar blok-VAP, zonder VAP naar aantal blokken. In tractstaten per stemkolom naar de blokstemmen van census-vest; is hun som in een tract 0, dan de regel met VAP.
- **Referentiekaart.** De stats-bestanden nummeren de districten van `cd_2020` niet altijd zoals `map.rds` (Oregon). De labels gaan naar die van `map.rds` op basis van gelijke bevolking, en die labels moeten passen bij CD118.

Wat er met de eerdere taken gebeurt:

| Eerdere taak | Wat er verandert | Waar |
|---|---|---|
| 1.2, 1.3 downloadplan en downloadscript | `map.rds` voor alle staten, census-vest alleen blokbestanden, manifest opruimen | 1.12 |
| 1.7, 1.8 blokken | POP100, countynamen, sleutel per soort eenheid, gewichten binnen een tract | 1.13, 1.14 |
| 0.4 config, 1.5 eenheden, 1.6 `align_to_alarm` | `unit_kind`, eenheden uit `map.rds`; `align_to_alarm` verdwijnt weer | 1.15 |
| 0.3 README | de zin dat de stemmen per precinct geteld zijn | 1.15 |
| 1.10 datacontroles | `check_vap` wordt `check_vap_pop`, nieuw `check_reference_labels` | 1.16, 1.17 |
| 1.9 ensembles | nieuw `reference_labels` | 1.17 |
| 1.11 `02_join.py` (niet gecommit) | opnieuw, op de nieuwe eenheden | 1.18 |

Het concept van taak 1.11 staat geparkeerd in `.superpowers/sdd/2026-10-05-gerrymandering-map/wip-1.11/`. Taak 1.18 vervangt het; kopieer het niet terug.

Deze fase gaat ervan uit dat de data uit taak 1.3 in `data\raw` staat (of in de map uit `$env:GERRY_DATA_DIR`) en dat `$env:PYTHONUTF8=1` gezet is. Alle commando's draaien in PowerShell vanuit de root van de worktree. De verwachte uitkomsten hieronder komen uit een proefrun van 6 oktober 2026: deze taken in deze volgorde, uitgevoerd op een kopie van de worktree met de echte data.

Twee dingen horen niet bij deze fase. Tennessee overschrijdt naar verwachting de drempel van de methodecontrole (CD118 tegen ALARM's `cd_2020`, 0,699 procentpunt in CD-09, hetzelfde aantal zetels); taak 2.15 zet de verklaring in `data/validation_notes.yaml`. De beperkingen uit hoofdstuk 10 van de spec komen in de methodetoelichting van de site.

De grens van `check_ensemble_totals` is inclusief: een afwijking gelijk aan 0,5 × aantal districten is toegestaan. De code doet dat al (`>` in `checks.py`), en de bestaande test `test_ensemble_totals_pass_within_half_a_vote_per_district` legt het vast met een plan dat precies op de grens zit. In de volledige run zitten HI en RI op de grens (afwijking 1,0 bij een grens van 1). Daarvoor verandert er niets.

### Task 1.12: Downloadplan: map.rds voor elke staat, manifest opruimen

**Files:**
- Modify: `pipeline/gerry/sources.py` (`Manifest.prune` erbij, `plan_downloads`)
- Modify: `pipeline/01_download.py` (`main`)
- Modify: `tests/test_sources.py`
- Modify: `tests/test_download_script.py`
- Modify (gegenereerd): `data/manifest.json`

**Interfaces:**
- Consumes: `Config`, `StateConfig` (nog met `unit_source`; taak 1.15 hernoemt het), `Download`, `DownloadError`, `Manifest`, `dataverse_files`, `fetch`, `open_session` (taken 1.1 en 1.2); `select`, `state_of` (taak 1.3).
- Produces:
  - `Manifest.prune(keep: Iterable[str]) -> list[str]`: haalt de regels weg waarvan de sleutel niet in `keep` staat en geeft die sleutels gesorteerd terug. Schrijft niet; daarvoor is `save()`.
  - `plan_downloads(cfg: Config, dv_files: dict[str, dict]) -> list[Download]`, in deze volgorde: 44 stats-bestanden, 44 keer `alarm/{ST}_cd_2020_map.rds`, de blokbestanden van census-vest voor CA, HI, ME en OR, `cd118.zip`, `cd120.zip`, 44 P.L.-bestanden, 3 TIGER-bestanden. Samen 141 bestanden.
  - `pipeline/01_download.py`: haalt manifestregels weg die niet in het volledige plan staan, ook met `--only`. Met `--dry-run` noemt het die regels zonder iets te schrijven.

De 39 VTD-bestanden van census-vest (38 VTD-staten plus IA) blijven op schijf staan, maar de pijplijn leest ze niet meer. Hun regels in het manifest verdwijnen bij de eerste run. Weggooien van de bestanden mag, maar hoeft niet.

Het opruimen gebeurt tegen het volledige plan en niet tegen de selectie van `--only`. Anders zou `--only NV` de regels van alle andere staten weghalen.

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_sources.py`:

```python
    m.record("census/a.zip", "https://example.org/a.zip", 5, "aa")
    m.save()
    assert b"\r" not in path.read_bytes()
```

door:

```python
    m.record("census/a.zip", "https://example.org/a.zip", 5, "aa")
    m.save()
    assert b"\r" not in path.read_bytes()


def test_manifest_prune_drops_entries_outside_the_plan(tmp_path):
    path = tmp_path / "manifest.json"
    m = Manifest(path)
    for key in ("census/cd120.zip", "census_vest/nv_2020_vtd.csv", "census_vest/al_2020_vtd.csv"):
        m.record(key, f"https://example.org/{key}", 1, "aa")
    removed = m.prune({"census/cd120.zip", "alarm/NV_cd_2020_map.rds"})
    assert removed == ["census_vest/al_2020_vtd.csv", "census_vest/nv_2020_vtd.csv"]
    assert m.get("census_vest/nv_2020_vtd.csv") is None
    m.save()
    assert list(json.loads(path.read_text(encoding="utf-8"))) == ["census/cd120.zip"]
```

Vervang in `tests/test_sources.py`:

```python
    "NV_cd_2020_stats.tab": {"id": 6392701, "size": 7257601, "md5": "10f038a740da8bf18a18a5fbd33f8f2e", "tabular": True},
    "WV_cd_2020_map.rds": {"id": 6380448, "size": 17740, "md5": "40ecd77e6862f5d5605951fcb75aeb8f", "tabular": False},
```

door:

```python
    "NV_cd_2020_map.rds": {"id": 6380432, "size": 427948, "md5": "4869feb60a4933e60b5a60745df39688", "tabular": False},
    "NV_cd_2020_stats.tab": {"id": 6392701, "size": 7257601, "md5": "10f038a740da8bf18a18a5fbd33f8f2e", "tabular": True},
    "WV_cd_2020_map.rds": {"id": 6380448, "size": 17740, "md5": "40ecd77e6862f5d5605951fcb75aeb8f", "tabular": False},
```

Vervang in `tests/test_sources.py`:

```python
        Download("alarm/CA_cd_2020_map.rds", f"{API}/access/datafile/6391062",
                 2117872, "e227564fe85c6729d49aa49e90019ecf"),
        Download("alarm/WV_cd_2020_map.rds", f"{API}/access/datafile/6380448",
                 17740, "40ecd77e6862f5d5605951fcb75aeb8f"),
        Download("census_vest/ca_2020_block.csv", f"{vest}/ca_2020_block.csv", None, None),
        Download("census_vest/nv_2020_vtd.csv", f"{vest}/nv_2020_vtd.csv", None, None),
```

door:

```python
        # map.rds for every state: the votes of all three scenarios come from it
        Download("alarm/CA_cd_2020_map.rds", f"{API}/access/datafile/6391062",
                 2117872, "e227564fe85c6729d49aa49e90019ecf"),
        Download("alarm/NV_cd_2020_map.rds", f"{API}/access/datafile/6380432",
                 427948, "4869feb60a4933e60b5a60745df39688"),
        Download("alarm/WV_cd_2020_map.rds", f"{API}/access/datafile/6380448",
                 17740, "40ecd77e6862f5d5605951fcb75aeb8f"),
        # census-vest: only the block files of the tract states, as weights within a tract
        Download("census_vest/ca_2020_block.csv", f"{vest}/ca_2020_block.csv", None, None),
```

Vervang in `tests/test_sources.py`:

```python
    files = {k: v for k, v in DV_FILES.items() if k != "WV_cd_2020_map.rds"}
    with pytest.raises(DownloadError, match="WV_cd_2020_map.rds"):
```

door:

```python
    files = {k: v for k, v in DV_FILES.items() if k != "NV_cd_2020_map.rds"}
    with pytest.raises(DownloadError, match="NV_cd_2020_map.rds"):
```

De md5 en grootte van `NV_cd_2020_map.rds` komen uit de Dataverse-lijst van versie 15.

Vervang in `tests/test_download_script.py`:

```python
import importlib.util
import sys
from pathlib import Path

from gerry.sources import Download
```

door:

```python
import importlib.util
import json
import sys
from pathlib import Path

from gerry.sources import Download, Manifest
```

Voeg onderaan `tests/test_download_script.py` toe:

```python


# ---- Task 1.12: manifest entries for files that left the plan ----

NEW_PLAN = [dl("alarm/NV_cd_2020_map.rds"), dl("census/cd120.zip"), dl("census/pl/wv2020.pl.zip")]
OLD_KEYS = ["census/cd120.zip", "census/pl/wv2020.pl.zip", "census_vest/nv_2020_vtd.csv"]


def offline_script(tmp_path, monkeypatch):
    """The script with a manifest in tmp_path and no network: a fixed plan, fetch writes a small file."""
    script = load_script()
    manifest = Manifest(tmp_path / "manifest.json")
    for key in OLD_KEYS:
        manifest.record(key, f"https://example.org/{key}", 1, "0" * 64)
    manifest.save()

    def fake_fetch(dl, root, manifest, session=None):
        path = Path(root) / dl.key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"x")
        manifest.record(dl.key, dl.url, 1, "1" * 64)
        return path

    monkeypatch.setenv("GERRY_DATA_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(script, "MANIFEST", tmp_path / "manifest.json")
    monkeypatch.setattr(script, "dataverse_files", lambda *args, **kwargs: {})
    monkeypatch.setattr(script, "plan_downloads", lambda cfg, dv_files: NEW_PLAN)
    monkeypatch.setattr(script, "fetch", fake_fetch)
    return script


def manifest_keys(tmp_path):
    return list(json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8")))


def test_download_removes_manifest_entries_that_left_the_plan(tmp_path, monkeypatch):
    script = offline_script(tmp_path, monkeypatch)
    # --only NV fetches only the NV and shared files, but the WV entry stays: it is still in the plan
    assert script.main(["--only", "NV"]) == 0
    assert manifest_keys(tmp_path) == ["alarm/NV_cd_2020_map.rds", "census/cd120.zip", "census/pl/wv2020.pl.zip"]


def test_dry_run_leaves_the_manifest_alone(tmp_path, monkeypatch, capsys):
    script = offline_script(tmp_path, monkeypatch)
    assert script.main(["--dry-run"]) == 0
    assert manifest_keys(tmp_path) == OLD_KEYS
    assert "census_vest/nv_2020_vtd.csv" in capsys.readouterr().out
```

De scripttests draaien `main` zonder netwerk: `dataverse_files`, `plan_downloads` en `fetch` zijn vervangen, en `MANIFEST` wijst naar `tmp_path`. `load_config()` leest het echte `config.yaml`; dat is nodig voor de controle op `--only NV`.

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py tests/test_download_script.py -q
```

Verwacht: `5 failed, 20 passed`. De meldingen: `AttributeError: 'Manifest' object has no attribute 'prune'`; voor het plan `At index 4 diff: Download(key='alarm/WV_cd_2020_map.rds', ...) != Download(key='alarm/NV_cd_2020_map.rds', ...)`; `Failed: DID NOT RAISE`; en in beide scripttests staat `census_vest/nv_2020_vtd.csv` nog in het manifest of niet in de uitvoer.

- [ ] **Step 3: Schrijf de code**

Vervang in `pipeline/gerry/sources.py`:

```python
import urllib.request
from dataclasses import dataclass
```

door:

```python
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
```

Vervang in `pipeline/gerry/sources.py`:

```python
    def record(self, key: str, url: str, size: int, sha256: str) -> None:
        self._entries[key] = {"url": url, "size": int(size), "sha256": sha256}
```

door:

```python
    def record(self, key: str, url: str, size: int, sha256: str) -> None:
        self._entries[key] = {"url": url, "size": int(size), "sha256": sha256}

    def prune(self, keep: Iterable[str]) -> list[str]:
        """Drop the entries whose key is not in `keep`; return the dropped keys, sorted. Call save() to write."""
        keep = set(keep)
        removed = sorted(key for key in self._entries if key not in keep)
        for key in removed:
            del self._entries[key]
        return removed
```

Vervang in `pipeline/gerry/sources.py`:

```python
    rds_keys = {f"alarm/{p}_cd_2020_map.rds" for p in postals if cfg.states[p].unit_source == "rds_county"}
    rds_keys |= {entry.rds for entry in cfg.align_to_alarm}
    plan += [_dataverse_download(cfg, dv_files, key.rsplit("/", 1)[1], key) for key in sorted(rds_keys)]
    for p in postals:
        kind = cfg.states[p].unit_source
        if kind in ("vtd", "block"):
            st = p.lower()
            url = src["census_vest"].format(commit=cfg.census_vest_commit, st=st, kind=kind)
            plan.append(Download(f"census_vest/{st}_2020_{kind}.csv", url, None, None))
```

door:

```python
    # map.rds holds the votes per unit for all three scenarios (spec chapter 3)
    plan += [_dataverse_download(cfg, dv_files, f"{p}_cd_2020_map.rds", f"alarm/{p}_cd_2020_map.rds")
             for p in postals]
    # census-vest: only the block files of CA, HI, ME and OR, as weights within a tract
    for p in postals:
        if cfg.states[p].unit_source == "block":
            st = p.lower()
            url = src["census_vest"].format(commit=cfg.census_vest_commit, st=st, kind="block")
            plan.append(Download(f"census_vest/{st}_2020_block.csv", url, None, None))
```

Vervang in `pipeline/01_download.py`:

```python
        plan = select(plan_downloads(cfg, dv_files), args.only)
    except DownloadError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    if args.dry_run:
        for dl in plan:
            print(f"{dl.key}  {dl.size if dl.size is not None else ''}")
        known = sum(dl.size for dl in plan if dl.size is not None)
        print(f"{len(plan)} files planned, {known:,} bytes known in advance (Dataverse)")
        return 0

    manifest = Manifest(MANIFEST)
    counts = {"downloaded": 0, "present": 0}
```

door:

```python
        full_plan = plan_downloads(cfg, dv_files)
    except DownloadError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    plan = select(full_plan, args.only)
    manifest = Manifest(MANIFEST)
    # against the full plan, so --only keeps the entries of the other states
    stale = manifest.prune(dl.key for dl in full_plan)
    if args.dry_run:
        for dl in plan:
            print(f"{dl.key}  {dl.size if dl.size is not None else ''}")
        known = sum(dl.size for dl in plan if dl.size is not None)
        print(f"{len(plan)} files planned, {known:,} bytes known in advance (Dataverse)")
        if stale:
            print(f"{len(stale)} manifest entries are not in the plan; a run without --dry-run removes them:")
            for key in stale:
                print(f"  {key}")
        return 0

    if stale:
        manifest.save()
        print(f"Removed {len(stale)} manifest entries that are no longer in the plan:")
        for key in stale:
            print(f"  {key}")
    counts = {"downloaded": 0, "present": 0}
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_sources.py tests/test_download_script.py -q
```

Verwacht: `25 passed`.

- [ ] **Step 5: Bekijk het plan zonder te downloaden**

```powershell
.venv\Scripts\python pipeline/01_download.py --dry-run
```

Verwacht: eerst `Data directory: ...`, dan 141 regels (44 stats-bestanden, dan `alarm/AL_cd_2020_map.rds  936432` tot `alarm/WV_cd_2020_map.rds  17740`, dan `census_vest/ca_2020_block.csv`, `hi`, `me` en `or`, dan Census), en daarna:

```
141 files planned, 819,185,545 bytes known in advance (Dataverse)
39 manifest entries are not in the plan; a run without --dry-run removes them:
  census_vest/al_2020_vtd.csv
  ...
  census_vest/wi_2020_vtd.csv
```

De 39 regels zijn de VTD-bestanden van de 38 VTD-staten plus `ia`. Het manifest is nog onveranderd (`git status --short` toont `data/manifest.json` niet).

- [ ] **Step 6: Download de 42 nieuwe kaartbestanden**

```powershell
.venv\Scripts\python pipeline/01_download.py
```

Verwacht: eerst `Removed 39 manifest entries that are no longer in the plan:` met de 39 regels uit stap 5. Dan per bestand een regel. De 42 `map.rds`-bestanden die er nog niet waren eindigen op `downloaded`, alle andere op `present`. Aan het eind, met een ander aantal minuten:

```
141 files: 42 downloaded, 99 present, 2,519,952,066 bytes, 1.2 min
Manifest ...\data\manifest.json has entries for 141 of these files
```

Staan de kaartbestanden er al (bijvoorbeeld uit een andere worktree), dan is het `0 downloaded, 141 present`; de controle op md5 en grootte uit Dataverse geldt dan net zo. Stopt de run met `md5 ..., expected ...`, dan is een bestand bij Dataverse anders dan in versie 15: niets weggooien, de melding aan de eigenaar voorleggen.

- [ ] **Step 7: Controleer aantallen en groottes**

```powershell
$root = if ($env:GERRY_DATA_DIR) { $env:GERRY_DATA_DIR } else { "data\raw" }
Get-ChildItem $root -Recurse -File | Group-Object { $_.Directory.Name } | ForEach-Object { "{0} {1} {2}" -f $_.Name, $_.Count, ($_.Group | Measure-Object Length -Sum).Sum }
(Get-ChildItem "$root\census_vest" -Filter *_block.csv | Measure-Object Length -Sum).Sum
(Get-Content data\manifest.json -Raw | ConvertFrom-Json).PSObject.Properties.Name.Count
```

Verwacht (de volgorde van de eerste vijf regels kan verschillen):

```
alarm 88 819185545
census 2 83169131
pl 44 1275194689
tiger 3 253271151
census_vest 43 119711775
89131550
141
```

`census_vest 43` telt de 39 VTD-bestanden mee die nog op schijf staan; de vier blokbestanden zijn samen 89.131.550 bytes. De vijf getallen van het plan (alarm, census, pl, tiger en de blokbestanden) tellen op tot 2.519.952.066.

- [ ] **Step 8: Draai alle tests**

```powershell
.venv\Scripts\python -m pytest -q
```

Verwacht: `165 passed`.

- [ ] **Step 9: Commit**

```powershell
git status --short
git add pipeline/gerry/sources.py pipeline/01_download.py tests/test_sources.py tests/test_download_script.py data/manifest.json
git commit -m "Download ALARM's map.rds for every state and drop stale manifest entries"
```

`git status --short` mag geen bestanden onder `data/raw/` tonen. Het manifest krijgt 42 bestanden erbij en verliest er 39: `git diff --stat data/manifest.json` vóór de commit toont `210 insertions(+), 195 deletions(-)` (vijf tekstregels per bestand).

### Task 1.13: P.L. 94-171: bevolking, countynamen en de sleutel van een blok

**Files:**
- Modify: `pipeline/gerry/blocks.py` (`PL_GEO_FIELDS`, `read_pl_blocks`, nieuw `read_pl_counties`, `unit_of_block`)
- Modify: `tests/test_blocks.py`

**Interfaces:**
- Consumes: `BlocksError`, `_read_pipe` (taak 1.7).
- Produces:
  - `PL_GEO_FIELDS` krijgt `"NAME": 87`.
  - `read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame`: kolommen `block_id` (str 15), `vap`, `pop` (int64, POP100), `vtd` (str), `lat`, `lon` (float64). Controleert ook dat de som van POP100 gelijk is aan het staatsrecord.
  - `read_pl_counties(zip_path: Path, st: str) -> pd.DataFrame`: kolommen `county_id` (str 5) en `name` (str, bijvoorbeeld `"Adair County"`), één rij per SUMLEV 050-record.
  - `unit_of_block(blocks: pd.DataFrame, unit_kind: str, fips: str) -> pd.Series`: index `block_id`, naam `unit_id`, waarde de sleutel van de eenheid: `vtd` GEOCODE[:5] + VTD-code (een lege VTD-code is een `BlocksError`), `tract` GEOCODE[:11], `county` GEOCODE[:5]. Elke andere soort is een `BlocksError`. Een sleutel hoeft geen eenheid van `map.rds` te zijn; taak 1.16 controleert die blokken.

`pop` is nodig voor de controle per eenheid (taak 1.16) en voor de controle van ALARM's referentiekaart tegen CD118 (taak 1.17). De countynamen zijn nodig voor Iowa, waar `map.rds` alleen de naam van de county heeft (taak 1.15). Het veld NAME staat op positie 87; de test-fixture schreef daar al een naam.

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_blocks.py`:

```python
from gerry.blocks import (PL_GEO_FIELDS, BlocksError, block_weighted, read_bef, read_pl_blocks, unit_of_block,
                          whole_unit)
```

door:

```python
from gerry.blocks import (PL_GEO_FIELDS, BlocksError, block_weighted, read_bef, read_pl_blocks, read_pl_counties,
                          unit_of_block, whole_unit)
```

Vervang in `tests/test_blocks.py`:

```python
    fields[87] = name
```

door:

```python
    fields[PL_GEO_FIELDS["NAME"]] = name
```

Vervang in `tests/test_blocks.py`:

```python
    assert list(blocks.columns) == ["block_id", "vap", "vtd", "lat", "lon"]
    assert blocks["block_id"].tolist() == ["320010001001000", "320010001001001"]
    assert blocks["vap"].dtype == np.int64 and blocks["vap"].tolist() == [8, 0]
```

door:

```python
    assert list(blocks.columns) == ["block_id", "vap", "pop", "vtd", "lat", "lon"]
    assert blocks["block_id"].tolist() == ["320010001001000", "320010001001001"]
    assert blocks["vap"].dtype == np.int64 and blocks["vap"].tolist() == [8, 0]
    assert blocks["pop"].dtype == np.int64 and blocks["pop"].tolist() == [10, 0]
```

Vervang in `tests/test_blocks.py`:

```python
def test_read_pl_blocks_checks_the_state_record(tmp_path):
```

door:

```python
def test_read_pl_counties_returns_fips_and_name(tmp_path):
    counties = read_pl_counties(make_pl_zip(tmp_path / "nv2020.pl.zip"), "NV")
    # the county name holds a Latin-1 byte, as in the real files
    assert counties.to_dict("records") == [{"county_id": "32001", "name": "Doña Ana County"}]


def test_read_pl_blocks_checks_the_state_record(tmp_path):
```

Vervang in `tests/test_blocks.py`:

```python
def test_read_pl_blocks_rejects_vap_above_population(tmp_path):
```

door:

```python
def test_read_pl_blocks_checks_the_state_population(tmp_path):
    # block POP100 adds up to 10 + 3 = 13; the state record says 10
    with pytest.raises(BlocksError, match="POP100 adds up to 13, state record says 10"):
        read_pl_blocks(make_pl_zip(tmp_path / "nv2020.pl.zip", block2_pop="3"), "nv")


def test_read_pl_blocks_rejects_vap_above_population(tmp_path):
```

De parameter `block2_pop` van `make_pl_zip` bestaat al; het tweede blok houdt VAP 0, dus alleen de controle op POP100 slaat aan.

Vervang in `tests/test_blocks.py`:

```python
    assert len(blocks) == 57409
    assert blocks["vap"].sum() == 2413326
```

door:

```python
    assert len(blocks) == 57409
    assert blocks["vap"].sum() == 2413326
    assert blocks["pop"].sum() == 3104614
```

Vervang in `tests/test_blocks.py`:

```python
def test_unit_of_block_for_block_states_is_the_block():
    blocks = pl_blocks(["060014001001000"])
    assert unit_of_block(blocks, "block", "06").to_dict() == {"060014001001000": "060014001001000"}


def test_unit_of_block_for_county_units_is_the_county():
    blocks = pl_blocks(["540630001001000", "540370001001000"])
    assert unit_of_block(blocks, "rds_county", "54").tolist() == ["54063", "54037"]


def test_unit_of_block_rejects_blocks_of_another_state():
    with pytest.raises(BlocksError, match="32"):
        unit_of_block(pl_blocks(["060014001001000"]), "block", "32")
```

door:

```python
def test_unit_of_block_for_tract_states_is_the_tract():
    blocks = pl_blocks(["060014001001000", "060014001002003"])
    assert unit_of_block(blocks, "tract", "06").tolist() == ["06001400100", "06001400100"]


def test_unit_of_block_for_county_units_is_the_county():
    blocks = pl_blocks(["540630001001000", "540370001001000"])
    assert unit_of_block(blocks, "county", "54").tolist() == ["54063", "54037"]


def test_unit_of_block_rejects_an_unknown_kind():
    with pytest.raises(BlocksError, match="'block'"):
        unit_of_block(pl_blocks(["060014001001000"]), "block", "06")


def test_unit_of_block_rejects_blocks_of_another_state():
    with pytest.raises(BlocksError, match="32"):
        unit_of_block(pl_blocks(["060014001001000"]), "tract", "32")
```

De bevolking van Nevada volgens de census van 2020 is 3.104.614.

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -q
```

Verwacht: `ERROR tests/test_blocks.py` met `ImportError: cannot import name 'read_pl_counties' from 'gerry.blocks'`.

- [ ] **Step 3: Schrijf de code**

Vervang in `pipeline/gerry/blocks.py`:

```python
"""Census blocks: P.L. 94-171 (VAP, VTD code, interior point) and the block equivalency files."""
```

door:

```python
"""Census blocks: P.L. 94-171 (VAP, population, VTD code, interior point, county names) and the block
equivalency files; the unit of each block and the votes per district."""
```

Vervang in `pipeline/gerry/blocks.py`:

```python
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "POP100": 90, "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}
```

door:

```python
PL_GEO_FIELDS = {"SUMLEV": 2, "LOGRECNO": 7, "GEOCODE": 9, "VTD": 77, "NAME": 87, "POP100": 90,
                 "INTPTLAT": 92, "INTPTLON": 93}
PL_SEG2_FIELDS = {"LOGRECNO": 4, "P0030001": 5}
_BLOCK_FIELDS = ("SUMLEV", "LOGRECNO", "GEOCODE", "VTD", "POP100", "INTPTLAT", "INTPTLON")
_COUNTY_FIELDS = ("SUMLEV", "GEOCODE", "NAME")
```

Vervang in `pipeline/gerry/blocks.py`:

```python
def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame:
    """block_id (str 15), vap (int64), vtd (str), lat, lon (float64) for every block (SUMLEV 750).

    Read from the zip without extracting. The block VAP must add up to the state record (SUMLEV 040)."""
    st = st.lower()
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st}geo2020.pl", PL_GEO_FIELDS)
```

door:

```python
def _fields(names: Sequence[str]) -> dict[str, int]:
    return {name: PL_GEO_FIELDS[name] for name in names}


def read_pl_blocks(zip_path: Path, st: str) -> pd.DataFrame:
    """block_id (str 15), vap, pop (int64), vtd (str), lat, lon (float64) for every block (SUMLEV 750).

    Read from the zip without extracting. The block VAP and POP100 must add up to the state record (SUMLEV 040)."""
    st = st.lower()
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st}geo2020.pl", _fields(_BLOCK_FIELDS))
```

Vervang in `pipeline/gerry/blocks.py`:

```python
    out = pd.DataFrame({
        "block_id": blocks["GEOCODE"].to_numpy(),
        "vap": vap.astype("int64").to_numpy(),
        "vtd": blocks["VTD"].to_numpy(),
        "lat": pd.to_numeric(blocks["INTPTLAT"]).to_numpy(),
        "lon": pd.to_numeric(blocks["INTPTLON"]).to_numpy(),
    })
    pop = pd.to_numeric(blocks["POP100"]).to_numpy()
    if not out["block_id"].str.len().eq(15).all() or not out["block_id"].is_unique:
        raise BlocksError(f"{st}: block GEOCODE is not a unique 15-character code")
    if (out["vap"].to_numpy() > pop).any():
        raise BlocksError(f"{st}: VAP above POP100 in {int((out['vap'].to_numpy() > pop).sum())} blocks; "
                          "check PL_GEO_FIELDS and PL_SEG2_FIELDS")
    state_vap = int(vap_of[state["LOGRECNO"].iloc[0]])
    if int(out["vap"].sum()) != state_vap:
        raise BlocksError(f"{st}: block VAP adds up to {int(out['vap'].sum())}, state record says {state_vap}")
    return out
```

door:

```python
    pop = pd.to_numeric(blocks["POP100"], errors="coerce")
    if pop.isna().any():
        raise BlocksError(f"{st}: {int(pop.isna().sum())} blocks have no POP100")
    out = pd.DataFrame({
        "block_id": blocks["GEOCODE"].to_numpy(),
        "vap": vap.astype("int64").to_numpy(),
        "pop": pop.astype("int64").to_numpy(),
        "vtd": blocks["VTD"].to_numpy(),
        "lat": pd.to_numeric(blocks["INTPTLAT"]).to_numpy(),
        "lon": pd.to_numeric(blocks["INTPTLON"]).to_numpy(),
    })
    if not out["block_id"].str.len().eq(15).all() or not out["block_id"].is_unique:
        raise BlocksError(f"{st}: block GEOCODE is not a unique 15-character code")
    if (out["vap"] > out["pop"]).any():
        raise BlocksError(f"{st}: VAP above POP100 in {int((out['vap'] > out['pop']).sum())} blocks; "
                          "check PL_GEO_FIELDS and PL_SEG2_FIELDS")
    state_vap = int(vap_of[state["LOGRECNO"].iloc[0]])
    if int(out["vap"].sum()) != state_vap:
        raise BlocksError(f"{st}: block VAP adds up to {int(out['vap'].sum())}, state record says {state_vap}")
    state_pop = int(state["POP100"].iloc[0])
    if int(out["pop"].sum()) != state_pop:
        raise BlocksError(f"{st}: block POP100 adds up to {int(out['pop'].sum())}, state record says {state_pop}")
    return out


def read_pl_counties(zip_path: Path, st: str) -> pd.DataFrame:
    """county_id (str 5) and name (str, e.g. "Adair County") of every county record (SUMLEV 050)."""
    with zipfile.ZipFile(zip_path) as zf:
        geo = _read_pipe(zf, f"{st.lower()}geo2020.pl", _fields(_COUNTY_FIELDS))
    counties = geo[geo["SUMLEV"] == "050"]
    out = pd.DataFrame({"county_id": counties["GEOCODE"].to_numpy(), "name": counties["NAME"].to_numpy()})
    if out.empty or not out["county_id"].str.len().eq(5).all() or not out["county_id"].is_unique:
        raise BlocksError(f"{st}: county records are missing or their GEOCODE is not a unique 5-character code")
    return out
```

Vervang in `pipeline/gerry/blocks.py`:

```python
def unit_of_block(blocks: pd.DataFrame, unit_source: str, fips: str) -> pd.Series:
    """block_id -> unit_id. vtd: county GEOID + VTD code; block: the block; rds_county: the county."""
    ids = blocks["block_id"]
    if not ids.str.startswith(fips).all():
        raise BlocksError(f"blocks that do not start with FIPS {fips}, e.g. {ids[~ids.str.startswith(fips)].iloc[0]}")
    if unit_source == "vtd":
        blank = blocks["vtd"].str.strip() == ""
        if blank.any():
            raise BlocksError(f"{fips}: {int(blank.sum())} blocks without VTD code, e.g. {ids[blank].iloc[0]}")
        units = ids.str[:5] + blocks["vtd"]
    elif unit_source == "block":
        units = ids
    elif unit_source == "rds_county":
        units = ids.str[:5]
    else:
        raise BlocksError(f"unknown unit_source {unit_source!r}")
```

door:

```python
def unit_of_block(blocks: pd.DataFrame, unit_kind: str, fips: str) -> pd.Series:
    """block_id -> key of the unit the block lies in: vtd: county (GEOCODE[:5]) + VTD code;
    tract: GEOCODE[:11]; county: GEOCODE[:5]. A key need not be a unit of map.rds (water)."""
    ids = blocks["block_id"]
    if not ids.str.startswith(fips).all():
        raise BlocksError(f"blocks that do not start with FIPS {fips}, e.g. {ids[~ids.str.startswith(fips)].iloc[0]}")
    if unit_kind == "vtd":
        blank = blocks["vtd"].str.strip() == ""
        if blank.any():
            raise BlocksError(f"{fips}: {int(blank.sum())} blocks without VTD code, e.g. {ids[blank].iloc[0]}")
        units = ids.str[:5] + blocks["vtd"]
    elif unit_kind == "tract":
        units = ids.str[:11]
    elif unit_kind == "county":
        units = ids.str[:5]
    else:
        raise BlocksError(f"unknown unit_kind {unit_kind!r}")
```

De test `test_read_pl_blocks_rejects_vap_above_population` blijft slagen: hij vervangt `|10|` door `|5|`, en dan valt eerst de controle VAP boven POP100.

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -q
```

Verwacht: `22 passed`. Zonder data: `20 passed, 2 skipped`.

- [ ] **Step 5: Draai alle tests**

```powershell
.venv\Scripts\python -m pytest -q
```

Verwacht: `168 passed`.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/blocks.py tests/test_blocks.py
git commit -m "Read block population and county names, and key blocks by VTD, tract or county"
```

### Task 1.14: Verdelen binnen een tract

**Files:**
- Modify: `pipeline/gerry/blocks.py` (`block_weighted`)
- Modify: `tests/test_blocks.py`

**Interfaces:**
- Consumes: `_linked_blocks`, `BlocksError` (taak 1.8).
- Produces: `block_weighted(units, blocks, unit_of, district_of, vote_cols, weights: pd.DataFrame | None = None) -> pd.DataFrame`. `weights`: index `block_id`, een kolom per stemkolom in `vote_cols` (de blokstemmen van census-vest, uit `read_block_votes` van taak 1.15). Zonder `weights` werkt de functie als voorheen. `.attrs` krijgt twee tellingen erbij:
  - `block_count_votes` (float): de stemmen van gesplitste eenheden die naar aantal blokken zijn verdeeld, opgeteld over `vote_cols`.
  - `weight_fallback_units` (int): eenheden met stemmen in een kolom waarvan de gewichten in die kolom samen 0 zijn, zodat de regel met VAP geldt. Zonder `weights` 0.

De regel per blok en per stemkolom komt uit hoofdstuk 4 van de spec. Met `weights` krijgt een blok zijn deel van het gewicht van de eenheid in die kolom, over de blokken buiten `ZZ`. Is dat totaal 0, of zijn er geen `weights`, dan zijn deel van de VAP van de eenheid. Heeft de eenheid geen VAP, dan krijgt elk blok hetzelfde deel. Een blok zonder gewicht is een fout: de blokbestanden van census-vest dekken alle blokken uit P.L. 94-171.

`whole_unit` verandert niet. Die wijst elke eenheid in haar geheel toe op VAP en aantal blokken; gewichten spelen daar geen rol.

De aanroeper geeft alleen de stemkolommen per verkiezing mee en telt de composiet daarna op de districten op (taak 1.18). Zou de composiet zelf over blokken verdeeld worden met de som van de blokgewichten, dan klopt `d` per district niet meer met `d_pre_16 + d_pre_20`.

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_blocks.py`:

```python
    assert out["r"].tolist() == pytest.approx([20.0, 50.0])
    assert out.attrs == {"split_units": 2, "zero_vap_units": 1, "zero_vap_split_units": 1,
                         "units_without_blocks": 0}
```

door:

```python
    assert out["r"].tolist() == pytest.approx([20.0, 50.0])
    # U2 is split and its 6 + 0 votes went by block count
    assert out.attrs == {"split_units": 2, "zero_vap_units": 1, "zero_vap_split_units": 1,
                         "units_without_blocks": 0, "block_count_votes": 6.0, "weight_fallback_units": 0}


def tract_case():
    # T1: VAP 40 over t1 (01), t2 (02) and t3 (ZZ). T2: no VAP, t4 (01) and t5 (02).
    blocks = pl_blocks(["t1", "t2", "t3", "t4", "t5"], vaps=[10, 30, 0, 0, 0])
    unit_of = pd.Series(["T1", "T1", "T1", "T2", "T2"], index=blocks["block_id"])
    district_of = pd.Series(["01", "02", "ZZ", "01", "02"], index=blocks["block_id"])
    units = pd.DataFrame({"unit_id": ["T1", "T2"], "vap": [40, 0], "d": [100.0, 8.0], "r": [50.0, 4.0]})
    # census-vest block votes: the weight of a block within its tract, per column
    weights = pd.DataFrame({"d": [3.0, 1.0, 96.0, 0.0, 0.0], "r": [0.0, 0.0, 5.0, 0.0, 0.0]},
                           index=pd.Index(["t1", "t2", "t3", "t4", "t5"], name="block_id"))
    return units, blocks, unit_of, district_of, weights


def test_block_weighted_uses_block_weights_per_column():
    units, blocks, unit_of, district_of, weights = tract_case()
    out = block_weighted(units, blocks, unit_of, district_of, VOTES, weights=weights)
    # T1 d: weights 3 and 1 outside ZZ (t3 goes first): 75 to 01, 25 to 02.
    # T1 r: weights add up to 0 outside ZZ, so VAP: 10/40 = 12.5 to 01, 30/40 = 37.5 to 02.
    # T2: no weight and no VAP, so block count: d 4 and 4, r 2 and 2.
    assert out["d"].tolist() == pytest.approx([79.0, 29.0])
    assert out["r"].tolist() == pytest.approx([14.5, 39.5])
    # T1 (r) and T2 (d, r) have votes but no weight; T2's 8 + 4 votes went by block count
    assert out.attrs["weight_fallback_units"] == 2
    assert out.attrs["block_count_votes"] == pytest.approx(12.0)


def test_block_weighted_needs_a_weight_for_every_block():
    units, blocks, unit_of, district_of, weights = tract_case()
    with pytest.raises(BlocksError, match="t4"):
        block_weighted(units, blocks, unit_of, district_of, VOTES, weights=weights.drop("t4"))
```

In `tract_case` heeft blok `t3` in `ZZ` het grootste gewicht (96 van 100). Telt het mee, dan gaan de stemmen van T1 grotendeels verloren; de test laat zien dat ZZ-blokken eerst wegvallen, ook voor het gewicht.

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -q
```

Verwacht: `3 failed, 21 passed`. Eén keer `AssertionError` op `.attrs` (`Right contains 2 more items`) en twee keer `TypeError: block_weighted() got an unexpected keyword argument 'weights'`.

- [ ] **Step 3: Schrijf de code**

Vervang in `pipeline/gerry/blocks.py`:

```python
def block_weighted(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str]) -> pd.DataFrame:
    """Votes per district: each unit's votes go to its blocks by block VAP, or by block count
    if the unit has no VAP. Counts for the log are in .attrs."""
    b, votes, districts, without_blocks = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per_unit = b.groupby("unit_id").agg(unit_vap=("vap", "sum"), n_blocks=("vap", "size"))
    b = b.join(per_unit, on="unit_id")
    has_vap = (b["unit_vap"] > 0).to_numpy()
    weight = np.where(has_vap, b["vap"].to_numpy() / np.where(has_vap, b["unit_vap"].to_numpy(), 1),
                      1.0 / b["n_blocks"].to_numpy())
    block_votes = votes.loc[b["unit_id"]].to_numpy() * weight[:, None]
    totals = (pd.DataFrame(block_votes, columns=list(vote_cols)).groupby(b["district"].to_numpy()).sum()
              .reindex(districts, fill_value=0.0))
    out = totals.rename_axis("district").reset_index()
    n_districts = b.groupby("unit_id")["district"].nunique()
    split = n_districts.index[n_districts > 1]
    zero_vap = per_unit.index[per_unit["unit_vap"] == 0]
    out.attrs = {"split_units": len(split), "zero_vap_units": len(zero_vap),
                 "zero_vap_split_units": int(split.isin(zero_vap).sum()), "units_without_blocks": without_blocks}
    return out
```

door:

```python
def block_weighted(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, district_of: pd.Series,
                   vote_cols: Sequence[str], weights: pd.DataFrame | None = None) -> pd.DataFrame:
    """Votes per district: each unit's votes go to its blocks outside ZZ.

    With `weights` (tract states: census-vest block votes, index block_id, a column per vote column) a block
    gets its share of the unit's weight in that column. Where those weights add up to 0, and without
    `weights`, a block gets its share of the unit's VAP; in a unit without VAP every block gets the same
    share. Counts for the log are in .attrs; block_count_votes sums the votes of split units that went by
    block count, over vote_cols."""
    b, votes, districts, without_blocks = _linked_blocks(units, blocks, unit_of, district_of, vote_cols)
    per_unit = b.groupby("unit_id").agg(unit_vap=("vap", "sum"), n_blocks=("vap", "size"))
    b = b.join(per_unit, on="unit_id")
    has_vap = (b["unit_vap"] > 0).to_numpy()
    by_vap = np.where(has_vap, b["vap"].to_numpy() / np.where(has_vap, b["unit_vap"].to_numpy(), 1),
                      1.0 / b["n_blocks"].to_numpy())
    unit_votes = votes.loc[b["unit_id"]].to_numpy()
    by_count = np.repeat(~has_vap[:, None], len(vote_cols), axis=1)   # block x column: weight from block count
    weight = np.repeat(by_vap[:, None], len(vote_cols), axis=1)
    fallback_units = set()
    if weights is not None:
        own = weights.reindex(b["block_id"].to_numpy())[list(vote_cols)]
        missing = own.isna().any(axis=1).to_numpy()
        if missing.any():
            first = b["block_id"].iloc[missing.argmax()]
            raise BlocksError(f"{int(missing.sum())} blocks have no weight, e.g. {first}")
        own = own.to_numpy()
        unit_total = pd.DataFrame(own).groupby(b["unit_id"].to_numpy()).transform("sum").to_numpy()
        usable = unit_total > 0
        weight = np.where(usable, own / np.where(usable, unit_total, 1), weight)
        by_count &= ~usable
        no_weight = ~usable & (unit_votes != 0)
        fallback_units = set(b["unit_id"].to_numpy()[no_weight.any(axis=1)])
    block_votes = unit_votes * weight
    totals = (pd.DataFrame(block_votes, columns=list(vote_cols)).groupby(b["district"].to_numpy()).sum()
              .reindex(districts, fill_value=0.0))
    out = totals.rename_axis("district").reset_index()
    n_districts = b.groupby("unit_id")["district"].nunique()
    split = n_districts.index[n_districts > 1]
    zero_vap = per_unit.index[per_unit["unit_vap"] == 0]
    in_split = b["unit_id"].isin(split).to_numpy()[:, None]
    out.attrs = {"split_units": len(split), "zero_vap_units": len(zero_vap),
                 "zero_vap_split_units": int(split.isin(zero_vap).sum()), "units_without_blocks": without_blocks,
                 "block_count_votes": float(block_votes[by_count & in_split].sum()),
                 "weight_fallback_units": len(fallback_units)}
    return out
```

`by_count` is per blok en per kolom `True` als de stemmen naar aantal blokken gaan. Alle blokken van een eenheid delen die waarde, dus de som van `block_votes` over die cellen is gelijk aan de stemmen van die eenheden.

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_blocks.py -q
```

Verwacht: `24 passed`.

- [ ] **Step 5: Draai alle tests**

```powershell
.venv\Scripts\python -m pytest -q
```

Verwacht: `170 passed`.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/blocks.py tests/test_blocks.py
git commit -m "Spread tract votes over blocks by census-vest block votes"
```

### Task 1.15: unit_kind in config.yaml en stemmen per eenheid uit map.rds

**Files:**
- Modify: `pipeline/gerry/config.py` (`unit_kind`, `AlignEntry` en `align_to_alarm` eruit)
- Modify: `pipeline/config.yaml`
- Modify: `pipeline/gerry/sources.py` (één regel)
- Modify: `pipeline/gerry/units.py` (nieuwe inhoud)
- Modify: `tests/test_config.py`
- Modify: `tests/test_units.py` (nieuwe inhoud)
- Modify: `tests/test_sources.py`, `tests/test_ensemble.py` (hulpfuncties)
- Modify: `tests/test_rds.py` (één commentaarregel)
- Modify: `README.md` (één zin over de stembasis)

**Interfaces:**
- Consumes: `read_rds_table` (taak 1.4); `read_pl_counties` (taak 1.13, alleen in de datatest); `select_columns`, `add_composite`, `UnitsError` (taak 1.5, ongewijzigd).
- Produces:
  - `StateConfig.unit_kind: str`, één van `vtd`, `tract`, `county`. Het veld `unit_source` bestaat niet meer.
  - `Config` heeft geen veld `align_to_alarm` meer; `AlignEntry` bestaat niet meer. In `config.yaml` zijn de sleutels `align_to_alarm` en `unit_source` nu onbekend en geven ze een `ConfigError`.
  - `units.ID_LENGTH = {"vtd": 11, "tract": 11, "county": 5}`.
  - `unit_ids(table: pd.DataFrame, st: StateConfig, counties: pd.DataFrame | None = None) -> pd.Series`: de ID's (str, naam `unit_id`) in de volgorde van de tabel. `GEOID` als die kolom er is, anders `tract` (tractstaten) of de countynaam opgezocht in `counties` (countystaten, kolommen `county_id` en `name`). Fout (`UnitsError`) bij: geen ID-kolom, lege ID, ID niet van de goede lengte of niet beginnend met de FIPS-code, dubbele ID, een countynaam met nul of meer dan één treffer, en in VTD-staten een `GEOID` die niet gelijk is aan `GEOID[:5]` + `vtd`.
  - `load_units(st: StateConfig, root: Path, counties: pd.DataFrame | None = None) -> pd.DataFrame`: uit `alarm/{ST}_cd_2020_map.rds` de kolommen `unit_id` (str), `vap`, `pop` (int64), `cd_2020` (str, `"01"`, het district van ALARM's referentiekaart) en per verkiezing `d_<e>`, `r_<e>` (float64). `.attrs["empty_vote_fields"]` en `.attrs["empty_vote_units"]` zoals voorheen.
  - `read_block_votes(st: StateConfig, root: Path) -> pd.DataFrame`: uit `census_vest/{st}_2020_block.csv` de index `block_id` en per verkiezing `d_<e>`, `r_<e>` (float64). Lege velden worden 0; `.attrs["empty_vote_fields"]` en `.attrs["empty_vote_units"]` tellen velden en blokken.
  - `align_to_alarm` bestaat niet meer.

De regels voor de ID's komen uit hoofdstuk 4 van de spec. In de 44 bestanden van versie 15 levert dat `GEOID` op in de 38 VTD-staten en in ME, OR en WV, `tract` in CA en HI, en de countynaam in IA. Maine heeft ook een kolom `tract`, maar die bevat alleen de tractcode van 6 tekens. Kiest de code per ongeluk die kolom, dan faalt de controle op 11 tekens.

`cd_2020` gaat mee in `load_units` omdat taak 1.17 de bevolking per district van ALARM's referentiekaart nodig heeft. `02_join` laat de kolom weg in `units/{ST}.parquet` (taak 1.18).

`st.unit_kind` bepaalt ook welke blokbestanden `plan_downloads` plant; daarom verandert in `sources.py` één regel mee.

- [ ] **Step 1: Pas de tests van config.py aan**

Vervang in `tests/test_config.py`:

```python
        "align_to_alarm": [],
        "sources": {key: f"https://example.org/{key}" for key in SOURCE_KEYS},
        "states": {
            "MO": {
                "name": "Missouri", "fips": "29", "seats": 8, "map_name": "HB 2909 of 2022",
                "status": "In effect", "source_label": "Redistricting Data Hub",
                "source_url": "https://example.org/mo-2022", "bef": "cd118",
                "elections": ["pre_16", "pre_20"], "unit_source": "vtd",
```

door:

```python
        "sources": {key: f"https://example.org/{key}" for key in SOURCE_KEYS},
        "states": {
            "MO": {
                "name": "Missouri", "fips": "29", "seats": 8, "map_name": "HB 2909 of 2022",
                "status": "In effect", "source_label": "Redistricting Data Hub",
                "source_url": "https://example.org/mo-2022", "bef": "cd118",
                "elections": ["pre_16", "pre_20"], "unit_kind": "vtd",
```

Vervang in `tests/test_config.py`:

```python
                "source_url": "https://example.org/nm", "bef": "cd120",
                "elections": ["pre_16", "pre_20"], "unit_source": "vtd",
            },
```

door:

```python
                "source_url": "https://example.org/nm", "bef": "cd120",
                "elections": ["pre_16", "pre_20"], "unit_kind": "tract",
            },
```

Vervang in `tests/test_config.py`:

```python
    assert mo.elections == ("pre_16", "pre_20")
    assert mo.notes == ("blocked_map",)
```

door:

```python
    assert mo.elections == ("pre_16", "pre_20")
    assert (mo.unit_kind, cfg.states["NM"].unit_kind) == ("vtd", "tract")
    assert mo.notes == ("blocked_map",)
```

Vervang in `tests/test_config.py`:

```python
    assert cfg.at_large["VT"].fips == "50"
    assert cfg.align_to_alarm == ()
```

door:

```python
    assert cfg.at_large["VT"].fips == "50"
```

Vervang in `tests/test_config.py`:

```python
    ("states.NM.unit_source", "tract", "unit_source"),
```

door:

```python
    ("states.NM.unit_kind", "block", "unit_kind"),
    ("states.NM.unit_source", "vtd", "unknown keys"),     # the key before unit_kind
    ("align_to_alarm", [], "unknown keys"),               # replaced by the weights within a tract
```

Vervang in `tests/test_config.py`:

```python
@pytest.mark.parametrize("units, message", [
    (["0604900030"], "length 11"),        # ten characters
    (["06049000300"], "starting with 35"),  # California tract in a New Mexico entry
])
def test_align_entry_units_are_checked(tmp_path, units, message):
    raw = minimal()
    raw["align_to_alarm"] = [{"state": "NM", "rds": "alarm/NM_cd_2020_map.rds",
                              "unit_column": "tract", "unit_len": 11, "units": units}]
    with pytest.raises(ConfigError, match=message):
        load_config(write(tmp_path, raw))


def test_repo_root_holds_the_pipeline():
```

door:

```python
def test_repo_root_holds_the_pipeline():
```

Vervang in `tests/test_config.py`:

```python
BLOCK_STATES = {"CA", "HI", "ME", "OR"}
```

door:

```python
TRACT_STATES = {"CA", "HI", "ME", "OR"}
```

Vervang in `tests/test_config.py`:

```python
def test_real_config_bef_and_unit_source(cfg):
    assert {p for p, s in cfg.states.items() if s.bef == "cd118"} == {"MO"}
    assert {s.bef for s in cfg.states.values()} == {"cd120", "cd118"}
    assert {p for p, s in cfg.states.items() if s.unit_source == "block"} == BLOCK_STATES
    assert {p for p, s in cfg.states.items() if s.unit_source == "rds_county"} == {"WV"}
    vtd = {p for p, s in cfg.states.items() if s.unit_source == "vtd"}
    assert len(vtd) == 39 and "IA" in vtd
```

door:

```python
def test_real_config_bef_and_unit_kind(cfg):
    assert {p for p, s in cfg.states.items() if s.bef == "cd118"} == {"MO"}
    assert {s.bef for s in cfg.states.values()} == {"cd120", "cd118"}
    # the units of ALARM's map.rds (spec chapter 3)
    assert {p for p, s in cfg.states.items() if s.unit_kind == "tract"} == TRACT_STATES
    assert {p for p, s in cfg.states.items() if s.unit_kind == "county"} == {"IA", "WV"}
    vtd = {p for p, s in cfg.states.items() if s.unit_kind == "vtd"}
    assert len(vtd) == 38 and "NH" in vtd
```

Vervang in `tests/test_config.py`:

```python
    assert cfg.ensemble.name == "alarm_v15" and cfg.ensemble.version == 15
    assert [(a.state, a.unit_column, a.units) for a in cfg.align_to_alarm] == [
        ("CA", "tract", ("06049000300", "06093000200"))]
```

door:

```python
    assert cfg.ensemble.name == "alarm_v15" and cfg.ensemble.version == 15
```

- [ ] **Step 2: Schrijf de tests van units.py**

Nieuwe inhoud van `tests/test_units.py`:

```python
import logging

import numpy as np
import pandas as pd
import pytest
import rdata

from gerry.blocks import read_pl_counties
from gerry.config import StateConfig, data_dir
from gerry.units import UnitsError, add_composite, load_units, read_block_votes, select_columns, unit_ids


def make_state(postal, fips, unit_kind, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name="Test", fips=fips, seats=2, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_kind=unit_kind, extra_maps=(), notes=())


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ---- select_columns ----

def test_select_columns_returns_the_dem_and_rep_column():
    cols = ["GEOID20", "pre_16_rep_tru", "pre_16_dem_cli", "uss_16_dem_cor", "pre_20_dem_bid", "pre_20_rep_tru"]
    assert select_columns(cols, "pre_16") == ("pre_16_dem_cli", "pre_16_rep_tru")


def test_select_columns_matches_only_at_the_start():
    cols = ["pre_20_dem_bid", "pre_20_rep_tru", "xpre_20_dem_a", "sos_r20_rep_b"]
    assert select_columns(cols, "pre_20") == ("pre_20_dem_bid", "pre_20_rep_tru")


def test_select_columns_without_a_match_fails():
    with pytest.raises(UnitsError, match="pre_16"):
        select_columns(["pre_20_dem_bid", "pre_20_rep_tru"], "pre_16")


def test_select_columns_with_two_matches_fails():
    with pytest.raises(UnitsError, match="pre_16_dem_cli, pre_16_dem_oth"):
        select_columns(["pre_16_dem_cli", "pre_16_dem_oth", "pre_16_rep_tru"], "pre_16")


# ---- unit_ids (spec chapter 4, "Eenheid-ID's in map.rds") ----

NV = make_state("NV", "32", "vtd")
CA = make_state("CA", "06", "tract")
ME = make_state("ME", "23", "tract")
IA = make_state("IA", "19", "county")


def test_unit_ids_of_a_vtd_state_are_geoid():
    # VTD codes can hold letters and dashes, as in New Hampshire (ALTO01) and Alabama (008-03)
    table = pd.DataFrame({"GEOID": ["32001000001", "32003ALTO01", "32003008-03"],
                          "vtd": ["000001", "ALTO01", "008-03"]})
    assert unit_ids(table, NV).tolist() == ["32001000001", "32003ALTO01", "32003008-03"]


def test_unit_ids_of_a_vtd_state_must_be_county_plus_vtd():
    table = pd.DataFrame({"GEOID": ["32001000001", "32001000002"], "vtd": ["000001", "000003"]})
    with pytest.raises(UnitsError, match="32001000002"):
        unit_ids(table, NV)


def test_unit_ids_of_ca_and_hi_come_from_the_tract_column():
    # CA and HI have no GEOID column; tract holds the 11-character tract GEOID
    table = pd.DataFrame({"tract": ["06001400100", "06049000300"], "county": ["Alameda County", "Modoc County"]})
    assert unit_ids(table, CA).tolist() == ["06001400100", "06049000300"]


def test_unit_ids_prefer_geoid_over_a_short_tract_column():
    # Maine: GEOID is the tract GEOID, tract only the 6-digit tract code
    table = pd.DataFrame({"GEOID": ["23019000500"], "tract": ["000500"]})
    assert unit_ids(table, ME).tolist() == ["23019000500"]


COUNTIES = pd.DataFrame({"county_id": ["19001", "19003", "19005"],
                         "name": ["Adair County", "Adams County", "Allamakee County"]})


def test_unit_ids_of_iowa_come_from_the_county_names():
    table = pd.DataFrame({"county": ["Adams County", "Adair County"]})
    assert unit_ids(table, IA, COUNTIES).tolist() == ["19003", "19001"]


def test_unit_ids_of_iowa_need_a_matching_county_name():
    table = pd.DataFrame({"county": ["Adair County", "Adair"]})
    with pytest.raises(UnitsError, match="'Adair' \\(0 matches\\)"):
        unit_ids(table, IA, COUNTIES)


def test_unit_ids_of_iowa_need_a_unique_county_name():
    counties = pd.concat([COUNTIES, pd.DataFrame({"county_id": ["19007"], "name": ["Adams County"]})])
    table = pd.DataFrame({"county": ["Adair County", "Adams County"]})
    with pytest.raises(UnitsError, match="'Adams County' \\(2 matches\\)"):
        unit_ids(table, IA, counties)


def test_unit_ids_of_iowa_need_the_county_records():
    with pytest.raises(UnitsError, match="county records"):
        unit_ids(pd.DataFrame({"county": ["Adair County"]}), IA)


@pytest.mark.parametrize("ids, message", [
    (["0600140010", "06001400200"], "11 characters"),      # ten characters
    (["32001400100", "06001400200"], "starting with 06"),  # another state
    (["06001400100", "06001400100"], "duplicate"),
    (["06001400100", None], "without id"),
])
def test_unit_ids_are_checked(ids, message):
    table = pd.DataFrame({"tract": pd.array(ids, dtype="str")})
    with pytest.raises(UnitsError, match=message):
        unit_ids(table, CA)


def test_unit_ids_need_an_id_column():
    with pytest.raises(UnitsError, match="no id column"):
        unit_ids(pd.DataFrame({"vtd": ["000001"]}), NV)


# ---- load_units ----

def write_map(path, **columns):
    """A small map.rds: the given columns plus a list column, as in ALARM's redist_map."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = len(next(iter(columns.values())))
    columns["adj"] = [np.array([0], dtype=np.int32)] * n
    rdata.write_rds(path, columns)


def nv_map(tmp_path, vap=(1334.0, 8.0), d16=(164.7, np.nan)):
    write_map(tmp_path / "alarm" / "NV_cd_2020_map.rds",
              GEOID=np.array(["32001000001", "32003008-03"], dtype=object),
              vtd=np.array(["000001", "008-03"], dtype=object),
              cd_2020=np.array([2, 1], dtype=np.int32),
              pop=np.array([1741.0, 10.0]), vap=np.array(vap),
              pre_16_dem_cli=np.array(d16), pre_16_rep_tru=np.array([529.2, 2.5]),
              uss_16_dem_cor=np.array([1.0, 2.0]),
              pre_20_dem_bid=np.array([172.8, 3.0]), pre_20_rep_tru=np.array([510.4, 4.0]))


def test_load_units_reads_the_alarm_map(tmp_path, caplog):
    nv_map(tmp_path)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        units = load_units(NV, tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "pop", "cd_2020", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["32001000001", "32003008-03"]
    assert units["vap"].dtype == np.int64 and units["vap"].tolist() == [1334, 8]
    assert units["pop"].dtype == np.int64 and units["pop"].tolist() == [1741, 10]
    assert units["cd_2020"].tolist() == ["02", "01"]
    assert units["d_pre_16"].tolist() == [164.7, 0.0]          # the empty field became 0
    assert units["r_pre_20"].dtype == np.float64 and units["r_pre_20"].tolist() == [510.4, 4.0]
    assert units.attrs == {"empty_vote_fields": 1, "empty_vote_units": 1}
    assert "NV: 1 empty vote fields in 1 units set to 0" in caplog.text


def test_load_units_rejects_fractional_vap(tmp_path):
    nv_map(tmp_path, vap=(1334.5, 8.0))
    with pytest.raises(UnitsError, match="vap"):
        load_units(NV, tmp_path)


def test_load_units_with_one_election_and_county_geoids(tmp_path):
    write_map(tmp_path / "alarm" / "WV_cd_2020_map.rds",
              GEOID=np.array(["54063", "54037"], dtype=object), county=np.array(["063", "037"], dtype=object),
              cd_2020=np.array([1, 2], dtype=np.int32), pop=np.array([12376.0, 57701.0]),
              vap=np.array([9895.0, 44965.0]),
              pre_20_rep_tru=np.array([5068.0, 15033.0]), pre_20_dem_bid=np.array([1345.0, 12127.0]))
    units = load_units(make_state("WV", "54", "county", elections=("pre_20",)), tmp_path)
    assert list(units.columns) == ["unit_id", "vap", "pop", "cd_2020", "d_pre_20", "r_pre_20"]
    assert units["unit_id"].tolist() == ["54063", "54037"]
    assert units["d_pre_20"].tolist() == [1345.0, 12127.0]


# ---- read_block_votes (census-vest, tract states only) ----

BLOCK_CSV = """GEOID20,state,county,pop,vap,pre_16_dem_cli,pre_16_rep_tru,pre_20_dem_bid,pre_20_rep_tru,arv_16
060014001001000,CA,Alameda County,0,0,0,0,0,0,NA
060490003001452,CA,Modoc County,0,0,NA,NA,NA,NA,NA
060014001001001,CA,Alameda County,12,10,2.5,1.25,3,1,0
"""


def test_read_block_votes_sets_empty_fields_to_zero(tmp_path, caplog):
    write(tmp_path / "census_vest" / "ca_2020_block.csv", BLOCK_CSV)
    with caplog.at_level(logging.INFO, logger="gerry.units"):
        votes = read_block_votes(CA, tmp_path)
    assert votes.index.name == "block_id"
    assert votes.index.tolist() == ["060014001001000", "060490003001452", "060014001001001"]
    assert list(votes.columns) == ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]
    assert votes.loc["060490003001452"].tolist() == [0.0, 0.0, 0.0, 0.0]
    assert votes.loc["060014001001001"].tolist() == [2.5, 1.25, 3.0, 1.0]
    assert votes.attrs == {"empty_vote_fields": 4, "empty_vote_units": 1}
    assert "CA: 4 empty vote fields in 1 census-vest blocks set to 0" in caplog.text


# ---- add_composite ----

def test_add_composite_sums_two_elections():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_16": [10.0], "r_pre_16": [20.0], "d_pre_20": [1.5], "r_pre_20": [2.5]})
    out = add_composite(df, ["pre_16", "pre_20"])
    # d = 10 + 1.5, r = 20 + 2.5
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (11.5, 22.5)
    assert "d" not in df.columns


def test_add_composite_with_one_election_copies_it():
    df = pd.DataFrame({"unit_id": ["a"], "d_pre_20": [1345.0], "r_pre_20": [5068.0]})
    out = add_composite(df, ["pre_20"])
    assert (out.loc[0, "d"], out.loc[0, "r"]) == (1345.0, 5068.0)


# ---- the real map.rds files ----

IA_MAP = data_dir() / "alarm" / "IA_cd_2020_map.rds"
IA_PL = data_dir() / "census" / "pl" / "ia2020.pl.zip"
CA_MAP = data_dir() / "alarm" / "CA_cd_2020_map.rds"


@pytest.mark.data
@pytest.mark.skipif(not (IA_MAP.exists() and IA_PL.exists()), reason="needs the Iowa map.rds and P.L. 94-171 files")
def test_iowa_counties_match_the_census_names():
    units = load_units(make_state("IA", "19", "county"), data_dir(), read_pl_counties(IA_PL, "IA"))
    assert len(units) == 99
    assert units["unit_id"].str.startswith("19").all() and units["unit_id"].is_unique
    assert units.loc[0, ["unit_id", "vap", "cd_2020"]].tolist() == ["19001", 5834, "03"]   # Adair County


@pytest.mark.data
@pytest.mark.skipif(not CA_MAP.exists(), reason="needs alarm/CA_cd_2020_map.rds")
def test_california_tracts_follow_alarm():
    units = load_units(make_state("CA", "06", "tract"), data_dir())
    assert len(units) == 9129
    # spec chapter 10: two tracts in Modoc and Siskiyou County have no votes in ALARM's map.rds
    two = units[units["unit_id"].isin(["06049000300", "06093000200"])]
    assert two[["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20"]].to_numpy().sum() == 0.0
```

De kleine `.rds`-bestanden schrijft `rdata.write_rds` uit een dict, zoals in de tests van taak 1.4. De kolom `adj` is een lijstkolom, zoals in ALARM's bestanden; `read_rds_table` slaat hem over. `np.nan` in `pre_16_dem_cli` wordt in R een lege waarde.

- [ ] **Step 3: Pas de hulpfuncties en een commentaar in de andere tests aan**

Vervang in `tests/test_sources.py`:

```python
from gerry.config import AlignEntry, Config, EnsembleConfig, StateConfig
```

door:

```python
from gerry.config import Config, EnsembleConfig, StateConfig
```

Vervang in `tests/test_sources.py`:

```python
def make_state(postal, name, fips, seats, unit_source, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name=name, fips=fips, seats=seats, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_source=unit_source, extra_maps=(), notes=())
```

door:

```python
def make_state(postal, name, fips, seats, unit_kind, elections=("pre_16", "pre_20")):
    return StateConfig(postal=postal, name=name, fips=fips, seats=seats, map_name="m", status="In effect",
                       source_label="s", source_url="https://example.org/", bef="cd120",
                       elections=tuple(elections), unit_kind=unit_kind, extra_maps=(), notes=())
```

Vervang in `tests/test_sources.py`:

```python
        ensemble=EnsembleConfig(name="alarm_v15", doi=DOI, version=15, notes={}, fill={}),
        align_to_alarm=(AlignEntry(state="CA", rds="alarm/CA_cd_2020_map.rds", unit_column="tract",
                                   unit_len=11, units=("06049000300", "06093000200")),),
        sources=SOURCES,
        states={"NV": make_state("NV", "Nevada", "32", 4, "vtd"),
                "CA": make_state("CA", "California", "06", 52, "block"),
                "WV": make_state("WV", "West Virginia", "54", 2, "rds_county", elections=("pre_20",))},
```

door:

```python
        ensemble=EnsembleConfig(name="alarm_v15", doi=DOI, version=15, notes={}, fill={}),
        sources=SOURCES,
        states={"NV": make_state("NV", "Nevada", "32", 4, "vtd"),
                "CA": make_state("CA", "California", "06", 52, "tract"),
                "WV": make_state("WV", "West Virginia", "54", 2, "county", elections=("pre_20",))},
```

Vervang in `tests/test_ensemble.py`:

```python
                       elections=tuple(elections), unit_source="vtd", extra_maps=(), notes=())
```

door:

```python
                       elections=tuple(elections), unit_kind="vtd", extra_maps=(), notes=())
```

Vervang in `tests/test_rds.py`:

```python
    # The two tracts of align_to_alarm: ALARM's tract data has no votes there.
```

door:

```python
    # Two tracts without votes in ALARM's map.rds (spec chapter 10).
```

De test zelf blijft gelijk; alleen het commentaar noemde nog `align_to_alarm`.

- [ ] **Step 4: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_units.py -q
.venv\Scripts\python -m pytest -q --ignore=tests/test_units.py
```

Verwacht: het eerste commando geeft `ERROR tests/test_units.py` met `ImportError: cannot import name 'read_block_votes' from 'gerry.units'`. Het tweede geeft `32 failed, 121 passed`. In `test_config.py` meldt de oude lader eerst `ConfigError: config.yaml: missing keys ['align_to_alarm']`; daardoor faalt `test_minimal_config_loads_with_types`, en 22 gevallen van `test_invalid_config_raises` falen met `Regex pattern did not match`. `test_real_config_bef_and_unit_kind` faalt met `AttributeError: 'StateConfig' object has no attribute 'unit_kind'`. De 8 tests in `test_sources.py` en `test_ensemble.py` die een `StateConfig` bouwen, falen met `TypeError: StateConfig.__init__() got an unexpected keyword argument 'unit_kind'`.

- [ ] **Step 5: Pas config.py aan**

Vervang in `pipeline/gerry/config.py`:

```python
_UNIT_SOURCES = ("vtd", "block", "rds_county")
```

door:

```python
_UNIT_KINDS = ("vtd", "tract", "county")
```

Vervang in `pipeline/gerry/config.py`:

```python
    "status_checked", "census_vest_commit", "ensemble", "align_to_alarm",
    "sources", "states", "at_large",
```

door:

```python
    "status_checked", "census_vest_commit", "ensemble", "sources", "states", "at_large",
```

Vervang in `pipeline/gerry/config.py`:

```python
    "bef", "elections", "unit_source",
```

door:

```python
    "bef", "elections", "unit_kind",
```

Vervang in `pipeline/gerry/config.py`:

```python
    unit_source: str
    extra_maps: tuple[ExtraMap, ...]
```

door:

```python
    unit_kind: str
    extra_maps: tuple[ExtraMap, ...]
```

Vervang in `pipeline/gerry/config.py`:

```python
@dataclass(frozen=True)
class AlignEntry:
    state: str
    rds: str
    unit_column: str
    unit_len: int
    units: tuple[str, ...]


@dataclass(frozen=True)
class Config:
    status_checked: date
    census_vest_commit: str
    ensemble: EnsembleConfig
    align_to_alarm: tuple[AlignEntry, ...]
    sources: dict[str, str]
```

door:

```python
@dataclass(frozen=True)
class Config:
    status_checked: date
    census_vest_commit: str
    ensemble: EnsembleConfig
    sources: dict[str, str]
```

Vervang in `pipeline/gerry/config.py`:

```python
        ensemble=_ensemble(raw["ensemble"], states),
        align_to_alarm=_align(raw["align_to_alarm"], states),
        sources=_sources(raw["sources"]),
```

door:

```python
        ensemble=_ensemble(raw["ensemble"], states),
        sources=_sources(raw["sources"]),
```

Vervang in `pipeline/gerry/config.py`:

```python
        unit_source=_choice(raw, "unit_source", where, _UNIT_SOURCES),
```

door:

```python
        unit_kind=_choice(raw, "unit_kind", where, _UNIT_KINDS),
```

Vervang in `pipeline/gerry/config.py`:

```python
def _align(raw: Any, states: dict[str, StateConfig]) -> tuple[AlignEntry, ...]:
    if raw is None:
        return ()
    if not isinstance(raw, list):
        raise ConfigError("align_to_alarm: expected a list")
    entries = []
    keys = ("state", "rds", "unit_column", "unit_len", "units")
    for i, item in enumerate(raw):
        where = f"align_to_alarm[{i}]"
        _mapping(item, where)
        _only_keys(item, keys, where, required=keys)
        postal = _text(item, "state", where)
        if postal not in states:
            raise ConfigError(f"{where}.state: {postal!r} is not in states")
        unit_len = _int(item["unit_len"], f"{where}.unit_len", 1)
        units = item["units"]
        if not isinstance(units, list) or not units:
            raise ConfigError(f"{where}.units: expected a non-empty list")
        for unit in units:
            if (not isinstance(unit, str) or len(unit) != unit_len
                    or not unit.startswith(states[postal].fips)):
                raise ConfigError(
                    f"{where}.units: {unit!r} must be quoted text of length {unit_len} "
                    f"starting with {states[postal].fips}"
                )
        entries.append(AlignEntry(
            state=postal,
            rds=_text(item, "rds", where),
            unit_column=_text(item, "unit_column", where),
            unit_len=unit_len,
            units=tuple(units),
        ))
    return tuple(entries)


def _sources(raw: Any) -> dict[str, str]:
```

door:

```python
def _sources(raw: Any) -> dict[str, str]:
```

- [ ] **Step 6: Pas config.yaml aan**

Vervang overal in `pipeline/config.yaml` (39 regels: de 38 VTD-staten en IA, dat hieronder `county` wordt):

```yaml
    unit_source: vtd
```

door:

```yaml
    unit_kind: vtd
```

Vervang overal in `pipeline/config.yaml` (CA, HI, ME en OR):

```yaml
    unit_source: block
```

door:

```yaml
    unit_kind: tract
```

Vervang in `pipeline/config.yaml` (WV):

```yaml
    unit_source: rds_county
```

door:

```yaml
    unit_kind: county
```

Vervang in `pipeline/config.yaml` (IA, de regel na `elections` onder Iowa):

```yaml
    source_url: https://services2.arcgis.com/KhKjlwEBlPJd6v51/arcgis/rest/services/RedistrictingPlan2/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_kind: vtd
```

door:

```yaml
    source_url: https://services2.arcgis.com/KhKjlwEBlPJd6v51/arcgis/rest/services/RedistrictingPlan2/FeatureServer
    bef: cd120
    elections: [pre_16, pre_20]
    unit_kind: county
```

Vervang in `pipeline/config.yaml`:

```yaml
# Units whose votes in the unit file differ from the data ALARM summed for the
# ensembles. units.py scales the block votes in these tracts to ALARM's totals.
align_to_alarm:
  - state: CA
    rds: alarm/CA_cd_2020_map.rds
    unit_column: tract
    unit_len: 11
    units: ["06049000300", "06093000200"]

sources:
```

door:

```yaml
sources:
```

Vervang in `pipeline/config.yaml`:

```yaml
status_checked: 2026-10-03
census_vest_commit: 243c8a8134ecf8151777a9388c48323e274767e2
```

door:

```yaml
status_checked: 2026-10-03
# census-vest block files of CA, HI, ME and OR: only weights within a tract.
# The votes per unit come from ALARM's map.rds (unit_kind per state below).
census_vest_commit: 243c8a8134ecf8151777a9388c48323e274767e2
```

Staat `status_checked` intussen op een latere datum, laat die datum dan staan en voeg alleen de twee commentaarregels toe. De URL `census_vest` onder `sources` blijft gelijk; `{kind}` is voortaan altijd `block`.

- [ ] **Step 7: Schrijf units.py**

Nieuwe inhoud van `pipeline/gerry/units.py`:

```python
"""Votes per unit from ALARM's map.rds (VTD, tract or county): unit ids, column choice, loading,
the census-vest block votes that weigh blocks within a tract, and the composite."""
from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence
from pathlib import Path

import pandas as pd

from gerry.config import StateConfig
from gerry.rds import read_rds_table

log = logging.getLogger(__name__)

ID_LENGTH = {"vtd": 11, "tract": 11, "county": 5}   # county (5) + VTD code (6); tract GEOID; county FIPS


class UnitsError(ValueError):
    pass


def select_columns(columns: Iterable[str], election: str) -> tuple[str, str]:
    """(dem, rep): the one column matching ^<election>_dem_ and the one matching ^<election>_rep_."""
    columns = list(columns)
    found = []
    for party in ("dem", "rep"):
        pattern = re.compile(rf"^{re.escape(election)}_{party}_")
        hits = [c for c in columns if pattern.match(c)]
        if len(hits) != 1:
            raise UnitsError(f"{election}: expected one column matching ^{election}_{party}_, "
                             f"found {len(hits)}: {', '.join(hits) or 'none'}")
        found.append(hits[0])
    return found[0], found[1]


def _county_fips(names: pd.Series, counties: pd.DataFrame | None, st: StateConfig) -> pd.Series:
    """County names such as "Adair County" -> FIPS codes, through the P.L. 94-171 county records."""
    if counties is None:
        raise UnitsError(f"{st.postal}: the map has no GEOID column; its county names need the "
                         "P.L. 94-171 county records")
    matches = names.map(counties["name"].value_counts()).fillna(0).astype("int64")
    bad = names[matches != 1]
    if len(bad):
        raise UnitsError(f"{st.postal}: {len(bad)} county names do not match exactly one P.L. 94-171 county, "
                         f"e.g. {bad.iloc[0]!r} ({int(matches[bad.index[0]])} matches)")
    return names.map(counties.drop_duplicates("name", keep=False).set_index("name")["county_id"])


def unit_ids(table: pd.DataFrame, st: StateConfig, counties: pd.DataFrame | None = None) -> pd.Series:
    """Text id of every unit in a map.rds table (spec chapter 4): GEOID; without GEOID the column tract
    (CA, HI) or the county name looked up in `counties` (IA, columns county_id and name)."""
    if "GEOID" in table.columns:
        ids, source = table["GEOID"], "GEOID"
    elif st.unit_kind == "tract" and "tract" in table.columns:
        ids, source = table["tract"], "tract"
    elif st.unit_kind == "county" and "county" in table.columns:
        ids, source = _county_fips(table["county"], counties, st), "county"
    else:
        raise UnitsError(f"{st.postal}: no id column for {st.unit_kind} units")
    if ids.isna().any():
        raise UnitsError(f"{st.postal}: {int(ids.isna().sum())} units without id in column {source}")
    if not pd.api.types.is_string_dtype(ids):
        raise UnitsError(f"{st.postal}: column {source} is not text but {ids.dtype}")
    length = ID_LENGTH[st.unit_kind]
    bad = ids[(ids.str.len() != length) | ~ids.str.startswith(st.fips)]
    if len(bad):
        raise UnitsError(f"{st.postal}: {len(bad)} ids in column {source} are not {length} characters "
                         f"starting with {st.fips}, e.g. {bad.iloc[0]}")
    dup = ids[ids.duplicated()]
    if len(dup):
        raise UnitsError(f"{st.postal}: duplicate unit ids: {', '.join(dup.head(5))}")
    if st.unit_kind == "vtd":
        if "vtd" not in table.columns:
            raise UnitsError(f"{st.postal}: the map has no vtd column")
        off = (ids != ids.str[:5] + table["vtd"]).to_numpy()
        if off.any():
            raise UnitsError(f"{st.postal}: {int(off.sum())} GEOIDs are not county + vtd, e.g. "
                             f"{ids[off].iloc[0]} with vtd {table['vtd'][off].iloc[0]}")
    return ids.astype(str).reset_index(drop=True).rename("unit_id")


def _whole(values: pd.Series, name: str, st: StateConfig) -> pd.Series:
    numbers = pd.to_numeric(values)
    if numbers.isna().any() or (numbers % 1 != 0).any():
        raise UnitsError(f"{st.postal}: {name} is missing or not a whole number in some units")
    return numbers.astype("int64")


def _zero_empty(df: pd.DataFrame, cols: list[str]) -> tuple[int, int]:
    """Set empty vote fields to 0 in place; return (fields, rows) that were empty."""
    empty = df[cols].isna()
    n_fields, n_rows = int(empty.sum().sum()), int(empty.any(axis=1).sum())
    df[cols] = df[cols].fillna(0.0)
    return n_fields, n_rows


def load_units(st: StateConfig, root: Path, counties: pd.DataFrame | None = None) -> pd.DataFrame:
    """unit_id (str), vap and pop (int64), cd_2020 (district of ALARM's reference map, str "01") and
    d_<e>, r_<e> (float64) per election, from alarm/{ST}_cd_2020_map.rds.

    `counties` (from read_pl_counties) is needed for a county map without GEOID (Iowa).
    Empty vote fields become 0; their number is in .attrs["empty_vote_fields"] and
    .attrs["empty_vote_units"], and in the log."""
    table = read_rds_table(Path(root) / "alarm" / f"{st.postal}_cd_2020_map.rds")
    missing = [c for c in ("vap", "pop", "cd_2020") if c not in table.columns]
    if missing:
        raise UnitsError(f"{st.postal}: map.rds has no column {', '.join(missing)}")
    out = pd.DataFrame({"unit_id": unit_ids(table, st, counties)})
    out["vap"] = _whole(table["vap"], "vap", st).to_numpy()
    out["pop"] = _whole(table["pop"], "pop", st).to_numpy()
    out["cd_2020"] = _whole(table["cd_2020"], "cd_2020", st).map("{:02d}".format).to_numpy()
    for e in st.elections:
        dem, rep = select_columns(table.columns, e)
        out[f"d_{e}"] = pd.to_numeric(table[dem]).astype("float64").to_numpy()
        out[f"r_{e}"] = pd.to_numeric(table[rep]).astype("float64").to_numpy()
    n_fields, n_units = _zero_empty(out, [f"{p}_{e}" for e in st.elections for p in ("d", "r")])
    if n_fields:
        log.info("%s: %d empty vote fields in %d units set to 0", st.postal, n_fields, n_units)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_units}
    return out


def read_block_votes(st: StateConfig, root: Path) -> pd.DataFrame:
    """Votes per census block from census-vest/{st}_2020_block.csv (tract states): index block_id,
    columns d_<e>, r_<e> (float64). They only weigh the blocks within a tract (spec chapter 4).
    Empty fields become 0; counted in .attrs as in load_units, and logged."""
    path = Path(root) / "census_vest" / f"{st.postal.lower()}_2020_block.csv"
    header = pd.read_csv(path, nrows=0, encoding="utf-8").columns
    names = {}
    for e in st.elections:
        dem, rep = select_columns(header, e)
        names[dem], names[rep] = f"d_{e}", f"r_{e}"
    table = pd.read_csv(path, usecols=["GEOID20", *names], dtype={"GEOID20": str}, encoding="utf-8")
    ids = table["GEOID20"]
    if ids.isna().any() or not ids.str.len().eq(15).all() or not ids.is_unique:
        raise UnitsError(f"{st.postal}: GEOID20 in {path.name} is not a unique 15-character block code")
    out = table.rename(columns=names).set_index("GEOID20").rename_axis("block_id")[list(names.values())]
    out = out.astype("float64")
    n_fields, n_blocks = _zero_empty(out, list(names.values()))
    if n_fields:
        log.info("%s: %d empty vote fields in %d census-vest blocks set to 0", st.postal, n_fields, n_blocks)
    out.attrs = {"empty_vote_fields": n_fields, "empty_vote_units": n_blocks}
    return out


def add_composite(df: pd.DataFrame, elections: Sequence[str]) -> pd.DataFrame:
    """Copy of df with d = sum of d_<e> and r = sum of r_<e> over the elections."""
    out = df.copy()
    out.attrs = dict(df.attrs)
    out["d"] = out[[f"d_{e}" for e in elections]].sum(axis=1)
    out["r"] = out[[f"r_{e}" for e in elections]].sum(axis=1)
    return out
```

- [ ] **Step 8: Pas sources.py en README.md aan**

Vervang in `pipeline/gerry/sources.py`:

```python
        if cfg.states[p].unit_source == "block":
```

door:

```python
        if cfg.states[p].unit_kind == "tract":
```

De README zei dat de stemmen per precinct geteld zijn. Met `map.rds` klopt dat niet meer voor de tract- en countystaten (spec hoofdstuk 2, afwijking 5).

Vervang in `README.md`:

```markdown
All three count the same votes. These are the 2016 and 2020 presidential results added together, by precinct. West Virginia uses 2020 only, by county.
```

door:

```markdown
All three count the same votes. These are the 2016 and 2020 presidential results added together, per voting district, from the ALARM Project's data. California, Hawaii, Maine and Oregon have them per census tract, Iowa and West Virginia per county. West Virginia uses 2020 only.
```

- [ ] **Step 9: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_config.py tests/test_units.py tests/test_sources.py tests/test_ensemble.py -q
(Select-String -Path pipeline\config.yaml -Pattern "unit_source|align_to_alarm").Count
.venv\Scripts\python -m pytest -q
```

Verwacht: `91 passed`, dan `0`, dan `178 passed`. De twee datatests van `test_units.py` vinden in Iowa 99 county's (de eerste is Adair County, `19001`, VAP 5.834, district 03 van ALARM's referentiekaart) en in California 9.129 tracts, waarvan de twee tracts in Modoc en Siskiyou County geen stemmen hebben.

- [ ] **Step 10: Commit**

```powershell
git add README.md pipeline/config.yaml pipeline/gerry/config.py pipeline/gerry/sources.py pipeline/gerry/units.py tests/test_config.py tests/test_ensemble.py tests/test_rds.py tests/test_sources.py tests/test_units.py
git commit -m "Load votes per unit from ALARM's map.rds and replace unit_source with unit_kind"
```

### Task 1.16: Controle: VAP en bevolking per eenheid

**Files:**
- Modify: `pipeline/gerry/checks.py` (`check_vap` wordt `check_vap_pop`)
- Modify: `tests/test_checks.py`

**Interfaces:**
- Consumes: `CheckError` (taak 0.5); de `units` van `load_units` (taak 1.15, kolommen `unit_id`, `vap`, `pop`); de `blocks` van `read_pl_blocks` en de sleutels van `unit_of_block` (taak 1.13).
- Produces: `check_vap_pop(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, state: str) -> tuple[int, int]`. Per eenheid moet de som van blok-VAP gelijk zijn aan `vap` en de som van POP100 aan `pop`. Blokken waarvan de sleutel geen eenheid is, moeten VAP 0 en bevolking 0 hebben; de functie geeft hun aantal en het aantal van hun sleutels terug. Een blok zonder sleutel is een fout. Faalt iets, dan `CheckError("vap_pop", state, ...)`. `check_vap` bestaat niet meer.

Op de echte data zijn er zulke lege blokken in drie staten: 631 blokken in 38 VTD's in MI, 63 blokken in 4 VTD's in OH en 112 blokken in 6 tracts in ME. Het gaat steeds om water dat ALARM niet in `map.rds` opnam. In MI hebben die 38 VTD's bij census-vest samen 17.272 stemmen; ALARM telt ze niet mee, en wij dus ook niet (spec, hoofdstuk 10).

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_checks.py`:

```python
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap)


def units_table():
    return pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 5],
                         "d_pre_20": [30.0, 6.0, 0.0], "r_pre_20": [60.0, 0.0, 0.0],
                         "d": [30.0, 6.0, 0.0], "r": [60.0, 0.0, 0.0]})


def blocks_table():
    return pd.DataFrame({"block_id": ["b1", "b2", "b3", "b4"], "vap": [10, 20, 0, 5]})
```

door:

```python
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap_pop)


def units_table():
    return pd.DataFrame({"unit_id": ["U1", "U2", "U3"], "vap": [30, 0, 5], "pop": [40, 2, 6],
                         "d_pre_20": [30.0, 6.0, 0.0], "r_pre_20": [60.0, 0.0, 0.0],
                         "d": [30.0, 6.0, 0.0], "r": [60.0, 0.0, 0.0]})


def blocks_table():
    return pd.DataFrame({"block_id": ["b1", "b2", "b3", "b4"], "vap": [10, 20, 0, 5], "pop": [12, 28, 2, 6]})
```

Vervang in `tests/test_checks.py`:

```python
# ---- check_vap ----

def test_vap_passes_when_blocks_add_up_to_units():
    check_vap(units_table(), blocks_table(), UNIT_OF, "NV")


def test_vap_fails_when_a_unit_differs():
    blocks = blocks_table()
    blocks.loc[1, "vap"] = 21
    with pytest.raises(CheckError, match="vap failed for NV.*U1.*30.*31"):
        check_vap(units_table(), blocks, UNIT_OF, "NV")


def test_vap_fails_for_block_vap_outside_the_unit_file():
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5"], "vap": [3]})], ignore_index=True)
    unit_of = pd.concat([UNIT_OF, pd.Series(["U9"], index=["b5"])])
    with pytest.raises(CheckError, match="U9"):
        check_vap(units_table(), blocks, unit_of, "NV")


def test_vap_fails_for_block_vap_without_a_unit():
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5"], "vap": [3]})], ignore_index=True)
    with pytest.raises(CheckError, match="vap failed for NV.*b5"):
        check_vap(units_table(), blocks, UNIT_OF, "NV")
```

door:

```python
# ---- check_vap_pop ----

def with_water(vap=(0, 0), pop=(0, 0)):
    """Blocks b5 and b6 whose key W1 is not a unit, as the water VTDs that ALARM left out in MI and OH."""
    blocks = pd.concat([blocks_table(), pd.DataFrame({"block_id": ["b5", "b6"], "vap": list(vap), "pop": list(pop)})],
                       ignore_index=True)
    unit_of = pd.concat([UNIT_OF, pd.Series(["W1", "W1"], index=["b5", "b6"])])
    return blocks, unit_of


def test_vap_pop_passes_when_blocks_add_up_to_units():
    assert check_vap_pop(units_table(), blocks_table(), UNIT_OF, "NV") == (0, 0)


def test_vap_pop_fails_when_the_vap_of_a_unit_differs():
    blocks = blocks_table()
    blocks.loc[1, "vap"] = 21
    with pytest.raises(CheckError, match="vap_pop failed for NV: vap: 1 units differ, e.g. U1: map 30, blocks 31"):
        check_vap_pop(units_table(), blocks, UNIT_OF, "NV")


def test_vap_pop_fails_when_the_population_of_a_unit_differs():
    blocks = blocks_table()
    blocks.loc[2, "pop"] = 3
    with pytest.raises(CheckError, match="pop: 1 units differ, e.g. U2: map 2, blocks 3"):
        check_vap_pop(units_table(), blocks, UNIT_OF, "NV")


def test_vap_pop_counts_empty_blocks_without_a_unit():
    blocks, unit_of = with_water()
    # two blocks, one key
    assert check_vap_pop(units_table(), blocks, unit_of, "NV") == (2, 1)


@pytest.mark.parametrize("vap, pop", [((0, 3), (0, 4)), ((0, 0), (0, 1))])
def test_vap_pop_fails_for_people_in_blocks_without_a_unit(vap, pop):
    blocks, unit_of = with_water(vap, pop)
    with pytest.raises(CheckError, match="vap_pop failed for NV: 1 blocks with VAP or population.*b6"):
        check_vap_pop(units_table(), blocks, unit_of, "NV")


def test_vap_pop_fails_for_a_block_without_a_key():
    blocks, _ = with_water()
    with pytest.raises(CheckError, match="b5"):
        check_vap_pop(units_table(), blocks, UNIT_OF, "NV")
```

De andere controles in dit bestand gebruiken `units_table()` en `blocks_table()` ook; de kolom `pop` verandert hun uitkomst niet.

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py -q
```

Verwacht: `ERROR tests/test_checks.py` met `ImportError: cannot import name 'check_vap_pop' from 'gerry.checks'`.

- [ ] **Step 3: Schrijf de code**

Vervang in `pipeline/gerry/checks.py`:

```python
def check_vap(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, state: str) -> None:
    """Block VAP (P0030001) summed per unit equals the VAP in the unit file."""
    unit_ids = blocks["block_id"].map(unit_of)
    unmapped = blocks.loc[unit_ids.isna() & (blocks["vap"] > 0), "block_id"]
    if len(unmapped):
        raise CheckError("vap", state, f"{len(unmapped)} blocks with VAP belong to no unit, "
                                       f"e.g. {unmapped.iloc[0]}")
    by_unit = blocks["vap"].groupby(unit_ids.to_numpy()).sum()
    expected = units.set_index("unit_id")["vap"]
    got = by_unit.reindex(expected.index, fill_value=0)
    bad = expected.index[(got != expected).to_numpy()]
    if len(bad):
        first = bad[0]
        raise CheckError("vap", state, f"{len(bad)} units differ, e.g. {first}: unit file {int(expected[first])}, "
                                       f"blocks {int(got[first])}")
    outside = by_unit[~by_unit.index.isin(expected.index) & (by_unit > 0).to_numpy()]
    if len(outside):
        raise CheckError("vap", state, f"{len(outside)} block units with VAP are not in the unit file, "
                                       f"e.g. {outside.index[0]} ({int(outside.iloc[0])})")
```

door:

```python
def check_vap_pop(units: pd.DataFrame, blocks: pd.DataFrame, unit_of: pd.Series, state: str) -> tuple[int, int]:
    """Per unit, block VAP (P0030001) and POP100 add up to vap and pop of map.rds. Blocks whose key
    (unit_of) is not a unit must have VAP 0 and POP100 0. Returns (number of those blocks, of their keys)."""
    keys = blocks["block_id"].map(unit_of)
    if keys.isna().any():
        raise CheckError("vap_pop", state, f"{int(keys.isna().sum())} blocks have no key, "
                                           f"e.g. {blocks.loc[keys.isna(), 'block_id'].iloc[0]}")
    known = keys.isin(units["unit_id"]).to_numpy()
    outside = blocks[~known]
    people = outside[(outside["vap"] > 0) | (outside["pop"] > 0)]
    if len(people):
        first = people.iloc[0]
        raise CheckError("vap_pop", state, f"{len(people)} blocks with VAP or population belong to no unit, "
                                           f"e.g. {first['block_id']} (VAP {int(first['vap'])}, "
                                           f"population {int(first['pop'])})")
    sums = blocks[known].groupby(keys[known].to_numpy())[["vap", "pop"]].sum()
    expected = units.set_index("unit_id")
    for col in ("vap", "pop"):
        got = sums[col].reindex(expected.index, fill_value=0)
        bad = expected.index[(got != expected[col]).to_numpy()]
        if len(bad):
            first = bad[0]
            raise CheckError("vap_pop", state, f"{col}: {len(bad)} units differ, e.g. {first}: "
                                               f"map {int(expected.at[first, col])}, blocks {int(got[first])}")
    return int((~known).sum()), int(keys[~known].nunique())
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py -q
.venv\Scripts\python -m pytest -q
```

Verwacht: `22 passed`, dan `181 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/checks.py tests/test_checks.py
git commit -m "Check VAP and population per unit, and that blocks without a unit are empty"
```

### Task 1.17: ALARM's referentiekaart: labels uit map.rds en controle tegen CD118

**Files:**
- Modify: `pipeline/gerry/ensemble.py` (nieuw `reference_labels`)
- Modify: `pipeline/gerry/checks.py` (nieuw `check_reference_labels`)
- Modify: `tests/test_ensemble.py`
- Modify: `tests/test_checks.py`

**Interfaces:**
- Consumes: `REFERENCE_DRAW`, `_district_codes`, `read_stats` (taak 1.9); `CheckError` (taak 0.5).
- Produces:
  - `reference_labels(stats: pd.DataFrame, map_pop: pd.Series, postal: str) -> dict[str, str]`: voor elk district van `cd_2020` in het stats-bestand het label van het district in `map.rds` met precies dezelfde bevolking (`total_pop` tegen `map_pop`). `map_pop`: bevolking per label van `cd_2020` in `map.rds`, index `"01"`, `"02"`, ... Een district met nul of meer treffers, of twee districten met dezelfde treffer, geven `CheckError("reference_labels", postal, ...)`.
  - `check_reference_labels(labels: pd.Series, district_of: pd.Series, pop: pd.Series, state: str, min_share: float = 0.97) -> float`: `labels` is per blok het label van `cd_2020` van zijn eenheid in `map.rds` (blokken zonder eenheid hebben geen label en vallen weg), `district_of` het CD118-district, `pop` de POP100. Zonder ZZ-blokken. Elk label moet de grootste bevolkingsoverlap hebben met het CD118-district met dezelfde code, zonder gelijke stand; elk CD118-district moet een label zijn; en minstens `min_share` van de bevolking moet in beide dezelfde code hebben. Geeft dat aandeel terug. Anders `CheckError("reference_labels", state, ...)`.

`reference_labels` staat in `ensemble.py`. Dat bestand leest het stats-bestand en kent `REFERENCE_DRAW`, dus de nummering van ALARM's referentiekaart hoort daar. Het is een pure functie die met een paar regels test-data te testen is. De vergelijking met CD118 is een controle die de pijplijn stopt; die staat bij de andere controles in `checks.py`. `02_join.py` (taak 1.18) koppelt ze, want alleen daar zijn `map.rds`, de blokken uit P.L. 94-171 en CD118 tegelijk geladen.

Op de echte data nummert alleen Oregon anders (stats 1 wordt 02, 2 wordt 04, 3 wordt 05, 4 wordt 06, 5 wordt 03, 6 wordt 01). In alle 44 staten past elk label van `map.rds` bij het CD118-district met dezelfde code. De grens van 97% geldt voor de hele staat: het laagste aandeel is 0,9794 (AZ). Per label zou de grens niet werken: in CA liggen 7 districten onder 97% (district 48 heeft maar 93,9% van zijn bevolking in CD118-district 48), in AZ en MA 2 en in FL 1. Dat komt doordat ALARM hele eenheden toewijst en CD118 eenheden splitst.

- [ ] **Step 1: Schrijf de falende tests**

Vervang in `tests/test_ensemble.py`:

```python
from gerry.ensemble import N_PLANS, district_votes, read_stats
```

door:

```python
from gerry.ensemble import N_PLANS, district_votes, read_stats, reference_labels
```

Vervang in `tests/test_ensemble.py`:

```python
NV_STATS = data_dir() / "alarm" / "NV_cd_2020_stats.csv"
```

door:

```python
# ---- reference_labels (Task 1.17) ----

def reference_stats(pops):
    """cd_2020 rows with the given total_pop per district, plus one plan that must be ignored."""
    n = len(pops)
    return pd.DataFrame({"draw": ["cd_2020"] * n + ["1"] * n, "district": list(range(1, n + 1)) * 2,
                         "total_pop": list(pops) + [999] * n})


def map_pop(*pops):
    return pd.Series(list(pops), index=[f"{k:02d}" for k in range(1, len(pops) + 1)])


def test_reference_labels_follow_the_population():
    # stats district 1 has the population of map.rds district 03, and so on (as in Oregon)
    labels = reference_labels(reference_stats([300, 100, 200]), map_pop(100, 200, 300), "OR")
    assert labels == {"01": "03", "02": "01", "03": "02"}


@pytest.mark.parametrize("stats_pops, pops, message", [
    ([301, 100, 200], (100, 200, 300), "cd_2020 district 01 \\(population 301\\) matches 0 districts of map.rds"),
    ([300, 100, 100], (100, 100, 300), "cd_2020 district 02 \\(population 100\\) matches 2 districts of map.rds"),
    ([100, 100, 300], (100, 200, 300), "cd_2020 districts 01, 02 all match district 01 of map.rds"),
])
def test_reference_labels_need_exactly_one_match(stats_pops, pops, message):
    with pytest.raises(CheckError, match=f"reference_labels failed for OR: {message}"):
        reference_labels(reference_stats(stats_pops), map_pop(*pops), "OR")


NV_STATS = data_dir() / "alarm" / "NV_cd_2020_stats.csv"
```

Vervang in `tests/test_checks.py`:

```python
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_units_linked, check_vap_pop)
```

door:

```python
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_reference_labels, check_units_linked, check_vap_pop)
```

Voeg onderaan `tests/test_checks.py` toe:

```python


# ---- check_reference_labels (Task 1.17) ----

BLOCKS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]


def reference_case(c5_pop=2):
    """map.rds label and CD118 district per block, and POP100. c6 lies in ZZ; c7 belongs to no unit."""
    labels = pd.Series(["01", "01", "02", "02", "02", "01", None], index=BLOCKS)
    district_of = pd.Series(["01", "01", "02", "02", "01", "ZZ", "02"], index=BLOCKS)
    pop = pd.Series([50, 48, 60, 30, c5_pop, 0, 0], index=BLOCKS)
    return labels, district_of, pop


def test_reference_labels_pass_and_return_the_share():
    # label 01: 98 people, all in CD118 01. Label 02: 90 in 02, 2 in 01. Same code: 188 of 190.
    share = check_reference_labels(*reference_case(), "NV")
    assert share == pytest.approx(188 / 190)


@pytest.mark.parametrize("c5_pop, message", [
    (100, "district 02 of map.rds overlaps most with CD118 district 01"),
    (90, "district 02 of map.rds overlaps equally with CD118 districts 01, 02"),
])
def test_reference_labels_need_the_same_code_in_cd118(c5_pop, message):
    with pytest.raises(CheckError, match=f"reference_labels failed for NV: {message}"):
        check_reference_labels(*reference_case(c5_pop), "NV")


def test_reference_labels_need_most_people_in_the_same_district():
    with pytest.raises(CheckError, match="0.9895 of the population .* below 0.995"):
        check_reference_labels(*reference_case(), "NV", min_share=0.995)


def test_reference_labels_need_a_label_for_every_cd118_district():
    labels, district_of, pop = reference_case()
    district_of["c4"] = "03"
    with pytest.raises(CheckError, match="CD118 districts without a map.rds district: 03"):
        check_reference_labels(labels, district_of, pop, "NV")
```

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py tests/test_ensemble.py -q
```

Verwacht: `2 errors during collection`: `ImportError: cannot import name 'check_reference_labels' from 'gerry.checks'` en `ImportError: cannot import name 'reference_labels' from 'gerry.ensemble'`.

- [ ] **Step 3: Schrijf de code**

Vervang in `pipeline/gerry/ensemble.py`:

```python
    n_plans = ensemble["draw"].nunique()
    if n_plans != N_PLANS:
        raise CheckError("ensemble_structure", st.postal, f"{n_plans} plans, expected {N_PLANS}")
    return ensemble, reference
```

door:

```python
    n_plans = ensemble["draw"].nunique()
    if n_plans != N_PLANS:
        raise CheckError("ensemble_structure", st.postal, f"{n_plans} plans, expected {N_PLANS}")
    return ensemble, reference


def reference_labels(stats: pd.DataFrame, map_pop: pd.Series, postal: str) -> dict[str, str]:
    """Label of each cd_2020 district in the stats file -> label of the map.rds district with exactly the
    same population. map_pop: population per cd_2020 label of map.rds ("01" -> int). The two files do not
    always number the districts alike (Oregon)."""
    ref = stats[stats["draw"].astype(str).str.strip() == REFERENCE_DRAW]
    labels = {}
    for label, pop in zip(_district_codes(ref["district"], postal), pd.to_numeric(ref["total_pop"])):
        hits = list(map_pop.index[map_pop == pop])
        if len(hits) != 1:
            raise CheckError("reference_labels", postal, f"cd_2020 district {label} (population {int(pop)}) "
                                                         f"matches {len(hits)} districts of map.rds")
        labels[label] = hits[0]
    for target in sorted(set(labels.values())):
        sources = sorted(k for k, v in labels.items() if v == target)
        if len(sources) > 1:
            raise CheckError("reference_labels", postal, f"cd_2020 districts {', '.join(sources)} all match "
                                                         f"district {target} of map.rds")
    return labels
```

Vervang in `pipeline/gerry/checks.py`:

```python
def check_conservation(units: pd.DataFrame, district_totals: pd.DataFrame, vote_cols: Sequence[str],
```

door:

```python
def check_reference_labels(labels: pd.Series, district_of: pd.Series, pop: pd.Series, state: str,
                           min_share: float = 0.97) -> float:
    """ALARM's reference map in map.rds against CD118, by block population, without ZZ blocks.

    labels: block_id -> cd_2020 label of the block's unit (blocks without unit are left out);
    district_of: block_id -> CD118 district; pop: block_id -> POP100. Each label must overlap most with
    the CD118 district of the same code, without a tie, every CD118 district must be a label, and at least
    min_share of the population must have the same code in both. Returns that share."""
    labels = labels.dropna()
    df = pd.DataFrame({"label": labels, "district": district_of.reindex(labels.index),
                       "pop": pop.reindex(labels.index)})
    if df[["district", "pop"]].isna().any().any():
        raise CheckError("reference_labels", state, "blocks with a label are missing from CD118 or P.L. 94-171")
    df = df[df["district"] != "ZZ"]
    overlap = df.groupby(["label", "district"])["pop"].sum().unstack(fill_value=0)
    missing = sorted(set(overlap.columns) - set(overlap.index))
    extra = sorted(set(overlap.index) - set(overlap.columns))
    if missing or extra:
        raise CheckError("reference_labels", state, f"CD118 districts without a map.rds district: "
                                                    f"{', '.join(missing) or 'none'}; map.rds districts not "
                                                    f"in CD118: {', '.join(extra) or 'none'}")
    for label, row in overlap.iterrows():
        top = list(row.index[row == row.max()])
        if len(top) > 1:
            raise CheckError("reference_labels", state, f"district {label} of map.rds overlaps equally with "
                                                        f"CD118 districts {', '.join(top)}")
        if top[0] != label:
            raise CheckError("reference_labels", state, f"district {label} of map.rds overlaps most with "
                                                        f"CD118 district {top[0]}")
    share = float(sum(overlap.at[k, k] for k in overlap.index) / overlap.to_numpy().sum())
    if share < min_share:
        raise CheckError("reference_labels", state, f"{share:.4f} of the population has the same district in "
                                                    f"map.rds and CD118, below {min_share}")
    return share


def check_conservation(units: pd.DataFrame, district_totals: pd.DataFrame, vote_cols: Sequence[str],
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_checks.py tests/test_ensemble.py -q
.venv\Scripts\python -m pytest -q
```

Verwacht: `38 passed`, dan `190 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/ensemble.py pipeline/gerry/checks.py tests/test_ensemble.py tests/test_checks.py
git commit -m "Match ALARM's reference districts to map.rds by population and check them against CD118"
```

### Task 1.18: 02_join.py (maakt het werk van taak 1.11 af)

**Files:**
- Create: `pipeline/02_join.py`
- Create: `tests/test_join.py`
- Create (gegenereerd, niet in git): `data/interim/units/{ST}.parquet`, `enacted_districts.parquet`, `ensemble_districts.parquet`, `alarm_reference.parquet`, `join_log.json`

**Interfaces:**
- Consumes: `load_units`, `read_block_votes`, `add_composite`, `UnitsError` (taak 1.15); `read_pl_blocks`, `read_pl_counties`, `unit_of_block`, `read_bef`, `block_weighted`, `whole_unit`, `BlocksError` (taken 1.7, 1.8, 1.13, 1.14); `read_stats`, `district_votes`, `reference_labels` (taken 1.9, 1.17); `check_geoids`, `check_vap_pop`, `check_units_linked`, `check_conservation`, `check_district_count`, `check_reference_labels`, `check_ensemble_totals`, `CheckError` (taken 1.10, 1.16, 1.17); `load_config()`, `data_dir()`, `interim_dir()` (taak 0.4).
- Produces: `pipeline/02_join.py [--states ST ...]` met `maps_of(st) -> list[tuple[str, str]]`, `join_state(cfg, postal, root) -> StateResult`, `replace_states(old, new, states) -> pd.DataFrame` en `write_outputs(results, cfg, out_dir, partial) -> None`, en de tussenbestanden:
  - `units/{ST}.parquet`: `unit_id`, `vap`, `pop`, `d_<e>`, `r_<e>`, `d`, `r` (uit `map.rds`; zonder `cd_2020`).
  - `enacted_districts.parquet`: `state`, `map_id` (`enacted`, `mo_hb1`, `check_2022`), `method` (`block`, `whole_unit`), `district`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d`, `r`. Voor WV zijn de `pre_16`-kolommen leeg.
  - `ensemble_districts.parquet`: `state`, `draw`, `district`, dezelfde stemkolommen.
  - `alarm_reference.parquet`: `state`, `district`, dezelfde stemkolommen; de rijen met `draw == "cd_2020"`, met de labels van `map.rds`, gesorteerd op district.
  - `join_log.json`, per staat: `units`, `empty_vote_fields`, `empty_vote_units` (lege stemvelden in `map.rds`), `empty_weight_fields` (lege velden in het blokbestand van census-vest, 0 buiten de tractstaten), `blocks`, `units_zero_vap`, `unlinked_blocks`, `unlinked_keys` (blokken en sleutels zonder eenheid, uit `check_vap_pop`), `maps` (per `map_id` de `.attrs` van `block_weighted`: `split_units`, `zero_vap_units`, `zero_vap_split_units`, `units_without_blocks`, `block_count_votes`, `weight_fallback_units`), `reference_share` (uit `check_reference_labels`), `reference_labels` (alleen de labels die veranderen, `{stats: map.rds}`) en `plans`. `align_to_alarm` bestaat niet meer.

Per staat doet `join_state`: voor IA en WV de countyrecords uit P.L. 94-171, eenheden uit `map.rds` met composiet, voor tractstaten de blokstemmen van census-vest als gewicht, blokken lezen, `check_geoids`, sleutel per blok, `check_vap_pop`. Dan per kaart (`enacted` uit `bef`, de `extra_maps`, en `check_2022` uit CD118): `check_units_linked`, de verdeling over blokken en de hele-eenheidstoewijzing, beide alleen met de stemkolommen per verkiezing en daarna de composiet op de districten, met `check_conservation` en `check_district_count`. Bij `check_2022` ook `check_reference_labels`. Tot slot de ensembles: nieuwe labels voor de referentiekaart uit `reference_labels`, en `check_ensemble_totals` op de plannen en op de referentiekaart.

Zonder `--states` schrijft het script alle bestanden opnieuw. Met `--states` vervangt het alleen de rijen van die staten. Faalt een controle, dan schrijft het niets, meldt `ERROR <ST>: <check> failed for <ST>: ...` en stopt met code 1. Een ontbrekend bestand geeft `ERROR <ST>: missing <pad>; run pipeline/01_download.py first`.

- [ ] **Step 1: Schrijf de falende tests**

Nieuwe inhoud van `tests/test_join.py`:

```python
import importlib.util
import sys
from pathlib import Path

import pandas as pd
import pytest

from gerry.config import data_dir, load_config

SCRIPT = Path(__file__).resolve().parents[1] / "pipeline" / "02_join.py"


def load_script():
    """Import pipeline/02_join.py (its name starts with a digit, so no normal import)."""
    spec = importlib.util.spec_from_file_location("join_script", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module      # dataclasses look the module up here
    spec.loader.exec_module(module)
    return module


def test_replace_states_keeps_other_states_and_column_order():
    old = pd.DataFrame({"state": ["AL", "NV", "NV"], "district": ["01", "01", "02"], "d": [1.0, 2.0, 3.0]})
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    out = load_script().replace_states(old, new, {"NV"})
    assert out.to_dict("records") == [{"state": "AL", "district": "01", "d": 1.0},
                                      {"state": "NV", "district": "01", "d": 9.0}]


def test_replace_states_without_old_file():
    new = pd.DataFrame({"state": ["NV"], "district": ["01"], "d": [9.0]})
    assert load_script().replace_states(None, new, {"NV"}).equals(new)


def test_maps_of_lists_enacted_extra_and_check_map():
    cfg = load_config()
    join = load_script()
    assert join.maps_of(cfg.states["NV"]) == [("enacted", "cd120"), ("check_2022", "cd118")]
    assert join.maps_of(cfg.states["MO"]) == [("enacted", "cd118"), ("mo_hb1", "cd120"), ("check_2022", "cd118")]


def files_of(postal, *extra):
    st = postal.lower()
    return [data_dir() / p for p in (f"alarm/{postal}_cd_2020_map.rds", f"alarm/{postal}_cd_2020_stats.csv",
                                     f"census/pl/{st}2020.pl.zip", "census/cd120.zip", "census/cd118.zip", *extra)]


def shares(frame):
    frame = frame.set_index("district")
    return frame["d"] / (frame["d"] + frame["r"])


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("NV")), reason="needs the Nevada files")
def test_nevada_join_reproduces_the_reference_numbers():
    result = load_script().join_state(load_config(), "NV", data_dir())
    enacted = result.enacted
    pick = lambda map_id, method: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
    block = shares(pick("enacted", "block"))
    # plan skeleton, "Referentiegetallen": Nevada, Enacted per district (block method)
    assert block.round(6).to_dict() == {"01": 0.547901, "02": 0.436352, "03": 0.534711, "04": 0.548082}
    whole = shares(pick("enacted", "whole_unit"))
    assert ((whole > 0.5) == (block > 0.5)).all()
    # CD118 against ALARM's cd_2020: largest difference 0.00042
    reference = shares(result.reference)
    assert round(float((shares(pick("check_2022", "block")) - reference).abs().max()), 5) == 0.00042
    log = result.log
    assert (log["units"], log["blocks"], log["unlinked_blocks"], log["plans"]) == (2102, 57409, 0, 5000)
    assert log["reference_labels"] == {}
    # one split VTD without VAP holds votes: 32003001906, 20.3 votes by block count
    assert log["maps"]["enacted"]["split_units"] == 40
    assert round(log["maps"]["enacted"]["block_count_votes"], 1) == 20.3
    assert len(result.ensemble) == 20000 and result.ensemble["draw"].nunique() == 5000
    assert list(result.units.columns) == ["unit_id", "vap", "pop", "d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20",
                                          "d", "r"]


@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("OR", "census_vest/or_2020_block.csv")),
                    reason="needs the Oregon files")
def test_oregon_join_relabels_alarms_reference_map():
    result = load_script().join_state(load_config(), "OR", data_dir())
    # spec chapter 4: the stats file numbers Oregon's cd_2020 districts differently from map.rds
    assert result.log["reference_labels"] == {"01": "02", "02": "04", "03": "05", "04": "06", "05": "03", "06": "01"}
    assert result.reference["district"].tolist() == ["01", "02", "03", "04", "05", "06"]
    assert (result.log["units"], result.log["unlinked_blocks"]) == (1001, 0)
    # after the new labels each district of ALARM's reference map lies within 0.5 points of CD118
    enacted = result.enacted
    check = enacted[(enacted["map_id"] == "check_2022") & (enacted["method"] == "block")]
    assert (shares(check) - shares(result.reference)).abs().max() < 0.005
```

De Nevada-test controleert dezelfde referentiegetallen als in de plankop: `map.rds` heeft in Nevada dezelfde VTD's en stemmen als census-vest. De test voor Oregon controleert de nieuwe labels van ALARM's referentiekaart; zonder die labels zou de methodecontrole in Oregon districten vergelijken die niet bij elkaar horen.

- [ ] **Step 2: Draai de tests en zie ze falen**

```powershell
.venv\Scripts\python -m pytest tests/test_join.py -q
```

Verwacht: `5 failed`, met `FileNotFoundError: [Errno 2] No such file or directory: '...\\pipeline\\02_join.py'`.

- [ ] **Step 3: Schrijf het script**

Nieuwe inhoud van `pipeline/02_join.py`:

```python
"""Step 2: votes per unit -> blocks -> districts, plus ALARM's plans; writes data/interim/ (spec chapter 4).

Usage: python pipeline/02_join.py [--states ST [ST ...]]

Without --states all states are joined and the interim files are rewritten. With --states only those
states are joined and their rows replace the earlier rows in the interim files.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from gerry.blocks import (BlocksError, block_weighted, read_bef, read_pl_blocks, read_pl_counties, unit_of_block,
                          whole_unit)
from gerry.checks import (CheckError, check_conservation, check_district_count, check_ensemble_totals,
                          check_geoids, check_reference_labels, check_units_linked, check_vap_pop)
from gerry.config import data_dir, interim_dir, load_config
from gerry.ensemble import district_votes, read_stats, reference_labels
from gerry.units import UnitsError, add_composite, load_units, read_block_votes

log = logging.getLogger("join")


@dataclass
class StateResult:
    units: pd.DataFrame       # unit_id, vap, pop, d_<e>, r_<e>, d, r
    enacted: pd.DataFrame     # state, map_id, method, district, vote columns
    ensemble: pd.DataFrame    # state, draw, district, vote columns
    reference: pd.DataFrame   # state, district, vote columns (draw cd_2020, with the labels of map.rds)
    log: dict


def maps_of(st) -> list[tuple[str, str]]:
    """(map_id, block equivalency file): the enacted map, extra maps, and the 2022 map for the check."""
    return [("enacted", st.bef), *((m.id, m.bef) for m in st.extra_maps), ("check_2022", "cd118")]


def join_state(cfg, postal: str, root: Path) -> StateResult:
    st = cfg.states[postal]
    parts = [f"{p}_{e}" for e in st.elections for p in ("d", "r")]
    vote_cols = parts + ["d", "r"]
    pl_zip = root / "census" / "pl" / f"{postal.lower()}2020.pl.zip"
    counties = read_pl_counties(pl_zip, postal) if st.unit_kind == "county" else None
    units = add_composite(load_units(st, root, counties), st.elections)
    weights = read_block_votes(st, root) if st.unit_kind == "tract" else None
    info = {"units": len(units), "empty_vote_fields": units.attrs["empty_vote_fields"],
            "empty_vote_units": units.attrs["empty_vote_units"],
            "empty_weight_fields": weights.attrs["empty_vote_fields"] if weights is not None else 0}

    blocks = read_pl_blocks(pl_zip, postal)
    check_geoids(blocks["block_id"], st.fips, postal)
    unit_of = unit_of_block(blocks, st.unit_kind, st.fips)
    unlinked_blocks, unlinked_keys = check_vap_pop(units, blocks, unit_of, postal)
    if unlinked_blocks:
        log.info("%s: %d blocks in %d keys are not in map.rds; all have VAP 0 and population 0",
                 postal, unlinked_blocks, unlinked_keys)
    info.update({"blocks": len(blocks), "units_zero_vap": int((units["vap"] == 0).sum()),
                 "unlinked_blocks": unlinked_blocks, "unlinked_keys": unlinked_keys, "maps": {}})

    rows = []
    for map_id, bef in maps_of(st):
        district_of = read_bef(root / "census" / f"{bef}.zip", bef, st.fips, postal)
        check_units_linked(units, unit_of, district_of, postal)
        # distribute the votes per election; the composite follows from the distributed parts
        block = block_weighted(units, blocks, unit_of, district_of, parts, weights)
        info["maps"][map_id] = dict(block.attrs)
        whole = whole_unit(units, blocks, unit_of, district_of, parts)
        for method, totals in (("block", block), ("whole_unit", whole)):
            totals = add_composite(totals, st.elections)
            check_conservation(units, totals, vote_cols, postal)
            check_district_count(totals, st.seats, postal)
            rows.append(totals.assign(state=postal, map_id=map_id, method=method))
        if map_id == "check_2022":
            labels = unit_of.map(units.set_index("unit_id")["cd_2020"])
            info["reference_share"] = check_reference_labels(labels, district_of,
                                                             blocks.set_index("block_id")["pop"], postal)
    enacted = pd.concat(rows, ignore_index=True)

    stats = read_stats(root / "alarm" / f"{postal}_cd_2020_stats.csv")
    ensemble, reference = district_votes(stats, st)
    labels = reference_labels(stats, units.groupby("cd_2020")["pop"].sum(), postal)
    reference = (reference.assign(district=reference["district"].map(labels))
                 .sort_values("district", ignore_index=True))
    info["reference_labels"] = {k: v for k, v in labels.items() if k != v}
    if info["reference_labels"]:
        log.info("%s: ALARM's cd_2020 districts get the labels of map.rds: %s", postal,
                 ", ".join(f"{k} -> {v}" for k, v in info["reference_labels"].items()))
    check_ensemble_totals(ensemble, units, st.elections, st.seats, postal)
    check_ensemble_totals(reference, units, st.elections, st.seats, postal)
    info["plans"] = int(ensemble["draw"].nunique())
    return StateResult(units.drop(columns="cd_2020"), enacted, ensemble, reference.drop(columns="draw"), info)


def replace_states(old: pd.DataFrame | None, new: pd.DataFrame, states: set[str]) -> pd.DataFrame:
    """Rows of `old` for other states, then the rows of `new`, sorted by state (stable)."""
    if old is None:
        return new
    combined = pd.concat([old[~old["state"].isin(states)], new], ignore_index=True)
    return combined.sort_values("state", kind="stable").reset_index(drop=True)


def _ordered(frames: list[pd.DataFrame], key_cols: list[str], vote_cols: list[str]) -> pd.DataFrame:
    return pd.concat(frames, ignore_index=True).reindex(columns=key_cols + vote_cols)


def write_outputs(results: dict[str, StateResult], cfg, out_dir: Path, partial: bool) -> None:
    elections = list(dict.fromkeys(e for st in cfg.states.values() for e in st.elections))
    vote_cols = [f"{p}_{e}" for e in elections for p in ("d", "r")] + ["d", "r"]
    (out_dir / "units").mkdir(parents=True, exist_ok=True)
    for postal, res in results.items():
        res.units.to_parquet(out_dir / "units" / f"{postal}.parquet", index=False)
    tables = {
        "enacted_districts.parquet": _ordered([r.enacted for r in results.values()],
                                              ["state", "map_id", "method", "district"], vote_cols),
        "ensemble_districts.parquet": _ordered([r.ensemble for r in results.values()],
                                               ["state", "draw", "district"], vote_cols),
        "alarm_reference.parquet": _ordered([r.reference for r in results.values()], ["state", "district"], vote_cols),
    }
    states = set(results)
    for name, table in tables.items():
        path = out_dir / name
        old = pd.read_parquet(path) if partial and path.exists() else None
        replace_states(old, table, states).to_parquet(path, index=False)
    log_path = out_dir / "join_log.json"
    previous = json.loads(log_path.read_text(encoding="utf-8")) if partial and log_path.exists() else {}
    previous.update({postal: res.log for postal, res in results.items()})
    log_path.write_text(json.dumps(dict(sorted(previous.items())), indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--states", nargs="+", default=[], metavar="ST", help="postal codes, e.g. NV WV")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="  %(message)s", stream=sys.stdout)
    cfg = load_config()
    states = [s.upper() for s in args.states] or sorted(cfg.states)
    unknown = sorted(set(states) - set(cfg.states))
    if unknown:
        parser.error(f"not a multi-seat state in config.yaml: {', '.join(unknown)}")
    root = data_dir()
    results = {}
    for postal in states:
        start = time.monotonic()
        try:
            res = join_state(cfg, postal, root)
        except (CheckError, UnitsError, BlocksError) as exc:
            print(f"ERROR {postal}: {exc}", file=sys.stderr)
            return 1
        except FileNotFoundError as exc:
            print(f"ERROR {postal}: missing {exc.filename}; run pipeline/01_download.py first", file=sys.stderr)
            return 1
        results[postal] = res
        enacted = res.log["maps"]["enacted"]
        print(f"{postal}: {res.log['units']} units ({res.log['units_zero_vap']} without VAP), "
              f"{res.log['blocks']} blocks, enacted map splits {enacted['split_units']} units "
              f"({enacted['zero_vap_split_units']} without VAP, {enacted['block_count_votes']:.1f} votes "
              f"by block count), {res.log['plans']} plans, {time.monotonic() - start:.1f} s", flush=True)
    write_outputs(results, cfg, interim_dir(), partial=bool(args.states))
    print(f"Wrote {len(results)} states to {interim_dir()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Draai de tests opnieuw**

```powershell
.venv\Scripts\python -m pytest tests/test_join.py -q
```

Verwacht: `5 passed`, in ongeveer 20 seconden.

- [ ] **Step 5: Draai de join voor alle 44 staten**

```powershell
.venv\Scripts\python pipeline/02_join.py
```

Dit duurt ongeveer vijf minuten. Verwacht precies deze regels, in deze volgorde (alleen de tijden aan het eind van elke staatsregel verschillen), en als laatste `Wrote 44 states to ...\data\interim`:

```
AL: 1837 units (0 without VAP), 185976 blocks, enacted map splits 11 units (0 without VAP, 0.0 votes by block count), 5000 plans, 11.2 s
AR: 2747 units (21 without VAP), 136422 blocks, enacted map splits 0 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.3 s
AZ: 1538 units (8 without VAP), 155444 blocks, enacted map splits 138 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.3 s
  CA: 8 empty vote fields in 2 census-vest blocks set to 0
CA: 9129 units (32 without VAP), 519723 blocks, enacted map splits 1074 units (9 without VAP, 0.0 votes by block count), 5000 plans, 22.0 s
CO: 3108 units (9 without VAP), 140345 blocks, enacted map splits 96 units (2 without VAP, 0.0 votes by block count), 5000 plans, 6.0 s
CT: 766 units (2 without VAP), 49926 blocks, enacted map splits 16 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.6 s
FL: 7211 units (336 without VAP), 390066 blocks, enacted map splits 261 units (7 without VAP, 3576.1 votes by block count), 5000 plans, 13.2 s
GA: 2698 units (13 without VAP), 232717 blocks, enacted map splits 42 units (0 without VAP, 0.0 votes by block count), 5000 plans, 6.7 s
HI: 461 units (29 without VAP), 14732 blocks, enacted map splits 6 units (2 without VAP, 0.0 votes by block count), 5000 plans, 0.7 s
IA: 99 units (0 without VAP), 175199 blocks, enacted map splits 0 units (0 without VAP, 0.0 votes by block count), 5000 plans, 6.1 s
ID: 931 units (0 without VAP), 81879 blocks, enacted map splits 6 units (0 without VAP, 0.0 votes by block count), 5000 plans, 3.1 s
IL: 10084 units (3 without VAP), 369978 blocks, enacted map splits 478 units (1 without VAP, 157.7 votes by block count), 5000 plans, 16.9 s
IN: 5159 units (49 without VAP), 204568 blocks, enacted map splits 20 units (0 without VAP, 0.0 votes by block count), 5000 plans, 6.0 s
KS: 4240 units (578 without VAP), 172529 blocks, enacted map splits 19 units (4 without VAP, 42.1 votes by block count), 5000 plans, 4.8 s
KY: 3693 units (47 without VAP), 132662 blocks, enacted map splits 27 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.1 s
LA: 3540 units (9 without VAP), 142874 blocks, enacted map splits 10 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.4 s
MA: 2157 units (6 without VAP), 107278 blocks, enacted map splits 19 units (1 without VAP, 311.2 votes by block count), 5000 plans, 3.0 s
MD: 2042 units (38 without VAP), 83827 blocks, enacted map splits 64 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.7 s
  ME: 112 blocks in 6 keys are not in map.rds; all have VAP 0 and population 0
ME: 401 units (1 without VAP), 47138 blocks, enacted map splits 1 units (0 without VAP, 0.0 votes by block count), 5000 plans, 1.2 s
  MI: 631 blocks in 38 keys are not in map.rds; all have VAP 0 and population 0
MI: 4767 units (7 without VAP), 254730 blocks, enacted map splits 31 units (0 without VAP, 0.0 votes by block count), 5000 plans, 7.1 s
MN: 4110 units (33 without VAP), 198705 blocks, enacted map splits 26 units (0 without VAP, 0.0 votes by block count), 5000 plans, 5.2 s
MO: 4604 units (223 without VAP), 253632 blocks, enacted map splits 58 units (1 without VAP, 121.7 votes by block count), 5000 plans, 7.2 s
MS: 1834 units (5 without VAP), 112241 blocks, enacted map splits 7 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.8 s
MT: 666 units (1 without VAP), 88417 blocks, enacted map splits 1 units (0 without VAP, 0.0 votes by block count), 5000 plans, 1.9 s
NC: 2666 units (0 without VAP), 236638 blocks, enacted map splits 21 units (0 without VAP, 0.0 votes by block count), 5000 plans, 5.6 s
NE: 1402 units (2 without VAP), 119103 blocks, enacted map splits 8 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.6 s
NH: 326 units (17 without VAP), 31948 blocks, enacted map splits 2 units (0 without VAP, 0.0 votes by block count), 5000 plans, 0.8 s
NJ: 6361 units (7 without VAP), 137972 blocks, enacted map splits 89 units (0 without VAP, 0.0 votes by block count), 5000 plans, 5.2 s
NM: 1977 units (1 without VAP), 107215 blocks, enacted map splits 13 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.6 s
NV: 2102 units (295 without VAP), 57409 blocks, enacted map splits 40 units (3 without VAP, 20.3 votes by block count), 5000 plans, 1.9 s
NY: 14191 units (214 without VAP), 288819 blocks, enacted map splits 176 units (1 without VAP, 274.6 votes by block count), 5000 plans, 12.4 s
  OH: 63 blocks in 4 keys are not in map.rds; all have VAP 0 and population 0
OH: 8937 units (4 without VAP), 276428 blocks, enacted map splits 51 units (0 without VAP, 0.0 votes by block count), 5000 plans, 10.1 s
OK: 1947 units (10 without VAP), 180154 blocks, enacted map splits 37 units (1 without VAP, 3.6 votes by block count), 5000 plans, 3.9 s
  OR: 16 empty vote fields in 4 census-vest blocks set to 0
  OR: ALARM's cd_2020 districts get the labels of map.rds: 01 -> 02, 02 -> 04, 03 -> 05, 04 -> 06, 05 -> 03, 06 -> 01
OR: 1001 units (8 without VAP), 130807 blocks, enacted map splits 79 units (0 without VAP, 0.0 votes by block count), 5000 plans, 3.0 s
PA: 9178 units (3 without VAP), 336985 blocks, enacted map splits 14 units (0 without VAP, 0.0 votes by block count), 5000 plans, 10.3 s
RI: 423 units (1 without VAP), 25649 blocks, enacted map splits 11 units (0 without VAP, 0.0 votes by block count), 5000 plans, 0.8 s
SC: 2268 units (2 without VAP), 146844 blocks, enacted map splits 13 units (0 without VAP, 0.0 votes by block count), 5000 plans, 3.7 s
TN: 1965 units (5 without VAP), 179717 blocks, enacted map splits 82 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.1 s
TX: 9007 units (240 without VAP), 668757 blocks, enacted map splits 360 units (1 without VAP, 0.0 votes by block count), 5000 plans, 17.8 s
UT: 2745 units (151 without VAP), 71207 blocks, enacted map splits 7 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.5 s
VA: 2465 units (1 without VAP), 163491 blocks, enacted map splits 41 units (0 without VAP, 0.0 votes by block count), 5000 plans, 4.2 s
WA: 7434 units (97 without VAP), 158093 blocks, enacted map splits 80 units (1 without VAP, 0.0 votes by block count), 5000 plans, 6.3 s
WI: 7059 units (327 without VAP), 203059 blocks, enacted map splits 31 units (0 without VAP, 0.0 votes by block count), 5000 plans, 7.0 s
WV: 55 units (0 without VAP), 72558 blocks, enacted map splits 0 units (0 without VAP, 0.0 votes by block count), 5000 plans, 2.2 s
```

Het aantal blokken per staat is gelijk aan de tabel in taak 1.11. Stemmen die naar aantal blokken gaan, vallen op de kaarten van 2026 in acht VTD-staten, samen 4.507,3 stemmen (FL, IL, KS, MA, MO, NV, NY en OK); dat is de beperking uit hoofdstuk 10 van de spec. In de tractstaten gaan de stemmen van een tract zonder VAP naar de blokstemmen van census-vest, dus daar staat 0,0.

Stopt een staat met een fout, pas dan geen code of drempel aan om de controle te laten slagen. Noteer de melding en vraag de eigenaar (CLAUDE.md: twijfel over een databron, stop en vraag).

- [ ] **Step 6: Controleer de tussenbestanden**

```powershell
.venv\Scripts\python -c "import pandas as pd; d='data/interim/'; print(len(pd.read_parquet(d+'enacted_districts.parquet')), len(pd.read_parquet(d+'ensemble_districts.parquet')), len(pd.read_parquet(d+'alarm_reference.parquet')))"
(Get-ChildItem data\interim\units\*.parquet).Count
.venv\Scripts\python -c "import json; log = json.load(open('data/interim/join_log.json', encoding='utf-8')); print({k: (v['unlinked_blocks'], v['unlinked_keys']) for k, v in log.items() if v['unlinked_blocks']}); print(round(sum(v['maps']['enacted']['block_count_votes'] for v in log.values()), 1)); print({k: v['reference_labels'] for k, v in log.items() if v['reference_labels']}); print(min((round(v['reference_share'], 4), k) for k, v in log.items())); print({k: v['empty_weight_fields'] for k, v in log.items() if v['empty_weight_fields']})"
```

Verwacht:

```
1732 2145000 429
44
{'ME': (112, 6), 'MI': (631, 38), 'OH': (63, 4)}
4507.3
{'OR': {'01': '02', '02': '04', '03': '05', '04': '06', '05': '03', '06': '01'}}
(0.9794, 'AZ')
{'CA': 8, 'OR': 16}
```

Enacted: (enacted plus check_2022) × 2 methoden × 429 districten = 1.716 rijen, plus 2 × 8 voor `mo_hb1`. Ensembles: 429 × 5.000.

Met deze tussenbestanden blijven de referentiegetallen uit de plankop gelijk: voor NV, TX, CA, IA, WV, UT, NC en LA dezelfde Proportional, Enacted en verdeling over de 5.000 plannen. In de methodecontrole (CD118 tegen ALARM's `cd_2020`, taak 2.11) is het grootste verschil 0,6989 procentpunt in TN-09, bij hetzelfde aantal zetels; daarna CA 0,4334, TX 0,3929 en AZ 0,3563. Tennessee krijgt in taak 2.15 een verklaring.

- [ ] **Step 7: Draai alle tests**

```powershell
.venv\Scripts\python -m pytest -q
```

Verwacht: `195 passed`. Zonder data: `186 passed, 9 skipped`.

- [ ] **Step 8: Commit**

```powershell
git status --short
git add pipeline/02_join.py tests/test_join.py
git commit -m "Add join step writing interim files for all states"
```

`data/interim/` staat in `.gitignore` en komt niet in de commit.

## Phase 2: metrieken en controlerapport

Deze fase bouwt de rekenregels uit hoofdstuk 5 van de spec in `pipeline/gerry/metrics.py`, het script `pipeline/03_metrics.py` dat ze per staat en landelijk toepast, en het controlerapport `docs/validation.md` via `pipeline/gerry/validation.py`. Daarna volgen de kruiscontroles met PlanScore en Dave's Redistricting App (DRA) en een volledige run waarin elke overschrijding een verklaring krijgt.

Vooraf:

- Fase 0, 1 en 1b zijn af. Nodig zijn `gerry/config.py`, `gerry/checks.py` (`CheckError`), `pytest.ini` met de marker `data`, en vanaf Taak 2.11 stap 6 een gevulde `data/interim/` uit `pipeline/02_join.py` (taak 1.18) voor alle 44 staten.
- Zet in elke nieuwe PowerShell-sessie eerst `$env:PYTHONUTF8=1`. Alle commando's draaien vanuit de root van de worktree.
- Tekens: effecten tellen in Democratische zetels, positief is meer Democratische zetels. Efficiency gap (EG) en mean-median (MM) zijn positief als de kaart gunstig is voor Republikeinen.
- `tests/test_metrics.py` importeert `from gerry import metrics as m`. Zo blijft de importregel gelijk tussen de taken; een functie die nog ontbreekt geeft een `AttributeError`.
- Elke verwachte waarde in een test is met de hand uitgerekend; de berekening staat als commentaar bij de test.

### Task 2.1: dem_wins met de gelijkspelregel

**Files:**
- Create: `pipeline/gerry/metrics.py`
- Test: `tests/test_metrics.py`

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces: `class TieError(ValueError)` met `TieError(message: str, positions: Sequence[int] = ())` en attribuut `positions: tuple[int, ...]`; `dem_wins(d, r, d20=None, r20=None) -> np.ndarray` (bool per district). D > R wint, R > D verliest, D == R beslist 2020 alleen; is ook 2020 gelijk, dan `TieError` met de posities in de tekst (`position(s) [1]`) en in `positions`.

- [ ] **Step 1: Write the failing test**

Maak `tests/test_metrics.py`:

```python
"""Tests for gerry/metrics.py. Every expected value is worked out by hand in the comments."""
import numpy as np
import pandas as pd
import pytest

from gerry import metrics as m


# Task 2.1: dem_wins

def test_dem_wins_majority_decides():
    # district 1: D 60 > R 40 -> D; district 2: D 30 < R 70 -> R
    assert m.dem_wins([60, 30], [40, 70]).tolist() == [True, False]


def test_dem_wins_tie_goes_to_2020_winner():
    # district 1: composite 100-100, 2020 alone D 55 > R 45 -> D
    # district 2: composite 100-100, 2020 alone D 40 < R 60 -> R
    # district 3: composite D 120 > R 80 -> D; its 2020 votes (10-90) do not count
    wins = m.dem_wins([100, 100, 120], [100, 100, 80], d20=[55, 40, 10], r20=[45, 60, 90])
    assert wins.tolist() == [True, False, True]


def test_dem_wins_double_tie_names_position():
    # position 1 is tied in the composite (50-50) and in 2020 (25-25)
    with pytest.raises(m.TieError, match=r"position\(s\) \[1\]") as err:
        m.dem_wins([60, 50], [40, 50], d20=[30, 25], r20=[20, 25])
    assert err.value.positions == (1,)


def test_dem_wins_tie_without_2020_votes_raises():
    with pytest.raises(m.TieError, match=r"position\(s\) \[0\]"):
        m.dem_wins([50], [50])


def test_dem_wins_rejects_missing_votes():
    with pytest.raises(ValueError, match="missing"):
        m.dem_wins([np.nan, 10], [5, 20])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: collection error, `ImportError: cannot import name 'metrics' from 'gerry'`.

- [ ] **Step 3: Write minimal implementation**

Maak `pipeline/gerry/metrics.py`. De importregels bovenaan dekken ook de latere taken.

```python
"""Counting rules from chapter 5 of the spec.

Sign conventions: effects are in Democratic seats (positive = more Democratic seats);
efficiency gap and mean-median are positive when they favor Republicans.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd


class TieError(ValueError):
    """D equals R in the composite and again in the 2020 presidential result."""

    def __init__(self, message: str, positions: Sequence[int] = ()):
        super().__init__(message)
        self.positions = tuple(int(p) for p in positions)


def dem_wins(d, r, d20=None, r20=None) -> np.ndarray:
    """True where the Democrat wins. D > R wins, R > D loses, D == R goes to the
    2020 winner (d20, r20). A tie in both raises TieError with the positions."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    if d.shape != r.shape:
        raise ValueError(f"d and r differ in shape: {d.shape} and {r.shape}")
    if np.isnan(d).any() or np.isnan(r).any():
        raise ValueError("missing votes in d or r")
    wins = d > r
    tied = d == r
    if not tied.any():
        return wins
    if d20 is None or r20 is None:
        pos = np.flatnonzero(tied)
        raise TieError(f"D equals R at position(s) {pos.tolist()} and no 2020 votes were given", pos)
    d20 = np.asarray(d20, dtype=float)
    r20 = np.asarray(r20, dtype=float)
    double = tied & (d20 == r20)
    if double.any():
        pos = np.flatnonzero(double)
        raise TieError(f"D equals R in the composite and in 2020 at position(s) {pos.tolist()}", pos)
    return np.where(tied, d20 > r20, wins)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add dem_wins with the 2020 tie rule"
```

### Task 2.2: largest_remainder

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `TieError` uit Taak 2.1.
- Produces: `largest_remainder(d_votes: float, r_votes: float, seats: int) -> int`, het aantal Democratische zetels. Quotum D = `d_votes * seats / (d_votes + r_votes)`, quotum R = `seats - quotum D`; beide naar beneden afronden; een resterende zetel gaat naar de grootste rest; bij gelijke rest naar de partij met meer stemmen; zijn ook de stemmen gelijk, dan `TieError`. `ValueError` bij `seats < 1` of geen stemmen.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.2: largest_remainder

def test_largest_remainder_larger_remainder_wins():
    # 60 to 40, 4 seats: quota D = 60 * 4 / 100 = 2.4, quota R = 4 - 2.4 = 1.6
    # floors 2 + 1 = 3, one seat left; remainders 0.4 (D) and 0.6 (R) -> R
    assert m.largest_remainder(60, 40, 4) == 2


def test_largest_remainder_nevada():
    # Nevada composite: D 1,242,313.3, R 1,181,550.1, 4 seats
    # quota D = 4 * 0.5125344 = 2.0501, quota R = 1.9499
    # floors 2 + 1, remainders 0.0501 (D) and 0.9499 (R) -> R; D keeps 2
    assert m.largest_remainder(1242313.3, 1181550.1, 4) == 2


def test_largest_remainder_whole_quotas():
    # 75 to 25, 4 seats: quotas 3.0 and 1.0, no seat left over
    assert m.largest_remainder(75, 25, 4) == 3


def test_largest_remainder_equal_remainders_go_to_more_votes():
    # 5 to 3, 4 seats: quota D = 5 * 4 / 8 = 2.5, quota R = 1.5, both remainders 0.5
    # D has more votes (5 > 3) and gets the last seat: 2 + 1 = 3
    assert m.largest_remainder(5, 3, 4) == 3
    # mirrored: R has more votes, D keeps its floor of 1
    assert m.largest_remainder(3, 5, 4) == 1


def test_largest_remainder_full_tie_raises():
    # 10 to 10, 3 seats: quotas 1.5 and 1.5, equal remainders and equal votes
    with pytest.raises(m.TieError):
        m.largest_remainder(10, 10, 3)


def test_largest_remainder_rejects_bad_input():
    with pytest.raises(ValueError):
        m.largest_remainder(0, 0, 4)
    with pytest.raises(ValueError):
        m.largest_remainder(10, 20, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `6 failed, 5 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'largest_remainder'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def largest_remainder(d_votes: float, r_votes: float, seats: int) -> int:
    """Democratic seats under largest remainder with two parties. Equal remainders
    go to the party with more votes; equal votes as well raise TieError."""
    total = d_votes + r_votes
    if seats < 1 or total <= 0:
        raise ValueError(f"need seats >= 1 and votes > 0, got seats={seats}, votes={total}")
    quota_d = d_votes * seats / total
    quota_r = seats - quota_d
    floor_d = int(np.floor(quota_d))
    floor_r = int(np.floor(quota_r))
    if floor_d + floor_r == seats:
        return floor_d
    rest_d = quota_d - floor_d
    rest_r = quota_r - floor_r
    if rest_d != rest_r:
        return floor_d + 1 if rest_d > rest_r else floor_d
    if d_votes != r_votes:
        return floor_d + 1 if d_votes > r_votes else floor_d
    raise TieError(f"equal remainders and equal votes ({d_votes} each) for {seats} seats")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `11 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add largest remainder for proportional seats"
```

### Task 2.3: seats_by_plan en distribution

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `dem_wins`, `TieError` uit Taak 2.1. Het ensemble heeft de kolommen uit `ensemble_districts.parquet`: `state`, `draw`, `district` (tekst) en minstens `d`, `r`, `d_pre_20`, `r_pre_20`.
- Produces: `seats_by_plan(ensemble: pd.DataFrame) -> pd.Series` (index `draw`, naam `dem_seats`, int64), met de gelijkspelregel; een dubbele gelijke stand geeft `TieError` met `"<staat> plan <draw> district <district>"`. `distribution(seat_samples, seats: int) -> np.ndarray` met lengte `seats + 1`: het aantal plannen per zetelaantal.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.3: seats_by_plan and distribution

def _ensemble(rows):
    return pd.DataFrame(rows, columns=["state", "draw", "district", "d", "r", "d_pre_20", "r_pre_20"])


def test_seats_by_plan_counts_dem_districts_per_draw():
    ens = _ensemble([
        # draw "1": 01 D (60 > 40), 02 R (30 < 70) -> 1 seat
        ("NV", "1", "01", 60, 40, 30, 20),
        ("NV", "1", "02", 30, 70, 15, 35),
        # draw "2": both tied 50-50; 2020 gives 01 to D (30 > 20), 02 to R (10 < 40) -> 1 seat
        ("NV", "2", "01", 50, 50, 30, 20),
        ("NV", "2", "02", 50, 50, 10, 40),
        # draw "7": 01 D (80 > 20), 02 D (55 > 45) -> 2 seats
        ("NV", "7", "01", 80, 20, 40, 10),
        ("NV", "7", "02", 55, 45, 30, 20),
    ])
    assert m.seats_by_plan(ens).to_dict() == {"1": 1, "2": 1, "7": 2}


def test_seats_by_plan_double_tie_names_state_plan_and_district():
    ens = _ensemble([
        ("NV", "1", "01", 60, 40, 30, 20),
        ("NV", "1", "02", 30, 70, 15, 35),
        ("NV", "9", "01", 50, 50, 25, 25),  # tied in the composite and in 2020
        ("NV", "9", "02", 30, 70, 15, 35),
    ])
    with pytest.raises(m.TieError, match="NV plan 9 district 01"):
        m.seats_by_plan(ens)


def test_distribution_counts_plans_per_seat_count():
    # 4 seats, so counts for 0 to 4 seats; samples 1, 1, 2, 3, 3, 3 -> [0, 2, 1, 3, 0]
    assert m.distribution([1, 1, 2, 3, 3, 3], 4).tolist() == [0, 2, 1, 3, 0]


def test_distribution_rejects_impossible_counts():
    with pytest.raises(ValueError):
        m.distribution([5], 4)
    with pytest.raises(ValueError):
        m.distribution([], 4)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `4 failed, 11 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'seats_by_plan'` en `... 'distribution'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def seats_by_plan(ensemble: pd.DataFrame) -> pd.Series:
    """Democratic seats per draw. Needs columns state, draw, district, d, r, d_pre_20, r_pre_20."""
    try:
        wins = dem_wins(ensemble["d"], ensemble["r"], ensemble["d_pre_20"], ensemble["r_pre_20"])
    except TieError as err:
        rows = ensemble.iloc[list(err.positions)]
        where = "; ".join(f"{row.state} plan {row.draw} district {row.district}"
                          for row in rows.itertuples(index=False))
        raise TieError(f"{where}: {err}", err.positions) from err
    seats = pd.Series(wins.astype(np.int64), index=ensemble.index).groupby(ensemble["draw"], sort=False).sum()
    seats.name = "dem_seats"
    return seats


def distribution(seat_samples, seats: int) -> np.ndarray:
    """Number of plans with 0, 1, ..., seats Democratic seats."""
    samples = np.asarray(seat_samples, dtype=np.int64)
    if samples.size == 0 or samples.min() < 0 or samples.max() > seats:
        raise ValueError(f"seat counts must lie in 0..{seats}")
    return np.bincount(samples, minlength=seats + 1)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `15 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add seats per plan and seat distribution"
```

### Task 2.4: sample_percentile en pmf_percentile

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `distribution` uit Taak 2.3 (alleen in de test).
- Produces: `sample_percentile(samples, q: float) -> int` met `numpy.percentile(..., method="inverted_cdf")`; `pmf_percentile(pmf, q: float) -> int`, de kleinste k die voorkomt (kans > 0) met cumulatief aandeel >= q/100 min `CUM_TOLERANCE` (1e-9). `pmf` mag aantallen of kansen bevatten. `q` buiten 0..100 geeft `ValueError`. Hulpfunctie `_normalize(pmf)` voor de taken hierna.

De tolerantie vangt afrondingsfouten in cumulatieve kansen op. Twaalf gelijke kansen tellen in floats op tot 0,49999999999999994 bij de zesde waarde, terwijl het met de hand precies 0,5 is. Zonder tolerantie zou de mediaan een plaats te hoog uitvallen. Bij de landelijke convolutie van 44 verdelingen zijn zulke fouten ongeveer 1e-15.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.4: sample_percentile and pmf_percentile

def test_sample_percentile_takes_lower_middle_value():
    # samples 1, 1, 2, 2: share of plans with at most 1 seat = 2/4 = 0.5 >= 0.5
    # so the median is 1, never the average 1.5
    assert m.sample_percentile([1, 1, 2, 2], 50) == 1


def test_sample_percentile_with_many_equal_values():
    # 7 plans with 2 seats, 3 with 3: cumulative share 0.7 at 2 seats, 1.0 at 3
    # p5: 0.7 >= 0.05 -> 2; median: 0.7 >= 0.5 -> 2; p95: 0.7 < 0.95 <= 1.0 -> 3
    samples = [2] * 7 + [3] * 3
    assert [m.sample_percentile(samples, q) for q in (5, 50, 95)] == [2, 2, 3]


def test_sample_percentile_all_equal():
    # West Virginia: every plan gives 0 seats
    assert [m.sample_percentile([0] * 5000, q) for q in (5, 50, 95)] == [0, 0, 0]


def test_sample_percentile_rejects_q_out_of_range():
    with pytest.raises(ValueError):
        m.sample_percentile([1, 2], 101)


def test_pmf_percentile_matches_hand_cdf():
    # plans per seat count 0..3: 1, 3, 4, 2 (10 plans); cumulative 0.1, 0.4, 0.8, 1.0
    # p5: 0.1 >= 0.05 -> 0; median: 0.4 < 0.5 <= 0.8 -> 2; p95: 0.8 < 0.95 <= 1.0 -> 3
    assert [m.pmf_percentile([1, 3, 4, 2], q) for q in (5, 50, 95)] == [0, 2, 3]


def test_pmf_percentile_skips_seat_counts_without_plans():
    # no plan has 0 seats, so the 0th percentile is 1, as numpy gives for the samples
    assert m.pmf_percentile([0, 5, 5], 0) == 1
    assert m.sample_percentile([1] * 5 + [2] * 5, 0) == 1


def test_pmf_percentile_tolerates_float_error():
    # twelve seat counts with one plan each: in floats the cumulative share at 5 is
    # 0.49999999999999994, just under 0.5; by hand it is 6/12 = 0.5, so the median is 5
    assert np.cumsum(np.ones(12) / 12)[5] < 0.5
    assert m.pmf_percentile(np.ones(12), 50) == 5
    assert m.sample_percentile(range(12), 50) == 5


def test_percentiles_at_exact_boundaries_take_the_lower_value():
    # 5000 plans; the cumulative share at 0 seats hits q exactly, so the answer is 0
    # p5: 250 / 5000 = 0.05; median: 2500 / 5000 = 0.5; p95: 4750 / 5000 = 0.95
    for zeros, q in ((250, 5), (2500, 50), (4750, 95)):
        samples = [0] * zeros + [1] * (5000 - zeros)
        assert m.sample_percentile(samples, q) == 0
        assert m.pmf_percentile([zeros, 5000 - zeros], q) == 0


def test_pmf_percentile_agrees_with_samples():
    # Nevada's distribution: 13 plans with 1 seat, 1901 with 2, 3086 with 3
    samples = [1] * 13 + [2] * 1901 + [3] * 3086
    pmf = m.distribution(samples, 4)
    for q in (0, 1, 5, 25, 50, 75, 95, 100):
        assert m.pmf_percentile(pmf, q) == m.sample_percentile(samples, q)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `9 failed, 15 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'sample_percentile'` en `... 'pmf_percentile'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
# Cumulative shares from a convolution of 44 distributions carry float error near 1e-15.
CUM_TOLERANCE = 1e-9


def _check_q(q: float) -> None:
    if not 0 <= q <= 100:
        raise ValueError(f"q must lie in 0..100, got {q}")


def _normalize(pmf) -> np.ndarray:
    p = np.asarray(pmf, dtype=float)
    if p.ndim != 1 or p.size == 0 or (p < 0).any() or p.sum() <= 0:
        raise ValueError("a distribution needs non-negative counts or probabilities with a positive sum")
    return p / p.sum()


def sample_percentile(samples, q: float) -> int:
    """Smallest seat count k with share of samples <= k at least q/100 (inverse CDF)."""
    _check_q(q)
    values = np.asarray(samples)
    if values.size == 0:
        raise ValueError("no samples")
    return int(np.percentile(values, q, method="inverted_cdf"))


def pmf_percentile(pmf, q: float) -> int:
    """Smallest seat count k that occurs and has cumulative share >= q/100."""
    _check_q(q)
    p = _normalize(pmf)
    cum = np.cumsum(p)
    hits = np.flatnonzero((p > 0) & (cum >= q / 100 - CUM_TOLERANCE))
    return int(hits[0])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `24 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add inverse-CDF percentiles for samples and distributions"
```

### Task 2.5: position en pmf_position

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `_normalize` uit Taak 2.4.
- Produces: `position(samples, value: int) -> dict` en `pmf_position(pmf, value: int) -> dict`, beide met de sleutels `fewer`, `equal`, `more`, `midrank` (fracties, `midrank = fewer + equal / 2`). `pmf_position` geeft `ValueError` als `value` buiten 0..len(pmf)-1 valt.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.5: position and pmf_position

def test_position_counts_fewer_equal_more():
    # 10 plans with seats 1, 2, 2, 3, 3, 3, 3, 4, 4, 5; enacted 3
    # fewer: 1, 2, 2 = 3/10 = 0.3; equal: 4/10 = 0.4; more: 4, 4, 5 = 0.3
    # midrank = 0.3 + 0.4 / 2 = 0.5
    pos = m.position([1, 2, 2, 3, 3, 3, 3, 4, 4, 5], 3)
    assert pos == pytest.approx({"fewer": 0.3, "equal": 0.4, "more": 0.3, "midrank": 0.5})


def test_position_nevada():
    # Nevada: enacted 3; 13 + 1901 = 1914 plans fewer (0.3828), 3086 equal (0.6172), none more
    # midrank = 0.3828 + 0.6172 / 2 = 0.6914
    samples = [1] * 13 + [2] * 1901 + [3] * 3086
    pos = m.position(samples, 3)
    assert pos == pytest.approx({"fewer": 0.3828, "equal": 0.6172, "more": 0.0, "midrank": 0.6914})


def test_pmf_position_from_counts():
    # plans per seat count 0..3: 1, 3, 4, 2; value 2
    # fewer = (1 + 3) / 10 = 0.4; equal = 4/10 = 0.4; more = 2/10 = 0.2; midrank = 0.4 + 0.2 = 0.6
    pos = m.pmf_position([1, 3, 4, 2], 2)
    assert pos == pytest.approx({"fewer": 0.4, "equal": 0.4, "more": 0.2, "midrank": 0.6})


def test_pmf_position_rejects_value_outside_range():
    with pytest.raises(ValueError):
        m.pmf_position([1, 3, 4, 2], 4)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `4 failed, 24 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'position'` en `... 'pmf_position'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def _position(fewer: float, equal: float, more: float) -> dict:
    return {"fewer": fewer, "equal": equal, "more": more, "midrank": fewer + equal / 2}


def position(samples, value: int) -> dict:
    """Share of plans with fewer, equal and more Democratic seats than value."""
    values = np.asarray(samples)
    if values.size == 0:
        raise ValueError("no samples")
    return _position(float(np.mean(values < value)), float(np.mean(values == value)),
                     float(np.mean(values > value)))


def pmf_position(pmf, value: int) -> dict:
    """position() for a distribution given as counts or probabilities per seat count."""
    p = _normalize(pmf)
    if not 0 <= value < p.size:
        raise ValueError(f"value {value} outside 0..{p.size - 1}")
    return _position(float(p[:value].sum()), float(p[value]), float(p[value + 1:].sum()))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `28 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add position of a seat count within an ensemble"
```

### Task 2.6: effects en outside_band

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: niets.
- Produces: `effects(proportional: int, median: int, enacted: int) -> dict` met `geographic = median - proportional` en `drawing = enacted - median` (int); `outside_band(enacted: int, p5: int, p95: int) -> bool`, waar als enacted onder p5 of boven p95 ligt. De randen zelf tellen als binnen.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.6: effects and outside_band

def test_effects_geographic_and_drawing():
    # California: proportional 34, median 45, enacted 48
    # geographic = 45 - 34 = 11; drawing = 48 - 45 = 3
    assert m.effects(34, 45, 48) == {"geographic": 11, "drawing": 3}
    # Texas: proportional 18, median 17, enacted 11 -> geographic -1, drawing -6
    assert m.effects(18, 17, 11) == {"geographic": -1, "drawing": -6}


def test_outside_band():
    # Texas band 15..20: 11 is below it; 15 and 20 are on the edges and count as inside; 21 is above
    assert m.outside_band(11, 15, 20) is True
    assert m.outside_band(15, 15, 20) is False
    assert m.outside_band(20, 15, 20) is False
    assert m.outside_band(21, 15, 20) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `2 failed, 28 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'effects'` en `... 'outside_band'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def effects(proportional: int, median: int, enacted: int) -> dict:
    """Geographic effect = median - proportional; drawing effect = enacted - median."""
    return {"geographic": int(median - proportional), "drawing": int(enacted - median)}


def outside_band(enacted: int, p5: int, p95: int) -> bool:
    """True when enacted lies below the 5th or above the 95th percentile."""
    return bool(enacted < p5 or enacted > p95)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `30 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add geographic and drawing effects"
```

### Task 2.7: efficiency_gap

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `dem_wins` uit Taak 2.1 (de winnaars komen altijd van daar, met de gelijkspelregel).
- Produces: `efficiency_gap(d, r, dem_win) -> float`. Per district met T = D + R verspilt de winnaar zijn stemmen boven T/2 en de verliezer al zijn stemmen. EG = (verspild D - verspild R) / som van alle T. Positief: gunstig voor Republikeinen.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.7: efficiency_gap

def test_efficiency_gap_five_districts():
    # district  D   R   T    winner  wasted D       wasted R
    # 1         80  20  100  D       80 - 50 = 30   20
    # 2         55  45  100  D       55 - 50 = 5    45
    # 3         30  70  100  R       30             70 - 50 = 20
    # 4         48  72  120  R       48             72 - 60 = 12
    # 5         35  45   80  R       35             45 - 40 = 5
    # wasted D = 148, wasted R = 102, all votes = 500
    # EG = (148 - 102) / 500 = 0.092, positive: more Democratic votes wasted, favors Republicans
    d = [80, 55, 30, 48, 35]
    r = [20, 45, 70, 72, 45]
    assert m.efficiency_gap(d, r, m.dem_wins(d, r)) == pytest.approx(0.092)


def test_efficiency_gap_mirror_favors_democrats():
    # swap the parties of the five-district example: wasted D 102, wasted R 148
    # EG = (102 - 148) / 500 = -0.092
    d = [20, 45, 70, 72, 45]
    r = [80, 55, 30, 48, 35]
    assert m.efficiency_gap(d, r, m.dem_wins(d, r)) == pytest.approx(-0.092)


def test_efficiency_gap_uses_given_winners():
    # district 1 is 50-50; district 2 is D 30, R 70 (R wins: wasted D 30, wasted R 70 - 50 = 20)
    # D declared winner of district 1: wasted D 50 - 50 = 0, wasted R 50
    #   EG = ((0 + 30) - (50 + 20)) / 200 = -0.2
    # R declared winner of district 1: wasted D 50, wasted R 0
    #   EG = ((50 + 30) - (0 + 20)) / 200 = 0.3
    assert m.efficiency_gap([50, 30], [50, 70], [True, False]) == pytest.approx(-0.2)
    assert m.efficiency_gap([50, 30], [50, 70], [False, False]) == pytest.approx(0.3)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `3 failed, 30 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'efficiency_gap'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def efficiency_gap(d, r, dem_win) -> float:
    """(wasted D - wasted R) / all votes. The winner wastes votes above T/2, the loser
    all votes. Positive favors Republicans. dem_win comes from dem_wins()."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    win = np.asarray(dem_win, dtype=bool)
    half = (d + r) / 2
    wasted_d = np.where(win, d - half, d)
    wasted_r = np.where(win, r, r - half)
    return float((wasted_d.sum() - wasted_r.sum()) / (d + r).sum())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `33 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add efficiency gap"
```

### Task 2.8: mean_median

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: niets.
- Produces: `mean_median(shares) -> float | None`: ongewogen gemiddelde min mediaan van de districtsaandelen (`numpy.median`, dus bij een even aantal het gemiddelde van de twee middelste). `None` bij minder dan drie districten. Positief: gunstig voor Republikeinen.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.8: mean_median

def test_mean_median_odd_count():
    # shares 0.30, 0.45, 0.50, 0.60, 0.80: mean = 2.65 / 5 = 0.53, median = 0.50
    # MM = 0.53 - 0.50 = 0.03, positive: favors Republicans
    assert m.mean_median([0.30, 0.45, 0.50, 0.60, 0.80]) == pytest.approx(0.03)


def test_mean_median_three_districts():
    # 0.20, 0.50, 0.50: mean = 1.2 / 3 = 0.4, median 0.5 -> MM = -0.1, favors Democrats
    assert m.mean_median([0.20, 0.50, 0.50]) == pytest.approx(-0.1)


def test_mean_median_even_count_averages_the_middle_two():
    # 0.35, 0.40, 0.55, 0.70 (given unsorted): mean = 2.0 / 4 = 0.5
    # median = (0.40 + 0.55) / 2 = 0.475; MM = 0.5 - 0.475 = 0.025
    assert m.mean_median([0.70, 0.35, 0.55, 0.40]) == pytest.approx(0.025)


def test_mean_median_none_for_two_districts():
    assert m.mean_median([0.3, 0.6]) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `4 failed, 33 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'mean_median'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def mean_median(shares) -> float | None:
    """Unweighted mean minus median of the district D shares; None below 3 districts.
    Positive favors Republicans."""
    values = np.asarray(shares, dtype=float)
    if values.size < 3:
        return None
    return float(np.mean(values) - np.median(values))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `37 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add mean-median difference"
```

### Task 2.9: linear_band en sorted_band

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: niets.
- Produces: `linear_band(values) -> dict` met `median`, `p5`, `p95` (floats, lineaire interpolatie, de standaard van `numpy.percentile`), voor de neutrale context van EG en MM. `sorted_band(share_matrix: np.ndarray) -> dict` met `p5`, `p50`, `p95` als Python-lijsten met lengte = aantal districten: per plan (rij) eerst sorteren van laag naar hoog, dan per positie het percentiel over de plannen.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.9: linear_band and sorted_band

def test_linear_band_interpolates():
    # five values 0.10 .. 0.50; numpy's linear rule puts q at position (n - 1) * q / 100
    # p5: 4 * 0.05 = 0.2 -> 0.10 + 0.2 * (0.20 - 0.10) = 0.12
    # median: position 2 -> 0.30
    # p95: 4 * 0.95 = 3.8 -> 0.40 + 0.8 * (0.50 - 0.40) = 0.48
    band = m.linear_band([0.50, 0.10, 0.40, 0.20, 0.30])
    assert band == pytest.approx({"median": 0.30, "p5": 0.12, "p95": 0.48})


def test_sorted_band_sorts_each_plan_first():
    # plan A: 0.6, 0.4 -> sorted 0.4, 0.6
    # plan B: 0.3, 0.5 -> 0.3, 0.5
    # plan C: 0.7, 0.2 -> 0.2, 0.7
    # lowest district: 0.2, 0.3, 0.4; position (3 - 1) * q / 100
    #   p5: 0.1 -> 0.2 + 0.1 * 0.1 = 0.21; p50: 0.3; p95: 1.9 -> 0.3 + 0.9 * 0.1 = 0.39
    # highest district: 0.5, 0.6, 0.7
    #   p5: 0.5 + 0.1 * 0.1 = 0.51; p50: 0.6; p95: 0.6 + 0.9 * 0.1 = 0.69
    band = m.sorted_band(np.array([[0.6, 0.4], [0.3, 0.5], [0.7, 0.2]]))
    assert band["p5"] == pytest.approx([0.21, 0.51])
    assert band["p50"] == pytest.approx([0.3, 0.6])
    assert band["p95"] == pytest.approx([0.39, 0.69])
    assert isinstance(band["p50"], list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `2 failed, 37 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'linear_band'` en `... 'sorted_band'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def linear_band(values) -> dict:
    """Median, 5th and 95th percentile with linear interpolation (EG and MM context)."""
    data = np.asarray(values, dtype=float)
    if data.size == 0:
        raise ValueError("no values")
    p5, p50, p95 = np.percentile(data, [5, 50, 95])
    return {"median": float(p50), "p5": float(p5), "p95": float(p95)}


def sorted_band(share_matrix: np.ndarray) -> dict:
    """Rows are plans, columns districts. Sort each plan's shares from low to high, then
    take the 5th, 50th and 95th percentile per position (linear interpolation)."""
    ordered = np.sort(np.asarray(share_matrix, dtype=float), axis=1)
    p5, p50, p95 = np.percentile(ordered, [5, 50, 95], axis=0)
    return {"p5": p5.tolist(), "p50": p50.tolist(), "p95": p95.tolist()}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `39 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add linear and sorted bands"
```

### Task 2.10: convolve en is_narrow

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Test: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `_normalize` (Taak 2.4), `pmf_percentile` (Taak 2.4) en `pmf_position` (Taak 2.5) in de test.
- Produces: `convolve(pmfs: Sequence[np.ndarray]) -> np.ndarray`, kansen voor 0 tot de som van de zetels, met staten als onafhankelijk; `is_narrow(dist_counts) -> bool`, waar als één zetelaantal minstens 95% van de plannen heeft (rekent met gehele getallen: `max * 20 >= 19 * totaal`).

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 2.10: convolve and is_narrow

THREE = [np.array([1, 3]), np.array([2, 2]), np.array([0, 1, 1])]


def test_convolve_three_distributions():
    # A (1 seat): plans [1, 3] -> P = [0.25, 0.75]
    # B (1 seat): plans [2, 2] -> P = [0.5, 0.5]
    # C (2 seats): plans [0, 1, 1] -> P = [0, 0.5, 0.5]
    # A*B: P(0) = 0.25 * 0.5 = 0.125; P(1) = 0.25 * 0.5 + 0.75 * 0.5 = 0.5; P(2) = 0.75 * 0.5 = 0.375
    # (A*B)*C: P(0) = 0.125 * 0 = 0
    #          P(1) = 0.125 * 0.5 = 0.0625
    #          P(2) = 0.125 * 0.5 + 0.5 * 0.5 = 0.3125
    #          P(3) = 0.5 * 0.5 + 0.375 * 0.5 = 0.4375
    #          P(4) = 0.375 * 0.5 = 0.1875
    assert m.convolve(THREE) == pytest.approx([0, 0.0625, 0.3125, 0.4375, 0.1875])


def test_convolution_percentiles_and_position():
    pmf = m.convolve(THREE)
    # cumulative: 0, 0.0625, 0.375, 0.8125, 1.0
    # p5: 0.0625 >= 0.05 -> 1; median: 0.375 < 0.5 <= 0.8125 -> 3; p95: 0.8125 < 0.95 -> 4
    assert [m.pmf_percentile(pmf, q) for q in (5, 50, 95)] == [1, 3, 4]
    # value 2: fewer = 0 + 0.0625; equal = 0.3125; more = 0.4375 + 0.1875 = 0.625
    # midrank = 0.0625 + 0.3125 / 2 = 0.21875
    assert m.pmf_position(pmf, 2) == pytest.approx(
        {"fewer": 0.0625, "equal": 0.3125, "more": 0.625, "midrank": 0.21875})


def test_is_narrow():
    # Louisiana: 4989 of 5000 plans give 1 seat, 0.9978 >= 0.95
    assert m.is_narrow([1, 4989, 10]) is True
    # exactly 95% counts as narrow, 94% does not
    assert m.is_narrow([5, 95]) is True
    assert m.is_narrow([6, 94]) is False
    # Nevada: largest share 3086 / 5000 = 0.6172
    assert m.is_narrow([0, 13, 1901, 3086, 0]) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `3 failed, 39 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'convolve'` en `... 'is_narrow'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python
def convolve(pmfs: Sequence[np.ndarray]) -> np.ndarray:
    """Distribution of the sum of independent seat counts. Each input may be counts
    or probabilities; the result is probabilities for 0..sum of seats."""
    if len(pmfs) == 0:
        raise ValueError("no distributions")
    total = np.array([1.0])
    for pmf in pmfs:
        total = np.convolve(total, _normalize(pmf))
    return total


def is_narrow(dist_counts) -> bool:
    """True when one seat count has at least 95% of the plans (integer arithmetic)."""
    counts = np.asarray(dist_counts, dtype=np.int64)
    total = int(counts.sum())
    if total <= 0:
        raise ValueError("no plans")
    return int(counts.max()) * 20 >= 19 * total
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics.py -v`
Expected: `42 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add convolution and narrow-ensemble test"
```

### Task 2.11: pipeline/03_metrics.py

**Files:**
- Create: `pipeline/03_metrics.py`
- Test: `tests/test_metrics_step.py`, `tests/test_metrics_data.py`

**Interfaces:**
- Consumes:
  - `gerry.config`: `load_config() -> Config`, `interim_dir() -> Path`, `StateConfig` (`postal`, `fips`, `seats`, `extra_maps`), `ExtraMap` (`id`, `status`), `AtLargeState` (`postal`, `name`, `fips`).
  - `gerry.checks.CheckError(check, state, detail)`.
  - Alle functies uit `gerry.metrics` (Taken 2.1 tot en met 2.10).
  - `data/interim/units/{ST}.parquet` (kolommen `d`, `r`), `enacted_districts.parquet` (`state`, `map_id`, `method`, `district`, `d_pre_20`, `r_pre_20`, `d`, `r`), `ensemble_districts.parquet` (`state`, `draw`, `district`, dezelfde stemkolommen), `alarm_reference.parquet` (`state`, `district`, dezelfde stemkolommen), `join_log.json`. `enacted_districts.parquet` moet per staat `check_2022`/`block` hebben, en voor `enacted` en elke extra kaart zowel `block` als `whole_unit` (zie "Bestanden tussen de stappen" onder Interfaces in de plankop).
- Produces:
  - `data/interim/metrics.json` met `{"national": {...}, "states": {ST: {...}}, "checks": {...}}`.
  - Per staat precies: `d_share`, `proportional`, `enacted`, `neutral` {`median`, `p5`, `p95`, `dist`: aantal plannen per zetelaantal 0..seats}, `position` {`fewer`, `equal`, `more`, `midrank`}, `effects` {`geographic`, `drawing`}, `outside_band`, `eg` {`value`, `median`, `p5`, `p95`}, `mm` (zelfde vorm of `null`), `districts` [{`id` (fips + district), `share`, `d`, `r`}], `sorted` {`enacted`, `p5`, `p50`, `p95`}, alleen bij een staat met een geblokkeerde extra kaart `blocked_map` {`enacted`, `districts`, `position`}, en `computed_notes` (`["narrow_ensemble"]` of `[]`). Stemmen blijven kommagetallen; afronden gebeurt in `04_export`.
  - `national`: `seats` (429), `proportional`, `enacted`, `neutral` {`median`, `p5`, `p95`, `dist`: 430 kansen}, `position`, `effects`, `outside_band`, `single_seat` [{`postal`, `fips`, `name`}] gesorteerd op postcode.
  - `checks`: `plans` {ST: int}; `ties` {ST: {`ensemble`: int, `enacted`: int}}; `cd118_vs_alarm` {ST: {`districts`: [{`district`, `ours`, `alarm`}], `seats_ours`, `seats_alarm`}}; `whole_unit` {ST: [{`map_id`, `district`, `block`, `whole`, `block_dem`, `whole_dem`}]}; `pre_20` {ST: {district: aandeel D in 2020}}; `join_log` (de inhoud van `join_log.json`); `totals` {`district_seats`, `at_large`}.
  - Functies in het script, voor de tests: `HOUSE_SEATS = 435`, `state_metrics(st, d_total, r_total, enacted, ensemble) -> dict`, `state_checks(st, enacted, ensemble, reference) -> dict`, `national_metrics(states, at_large) -> dict`, `compute(cfg, idir) -> dict`, `main()`. Tests laden het script met `importlib`, omdat de bestandsnaam met een cijfer begint.

Een paar keuzes in het script:

- Enacted gebruikt de blokverdeling (`method == "block"`). De hele-eenheidstoewijzing is alleen een controle.
- De EG per plan gebruikt dezelfde winnaars als de zeteltelling: `dem_wins` met `d_pre_20` en `r_pre_20`.
- Een dubbele gelijke stand stopt het script met een `TieError` die staat, kaart of plan, en district noemt.
- `national_metrics` stopt met `CheckError("house_total", ...)` als districtszetels plus at-large zetels niet 435 zijn.

- [ ] **Step 1: Write the failing test**

Maak `tests/test_metrics_step.py`. Het voorbeeld is een verzonnen staat XX met 3 zetels en 4 plannen; alle getallen zijn met de hand nagerekend in het commentaar.

```python
"""Tests for pipeline/03_metrics.py on a made-up state with 3 seats and 4 plans.
Every expected value is worked out by hand in the comments."""
import dataclasses
import importlib.util
from pathlib import Path

import pandas as pd
import pytest

from gerry.checks import CheckError
from gerry.config import AtLargeState, ExtraMap, StateConfig
from gerry.metrics import TieError

_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "03_metrics.py"
_SPEC = importlib.util.spec_from_file_location("metrics_step", _PATH)
step = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(step)

XX = StateConfig(
    postal="XX", name="Example", fips="99", seats=3, map_name="Plan A", status="In effect",
    source_label="Example source", source_url="https://example.org", bef="cd120",
    elections=("pre_16", "pre_20"), unit_kind="vtd",
    extra_maps=(ExtraMap(id="xx_new", name="Plan B", status="Blocked", bef="cd120",
                         source_label="Example source", source_url="https://example.org/b"),),
    notes=())

COLS = ["d_pre_16", "r_pre_16", "d_pre_20", "r_pre_20", "d", "r"]


def _votes(d, r, d20=None, r20=None):
    # 2020 is half of the composite unless given; 2016 is the rest
    d20 = d / 2 if d20 is None else d20
    r20 = r / 2 if r20 is None else r20
    return [d - d20, r - r20, d20, r20, d, r]


def _enacted():
    rows = []
    maps = {
        # enacted, block: 01 D (600 > 400), 02 R, 03 R -> 1 seat; shares 0.6, 0.3, 0.4
        ("enacted", "block"): [("01", 600, 400), ("02", 300, 700), ("03", 400, 600)],
        ("enacted", "whole_unit"): [("01", 590, 410), ("02", 310, 690), ("03", 400, 600)],
        # blocked map: 01 D, 02 D, 03 R -> 2 seats
        ("xx_new", "block"): [("01", 520, 480), ("02", 510, 490), ("03", 270, 730)],
        # whole units flip district 02: 495 < 505
        ("xx_new", "whole_unit"): [("01", 530, 470), ("02", 495, 505), ("03", 275, 725)],
        ("check_2022", "block"): [("01", 610, 390), ("02", 300, 700), ("03", 390, 610)],
    }
    for (map_id, method), districts in maps.items():
        for district, d, r in districts:
            rows.append(["XX", map_id, method, district] + _votes(d, r))
    return pd.DataFrame(rows, columns=["state", "map_id", "method", "district"] + COLS)


def _ensemble():
    plans = {
        "1": [(650, 350), (350, 650), (300, 700)],              # 1 seat
        "2": [(550, 450), (500, 500, 300, 200), (250, 750)],    # tie in 02, 2020 300 > 200 -> D: 2 seats
        "3": [(450, 550), (450, 550), (400, 600)],              # 0 seats
        "4": [(600, 400), (400, 600), (300, 700)],              # 1 seat
    }
    rows = []
    for draw, districts in plans.items():
        for i, v in enumerate(districts, start=1):
            rows.append(["XX", draw, f"{i:02d}"] + _votes(*v))
    return pd.DataFrame(rows, columns=["state", "draw", "district"] + COLS)


def _reference():
    rows = [["XX", "01"] + _votes(612, 388), ["XX", "02"] + _votes(299, 701), ["XX", "03"] + _votes(389, 611)]
    return pd.DataFrame(rows, columns=["state", "district"] + COLS)


def test_state_metrics_hand_example():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # d_share = 1300 / 3000
    assert res["d_share"] == pytest.approx(1300 / 3000)
    # quota D = 1300 * 3 / 3000 = 1.3, quota R = 1.7; floors 1 + 1, rest 0.3 vs 0.7 -> R
    assert res["proportional"] == 1
    assert res["enacted"] == 1
    # seats per plan 1, 2, 0, 1 -> plans per seat count [1, 2, 1, 0]
    # cumulative 0.25, 0.75, 1.0: p5 0, median 1, p95 2
    assert res["neutral"] == {"median": 1, "p5": 0, "p95": 2, "dist": [1, 2, 1, 0]}
    # enacted 1: fewer 1/4, equal 2/4, more 1/4, midrank 0.25 + 0.25 = 0.5
    assert res["position"] == pytest.approx({"fewer": 0.25, "equal": 0.5, "more": 0.25, "midrank": 0.5})
    # geographic = median 1 - proportional 1 = 0; drawing = enacted 1 - median 1 = 0
    assert res["effects"] == {"geographic": 0, "drawing": 0}
    assert res["outside_band"] is False
    assert res["computed_notes"] == []


def test_state_metrics_eg_and_mm_with_neutral_context():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # enacted: wasted D = 100 + 300 + 400 = 800, wasted R = 400 + 200 + 100 = 700 -> 100 / 3000
    # plans: 1 -> (800 - 700) / 3000 = 1/30; 2 -> (300 - 1200) / 3000 = -0.3 (the tied
    # district counts as a D win, as in the seat count); 3 -> (1300 - 200) / 3000 = 11/30; 4 -> 1/30
    # sorted -0.3, 1/30, 1/30, 11/30; linear positions 3 * q / 100
    # p5: 0.15 -> -0.3 + 0.15 * (1/30 + 0.3) = -0.25; median: 1.5 -> 1/30
    # p95: 2.85 -> 1/30 + 0.85 * (11/30 - 1/30) = 19/60
    assert res["eg"] == pytest.approx({"value": 1 / 30, "median": 1 / 30, "p5": -0.25, "p95": 19 / 60})
    # enacted shares 0.6, 0.3, 0.4: mean 13/30, median 0.4 -> MM = 1/30
    # plans all have mean 13/30; medians 0.35, 0.5, 0.45, 0.4 -> MM 5/60, -4/60, -1/60, 2/60
    # sorted -4/60, -1/60, 2/60, 5/60: p5 = (-4 + 0.15 * 3) / 60; median = 0.5 / 60; p95 = (2 + 0.85 * 3) / 60
    assert res["mm"] == pytest.approx({"value": 1 / 30, "median": 0.5 / 60, "p5": -3.55 / 60, "p95": 4.55 / 60})


def test_state_metrics_districts_and_sorted_band():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    assert [d["id"] for d in res["districts"]] == ["9901", "9902", "9903"]
    assert res["districts"][0] == pytest.approx({"id": "9901", "share": 0.6, "d": 600.0, "r": 400.0})
    # plans sorted low to high: (.30 .35 .65) (.25 .50 .55) (.40 .45 .45) (.30 .40 .60)
    # lowest: .25 .30 .30 .40 -> p5 .25 + .15 * .05 = .2575; p50 .30; p95 .30 + .85 * .10 = .385
    # middle: .35 .40 .45 .50 -> p5 .3575; p50 .425; p95 .4925
    # highest: .45 .55 .60 .65 -> p5 .465; p50 .575; p95 .6425
    assert res["sorted"]["enacted"] == pytest.approx([0.3, 0.4, 0.6])
    assert res["sorted"]["p5"] == pytest.approx([0.2575, 0.3575, 0.465])
    assert res["sorted"]["p50"] == pytest.approx([0.30, 0.425, 0.575])
    assert res["sorted"]["p95"] == pytest.approx([0.385, 0.4925, 0.6425])


def test_state_metrics_blocked_map():
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), _ensemble())
    # Plan B: 2 seats; plans 1, 2, 0, 1 -> fewer 3/4, equal 1/4, more 0, midrank 0.875
    assert res["blocked_map"]["enacted"] == 2
    assert res["blocked_map"]["position"] == pytest.approx(
        {"fewer": 0.75, "equal": 0.25, "more": 0.0, "midrank": 0.875})
    assert [d["id"] for d in res["blocked_map"]["districts"]] == ["9901", "9902", "9903"]


def test_state_metrics_two_seats_has_no_mm():
    two = dataclasses.replace(XX, seats=2, extra_maps=())
    enacted = _enacted()
    enacted = enacted[(enacted.district != "03") & (enacted.map_id == "enacted")]
    ens = _ensemble()
    ens = ens[ens.district != "03"]
    res = step.state_metrics(two, 1000.0, 1000.0, enacted, ens)
    assert res["mm"] is None
    # seats per plan: 1 (650 > 350, 350 < 650), 2, 0, 1 -> no seat count has 95%
    assert res["computed_notes"] == []
    assert "blocked_map" not in res


def test_state_metrics_flags_narrow_ensemble():
    ens = _ensemble()
    ens = ens[ens.draw.isin(["1", "4"])]   # both plans give 1 seat -> 100% of plans
    res = step.state_metrics(XX, 1300.0, 1700.0, _enacted(), ens)
    assert res["computed_notes"] == ["narrow_ensemble"]


def test_state_metrics_double_tie_in_enacted_names_district():
    enacted = _enacted()
    hit = (enacted.map_id == "enacted") & (enacted.method == "block") & (enacted.district == "02")
    enacted.loc[hit, COLS] = _votes(500, 500, 250, 250)
    with pytest.raises(TieError, match="XX enacted, district 02"):
        step.state_metrics(XX, 1300.0, 1700.0, enacted, _ensemble())


def test_state_metrics_rejects_wrong_district_count():
    enacted = _enacted()
    enacted = enacted[~((enacted.map_id == "enacted") & (enacted.district == "03"))]
    with pytest.raises(CheckError, match="district_count"):
        step.state_metrics(XX, 1300.0, 1700.0, enacted, _ensemble())


def test_state_checks():
    checks = step.state_checks(XX, _enacted(), _ensemble(), _reference())
    assert checks["plans"] == 4
    # one tied district in the plans (plan 2, district 02), none in the maps
    assert checks["ties"] == {"ensemble": 1, "enacted": 0}
    ref = checks["cd118_vs_alarm"]
    # ours 0.61 / 0.30 / 0.39 against ALARM 0.612 / 0.299 / 0.389; one D seat each
    assert [r["district"] for r in ref["districts"]] == ["01", "02", "03"]
    assert ref["districts"][0] == pytest.approx({"district": "01", "ours": 0.61, "alarm": 0.612})
    assert (ref["seats_ours"], ref["seats_alarm"]) == (1, 1)
    whole = checks["whole_unit"]
    assert len(whole) == 6
    flipped = [w for w in whole if w["block_dem"] != w["whole_dem"]]
    assert flipped == [pytest.approx({"map_id": "xx_new", "district": "02", "block": 0.51, "whole": 0.495,
                                      "block_dem": True, "whole_dem": False})]
    # 2020 shares on the enacted map are half the composite on both sides: 0.6, 0.3, 0.4
    assert checks["pre_20"] == pytest.approx({"01": 0.6, "02": 0.3, "03": 0.4})


def test_state_checks_requires_check_2022_rows():
    enacted = _enacted()
    enacted = enacted[enacted.map_id != "check_2022"]
    with pytest.raises(CheckError, match="cd118_vs_alarm"):
        step.state_checks(XX, enacted, _ensemble(), _reference())


def test_national_metrics(monkeypatch):
    # three states as in the convolution test: A 1 seat [1, 3], B 1 seat [2, 2], C 2 seats [0, 1, 1]
    def state(dist, prop, enacted):
        return {"proportional": prop, "enacted": enacted, "neutral": {"dist": dist}}

    states = {"AA": state([1, 3], 1, 0), "BB": state([2, 2], 0, 1), "CC": state([0, 1, 1], 1, 2)}
    at_large = {"WY": AtLargeState("WY", "Wyoming", "56"), "AK": AtLargeState("AK", "Alaska", "02")}
    monkeypatch.setattr(step, "HOUSE_SEATS", 4 + 2)
    nat = step.national_metrics(states, at_large)
    assert nat["seats"] == 4
    assert nat["proportional"] == 2      # 1 + 0 + 1
    assert nat["enacted"] == 3           # 0 + 1 + 2
    # P = [0, 0.0625, 0.3125, 0.4375, 0.1875]; cumulative 0, .0625, .375, .8125, 1
    assert nat["neutral"]["dist"] == pytest.approx([0, 0.0625, 0.3125, 0.4375, 0.1875])
    assert (nat["neutral"]["median"], nat["neutral"]["p5"], nat["neutral"]["p95"]) == (3, 1, 4)
    # enacted 3: fewer .375, equal .4375, more .1875, midrank .375 + .21875 = .59375
    assert nat["position"] == pytest.approx({"fewer": 0.375, "equal": 0.4375, "more": 0.1875, "midrank": 0.59375})
    # geographic = 3 - 2 = 1; drawing = 3 - 3 = 0
    assert nat["effects"] == {"geographic": 1, "drawing": 0}
    assert nat["outside_band"] is False
    assert nat["single_seat"] == [{"postal": "AK", "fips": "02", "name": "Alaska"},
                                  {"postal": "WY", "fips": "56", "name": "Wyoming"}]


def test_national_metrics_checks_house_total():
    states = {"AA": {"proportional": 1, "enacted": 0, "neutral": {"dist": [1, 3]}}}
    with pytest.raises(CheckError, match="house_total"):
        step.national_metrics(states, {})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics_step.py -v`
Expected: collection error, `FileNotFoundError: ... pipeline\03_metrics.py`.

- [ ] **Step 3: Write minimal implementation**

Maak `pipeline/03_metrics.py`:

```python
"""Step 3: seats, neutral baseline, EG and MM per state and for the nation.

Reads data/interim/ (written by 02_join.py) and pipeline/config.yaml.
Writes data/interim/metrics.json.
Run from the repo root: python pipeline/03_metrics.py
"""
from __future__ import annotations

import json
from typing import Mapping

import numpy as np
import pandas as pd

from gerry.checks import CheckError
from gerry.config import AtLargeState, StateConfig, interim_dir, load_config
from gerry.metrics import (TieError, convolve, dem_wins, distribution, effects, efficiency_gap,
                           is_narrow, largest_remainder, linear_band, mean_median, outside_band,
                           pmf_percentile, pmf_position, position, sample_percentile, seats_by_plan,
                           sorted_band)

HOUSE_SEATS = 435
WIN_COLS = ["d", "r", "d_pre_20", "r_pre_20"]


def district_wins(rows: pd.DataFrame, label: str) -> np.ndarray:
    """dem_wins() on district rows; a double tie names the map and the district."""
    try:
        return dem_wins(rows["d"], rows["r"], rows["d_pre_20"], rows["r_pre_20"])
    except TieError as err:
        where = ", ".join(f"district {rows['district'].iloc[p]}" for p in err.positions)
        raise TieError(f"{label}, {where}: {err}", err.positions) from err


def map_rows(enacted: pd.DataFrame, map_id: str, method: str = "block") -> pd.DataFrame:
    rows = enacted[(enacted["map_id"] == map_id) & (enacted["method"] == method)]
    return rows.sort_values("district").reset_index(drop=True)


def map_result(rows: pd.DataFrame, st: StateConfig, map_id: str) -> dict:
    """Seats, shares and the district list of one map."""
    if len(rows) != st.seats or rows["district"].duplicated().any():
        raise CheckError("district_count", st.postal,
                         f"{map_id}: {len(rows)} district rows, expected {st.seats} distinct districts")
    wins = district_wins(rows, f"{st.postal} {map_id}")
    d = rows["d"].to_numpy(dtype=float)
    r = rows["r"].to_numpy(dtype=float)
    shares = d / (d + r)
    districts = [{"id": st.fips + district, "share": float(share), "d": float(dv), "r": float(rv)}
                 for district, share, dv, rv in zip(rows["district"], shares, d, r)]
    return {"enacted": int(wins.sum()), "districts": districts, "shares": shares, "wins": wins, "d": d, "r": r}


def plan_matrices(ensemble: pd.DataFrame, st: StateConfig) -> dict[str, np.ndarray]:
    """Plans as rows, districts as columns, one matrix per vote column in WIN_COLS."""
    wide = ensemble.pivot(index="draw", columns="district", values=WIN_COLS)
    if wide.isna().to_numpy().any() or wide.shape[1] != len(WIN_COLS) * st.seats:
        raise CheckError("plan_structure", st.postal,
                         f"plans do not all have districts 01..{st.seats:02d} with votes")
    return {col: wide[col].sort_index(axis=1).to_numpy(dtype=float) for col in WIN_COLS}


def state_metrics(st: StateConfig, d_total: float, r_total: float,
                  enacted: pd.DataFrame, ensemble: pd.DataFrame) -> dict:
    """All numbers for one state. enacted and ensemble hold this state's rows only."""
    proportional = largest_remainder(d_total, r_total, st.seats)
    main = map_result(map_rows(enacted, "enacted"), st, "enacted")

    samples = seats_by_plan(ensemble).to_numpy()
    dist = distribution(samples, st.seats)
    median = sample_percentile(samples, 50)
    p5 = sample_percentile(samples, 5)
    p95 = sample_percentile(samples, 95)

    mats = plan_matrices(ensemble, st)
    d, r = mats["d"], mats["r"]
    wins = dem_wins(d.ravel(), r.ravel(), mats["d_pre_20"].ravel(), mats["r_pre_20"].ravel()).reshape(d.shape)
    shares = d / (d + r)
    eg_plans = [efficiency_gap(d[i], r[i], wins[i]) for i in range(len(d))]
    eg = {"value": efficiency_gap(main["d"], main["r"], main["wins"]), **linear_band(eg_plans)}
    mm = None
    if st.seats >= 3:
        mm = {"value": mean_median(main["shares"]), **linear_band([mean_median(row) for row in shares])}

    result = {
        "d_share": d_total / (d_total + r_total),
        "proportional": proportional,
        "enacted": main["enacted"],
        "neutral": {"median": median, "p5": p5, "p95": p95, "dist": [int(n) for n in dist]},
        "position": position(samples, main["enacted"]),
        "effects": effects(proportional, median, main["enacted"]),
        "outside_band": outside_band(main["enacted"], p5, p95),
        "eg": eg,
        "mm": mm,
        "districts": main["districts"],
        "sorted": {"enacted": sorted(float(s) for s in main["shares"]), **sorted_band(shares)},
    }
    blocked = [m for m in st.extra_maps if m.status == "Blocked"]
    if len(blocked) > 1:
        raise CheckError("blocked_map", st.postal, "results.json holds one blocked map per state")
    if blocked:
        extra = map_result(map_rows(enacted, blocked[0].id), st, blocked[0].id)
        result["blocked_map"] = {"enacted": extra["enacted"], "districts": extra["districts"],
                                 "position": position(samples, extra["enacted"])}
    result["computed_notes"] = ["narrow_ensemble"] if is_narrow(dist) else []
    return result


def _shares(rows: pd.DataFrame) -> np.ndarray:
    return (rows["d"] / (rows["d"] + rows["r"])).to_numpy(dtype=float)


def state_checks(st: StateConfig, enacted: pd.DataFrame, ensemble: pd.DataFrame,
                 reference: pd.DataFrame) -> dict:
    """Numbers for docs/validation.md: plans, ties, CD118 against ALARM cd_2020,
    whole units against block allocation, and 2020 shares for the DRA comparison."""
    ours = map_rows(enacted, "check_2022")
    alarm = reference.sort_values("district").reset_index(drop=True)
    if len(ours) != st.seats or ours["district"].tolist() != alarm["district"].tolist():
        raise CheckError("cd118_vs_alarm", st.postal,
                         f"districts differ: ours {ours['district'].tolist()}, ALARM {alarm['district'].tolist()}")
    reference_check = {
        "districts": [{"district": dist, "ours": float(a), "alarm": float(b)}
                      for dist, a, b in zip(ours["district"], _shares(ours), _shares(alarm))],
        "seats_ours": int(district_wins(ours, f"{st.postal} check_2022").sum()),
        "seats_alarm": int(district_wins(alarm, f"{st.postal} ALARM cd_2020").sum()),
    }

    whole_unit = []
    for map_id in ["enacted"] + [m.id for m in st.extra_maps]:
        block = map_rows(enacted, map_id, "block")
        whole = map_rows(enacted, map_id, "whole_unit")
        if len(block) != st.seats or block["district"].tolist() != whole["district"].tolist():
            raise CheckError("whole_unit", st.postal, f"{map_id}: block and whole-unit districts differ")
        block_wins = district_wins(block, f"{st.postal} {map_id} block")
        whole_wins = district_wins(whole, f"{st.postal} {map_id} whole_unit")
        for i, (b_share, w_share) in enumerate(zip(_shares(block), _shares(whole))):
            whole_unit.append({"map_id": map_id, "district": block["district"].iloc[i],
                               "block": float(b_share), "whole": float(w_share),
                               "block_dem": bool(block_wins[i]), "whole_dem": bool(whole_wins[i])})

    main = map_rows(enacted, "enacted")
    pre_20 = {dist: float(dv / (dv + rv)) for dist, dv, rv in zip(main["district"], main["d_pre_20"], main["r_pre_20"])}
    return {
        "plans": int(ensemble["draw"].nunique()),
        "ties": {"ensemble": int((ensemble["d"] == ensemble["r"]).sum()),
                 "enacted": int((enacted["d"] == enacted["r"]).sum())},
        "cd118_vs_alarm": reference_check,
        "whole_unit": whole_unit,
        "pre_20": pre_20,
    }


def national_metrics(states: Mapping[str, dict], at_large: Mapping[str, AtLargeState]) -> dict:
    """Sums over states and the convolved neutral distribution (states independent)."""
    seats = sum(len(s["neutral"]["dist"]) - 1 for s in states.values())
    if seats + len(at_large) != HOUSE_SEATS:
        raise CheckError("house_total", "US",
                         f"{seats} district seats plus {len(at_large)} at-large seats, expected {HOUSE_SEATS}")
    proportional = sum(s["proportional"] for s in states.values())
    enacted = sum(s["enacted"] for s in states.values())
    pmf = convolve([np.asarray(s["neutral"]["dist"]) for s in states.values()])
    median = pmf_percentile(pmf, 50)
    p5 = pmf_percentile(pmf, 5)
    p95 = pmf_percentile(pmf, 95)
    return {
        "seats": seats,
        "proportional": proportional,
        "enacted": enacted,
        "neutral": {"median": median, "p5": p5, "p95": p95, "dist": [float(p) for p in pmf]},
        "position": pmf_position(pmf, enacted),
        "effects": effects(proportional, median, enacted),
        "outside_band": outside_band(enacted, p5, p95),
        "single_seat": [{"postal": a.postal, "fips": a.fips, "name": a.name}
                        for a in sorted(at_large.values(), key=lambda a: a.postal)],
    }


def compute(cfg, idir) -> dict:
    enacted_all = pd.read_parquet(idir / "enacted_districts.parquet")
    ensemble_all = pd.read_parquet(idir / "ensemble_districts.parquet")
    reference_all = pd.read_parquet(idir / "alarm_reference.parquet")
    join_log = json.loads((idir / "join_log.json").read_text(encoding="utf-8"))

    states = {}
    checks = {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {}, "join_log": join_log}
    for postal in sorted(cfg.states):
        st = cfg.states[postal]
        enacted = enacted_all[enacted_all["state"] == postal]
        ensemble = ensemble_all[ensemble_all["state"] == postal]
        reference = reference_all[reference_all["state"] == postal]
        if enacted.empty or ensemble.empty or reference.empty:
            raise CheckError("interim_files", postal, "state missing from the interim Parquet files")
        units = pd.read_parquet(idir / "units" / f"{postal}.parquet", columns=["d", "r"])
        states[postal] = state_metrics(st, float(units["d"].sum()), float(units["r"].sum()), enacted, ensemble)
        for key, value in state_checks(st, enacted, ensemble, reference).items():
            checks[key][postal] = value
        s = states[postal]
        print(f"{postal}: proportional {s['proportional']}, neutral {s['neutral']['median']} "
              f"({s['neutral']['p5']}-{s['neutral']['p95']}), enacted {s['enacted']}")
    national = national_metrics(states, cfg.at_large)
    checks["totals"] = {"district_seats": national["seats"], "at_large": len(cfg.at_large)}
    print(f"US: proportional {national['proportional']}, neutral {national['neutral']['median']} "
          f"({national['neutral']['p5']}-{national['neutral']['p95']}), enacted {national['enacted']}")
    return {"national": national, "states": states, "checks": checks}


def main() -> None:
    cfg = load_config()
    idir = interim_dir()
    metrics = compute(cfg, idir)
    out = idir / "metrics.json"
    out.write_text(json.dumps(metrics, indent=1, allow_nan=False), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics_step.py -v`
Expected: `12 passed`.

- [ ] **Step 5: Write the data integration test**

Maak `tests/test_metrics_data.py`. Het controleert de referentiegetallen uit het hoofdstuk Interfaces van dit plan, plus de Nevada-getallen per district en de CD118-controle.

```python
"""Reference numbers from the feasibility check (plan, Interfaces). Needs
data/interim/metrics.json from 02_join.py and 03_metrics.py on the real data."""
import json

import pytest

from gerry.config import interim_dir

METRICS = interim_dir() / "metrics.json"
pytestmark = [pytest.mark.data,
              pytest.mark.skipif(not METRICS.exists(), reason="run 02_join.py and 03_metrics.py first")]

# state: proportional, enacted, plans per D seat count, median, p5, p95
REFERENCE = {
    "NV": (2, 3, {1: 13, 2: 1901, 3: 3086}, 3, 2, 3),
    "TX": (18, 11, {12: 1, 13: 1, 14: 62, 15: 264, 16: 1027, 17: 1197, 18: 1213, 19: 755, 20: 452, 21: 28},
           17, 15, 20),
    "CA": (34, 48, {43: 112, 44: 763, 45: 3258, 46: 802, 47: 58, 48: 7}, 45, 44, 46),
    "IA": (2, 0, {0: 78, 1: 3214, 2: 1708}, 1, 1, 2),
    "WV": (1, 0, {0: 5000}, 0, 0, 0),
    "UT": (2, 1, {0: 1387, 1: 3613}, 1, 0, 1),
    "NC": (7, 3, {3: 1, 4: 156, 5: 1752, 6: 1875, 7: 1118, 8: 98}, 6, 5, 7),
    "LA": (2, 1, {0: 1, 1: 4989, 2: 10}, 1, 1, 1),
}


@pytest.fixture(scope="module")
def metrics():
    return json.loads(METRICS.read_text(encoding="utf-8"))


@pytest.mark.parametrize("postal", sorted(REFERENCE))
def test_reference_numbers(metrics, postal):
    proportional, enacted, plans, median, p5, p95 = REFERENCE[postal]
    s = metrics["states"][postal]
    assert s["proportional"] == proportional
    assert s["enacted"] == enacted
    assert {seats: n for seats, n in enumerate(s["neutral"]["dist"]) if n} == plans
    assert (s["neutral"]["median"], s["neutral"]["p5"], s["neutral"]["p95"]) == (median, p5, p95)
    assert metrics["checks"]["plans"][postal] == 5000


def test_nevada_enacted_districts(metrics):
    shares = {d["id"]: d["share"] for d in metrics["states"]["NV"]["districts"]}
    assert shares == pytest.approx({"3201": 0.547901, "3202": 0.436352, "3203": 0.534711, "3204": 0.548082},
                                   abs=5e-7)


def test_nevada_position(metrics):
    # 1914 of 5000 plans give fewer D seats than 3, 3086 the same, none more
    assert metrics["states"]["NV"]["position"] == pytest.approx(
        {"fewer": 0.3828, "equal": 0.6172, "more": 0.0, "midrank": 0.6914})


def test_nevada_cd118_against_alarm(metrics):
    rows = metrics["checks"]["cd118_vs_alarm"]["NV"]["districts"]
    assert max(abs(r["ours"] - r["alarm"]) for r in rows) == pytest.approx(0.00042, abs=5e-6)


def test_narrow_ensembles(metrics):
    # LA: 4989 of 5000 plans give 1 seat; WV: all give 0; NV: largest share 62%
    assert metrics["states"]["LA"]["computed_notes"] == ["narrow_ensemble"]
    assert metrics["states"]["WV"]["computed_notes"] == ["narrow_ensemble"]
    assert metrics["states"]["NV"]["computed_notes"] == []


def test_national_totals(metrics):
    nat = metrics["national"]
    states = metrics["states"].values()
    assert nat["seats"] == 429
    assert [s["postal"] for s in nat["single_seat"]] == ["AK", "DE", "ND", "SD", "VT", "WY"]
    assert nat["proportional"] == sum(s["proportional"] for s in states)
    assert nat["enacted"] == sum(s["enacted"] for s in states)
    assert len(nat["neutral"]["dist"]) == 430
    assert sum(nat["neutral"]["dist"]) == pytest.approx(1.0)
```

- [ ] **Step 6: Run 03_metrics on the real data**

`data/interim/` moet gevuld zijn door `pipeline/02_join.py` (taak 1.18) voor alle 44 staten. Is dat nog niet zo, draai eerst `.venv\Scripts\python pipeline/02_join.py`.

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: 44 regels in de vorm `XX: proportional P, neutral M (P5-P95), enacted E`, een regel `US: ...` en `Wrote ...\data\interim\metrics.json`. Voor de acht referentiestaten precies:

```
CA: proportional 34, neutral 45 (44-46), enacted 48
IA: proportional 2, neutral 1 (1-2), enacted 0
LA: proportional 2, neutral 1 (1-1), enacted 1
NC: proportional 7, neutral 6 (5-7), enacted 3
NV: proportional 2, neutral 3 (2-3), enacted 3
TX: proportional 18, neutral 17 (15-20), enacted 11
UT: proportional 2, neutral 1 (0-1), enacted 1
WV: proportional 1, neutral 0 (0-0), enacted 0
```

Stopt het script met een `TieError` of `CheckError`, pas dan niets aan de rekenregels aan. Volg de skill systematic-debugging vanaf de genoemde staat en controle. Is de oorzaak een databron of een definitie, stop dan en vraag het de eigenaar.

- [ ] **Step 7: Run the data test**

Run: `.venv\Scripts\python -m pytest tests/test_metrics_data.py -m data -v`
Expected: `13 passed`.

Faalt een referentiegetal, verander dan nooit het verwachte getal. Volg systematic-debugging: vergelijk eerst de kolomkeuze (`pre_16_dem_*` enzovoort), de districtscodes (twee tekens) en de gelijkspelregel. Vind je de oorzaak niet, stop en vraag de eigenaar.

- [ ] **Step 8: Run the whole suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 9: Commit**

`data/interim/` staat in `.gitignore`; alleen code en tests gaan mee.

```powershell
git add pipeline/03_metrics.py tests/test_metrics_step.py tests/test_metrics_data.py
git commit -m "Add 03_metrics: per-state and national metrics"
```

### Task 2.12: gerry/validation.py en het controlerapport

**Files:**
- Create: `pipeline/gerry/validation.py`, `data/validation_notes.yaml`
- Modify: `pipeline/03_metrics.py` (imports en `main`)
- Test: `tests/test_validation.py`, `tests/test_metrics_step.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `metrics.json`-structuur uit Taak 2.11 (vooral `checks`, `national.seats`, `national.single_seat`, `states.<ST>.eg.value`); `dem_wins` en `efficiency_gap` uit `gerry.metrics`; `REPO_ROOT` uit `gerry.config`; `yaml` (pyyaml).
- Produces:
  - `build_report(metrics: dict, crosscheck_dir: Path, notes_path: Path) -> str`, de volledige tekst van `docs/validation.md`.
  - Constanten `SHARE_TOLERANCE = 0.005`, `EXPECTED_PLANS = 5000`, `CHECK_KEYS`, `PLANSCORE_COLUMNS`, `DRA_COLUMNS`, `STATE_FILES_COLUMNS`.
  - `load_notes(path) -> dict[tuple[str, str], str]`, `read_crosscheck(path, columns) -> pd.DataFrame | None` (None als het bestand nog niet bestaat), `planscore_comparison(df) -> list[dict]` (per staat en verkiezing: `state`, `election`, `url`, `accessed`, `same_map`, `planscore`, `tolerance`, `reproduced`, `equal_turnout`), `equal_turnout_gap(d, r, dem_win) -> float`.
  - `03_metrics.py` schrijft na `metrics.json` ook `docs/validation.md`.

Het rapport heeft deze onderdelen, in deze volgorde: samenvatting met het aantal open en wachtende punten, zetels landelijk, CD118 tegen ALARM `cd_2020`, hele eenheden tegen blokverdeling, plannen en gelijke standen, het koppellog (met de blokken zonder eenheid, de stemmen die naar aantal blokken gingen en de nieuwe labels van ALARM's referentiekaart), PlanScore, DRA, CD120 tegen de bestanden van staten, en de gebruikte en ongebruikte verklaringen.

Regels voor de status per regel:

| Controle (sleutel) | In orde als | Anders |
|---|---|---|
| `cd118_vs_alarm` | elk district hoogstens 0,5 procentpunt verschil en hetzelfde aantal D-zetels | open, tenzij verklaard |
| `whole_unit` | geen district met een andere winnaar | open, tenzij verklaard |
| `plans` | precies 5.000 plannen | open, tenzij verklaard |
| `planscore_reproduction` | onze EG op de districtsstemmen van PlanScore ligt binnen de afronding van hun gedrukte waarde | open, tenzij verklaard |
| `planscore` | nooit vanzelf: andere stembasis, dus altijd een verklaring nodig | open, tenzij verklaard |
| `dra` | elk district hoogstens 0,5 procentpunt verschil en alle districten aanwezig | open, tenzij verklaard |
| `state_files` | elk CD120-blok in het gekoppelde district, geen blok alleen in de bron van de staat, koppeling één op één | open, tenzij verklaard |

De regel voor `whole_unit` volgt hoofdstuk 6 van de spec. Een district waar de hele-eenheidstoewijzing een andere winnaar geeft dan de blokverdeling, blijft open tot `data/validation_notes.yaml` het verklaart. Hoe je zo'n verklaring schrijft, staat in Taak 2.15, stap 3.

Een kruiscontrolebestand dat nog niet bestaat, staat als "pending" in het rapport en telt niet als open. Een verklaring die bij niets past, komt onder "Explanations without an exceedance".

Bestandsformaten. Alle CSV's zijn UTF-8, met komma's en een kopregel; alles wordt als tekst gelezen. De kolommen staan in deze volgorde:

| Bestand | Kolommen | Inhoud |
|---|---|---|
| `data/crosscheck/planscore.csv` | `state,election,url,accessed,same_map,planscore_eg_pct,planscore_favors,district,dem_votes,rep_votes` | Eén regel per district. `state` is de postcode, `election` de naam bij PlanScore (bijvoorbeeld `2024 U.S. House`), `accessed` de datum `JJJJ-MM-DD`, `same_map` is `yes` als die verkiezing op onze Enacted-kaart is gehouden, anders `no`. `planscore_eg_pct` is de grootte precies zoals PlanScore hem drukt (`4.2`); het aantal decimalen bepaalt de tolerantie (halve eenheid van de laatste decimaal). `planscore_favors` is `Republicans` of `Democrats`. `dem_votes`, `rep_votes` zijn de stemmen per district die PlanScore toont. De kolommen `url` tot en met `planscore_favors` zijn gelijk op alle regels van één staat en verkiezing. |
| `data/crosscheck/dra.csv` | `state,map_name,url,accessed,district,dem,rep` | Eén regel per district van de huidige kaart. `map_name` is de titel bij DRA, `district` twee tekens. `dem` en `rep` zoals DRA ze toont voor president 2020: stemmen of percentages, want alleen `dem / (dem + rep)` telt. |
| `data/crosscheck/state_files.csv` | `state,map,source_kind,source_url,retrieved,blocks_census,blocks_state,only_census,only_state,blocks_matching,share_blocks,share_vap,district_mapping,one_to_one,result` | Eén regel per vergeleken kaart, geschreven door `tools/compare_state_files.py` in Fase 3 (Taak 3.6), dat deze kolommen uit `STATE_FILES_COLUMNS` hieronder importeert. `source_kind` is `block_file` (blok voor blok) of `shapes` (interne punten van blokken in de officiële vormen). `blocks_census`, `blocks_state`, `only_census`, `only_state` en `blocks_matching` zijn aantallen blokken. `one_to_one` is `True` of `False`. `result` is de Engelse zin voor `data/sources.md`. Het rapport leest alleen `state`, `map`, `source_kind`, `source_url`, `retrieved`, `blocks_census`, `only_state`, `blocks_matching`, `one_to_one` en `result`; de kolommen moeten wel precies deze zijn, in deze volgorde. In orde als `blocks_matching == blocks_census`, `only_state == 0` en `one_to_one` waar is. |
| `data/validation_notes.yaml` | postcode, dan sleutel uit de tabel hierboven, dan tekst | Met de hand geschreven verklaringen, in het Engels, zonder em-dashes, met getallen en bron. |

- [ ] **Step 1: Write the failing test**

Maak `tests/test_validation.py`:

```python
"""Tests for gerry/validation.py on a small made-up metrics dict and cross-check files."""
import copy

import pytest

from gerry import validation as v
from gerry.metrics import efficiency_gap

PLANSCORE_HEADER = "state,election,url,accessed,same_map,planscore_eg_pct,planscore_favors,district,dem_votes,rep_votes\n"
DRA_HEADER = "state,map_name,url,accessed,district,dem,rep\n"
STATE_FILES_HEADER = ("state,map,source_kind,source_url,retrieved,blocks_census,blocks_state,only_census,"
                      "only_state,blocks_matching,share_blocks,share_vap,district_mapping,one_to_one,result\n")

METRICS = {
    "national": {"seats": 5, "proportional": 2, "enacted": 3, "neutral": {"median": 2},
                 "single_seat": [{"postal": "WY", "fips": "56", "name": "Wyoming"}]},
    "states": {"AA": {"eg": {"value": 0.05}}, "BB": {"eg": {"value": -0.01}}},
    "checks": {
        "plans": {"AA": 5000, "BB": 4999},
        "ties": {"AA": {"ensemble": 2, "enacted": 0}, "BB": {"ensemble": 0, "enacted": 0}},
        "cd118_vs_alarm": {
            # AA: largest difference 0.001 (0.100 points), seats equal -> ok
            "AA": {"districts": [{"district": "01", "ours": 0.401, "alarm": 0.400},
                                 {"district": "02", "ours": 0.620, "alarm": 0.620},
                                 {"district": "03", "ours": 0.550, "alarm": 0.5505}],
                   "seats_ours": 2, "seats_alarm": 2},
            # BB: district 02 differs by 0.007 (0.700 points) -> exceedance
            "BB": {"districts": [{"district": "01", "ours": 0.450, "alarm": 0.451},
                                 {"district": "02", "ours": 0.507, "alarm": 0.500}],
                   "seats_ours": 1, "seats_alarm": 0},
        },
        "whole_unit": {
            "AA": [{"map_id": "enacted", "district": "01", "block": 0.400, "whole": 0.401, "block_dem": False, "whole_dem": False},
                   {"map_id": "enacted", "district": "02", "block": 0.620, "whole": 0.618, "block_dem": True, "whole_dem": True},
                   {"map_id": "enacted", "district": "03", "block": 0.501, "whole": 0.499, "block_dem": True, "whole_dem": False}],
            "BB": [{"map_id": "enacted", "district": "01", "block": 0.45, "whole": 0.45, "block_dem": False, "whole_dem": False},
                   {"map_id": "enacted", "district": "02", "block": 0.51, "whole": 0.51, "block_dem": True, "whole_dem": True}],
        },
        "pre_20": {"AA": {"01": 0.40, "02": 0.62, "03": 0.55}, "BB": {"01": 0.45, "02": 0.51}},
        # same shape as 02_join.py writes: counts, counts per map, ALARM's reference map
        "join_log": {"AA": {"units": 30, "empty_weight_fields": 4, "units_zero_vap": 3,
                            "unlinked_blocks": 5, "unlinked_keys": 2,
                            "maps": {"enacted": {"split_units": 7, "zero_vap_split_units": 1,
                                                 "block_count_votes": 20.3, "weight_fallback_units": 0},
                                     "check_2022": {"split_units": 5, "zero_vap_split_units": 0,
                                                    "block_count_votes": 0.0, "weight_fallback_units": 0}},
                            "reference_share": 0.9812, "reference_labels": {"01": "02", "02": "01"},
                            "plans": 5000},
                     "BB": {"units": 12, "empty_weight_fields": 0, "units_zero_vap": 0,
                            "unlinked_blocks": 0, "unlinked_keys": 0,
                            "maps": {"enacted": {"split_units": 1, "zero_vap_split_units": 0,
                                                 "block_count_votes": 0.0, "weight_fallback_units": 2},
                                     "check_2022": {"split_units": 1, "zero_vap_split_units": 0,
                                                    "block_count_votes": 0.0, "weight_fallback_units": 2}},
                            "reference_share": 1.0, "reference_labels": {},
                            "plans": 4999}},
        "totals": {"district_seats": 5, "at_large": 1},
    },
}


@pytest.fixture
def crosscheck(tmp_path):
    d = tmp_path / "crosscheck"
    d.mkdir()
    # AA: (60, 40) D wins, (30, 70) R, (45, 55) R
    # wasted D = 10 + 30 + 45 = 85, wasted R = 40 + 20 + 5 = 65, all votes 300
    # EG = 20 / 300 = 0.0667: 6.67 points, PlanScore prints 6.7 favoring Republicans
    rows = ["AA,2024 U.S. House,https://planscore.org/x,2026-10-12,yes,6.7,Republicans,%s,%d,%d" % r
            for r in (("01", 60, 40), ("02", 30, 70), ("03", 45, 55))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    # AA 2020 two-party shares from DRA: 40.0, 62.0 and 55.8 (0.8 points above our 55.0)
    rows = ["AA,Plan A,https://davesredistricting.org/x,2026-10-12,%s,%s,%s" % r
            for r in (("01", "40.00", "60.00"), ("02", "62.00", "38.00"), ("03", "55.80", "44.20"))]
    (d / "dra.csv").write_text(DRA_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    return d


@pytest.fixture
def notes(tmp_path):
    p = tmp_path / "validation_notes.yaml"
    p.write_text("BB:\n  cd118_vs_alarm: >\n    ALARM's reference plan for BB is the 2021 map.\n"
                 "AA:\n  planscore: PlanScore uses 2024 House votes; we use 2016 and 2020 president.\n"
                 "CC:\n  dra: Left over from an earlier run.\n", encoding="utf-8")
    return p


def test_report_counts_open_and_pending(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # open: AA whole_unit (district 03 flips), AA dra (0.800 points), BB plans (4999)
    # explained: BB cd118_vs_alarm, AA planscore; pending: state_files.csv
    assert "**Open items: 3.** Pending: 1." in report
    assert "- AA whole_unit: enacted district 03 has another winner" in report
    assert "- AA dra: largest difference 0.800 points" in report
    assert "- BB plans: 4999 plans, expected 5000" in report
    assert "- data/crosscheck/state_files.csv not found" in report


def test_report_cd118_section(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    assert "| AA | 3 | 0.100 | 2 | 2 | ok |" in report
    assert "| BB | 2 | 0.700 | 1 | 0 | explained |" in report
    # districts above 0.5 points are listed with both shares
    assert "| BB | 02 | 50.70% | 50.00% | 0.700 |" in report


def test_report_planscore_section(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # PlanScore +6.70, ours on their votes +6.67, equal-turnout +6.67, our composite +5.00
    assert "| AA | 2024 U.S. House | +6.70 | +6.67 | +6.67 | ok | +5.00 | yes | explained | https://planscore.org/x (2026-10-12) |" in report


def test_report_lists_explanations_and_unused_notes(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    assert "- **BB, cd118_vs_alarm.** ALARM's reference plan for BB is the 2021 map." in report
    assert "- **CC, dra.** Left over from an earlier run." in report.split("## Explanations without an exceedance")[1]


def test_report_tables_for_logs(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    # counts per state: the whole-number fields in log order, then reference_share as a percentage
    assert ("| State | units | empty_weight_fields | units_zero_vap | unlinked_blocks | unlinked_keys | plans | "
            "reference_share |") in report
    assert "| AA | 30 | 4 | 3 | 5 | 2 | 5000 | 98.12% |" in report
    assert "| BB | 12 | 0 | 0 | 0 | 0 | 4999 | 100.00% |" in report
    # per map: split_units, zero_vap_split_units, block_count_votes (votes, one decimal), weight_fallback_units
    assert "| AA | enacted | 7 | 1 | 20.3 | 0 |" in report
    assert "| BB | check_2022 | 1 | 0 | 0.0 | 2 |" in report
    # only states whose cd_2020 districts take another label from map.rds
    assert "- AA: 01 -> 02, 02 -> 01" in report
    assert "- BB:" not in report
    assert "| AA | 5000 | 2 | 0 | ok |" in report


def test_report_state_files_section(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    rows = [
        # AA, shapes: 200 CD120 blocks, 197 in the matching district (2 outside every shape, 1 elsewhere)
        "AA,Plan A,shapes,https://example.org/a,2026-10-05,200,198,2,0,197,0.985,0.999,01=01;02=02;03=03,True,"
        "98.5000% of 200 block points lie in the matching district",
        # BB, block file: identical; the result text holds a comma, so it is quoted
        'BB,Plan B,block_file,https://example.org/b,2026-10-05,100,100,0,0,100,1.0,,01=01;02=02,True,'
        '"Identical, block for block (100 blocks)"',
    ]
    (d / "state_files.csv").write_text(STATE_FILES_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, notes)
    # 200 - 197 = 3 blocks outside the matching district; no note for AA state_files -> open
    assert "- AA state_files: 3 of 200 blocks outside the matching district, 0 only in the state source" in report
    assert ("| BB | Plan B | block_file | 100 | 0 | 0 | Identical, block for block (100 blocks) | ok | "
            "https://example.org/b (2026-10-05) |") in report
    # planscore.csv and dra.csv are missing from this folder
    assert "Pending: 2." in report


def test_report_without_crosscheck_files(tmp_path):
    report = v.build_report(METRICS, tmp_path, tmp_path / "missing.yaml")
    assert "Pending: 3." in report


def test_report_has_no_em_dash(crosscheck, notes):
    em_dash = chr(0x2014)
    assert em_dash not in v.build_report(METRICS, crosscheck, notes)


def test_failed_reproduction_is_open(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    rows = ["AA,2024 U.S. House,https://planscore.org/x,2026-10-12,yes,5.0,Republicans,%s,%d,%d" % r
            for r in (("01", 60, 40), ("02", 30, 70), ("03", 45, 55))]
    (d / "planscore.csv").write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    report = v.build_report(METRICS, d, notes)
    assert "- AA planscore_reproduction: PlanScore +5.00, ours +6.67" in report


def test_planscore_comparison_signs_and_tolerance(tmp_path):
    p = tmp_path / "planscore.csv"
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,01,40,60",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,02,70,30",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,03,55,45"]
    p.write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    [row] = v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))
    # mirror of the fixture: our EG = -20 / 300; PlanScore "6.7 favoring Democrats" -> -0.067
    assert row["planscore"] == pytest.approx(-0.067)
    assert row["reproduced"] == pytest.approx(-20 / 300)
    # one decimal in percent: half of 0.1 point = 0.0005 as a fraction
    assert row["tolerance"] == pytest.approx(0.0005)


def test_planscore_rows_must_agree_within_a_plan(tmp_path):
    p = tmp_path / "planscore.csv"
    rows = ["AA,2024 U.S. House,u,2026-10-12,yes,6.7,Democrats,01,40,60",
            "AA,2024 U.S. House,u,2026-10-12,yes,6.8,Democrats,02,70,30"]
    p.write_text(PLANSCORE_HEADER + "\n".join(rows) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="planscore_eg_pct"):
        v.planscore_comparison(v.read_crosscheck(p, v.PLANSCORE_COLUMNS))


def test_equal_turnout_gap_differs_from_wasted_votes():
    # (80, 20) T 100 D wins; (10, 30) T 40 R wins; (25, 35) T 60 R wins
    # wasted votes: D 30 + 10 + 25 = 65, R 20 + 10 + 5 = 35 -> (65 - 35) / 200 = 0.15
    # equal turnout: V = 115 / 200 = 0.575, S = 1/3 -> 2 * 0.075 - (1/3 - 0.5) = 0.31667
    d, r = [80, 10, 25], [20, 30, 35]
    win = [True, False, False]
    assert efficiency_gap(d, r, win) == pytest.approx(0.15)
    assert v.equal_turnout_gap(d, r, win) == pytest.approx(0.15 + 1 / 6)


def test_read_crosscheck_rejects_wrong_columns(tmp_path):
    p = tmp_path / "dra.csv"
    p.write_text("state,district,dem\nAA,01,40\n", encoding="utf-8")
    with pytest.raises(ValueError, match="columns"):
        v.read_crosscheck(p, v.DRA_COLUMNS)
    assert v.read_crosscheck(tmp_path / "none.csv", v.DRA_COLUMNS) is None


def test_load_notes_rejects_unknown_check(tmp_path):
    p = tmp_path / "notes.yaml"
    p.write_text("AA:\n  typo_check: text\n", encoding="utf-8")
    with pytest.raises(ValueError, match="typo_check"):
        v.load_notes(p)


def test_dra_unknown_district_raises(tmp_path, notes):
    d = tmp_path / "cc"
    d.mkdir()
    (d / "dra.csv").write_text(DRA_HEADER + "AA,Plan A,u,2026-10-12,09,40,60\n", encoding="utf-8")
    with pytest.raises(ValueError, match="AA district 09"):
        v.build_report(copy.deepcopy(METRICS), d, notes)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_validation.py -v`
Expected: collection error, `ImportError: cannot import name 'validation' from 'gerry'`.

- [ ] **Step 3: Write minimal implementation**

Maak `pipeline/gerry/validation.py`:

```python
"""docs/validation.md: method checks and cross-checks, rebuilt on every run of 03_metrics.

An exceedance is open until data/validation_notes.yaml explains it for that state and
check. A cross-check file that does not exist yet is pending.

Input files (UTF-8, comma-separated, header row, every value read as text):
- data/crosscheck/planscore.csv, PLANSCORE_COLUMNS, one row per district. The plan-level
  columns (url, accessed, same_map, planscore_eg_pct, planscore_favors) repeat on every
  row of a state and election. planscore_eg_pct is the size exactly as PlanScore prints it
  ("4.2"), planscore_favors is "Republicans" or "Democrats", same_map is "yes" or "no".
- data/crosscheck/dra.csv, DRA_COLUMNS, one row per district; dem and rep as DRA shows
  them for the 2020 presidential election (votes or percentages; only dem / (dem + rep) is used).
- data/crosscheck/state_files.csv, STATE_FILES_COLUMNS, one row per compared map, written by
  tools/compare_state_files.py (Phase 3). source_kind is "block_file" or "shapes"; the
  blocks_* and only_* columns are block counts; one_to_one is "True" or "False".
- data/validation_notes.yaml: state postal code -> check name (CHECK_KEYS) -> explanation.
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd
import yaml

from gerry.metrics import dem_wins, efficiency_gap

SHARE_TOLERANCE = 0.005       # 0.5 percentage point, as a fraction
EXPECTED_PLANS = 5000
CHECK_KEYS = ("cd118_vs_alarm", "whole_unit", "plans", "planscore_reproduction", "planscore", "dra",
              "state_files")
PLANSCORE_COLUMNS = ("state", "election", "url", "accessed", "same_map", "planscore_eg_pct",
                     "planscore_favors", "district", "dem_votes", "rep_votes")
DRA_COLUMNS = ("state", "map_name", "url", "accessed", "district", "dem", "rep")
# tools/compare_state_files.py (Phase 3) imports this tuple and writes state_files.csv with it.
STATE_FILES_COLUMNS = ("state", "map", "source_kind", "source_url", "retrieved", "blocks_census", "blocks_state",
                       "only_census", "only_state", "blocks_matching", "share_blocks", "share_vap",
                       "district_mapping", "one_to_one", "result")
_PLAN_LEVEL = ("url", "accessed", "same_map", "planscore_eg_pct", "planscore_favors")


def load_notes(path: Path) -> dict[tuple[str, str], str]:
    """{(state, check): explanation} from data/validation_notes.yaml (state -> check -> text)."""
    if not path.exists():
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    notes = {}
    for state, checks in raw.items():
        if not isinstance(checks, dict):
            raise ValueError(f"{path}: {state} must map check names to explanations")
        for check, text in checks.items():
            if check not in CHECK_KEYS:
                raise ValueError(f"{path}: unknown check {check!r} for {state}; use one of {CHECK_KEYS}")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{path}: empty explanation for {state} {check}")
            notes[(str(state), check)] = " ".join(text.split())
    return notes


def read_crosscheck(path: Path, columns: Sequence[str]) -> pd.DataFrame | None:
    """A cross-check CSV as text columns, or None when the file does not exist yet."""
    if not path.exists():
        return None
    df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
    if list(df.columns) != list(columns):
        raise ValueError(f"{path}: columns {list(df.columns)}, expected {list(columns)}")
    return df.apply(lambda col: col.str.strip())


def equal_turnout_gap(d, r, dem_win) -> float:
    """EG with every district weighted equally: 2(V - 0.5) - (S - 0.5), positive favors
    Republicans. PlanScore's current code uses this form with the opposite sign."""
    d = np.asarray(d, dtype=float)
    r = np.asarray(r, dtype=float)
    vote_share = d.sum() / (d + r).sum()
    seat_share = float(np.mean(np.asarray(dem_win, dtype=bool)))
    return float(2 * (vote_share - 0.5) - (seat_share - 0.5))


def planscore_comparison(df: pd.DataFrame) -> list[dict]:
    """One dict per state and election: PlanScore's EG in our sign, the rounding
    tolerance of the printed value, and our EG on PlanScore's district votes."""
    out = []
    for (state, election), rows in df.groupby(["state", "election"], sort=False):
        for col in _PLAN_LEVEL:
            if rows[col].nunique() != 1:
                raise ValueError(f"planscore.csv: {state} {election} has more than one {col}")
        first = rows.iloc[0]
        if first["planscore_favors"] not in ("Republicans", "Democrats"):
            raise ValueError(f"planscore.csv: planscore_favors must be Republicans or Democrats, got {first['planscore_favors']!r}")
        if first["same_map"] not in ("yes", "no"):
            raise ValueError(f"planscore.csv: same_map must be yes or no, got {first['same_map']!r}")
        text = first["planscore_eg_pct"]
        decimals = len(text.split(".")[1]) if "." in text else 0
        sign = 1.0 if first["planscore_favors"] == "Republicans" else -1.0
        d = rows["dem_votes"].astype(float).to_numpy()
        r = rows["rep_votes"].astype(float).to_numpy()
        wins = dem_wins(d, r)
        out.append({
            "state": state, "election": election, "url": first["url"], "accessed": first["accessed"],
            "same_map": first["same_map"] == "yes",
            "planscore": sign * float(text) / 100,
            "tolerance": 0.5 * 10.0 ** -decimals / 100,
            "reproduced": efficiency_gap(d, r, wins),
            "equal_turnout": equal_turnout_gap(d, r, wins),
        })
    return out


class _Ledger:
    """Tracks open, explained and pending items while the report is built."""

    def __init__(self, notes: dict[tuple[str, str], str]):
        self.notes = notes
        self.used: set[tuple[str, str]] = set()
        self.open: list[str] = []
        self.pending: list[str] = []

    def judge(self, state: str, check: str, ok: bool, what: str) -> str:
        if ok:
            return "ok"
        if (state, check) in self.notes:
            self.used.add((state, check))
            return "explained"
        self.open.append(f"{state} {check}: {what}")
        return "open"


def _cell(value) -> str:
    return str(value).replace("|", "\\|")


def _table(headers: Sequence[str], rows: Sequence[Sequence]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(_cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def _pct(x: float) -> str:
    return f"{100 * x:.2f}%"


def _pts(x: float) -> str:
    return f"{100 * x:.3f}"


def _eg(x: float) -> str:
    return f"{100 * x:+.2f}"


def _seat_totals(metrics: dict) -> str:
    nat = metrics["national"]
    at_large = [s["postal"] for s in nat["single_seat"]]
    n = nat["seats"]
    rows = [(label, value, n - value) for label, value in
            (("Proportional", nat["proportional"]), ("Neutral baseline (median)", nat["neutral"]["median"]),
             ("Enacted", nat["enacted"]))]
    return "\n\n".join([
        "## Seat totals",
        f"District seats: {n} in {len(metrics['states'])} states. At-large seats: {len(at_large)} "
        f"({', '.join(at_large)}). Together: {n + len(at_large)}.",
        _table(["Scenario", "Democratic seats", "Other seats"], rows),
    ])


def _cd118(metrics: dict, ledger: _Ledger) -> str:
    rows, details = [], []
    for state, chk in sorted(metrics["checks"]["cd118_vs_alarm"].items()):
        diffs = [abs(d["ours"] - d["alarm"]) for d in chk["districts"]]
        worst = max(diffs)
        ok = worst <= SHARE_TOLERANCE + 1e-12 and chk["seats_ours"] == chk["seats_alarm"]
        what = f"largest difference {_pts(worst)} points, D seats {chk['seats_ours']} against {chk['seats_alarm']}"
        status = ledger.judge(state, "cd118_vs_alarm", ok, what)
        rows.append((state, len(diffs), _pts(worst), chk["seats_ours"], chk["seats_alarm"], status))
        details += [(state, d["district"], _pct(d["ours"]), _pct(d["alarm"]), _pts(abs(d["ours"] - d["alarm"])))
                    for d in chk["districts"] if abs(d["ours"] - d["alarm"]) > SHARE_TOLERANCE + 1e-12]
    parts = [
        "## CD118 maps against ALARM cd_2020",
        "Our block allocation on the 2022 maps (Census CD118) against ALARM's reference plan `cd_2020`, "
        "same vote basis. Threshold: at most 0.5 points per district and the same number of Democratic seats.",
        _table(["State", "Districts", "Largest difference (points)", "D seats, ours", "D seats, ALARM", "Status"], rows),
    ]
    if details:
        parts += ["Districts above the threshold:",
                  _table(["State", "District", "Ours", "ALARM", "Difference (points)"], details)]
    return "\n\n".join(parts)


def _whole_unit(metrics: dict, ledger: _Ledger) -> str:
    rows = []
    for state, items in sorted(metrics["checks"]["whole_unit"].items()):
        for map_id in dict.fromkeys(i["map_id"] for i in items):
            sub = [i for i in items if i["map_id"] == map_id]
            worst = max(abs(i["block"] - i["whole"]) for i in sub)
            flipped = [i["district"] for i in sub if i["block_dem"] != i["whole_dem"]]
            if len(flipped) == 1:
                what = f"{map_id} district {flipped[0]} has another winner"
            else:
                what = f"{map_id} districts {', '.join(flipped)} have another winner"
            status = ledger.judge(state, "whole_unit", not flipped, what)
            rows.append((state, map_id, _pts(worst), ", ".join(flipped) or "none", status))
    return "\n\n".join([
        "## Whole-unit assignment against block allocation",
        "Each unit assigned whole to the district with most of its voting-age population, against the "
        "block allocation used for Enacted. A district with another winner is open until explained.",
        _table(["State", "Map", "Largest difference (points)", "Districts with another winner", "Status"], rows),
    ])


def _plans_and_ties(metrics: dict, ledger: _Ledger) -> str:
    rows = []
    for state, plans in sorted(metrics["checks"]["plans"].items()):
        ties = metrics["checks"]["ties"][state]
        status = ledger.judge(state, "plans", plans == EXPECTED_PLANS, f"{plans} plans, expected {EXPECTED_PLANS}")
        rows.append((state, plans, ties["ensemble"], ties["enacted"], status))
    return "\n\n".join([
        "## Plans and ties",
        "Ties are districts where D equals R in the composite; the 2020 result decided them.",
        _table(["State", "Plans", "Ties in plans", "Ties in maps", "Status"], rows),
    ])


def _log_value(value) -> str:
    """A join-log count as table text: votes (floats) with one decimal, whole numbers as they are."""
    return f"{value:.1f}" if isinstance(value, float) else str(value)


def _join_log(metrics: dict) -> str:
    log = metrics["checks"]["join_log"]
    # counts per state: every whole-number field (units, blocks, unlinked_blocks, plans, ...)
    keys = list(dict.fromkeys(k for entry in log.values() for k, val in entry.items()
                              if isinstance(val, int) and not isinstance(val, bool)))
    rows = [(state, *[entry.get(k, "") for k in keys],
             _pct(entry["reference_share"]) if "reference_share" in entry else "")
            for state, entry in sorted(log.items())]
    # per-map counts: {"maps": {map_id: {count: value}}}; block_count_votes is a number of votes
    map_keys = list(dict.fromkeys(k for entry in log.values() for counts in entry.get("maps", {}).values()
                                  for k in counts))
    map_rows = [(state, map_id, *[_log_value(counts.get(k, "")) for k in map_keys])
                for state, entry in sorted(log.items()) for map_id, counts in entry.get("maps", {}).items()]
    relabeled = [f"- {state}: " + ", ".join(f"{k} -> {v}" for k, v in sorted(entry["reference_labels"].items()))
                 for state, entry in sorted(log.items()) if entry.get("reference_labels")]
    parts = ["## Join log",
             "Counts from 02_join.py. `unlinked_blocks` are census blocks whose unit is not in ALARM's map.rds "
             "(water); they have no voting-age population and no people. `reference_share` is the share of the "
             "population with the same district on ALARM's reference plan and on the 2022 map (Census CD118)."]
    if keys:
        parts.append(_table(["State", *keys, "reference_share"], rows))
    if map_rows:
        parts += ["Counts per map (block allocation). `block_count_votes` are the votes of split units without "
                  "voting-age population, spread over their blocks by block count.",
                  _table(["State", "Map", *map_keys], map_rows)]
    parts += ["ALARM's `cd_2020` districts that take the label of the matching district in map.rds:",
              "\n".join(relabeled) if relabeled else "None."]
    return "\n\n".join(parts)


def _planscore(metrics: dict, crosscheck_dir: Path, ledger: _Ledger) -> str:
    head = ["## PlanScore",
            "EG in percentage points, positive favors Republicans. PlanScore's own sign is the opposite; "
            "the CSV records the size and the party PlanScore names. \"Ours on PlanScore's votes\" must "
            "match PlanScore to the rounding of its printed value."]
    df = read_crosscheck(crosscheck_dir / "planscore.csv", PLANSCORE_COLUMNS)
    if df is None:
        ledger.pending.append("data/crosscheck/planscore.csv not found")
        return "\n\n".join(head + ["Pending: data/crosscheck/planscore.csv not found."])
    rows = []
    for c in planscore_comparison(df):
        state = c["state"]
        if state not in metrics["states"]:
            raise ValueError(f"planscore.csv: {state} is not a state in metrics.json")
        repro_ok = abs(c["reproduced"] - c["planscore"]) <= c["tolerance"] + 1e-12
        repro = ledger.judge(state, "planscore_reproduction", repro_ok,
                             f"PlanScore {_eg(c['planscore'])}, ours {_eg(c['reproduced'])}")
        ours = metrics["states"][state]["eg"]["value"]
        composite = ledger.judge(state, "planscore", False,
                                 f"PlanScore {_eg(c['planscore'])}, our composite {_eg(ours)}")
        rows.append((state, c["election"], _eg(c["planscore"]), _eg(c["reproduced"]), _eg(c["equal_turnout"]),
                     repro, _eg(ours), "yes" if c["same_map"] else "no", composite,
                     f"{c['url']} ({c['accessed']})"))
    return "\n\n".join(head + [_table(
        ["State", "Election", "PlanScore", "Ours on PlanScore's votes", "Equal-turnout formula", "Reproduced",
         "Our composite, enacted map", "Same map", "Composite", "Source"], rows)])


def _dra(metrics: dict, crosscheck_dir: Path, ledger: _Ledger) -> str:
    head = ["## Dave's Redistricting App",
            "2020 presidential two-party share per district on the current map: DRA against our block "
            "allocation. Threshold: 0.5 points per district, and every district present."]
    df = read_crosscheck(crosscheck_dir / "dra.csv", DRA_COLUMNS)
    if df is None:
        ledger.pending.append("data/crosscheck/dra.csv not found")
        return "\n\n".join(head + ["Pending: data/crosscheck/dra.csv not found."])
    pre_20 = metrics["checks"]["pre_20"]
    rows, details = [], []
    for state, sub in df.groupby("state", sort=True):
        if state not in pre_20:
            raise ValueError(f"dra.csv: {state} is not a state in metrics.json")
        if sub["district"].duplicated().any():
            raise ValueError(f"dra.csv: {state} lists a district twice")
        diffs = []
        for row in sub.itertuples(index=False):
            if row.district not in pre_20[state]:
                raise ValueError(f"dra.csv: {state} district {row.district} is not in the enacted map")
            theirs = float(row.dem) / (float(row.dem) + float(row.rep))
            ours = pre_20[state][row.district]
            diffs.append(abs(theirs - ours))
            if abs(theirs - ours) > SHARE_TOLERANCE + 1e-12:
                details.append((state, row.district, _pct(theirs), _pct(ours), _pts(abs(theirs - ours))))
        complete = len(sub) == len(pre_20[state])
        worst = max(diffs)
        what = f"largest difference {_pts(worst)} points" + ("" if complete else f", {len(sub)} of {len(pre_20[state])} districts")
        status = ledger.judge(state, "dra", complete and worst <= SHARE_TOLERANCE + 1e-12, what)
        sources = "; ".join(f"{u} ({a})" for u, a in dict.fromkeys(zip(sub["url"], sub["accessed"])))
        rows.append((state, sub["map_name"].iloc[0], f"{len(sub)} of {len(pre_20[state])}", _pts(worst), status, sources))
    parts = head + [_table(["State", "Map", "Districts", "Largest difference (points)", "Status", "Source"], rows)]
    if details:
        parts += ["Districts above the threshold:",
                  _table(["State", "District", "DRA", "Ours", "Difference (points)"], details)]
    return "\n\n".join(parts)


def _state_files(crosscheck_dir: Path, ledger: _Ledger) -> str:
    head = ["## CD120 against state files",
            "From tools/compare_state_files.py. `block_file`: the state's block file, block for block; "
            "`shapes`: block internal points in the state's district shapes. District numbers are matched "
            "by largest overlap first. In order when every CD120 block lies in the matching district, no "
            "block is only in the state source, and the matching is one-to-one."]
    df = read_crosscheck(crosscheck_dir / "state_files.csv", STATE_FILES_COLUMNS)
    if df is None:
        ledger.pending.append("data/crosscheck/state_files.csv not found")
        return "\n\n".join(head + ["Pending: data/crosscheck/state_files.csv not found."])
    rows = []
    for row in df.sort_values("state").itertuples(index=False):
        if row.source_kind not in ("block_file", "shapes"):
            raise ValueError(f"state_files.csv: source_kind must be block_file or shapes, got {row.source_kind!r}")
        if row.one_to_one not in ("True", "False"):
            raise ValueError(f"state_files.csv: one_to_one must be True or False, got {row.one_to_one!r}")
        census, matching, only_state = int(row.blocks_census), int(row.blocks_matching), int(row.only_state)
        one_to_one = row.one_to_one == "True"
        what = f"{census - matching} of {census} blocks outside the matching district, {only_state} only in the state source"
        if not one_to_one:
            what += ", district matching not one-to-one"
        status = ledger.judge(row.state, "state_files", matching == census and only_state == 0 and one_to_one, what)
        rows.append((row.state, row.map, row.source_kind, census, census - matching, only_state, row.result,
                     status, f"{row.source_url} ({row.retrieved})"))
    return "\n\n".join(head + [_table(
        ["State", "Map", "Source", "CD120 blocks", "Outside matching district", "Only in state source",
         "Result", "Status", "Link"], rows)])


def build_report(metrics: dict, crosscheck_dir: Path, notes_path: Path) -> str:
    """The full text of docs/validation.md."""
    ledger = _Ledger(load_notes(notes_path))
    sections = [
        _seat_totals(metrics),
        _cd118(metrics, ledger),
        _whole_unit(metrics, ledger),
        _plans_and_ties(metrics, ledger),
        _join_log(metrics),
        _planscore(metrics, crosscheck_dir, ledger),
        _dra(metrics, crosscheck_dir, ledger),
        _state_files(crosscheck_dir, ledger),
    ]
    used = [f"- **{s}, {c}.** {ledger.notes[(s, c)]}" for s, c in sorted(ledger.used)]
    unused = [f"- **{s}, {c}.** {t}" for (s, c), t in sorted(ledger.notes.items()) if (s, c) not in ledger.used]
    sections.append("## Explanations\n\n" + ("\n".join(used) if used else "None."))
    sections.append("## Explanations without an exceedance\n\nThese notes match nothing in this run. "
                    "Remove them or check the state and check name.\n\n" + ("\n".join(unused) if unused else "None."))
    summary = [
        "# Validation report",
        "Generated by `pipeline/03_metrics.py` from `data/interim/metrics.json`, `data/crosscheck/` and "
        "`data/validation_notes.yaml`. Do not edit by hand.",
        "Shares are Democratic two-party shares. Differences are in percentage points. An exceedance stays "
        "open until `data/validation_notes.yaml` explains it.",
        f"**Open items: {len(ledger.open)}.** Pending: {len(ledger.pending)}.",
    ]
    if ledger.open:
        summary.append("\n".join(f"- {item}" for item in ledger.open))
    if ledger.pending:
        summary.append("Pending:\n\n" + "\n".join(f"- {item}" for item in ledger.pending))
    return "\n\n".join(summary + sections) + "\n"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_validation.py -v`
Expected: `15 passed`.

- [ ] **Step 5: Write the failing test for the report in main()**

Voeg onderaan `tests/test_metrics_step.py` toe:

```python
def test_main_writes_metrics_and_report(tmp_path, monkeypatch):
    import json

    metrics = {"national": {"seats": 0, "proportional": 0, "enacted": 0, "neutral": {"median": 0},
                            "single_seat": []},
               "states": {},
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {},
                          "join_log": {}}}
    (tmp_path / "data" / "interim").mkdir(parents=True)
    (tmp_path / "docs").mkdir()
    monkeypatch.setattr(step, "load_config", lambda: None)
    monkeypatch.setattr(step, "interim_dir", lambda: tmp_path / "data" / "interim")
    monkeypatch.setattr(step, "compute", lambda cfg, idir: metrics)
    monkeypatch.setattr(step, "REPO_ROOT", tmp_path)
    step.main()
    written = json.loads((tmp_path / "data" / "interim" / "metrics.json").read_text(encoding="utf-8"))
    assert written == metrics
    report = (tmp_path / "docs" / "validation.md").read_text(encoding="utf-8")
    assert report.startswith("# Validation report")
```

- [ ] **Step 6: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_metrics_step.py -v`
Expected: `1 failed, 12 passed`, met `AttributeError: <module 'metrics_step' ...> has no attribute 'REPO_ROOT'`.

- [ ] **Step 7: Wire the report into 03_metrics.py**

In `pipeline/03_metrics.py`, vervang de importregel

```python
from gerry.config import AtLargeState, StateConfig, interim_dir, load_config
```

door

```python
from gerry.config import REPO_ROOT, AtLargeState, StateConfig, interim_dir, load_config
```

Voeg direct onder het importblok van `gerry.metrics` (de regel die eindigt op `sorted_band)`) toe:

```python
from gerry.validation import build_report
```

Vervang de functie `main` door:

```python
def main() -> None:
    cfg = load_config()
    idir = interim_dir()
    metrics = compute(cfg, idir)
    out = idir / "metrics.json"
    out.write_text(json.dumps(metrics, indent=1, allow_nan=False), encoding="utf-8")
    print(f"Wrote {out}")
    report = build_report(metrics, REPO_ROOT / "data" / "crosscheck", REPO_ROOT / "data" / "validation_notes.yaml")
    report_path = REPO_ROOT / "docs" / "validation.md"
    report_path.write_text(report, encoding="utf-8")
    status = next(line for line in report.splitlines() if line.startswith("**Open items"))
    print(f"Wrote {report_path}: {status.replace('**', '')}")
```

- [ ] **Step 8: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_metrics_step.py tests/test_validation.py -v`
Expected: `28 passed`.

- [ ] **Step 9: Create the notes file**

Maak `data/validation_notes.yaml`:

```yaml
# Explanations for exceedances in docs/validation.md, written by hand.
# Layout: state postal code, then check name, then the explanation in plain English.
# Check names: cd118_vs_alarm, whole_unit, plans, planscore_reproduction, planscore, dra, state_files.
# Name the numbers and the source. No em dashes.
#
# Made-up example of the layout:
# XX:
#   cd118_vs_alarm: >
#     District 03 differs by 0.62 points. ALARM assigns each split VTD whole to one
#     district; we split its votes over blocks by voting-age population.
```

- [ ] **Step 10: Run 03_metrics and look at the report**

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: als in Taak 2.11, plus als laatste regel `Wrote ...\docs\validation.md: Open items: N. Pending: 3.` De drie wachtende punten zijn de drie kruiscontrolebestanden. Open `docs/validation.md` en kijk of alle onderdelen er staan. Verklaren gebeurt in Taak 2.15; commit het rapport nog niet.

- [ ] **Step 11: Run the whole suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 12: Commit**

```powershell
git add pipeline/gerry/validation.py pipeline/03_metrics.py tests/test_validation.py tests/test_metrics_step.py data/validation_notes.yaml
git commit -m "Add validation report and wire it into 03_metrics"
```

### Task 2.13: kruiscontrole met PlanScore

**Files:**
- Create: `data/crosscheck/planscore.csv`, `tests/test_planscore_crosscheck.py`
- Modify: `data/validation_notes.yaml`

**Interfaces:**
- Consumes: `read_crosscheck`, `planscore_comparison`, `PLANSCORE_COLUMNS` uit Taak 2.12; `REPO_ROOT` uit `gerry.config`.
- Produces: `data/crosscheck/planscore.csv` met minstens drie staten (formaat in Taak 2.12); de PlanScore-tabel in `docs/validation.md`; een `planscore`-verklaring per staat in `data/validation_notes.yaml`.

Wat we vooraf weten (gecontroleerd op 5 oktober 2026):

- Tekenconventie. De site van PlanScore toont de EG als grootte plus partij, op een schaal van "+% D" via "Balanced" naar "+% R". De code van PlanScore (`planscore/score.py`, `calculate_EG`) geeft een getal dat positief is als de kaart gunstig is voor Democraten ("positive for blue"). Onze EG is positief als de kaart gunstig is voor Republikeinen. Dus: onze EG = min de EG uit hun code. In de CSV leggen we daarom alleen de grootte en de genoemde partij vast (`planscore_eg_pct`, `planscore_favors`); `planscore_comparison` maakt daar ons teken van. Zie je bij PlanScore alleen een getal met teken, dan is `planscore_favors` `Democrats` bij een positief en `Republicans` bij een negatief getal. Voor MM geldt hetzelfde: PlanScore rekent mediaan min gemiddelde, positief gunstig voor Democraten; onze MM is gemiddelde min mediaan.
- Formule. `calculate_EG` rekent nu met de vorm voor gelijke opkomst: (S - 0,5) - 2 (V - 0,5), met S het aandeel gewonnen districten en V het stemmenaandeel over de hele staat, na het klemmen van V op 0,25 tot 0,75. Onze `efficiency_gap` telt verspilde stemmen per district zoals de spec voorschrijft. Bij ongelijke opkomst per district verschillen de twee. Het rapport toont daarom ook de kolom "Equal-turnout formula" (`equal_turnout_gap`).
- Bronnen. De staatpagina's van PlanScore laden hun gegevens met JavaScript, en de plannen in de bibliotheek (`https://planscore.org/library/<staat>/`) zijn gescoord met een voorspellend model, niet met werkelijke uitslagen. Een pagina met werkelijke House-uitslagen en stemmen per district hebben we nog niet gevonden.

- [ ] **Step 1: Write the failing test**

Maak `tests/test_planscore_crosscheck.py`:

```python
"""PlanScore cross-check (spec chapter 6): our efficiency_gap on PlanScore's own district
votes must give PlanScore's printed EG, to the rounding of the printed value.
Reads data/crosscheck/planscore.csv, which is in git. Skipped until Task 2.13 has made
the file; Task 4.4 checks that these tests run."""
import pytest

from gerry.config import REPO_ROOT
from gerry.validation import PLANSCORE_COLUMNS, planscore_comparison, read_crosscheck

PLANSCORE = REPO_ROOT / "data" / "crosscheck" / "planscore.csv"
pytestmark = pytest.mark.skipif(not PLANSCORE.exists(),
                                reason="data/crosscheck/planscore.csv does not exist yet; Task 2.13 makes it")


@pytest.fixture(scope="module")
def rows():
    return planscore_comparison(read_crosscheck(PLANSCORE, PLANSCORE_COLUMNS))


def test_at_least_three_states(rows):
    assert len({r["state"] for r in rows}) >= 3


def test_efficiency_gap_reproduces_planscore(rows):
    misses = [(r["state"], r["election"], round(100 * r["planscore"], 2), round(100 * r["reproduced"], 3),
               round(100 * r["equal_turnout"], 3))
              for r in rows if abs(r["reproduced"] - r["planscore"]) > r["tolerance"] + 1e-12]
    # each miss: state, election, PlanScore, ours, equal-turnout formula (points)
    assert misses == []
```

- [ ] **Step 2: Run the test (it skips until the CSV exists)**

Run: `.venv\Scripts\python -m pytest tests/test_planscore_crosscheck.py -v -rs`
Expected: `2 skipped`, met als reden `data/crosscheck/planscore.csv does not exist yet; Task 2.13 makes it`. De tests slaan over zolang het bestand ontbreekt, zodat de stappen "alle tests slagen" vóór deze taak niet vastlopen. Task 4.4 controleert dat het bestand bestaat en dat de tests echt draaien.

- [ ] **Step 3: Find PlanScore pages with actual results**

Zoek op planscore.org naar pagina's met werkelijke uitslagen van het Huis, waar per district de Democratische en Republikeinse stemmen staan naast de EG van die verkiezing. Open de pagina in een browser, want de inhoud verschijnt pas na het laden van JavaScript. Bied de pagina een download aan (tab-gescheiden tekst), gebruik die.

Kies minstens drie staten waarvoor geldt:

1. De kaart van die verkiezing is onze Enacted-kaart (`same_map` = `yes`). Dat zijn staten zonder nieuwe kaart sinds november 2024 in `data/sources.md`, bijvoorbeeld AZ, IA, MI, NV, PA en WI.
2. In elk district stonden een Democraat en een Republikein op het stembiljet. Bij een district zonder tegenkandidaat vult PlanScore stemmen in, en dan volgt hun EG niet meer direct uit de getoonde stemmen.

Stop en vraag de eigenaar als een van deze situaties zich voordoet. Kies dan zelf geen andere bron.

- PlanScore heeft geen pagina met werkelijke uitslagen en stemmen per district, alleen modelvoorspellingen.
- Minder dan drie staten voldoen aan beide eisen.

Leg de eigenaar bij elk stoppunt in deze taak (hier en in Step 5) deze twee opties voor, met de pagina's die je vond:

- (a) Aanbevolen. Neem voor minstens drie staten met onze Enacted-kaart de districtsstemmen over die PlanScore toont, ook als ze uit hun model komen, en reproduceer hun gedrukte EG met hun eigen formule voor gelijke opkomst (`equal_turnout_gap`). Dat toont dat we hun invoer goed overnemen. Onze `efficiency_gap` (verspilde stemmen, hoofdstuk 5 van de spec) blijft de maat op de site. Het verschil tussen de EG van PlanScore en onze EG op de composiet voor dezelfde kaart verklaren we met getallen in `data/validation_notes.yaml`; het klaar-criterium staat een verklaard verschil toe.
- (b) De eigenaar noemt een andere bron met een EG en stemmen per district.

Wacht op het besluit. Bij (b) volg je Step 4 tot en met 8 met de bron van de eigenaar. Bij (a) pas je eerst de reproductiecontrole aan, met TDD:

1. `tests/test_planscore_crosscheck.py`, `test_efficiency_gap_reproduces_planscore`: vergelijk `r["equal_turnout"]` in plaats van `r["reproduced"]` met `r["planscore"]`, en pas de docstring van de module aan: PlanScore's gedrukte EG moet uit hun eigen districtsstemmen volgen met hun formule voor gelijke opkomst.
2. `tests/test_validation.py`, `test_failed_reproduction_is_open`: de verwachte regel wordt `- AA planscore_reproduction: PlanScore +5.00, equal-turnout formula +6.67`. Draai `.venv\Scripts\python -m pytest tests/test_validation.py -v` en zie precies die test falen.
3. `pipeline/gerry/validation.py`, functie `_planscore`: `repro_ok` en de tekst van `ledger.judge` gebruiken `c["equal_turnout"]` en de woorden `equal-turnout formula` in plaats van `c["reproduced"]` en `ours`. De zin boven de tabel noemt "Equal-turnout formula" als de kolom die op afronding na gelijk moet zijn aan PlanScore.
4. Draai `.venv\Scripts\python -m pytest tests/test_validation.py -v`. Expected: `15 passed`.
5. Pas de zin over PlanScore in hoofdstuk 6 van de spec aan het besluit aan. Commit spec, code en tests samen: `git add docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md pipeline/gerry/validation.py tests/test_validation.py tests/test_planscore_crosscheck.py`, dan `git commit -m "Reproduce PlanScore's EG with its equal-turnout formula"`.

Ga daarna verder met Step 4. In de kolom `election` komt dan de naam die PlanScore boven de cijfers zet.

- [ ] **Step 4: Record the data**

Maak `data/crosscheck/planscore.csv` met de kopregel en één regel per district, in het formaat uit Taak 2.12. Neem `planscore_eg_pct` over met precies de decimalen die PlanScore toont. Voorbeeld van de vorm, met een verzonnen staat XX en verzonnen getallen:

```csv
state,election,url,accessed,same_map,planscore_eg_pct,planscore_favors,district,dem_votes,rep_votes
XX,2024 U.S. House,https://planscore.org/...,2026-10-12,yes,4.2,Democrats,01,180000,150000
XX,2024 U.S. House,https://planscore.org/...,2026-10-12,yes,4.2,Democrats,02,140000,220000
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_planscore_crosscheck.py -v`
Expected: `2 passed`.

Faalt `test_efficiency_gap_reproduces_planscore`, kijk dan naar de laatste waarde in elke regel van de foutmelding: de uitkomst van de formule voor gelijke opkomst. Komt die wel overeen met PlanScore, dan gebruikt PlanScore op die pagina de andere formule. Stop en leg de eigenaar de opties (a) en (b) uit Step 3 voor. Pas `efficiency_gap` en de test niet zelf aan. Komt geen van beide overeen, controleer dan de ingevoerde stemmen en het teken; blijft het verschil, stop en leg de eigenaar dezelfde opties voor.

- [ ] **Step 6: Compare with our composite and explain**

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: in `docs/validation.md`, sectie "PlanScore", staat per staat `ok` in de kolom "Reproduced" en `open` in de kolom "Composite". Schrijf per staat een verklaring onder `planscore` in `data/validation_notes.yaml`. Noem de twee getallen en de oorzaken die je kunt aanwijzen: andere stembasis (House 2024 tegenover president 2016 plus 2020), kandidaten die zittend zijn, en zo nodig de formule. Voorbeeld van de vorm, met een verzonnen staat XX en verzonnen getallen:

```yaml
XX:
  planscore: >
    PlanScore gives 4.2 points in favor of Democrats for the 2024 House vote; our
    composite gives 9.6 points in favor of Democrats. PlanScore uses House votes with
    incumbents on the ballot; we use the 2016 and 2020 presidential vote.
```

Draai `03_metrics.py` opnieuw. Expected: de kolom "Composite" toont `explained` voor elke PlanScore-staat.

- [ ] **Step 7: Run the whole suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add data/crosscheck/planscore.csv tests/test_planscore_crosscheck.py data/validation_notes.yaml
git commit -m "Add PlanScore cross-check"
```

### Task 2.14: kruiscontrole met Dave's Redistricting App

**Files:**
- Create: `data/crosscheck/dra.csv`, `tests/test_dra_crosscheck.py`
- Modify: `data/validation_notes.yaml` (alleen bij overschrijdingen)

**Interfaces:**
- Consumes: `read_crosscheck`, `DRA_COLUMNS` uit Taak 2.12; `load_config`, `REPO_ROOT` uit `gerry.config`; `checks.pre_20` in `metrics.json` (Taak 2.11).
- Produces: `data/crosscheck/dra.csv` (formaat in Taak 2.12) voor minstens vijf staten; de DRA-tabel in `docs/validation.md`.

Welke staten, en waarom. Elk van deze zes test een ander deel van de pijplijn. Neem er minstens vijf.

| Staat | Kaart (zoals in `data/sources.md`) | Wat het test |
|---|---|---|
| NC | SL 2025-95 (SB 249) | Hertekening in 2025 waarin alleen districten 1 en 3 veranderden; CD120 voor een gedeeltelijke wijziging |
| TX | PLANC2333 (HB 4) | 38 districten en veel gesplitste VTD's; in de haalbaarheidscontrole tot 0,57 punt verschil tussen blokverdeling en hele eenheden (TX-11) |
| OH | Ohio Redistricting Commission plan (2025) | Nieuwe kaart die niet in de haalbaarheidscontrole zat |
| FL | EOGPCRP2026 (HB 1-D) | Eenheden zonder VAP maar met stemmen, verdeeld naar aantal blokken: op deze kaart 7 gesplitste eenheden met samen 3.576 stemmen (taak 1.18) |
| CA | AB 604 (Proposition 50) | Tracts als eenheid, stemmen uit ALARM's `map.rds`, binnen een tract verdeeld naar de blokstemmen van census-vest |
| MO | HB 2909 of 2022 | De kaart van 2022 uit CD118, niet HB 1 uit CD120 |

DRA gebruikt voor 2020 VEST-uitslagen per precinct, met een eigen verdeling over blokken. Onze stemmen komen uit ALARM's `map.rds`, per VTD, tract of county (spec hoofdstuk 3). Kleine verschillen zijn dus te verwachten; de drempel is 0,5 procentpunt per district.

- [ ] **Step 1: Write the failing test**

Maak `tests/test_dra_crosscheck.py`:

```python
"""DRA cross-check (spec chapter 6): data/crosscheck/dra.csv covers at least five states,
every district of each current map, one map and one access date per state.
Skipped until Task 2.14 has made the file; Task 4.4 checks that this test runs."""
import pandas as pd
import pytest

from gerry.config import REPO_ROOT, load_config
from gerry.validation import DRA_COLUMNS, read_crosscheck

DRA = REPO_ROOT / "data" / "crosscheck" / "dra.csv"
pytestmark = pytest.mark.skipif(not DRA.exists(),
                                reason="data/crosscheck/dra.csv does not exist yet; Task 2.14 makes it")


def test_dra_csv_covers_whole_maps():
    df = read_crosscheck(DRA, DRA_COLUMNS)
    cfg = load_config()
    states = sorted(df["state"].unique())
    assert len(states) >= 5
    for postal in states:
        sub = df[df["state"] == postal]
        expected = [f"{i:02d}" for i in range(1, cfg.states[postal].seats + 1)]
        assert sorted(sub["district"]) == expected, postal
        assert sub["map_name"].nunique() == 1, postal
        assert sub["accessed"].nunique() == 1, postal
        pd.to_datetime(sub["accessed"], format="%Y-%m-%d")
        assert (sub["dem"].astype(float) > 0).all() and (sub["rep"].astype(float) > 0).all(), postal
```

- [ ] **Step 2: Run the test (it skips until the CSV exists)**

Run: `.venv\Scripts\python -m pytest tests/test_dra_crosscheck.py -v -rs`
Expected: `1 skipped`, met als reden `data/crosscheck/dra.csv does not exist yet; Task 2.14 makes it`. Task 4.4 controleert dat het bestand bestaat en dat de test echt draait.

- [ ] **Step 3: Collect the numbers from DRA**

Per staat:

1. Open davesredistricting.org en zoek de officiële kaart van de staat (DRA publiceert vastgestelde kaarten als "Official"). Controleer dat het dezelfde kaart is: zelfde aantal districten, en naam of datum passend bij de kaartnaam in `data/sources.md`. Voor Missouri is dat de kaart van 2022, niet HB 1.
2. Kies in de statistieken de verkiezing "2020 President", niet de composiet van DRA.
3. Neem per district de Democratische en Republikeinse waarde over, of exporteer de districtsgegevens als CSV als DRA dat aanbiedt.
4. Noteer de URL van de kaart en de datum.

Vraagt DRA om in te loggen, stop dan en vraag de eigenaar om de cijfers te exporteren. Maak geen account aan en log niet in.

- [ ] **Step 4: Record the data**

Maak `data/crosscheck/dra.csv` met de kopregel en één regel per district, in het formaat uit Taak 2.12. Voorbeeld van de vorm, met een verzonnen staat XX en verzonnen getallen:

```csv
state,map_name,url,accessed,district,dem,rep
XX,Example Map 1,https://davesredistricting.org/...,2026-10-12,01,58.10,41.90
XX,Example Map 1,https://davesredistricting.org/...,2026-10-12,02,44.75,55.25
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_dra_crosscheck.py -v`
Expected: `1 passed`.

- [ ] **Step 6: Compare with our numbers**

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: in `docs/validation.md`, sectie "Dave's Redistricting App", één regel per staat met "Districts" `n of n`. Staat een staat op `open`, kijk dan in de tabel "Districts above the threshold" en zoek de oorzaak: hetzelfde district bij een andere kaartversie, een fout bij het overnemen, of een district met veel gesplitste eenheden (vergelijk met de sectie "Whole-unit assignment"). Is de oorzaak aangetoond, schrijf dan een verklaring onder `dra` in `data/validation_notes.yaml`, met de getallen. Is ze niet duidelijk, stop en vraag de eigenaar.

- [ ] **Step 7: Run the whole suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add data/crosscheck/dra.csv tests/test_dra_crosscheck.py data/validation_notes.yaml
git commit -m "Add DRA cross-check"
```

### Task 2.15: volledige run en verklaringen

**Files:**
- Modify: `data/validation_notes.yaml`
- Create (gegenereerd): `docs/validation.md`

**Interfaces:**
- Consumes: alles uit Taken 2.11 tot en met 2.14; `data/interim/` van `02_join.py` voor alle 44 staten.
- Produces: `docs/validation.md` zonder open punten, in git. Eén punt blijft "pending": `data/crosscheck/state_files.csv`, dat Fase 3 maakt met `tools/compare_state_files.py`. Taak 3.6 draait daarna `03_metrics.py` opnieuw en commit het rapport met `Pending: 0.`

- [ ] **Step 1: Run the pipeline step**

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: 44 staatsregels, een regel `US: ...`, en als laatste `Wrote ...\docs\validation.md: Open items: N. Pending: 1.` N is minstens 1, want Tennessee overschrijdt in `cd118_vs_alarm` de drempel (stap 3).

- [ ] **Step 2: Run all tests**

Run: `.venv\Scripts\python -m pytest -v`, daarna `.venv\Scripts\python -m pytest -m data -v`
Expected: alle tests slagen.

- [ ] **Step 3: Explain every open item**

Lees `docs/validation.md` van boven naar beneden. Werk de lijst onder "Open items" af. Per soort:

- `cd118_vs_alarm`: kijk in "Districts above the threshold" welke districten afwijken. Gangbare oorzaak tot 0,4 punt: ALARM wijst gesplitste eenheden in hun geheel toe (CA, TX). Boven 0,5 punt of bij een ander aantal zetels: controleer of ALARM's `cd_2020` dezelfde kaart is als CD118 (lees `XX_cd_2020_doc.html` van ALARM; in een paar staten veranderde de kaart in de loop van 2022). Schrijf de verklaring alleen op als de oorzaak is aangetoond, met getallen en bron.

  Verwacht: alleen Tennessee staat hier open, met district 09 op 0,699 punt (0,6989 procentpunt) en hetzelfde aantal zetels (taak 1.18, stap 6; spec hoofdstuk 6). De vergelijking is CD118 tegen ALARM's `cd_2020`. De oorzaak is aangetoond: ALARM's referentiekaart wijst hele VTD's toe, terwijl CD118 rond Memphis 21 VTD's splitst. Ook een verdeling naar bevolking in plaats van VAP blijft boven de drempel. Komen de getallen overeen, zet dan deze verklaring in `data/validation_notes.yaml`:

  ```yaml
  TN:
    cd118_vs_alarm: >
      District 09 differs by 0.699 points, with the same number of Democratic seats.
      ALARM's reference plan cd_2020 assigns every VTD whole to one district, while the
      2022 map (Census CD118) splits 21 VTDs around Memphis. Spreading the votes of those
      VTDs by population instead of voting-age population also stays above 0.5 points.
      Source: our join of ALARM's TN_cd_2020_map.rds with Census CD118.
  ```

  Staat er een andere staat boven de drempel, of wijkt Tennessee af van deze getallen, schrijf dan niets op en vraag de eigenaar.
- `whole_unit`: hoofdstuk 6 van de spec vraagt voor elk district met een andere winnaar een verklaring; tot die er is, blijft het punt open. Zo'n district ligt dicht bij 50%. Zoek de aandelen op:

  ```powershell
  .venv\Scripts\python -c "import json; m = json.load(open('data/interim/metrics.json', encoding='utf-8')); [print(st, w['map_id'], w['district'], round(100 * w['block'], 3), round(100 * w['whole'], 3)) for st, ws in m['checks']['whole_unit'].items() for w in ws if w['block_dem'] != w['whole_dem']]"
  ```

  Elke regel geeft staat, kaart, district en het Democratische aandeel in procenten, eerst met blokverdeling, dan met hele eenheden. Een verklaring hoort bij één staat en de sleutel `whole_unit`; heeft een staat meer districten met een andere winnaar, ook op `mo_hb1`, noem ze dan allemaal in die ene tekst. Noem per district de kaart, beide aandelen en het aantal gesplitste eenheden op die kaart (sectie "Join log", tabel "Counts per map"), en zeg dat Enacted de blokverdeling gebruikt (hoofdstuk 2 en 4 van de spec). Voorbeeld van de vorm, met een verzonnen staat XX en verzonnen getallen:

  ```yaml
  XX:
    whole_unit: >
      On the enacted map, district 03 is 50.08% Democratic with block allocation and
      49.96% with whole units. Twelve units are split between districts on this map.
      Enacted uses block allocation, so district 03 counts as a Democratic seat.
  ```
- `plans`: hoort niet voor te komen, want `02_join.py` controleert het aantal plannen. Stop en zoek de oorzaak met systematic-debugging.
- `planscore_reproduction`, `planscore`, `dra`: zie Taken 2.13 en 2.14.

Geen open punt, wel om te controleren: de sectie "Join log" noemt `unlinked_blocks` alleen bij ME (112 blokken in 6 tracts), MI (631 blokken in 38 VTD's) en OH (63 blokken in 4 VTD's). Dat is water dat ALARM niet in `map.rds` opnam; `check_vap_pop` heeft in `02_join.py` al gecontroleerd dat die blokken geen VAP en geen bevolking hebben (spec hoofdstuk 6 en 10). Ze hebben geen verklaring nodig. Onder de tabellen van die sectie staat alleen OR met nieuwe labels voor ALARM's referentiekaart (taak 1.17). Wijkt een van beide af, stop dan en vraag de eigenaar.

Is een oorzaak niet duidelijk, schrijf dan geen verklaring. Stop en vraag de eigenaar.

Haal de tekst van de verklaringen door de unslop-skill: Engels, direct, geen em-dashes.

- [ ] **Step 4: Run again**

Run:

```powershell
$env:PYTHONUTF8=1
.venv\Scripts\python pipeline/03_metrics.py
```

Expected: `Wrote ...\docs\validation.md: Open items: 0. Pending: 1.` Kijk ook onder "Explanations without an exceedance": daar hoort "None." te staan. Staat er een verklaring, verwijder die of verbeter de staat of sleutel.

- [ ] **Step 5: Check for em dashes**

Run: `Select-String -Path data/validation_notes.yaml, docs/validation.md -Pattern ([char]0x2014)`
Expected: geen uitvoer.

- [ ] **Step 6: Commit**

```powershell
git add docs/validation.md data/validation_notes.yaml
git commit -m "Explain all exceedances in the validation report"
```

## Phase 3: export en vergelijking met bestanden van staten

Deze fase maakt de twee bestanden voor de site (`site/data/results.json` en `site/data/map.topojson`), controleert dat geometrie en blokbestanden dezelfde kaart beschrijven, en vergelijkt CD120 eenmalig met de bestanden van vijf staten.

Vooraf nodig:

- Fase 0: `.venv` met geopandas, pyogrio, pyyaml en openpyxl (taak 0.1); `npm install` gedaan, zodat `node_modules/mapshaper` bestaat (taak 0.2); `pytest.ini` met de marker `data`; `gerry.config` (taak 0.4); `gerry.checks.CheckError` en `gerry.checks.check_sources_md` (taak 0.5).
- Fase 1: `gerry.blocks.read_pl_blocks` en `gerry.blocks.read_bef` (taak 1.7); de downloads in de datamap (taak 1.3).
- Fase 2: `data/interim/metrics.json` (taak 2.11, voor het draaien van `04_export` in taak 3.5); `gerry.validation.STATE_FILES_COLUMNS` en het controlerapport van `03_metrics.py` (taak 2.12, voor taak 3.6); `data/crosscheck/planscore.csv` en `dra.csv` (taak 2.13 en 2.14).

Gecontroleerd in een sandbox op 5 oktober 2026, met de echte bestanden:

- De laag in de TIGER-GeoPackage heet `Congressional Districts`, met een spatie. De spec en `docs/research/boundary-sources.md` noemen hem ook zo. De laag heeft 444 objecten: 435 districten, zes keer `98` (DC, PR, AS, GU, MP, VI) en `ZZ` in CT, IL en NH. Het geometrietype is "Measured 3D MultiPolygon"; pyogrio laat de M-waarden vallen en geeft daarover een waarschuwing. CRS EPSG:4269, ongeveer 4,1 miljoen punten.
- `tl_2025_29_cd119` heeft de velden `STATEFP` en `CD119FP` en 8 districten. De buitengrens van Missouri is in TIGER 2025 en 2026 precies gelijk (Hausdorff-afstand 0 m), dus de grens met de buurstaten sluit aan.
- Met mapshaper 0.7.77 en `simplify 3%` is `map.topojson` 683.120 bytes (1%: 285.424, 2%: 485.336, 4%: 879.376).
- `check_geometry` op echte bestanden: NV 100,0000%, MO (CD118 tegen `tl_2025_29_cd119`) 99,9941%, UT 99,9958%, CA 99,9975%.

### Task 3.1: noot-teksten en resolve_notes

**Files:**
- Create: `pipeline/gerry/export.py`
- Create: `tests/test_export.py`

**Interfaces:**
- Consumes: uit `gerry.config` (taak 0.4): `Config`, `EnsembleConfig`, `StateConfig`, `ExtraMap`, `AtLargeState`, `ConfigError`, `ENSEMBLE_NOTE_KEYS`, `STATE_NOTE_KEYS`, `COMPUTED_NOTE_KEYS`, `REPO_ROOT`, `load_config()`. De notentabel en de tabel met invulwaarden in hoofdstuk 5 van de spec.
- Produces: `NOTE_TEXTS: dict[str, str]`, sleutels gelijk aan alle drie de sleuteltuples. `resolve_notes(postal: str, cfg: Config, computed: Sequence[str]) -> list[dict]`, met `[{"key": str, "text": str}]` in de volgorde ensemble, staat, berekend; vult `{reference_map}` en `{consequence}` uit `cfg.ensemble.fill[postal]`; geeft `ConfigError` bij een onbekende sleutel of een ontbrekende invulwaarde.

De teksten zijn letterlijk die uit de spec. Een test vergelijkt `NOTE_TEXTS` met de spectabel, zodat een tekstwijziging altijd op beide plekken gebeurt. Een tweede test vergelijkt de staatslijsten in `config.yaml` met de kolom "Staten" van die tabel. Die test zegt niets over ALARM zelf. De spec vraagt ook dat de bouw van `export.py` de staatslijsten en drempels per staat opnieuw controleert in de code van ALARM; dat doet stap 5. Stap 6 haalt de teksten door de unslop-skill.

- [ ] **Step 1: Write the failing test**

`tests/test_export.py`:

```python
from datetime import date

import pytest

from gerry.config import (
    COMPUTED_NOTE_KEYS, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, AtLargeState, Config,
    ConfigError, EnsembleConfig, ExtraMap, StateConfig, load_config,
)
from gerry.export import NOTE_TEXTS, resolve_notes

SPEC = REPO_ROOT / "docs" / "superpowers" / "specs" / "2026-10-05-gerrymandering-map-design.md"

HB1 = ExtraMap(id="mo_hb1", name="HB 1 of 2025", status="Blocked", bef="cd120",
               source_label="Redistricting Data Hub (Missouri House)",
               source_url="https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/")


def state(postal, name, fips, seats, notes=(), extra_maps=()):
    return StateConfig(
        postal=postal, name=name, fips=fips, seats=seats, map_name=f"{name} map", status="In effect",
        source_label=f"{name} source", source_url=f"https://example.org/{postal.lower()}", bef="cd120",
        elections=("pre_16", "pre_20"), unit_kind="vtd", extra_maps=tuple(extra_maps), notes=tuple(notes),
    )


def toy_config(states, ens_notes=None, fill=None):
    """A small hand-made Config. Seat counts are made small on purpose."""
    return Config(
        status_checked=date(2026, 10, 3),
        census_vest_commit="243c8a8134ecf8151777a9388c48323e274767e2",
        ensemble=EnsembleConfig(name="alarm_v15", doi="doi:10.7910/DVN/SLCD3E", version=15,
                                notes=ens_notes or {}, fill=fill or {}),
        sources={},
        states={s.postal: s for s in states},
        at_large={"DE": AtLargeState(postal="DE", name="Delaware", fips="10"),
                  "AK": AtLargeState(postal="AK", name="Alaska", fips="02")},
    )


def table_after(marker):
    """Rows (header and separator dropped) of the first Markdown table after the line starting with marker."""
    lines = SPEC.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith(marker))
    rows, in_table = [], False
    for line in lines[start + 1:]:
        if line.startswith("|"):
            in_table = True
            rows.append([cell.strip() for cell in line.strip().strip("|").split("|")])
        elif in_table:
            break
    return rows[2:]


def test_note_texts_cover_every_note_key():
    assert set(NOTE_TEXTS) == set(ENSEMBLE_NOTE_KEYS + STATE_NOTE_KEYS + COMPUTED_NOTE_KEYS)


def test_note_texts_match_the_spec_table():
    spec = {row[0].strip("`"): row[3] for row in table_after("### Noten")}
    assert NOTE_TEXTS == spec


def test_note_texts_have_no_dashes_used_as_punctuation():
    for key, text in NOTE_TEXTS.items():
        assert "\u2014" not in text and "\u2013" not in text, key


def test_resolve_notes_orders_ensemble_then_state_then_computed():
    cfg = toy_config([state("MO", "Missouri", "29", 2, notes=["blocked_map"], extra_maps=[HB1])],
                     ens_notes={"MO": ("vra_constraint", "vra_filter_bvap")})
    notes = resolve_notes("MO", cfg, ["narrow_ensemble"])
    assert [n["key"] for n in notes] == ["vra_constraint", "vra_filter_bvap", "blocked_map", "narrow_ensemble"]
    assert notes[2]["text"] == NOTE_TEXTS["blocked_map"]


def test_resolve_notes_fills_reference_map_and_consequence():
    cfg = toy_config([state("NM", "New Mexico", "35", 3)],
                     ens_notes={"NM": ("core_preservation_prior_map",)},
                     fill={"NM": {"reference_map": "the 2021 map",
                                  "consequence": "The current map is that 2021 map."}})
    notes = resolve_notes("NM", cfg, [])
    assert notes == [{
        "key": "core_preservation_prior_map",
        "text": "ALARM's neutral maps for this state keep the core of each district in the 2021 map. "
                "So they look more like that map than neutral maps drawn without this rule would. "
                "The current map is that 2021 map.",
    }]


def test_resolve_notes_without_notes_is_empty():
    cfg = toy_config([state("HI", "Hawaii", "15", 2)])
    assert resolve_notes("HI", cfg, []) == []


def test_resolve_notes_stops_on_missing_fill_value():
    cfg = toy_config([state("NM", "New Mexico", "35", 3)],
                     ens_notes={"NM": ("core_preservation_prior_map",)},
                     fill={"NM": {"reference_map": "the 2021 map"}})
    with pytest.raises(ConfigError, match="NM.*consequence"):
        resolve_notes("NM", cfg, [])


def test_resolve_notes_stops_on_unknown_key():
    cfg = toy_config([state("HI", "Hawaii", "15", 2)])
    with pytest.raises(ConfigError, match="HI.*no_such_note"):
        resolve_notes("HI", cfg, ["no_such_note"])


def test_repo_config_note_lists_match_the_spec():
    cfg = load_config()
    if cfg.ensemble.name != "alarm_v15":
        pytest.skip("the note lists in the spec describe alarm_v15")
    for key, _, states, _ in table_after("### Noten"):
        key = key.strip("`")
        if key in COMPUTED_NOTE_KEYS:
            continue
        if key in ENSEMBLE_NOTE_KEYS:
            actual = {st for st, keys in cfg.ensemble.notes.items() if key in keys}
        else:
            actual = {st for st, s in cfg.states.items() if key in s.notes}
        assert actual == set(states.split(", ")), key
    fill = {row[0]: {"reference_map": row[1], "consequence": row[2]} for row in table_after("Invulwaarden voor")}
    assert cfg.ensemble.fill == fill
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'gerry.export'`.

- [ ] **Step 3: Write minimal implementation**

`pipeline/gerry/export.py`:

```python
"""Note texts and the contents of site/data/results.json."""
from __future__ import annotations

from collections.abc import Sequence

from gerry.config import Config, ConfigError

# English note texts, identical to the notes table in chapter 5 of the spec.
# Change a text in both places; tests/test_export.py compares them.
NOTE_TEXTS: dict[str, str] = {
    "vra_constraint": (
        "ALARM's neutral maps for this state aim for about as many districts with a large minority share "
        "of voting-age adults as the 2022 map had. This follows the Voting Rights Act as courts applied it "
        "before Louisiana v. Callais (April 2026). The law can require such districts. In seat counts they "
        "can look like packing, which means putting many voters of one party into a few districts."
    ),
    "core_preservation_prior_map": (
        "ALARM's neutral maps for this state keep the core of each district in {reference_map}. So they "
        "look more like that map than neutral maps drawn without this rule would. {consequence}"
    ),
    "core_preservation_2010": (
        "ALARM's neutral maps for this state keep the core of each district drawn after the 2010 census."
    ),
    "competitiveness_rule": (
        "This state's redistricting rules call for competitive districts, so ALARM's neutral maps for this "
        "state favor them. Measuring competitiveness requires party vote data."
    ),
    "vra_filter_with_votes": (
        "ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps "
        "with at least one district where more than 30% of voting-age adults are Black and Democrats win a "
        "majority in ALARM's vote data."
    ),
    "vra_filter_bvap": (
        "ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps "
        "with at least one district where more than 30% of voting-age adults are Black."
    ),
    "alarm_rerun_unpublished": (
        "ALARM has rerun the simulations for this state because the version 15 run did not meet its current "
        "convergence check. The new run is not yet in ALARM's dataset on Harvard Dataverse. We use version 15 "
        "of that dataset (February 2026)."
    ),
    "alarm_method_update_pending": (
        "ALARM is preparing new simulations for this state with an updated method. They are not yet "
        "published. We use version 15 of ALARM's dataset (February 2026)."
    ),
    "narrow_ensemble": (
        "At least 95% of the neutral maps for this state give the same number of Democratic seats, so the "
        "neutral baseline has little or no spread."
    ),
    "adopted_after_2024_election": (
        "This map was adopted after the 2024 election, so the people who drew it could use 2024 results. "
        "Our vote basis is the 2016 and 2020 presidential elections and does not include 2024."
    ),
    "composite_2020_only": (
        "ALARM's data for this state has 2020 presidential results only, by county. All three numbers here "
        "use 2020 alone, not 2016 and 2020 combined."
    ),
    "blocked_map": (
        "The legislature adopted a new map in 2025 (HB 1). Courts have blocked it until voters decide on it. "
        "It is on the November 3, 2026 ballot as Proposition A. The November 2026 election uses the 2022 map."
    ),
}


def resolve_notes(postal: str, cfg: Config, computed: Sequence[str]) -> list[dict]:
    """Notes for one state as [{"key", "text"}]: ensemble notes, then state notes, then computed notes."""
    keys = [*cfg.ensemble.notes.get(postal, ()), *cfg.states[postal].notes, *computed]
    fill = cfg.ensemble.fill.get(postal, {})
    notes = []
    for key in keys:
        if key not in NOTE_TEXTS:
            raise ConfigError(f"{postal}: unknown note key {key!r}")
        try:
            text = NOTE_TEXTS[key].format_map(fill)
        except KeyError as err:
            raise ConfigError(
                f"{postal}: note {key!r} needs {err.args[0]!r} under ensemble.fill.{postal} in config.yaml"
            ) from None
        notes.append({"key": key, "text": text})
    return notes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -v`
Expected: `9 passed`.

Faalt alleen `test_repo_config_note_lists_match_the_spec`, dan wijkt `pipeline/config.yaml` af van de spectabel. Pas `config.yaml` aan, niet de test. Lijkt de spectabel zelf fout, stop dan en vraag het de eigenaar.

- [ ] **Step 5: Controleer de staatslijsten per staat in ALARM's code**

Geen nieuwe code. Bron: de repository `alarm-redist/fifty-states` op GitHub, map `analyses/{ST}_cd_2020/`, bestanden `02_setup_{ST}_cd_2020.R` en `03_sim_{ST}_cd_2020.R`. Lees ze in de browser of als ruwe tekst, bijvoorbeeld `https://raw.githubusercontent.com/alarm-redist/fifty-states/main/analyses/AL_cd_2020/03_sim_AL_cd_2020.R`. Loop alle 44 staten uit `config.yaml` langs, ook de staten zonder noot, en vink per staat af welke noten de code rechtvaardigt.

| Noot | Bestand | Waarop letten (gecontroleerd op AL, CO, KS, MO, NM op 5 oktober 2026) |
|---|---|---|
| `vra_constraint` | `03_sim` | `add_constr_grp_hinge` op een minderheidsgroep, bijvoorbeeld `add_constr_grp_hinge(21, vap_black, vap, 0.42)` in AL |
| `vra_filter_with_votes` | `03_sim` | een filter na de simulatie op zwarte VAP boven 0.3 én een Democratische meerderheid (`bvap > 0.3`, `ndshare > 0.5` in AL) |
| `vra_filter_bvap` | `03_sim` | een filter na de simulatie op zwarte VAP boven 0.3, zonder stemdata (`filter(vap_black > 0.3 \| draw == "cd_2020")` in MO) |
| `competitiveness_rule` | `03_sim` | `add_constr_compet` (CO: `add_constr_compet(30, ndv, nrv, pow = 1)`) |
| `core_preservation_prior_map` | `02_setup` | kernen uit de kaart van 2020-2022: `make_cores(boundary = 2)` met `existing_plan = cd_2020` in `redist_map(...)` (NM) |
| `core_preservation_2010` | `02_setup` | kernen uit de kaart van 2010: `redist.identify.cores(map$adj, map$cd_2010, boundary = 2)` (KS) |
| `alarm_rerun_unpublished` | geschiedenis van `analyses/{ST}_cd_2020/` | een nieuwe run na februari 2026 omdat v15 niet door de convergentiecontrole kwam, nog niet op Dataverse |
| `alarm_method_update_pending` | open pull requests | een nieuwe methode voor de staat in een pull request die nog open is |

Controleer ook de drempel van 30% in de teksten van `vra_filter_with_votes` en `vra_filter_bvap`. Texas gebruikt voor de VRA volgens `docs/research/alarm-50-state.md` het aandeel minderheden in de CVAP (staatsburgers van stemgerechtigde leeftijd), terwijl de tekst van `vra_constraint` "voting-age adults" zegt; noteer wat de code van TX doet.

Expected: elke staat heeft precies de noten die `config.yaml` en de spectabel noemen. Wijkt een staat af, of klopt een tekst niet voor een staat (zoals mogelijk TX), stop dan en leg de staat, het bestand en de regel code voor aan de eigenaar. Pas de spectabel, `config.yaml`, `NOTE_TEXTS` en de verwachte lijsten in `tests/test_config.py` (taak 0.4) alleen aan na zijn besluit, en dan allemaal tegelijk.

- [ ] **Step 6: Haal de noot-teksten door de unslop-skill**

Roep de unslop-skill aan op de twaalf teksten van `NOTE_TEXTS`, met de drie ingevulde varianten van `core_preservation_prior_map` (NM, LA, UT, invulwaarden uit `config.yaml`).

Expected: geen wijzigingen. Stelt de skill een andere tekst voor, leg die voor aan de eigenaar; de spec is goedgekeurd. Na zijn akkoord gaat de nieuwe tekst tegelijk in de notentabel van de spec en in `NOTE_TEXTS` (de test uit stap 1 dwingt dat af), daarna opnieuw stap 4.

- [ ] **Step 7: Commit**

Heeft de eigenaar in stap 5 of 6 een wijziging goedgekeurd, zet dan ook de gewijzigde spec, `pipeline/config.yaml` en `tests/test_config.py` in deze commit.

```bash
git add pipeline/gerry/export.py tests/test_export.py
git commit -m "Add note texts and resolve_notes"
```

### Task 3.2: build_results

**Files:**
- Modify: `pipeline/gerry/export.py` (importblok bovenaan, functies onderaan)
- Modify: `tests/test_export.py` (importblok bovenaan, tests onderaan)

**Interfaces:**
- Consumes: `CheckError(check, state, detail)` uit `gerry.checks` (taak 0.5), met de attributen `check`, `state` en `detail`. `metrics.json` uit taak 2.11, zoals onder "Bestanden tussen de stappen" in de plankop: `national` met minstens `seats`, `proportional`, `enacted`, `neutral`, `position`, `effects`, `outside_band` (een meegeschreven `single_seat` wordt genegeerd); per staat de numerieke velden van hoofdstuk 7 plus `computed_notes`; `districts[].d` en `.r` als onafgeronde kommagetallen; voor Missouri `blocked_map` met `enacted`, `districts`, `position`.
- Produces: `build_results(metrics: dict, cfg: Config, generated: str) -> dict`, precies de structuur van hoofdstuk 7. `meta.status_checked` en `meta.generated` als `"YYYY-MM-DD"`. Staten op postcode gesorteerd, districten op id, stemmen half-up afgerond op hele getallen. Constanten `NATIONAL_FIELDS` en `STATE_FIELDS`. `CheckError` met `check` = `export_states`, `export_seats`, `export_districts` of `export_blocked_map`.

`build_results` controleert alleen de onderlinge samenhang: dezelfde staten in `metrics.json` en `config.yaml`, landelijke zetels gelijk aan de som uit `config.yaml`, districts-id's `<fips>01` tot en met `<fips><seats>`. De controle op 435 zetels zit in `04_export` (taak 3.5), omdat de tests een kleine configuratie gebruiken.

- [ ] **Step 1: Write the failing test**

Vervang in `tests/test_export.py` het importblok bovenaan:

```python
from datetime import date

import pytest

from gerry.config import (
    COMPUTED_NOTE_KEYS, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, AtLargeState, Config,
    ConfigError, EnsembleConfig, ExtraMap, StateConfig, load_config,
)
from gerry.export import NOTE_TEXTS, resolve_notes
```

door:

```python
import json
from datetime import date

import pytest

from gerry.checks import CheckError
from gerry.config import (
    COMPUTED_NOTE_KEYS, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, AtLargeState, Config,
    ConfigError, EnsembleConfig, ExtraMap, StateConfig, load_config,
)
from gerry.export import NOTE_TEXTS, build_results, resolve_notes
```

Voeg onderaan `tests/test_export.py` toe:

```python


# --- build_results -------------------------------------------------------------------------------

def toy_state_metrics(fips, computed_notes=()):
    """Numeric fields for a 2-seat state, shaped like data/interim/metrics.json."""
    return {
        "d_share": 0.55,
        "proportional": 1,
        "enacted": 1,
        "neutral": {"median": 1, "p5": 1, "p95": 2, "dist": [0, 4000, 1000]},
        "position": {"fewer": 0.0, "equal": 0.8, "more": 0.2, "midrank": 0.4},
        "effects": {"geographic": 0, "drawing": 0},
        "outside_band": False,
        "eg": {"value": 0.031, "median": 0.02, "p5": -0.05, "p95": 0.09},
        "mm": None,
        "districts": [
            {"id": f"{fips}02", "share": 0.4, "d": 1000.5, "r": 1500.4999},
            {"id": f"{fips}01", "share": 0.7, "d": 2100.0, "r": 900.25},
        ],
        "sorted": {"enacted": [0.4, 0.7], "p5": [0.38, 0.6], "p50": [0.45, 0.65], "p95": [0.5, 0.71]},
        "computed_notes": list(computed_notes),
    }


def toy_metrics():
    mo = toy_state_metrics("29")
    mo["blocked_map"] = {
        "enacted": 0,
        "districts": [{"id": "2901", "share": 0.45, "d": 10.0, "r": 12.2},
                      {"id": "2902", "share": 0.48, "d": 20.0, "r": 21.7}],
        "position": {"fewer": 0.1, "equal": 0.3, "more": 0.6, "midrank": 0.25},
    }
    return {
        "national": {
            "seats": 4, "proportional": 2, "enacted": 2,
            "neutral": {"median": 2, "p5": 2, "p95": 3, "dist": [0.0, 0.0, 0.7, 0.3, 0.0]},
            "position": {"fewer": 0.0, "equal": 0.7, "more": 0.3, "midrank": 0.35},
            "effects": {"geographic": 0, "drawing": 0},
            "outside_band": False,
        },
        "states": {"HI": toy_state_metrics("15", ["narrow_ensemble"]), "MO": mo},
        "checks": {"anything": "not exported"},
    }


def toy_results_config():
    return toy_config(
        [state("HI", "Hawaii", "15", 2),
         state("MO", "Missouri", "29", 2, notes=["blocked_map"], extra_maps=[HB1])],
        ens_notes={"MO": ("vra_constraint",)},
    )


def test_build_results_meta():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    assert results["meta"] == {
        "generated": "2026-10-06",
        "ensemble": {"name": "alarm_v15", "doi": "doi:10.7910/DVN/SLCD3E", "version": 15},
        "census_vest_commit": "243c8a8134ecf8151777a9388c48323e274767e2",
        "vote_basis": ["pre_16", "pre_20"],
        "status_checked": "2026-10-03",
    }


def test_build_results_national_adds_single_seat_states_sorted_by_postal():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    national = results["national"]
    assert national["seats"] == 4
    assert national["neutral"]["dist"] == [0.0, 0.0, 0.7, 0.3, 0.0]
    assert national["single_seat"] == [{"postal": "AK", "fips": "02", "name": "Alaska"},
                                       {"postal": "DE", "fips": "10", "name": "Delaware"}]
    assert list(national) == ["seats", "proportional", "enacted", "neutral", "position", "effects",
                              "outside_band", "single_seat"]


def test_build_results_state_entry():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    m = toy_state_metrics("15")
    assert results["states"]["HI"] == {
        "name": "Hawaii", "fips": "15", "seats": 2, "map_name": "Hawaii map", "status": "In effect",
        "source": {"label": "Hawaii source", "url": "https://example.org/hi"},
        "notes": [{"key": "narrow_ensemble", "text": NOTE_TEXTS["narrow_ensemble"]}],
        "d_share": 0.55, "proportional": 1, "enacted": 1,
        "neutral": m["neutral"], "position": m["position"], "effects": m["effects"],
        "outside_band": False, "eg": m["eg"], "mm": None,
        # sorted by id, votes rounded half up: 1000.5 -> 1001, 1500.4999 -> 1500, 900.25 -> 900
        "districts": [{"id": "1501", "share": 0.7, "d": 2100, "r": 900},
                      {"id": "1502", "share": 0.4, "d": 1001, "r": 1500}],
        "sorted": m["sorted"],
    }
    assert "blocked_map" not in results["states"]["HI"]


def test_build_results_blocked_map_for_missouri():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    mo = results["states"]["MO"]
    assert [n["key"] for n in mo["notes"]] == ["vra_constraint", "blocked_map"]
    assert mo["blocked_map"] == {
        "name": "HB 1 of 2025", "status": "Blocked",
        "source": {"label": "Redistricting Data Hub (Missouri House)",
                   "url": "https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/"},
        "enacted": 0,
        "districts": [{"id": "2901", "share": 0.45, "d": 10, "r": 12},
                      {"id": "2902", "share": 0.48, "d": 20, "r": 22}],
        "position": {"fewer": 0.1, "equal": 0.3, "more": 0.6, "midrank": 0.25},
    }


def test_build_results_is_valid_json_without_nan():
    results = build_results(toy_metrics(), toy_results_config(), "2026-10-06")
    text = json.dumps(results, allow_nan=False)
    assert '"mm": null' in text


def test_build_results_stops_when_states_differ():
    metrics = toy_metrics()
    del metrics["states"]["HI"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_states"


def test_build_results_stops_on_wrong_district_ids():
    metrics = toy_metrics()
    metrics["states"]["HI"]["districts"][0]["id"] = "1503"
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_districts", "HI")


def test_build_results_stops_when_national_seats_differ_from_config():
    metrics = toy_metrics()
    metrics["national"]["seats"] = 5
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert err.value.check == "export_seats"


def test_build_results_stops_when_blocked_map_is_missing():
    metrics = toy_metrics()
    del metrics["states"]["MO"]["blocked_map"]
    with pytest.raises(CheckError) as err:
        build_results(metrics, toy_results_config(), "2026-10-06")
    assert (err.value.check, err.value.state) == ("export_blocked_map", "MO")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -v`
Expected: collection error `ImportError: cannot import name 'build_results' from 'gerry.export'`.

- [ ] **Step 3: Write minimal implementation**

Vervang in `pipeline/gerry/export.py` de regels

```python
from collections.abc import Sequence

from gerry.config import Config, ConfigError
```

door:

```python
import math
from collections.abc import Sequence

from gerry.checks import CheckError
from gerry.config import Config, ConfigError

NATIONAL_FIELDS = ("seats", "proportional", "enacted", "neutral", "position", "effects", "outside_band")
STATE_FIELDS = ("d_share", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                "eg", "mm", "districts", "sorted")
```

Voeg onderaan `pipeline/gerry/export.py` toe:

```python


def _votes(value: float) -> int:
    """Round a vote count half up to a whole number."""
    return int(math.floor(value + 0.5))


def _districts(rows: list[dict], fips: str, seats: int, postal: str) -> list[dict]:
    expected = [f"{fips}{n:02d}" for n in range(1, seats + 1)]
    ids = sorted(row["id"] for row in rows)
    if ids != expected:
        raise CheckError("export_districts", postal, f"district ids {ids}, expected {expected}")
    return [{"id": row["id"], "share": row["share"], "d": _votes(row["d"]), "r": _votes(row["r"])}
            for row in sorted(rows, key=lambda row: row["id"])]


def _blocked_map(postal: str, cfg: Config, m: dict) -> dict | None:
    st = cfg.states[postal]
    others = [x.id for x in st.extra_maps if x.status != "Blocked"]
    if others:
        raise CheckError("export_blocked_map", postal, f"extra maps {others} are not Blocked; results.json "
                         "only has a field for a blocked map")
    blocked = [x for x in st.extra_maps if x.status == "Blocked"]
    if len(blocked) > 1 or bool(blocked) != ("blocked_map" in m):
        raise CheckError("export_blocked_map", postal, f"config.yaml has {len(blocked)} blocked map(s), "
                         f"metrics.json {'has' if 'blocked_map' in m else 'has no'} blocked_map")
    if not blocked:
        return None
    x, b = blocked[0], m["blocked_map"]
    return {
        "name": x.name,
        "status": x.status,
        "source": {"label": x.source_label, "url": x.source_url},
        "enacted": b["enacted"],
        "districts": _districts(b["districts"], st.fips, st.seats, postal),
        "position": b["position"],
    }


def _state_entry(postal: str, cfg: Config, m: dict) -> dict:
    st = cfg.states[postal]
    entry = {
        "name": st.name,
        "fips": st.fips,
        "seats": st.seats,
        "map_name": st.map_name,
        "status": st.status,
        "source": {"label": st.source_label, "url": st.source_url},
        "notes": resolve_notes(postal, cfg, m["computed_notes"]),
    }
    entry.update({key: m[key] for key in STATE_FIELDS})
    entry["districts"] = _districts(m["districts"], st.fips, st.seats, postal)
    blocked = _blocked_map(postal, cfg, m)
    if blocked is not None:
        entry["blocked_map"] = blocked
    return entry


def build_results(metrics: dict, cfg: Config, generated: str) -> dict:
    """The contents of site/data/results.json (chapter 7 of the spec)."""
    if set(metrics["states"]) != set(cfg.states):
        raise CheckError("export_states", "US", f"metrics.json has {sorted(metrics['states'])}, "
                         f"config.yaml has {sorted(cfg.states)}")
    national = {key: metrics["national"][key] for key in NATIONAL_FIELDS}
    seats = sum(st.seats for st in cfg.states.values())
    if national["seats"] != seats:
        raise CheckError("export_seats", "US", f"metrics.json has {national['seats']} seats, "
                         f"config.yaml {seats}")
    national["single_seat"] = [{"postal": a.postal, "fips": a.fips, "name": a.name}
                               for a in sorted(cfg.at_large.values(), key=lambda a: a.postal)]
    vote_basis = sorted({e for st in cfg.states.values() for e in st.elections})
    return {
        "meta": {
            "generated": generated,
            "ensemble": {"name": cfg.ensemble.name, "doi": cfg.ensemble.doi, "version": cfg.ensemble.version},
            "census_vest_commit": cfg.census_vest_commit,
            "vote_basis": vote_basis,
            "status_checked": cfg.status_checked.isoformat(),
        },
        "national": national,
        "states": {postal: _state_entry(postal, cfg, metrics["states"][postal]) for postal in sorted(cfg.states)},
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -v`
Expected: `18 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/gerry/export.py tests/test_export.py
git commit -m "Build results.json from metrics and config"
```

### Task 3.3: geometrie en mapshaper

**Files:**
- Create: `pipeline/gerry/geometry.py`
- Create: `tests/test_geometry.py`

**Interfaces:**
- Consumes: `REPO_ROOT` uit `gerry.config` (taak 0.4); `CheckError` uit `gerry.checks` (taak 0.5); `node_modules/mapshaper` uit `npm install` (taak 0.2, `package.json`).
- Produces:
  - `load_districts(gpkg_zip: Path, mo_zip: Path, workdir: Path) -> gpd.GeoDataFrame`: kolommen `id` (str, `"4809"`), `state` (postcode), `geometry`; EPSG:4326; gesorteerd op `id`; 435 rijen op de echte bestanden. Pakt de GeoPackage één keer uit in `workdir`. `CheckError("geopackage", ...)` als laag of veld ontbreekt.
  - `national_outline(cb_zip: Path) -> gpd.GeoDataFrame`: één rij, kolom `name` = `"US"`, EPSG:4326. `CheckError("outline", ...)` als er geen 50 staten in staan.
  - `mapshaper_cmd(args: Sequence[str]) -> list[str]`.
  - `build_topojson(districts_path: Path, outline_path: Path, out_path: Path, simplify_pct: float) -> Path`: TopoJSON met de lagen `districts` (`id`, `state`) en `states` (`id` = FIPS, `postal`).
  - Constanten `STATE_POSTAL` (FIPS naar postcode, 50 staten), `GPKG_LAYER` (`"Congressional Districts"`), `MAPSHAPER_JS`.

- [ ] **Step 1: Check that mapshaper is installed**

Run: `node node_modules/mapshaper/bin/mapshaper -v`
Expected: een versienummer, bijvoorbeeld `0.7.77`. Geeft dit een fout, draai dan eerst `npm install`.

- [ ] **Step 2: Write the failing test**

`tests/test_geometry.py`:

```python
import json
import shutil
import zipfile

import geopandas as gpd
import pytest
from shapely.geometry import box

from gerry.checks import CheckError
from gerry.config import REPO_ROOT
from gerry.geometry import (
    MAPSHAPER_JS, STATE_POSTAL, build_topojson, load_districts, mapshaper_cmd, national_outline,
)

GPKG_NAME = "tlgpkg_2026_us_legislative.gpkg"


def write_gpkg_zip(tmp_path, rows, layer="Congressional Districts", field="CD120FP"):
    """Zip a one-layer GeoPackage like the TIGER 2026 file. rows: (STATEFP, district, geometry)."""
    src = tmp_path / "src"
    src.mkdir(exist_ok=True)
    gdf = gpd.GeoDataFrame(
        {"STATEFP": [r[0] for r in rows], field: [r[1] for r in rows], "NAMELSAD": ["x"] * len(rows)},
        geometry=[r[2] for r in rows], crs="EPSG:4269",
    )
    gdf.to_file(src / GPKG_NAME, layer=layer, driver="GPKG")
    zip_path = tmp_path / f"{GPKG_NAME}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(src / GPKG_NAME, GPKG_NAME)
    shutil.rmtree(src)
    return zip_path


def write_mo_zip(tmp_path):
    """Zip a Missouri shapefile like tl_2025_29_cd119.zip, with two districts."""
    src = tmp_path / "mo"
    src.mkdir()
    gdf = gpd.GeoDataFrame({"STATEFP": ["29", "29"], "CD119FP": ["01", "02"]},
                           geometry=[box(5, 0, 6, 1), box(6, 0, 7, 1)], crs="EPSG:4269")
    gdf.to_file(src / "tl_2025_29_cd119.shp")
    zip_path = tmp_path / "tl_2025_29_cd119.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in src.iterdir():
            zf.write(f, f.name)
    shutil.rmtree(src)
    return zip_path


NATIONAL_ROWS = [
    ("01", "01", box(0, 0, 1, 1)),
    ("01", "02", box(1, 0, 2, 1)),
    ("02", "00", box(10, 10, 11, 11)),
    ("09", "ZZ", box(20, 0, 21, 1)),     # water, no district
    ("11", "98", box(22, 0, 23, 1)),     # DC delegate
    ("72", "98", box(24, 0, 25, 1)),     # Puerto Rico
    ("66", "98", box(26, 0, 27, 1)),     # Guam
    ("29", "01", box(50, 50, 51, 51)),   # Missouri HB 1, replaced by the 2022 map
]


def test_load_districts_keeps_states_and_takes_missouri_from_2022_file(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS)
    mo_zip = write_mo_zip(tmp_path)
    districts = load_districts(gpkg_zip, mo_zip, tmp_path / "work")
    assert districts["id"].tolist() == ["0101", "0102", "0200", "2901", "2902"]
    assert districts["state"].tolist() == ["AL", "AL", "AK", "MO", "MO"]
    assert list(districts.columns) == ["id", "state", "geometry"]
    assert districts.crs.to_epsg() == 4326
    mo1 = districts.loc[districts["id"] == "2901", "geometry"].iloc[0]
    assert mo1.bounds == pytest.approx((5, 0, 6, 1))


def test_load_districts_extracts_the_geopackage_once(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS)
    mo_zip = write_mo_zip(tmp_path)
    work = tmp_path / "work"
    load_districts(gpkg_zip, mo_zip, work)
    first = (work / GPKG_NAME).stat().st_mtime_ns
    load_districts(gpkg_zip, mo_zip, work)
    assert (work / GPKG_NAME).stat().st_mtime_ns == first
    assert sorted(p.name for p in work.iterdir()) == [GPKG_NAME]


def test_load_districts_stops_when_layer_is_missing(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS, layer="Congressional_Districts")
    with pytest.raises(CheckError) as err:
        load_districts(gpkg_zip, write_mo_zip(tmp_path), tmp_path / "work")
    assert err.value.check == "geopackage"
    assert "Congressional Districts" in err.value.detail


def test_load_districts_stops_when_cd120fp_is_missing(tmp_path):
    gpkg_zip = write_gpkg_zip(tmp_path, NATIONAL_ROWS, field="CD119FP")
    with pytest.raises(CheckError) as err:
        load_districts(gpkg_zip, write_mo_zip(tmp_path), tmp_path / "work")
    assert err.value.check == "geopackage"
    assert "CD120FP" in err.value.detail


def write_cb_zip(tmp_path, fips_codes):
    """Zip a states shapefile like cb_2025_us_state_500k.zip: one unit square per state in a row."""
    src = tmp_path / "cb"
    src.mkdir()
    gdf = gpd.GeoDataFrame({"STATEFP": list(fips_codes)},
                           geometry=[box(i, 0, i + 1, 1) for i in range(len(fips_codes))], crs="EPSG:4269")
    gdf.to_file(src / "cb_2025_us_state_500k.shp")
    zip_path = tmp_path / "cb_2025_us_state_500k.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in src.iterdir():
            zf.write(f, f.name)
    shutil.rmtree(src)
    return zip_path


def test_national_outline_is_one_shape_of_the_50_states(tmp_path):
    cb_zip = write_cb_zip(tmp_path, [*sorted(STATE_POSTAL), "72", "11"])
    outline = national_outline(cb_zip)
    assert len(outline) == 1
    assert outline.crs.to_epsg() == 4326
    # 50 adjacent unit squares; Puerto Rico and DC (squares 51 and 52) are left out
    assert outline.geometry.iloc[0].area == pytest.approx(50)
    assert outline.geometry.iloc[0].bounds == pytest.approx((0, 0, 50, 1))


def test_national_outline_stops_when_a_state_is_missing(tmp_path):
    cb_zip = write_cb_zip(tmp_path, sorted(STATE_POSTAL)[1:])
    with pytest.raises(CheckError) as err:
        national_outline(cb_zip)
    assert err.value.check == "outline"


def test_mapshaper_cmd_runs_the_repo_copy_with_node():
    assert mapshaper_cmd(["-v"]) == ["node", str(REPO_ROOT / "node_modules" / "mapshaper" / "bin" / "mapshaper"), "-v"]


def topojson_bounds(topo):
    """Bounding box of all arcs of a quantized TopoJSON file, in input coordinates."""
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    xs, ys = [], []
    for arc in topo["arcs"]:
        x = y = 0
        for dx, dy in arc:
            x, y = x + dx, y + dy
            xs.append(x * sx + tx)
            ys.append(y * sy + ty)
    return min(xs), min(ys), max(xs), max(ys)


@pytest.mark.skipif(shutil.which("node") is None or not MAPSHAPER_JS.exists(),
                    reason="needs node and npm install (node_modules/mapshaper)")
def test_build_topojson_writes_district_and_state_layers(tmp_path):
    districts = gpd.GeoDataFrame({"id": ["0101", "0102", "0200"], "state": ["AL", "AL", "AK"]},
                                 geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1), box(3, 0, 4, 1)], crs="EPSG:4326")
    districts.to_file(tmp_path / "districts.geojson", driver="GeoJSON")
    outline = gpd.GeoDataFrame({"name": ["US"]}, geometry=[box(0, 0, 3.5, 0.5)], crs="EPSG:4326")
    outline.to_file(tmp_path / "outline.geojson", driver="GeoJSON")

    out = build_topojson(tmp_path / "districts.geojson", tmp_path / "outline.geojson",
                         tmp_path / "site" / "map.topojson", simplify_pct=50)

    topo = json.loads(out.read_text(encoding="utf-8"))
    assert set(topo["objects"]) == {"districts", "states"}
    assert [g["properties"] for g in topo["objects"]["districts"]["geometries"]] == [
        {"id": "0101", "state": "AL"}, {"id": "0102", "state": "AL"}, {"id": "0200", "state": "AK"}]
    assert sorted((g["properties"]["id"], g["properties"]["postal"])
                  for g in topo["objects"]["states"]["geometries"]) == [("01", "AL"), ("02", "AK")]
    # clipped to the outline: nothing above y = 0.5 or right of x = 3.5
    assert topojson_bounds(topo) == pytest.approx((0, 0, 3.5, 0.5), abs=1e-4)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_geometry.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'gerry.geometry'`.

- [ ] **Step 4: Write minimal implementation**

`pipeline/gerry/geometry.py`:

```python
"""District and outline geometry for the site map: TIGER GeoPackage, Missouri 2022, mapshaper."""
from __future__ import annotations

import os
import shutil
import subprocess
import warnings
import zipfile
from collections.abc import Sequence
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

from gerry.checks import CheckError
from gerry.config import REPO_ROOT

GPKG_LAYER = "Congressional Districts"   # with a space; checked against the file on 2026-10-05
GPKG_FIELD = "CD120FP"
MO_FIPS = "29"
MAPSHAPER_JS = REPO_ROOT / "node_modules" / "mapshaper" / "bin" / "mapshaper"

# The 50 states. DC, Puerto Rico and the island areas are left out of the map.
STATE_POSTAL = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
    "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
    "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
    "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY",
}


def _extract_once(zip_path: Path, workdir: Path) -> Path:
    """Unzip the single .gpkg member into workdir, unless a file of the same size is already there."""
    with zipfile.ZipFile(zip_path) as zf:
        members = [m for m in zf.infolist() if m.filename.endswith(".gpkg")]
        if len(members) != 1:
            raise CheckError("geopackage", "US", f"{zip_path.name} holds {len(members)} .gpkg files, expected 1")
        member = members[0]
        target = workdir / Path(member.filename).name
        if target.exists() and target.stat().st_size == member.file_size:
            return target
        workdir.mkdir(parents=True, exist_ok=True)
        part = target.with_name(target.name + ".part")
        with zf.open(member) as src, open(part, "wb") as dst:
            shutil.copyfileobj(src, dst, length=1 << 20)
    os.replace(part, target)
    return target


def load_districts(gpkg_zip: Path, mo_zip: Path, workdir: Path) -> gpd.GeoDataFrame:
    """Districts for November 2026: CD120 from the GeoPackage, Missouri from the 2022 map.

    Columns id (state FIPS + district, "4809"), state (postal code) and geometry, in EPSG:4326.
    """
    gpkg = _extract_once(gpkg_zip, workdir)
    with warnings.catch_warnings():
        # The TIGER GeoPackage stores measured (M) geometries; pyogrio drops M and says so.
        warnings.filterwarnings("ignore", message="Measured \\(M\\) geometry types", category=UserWarning)
        layers = [str(name) for name, _ in pyogrio.list_layers(gpkg)]
        if GPKG_LAYER not in layers:
            raise CheckError("geopackage", "US", f"layer {GPKG_LAYER!r} not in {gpkg.name}; layers: {layers}")
        fields = [str(f) for f in pyogrio.read_info(gpkg, layer=GPKG_LAYER)["fields"]]
        missing = sorted({"STATEFP", GPKG_FIELD} - set(fields))
        if missing:
            raise CheckError("geopackage", "US", f"layer {GPKG_LAYER!r} lacks {missing}; fields: {fields}")
        cd = gpd.read_file(gpkg, layer=GPKG_LAYER, columns=["STATEFP", GPKG_FIELD])
    cd = cd.rename(columns={GPKG_FIELD: "district"})
    keep = cd["STATEFP"].isin(list(STATE_POSTAL)) & (cd["STATEFP"] != MO_FIPS) & ~cd["district"].isin(["ZZ", "98"])
    cd = cd[keep]

    mo = gpd.read_file(mo_zip, columns=["STATEFP", "CD119FP"]).rename(columns={"CD119FP": "district"})
    if not (mo["STATEFP"] == MO_FIPS).all():
        raise CheckError("geopackage", "MO", f"{mo_zip.name} has STATEFP {sorted(mo['STATEFP'].unique())}")
    mo = mo.to_crs(cd.crs)

    out = gpd.GeoDataFrame(pd.concat([cd, mo], ignore_index=True), geometry="geometry", crs=cd.crs)
    out["id"] = out["STATEFP"] + out["district"]
    out["state"] = out["STATEFP"].map(STATE_POSTAL)
    out["geometry"] = out.geometry.force_2d()
    out = out[["id", "state", "geometry"]].sort_values("id").reset_index(drop=True)
    duplicated = out.loc[out["id"].duplicated(), "id"].tolist()
    if duplicated:
        raise CheckError("geopackage", "US", f"district ids occur more than once: {duplicated}")
    return out.to_crs("EPSG:4326")


def national_outline(cb_zip: Path) -> gpd.GeoDataFrame:
    """The 50 states from the cartographic boundary file, merged into one shape (EPSG:4326)."""
    states = gpd.read_file(cb_zip, columns=["STATEFP"])
    states = states[states["STATEFP"].isin(list(STATE_POSTAL))]
    if len(states) != len(STATE_POSTAL):
        raise CheckError("outline", "US", f"{cb_zip.name} has {len(states)} of the {len(STATE_POSTAL)} states")
    shape = states.to_crs("EPSG:4326").union_all()
    return gpd.GeoDataFrame({"name": ["US"]}, geometry=[shape], crs="EPSG:4326")


def mapshaper_cmd(args: Sequence[str]) -> list[str]:
    """Command line for the repo's mapshaper. Not npx: on Windows that is a .cmd file."""
    return ["node", str(MAPSHAPER_JS), *args]


def build_topojson(districts_path: Path, outline_path: Path, out_path: Path, simplify_pct: float) -> Path:
    """Clip, dissolve and simplify with mapshaper; write TopoJSON with layers districts and states."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    args = [
        "-i", str(districts_path), "snap", "name=districts",
        "-clip", str(outline_path), "remove-slivers",
        "-each", "fips = id.slice(0, 2)",
        "-dissolve", "fips", "copy-fields=state", "+", "name=states",
        "-rename-fields", "id=fips,postal=state", "target=states",
        "-filter-fields", "id,state", "target=districts",
        "-simplify", f"{simplify_pct}%", "keep-shapes", "target=districts,states",
        "-o", "format=topojson", "target=districts,states", str(out_path),
    ]
    subprocess.run(mapshaper_cmd(args), check=True)
    return out_path
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_geometry.py -v`
Expected: `8 passed`. Ontbreekt `node_modules/mapshaper`, dan `7 passed, 1 skipped`; dat is hier niet goed genoeg, draai dan `npm install` en herhaal.

- [ ] **Step 6: Commit**

```bash
git add pipeline/gerry/geometry.py tests/test_geometry.py
git commit -m "Load 2026 district geometry and build TopoJSON with mapshaper"
```

### Task 3.4: check_geometry

**Files:**
- Modify: `pipeline/gerry/checks.py` (import bovenaan, functie onderaan)
- Create: `tests/test_check_geometry.py`

**Interfaces:**
- Consumes: `load_districts` (taak 3.3); `read_pl_blocks(zip_path, st)` met kolommen `block_id`, `vap`, `pop`, `vtd`, `lat`, `lon` (taak 1.7 en 1.13) en `read_bef(zip_path, kind, fips, postal)` met index `block_id` en waarde `district` (taak 1.7).
- Produces: `check_geometry(districts, blocks, district_of, state, min_share: float = 0.999) -> float`. Geeft het aandeel blokken waarvan het interne punt in het district ligt dat het blokbestand noemt. Blokken met `ZZ` tellen niet mee. Een blok uit het blokbestand zonder punt in P.L. 94-171 telt als misser. Fouten: `CheckError("geometry_codes", state, ...)` als de districtscodes verschillen, `CheckError("geometry_points", state, ...)` onder `min_share`, met de eerste vijf missers.

De punten uit P.L. 94-171 zijn NAD83, de districten EPSG:4326. Het verschil is kleiner dan 2 meter; de functie zet beide in hetzelfde stelsel zonder omrekening.

- [ ] **Step 1: Write the failing test**

`tests/test_check_geometry.py`:

```python
import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

from gerry.checks import CheckError, check_geometry
from gerry.config import data_dir

# Nevada (FIPS 32) with two square districts side by side. Utah's "4903" covers the same area and
# must be ignored: it belongs to another state.
DISTRICTS = gpd.GeoDataFrame(
    {"id": ["3201", "3202", "4903"], "state": ["NV", "NV", "UT"]},
    geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1), box(-5, -5, 5, 5)],
    crs="EPSG:4326",
)


def blocks(points):
    """P.L. 94-171 block table; points: {block_id: (lon, lat)}."""
    return pd.DataFrame({
        "block_id": list(points),
        "vap": [10] * len(points),
        "vtd": ["000001"] * len(points),
        "lat": [lat for _, lat in points.values()],
        "lon": [lon for lon, _ in points.values()],
    })


def bef(assignment):
    s = pd.Series(assignment, name="district")
    s.index.name = "block_id"
    return s


POINTS = {
    "320010001001000": (0.5, 0.5),
    "320010001001001": (0.2, 0.8),
    "320010001001002": (1.5, 0.5),
    "320010001001003": (1.7, 0.1),
}
NAMED = {"320010001001000": "01", "320010001001001": "01", "320010001001002": "02", "320010001001003": "02"}


def test_check_geometry_passes_when_every_point_is_in_its_district():
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(NAMED), "NV") == 1.0


def test_check_geometry_ignores_zz_blocks():
    points = {**POINTS, "320010001001004": (9.0, 9.0)}       # water block outside every district
    named = {**NAMED, "320010001001004": "ZZ"}
    assert check_geometry(DISTRICTS, blocks(points), bef(named), "NV") == 1.0


def test_check_geometry_stops_when_district_codes_differ():
    named = {**NAMED, "320010001001003": "03"}
    with pytest.raises(CheckError) as err:
        check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV")
    assert (err.value.check, err.value.state) == ("geometry_codes", "NV")


def test_check_geometry_stops_below_min_share():
    named = {**NAMED, "320010001001003": "01"}                 # point lies in 02, block file says 01
    with pytest.raises(CheckError) as err:
        check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV")
    assert err.value.check == "geometry_points"
    assert "320010001001003" in err.value.detail


def test_check_geometry_returns_share_when_above_min_share():
    named = {**NAMED, "320010001001003": "01"}
    # 3 of 4 points in the named district
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV", min_share=0.7) == 0.75


def test_check_geometry_counts_a_block_without_point_as_a_miss():
    named = {**NAMED, "320010001001009": "02"}                 # in the block file, not in P.L. 94-171
    # 4 of 5 blocks confirmed
    assert check_geometry(DISTRICTS, blocks(POINTS), bef(named), "NV", min_share=0.5) == 0.8


GPKG = data_dir() / "census" / "tiger" / "tlgpkg_2026_us_legislative.gpkg.zip"
MO_2022 = data_dir() / "census" / "tiger" / "tl_2025_29_cd119.zip"


@pytest.mark.data
@pytest.mark.parametrize("postal, fips, bef_kind", [("NV", "32", "cd120"), ("MO", "29", "cd118")])
def test_check_geometry_on_real_files(postal, fips, bef_kind, tmp_path):
    from gerry.blocks import read_bef, read_pl_blocks
    from gerry.geometry import load_districts

    pl_zip = data_dir() / "census" / "pl" / f"{postal.lower()}2020.pl.zip"
    bef_zip = data_dir() / "census" / f"{bef_kind}.zip"
    if not all(p.exists() for p in (GPKG, MO_2022, pl_zip, bef_zip)):
        pytest.skip("real files missing in the data directory")
    districts = load_districts(GPKG, MO_2022, data_dir() / "census" / "tiger")
    share = check_geometry(districts, read_pl_blocks(pl_zip, postal.lower()),
                           read_bef(bef_zip, bef_kind, fips, postal), postal)
    assert share >= 0.999
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_check_geometry.py -v`
Expected: collection error `ImportError: cannot import name 'check_geometry' from 'gerry.checks'`.

- [ ] **Step 3: Write minimal implementation**

Vervang de importregels bovenaan `pipeline/gerry/checks.py` (zoals taak 1.10 stap 3 ze schreef):

```python
from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import pandas as pd

from gerry.config import Config
```

door:

```python
from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import geopandas as gpd
import pandas as pd

from gerry.config import Config
```

Voeg onderaan `pipeline/gerry/checks.py` toe:

```python


def check_geometry(districts, blocks, district_of, state, min_share: float = 0.999) -> float:
    """Geometry and block file describe the same map.

    districts: GeoDataFrame from geometry.load_districts (id, state, geometry).
    blocks: read_pl_blocks table (block_id, lat, lon, ...). district_of: read_bef series.
    Returns the share of blocks whose internal point lies in the district the block file names.
    """
    mine = districts[districts["state"] == state]
    named = district_of[district_of != "ZZ"]
    if named.empty:
        raise CheckError("geometry_codes", state, "the block file has no blocks outside ZZ")
    geo_codes = sorted(set(mine["id"].str[2:]))
    bef_codes = sorted(set(named))
    if geo_codes != bef_codes:
        raise CheckError("geometry_codes", state, f"geometry has districts {geo_codes}, block file {bef_codes}")

    pts = blocks.loc[blocks["block_id"].isin(named.index), ["block_id", "lat", "lon"]]
    points = gpd.GeoDataFrame(
        {"block_id": pts["block_id"].to_numpy(), "named": named.reindex(pts["block_id"]).to_numpy()},
        geometry=gpd.points_from_xy(pts["lon"], pts["lat"]),
        crs=mine.crs,   # P.L. points are NAD83; next to EPSG:4326 the shift is under 2 m
    )
    polygons = gpd.GeoDataFrame({"found": mine["id"].str[2:].to_numpy()},
                                geometry=mine.geometry.to_numpy(), crs=mine.crs)
    hits = gpd.sjoin(points, polygons, how="inner", predicate="within")
    confirmed = set(hits.loc[hits["found"] == hits["named"], "block_id"])
    share = len(confirmed) / len(named)
    if share < min_share:
        misses = sorted(set(named.index) - confirmed)[:5]
        raise CheckError("geometry_points", state,
                         f"{len(confirmed):,} of {len(named):,} block points ({share:.4%}) lie in the district "
                         f"the block file names, minimum {min_share:.1%}; first misses: {misses}")
    return share
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_check_geometry.py -v`
Expected: `8 passed` als de datamap gevuld is (de eerste run pakt de GeoPackage van 402 MB uit in `census/tiger/` van de datamap, samen ongeveer 15 seconden). Zonder datamap: `6 passed, 2 skipped`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/gerry/checks.py tests/test_check_geometry.py
git commit -m "Check district geometry against the block files"
```

### Task 3.5: 04_export, results.json en map.topojson

**Files:**
- Modify: `pipeline/gerry/checks.py` (functie onderaan)
- Create: `tests/test_check_map_ids.py`
- Create: `pipeline/04_export.py`
- Create (gegenereerd): `site/data/results.json`, `site/data/map.topojson`

**Interfaces:**
- Consumes: `load_config`, `data_dir`, `interim_dir`, `REPO_ROOT` (taak 0.4); `check_sources_md`, `CheckError` (taak 0.5); `read_pl_blocks`, `read_bef` (taak 1.7); `data/interim/metrics.json` (taak 2.11); `build_results` (taak 3.2); `load_districts`, `national_outline`, `build_topojson` (taak 3.3); `check_geometry` (taak 3.4).
- Produces: `check_map_ids(topo: dict, results: dict) -> None` in `gerry/checks.py`. `pipeline/04_export.py` met de constanten `SIMPLIFY_PCT = 3` en `MAX_MAP_BYTES = 1_000_000`. Tussenbestanden `data/interim/districts.geojson`, `outline.geojson` en `map.topojson`. De twee sitebestanden uit hoofdstuk 7 van de spec.

`04_export` schrijft pas naar `site/data/` als alle controles geslaagd zijn. Volgorde: `check_sources_md`, `build_results`, 429 plus 6 is 435, geometrie laden, `check_geometry` voor alle 44 staten (Missouri tegen CD118), mapshaper, grootte onder 1 MB, `check_map_ids`, schrijven.

- [ ] **Step 1: Write the failing test**

`tests/test_check_map_ids.py`:

```python
import copy

import pytest

from gerry.checks import CheckError, check_map_ids

RESULTS = {
    "national": {"single_seat": [{"postal": "AK", "fips": "02", "name": "Alaska"}]},
    "states": {
        "HI": {"fips": "15", "districts": [{"id": "1501"}, {"id": "1502"}]},
        "NM": {"fips": "35", "districts": [{"id": "3501"}, {"id": "3502"}, {"id": "3503"}]},
    },
}


def topo(districts, states):
    """Minimal TopoJSON object tree; districts: [(id, state)], states: [(id, postal)]."""
    return {"type": "Topology", "objects": {
        "districts": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "arcs": [], "properties": {"id": i, "state": s}} for i, s in districts]},
        "states": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "arcs": [], "properties": {"id": i, "postal": p}} for i, p in states]},
    }}


DISTRICTS = [("0200", "AK"), ("1501", "HI"), ("1502", "HI"), ("3501", "NM"), ("3502", "NM"), ("3503", "NM")]
STATES = [("02", "AK"), ("15", "HI"), ("35", "NM")]


def test_check_map_ids_passes_when_map_and_results_agree():
    check_map_ids(topo(DISTRICTS, STATES), RESULTS)


def test_check_map_ids_stops_on_missing_district():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS[:-1], STATES), RESULTS)
    assert err.value.check == "map_ids"
    assert "3503" in err.value.detail


def test_check_map_ids_stops_on_duplicate_district():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo([*DISTRICTS, ("1501", "HI")], STATES), RESULTS)
    assert "1501" in err.value.detail


def test_check_map_ids_stops_on_wrong_state_property():
    districts = [("0200", "AK"), ("1501", "HI"), ("1502", "NM"), ("3501", "NM"), ("3502", "NM"), ("3503", "NM")]
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(districts, STATES), RESULTS)
    assert "1502" in err.value.detail


def test_check_map_ids_stops_on_missing_at_large_state():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, STATES[1:]), RESULTS)
    assert "AK" in err.value.detail


def test_check_map_ids_needs_the_at_large_district():
    results = copy.deepcopy(RESULTS)
    results["national"]["single_seat"].append({"postal": "DE", "fips": "10", "name": "Delaware"})
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, [*STATES, ("10", "DE")]), results)
    assert "1000" in err.value.detail
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_check_map_ids.py -v`
Expected: collection error `ImportError: cannot import name 'check_map_ids' from 'gerry.checks'`.

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/checks.py` toe:

```python


def check_map_ids(topo: dict, results: dict) -> None:
    """map.topojson has exactly the districts and states of results.json, plus the at-large states."""
    postal = {s["fips"]: p for p, s in results["states"].items()}
    postal |= {a["fips"]: a["postal"] for a in results["national"]["single_seat"]}
    want = {d["id"] for s in results["states"].values() for d in s["districts"]}
    want |= {f"{a['fips']}00" for a in results["national"]["single_seat"]}

    props = [g["properties"] for g in topo["objects"]["districts"]["geometries"]]
    ids = [p["id"] for p in props]
    duplicated = sorted({i for i in ids if ids.count(i) > 1})
    missing, extra = sorted(want - set(ids)), sorted(set(ids) - want)
    if duplicated or missing or extra:
        raise CheckError("map_ids", "US", f"districts in map.topojson: missing {missing}, extra {extra}, "
                         f"duplicated {duplicated}")
    wrong = sorted(p["id"] for p in props if p["state"] != postal[p["id"][:2]])
    if wrong:
        raise CheckError("map_ids", "US", f"districts with the wrong state property: {wrong}")

    states = {g["properties"]["id"]: g["properties"]["postal"] for g in topo["objects"]["states"]["geometries"]}
    if states != postal:
        raise CheckError("map_ids", "US", f"states in map.topojson {sorted(states.values())}, "
                         f"expected {sorted(postal.values())}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_check_map_ids.py -v`
Expected: `6 passed`.

- [ ] **Step 5: Write the export script**

`pipeline/04_export.py`:

```python
"""Step 4: write site/data/results.json and site/data/map.topojson.

Reads data/interim/metrics.json, pipeline/config.yaml and the TIGER geometry. Checks every multi-seat
map against its block file before anything is written to site/data/.
"""
from __future__ import annotations

import json
import shutil
import time
from datetime import date
from pathlib import Path

import geopandas as gpd

from gerry.blocks import read_bef, read_pl_blocks
from gerry.checks import CheckError, check_geometry, check_map_ids, check_sources_md
from gerry.config import REPO_ROOT, Config, data_dir, interim_dir, load_config
from gerry.export import build_results
from gerry.geometry import build_topojson, load_districts, national_outline

# Share of removable vertices mapshaper keeps. 3 gave 683,120 bytes on 2026-10-05.
SIMPLIFY_PCT = 3
MAX_MAP_BYTES = 1_000_000
HOUSE_SEATS = 435
SITE_DATA = REPO_ROOT / "site" / "data"


def check_all_geometry(cfg: Config, districts: gpd.GeoDataFrame, root: Path) -> None:
    """check_geometry for every multi-seat state, against the block file the pipeline uses."""
    for postal, st in sorted(cfg.states.items()):
        start = time.perf_counter()
        blocks = read_pl_blocks(root / "census" / "pl" / f"{postal.lower()}2020.pl.zip", postal.lower())
        district_of = read_bef(root / "census" / f"{st.bef}.zip", st.bef, st.fips, postal)
        share = check_geometry(districts, blocks, district_of, postal)
        print(f"  {postal} ({st.bef.upper()}): {share:.4%} of block points in their district, "
              f"{time.perf_counter() - start:.0f} s")


def main() -> None:
    cfg = load_config()
    root = data_dir()
    tiger = root / "census" / "tiger"
    check_sources_md(cfg, REPO_ROOT / "data" / "sources.md")

    metrics = json.loads((interim_dir() / "metrics.json").read_text(encoding="utf-8"))
    results = build_results(metrics, cfg, date.today().isoformat())
    national = results["national"]
    total = national["seats"] + len(national["single_seat"])
    if total != HOUSE_SEATS:
        raise CheckError("export_seats", "US", f"{national['seats']} seats plus {len(national['single_seat'])} "
                         f"single-seat states is {total}, expected {HOUSE_SEATS}")

    print("Loading district geometry")
    districts = load_districts(tiger / "tlgpkg_2026_us_legislative.gpkg.zip", tiger / "tl_2025_29_cd119.zip", tiger)
    print("Checking the geometry against the block files")
    check_all_geometry(cfg, districts, root)

    work = interim_dir()
    work.mkdir(parents=True, exist_ok=True)
    districts.to_file(work / "districts.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    national_outline(tiger / "cb_2025_us_state_500k.zip").to_file(
        work / "outline.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    print(f"Running mapshaper, simplify {SIMPLIFY_PCT}%")
    map_tmp = build_topojson(work / "districts.geojson", work / "outline.geojson", work / "map.topojson",
                             SIMPLIFY_PCT)
    size = map_tmp.stat().st_size
    if size >= MAX_MAP_BYTES:
        raise SystemExit(f"map.topojson is {size:,} bytes, limit {MAX_MAP_BYTES:,}. "
                         f"Lower SIMPLIFY_PCT ({SIMPLIFY_PCT}) in pipeline/04_export.py.")
    check_map_ids(json.loads(map_tmp.read_text(encoding="utf-8")), results)

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(map_tmp, SITE_DATA / "map.topojson")
    (SITE_DATA / "results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=1, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Wrote site/data/results.json ({len(results['states'])} states) "
          f"and site/data/map.topojson ({size:,} bytes)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the whole test suite**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -v`
Expected: alle tests slagen; tests met `@pytest.mark.data` worden overgeslagen als de datamap leeg is.

- [ ] **Step 7: Run the export**

Vereist: `data/interim/metrics.json` uit `03_metrics` en alle downloads uit `01_download`.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/04_export.py` (of `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make export`, zodat Make de Python uit `.venv` gebruikt)

Expected: na ongeveer 4 minuten. Bijna alle tijd gaat naar de geometriecontrole, die per staat P.L. 94-171 leest en voor elk blok het district van zijn interne punt zoekt. In de sandbox was dat ongeveer 24 seconden per miljoen blokken, voor de 7,8 miljoen blokken van de 44 staten ruim 3 minuten. Het landelijke CD120-bestand leest `read_bef` maar één keer, bij de eerste staat (ongeveer 6 seconden), en houdt het daarna in het geheugen (taak 1.7). GeoJSON schrijven en mapshaper duren samen ongeveer 20 seconden. De eerste run pakt ook de GeoPackage van 402 MB uit, ongeveer 15 seconden extra.

```
Loading district geometry
Checking the geometry against the block files
  AL (CD120): 100.0000% of block points in their district, 10 s
  ...
  CA (CD120): 99.9975% of block points in their district, 11 s
  ...
  MO (CD118): 99.9941% of block points in their district, 6 s
  ...
  NV (CD120): 100.0000% of block points in their district, 1 s
  ...
  UT (CD120): 99.9958% of block points in their district, 2 s
  ...
Running mapshaper, simplify 3%
Wrote site/data/results.json (44 states) and site/data/map.topojson (683,120 bytes)
```

De tijd bij AL bevat het eenmalige lezen van CD120. Elke staat staat op minstens 99,9000%. Mapshaper schrijft daarnaast naar stderr, onder meer `[dissolve] Dissolved 435 features into 50 features`; PowerShell kan die regels rood tonen, dat is geen fout. Stopt het script met `CheckError` op `geometry_points` of `geometry_codes`, dan beschrijven geometrie en blokbestand niet dezelfde kaart: niets aanpassen, de melding met de eerste missers aan de eigenaar voorleggen. Zegt het script dat `map.topojson` te groot is, verlaag dan `SIMPLIFY_PCT` met 0,5 en draai opnieuw.

- [ ] **Step 8: Verify the output files**

Run: `.venv\Scripts\python -c "import json; r=json.load(open('site/data/results.json',encoding='utf-8')); t=json.load(open('site/data/map.topojson',encoding='utf-8')); print(len(r['states']), r['national']['seats'], len(r['national']['single_seat']), len(t['objects']['districts']['geometries']), len(t['objects']['states']['geometries']), r['meta']['status_checked'])"`
Expected: `44 429 6 435 50 2026-10-03` (de laatste waarde is `status_checked` uit `config.yaml`).

- [ ] **Step 9: Look at the map**

Run: `node node_modules/mapshaper/bin/mapshaper site/data/map.topojson -proj albersusa -o data/interim/map_check.svg target=districts,states`

Open `data/interim/map_check.svg` in een browser. Controleer: kustlijnen en Grote Meren zijn afgesneden; elke staat heeft een gesloten grens; Missouri sluit zonder gat of overlap aan op IA, IL, KY, TN, AR, OK, KS en NE; de districten zijn op telefoongrootte (ongeveer 375 px breed) nog herkenbaar. De melding `Removed ... paths containing unprojectable vertices` hoort erbij: dat zijn delen van de Aleoeten en van de noordwestelijke eilanden van Hawaii buiten de inzetkaders. Zijn de vormen te grof, verhoog `SIMPLIFY_PCT` zolang het bestand onder 1 MB blijft (4% gaf in de sandbox 879.376 bytes) en draai stap 7 opnieuw.

- [ ] **Step 10: Commit**

```bash
git add pipeline/gerry/checks.py tests/test_check_map_ids.py pipeline/04_export.py site/data/results.json site/data/map.topojson
git commit -m "Export results.json and map.topojson for the site"
```

### Task 3.6: eenmalige vergelijking met bestanden van staten

**Files:**
- Create: `tools/compare_state_files.py`
- Create: `tests/test_compare_state_files.py`
- Create (gegenereerd): `data/crosscheck/state_files.csv`
- Modify: `data/sources.md` (vergelijkingstabel, open punten, en de rij UT als de eigenaar een andere naam kiest)
- Modify: `pipeline/config.yaml` (`map_name` van UT, alleen als de eigenaar een andere naam kiest)
- Modify: `data/validation_notes.yaml` (alleen bij een open punt `state_files`)
- Modify (gegenereerd): `docs/validation.md`, `site/data/results.json`

**Interfaces:**
- Consumes: `read_bef`, `read_pl_blocks` (taak 1.7); `REPO_ROOT`, `data_dir` (taak 0.4); `check_sources_md` (taak 0.5); `STATE_FILES_COLUMNS` en `pipeline/03_metrics.py` met het controlerapport (taak 2.12); openpyxl (taak 0.1); netwerk.
- Produces: `compare_assignments(census: pd.Series, official: pd.Series, vap: pd.Series | None = None) -> dict`, `result_text(kind: str, r: dict) -> str` en `make_row(postal: str, src: dict, retrieved: str, result: dict) -> dict` in `tools/compare_state_files.py`. `data/crosscheck/state_files.csv` met de kolommen hieronder. Downloads in `<datamap>/state_files/`, die hergebruikt worden. Een opnieuw opgebouwd `docs/validation.md` met de regel `**Open items: 0.** Pending: 0.`

Dit script draait niet in `make all`. Districtsnummers kunnen tussen bronnen verschillen; het script koppelt elk CD120-district aan het staatsdistrict met de meeste blokken en schrijft die koppeling op.

Kolommen van `data/crosscheck/state_files.csv`:

| Kolom | Inhoud |
|---|---|
| `state` | postcode |
| `map` | naam van de kaart in de bron |
| `source_kind` | `block_file` (blokbestand van de staat) of `shapes` (districtsvormen) |
| `source_url` | waar het bestand vandaan komt |
| `retrieved` | datum van de download (wijzigingsdatum van het bestand in `state_files/`) |
| `blocks_census` | blokken in CD120 voor de staat, zonder `ZZ` |
| `blocks_state` | blokken die de bron toewijst; bij vormen: blokken waarvan het interne punt in een vorm ligt |
| `only_census` | blokken in CD120 die de bron niet toewijst |
| `only_state` | blokken in de bron die niet in CD120 staan |
| `blocks_matching` | blokken met hetzelfde district na het koppelen van de nummers |
| `share_blocks` | `blocks_matching / blocks_census` |
| `share_vap` | hetzelfde, gewogen naar VAP; alleen bij vormen, anders leeg |
| `district_mapping` | koppeling `CD120=staat`, bijvoorbeeld `01=01;02=02` |
| `one_to_one` | `True` als elk CD120-district een eigen staatsdistrict heeft |
| `result` | de regel voor de vergelijkingstabel in `data/sources.md` |

Het script neemt deze kolomnamen en hun volgorde over uit `STATE_FILES_COLUMNS` in `gerry/validation.py` (taak 2.12), en `make_row` controleert ze per rij. `read_crosscheck` eist precies die kolommen, dus er is maar één lijst.

Bronnen (vastgelegd in het script): OH via de kopie van het Internet Archive van 22 april 2026 (ohiosos.gov blokkeert buitenlandse IP-adressen), MO HB 1 via het xlsx-blokbestand van MSDIS op ArcGIS, AL via de ALGeoHub-laag, TN via de laag van TN STS, UT via de laag van UGRC.

- [ ] **Step 1: Write the failing test**

`tests/test_compare_state_files.py`:

```python
import importlib.util

import pandas as pd
import pytest

from gerry.config import REPO_ROOT
from gerry.validation import STATE_FILES_COLUMNS

spec = importlib.util.spec_from_file_location("compare_state_files", REPO_ROOT / "tools" / "compare_state_files.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def series(d):
    s = pd.Series(d, dtype="str")
    s.index.name = "block_id"
    return s


CENSUS = series({"b1": "01", "b2": "01", "b3": "02", "b4": "02", "b5": "ZZ"})


def test_identical_block_files():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "b4": "2"}))
    assert out == {"blocks_census": 4, "blocks_state": 4, "only_census": 0, "only_state": 0,
                   "blocks_matching": 4, "share_blocks": 1.0, "share_vap": None,
                   "district_mapping": "01=01;02=02", "one_to_one": True}


def test_renumbered_districts_are_matched_by_largest_overlap():
    census = series({"c1": "01", "c2": "01", "c3": "01", "c4": "02", "c5": "02", "c6": "02"})
    # the state calls district 01 "2" and district 02 "1"; c3 sits in the other district
    official = series({"c1": "2", "c2": "2", "c3": "1", "c4": "1", "c5": "1", "c6": "1"})
    out = tool.compare_assignments(census, official)
    assert out["district_mapping"] == "01=02;02=01"
    assert out["blocks_matching"] == 5
    assert out["share_blocks"] == pytest.approx(5 / 6)
    assert out["one_to_one"] is True


def test_blocks_missing_on_either_side_are_counted():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "x9": "2"}))
    assert (out["only_census"], out["only_state"], out["blocks_matching"]) == (1, 1, 3)
    assert out["share_blocks"] == 0.75


def test_share_vap_weights_blocks_by_voting_age_population():
    vap = pd.Series({"b1": 10, "b2": 0, "b3": 30, "b4": 60})
    # b4 lies outside every official shape: 40 of 100 adults confirmed
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2"}), vap)
    assert out["share_vap"] == pytest.approx(0.4)
    assert out["only_census"] == 1


def test_mapping_that_is_not_one_to_one_is_flagged():
    out = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "1", "b4": "1"}))
    assert out["district_mapping"] == "01=01;02=01"
    assert out["one_to_one"] is False


def test_result_text():
    same = {"blocks_census": 4, "blocks_state": 4, "only_census": 0, "only_state": 0, "blocks_matching": 4,
            "share_blocks": 1.0, "share_vap": None, "district_mapping": "01=01;02=02", "one_to_one": True}
    assert tool.result_text("block_file", same) == "Identical, block for block (4 blocks)"
    shapes = {**same, "blocks_matching": 3, "share_blocks": 0.75, "share_vap": 0.999991, "only_census": 1}
    assert tool.result_text("shapes", shapes) == (
        "75.0000% of 4 block points (99.9991% of voting-age population) lie in the matching district. "
        "Outside every district shape: 1")
    renumbered = {**same, "district_mapping": "01=02;02=01"}
    assert tool.result_text("block_file", renumbered) == (
        "Identical, block for block (4 blocks), with other district numbers: 01=02;02=01")


def test_rows_have_the_columns_the_report_reads():
    # gerry.validation.read_crosscheck accepts exactly STATE_FILES_COLUMNS, in this order
    result = tool.compare_assignments(CENSUS, series({"b1": "1", "b2": "1", "b3": "2", "b4": "2"}))
    row = tool.make_row("MO", tool.SOURCES["MO"], "2026-10-05", result)
    assert list(row) == list(STATE_FILES_COLUMNS)
    assert (row["state"], row["map"], row["source_kind"], row["retrieved"]) == (
        "MO", "HB 1 of 2025", "block_file", "2026-10-05")
    assert row["result"] == "Identical, block for block (4 blocks)"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_compare_state_files.py -v`
Expected: collection error `FileNotFoundError: [Errno 2] No such file or directory: '...\\tools\\compare_state_files.py'`.

- [ ] **Step 3: Write minimal implementation**

`tools/compare_state_files.py`:

```python
"""One-time comparison of the Census CD120 block file with the states' own files.

Needs network and is not part of `make all`. Downloads go to <data dir>/state_files/ and are reused.
Writes data/crosscheck/state_files.csv. Run from the repo root:

    .venv\\Scripts\\python tools/compare_state_files.py [STATE ...]
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import geopandas as gpd
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from gerry.blocks import read_bef, read_pl_blocks  # noqa: E402
from gerry.config import REPO_ROOT, data_dir  # noqa: E402
from gerry.validation import STATE_FILES_COLUMNS  # noqa: E402  (the columns docs/validation.md reads)

UA = {"User-Agent": "Mozilla/5.0 (gerrymandering-map; compare_state_files)"}
OUT = REPO_ROOT / "data" / "crosscheck" / "state_files.csv"

# Ohio's site blocks requests from outside the US; the URL is the Internet Archive copy of
# https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx
SOURCES = {
    "AL": {"fips": "01", "map": "Livingston Congressional Plan 3-2023", "kind": "shapes", "field": "DISTRICT",
           "url": "https://services7.arcgis.com/jF2q3LPxL7PETdYk/arcgis/rest/services/"
                  "2023_CONG_LEGISLATIVE_PLAN/FeatureServer/0"},
    "MO": {"fips": "29", "map": "HB 1 of 2025", "kind": "block_file", "columns": ["Block", "DistrictID"],
           "url": "https://www.arcgis.com/sharing/rest/content/items/c340c9dd07384cc6b1457a3fce96df19/data"},
    "OH": {"fips": "39", "map": "Ohio Redistricting Commission plan of 2025-10-31", "kind": "block_file",
           "columns": ["Block", "DistrictID:1"],
           "url": "https://web.archive.org/web/20260422123848id_/https://www.ohiosos.gov/assets/"
                  "uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx"},
    "TN": {"fips": "47", "map": "HB 7003 / SB 7004 of 2026", "kind": "shapes", "field": "DISTRICT",
           "url": "https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/"
                  "CONGRESSIONAL_DISTRICTS/FeatureServer/2"},
    "UT": {"fips": "49", "map": "Map 1A (UGRC layer us_congress_districts_2026_to_2032)", "kind": "shapes",
           "field": "DISTRICT",
           "url": "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/"
                  "political_us_congress_districts_2026_to_2032/FeatureServer/0"},
}


def compare_assignments(census: pd.Series, official: pd.Series, vap: pd.Series | None = None) -> dict:
    """Compare two block -> district assignments. District numbers may differ: each CD120 district is
    matched to the state district that holds most of its blocks."""
    census = census[census != "ZZ"]
    official = official.dropna().astype(str).str.strip().str.zfill(2)
    both = census.index.intersection(official.index)
    table = pd.crosstab(census.loc[both].to_numpy(), official.loc[both].to_numpy())
    mapping = {c: table.loc[c].idxmax() for c in table.index}
    matching = both[(official.loc[both].to_numpy() == census.loc[both].map(mapping).to_numpy())]
    share_vap = None
    if vap is not None:
        share_vap = float(vap.reindex(matching).sum() / vap.reindex(census.index).fillna(0).sum())
    return {
        "blocks_census": len(census),
        "blocks_state": len(official),
        "only_census": len(census.index.difference(official.index)),
        "only_state": len(official.index.difference(census.index)),
        "blocks_matching": len(matching),
        "share_blocks": len(matching) / len(census),
        "share_vap": share_vap,
        "district_mapping": ";".join(f"{c}={o}" for c, o in sorted(mapping.items())),
        "one_to_one": len(set(mapping.values())) == len(mapping) == census.nunique(),
    }


def result_text(kind: str, r: dict) -> str:
    """One line for the comparison table in data/sources.md."""
    pairs = [pair.split("=") for pair in r["district_mapping"].split(";") if pair]
    renumbered = any(c != o for c, o in pairs)
    if kind == "block_file":
        n = r["blocks_census"]
        if r["blocks_matching"] == n == r["blocks_state"] and r["only_state"] == 0:
            text = f"Identical, block for block ({n:,} blocks)"
        else:
            text = (f"{n - r['blocks_matching']:,} of {n:,} blocks differ; {r['only_census']:,} only in CD120, "
                    f"{r['only_state']:,} only in the state file")
    else:
        text = (f"{r['share_blocks']:.4%} of {r['blocks_census']:,} block points ({r['share_vap']:.4%} of "
                f"voting-age population) lie in the matching district")
        if r["only_census"]:
            text += f". Outside every district shape: {r['only_census']:,}"
    if renumbered:
        text += f", with other district numbers: {r['district_mapping']}"
    if not r["one_to_one"]:
        text += ". The district mapping is not one-to-one"
    return text


def make_row(postal: str, src: dict, retrieved: str, result: dict) -> dict:
    """One row of state_files.csv, with the keys of STATE_FILES_COLUMNS in that order."""
    row = {"state": postal, "map": src["map"], "source_kind": src["kind"], "source_url": src["url"],
           "retrieved": retrieved, **result, "result": result_text(src["kind"], result)}
    if list(row) != list(STATE_FILES_COLUMNS):
        raise ValueError(f"{postal}: row keys {list(row)} differ from STATE_FILES_COLUMNS")
    return row


def download(url: str, target: Path) -> Path:
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as response:
        data = response.read()
    part = target.with_name(target.name + ".part")
    part.write_bytes(data)
    os.replace(part, target)
    return target


def read_block_xlsx(path: Path, columns: list[str]) -> pd.Series:
    df = pd.read_excel(path, dtype=str, usecols=[0, 1])
    if list(df.columns) != columns:
        raise ValueError(f"{path.name}: columns {list(df.columns)}, expected {columns}")
    return pd.Series(df[columns[1]].to_numpy(), index=pd.Index(df[columns[0]].to_numpy(), name="block_id"))


def fetch_layer(url: str, field: str, target: Path) -> gpd.GeoDataFrame:
    """All features of an ArcGIS feature layer as GeoJSON in EPSG:4326, cached in target."""
    if not target.exists():
        features, offset = [], 0
        while True:
            query = urllib.parse.urlencode({"where": "1=1", "outFields": field, "outSR": 4326, "f": "geojson",
                                            "resultOffset": offset, "resultRecordCount": 1000})
            request = urllib.request.Request(f"{url}/query?{query}", headers=UA)
            with urllib.request.urlopen(request, timeout=300) as response:
                page = json.load(response)
            if "error" in page:
                raise RuntimeError(f"{url}: {page['error']}")
            features += page["features"]
            more = page.get("exceededTransferLimit") or page.get("properties", {}).get("exceededTransferLimit")
            if not more:
                break
            offset += len(page["features"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    shapes = gpd.read_file(target)
    shapes["district"] = shapes[field].map(lambda v: str(int(v)).zfill(2))
    return shapes[["district", "geometry"]].to_crs("EPSG:4326")


def shape_assignment(shapes: gpd.GeoDataFrame, blocks: pd.DataFrame) -> pd.Series:
    """block_id -> district of the state shape that contains the block's internal point."""
    points = gpd.GeoDataFrame({"block_id": blocks["block_id"].to_numpy()},
                              geometry=gpd.points_from_xy(blocks["lon"], blocks["lat"]), crs="EPSG:4326")
    hits = gpd.sjoin(points, shapes, how="inner", predicate="within").drop_duplicates("block_id")
    return pd.Series(hits["district"].to_numpy(), index=pd.Index(hits["block_id"].to_numpy(), name="block_id"))


def compare_state(postal: str, root: Path) -> dict:
    src = SOURCES[postal]
    cache = root / "state_files"
    census = read_bef(root / "census" / "cd120.zip", "cd120", src["fips"], postal)
    if src["kind"] == "block_file":
        path = download(src["url"], cache / f"{postal}_block_file.xlsx")
        result = compare_assignments(census, read_block_xlsx(path, src["columns"]))
    else:
        path = cache / f"{postal}_districts.geojson"
        shapes = fetch_layer(src["url"], src["field"], path)
        blocks = read_pl_blocks(root / "census" / "pl" / f"{postal.lower()}2020.pl.zip", postal.lower())
        result = compare_assignments(census, shape_assignment(shapes, blocks), blocks.set_index("block_id")["vap"])
    return make_row(postal, src, date.fromtimestamp(path.stat().st_mtime).isoformat(), result)


def main(states: list[str]) -> None:
    rows = []
    for postal in states:
        rows.append(compare_state(postal, data_dir()))
        print(f"{postal}: {rows[-1]['result']}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=list(STATE_FILES_COLUMNS)).to_csv(OUT, index=False, lineterminator="\n")
    print(f"Wrote {OUT.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main([s.upper() for s in sys.argv[1:]] or sorted(SOURCES))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_compare_state_files.py -v`
Expected: `7 passed`.

- [ ] **Step 5: Run the comparison**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python tools/compare_state_files.py`

Expected (sandboxrun van 5 oktober 2026, ongeveer 80 seconden):

```
AL: 100.0000% of 185,976 block points (100.0000% of voting-age population) lie in the matching district
MO: Identical, block for block (253,632 blocks)
OH: Identical, block for block (276,428 blocks)
TN: 100.0000% of 179,717 block points (100.0000% of voting-age population) lie in the matching district
UT: 100.0000% of 71,207 block points (100.0000% of voting-age population) lie in the matching district
Wrote data\crosscheck\state_files.csv
```

In alle vijf staten is de koppeling `01=01`, `02=02` enzovoort. Wijkt een uitkomst af, of geeft een bron een HTTP-fout, stop dan en leg de uitvoer voor aan de eigenaar. Pas niets aan in de pijplijn.

Draai het script voor de definitieve CSV altijd zonder argumenten. Met staten als argument (`tools/compare_state_files.py UT`) schrijft het een CSV met alleen die staten; dat is alleen bedoeld om één bron opnieuw te proberen.

- [ ] **Step 6: Update the comparison table in data/sources.md**

Vervang in `data/sources.md`, onder "Comparison of CD120 with the states' own files", de rij

```
| AL, OH, TN, UT, MO (HB 1) | To be checked with `tools/compare_state_files.py` (block files for OH and MO HB 1; official shapes for AL from ALGeoHub, TN from the state GIS layer, UT from UGRC) |
```

door de vijf rijen hieronder, en zet de zin eronder direct na de tabel:

```
| OH | Identical, block for block (276,428 blocks). State file from the Internet Archive copy of 2026-04-22 |
| MO (HB 1) | Identical, block for block (253,632 blocks) |
| AL | Every block point (185,976) lies in the same district of the state's map layer on ALGeoHub |
| TN | Every block point (179,717) lies in the same district of the state's map layer (TN STS) |
| UT | Every block point (71,207) lies in the same district of the UGRC layer for Map 1A |

Details in `data/crosscheck/state_files.csv`, made with `tools/compare_state_files.py`.
```

Gebruik de getallen uit je eigen run als ze afwijken van deze. Verwijder onder "Open items" de regel `- Compare CD120 with the official files for AL, OH, TN, UT and MO HB 1.`

- [ ] **Step 7: Ask the owner for the name of Utah's map**

De naam van de kaart van Utah is een open punt in `data/sources.md`. Kies hem niet zelf. Leg de eigenaar het bewijs voor:

- Rechtbankstukken noemen de kaart "Map 1". Dat is de kaart van de eisers die de rechter aannam.
- De UGRC-laag noemt hem "Map 1A". Volgens de beschrijving van die laag is dat Map 1 met kleine aanpassingen, gemaakt nadat de staat om verduidelijking vroeg.
- In Step 5 lagen de interne punten van alle 71.207 CD120-blokken van Utah in hetzelfde district van de UGRC-laag voor Map 1A (100,0000%).

Vraag welke linktekst de rij UT in `data/sources.md` krijgt. Dezelfde tekst wordt `map_name` op de site. Voorbeelden zijn `Court-adopted Map 1` (zoals nu) en `Court-adopted Map 1A`. Wacht op het antwoord.

Voer het besluit in beide bestanden tegelijk uit:

- Houdt de eigenaar `Court-adopted Map 1`, dan blijven `data/sources.md` en `pipeline/config.yaml` zoals ze zijn.
- Kiest de eigenaar een andere naam, vervang dan in `data/sources.md`, tabel "Multi-seat states", rij UT, de linktekst `Court-adopted Map 1` door die naam (de URL blijft), en zet in `pipeline/config.yaml` bij staat `UT` precies dezelfde tekst als `map_name`. Wil de eigenaar het verschil tussen Map 1 en Map 1A in `data/sources.md` toelichten, zet die zin dan, in de woorden die hij goedkeurt, aan het begin van de cel "Notes and litigation".

Verwijder in beide gevallen onder "Open items" de regel `- Utah: settle the official name of the map ("Map 1" in court filings, "Map 1A" in the state GIS layer).`

- [ ] **Step 8: Verify config.yaml and sources.md still agree**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import sys; sys.path.insert(0, 'pipeline'); from gerry.config import load_config, REPO_ROOT; from gerry.checks import check_sources_md; check_sources_md(load_config(), REPO_ROOT / 'data' / 'sources.md'); print('sources.md matches config.yaml')"`
Expected: `sources.md matches config.yaml`.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 9: Rebuild the validation report**

Nu bestaan alle drie de kruiscontrolebestanden, `planscore.csv` en `dra.csv` uit taak 2.13 en 2.14 en `state_files.csv` uit Step 5.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: dezelfde 44 staatsregels en dezelfde regel `US: ...` als in taak 2.11, en als laatste `Wrote ...\docs\validation.md: Open items: 0. Pending: 0.`

Run: `Select-String -Path docs\validation.md -SimpleMatch -Pattern '**Open items: 0.** Pending: 0.'`

Expected: één treffer.

Staat er een open punt onder de samenvattingsregel, bijvoorbeeld `UT state_files: ...`, lees dan de sectie "CD120 against state files". Is de oorzaak aangetoond, schrijf dan onder de sleutel `state_files` van die staat een verklaring in `data/validation_notes.yaml`, met de getallen en de bron, zoals in taak 2.15, en draai `03_metrics.py` opnieuw. Is de oorzaak niet duidelijk, stop en vraag de eigenaar; pas niets aan in de pijplijn. Is `Pending` groter dan 0, dan ontbreekt `planscore.csv` of `dra.csv`. Maak dan eerst taak 2.13 en 2.14 af.

- [ ] **Step 10: Regenerate results.json**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/04_export.py`
Expected: dezelfde uitvoer als in taak 3.5, stap 7.

Run: `.venv\Scripts\python -c "import json; print(json.load(open('site/data/results.json',encoding='utf-8'))['states']['UT']['map_name'])"`
Expected: de naam uit Step 7, gelijk aan de linktekst van de rij UT in `data/sources.md`.

- [ ] **Step 11: Commit**

```bash
git add tools/compare_state_files.py tests/test_compare_state_files.py data/crosscheck/state_files.csv data/sources.md pipeline/config.yaml data/validation_notes.yaml docs/validation.md site/data/results.json site/data/map.topojson
git commit -m "Compare CD120 with state files for AL, MO, OH, TN and UT"
```

### Task 3.7: status opnieuw controleren (ook vlak voor publicatie)

**Files:**
- Modify: `data/sources.md`
- Modify: `pipeline/config.yaml` (`status_checked`, `status` per staat)
- Modify (gegenereerd): `site/data/results.json`

**Interfaces:**
- Consumes: `check_sources_md` (taak 0.5), `04_export` (taak 3.5).
- Produces: een `data/sources.md` en `config.yaml` met dezelfde datum van statuscontrole, en een `results.json` met die datum in `meta.status_checked`.

Deze taak is een procedure zonder nieuwe code. Voer hem nu uit, na de eerste volledige export, zodat `results.json` een actuele status heeft. Vlak voor publicatie voert Task 4.4 (Step 7) deze taak opnieuw volledig uit, stap 1 tot en met 6, met dezelfde tabel (stap 1) en dezelfde beslisregels (stap 2). Een nieuw punt om na te gaan komt daarom in de tabel hieronder, niet in Task 4.4.

- [ ] **Step 1: Re-check every item**

Zoek per punt naar nieuws sinds de datum in de regel `Status checked on ...` direct onder de titel van `data/sources.md`. Gebruik bij voorkeur de site van de rechtbank of de staat; anders een recente nieuwsbron met datum.

| Punt | Wat nagaan |
|---|---|
| Open items in `data/sources.md` | Louisiana: uitspraak in Callais v. Landry over SB 121, nieuwe zaken. North Carolina: uitspraak in Gallop v. Hirsch. Illinois: uitspraak in Ives v. Pritzker. Connecticut: hoger beroep in Ingersoll v. Connecticut. Missouri: hoe kandidaten die op de lijnen van HB 1 zijn gekozen passen op de districten van 2022 |
| Staten met status Challenged | AL, CA, FL, GA, IL, LA, NC, TN, TX, UT, WI: nieuwe uitspraken, afgewezen of ingetrokken zaken, hoger beroep |
| Staten met status In effect | Nieuwe zaken tegen de kaart (dan wordt de status Challenged) |
| Missouri, Proposition A | Uitslag van 3 november 2026, als de publicatie daarna valt |
| Louisiana | Runoff op 12 december 2026; verandert niets aan de kaart, wel aan de toelichting in de kolom "Notes and litigation" |
| ALARM | Staat er een versie 16 op Dataverse (doi:10.7910/DVN/SLCD3E), of zijn de race-blinde ensembles (doi:10.7910/DVN/A3SE7Y) of de dataset met 2024-scores (doi:10.7910/DVN/KI4BHR) openbaar? De noten `alarm_rerun_unpublished` en `alarm_method_update_pending` zeggen dat dit niet zo is |

- [ ] **Step 2: Decide per finding**

- Alleen de juridische status verandert (In effect naar Challenged of terug): pas de cel "Status" en de cel "Notes and litigation" aan in `data/sources.md`, en `status` van die staat in `pipeline/config.yaml`.
- De kaart waarmee op 3 november 2026 gestemd wordt is veranderd (nieuwe kaart, rechterlijk bevel): stop en vraag de eigenaar. Dan zijn een ander blokbestand en een nieuwe run vanaf `02_join` nodig.
- Proposition A is aangenomen of verworpen: stop en vraag de eigenaar. De tekst van de noot `blocked_map` en de status `Blocked` van HB 1 beschrijven de situatie voor de stemming. Een nieuwe tekst gaat in de notentabel van de spec en in `NOTE_TEXTS` tegelijk; de test uit taak 3.1 dwingt dat af.
- ALARM heeft nieuwe ensembles gepubliceerd: stop en vraag de eigenaar. Wisselen van ensembleset is een besluit, en de twee noten over ALARM kloppen dan niet meer.
- Alles in een open punt is opgelost: haal het weg onder "Open items". Een nieuw open punt komt erbij.

- [ ] **Step 3: Set the check date in both files**

Vervang in `data/sources.md` de regel direct onder de titel (`# Map sources and status by state` blijft staan) door: `Status checked on YYYY-MM-DD. Check again right before publishing.`, met de datum van vandaag. Zet dezelfde datum in `pipeline/config.yaml`: `status_checked: YYYY-MM-DD`.

- [ ] **Step 4: Verify both files agree**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import sys; sys.path.insert(0, 'pipeline'); from gerry.config import load_config, REPO_ROOT; from gerry.checks import check_sources_md; check_sources_md(load_config(), REPO_ROOT / 'data' / 'sources.md'); print('sources.md matches config.yaml')"`
Expected: `sources.md matches config.yaml`.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -v`
Expected: alle tests slagen.

- [ ] **Step 5: Re-run the export**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/04_export.py` (of `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make export`, zodat Make de Python uit `.venv` gebruikt)
Expected: dezelfde uitvoer als in taak 3.5, stap 7. `map.topojson` verandert niet zolang de geometrie gelijk blijft.

Run: `.venv\Scripts\python -c "import json; r=json.load(open('site/data/results.json',encoding='utf-8')); print(r['meta']['status_checked'], sorted((k, s['status']) for k, s in r['states'].items() if s['status'] != 'In effect'))"`
Expected: de nieuwe datum en de lijst van staten met status Challenged, gelijk aan `data/sources.md`.

- [ ] **Step 6: Commit**

```bash
git add data/sources.md pipeline/config.yaml site/data/results.json site/data/map.topojson
git commit -m "Recheck map status"
```

## Phase 4: site (vastgelegd deel)

De spec legt voor de site drie dingen vast: de opmaak van getallen (hoofdstuk 8), de vorm van `results.json` en `map.topojson` (hoofdstuk 7) en de klaar-criteria (hoofdstuk 11). Deze fase bouwt de formatter en de contracttest, regelt de ontwerpsessie voor de rest van de site, en eindigt met de eindcontrole. Het visuele ontwerp en de bouw van de pagina zelf staan in een apart plan dat Task 4.3 oplevert; Task 4.4 draait pas als dat plan is uitgevoerd.

Alle commando's draaien in PowerShell vanuit de worktree-root `C:\projects\Gerry\.worktrees\pipeline-setup`.

### Task 4.1: site/js/format.js

**Files:**
- Create: `site/js/format.test.js`
- Create: `site/js/format.js`

**Interfaces:**
- Consumes: het npm-script `test` = `node --test "site/js/*.test.js"` en `"type": "module"` uit `package.json` (Task 0.2).
- Produces (ES-module `site/js/format.js`, voor alle code van de site):
  - `roundHalfUp(value: number, decimals: number, shift = 0) -> string`: half-up op de decimale waarde, na `shift` plaatsen verschuiven. Alleen niet-negatieve eindige getallen, anders `TypeError`.
  - `share(fraction: number) -> string`: stemaandeel, `0.547901` wordt `"54.8%"`.
  - `planShare(fraction: number) -> string`: aandeel plannen, `3086/5000` wordt `"62%"`.
  - `advantage(value: number | null) -> string`: EG of MM, `0.042` wordt `"favors Republicans by 4.2 points"`, `null` wordt `"Not defined for two districts"`.
  - `seats(n: number) -> string`: `17` wordt `"17"`.
  - Alle functies gooien `TypeError` bij ongeldige invoer (geen getal, buiten 0 tot 1 voor aandelen, geen geheel getal voor zetels).

De regels uit hoofdstuk 8, zoals de code ze toepast:

- Afronden is half-up op de decimale waarde. `roundHalfUp` neemt de kortste decimale vorm van het getal (`toExponential()` zonder argument geeft die cijfers) en rondt die af met `BigInt`. Nooit `Math.round` of `toFixed` op een kommagetal: `0.285 * 100` is `28.499999999999996`, dus `Math.round` geeft 28 waar 29 hoort, en `(1.005).toFixed(2)` geeft `"1.00"`.
- `share`: procent met één decimaal. Geeft dat `50.0`, dan twee decimalen. Geeft dat nog `50.00`, dan `"just under 50%"` of `"just over 50%"`. Precies `0.5` geeft `"exactly 50%"`. De spec noemt dat geval niet; Step 5 legt de tekst samen met de andere zichtbare teksten langs de unslop-skill.
- `planShare`: hele procenten. Groter dan 0 maar afgerond 0 wordt `"<1%"`; kleiner dan 1 maar afgerond 100 wordt `">99%"`. Alleen exact 0 en 1 worden `"0%"` en `"100%"`.
- `advantage`: procentpunten met één decimaal, positief is gunstig voor Republikeinen (EG en MM, hoofdstuk 5). Afgerond 0.0 wordt `"Less than 0.05 points either way"`.
- `seats`: geheel getal, niet negatief. Hoe de site een effect met teken toont (`+11`, `−1`) beslist de ontwerpsessie (Task 4.3).

- [ ] **Step 1: Schrijf de tests `site/js/format.test.js`**

Elk geval staat met de handberekening in het commentaar. De gevallen met een `Math.round`- of `toFixed`-commentaar falen bij een naïeve implementatie; in de sandbox faalden daarmee drie tests.

```js
// Tests for site/js/format.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundHalfUp, share, planShare, advantage, seats } from './format.js';

test('roundHalfUp rounds the decimal value, not the binary float', () => {
  // (1.005).toFixed(2) gives "1.00": the float is 1.00499999999999989...
  assert.equal(roundHalfUp(1.005, 2), '1.01');
  // Math.round(0.285 * 100) gives 28: 0.285 * 100 is 28.499999999999996.
  assert.equal(roundHalfUp(0.285, 0, 2), '29');
  // (0.1235 * 100).toFixed(1) gives "12.3".
  assert.equal(roundHalfUp(0.1235, 1, 2), '12.4');
  // Math.round(0.5005 * 1000) / 10 gives 50: 0.5005 * 1000 is 500.49999999999994.
  assert.equal(roundHalfUp(0.5005, 1, 2), '50.1');
  assert.equal(roundHalfUp(0.995, 0, 2), '100');
});

test('roundHalfUp handles zero, one, tiny values and padding', () => {
  assert.equal(roundHalfUp(0, 1, 2), '0.0');
  assert.equal(roundHalfUp(1, 1, 2), '100.0');
  assert.equal(roundHalfUp(1e-7, 1, 2), '0.0');
  assert.equal(roundHalfUp(0.0004, 2, 2), '0.04');
  assert.equal(roundHalfUp(123.456, 0), '123');
  assert.equal(roundHalfUp(2.5, 0), '3');
});

test('roundHalfUp rejects negative and non-finite input', () => {
  for (const bad of [-0.1, Number.NaN, Infinity, '0.5', null, undefined]) {
    assert.throws(() => roundHalfUp(bad, 1), TypeError, String(bad));
  }
});

test('share: percent with one decimal', () => {
  assert.equal(share(0.547901), '54.8%');
  assert.equal(share(0.436352), '43.6%');
  assert.equal(share(0.4945), '49.5%');
  assert.equal(share(0.5005), '50.1%'); // 50.05 rounds up to 50.1, away from 50.0
  assert.equal(share(0.5015), '50.2%'); // Math.round(0.5015 * 1000) / 10 gives 50.1
  assert.equal(share(0), '0.0%');
  assert.equal(share(1), '100.0%');
});

test('share: two decimals when one decimal would show 50.0%', () => {
  assert.equal(share(0.4995), '49.95%'); // 49.95 -> 50.0 -> 49.95
  assert.equal(share(0.5004), '50.04%');
  assert.equal(share(0.50049), '50.05%'); // 50.049 -> 50.0 -> 50.05
  assert.equal(share(0.50005), '50.01%'); // 50.005 -> 50.0 -> 50.01
});

test('share: words when two decimals would still show 50.00%', () => {
  assert.equal(share(0.49996), 'just under 50%');
  assert.equal(share(0.49995), 'just under 50%'); // 49.995 -> 50.00
  assert.equal(share(0.500049), 'just over 50%');
  assert.equal(share(0.5), 'exactly 50%');
});

test('share rejects values outside 0 to 1', () => {
  for (const bad of [-0.01, 1.2, Number.NaN, '0.5', null]) {
    assert.throws(() => share(bad), TypeError, String(bad));
  }
});

test('planShare: whole percents', () => {
  assert.equal(planShare(3086 / 5000), '62%');
  assert.equal(planShare(1901 / 5000), '38%');
  assert.equal(planShare(0.125), '13%');
  assert.equal(planShare(0.5), '50%');
  assert.equal(planShare(4974 / 5000), '99%'); // 99.48
  assert.equal(planShare(1425 / 5000), '29%'); // 28.5; Math.round(0.285 * 100) gives 28
  assert.equal(planShare(2875 / 5000), '58%'); // 57.5; Math.round(0.575 * 100) gives 57
});

test('planShare: half-up at the edges, 25/5000 and 4975/5000', () => {
  assert.equal(planShare(25 / 5000), '1%'); // 0.5% rounds up to 1%
  assert.equal(planShare(4975 / 5000), '>99%'); // 99.5% rounds up to 100%, but it is not all plans
});

test('planShare: only exact 0 and 1 give 0% and 100%', () => {
  assert.equal(planShare(0), '0%');
  assert.equal(planShare(1), '100%');
  assert.equal(planShare(1 / 5000), '<1%');
  assert.equal(planShare(24 / 5000), '<1%'); // 0.48%
  assert.equal(planShare(4976 / 5000), '>99%');
  assert.equal(planShare(4999 / 5000), '>99%');
});

test('planShare rejects values outside 0 to 1', () => {
  for (const bad of [-0.0001, 1.0001, Number.NaN, '1']) {
    assert.throws(() => planShare(bad), TypeError, String(bad));
  }
});

test('advantage: points with one decimal and the favored party', () => {
  assert.equal(advantage(0.042), 'favors Republicans by 4.2 points');
  assert.equal(advantage(-0.042), 'favors Democrats by 4.2 points');
  assert.equal(advantage(0.1235), 'favors Republicans by 12.4 points');
  assert.equal(advantage(0.0005), 'favors Republicans by 0.1 points'); // 0.05 rounds up
  assert.equal(advantage(-0.0005), 'favors Democrats by 0.1 points');
});

test('advantage: values that round to 0.0 points', () => {
  assert.equal(advantage(0), 'Less than 0.05 points either way');
  assert.equal(advantage(-0), 'Less than 0.05 points either way');
  assert.equal(advantage(0.0004), 'Less than 0.05 points either way');
  assert.equal(advantage(-0.000499), 'Less than 0.05 points either way');
});

test('advantage: null mean-median for two districts', () => {
  assert.equal(advantage(null), 'Not defined for two districts');
});

test('advantage rejects non-numbers', () => {
  for (const bad of [Number.NaN, Infinity, undefined, '0.04']) {
    assert.throws(() => advantage(bad), TypeError, String(bad));
  }
});

test('seats: whole numbers as text', () => {
  assert.equal(seats(17), '17');
  assert.equal(seats(0), '0');
  assert.equal(seats(429), '429');
});

test('seats rejects fractions, negatives and text', () => {
  for (const bad of [2.5, -1, '3', Number.NaN, null]) {
    assert.throws(() => seats(bad), TypeError, String(bad));
  }
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npm test`

Expected: `✖ site\js\format.test.js` met `ERR_MODULE_NOT_FOUND` (`Cannot find module ...\site\js\format.js`). Totaal `pass 2`, `fail 1`; de twee geslaagde tests zijn `vendor.test.js`.

- [ ] **Step 3: Schrijf `site/js/format.js`**

```js
// Number formatting for the site (spec chapter 8, "Opmaak van getallen").
// The pipeline exports raw numbers; every number a visitor sees goes through
// this module.
//
// Rounding is half-up on the decimal value. We take the shortest decimal form
// of the number (the digits JavaScript prints for it) and round those digits
// with integer arithmetic. We never use Math.round or toFixed on a float:
// 0.285 * 100 is 28.499999999999996, so Math.round gives 28 instead of 29.

/**
 * Round a non-negative number half-up after moving the decimal point `shift`
 * places to the right. Returns text with exactly `decimals` decimals.
 * roundHalfUp(0.285, 0, 2) === '29'; roundHalfUp(1.005, 2) === '1.01'.
 * @param {number} value non-negative finite number
 * @param {number} decimals digits after the decimal point
 * @param {number} [shift=0] power of ten to multiply by first (2 = percent)
 * @returns {string}
 */
export function roundHalfUp(value, decimals, shift = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`expected a non-negative finite number, got ${value}`);
  }
  // toExponential() without an argument gives the shortest digits that
  // identify the number: 0.285 -> "2.85e-1".
  const [mantissa, exponent] = value.toExponential().split('e');
  const digits = mantissa.replace('.', '');
  // value = digits * 10^(exponent - (digits.length - 1)); we want the integer
  // round(value * 10^(shift + decimals)).
  const power = Number(exponent) - (digits.length - 1) + shift + decimals;
  let scaled = BigInt(digits);
  if (power >= 0) {
    scaled *= 10n ** BigInt(power);
  } else {
    const divisor = 10n ** BigInt(-power);
    const remainder = scaled % divisor;
    scaled /= divisor;
    if (2n * remainder >= divisor) scaled += 1n;
  }
  const text = scaled.toString().padStart(decimals + 1, '0');
  return decimals === 0 ? text : `${text.slice(0, -decimals)}.${text.slice(-decimals)}`;
}

function checkFraction(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`expected a fraction from 0 to 1, got ${value}`);
  }
}

/**
 * A vote share (fraction) as a percent with one decimal: 0.547901 -> "54.8%".
 * If that shows 50.0%, two decimals; if that still shows 50.00%, words.
 * @param {number} fraction
 * @returns {string}
 */
export function share(fraction) {
  checkFraction(fraction);
  const one = roundHalfUp(fraction, 1, 2);
  if (one !== '50.0') return `${one}%`;
  const two = roundHalfUp(fraction, 2, 2);
  if (two !== '50.00') return `${two}%`;
  if (fraction < 0.5) return 'just under 50%';
  if (fraction > 0.5) return 'just over 50%';
  return 'exactly 50%';
}

/**
 * A share of plans (fraction) as a whole percent: 3086/5000 -> "62%".
 * Above 0 but rounding to 0 gives "<1%"; below 1 but rounding to 100 gives ">99%".
 * @param {number} fraction
 * @returns {string}
 */
export function planShare(fraction) {
  checkFraction(fraction);
  if (fraction === 0) return '0%';
  if (fraction === 1) return '100%';
  const whole = roundHalfUp(fraction, 0, 2);
  if (whole === '0') return '<1%';
  if (whole === '100') return '>99%';
  return `${whole}%`;
}

/**
 * Efficiency gap or mean-median (fraction, positive favors Republicans) in
 * percentage points: 0.042 -> "favors Republicans by 4.2 points".
 * null (mean-median with two districts) -> "Not defined for two districts".
 * @param {number|null} value
 * @returns {string}
 */
export function advantage(value) {
  if (value === null) return 'Not defined for two districts';
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`expected a finite number or null, got ${value}`);
  }
  const points = roundHalfUp(Math.abs(value), 1, 2);
  if (points === '0.0') return 'Less than 0.05 points either way';
  return `favors ${value > 0 ? 'Republicans' : 'Democrats'} by ${points} points`;
}

/**
 * A seat count as a whole number: 17 -> "17".
 * @param {number} n
 * @returns {string}
 */
export function seats(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`expected a whole number of seats, got ${n}`);
  }
  return String(n);
}
```

- [ ] **Step 4: Draai de tests opnieuw**

Run: `npm test`

Expected: `tests 19`, `pass 19`, `fail 0` (17 in `format.test.js`, 2 in `vendor.test.js`).

- [ ] **Step 5: Haal de zichtbare teksten door de unslop-skill**

Roep de unslop-skill aan op elke tekst die `format.js` aan bezoekers toont: `exactly 50%`, `just under 50%`, `just over 50%`, het patroon `favors Republicans by 4.2 points` en `favors Democrats by 4.2 points` (`favors ... by ... points`), `Less than 0.05 points either way` en `Not defined for two districts`.

Expected: geen wijzigingen. Stelt de skill een andere tekst voor, leg die dan voor aan de eigenaar; de spec is goedgekeurd. Een wijziging die de eigenaar goedkeurt, gaat tegelijk in hoofdstuk 8 van de spec (ook voor `exactly 50%`, dat de spec nu niet noemt), in `site/js/format.js` en in de verwachte waarden in `site/js/format.test.js`. Pas ook Task 4.3 en Task 4.4 Step 8 van dit plan aan als ze een gewijzigde tekst citeren. Draai daarna `npm test` opnieuw. Expected: `pass 19`, `fail 0`.

- [ ] **Step 6: Commit**

Heeft de eigenaar in Step 5 een wijziging goedgekeurd, zet dan ook de spec en het plan in deze commit: `git add docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md docs/superpowers/plans/2026-10-05-gerrymandering-map.md`.

```powershell
git add site/js/format.js site/js/format.test.js
git commit -m "Add number formatting for the site with half-up rounding"
```

### Task 4.2: site/js/contract.test.js

**Files:**
- Create: `site/js/contract.test.js`

**Interfaces:**
- Consumes: `site/data/results.json` (geschreven door `build_results` in `04_export`) en `site/data/map.topojson` (geschreven door `build_topojson`), met de vorm uit hoofdstuk 7 van de spec.
- Produces: een test die de site tegen de uitvoer van de pijplijn afschermt. Ontbreekt een van beide bestanden, dan slaat hij alle acht tests over met de melding `site data not generated yet (missing site/data/results.json, ...); run make export first`.

Wat de test controleert:

- `meta`: `generated` als datum, `ensemble` met precies `name`, `doi`, `version`, `census_vest_commit` van 40 tekens, `vote_basis` gelijk aan `["pre_16","pre_20"]`, `status_checked` als datum.
- Landelijk: 44 staten, `seats` 429 en gelijk aan de som over de staten. `proportional` en `enacted` zijn de som over de staten. `neutral.dist` heeft 430 kansen die optellen tot 1. Zes `single_seat`-staten (AK, DE, ND, SD, VT, WY), en geen daarvan onder `states`.
- Per staat alle velden uit hoofdstuk 7, met typen en bereiken. `status` is `In effect` of `Challenged`. Noot-sleutels komen uit de twaalf bekende sleutels en hebben tekst. `mm` is `null` precies bij twee districten.
- Samenhang per staat: `neutral.dist` heeft `seats + 1` tellingen die optellen tot 5.000; `p5 <= median <= p95`; `position` telt op tot 1 en `midrank = fewer + equal / 2`; `effects.geographic = median - proportional`, `effects.drawing = enacted - median`; `outside_band` volgt uit `enacted`, `p5` en `p95`; district-id's zijn FIPS plus twee cijfers, uniek, `seats` stuks; `share` past bij `d / (d + r)` (marge 1e-4, want `d` en `r` zijn afgerond); `sorted.enacted` is de gesorteerde lijst van districtsaandelen; `p5 <= p50 <= p95` per positie; `enacted` is het aantal districten met aandeel boven 0,5, met ruimte voor exacte gelijke standen.
- Alleen Missouri heeft `blocked_map`, met `status` `Blocked`, bron, `enacted`, acht districten en `position`.
- TopoJSON: `type` is `Topology`. De laag `districts` heeft per staat precies de district-id's uit `results.json`; elke staat met één zetel is één district `<fips>00`; elke geometrie heeft een type. De laag `states` heeft 50 objecten en `id` (FIPS) en `postal` passen bij `results.json`. Id's en postcodes staan in `properties`, niet in `geometry.id`.
- Zichtbare tekst in `results.json` (naam, kaartnaam, bronlabel, noot-teksten, naam van de geblokkeerde kaart) bevat geen em-dash.

De marges zijn krap (1e-9 voor `position`, 1e-6 voor de som van `dist`). Dat klopt met hoofdstuk 7 en 8: Python exporteert ruwe getallen en rondt alleen stemmen af.

- [ ] **Step 1: Schrijf `site/js/contract.test.js`**

```js
// Contract between the pipeline output and the site (spec chapter 7).
// Reads site/data/results.json and site/data/map.topojson, written by
// pipeline/04_export.py. Skips with a message until both files exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RESULTS = fileURLToPath(new URL('../data/results.json', import.meta.url));
const TOPOLOGY = fileURLToPath(new URL('../data/map.topojson', import.meta.url));
const missing = [[RESULTS, 'site/data/results.json'], [TOPOLOGY, 'site/data/map.topojson']]
  .filter(([path]) => !existsSync(path))
  .map(([, name]) => name);
const skip = missing.length > 0
  ? `site data not generated yet (missing ${missing.join(', ')}); run make export first`
  : false;

const SINGLE_SEAT = ['AK', 'DE', 'ND', 'SD', 'VT', 'WY'];
const PLANS = 5000;
const NOTE_KEYS = [
  'vra_constraint', 'core_preservation_prior_map', 'core_preservation_2010',
  'competitiveness_rule', 'vra_filter_with_votes', 'vra_filter_bvap',
  'alarm_rerun_unpublished', 'alarm_method_update_pending', 'narrow_ensemble',
  'adopted_after_2024_election', 'composite_2020_only', 'blocked_map',
];
const STATE_FIELDS = [
  'name', 'fips', 'seats', 'map_name', 'status', 'source', 'notes', 'd_share',
  'proportional', 'enacted', 'neutral', 'position', 'effects', 'outside_band',
  'eg', 'mm', 'districts', 'sorted',
];

let cache;
function data() {
  cache ??= {
    results: JSON.parse(readFileSync(RESULTS, 'utf8')),
    topology: JSON.parse(readFileSync(TOPOLOGY, 'utf8')),
  };
  return cache;
}

const isInt = (v) => Number.isInteger(v);
const isFraction = (v) => typeof v === 'number' && v >= 0 && v <= 1;
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const sameSet = (a, b) => assert.deepEqual([...new Set(a)].sort(), [...new Set(b)].sort());

function checkPosition(position, where) {
  for (const key of ['fewer', 'equal', 'more', 'midrank']) {
    assert.ok(isFraction(position[key]), `${where}.position.${key}`);
  }
  assert.ok(near(position.fewer + position.equal + position.more, 1, 1e-9), `${where}.position sums to 1`);
  assert.ok(near(position.midrank, position.fewer + position.equal / 2, 1e-9), `${where}.position.midrank`);
}

function checkNeutral(neutral, length, total, where) {
  for (const key of ['median', 'p5', 'p95']) assert.ok(isInt(neutral[key]), `${where}.neutral.${key}`);
  assert.ok(neutral.p5 <= neutral.median && neutral.median <= neutral.p95, `${where}.neutral order`);
  assert.equal(neutral.dist.length, length, `${where}.neutral.dist length`);
  assert.ok(near(sum(neutral.dist), total, 1e-6), `${where}.neutral.dist sums to ${total}`);
}

function checkEffects(block, proportional, where) {
  const { neutral, enacted, effects } = block;
  assert.equal(effects.geographic, neutral.median - proportional, `${where}.effects.geographic`);
  assert.equal(effects.drawing, enacted - neutral.median, `${where}.effects.drawing`);
  assert.equal(block.outside_band, enacted < neutral.p5 || enacted > neutral.p95, `${where}.outside_band`);
}

function checkDistricts(districts, fips, seats, where) {
  assert.equal(districts.length, seats, `${where}.districts length`);
  for (const d of districts) {
    assert.match(d.id, new RegExp(`^${fips}\\d{2}$`), `${where} district id ${d.id}`);
    assert.ok(isFraction(d.share), `${where} ${d.id}.share`);
    assert.ok(isInt(d.d) && isInt(d.r) && d.d + d.r > 0, `${where} ${d.id} votes`);
    assert.ok(near(d.share, d.d / (d.d + d.r), 1e-4), `${where} ${d.id}.share matches d and r`);
  }
  assert.equal(new Set(districts.map((d) => d.id)).size, seats, `${where} district ids unique`);
}

function checkSeatsMatchDistricts(enacted, districts, where) {
  // A district is Democratic when D > R; an exact tie (share 0.5) is decided by 2020 alone.
  const wins = districts.filter((d) => d.share > 0.5).length;
  const ties = districts.filter((d) => d.share === 0.5).length;
  assert.ok(wins <= enacted && enacted <= wins + ties, `${where}: enacted ${enacted}, districts give ${wins}`);
}

function checkMeasure(measure, where) {
  for (const key of ['value', 'median', 'p5', 'p95']) {
    assert.ok(typeof measure[key] === 'number' && Number.isFinite(measure[key]), `${where}.${key}`);
  }
  assert.ok(measure.p5 <= measure.median && measure.median <= measure.p95, `${where} order`);
}

function checkSource(source, where) {
  assert.ok(typeof source.label === 'string' && source.label.length > 0, `${where}.source.label`);
  assert.match(source.url, /^https:\/\//, `${where}.source.url`);
}

test('meta has the fields of chapter 7', { skip }, () => {
  const { meta } = data().results;
  assert.match(meta.generated, /^\d{4}-\d{2}-\d{2}/);
  assert.deepEqual(Object.keys(meta.ensemble).sort(), ['doi', 'name', 'version']);
  assert.match(meta.census_vest_commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(meta.vote_basis, ['pre_16', 'pre_20']);
  assert.match(meta.status_checked, /^\d{4}-\d{2}-\d{2}$/);
});

test('national totals add up to 429, with the six single-seat states apart', { skip }, () => {
  const { national, states } = data().results;
  const all = Object.values(states);
  assert.equal(all.length, 44);
  assert.equal(national.seats, 429);
  assert.equal(sum(all.map((s) => s.seats)), 429);
  assert.equal(national.proportional, sum(all.map((s) => s.proportional)));
  assert.equal(national.enacted, sum(all.map((s) => s.enacted)));
  checkNeutral(national.neutral, 430, 1, 'national');
  checkPosition(national.position, 'national');
  checkEffects(national, national.proportional, 'national');
  assert.deepEqual(national.single_seat.map((s) => s.postal).sort(), SINGLE_SEAT);
  for (const s of national.single_seat) {
    assert.match(s.fips, /^\d{2}$/);
    assert.ok(s.name.length > 0);
    assert.ok(!(s.postal in states), `${s.postal} is single-seat and must not be in states`);
  }
});

test('every state has the fields of chapter 7', { skip }, () => {
  for (const [postal, s] of Object.entries(data().results.states)) {
    for (const field of STATE_FIELDS) assert.ok(field in s, `${postal}.${field} missing`);
    assert.match(s.fips, /^\d{2}$/, `${postal}.fips`);
    assert.ok(isInt(s.seats) && s.seats >= 2, `${postal}.seats`);
    assert.ok(['In effect', 'Challenged'].includes(s.status), `${postal}.status`);
    checkSource(s.source, postal);
    for (const note of s.notes) {
      assert.ok(NOTE_KEYS.includes(note.key), `${postal} note key ${note.key}`);
      assert.ok(typeof note.text === 'string' && note.text.length > 0, `${postal} note ${note.key} text`);
    }
    assert.ok(isFraction(s.d_share), `${postal}.d_share`);
    assert.ok(isInt(s.proportional) && s.proportional >= 0 && s.proportional <= s.seats, `${postal}.proportional`);
    assert.ok(isInt(s.enacted) && s.enacted >= 0 && s.enacted <= s.seats, `${postal}.enacted`);
    assert.ok(typeof s.outside_band === 'boolean', `${postal}.outside_band`);
    checkMeasure(s.eg, `${postal}.eg`);
    if (s.seats < 3) assert.equal(s.mm, null, `${postal}.mm must be null with two districts`);
    else checkMeasure(s.mm, `${postal}.mm`);
  }
});

test('neutral band, position, effects and districts agree per state', { skip }, () => {
  for (const [postal, s] of Object.entries(data().results.states)) {
    checkNeutral(s.neutral, s.seats + 1, PLANS, postal);
    checkPosition(s.position, postal);
    checkEffects(s, s.proportional, postal);
    checkDistricts(s.districts, s.fips, s.seats, postal);
    for (const key of ['enacted', 'p5', 'p50', 'p95']) {
      assert.equal(s.sorted[key].length, s.seats, `${postal}.sorted.${key} length`);
    }
    const shares = s.districts.map((d) => d.share).sort((a, b) => a - b);
    assert.deepEqual(s.sorted.enacted, shares, `${postal}.sorted.enacted is the sorted district shares`);
    s.sorted.p50.forEach((p50, i) => {
      assert.ok(s.sorted.p5[i] <= p50 && p50 <= s.sorted.p95[i], `${postal}.sorted order at ${i}`);
    });
    checkSeatsMatchDistricts(s.enacted, s.districts, postal);
  }
});

test('only Missouri has a blocked map, with the fields of chapter 7', { skip }, () => {
  const { states } = data().results;
  const withBlocked = Object.keys(states).filter((postal) => 'blocked_map' in states[postal]);
  assert.deepEqual(withBlocked, ['MO']);
  const b = states.MO.blocked_map;
  assert.ok(typeof b.name === 'string' && b.name.length > 0);
  assert.equal(b.status, 'Blocked');
  checkSource(b.source, 'MO.blocked_map');
  assert.ok(isInt(b.enacted) && b.enacted >= 0 && b.enacted <= states.MO.seats);
  checkDistricts(b.districts, states.MO.fips, states.MO.seats, 'MO.blocked_map');
  checkSeatsMatchDistricts(b.enacted, b.districts, 'MO.blocked_map');
  checkPosition(b.position, 'MO.blocked_map');
});

test('topojson districts match results.json per state', { skip }, () => {
  const { results, topology } = data();
  assert.equal(topology.type, 'Topology');
  const geometries = topology.objects.districts.geometries;
  for (const g of geometries) {
    assert.ok(g.type, `district ${g.properties.id} has no geometry`);
  }
  const byState = new Map();
  for (const { properties: p } of geometries) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p.id);
  }
  sameSet([...byState.keys()], [...Object.keys(results.states), ...SINGLE_SEAT]);
  for (const [postal, s] of Object.entries(results.states)) {
    const ids = byState.get(postal);
    assert.equal(ids.length, new Set(ids).size, `${postal} has a duplicate district in the topojson`);
    sameSet(ids, s.districts.map((d) => d.id));
  }
  for (const s of results.national.single_seat) {
    assert.deepEqual(byState.get(s.postal), [`${s.fips}00`], `${s.postal} is one district 00`);
  }
});

test('topojson states layer matches results.json ids and postal codes', { skip }, () => {
  const { results, topology } = data();
  const expected = new Map(Object.entries(results.states).map(([postal, s]) => [postal, s.fips]));
  for (const s of results.national.single_seat) expected.set(s.postal, s.fips);
  const props = topology.objects.states.geometries.map((g) => g.properties);
  assert.equal(props.length, 50);
  sameSet(props.map((p) => p.postal), [...expected.keys()]);
  for (const p of props) assert.equal(p.id, expected.get(p.postal), `states layer id for ${p.postal}`);
});

test('visible text in results.json has no em dashes', { skip }, () => {
  const texts = [];
  for (const s of Object.values(data().results.states)) {
    texts.push(s.name, s.map_name, s.source.label, ...s.notes.map((n) => n.text));
    if (s.blocked_map) texts.push(s.blocked_map.name, s.blocked_map.source.label);
  }
  for (const text of texts) assert.ok(!text.includes('\u2014'), `em dash in: ${text}`);
});
```

- [ ] **Step 2: Draai de tests**

Run: `npm test`

Expected: `tests 27`, `pass 27`. Dat vraagt `site/data/results.json` en `site/data/map.topojson` uit fase 3. Zie je `pass 19`, `skipped 8` en de melding `site data not generated yet`, draai dan eerst `make export` en herhaal deze stap. Ga pas verder bij `pass 27`.

Faalt een test op echte data, dan is dat een fout in `04_export` of in de geometrie. Volg `systematic-debugging` en pas de test niet aan om hem te laten slagen.

- [ ] **Step 3: Zie de test falen op een kapotte kopie**

Zet in `site/data/results.json` het veld `national.seats` op `435`:

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import json, pathlib; p = pathlib.Path('site/data/results.json'); r = json.loads(p.read_text(encoding='utf-8')); r['national']['seats'] = 435; p.write_text(json.dumps(r), encoding='utf-8')"`

Run: `npm test`

Expected: `✖ national totals add up to 429, with the six single-seat states apart`, `fail 1`.

Zet het bestand terug:

Run: `git checkout -- site/data/results.json`

Run: `npm test`

Expected: `pass 27`.

- [ ] **Step 4: Commit**

```powershell
git add site/js/contract.test.js
git commit -m "Add contract test for results.json and map.topojson"
```

### Task 4.3: Ontwerp en plan voor de site

Deze taak heeft geen code. Hij levert twee documenten op en eindigt met het akkoord van de eigenaar. Daarna voert een aparte sessie het siteplan uit.

**Files:**
- Create: `docs/superpowers/specs/YYYY-MM-DD-site-design.md` (YYYY-MM-DD is de datum van de ontwerpsessie)
- Create: `docs/superpowers/plans/YYYY-MM-DD-site.md`

**Interfaces:**
- Consumes: `site/data/results.json` en `site/data/map.topojson` met de vorm die `site/js/contract.test.js` vastlegt (Task 4.2); `site/js/format.js` (Task 4.1); `site/vendor/d3.min.js` en `site/vendor/topojson-client.min.js` (Task 0.2); hoofdstuk 7 en 8 van de spec.
- Produces: een goedgekeurd ontwerp en een uitvoerbaar plan. Het plan gebruikt `format.js` voor elk getal, leest alleen `results.json` en `map.topojson`, en voegt geen eigen rekenregels toe.

Wat de ontwerpsessie moet beslissen:

1. Indeling op desktop en mobiel: panelen naast de kaart op desktop, eronder op mobiel; vanaf welke breedte; waar het landelijke beeld en de methodetoelichting staan.
2. Typografie: systeemlettertypen of zelf gehoste lettertypen in `site/fonts/` met licentiebestand. Nooit Google Fonts of een andere externe bron.
3. Kleurschaal voor het Democratische aandeel per district: divergerend rond 50%, leesbaar bij kleurenblindheid, met legenda. Of de schaal partijkleuren gebruikt, beslist de eigenaar.
4. Kleurschaal voor het tekeneffect per staat: divergerend rond 0, in hele zetels, met legenda. Staten met één zetel grijs.
5. De zetelas: Proportional, Neutral baseline (mediaan met band van 5e tot 95e percentiel) en Enacted op één as, landelijk en per staat, met de verdeling over de plannen.
6. De gesorteerde districtsgrafiek: de districtsaandelen van Enacted van laag naar hoog tegen de band per positie (`sorted.p5`, `p50`, `p95`), met een lijn op 50%.
7. Interactie: aanwijzen, klikken, tikken en toetsenbord voor kaart en paneel; de knop tussen de twee kaartweergaven; openen en sluiten van het staatspaneel; of de gekozen staat in de URL komt (bijvoorbeeld `#TX`).
8. Hoe een effect met teken eruitziet (`+11`, `−1`, of in woorden) en de zin onder de landelijke zetelas die het geografische effect en het tekeneffect noemt.
9. De methodetoelichting: de zes punten uit hoofdstuk 8 (stedelijk effect in twee of drie zinnen zonder oordeel; VRA en Callais; stembasis; kernbehoud in KS, LA, NE, NM en UT; de landelijke band en waarom de landelijke effecten niet de som van de staateffecten zijn; ALARM-versie, datum van de statuscontrole en licenties), met bronverwijzingen. Daarnaast de beperkingen uit hoofdstuk 10 die geen noot per staat hebben:
   - de eenheden van de stemmen: VTD's (ongeveer precincten) in 38 staten, tracts in CA, HI, ME en OR, county's in IA en WV, zoals in ALARM's `map.rds`;
   - in California hebben twee tracts in Modoc en Siskiyou County in ALARM's `map.rds` geen stemmen; in het blokbestand van census-vest hebben ze samen ongeveer 4.100 stemmen over de vier stemkolommen. We volgen ALARM, zodat de drie scenario's één stembasis houden;
   - in Michigan staan 38 watereenheden niet in ALARM's `map.rds`; bij census-vest hebben ze samen 17.272 stemmen, die bij ons niet meetellen. In Ohio ontbreken 4 watereenheden, zonder stemmen;
   - het blokbestand van census-vest voor Maine is van oktober 2025 en verdeelt de stemmen anders over de tracts dan `map.rds`; we gebruiken het alleen voor de verdeling binnen een tract, de stemmen per tract komen uit `map.rds`;
   - de `map.rds` van New Jersey heeft voor 2020 de cijfers van vóór ALARM's herziening van het census-vest-bestand van die staat; we volgen `map.rds`;
   - heeft een eenheid geen VAP, dan gaan haar stemmen in gelijke delen naar haar blokken; op de kaarten van 2026 liggen zulke eenheden in acht VTD-staten over een districtsgrens, met samen ongeveer 4.500 stemmen;
   - we toetsen de vastgestelde kaarten niet op gelijke bevolking; NV en CA tellen gevangenen bij herindeling anders mee dan de census;
   - een districtsnummer kan op een andere kaart een heel ander gebied zijn, zoals in Utah, dus nummers zijn niet te vergelijken tussen kaarten;
   - op onze stembasis blijven onder meer TX-15, TX-28 en TX-34 Democratisch;
   - in Louisiana geeft 99,8% van de neutrale plannen 1 Democratische zetel, door de VRA-eis en het kernbehoud samen.
10. De bronlabels die de site per staat toont (`source_label` in `pipeline/config.yaml`, in `results.json` als `source.label`, ook voor HB 1 van Missouri): loop ze met de eigenaar na. Een gewijzigd label gaat alleen in `config.yaml`, want `check_sources_md` vergelijkt het label niet met `data/sources.md`; draai daarna `make export`.

Vaste eisen uit de spec en CLAUDE.md, die het ontwerp niet openbreekt:

- Geen verzoeken naar derden: geen CDN, geen lettertypen van buiten, geen trackers, geen tegelservers. Alleen `site/vendor/` en eigen bestanden.
- Labels in het Engels, precies "Proportional", "Neutral baseline" en "Enacted". Statuslabels "In effect", "Challenged in court", "Blocked", "At-large". Bij elke staat "Legal status as of <datum>" met `meta.status_checked`.
- Twee kaartweergaven: districten naar Democratisch aandeel, staten naar tekeneffect. Projectie `geoAlbersUsa` met Alaska en Hawaii als inzet.
- Staten met één zetel grijs; aanwijzen of tikken toont "One at-large seat. No districts, so nothing to compare."
- Staatspaneel met de drie getallen, band en verdeling, beide effecten, minder, gelijk, meer en het samenvattende percentiel, de gesorteerde districtsgrafiek, EG en MM met neutrale context ("Not defined for two districts" bij twee districten), status, noten en bron. Voor Missouri een extra rij voor HB 1.
- Toegankelijk: werkt met muis, toetsenbord en aanraking; zichtbare focus; voldoende contrast; informatie nooit alleen via kleur.
- Ingetogen, redactionele datavisualisatie, geen dashboard-template. Geen partijdige of emotionele woorden. Geen em-dashes. Alle zichtbare tekst door de unslop-skill.
- Statisch te hosten: één pagina, `make serve` volstaat.

- [ ] **Step 1: Bereid de sessie voor**

Lees hoofdstuk 7, 8 en 11 van de spec, `site/js/format.js` en `site/js/contract.test.js`. Open `site/data/results.json` en noteer voor drie staten (bijvoorbeeld CA, TX en UT) de echte getallen, zodat de schetsen echte waarden tonen.

- [ ] **Step 2: Start de ontwerpsessie met de eigenaar**

Laad de skills `frontend-design` en `superpowers:brainstorming`. Loop de tien punten hierboven één voor één door. Stel per beurt één vraag, met twee of drie opties en een aanbeveling. Leg elk besluit met reden vast.

- [ ] **Step 3: Schrijf het ontwerpdocument**

Schrijf `docs/superpowers/specs/YYYY-MM-DD-site-design.md` in het Nederlands, met per punt het besluit en de reden, schetsen of beschrijvingen van de indeling op 375 px en 1280 px breed, de kleurwaarden, de lettertypen, en de concepttekst van de methodetoelichting in het Engels. Haal alle Engelse tekst door de unslop-skill.

- [ ] **Step 4: Laat de eigenaar het ontwerp beoordelen**

Vraag de eigenaar het document te lezen. Verwerk opmerkingen tot de eigenaar akkoord geeft. Noteer het akkoord met datum bovenaan het document.

- [ ] **Step 5: Commit het ontwerp**

```powershell
git add docs/superpowers/specs/*-site-design.md
git commit -m "Add site design spec"
```

- [ ] **Step 6: Schrijf het siteplan**

Laad de skill `writing-plans` en schrijf `docs/superpowers/plans/YYYY-MM-DD-site.md`. Het plan volgt dezelfde regels als dit plan: taken met Files, Interfaces en stappen met volledige code, tests met `node --test` voor alle pure functies (schalen, opbouw van het paneel uit `results.json`), en per taak een commit. Het plan noemt `format.js` voor elk getal en voegt `site/index.html`, CSS en de modules onder `site/js/` toe.

- [ ] **Step 7: Laat de eigenaar het plan goedkeuren en commit**

```powershell
git add docs/superpowers/plans/*-site.md
git commit -m "Add implementation plan for the site"
```

Expected: beide documenten staan in git en de eigenaar heeft beide goedgekeurd. Pas dan begint de uitvoering van het siteplan.

### Task 4.4: Eindcontrole tegen de klaar-criteria

Draai deze taak pas als het siteplan uit Task 4.3 is uitgevoerd. Laad eerst de skill `verification-before-completion` (CLAUDE.md). Elk criterium uit hoofdstuk 11 van de spec heeft hieronder een stap met een commando of een controle. Faalt er een, dan is het werk niet af: herstel de oorzaak en draai de hele taak opnieuw.

**Files:**
- Modify: `data/sources.md` en `pipeline/config.yaml` (alleen de statusdatum en eventuele statuswijzigingen uit Step 7)
- Modify: `site/data/results.json`, `site/data/map.topojson`, `docs/validation.md` (opnieuw gegenereerd)

**Interfaces:**
- Consumes: alles uit fase 0 tot en met 3, de site uit het siteplan, `site/js/contract.test.js`, `tests/test_checks_sources.py`, `docs/validation.md` met de samenvattingsregel `**Open items: <n>.** Pending: <m>.` die `build_report` in fase 2 schrijft (zie Interfaces in de plankop).
- Produces: een branch die aan alle klaar-criteria voldoet, plus de push-commando's.

- [ ] **Step 1: Alle tests**

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make test`

Expected: pytest meldt alleen `passed`, en `skipped` alleen voor tests met de marker `data` als de datamap ontbreekt; de kruiscontroletests van Task 2.13 en 2.14 slaan niet over (Step 5 controleert dat). `node --test` meldt `fail 0` en `skipped 0`. Exit code 0.

- [ ] **Step 2: De hele pijplijn met alle controles**

Zet `GERRY_DATA_DIR` als de downloads niet in `data/raw/` staan.

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make all`

Expected: exit code 0, geen `CheckError`. Daarna opnieuw `make test`: nu draaien ook de tests met de marker `data`, zonder `skipped`.

- [ ] **Step 3: Criterium "landelijk 429 zetels, zes staten apart"**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import json; r = json.load(open('site/data/results.json', encoding='utf-8')); n = r['national']; s = r['states'].values(); print(n['seats'], sum(x['seats'] for x in s), len(r['states']), len(n['single_seat']), n['proportional'], n['neutral']['median'], n['enacted'])"`

Expected: begint met `429 429 44 6`, gevolgd door de Democratische zetels voor Proportional, Neutral baseline en Enacted. De test `national totals add up to 429` in `contract.test.js` controleert dat die drie de som over de staten zijn.

- [ ] **Step 4: Criterium "geen open overschrijdingen in docs/validation.md"**

Run: `Select-String -Path docs\validation.md -SimpleMatch -Pattern '**Open items: 0.** Pending: 0.'`

Expected: één treffer, `docs\validation.md:7:**Open items: 0.** Pending: 0.` (het regelnummer kan verschillen).

Geen treffer: open de regel die begint met `**Open items:`. Direct eronder staan de punten.

- `Open items` groter dan 0: een overschrijding zonder verklaring in `data/validation_notes.yaml`.
- `Pending` groter dan 0: een kruiscontrolebestand in `data/crosscheck/` ontbreekt (`planscore.csv`, `dra.csv` of `state_files.csv`). Dan zijn de criteria van Step 5 en Step 6 ook niet gehaald.

- [ ] **Step 5: Criteria "PlanScore" en "DRA"**

Run: `Test-Path data\crosscheck\planscore.csv, data\crosscheck\dra.csv`

Expected: twee regels `True`.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_planscore_crosscheck.py tests/test_dra_crosscheck.py -v -rs`

Expected: `3 passed`, geen `skipped`. Slaat een test over, dan ontbreekt het bestand. Maak dan Task 2.13 of 2.14 af.

Open `docs/validation.md`. Controleer met de hand:

- Het deel over PlanScore noemt minstens drie staten. Per staat staat eerst de reproductie van hun EG uit hun eigen districtsstemmen, met `ok` in de kolom "Reproduced" (met onze functie, of met de formule voor gelijke opkomst als de eigenaar in Task 2.13 voor optie (a) koos), daarna onze EG op de composiet naast die van PlanScore, met `explained` in de kolom "Composite". Elk verschil groter dan afronding heeft een verklaring.
- Het deel over Dave's Redistricting App noemt minstens vijf staten, zoals Task 2.14 en `tests/test_dra_crosscheck.py` eisen, met de presidentsuitslag van 2020 per district naast onze cijfers, met URL en datum.

- [ ] **Step 6: Criterium "vergelijking CD120 met de bestanden van AL, OH, TN, UT en MO HB 1"**

Run: `Select-String -Path data\sources.md -Pattern 'To be checked'`

Expected: geen uitvoer. In de vergelijkingstabel van `data/sources.md` heeft elk van AL, OH, TN, UT en MO (HB 1) een eigen regel met een uitkomst.

- [ ] **Step 7: Criteria "elke staat heeft een regel in sources.md en config.yaml komt ermee overeen", "open punten in sources.md" en "status vlak voor publicatie opnieuw gecontroleerd"**

Doe dit vlak voor publicatie, niet eerder.

Voer Task 3.7 opnieuw volledig uit, stap 1 tot en met 6. De punten om na te gaan staan in de tabel van Task 3.7, stap 1; wat je met een bevinding doet, staat in de beslisregels van stap 2. Daarna volgen de nieuwe datum in `data/sources.md` en `pipeline/config.yaml` (stap 3), de controle dat beide overeenkomen (stap 4), de export (stap 5) en de commit (stap 6). Verandert de kaart van een staat, is Proposition A beslist of heeft ALARM nieuwe ensembles gepubliceerd, dan stop je volgens die beslisregels en vraag je de eigenaar.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py tests/test_config.py -v`

Expected: alles `passed`. Deze tests hangen niet af van de huidige statussen of datum; een fout hier betekent dat `config.yaml` en `sources.md` niet overeenkomen.

Run: `npm test`

Expected: `fail 0`, `skipped 0`, en `site/data/results.json` heeft de nieuwe `meta.status_checked`.

- [ ] **Step 8: Criterium "werkt op mobiel en desktop, geen verzoeken naar derden"**

Start de server in een aparte terminal of als achtergrondproces, want hij blijft draaien:

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make serve`

Expected: `Serving HTTP on 127.0.0.1 port 8000`.

Open `http://127.0.0.1:8000` in Chrome of Edge. In DevTools:

1. Tabblad Network, vink "Disable cache" aan, laad de pagina opnieuw. Typ in het filterveld `-domain:127.0.0.1`. Expected: geen enkele regel.
2. Tabblad Console, voer uit:
   ```js
   performance.getEntriesByType('resource').map((e) => e.name).filter((url) => new URL(url).origin !== location.origin)
   ```
   Expected: `[]`. De console toont geen fouten.
3. Device toolbar op 375 x 812 en daarna op 1280 x 800. Controleer bij beide breedtes: de kaart past zonder horizontaal scrollen; het paneel staat naast de kaart op desktop en eronder op mobiel; tikken of klikken op Texas opent het paneel met de drie getallen; beide kaartweergaven werken; Wyoming toont "One at-large seat. No districts, so nothing to compare."; Missouri toont de extra rij voor HB 1; Hawaii toont bij MM "Not defined for two districts".
4. Alleen met het toetsenbord: Tab naar de kaart, kies een staat met Enter, sluit het paneel. De focus is steeds zichtbaar.
5. Lees de methodetoelichting. Ze noemt de beperkingen uit hoofdstuk 10 van de spec die geen noot per staat hebben (Task 4.3, punt 9), waaronder de eenheden uit ALARM's `map.rds`, de twee tracts in California zonder stemmen, de watereenheden van MI en OH, het blokbestand van Maine, de cijfers van New Jersey en de regel voor eenheden zonder VAP.

Herhaal punt 1 en 2 met de device toolbar op 375 x 812.

Stop de server met Ctrl+C.

- [ ] **Step 9: Commit en push-commando's**

In Step 7 heeft Task 3.7 (stap 6) de statuscontrole al gecommit.

Run: `git status --short`

Staan er nog gewijzigde bestanden, bijvoorbeeld `docs/validation.md` of `site/data/` uit Step 2, commit die:

```powershell
git add docs/validation.md site/data/results.json site/data/map.topojson
git commit -m "Regenerate outputs before publishing"
```

Run: `git status --short`

Expected: geen uitvoer.

Er is nog geen remote. De eigenaar maakt die aan en geeft de URL. Geef de eigenaar daarna precies deze commando's:

```powershell
git remote add origin <URL van de eigenaar>
git push -u origin feature/pipeline-setup
```

## Open punten voor de eigenaar

Deze besluiten liggen nog open. De taak die erbij hoort, stopt op dat punt en vraagt het de eigenaar.

1. PlanScore (Task 2.13). Heeft PlanScore geen pagina's met werkelijke uitslagen en stemmen per district, of lukt de reproductie van hun EG alleen met hun formule voor gelijke opkomst, dan kiest de eigenaar tussen twee opties. Bij optie (a) nemen we hun districtsstemmen over en reproduceren we hun EG met `equal_turnout_gap`; onze `efficiency_gap` blijft de maat op de site en het verschil met PlanScore komt verklaard in `data/validation_notes.yaml`. Bij optie (b) noemt de eigenaar een andere bron. We raden (a) aan.
2. Naam van de kaart van Utah (Task 3.6, Step 7). De rechtbankstukken zeggen "Map 1", de laag van UGRC zegt "Map 1A", en CD120 komt voor 100% overeen met de laag voor Map 1A. Het besluit gaat tegelijk in `data/sources.md` en in `map_name` in `pipeline/config.yaml`.
3. Bronlabels op de site (Task 4.3, punt 10). De `source_label`-waarden in `pipeline/config.yaml` staan zichtbaar bij elke staat. De eigenaar loopt ze na tijdens de ontwerpsessie.
4. Meldingen van `npm audit` (Task 0.2, Step 5). Het gaat om kwetsbaarheden in `file-type` en `image-size`, die via `@ngageoint/geopackage` met mapshaper 0.7.77 meekomen. `npm audit fix --force` zet mapshaper terug naar 0.6.13. Mapshaper verwerkt alleen onze eigen bestanden, lokaal. De eigenaar beslist of de meldingen geaccepteerd worden.
