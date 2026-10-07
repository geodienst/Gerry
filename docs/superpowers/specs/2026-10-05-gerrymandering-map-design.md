# Ontwerp: kaart van gerrymandering in het Amerikaanse Huis van Afgevaardigden

Datum: 5 oktober 2026. Status: goedgekeurd in de brainstormsessie, ter beoordeling. Branch: `feature/pipeline-setup`.

Achtergrond staat in `docs/research/`: `alarm-50-state.md` (de ALARM-data), `boundary-sources.md` (grenzen en blokbestanden) en `data-probe.md` (de haalbaarheidscontrole op acht staten). `data/sources.md` geeft de status per staat.

## 1. Doel en afbakening

Een statische, interactieve kaart van alle Amerikaanse congresdistricten die per staat en landelijk drie zetelverdelingen naast elkaar zet:

1. Proportional: zetels naar rato van de stemmen in de staat.
2. Neutral baseline: wat neutraal getekende kaarten opleveren, als mediaan met spreiding.
3. Enacted: wat de kaart oplevert waarmee op 3 november 2026 gestemd wordt.

Het verschil tussen 1 en 2 heet het geografische effect, het verschil tussen 2 en 3 het tekeneffect. Beide staan expliciet in beeld. Voor geen van beide nemen we de richting vooraf aan. In de haalbaarheidscontrole was het geografische effect in California +11 zetels en in Texas −1 (positief is meer Democratische zetels).

Versie 1 bevat niet:

- Werkelijke House-uitslagen. De uitslagen van 2026 komen in versie 2, na certificering.
- Een stembasis met 2024. Daarvoor moeten we alle 220.000 plannen zelf opnieuw doorrekenen, of wachten op een nieuwere ALARM-dataset die nog niet openbaar is.
- Eigen simulaties. We gebruiken de ensembles van ALARM.

## 2. Besluiten

| Onderwerp | Besluit | Reden |
|---|---|---|
| Stembasis | President 2016 plus 2020, stemmen opgeteld. West Virginia alleen 2020, want ALARM heeft daar geen 2016. Alle drie de scenario's rekenen met dezelfde stemmen per eenheid. | In elke staat dezelfde verkiezingen, altijd een tweestrijd. ALARM raadt voor vergelijkingen tussen staten een presidentiële basis aan; 2016 en 2020 optellen is onze keuze. ALARM's eigen `ndv`/`nrv` middelt over alle kandidaatkolommen en geeft daardoor scheve aandelen in LA, IA, RI en NE, en telt runoffs mee in GA, MS en LA. |
| Stembron | ALARM's `{ST}_cd_2020_map.rds` voor alle 44 staten. De eenheid is een VTD in 38 staten, een tract in CA, HI, ME en OR en een county in IA en WV. De blokbestanden van census-vest (CA, HI, ME, OR) gebruiken we alleen om de stemmen van een tract over zijn blokken te verdelen. Besluit van de eigenaar, 6 oktober 2026. | ALARM telde de stats-bestanden op uit deze eenheden. Met `map.rds` sluiten de staatstotalen per plan in alle 44 staten aan op de stats-bestanden; met de bestanden van census-vest lukte dat niet in CA, ME, MI en NJ. VAP en bevolking per eenheid zijn in alle 44 staten gelijk aan de som over de blokken uit P.L. 94-171. |
| Enacted | De kaart waarmee op 3 november 2026 gestemd wordt. Missouri: kaart van 2022. Virginia: kaart van 2021. | Op deze kaart stemmen de kiezers. Een aangevochten kaart die nu geldt, telt mee met de status "Challenged". |
| Geblokkeerde kaart | Missouri krijgt in het staatspaneel een extra rij voor HB 1 (2025). Die wet staat als Proposition A op het stembiljet. | Laat zien waar het referendum over gaat. |
| VRA na Louisiana v. Callais (april 2026) | ALARM v15 zoals gepubliceerd, met een noot per staat. Welke ensembles we gebruiken staat in `config.yaml`, zodat we later ensembles kunnen inwisselen die ras niet meewegen. | ALARM heeft die ensembles nog niet gepubliceerd. |
| Kernbehoud | De cijfers van UT, NM en LA tonen, met een noot per staat. Die noot zegt welke kaart de neutrale kaarten volgen en wat dat betekent voor het tekeneffect: in NM en grotendeels in LA wordt het naar nul getrokken, in UT is de richting onbekend. KS en NE krijgen een lichtere noot (kernen van de districten van na de census van 2010). | Weglaten maakt het landelijke totaal moeilijk uit te leggen. Het gaat om 13 van de 429 zetels. |
| Detail | Zetels plus districtsdetail: aandeel per district en de gesorteerde districtsgrafiek. | Aan zetels alleen zie je niet hoe geconcentreerd de stemmen zijn (Utah) of hoe nipt een district is (Iowa). |
| Eenheden op een districtsgrens | Stemmen verdelen over blokken naar volwassen bevolking (VAP), in de tractstaten naar de blokstemmen van census-vest. Ter controle wijzen we elke eenheid ook in haar geheel toe aan één district. | Zo kloppen de stemtotalen per district. In de haalbaarheidscontrole gaven beide methoden in elk district dezelfde winnaar. |

Afwijkingen van CLAUDE.md, besloten door de eigenaar of volgend uit die besluiten:

1. CLAUDE.md spreekt van "de basis die ALARM hanteert". ALARM gebruikt twee bases (`ndv`/`nrv` en de per-verkiezing-gemiddelden achter `e_dem`). We kiezen een presidentiële basis, zoals ALARM aanraadt, en tellen 2016 en 2020 op.
2. CLAUDE.md noemt de grenzen van het 119e Congres. We tonen de kaarten van november 2026, in negen staten die van het 120e Congres.
3. De House-uitslagen van 2024 vervallen; die van 2026 komen in versie 2.
4. Voor hertekende kaarten vraagt CLAUDE.md de officiële bestanden van de staat of de Redistricting Data Hub. De pijplijn gebruikt de blokbestanden van Census (CD120, CD118); een eenmalige vergelijking met de bestanden van de staten (hoofdstuk 6) toont dat ze overeenkomen.
5. CLAUDE.md vraagt de stemcomposiet op precinctniveau. We gebruiken de eenheden uit ALARM's `map.rds`: VTD's (ongeveer precincten) in 38 staten, tracts in CA, HI, ME en OR, county's in IA en WV.

