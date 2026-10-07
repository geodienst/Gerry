# Siteontwerp

Datum: 6 oktober 2026. Status: goedgekeurd door de eigenaar op 7 oktober 2026, in de vorm van versie 5 van het voorproefje en met de wijzigingen hieronder. De punten 1 tot en met 8 zijn besluiten uit de ontwerpsessie van 6 oktober 2026; de opzet van punt 9 (methodetoelichting) en punt 10 (bronlabels, "Map file:") zijn met het ontwerp goedgekeurd.

**Senaat (besluit 7 oktober 2026).** Een apart blok in de landelijke sectie, naast de meerderheid in het Huis, met de drempel voor de Senaat uit hoofdstuk 7 van het uitbreidingsontwerp en één zin dat dit geen effect van kaarten is.

**Bijgewerkt na feedback van de eigenaar op 7 oktober 2026** (voorproefje versie 5). Deze punten gaan voor waar de tekst hieronder afwijkt:

- De kaart staat bovenaan, direct onder de kop. De kop krijgt één regel met de landelijke kerncijfers (Proportional, Neutral baseline, Enacted, tekeneffect) en een knop naar het landelijke beeld; de landelijke strook met zetelas en effecten staat onder kaart en blad.
- Alles schaalt mee met het scherm: maten in rem, de basisgrootte groeit van 15 pixels (tot ongeveer 1300 pixels breed) naar 21 pixels op grote schermen; geen vaste maximale breedte van 1240 pixels meer (wel 2400); het blad is minstens 22rem en anders 30% breed.
- In "Drawing effect by state" zijn de staten zonder tekeneffect ingeklapt achter een regel met een klein pijltje ("26 states match their neutral median"). Onderaan staat het landelijke saldo als staafje: links de zetels richting Republikeinen, rechts richting Democraten, met een markering voor het netto getal.
- Zoomen volgt de gangbare aanpak voor een kaart in een scrollende pagina (zoals ingesloten kaarten van Google Maps): Ctrl of Cmd plus scrollen zoomt, gewoon scrollen scrolt de pagina en toont kort "Use Ctrl + scroll to zoom the map"; op een aanraakscherm zoomen en verschuiven twee vingers en scrolt één vinger de pagina ("Use two fingers to move the map").
- De kaart heeft een lichte achtergrondkleur (`--water`), zodat de cursor en de kaartrand ook op een wit scherm zichtbaar zijn; tijdens slepen wordt de cursor een gesloten hand.
- Effecten krijgen geen plus of min meer, maar de richting: "R+6 · 6 seats toward Republicans", "D+3 · 3 seats toward Democrats", "0 · no difference". Zo is geen partij het uitgangspunt en is een knop om het perspectief om te draaien niet nodig. Efficiency gap en mean-median op dezelfde manier: "18.2 points toward Republicans". Dit vervangt punt 6 hieronder.
- Besluit van de eigenaar, 7 oktober 2026 (later die avond): titel "Some votes are more equal than others", in plaats van de werktitel "House of cards".
- Besluit van de eigenaar, 7 oktober 2026: werktitel "House of cards"; een nieuwe uitleg onder de kop ("How many U.S. House seats would Democrats win with the same votes on different maps? ..."); de kerncijferregel als één zin ("Of 429 seats, Democrats win 224 if seats follow the votes, 223 on neutral maps and 213 on the 2026 maps. Drawing effect: R+10.", getallen uit `results.json`); en tussen kop en kaart een inklapbaar blok "How to read this" (standaard open) met Texas als rekenvoorbeeld, alle getallen uit `results.json` via `explainerView`. Dit vervangt de kop en de uitleg van punt 8.

Dit document werkt hoofdstuk 8 van het hoofdontwerp (`2026-10-05-gerrymandering-map-design.md`) uit, en de weergaven van de uitbreidingen (`2026-10-06-extensions-design.md`). Het voorproefje (`https://claude.ai/artifact/6jnsQ6XGWerWYoydqQQwSV`, versie 4) laat de indeling, de kaart met zoom, de zetelas en de gesorteerde districtsgrafiek zien met de echte export; de site neemt die opbouw over. Vaste eisen uit het hoofdontwerp blijven gelden: één statische pagina, alleen `site/vendor/` en eigen bestanden, geen verzoeken naar derden, Engelse interface met de labels "Proportional", "Neutral baseline" en "Enacted", alle getallen via `site/js/format.js`, alle zichtbare tekst door de unslop-skill.

