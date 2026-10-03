# Grenzen en blokbestanden

Onderzoeksnotities, gecontroleerd op 3 oktober 2026. Alle Census-URL's gaven HTTP 200 tenzij anders vermeld.

## De kern

Census heeft de kaarten voor de verkiezing van 2026 al op blokniveau gepubliceerd. `cd120.zip` (31 augustus 2026) bevat een landelijk blokbestand voor het 120e Congres en aparte bestanden voor de tien staten die veranderden: AL, CA, FL, LA, MO, NC, OH, TN, TX en UT. Vergeleken met de bestanden van de staten zelf: TX, CA en NC komen blok voor blok overeen, FL op alle gecontroleerde rijen, LA op alle blokken die in beide bestanden voorkomen.

Missouri is de uitzondering. CD120 bevat de kaart van 2025 (HB 1). Het Missouri Supreme Court (3 september 2026) en het US Supreme Court (10 en 25 september 2026) hielden de kaart van 2022 aan voor november 2026, en HB 1 staat op hetzelfde stembiljet als referendum. Census meldt dit zelf op de pagina over congresdistricten.

## Blokbestanden

| Bestand | URL | Grootte | Formaat |
|---|---|---|---|
| CD119 | https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip | 22.959.130 B (29-07-2024) | `NationalCD119.txt`, header `GEOID,CDFP`, alle staten plus DC en PR |
| CD120 | https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip | 57.246.616 B (31-08-2026) | `NationalCD120.txt`, header `GEOID,STATEFP,COUNTYFP,TRACTCE,BLOCKCE,CDFP`, plus `CD120_{01,06,12,22,29,37,39,47,48,49}.txt` |

- GEOID is het blok-GEOID20 van 15 tekens: staat 2, county 3, tract 6, blok 4.
- CDFP heeft 2 tekens. `00` is at-large, `98` is DC of PR, `ZZ` is niet-toegewezen water in CT, IL en NH.
- Alles als tekst inlezen. Het landelijke bestand gebruikt CRLF, de staatsbestanden LF. De volgorde van rijen ligt niet vast.
- CD120 heeft één gesplitst blok: Colorado 080010096072000, toegerekend aan district 08.

## Geometrie

| Bestand | URL | Grootte | Opmerking |
|---|---|---|---|
| CD119, generalized 500k | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip | 7.067.743 B | Landelijk, 441 objecten |
| CD119, generalized 5m | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_5m.zip | 2.095.960 B | |
| CD119 TIGER/Line per staat | https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_{SS}_cd119.zip | samen ongeveer 40 MB | Volle resolutie |
| CD120, TIGER 2026 GeoPackage | https://www2.census.gov/geo/tiger/TGRGPKG26/tlgpkg_2026_us_legislative.gpkg.zip | 249.289.919 B (27-08-2026) | Laag `Congressional_Districts`, veld `CD120FP`, volle resolutie |
| CD120, TIGER 2026 geodatabase | https://www2.census.gov/geo/tiger/TGRGDB26/tlgdb_2026_us_legislative.gdb.zip | 104.502.291 B | Zelfde inhoud |
| Staten, generalized | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_5m.zip | 1.120.533 B | Ook 500k en 20m |
| VTD's 2020 | https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/{SS}_{NAAM}/{SS}/tl_2020_{SS}_vtd20.zip | TX 43 MB | Geen VTD-bestanden voor CA, HI en OR |
| Blok naar VTD | https://www2.census.gov/geo/docs/maps-data/data/baf2020/BlockAssign_ST{SS}_{ST}.zip | | Lid `..._VTD.txt`, `BLOCKID|COUNTYFP|DISTRICT` |

Nog niet beschikbaar: TIGER/Line 2026-shapefiles voor CD120 (gepland voor september 2026, map gaf 404 op 3 oktober), en generalized CD120-bestanden ("coming in 2027"). Het CD120 Summary File staat gepland voor december 2026.

Alle bestanden zijn NAD83 geografisch (EPSG:4269).

## Officiële bronnen van de staten

De bestanden van Census volstaan voor de pijplijn. De bestanden van de staten zijn kruiscontrole en bron voor `data/sources.md`. Een aantal staatsservers blokkeert deze machine (Nederlands IP): de data portal van Texas, ncleg.gov, ohiosos.gov en het OA van Missouri geven 403. Voor TX, NC en OH kwamen de URL's uit het Internet Archive.

| Staat | Plan | Officiële bron |
|---|---|---|
| TX | PLANC2333 | https://data.capitol.texas.gov/dataset/planc2333 |
| CA | AB 604 (Prop 50) | https://aelc.assembly.ca.gov/proposed-congressional-map en https://statewidedatabase.org/pub/data/d25/ |
| MO | HB 1 (2025) | MSDIS op ArcGIS; de kaart van 2022 staat in CD119 |
| NC | SL 2025-95 | https://webservices.ncleg.gov/ViewBillDocument/2025/7669/0/SL%202025-95%20-%20Block%20Assignment%20File |
| OH | Commissiekaart 31-10-2025 | https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx |
| UT | Map 1A (rechter) | https://opendata.gis.utah.gov/ (UGRC, laag `political_us_congress_districts_2026_to_2032`) |
| FL | EOGPCRP2026 | https://www.flsenate.gov/Session/Redistricting/Congressional |
| TN | HB 7003 (2026) | https://www.capitol.tn.gov/redistricting/ (niet bereikbaar van hieruit), laag CONGRESSIONAL_DISTRICTS van TN STS |
| LA | Act 2 (2026) | https://redist.legis.la.gov/ (het blokbestand van de staat bevat 1.751 GEOID's die geen tabulatieblok van 2020 zijn; CD120 heeft de voorkeur) |
| AL | Plan van de wetgever (mei 2026) | https://alison.legislature.state.al.us/reapportionment-documents |

Let op bij Utah: district 1 is nu het district in Salt Lake County. Districtsnummers zijn tussen kaarten niet vergelijkbaar.