Voorstel: CLAUDE.md op deze vijf punten bijwerken. Dat besluit ligt bij de eigenaar.

## 3. Databronnen

Een eenheid is het kleinste gebied met stemcijfers in ALARM's `map.rds`: meestal een VTD (stemdistrict uit de census, ongeveer een precinct), in CA, HI, ME en OR een censustract, in IA en WV een county.

| Bron | Gebruik | Versie |
|---|---|---|
| ALARM 50-State Simulations, `XX_cd_2020_stats.tab`, als CSV via `?format=original`, 44 staten | Stemmen per district per plan voor de neutrale band, en ALARM's referentiekaart `cd_2020` | Dataverse doi:10.7910/DVN/SLCD3E, versie 15 |
| ALARM `XX_cd_2020_map.rds`, 44 staten | Stemmen, VAP, bevolking en de referentiekaart `cd_2020` per eenheid, voor alle drie de scenario's | Dezelfde dataset en versie, gelezen met het Python-pakket `rdata` |
| ALARM census-2020, `census-vest-2020/{st}_2020_block.csv`, alleen CA, HI, ME en OR | Stemmen per blok, alleen als gewicht om de stemmen van een tract over zijn blokken te verdelen | Commit `243c8a8134ecf8151777a9388c48323e274767e2` |
| [Census CD118](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2023/118-congressional-district-bef/cd118.zip), per staat `{ss}_{ST}_CD118.txt` | Missouri (kaart van 2022, gelijk aan 2024), en de controle tegen ALARM's `cd_2020` | 16-12-2022 |
| [Census CD120](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip), `NationalCD120.txt` | Alle andere staten, plus Missouri HB 1 | 31-08-2026 |
| Census P.L. 94-171, `{st}2020.pl.zip`, alle 44 staten | Per blok de VAP (P0030001), de bevolking (POP100), de VTD-code en het interne punt; voor Iowa de countynamen | 2020 |
| Census TIGER 2026, nationale GeoPackage, laag `Congressional Districts` (met spatie), veld `CD120FP` | Districtsgrenzen 2026 | 27-08-2026 |
| Census TIGER/Line 2025, `tl_2025_29_cd119` | Districtsgrenzen Missouri 2022 | 22-09-2025 |
| Census cartografische grenzen 2025, `cb_2025_us_state_500k` | Afsnijden op de kustlijn | 23-04-2026 |

Licenties: de ALARM-dataset is CC0, de VEST-verkiezingsdata CC BY 4.0 en de census-2020-bestanden van ALARM CC BY-SA 4.0. Data van het Census Bureau zijn publiek domein. De site noemt alle licenties bij de bronnen.

`01_download` haalt alles op naar de datamap, standaard `data/raw/` (niet in git). Met de omgevingsvariabele `GERRY_DATA_DIR` delen worktrees één datamap. Totaal ongeveer 2,5 GB. Gedrag:

- Staat een bestand er al met de juiste grootte en checksum uit `data/manifest.json`, dan slaat het script het over.
- Anders downloadt het script naar `<naam>.part`, controleert het bestand en hernoemt het met `os.replace`. Drie pogingen met een wachttijd ertussen.
- Dataverse: voor ingelezen tabellen (`.tab`, gehaald met `?format=original`) gelden `originalFileSize` en `md5` uit de API voor versie 15; voor andere bestanden (`.rds`) `filesize` en `md5`.
- Census en GitHub: de eerste download legt sha256 vast in `data/manifest.json`, dat in git staat. Wijkt een latere download af, dan stopt het script en noemt het de URL.
- Regels in `data/manifest.json` voor bestanden die niet meer in het downloadplan staan, haalt het script weg. De VTD-bestanden van census-vest staan niet meer in het plan en verdwijnen zo uit het manifest.

TX, NC, OH en MO blokkeren buitenlandse IP-adressen. Dat raakt de pijplijn niet: die haalt niets van websites van staten. Alleen de eenmalige vergelijking in hoofdstuk 6 gebruikt bestanden van staten, waar nodig via het Internet Archive.

## 4. Architectuur

```
pipeline/
  config.yaml          bronnen, ensembleset en per staat de instellingen
  gerry/               gedeelde code, getest
    config.py          laden en valideren van config.yaml; repo-root uit __file__
    sources.py         downloads, checksums, manifest
    units.py           stemmen per eenheid uit map.rds, eenheid-ID's, kolomkeuze, composiet
    blocks.py          P.L. 94-171 lezen, verdelen over blokken, optellen per district
    ensemble.py        stemmen per district per plan uit de stats-bestanden
    metrics.py         alle rekenregels uit hoofdstuk 5
    checks.py          de controles uit hoofdstuk 6
    validation.py      docs/validation.md samenstellen
    geometry.py        GeoPackage en shapefiles lezen, mapshaper aanroepen
    export.py          results.json en de noot-teksten
  01_download.py
  02_join.py
  03_metrics.py
  04_export.py
tools/
  compare_state_files.py   eenmalige vergelijking van CD120 met bestanden van staten
tests/                 pytest, per module
data/raw/              downloads (gitignore)
data/interim/          Parquet en JSON tussen de stappen (gitignore)
data/manifest.json     checksums van de downloads
data/sources.md        status en bronnen per staat
data/crosscheck/       invoer voor de kruiscontroles, in git (hoofdstuk 6)
docs/validation.md     methoderapport en kruiscontroles, gegenereerd en in git
site/                  de statische site, met data/, vendor/ en de formatter
README.md
Makefile
package.json
pytest.ini             testpaths = tests, pythonpath = pipeline
requirements.txt
```

Scripts worden als bestand gestart (`python pipeline/02_join.py`). `gerry/config.py` bepaalt de repo-root als `Path(__file__).resolve().parents[2]` en leidt daaruit `config.yaml`, `data/` en `site/` af, nooit uit de werkmap.

### config.yaml

Globaal:

- `status_checked`: de datum van de laatste statuscontrole. Moet gelijk zijn aan de datum in de eerste regel van `data/sources.md`.
- `ensemble`: naam (`alarm_v15`), DOI, versie, en per staat de noten die bij deze ensembleset horen, met hun invulwaarden (hoofdstuk 5, notentabel). Wisselen van ensembleset wisselt zo ook die noten.
- `census_vest_commit` (voor de blokbestanden van CA, HI, ME en OR) en de URL's van de bronnen. Datums en checksums staan in `data/sources.md` en `data/manifest.json`.

Per staat:

- `seats`, `name`, `fips`, `map_name` (gelijk aan de linktekst in `data/sources.md`), `status` (`In effect`, `Challenged`, `At-large`), `source_label`, `source_url`.
- `bef`: `cd120` of `cd118` (Missouri).
- `elections`: `[pre_16, pre_20]`, West Virginia `[pre_20]`.
- `unit_kind`: `vtd`, `tract` (CA, HI, ME, OR) of `county` (IA, WV).
- `extra_maps`: alleen Missouri, `mo_hb1` uit `cd120`, met `status: Blocked`, `name`, `source_label` en `source_url`.
- `notes`: de noten die bij de staat horen en niet bij de ensembleset (`adopted_after_2024_election`, `composite_2020_only`, `blocked_map`).

### Gegevens tussen de stappen

Alle ID's zijn tekst. Districten zijn twee tekens met voorloopnul (`"09"`); ALARM's districtnummers worden daarnaar omgezet. Stemkolommen heten `d_<verkiezing>` en `r_<verkiezing>` (bijvoorbeeld `d_pre_16`), plus de composiet `d` en `r`.

`02_join` leest het landelijke CD120-bestand één keer, met de C-engine van pandas, `usecols=["GEOID","CDFP"]` en `dtype=str`, en filtert per staat op de eerste twee tekens. De pyarrow-engine haalt voorloopnullen weg en is daarom verboden. CD118 leest het per staat (`{ss}_{ST}_CD118.txt`) met `skipinitialspace=True`, omdat de header een spatie heeft (`GEOID, CDFP`). Het schrijft naar `data/interim/`:

- `units/{ST}.parquet`: `unit_id`, `vap`, `pop` en de stemkolommen, uit `map.rds`.
- `enacted_districts.parquet`: `state`, `map_id` (`enacted`, `mo_hb1`, `check_2022`), `method` (`block`, `whole_unit`), `district`, de stemkolommen.
- `ensemble_districts.parquet`: `state`, `draw`, `district`, de stemkolommen. Alle rijen met `draw != "cd_2020"`.
- `alarm_reference.parquet`: dezelfde kolommen voor de rijen met `draw == "cd_2020"`, met de districtlabels van `map.rds` (koppelregels).

`03_metrics` leest deze bestanden, `config.yaml` en `data/crosscheck/`, en schrijft `data/interim/metrics.json` (alle uitkomsten uit hoofdstuk 5) en via `validation.py` het rapport `docs/validation.md`. `04_export` leest `metrics.json`, `config.yaml` en de geometrie, en schrijft de bestanden uit hoofdstuk 7.

### Koppelregels

- Kolomkeuze: voor elke verkiezing in `elections` zoekt `units.py` in `map.rds` en in de blokbestanden van census-vest, en `ensemble.py` in het stats-bestand, de kolom met patroon `^<verkiezing>_dem_` en de kolom met `^<verkiezing>_rep_`. Precies één treffer per partij, anders een fout.
- Blokken uit P.L. 94-171: `blocks.py` leest de zip zonder uit te pakken. Uit `{st}geo2020.pl` (scheidingsteken `|`, geen header, `dtype=str`, `encoding="latin-1"`) de records met SUMLEV 750, met LOGRECNO, GEOCODE (15 tekens), de VTD-code, POP100 en het interne punt. Voor Iowa ook de records met SUMLEV 050, met GEOCODE en NAME. Uit `{st}000022020.pl` LOGRECNO en P0030001. De veldposities staan als constanten in de code en worden bij het inlezen gecontroleerd: de som van P0030001 over de blokken is gelijk aan het staatsrecord (SUMLEV 040).
- Eenheid-ID's in `map.rds`: tekst, uniek en nooit leeg. CA en HI gebruiken de kolom `tract`. Iowa heeft geen ID-kolom: `units.py` zoekt de naam in de kolom `county` (bijvoorbeeld `Adair County`) op in NAME van de SUMLEV 050-records en neemt de FIPS-code van vijf tekens. Alle 99 county's moeten precies één treffer hebben. De andere staten gebruiken `GEOID`. In VTD-staten moet `GEOID` gelijk zijn aan `GEOID[:5]` plus de kolom `vtd` van `map.rds`.
- Sleutel van een blok: in VTD-staten GEOCODE[:5] + VTD-code, in tractstaten GEOCODE[:11], in IA en WV GEOCODE[:5]. Een blok zonder VTD-code in een VTD-staat is een fout. Een blok waarvan de sleutel bij geen eenheid hoort, doet niet mee; hoofdstuk 6 controleert dat zulke blokken geen VAP en geen bevolking hebben.
- Lege stemvelden in `map.rds` en in de blokbestanden van census-vest worden 0 en komen in het log (in het blokbestand van California twee blokken zonder bevolking, in dat van Oregon vier).
- Blokken met CDFP `ZZ` (water in CT, IL en NH) vallen weg vóór het verdelen. Een eenheid met stemmen zonder overgebleven blokken is een fout; een eenheid zonder stemmen en zonder overgebleven blokken komt in het log.
- Blokverdeling in VTD-staten en in IA en WV: de stemmen van een eenheid gaan naar haar blokken naar verhouding van de blok-VAP. Heeft de eenheid geen VAP, dan krijgt elk blok hetzelfde deel (1 gedeeld door het aantal blokken); per kaart komen het aantal zulke eenheden en hun stemmen in `join_log.json`.
- Blokverdeling in tractstaten: per stemkolom is het gewicht van een blok de waarde van die kolom in het blokbestand van census-vest, gedeeld door de som van die kolom over de blokken van het tract buiten `ZZ`. Is die som 0, dan geldt de regel met VAP.
- Hele-eenheidstoewijzing (controle): een eenheid gaat in haar geheel naar het district met de meeste blok-VAP binnen de eenheid; bij gelijke VAP, of zonder VAP, naar het district met de meeste blokken; blijft het gelijk, dan naar het laagste districtnummer.
- Plannen: elke draw behalve `cd_2020` moet precies `seats` rijen hebben met districten 1 tot en met `seats`, en elke draw komt één keer voor. Het aantal plannen moet 5.000 zijn.
- ALARM's referentiekaart: de stats-bestanden en `map.rds` nummeren de districten van `cd_2020` niet altijd gelijk. Elk label van `cd_2020` in het stats-bestand krijgt het label uit `map.rds` met precies dezelfde bevolking (`total_pop` tegen de som van `pop` per label van `cd_2020` in `map.rds`). Daarna moet elk label van `map.rds` gelijk zijn aan de CDFP van het CD118-district met de grootste bevolkingsoverlap, en over de hele staat moet minstens 97% van de bevolking in een district met hetzelfde label liggen (de laagste waarde is nu AZ met 97,9%). Per district geldt geen drempel, omdat ALARM's referentie hele eenheden toewijst. Een gelijke stand of een ontbrekende match is een fout. Alleen Oregon krijgt andere labels: 1 wordt 02, 2 wordt 04, 3 wordt 05, 4 wordt 06, 5 wordt 03 en 6 wordt 01. In de andere staten blijft elk label gelijk.

