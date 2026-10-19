# Uitbreidingen: implementatieplan (fase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De vier goedgekeurde uitbreidingen in de pijplijn tot en met `results.json`: de meerderheidsdrempel, de hertekeningen sinds de verkiezing van 2024, concurrerende districten, en wie de kaart aannam en onder welke politieke controle. Daarbij het blok over de Senaat op dezelfde stemmen (besluit 7 van de eigenaar, 7 oktober 2026). De weergave op de site hoort bij het siteontwerp (taak 4.3 van het hoofdplan) en valt buiten dit plan.

**Architecture:** Census CD119 (de kaarten van de verkiezing van 2024) gaat als vierde kaart `map_2024` door `02_join`. Nieuwe pure functies in `gerry/metrics.py` (concurrerende districten, zetels bij een uniforme verschuiving, drempels op een raster van 0,01 procentpunt met bisectie) worden in `03_metrics.py` per staat en landelijk toegepast. Twee nieuwe velden per staat in `config.yaml` komen uit webonderzoek; `check_sources_md` houdt ze gelijk met een nieuwe kolom in `data/sources.md`. `build_results` neemt alles over in `results.json` en de contracttest controleert de samenhang. Voor de Senaat haalt `01_download` de presidentsuitslagen per staat van het MIT Election Data and Science Lab op; `02_join` schrijft daaruit de stemmen van de zes staten met één zetel naar een tussenbestand, en `03_metrics` zet die met de 44 staten van de stembasis in `national.senate`.

**Tech Stack:** zoals in het hoofdplan: Python 3.12 uit `.venv` (pandas 3, numpy, pytest), Node 24 voor `node --test`.

Ontwerp: `docs/superpowers/specs/2026-10-06-extensions-design.md` (hierna "het uitbreidingsontwerp"; de besluiten van de eigenaar staan in hoofdstuk 6). Hoofdontwerp: `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md` ("de spec"). Dit plan is fase 5 van `docs/superpowers/plans/2026-10-05-gerrymandering-map.md` ("het hoofdplan") en volgt de conventies daarvan.

## Global Constraints

- Alle regels uit "Global Constraints" van het hoofdplan gelden: worktree `C:\projects\Gerry\.worktrees\pipeline-setup`, branch `feature/pipeline-setup`, commit na elke taak met een Engels bericht zonder `Co-Authored-By`-regel, Python uit `.venv` (nooit `python3`), `$env:PYTHONUTF8=1` in elke nieuwe PowerShell-sessie, alle ID's en districtcodes als tekst, unit tests zonder netwerk en zonder datamap, tests op echte data met `@pytest.mark.data`.
- Begin pas als de taken waar deze fase op bouwt af zijn: 1.18 (`02_join`), 2.11 tot en met 2.13 (`03_metrics`, `validation.py`, PlanScore) en 3.1 tot en met 3.5 (export). Taak 2.13 wijzigt `pipeline/gerry/validation.py`, `tests/test_validation.py`, `data/validation_notes.yaml` en hoofdstuk 6 van de spec. Taak 5.8 en 5.14 raken dezelfde bestanden: lees eerst de actuele versie en pas de stappen daarop toe.
- Elke verwachte waarde in een unit test is met de hand uitgerekend; de berekening staat als commentaar bij de test.
- De uitkomsten op echte data in dit plan komen uit de proefrun hieronder. Wijkt een uitkomst af, verander dan nooit het verwachte getal. Volg de skill systematic-debugging; is de oorzaak een databron of een definitie, stop en vraag de eigenaar.
- Zichtbare tekst die deze fase toevoegt (de teksten van `adopted_note`) is Engels, zonder em-dashes, gaat door de unslop-skill en wordt door de eigenaar goedgekeurd (taak 5.9).
- Alle commando's draaien in PowerShell vanuit de root van de worktree.

## Indeling in taken

| Taak | Inhoud | Hangt af van |
|---|---|---|
| 5.1 | CD119 in het downloadplan en het manifest | fase 3 |
| 5.2 | `read_bef` leest CD119; `changed_blocks` telt verplaatste blokken | 5.1 |
| 5.3 | `02_join`: kaart `map_2024` voor alle 44 staten en `map_2024_changed_blocks` in `join_log.json` | 5.2 |
| 5.4 | `metrics.py`: concurrerende districten, zetels bij een verschuiving, exacte drempel voor Enacted | geen |
| 5.5 | `metrics.py`: raster en bisectie, drempel voor de neutrale kaarten en voor Proportional | 5.4 |
| 5.6 | `03_metrics`: `competitive` en `redraw` per staat | 5.3, 5.4 |
| 5.7 | `03_metrics`: `majority`, `competitive` en `redraw` landelijk, met de grens van 5 punten | 5.5, 5.6 |
| 5.8 | `docs/validation.md`: `map_2024` in de hele-eenheidscontrole en een regel per staat | 5.7, 2.13 |
| 5.9 | Onderzoek: wie nam elke kaart aan, onder welke controle (geen code) | de besluiten van 7 oktober (hieronder) |
| 5.10 | `config.yaml` en `gerry/config.py`: `adopted_by`, `control`, `adopted_note` | 5.9 |
| 5.11 | `check_sources_md` vergelijkt de nieuwe kolom van `data/sources.md` met `config.yaml` | 5.10 |
| 5.12 | `03_metrics`: `by_control` en `by_body` | 5.7, 5.10 |
| 5.13 | `results.json` en de contracttest | 5.8, 5.11, 5.12 |
| 5.14 | De spec verwijst naar de nieuwe velden | 5.13 |
| 5.15 | Het MIT-bestand met de presidentsuitslagen per staat in het downloadplan en het manifest | 5.14 |
| 5.16 | `gerry/president.py`: de stemmen van de zes staten met één zetel, gecontroleerd op de officiële uitslagen | 5.15 |
| 5.17 | `02_join`: `single_seat_votes.parquet` | 5.16 |
| 5.18 | `metrics.py`: de drempel voor de Senaat | 5.14 |
| 5.19 | `03_metrics`: `national.senate` | 5.17, 5.18 |
| 5.20 | `results.json` en de contracttest voor de Senaat | 5.19 |
| 5.21 | De spec verwijst naar de Senaat | 5.20 |

Afwijkingen van de voorgestelde indeling in acht taken, met reden:

- De join (voorstel 4) is gesplitst in 5.2 en 5.3. `02_join` kan CD119 pas lezen als `gerry/blocks.py` het kan, en die module heeft eigen tests.
- De pure functies (voorstel 5) zijn gesplitst in 5.4 en 5.5, en de koppeling in `03_metrics` (voorstel 6) in 5.6, 5.7, 5.8 en 5.12. Zo blijft elke taak zo groot als de taken van fase 2 in het hoofdplan.
- Het onderzoek (5.9) komt vóór de configuratievelden (5.10). De velden zijn verplicht, dus `config.yaml` kan pas geldig blijven als de waarden bekend zijn. Het onderzoek heeft geen code. De eigenaar besliste de beslisregels op 7 oktober 2026, dus het kan meteen beginnen, parallel aan 5.1 tot en met 5.8.
- Taak 5.11 is nieuw: `check_sources_md` vergelijkt de nieuwe kolom van `data/sources.md` met `config.yaml`, zoals nu al voor status, kaartnaam en bron (spec, hoofdstuk 6). Zie punt 5 van de besluiten van de eigenaar.
- `by_control` en `by_body` (5.12) staan apart, omdat ze `control` en `adopted_by` uit `config.yaml` nodig hebben.
- De Senaat (besluit 7, hoofdstuk 7 van het uitbreidingsontwerp) kwam er op 7 oktober bij, in zeven taken na 5.14: de databron (5.15), de lezer met de controle op de officiële uitslagen (5.16), het tussenbestand (5.17), de pure functie (5.18), de koppeling in `03_metrics` (5.19), de export (5.20) en de spec (5.21). Ze beginnen na 5.14, omdat hun verwachte uitkomsten (aantallen tests, de volgorde van de velden in `results.json`) de stand na 5.14 aannemen. Inhoudelijk hangt 5.18 alleen van 5.4 af.

## Keuzes in dit plan

Om na te gaan bij de review. De open punten van de Senaat staan in een eigen hoofdstuk verderop.

1. `map_changed` vergelijkt CD119 met het blokbestand van de vastgestelde kaart (`bef` van de staat: CD120, voor Missouri CD118). CD120 bevat voor Missouri HB 1, terwijl het uitbreidingsontwerp zegt dat de kaart van 2024 in Missouri de huidige kaart is. Met deze vergelijking heeft Missouri 0 verplaatste blokken. Negen staten hebben een andere kaart dan in 2024: AL, CA, FL, LA, NC, OH, TN, TX en UT.
2. `cd119.zip` bevat `NationalCD119.txt` (kop `GEOID,CDFP`, 8.174.955 blokken, alle staten plus DC en PR) en losse bestanden voor AL, GA, LA, NY en NC. Die vijf zijn blok voor blok gelijk aan het landelijke bestand (nagegaan in de proefrun). `read_bef` leest het landelijke bestand, één keer per proces, zoals CD120. De cache houdt nu twee landelijke bestanden vast.
3. `map_2024` krijgt in `02_join` dezelfde controles als de andere kaarten (eenheden gekoppeld, stemmen behouden, aantal districten) en in `03_metrics` dezelfde vergelijking van hele eenheden met de blokverdeling als `enacted` en de geblokkeerde kaart. In de proefrun geeft geen enkel district van 2024 een andere winnaar; het grootste verschil is 0,724 procentpunt in TN.
4. De vaste partij van de zes staten met één zetel (besluit 1 van de eigenaar) staat als constante `SINGLE_SEAT_PARTY` in `03_metrics.py`, net als `HOUSE_SEATS`. De pijplijn stopt als `config.yaml` andere staten met één zetel noemt.
5. De drempels op het raster zoekt `smallest_swing` met bisectie. Dat mag, omdat de voorwaarde monotoon is: een grotere verschuiving geeft per plan nooit minder zetels, en de convolutie behoudt die volgorde. Twaalf evaluaties per drempel; `03_metrics` duurt ongeveer 10 seconden.
6. De getallen "bij de echte stemmen" gebruiken de bestaande gelijkspelregel: `seats_at_base` is `national.enacted`, `probability_at_base` komt uit `national.neutral.dist`. De drempels gebruiken "aandeel plus verschuiving boven 0,5". Bij een verschuiving van 0 verschillen die alleen bij een exacte gelijke stand: één district in één plan van Nebraska. Daardoor is de kans 0,985345 met de gelijkspelregel en 0,985342 zonder.
7. De grens van 5 punten: `CheckError("majority_threshold", "US", ...)` als de exacte drempel voor Enacted meer dan 0,05 van *V0* ligt, of als het raster van -0,05 tot +0,05 geen drempel heeft. Ligt een rasterdrempel op precies -5 punten, dan stopt de pijplijn ook; dat ligt ver van de verwachte waarden.
8. `by_control` en `by_body` noemen elke waarde uit de tabellen van het uitbreidingsontwerp, in die volgorde, ook met 0 staten. De site kiest wat ze toont.
9. De som van `drawing` per waarde is de som van de tekeneffecten van de staten. Die is niet het landelijke tekeneffect, dat de landelijke mediaan gebruikt (spec, hoofdstuk 5). In de proefrun zijn ze toevallig gelijk (beide -10), omdat de som van de mediaan per staat (223) gelijk is aan de landelijke mediaan. De contracttest vergelijkt daarom met de som over de staten, niet met `national.effects.drawing`.

De Senaat (taak 5.15 tot en met 5.21):

10. Het MIT-bestand komt binnen via een directe link naar één Dataverse-bestand (`api/access/datafile/13887042`), niet via een tweede bestandslijst zoals bij ALARM. Het is één bestand, en een bestands-id van Dataverse wijst altijd naar dezelfde inhoud: een nieuwe versie met een ander bestand krijgt een nieuw id. Het manifest legt grootte en sha256 vast, zoals bij Census. Taak 5.15 vergelijkt de md5 één keer met de waarde die Dataverse publiceert. Zo blijven `plan_downloads(cfg, dv_files)` en `01_download.py` ongewijzigd.
11. Welke rijen tellen (taak 5.16): per staat en jaar alle rijen van de kandidaat van de partij, op elke partijlijn, zonder de rijen met `writein` waar. Zo vraagt het codeboek het voor tweepartijtotalen. De kandidaten staan als vaste namen in de code. De lezer stopt als een kandidaat niet precies één rij heeft op de lijn `DEMOCRAT` of `REPUBLICAN`, of als `writein` iets anders is dan TRUE of FALSE. In de zes staten heeft elke kandidaat precies één rij, zonder write-in-rij; de officiële uitslagen bevestigen de getallen.
12. De stemmen van de zes staten gaan via `02_join` naar `data/interim/single_seat_votes.parquet`, zodat `03_metrics` alleen tussenresultaten leest, zoals nu. `02_join` leest het MIT-bestand vóór de 44 staten en `03_metrics` het tussenbestand vóór de lus over de staten: een ontbrekend bestand stopt meteen.
13. De drempel voor de Senaat gebruikt dezelfde grens als Enacted: een staat precies op 50% telt niet, en bij de drempel zelf staat de 26e staat op 50%. `senate_majority` gebruikt daarom `enacted_threshold` en `seats_at_swing` uit taak 5.4. `tipping` loopt van hoog naar laag aandeel; bij een gelijk aandeel gaat de postcode voor (komt in de echte data niet voor).
14. Geen grens van 5 punten voor de Senaat. Bij het Huis beschermt die grens de vaste uitslag van de zes staten met één zetel; in het blok over de Senaat verschuiven die staten mee met de andere.
15. `results.json` heeft geen stemmen van de zes staten. De contracttest kan *V50* daarom niet narekenen en controleert de samenhang: de drempel volgt uit het aandeel van de 26e staat, de aandelen in `tipping` passen bij `d_share` en bij `states_at_base`. De getallen zelf staan vast in de datatest van taak 5.19.

## Proefrun

Op 6 oktober 2026 draaide de code uit dit plan in een kopie van de repo in de scratchmap van de sessie, met de echte datamap (alleen gelezen) en een eigen kopie van `cd119.zip`. Alle unit tests uit dit plan slaagden daar; de getallen hieronder zijn de uitkomsten op echte data.

CD119: 22.959.130 bytes, sha256 `1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6`, laatst gewijzigd 29 juli 2024.

Meerderheid (216 van de 429 districten):

| Getal | Waarde |
|---|---|
| *V0*, Democratisch tweepartijenaandeel over de 44 staten | 0,5179747 (51,80%) |
| Enacted, exact: het 216e hoogste districtsaandeel is 0,4949420 | 0,5230328 (52,30%), verschuiving +0,0050580 |
| Zetels Enacted bij *V0* | 213 |
| Neutral baseline, de helft van de uitkomsten haalt 216 | 0,5115747 (51,16%), verschuiving -0,0064 |
| Band: 5% en 95% van de uitkomsten haalt 216 | 0,5065747 tot 0,5159747 (verschuivingen -0,0114 en -0,0020) |
| Aandeel neutrale uitkomsten met 216 of meer bij *V0* | 0,9853454 |
| Proportional | 0,4978747 (49,79%), verschuiving -0,0201 |

Concurrerende districten (45% tot en met 55%): landelijk 81 op de vastgestelde kaarten, neutraal mediaan 96 (87 tot 105). Per staat onder meer:

| Staat | Enacted | Neutraal mediaan (p5 tot p95) |
|---|---|---|
| AZ | 4 | 4 (2 tot 5) |
| CA | 1 | 9 (6 tot 12) |
| FL | 14 | 7 (4 tot 9) |
| NC | 2 | 4 (3 tot 6) |
| NV | 3 | 2 (1 tot 2) |
| TX | 5 | 9 (4 tot 12) |
| WV | 0 | 0 (0 tot 0) |

Hertekeningen: landelijk 217 Democratische zetels op de kaarten van 2024 en 213 op de vastgestelde kaarten, netto -4. Alleen de negen veranderde staten hebben een ander aantal:

| Staat | Verplaatste blokken | Zetels kaart 2024 | Zetels Enacted | Verschil |
|---|---|---|---|---|
| AL | 23.529 | 2 | 1 | -1 |
| CA | 133.426 | 44 | 48 | +4 |
| FL | 99.385 | 10 | 9 | -1 |
| LA | 40.716 | 2 | 1 | -1 |
| NC | 18.826 | 4 | 3 | -1 |
| OH | 47.697 | 4 | 3 | -1 |
| TN | 63.380 | 1 | 0 | -1 |
| TX | 192.131 | 14 | 11 | -3 |
| UT | 47.874 | 0 | 1 | +1 |

Tekeneffect per staat (uit `metrics.json`, nodig om `by_control` en `by_body` in taak 5.12 na te rekenen): AZ -1, CA +3, CO +1, FL -4, IA -1, IL +3, KS -1, MD +1, MI +1, NC -3, NM +1, OH -2, OR +1, PA +1, SC -1, TN -2, TX -6, VA -1; alle andere staten 0. Som -10.

`by_body` met de huidige kolom "By" van `data/sources.md` als voorlopige `adopted_by` (taak 5.9 kan dat veranderen): Legislature 28 staten, 301 zetels, tekeneffect -9; Commission 9 staten (AZ, CO, HI, ID, MI, MT, NJ, OH, WA), 73 zetels, -1; Court 7 staten (CT, MN, NH, PA, UT, VA, WI), 55 zetels, 0. Voor `by_control` geeft dit plan geen getallen: die volgen uit het onderzoek.

Wat opvalt, en waarom het toch klopt:

- Proportional heeft minder dan 50% nodig. Largest remainder per staat geeft de Democraten bij *V0* 224 zetels, terwijl 429 maal *V0* 222,2 is: de afronding per staat levert nu ongeveer twee zetels extra op. Bij een verschuiving van -0,0201 krijgen IN en NY tegelijk een zetel (van 214 naar 216). Dat volgt uit de definitie in hoofdstuk 1 van het uitbreidingsontwerp. De zin op de site moet dit niet verbergen; zie punt 7 van de besluiten van de eigenaar.
- Florida heeft op de vastgestelde kaart 14 concurrerende districten en neutraal 7. De kaart is na de verkiezing van 2024 getekend; op onze stembasis (president 2016 en 2020) liggen 14 van de 28 districten tussen 45% en 55%. De noot `adopted_after_2024_election` legt het verschil in stembasis al uit.
- De drempel voor Enacted (52,30%) ligt boven *V0* (51,80%), omdat Enacted bij *V0* 213 zetels geeft. Bij de neutrale kaarten haalt 98,5% van de uitkomsten bij *V0* de meerderheid, zodat hun drempel (51,16%) eronder ligt.

Geen getal is onverklaard. De grens van 5 punten ligt ruim buiten alle drempels (de grootste verschuiving is -0,0201).

### Senaat

Op 7 oktober 2026 draaide de code van taak 5.15 tot en met 5.21 in een nieuwe kopie van de repo, met de code van taak 5.1 tot en met 5.14 uit de proefrun hierboven, de echte datamap (alleen gelezen) en een eigen kopie van het MIT-bestand. `02_join` en `03_metrics` liepen helemaal; `results.json` kwam uit `build_results` zonder de stappen voor de geometrie, die niet veranderen. Alle tests uit dit plan slaagden daar: pytest 493 passed en 2 skipped (de twee tests van mapshaper; de kopie had geen `node_modules`), `node --test` 32 passed. De mutaties van `national.senate` die de contracttest moet vangen (een andere drempel, `states_at_base`, `seats_at_base`, `states_needed`, twee staten in `tipping` verwisseld, een aandeel in `tipping` 1e-9 verschoven, een staat in `tipping` weg) faalden alle zeven.

MIT Election Data and Science Lab, "U.S. President 1976-2024", versie 10.1 van 4 september 2026, `1976-2024-president.csv`: 514.108 bytes, md5 `405af83db7625cb35d8c19a5ebe029ff` (gelijk aan de waarde van Dataverse), sha256 `9936410a6dd4ecc8be7fe202c6dff5b5f8fee59d88f35ab542ed12879941dcb7`, licentie CC0 1.0. De 24 getallen van de zes staten zijn gelijk aan de officiële uitslagen (taak 5.16), op één bron na in Delaware (open punt 2 bij de Senaat).

| Getal | Waarde |
|---|---|
| *V50*, Democratisch tweepartijenaandeel over de 50 staten | 0,5169609 (51,70%) |
| Drempel: het 26e hoogste staatsaandeel is 0,4878762 (FL) | 0,5290847 (52,91%), verschuiving +0,0121238 |
| Bij *V50* | 22 staten, 44 zetels |
| De 24e tot en met de 28e staat | AZ 0,4929715, GA 0,4888521, FL 0,4878762, NC 0,4876063, TX 0,4635184 |

De zes staten met één zetel: VT 0,6694452 (plaats 1), DE 0,5796321 (11), AK 0,4333627 (32), SD 0,3540789 (45), ND 0,3156498 (48), WY 0,2602595 (50). De 22 staten met een Democratische meerderheid zijn de 20 die de Democraten in 2016 en in 2020 wonnen, plus MI (0,5073) en PA (0,5014). De 23e staat is WI, met 0,4998024 net onder 50%. *V50* ligt 0,1 punt onder *V0* (0,5179747): de zes staten met één zetel stemden samen voor 44,8% Democratisch (1.829.549 tegen 2.256.272).

Een eerste schatting uit losse uitslagen gaf dezelfde getallen (*V50* 0,5170, drempel 0,5291, 22 staten, FL op plaats 26, GA op 25). Die noemde WI tot en met NC als de staten rond de drempel; dat zijn de plaatsen 23 tot en met 27. Volgens het uitbreidingsontwerp zijn het de plaatsen 24 tot en met 28, dus AZ tot en met TX.

## Besluiten van de eigenaar

Op 7 oktober 2026 besliste de eigenaar over de acht open punten van dit plan (uitbreidingsontwerp, hoofdstuk 6, besluit 5 en 6). De nummers hieronder zijn die van de vroegere open punten; taak 5.9 noemt ze "punt 1" tot en met "punt 8". "Besluit N" blijft in dit plan de nummering van hoofdstuk 6 van het uitbreidingsontwerp volgen.

1. **Overlap in de definitie van `control`.** De stemming gaat voor. Stemde in elke kamer die stemde een meerderheid van de aanwezige leden van elke partij voor, dan is de kaart `Bipartisan`; anders bepaalt de controle over het besluit de waarde. Taak 5.9 gaat dit in elk geval na voor Iowa 2021 en New York 2024.
2. **Geen veto van de gouverneur.** Een partij die de kaart zonder de gouverneur kan aannemen, kon haar alleen aannemen. North Carolina wordt `Republican`, met een `adopted_note`.
3. **Welke commissie is onafhankelijk.** `Nonpartisan` zijn de commissies van burgers zonder gekozen politici, met leden zonder partij die de doorslag kunnen geven: AZ, CO en MI. De andere commissies (HI, ID, MT, NJ, OH, WA) gaan op de stemming: `Bipartisan` als leden van beide partijen voorstemden of als geen partij alleen een meerderheid had, de naam van een partij als haar leden de meerderheid vormden en de andere partij tegenstemde. Een lid zonder partij dat de doorslag gaf (te verwachten in NJ en MT), telt niet als partij (besluit 5). Zulke kaarten worden `Bipartisan`, met een `adopted_note` die zegt wie de doorslag gaf en voor welk voorstel.
4. **Gemengde routes.** `adopted_by` is het orgaan dat de geldende districtsgrenzen vaststelde; de andere stappen (goedkeuring door een rechter of door de kiezers, een wijziging door het parlement, een bevel van een rechter) gaan in `adopted_note`. WA wordt zo `Commission` en MN `Court`, tenzij het onderzoek laat zien dat de wijziging meer was dan een correctie. Dan stopt taak 5.9 en vraagt de eigenaar.
5. **Eén nieuwe kolom in `data/sources.md`.** De kolom heet "Adoption and control" en elke cel begint met `<adopted_by>, <control>.`, zodat `check_sources_md` haar met `config.yaml` kan vergelijken (taak 5.11).
6. **`drawn_by` in het uitbreidingsontwerp.** Bedoeld was het overzicht per `control` en per `adopted_by`. Hoofdstuk 5 van het uitbreidingsontwerp zegt dat nu zo.
7. **Proportional onder 50%.** Geen wijziging in de pijplijn. Het siteontwerp (taak 4.3 van het hoofdplan) kiest de zin die uitlegt dat de afronding per staat de drempel onder 50% brengt.
8. **De vaste partij van de zes staten met één zetel.** Die komt als vaste tekst op de site, niet als veld in `results.json`. `national.single_seat` blijft zoals het is; er komt geen extra taak.

Besluit 7 voegt de Senaat toe als apart blok (hoofdstuk 7 van het uitbreidingsontwerp): taak 5.15 tot en met 5.21.

## Open punten bij de Senaat

Ontstaan bij het uitwerken van besluit 7. Ze blokkeren geen taak: de taken volgen de aanbeveling, en een ander besluit verandert alleen de bronvermelding of een commentaar.

1. **Titel en versie van de databron.** Het uitbreidingsontwerp noemt "U.S. President 1976-2020". Dezelfde dataset (doi:10.7910/DVN/42MVDX) heet sinds versie 9.0 (11 mei 2026) "U.S. President 1976-2024", met 2024 erbij. De huidige versie is 10.1 (4 september 2026), met het bestand `1976-2024-president.csv`. De rijen van 2016 en 2020 zijn in de proefrun vergeleken met die van versie 8.0, de laatste met de oude titel: alle 892 rijen zijn gelijk, op drie lege velden `writein` in Maryland 2020 na, die versie 8.0 als `NA` schrijft. Aanbeveling: versie 10.1 gebruiken en noemen met de huidige titel. Het alternatief is versie 8.0 (`1976-2020-president.tab`, via `?format=original`), met dezelfde getallen.
2. **Delaware 2020 heeft twee officiële getallen.** De officiële uitslag van de Department of Elections van Delaware geeft Biden 296.268 en Trump 200.603, net als de FEC en het MIT-bestand. Het Certificate of Ascertainment van de gouverneur (National Archives) noemt voor de kiesmannen 295.933 en 200.327: 335 en 276 stemmen minder. De andere 22 getallen van de zes staten zijn in alle bronnen gelijk. Aanbeveling: de officiële uitslag van de verkiezingsdienst is de referentie, zoals in de test van taak 5.16. Met de getallen van het certificaat daalt *V50* met 0,00000007 en de drempel ook; geen staat verandert van plaats.

## Interfaces

Dit hoofdstuk vult "Interfaces" van het hoofdplan aan. Namen, typen en kolommen zijn bindend.

### Datamap

```
census/cd119.zip                 Census 119th Congress block equivalency file, NationalCD119.txt (GEOID,CDFP)
medsl/1976-2024-president.csv    MIT Election Data and Science Lab, U.S. President 1976-2024, versie 10.1 (Senaat)
```

Het downloadplan telt 142 bestanden: na `census/cd118.zip` komt `census/cd119.zip`, daarna `census/cd120.zip`. `data/manifest.json` krijgt de regel `census/cd119.zip` met grootte 22959130 en sha256 `1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6`.

Na taak 5.15 telt het downloadplan 143 bestanden, met `medsl/1976-2024-president.csv` als laatste. `data/manifest.json` krijgt daarvoor de regel met grootte 514108 en sha256 `9936410a6dd4ecc8be7fe202c6dff5b5f8fee59d88f35ab542ed12879941dcb7`.

### config.yaml

```yaml
sources:
  cd119: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip
  medsl_president: https://dataverse.harvard.edu/api/access/datafile/13887042    # taak 5.15
states:
  TX:
    # ... de bestaande velden
    adopted_by: Legislature          # Legislature | Commission | Court
    control: Republican              # Republican | Democratic | Bipartisan | Nonpartisan
    adopted_note: "..."              # optioneel, Engels, zichtbaar op de site
```

Een kaart van een rechter is altijd `Nonpartisan`; een kaart van een parlement is nooit `Nonpartisan`. `map_2024` is een gereserveerd kaart-id, net als `enacted` en `check_2022`.

### Python-modules

