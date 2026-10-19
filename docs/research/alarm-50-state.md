# ALARM 50-State Redistricting Simulations

Onderzoeksnotities, gecontroleerd op 3 oktober 2026 tegen Dataverse, de documentatie per staat en de broncode op GitHub.

## Dataset

Harvard Dataverse, doi:10.7910/DVN/SLCD3E. De laatste versie is v15 van 19 februari 2026. De dataset zelf valt onder CC0 1.0. De onderliggende VEST-verkiezingsdata vallen onder CC BY 4.0 en de gekoppelde census-2020-bestanden onder CC BY-SA 4.0. Bij hergebruik moeten we die twee dus vermelden.

De dataset dekt 44 staten: alle staten met meer dan één zetel, samen 429 districten. De zes staten met één zetel ontbreken. Per staat staat er een map `XX_cd_2020/` met vier bestanden:

| Bestand | Inhoud | Grootte |
|---|---|---|
| `XX_cd_2020_doc.html` | Documentatie per staat, met het codebook | 5 tot 8 kB |
| `XX_cd_2020_map.rds` | `redist_map` (R, sf): eenheden, bevolking, verkiezingskolommen, de vastgestelde kaart van 2022 | 18 kB (WV) tot 3,1 MB (TX) |
| `XX_cd_2020_plans.rds` | `redist_plans`: toewijzingsmatrix eenheden maal 5.001 plannen | 47 kB tot 4,0 MB |
| `XX_cd_2020_stats.tab` | Statistiek per plan per district; met `?format=original` krijg je de CSV | 2,2 MB (WV) tot 84 MB (TX), samen ongeveer 0,78 GB |

Er is ook een 2010-cyclus (43 staten). Die gebruiken we niet.

Er staan herberekeningen op GitHub die nog niet op Dataverse staan. PR #375, samengevoegd op 27 augustus 2026, draait AL, CO, KS, MI, MS, NC, NY, OH, PA, SC en WA opnieuw omdat ze de R-hat-drempel van 1,05 niet meer haalden. PR #348, nog open, vervangt voor CA, FL en TX de gedeeltelijke simulatie door een nieuwe methode. Een v16 ligt dus in het verschiet. We pinnen v15 en maken de versie een instelling.

Een werkdocument van juli 2026 (Kenny, Zhou, Simko en Imai) noemt twee nieuwere datasets: race-blinde ensembles (doi:10.7910/DVN/A3SE7Y) en de kaarten van het 119e Congres plus kaarten vastgesteld tot 15 juni 2026, gescoord op presidentsuitslagen van 2024 (doi:10.7910/DVN/KI4BHR). Beide geven nu HTTP 401. Ze zijn nog niet openbaar.

## Het stats-bestand

Elke rij is één district in één plan. Nevada heeft 55 kolommen en 20.004 rijen: 5.001 plannen maal 4 districten. De kolom `draw` is `cd_2020` voor de kaart die in 2022 gold, daarna `1` tot `5000`. `chain` is de onafhankelijke run (1 of 2, `NA` voor de vastgestelde kaart). Getallen zijn geschreven met R `format(digits=4)` en opgevuld met spaties. Inlezen met `skipinitialspace=True`; het verlies is hooguit één stem.

Kolommen in Nevada:

```
draw,district,total_pop,chain,pop_overlap,total_vap,plan_dev,comp_edge,comp_polsby,
pop_hisp,pop_white,pop_black,pop_aian,pop_asian,pop_nhpi,pop_other,pop_two,
vap_hisp,vap_white,vap_black,vap_aian,vap_asian,vap_nhpi,vap_other,vap_two,
pre_16_dem_cli,pre_16_rep_tru,uss_16_dem_cor,uss_16_rep_hec,uss_18_dem_ros,uss_18_rep_hel,
gov_18_dem_sis,gov_18_rep_lax,atg_18_dem_for,atg_18_rep_dun,sos_18_dem_ara,sos_18_rep_ceg,
pre_20_dem_bid,pre_20_rep_tru,arv_16,adv_16,arv_18,adv_18,arv_20,adv_20,
county_splits,muni_splits,ndv,nrv,ndshare,e_dvs,pr_dem,e_dem,pbias,egap
```

De kolommen verschillen per staat. `pop_overlap` ontbreekt in FL, HI, KY, NJ, NM, PA, TN en VA. FL en TX hebben CVAP-kolommen. GA, LA en MS hebben runoff-kolommen zoals `sos_r18_dem_bar`.