## 1. Indeling (besluit: A, naast elkaar)

Van boven naar beneden:

1. **Kop.** Titel, één zin uitleg, een link "Method" naar de toelichting onderaan.
2. **Landelijke strook.** De drie getallen (Proportional, Neutral baseline met de band van 90%, Enacted) met de landelijke zetelas. Daaronder de effecten in één zin, en vier korte regels uit de uitbreidingen: de meerderheidsdrempel, het netto effect van de hertekeningen sinds 2024, de concurrerende districten en een link naar de tabel per politieke controle.
3. **Kaart en staatsblad.** Vanaf 900 pixels breed naast elkaar: de kaart links (flexibel), het staatsblad rechts (380 pixels). Smaller onder elkaar: kaart, dan blad.
4. **Per politieke controle.** Een kleine tabel: per waarde van `control` het aantal staten, de zetels en het netto tekeneffect; daaronder hetzelfde per orgaan (`adopted_by`).
5. **Methode.** De toelichting (punt 9) met bronnen.
6. **Voet.** Bronnen, licenties, datum van de statuscontrole, versie van ALARM's dataset.

Schets op 1280 pixels: kop en strook over de volle breedte (maximaal 1240 pixels), dan de kaart (ongeveer 820 pixels) met het blad ernaast, dan tabel en methode in één kolom van ongeveer 70 tekens breed. Schets op 375 pixels: alles in één kolom met 16 pixels marge; de zetelas schaalt mee; de kaart is 343 pixels breed en zoomt met knijpen.

**Staatsblad.** Zonder gekozen staat: "Drawing effect by state", de 44 staten gesorteerd op tekeneffect met een staafje en het getal, en bovenaan de netto som ("Sum over the states: −10. 10 states give 22 fewer Democratic seats than their neutral median, 8 give 12 more, 26 match it."). Met een gekozen staat, in deze volgorde:

1. Naam, kaartnaam, statuslabel ("In effect", "Challenged in court", "Blocked") met "Legal status as of <datum>", en "Adopted by: Legislature (Republican control)".
2. De drie getallen met het stemaandeel van de staat, en de zetelas met de verdeling over de 5.000 plannen.
3. De twee effecten, als getal en in woorden (punt 8).
4. De positie: "Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more."
5. Alleen Missouri: de rij voor HB 1 (zetels en positie van de geblokkeerde kaart).
6. "Districts, sorted": de gesorteerde districtsgrafiek.
7. Concurrerende districten, en de hertekening sinds 2024.
8. Efficiency gap en mean-median met neutrale context ("Not defined for two districts" bij twee districten).
9. De noten, en de bron (punt 10).

## 2. Typografie (besluit: systeemletters)

Koppen en de grote getallen in een serif uit het systeem: `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`. Tekst, labels en assen in `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Tabulaire cijfers (`font-variant-numeric: tabular-nums`) in lijsten, tabellen en assen. Schaal: 34, 26, 20, 15, 13 en 12 pixels. Geen lettertypebestanden.

## 3. Kleuren (besluit: partijkleuren, met een knop voor neutrale kleuren)

Alle kleuren als tokens, met eigen waarden voor licht en donker (zoals het voorproefje).

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `--bg` | `#f5f6f7` | `#111316` | pagina |
| `--sheet` | `#ffffff` | `#191c20` | strook, kaart, blad |
| `--fg` | `#16181b` | `#eceef1` | tekst |
| `--muted` | `#5b626b` | `#a3aab3` | labels, assen |
| `--rule` | `#d7dbe0` | `#2d3239` | lijnen |
| `--ink` | `#23324f` | `#c8d3ea` | knoppen, links, focus |
| `--party-d` / `--party-r` | `#2a78d6` / `#e34948` | `#3987e5` / `#e66767` | polen bij partijkleuren |
| `--neutral-d` / `--neutral-r` | `#01665e` / `#8c510a` | `#5ab4ac` / `#d8b365` | polen bij neutrale kleuren |
| `--mid` | `#ecebe7` | `#3a3a37` | middenpunt (50% of 0) |
| `--blank` | `#c9ccd1` | `#4a4f56` | staten met één zetel |

