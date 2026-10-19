# Uitbreidingen: meerderheid, hertekeningen, concurrerende districten, wie tekende de kaart

Datum: 6 oktober 2026. Status: goedgekeurd door de eigenaar op 6 oktober 2026 (besluiten in hoofdstuk 6).

Besluit van de eigenaar (6 oktober 2026): alle vier toevoegen. Dit document legt vast wat ze precies betekenen en hoe de pijplijn ze berekent. Het bouwt op het hoofdontwerp (`2026-10-05-gerrymandering-map-design.md`): dezelfde stembasis (presidentsverkiezingen 2016 en 2020 opgeteld, West Virginia alleen 2020), dezelfde blokverdeling en dezelfde 5.000 neutrale plannen per staat. Geen van de vier is een voorspelling van de verkiezing van 2026; elk getal zegt wat er gebeurt als iedereen stemt zoals bij die presidentsverkiezingen.

## 1. Meerderheidsdrempel

**Vraag.** Welk landelijk aandeel van de stemmen hebben Democraten nodig voor een meerderheid in het Huis, onder de vastgestelde kaarten, onder neutrale kaarten en als zetels het stemaandeel volgen?

**Meerderheid.** 218 van de 435 zetels. De zes staten met één zetel liggen vast op de winnaar van de presidentsverkiezingen van 2016 en 2020 in die staat: Democraten in DE en VT, Republikeinen in AK, ND, SD en WY. In beide verkiezingen won dezelfde partij daar. Democraten hebben dus 216 van de 429 districten nodig. Zo is geen nieuwe databron nodig voor de zes staten. Op deze stembasis kantelt AK pas bij een verschuiving van ongeveer 6,7 procentpunt naar de Democraten en DE bij ongeveer 8 punt naar de Republikeinen (officiële staatsuitslagen 2016 en 2020); de drempels hieronder moeten ruim binnen die marge liggen, en de pijplijn stopt als een drempel meer dan 5 procentpunt van *V0* ligt (paragraaf 5).

**Uniforme verschuiving.** Tel bij het Democratische tweepartijenaandeel van elk district hetzelfde getal *s* op. Het landelijke aandeel over de 429 districten is dan *V0 + s*, met *V0* het aandeel op onze stembasis (nu 51,8%). Een district gaat naar de Democraat als zijn aandeel plus *s* boven 50% ligt.

- **Enacted.** Sorteer de 429 districtsaandelen van de vastgestelde kaarten van hoog naar laag; *h* is het 216e. De drempel is *V0 + (0,5 − h)*. Exact, zonder raster.
- **Neutral baseline.** Per staat en per plan het aantal Democratische zetels bij verschuiving *s*; per staat de verdeling over de 5.000 plannen; landelijk de convolutie van de 44 verdelingen, zoals de landelijke band in hoofdstuk 5. De drempel is het kleinste *s* op een raster van 0,01 procentpunt waarbij minstens de helft van de neutrale uitkomsten 216 of meer districten geeft. Daarnaast een band: de *s* waarbij 5% en waarbij 95% van de neutrale uitkomsten die 216 haalt.
- **Proportional.** Per staat largest remainder op staatsaandeel plus *s*, landelijk opgeteld. De drempel is het kleinste *s* op hetzelfde raster waarbij de som 216 of meer is.
- **Bij de echte stemmen** (*s* = 0): het aantal zetels onder Enacted, en het aandeel neutrale uitkomsten met een meerderheid (nu 98,5%).

**Weergave.** In de landelijke strook één zin, bijvoorbeeld: "With these votes, Democrats need 52.4% of the two-party vote for a House majority under the enacted maps, 50.1% under neutral maps and 50.0% if seats followed the vote. They have 51.8%." (De getallen in dit voorbeeld zijn verzonnen; de pijplijn rekent ze uit.)