De stemkolommen per verkiezing zijn al per district opgeteld. Elke composiet die een lineaire combinatie van verkiezingen is, kunnen we dus voor alle 5.000 plannen uitrekenen zonder R. Gecontroleerd voor Nevada: per plan tellen de presidentiële kolommen op tot het staatstotaal (verschil hooguit 3 stemmen), en dat totaal klopt met het VTD-bestand.

## De stemcomposiet

De verkiezingen komen uit VEST: algemene verkiezingen in 2016, 2018 en 2020 voor president, US Senaat, gouverneur, attorney general en secretary of state, alleen de Democratische en Republikeinse kandidaten. Het aantal verschilt per staat. CA heeft alleen president 2016 en 2020, WV alleen president 2020 (op countyniveau), TN heeft er 3, KY, NJ en VA 4, en MO, MT, NC, OR en WA 10. President 2016 en 2020 zijn er in elke staat, behalve 2016 in WV.

ALARM gebruikt twee verschillende bases.

`ndv` en `nrv` (en daarmee `ndshare`) zijn het gemiddelde over alle Democratische en alle Republikeinse kandidaatkolommen per precinct (`census-2020/R/01_compile.R`, `rowMeans(select(., contains('_dem_')))`). Dat geeft drie eigenaardigheden:

- In Louisiana tellen alle kandidaten uit de jungle primary mee, 18 Democratische kolommen. Het statewide `ndv` is daardoor 230.000 tegen 856.000 stemmen voor Biden.
- Races zonder tegenkandidaat tellen aan één kant mee: attorney general 2018 in IA en RI alleen aan Democratische kant, in NE alleen aan Republikeinse kant.
- Runoffs tellen mee (GA, MS, LA).

`e_dvs`, `pr_dem`, `e_dem`, `egap` en `pbias` worden per verkiezing berekend en daarna gemiddeld, en alleen over verkiezingen met precies één D- en één R-kolom (`fifty-states/R/summary_stats.R`). In Louisiana zijn dat alleen president 2016 en 2020.

"De basis die ALARM hanteert" is dus niet eenduidig. Het verschil is niet klein. Statewide Democratisch aandeel op `ndv`/`nrv` tegenover president 2020: MA 0,614 tegen 0,671, MD 0,621 tegen 0,670, ME 0,487 tegen 0,547, UT 0,333 tegen 0,393, NE 0,371 tegen 0,402.

ALARM telt zetels zelf als `e_dem`: het gemiddelde over verkiezingen van het aantal gewonnen districten, dus een gebroken getal. Hun statenpagina's tonen een histogram van `e_dem`, de mediaan en de 1e tot 99e percentiel, en de positie van de vastgestelde kaart als `mean(sims <= enacted)`. Het Scientific Data-artikel (2022) en hun latere werk (PNAS 2023) raden voor vergelijkingen tussen staten een presidentiële basis aan, omdat de verkiezingen per staat verschillen.

## Eenheden en stemdata op precinctniveau

- 38 staten gebruiken VTD's van 2020 (GEOID20, 11 tekens).
- CA, HI, ME en OR gebruiken tracts, OR met sub-tracts waar de vastgestelde kaart een tract splitst.
- IA en WV gebruiken counties.