## 5. Rekenregels

Alle regels komen in `gerry/metrics.py`. Voor elke regel schrijven we eerst de test (hoofdstuk 6). De opmaak van getallen voor de bezoeker hoort niet hier maar bij de site (hoofdstuk 8).

Composiet. Per eenheid of district: D = som van `d_<verkiezing>` over de verkiezingen van die staat, R idem. Aandeel = D / (D + R). Stemmen blijven kommagetallen tot de export.

Zetelregel. Een district is Democratisch als D > R en Republikeins als R > D. De stats-bestanden van ALARM slaan hele getallen op, dus in de ensembles kan D = R voorkomen (in de controle op acht staten niet; de kleinste marge was 4 stemmen). Bij D = R beslist de presidentsverkiezing van 2020 alleen. Is ook die gelijk, dan stopt de pijplijn met een fout die staat, plan en district noemt. Het aantal beslechte gelijke standen per staat komt in `docs/validation.md`. De efficiency gap gebruikt dezelfde winnaar.

Proportional. Quotum D = aandeel × zetels, quotum R = zetels − quotum D. Beide naar beneden afronden; resterende zetels naar de grootste rest. Bij gelijke rest gaat de zetel naar de partij met de meeste stemmen in de staat. Landelijk is de som over de staten.

Percentielen van zetels. Het q-de percentiel van een zetelverdeling is de kleinste k waarvoor het aandeel plannen met hoogstens k Democratische zetels minstens q is (`numpy.percentile(..., method="inverted_cdf")` voor steekproeven). Dat geeft altijd een echt voorkomend zetelaantal. De mediaan is het 50e percentiel volgens deze regel, nooit het gemiddelde van twee middelste waarden.

Neutral baseline. Per plan het aantal Democratische districten. Per staat: de verdeling over de plannen (aantal plannen per zetelaantal van 0 tot `seats`), de mediaan, het 5e en het 95e percentiel.

Positie van Enacted. We tellen welk aandeel van de plannen minder, evenveel en meer Democratische zetels geeft dan Enacted, en noemen die aandelen minder, gelijk en meer. Het samenvattende getal is minder + ½ × gelijk.

Effecten. Geografisch effect = mediaan − Proportional. Tekeneffect = Enacted − mediaan. Positief betekent meer Democratische zetels. Enacted ligt buiten de band als het onder het 5e of boven het 95e percentiel ligt.

Efficiency gap. Per district met totaal T = D + R: de winnaar verspilt zijn stemmen boven T/2, de verliezer al zijn stemmen. EG = (verspild D − verspild R) / som van alle T. Positief betekent dat er meer Democratische stemmen verspild zijn: de kaart is gunstig voor Republikeinen.

Mean-median. Alleen voor staten met drie of meer districten. MM = gemiddelde van de districtsaandelen (ongewogen) − mediaan van de districtsaandelen. Bij een even aantal districten is de mediaan het gemiddelde van de twee middelste aandelen (`numpy.median`). Positief is gunstig voor Republikeinen. Bij twee districten is MM leeg.

Neutrale context voor EG en MM. We berekenen beide maten voor elk plan. Per staat geven we de mediaan en het 5e en 95e percentiel, met lineaire interpolatie.

Gesorteerde band. Per plan sorteren we de districtsaandelen van laag naar hoog. Voor elke positie in die volgorde nemen we over alle plannen het 5e, 50e en 95e percentiel (lineaire interpolatie). De aandelen van Enacted sorteren we op dezelfde manier.

Landelijke neutrale band. We combineren de zetelverdelingen van de 44 staten door convolutie en nemen daarbij aan dat staten onafhankelijk zijn. De uitkomst is een kansverdeling over 0 tot 429 zetels. Percentielen en positie volgen dezelfde regels als per staat, toegepast op de cumulatieve kansen. De landelijke effecten gebruiken de landelijke mediaan en zijn daarom niet de som van de effecten per staat; de methodetoelichting zegt dat.

Staten met één zetel. AK, DE, ND, SD, VT en WY doen niet mee. Alle scenario's tellen landelijk op tot 429; de zes zetels staan er apart naast, zonder partij.

Missouri HB 1. Zelfde berekening als Enacted, op CD120: zetels, districtsaandelen en positie in de neutrale verdeling. Telt niet mee in het landelijke totaal.

### Noten

Een noot is een sleutel. De Engelse tekst staat in `export.py`, met invulwaarden uit `config.yaml`. `04_export` vult de tekst per staat in, zodat de site geen eigen kopie nodig heeft. Alle teksten gaan door de noslop-skill (hoofdstuk 8). De staatslijsten en drempels komen uit de documentatie en code van ALARM; de bouw van `export.py` controleert ze per staat opnieuw.