**Beperking.** Een uniforme verschuiving is een vereenvoudiging: in werkelijkheid verschuift niet elk district even veel. Het is de gangbare maat voor zetels tegenover stemmen en gebruikt alleen onze bestaande gegevens.

## 2. Hertekeningen sinds de verkiezing van 2024

**Vraag.** Wat veranderen de nieuwe kaarten van 2025 en 2026 aan het aantal Democratische zetels, met dezelfde stemmen?

**Referentie.** De kaarten van de verkiezing van 2024: het Census-blokbestand CD119 (`https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip`, 22.959.130 bytes, 29 juli 2024, kop `GEOID,CDFP`, zelfde vorm als CD118 en CD120). We kiezen 2024 en niet 2022, omdat AL, GA, LA, NY en NC tussen 2022 en 2024 al nieuwe kaarten kregen. Met 2024 als referentie meten we alleen de golf van 2025 en 2026. Dit is een nieuwe databron; `01_download` haalt hem op en zet hem in het manifest.

**Berekening.** `02_join` verdeelt de stemmen ook over de kaart van 2024 (blokmethode, zelfde controles als de andere kaarten). Per staat: `seats_2024` en `change` = Enacted min `seats_2024`. Daarnaast `map_changed`: of de blokindeling van CD119 voor die staat verschilt van het blokbestand van de vastgestelde kaart (CD120; voor Missouri CD118). Voor Missouri is de kaart van 2024 dezelfde als de huidige (de kaart van 2022). Landelijk: de som van beide en het netto verschil.

**Weergave.** In het staatsblad: "2024 map: 14 Democratic seats with these votes. 2026 map: 11 (3 fewer)." of "Map unchanged since 2024." Landelijk: het netto verschil en de staten met een andere uitkomst.

**Beperking.** We vergelijken aantallen zetels. Een districtsnummer kan op de nieuwe kaart een ander gebied zijn.

## 3. Concurrerende districten

**Definitie.** Een district is concurrerend als het Democratische tweepartijenaandeel op onze stembasis tussen 45% en 55% ligt, grenzen inbegrepen. Dat is een gangbare grens; we noemen hem bij elk getal.

**Berekening.** Per staat: het aantal concurrerende districten op de vastgestelde kaart, en over de 5.000 neutrale plannen de mediaan en het 5e tot 95e percentiel (inverse CDF, zoals in hoofdstuk 5). Landelijk: de som voor Enacted, en voor de neutrale kaarten de convolutie van de 44 verdelingen.

**Weergave.** In het staatsblad: "Competitive districts (45 to 55%): 2 on the enacted map, 6 on neutral maps (4 to 8)." Landelijk dezelfde zin.

## 4. Wie stelde de kaart vast, en onder welke politieke controle

Besluit van de eigenaar (6 oktober 2026): de politieke kleur is relevant. Daarom twee velden per staat in `config.yaml`, met de toestand op het moment dat de huidige kaart werd aangenomen.

**`adopted_by`**, het orgaan:

| Waarde | Betekenis |
|---|---|
| `Legislature` | Het staatsparlement nam de kaart aan, ook als kiezers hem daarna goedkeurden (California, Proposition 50). |
| `Commission` | Een commissie stelde de kaart vast (bijvoorbeeld Arizona, Michigan, de Ohio Redistricting Commission). |
| `Court` | Een rechter of door de rechter aangestelde deskundigen stelden de kaart vast (bijvoorbeeld Utah 2025). |

**`control`**, de politieke controle over dat besluit:

| Waarde | Betekenis |
|---|---|
| `Republican` | Eén partij kon de kaart alleen aannemen: bij een parlement had die partij beide kamers en de gouverneur, of beide kamers met een meerderheid die een veto kan breken; bij een commissie had die partij de meerderheid en stemde de andere partij tegen. Hier de Republikeinen. |
| `Democratic` | Hetzelfde, voor de Democraten. |
| `Bipartisan` | Geen partij kon de kaart alleen aannemen, of beide partijen stemden ervoor (bijvoorbeeld een gouverneur van de ene partij en een parlement van de andere). |
| `Nonpartisan` | Een onafhankelijke commissie, of een rechter. |