```python
# gerry/config.py
ADOPTED_BY_VALUES = ("Legislature", "Commission", "Court")
CONTROL_VALUES = ("Republican", "Democratic", "Bipartisan", "Nonpartisan")
class StateConfig: ...                 # na notes: adopted_by: str; control: str; adopted_note: str | None
# sources: ook "cd119"

# gerry/blocks.py
NATIONAL_FILES = {"cd119": "NationalCD119.txt", "cd120": "NationalCD120.txt"}
def read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series   # kind: cd118 | cd119 | cd120
def changed_blocks(old: pd.Series, new: pd.Series) -> int
    # blokken met een ander district; een blok dat in maar één van beide staat, telt mee

# pipeline/02_join.py
def maps_of(st) -> list[tuple[str, str]]
    # [("enacted", st.bef), *extra_maps, ("check_2022", "cd118"), ("map_2024", "cd119")]

# gerry/metrics.py
COMPETITIVE_LOW = 0.45
COMPETITIVE_HIGH = 0.55
def competitive(shares) -> np.ndarray          # aantal aandelen in [0,45; 0,55] langs de laatste as
def seats_at_swing(shares, swing: float) -> np.ndarray   # aantal met aandeel + swing > 0,5 langs de laatste as
def enacted_threshold(shares, needed: int) -> float      # 0,5 - h, h het needed-de hoogste aandeel
SWING_GRID = 10_000                            # stappen per eenheid aandeel: 0,0001 per stap
MAX_SWING_STEPS = 500                          # 5 procentpunt
class SwingRangeError(ValueError): ...
def smallest_swing(holds, max_steps: int = MAX_SWING_STEPS) -> float
    # kleinste k / SWING_GRID met -max_steps < k <= max_steps waarvoor holds waar is
def majority_probability(plan_shares, swing: float, needed: int) -> float
def neutral_threshold(plan_shares, needed: int, q: float) -> float
def proportional_at_swing(state_shares, seats, swing: float) -> int
def proportional_threshold(state_shares, seats, needed: int) -> float

# pipeline/03_metrics.py
HOUSE_MAJORITY = 218
SINGLE_SEAT_PARTY = {"AK": "R", "DE": "D", "ND": "R", "SD": "R", "VT": "D", "WY": "R"}
def plan_shares(ensemble, st) -> np.ndarray                       # plannen x districten
def state_competitive(st, enacted, ensemble) -> dict
def state_redraw(st, enacted, enacted_seats: int, changed_blocks: int) -> dict
def seats_needed(at_large) -> int                                  # 216
def national_majority(*, base_share, needed, enacted_shares, plan_shares, state_shares, state_seats,
                      seats_at_base, neutral_pmf) -> dict
def national_competitive(states) -> dict
def national_redraw(states) -> dict
def national_by(states, cfg_states, field: str) -> dict            # field: "control" | "adopted_by"
# nieuwe CheckError-controles: redraw, single_seat_party, majority_threshold; interim_files ook bij
# een join_log.json zonder map_2024_changed_blocks

# gerry/validation.py
# nieuw deel "## Maps of the 2024 election" direct na het deel over hele eenheden, uit checks.map_2024

# gerry/checks.py
# parse_sources_md: rijen onder "Multi-seat states" krijgen "adoption" (kolom "Adoption and control");
# check_sources_md: de cel begint met f"{adopted_by}, {control}."

# gerry/export.py
NATIONAL_FIELDS = (..., "outside_band", "majority", "competitive", "redraw", "by_control", "by_body")
STATE_FIELDS = (..., "sorted", "competitive", "redraw")
# en per staat "adopted": {"by", "control", "note"} uit config.yaml
```

De Senaat (taak 5.15 tot en met 5.20):

```python
# gerry/config.py
# sources: ook "medsl_president"

# gerry/president.py (nieuw)
ELECTIONS = {"pre_16": "2016", "pre_20": "2020"}
NOMINEES = {"2016": {"d": "CLINTON, HILLARY", "r": "TRUMP, DONALD J."},
            "2020": {"d": "BIDEN, JOSEPH R. JR", "r": "TRUMP, DONALD J."}}
PARTY_LINES = {"d": "DEMOCRAT", "r": "REPUBLICAN"}
class PresidentError(ValueError): ...
def read_president(path: Path) -> pd.DataFrame
    # year, state_po, candidate, party_detailed, writein als tekst; candidatevotes als int64
def two_party_votes(table: pd.DataFrame, postals: Iterable[str]) -> pd.DataFrame
    # state, d_pre_16, r_pre_16, d_pre_20, r_pre_20, d, r; een rij per postcode, in de gegeven volgorde

# pipeline/02_join.py
def single_seat_votes(cfg, root: Path) -> pd.DataFrame   # two_party_votes voor sorted(cfg.at_large)

# gerry/metrics.py
def senate_majority(votes: Mapping[str, tuple[float, float]], needed: int, around: int = 2) -> dict
    # {"base_share", "states_needed", "share", "states_at_base", "seats_at_base",
    #  "tipping": [{"postal", "share"}, ...]}; tipping: plaats needed - around tot en met needed + around

# pipeline/03_metrics.py
SENATE_STATES = 50
SENATE_STATES_NEEDED = 26
def read_single_seat_votes(idir, at_large) -> dict[str, tuple[float, float]]
def national_senate(votes: Mapping[str, tuple[float, float]]) -> dict
# nieuwe CheckError-controle: senate_states; interim_files ook bij een ontbrekende single_seat_votes.parquet

# gerry/export.py
NATIONAL_FIELDS = (..., "by_control", "by_body", "senate")
```

### Bestanden tussen de stappen (`data/interim/`)

- `enacted_districts.parquet`: `map_id` kan ook `map_2024` zijn, met `block` en `whole_unit` voor elke staat. Samen 2.590 rijen (was 1.732).
- `join_log.json`: per staat ook `map_2024_changed_blocks` (int, verplaatste blokken tussen CD119 en het blokbestand van de vastgestelde kaart), en onder `maps` ook `map_2024`.
- `single_seat_votes.parquet` (nieuw, taak 5.17): `state`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d`, `r` (gehele getallen) voor de zes staten met één zetel, gesorteerd op postcode.
- `metrics.json`:
  - per staat ook `competitive` {`enacted`, `median`, `p5`, `p95`, `neutral_dist`: aantal plannen per aantal concurrerende districten, 0 tot `seats`} en `redraw` {`seats_2024`, `change`, `map_changed`};
  - `national` ook `majority` {`seats_needed`, `base_share`, `enacted` {`share`, `seats_at_base`}, `neutral` {`share`, `low`, `high`, `probability_at_base`}, `proportional` {`share`}}, `competitive` (zelfde vorm als per staat, `neutral_dist` met 430 kansen), `redraw` {`seats_2024`, `change`}, `by_control` en `by_body` (per waarde {`states`, `seats`, `drawing`}), en vanaf taak 5.19 `senate` {`base_share`, `states_needed`, `share`, `states_at_base`, `seats_at_base`, `tipping`: lijst van {`postal`, `share`}};
  - `checks` ook `map_2024` {ST: {`districts`, `changed_blocks`, `seats_2024`, `seats_enacted`}}; `whole_unit` heeft ook regels met `map_id` `map_2024`.

### Uitvoer voor de site

`site/data/results.json` krijgt de velden uit hoofdstuk 5 van het uitbreidingsontwerp: `national.majority`, `national.competitive`, `national.redraw`, `national.by_control`, `national.by_body`, en per staat `adopted` {`by`, `control`, `note`}, `competitive` en `redraw`. Uit hoofdstuk 7 komt `national.senate` erbij, met de velden van `metrics.json`. Volgorde in `national`: de zeven bestaande velden, dan `majority`, `competitive`, `redraw`, `by_control`, `by_body`, `senate`, dan `single_seat`. Per staat staat `adopted` direct na `source`. Aandelen blijven ruwe fracties.

## Phase 5: uitbreidingen

Na deze fase heeft `results.json` de velden van hoofdstuk 5 van het uitbreidingsontwerp en `national.senate` uit hoofdstuk 7, met dezelfde stembasis en dezelfde plannen als de rest, en controleert de contracttest hun samenhang.

### Task 5.1: CD119 in het downloadplan

**Files:**
- Modify: `pipeline/config.yaml` (bron `cd119`)
- Modify: `pipeline/gerry/config.py` (`_SOURCE_KEYS`)
- Modify: `pipeline/gerry/sources.py` (`plan_downloads`)
- Modify: `tests/test_config.py`, `tests/test_sources.py`
- Modify (na de download): `data/manifest.json`

**Interfaces:**
- Consumes: `plan_downloads(cfg, dv_files)` en `fetch` (hoofdplan, taak 1.1, 1.2, 1.12); `load_config()` (taak 0.4).
- Produces: bron `cfg.sources["cd119"]`; een downloadplan van 142 bestanden met `census/cd119.zip` tussen `census/cd118.zip` en `census/cd120.zip`; een regel voor `census/cd119.zip` in `data/manifest.json`.

- [ ] **Step 1: Write the failing tests**

Zet in `tests/test_config.py` `cd119` in de lijst van bronnen:

```python
SOURCE_KEYS = ("dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
               "tiger_gpkg", "tiger_mo_cd119", "cb_states")
```

Voeg in `tests/test_config.py` direct na `test_real_config_globals` toe:

```python
def test_real_config_has_the_block_file_of_the_2024_maps(cfg):
    # extensions design, chapter 2: the maps of the 2024 election, Census CD119 (2024-07-29)
    assert cfg.sources["cd119"] == ("https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/"
                                    "119-congressional-district-befs/cd119.zip")
```

Zet in `tests/test_sources.py` in het woordenboek `SOURCES` na de regel van `cd118`:

```python
    "cd119": "https://www2.census.gov/x/cd119.zip",
```

en in `test_plan_downloads_follows_the_data_dir_layout` tussen de verwachte downloads van `cd118.zip` en `cd120.zip`:

```python
        # the maps of the 2024 election, reference for the redraws (extensions design, chapter 2)
        Download("census/cd119.zip", "https://www2.census.gov/x/cd119.zip", None, None),
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_sources.py -q`
Expected: `4 failed, 56 passed`: `test_minimal_config_loads_with_types` (`ConfigError: sources: unknown keys ['cd119']`), `test_invalid_config_raises[sources.cd120-None-missing keys]` (dezelfde melding in plaats van `missing keys`), `test_real_config_has_the_block_file_of_the_2024_maps` (`KeyError: 'cd119'`) en `test_plan_downloads_follows_the_data_dir_layout` (de download van `cd119.zip` ontbreekt).

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/config.py`:

```python
_SOURCE_KEYS = (
    "dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
    "tiger_gpkg", "tiger_mo_cd119", "cb_states",
)
```

In `pipeline/config.yaml`, onder `sources:` direct na de regel van `cd118`:

```yaml
  cd119: https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip
```

In `pipeline/gerry/sources.py`, in `plan_downloads`, vervang

```python
    plan.append(Download("census/cd118.zip", src["cd118"], None, None))
    plan.append(Download("census/cd120.zip", src["cd120"], None, None))
```

door:

```python
    plan.append(Download("census/cd118.zip", src["cd118"], None, None))
    # the maps of the 2024 election, reference for the redraws (extensions design, chapter 2)
    plan.append(Download("census/cd119.zip", src["cd119"], None, None))
    plan.append(Download("census/cd120.zip", src["cd120"], None, None))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_sources.py tests/test_download_script.py -q`
Expected: `65 passed`.

- [ ] **Step 5: Download CD119**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/01_download.py`

Het script loopt de 142 bestanden langs, controleert de checksum van elk bestand dat er al is (samen enkele minuten) en haalt alleen `cd119.zip` op. Expected: de regel `[ 94/142] census/cd119.zip downloaded (23.0 MB)`, alle andere regels `present`, en als slot `142 files: 1 downloaded, 141 present, 2,542,911,196 bytes, ...` en `Manifest ...\data\manifest.json has entries for 142 of these files`.

Run: `git diff data/manifest.json`
Expected: één nieuwe vermelding:

```json
  "census/cd119.zip": {
    "url": "https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip",
    "size": 22959130,
    "sha256": "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6"
  },
```

Is de grootte of de checksum anders, stop dan: Census heeft het bestand vervangen. Vraag de eigenaar voordat je verdergaat.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/config.yaml pipeline/gerry/config.py pipeline/gerry/sources.py tests/test_config.py tests/test_sources.py data/manifest.json
git commit -m "Download the Census block file of the 2024 maps (CD119)"
```

### Task 5.2: read_bef leest CD119, changed_blocks

**Files:**
- Modify: `pipeline/gerry/blocks.py`
- Modify: `tests/test_blocks.py`

**Interfaces:**
- Consumes: `read_bef` (hoofdplan, taak 1.7).
- Produces: `NATIONAL_FILES = {"cd119": "NationalCD119.txt", "cd120": "NationalCD120.txt"}`; `read_bef(zip_path, "cd119", fips, postal)` met dezelfde uitvoer als voor `cd120` (index `block_id`, waarde `district`, naam `district`); `changed_blocks(old, new) -> int`. Het landelijke bestand wordt per proces één keer gelezen; de cache heeft plaats voor CD119 en CD120 samen. Een onbekend soort bestand blijft een `BlocksError`.

- [ ] **Step 1: Write the failing tests**

Vervang in `tests/test_blocks.py` de importregel van `gerry.blocks` door:

```python
from gerry.blocks import (PL_GEO_FIELDS, BlocksError, block_weighted, changed_blocks, read_bef, read_pl_blocks,
                          read_pl_counties, unit_of_block, whole_unit)
```

`cd119` is straks een bekend soort. Vervang `test_read_bef_rejects_an_unknown_kind` door:

```python
def test_read_bef_rejects_an_unknown_kind(tmp_path):
    with pytest.raises(BlocksError, match="cd117"):
        read_bef(make_cd120_zip(tmp_path / "cd120.zip"), "cd117", "01", "AL")
```

Voeg direct daaronder toe:

```python
def make_cd119_zip(path):
    # CD119: a national file with only GEOID and CDFP, plus files for the states that redrew in 2023 and 2024
    text = ("GEOID,CDFP\r\n"
            "010010201001000,06\r\n"
            "010010201001001,02\r\n"
            "320010001001000,02\r\n")
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("NationalCD119.txt", text)
        zf.writestr("01_AL_CD119.txt", "not read")
    return path


def test_read_bef_cd119_reads_the_national_file(tmp_path):
    bef = read_bef(make_cd119_zip(tmp_path / "cd119.zip"), "cd119", "01", "AL")
    assert bef.name == "district" and bef.index.name == "block_id"
    assert bef.to_dict() == {"010010201001000": "06", "010010201001001": "02"}


def test_read_bef_keeps_cd119_and_cd120_apart(tmp_path):
    # both national files stay in the cache at the same time; the cache must not mix them up
    cd119 = make_cd119_zip(tmp_path / "cd119.zip")
    cd120 = make_cd120_zip(tmp_path / "cd120.zip")
    for _ in range(2):
        assert read_bef(cd119, "cd119", "01", "AL").to_dict() == {"010010201001000": "06", "010010201001001": "02"}
        assert read_bef(cd120, "cd120", "01", "AL").to_dict() == {"010010201001000": "07", "010010201001001": "02"}


def bef(mapping):
    return pd.Series(mapping, name="district").rename_axis("block_id")


def test_changed_blocks_counts_blocks_with_another_district():
    old = bef({"320010001001000": "01", "320010001001001": "02", "320010001001002": "ZZ"})
    new = bef({"320010001001000": "01", "320010001001001": "01", "320010001001002": "ZZ"})
    # only block ...001 moves, from district 02 to 01
    assert changed_blocks(old, new) == 1
    assert changed_blocks(old, old) == 0


def test_changed_blocks_counts_a_block_in_one_file_only():
    old = bef({"320010001001000": "01", "320010001001001": "02"})
    new = bef({"320010001001000": "01", "320010001001002": "02"})
    # ...001 is only in old, ...002 only in new: two changed blocks
    assert changed_blocks(old, new) == 2
```

Zet onder `CD120 = ...` de regel

```python
CD119 = data_dir() / "census" / "cd119.zip"
```

en voeg direct na `test_nevada_block_equivalency_files` een test op echte data toe:

```python
@pytest.mark.data
@pytest.mark.skipif(not (CD119.exists() and CD120.exists() and CD118.exists()),
                    reason="needs census/cd119.zip, cd120.zip and cd118.zip")
def test_2024_block_file_against_the_maps_of_2026():
    # Nevada did not redraw; Missouri votes in 2026 on its 2022 map (CD118), which CD119 also has
    assert changed_blocks(read_bef(CD120, "cd120", "32", "NV"), read_bef(CD119, "cd119", "32", "NV")) == 0
    assert changed_blocks(read_bef(CD118, "cd118", "29", "MO"), read_bef(CD119, "cd119", "29", "MO")) == 0
    # Alabama: the 2024 court map in CD119, the legislature's 2023 plan in CD120
    assert changed_blocks(read_bef(CD120, "cd120", "01", "AL"), read_bef(CD119, "cd119", "01", "AL")) == 23529
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_blocks.py -q`
Expected: collection error `ImportError: cannot import name 'changed_blocks' from 'gerry.blocks'`.

- [ ] **Step 3: Write minimal implementation**

Vervang in `pipeline/gerry/blocks.py` de functie `_national_cd120` en het begin van `read_bef`:

```python
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
```

door:

```python
# Block equivalency files with one national table: the 2024 maps (CD119) and the 2026 maps (CD120)
NATIONAL_FILES = {"cd119": "NationalCD119.txt", "cd120": "NationalCD120.txt"}


@functools.lru_cache(maxsize=2)
def _national(zip_path: str, member: str) -> dict[str, pd.DataFrame]:
    """A national block equivalency file, read once and split by state FIPS (first two GEOID characters).
    Room for two files, so 02_join keeps CD119 and CD120 both in memory."""
    with zipfile.ZipFile(zip_path) as zf, zf.open(member) as fh:
        table = pd.read_csv(fh, engine="c", usecols=["GEOID", "CDFP"], dtype=str, keep_default_na=False)
    return {fips: part for fips, part in table.groupby(table["GEOID"].str[:2], sort=False)}


def read_bef(zip_path: Path, kind: str, fips: str, postal: str) -> pd.Series:
    """Block -> district code for one state. cd119, cd120: national file; cd118: {fips}_{postal}_CD118.txt."""
    if kind in NATIONAL_FILES:
        table = _national(str(Path(zip_path).resolve()), NATIONAL_FILES[kind]).get(fips)
```

De rest van `read_bef` blijft gelijk. Voeg direct na `read_bef` toe:

```python
def changed_blocks(old: pd.Series, new: pd.Series) -> int:
    """Blocks whose district differs between two block equivalency files of one state (from read_bef).
    A block that is in only one of the two counts as changed."""
    blocks = old.index.union(new.index)
    return int((old.reindex(blocks) != new.reindex(blocks)).sum())
```

Een blok dat in één bestand ontbreekt, wordt na `reindex` een ontbrekende waarde; `!=` geeft daar `True`, ook als beide ontbreken.

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_blocks.py -q`
Expected: `29 passed` (zonder datamap: `26 passed, 3 skipped`). De test op echte data leest beide landelijke bestanden en duurt ongeveer 20 seconden.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/blocks.py tests/test_blocks.py
git commit -m "Read the CD119 block file and count blocks that changed district"
```

### Task 5.3: 02_join, de kaart van 2024

**Files:**
- Modify: `pipeline/02_join.py`
- Modify: `pipeline/gerry/config.py` (`_RESERVED_MAP_IDS`)
- Modify: `tests/test_join.py`, `tests/test_config.py`
- Create (gegenereerd, niet in git): nieuwe versies van `data/interim/enacted_districts.parquet` en `join_log.json`

**Interfaces:**
- Consumes: `read_bef` met `cd119` en `changed_blocks` (taak 5.2); de controles van `join_state` (hoofdplan, taak 1.18).
- Produces: `maps_of(st)` eindigt op `("map_2024", "cd119")`; `enacted_districts.parquet` heeft per staat `map_2024` met `block` en `whole_unit`; `join_log.json` heeft per staat `map_2024_changed_blocks` (int) en `maps.map_2024`. `map_2024` is een gereserveerd kaart-id in `config.yaml`.

`changed_blocks` vergelijkt CD119 met het blokbestand van de vastgestelde kaart (`st.bef`), niet met CD120. Zo blijft Missouri, dat in 2026 op zijn kaart van 2022 stemt, ongewijzigd (zie "Keuzes in dit plan", punt 1).

- [ ] **Step 1: Write the failing tests**

Vervang in `tests/test_join.py` de test `test_maps_of_lists_enacted_extra_and_check_map` en de helper `files_of` door:

```python
def test_maps_of_lists_enacted_extra_check_and_2024_maps():
    cfg = load_config()
    join = load_script()
    assert join.maps_of(cfg.states["NV"]) == [("enacted", "cd120"), ("check_2022", "cd118"), ("map_2024", "cd119")]
    assert join.maps_of(cfg.states["MO"]) == [("enacted", "cd118"), ("mo_hb1", "cd120"), ("check_2022", "cd118"),
                                              ("map_2024", "cd119")]


def files_of(postal, *extra):
    st = postal.lower()
    return [data_dir() / p for p in (f"alarm/{postal}_cd_2020_map.rds", f"alarm/{postal}_cd_2020_stats.csv",
                                     f"census/pl/{st}2020.pl.zip", "census/cd120.zip", "census/cd118.zip",
                                     "census/cd119.zip", *extra)]
```

Voeg onderaan `test_nevada_join_reproduces_the_reference_numbers` toe:

```python
    # Nevada has not redrawn since 2021: the 2024 map (CD119) is the enacted map, block for block
    assert log["map_2024_changed_blocks"] == 0
    assert shares(pick("map_2024", "block")).equals(block)
```

Voeg direct na die test toe:

```python
@pytest.mark.data
@pytest.mark.skipif(not all(p.exists() for p in files_of("AL")), reason="needs the Alabama files")
def test_alabama_join_has_another_map_in_2024():
    result = load_script().join_state(load_config(), "AL", data_dir())
    enacted = result.enacted
    pick = lambda map_id: enacted[(enacted["map_id"] == map_id) & (enacted["method"] == "block")]
    # the 2024 court map (CD119) against the legislature's 2023 plan (CD120): 23,529 blocks moved
    assert result.log["map_2024_changed_blocks"] == 23529
    # prototype on the real data: two districts above one half on the 2024 map, one on the 2026 map
    assert int((shares(pick("map_2024")) > 0.5).sum()) == 2
    assert int((shares(pick("enacted")) > 0.5).sum()) == 1
    # the same votes on both maps
    assert pick("map_2024")["d"].sum() == pytest.approx(pick("enacted")["d"].sum(), rel=1e-9)
```

Voeg in `tests/test_config.py` aan `BAD_VALUES` toe, na de regel met `"more than once"`:

```python
    # map_2024 is the map id of the 2024 map in 02_join.py (Task 5.3)
    ("states.MO.extra_maps.map_2024", {"name": "x", "status": "Blocked", "bef": "cd120", "source_label": "x",
                                       "source_url": "https://example.org/x"}, "not a valid map id"),
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_join.py tests/test_config.py -q`
Expected: `4 failed, 43 passed`: `test_maps_of_lists_enacted_extra_check_and_2024_maps`, de tests voor Nevada en Alabama (`KeyError: 'map_2024_changed_blocks'`) en `test_invalid_config_raises[states.MO.extra_maps.map_2024-...]` (`DID NOT RAISE`).

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/config.py`:

```python
_RESERVED_MAP_IDS = ("enacted", "check_2022", "map_2024")
```

In `pipeline/02_join.py`, de import van `gerry.blocks`:

```python
from gerry.blocks import (BlocksError, block_weighted, changed_blocks, read_bef, read_pl_blocks, read_pl_counties,
                          unit_of_block, whole_unit)
```

`maps_of`:

```python
def maps_of(st) -> list[tuple[str, str]]:
    """(map_id, block equivalency file): the enacted map, extra maps, the 2022 map for the check, and the map
    of the 2024 election for the redraws (extensions design, chapter 2)."""
    return [("enacted", st.bef), *((m.id, m.bef) for m in st.extra_maps), ("check_2022", "cd118"),
            ("map_2024", "cd119")]
```

In `join_state`, vervang

```python
    rows = []
    for map_id, bef in maps_of(st):
        district_of = read_bef(root / "census" / f"{bef}.zip", bef, st.fips, postal)
        check_units_linked(units, unit_of, district_of, postal)
```

door:

```python
    rows, befs = [], {}
    for map_id, bef in maps_of(st):
        district_of = read_bef(root / "census" / f"{bef}.zip", bef, st.fips, postal)
        befs[map_id] = district_of
        check_units_linked(units, unit_of, district_of, postal)
```

en zet direct vóór `enacted = pd.concat(rows, ignore_index=True)`:

```python
    # map_changed in 03_metrics: does any block lie in another district than on the 2024 map?
    info["map_2024_changed_blocks"] = changed_blocks(befs["map_2024"], befs["enacted"])
    if info["map_2024_changed_blocks"]:
        log.info("%s: %d blocks lie in another district than on the 2024 map (CD119)", postal,
                 info["map_2024_changed_blocks"])
```

De kaart van 2024 doorloopt zo dezelfde stappen als de andere kaarten: `check_units_linked`, `block_weighted` en `whole_unit`, `check_conservation` en `check_district_count`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_join.py tests/test_config.py -q`
Expected: `47 passed`, in ongeveer 30 seconden.

- [ ] **Step 5: Run the join for all 44 states**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/02_join.py`

Dit duurt ongeveer vijf minuten. De regels per staat zijn dezelfde als in taak 1.18 van het hoofdplan (alleen de tijden verschillen). Nieuw zijn negen ingesprongen regels, elk direct vóór de regel van de staat:

```
  AL: 23529 blocks lie in another district than on the 2024 map (CD119)
  CA: 133426 blocks lie in another district than on the 2024 map (CD119)
  FL: 99385 blocks lie in another district than on the 2024 map (CD119)
  LA: 40716 blocks lie in another district than on the 2024 map (CD119)
  NC: 18826 blocks lie in another district than on the 2024 map (CD119)
  OH: 47697 blocks lie in another district than on the 2024 map (CD119)
  TN: 63380 blocks lie in another district than on the 2024 map (CD119)
  TX: 192131 blocks lie in another district than on the 2024 map (CD119)
  UT: 47874 blocks lie in another district than on the 2024 map (CD119)
```

Als laatste: `Wrote 44 states to ...\data\interim`. Stopt een staat met een `CheckError` of `BlocksError` op `map_2024`, pas dan geen controle aan; noteer de melding en vraag de eigenaar.

- [ ] **Step 6: Check the interim files**

Run:

```powershell
.venv\Scripts\python -c "import json, pandas as pd; d = 'data/interim/'; e = pd.read_parquet(d + 'enacted_districts.parquet'); print(len(e), e[e.map_id == 'map_2024'].groupby('method').size().to_dict()); log = json.load(open(d + 'join_log.json', encoding='utf-8')); print({k: v['map_2024_changed_blocks'] for k, v in log.items() if v['map_2024_changed_blocks']}); print(round(sum(v['maps']['map_2024']['block_count_votes'] for v in log.values()), 1))"
```

Expected:

```
2590 {'block': 429, 'whole_unit': 429}
{'AL': 23529, 'CA': 133426, 'FL': 99385, 'LA': 40716, 'NC': 18826, 'OH': 47697, 'TN': 63380, 'TX': 192131, 'UT': 47874}
3477.0
```

2.590 rijen: de 1.732 van taak 1.18 plus 2 methoden maal 429 districten. Op de kaarten van 2024 gaan 3.477,0 stemmen van eenheden zonder VAP naar aantal blokken, in dezelfde acht staten als op de kaarten van 2026 (FL, IL, KS, MA, MO, NV, NY, OK).

`03_metrics` werkt nog zonder aanpassing: het leest alleen de kaarten die het kent.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/02_join.py pipeline/gerry/config.py tests/test_join.py tests/test_config.py
git commit -m "Join the votes to the 2024 maps and count blocks that moved since"
```

### Task 5.4: concurrerende districten, zetels bij een verschuiving, drempel voor Enacted

**Files:**
- Modify: `pipeline/gerry/metrics.py` (onderaan toevoegen)
- Modify: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces: `COMPETITIVE_LOW = 0.45`, `COMPETITIVE_HIGH = 0.55`; `competitive(shares)`: het aantal aandelen van 0,45 tot en met 0,55 langs de laatste as (één getal voor een kaart, één per plan voor een matrix met plannen als rijen); `seats_at_swing(shares, swing)`: het aantal aandelen waarvoor aandeel plus `swing` boven 0,5 ligt, langs de laatste as; `enacted_threshold(shares, needed) -> float`: de verschuiving 0,5 - h met h het `needed`-de hoogste aandeel (uitbreidingsontwerp, hoofdstuk 1), `ValueError` als `needed` niet tussen 1 en het aantal districten ligt.

Een district dat bij een verschuiving precies op 0,5 uitkomt, telt niet als Democratisch ("boven 50%"). De drempel voor Enacted is daarom de grens: bij die verschuiving zelf heeft district `needed` precies de helft, bij elke grotere verschuiving telt het mee.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 5.4: competitive districts, seats under a uniform swing, the enacted threshold

