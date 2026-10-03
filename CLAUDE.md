# CLAUDE.md: US Gerrymandering Map

## Doel

Een interactieve kaart van alle Amerikaanse congresdistricten die per staat en landelijk drie zetelverdelingen naast elkaar zet:

1. **Proportional**: zetels naar rato van de stemmen in de staat (elke stem even zwaar).
2. **Neutral baseline**: wat neutraal getekende kaarten gemiddeld opleveren, met spreiding.
3. **Enacted**: wat de huidige, werkelijk vastgestelde kaart oplevert.

Het verschil tussen 1 en 2 is het **geografische effect** (onder meer de concentratie van stedelijke kiezers). Het verschil tussen 2 en 3 is het **effect van het tekenen**. Die twee verschillen zijn de kern van het verhaal en moeten in de UI expliciet zichtbaar zijn.

De rangorde tussen de drie wordt niet vooraf aangenomen. De data bepaalt per staat waar de enacted kaart staat. Een enacted kaart kan binnen de neutrale band vallen of het geografische effect zelfs compenseren; dat tonen we gewoon.

## Methodologische regels

- **Eén stembasis voor alle drie de scenario's.** Gebruik dezelfde composiet van statewide verkiezingen (de basis die ALARM hanteert) op precinctniveau. Enacted zetels worden berekend door die precincten aan de huidige districten toe te wijzen, niet uit losse House-uitslagen. Zo zijn de drie getallen direct vergelijkbaar, ook voor kaarten die in 2025-2026 zijn hertekend en nog geen verkiezing hebben gehad.
- **Werkelijke House-uitslagen (2024, later 2026)** zijn een aparte, optionele laag, duidelijk gescheiden van de vergelijking.
- **Proportional**: tweepartijenaandeel van de staat maal aantal zetels, afgerond met largest remainder per staat. Landelijk totaal is de som over staten.
- **Neutral baseline**: mediaan plus 5e tot 95e percentiel van het aantal Democratische zetels over het ensemble. Rapporteer ook het percentiel van de enacted kaart binnen het ensemble.
- **Aanvullende maten per staat**: efficiency gap en mean-median difference, berekend op dezelfde stembasis.
- **Staten met één zetel** (AK, DE, ND, SD, VT, WY) doen niet mee aan de vergelijking; toon ze grijs met een korte verklaring.
- **Voting Rights Act**: majority-minority districten kunnen wettelijk verplicht zijn en lijken op packing. ALARM neemt VRA-overwegingen mee in de simulaties; vermeld dit in de methodetoelichting en per staat waar relevant.
- Twijfel over een databron of definitie: stop en vraag, niet gokken.

## Databronnen

- **ALARM Project, 50-State Redistricting Simulations** (Harvard Dataverse, McCartan, Imai e.a.). Ensembles en precinct-niveau stemcomposiet per staat. Lees eerst de documentatie en codebook voordat je iets bouwt.
- **Census TIGER/Line**: grenzen van de congresdistricten (119e Congres) en staten.
- **Hertekende kaarten 2025-2026**: verifieer per staat via webonderzoek of de kaart tussentijds is gewijzigd. Haal dan de officiële shapefile of block assignment file op (staatsbron of Redistricting Data Hub). Houd een tabel bij in `data/sources.md` met per staat: bron, datum, status (vastgesteld, aangevochten, geblokkeerd door rechter).
- **Kruiscontrole**: PlanScore en Dave's Redistricting App voor een handvol staten.

Ruwe data komt niet in git. `data/raw/` staat in `.gitignore`; alles is reproduceerbaar via de downloadscripts.

## Stack

- **Pijplijn**: Python 3, `geopandas`, `pandas`, `pyarrow`. Scripts genummerd in `pipeline/` (01_download, 02_join, 03_metrics, 04_export), aangestuurd door een `Makefile`. Tussenresultaten als Parquet.
- **Tests**: `pytest` voor alle metriekfuncties, met kleine handberekende voorbeelden.
- **Output voor de frontend**: TopoJSON (vereenvoudigd met `mapshaper`) plus één JSON met alle cijfers per staat en district.
- **Frontend**: vanilla JS en D3 met `geoAlbersUsa` (Alaska en Hawaii als inzet). Geen tegelservers, geen API-keys, geen trackers, geen externe diensten. Single-page, statisch te hosten.
- **UI-taal**: Engels (Amerikaans publiek). Labels neutraal: "Proportional", "Neutral baseline", "Enacted". Geen partijdige of emotionele bewoording; de cijfers spreken.

## Skills

- **superpowers**: volg de workflow. `brainstorming` voor ontwerpkeuzes, `writing-plans` voordat je bouwt, `test-driven-development` voor de metrieken, `systematic-debugging` bij datafouten, `verification-before-completion` voordat je iets af meldt.
- **frontend-design**: voor de kaart en de UI. Ingetogen, editorial datavisualisatie, geen dashboard-template.
- **noslop**: voor alle zichtbare tekst (UI, methodetoelichting, README).

## Werkwijze

- Werk altijd in een **git worktree** op een feature branch.
- Commit in logische brokken met heldere messages. Voeg jezelf nooit toe als co-author.
- Sluit elke sessie af met de exacte commando's om de feature branch naar de remote te pushen.
- Moet ik zelf iets installeren of uitvoeren: geef één stap per keer en wacht op het resultaat.

## Schrijfstijl

- Geen em-dashes in zichtbare tekst.
- Direct en sober. Geen consultant-taal.
- Methodetoelichting: kort, precies, met bronverwijzing. Leg het stedelijke effect uit in twee of drie zinnen, zonder oordeel.

## Klaar-criteria

- Landelijk totaal van zetels in alle scenario's telt op tot 435 minus de staten met één zetel (die apart opgeteld worden).
- Efficiency gap van minstens drie staten wijkt niet meer dan afrondingsverschil af van PlanScore op dezelfde stembasis, of het verschil is verklaard.
- Elke staat heeft een ingevulde regel in `data/sources.md`.
- Kaart werkt op mobiel en desktop, laadt zonder netwerkverzoeken naar derden.