Voorbeelden: Texas `Legislature`, `Republican`; Illinois `Legislature`, `Democratic`; California (2026) `Legislature`, `Democratic`, goedgekeurd door kiezers; Arizona `Commission`, `Nonpartisan`; Utah (2025) `Court`, `Nonpartisan`.

Plus een optioneel veld `adopted_note` voor gevallen die uitleg nodig hebben, bijvoorbeeld Iowa (onpartijdige staf maakt het voorstel, het parlement stemt erover). Per staat komen de bronnen in `data/sources.md` in een nieuwe kolom: het orgaan, de stemming of de uitspraak, en de samenstelling van parlement en gouverneur op die datum, met officiële bronnen. Dit is webonderzoek per staat; twijfel gaat naar de eigenaar.

**Berekening.** Landelijk per waarde van `control` (en apart per `adopted_by`): het aantal staten, het aantal zetels en de som van de tekeneffecten.

**Weergave.** In het staatsblad een feitelijke regel: "Adopted by: Legislature (Republican control)." Landelijk een kleine tabel: per waarde het aantal staten, de zetels en het netto tekeneffect. Geen woorden als "gerrymander" of "partisan map"; de site noemt alleen wie de kaart aannam en wat de cijfers laten zien.

**Beperking.** Het veld zegt wie de kaart aannam en onder welke controle, niet met welke bedoeling. Ook een kaart onder controle van één partij kan binnen de neutrale band vallen; dat tonen we gewoon.

## 5. Wat er verandert per onderdeel

- `01_download`: `cd119.zip` in het downloadplan en het manifest.
- `config.yaml` en `gerry/config.py`: `adopted_by` en `control` (verplicht, uit de tabellen in paragraaf 4) en `adopted_note` (optioneel) per staat.
- `02_join`: een extra kaart `map_2024` uit CD119 voor alle 44 staten.
- `03_metrics` en `gerry/metrics.py`: de drempels (paragraaf 1), `competitive` per staat en landelijk, `redraw` per staat en landelijk, en het overzicht per `control` en per `adopted_by`. Nieuwe pure functies met handberekende tests, zoals in fase 2. De pijplijn stopt als een drempel meer dan 5 procentpunt van *V0* ligt, zodat de vaste uitslag van de zes staten met één zetel blijft kloppen.
- `docs/validation.md`: een regel per staat dat `map_2024` geldige districten heeft (zelfde controles als de andere kaarten).
- `results.json` (hoofdstuk 7 van het hoofdontwerp): `national.majority` {`seats_needed` (216 van 429), `base_share`, `enacted` {`share`, `seats_at_base`}, `neutral` {`share`, `low`, `high`, `probability_at_base`}, `proportional` {`share`}}; `national.competitive` en `states.<ST>.competitive` {`enacted`, `median`, `p5`, `p95`, `neutral_dist`}; `national.redraw` {`seats_2024`, `change`} en `states.<ST>.redraw` {`seats_2024`, `change`, `map_changed`}; `states.<ST>.adopted` {`by`, `control`, `note` (of `null`)}; `national.by_control` en `national.by_body`: per waarde {`states`, `seats`, `drawing`}.
- `site/js/contract.test.js`: de nieuwe velden en hun samenhang (bijvoorbeeld: de som van `change` over de staten is `national.redraw.change`).
- De site: de weergaven hierboven, uitgewerkt in het siteontwerp (taak 4.3).

## 6. Besluiten van de eigenaar

Op 6 oktober 2026:

1. De zes staten met één zetel liggen vast: DE en VT Democratisch, AK, ND, SD en WY Republikeins (paragraaf 1).
2. De kaarten van 2024 (CD119) zijn de referentie voor hertekeningen (paragraaf 2).
3. Concurrerend is 45% tot 55% (paragraaf 3).
4. Wie de kaart aannam: de politieke kleur is relevant. Twee velden, `adopted_by` en `control`, zoals in paragraaf 4 (akkoord 6 oktober 2026).

Op 7 oktober 2026, bij de open punten van het implementatieplan (`docs/superpowers/plans/2026-10-06-extensions.md`):

5. Een lid zonder partij dat in een commissie de doorslag gaf (te verwachten in New Jersey en Montana), telt niet als partij. Zulke kaarten krijgen `Bipartisan`, met een `adopted_note` die zegt wie de doorslag gaf en voor welk voorstel.
6. De overige open punten volgen de aanbevelingen van het plan: stemden in elke kamer die stemde meerderheden van beide partijen voor, dan `Bipartisan`; een partij die de kaart zonder de gouverneur kan aannemen (North Carolina), kon haar alleen aannemen; `adopted_by` is het orgaan dat de geldende grenzen vaststelde, andere stappen gaan in `adopted_note`; één kolom "Adoption and control" in `data/sources.md`; de vaste partij van de zes staten met één zetel staat als vaste tekst op de site.
7. De Senaat komt erbij, als apart blok (paragraaf 7).

## 7. De Senaat, op dezelfde stemmen

**Vraag.** Welk landelijk aandeel van de stemmen hebben Democraten nodig voor een meerderheid in de Senaat, als in elke staat beide senatoren naar de partij gaan die daar de presidentsverkiezingen van 2016 en 2020 samen won?

**Geen gerrymandering.** De Senaat heeft geen districten. Het verschil met het stemaandeel komt doordat elke staat twee senatoren heeft, groot of klein. De site zet dit blok daarom apart van de kaarten en zegt dat in één zin.

**Stemmen per staat.** Voor de 44 staten met districten het tweepartijenaandeel over de staat uit onze stembasis (de som van de districtsstemmen; West Virginia alleen 2020). Voor de zes staten met één zetel (AK, DE, ND, SD, VT, WY) de officiële uitslagen per staat van 2016 en 2020, opgeteld, uit een nieuwe databron: MIT Election Data and Science Lab, "U.S. President 1976-2024" (Harvard Dataverse, doi:10.7910/DVN/42MVDX). Het implementatieplan legt versie, bestand, licentie en controle vast; wijken de cijfers af van de officiële uitslagen van die staten, dan stoppen en vragen.

**Meerderheid.** 51 van de 100 zetels. Bij 50 tegen 50 beslist de vicepresident; die is sinds januari 2025 Republikein. Omdat elke staat hier twee zetels aan één partij geeft, hebben Democraten 26 staten nodig.

**Berekening.** Uniforme verschuiving op de staatsaandelen, zoals in paragraaf 1. *V50* is het landelijke aandeel over de 50 staten. De drempel is *V50 + (0,5 − h)*, met *h* het 26e hoogste staatsaandeel. Daarnaast: het aantal staten en zetels bij de echte stemmen, en de staten rond de drempel (de 24e tot en met de 28e).

**Uitvoer.** `national.senate` {`base_share`, `states_needed` (26), `share`, `states_at_base`, `seats_at_base`, `tipping`: lijst van {`postal`, `share`}}.

**Weergave.** Een apart blok naast de meerderheid in het Huis: "If each state's two senators went to the party that won its presidential vote, Democrats would need 52.9% of the two-party vote for a Senate majority. They have 51.7% and would win 22 states." (Voorbeeldgetallen uit een eerste berekening; de pijplijn rekent ze uit.) Met een korte uitleg dat dit geen effect van kaarten is.

**Beperking.** Een gedachte-experiment: echte senatoren hangen ook af van kandidaten, en per verkiezing staat maar een derde van de zetels open.