| Sleutel | Hoort bij | Staten | Tekst (concept) |
|---|---|---|---|
| `vra_constraint` | ensembleset | AL, AZ, CA, FL, GA, LA, MI, MO, MS, NC, OH, RI, SC, WA | ALARM's neutral maps for this state favor districts with a large minority share of voting-age adults, following the Voting Rights Act as courts applied it before Louisiana v. Callais (April 2026). The law can require such districts. In seat counts they can look like packing, which means putting many voters of one party into a few districts. |
| `vra_constraint_cvap` | ensembleset | TX | ALARM's neutral maps for this state favor districts with a large Hispanic or Black share of adult citizens, following the Voting Rights Act as courts applied it before Louisiana v. Callais (April 2026). The law can require such districts. In seat counts they can look like packing, which means putting many voters of one party into a few districts. |
| `core_preservation_prior_map` | ensembleset | LA, NM, UT | ALARM's neutral maps for this state keep the core of each district in {reference_map}. So they look more like that map than neutral maps drawn without this rule would. {consequence} |
| `core_preservation_2010` | ensembleset | KS, NE | ALARM's neutral maps for this state keep the core of each district drawn after the 2010 census. |
| `competitiveness_rule` | ensembleset | AZ, CO | This state's redistricting rules call for competitive districts, so ALARM's neutral maps for this state favor them. Measuring competitiveness requires party vote data. |
| `vra_filter_with_votes` | ensembleset | AL, SC | ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps with at least one district where more than 30% of voting-age adults are Black and Democrats win a majority in ALARM's vote data. |
| `vra_filter_bvap` | ensembleset | MO | ALARM filtered the neutral maps for this state to follow the Voting Rights Act. It kept only maps with at least one district where more than 30% of voting-age adults are Black. |
| `vra_filter_minority_majority` | ensembleset | MI | ALARM kept only neutral maps for this state with at least two districts where more than half of voting-age adults belong to a minority group. |
| `vra_fixed_district` | ensembleset | OH | Every neutral map for this state has a district in Cuyahoga County, which includes Cleveland, where more than 40% of voting-age adults are Black. ALARM drew that district first and the rest of the state around it. |
| `alarm_rerun_unpublished` | ensembleset | AL, CO, KS, MI, MS, NC, NY, OH, PA, SC, WA | ALARM has rerun the simulations for this state because the version 15 run did not meet its current convergence check. The new run is not yet in ALARM's dataset on Harvard Dataverse. We use version 15 of that dataset (February 2026). |
| `alarm_method_update_pending` | ensembleset | CA, FL, TX | ALARM is preparing new simulations for this state with an updated method. They are not yet published. We use version 15 of ALARM's dataset (February 2026). |
| `narrow_ensemble` | berekend in `03_metrics` | elke staat waar één zetelaantal minstens 95% van de plannen heeft | At least 95% of the neutral maps for this state give the same number of Democratic seats, so the neutral baseline has little or no spread. |
| `adopted_after_2024_election` | staat | CA, FL, LA, NC, OH, TN, TX, UT | This map was adopted after the 2024 election, so the people who drew it could use 2024 results. Our vote basis is the 2016 and 2020 presidential elections and does not include 2024. |
| `composite_2020_only` | staat | WV | ALARM's data for this state has 2020 presidential results only, by county. All three numbers here use 2020 alone, not 2016 and 2020 combined. |
| `blocked_map` | staat | MO | The legislature adopted a new map in 2025 (HB 1). Courts have blocked it until voters decide on it. It is on the November 3, 2026 ballot as Proposition A. The November 2026 election uses the 2022 map. |

Invulwaarden voor `core_preservation_prior_map`, in `config.yaml` onder de ensembleset:

| Staat | `reference_map` | `consequence` |
|---|---|---|
| NM | the 2021 map | The current map is that 2021 map, so the drawing effect shown here is probably closer to zero than it should be. |
| LA | the 2022 map | The current map, adopted in 2026, largely follows the 2022 lines, so the drawing effect shown here is probably closer to zero than it should be. |
| UT | the legislature's 2021 map | A court replaced that map in 2025 with the current map. We cannot say in which direction this rule shifts the drawing effect shown here. |

## 6. Controles en tests

Tests voor de rekenregels (pytest). De test komt steeds vóór de code. Elk geval rekenen we met de hand uit; de berekening staat als commentaar in de test:

- composiet: twee verkiezingen opgeteld, en één verkiezing (West Virginia);
- kolomkeuze: één treffer, geen treffer, twee treffers;
- zetelregel: D > R, R > D, D = R beslist door 2020, en de fout bij een dubbele gelijke stand;
- largest remainder, ook met gelijke rest;
- percentielen en mediaan volgens de inverse verdelingsfunctie, met een verdeling vol gelijke waarden;
- minder, gelijk, meer en het samenvattende getal;
- effecten en het buiten-de-band-criterium;
- efficiency gap op een voorbeeld van vijf districten;
- mean-median bij een oneven en een even aantal districten, en leeg bij twee districten;
- neutrale context voor EG en MM met lineaire interpolatie;
- gesorteerde band;
- convolutie van drie kleine verdelingen, met mediaan, 5e en 95e percentiel en positie;
- eenheid-ID's: de kolom `tract`, `GEOID` met de controle op de kolom `vtd`, en de countynamen van Iowa, ook een naam zonder treffer en een naam met twee treffers;
- sleutel van een blok per soort eenheid, en de fout bij een blok zonder VTD-code;
- verdelen over blokken: een gesplitste eenheid, een eenheid zonder VAP, ZZ-blokken;
- verdelen binnen een tract: gewichten per stemkolom uit het blokbestand, een lege blokwaarde, en een tract waar de som 0 is;
- VAP en bevolking per eenheid tegen de blokken, en blokken zonder eenheid met en zonder VAP of bevolking;
- nieuwe labels voor ALARM's referentiekaart: de match op bevolking, de controle tegen CD118, een gelijke stand en een ontbrekende match;
- hele-eenheidstoewijzing, ook bij gelijke stand;
- het inlezen van `data/sources.md`, op een kopie van het echte bestand.

Controles in de pijplijn (`gerry/checks.py`). Faalt er een, dan stopt de pijplijn met een melding die de controle, de staat en de waarden noemt:

- Elke eenheid met stemmen is aan minstens één blok buiten `ZZ` gekoppeld, en de som van de stemmen per kaart is gelijk aan het totaal van `units/{ST}.parquet` (relatief verschil onder 1e-9).
- De eenheid-ID's volgen de regels uit hoofdstuk 4.
- Per eenheid is de opgetelde blok-VAP (P0030001) gelijk aan `vap` en de opgetelde POP100 gelijk aan `pop` uit `map.rds`. Dat klopt in alle 44 staten.
- Blokken waarvan de sleutel bij geen eenheid hoort, hebben VAP 0 en bevolking 0. Hun aantal komt in het log. Nu zijn dat 631 blokken in 38 VTD's in MI, 63 blokken in 4 VTD's in OH en 112 blokken in 6 tracts in ME. Het gaat steeds om water dat niet in ALARM's `map.rds` staat.
- Per plan en per stemkolom, vóór de composiet: |staatstotaal − totaal van `units/{ST}.parquet`| ≤ 0,5 × aantal districten. Een afwijking gelijk aan de grens is toegestaan; in HI en RI is de grootste afwijking 1,0 bij een grens van 1. ALARM rondt per district af op hele stemmen, en de grootste afwijking in de haalbaarheidscontrole bleef binnen deze grens (NC 3,7 bij een grens van 7, LA 2,7 bij 3). Overschrijdt een staat de grens, dan stopt de pijplijn en zoeken we de oorzaak uit voordat we iets aanpassen.
- De structuur van de plannen klopt, en de labels van ALARM's referentiekaart passen bij CD118 (hoofdstuk 4, koppelregels).
- Elke staat heeft het aantal districten uit `config.yaml`; landelijk 429 plus zes at-large zetels.
- GEOID's zijn tekst van 15 tekens en beginnen met de FIPS-code van de staat. `ZZ` en `98` (DC, PR) komen niet in de uitvoer.
- Geometrie en blokbestand beschrijven dezelfde kaart: per staat dezelfde set districtscodes, en minstens 99,9% van de interne punten van de blokken (uit P.L. 94-171) ligt in het district dat het blokbestand noemt. Voor Missouri met `tl_2025_29_cd119` tegen CD118.
- `config.yaml` en `data/sources.md` komen overeen. De lezer van `sources.md` neemt alleen de tabellen onder de koppen "Multi-seat states", "Blocked maps" en "At-large states", vindt de kolommen op hun kopnaam en negeert alle andere tabellen. Per rij vergelijkt hij exact: Status, Seats, Pipeline file, de kaartnaam (de linktekst, of de celtekst als er geen link is) en de link-URL. Rijen uit "Blocked maps" horen bij `extra_maps` van die staat. De datum in de eerste regel moet gelijk zijn aan `status_checked`.

Controles van de methode, in `docs/validation.md`:

- De kaarten van 2022 (CD118) met onze methode tegen ALARM's `cd_2020`, alle 44 staten. Drempel: per district hoogstens 0,5 procentpunt verschil en hetzelfde aantal zetels. In California en Texas wijkt de referentiekaart van ALARM zelf al tot 0,4 procentpunt af, omdat ALARM hele eenheden toewijst. Tennessee overschrijdt de drempel naar verwachting: in CD-09 is het verschil 0,699 procentpunt, bij hetzelfde aantal zetels. ALARM's referentiekaart wijst hele VTD's toe, terwijl CD118 rond Memphis 21 VTD's splitst. Ook een verdeling naar bevolking in plaats van VAP blijft boven de drempel. Tennessee krijgt daarom een verklaring in `data/validation_notes.yaml`. In Massachusetts zet ALARM's referentiekaart 12 VTD's in een district waar ze geen blok hebben; MA blijft wel binnen de drempel.
- Hele-eenheidstoewijzing tegen blokverdeling voor de kaarten van 2026: districten met een andere winnaar worden genoemd, en elk krijgt een verklaring in `data/validation_notes.yaml`. Zo'n district ligt dicht bij 50%, en dan doet de methode ertoe.
- Aantal plannen en aantal beslechte gelijke standen.

Eenmalige vergelijking met bestanden van staten (`tools/compare_state_files.py`). CD120 tegen het officiële bestand voor AL, OH, TN, UT en MO HB 1, naast de al gedane vergelijking voor TX, CA, NC, FL en LA. Waar een staat een blokbestand heeft (OH, MO HB 1), vergelijken we blok voor blok. Anders (AL via ALGeoHub, TN via de staatslaag, UT via UGRC) vergelijken we de officiële districtsvormen met CD120 via de interne punten van de blokken. Het script schrijft `data/crosscheck/state_files.csv`; daarna werken we de vergelijkingstabel in `data/sources.md` met de hand bij en draaien we `03_metrics` opnieuw. In dezelfde stap legt de eigenaar de naam van de kaart van Utah vast.

Kruiscontroles uit CLAUDE.md:

- PlanScore, minstens drie staten met onze Enacted-kaart, op de pagina's van hun plannenbibliotheek (`planscore.org/plan.html?<plan-id>`). Zo'n pagina drukt per verkiezing een EG (president 2016 en 2020) en biedt de districtsstemmen waaruit die volgt als tab-gescheiden download. PlanScore rekent daarvoor met de formule voor gelijke opkomst, 2(V − 0,5) − (S − 0,5), en niet met verspilde stemmen. Daarin is V het Democratische stemmenaandeel in de staat, geklemd op 0,25 tot 0,75, en S het Democratische aandeel van de gewonnen districten. In ons teken is een positieve uitkomst gunstig voor Republikeinen. De districtsstemmen en de gedrukte EG komen met URL en datum in `data/crosscheck/planscore.csv`. Eerst voeren we die districtsstemmen in de formule voor gelijke opkomst (`equal_turnout_gap`) in; de uitkomst moet op afronding na gelijk zijn aan de gedrukte EG. Dat toont dat we hun invoer goed overnemen. Onze `efficiency_gap` (verspilde stemmen) blijft de maat op de site. Die zetten we daarna op de composiet naast de EG van PlanScore voor dezelfde kaart; het verschil verklaren we met getallen in `data/validation_notes.yaml`, uitgesplitst naar formule en stembasis.
- Dave's Redistricting App, een handvol staten: de presidentsuitslag van 2020 per district op de huidige kaart, met URL en datum in `data/crosscheck/dra.csv`, naast onze cijfers.

`docs/validation.md` wordt bij elke run van `03_metrics` volledig opnieuw opgebouwd uit de pijplijnuitkomsten, `data/crosscheck/*.csv` en `data/validation_notes.yaml`. Dat laatste bestand bevat per staat en per controle de verklaring van elke overschrijding, met de hand geschreven en in git. Een overschrijding zonder verklaring markeert het rapport als open.

## 7. Export

`04_export` schrijft twee bestanden, die in git staan zodat de site zonder pijplijn werkt.

`site/data/results.json`:

| Veld | Inhoud |
|---|---|
| `meta` | `generated` (datum), `ensemble` (naam, DOI, versie), `census_vest_commit`, `vote_basis` (`["pre_16","pre_20"]`), `status_checked` |
| `national` | `seats` (429), `proportional`, `enacted`, `neutral` {`median`, `p5`, `p95`, `dist`: kansen voor 0 tot 429 zetels}, `position` {`fewer`, `equal`, `more`, `midrank`}, `effects` {`geographic`, `drawing`}, `outside_band`, `single_seat`: lijst van {`postal`, `fips`, `name`} |
| `states.<postcode>` | `name`, `fips` (`"48"`), `seats`, `map_name`, `status`, `source` {`label`, `url`}, `notes`: lijst van {`key`, `text`} met de ingevulde tekst, `d_share` (staatsbreed, fractie), `proportional`, `enacted`, `neutral` {`median`, `p5`, `p95`, `dist`: aantal plannen per zetelaantal van 0 tot `seats`}, `position`, `effects`, `outside_band`, `eg` {`value`, `median`, `p5`, `p95`}, `mm` (zelfde vorm, of `null`), `districts`: lijst van {`id` (`"4809"`), `share`, `d`, `r`}, `sorted` {`enacted`, `p5`, `p50`, `p95`: lijsten met lengte `seats`}, en voor Missouri `blocked_map` {`name`, `status` (`"Blocked"`), `source` {`label`, `url`}, `enacted`, `districts`, `position`} |