**Districten.** Divergerend rond 50%, domein 20% tot 80% (daarbuiten de volle poolkleur), interpolatie in Lab. Legenda met een kleurbalk en de labels "20%", "35%", "50%", "65%", "80%", plus "More Democratic" en "More Republican" aan de uiteinden.

**Tekeneffect.** Dezelfde twee polen, in hele zetels van −6 tot +6 (daarbuiten de volle kleur), 0 is het middenpunt. Legenda met dertien vakjes en de labels −6, −4, −2, 0, +2, +4, +6.

De knop "Party colors / Neutral colors" verandert alleen de polen. Informatie hangt nooit alleen aan kleur: elk getal staat ook als tekst in de tooltip, het blad of de lijst. Voor de bouw gaan beide paren door de validator van de dataviz-skill (lichtheid monotoon, contrast van de polen tegen `--sheet`).

## 4. Kaart en interactie (besluiten: zoom, staat in de link)

- Twee weergaven met een knop: "Districts: Democratic share" en "States: drawing effect".
- Een staat kiezen (klik, tik, de lijst of het keuzemenu) zoomt de kaart in op die staat en opent het blad. Knoppen "+", "−" en "All". Knijpen op aanraakschermen, Ctrl plus scrollen met een muis; gewoon scrollen scrolt de pagina. Slepen verschuift. Met `prefers-reduced-motion` springt de zoom zonder animatie.
- De gekozen staat staat in de link als `#TX`; de terugknop werkt. "All" zet de link terug op de hele kaart.
- Aanwijzen met een muis toont een tooltip: district, staat en aandeel, of bij de staten het tekeneffect. Op een aanraakscherm kiest een tik de staat en toont een regel onder de kaart met het getikte district ("TX-9: 72.1% Democratic").
- Toetsenbord: de lijst en het keuzemenu bereiken elke staat; zichtbare focus; Escape gaat van het blad terug naar de lijst. De 435 districtsvlakken zijn geen tab-stops.
- Staten met één zetel zijn grijs; aanwijzen of tikken toont "One at-large seat. No districts, so nothing to compare."

## 5. Zetelas en grafieken (besluit: zoals in het voorproefje)

- **Zetelas.** Hele zetels op de as. Staafjes: het aandeel neutrale plannen per zetelaantal. Grijze band: 5e tot 95e percentiel. Drie markeringen met label: Proportional (gestippelde lijn met vierkantje), Neutral (doorgetrokken lijn), Enacted (stip). Labels die botsen, gaan een regel omhoog. Landelijk loopt de as van 14 zetels onder tot 14 zetels boven de band.
- **Gesorteerde districten.** De districten van Enacted van laag naar hoog Democratisch aandeel als stippen, tegen de band per positie (`sorted.p5` tot `sorted.p95`) en de mediaan (`sorted.p50`), met een stippellijn op 50%.
- **Meerderheidsdrempel.** Een horizontale stemas (ongeveer 45% tot 60%) met drie markeringen: de drempel onder Enacted, onder neutrale kaarten (met band) en bij Proportional, en een verticale lijn op het werkelijke aandeel. Daaronder de zin uit het uitbreidingsontwerp.
- **Hertekeningen.** Landelijk het netto getal en de lijst van staten met een andere uitkomst, elk met "+n" of "−n" en woorden. In het blad de zin uit het uitbreidingsontwerp.

## 6. Effecten (besluit: getal en woorden)

"−6 · 6 fewer Democratic seats", "+3 · 3 more Democratic seats", "0 · no difference". Het minteken is U+2212. Landelijk: "Geographic effect −1: 1 fewer Democratic seat under neutral maps than if seats followed the vote. Drawing effect −10: 10 fewer Democratic seats under the enacted maps than under neutral maps."

## 7. Toegankelijkheid en snelheid

Werkt met muis, toetsenbord en aanraking. Contrast minstens 4,5:1 voor tekst en 3:1 voor markeringen. Elke grafiek heeft een tekstalternatief (`role="img"` met een beschrijving van de getallen). Alleen `index.html`, één CSS-bestand, de modules in `site/js/`, `site/vendor/` en `site/data/`; samen onder 1,5 MB. Werkt zonder netwerkverzoeken naar derden.

## 8. Teksten op de site