def test_competitive_counts_45_to_55_percent_bounds_included():
    # 0.45 and 0.55 are the bounds and count; 0.449 and 0.551 lie outside; 0.5 counts -> 3
    assert m.competitive([0.45, 0.55, 0.449, 0.551, 0.5]) == 3


def test_competitive_counts_per_plan():
    # plans as rows: (0.45, 0.6) -> 1; (0.5, 0.52) -> 2; (0.3, 0.7) -> 0
    assert m.competitive(np.array([[0.45, 0.6], [0.5, 0.52], [0.3, 0.7]])).tolist() == [1, 2, 0]


def test_seats_at_swing_adds_the_swing_to_every_district():
    shares = [0.6, 0.48, 0.45, 0.3]
    # swing 0: only 0.6 lies above one half
    assert m.seats_at_swing(shares, 0.0) == 1
    # +0.03: 0.63, 0.51, 0.48, 0.33 -> 2
    assert m.seats_at_swing(shares, 0.03) == 2
    # -0.11: 0.49, 0.37, 0.34, 0.19 -> 0
    assert m.seats_at_swing(shares, -0.11) == 0


def test_seats_at_swing_on_one_half_is_not_democratic():
    # 0.375 + 0.125 = 0.5 exactly (binary fractions, no rounding): not above one half
    assert m.seats_at_swing([0.375, 0.625], 0.125) == 1


def test_seats_at_swing_per_plan():
    # (0.6, 0.4) - 0.015 = (0.585, 0.385) -> 1; (0.52, 0.51) - 0.015 = (0.505, 0.495) -> 1
    assert m.seats_at_swing(np.array([[0.6, 0.4], [0.52, 0.51]]), -0.015).tolist() == [1, 1]


def test_enacted_threshold_is_one_half_minus_the_needed_share():
    shares = [0.48, 0.7, 0.4, 0.52, 0.55]
    # high to low: 0.7, 0.55, 0.52, 0.48, 0.4
    # needed 3: h = 0.52, swing 0.5 - 0.52 = -0.02
    assert m.enacted_threshold(shares, 3) == pytest.approx(-0.02)
    # needed 4: h = 0.48, swing 0.5 - 0.48 = +0.02
    assert m.enacted_threshold(shares, 4) == pytest.approx(0.02)


def test_enacted_threshold_is_the_edge_of_the_majority():
    shares = [0.75, 0.625, 0.375]
    # needed 2: h = 0.625, swing 0.5 - 0.625 = -0.125 (binary fractions, exact)
    swing = m.enacted_threshold(shares, 2)
    assert swing == -0.125
    # at the threshold the second district sits on one half and does not count yet; just above it does
    assert m.seats_at_swing(shares, swing) == 1
    assert m.seats_at_swing(shares, swing + 0.001) == 2