Aandelen zijn fracties tussen 0 en 1, stemmen afgerond op hele getallen, `position` in fracties.

`site/data/map.topojson` heeft twee lagen:

- `districts`: eigenschappen `id` (staat-FIPS + district, `"4809"`) en `state` (postcode). De districten van 2026, voor Missouri die van 2022. Zonder `ZZ`, DC, PR en eilandgebieden. De staten met één zetel zitten erin als district `00`.
- `states`: eigenschappen `id` (FIPS) en `postal`, gemaakt door de districten per staat samen te voegen, zodat grenzen precies aansluiten.

Route van de geometrie, in `gerry/geometry.py`:

1. De GeoPackage één keer uitpakken in de datamap. Met `pyogrio.list_layers` controleren dat de laag `Congressional Districts` (met spatie) met veld `CD120FP` bestaat, anders stoppen. Alleen `STATEFP` en `CD120FP` lezen.
2. `ZZ`, `98`, eilandgebieden en Missouri weglaten; Missouri toevoegen uit `tl_2025_29_cd119` (veld `CD119FP` hernoemen). Omzetten naar EPSG:4326 en schrijven als `data/interim/districts.geojson`.
3. De omtrek van alle staten uit `cb_2025_us_state_500k` samenvoegen tot één vorm. We snijden af op die omtrek, zodat alleen kust en meren veranderen en grenzen tussen staten de volle TIGER-lijn houden.
4. Mapshaper starten als `node node_modules/mapshaper/bin/mapshaper` (niet via `npx`, dat is op Windows een `.cmd`): invoer, `snap`, afsnijden, `dissolve` per staat tot de laag `states`, vereenvoudigen met `keep-shapes`, uitvoer als TopoJSON. Doel: onder 1 MB, vormen herkenbaar op een telefoon. Missouri komt uit een andere TIGER-jaargang; `snap` en een visuele controle van de grens met de buurstaten horen bij deze stap.

## 8. De site

Eén statische pagina in `site/`: gewone JavaScript, D3 en topojson-client, lokaal in `site/vendor/` met hun licentiebestanden (in git). Geen verzoeken naar derden, ook niet voor lettertypen. Projectie `geoAlbersUsa` met Alaska en Hawaii als inzet. Interface in het Engels met de labels "Proportional", "Neutral baseline" en "Enacted". Alle zichtbare tekst (interface, noot-teksten, methodetoelichting, README) gaat door de noslop-skill, hier geïnstalleerd als unslop: geen em-dashes, geen partijdige of emotionele woorden, de cijfers spreken.

Inhoud:

- Bovenaan het landelijke beeld: de drie getallen op één zetelas, met de neutrale band en de positie van Enacted. Eén zin eronder noemt het geografische effect en het tekeneffect.
- Kaart met twee weergaven: districten gekleurd naar Democratisch aandeel, en staten gekleurd naar tekeneffect. Staten met één zetel zijn grijs; aanwijzen of tikken toont "One at-large seat. No districts, so nothing to compare."
- Staatspaneel na klikken of tikken: de drie getallen met de band en de verdeling, de twee effecten, minder, gelijk, meer en het samenvattende percentiel, de gesorteerde districtsgrafiek, EG en MM met neutrale context (bij twee districten: "Not defined for two districts"), de status met "Legal status as of <datum>", de noten en de bron. Voor Missouri een extra rij voor HB 1.
- Methodetoelichting, kort en met bronnen:
  - het stedelijke effect in twee of drie zinnen, zonder oordeel;
  - de VRA: majority-minority districten kunnen wettelijk verplicht zijn en lijken in zetelmaten op packing; ALARM's ensembles volgen de VRA zoals die vóór Callais gold; waar een kaart van na Callais zulke districten heeft geschrapt, zit dat in het tekeneffect;
  - de stembasis: president 2016 en 2020. Op die basis kunnen de zetels van Enacted afwijken van de uitkomst op de uitslagen van 2024;
  - het kernbehoud in KS, LA, NE, NM en UT;
  - de landelijke band: staten als onafhankelijk opgeteld, en waarom de landelijke effecten niet de som van de staateffecten zijn;
  - de ALARM-versie, de datum van de statuscontrole en de licenties.

Statuslabels op de site: "In effect", "Challenged in court", "Blocked", "At-large". Zo botst de status niet met het scenariolabel "Enacted".

Opmaak van getallen. Eén formatter in `site/js/format.js`, getest met `node --test "site/js/*.test.js"` (zonder extra pakketten). Python exporteert alleen ruwe getallen. Regels:

- Aandelen in procenten met één decimaal. Rondt een aandeel af op 50,0%, dan twee decimalen; is het dan nog 50,00%, dan "just under 50%" of "just over 50%".
- Aandelen van plannen in hele procenten. Is de waarde groter dan 0 maar rondt ze af op 0, dan "<1%"; is ze kleiner dan 1 maar rondt ze af op 100, dan ">99%". Alleen exact 0 en 1 worden "0%" en "100%". Testgevallen onder meer 25/5000 en 4975/5000.
- EG en MM in procentpunten met één decimaal, met de richting: "4.2 points toward Republicans". Rondt de waarde af op 0,0, dan "less than 0.05 points either way". Effecten in hele zetels op dezelfde manier: "R+6 · 6 seats toward Republicans", "D+3 · 3 seats toward Democrats", "0 · no difference" (siteontwerp, bijgewerkt op 7 oktober 2026).
- Zetels als geheel getal.
- Afronden half-up op de decimale waarde, niet met `Math.round` op een kommagetal.

Werkt met muis, toetsenbord en aanraking; panelen naast de kaart op desktop, eronder op mobiel. Het visuele ontwerp volgt in een aparte sessie met de frontend-design skill, vlak voor de bouw van de site.

## 9. Gereedschap en werkwijze