De data staan ook als CSV in github.com/alarm-redist/census-2020, map `census-vest-2020/{st}_2020_vtd.csv`, met dezelfde verkiezingskolommen. Voor Nevada is dat bestand identiek aan de data in `map.rds`. Stemschattingen op blokniveau zijn alleen gepubliceerd voor CA, HI, ME en OR (`{st}_2020_block.csv`). Voor de andere staten is blokniveau een tussenstap die ALARM niet bewaart (VEST naar blokken van 2010 via VAP-gewichten, naar blokken van 2020, naar VTD's).

De `.rds`-bestanden zijn in Python te lezen met het pakket `rdata`, zonder R. Getest op Nevada: de plannenmatrix (2.102 eenheden maal 5.001 plannen) en de districtstotalen kwamen exact terug.

In de vastgestelde kaart van ALARM zijn gesplitste VTD's in hun geheel aan één district toegewezen. Daardoor heeft de kaart van Nevada een bevolkingsafwijking van 0,88%, terwijl de echte kaart binnen 0,5% blijft.

## De ensembles

- Algoritme: Sequential Monte Carlo (`redist_smc`) in alle staten, 5.000 plannen per staat met gelijke gewichten. Meestal twee runs van 2.500. Grote staten worden overbemonsterd en uitgedund (GA 20.000, IL 60.000, FL 160.000, TX 50.000, MI 48.000). AZ, ME, MI, NE en WV gebruiken vier runs.
- Harde eisen: aaneengesloten districten, bevolkingsafwijking hooguit 0,5% (IA 0,01%), en hooguit ndists min 1 gesplitste counties. Counties die groter zijn dan een district worden gesplitst in pseudo-counties per gemeente.
- Zachte eisen: compactheid en penalties per staat.
- VRA: een hinge-penalty als het aandeel minderheden in de VAP van een district onder een doel zakt, en een omgekeerde hinge tegen packing. De doelen volgen het aantal opportunity districts in de kaart van 2022. Dit staat aan in AL, AZ, CA, FL, GA, LA, MI, MO, MS, NC, OH, RI, SC, TX (op CVAP) en WA. Achteraf filteren AL en SC plannen weg zonder district met meer dan 30% zwarte VAP en een Democratische meerderheid, en MO eist minstens 30% zwarte VAP in het meest zwarte district. De documentatie van IL noemt VRA-beperkingen, maar die stonden niet aan.
- Niet partij-blind: CO (beperking op competitiviteit) en AZ. De filters in AL en SC gebruiken ook stemdata.
- Kernbehoud: KS, LA, NE, NM en UT. Alle precincts die meer dan twee precincts van een districtsgrens liggen, worden samengevoegd, zodat de kern van elk district intact blijft. Volgens de documentatie gaat het overal om de kaart van 2010. De code zegt iets anders (`analyses/*_cd_2020/02_setup_*.R`, gecontroleerd op 5 oktober 2026): KS en NE gebruiken `cd_2010`, maar LA, NM en UT gebruiken `cd_2020`, de vastgestelde kaart van 2021-2022. In Utah is dat de kaart van de wetgever uit 2021, die een rechter in 2025 verving. De neutrale kaarten van LA, NM en UT lijken daardoor meer op die kaart dan vrij getekende kaarten zouden doen.
- Clusters of gedeeltelijke simulatie: CA, FL, TX, AZ, HI en OH.

Louisiana v. Callais (april 2026) heeft Sectie 2 van de VRA verzwakt. De VRA-beperkingen in v15 volgen het recht van vóór die uitspraak. Kenny e.a. (juni 2026) vinden dat race-blinde neutrale kaarten landelijk ongeveer dezelfde partijverhouding geven als de ensembles met VRA-beperkingen.

De diagnostiek (R-hat rond 1,05, gewichten, diversiteit van plannen) staat alleen in de pull requests op GitHub, niet op Dataverse. De documentatie op Dataverse is een momentopname uit 2022 met enkele bekende fouten.

## Wat we direct kunnen gebruiken

- De stats-bestanden: per plan per district de stemmen per verkiezing. Daarmee rekenen we de neutrale band uit op elke lineaire composiet.
- De VTD-bestanden van census-2020 met GEOID20, voor de vastgestelde kaarten en het proportionele aandeel.
- De blokbestanden voor CA, HI, ME en OR.
- `e_dem`, `egap` en `pbias` als controlegetallen, met de definities hierboven.
- `cd_2020` als controle voor staten die sinds 2022 niet zijn hertekend.
- De documentatie per staat voor de toelichting over beperkingen en VRA.

## Wat we zelf moeten afleiden

- De composiet zelf, en de regel waarmee een district als Democratisch telt.
- Per staat de mediaan, het 5e en 95e percentiel, en de positie van de vastgestelde kaart.
- Proportionele zetels met largest remainder.
- Zetels voor de huidige kaarten: blokbestanden van Census naar VTD's, met een verdeling van gesplitste VTD's naar bevolking.
- Efficiency gap en mean-median op de composiet. ALARM's `egap` is een gemiddelde per verkiezing en een mean-median ontbreekt.
- Kaartgeometrie voor de site. De geometrie in `map.rds` is vereenvoudigd en in staatsprojecties.

## Bronnen

- Dataverse: https://doi.org/10.7910/DVN/SLCD3E
- Code: https://github.com/alarm-redist/fifty-states en https://github.com/alarm-redist/census-2020
- McCartan e.a. (2022), "Simulated redistricting plans for the analysis and evaluation of redistricting in the United States", Scientific Data. https://doi.org/10.1038/s41597-022-01808-2
- Kenny, Zhou, Simko en Imai (27 juni 2026), "Weakening the Voting Rights Act reduces minority representation and electoral competition", werkdocument.