def test_enacted_threshold_needs_a_count_within_the_districts():
    with pytest.raises(ValueError, match="needed"):
        m.enacted_threshold([0.6, 0.4], 3)
    with pytest.raises(ValueError, match="needed"):
        m.enacted_threshold([0.6, 0.4], 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `8 failed, 42 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'competitive'` (en `seats_at_swing`, `enacted_threshold`).

- [ ] **Step 3: Write minimal implementation**

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python


# --- Extensions (docs/superpowers/specs/2026-10-06-extensions-design.md) ---------------------------

COMPETITIVE_LOW = 0.45       # chapter 3: a Democratic share from 45% to 55%, bounds included
COMPETITIVE_HIGH = 0.55


def competitive(shares) -> np.ndarray:
    """Districts with a Democratic share from 45% to 55%, bounds included, counted along the last axis:
    one number for a map, one per plan for a matrix with plans as rows."""
    values = np.asarray(shares, dtype=float)
    return ((values >= COMPETITIVE_LOW) & (values <= COMPETITIVE_HIGH)).sum(axis=-1)


def seats_at_swing(shares, swing: float) -> np.ndarray:
    """Democratic seats when `swing` is added to every district share: districts above one half, counted
    along the last axis. A district that lands exactly on one half does not count."""
    return (np.asarray(shares, dtype=float) + swing > 0.5).sum(axis=-1)


def enacted_threshold(shares, needed: int) -> float:
    """The swing 0.5 - h, with h the needed-th highest district share (chapter 1). Any larger swing gives at
    least `needed` Democratic districts; at the threshold itself district `needed` sits on one half."""
    ordered = np.sort(np.asarray(shares, dtype=float))[::-1]
    if not 1 <= needed <= ordered.size:
        raise ValueError(f"needed must lie in 1..{ordered.size}, got {needed}")
    return float(0.5 - ordered[needed - 1])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `50 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add competitive counts, seats under a uniform swing and the enacted threshold"
```

### Task 5.5: raster, drempel voor de neutrale kaarten en voor Proportional

**Files:**
- Modify: `pipeline/gerry/metrics.py` (import bovenaan, functies onderaan)
- Modify: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `seats_at_swing` (taak 5.4), `convolve` en `CUM_TOLERANCE` (hoofdplan, taak 2.4 en 2.10), `largest_remainder` (taak 2.2).
- Produces: `SWING_GRID = 10_000`, `MAX_SWING_STEPS = 500`; `class SwingRangeError(ValueError)`; `smallest_swing(holds, max_steps=MAX_SWING_STEPS) -> float`: de kleinste verschuiving k / 10.000 met -500 < k <= 500 waarvoor `holds` waar is, gevonden met bisectie, met `SwingRangeError` als `holds` bij -0,05 al waar is of bij +0,05 nog onwaar; `majority_probability(plan_shares, swing, needed) -> float`: het aandeel neutrale uitkomsten met minstens `needed` districten (per staat de verdeling over de plannen, staten geconvolueerd als onafhankelijk); `neutral_threshold(plan_shares, needed, q) -> float`: de kleinste rasterverschuiving waarbij dat aandeel minstens q is (met `CUM_TOLERANCE`); `proportional_at_swing(state_shares, seats, swing) -> int`: largest remainder per staat op aandeel plus `swing`, opgeteld; `proportional_threshold(state_shares, seats, needed) -> float`.

De verschuiving is `k / SWING_GRID`, niet `k * 0.0001`: een deling rondt één keer af en geeft voor elke k het getal dat het dichtst bij k / 10.000 ligt.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python
# Task 5.5: the grid of swings, the neutral and the proportional threshold

def test_smallest_swing_finds_the_first_grid_point():
    # grid steps of 0.0001: s >= 0.0123 first holds at step 123
    assert m.smallest_swing(lambda s: s >= 0.0123) == pytest.approx(0.0123)
    # s > -0.00015 first holds at step -1
    assert m.smallest_swing(lambda s: s > -0.00015) == pytest.approx(-0.0001)


def test_smallest_swing_accepts_the_upper_edge_only():
    # +0.05 (step 500) is the last grid point and counts
    assert m.smallest_swing(lambda s: s >= 0.05) == pytest.approx(0.05)
    # at -0.05 (step -500) the condition must still be false; s > -0.05 first holds at step -499
    assert m.smallest_swing(lambda s: s > -0.05) == pytest.approx(-0.0499)


def test_smallest_swing_stops_outside_five_points():
    with pytest.raises(m.SwingRangeError, match="already true"):
        m.smallest_swing(lambda s: True)
    with pytest.raises(m.SwingRangeError, match="still false"):
        m.smallest_swing(lambda s: False)


# Two made-up states with 2 districts each. Every share ends in 5 in the fifth decimal, so no district
# lands exactly on one half at a grid point. A district turns Democratic once the swing passes 0.5 - share:
#   AA plan 1: -0.10005, +0.09995   AA plan 2: -0.05005, -0.02005
#   AA plan 3: +0.04495, +0.19995   AA plan 4: -0.01005, +0.00995
#   BB plan 1: -0.20005, +0.02995   BB plan 2: +0.01005, +0.03995
AA_PLANS = np.array([[0.60005, 0.40005], [0.55005, 0.52005], [0.45505, 0.30005], [0.51005, 0.49005]])
BB_PLANS = np.array([[0.70005, 0.47005], [0.48995, 0.46005]])


def test_majority_probability_convolves_the_states():
    # swing 0: AA plans give 1, 2, 0, 1 seats -> P(AA) = [0.25, 0.5, 0.25]; BB 1, 0 -> P(BB) = [0.5, 0.5, 0]
    # P(sum) = [0.125, 0.375, 0.375, 0.125, 0] -> 3 or more: 0.125
    assert m.majority_probability([AA_PLANS, BB_PLANS], 0.0, 3) == pytest.approx(0.125)
    # +0.02: AA 1, 2, 0, 2 -> [0.25, 0.25, 0.5]; BB 1, 1 -> [0, 1, 0]
    # sum = AA + 1, so 3 or more means AA = 2: 0.5
    assert m.majority_probability([AA_PLANS, BB_PLANS], 0.02, 3) == pytest.approx(0.5)
    # +0.035: AA as at +0.02; BB 2, 1 -> [0, 0.5, 0.5]
    # 3 or more: P(AA = 2) + P(AA = 1) * P(BB = 2) = 0.5 + 0.25 * 0.5 = 0.625
    assert m.majority_probability([AA_PLANS, BB_PLANS], 0.035, 3) == pytest.approx(0.625)


def test_neutral_threshold_at_5_50_and_95_percent():
    # P(3 or more districts) by swing, from the turning points above:
    #   up to -0.02005: 0          -0.02005 to +0.00995: 0.125     +0.00995 to +0.01005: 0.25
    #   +0.01005 to +0.02995: 0.5  +0.02995 to +0.03995: 0.625     +0.03995 to +0.04495: 0.75
    #   above +0.04495: 1
    # first grid point above -0.02005 is step -200, above +0.01005 step 101, above +0.04495 step 450
    plans = [AA_PLANS, BB_PLANS]
    assert m.neutral_threshold(plans, 3, 0.05) == pytest.approx(-0.02)
    assert m.neutral_threshold(plans, 3, 0.5) == pytest.approx(0.0101)
    assert m.neutral_threshold(plans, 3, 0.95) == pytest.approx(0.045)


def test_proportional_at_swing_sums_largest_remainder_over_states():
    # 4 seats at 0.55005: quota 2.2002, remainders 0.2002 (D) and 0.7998 (R) -> 2
    # 3 seats at 0.38005: quota 1.14015, remainders 0.14015 and 0.85985 -> 1; together 3
    assert m.proportional_at_swing([0.55005, 0.38005], [4, 3], 0.0) == 3
    # +0.08: 4 * 0.63005 = 2.5202, remainders 0.5202 and 0.4798 -> 3
    #        3 * 0.46005 = 1.38015, remainders 0.38015 and 0.61985 -> 1; together 4
    assert m.proportional_at_swing([0.55005, 0.38005], [4, 3], 0.08) == 4


def test_proportional_at_swing_rejects_a_share_outside_0_to_1():
    # 0.97 + 0.04 = 1.01
    with pytest.raises(ValueError, match="outside"):
        m.proportional_at_swing([0.97], [2], 0.04)


def test_proportional_threshold():
    # 2 seats each, at 0.72005 and 0.40005: 1 + 1 seats at swing 0
    # the first state gets its second seat once 2 * (0.72005 + s) > 1.5, so s > 0.02995 (step 300);
    # the second state keeps 1 seat from -0.05 to +0.05 (2 * 0.35005 = 0.7001 up to 2 * 0.45005 = 0.9001)
    assert m.proportional_threshold([0.72005, 0.40005], [2, 2], 3) == pytest.approx(0.03)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `8 failed, 50 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'smallest_swing'` (en `SwingRangeError`, `majority_probability`, `neutral_threshold`, `proportional_at_swing`, `proportional_threshold`).

- [ ] **Step 3: Write minimal implementation**

Vervang in `pipeline/gerry/metrics.py` de regel `from typing import Sequence` door:

```python
from typing import Callable, Sequence
```

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python


SWING_GRID = 10_000          # grid steps per unit of share: one step is 0.0001, or 0.01 percentage point
MAX_SWING_STEPS = 500        # 5 percentage points (chapters 1 and 5)


class SwingRangeError(ValueError):
    """A threshold lies 5 percentage points or more from the base share."""


def smallest_swing(holds: Callable[[float], bool], max_steps: int = MAX_SWING_STEPS) -> float:
    """Smallest swing k / SWING_GRID with -max_steps < k <= max_steps at which holds(swing) is true. holds must
    stay true once it is true (bisection). SwingRangeError when it is already true at -max_steps or still
    false at +max_steps."""
    lo, hi = -max_steps, max_steps
    if holds(lo / SWING_GRID):
        raise SwingRangeError(f"already true at a swing of {lo / SWING_GRID:+.4f}")
    if not holds(hi / SWING_GRID):
        raise SwingRangeError(f"still false at a swing of {hi / SWING_GRID:+.4f}")
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if holds(mid / SWING_GRID):
            hi = mid
        else:
            lo = mid
    return hi / SWING_GRID


def majority_probability(plan_shares: Sequence[np.ndarray], swing: float, needed: int) -> float:
    """Share of neutral outcomes with at least `needed` Democratic districts when `swing` is added to every
    district share. One matrix per state with plans as rows; states convolved as independent (spec chapter 5)."""
    pmfs = [np.bincount(seats_at_swing(shares, swing), minlength=shares.shape[1] + 1) for shares in plan_shares]
    return float(convolve(pmfs)[needed:].sum())


def neutral_threshold(plan_shares: Sequence[np.ndarray], needed: int, q: float) -> float:
    """Smallest grid swing at which a share q of the neutral outcomes has at least `needed` districts."""
    return smallest_swing(lambda swing: majority_probability(plan_shares, swing, needed) >= q - CUM_TOLERANCE)


def proportional_at_swing(state_shares: Sequence[float], seats: Sequence[int], swing: float) -> int:
    """Democratic seats summed over states, each by largest remainder on its two-party share plus swing."""
    total = 0
    for share, n in zip(state_shares, seats, strict=True):
        d = share + swing
        if not 0 <= d <= 1:
            raise ValueError(f"share {share} plus swing {swing} lies outside 0..1")
        total += largest_remainder(d, 1 - d, n)
    return total


def proportional_threshold(state_shares: Sequence[float], seats: Sequence[int], needed: int) -> float:
    """Smallest grid swing at which largest remainder per state gives at least `needed` seats in total."""
    return smallest_swing(lambda swing: proportional_at_swing(state_shares, seats, swing) >= needed)
```

Bisectie mag, omdat elke voorwaarde monotoon is in de verschuiving: per plan geeft een grotere verschuiving nooit minder zetels, de convolutie behoudt die volgorde, en largest remainder met twee partijen rondt het quotum af naar de dichtstbijzijnde hele zetel.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `58 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add the grid search for the neutral and proportional majority thresholds"
```

### Task 5.6: 03_metrics, concurrerende districten en hertekeningen per staat

**Files:**
- Modify: `pipeline/03_metrics.py`
- Modify: `tests/test_metrics_step.py`, `tests/test_metrics_data.py`

**Interfaces:**
- Consumes: `competitive` (taak 5.4); `distribution`, `sample_percentile` (hoofdplan, taak 2.3, 2.4); `map_rows`, `map_result`, `plan_matrices` in `03_metrics.py` (taak 2.11); de rijen `map_2024` in `enacted_districts.parquet` en `map_2024_changed_blocks` in `join_log.json` (taak 5.3).
- Produces: in `03_metrics.py` `plan_shares(ensemble, st) -> np.ndarray` (Democratisch aandeel, plannen als rijen, districten 01 eerst), `state_competitive(st, enacted, ensemble) -> dict` met `enacted`, `median`, `p5`, `p95` (inverse verdelingsfunctie, zoals de zetels) en `neutral_dist` (aantal plannen per aantal concurrerende districten, 0 tot `seats`), en `state_redraw(st, enacted, enacted_seats, changed_blocks) -> dict` met `seats_2024`, `change` (Enacted min 2024) en `map_changed`. `compute` zet beide per staat in `metrics.json`. Nieuwe controles: `CheckError("redraw", ...)` als geen blok verplaatste maar de zetels toch verschillen; `CheckError("interim_files", ...)` als `join_log.json` geen `map_2024_changed_blocks` heeft.

- [ ] **Step 1: Write the failing tests**

Voeg in `tests/test_metrics_step.py` aan het woordenboek `maps` in `_enacted()` toe, na de regel van `check_2022`:

```python
        # the map of the 2024 election: 01 D, 02 D, 03 R -> 2 seats; whole units give the same winners
        ("map_2024", "block"): [("01", 560, 440), ("02", 520, 480), ("03", 300, 700)],
        ("map_2024", "whole_unit"): [("01", 555, 445), ("02", 515, 485), ("03", 305, 695)],
```

De bestaande tests merken daar niets van: ze kiezen hun rijen op `map_id`, en de nieuwe rijen hebben geen gelijke stand.

Vervang `test_compute_assembles_states_national_and_checks` door:

```python
def _interim(tmp_path, join_log='{"XX": {"map_2024_changed_blocks": 12}}'):
    """The interim files of 02_join.py for the made-up state XX."""
    (tmp_path / "units").mkdir()
    pd.DataFrame({"d": [1300.0], "r": [1700.0]}).to_parquet(tmp_path / "units" / "XX.parquet")
    _enacted().to_parquet(tmp_path / "enacted_districts.parquet")
    _ensemble().to_parquet(tmp_path / "ensemble_districts.parquet")
    _reference().to_parquet(tmp_path / "alarm_reference.parquet")
    (tmp_path / "join_log.json").write_text(join_log, encoding="utf-8")
    return SimpleNamespace(states={"XX": XX}, at_large={"WY": AtLargeState("WY", "Wyoming", "56")})


def test_compute_assembles_states_national_and_checks(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    out = step.compute(cfg, tmp_path)
    assert set(out) == {"national", "states", "checks"}
    assert out["states"]["XX"]["proportional"] == 1             # units 1300 D / 1700 R, as in the hand example
    assert out["checks"]["plans"] == {"XX": 4}
    assert out["checks"]["totals"] == {"district_seats": 3, "at_large": 1}
    assert out["checks"]["join_log"] == {"XX": {"map_2024_changed_blocks": 12}}
    # Task 5.6: the hand examples of state_competitive and state_redraw below
    assert out["states"]["XX"]["competitive"] == {"enacted": 0, "median": 0, "p5": 0, "p95": 2,
                                                  "neutral_dist": [2, 0, 2, 0]}
    assert out["states"]["XX"]["redraw"] == {"seats_2024": 2, "change": -1, "map_changed": True}


def test_compute_needs_the_changed_blocks_of_02_join(tmp_path, monkeypatch):
    # a join_log.json from before the extensions has no map_2024_changed_blocks
    cfg = _interim(tmp_path, join_log='{"XX": {"units": 3}}')
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    with pytest.raises(CheckError, match="map_2024_changed_blocks"):
        step.compute(cfg, tmp_path)
```

Voeg onderaan `tests/test_metrics_step.py` toe:

```python


# --- Task 5.6: competitive districts and redraws per state -------------------------------------


def test_state_competitive_counts_the_enacted_map_and_the_plans():
    res = step.state_competitive(XX, _enacted(), _ensemble())
    # enacted shares 0.6, 0.3, 0.4: none from 0.45 to 0.55
    # plans: (.65 .35 .30) -> 0; (.55 .50 .25) -> 2; (.45 .45 .40) -> 2; (.60 .40 .30) -> 0
    # plans per count 0..3: [2, 0, 2, 0]; sorted 0 0 2 2: p5 0, median 0 (2 of 4 plans reach 0), p95 2
    assert res == {"enacted": 0, "median": 0, "p5": 0, "p95": 2, "neutral_dist": [2, 0, 2, 0]}


def test_state_competitive_counts_the_bounds_on_the_enacted_map():
    # shares 0.45, 0.55 and 0.6: both bounds count -> 2
    enacted = _with_main_map(_enacted(), [(450, 550), (550, 450), (600, 400)])
    assert step.state_competitive(XX, enacted, _ensemble())["enacted"] == 2


def test_state_redraw_compares_with_the_2024_map():
    # 2024 map: 560-440 D, 520-480 D, 300-700 R -> 2 seats; enacted 1 -> change 1 - 2 = -1
    assert step.state_redraw(XX, _enacted(), 1, 12) == {"seats_2024": 2, "change": -1, "map_changed": True}


def test_state_redraw_of_an_unchanged_map():
    # the 2024 rows are a copy of the enacted rows: 1 seat on both, no block changed district
    enacted = _enacted()
    copy = enacted[enacted.map_id == "enacted"].assign(map_id="map_2024")
    enacted = pd.concat([enacted[enacted.map_id != "map_2024"], copy], ignore_index=True)
    assert step.state_redraw(XX, enacted, 1, 0) == {"seats_2024": 1, "change": 0, "map_changed": False}


def test_state_redraw_stops_when_an_unchanged_map_gives_other_seats():
    # no block changed district, yet the 2024 rows give 2 seats against 1: they belong to another map
    with pytest.raises(CheckError, match="redraw"):
        step.state_redraw(XX, _enacted(), 1, 0)


def test_state_redraw_needs_the_2024_rows():
    enacted = _enacted()
    with pytest.raises(CheckError, match="district_count"):
        step.state_redraw(XX, enacted[enacted.map_id != "map_2024"], 1, 12)
```

De aandelen 0,55 en 0,45 in plan 2 en 3 zijn 550 / 1.000 en 450 / 1.000. Een deling rondt af op het getal dat het dichtst bij de uitkomst ligt, net als de letterlijke 0,55 en 0,45 in `metrics.py`; de grenzen tellen dus mee.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `8 failed, 25 passed`: de zes nieuwe tests onderaan (`AttributeError: module 'metrics_step' has no attribute 'state_competitive'` of `'state_redraw'`), `test_compute_assembles_states_national_and_checks` (`KeyError: 'competitive'`) en `test_compute_needs_the_changed_blocks_of_02_join` (`DID NOT RAISE`).

- [ ] **Step 3: Write minimal implementation**

Voeg in `pipeline/03_metrics.py` `competitive` toe aan de import uit `gerry.metrics`:

```python
from gerry.metrics import (TieError, competitive, convolve, dem_wins, distribution, effects, efficiency_gap,
                           is_narrow, largest_remainder, linear_band, mean_median, outside_band,
                           pmf_percentile, pmf_position, position, sample_percentile, seats_by_plan,
                           sorted_band)
```

Voeg direct na `state_metrics` toe:

```python
def plan_shares(ensemble: pd.DataFrame, st: StateConfig) -> np.ndarray:
    """Democratic share per plan (rows) and district (columns, 01 first)."""
    mats = plan_matrices(ensemble, st)
    return mats["d"] / (mats["d"] + mats["r"])


def state_competitive(st: StateConfig, enacted: pd.DataFrame, ensemble: pd.DataFrame) -> dict:
    """Competitive districts (45% to 55%) on the enacted map and over the plans (extensions design, ch. 3)."""
    main = map_result(map_rows(enacted, "enacted"), st, "enacted")
    counts = competitive(plan_shares(ensemble, st))
    return {
        "enacted": int(competitive(main["shares"])),
        "median": sample_percentile(counts, 50),
        "p5": sample_percentile(counts, 5),
        "p95": sample_percentile(counts, 95),
        "neutral_dist": [int(n) for n in distribution(counts, st.seats)],
    }


def state_redraw(st: StateConfig, enacted: pd.DataFrame, enacted_seats: int, changed_blocks: int) -> dict:
    """Democratic seats on the map of the 2024 election with the same votes, and the change to the enacted
    map (extensions design, ch. 2). changed_blocks comes from join_log.json (02_join.py)."""
    seats_2024 = map_result(map_rows(enacted, "map_2024"), st, "map_2024")["enacted"]
    if changed_blocks == 0 and seats_2024 != enacted_seats:
        raise CheckError("redraw", st.postal, f"no block changed district since 2024, yet the 2024 map gives "
                                              f"{seats_2024} seats and the enacted map {enacted_seats}")
    return {"seats_2024": seats_2024, "change": enacted_seats - seats_2024, "map_changed": changed_blocks > 0}
```

`map_result` controleert het aantal districten en past de gelijkspelregel toe, zoals voor de andere kaarten.

Voeg in `compute`, direct na de regel `states[postal] = state_metrics(...)`, toe:

```python
        changed = join_log.get(postal, {}).get("map_2024_changed_blocks")
        if changed is None:
            raise CheckError("interim_files", postal, "join_log.json has no map_2024_changed_blocks; "
                                                      "run pipeline/02_join.py again")
        states[postal]["competitive"] = state_competitive(st, enacted, ensemble)
        states[postal]["redraw"] = state_redraw(st, enacted, states[postal]["enacted"], changed)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `33 passed`.

- [ ] **Step 5: Run 03_metrics on the real data**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: dezelfde 44 regels en dezelfde regel `US: proportional 224, neutral 223 (217-229), enacted 213` als na fase 2, dan `Wrote ...\data\interim\metrics.json` en `Wrote ...\docs\validation.md: Open items: <n>. Pending: <m>.`, met dezelfde n en m als vóór deze taak. In `docs/validation.md` heeft de tabel per staat van het join-log nu een kolom `map_2024_changed_blocks` en de tabel per kaart rijen `map_2024`; dat komt uit `join_log.json` van taak 5.3.

- [ ] **Step 6: Write the data tests**

Voeg onderaan `tests/test_metrics_data.py` toe:

```python


# Extensions: numbers from the prototype run of 2026-10-06 (plan 2026-10-06-extensions.md, "Proefrun").
# state: competitive districts (45 to 55%) on the enacted map, and median, p5 and p95 over the plans
COMPETITIVE = {
    "AZ": (4, 4, 2, 5), "CA": (1, 9, 6, 12), "FL": (14, 7, 4, 9), "NC": (2, 4, 3, 6), "NV": (3, 2, 1, 2),
    "TX": (5, 9, 4, 12), "WV": (0, 0, 0, 0),
}
# state: Democratic seats on the 2024 map and the change to the enacted map (enacted minus 2024)
REDRAW = {
    "AL": (2, -1), "CA": (44, 4), "FL": (10, -1), "LA": (2, -1), "NC": (4, -1), "OH": (4, -1), "TN": (1, -1),
    "TX": (14, -3), "UT": (0, 1),
}


@pytest.mark.parametrize("postal", sorted(COMPETITIVE))
def test_competitive_districts(metrics, postal):
    c = metrics["states"][postal]["competitive"]
    assert (c["enacted"], c["median"], c["p5"], c["p95"]) == COMPETITIVE[postal]
    assert sum(c["neutral_dist"]) == 5000


def test_redraws_since_2024(metrics):
    states = metrics["states"]
    # the nine states with another map than in 2024; Missouri votes on its 2022 map, as in 2024
    assert {p for p, s in states.items() if s["redraw"]["map_changed"]} == set(REDRAW)
    for postal, s in states.items():
        assert (s["redraw"]["seats_2024"], s["redraw"]["change"]) == REDRAW.get(postal, (s["enacted"], 0)), postal
```

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_data.py -m data -q`
Expected: `21 passed`.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

`data/interim/` staat niet in git. Staat `docs/validation.md` in git en is het gewijzigd (`git status --short`), commit het dan mee.

```powershell
git add pipeline/03_metrics.py tests/test_metrics_step.py tests/test_metrics_data.py
git add docs/validation.md
git commit -m "Count competitive districts and the seats on the 2024 maps per state"
```

### Task 5.7: 03_metrics, meerderheid, concurrerende districten en hertekeningen landelijk

**Files:**
- Modify: `pipeline/03_metrics.py`
- Modify: `tests/test_metrics_step.py`, `tests/test_metrics_data.py`

**Interfaces:**
- Consumes: `enacted_threshold` (taak 5.4); `SWING_GRID`, `MAX_SWING_STEPS`, `SwingRangeError`, `neutral_threshold`, `proportional_threshold` (taak 5.5); `convolve`, `pmf_percentile` (hoofdplan); `plan_shares`, `state_competitive`, `state_redraw` (taak 5.6).
- Produces: in `03_metrics.py` `HOUSE_MAJORITY = 218`, `SINGLE_SEAT_PARTY` (besluit 1 van de eigenaar), `seats_needed(at_large) -> int` (216, of `CheckError("single_seat_party", "US", ...)`), `national_majority(*, base_share, needed, enacted_shares, plan_shares, state_shares, state_seats, seats_at_base, neutral_pmf) -> dict`, `national_competitive(states) -> dict`, `national_redraw(states) -> dict`. `compute` zet `majority`, `competitive` en `redraw` onder `national` in `metrics.json`. `national_majority` stopt met `CheckError("majority_threshold", "US", ...)` als een drempel 5 procentpunt of meer van *V0* ligt (uitbreidingsontwerp, hoofdstuk 1 en 5).

*V0* (`base_share`) is de som van `d` over de eenheden van de 44 staten, gedeeld door de som van `d + r`: hetzelfde aandeel als over de 429 districten, want elke kaart behoudt de stemmen. `seats_at_base` is `national.enacted` en `probability_at_base` de som van `national.neutral.dist` vanaf 216, beide met de bestaande gelijkspelregel (zie "Keuzes in dit plan", punt 6).

- [ ] **Step 1: Write the failing tests**

Voeg in `tests/test_metrics_step.py` bij de imports `import numpy as np` toe (tussen `from types import SimpleNamespace` en `import pandas as pd`).

Voeg direct na `_interim` toe:

```python
def _small_house(monkeypatch):
    """A House of the 3 districts of XX plus WY: majority 3, WY fixed as Republican. national_majority is
    replaced by a stand-in that records its arguments (its own tests are under Task 5.7)."""
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    monkeypatch.setattr(step, "HOUSE_MAJORITY", 3)
    monkeypatch.setattr(step, "SINGLE_SEAT_PARTY", {"WY": "R"})
    seen = {}

    def stand_in(**kwargs):
        seen.update(kwargs)
        return {"seats_needed": kwargs["needed"], "base_share": 0.0, "enacted": {"share": 0.0, "seats_at_base": 0},
                "neutral": {"share": 0.0, "low": 0.0, "high": 0.0, "probability_at_base": 0.0},
                "proportional": {"share": 0.0}}

    monkeypatch.setattr(step, "national_majority", stand_in)
    return seen
```

De gemaakte staat XX ligt ver van 50% (aandelen 0,6, 0,3 en 0,4); elke drempel zou meer dan 5 punten van *V0* liggen. Daarom vervangt `_small_house` `national_majority` in de tests van `compute`.

Vervang in `test_compute_assembles_states_national_and_checks` de regel `monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)` door `_small_house(monkeypatch)`.

Voeg onderaan `tests/test_metrics_step.py` toe:

```python


# --- Task 5.7: majority thresholds, competitive districts and redraws for the nation ------------


def test_seats_needed_counts_the_single_seat_states_fixed_as_democratic():
    at_large = {p: AtLargeState(p, p, "00") for p in ("AK", "DE", "ND", "SD", "VT", "WY")}
    # 218 of 435 for a majority; DE and VT are fixed as Democratic -> 216 of the 429 districts
    assert step.seats_needed(at_large) == 216


def test_seats_needed_stops_on_other_single_seat_states():
    with pytest.raises(CheckError, match="single_seat_party"):
        step.seats_needed({"WY": AtLargeState("WY", "Wyoming", "56")})


# The two made-up states of Task 5.5 in tests/test_metrics.py, with their turning points.
AA_PLANS = np.array([[0.60005, 0.40005], [0.55005, 0.52005], [0.45505, 0.30005], [0.51005, 0.49005]])
BB_PLANS = np.array([[0.70005, 0.47005], [0.48995, 0.46005]])
MAJORITY_ARGS = {"base_share": 0.5, "needed": 3, "enacted_shares": [0.6, 0.47005, 0.52, 0.4],
                 "plan_shares": [AA_PLANS, BB_PLANS], "state_shares": [0.72005, 0.40005], "state_seats": [2, 2],
                 "seats_at_base": 2, "neutral_pmf": [0.125, 0.375, 0.375, 0.125, 0.0]}


def test_national_majority_hand_example():
    res = step.national_majority(**MAJORITY_ARGS)
    assert (res["seats_needed"], res["base_share"]) == (3, 0.5)
    # enacted: high to low 0.6, 0.52, 0.47005, 0.4; the third is 0.47005 -> swing 0.02995, share 0.52995
    assert res["enacted"] == pytest.approx({"share": 0.52995, "seats_at_base": 2})
    # neutral (Task 5.5): 5% at -0.02, 50% at +0.0101, 95% at +0.045; at the base 3 or more: 0.125 + 0
    assert res["neutral"] == pytest.approx({"share": 0.5101, "low": 0.48, "high": 0.545, "probability_at_base": 0.125})
    # proportional (Task 5.5): +0.03
    assert res["proportional"] == pytest.approx({"share": 0.53})


def test_national_majority_stops_when_the_enacted_threshold_is_far_off():
    # needed 4: the fourth share is 0.4 -> swing +0.1, 10 points from the base share
    with pytest.raises(CheckError, match="majority_threshold.*enacted maps"):
        step.national_majority(**{**MAJORITY_ARGS, "needed": 4, "enacted_shares": [0.6, 0.47005, 0.52, 0.4]})


def test_national_majority_stops_when_a_grid_threshold_is_far_off():
    # plans with both districts at 0.3 and 0.2: no plan reaches 3 districts within +5 points
    low = np.array([[0.30005, 0.20005]])
    with pytest.raises(CheckError, match="majority_threshold.*neutral maps"):
        step.national_majority(**{**MAJORITY_ARGS, "plan_shares": [low, low]})
    # proportional: the second state at 0.15005 + 0.05 = 0.20005 keeps 0 seats (2 * 0.20005 = 0.4001), the first
    # reaches 2: 3 seats are out of reach within +5 points
    with pytest.raises(CheckError, match="majority_threshold.*proportional"):
        step.national_majority(**{**MAJORITY_ARGS, "state_shares": [0.72005, 0.15005]})


def test_national_competitive_convolves_the_states():
    # competitive counts per plan, as in test_national_metrics: A [1, 3], B [2, 2], C [0, 1, 1]
    # P = [0, 0.0625, 0.3125, 0.4375, 0.1875]; cumulative 0, .0625, .375, .8125, 1 -> median 3, p5 1, p95 4
    def state(dist, enacted):
        return {"competitive": {"enacted": enacted, "neutral_dist": dist}}

    res = step.national_competitive({"AA": state([1, 3], 1), "BB": state([2, 2], 0), "CC": state([0, 1, 1], 2)})
    assert (res["enacted"], res["median"], res["p5"], res["p95"]) == (3, 3, 1, 4)    # enacted 1 + 0 + 2
    assert res["neutral_dist"] == pytest.approx([0, 0.0625, 0.3125, 0.4375, 0.1875])


def test_national_redraw_sums_the_states():
    states = {"AA": {"enacted": 3, "redraw": {"seats_2024": 5}}, "BB": {"enacted": 2, "redraw": {"seats_2024": 1}}}
    # 2024 maps: 5 + 1 = 6; enacted 3 + 2 = 5; change 5 - 6 = -1
    assert step.national_redraw(states) == {"seats_2024": 6, "change": -1}


def test_compute_adds_majority_competitive_and_redraw(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    seen = _small_house(monkeypatch)
    out = step.compute(cfg, tmp_path)
    nat = out["national"]
    # 4 seats, majority 3, WY Republican -> 3 of the 3 districts
    assert seen["needed"] == 3 and nat["majority"]["seats_needed"] == 3
    # units: 1300 D and 1700 R
    assert seen["base_share"] == pytest.approx(1300 / 3000)
    assert seen["state_shares"] == pytest.approx([1300 / 3000]) and seen["state_seats"] == [3]
    # enacted shares 0.6, 0.3, 0.4; one Democratic district at the base
    assert sorted(seen["enacted_shares"]) == pytest.approx([0.3, 0.4, 0.6])
    assert seen["seats_at_base"] == 1
    assert [shares.shape for shares in seen["plan_shares"]] == [(4, 3)]
    # the neutral distribution of the seats: plans give 1, 2, 0, 1 -> [0.25, 0.5, 0.25, 0]
    assert seen["neutral_pmf"] == pytest.approx([0.25, 0.5, 0.25, 0.0])
    # one state: the national numbers are those of XX (Task 5.6), with probabilities
    assert nat["competitive"] == {"enacted": 0, "median": 0, "p5": 0, "p95": 2,
                                  "neutral_dist": pytest.approx([0.5, 0.0, 0.5, 0.0])}
    assert nat["redraw"] == {"seats_2024": 2, "change": -1}
```

Rekenvoorbeeld bij `test_national_majority_hand_example`: de drempels voor de neutrale kaarten en Proportional zijn die van taak 5.5 (zelfde plannen en aandelen), opgeteld bij *V0* = 0,5. De kans bij *V0* volgt uit de gegeven verdeling: P(3) + P(4) = 0,125 + 0.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `9 failed, 32 passed`: de acht nieuwe tests (`AttributeError: module 'metrics_step' has no attribute 'seats_needed'`, `'national_majority'`, `'national_competitive'`, `'national_redraw'` of `'HOUSE_MAJORITY'`) en `test_compute_assembles_states_national_and_checks` (`AttributeError: ... 'HOUSE_MAJORITY'`).

- [ ] **Step 3: Write minimal implementation**

Vervang in `pipeline/03_metrics.py` de import uit `gerry.metrics` en de constanten eronder door:

```python
from gerry.metrics import (MAX_SWING_STEPS, SWING_GRID, SwingRangeError, TieError, competitive, convolve,
                           dem_wins, distribution, effects, efficiency_gap, enacted_threshold, is_narrow,
                           largest_remainder, linear_band, mean_median, neutral_threshold, outside_band,
                           pmf_percentile, pmf_position, position, proportional_threshold, sample_percentile,
                           seats_by_plan, sorted_band)
from gerry.validation import build_report

HOUSE_SEATS = 435
HOUSE_MAJORITY = 218
# Owner decision 1 (extensions design, chapter 6): each single-seat state goes to the party that won it in
# both the 2016 and the 2020 presidential election.
SINGLE_SEAT_PARTY = {"AK": "R", "DE": "D", "ND": "R", "SD": "R", "VT": "D", "WY": "R"}
WIN_COLS = ["d", "r", "d_pre_20", "r_pre_20"]
```

Voeg direct na `national_metrics` toe:

```python
def seats_needed(at_large: Mapping[str, AtLargeState]) -> int:
    """Districts Democrats need for a House majority: 218 minus the single-seat states fixed as Democratic."""
    if set(at_large) != set(SINGLE_SEAT_PARTY):
        raise CheckError("single_seat_party", "US", f"config.yaml has single-seat states {sorted(at_large)}, "
                                                    f"03_metrics.py fixes {sorted(SINGLE_SEAT_PARTY)}")
    return HOUSE_MAJORITY - sum(1 for postal in at_large if SINGLE_SEAT_PARTY[postal] == "D")


def national_majority(*, base_share: float, needed: int, enacted_shares, plan_shares, state_shares,
                      state_seats, seats_at_base: int, neutral_pmf) -> dict:
    """The national two-party share Democrats need for `needed` districts under a uniform swing (extensions
    design, ch. 1): exact for the enacted maps; on the grid of 0.01 point for the neutral maps (half of the
    outcomes, and 5% and 95%) and for proportional seats. Stops when a threshold lies 5 points or more from
    base_share, so the fixed result of the single-seat states still holds."""
    enacted = enacted_threshold(enacted_shares, needed)
    if abs(enacted) > MAX_SWING_STEPS / SWING_GRID:
        raise CheckError("majority_threshold", "US", f"enacted maps: Democrats need {base_share + enacted:.4f}, "
                                                     f"more than 5 points from {base_share:.4f}")
    try:
        low, middle, high = [neutral_threshold(plan_shares, needed, q) for q in (0.05, 0.5, 0.95)]
    except SwingRangeError as err:
        raise CheckError("majority_threshold", "US", f"neutral maps: {err}, 5 points or more from "
                                                     f"{base_share:.4f}") from err
    try:
        proportional = proportional_threshold(state_shares, state_seats, needed)
    except SwingRangeError as err:
        raise CheckError("majority_threshold", "US", f"proportional seats: {err}, 5 points or more from "
                                                     f"{base_share:.4f}") from err
    return {
        "seats_needed": needed,
        "base_share": base_share,
        "enacted": {"share": base_share + enacted, "seats_at_base": seats_at_base},
        "neutral": {"share": base_share + middle, "low": base_share + low, "high": base_share + high,
                    "probability_at_base": float(np.sum(np.asarray(neutral_pmf, dtype=float)[needed:]))},
        "proportional": {"share": base_share + proportional},
    }


def national_competitive(states: Mapping[str, dict]) -> dict:
    """Competitive districts for the nation: the sum over the enacted maps, and the convolution of the
    states' plan distributions (states independent, as for the seats)."""
    pmf = convolve([np.asarray(s["competitive"]["neutral_dist"]) for s in states.values()])
    return {
        "enacted": sum(s["competitive"]["enacted"] for s in states.values()),
        "median": pmf_percentile(pmf, 50),
        "p5": pmf_percentile(pmf, 5),
        "p95": pmf_percentile(pmf, 95),
        "neutral_dist": [float(p) for p in pmf],
    }


def national_redraw(states: Mapping[str, dict]) -> dict:
    """Democratic seats on the maps of the 2024 election, and the net change to the enacted maps."""
    seats_2024 = sum(s["redraw"]["seats_2024"] for s in states.values())
    return {"seats_2024": seats_2024, "change": sum(s["enacted"] for s in states.values()) - seats_2024}
```

Pas `compute` aan. Voeg direct na de regel `checks = {...}` toe:

```python
    # inputs of the majority thresholds, one entry per state
    votes = {"d": 0.0, "r": 0.0, "enacted_shares": [], "plan_shares": [], "state_shares": [], "state_seats": []}
```

Vervang

```python
        states[postal] = state_metrics(st, float(units["d"].sum()), float(units["r"].sum()), enacted, ensemble)
```

door:

```python
        d_total, r_total = float(units["d"].sum()), float(units["r"].sum())
        states[postal] = state_metrics(st, d_total, r_total, enacted, ensemble)
        votes["d"] += d_total
        votes["r"] += r_total
        votes["enacted_shares"].append(_shares(map_rows(enacted, "enacted")))
        votes["plan_shares"].append(plan_shares(ensemble, st))
        votes["state_shares"].append(d_total / (d_total + r_total))
        votes["state_seats"].append(st.seats)
```

Voeg tot slot direct vóór `return {"national": national, "states": states, "checks": checks}` toe:

```python
    national["majority"] = national_majority(
        base_share=votes["d"] / (votes["d"] + votes["r"]), needed=seats_needed(cfg.at_large),
        enacted_shares=np.concatenate(votes["enacted_shares"]), plan_shares=votes["plan_shares"],
        state_shares=votes["state_shares"], state_seats=votes["state_seats"],
        seats_at_base=national["enacted"], neutral_pmf=national["neutral"]["dist"])
    national["competitive"] = national_competitive(states)
    national["redraw"] = national_redraw(states)
    maj, comp, red = national["majority"], national["competitive"], national["redraw"]
    print(f"US majority: {maj['seats_needed']} of {national['seats']} districts; Democrats have "
          f"{maj['base_share']:.4f} and need {maj['enacted']['share']:.4f} (enacted), {maj['neutral']['share']:.4f} "
          f"({maj['neutral']['low']:.4f}-{maj['neutral']['high']:.4f}, neutral), {maj['proportional']['share']:.4f} "
          f"(proportional); at {maj['base_share']:.4f}: {maj['enacted']['seats_at_base']} districts enacted, "
          f"{maj['neutral']['probability_at_base']:.4f} of neutral outcomes with a majority")
    print(f"US competitive (45 to 55%): enacted {comp['enacted']}, neutral {comp['median']} "
          f"({comp['p5']}-{comp['p95']})")
    print(f"US 2024 maps: {red['seats_2024']}, enacted {national['enacted']}, change {red['change']:+d}")
```

`_shares` en `map_rows` bestaan al in `03_metrics.py`. `national_majority` krijgt alleen trefwoordargumenten, zodat de test van `compute` ze op naam kan nalopen.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `41 passed`.

- [ ] **Step 5: Run 03_metrics on the real data**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: na de regel `US: proportional 224, neutral 223 (217-229), enacted 213` precies:

```
US majority: 216 of 429 districts; Democrats have 0.5180 and need 0.5230 (enacted), 0.5116 (0.5066-0.5160, neutral), 0.4979 (proportional); at 0.5180: 213 districts enacted, 0.9853 of neutral outcomes with a majority
US competitive (45 to 55%): enacted 81, neutral 96 (87-105)
US 2024 maps: 217, enacted 213, change -4
```

en dan de regels `Wrote ...`. Het script duurt ongeveer 10 seconden langer dan voorheen. Stopt het met `majority_threshold`, pas dan de grens niet aan: een drempel ver van *V0* betekent een fout in de stemmen of de kaarten. Volg systematic-debugging.

- [ ] **Step 6: Write the data tests**

Voeg onderaan `tests/test_metrics_data.py` toe:

```python


def test_redraws_for_the_nation(metrics):
    # 217 Democratic districts on the 2024 maps, 213 on the enacted maps
    assert metrics["national"]["redraw"] == {"seats_2024": 217, "change": -4}


def test_majority_thresholds(metrics):
    maj = metrics["national"]["majority"]
    assert maj["seats_needed"] == 216
    assert maj["base_share"] == pytest.approx(0.5179747, abs=5e-7)
    # enacted: the 216th highest district share is 0.4949420 -> 0.5179747 + 0.5 - 0.4949420
    assert maj["enacted"] == pytest.approx({"share": 0.5230328, "seats_at_base": 213}, abs=5e-7)
    # neutral: grid swings -0.0064 (50%), -0.0114 (5%) and -0.0020 (95%)
    assert maj["neutral"] == pytest.approx({"share": 0.5115747, "low": 0.5065747, "high": 0.5159747,
                                            "probability_at_base": 0.9853454}, abs=5e-7)
    # proportional: grid swing -0.0201, where IN and NY both gain a seat (214 -> 216)
    assert maj["proportional"] == pytest.approx({"share": 0.4978747}, abs=5e-7)


def test_competitive_districts_for_the_nation(metrics):
    c = metrics["national"]["competitive"]
    assert (c["enacted"], c["median"], c["p5"], c["p95"]) == (81, 96, 87, 105)
    assert c["enacted"] == sum(s["competitive"]["enacted"] for s in metrics["states"].values())
    assert len(c["neutral_dist"]) == 430 and sum(c["neutral_dist"]) == pytest.approx(1.0)
```

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_data.py -m data -q`
Expected: `24 passed`.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/03_metrics.py tests/test_metrics_step.py tests/test_metrics_data.py
git add docs/validation.md
git commit -m "Add the majority thresholds, competitive districts and redraws for the nation"
```

Sla de tweede `git add` over als `docs/validation.md` niet in git staat of niet veranderde.

### Task 5.8: docs/validation.md, de kaarten van 2024

**Files:**
- Modify: `pipeline/03_metrics.py` (`state_checks`, `compute`)
- Modify: `pipeline/gerry/validation.py`
- Modify: `tests/test_metrics_step.py`, `tests/test_validation.py`
- Modify (gegenereerd): `docs/validation.md`

**Interfaces:**
- Consumes: `state_checks` en `compute` (hoofdplan, taak 2.11 en 2.12); `build_report` en `_table` in `validation.py` (taak 2.12, gewijzigd in taak 2.13); `states[ST]["redraw"]` (taak 5.6).
- Produces: `checks.whole_unit` heeft ook regels met `map_id` `map_2024`, beoordeeld als de andere kaarten (open tot verklaard bij een andere winnaar); `checks.map_2024` {ST: {`districts`, `changed_blocks`, `seats_2024`, `seats_enacted`}}; in `docs/validation.md` een nieuw deel `## Maps of the 2024 election`, direct na het deel over hele eenheden, met een regel per staat. Dat deel heeft geen statuskolom: `02_join` en `03_metrics` stoppen al bij een kaart met een verkeerd aantal districten of stemmen.

Uitbreidingsontwerp, hoofdstuk 5: "een regel per staat dat `map_2024` geldige districten heeft (zelfde controles als de andere kaarten)". De controles van `02_join` gelden al sinds taak 5.3; deze taak zet de uitkomst in het rapport en voegt de vergelijking van hele eenheden met de blokverdeling toe.

Lees eerst de actuele `pipeline/gerry/validation.py` en `tests/test_validation.py`: taak 2.13 heeft ze gewijzigd. De stappen hieronder voegen alleen toe.

- [ ] **Step 1: Write the failing tests**

In `tests/test_metrics_step.py`, in `test_state_checks`, vervang `assert len(whole) == 6` door:

```python
    # three districts each on the enacted map, the blocked map and the 2024 map (Task 5.8)
    assert len(whole) == 9
    assert [w["map_id"] for w in whole[6:]] == ["map_2024"] * 3
```

De lijst `flipped` in die test blijft gelijk: op de kaart van 2024 geven hele eenheden dezelfde winnaars (555 tegen 445, 515 tegen 485, 305 tegen 695).

Voeg in `test_main_writes_metrics_and_report` en in `_main_setup` aan het woordenboek `checks` de sleutel `"map_2024": {}` toe, vóór `"join_log": {}`:

```python
               "checks": {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {},
                          "map_2024": {}, "join_log": {}}}
```

Voeg onderaan `test_compute_assembles_states_national_and_checks` toe:

```python
    # Task 5.8: the row of the 2024 map in docs/validation.md
    assert out["checks"]["map_2024"] == {"XX": {"districts": 3, "changed_blocks": 12, "seats_2024": 2,
                                                "seats_enacted": 1}}
```

In `tests/test_validation.py`: voeg aan `METRICS["checks"]` toe, na `"pre_20"`:

```python
        # the maps of the 2024 election (extensions, Task 5.8): AA redrew since 2024, BB did not
        "map_2024": {"AA": {"districts": 3, "changed_blocks": 120, "seats_2024": 1, "seats_enacted": 2},
                     "BB": {"districts": 2, "changed_blocks": 0, "seats_2024": 1, "seats_enacted": 1}},
```

Voeg in `test_report_sections_come_in_the_order_of_the_brief` de kop `"Maps of the 2024 election"` in de lijst in, direct na `"Whole-unit assignment against block allocation"`. Voeg onderaan het bestand toe:

```python


def test_report_has_a_row_per_state_for_the_maps_of_2024(crosscheck, notes):
    report = v.build_report(METRICS, crosscheck, notes)
    section = report.split("## Maps of the 2024 election")[1].split("\n## ")[0]
    assert "| State | Districts | Blocks in another district now | D seats, 2024 map | D seats, enacted map |" in section
    # AA: 120 blocks moved and the seats went from 1 to 2; BB has the same map as in 2024
    assert "| AA | 3 | 120 | 1 | 2 |" in section
    assert "| BB | 2 | 0 | 1 | 1 |" in section
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py tests/test_validation.py -q`
Expected: 4 failed: `test_state_checks` (`assert 6 == 9`), `test_compute_assembles_states_national_and_checks` (`KeyError: 'map_2024'`), `test_report_sections_come_in_the_order_of_the_brief` en `test_report_has_a_row_per_state_for_the_maps_of_2024` (`IndexError`, de kop ontbreekt). De andere tests slagen.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/03_metrics.py`, in `state_checks`, vervang

```python
    for map_id in ["enacted"] + [m.id for m in st.extra_maps]:
```

door:

```python
    for map_id in ["enacted", *(m.id for m in st.extra_maps), "map_2024"]:
```

In `compute`, vervang de regel `checks = {...}` door:

```python
    checks = {"plans": {}, "ties": {}, "cd118_vs_alarm": {}, "whole_unit": {}, "pre_20": {}, "map_2024": {},
              "join_log": join_log}
```

en voeg direct na de lus `for key, value in state_checks(...).items(): checks[key][postal] = value` toe:

```python
        # docs/validation.md: one row per state for the map of the 2024 election
        checks["map_2024"][postal] = {"districts": len(map_rows(enacted, "map_2024")), "changed_blocks": changed,
                                      "seats_2024": states[postal]["redraw"]["seats_2024"],
                                      "seats_enacted": states[postal]["enacted"]}
```

In `pipeline/gerry/validation.py`, in `_whole_unit`, vervang de zin onder de kop door:

```python
        "Each unit assigned whole to the district with most of its voting-age population, against the "
        "block allocation used for the numbers on the site: the enacted map, a blocked map and the map of the "
        "2024 election. A district with another winner is open until explained.",
```

Voeg direct na `_whole_unit` toe:

```python
def _maps_2024(metrics: dict) -> str:
    rows = [(state, m["districts"], m["changed_blocks"], m["seats_2024"], m["seats_enacted"])
            for state, m in sorted(metrics["checks"]["map_2024"].items())]
    return "\n\n".join([
        "## Maps of the 2024 election",
        "The maps used in November 2024 (Census CD119), with the same votes and the same checks as the other "
        "maps: 02_join.py stops unless every unit with votes lies in a district, the votes add up to the state "
        "totals and the map has the state's number of districts, and the whole-unit check above covers these "
        "maps too. The third column counts the blocks that lie in another district on the enacted map.",
        _table(["State", "Districts", "Blocks in another district now", "D seats, 2024 map", "D seats, enacted map"],
               rows),
    ])
```

Zet in `build_report`, in de lijst `sections`, `_maps_2024(metrics),` direct na `_whole_unit(metrics, ledger),`.

Haal de zinnen door de unslop-skill voordat je commit; het rapport is zichtbare tekst in git.

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py tests/test_validation.py -q`
Expected: alles slaagt; `tests/test_metrics_step.py` heeft 41 tests, `tests/test_validation.py` één meer dan vóór deze taak.

- [ ] **Step 5: Regenerate docs/validation.md**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: dezelfde uitvoer als in taak 5.7, met dezelfde `Open items` en `Pending` als ervoor: geen district van 2024 krijgt bij hele eenheden een andere winnaar. In `docs/validation.md`:

- in het deel over hele eenheden 44 regels `map_2024`, alle met `none` en `ok`; de grootste verschillen zijn `| TN | map_2024 | 0.724 | none | ok |` en `| CA | map_2024 | 0.607 | none | ok |`;
- het nieuwe deel met 44 regels, onder meer `| AL | 7 | 23529 | 2 | 1 |`, `| MO | 8 | 0 | 2 | 2 |`, `| TX | 38 | 192131 | 14 | 11 |` en `| UT | 4 | 47874 | 0 | 1 |`.

Is er toch een district met een andere winnaar, dan blijft het open tot de eigenaar een verklaring in `data/validation_notes.yaml` heeft goedgekeurd (sleutel `whole_unit` van die staat).

- [ ] **Step 6: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/03_metrics.py pipeline/gerry/validation.py tests/test_metrics_step.py tests/test_validation.py docs/validation.md
git commit -m "Report the 2024 maps in the validation report"
```

### Task 5.9: onderzoek, wie nam elke kaart aan en onder welke controle

Deze taak heeft geen code. Hij levert per staat `adopted_by` en `control` met officiële bronnen, de teksten voor `adopted_note`, en de beslissing van de eigenaar over elk twijfelgeval dat de beslisregels niet beslechten. De eigenaar besliste de beslisregels op 7 oktober 2026 ("Besluiten van de eigenaar", punt 1 tot en met 5). De taak kan meteen beginnen en loopt parallel aan 5.1 tot en met 5.8.

**Files:**
- Modify: `data/sources.md` (nieuwe kolom "Adoption and control" in de tabel "Multi-seat states", een alinea met de beslisregels, nieuwe open punten)

**Interfaces:**
- Consumes: de definities in hoofdstuk 4 van het uitbreidingsontwerp; de besluiten van de eigenaar van 7 oktober 2026, punt 1 tot en met 5; de kolommen "Adopted" en "By" van `data/sources.md` als startpunt.
- Produces: in de tabel "Multi-seat states", direct na de kolom "By", de kolom `Adoption and control`. Elke cel begint met `<adopted_by>, <control>.` (bijvoorbeeld `Legislature, Republican.`), gevolgd door de stemming of de uitspraak, de samenstelling op de datum van aanneming en de bronnen als Markdown-links. Taak 5.10 neemt de twee waarden over in `config.yaml`; taak 5.11 controleert dat ze gelijk blijven. Daarnaast goedgekeurde Engelse teksten voor `adopted_note`.

Regels voor de cel, zodat `parse_sources_md` en de controle van taak 5.11 hem kunnen lezen:

- Geen `|` in de cel en geen em-dashes. Engels, zoals de rest van `data/sources.md`.
- Het begin is precies een waarde uit `Legislature`, `Commission`, `Court`, dan `, `, dan een waarde uit `Republican`, `Democratic`, `Bipartisan`, `Nonpartisan`, dan een punt.
- Een rechter is altijd `Nonpartisan`; een parlement is nooit `Nonpartisan` (de twee tabellen in hoofdstuk 4). `gerry/config.py` dwingt dat af vanaf taak 5.10.
- De kolomnaam begint niet met `Map`: `parse_sources_md` zoekt precies één kolom die zo begint.

Vorm van de cel, met verzonnen getallen:

```
Legislature, Republican. HB 99 passed the House 80-60 on 2025-08-20 (R 80-0, D 0-60) and the Senate 19-11 on 2025-08-23 (R 19-0, D 0-11); signed 2025-08-29. At adoption: House 88 R, 62 D; Senate 19 R, 11 D; Governor Jane Doe (R). Sources: [Bill page](https://...), [House journal](https://...), [Senate journal](https://...)
```

- [ ] **Step 1: Write the decision rules into data/sources.md**

De eigenaar besliste de regels op 7 oktober 2026 ("Besluiten van de eigenaar", punt 1 tot en met 5); vraag ze niet opnieuw. Zet ze in het inleidende deel van `data/sources.md`, direct vóór de kop `## Multi-seat states`, als alinea met een genummerde lijst. Gebruik geen nieuwe kop: `parse_sources_md` zoekt zijn tabellen onder vaste koppen. Haal de tekst door de unslop-skill:

```
Adoption and control. This column says which body adopted the map in force and whether one party could adopt it alone, as defined in chapter 4 of docs/superpowers/specs/2026-10-06-extensions-design.md. The owner approved these rules on 2026-10-07:

1. The vote comes first. A map is Bipartisan if, in every chamber that voted, a majority of the members present from each party voted for it. Otherwise the control over the decision sets the value.
2. A party that could adopt the map without the governor could adopt it alone.
3. Commissions of citizens without elected officials, where members from neither party can cast the deciding vote, are Nonpartisan. These are Arizona, Colorado and Michigan. Other commissions follow their vote. A map is Bipartisan if members of both parties voted for it or if no party held a majority alone. It carries the name of a party if that party's members formed the majority and the other party voted against. A member from neither party who cast the deciding vote does not count as a party. Such maps are Bipartisan, and their note says who cast the deciding vote and for which plan.
4. The adopting body is the one that set the district lines in force. Other steps, such as approval by a court or by voters, go in the note.
5. Each cell of the column starts with the body, a comma, the control value and a full stop, as in "Legislature, Republican."
```

Taak 5.11 leest alleen de tabel; de alinea en de lijst staan erbuiten.

- [ ] **Step 2: Collect the facts per state**

Zoek voor elk van de 44 staten:

1. Het besluit dat de geldende kaart vaststelde: wetsvoorstel en wet (nummer, hoofdstuk), commissiebesluit of rechterlijke uitspraak, met datum van de definitieve aanneming.
2. Bij een parlement: de eindstemming per kamer, met de verdeling per partij; of de gouverneur tekende, een veto gaf dat werd verworpen, of de wet zonder handtekening van kracht werd; of de gouverneur in die staat een veto over deze wet heeft.
3. De samenstelling op die datum: zetels per partij in elke kamer (met vacatures), de partij van de gouverneur, en de meerderheid die nodig is om een veto te breken.
4. Bij een commissie: samenstelling (partij of geen partij per lid, wie benoemde) en de stemming per lid of per groep.
5. Bij een rechter: welke rechter, de zaak, de datum, en of de kaart van de rechter zelf, van een speciale deskundige of van een partij in de zaak kwam.

Bronnen in deze volgorde: de site van het parlement (wetspagina, journaal, stemming per naam), de site van de commissie (besluit, notulen), de uitspraak of het bevel van de rechter, de officiële ledenlijst voor de partij van een lid. Secundaire bronnen (Ballotpedia, All About Redistricting, nieuws) gebruik je alleen om het officiële stuk te vinden. Blokkeert een staatssite buitenlandse adressen (TX, NC, OH, MO), neem dan de kopie in het Internet Archive en noteer de URL van die kopie.

Het werk is groot. Verdeel het desgewenst over subagents per groep staten; elke subagent levert per staat de feiten met bronnen en noemt elk twijfelgeval. De conclusie trekt de hoofdagent, met de regels van stap 1.

Startpunt per staat, uit de kolommen "Adopted" en "By" van `data/sources.md`, met wat in elk geval na te gaan is:

| Staat | Adopted, By | Nagaan |
|---|---|---|
| AL | 2023-07-21, Legislature | Stemming per partij over het plan van juli 2023; tekende de gouverneur |
| AZ | 2021-12-22, Commission | Voorbeeld in het ontwerp: Commission, Nonpartisan. Stemming van de commissie als bron |
| AR | 2021-10-13, Legislature | Stemming per partij; tekende de gouverneur of werd de wet zonder handtekening van kracht |
| CA | 2025-08-21, Legislature and ballot measure | Voorbeeld in het ontwerp: Legislature, Democratic. Stemming over AB 604; Proposition 50 voor `adopted_note` |
| CO | 2021-11-01, Commission, approved by the Colorado Supreme Court | Samenstelling en stemming van de commissie (punt 3); de goedkeuring door de rechter voor `adopted_note` (punt 4) |
| CT | 2022-02-10, Court | Bevel van het Connecticut Supreme Court en de rol van de special master |
| FL | 2026-05-04, Legislature | Stemming per partij; tekende de gouverneur |
| GA | 2023-12-08, Legislature, court-ordered remedy | Stemming per partij; het bevel van de rechter voor `adopted_note` (punt 4) |
| HI | 2022-01-28, Commission | Samenstelling (wie benoemde de leden) en stemming (punt 3) |
| ID | 2021-11-10, Commission | Samenstelling en stemming (punt 3) |
| IL | 2021-11-23, Legislature | Voorbeeld in het ontwerp: Legislature, Democratic. Stemming als bron |
| IN | 2021-10-04, Legislature | Stemming per partij |
| IA | 2021-11-04, Legislature, nonpartisan staff plan | Stemming per partij (punt 1); het plan van de staf voor `adopted_note` |
| KS | 2022-02-09, Legislature, veto overridden | Stemmingen over het veto; meerderheid voor het breken van een veto |
| KY | 2022-01-20, Legislature, veto overridden | Idem |
| LA | 2026-05-29, Legislature | Stemming per partij over SB 121; tekende de gouverneur |
| ME | 2021-09-29, Legislature | Stemming per partij; de vereiste meerderheid van twee derde |
| MD | 2022-04-04, Legislature | Stemming per partij over SB 1012; wat deed de gouverneur (andere partij) |
| MA | 2021-11-22, Legislature | Stemming per partij; wat deed de gouverneur (andere partij) |
| MI | 2021-12-28, Commission | Samenstelling en stemming van de commissie van burgers (punt 3) |
| MN | 2022-02-15, fix 2022-06-02, Court panel, small legislative fix | Wie stelde de correctie van juni 2022 vast (punt 4) |
| MS | 2022-01-24, Legislature | Stemming per partij |
| MO | 2022-05-18, Legislature | Stemming per partij over HB 2909 |
| MT | 2021-11-12, Commission | Samenstelling, wie benoemde de voorzitter, stemming; gaf de voorzitter zonder partij de doorslag, dan `Bipartisan` met een `adopted_note` over wie de doorslag gaf en voor welk voorstel (punt 3) |
| NE | 2021-09-30, Legislature | Het parlement is officieel zonder partijen: partij van de leden volgens de officiële registratie; meerderheid nodig om een filibuster te breken |
| NV | 2021-11-16, Legislature | Stemming per partij |
| NH | 2022-05-31, Court | Uitspraak van het New Hampshire Supreme Court |
| NJ | 2021-12-22, Commission | Samenstelling, de doorslaggevende stem van het onafhankelijke lid; dan `Bipartisan` met een `adopted_note` over wie de doorslag gaf en voor welk voorstel (punt 3) |
| NM | 2021-12-17, Legislature | Stemming per partij |
| NY | 2024-02-28, Legislature | Stemming per partij (punt 1) |
| NC | 2025-10-22, Legislature | Stemming per partij; geen veto van de gouverneur, dus `Republican` met een `adopted_note` als de Republikeinen beide kamers hadden (punt 2) |
| OH | 2025-10-31, Commission | Samenstelling en stemming van de Ohio Redistricting Commission |
| OK | 2021-11-22, Legislature | Stemming per partij |
| OR | 2021-09-27, Legislature | Stemming per partij |
| PA | 2022-02-23, Court | Uitspraak van het Pennsylvania Supreme Court (Carter v. Chapman) |
| RI | 2022-02-16, Legislature | Stemming per partij |
| SC | 2022-01-26, Legislature | Stemming per partij |
| TN | 2026-05-07, Legislature | Stemming per partij |
| TX | 2025-08-29, Legislature | Voorbeeld in het ontwerp: Legislature, Republican. Stemming als bron |
| UT | 2025-11-10, Court | Voorbeeld in het ontwerp: Court, Nonpartisan. Uitspraak als bron |
| VA | 2021-12-28, Court | Uitspraak van het Supreme Court of Virginia en de special masters |
| WA | 2022-02-08, Commission, amended by the Legislature | Stemming van de commissie; aard en stemming van de wijziging (punt 3 en 4) |
| WV | 2021-10-22, Legislature | Stemming per partij |
| WI | 2022-03-03, Court | Uitspraak van het Wisconsin Supreme Court (Johnson v. WEC), en wiens kaart het werd |

- [ ] **Step 3: Decide adopted_by and control per state**

Pas de definities van hoofdstuk 4 van het uitbreidingsontwerp toe, met de besluiten van stap 1. Noteer bij elke staat welke regel de uitkomst bepaalde.

Stop en vraag de eigenaar, en kies niet zelf, als:

1. de definities en de besluiten van stap 1 voor een staat twee waarden toelaten;
2. er voor de eindstemming of de samenstelling geen officiële bron is, ook niet in het Internet Archive;
3. de feiten afwijken van de kolommen "Adopted", "By" of "Map for Nov 3, 2026" van `data/sources.md`;
4. de feiten afwijken van een voorbeeld in het ontwerp (TX, IL, CA, AZ, UT);
5. de kaart die in november 2026 geldt sinds de laatste statuscontrole is veranderd (dan gelden de beslisregels van taak 3.7 van het hoofdplan);
6. een overstap van partij of een vacature bepaalt of een partij de kaart alleen kon aannemen.

- [ ] **Step 4: Write the column**

Voeg in `data/sources.md`, in de tabel onder `## Multi-seat states`, direct na de kolom "By" de kolom `Adoption and control` toe, met de kop, de scheidingsregel en een cel voor elk van de 44 staten. Pas de andere kolommen niet aan, behalve een fout die stap 3 vond en de eigenaar bevestigde. Zet elk twijfelgeval dat nog openstaat onder `## Open items`.

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py -q`
Expected: alles slaagt. De lezer van `data/sources.md` negeert de nieuwe kolom tot taak 5.11.

- [ ] **Step 5: Draft the adopted_note texts**

Schrijf een korte Engelse tekst voor elke staat waar het orgaan of de controle uitleg nodig heeft, zoals het ontwerp voor Iowa noemt: in elk geval de gevallen van punt 2 tot en met 4 van de besluiten (bij een lid zonder partij met de doorslag: wie de doorslag gaf en voor welk voorstel) en de staten waar een regel uit stap 1 de doorslag gaf. Eén of twee zinnen, feitelijk, zonder oordeel en zonder em-dashes. Haal ze door de unslop-skill. Voorbeeld van de vorm (verzonnen): `Nonpartisan legislative staff drew the plan; the legislature could accept or reject it without amendments.`

- [ ] **Step 6: Get the owner's approval**

Leg de eigenaar voor: een tabel met de 44 staten (staat, `adopted_by`, `control`, de beslissende regel), de lijst van twijfelgevallen met de feiten en beide lezingen, en de teksten voor `adopted_note`. Verwerk de opmerkingen tot de eigenaar akkoord geeft. Noteer het akkoord met datum in de alinea van stap 1.

- [ ] **Step 7: Commit**

```powershell
git add data/sources.md
git commit -m "Record who adopted each map and under whose control"
```

### Task 5.10: config.yaml en gerry/config.py, adopted_by, control en adopted_note

**Files:**
- Modify: `pipeline/gerry/config.py`
- Modify: `pipeline/config.yaml` (alle 44 staten)
- Modify: `tests/test_config.py`
- Modify: `tests/test_ensemble.py`, `tests/test_units.py`, `tests/test_sources.py`, `tests/test_export.py`, `tests/test_metrics_step.py` (de hulpfuncties die een `StateConfig` maken)

**Interfaces:**
- Consumes: de kolom "Adoption and control" en de goedgekeurde teksten uit taak 5.9.
- Produces: `ADOPTED_BY_VALUES`, `CONTROL_VALUES`; `StateConfig` met na `notes` de velden `adopted_by: str`, `control: str` en `adopted_note: str | None`; `config.yaml` met beide verplichte velden voor elke staat en `adopted_note` waar de eigenaar een tekst goedkeurde. `ConfigError` bij een onbekende waarde, een ontbrekend verplicht veld, een rechter die niet `Nonpartisan` is, een parlement dat `Nonpartisan` is, of een lege of em-dash bevattende `adopted_note`.

De velden hebben geen standaardwaarde, net als de andere velden van `StateConfig`. Daarom krijgen de vijf hulpfuncties in de tests die een `StateConfig` maken de drie nieuwe argumenten.

- [ ] **Step 1: Write the failing tests**

In `tests/test_config.py`, vervang de import uit `gerry.config` door:

```python
from gerry.config import (
    ADOPTED_BY_VALUES, CONTROL_VALUES, ENSEMBLE_NOTE_KEYS, REPO_ROOT, STATE_NOTE_KEYS, ConfigError, ExtraMap,
    data_dir, interim_dir, load_config,
)
```

Voeg in `minimal()` aan Missouri toe, na `"notes": ["blocked_map"],`:

```python
                "adopted_by": "Legislature", "control": "Republican",
```

en aan New Mexico, na `"unit_kind": "tract",`:

```python
                # made-up values; the real ones come from the research in data/sources.md
                "adopted_by": "Commission", "control": "Bipartisan",
                "adopted_note": "Made-up note for the test.",
```

Voeg onderaan `test_minimal_config_loads_with_types` toe:

```python
    # extensions design, chapter 4: who adopted the map, under whose control; the note is optional
    assert (mo.adopted_by, mo.control, mo.adopted_note) == ("Legislature", "Republican", None)
    nm = cfg.states["NM"]
    assert (nm.adopted_by, nm.control, nm.adopted_note) == ("Commission", "Bipartisan", "Made-up note for the test.")
```

Voeg onderaan de lijst `BAD_VALUES` toe:

```python
    # extensions design, chapter 4: adopted_by and control from the two tables, adopted_note optional
    ("states.NM.adopted_by", "Governor", "adopted_by"),
    ("states.NM.control", "Independent", "control"),
    ("states.NM.control", None, "missing keys"),
    ("states.NM.adopted_by", None, "missing keys"),
    ("states.NM.adopted_by", "Court", "court"),            # a court is Nonpartisan (NM: Bipartisan)
    ("states.MO.control", "Nonpartisan", "legislature"),   # a legislature never is
    ("states.NM.adopted_note", "", "adopted_note"),
    ("states.NM.adopted_note", "Staff drew it \u2014 the legislature voted.", "em dash"),
```

Voeg direct vóór `test_real_config_has_the_block_file_of_the_2024_maps` toe:

```python
def test_real_config_adoption_fields(cfg):
    # extensions design, chapter 4; the values come from data/sources.md, column "Adoption and control"
    for postal, st in cfg.states.items():
        assert st.adopted_by in ADOPTED_BY_VALUES and st.control in CONTROL_VALUES, postal
    # the examples in the design
    examples = {"TX": ("Legislature", "Republican"), "IL": ("Legislature", "Democratic"),
                "CA": ("Legislature", "Democratic"), "AZ": ("Commission", "Nonpartisan"),
                "UT": ("Court", "Nonpartisan")}
    for postal, expected in examples.items():
        assert (cfg.states[postal].adopted_by, cfg.states[postal].control) == expected, postal
```

Geef de vijf hulpfuncties de nieuwe velden mee:

- `tests/test_ensemble.py`:

  ```python
  def make_state(postal="NV", seats=2, elections=("pre_16", "pre_20")):
      return StateConfig(postal=postal, name="Test", fips="32", seats=seats, map_name="m", status="In effect",
                         source_label="s", source_url="https://example.org/", bef="cd120",
                         elections=tuple(elections), unit_kind="vtd", extra_maps=(), notes=(),
                         adopted_by="Legislature", control="Republican", adopted_note=None)
  ```

- `tests/test_units.py`:

  ```python
  def make_state(postal, fips, unit_kind, elections=("pre_16", "pre_20")):
      return StateConfig(postal=postal, name="Test", fips=fips, seats=2, map_name="m", status="In effect",
                         source_label="s", source_url="https://example.org/", bef="cd120",
                         elections=tuple(elections), unit_kind=unit_kind, extra_maps=(), notes=(),
                         adopted_by="Legislature", control="Republican", adopted_note=None)
  ```

- `tests/test_sources.py`:

  ```python
  def make_state(postal, name, fips, seats, unit_kind, elections=("pre_16", "pre_20")):
      return StateConfig(postal=postal, name=name, fips=fips, seats=seats, map_name="m", status="In effect",
                         source_label="s", source_url="https://example.org/", bef="cd120",
                         elections=tuple(elections), unit_kind=unit_kind, extra_maps=(), notes=(),
                         adopted_by="Legislature", control="Republican", adopted_note=None)
  ```

- `tests/test_export.py`, de functie `state`:

  ```python
  def state(postal, name, fips, seats, notes=(), extra_maps=(), adopted_by="Legislature", control="Republican",
            adopted_note=None):
      return StateConfig(
          postal=postal, name=name, fips=fips, seats=seats, map_name=f"{name} map", status="In effect",
          source_label=f"{name} source", source_url=f"https://example.org/{postal.lower()}", bef="cd120",
          elections=("pre_16", "pre_20"), unit_kind="vtd", extra_maps=tuple(extra_maps), notes=tuple(notes),
          adopted_by=adopted_by, control=control, adopted_note=adopted_note,
      )
  ```

- `tests/test_metrics_step.py`, de constante `XX`: vervang de laatste regel `notes=())` door

  ```python
      notes=(), adopted_by="Legislature", control="Republican", adopted_note=None)
  ```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_ensemble.py tests/test_units.py tests/test_sources.py tests/test_export.py tests/test_metrics_step.py -q`
Expected: `Interrupted: 3 errors during collection`: `ImportError: cannot import name 'ADOPTED_BY_VALUES' from 'gerry.config'` in `test_config.py`, en `TypeError: StateConfig.__init__() got an unexpected keyword argument 'adopted_by'` in `test_metrics_step.py` en `test_units.py`.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/config.py`, direct na `COMPUTED_NOTE_KEYS`:

```python
# extensions design, chapter 4: who adopted the current map, and under whose control
ADOPTED_BY_VALUES = ("Legislature", "Commission", "Court")
CONTROL_VALUES = ("Republican", "Democratic", "Bipartisan", "Nonpartisan")
```

De verplichte en toegestane sleutels per staat:

```python
_STATE_REQUIRED = (
    "name", "fips", "seats", "map_name", "status", "source_label", "source_url",
    "bef", "elections", "unit_kind", "adopted_by", "control",
)
_STATE_KEYS = _STATE_REQUIRED + ("extra_maps", "notes", "adopted_note")
```

Onderaan de velden van `StateConfig`, na `notes: tuple[str, ...]`:

```python
    adopted_by: str              # ADOPTED_BY_VALUES
    control: str                 # CONTROL_VALUES
    adopted_note: str | None     # English, shown on the site
```

In `_state`, voeg als laatste argument van `StateConfig(...)` toe, na `notes=...`:

```python
        **_adoption(raw, where),
```

en voeg direct na `_state` toe:

```python
def _adoption(raw: dict, where: str) -> dict:
    """adopted_by, control and adopted_note (extensions design, chapter 4). By the two tables there, a court
    is Nonpartisan and a legislature never is."""
    adopted_by = _choice(raw, "adopted_by", where, ADOPTED_BY_VALUES)
    control = _choice(raw, "control", where, CONTROL_VALUES)
    if adopted_by == "Court" and control != "Nonpartisan":
        raise ConfigError(f"{where}.control: a map adopted by a court is Nonpartisan, got {control!r}")
    if adopted_by == "Legislature" and control == "Nonpartisan":
        raise ConfigError(f"{where}.control: a map adopted by a legislature is Republican, Democratic or "
                          "Bipartisan, got 'Nonpartisan'")
    note = None
    if raw.get("adopted_note") is not None:
        note = _text(raw, "adopted_note", where)
        if "\u2014" in note:
            raise ConfigError(f"{where}.adopted_note: no em dash in text shown on the site")
    return {"adopted_by": adopted_by, "control": control, "adopted_note": note}
```

- [ ] **Step 4: Fill config.yaml**

Zet bij elke staat in `pipeline/config.yaml`, na `unit_kind` (en na `extra_maps` en `notes` als die er zijn), de twee waarden uit het begin van de cel "Adoption and control" in `data/sources.md`, en `adopted_note` alleen waar de eigenaar in taak 5.9 een tekst goedkeurde. Vorm:

```yaml
  TX:
    # ... de bestaande velden
    notes: [adopted_after_2024_election]
    adopted_by: Legislature
    control: Republican
  IA:
    # ... de bestaande velden
    adopted_by: Legislature
    control: Bipartisan                  # de waarde uit data/sources.md, niet deze
    adopted_note: "De tekst die de eigenaar goedkeurde."
```

Zet een `adopted_note` tussen dubbele aanhalingstekens. Pas de kopregel van `config.yaml` niet aan.

Controleer dat beide bestanden overeenkomen (taak 5.11 maakt hier een vaste controle van):

```powershell
.venv\Scripts\python -c "import re, sys; sys.path.insert(0, 'pipeline'); from gerry.config import load_config, REPO_ROOT; cfg = load_config(); text = (REPO_ROOT / 'data' / 'sources.md').read_text(encoding='utf-8'); bad = [p for p, st in cfg.states.items() if not re.search(rf'^\| {p} \|.*\| {st.adopted_by}, {st.control}\.', text, re.M)]; print('mismatch:', bad or 'none')"
```

Expected: `mismatch: none`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_ensemble.py tests/test_units.py tests/test_sources.py tests/test_export.py tests/test_metrics_step.py -q`
Expected: `179 passed` (`test_config.py` 50, `test_ensemble.py` 11, `test_units.py` 25, `test_sources.py` 20, `test_export.py` 32, `test_metrics_step.py` 41). Zonder datamap slaan de tests met de marker `data` over.

- [ ] **Step 6: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/gerry/config.py pipeline/config.yaml tests/test_config.py tests/test_ensemble.py tests/test_units.py tests/test_sources.py tests/test_export.py tests/test_metrics_step.py
git commit -m "Add who adopted each map and under whose control to the config"
```

### Task 5.11: check_sources_md vergelijkt de nieuwe kolom

**Files:**
- Modify: `pipeline/gerry/checks.py`
- Modify: `tests/test_checks_sources.py`

**Interfaces:**
- Consumes: `parse_sources_md`, `check_sources_md` en `_column` (hoofdplan, taak 0.5); de kolom uit taak 5.9 en de velden uit taak 5.10.
- Produces: elke rij onder "Multi-seat states" in de uitvoer van `parse_sources_md` heeft ook `adoption` (de tekst van de kolom `Adoption and control`); ontbreekt de kolom, dan `CheckError("sources_md", "US", "... has no column 'Adoption and control'")`. `check_sources_md` meldt een staat waarvan de cel niet begint met `f"{adopted_by}, {control}."` gevolgd door een spatie of het einde van de cel. `04_export` roept `check_sources_md` al aan, dus de export stopt bij een verschil.

- [ ] **Step 1: Write the failing tests**

In `tests/test_checks_sources.py`, voeg in `test_parse_real_sources_md` na `assert tx["status"] in {"In effect", "Challenged"}` toe:

```python
    # extensions design, chapter 4: the new column starts with adopted_by and control (Texas is its example)
    assert tx["adoption"].startswith("Legislature, Republican.")
```

Voeg aan `MISMATCHES` toe, na de regel met `"TX", "url"`:

```python
    ("Multi-seat states", "TX", "Adoption and control", lambda v: v.replace("Republican", "Democratic", 1),
     "TX", "adoption"),
    ("Multi-seat states", "AZ", "Adoption and control", lambda v: v.replace("Commission", "Court", 1),
     "AZ", "adoption"),
```

Voeg direct vóór `test_map_cell_with_link_and_text_raises` toe:

```python
def test_multi_seat_table_needs_the_adoption_column(tmp_path):
    text = real_text().replace("| Adoption and control |", "| Adoption |", 1)
    with pytest.raises(CheckError, match="Adoption and control"):
        parse_sources_md(write(tmp_path, text))


def test_adoption_cell_must_start_with_both_values_and_a_full_stop(tmp_path):
    # "Legislature, Republicans ..." is not "Legislature, Republican."
    text = change_cell(real_text(), "Multi-seat states", "TX", "Adoption and control",
                       lambda v: v.replace("Republican.", "Republicans,", 1))
    with pytest.raises(CheckError) as info:
        check_sources_md(load_config(), write(tmp_path, text))
    assert info.value.state == "TX" and "adoption" in info.value.detail
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py -q`
Expected: `5 failed, 16 passed`: `test_parse_real_sources_md` (`KeyError: 'adoption'`), de twee nieuwe regels van `test_mismatch_raises` en de twee nieuwe tests (`DID NOT RAISE`).

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/checks.py`, direct na `_SECTIONS`:

```python
_ADOPTION = "Adoption and control"   # column of "Multi-seat states": "<adopted_by>, <control>. <record>"
```

In `parse_sources_md`, vervang de docstring-regel over de rijen en voeg na de regel `rows = [_row(...) for raw in cells]` het lezen van de kolom toe:

```python
    Returns {"status_checked": date, "multi": {ST: row}, "blocked": {ST: [row, ...]},
    "at_large": {ST: row}}. A row is {"map_name", "url", "status", "pipeline_file"}
    plus "seats" (int) in "multi" and "at_large", and "adoption" (the text of the column
    "Adoption and control") in "multi". "url" is None when the map cell has no link.
    """
```

```python
        rows = [_row(header, raw, heading, with_seats=key != "blocked") for raw in cells]
        if key == "multi":
            # extensions design, chapter 4: who adopted the map, under whose control, with the sources
            rows = [(postal, {**row, "adoption": _column(header, raw, _ADOPTION, heading)})
                    for (postal, row), raw in zip(rows, cells)]
```

In `check_sources_md`, direct na `problems += _compare(postal, multi[postal], expected)`:

```python
            start = f"{st.adopted_by}, {st.control}."
            cell = multi[postal]["adoption"]
            if cell != start and not cell.startswith(start + " "):
                problems.append((postal, f"adoption: sources.md starts with {cell[:40]!r}, "
                                         f"config.yaml has {start!r}"))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_checks_sources.py tests/test_export_step.py -q`
Expected: `34 passed` (21 en 13).

- [ ] **Step 5: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/checks.py tests/test_checks_sources.py
git commit -m "Check that sources.md and config.yaml agree on who adopted each map"
```

### Task 5.12: 03_metrics, het overzicht per controle en per orgaan

**Files:**
- Modify: `pipeline/03_metrics.py`
- Modify: `tests/test_metrics_step.py`, `tests/test_metrics_data.py`

**Interfaces:**
- Consumes: `ADOPTED_BY_VALUES`, `CONTROL_VALUES`, `StateConfig.adopted_by`, `StateConfig.control` (taak 5.10); `effects.drawing` per staat (hoofdplan, taak 2.11).
- Produces: `national_by(states, cfg_states, field) -> dict` met `field` gelijk aan `"control"` of `"adopted_by"`: per waarde {`states`, `seats`, `drawing`}, met elke waarde uit de tabel van het ontwerp, in die volgorde, ook zonder staten. `compute` zet `by_control` en `by_body` onder `national` in `metrics.json`.

`seats` is het aantal zetels van die staten, `drawing` de som van hun tekeneffecten. Die som is niet het landelijke tekeneffect (zie "Keuzes in dit plan", punt 9).

- [ ] **Step 1: Write the failing tests**

Voeg onderaan `tests/test_metrics_step.py` toe:

```python


# --- Task 5.12: the overview per control and per body ----------------------------------------


def test_national_by_sums_states_seats_and_drawing_effects():
    cfg_states = {
        "AA": dataclasses.replace(XX, postal="AA", seats=4, adopted_by="Legislature", control="Republican"),
        "BB": dataclasses.replace(XX, postal="BB", seats=6, adopted_by="Legislature", control="Republican"),
        "CC": dataclasses.replace(XX, postal="CC", seats=2, adopted_by="Court", control="Nonpartisan"),
    }
    states = {"AA": {"effects": {"drawing": -2}}, "BB": {"effects": {"drawing": 1}}, "CC": {"effects": {"drawing": 0}}}
    # Republican: AA and BB, 4 + 6 = 10 seats, drawing -2 + 1 = -1; Nonpartisan: CC, 2 seats, 0
    # every value of the design's table is listed, in that order, also without states
    assert step.national_by(states, cfg_states, "control") == {
        "Republican": {"states": 2, "seats": 10, "drawing": -1},
        "Democratic": {"states": 0, "seats": 0, "drawing": 0},
        "Bipartisan": {"states": 0, "seats": 0, "drawing": 0},
        "Nonpartisan": {"states": 1, "seats": 2, "drawing": 0},
    }
    by_body = step.national_by(states, cfg_states, "adopted_by")
    assert list(by_body) == ["Legislature", "Commission", "Court"]
    assert by_body["Legislature"] == {"states": 2, "seats": 10, "drawing": -1}
    assert by_body["Court"] == {"states": 1, "seats": 2, "drawing": 0}


def test_compute_adds_the_overview_per_control_and_body(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    _small_house(monkeypatch)
    nat = step.compute(cfg, tmp_path)["national"]
    # XX: Legislature, Republican, 3 seats, drawing effect enacted 1 - median 1 = 0
    assert nat["by_control"]["Republican"] == {"states": 1, "seats": 3, "drawing": 0}
    assert nat["by_body"]["Legislature"] == {"states": 1, "seats": 3, "drawing": 0}
    assert sum(v["states"] for v in nat["by_control"].values()) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `2 failed, 41 passed`, met `AttributeError: module 'metrics_step' has no attribute 'national_by'` en `KeyError: 'by_control'`.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/03_metrics.py`, vervang de import uit `gerry.config` door:

```python
from gerry.config import (ADOPTED_BY_VALUES, CONTROL_VALUES, REPO_ROOT, AtLargeState, StateConfig, interim_dir,
                          load_config)
```

Voeg direct na `national_redraw` toe:

```python
def national_by(states: Mapping[str, dict], cfg_states: Mapping[str, StateConfig], field: str) -> dict:
    """Per value of `field` (control or adopted_by, extensions design ch. 4): the number of states, their seats
    and the sum of their drawing effects. Every value of the design's table is listed, in that order, also
    without states. The sum of the state effects is not the national drawing effect (spec chapter 5)."""
    values = {"control": CONTROL_VALUES, "adopted_by": ADOPTED_BY_VALUES}[field]
    out = {value: {"states": 0, "seats": 0, "drawing": 0} for value in values}
    for postal, s in states.items():
        st = cfg_states[postal]
        entry = out[getattr(st, field)]
        entry["states"] += 1
        entry["seats"] += st.seats
        entry["drawing"] += s["effects"]["drawing"]
    return out
```

Voeg in `compute` direct vóór `return {"national": national, "states": states, "checks": checks}` toe:

```python
    national["by_control"] = national_by(states, cfg.states, "control")
    national["by_body"] = national_by(states, cfg.states, "adopted_by")
    for field in ("by_control", "by_body"):
        parts = [f"{value} {e['states']} states, {e['seats']} seats, drawing {e['drawing']:+d}"
                 for value, e in national[field].items()]
        print(f"US {field}: " + "; ".join(parts))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `43 passed`.

- [ ] **Step 5: Run 03_metrics on the real data**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: na de drie regels van taak 5.7 twee nieuwe regels in deze vorm:

```
US by_control: Republican <n> states, <n> seats, drawing <+n>; Democratic ...; Bipartisan ...; Nonpartisan ...
US by_body: Legislature <n> states, <n> seats, drawing <+n>; Commission ...; Court ...
```

De getallen volgen uit de waarden van taak 5.9. Reken ze na met de tekeneffecten per staat in de proefrun: per regel tellen de staten op tot 44, de zetels tot 429 en de tekeneffecten tot -10. Blijft de kolom "By" van `data/sources.md` het orgaan, dan is de tweede regel `US by_body: Legislature 28 states, 301 seats, drawing -9; Commission 9 states, 73 seats, drawing -1; Court 7 states, 55 seats, drawing +0`.

- [ ] **Step 6: Write the data test**

Vervang in `tests/test_metrics_data.py` de regel `from gerry.config import interim_dir` door `from gerry.config import interim_dir, load_config` en voeg onderaan toe:

```python


def test_overview_per_control_and_body(metrics):
    cfg = load_config()
    states = metrics["states"]
    for field, attr in (("by_control", "control"), ("by_body", "adopted_by")):
        table = metrics["national"][field]
        for value, entry in table.items():
            members = [p for p, st in cfg.states.items() if getattr(st, attr) == value]
            assert entry == {"states": len(members), "seats": sum(cfg.states[p].seats for p in members),
                             "drawing": sum(states[p]["effects"]["drawing"] for p in members)}, (field, value)
        assert sum(e["states"] for e in table.values()) == 44
        assert sum(e["seats"] for e in table.values()) == 429
        # the sum of the state drawing effects: -10 on 2026-10-06
        drawing = sum(e["drawing"] for e in table.values())
        assert drawing == sum(s["effects"]["drawing"] for s in states.values()) == -10
```

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_data.py -m data -q`
Expected: `25 passed`.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/03_metrics.py tests/test_metrics_step.py tests/test_metrics_data.py
git add docs/validation.md
git commit -m "Sum states, seats and drawing effects per control and per adopting body"
```

Sla de tweede `git add` over als `docs/validation.md` niet veranderde.

### Task 5.13: results.json en de contracttest

**Files:**
- Modify: `pipeline/gerry/export.py`
- Modify: `tests/test_export.py`
- Modify: `site/js/contract.test.js`
- Modify (gegenereerd): `site/data/results.json`, `site/data/map.topojson` (blijft gelijk)

**Interfaces:**
- Consumes: `metrics.json` met de velden van taak 5.6, 5.7 en 5.12; `StateConfig.adopted_by`, `control`, `adopted_note` (taak 5.10); `build_results` (hoofdplan, taak 3.2).
- Produces: `NATIONAL_FIELDS` met daarachter `majority`, `competitive`, `redraw`, `by_control`, `by_body`; `STATE_FIELDS` met daarachter `competitive`, `redraw`; per staat `adopted` {`by`, `control`, `note`} direct na `source`. Een `results.json` met de velden van hoofdstuk 5 van het uitbreidingsontwerp; een contracttest met vier nieuwe tests en de nieuwe velden in de bestaande tests.

Wat de contracttest erbij controleert:

- Meerderheid: `seats_needed` is 216; `base_share` past bij de stemmen van alle districten (marge 1e-6, de stemmen zijn afgerond); de drempel voor Enacted is precies *V0* + 0,5 min het 216e hoogste districtsaandeel (1e-12); `seats_at_base` is `national.enacted`, en ligt dat onder 216, dan ligt de drempel voor Enacted op of boven *V0*; alle vijf drempels liggen binnen 5 punten van *V0*; de vier rasterdrempels liggen op het raster van 0,01 punt; `low <= share <= high`; `probability_at_base` volgt uit `national.neutral.dist`.
- Concurrerend: per staat telt `enacted` precies de districten met een aandeel van 0,45 tot en met 0,55; `neutral_dist` heeft `seats + 1` tellingen met som 5.000; `median`, `p5` en `p95` volgen uit `neutral_dist` (inverse verdelingsfunctie); landelijk 430 kansen met som 1 en `enacted` als som over de staten.
- Hertekeningen: `change` is Enacted min `seats_2024`; zonder verandering van de kaart is `change` 0; landelijk zijn `seats_2024` en `change` de som over de staten en is `change` gelijk aan `national.enacted` min `seats_2024`.
- Wie nam de kaart aan: waarden uit de twee tabellen; een rechter is `Nonpartisan`, een parlement niet; `note` is `null` of tekst; `by_control` en `by_body` noemen elke waarde in volgorde, en elk getal volgt uit de staten met die waarde; samen 44 staten en 429 zetels. Er is geen vergelijking met `national.effects.drawing`.
- De tekst van `adopted.note` valt onder de test op em-dashes.

- [ ] **Step 1: Write the failing test**

In `tests/test_export.py`, voeg onderaan het woordenboek in `toy_state_metrics` toe (na `"computed_notes": list(computed_notes),`):

```python
        # extensions (Task 5.6): competitive districts and the 2024 map
        "competitive": {"enacted": 0, "median": 1, "p5": 0, "p95": 1, "neutral_dist": [2000, 3000, 0]},
        "redraw": {"seats_2024": 2, "change": -1, "map_changed": True},
```

Voeg in `toy_metrics` onder `"national"` toe, na `"outside_band": False,`:

```python
            # extensions (Tasks 5.7 and 5.12), passed through unchanged
            "majority": {"seats_needed": 3, "base_share": 0.55,
                         "enacted": {"share": 0.56, "seats_at_base": 2},
                         "neutral": {"share": 0.53, "low": 0.5, "high": 0.57, "probability_at_base": 0.8},
                         "proportional": {"share": 0.52}},
            "competitive": {"enacted": 0, "median": 2, "p5": 1, "p95": 2, "neutral_dist": [0.16, 0.48, 0.36, 0.0, 0.0]},
            "redraw": {"seats_2024": 4, "change": -2},
            "by_control": {"Republican": {"states": 2, "seats": 4, "drawing": 0},
                           "Democratic": {"states": 0, "seats": 0, "drawing": 0},
                           "Bipartisan": {"states": 0, "seats": 0, "drawing": 0},
                           "Nonpartisan": {"states": 0, "seats": 0, "drawing": 0}},
            "by_body": {"Legislature": {"states": 2, "seats": 4, "drawing": 0},
                        "Commission": {"states": 0, "seats": 0, "drawing": 0},
                        "Court": {"states": 0, "seats": 0, "drawing": 0}},
```

Vervang in `test_build_results_national_adds_single_seat_states_sorted_by_postal` de laatste bewering door:

```python
    assert list(national) == ["seats", "proportional", "enacted", "neutral", "position", "effects",
                              "outside_band", "majority", "competitive", "redraw", "by_control", "by_body",
                              "single_seat"]
    # the extensions pass through unchanged
    for key in ("majority", "competitive", "redraw", "by_control", "by_body"):
        assert national[key] == toy_metrics()["national"][key], key
```

Voeg in `test_build_results_state_entry` aan het verwachte woordenboek toe, na `"source": {...},`:

```python
        # from config.yaml (Task 5.10): the toy state's defaults
        "adopted": {"by": "Legislature", "control": "Republican", "note": None},
```

en na `"sorted": m["sorted"],`:

```python
        "competitive": m["competitive"], "redraw": m["redraw"],
```

Voeg direct vóór `test_blocked_map_district_ids_are_checked_too` toe:

```python
def test_adopted_comes_from_the_config_with_its_note():
    cfg = toy_results_config()
    hawaii = dataclasses.replace(cfg.states["HI"], adopted_by="Commission", control="Bipartisan",
                                 adopted_note="Made-up note.")
    cfg = dataclasses.replace(cfg, states={**cfg.states, "HI": hawaii})
    results = build_results(toy_metrics(), cfg, "2026-10-06")
    assert results["states"]["HI"]["adopted"] == {"by": "Commission", "control": "Bipartisan", "note": "Made-up note."}
    assert results["states"]["MO"]["adopted"] == {"by": "Legislature", "control": "Republican", "note": None}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -q`
Expected: `3 failed, 30 passed`: `test_build_results_national_adds_single_seat_states_sorted_by_postal` en `test_build_results_state_entry` met een `AssertionError` (velden ontbreken), `test_adopted_comes_from_the_config_with_its_note` met `KeyError: 'adopted'`.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/export.py`:

```python
NATIONAL_FIELDS = ("seats", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                   "majority", "competitive", "redraw", "by_control", "by_body")
STATE_FIELDS = ("d_share", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                "eg", "mm", "districts", "sorted", "competitive", "redraw")
```

In `_state_entry`, voeg na de regel `"source": {"label": st.source_label, "url": st.source_url},` toe:

```python
        # extensions design, chapter 4: who adopted the map, under whose control
        "adopted": {"by": st.adopted_by, "control": st.control, "note": st.adopted_note},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py tests/test_export_step.py -q`
Expected: `46 passed`.

- [ ] **Step 5: Extend the contract test**

In `site/js/contract.test.js`, vervang `STATE_FIELDS` en voeg de constanten van de uitbreidingen toe:

```js
const STATE_FIELDS = [
  'name', 'fips', 'seats', 'map_name', 'status', 'source', 'adopted', 'notes', 'd_share',
  'proportional', 'enacted', 'neutral', 'position', 'effects', 'outside_band',
  'eg', 'mm', 'districts', 'sorted', 'competitive', 'redraw',
];
// Extensions design (docs/superpowers/specs/2026-10-06-extensions-design.md)
const MAJORITY_DISTRICTS = 216;    // 218 of 435, minus DE and VT, fixed as Democratic (chapter 1)
const MAX_SWING = 0.05;            // a threshold lies within 5 points of the base share (chapters 1 and 5)
const GRID = 10000;                // neutral and proportional thresholds: steps of 0.01 point
const ADOPTED_BY = ['Legislature', 'Commission', 'Court'];
const CONTROL = ['Republican', 'Democratic', 'Bipartisan', 'Nonpartisan'];
```

Voeg in de test `visible text in results.json has no em dashes`, na de regel met `s.blocked_map`, toe:

```js
    if (s.adopted.note) texts.push(s.adopted.note);
```

Voeg onderaan het bestand toe:

```js

// --- Extensions: majority threshold, competitive districts, redraws, who adopted the map ---------------------

test('majority thresholds follow from the districts and lie within 5 points of the base share', { skip }, () => {
  const { national, states } = data().results;
  const m = national.majority;
  const districts = Object.values(states).flatMap((s) => s.districts);
  assert.equal(m.seats_needed, MAJORITY_DISTRICTS);
  // one vote base: the share of all district votes (rounded to whole votes in results.json)
  assert.ok(near(m.base_share, sum(districts.map((x) => x.d)) / sum(districts.map((x) => x.d + x.r)), 1e-6),
    `majority.base_share ${m.base_share}`);
  // enacted: exact, from the 216th highest district share
  const h = districts.map((x) => x.share).sort((a, b) => b - a)[MAJORITY_DISTRICTS - 1];
  assert.ok(near(m.enacted.share, m.base_share + 0.5 - h, 1e-12), `majority.enacted.share ${m.enacted.share}`);
  assert.equal(m.enacted.seats_at_base, national.enacted);
  if (m.enacted.seats_at_base < MAJORITY_DISTRICTS) assert.ok(m.enacted.share >= m.base_share, 'short of a majority: the threshold lies above the base share');
  else assert.ok(m.enacted.share <= m.base_share, 'a majority: the threshold lies at or below the base share');
  const grid = [m.neutral.share, m.neutral.low, m.neutral.high, m.proportional.share];
  for (const share of [m.enacted.share, ...grid]) {
    assert.ok(isFraction(share) && Math.abs(share - m.base_share) <= MAX_SWING + 1e-12, `threshold ${share} lies within 5 points`);
  }
  for (const share of grid) {
    const steps = (share - m.base_share) * GRID;
    assert.ok(near(steps, Math.round(steps), 1e-6), `threshold ${share} lies on the grid of 0.01 point`);
  }
  assert.ok(m.neutral.low <= m.neutral.share && m.neutral.share <= m.neutral.high, 'majority.neutral band order');
  assert.ok(near(m.neutral.probability_at_base, sum(national.neutral.dist.slice(MAJORITY_DISTRICTS)), 1e-9),
    'majority.neutral.probability_at_base follows from neutral.dist');
});

function checkCompetitive(c, length, total, where) {
  for (const key of ['enacted', 'median', 'p5', 'p95']) assert.ok(isInt(c[key]) && c[key] >= 0 && c[key] < length, `${where}.competitive.${key}`);
  assert.equal(c.neutral_dist.length, length, `${where}.competitive.neutral_dist length`);
  assert.ok(near(sum(c.neutral_dist), total, 1e-6), `${where}.competitive.neutral_dist sums to ${total}`);
  for (const [key, q] of [['p5', 0.05], ['median', 0.5], ['p95', 0.95]]) {
    assert.equal(c[key], percentile(c.neutral_dist, q), `${where}.competitive.${key} follows from neutral_dist`);
  }
}

test('competitive districts (45 to 55%) per state and for the nation', { skip }, () => {
  const { national, states } = data().results;
  for (const [postal, s] of Object.entries(states)) {
    checkCompetitive(s.competitive, s.seats + 1, PLANS, postal);
    const count = s.districts.filter((x) => x.share >= 0.45 && x.share <= 0.55).length;
    assert.equal(s.competitive.enacted, count, `${postal}.competitive.enacted counts the districts from 45 to 55%`);
  }
  checkCompetitive(national.competitive, 430, 1, 'national');
  assert.equal(national.competitive.enacted, sum(Object.values(states).map((s) => s.competitive.enacted)));
});

test('redraws since 2024 add up per state and for the nation', { skip }, () => {
  const { national, states } = data().results;
  for (const [postal, s] of Object.entries(states)) {
    const r = s.redraw;
    assert.ok(isInt(r.seats_2024) && r.seats_2024 >= 0 && r.seats_2024 <= s.seats, `${postal}.redraw.seats_2024`);
    assert.equal(r.change, s.enacted - r.seats_2024, `${postal}.redraw.change`);
    assert.equal(typeof r.map_changed, 'boolean', `${postal}.redraw.map_changed`);
    if (!r.map_changed) assert.equal(r.change, 0, `${postal}: the same map gives the same seats`);
  }
  const all = Object.values(states);
  assert.equal(national.redraw.seats_2024, sum(all.map((s) => s.redraw.seats_2024)));
  assert.equal(national.redraw.change, sum(all.map((s) => s.redraw.change)));
  assert.equal(national.redraw.change, national.enacted - national.redraw.seats_2024);
});

test('who adopted each map, and the overview per control and per body', { skip }, () => {
  const { national, states } = data().results;
  const all = Object.values(states);
  for (const [postal, s] of Object.entries(states)) {
    assert.ok(ADOPTED_BY.includes(s.adopted.by), `${postal}.adopted.by`);
    assert.ok(CONTROL.includes(s.adopted.control), `${postal}.adopted.control`);
    assert.ok(s.adopted.note === null || (typeof s.adopted.note === 'string' && s.adopted.note.length > 0), `${postal}.adopted.note`);
    if (s.adopted.by === 'Court') assert.equal(s.adopted.control, 'Nonpartisan', `${postal}: a court is Nonpartisan`);
    if (s.adopted.by === 'Legislature') assert.notEqual(s.adopted.control, 'Nonpartisan', `${postal}: a legislature is not Nonpartisan`);
  }
  for (const [field, key, values] of [['by_control', 'control', CONTROL], ['by_body', 'by', ADOPTED_BY]]) {
    assert.deepEqual(Object.keys(national[field]), values, `${field} lists every value, in order`);
    for (const value of values) {
      const members = all.filter((s) => s.adopted[key] === value);
      assert.deepEqual(national[field][value], {
        states: members.length,
        seats: sum(members.map((s) => s.seats)),
        drawing: sum(members.map((s) => s.effects.drawing)),
      }, `${field}.${value} follows from the states`);
    }
    // the drawing effects of the states add up; their sum need not equal national.effects.drawing (spec chapter 5)
    const entries = Object.values(national[field]);
    assert.equal(sum(entries.map((e) => e.states)), 44);
    assert.equal(sum(entries.map((e) => e.seats)), 429);
  }
});
```

`near`, `sum`, `isInt`, `isFraction`, `percentile` en `PLANS` bestaan al in het bestand.

- [ ] **Step 6: Run the contract test against the old results.json**

Run: `npm test`
Expected: `tests 31`, `pass 25`, `fail 6`: `every state has the fields of chapter 7`, `visible text in results.json has no em dashes` en de vier nieuwe tests. `site/data/results.json` heeft de nieuwe velden nog niet.

- [ ] **Step 7: Run the export**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/04_export.py`

Expected: dezelfde uitvoer als in taak 3.5 van het hoofdplan, met als laatste regel `Wrote site/data/results.json (44 states) and site/data/map.topojson (683,120 bytes)`. De geometrie verandert niet; `results.json` groeit van ongeveer 164 kB naar ongeveer 189 kB. Stopt het script met `sources_md`, dan verschillen `data/sources.md` en `config.yaml` (taak 5.11): herstel het verschil, niet de controle.

- [ ] **Step 8: Run the JavaScript tests**

Run: `npm test`
Expected: `tests 31`, `pass 31`, `fail 0`, `skipped 0`.

Zie de test falen op een kapotte kopie: bewaar het bestand, zet `national.redraw.change` op een verkeerde waarde en zet het daarna terug.

Run: `Copy-Item site\data\results.json "$env:TEMP\results.json"`

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import json, pathlib; p = pathlib.Path('site/data/results.json'); r = json.loads(p.read_text(encoding='utf-8')); r['national']['redraw']['change'] += 1; p.write_text(json.dumps(r), encoding='utf-8')"`

Run: `npm test`
Expected: `✖ redraws since 2024 add up per state and for the nation`, `fail 1`.

Run: `Copy-Item "$env:TEMP\results.json" site\data\results.json -Force` en daarna `npm test`
Expected: `pass 31`.

- [ ] **Step 9: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 10: Commit**

```powershell
git add pipeline/gerry/export.py tests/test_export.py site/js/contract.test.js site/data/results.json site/data/map.topojson
git commit -m "Export the majority thresholds, competitive districts, redraws and adoption to results.json"
```

### Task 5.14: de spec verwijst naar de nieuwe velden

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md` (hoofdstuk 3, 4, 5 en 7)

**Interfaces:**
- Consumes: de velden en bestanden van taak 5.1 tot en met 5.13.
- Produces: een spec die naar het uitbreidingsontwerp verwijst. De notentabel en de tabel met invulwaarden in hoofdstuk 5 blijven gelijk; `tests/test_export.py` leest ze. Hoofdstuk 6 blijft gelijk (taak 2.13 werkte daarin; het rapport van taak 5.8 staat daar niet in de lijst van controles van de methode, maar volgt uit hoofdstuk 5 van het uitbreidingsontwerp).

De spec is Nederlands en intern; houd de zinnen kort en zonder em-dashes.

- [ ] **Step 1: Edit the spec**

Hoofdstuk 3, in de tabel van bronnen, direct na de regel van CD118:

```
| [Census CD119](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip), `NationalCD119.txt` | De kaarten van de verkiezing van 2024, referentie voor de hertekeningen (uitbreidingsontwerp, hoofdstuk 2) | 29-07-2024 |
```

Hoofdstuk 4, onder "Per staat" in het deel over `config.yaml`, na de regel van `notes`:

```
- `adopted_by` (`Legislature`, `Commission`, `Court`) en `control` (`Republican`, `Democratic`, `Bipartisan`, `Nonpartisan`), verplicht, en `adopted_note`, optioneel: wie de huidige kaart aannam en onder welke politieke controle (uitbreidingsontwerp, hoofdstuk 4). Een rechter is altijd `Nonpartisan`, een parlement nooit. `check_sources_md` vergelijkt beide met de kolom "Adoption and control" van `data/sources.md`.
```

Hoofdstuk 4, in "Gegevens tussen de stappen", vervang de regel van `enacted_districts.parquet` door:

```
- `enacted_districts.parquet`: `state`, `map_id` (`enacted`, `mo_hb1`, `check_2022`, en `map_2024`: de kaart van de verkiezing van 2024 uit CD119), `method` (`block`, `whole_unit`), `district`, de stemkolommen.
```

Hoofdstuk 5, aan het eind (na de tabel met invulwaarden, vóór `## 6. Controles en tests`):

```
### Uitbreidingen

Vier rekenregels staan in `docs/superpowers/specs/2026-10-06-extensions-design.md`. Ze gebruiken dezelfde stembasis, dezelfde blokverdeling en dezelfde 5.000 plannen per staat:

- Meerderheidsdrempel (hoofdstuk 1): het landelijke aandeel dat Democraten nodig hebben voor 216 van de 429 districten bij een uniforme verschuiving. De zes staten met één zetel liggen vast: DE en VT Democratisch, AK, ND, SD en WY Republikeins. Exact voor Enacted, op een raster van 0,01 procentpunt voor de neutrale kaarten (de helft van de uitkomsten, met een band van 5% en 95%) en voor Proportional. De pijplijn stopt als een drempel 5 procentpunt of meer van het landelijke aandeel ligt.
- Hertekeningen sinds de verkiezing van 2024 (hoofdstuk 2): zetels op de kaarten van CD119 met dezelfde stemmen, het verschil met Enacted, en of de blokindeling veranderde.
- Concurrerende districten (hoofdstuk 3): een Democratisch aandeel van 45% tot en met 55%, op de vastgestelde kaart en over de plannen, landelijk door convolutie.
- Wie de kaart aannam en onder welke controle (hoofdstuk 4): per staat `adopted_by` en `control` uit `config.yaml`, landelijk per waarde het aantal staten, de zetels en de som van de tekeneffecten. Die som is niet het landelijke tekeneffect, om dezelfde reden als bij de landelijke band.
```

Hoofdstuk 7, in de tabel van `results.json`: zet aan het eind van de cel van `national`, na `` `single_seat`: lijst van {`postal`, `fips`, `name`} ``:

```
; uit het uitbreidingsontwerp (hoofdstuk 5): `majority`, `competitive`, `redraw`, `by_control`, `by_body`
```

en aan het eind van de cel van `states.<postcode>`, na de beschrijving van `blocked_map`:

```
; uit het uitbreidingsontwerp (hoofdstuk 5): `adopted` {`by`, `control`, `note`}, `competitive`, `redraw`
```

- [ ] **Step 2: Run the tests that read the spec**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -q`
Expected: `33 passed`. Een fout in `test_note_texts_match_the_spec_table` of `test_repo_config_note_lists_match_the_spec` betekent dat een tabel in hoofdstuk 5 is geraakt.

Run: `Select-String -Path docs\superpowers\specs\2026-10-05-gerrymandering-map-design.md -Pattern ([char]0x2014)`
Expected: geen uitvoer.

- [ ] **Step 3: Commit**

```powershell
git add docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md
git commit -m "Point the spec to the extensions design"
```

### Task 5.15: het MIT-bestand in het downloadplan

Begin na taak 5.14. De verwachte uitkomsten van taak 5.15 tot en met 5.21 (aantallen tests, de volgorde van de velden in `results.json`) gaan uit van de stand na taak 5.14. De aantallen `passed` komen uit de proefrun, met precies de tests uit dit plan. Bij de uitvoering van de eerdere taken kregen enkele testbestanden extra tests (onder meer `tests/test_metrics.py`, `tests/test_metrics_step.py`, `tests/test_config.py` en `tests/test_join.py`); tel die bij `passed` op. Het aantal falende tests en hun namen moeten wel kloppen.

**Files:**
- Modify: `pipeline/config.yaml` (bron `medsl_president`)
- Modify: `pipeline/gerry/config.py` (`_SOURCE_KEYS`)
- Modify: `pipeline/gerry/sources.py` (`plan_downloads`)
- Modify: `tests/test_config.py`, `tests/test_sources.py`, `tests/test_download_script.py`
- Modify (na de download): `data/manifest.json`

**Interfaces:**
- Consumes: `plan_downloads(cfg, dv_files)` en `fetch` (hoofdplan, taak 1.1, 1.2, 1.12); `load_config()` (taak 0.4).
- Produces: bron `cfg.sources["medsl_president"]`; een downloadplan van 143 bestanden met `medsl/1976-2024-president.csv` als laatste; een regel voor dat bestand in `data/manifest.json`.

De databron (uitbreidingsontwerp, hoofdstuk 7): MIT Election Data and Science Lab, "U.S. President 1976-2024", Harvard Dataverse doi:10.7910/DVN/42MVDX, versie 10.1 van 4 september 2026. Het bestand `1976-2024-president.csv` is een CSV die Dataverse niet heeft ingelezen: 514.108 bytes, md5 `405af83db7625cb35d8c19a5ebe029ff`, bestands-id 13887042. Licentie CC0 1.0. De bestandslijst van die versie: `https://dataverse.harvard.edu/api/datasets/:persistentId/versions/10.1/files?persistentId=doi:10.7910/DVN/42MVDX`. Waarom een directe link: "Keuzes in dit plan", punt 10. Over de titel: open punt 1 bij de Senaat.

- [ ] **Step 1: Write the failing tests**

Zet in `tests/test_config.py` `medsl_president` in de lijst van bronnen:

```python
SOURCE_KEYS = ("dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
               "tiger_gpkg", "tiger_mo_cd119", "cb_states", "medsl_president")
```

Voeg onderaan `tests/test_config.py` toe:

```python


def test_real_config_has_the_statewide_presidential_votes(cfg):
    # extensions design, chapter 7: MIT Election Data and Science Lab, U.S. President 1976-2024,
    # doi:10.7910/DVN/42MVDX, version 10.1, file 1976-2024-president.csv (Dataverse file 13887042)
    assert cfg.sources["medsl_president"] == "https://dataverse.harvard.edu/api/access/datafile/13887042"
```

Zet in `tests/test_sources.py` in het woordenboek `SOURCES` na de regel van `cb_states`:

```python
    "medsl_president": "https://dataverse.harvard.edu/api/access/datafile/13887042",
```

en in `test_plan_downloads_follows_the_data_dir_layout` na de verwachte download van `cb_2025_us_state_500k.zip`, als laatste:

```python
        # statewide presidential votes for the Senate block (extensions design, chapter 7)
        Download("medsl/1976-2024-president.csv", SOURCES["medsl_president"], None, None),
```

Voeg in `tests/test_download_script.py`, in `test_state_of_reads_the_postal_code_from_the_key`, na `assert script.state_of("census/cd120.zip") is None` toe:

```python
    # one file for all states: --only keeps it (Senate block, extensions design chapter 7)
    assert script.state_of("medsl/1976-2024-president.csv") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_sources.py tests/test_download_script.py -q`
Expected: `4 failed, 72 passed`: `test_minimal_config_loads_with_types` (`ConfigError: sources: unknown keys ['medsl_president']`), `test_invalid_config_raises[sources.cd120-None-missing keys]` (dezelfde melding in plaats van `missing keys`), `test_real_config_has_the_statewide_presidential_votes` (`KeyError: 'medsl_president'`) en `test_plan_downloads_follows_the_data_dir_layout` (de download van het MIT-bestand ontbreekt). De nieuwe regel in `tests/test_download_script.py` slaagt al: `state_of` geeft `None` voor elke map die niet per staat is. Hij legt vast dat `--only` het bestand meeneemt.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/config.py`:

```python
_SOURCE_KEYS = (
    "dataverse_api", "cd118", "cd119", "cd120", "pl94171", "census_vest",
    "tiger_gpkg", "tiger_mo_cd119", "cb_states", "medsl_president",
)
```

In `pipeline/config.yaml`, onder `sources:` direct na de regel van `cb_states`:

```yaml
  # Senate block (extensions design, chapter 7): statewide presidential votes of the six single-seat states.
  # MIT Election Data and Science Lab, "U.S. President 1976-2024", doi:10.7910/DVN/42MVDX, version 10.1,
  # file 1976-2024-president.csv, CC0 1.0. A Dataverse file id always serves the same file.
  medsl_president: https://dataverse.harvard.edu/api/access/datafile/13887042
```

In `pipeline/gerry/sources.py`, in `plan_downloads`, direct na de lus over `("tiger_gpkg", "tiger_mo_cd119", "cb_states")`:

```python
    # statewide presidential votes for the Senate block (extensions design, chapter 7): one Dataverse file,
    # checked against data/manifest.json like the Census files
    plan.append(Download("medsl/1976-2024-president.csv", src["medsl_president"], None, None))
```

`01_download.py` verandert niet: `state_of` rekent de map `medsl/` tot de bestanden van alle staten.

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_config.py tests/test_sources.py tests/test_download_script.py -q`
Expected: `76 passed`.

- [ ] **Step 5: Download the file**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/01_download.py`

Het script controleert de checksum van elk bestand dat er al is (enkele minuten) en haalt alleen het MIT-bestand op. Dataverse stuurt de aanvraag door naar Amazon S3; `fetch` volgt de doorverwijzing. Expected: als laatste bestand `[143/143] medsl/1976-2024-president.csv downloaded (0.5 MB)`, alle andere regels `present`, en als slot `143 files: 1 downloaded, 142 present, 2,543,425,304 bytes, ...` en `Manifest ...\data\manifest.json has entries for 143 of these files`.

Run: `git diff data/manifest.json`
Expected: één nieuwe vermelding, als laatste (na de regel van de vorige laatste vermelding komt een komma):

```json
  "medsl/1976-2024-president.csv": {
    "url": "https://dataverse.harvard.edu/api/access/datafile/13887042",
    "size": 514108,
    "sha256": "9936410a6dd4ecc8be7fe202c6dff5b5f8fee59d88f35ab542ed12879941dcb7"
  }
```

- [ ] **Step 6: Compare with the md5 that Dataverse publishes**

Run: `.venv\Scripts\python -c "import hashlib, sys; sys.path.insert(0, 'pipeline'); from gerry.config import data_dir; print(hashlib.md5((data_dir() / 'medsl' / '1976-2024-president.csv').read_bytes()).hexdigest())"`
Expected: `405af83db7625cb35d8c19a5ebe029ff`.

Is de grootte, de sha256 of de md5 anders, stop dan: achter bestands-id 13887042 staat niet meer het bestand van versie 10.1. Vraag de eigenaar voordat je verdergaat.

- [ ] **Step 7: Commit**

```powershell
git add pipeline/config.yaml pipeline/gerry/config.py pipeline/gerry/sources.py tests/test_config.py tests/test_sources.py tests/test_download_script.py data/manifest.json
git commit -m "Download the statewide presidential results of the MIT Election Data and Science Lab"
```

### Task 5.16: de stemmen van de zes staten met één zetel

**Files:**
- Create: `pipeline/gerry/president.py`
- Create: `tests/test_president.py`

**Interfaces:**
- Consumes: `data_dir()` (taak 0.4); `medsl/1976-2024-president.csv` (taak 5.15).
- Produces: `ELECTIONS`, `NOMINEES`, `PARTY_LINES`, `class PresidentError(ValueError)`; `read_president(path) -> pd.DataFrame` met `year`, `state_po`, `candidate`, `party_detailed` en `writein` als tekst en `candidatevotes` als geheel getal; `two_party_votes(table, postals) -> pd.DataFrame` met een rij per postcode, in de gegeven volgorde, en de kolommen `state`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d` en `r` (gehele getallen).

Welke rijen tellen. Het codeboek van de dataset (`codebook-us-president-1976-2020.md`) zegt: een kandidaat op meer partijlijnen heeft een rij per lijn, en voor tweepartijtotalen tel je die rijen op; rijen met `writein` waar zijn stemmen voor write-in-kandidaten. Daaruit volgt:

- Democratisch zijn alle rijen van de Democratische kandidaat van dat jaar, op elke partijlijn: 2016 `CLINTON, HILLARY`, 2020 `BIDEN, JOSEPH R. JR`. Republikeins idem: `TRUMP, DONALD J.` in beide jaren. De namen staan in de code zoals in het bestand.
- Rijen met `writein` waar tellen nooit mee, ook niet als ze de naam van een kandidaat dragen (in het bestand: Maryland 2016). Rijen voor andere kandidaten en voor blanco, ongeldige, over- en ondervotes (`BLANK VOTE`, `OVERVOTES` en dergelijke) tellen niet mee.
- De lezer stopt met `PresidentError` als een kandidaat niet precies één rij heeft op de lijn van zijn partij (`DEMOCRAT` of `REPUBLICAN`), als een staat in een van beide jaren geen rijen heeft, of als `writein` in een rij van de staat iets anders is dan TRUE of FALSE (hoofdletters maken niet uit; versie 10.1 schrijft `True` en `False`).

In de zes staten heeft elke kandidaat in beide jaren precies één rij, op de lijn van zijn partij, zonder write-in-rij. Andere partijlijnen komen alleen elders voor (New York 2016).

De controle. De getallen moeten gelijk zijn aan de officiële uitslagen van de staten:

| Staat | 2016 Clinton | 2016 Trump | 2020 Biden | 2020 Trump |
|---|---|---|---|---|
| AK | 116.454 | 163.387 | 153.778 | 189.951 |
| DE | 235.603 | 185.127 | 296.268 | 200.603 |
| ND | 93.758 | 216.794 | 114.902 | 235.595 |
| SD | 117.458 | 227.721 | 150.471 | 261.043 |
| VT | 178.573 | 95.369 | 242.820 | 112.704 |
| WY | 55.973 | 174.419 | 73.491 | 193.559 |

Bronnen, nagegaan op 7 oktober 2026:

- FEC, "Federal Elections 2016", tabel "2016 Presidential General Election Results" (`https://www.fec.gov/resources/cms-content/documents/federalelections2016.pdf`), en FEC, "Official 2020 Presidential General Election Results" (`https://www.fec.gov/resources/cms-content/documents/2020presgeresults.pdf`). De FEC neemt de officiële uitslagen over van de verkiezingsdiensten van de staten. Alle 24 getallen zijn gelijk.
- De Certificates of Ascertainment van de staten, bij de National Archives: `https://www.archives.gov/files/electoral-college/2016/ascertainment-alaska.pdf`, en zo verder met `delaware`, `north-dakota`, `south-dakota`, `vermont` en `wyoming`, en voor 2020 met `2020` in het pad. Gelijk, behalve Delaware 2020: dat certificaat noemt 295.933 en 200.327 (open punt 2 bij de Senaat).
- Delaware Department of Elections, "2020 General Election Report", Official Results (`https://elections.delaware.gov/reports/GE2020.html`; de site weigert aanvragen van buiten de VS, kopie in het Internet Archive: `https://web.archive.org/web/20260919030702/https://elections.delaware.gov/reports/GE2020.html`): Biden 296.268, Trump 200.603.
- Wyoming Secretary of State, "Statewide Candidates Official Summary" (`https://sos.wyo.gov/Elections/Docs/2016/Results/General/2016_General_Statewide_Candidates_Summary.pdf` en `https://sos.wyo.gov/Elections/Docs/2020/Results/General/2020_General_Statewide_Candidates_Summary.pdf`): gelijk.

- [ ] **Step 1: Write the failing test**

Maak `tests/test_president.py`:

```python
"""Tests for gerry.president: statewide presidential votes from the MIT Election Data and Science Lab."""
import pytest

from gerry.config import data_dir
from gerry.president import PresidentError, read_president, two_party_votes

HEADER = ("year,state,state_po,state_fips,state_cen,state_ic,office,candidate,party_detailed,writein,"
          "candidatevotes,totalvotes,version,notes,party_simplified\n")


def row(year, postal, candidate, party, writein, votes):
    """One line of the MIT file; the columns the reader does not use get placeholder values."""
    return f'{year},STATE,{postal},99,99,99.0,US PRESIDENT,"{candidate}",{party},{writein},{votes},0,20210113,,OTHER\n'


def write(tmp_path, rows):
    path = tmp_path / "1976-2024-president.csv"
    path.write_text(HEADER + "".join(rows), encoding="utf-8")
    return path


AA = [
    # 2016: Clinton on two party lines and Trump on two, as in New York in the real file
    row(2016, "AA", "CLINTON, HILLARY", "DEMOCRAT", "False", 100),
    row(2016, "AA", "CLINTON, HILLARY", "WORKING FAMILIES", "False", 10),
    row(2016, "AA", "TRUMP, DONALD J.", "REPUBLICAN", "False", 90),
    row(2016, "AA", "TRUMP, DONALD J.", "CONSERVATIVE", "False", 5),
    # not counted: another candidate, blank ballots, the write-in total
    row(2016, "AA", "JOHNSON, GARY", "LIBERTARIAN", "False", 20),
    row(2016, "AA", "BLANK VOTE", "", "False", 3),
    row(2016, "AA", "", "", "True", 7),
    row(2020, "AA", "BIDEN, JOSEPH R. JR", "DEMOCRAT", "False", 120),
    row(2020, "AA", "TRUMP, DONALD J.", "REPUBLICAN", "False", 80),
    # a write-in row with a nominee's name does not count either (Maryland 2016 in the real file)
    row(2020, "AA", "BIDEN, JOSEPH R. JR", "DEMOCRAT", "True", 9),
    # other years and other states are not read
    row(2012, "AA", "OBAMA, BARACK H.", "DEMOCRAT", "False", 999),
    row(2020, "BB", "BIDEN, JOSEPH R. JR", "DEMOCRAT", "False", 50),
]


def test_two_party_votes_adds_up_the_party_lines_of_each_nominee(tmp_path):
    votes = two_party_votes(read_president(write(tmp_path, AA)), ["AA"])
    # 2016: Clinton 100 + 10 = 110, Trump 90 + 5 = 95; 2020: Biden 120, Trump 80
    # d = 110 + 120 = 230, r = 95 + 80 = 175
    assert votes.to_dict("records") == [{"state": "AA", "d_pre_16": 110, "r_pre_16": 95, "d_pre_20": 120,
                                         "r_pre_20": 80, "d": 230, "r": 175}]


def test_two_party_votes_reads_writein_in_capitals_too(tmp_path):
    # the codebook writes TRUE and FALSE; version 10.1 of the file writes True and False
    rows = [line.replace(",False,", ",FALSE,").replace(",True,", ",TRUE,") for line in AA]
    assert two_party_votes(read_president(write(tmp_path, rows)), ["AA"])["d"].tolist() == [230]


def test_two_party_votes_keeps_the_order_of_the_states(tmp_path):
    bb = [row(2016, "BB", "CLINTON, HILLARY", "DEMOCRAT", "False", 1),
          row(2016, "BB", "TRUMP, DONALD J.", "REPUBLICAN", "False", 2),
          row(2020, "BB", "TRUMP, DONALD J.", "REPUBLICAN", "False", 4)]
    votes = two_party_votes(read_president(write(tmp_path, AA + bb)), ["BB", "AA"])
    # BB: 1 + 50 Democratic, 2 + 4 Republican
    assert votes[["state", "d", "r"]].values.tolist() == [["BB", 51, 6], ["AA", 230, 175]]


def test_two_party_votes_needs_both_elections(tmp_path):
    rows = [line for line in AA if not line.startswith("2016,")]
    with pytest.raises(PresidentError, match="AA 2016"):
        two_party_votes(read_president(write(tmp_path, rows)), ["AA"])


def test_two_party_votes_needs_the_nominee_on_the_party_line(tmp_path):
    # Biden only on another line: the reader does not guess which row is the Democratic one
    rows = [line.replace('"BIDEN, JOSEPH R. JR",DEMOCRAT,False', '"BIDEN, JOSEPH R. JR",DEMOCRATIC-NPL,False')
            for line in AA]
    with pytest.raises(PresidentError, match="AA 2020: BIDEN, JOSEPH R. JR has 0 rows on the DEMOCRAT line"):
        two_party_votes(read_president(write(tmp_path, rows)), ["AA"])


def test_two_party_votes_stops_on_a_second_row_on_the_party_line(tmp_path):
    rows = AA + [row(2020, "AA", "TRUMP, DONALD J.", "REPUBLICAN", "False", 1)]
    with pytest.raises(PresidentError, match="TRUMP, DONALD J. has 2 rows on the REPUBLICAN line"):
        two_party_votes(read_president(write(tmp_path, rows)), ["AA"])


def test_two_party_votes_needs_a_known_writein_value(tmp_path):
    # Maryland 2020 has three rows with an empty writein; in a state the Senate block reads, the reader stops
    rows = AA + [row(2020, "AA", "RALEY, ALBERT", "", "", 32)]
    with pytest.raises(PresidentError, match="writein"):
        two_party_votes(read_president(write(tmp_path, rows)), ["AA"])


PRESIDENT_FILE = data_dir() / "medsl" / "1976-2024-president.csv"
# Official results, Democratic and Republican votes: 2016 (Clinton, Trump) and 2020 (Biden, Trump).
# FEC, Federal Elections 2016 and Official 2020 Presidential General Election Results, both compiled from the
# state election offices; the same numbers as the states' certificates of ascertainment (National Archives),
# except Delaware 2020, see the plan of the extensions, open points of the Senate block.
OFFICIAL = {
    "AK": (116454, 163387, 153778, 189951),
    "DE": (235603, 185127, 296268, 200603),
    "ND": (93758, 216794, 114902, 235595),
    "SD": (117458, 227721, 150471, 261043),
    "VT": (178573, 95369, 242820, 112704),
    "WY": (55973, 174419, 73491, 193559),
}


@pytest.mark.data
@pytest.mark.skipif(not PRESIDENT_FILE.exists(), reason="needs medsl/1976-2024-president.csv")
def test_single_seat_states_match_the_official_results():
    votes = two_party_votes(read_president(PRESIDENT_FILE), sorted(OFFICIAL)).set_index("state")
    for postal, (d16, r16, d20, r20) in OFFICIAL.items():
        got = votes.loc[postal]
        assert (got["d_pre_16"], got["r_pre_16"], got["d_pre_20"], got["r_pre_20"]) == (d16, r16, d20, r20), postal
        assert (got["d"], got["r"]) == (d16 + d20, r16 + r20), postal
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_president.py -q`
Expected: collection error `ModuleNotFoundError: No module named 'gerry.president'`.

- [ ] **Step 3: Write minimal implementation**

Maak `pipeline/gerry/president.py`:

```python
"""Statewide presidential votes from the MIT Election Data and Science Lab, "U.S. President 1976-2024"
(Harvard Dataverse, doi:10.7910/DVN/42MVDX, version 10.1). The Senate block (extensions design, chapter 7)
takes the votes of the six single-seat states from it."""
from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pandas as pd

# The elections of the vote basis (config.yaml: pre_16, pre_20) and each party's nominee, named as in the file.
ELECTIONS = {"pre_16": "2016", "pre_20": "2020"}
NOMINEES = {
    "2016": {"d": "CLINTON, HILLARY", "r": "TRUMP, DONALD J."},
    "2020": {"d": "BIDEN, JOSEPH R. JR", "r": "TRUMP, DONALD J."},
}
PARTY_LINES = {"d": "DEMOCRAT", "r": "REPUBLICAN"}
COLUMNS = ["year", "state_po", "candidate", "party_detailed", "writein", "candidatevotes"]


class PresidentError(ValueError):
    """The file lacks the rows the Senate block needs for a state and an election."""


def read_president(path: Path) -> pd.DataFrame:
    """The columns of the MIT file that the Senate block uses, as text; candidatevotes as integers."""
    table = pd.read_csv(path, usecols=COLUMNS, dtype=str, keep_default_na=False, engine="c")
    table["candidatevotes"] = table["candidatevotes"].astype("int64")
    return table


def two_party_votes(table: pd.DataFrame, postals: Iterable[str]) -> pd.DataFrame:
    """Democratic and Republican votes per state, in the order of `postals`: columns state, d_pre_16, r_pre_16,
    d_pre_20, r_pre_20, d and r. A party's votes are the rows of its nominee that are not write-ins, on every
    party line: the codebook gives a candidate one row per party line, to be added up for two-party totals.
    Write-in rows hold votes for write-in candidates and never count. The nominee must have exactly one row
    on the party's own line (DEMOCRAT or REPUBLICAN); otherwise PresidentError."""
    rows = []
    for postal in postals:
        out = {"state": postal}
        for election, year in ELECTIONS.items():
            part = table[(table["state_po"] == postal) & (table["year"] == year)]
            if part.empty:
                raise PresidentError(f"{postal} {year}: no rows in the file")
            writein = part["writein"].str.upper()
            if not writein.isin(["TRUE", "FALSE"]).all():
                raise PresidentError(f"{postal} {year}: writein must be TRUE or FALSE in every row")
            ballot = part[writein == "FALSE"]
            for party, nominee in NOMINEES[year].items():
                mine = ballot[ballot["candidate"] == nominee]
                own_line = int((mine["party_detailed"] == PARTY_LINES[party]).sum())
                if own_line != 1:
                    raise PresidentError(f"{postal} {year}: {nominee} has {own_line} rows on the "
                                         f"{PARTY_LINES[party]} line, expected 1")
                out[f"{party}_{election}"] = int(mine["candidatevotes"].sum())
        out["d"] = sum(out[f"d_{election}"] for election in ELECTIONS)
        out["r"] = sum(out[f"r_{election}"] for election in ELECTIONS)
        rows.append(out)
    columns = ["state", *(f"{party}_{election}" for election in ELECTIONS for party in ("d", "r")), "d", "r"]
    return pd.DataFrame(rows, columns=columns)
```

`read_president` gebruikt de C-engine van pandas met `dtype=str`, zoals de andere lezers.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_president.py -q`
Expected: `8 passed` (zonder datamap `7 passed, 1 skipped`).

Faalt `test_single_seat_states_match_the_official_results`, verander dan nooit de verwachte getallen. Noteer welke staat, welk jaar en welk getal afwijkt, en vraag de eigenaar.

- [ ] **Step 5: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 6: Commit**

```powershell
git add pipeline/gerry/president.py tests/test_president.py
git commit -m "Read the 2016 and 2020 presidential votes of the single-seat states"
```

### Task 5.17: 02_join schrijft de stemmen van de zes staten

**Files:**
- Modify: `pipeline/02_join.py`
- Modify: `tests/test_join.py`
- Create (gegenereerd, niet in git): `data/interim/single_seat_votes.parquet`

**Interfaces:**
- Consumes: `read_president`, `two_party_votes`, `PresidentError` (taak 5.16); `cfg.at_large` (hoofdplan, taak 0.4).
- Produces: in `02_join.py` `single_seat_votes(cfg, root) -> pd.DataFrame` (de uitvoer van `two_party_votes` voor de staten met één zetel, gesorteerd op postcode); `data/interim/single_seat_votes.parquet` met de kolommen `state`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d` en `r`. `02_join` leest het MIT-bestand vóór de 44 staten en schrijft het tussenbestand bij elke run, ook met `--states`.

- [ ] **Step 1: Write the failing test**

Zet in `tests/test_join.py` bij de imports, na `from pathlib import Path`:

```python
from types import SimpleNamespace
```

en vervang `from gerry.config import data_dir, load_config` door:

```python
from gerry.config import AtLargeState, data_dir, load_config
```

Voeg direct vóór `def files_of(postal, *extra):` toe:

```python
# Senate block (extensions design, chapter 7): two single-seat states in the layout of the MIT file
MEDSL = """year,state,state_po,state_fips,state_cen,state_ic,office,candidate,party_detailed,writein,candidatevotes,totalvotes,version,notes,party_simplified
2016,WYOMING,WY,56,83,68.0,US PRESIDENT,"CLINTON, HILLARY",DEMOCRAT,False,10,0,20210113,,DEMOCRAT
2016,WYOMING,WY,56,83,68.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,30,0,20210113,,REPUBLICAN
2020,WYOMING,WY,56,83,68.0,US PRESIDENT,"BIDEN, JOSEPH R. JR",DEMOCRAT,False,20,0,20210113,,DEMOCRAT
2020,WYOMING,WY,56,83,68.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,40,0,20210113,,REPUBLICAN
2016,DELAWARE,DE,10,51,11.0,US PRESIDENT,"CLINTON, HILLARY",DEMOCRAT,False,50,0,20210113,,DEMOCRAT
2016,DELAWARE,DE,10,51,11.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,40,0,20210113,,REPUBLICAN
2020,DELAWARE,DE,10,51,11.0,US PRESIDENT,"BIDEN, JOSEPH R. JR",DEMOCRAT,False,60,0,20210113,,DEMOCRAT
2020,DELAWARE,DE,10,51,11.0,US PRESIDENT,"TRUMP, DONALD J.",REPUBLICAN,False,30,0,20210113,,REPUBLICAN
"""


def test_single_seat_votes_reads_the_single_seat_states_in_order(tmp_path):
    (tmp_path / "medsl").mkdir()
    (tmp_path / "medsl" / "1976-2024-president.csv").write_text(MEDSL, encoding="utf-8")
    cfg = SimpleNamespace(at_large={"WY": AtLargeState("WY", "Wyoming", "56"),
                                    "DE": AtLargeState("DE", "Delaware", "10")})
    votes = load_script().single_seat_votes(cfg, tmp_path)
    # sorted by postal code: DE 50 + 60 Democratic, 40 + 30 Republican; WY 10 + 20 and 30 + 40
    assert votes[["state", "d", "r"]].values.tolist() == [["DE", 110, 70], ["WY", 30, 70]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_join.py -q`
Expected: `1 failed, 6 passed`, met `AttributeError: module 'join_script' has no attribute 'single_seat_votes'`. De drie tests op echte data (NV, AL, OR) duren samen ongeveer een minuut; zonder datamap: `1 failed, 3 passed, 3 skipped`.

- [ ] **Step 3: Write minimal implementation**

In `pipeline/02_join.py`, vervang de laatste zin van de docstring:

```python
Without --states all states are joined and the interim files are rewritten. With --states only those
states are joined and their rows replace the earlier rows in the interim files. Both rewrite the votes
of the single-seat states for the Senate block (extensions design, chapter 7).
"""
```

Voeg na de import uit `gerry.ensemble` toe:

```python
from gerry.president import PresidentError, read_president, two_party_votes
```

Voeg direct vóór `write_outputs` toe:

```python
def single_seat_votes(cfg, root: Path) -> pd.DataFrame:
    """Democratic and Republican votes of 2016 and 2020 in the single-seat states, sorted by postal code, from
    the statewide file of the MIT Election Data and Science Lab (Senate block, extensions design chapter 7)."""
    return two_party_votes(read_president(root / "medsl" / "1976-2024-president.csv"), sorted(cfg.at_large))
```

In `main`, vervang

```python
    root = data_dir()
    results = {}
```

door:

```python
    root = data_dir()
    try:
        single = single_seat_votes(cfg, root)
    except PresidentError as exc:
        print(f"ERROR single-seat states: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(f"ERROR missing {exc.filename}; run pipeline/01_download.py first", file=sys.stderr)
        return 1
    results = {}
```

en vervang

```python
    write_outputs(results, cfg, interim_dir(), partial=bool(args.states))
```

door:

```python
    write_outputs(results, cfg, interim_dir(), partial=bool(args.states))
    single.to_parquet(interim_dir() / "single_seat_votes.parquet", index=False)
    print("Single-seat states, Democratic share of the 2016 and 2020 presidential votes: "
          + ", ".join(f"{s.state} {s.d / (s.d + s.r):.4f}" for s in single.itertuples(index=False)))
```

Het bestand staat vóór de lus over de staten, zodat een ontbrekend of afwijkend MIT-bestand de vijf minuten van de join niet verspilt.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_join.py -q`
Expected: `7 passed`.

- [ ] **Step 5: Run the join**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/02_join.py`

Dit duurt ongeveer vijf minuten. Expected: dezelfde regels als in taak 5.3, dan precies

```
Single-seat states, Democratic share of the 2016 and 2020 presidential votes: AK 0.4334, DE 0.5796, ND 0.3156, SD 0.3541, VT 0.6694, WY 0.2603
```

en als laatste `Wrote 44 states to ...\data\interim`.

- [ ] **Step 6: Check the interim file**

Run: `.venv\Scripts\python -c "import pandas as pd; print(pd.read_parquet('data/interim/single_seat_votes.parquet').to_string(index=False))"`

Expected:

```
state  d_pre_16  r_pre_16  d_pre_20  r_pre_20      d      r
   AK    116454    163387    153778    189951 270232 353338
   DE    235603    185127    296268    200603 531871 385730
   ND     93758    216794    114902    235595 208660 452389
   SD    117458    227721    150471    261043 267929 488764
   VT    178573     95369    242820    112704 421393 208073
   WY     55973    174419     73491    193559 129464 367978
```

`03_metrics` leest het bestand nog niet; dat volgt in taak 5.19.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/02_join.py tests/test_join.py
git commit -m "Write the votes of the single-seat states to the interim files"
```

### Task 5.18: metrics.py, de drempel voor de Senaat

**Files:**
- Modify: `pipeline/gerry/metrics.py` (import bovenaan, functie onderaan)
- Modify: `tests/test_metrics.py` (onderaan toevoegen)

**Interfaces:**
- Consumes: `seats_at_swing` en `enacted_threshold` (taak 5.4).
- Produces: `senate_majority(votes, needed, around=2) -> dict` met, in deze volgorde, `base_share` (het landelijke aandeel over alle staten in `votes`), `states_needed`, `share` (`base_share` plus 0,5 min het `needed`-de hoogste staatsaandeel), `states_at_base`, `seats_at_base` (twee per staat) en `tipping`: de staten op plaats `needed - around` tot en met `needed + around`, van hoog naar laag aandeel, als lijst van {`postal`, `share`}. `ValueError` als die plaatsen niet allemaal bestaan.

Uitbreidingsontwerp, hoofdstuk 7: uniforme verschuiving op de staatsaandelen, zoals in hoofdstuk 1 voor de districten. Een staat precies op 50% telt niet ("Keuzes in dit plan", punt 13).

- [ ] **Step 1: Write the failing test**

Voeg onderaan `tests/test_metrics.py` toe:

```python


# Task 5.18: the Senate block

# five made-up states with their (Democratic, Republican) votes
SENATE_VOTES = {"AA": (600, 400), "BB": (300, 700), "CC": (550, 450), "DD": (480, 520), "EE": (450, 550)}


def test_senate_majority_hand_example():
    res = m.senate_majority(SENATE_VOTES, 3, around=1)
    # national share: (600 + 300 + 550 + 480 + 450) / 5000 = 2380 / 5000 = 0.476
    assert res["base_share"] == pytest.approx(0.476)
    # shares from high to low: AA 0.6, CC 0.55, DD 0.48, EE 0.45, BB 0.3; the third is 0.48
    # threshold 0.476 + 0.5 - 0.48 = 0.496
    assert res["share"] == pytest.approx(0.496)
    assert res["states_needed"] == 3
    # at the real votes AA and CC lie above one half: 2 states, 4 seats
    assert (res["states_at_base"], res["seats_at_base"]) == (2, 4)
    # the states ranked 3 - 1 to 3 + 1
    assert [t["postal"] for t in res["tipping"]] == ["CC", "DD", "EE"]
    assert [t["share"] for t in res["tipping"]] == pytest.approx([0.55, 0.48, 0.45])
    assert list(res) == ["base_share", "states_needed", "share", "states_at_base", "seats_at_base", "tipping"]


def test_senate_majority_lists_two_ranks_on_each_side_by_default():
    # needed 3 of 5 states: ranks 1 to 5, every state from high to low
    res = m.senate_majority(SENATE_VOTES, 3)
    assert [t["postal"] for t in res["tipping"]] == ["AA", "CC", "DD", "EE", "BB"]


def test_senate_majority_a_state_on_one_half_does_not_count():
    # shares 0.75, 0.625, 0.5 and 0.375 (binary fractions, exact); national share 12 / 22
    votes = {"AA": (3, 1), "BB": (5, 3), "CC": (1, 1), "DD": (3, 5)}
    res = m.senate_majority(votes, 3, around=1)
    # CC sits on one half and does not count at the real votes
    assert (res["states_at_base"], res["seats_at_base"]) == (2, 4)
    # the third highest share is 0.5: swing 0, so the threshold is the national share itself
    assert res["share"] == res["base_share"] == pytest.approx(12 / 22)
    assert [t["postal"] for t in res["tipping"]] == ["BB", "CC", "DD"]


def test_senate_majority_orders_equal_shares_by_postal_code():
    # AA and CC both 2 / 5 = 0.4, BB 0.6; national share (2 + 3 + 2) / 15 = 7 / 15
    res = m.senate_majority({"CC": (2, 3), "BB": (3, 2), "AA": (2, 3)}, 2, around=1)
    assert [t["postal"] for t in res["tipping"]] == ["BB", "AA", "CC"]
    # the second highest share is 0.4: 7 / 15 + 0.5 - 0.4
    assert res["share"] == pytest.approx(7 / 15 + 0.1)


def test_senate_majority_needs_the_ranks_around_the_threshold():
    # needed 2 of 2 states with two ranks on each side: ranks 0 to 4 do not all exist
    with pytest.raises(ValueError, match="ranks"):
        m.senate_majority({"AA": (1, 2), "BB": (2, 1)}, 2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `5 failed, 58 passed`, met `AttributeError: module 'gerry.metrics' has no attribute 'senate_majority'`.

- [ ] **Step 3: Write minimal implementation**

Vervang in `pipeline/gerry/metrics.py` de regel `from typing import Callable, Sequence` door:

```python
from typing import Callable, Mapping, Sequence
```

Voeg onderaan `pipeline/gerry/metrics.py` toe:

```python


# --- Senate block (extensions design, chapter 7) ----------------------------------------------------


def senate_majority(votes: Mapping[str, tuple[float, float]], needed: int, around: int = 2) -> dict:
    """Each state's two senators go to the party with more of its two-party vote. `votes` maps every state to its
    (Democratic, Republican) votes. Under a uniform swing on the state shares Democrats need `needed` states: the
    threshold is the national share plus 0.5 - h, with h the needed-th highest state share (exact, as
    enacted_threshold). A state exactly on one half does not count. Also the states and seats at the real votes,
    and the states ranked needed - around to needed + around, from high to low (equal shares by postal code)."""
    postals = sorted(votes)
    first, last = needed - around, needed + around
    if not 1 <= first <= last <= len(postals):
        raise ValueError(f"ranks {first} to {last} must lie within 1..{len(postals)}")
    d = np.array([votes[p][0] for p in postals], dtype=float)
    r = np.array([votes[p][1] for p in postals], dtype=float)
    shares = d / (d + r)
    base = float(d.sum() / (d + r).sum())
    ranked = sorted(range(len(postals)), key=lambda i: (-shares[i], postals[i]))
    states = int(seats_at_swing(shares, 0.0))
    return {
        "base_share": base,
        "states_needed": needed,
        "share": base + enacted_threshold(shares, needed),
        "states_at_base": states,
        "seats_at_base": 2 * states,
        "tipping": [{"postal": postals[i], "share": float(shares[i])} for i in ranked[first - 1:last]],
    }
```

`d / (d + r)` geeft voor een staat hetzelfde getal als `d_share` in `state_metrics` (dezelfde twee optellingen en één deling in dubbele precisie); de contracttest van taak 5.20 rekent daarop.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics.py -q`
Expected: `63 passed`.

- [ ] **Step 5: Commit**

```powershell
git add pipeline/gerry/metrics.py tests/test_metrics.py
git commit -m "Add the Senate threshold under a uniform swing on the state shares"
```

### Task 5.19: 03_metrics, het blok over de Senaat

**Files:**
- Modify: `pipeline/03_metrics.py`
- Modify: `tests/test_metrics_step.py`, `tests/test_metrics_data.py`

**Interfaces:**
- Consumes: `senate_majority` (taak 5.18); `data/interim/single_seat_votes.parquet` (taak 5.17); `compute` met het woordenboek `votes` (taak 5.7) en `by_control` en `by_body` (taak 5.12); `_interim` en `_small_house` in `tests/test_metrics_step.py` (taak 5.6 en 5.7).
- Produces: in `03_metrics.py` `SENATE_STATES = 50`, `SENATE_STATES_NEEDED = 26`, `read_single_seat_votes(idir, at_large) -> dict[str, tuple[float, float]]`, `national_senate(votes) -> dict`. `compute` zet `senate` onder `national` in `metrics.json`, met de velden van `senate_majority`. Nieuwe controle: `CheckError("senate_states", "US", ...)` als `single_seat_votes.parquet` andere staten noemt dan `config.yaml`, of als er geen 50 staten zijn; `CheckError("interim_files", "US", ...)` als het bestand ontbreekt.

De stemmen per staat: voor de 44 staten `d_total` en `r_total` uit de eenheden, dezelfde getallen als achter `d_share` en *V0*; voor de zes staten met één zetel `d` en `r` uit `single_seat_votes.parquet`.

- [ ] **Step 1: Write the failing tests**

Voeg in `tests/test_metrics_step.py`, in `_interim`, direct vóór de regel `return SimpleNamespace(...)` toe:

```python
    # the single-seat state WY, 2016 and 2020 added up (02_join.py, Task 5.17)
    pd.DataFrame({"state": ["WY"], "d_pre_16": [150], "r_pre_16": [350], "d_pre_20": [250], "r_pre_20": [250],
                  "d": [400], "r": [600]}).to_parquet(tmp_path / "single_seat_votes.parquet")
```

Vervang in `_small_house` alles van de docstring tot en met de regel `seen = {}` door:

```python
    """A House of the 3 districts of XX plus WY: majority 3, WY fixed as Republican. national_majority is
    replaced by a stand-in that records its arguments (its own tests are under Task 5.7). The Senate has the
    two states XX and WY; senate_majority is replaced in the same way (Task 5.18 tests it)."""
    monkeypatch.setattr(step, "HOUSE_SEATS", 3 + 1)
    monkeypatch.setattr(step, "HOUSE_MAJORITY", 3)
    monkeypatch.setattr(step, "SINGLE_SEAT_PARTY", {"WY": "R"})
    monkeypatch.setattr(step, "SENATE_STATES", 2)
    seen = {}
```

en de laatste twee regels van `_small_house` (`monkeypatch.setattr(step, "national_majority", stand_in)` en `return seen`) door:

```python
    def senate_stand_in(votes, needed):
        seen["senate"] = (dict(votes), needed)
        return {"base_share": 0.0, "states_needed": needed, "share": 0.0, "states_at_base": 0,
                "seats_at_base": 0, "tipping": []}

    monkeypatch.setattr(step, "national_majority", stand_in)
    monkeypatch.setattr(step, "senate_majority", senate_stand_in)
    return seen
```

Twee gemaakte staten kunnen de plaatsen 24 tot en met 28 niet vullen; daarom vervangt `_small_house` ook `senate_majority` in de tests van `compute`.

Voeg onderaan `tests/test_metrics_step.py` toe:

```python


# --- Task 5.19: the Senate block ------------------------------------------------------------------


def test_senate_needs_26_of_the_50_states():
    # 51 of 100 seats; at 50-50 the vice president, a Republican since January 2025, decides; two seats per state
    assert (step.SENATE_STATES, step.SENATE_STATES_NEEDED) == (50, 26)


def test_read_single_seat_votes(tmp_path):
    pd.DataFrame({"state": ["WY"], "d": [400], "r": [600]}).to_parquet(tmp_path / "single_seat_votes.parquet")
    wyoming = {"WY": AtLargeState("WY", "Wyoming", "56")}
    assert step.read_single_seat_votes(tmp_path, wyoming) == {"WY": (400.0, 600.0)}
    # config.yaml and the file of 02_join.py must name the same states
    with pytest.raises(CheckError, match="senate_states"):
        step.read_single_seat_votes(tmp_path, {**wyoming, "AK": AtLargeState("AK", "Alaska", "02")})


def test_read_single_seat_votes_needs_the_file_of_02_join(tmp_path):
    with pytest.raises(CheckError, match="interim_files"):
        step.read_single_seat_votes(tmp_path, {"WY": AtLargeState("WY", "Wyoming", "56")})


def test_national_senate_needs_every_state():
    with pytest.raises(CheckError, match="senate_states"):
        step.national_senate({"AA": (1.0, 2.0)})


def test_national_senate_uses_the_number_of_states_needed(monkeypatch):
    # the five states of the Senate tests in tests/test_metrics.py, as if they were all the states
    monkeypatch.setattr(step, "SENATE_STATES", 5)
    monkeypatch.setattr(step, "SENATE_STATES_NEEDED", 3)
    votes = {"AA": (600, 400), "BB": (300, 700), "CC": (550, 450), "DD": (480, 520), "EE": (450, 550)}
    res = step.national_senate(votes)
    # 0.476 + 0.5 - 0.48 = 0.496; ranks 3 - 2 to 3 + 2, high to low
    assert (res["states_needed"], res["share"]) == (3, pytest.approx(0.496))
    assert [t["postal"] for t in res["tipping"]] == ["AA", "CC", "DD", "EE", "BB"]


def test_compute_adds_the_senate(tmp_path, monkeypatch):
    cfg = _interim(tmp_path)
    seen = _small_house(monkeypatch)
    nat = step.compute(cfg, tmp_path)["national"]
    # XX: the votes of its units, 1300 D and 1700 R; WY: 400 D and 600 R from single_seat_votes.parquet
    assert seen["senate"] == ({"XX": (1300.0, 1700.0), "WY": (400.0, 600.0)}, 26)
    assert nat["senate"]["states_needed"] == 26
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `9 failed, 40 passed`. De zes nieuwe tests falen met `AttributeError` (`SENATE_STATES`, `read_single_seat_votes` of `national_senate`), en ook de drie bestaande tests die `_small_house` gebruiken (`test_compute_assembles_states_national_and_checks`, `test_compute_adds_majority_competitive_and_redraw`, `test_compute_adds_the_overview_per_control_and_body`), omdat `monkeypatch.setattr` een ontbrekende `SENATE_STATES` niet aanvaardt.

- [ ] **Step 3: Write minimal implementation**

Voeg in `pipeline/03_metrics.py` `senate_majority` toe aan de import uit `gerry.metrics`: vervang `seats_by_plan, sorted_band)` door `seats_by_plan, senate_majority, sorted_band)`.

Voeg direct na `SINGLE_SEAT_PARTY = {...}` toe:

```python
# Senate block (extensions design, chapter 7): 51 of 100 seats; at 50-50 the vice president decides, a
# Republican since January 2025. Each state gives both its seats to one party: Democrats need 26 states.
SENATE_STATES = 50
SENATE_STATES_NEEDED = 26
```

Voeg direct vóór `compute` toe:

```python
def read_single_seat_votes(idir, at_large: Mapping[str, AtLargeState]) -> dict[str, tuple[float, float]]:
    """(Democratic, Republican) votes of the single-seat states, 2016 and 2020 added up, as 02_join.py wrote them
    from the statewide file of the MIT Election Data and Science Lab."""
    path = idir / "single_seat_votes.parquet"
    if not path.exists():
        raise CheckError("interim_files", "US", "single_seat_votes.parquet is missing; run pipeline/02_join.py again")
    table = pd.read_parquet(path)
    if sorted(table["state"]) != sorted(at_large):
        raise CheckError("senate_states", "US", f"single_seat_votes.parquet has {sorted(table['state'])}, "
                                                f"config.yaml has {sorted(at_large)}")
    return {row.state: (float(row.d), float(row.r)) for row in table.itertuples(index=False)}


def national_senate(votes: Mapping[str, tuple[float, float]]) -> dict:
    """The Senate block (extensions design, ch. 7) from the (Democratic, Republican) votes of every state."""
    if len(votes) != SENATE_STATES:
        raise CheckError("senate_states", "US", f"{len(votes)} states with votes, expected {SENATE_STATES}")
    return senate_majority(votes, SENATE_STATES_NEEDED)
```

Pas `compute` aan. Voeg direct na de regel `join_log = json.loads(...)` toe:

```python
    single_seat = read_single_seat_votes(idir, cfg.at_large)
```

Voeg direct na de regel `votes = {"d": 0.0, ...}` toe:

```python
    senate = {}    # (Democratic, Republican) votes per state for the Senate block
```

en in de lus direct na `votes["state_seats"].append(st.seats)`:

```python
        senate[postal] = (d_total, r_total)
```

Voeg tot slot direct vóór `return {"national": national, "states": states, "checks": checks}` toe, na de regels van `by_control` en `by_body`:

```python
    national["senate"] = national_senate({**senate, **single_seat})
    sen = national["senate"]
    print(f"US Senate: Democrats have {sen['base_share']:.4f} of the two-party vote in the {SENATE_STATES} states "
          f"and need {sen['share']:.4f} for {sen['states_needed']} states; at {sen['base_share']:.4f} they win "
          f"{sen['states_at_base']} states ({sen['seats_at_base']} seats); around the threshold: "
          + ", ".join(f"{t['postal']} {t['share']:.4f}" for t in sen["tipping"]))
```

`compute` leest `single_seat_votes.parquet` vóór de lus over de staten, zodat een ontbrekend bestand meteen stopt.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_step.py -q`
Expected: `49 passed`.

- [ ] **Step 5: Run 03_metrics on the real data**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/03_metrics.py`

Expected: na de regels van taak 5.7 en 5.12 precies

```
US Senate: Democrats have 0.5170 of the two-party vote in the 50 states and need 0.5291 for 26 states; at 0.5170 they win 22 states (44 seats); around the threshold: AZ 0.4930, GA 0.4889, FL 0.4879, NC 0.4876, TX 0.4635
```

en dan de regels `Wrote ...`, met dezelfde `Open items` en `Pending` als ervoor: `docs/validation.md` verandert niet.

- [ ] **Step 6: Write the data test**

Voeg onderaan `tests/test_metrics_data.py` toe:

```python


def test_senate(metrics):
    sen = metrics["national"]["senate"]
    # prototype run of 2026-10-07: the 44 states of the vote basis and the six single-seat states (MIT file)
    assert (sen["states_needed"], sen["states_at_base"], sen["seats_at_base"]) == (26, 22, 44)
    assert sen["base_share"] == pytest.approx(0.5169609, abs=5e-7)
    # the 26th highest state share is Florida's 0.4878762: 0.5169609 + 0.5 - 0.4878762
    assert sen["share"] == pytest.approx(0.5290847, abs=5e-7)
    assert [t["postal"] for t in sen["tipping"]] == ["AZ", "GA", "FL", "NC", "TX"]
    assert [t["share"] for t in sen["tipping"]] == pytest.approx(
        [0.4929715, 0.4888521, 0.4878762, 0.4876063, 0.4635184], abs=5e-7)
    # one vote base: a multi-seat state has the share behind its proportional seats
    for t in sen["tipping"]:
        assert t["share"] == metrics["states"][t["postal"]]["d_share"]
```

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_metrics_data.py -m data -q`
Expected: `26 passed`.

- [ ] **Step 7: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 8: Commit**

```powershell
git add pipeline/03_metrics.py tests/test_metrics_step.py tests/test_metrics_data.py
git commit -m "Add the Senate threshold on the state votes for the nation"
```

### Task 5.20: results.json en de contracttest voor de Senaat

**Files:**
- Modify: `pipeline/gerry/export.py`
- Modify: `tests/test_export.py`
- Modify: `site/js/contract.test.js`
- Modify (gegenereerd): `site/data/results.json`, `site/data/map.topojson` (blijft gelijk)

**Interfaces:**
- Consumes: `national.senate` in `metrics.json` (taak 5.19); `NATIONAL_FIELDS` en de contracttest na taak 5.13.
- Produces: `NATIONAL_FIELDS` met daarachter `senate`; `results.json` met `national.senate` tussen `by_body` en `single_seat`; een contracttest met één nieuwe test.

Wat de contracttest controleert, zonder de stemmen van de zes staten (die staan niet in `results.json`; zie "Keuzes in dit plan", punt 15): 50 staten; `states_needed` is 26; `seats_at_base` is twee keer `states_at_base`; vijf verschillende staten in `tipping`, van hoog naar laag; voor een staat met districten is het aandeel in `tipping` zijn `d_share`; de staat op plaats 24 + i ligt boven 50% precies als die plaats binnen `states_at_base` valt; de drempel is *V50* plus 0,5 min het aandeel van de 26e staat (1e-12); `states_at_base` ligt tussen het aantal staten met districten boven 50% en dat aantal plus zes.

- [ ] **Step 1: Write the failing test**

Voeg in `tests/test_export.py`, in `toy_metrics` onder `"national"`, direct na het woordenboek `"by_body"` toe:

```python
            # extensions (Task 5.19): the Senate block, passed through unchanged
            "senate": {"base_share": 0.55, "states_needed": 26, "share": 0.53, "states_at_base": 27,
                       "seats_at_base": 54, "tipping": [{"postal": "HI", "share": 0.5}]},
```

Vervang in `test_build_results_national_adds_single_seat_states_sorted_by_postal` de bewering over `list(national)` en de lus eronder (taak 5.13) door:

```python
    assert list(national) == ["seats", "proportional", "enacted", "neutral", "position", "effects",
                              "outside_band", "majority", "competitive", "redraw", "by_control", "by_body",
                              "senate", "single_seat"]
    # the extensions pass through unchanged
    for key in ("majority", "competitive", "redraw", "by_control", "by_body", "senate"):
        assert national[key] == toy_metrics()["national"][key], key
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -q`
Expected: `1 failed, 32 passed`: `test_build_results_national_adds_single_seat_states_sorted_by_postal` met een `AssertionError` (`senate` ontbreekt).

- [ ] **Step 3: Write minimal implementation**

In `pipeline/gerry/export.py`:

```python
NATIONAL_FIELDS = ("seats", "proportional", "enacted", "neutral", "position", "effects", "outside_band",
                   "majority", "competitive", "redraw", "by_control", "by_body", "senate")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py tests/test_export_step.py -q`
Expected: `46 passed`.

- [ ] **Step 5: Extend the contract test**

In `site/js/contract.test.js`, voeg direct na `const CONTROL = [...]` toe:

```js
// 51 of 100 seats, two per state; at 50-50 the vice president, a Republican since January 2025, decides (chapter 7)
const SENATE_STATES_NEEDED = 26;
```

Voeg onderaan het bestand toe:

```js

test('the Senate block follows from the state shares', { skip }, () => {
  const { national, states } = data().results;
  const s = national.senate;
  const all = [...Object.keys(states), ...national.single_seat.map((x) => x.postal)];
  assert.equal(all.length, 50);
  assert.equal(s.states_needed, SENATE_STATES_NEEDED);
  assert.ok(isFraction(s.base_share) && isFraction(s.share), 'senate.base_share and senate.share are fractions');
  assert.ok(isInt(s.states_at_base) && s.states_at_base >= 0 && s.states_at_base <= all.length, 'senate.states_at_base');
  assert.equal(s.seats_at_base, 2 * s.states_at_base);
  // the states ranked 24th to 28th, from high to low share
  assert.equal(s.tipping.length, 5);
  assert.equal(new Set(s.tipping.map((t) => t.postal)).size, 5, 'senate.tipping names five states');
  s.tipping.forEach((t, i) => {
    const rank = SENATE_STATES_NEEDED - 2 + i;
    assert.ok(all.includes(t.postal) && isFraction(t.share), `senate.tipping ${t.postal}`);
    if (i > 0) assert.ok(s.tipping[i - 1].share >= t.share, 'senate.tipping runs from high to low');
    // one vote base: a multi-seat state has the share of its district votes
    if (t.postal in states) assert.ok(near(t.share, states[t.postal].d_share, 1e-12), `senate.tipping ${t.postal} is its d_share`);
    // the state ranked here is Democratic at the real votes exactly when its share lies above one half
    assert.equal(t.share > 0.5, rank <= s.states_at_base, `senate.tipping ${t.postal} (rank ${rank}) against states_at_base`);
  });
  // the threshold: the base share plus one half minus the share of the 26th state (exact)
  assert.ok(near(s.share, s.base_share + 0.5 - s.tipping[2].share, 1e-12), `senate.share ${s.share}`);
  // results.json has no votes of the single-seat states: they can add at most one state each
  const above = Object.values(states).filter((x) => x.d_share > 0.5).length;
  assert.ok(above <= s.states_at_base && s.states_at_base <= above + national.single_seat.length,
    `senate.states_at_base ${s.states_at_base} against ${above} multi-seat states above one half`);
});
```

`isInt`, `isFraction`, `near` en `data` bestaan al in het bestand.

- [ ] **Step 6: Run the contract test against the old results.json**

Run: `npm test`
Expected: `tests 32`, `pass 31`, `fail 1`: `the Senate block follows from the state shares` met `TypeError: Cannot read properties of undefined (reading 'states_needed')`. `site/data/results.json` heeft `senate` nog niet.

- [ ] **Step 7: Run the export**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python pipeline/04_export.py`

Expected: dezelfde uitvoer als in taak 5.13, met als laatste regel `Wrote site/data/results.json (44 states) and site/data/map.topojson (683,120 bytes)`. De geometrie verandert niet; `results.json` groeit met ongeveer 0,5 kB (het blok `senate`).

- [ ] **Step 8: Run the JavaScript tests**

Run: `npm test`
Expected: `tests 32`, `pass 32`, `fail 0`, `skipped 0`.

Zie de test falen op een kapotte kopie: bewaar het bestand, verschuif de drempel en zet het daarna terug.

Run: `Copy-Item site\data\results.json "$env:TEMP\results.json"`

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -c "import json, pathlib; p = pathlib.Path('site/data/results.json'); r = json.loads(p.read_text(encoding='utf-8')); r['national']['senate']['share'] += 0.001; p.write_text(json.dumps(r), encoding='utf-8')"`

Run: `npm test`
Expected: `✖ the Senate block follows from the state shares`, `fail 1`.

Run: `Copy-Item "$env:TEMP\results.json" site\data\results.json -Force` en daarna `npm test`
Expected: `pass 32`.

- [ ] **Step 9: Run all tests**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q`
Expected: alle tests slagen.

- [ ] **Step 10: Commit**

```powershell
git add pipeline/gerry/export.py tests/test_export.py site/js/contract.test.js site/data/results.json site/data/map.topojson
git commit -m "Export the Senate threshold to results.json"
```

### Task 5.21: de spec verwijst naar de Senaat

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md` (hoofdstuk 3, 4, 5 en 7)

**Interfaces:**
- Consumes: de velden en bestanden van taak 5.15 tot en met 5.20; de spec na taak 5.14.
- Produces: een spec die de nieuwe databron, het tussenbestand en `national.senate` noemt. De notentabel en de tabel met invulwaarden in hoofdstuk 5 blijven gelijk; `tests/test_export.py` leest ze.

De spec is Nederlands en intern; houd de zinnen kort en zonder em-dashes. De bronvermelding op de site (siteontwerp, punt 9, "Sources") moet het MIT-bestand ook noemen; dat hoort bij het siteplan (taak 4.3 van het hoofdplan), niet bij deze taak.

- [ ] **Step 1: Edit the spec**

Hoofdstuk 3, in de tabel van bronnen, direct na de regel van ALARM census-2020:

```
| [MIT Election Data and Science Lab, "U.S. President 1976-2024"](https://doi.org/10.7910/DVN/42MVDX), `1976-2024-president.csv` | Stemmen per staat van 2016 en 2020 in de zes staten met één zetel, voor het blok over de Senaat (uitbreidingsontwerp, hoofdstuk 7) | Dataverse doi:10.7910/DVN/42MVDX, versie 10.1 (04-09-2026) |
```

Hoofdstuk 3, de zin over licenties: vervang "de ALARM-dataset is CC0" door "de ALARM-dataset en de presidentsuitslagen per staat van het MIT Election Data and Science Lab zijn CC0".

Hoofdstuk 3, in de lijst onder "Gedrag:", direct na de regel die begint met "Census en GitHub:":

```
- Het MIT-bestand komt via een directe link naar één Dataverse-bestand (`api/access/datafile/13887042`). De eerste download legt sha256 vast in `data/manifest.json`, zoals bij Census en GitHub.
```

Hoofdstuk 4, in de boom van `pipeline/`, direct na de regel van `ensemble.py`:

```
    president.py       stemmen per staat uit het bestand van het MIT Election Data and Science Lab
```

Hoofdstuk 4, in "Gegevens tussen de stappen", als laatste punt van de lijst onder "Het schrijft naar `data/interim/`:":

```
- `single_seat_votes.parquet`: `state`, `d_pre_16`, `r_pre_16`, `d_pre_20`, `r_pre_20`, `d`, `r` voor de zes staten met één zetel, uit het MIT-bestand (uitbreidingsontwerp, hoofdstuk 7).
```

Hoofdstuk 5, aan het eind van "### Uitbreidingen" (taak 5.14), na de vier punten:

```
De Senaat (hoofdstuk 7 van het uitbreidingsontwerp) gebruikt de stemmen per staat: voor de 44 staten de stembasis, voor de zes staten met één zetel de officiële uitslagen van 2016 en 2020 uit het MIT-bestand. Bij 50 tegen 50 beslist de vicepresident, sinds januari 2025 een Republikein, dus Democraten hebben 26 staten nodig. De drempel is het landelijke aandeel over de 50 staten plus 0,5 min het 26e hoogste staatsaandeel. Dit blok gaat niet over kaarten.
```

Hoofdstuk 7, in de tabel van `results.json`: vervang in de cel van `national` het stuk dat taak 5.14 toevoegde, `` `by_control`, `by_body` ``, door:

```
`by_control`, `by_body`; uit hoofdstuk 7 van dat ontwerp: `senate` {`base_share`, `states_needed`, `share`, `states_at_base`, `seats_at_base`, `tipping`: lijst van {`postal`, `share`}}
```

- [ ] **Step 2: Run the tests that read the spec**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest tests/test_export.py -q`
Expected: `33 passed`.

Run: `Select-String -Path docs\superpowers\specs\2026-10-05-gerrymandering-map-design.md -Pattern ([char]0x2014)`
Expected: geen uitvoer.

- [ ] **Step 3: Commit**

```powershell
git add docs/superpowers/specs/2026-10-05-gerrymandering-map-design.md
git commit -m "Point the spec to the Senate block"
```

## Afronding

- [ ] **Step 1: Alle tests en de hele pijplijn**

Run: `$env:PYTHONUTF8=1; .venv\Scripts\python -m pytest -q` en `npm test`
Expected: pytest alleen `passed` (en `skipped` alleen als de datamap ontbreekt), minstens 90 tests meer dan vóór fase 5: 68 uit taak 5.1 tot en met 5.14 en 22 uit taak 5.15 tot en met 5.21, plus de tests die bij de uitvoering zijn toegevoegd; `node --test` met `tests 32`, `pass 32`.

Run: `$env:PATH = "$PWD\.venv\Scripts;" + $env:PATH; make all`
Expected: exit code 0, zonder `CheckError`. `git status --short` toont daarna geen gewijzigde bestanden, behalve een nieuwe datum in `results.json` als de dag veranderde.

- [ ] **Step 2: Push-commando's voor de eigenaar**

De branch heeft een remote (`origin`). Geef de eigenaar precies dit commando:

```powershell
git push origin feature/pipeline-setup
```