Kop: "U.S. House seats, counted three ways". Uitleg: "Democratic seats in each state if seats followed the vote share, under neutrally drawn maps, and under the maps used on November 3, 2026. All three use the same votes: the 2016 and 2020 presidential results added together."

## 9. Methodetoelichting (ter beoordeling)

Concept, in het Engels, voor onderaan de pagina:

> **How to read the three numbers.** All numbers count Democratic seats in the U.S. House. *Proportional* gives each state's seats in proportion to its two-party vote. *Neutral baseline* is the median of 5,000 maps per state drawn by a computer that follows each state's rules but ignores party. *Enacted* is what the maps used on November 3, 2026 produce with the same votes. The difference between the first two is the geographic effect; the difference between the last two is the drawing effect.
>
> **Why neutral maps are not proportional.** Each district elects one winner, so the party with more votes in a state usually wins a larger share of its seats than of its votes. Democratic voters also live closer together, mostly in cities, so neutral maps often put many of them in a few districts that Democrats win by large margins. The geographic effect is the sum of both.
>
> **Votes.** We use the 2016 and 2020 presidential results added together, by voting district (by census tract in California, Hawaii, Maine and Oregon, by county in Iowa and West Virginia; West Virginia uses 2020 only), as prepared by the ALARM Project. The enacted seats come from assigning these votes to the 2026 districts, not from House results. With these votes the enacted seats can differ from what happened in 2024.
>
> **The Voting Rights Act.** The law can require districts where a minority group forms a large share of the voters. In seat counts such districts can look like packing. ALARM's neutral maps follow the Voting Rights Act as courts applied it before Louisiana v. Callais (April 2026). Where a map adopted after that ruling removed such districts, the change shows up in the drawing effect. The notes per state say what ALARM did there.
>
> **Neutral maps that keep old district cores.** In Kansas and Nebraska ALARM's neutral maps keep the cores of the districts drawn after the 2010 census, in Louisiana, New Mexico and Utah those of the 2021 or 2022 map. In New Mexico, and largely in Louisiana, that pulls the drawing effect toward zero.
>
> **The national band.** The national neutral baseline combines the 44 states as if their neutral maps were drawn independently. The national effects therefore differ slightly from the sum of the state effects.
>
> **Extensions.** The majority threshold shifts every district's Democratic share by the same amount until Democrats win 216 of the 429 districts; the six states with one seat stay with the party that won them in 2016 and 2020. Competitive districts have a Democratic share between 45% and 55%. Redraws compare the 2026 maps with the maps of the 2024 election (U.S. Census Bureau, 119th Congress). "Adopted by" says which body adopted the map and which party, if any, could adopt it alone.
>
> **Known limits.** [de beperkingen uit hoofdstuk 10 van het hoofdontwerp die geen noot per staat hebben, elk in één zin: de eenheden van de stemmen; twee tracts in California zonder stemmen bij ALARM; 38 watereenheden in Michigan; het blokbestand van Maine; de cijfers van New Jersey; eenheden zonder volwassenen; geen toets op gelijke bevolking; districtsnummers verschillen tussen kaarten; TX-15, TX-28 en TX-34 blijven Democratisch op deze stemmen; Louisiana ligt bijna vast op één Democratische zetel.]
>
> **Sources.** ALARM Project, 50-State Redistricting Simulations, version 15 (McCartan, Imai and others; Harvard Dataverse, doi:10.7910/DVN/SLCD3E), CC0. U.S. Census Bureau, TIGER/Line 2026 and block equivalency files for the 119th and 120th Congress. Legal status as of <datum>. Cross-checked against PlanScore for seven states.

De zinnen bij "Known limits" schrijf ik uit in het siteplan, na akkoord op deze opzet.

**Voet, toevoeging van de eigenaar (7 oktober 2026).** De voet krijgt het logo van de Geodienst (Rijksuniversiteit Groningen) met het woord Geodienst, samen één link naar https://rug.nl/geo. Het logo is een eigen bestand van de site (`site/img/geodienst.svg`, uit `logo geodienst.svg` in de projectmap, zonder Inkscape-gegevens). De site doet daardoor geen verzoek naar een andere host; dat gebeurt pas als iemand op de link klikt.

## 10. Bronlabels (ter beoordeling)