- Python 3.12 in `.venv`, versies vast in `requirements.txt`: pandas (3.x), pyarrow, numpy, geopandas, pyogrio, pyyaml, rdata, pytest, en openpyxl (alleen voor de `.xlsx`-blokbestanden in `tools/compare_state_files.py`).
- Alle tekstbestanden openen met `encoding="utf-8"` (P.L. 94-171 uitgezonderd, dat is Latin-1). `PYTHONUTF8=1` staat in de Makefile en in de instructie om scripts los te draaien.
- Node-pakketten als devDependencies in `package.json`: mapshaper, d3, topojson-client. Het npm-script `vendor` kopieert met `node -e` en `fs.copyFileSync` de bestanden `d3.min.js`, `topojson-client.min.js` en beide licenties naar `site/vendor/`. Eén keer draaien na `npm install` en het resultaat committen.
- Makefile met `download`, `join`, `metrics`, `export`, `test`, `all` en `serve`. `PY ?= python`, gestart na het activeren van `.venv`, nooit `python3`. Elk recept is één regel zonder shell-gereedschap (geen `rm`, `cp`, `source`, `&&`), bijvoorbeeld `$(PY) pipeline/02_join.py` en `$(PY) -m http.server 8000 --bind 127.0.0.1 --directory site`. `test` draait pytest en `node --test "site/js/*.test.js"`, via de hulpdoelen `test-py` en `test-js`. Make staat nog niet op deze machine; installeren gaat met `winget install ezwinports.make`. De scripts draaien ook zonder Make.
- `.gitignore` krijgt `data/interim/` erbij.
- Werken in een git worktree op een feature branch, commits in logische stukken, nooit een co-author. Elke sessie eindigt met de push-commando's; er is nog geen remote.

## 10. Bekende beperkingen

Deze staan ook in de methodetoelichting of in de noten per staat.

- De stembasis is 2016-2020. De kaarten die na de verkiezing van 2024 zijn vastgesteld, konden op uitslagen van 2024 getekend worden; voor Texas is dat gedocumenteerd. Op onze basis blijven onder meer TX-15, TX-28 en TX-34 Democratisch. Op onze basis kunnen de zetels van Enacted afwijken van de uitkomst op de uitslagen van 2024.
- De neutrale kaarten volgen de VRA zoals die vóór Louisiana v. Callais (april 2026) gold.
- In KS en NE houden de neutrale kaarten de kernen vast van de districten van na de census van 2010, in LA, NM en UT die van de kaart van 2021-2022. In NM en grotendeels in LA trekt dat het tekeneffect naar nul; in UT is de richting onbekend. In LA ligt de uitkomst door de VRA-eis en het kernbehoud bijna vast: 99,8% van de plannen geeft 1 Democratische zetel.
- In AZ en CO vragen de regels van de staat om competitieve districten, en ALARM's neutrale kaarten wegen dat mee met partijdata. In AL en SC filtert ALARM de plannen op bevolkings- en stemdata, in MO alleen op bevolkingsdata, alle drie om de VRA te volgen. In MI houdt ALARM alleen plannen over met minstens twee districten waar meer dan de helft van de VAP tot een minderheidsgroep behoort. In OH heeft elk plan een district in Cuyahoga County met meer dan 40% zwarte VAP. ALARM tekent dat district eerst en de rest van de staat daaromheen.
- ALARM heeft voor 11 staten nieuwe simulaties op GitHub gezet (AL, CO, KS, MI, MS, NC, NY, OH, PA, SC, WA), omdat de runs van v15 niet meer door hun convergentiecontrole kwamen; voor CA, FL en TX staat een nieuwe methode in een open pull request. Geen van beide staat op Dataverse. Wij gebruiken v15.
- West Virginia gebruikt alleen 2020. Iowa en West Virginia hebben county's als eenheid, CA, HI, ME en OR tracts, zoals in ALARM's `map.rds`.
- In California hebben twee tracts in Modoc en Siskiyou County in ALARM's `map.rds` geen stemmen. In het blokbestand van census-vest hebben ze samen ongeveer 4.100 stemmen over de vier stemkolommen. We volgen ALARM, zodat de drie scenario's één stembasis houden. De oorzaak aan de kant van ALARM is onbekend.
- In Michigan staan 38 watereenheden niet in ALARM's `map.rds`. In census-vest hebben ze samen 17.272 stemmen; die tellen bij ons niet mee. In Ohio ontbreken 4 watereenheden, zonder stemmen.
- Het blokbestand van census-vest voor Maine is van oktober 2025 en verdeelt de stemmen anders over de tracts dan `map.rds`. We gebruiken het alleen voor de verdeling binnen een tract; de stemmen per tract komen uit `map.rds`.
- De `map.rds` van New Jersey heeft voor 2020 de cijfers van vóór ALARM's herziening van het census-vest-bestand van die staat. We volgen `map.rds`.
- Heeft een eenheid geen VAP, dan gaan haar stemmen in gelijke delen naar haar blokken. Op de kaarten van 2026 liggen zulke eenheden in acht VTD-staten over een districtsgrens, met samen ongeveer 4.500 stemmen.
- We toetsen de vastgestelde kaarten niet op gelijke bevolking. NV en CA tellen gevangenen bij herindeling anders mee dan de census.
- Een districtsnummer kan op een andere kaart een heel ander gebied zijn, zoals in Utah.

## 11. Klaar-criteria

- Landelijk telt elk scenario op tot 429 zetels; de zes staten met één zetel staan er apart naast.
- De efficiency gap van minstens drie staten wijkt niet meer dan afrondingsverschil af van PlanScore op dezelfde stembasis, of het verschil is verklaard in `docs/validation.md`.
- De vergelijking met DRA is gedaan voor een handvol staten en staat in `docs/validation.md`.
- De eenmalige vergelijking van CD120 met de bestanden van AL, OH, TN, UT en MO HB 1 is gedaan en staat in `data/sources.md`.
- Elke staat, ook de zes at-large staten, heeft een ingevulde regel in `data/sources.md`, en `config.yaml` komt ermee overeen.
- Alle tests (pytest en `node --test`) en pijplijncontroles slagen, en `docs/validation.md` heeft geen open overschrijdingen.
- De open punten in `data/sources.md` zijn opgelost of staan als open vermeld, en de status is vlak voor publicatie opnieuw gecontroleerd.
- De kaart werkt op mobiel en desktop en laadt zonder verzoeken naar derden, gecontroleerd in de browser met het netwerkoverzicht.