De site toont per staat de kaartnaam en de bron van het kaartbestand uit `config.yaml`. Voorstel: de regel heet "Map file:" in plaats van "Source:", omdat een deel van de labels de leverancier van het bestand noemt (bijvoorbeeld Redistricting Data Hub voor IL, MD, MO en MS) en niet het orgaan dat de kaart aannam. Wie de kaart aannam, staat al in "Adopted by". Een gewijzigd label gaat alleen in `config.yaml`, daarna `make export`.

| Staat | Kaart | Map file |
|---|---|---|
| AL | Livingston Congressional Plan 3-2023 | Alabama Secretary of State |
| AR | Acts 1114 and 1116 of 2021 | Arkansas GIS Office |
| AZ | Independent Redistricting Commission map v14.0 | Arizona Independent Redistricting Commission |
| CA | AB 604 (Proposition 50) | California State Assembly Elections Committee |
| CO | Independent Congressional Redistricting Commission plan | Colorado Independent Redistricting Commissions |
| CT | Special master plan | Connecticut General Assembly |
| FL | EOGPCRP2026 (HB 1-D) | Florida Senate |
| GA | December 2023 remedial plan (SB 3EX) | Georgia Legislative and Congressional Reapportionment Office |
| HI | Reapportionment Commission plan | Hawaii Office of Elections |
| IA | SF 621, LSA Plan 2 | Iowa Legislative Services Agency |
| ID | Commission for Reapportionment plan | Idaho Legislature |
| IL | HB 1291 of 2021 | Redistricting Data Hub |
| IN | HEA 1581 of 2021 | Indiana Geographic Information Office |
| KS | SB 355, Ad Astra 2 | Kansas Legislative Research Department |
| KY | SB 3 of 2022 | Kentucky General Assembly |
| LA | SB 121 of 2026 (Act 2) | Louisiana Legislature |
| MA | Chapter 93 of the Acts of 2021 | MassGIS |
| MD | SB 1012 of 2022 | Redistricting Data Hub |
| ME | LD 1739 of 2021 | Maine Office of GIS |
| MI | Independent Citizens Redistricting Commission, Chestnut plan | State of Michigan GIS Open Data |
| MN | Court plan C2022 with the 2022 CD7/CD8 fix | Minnesota Legislative Coordinating Commission |
| MO | HB 2909 of 2022 | Redistricting Data Hub |
| MO (HB 1, geblokkeerd) | HB 1 of 2025 | Redistricting Data Hub |
| MS | HB 384 of 2022 | Redistricting Data Hub |
| MT | Districting and Apportionment Commission plan | Montana Districting and Apportionment Commission |
| NC | SL 2025-95 (SB 249) | North Carolina General Assembly |
| NE | LB 1 of 2021 | State of Nebraska GIS |
| NH | Special master plan | NH GRANIT |
| NJ | Congressional Redistricting Commission plan | New Jersey Office of GIS |
| NM | SB 1 of 2021 | New Mexico Legislature |
| NV | SB 1 of 2021 | Nevada Legislative Counsel Bureau |
| NY | 2024 plan | New York Legislative Task Force on Demographic Research and Reapportionment |
| OH | Ohio Redistricting Commission plan | Ohio Secretary of State |
| OK | HB 1002X of 2021 | Oklahoma House of Representatives |
| OR | SB 881 of 2021 | Oregon GEOHub |
| PA | Carter plan | Pennsylvania Legislative Reapportionment Commission |
| RI | S 2162 / H 7323 of 2022 | Rhode Island Department of State |
| SC | S. 865 of 2022 | South Carolina Senate |
| TN | HB 7003 / SB 7004 of 2026 | Tennessee Comptroller of the Treasury |
| TX | PLANC2333 (HB 4) | Texas Legislative Council |
| UT | Court-adopted Map 1 | Utah Geospatial Resource Center |
| VA | 2021 Supreme Court of Virginia plan | Virginia Division of Legislative Services |
| WA | Redistricting Commission plan as amended | Washington State Redistricting Commission |
| WI | Least-change plan, Johnson v. WEC | Wisconsin Legislative Technology Services Bureau |
| WV | SB 3033 of 2021 | West Virginia Legislature |

Twee kaartnamen vragen nog aandacht: "2024 plan" (NY) zegt weinig zonder wetsnummer, en Utah ("Map 1" of "Map 1A") volgt in taak 3.6.
