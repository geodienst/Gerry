# Herontwerp van de site

Datum: 8 oktober 2026. Status: goedgekeurd door de eigenaar op 8 oktober 2026, in de vorm van het mockup "Some votes are more equal than others" (`https://claude.ai/artifact/QTZMR7LLd5mZ4TgvM9hmo4`; bron `scratchpad/redesign/template.html` van de ontwerpsessie). De open punten in hoofdstuk 10 zijn nog niet beslist; het plan (`docs/superpowers/plans/2026-10-08-redesign.md`, fase 7) volgt daar de aanbeveling, zodat geen taak erop hoeft te wachten.

Dit ontwerp vervangt de indeling van het siteontwerp (`2026-10-06-site-design.md`, hoofdstuk 1, 2 en 8 en de punten in het blok "Bijgewerkt na feedback" die over indeling, kop en "How to read this" gaan). Wat dit ontwerp niet noemt, blijft zoals het siteontwerp het vastlegt: kleuren van de kaart en de legenda's (hoofdstuk 3), kaart en interactie (hoofdstuk 4, met zoom, `#TX` in de link, tooltip en tikregel), effecten met richting ("R+6 · 6 seats toward Republicans"), de methodetekst (hoofdstuk 9 zoals taak 6.8 en 6.10 hem schreven), de bronlabels (hoofdstuk 10) en de voet met de Geodienst. De vaste eisen uit CLAUDE.md gelden onverkort: één statische pagina, geen verzoeken naar derden, d3 en topojson-client uit `site/vendor/`, systeemletters, Engelse interface met de labels "Proportional", "Neutral baseline" en "Enacted", geen em-dashes, alle zichtbare tekst door de unslop-skill, alle getallen via `site/js/format.js`.

## 1. Doel

Een vakgenoot las de huidige site en vond de begrippen onduidelijk. Bovenaan stonden drie getallen in één zin, met daaronder een uitklapblok "How to read this" dat Texas als rekenvoorbeeld gebruikte. Wie het blok oversloeg, wist niet wat "neutral" of "drawing effect" betekende; wie het las, moest de uitleg van één staat zelf naar het landelijke beeld vertalen.

Het herontwerp legt de uitleg in de opbouw zelf. Hoofdstuk 01 toont het landelijke verhaal als drie rijen met dezelfde stemmen, de twee verschillen ertussen met naam, en een wafel van 429 zetels die bij elke rij verkleurt. Daarna komen de staten (02), wat de kaarten beslissen (03) en de methode (04).

Besluiten van de eigenaar die hier gelden:

- Titel "Some votes are more equal than others" (7 oktober 2026, ongewijzigd).
- Het blok "How to read this" vervalt; hoofdstuk 01 neemt de uitleg over (8 oktober 2026).
- Toon sober en zakelijk. Geen regels die een kant kiezen of de lezer iets willen laten voelen; de getallen spreken. Het mockup bevat geen geladen zinnen en dat blijft zo.
- Het mockup is de goedgekeurde vorm voor indeling, kleur en typografische hiërarchie. Teksten in het mockup zijn voorbeelden; de definitieve teksten staan in hoofdstuk 3 tot en met 6 hieronder en gaan door de unslop-skill.

## 2. Indeling

Van boven naar beneden, elk deel over de volle breedte van het venster met de inhoud in een kolom van maximaal 83rem (zie open punt 8):

1. **Kopband** (`header.mast`). Donkergroene band met een bovenregel "U.S. House maps for November 3, 2026", de titel en één zin: "Same votes, three ways to count the U.S. House: in proportion to the votes, on neutral maps, and on the maps of 2026." Die zin is ook de `meta description`.
2. **Metastrook** (`.metastrip`). Drie korte velden naast elkaar, onder elkaar onder 720 pixels: Scope "U.S. House, 429 seats in 44 states" (getallen uit `results.json`), Votes "2016 + 2020 presidential, held constant", Question "How much do geography and map drawing change the seats?".
3. **01 One electorate. Three outcomes.** (`section#outcomes`). Hoofdstuk 3.
4. **02 State by state** (`section#states`). Hoofdstuk 4.
5. **03 What the maps decide** (`section#decide`). Hoofdstuk 5.
6. **04 Method, scope and uncertainty** (`section#method`). Hoofdstuk 6.
7. **Voet.** Hoofdstuk 6.

Elk hoofdstuk heeft dezelfde kop (`.chead`): een nummer in een kader, de titel in de serif, en één regel uitleg in `--muted`.

## 3. Hoofdstuk 01: drie uitkomsten met dezelfde stemmen

Uitleg onder de kop: "Democratic seats in the 44 states with more than one seat, counted three ways with the same votes. Select a row to see it as seats."

**Drie rijen** (links, 23rem breed; onder 880 pixels boven de wafel). Een `radiogroup` met drie knoppen (`role="radio"`), elk met label, groot getal en één regel:

| Rij | Getal | Regel |
|---|---|---|
| Proportional | 224 | Each state's seats in proportion to its two-party vote. |
| Neutral baseline | 223 | The middle outcome of the neutral maps. 90% of outcomes: 217 to 229. |
| Enacted | 213 | The maps used on November 3, 2026. |

Tussen de rijen staan de twee verschillen als smalle tussenregel: "Geographic effect **R+1**: 1 seat toward Republicans" tussen de eerste en de tweede rij, "Drawing effect **R+10**: 10 seats toward Republicans" tussen de tweede en de derde. Zo staat elk effect letterlijk tussen de twee getallen waarvan het het verschil is. Bij het laden is Enacted gekozen.

**De wafel** (rechts). 429 vierkantjes, één per zetel, in 13 rijen en 33 kolommen, kolom voor kolom gevuld van linksboven: eerst de Democratische zetels in `--party-d`, dan de Republikeinse in `--party-r`. Boven de kolom waar de Democratische zetels eindigen staat een streepje met het getal. Daarboven een regel met "Democrats 213" en "Republicans 216" (`aria-live="polite"`). Bij de rij Neutral baseline krijgen de zetels 217 tot en met 229 een omlijning: daar eindigt het Democratische aantal in 90% van de neutrale uitkomsten. De legenda eronder: "Democratic seat", "Republican seat", bij Neutral baseline "Outlined: seats 217 to 229, where the Democratic seats end in 90% of neutral outcomes", en "1 square = 1 seat, Democrats first". Kiezen van een andere rij verkleurt de vierkantjes die wisselen, met een korte vertraging per vierkantje vanaf de grens; met `prefers-reduced-motion` zonder overgang.

**Bevindingen** (onder rijen en wafel, twee kolommen, onder 880 pixels één):

- Links de twee effecten, elk als label, notatie en woorden met de getallen waartussen ze liggen: Geographic effect, R+1, "1 seat toward Republicans (224 to 223)"; Drawing effect, R+10, "10 seats toward Republicans (223 to 213)". Daaronder: "The geographic effect is the difference between proportional seats and neutral maps. The drawing effect is the difference between neutral maps and the enacted maps."
- Rechts de spreiding en wat neutraal betekent: "90% of neutral outcomes give Democrats 217 to 229 seats. The enacted maps give 213, below that range." (bij een uitkomst in de band "within that range", erboven "above that range"); de positie uit de huidige strook ("In more than 99% of neutral outcomes Democrats win more seats than under the enacted maps."); "The neutral maps come from the ALARM Project. For each state a computer drew 5,000 maps that follow the state's rules, such as equal population and the Voting Rights Act, without using party data. The national figures combine the 44 states."; en de regel over de zes staten met één zetel uit de huidige strook.

Alle getallen komen uit `results.json` (`national`); de zinnen maakt `chapters.js` (een nieuwe pure module, zie hoofdstuk 9).

## 4. Hoofdstuk 02: staat voor staat

Uitleg onder de kop: "The drawing effect of each state: Democratic seats on the enacted map minus the neutral baseline, the median of the state's neutral maps."

**Werkbalk.** Het keuzemenu State (alle 50 staten, de zes met één zetel als "Wyoming (one seat)", zie open punt 6), de knop tussen "States: drawing effect" en "Districts: Democratic share" (staten eerst en standaard, zoals het mockup), en de knop "Party colors / Neutral colors" (open punt 7).

**Grootste effecten, zonder weglatingen.** Een regel "Drawing effects of 3 seats or more" met een knop per staat die minstens 3 zetels verschuift, gesorteerd op grootte, bij gelijke grootte eerst richting Republikeinen, dan op naam: TX R+6, FL R+4, NC R+3, CA D+3, IL D+3. Daarna één zin die de rest telt: "Then 13 states at 1 or 2 seats either way, and 26 states at 0." Er is geen top vijf: elke staat boven de drempel staat erin, en de zin noemt hoeveel staten eronder blijven. Een knop kiest de staat.

**Kaart.** De kaart van de huidige site, ongewijzigd in gedrag: zoom met Ctrl of Cmd en scrollen, twee vingers op een aanraakscherm, de knoppen "+", "−" en "All", slepen, tooltip met de muis, tikregel onder de kaart, de hint, de legenda, de omlijning van de gekozen staat, `#TX` in de link en de terugknop.

**Staatsblad** (rechts van de kaart vanaf 900 pixels, minstens 22rem en anders 30% breed; smaller eronder). Zonder gekozen staat de lijst "Drawing effect by state" van de huidige site, met de ingeklapte nulstaten en het saldostaafje (open punt 5). Met een gekozen staat, in deze volgorde, alles wat het huidige blad toont:

1. De knop "All states", de bovenregel "State record" en de naam.
2. Kaartnaam, statuslabel ("In effect", "Challenged in court", "Blocked"), "Legal status as of <datum>", aantal zetels; "Adopted by: Legislature (Republican control)." met de noot als die er is.
3. De kopregel: het tekeneffect groot met een vakje in de kleur van de kaart, en één zin: "6 seats toward Republicans compared with the neutral baseline." of "No difference from the neutral baseline."
4. "Democratic seats of 38.", de drie getallen (Proportional met het stemaandeel, Neutral baseline met de band, Enacted met "inside/outside the neutral band"), en de zetelstrook: drie rijen op één as van 0 tot het aantal zetels, de neutrale rij met de band van het 5e tot het 95e percentiel, Enacted als volle stip. De strook vervangt de zetelas met staafjes (open punt 4).
5. Geographic effect en Drawing effect met notatie, woorden en uitleg tussen haakjes.
6. De positie: "Of the 5,000 neutral maps, 0% give fewer Democratic seats than the enacted map, 0% the same number and 100% more."
7. Alleen Missouri: het blok "Blocked map" met HB 1, statuslabel, zetels, positie en "Map file:".
8. "Districts, sorted": de gesorteerde districtsgrafiek met onderschrift.
9. Concurrerende districten en de hertekening sinds 2024.
10. "Other measures": efficiency gap en mean-median met neutrale context ("Not defined for two districts" bij twee districten).
11. "Notes": alle noten van de staat, waaronder de noten over de Voting Rights Act.
12. "Map file:" met de bron.

Een staat met één zetel krijgt een kort blad: naam, "1 seat", "One at-large seat. No districts, so nothing to compare." en "Not counted in the 429 seats compared here."

## 5. Hoofdstuk 03: wat de kaarten beslissen

Uitleg onder de kop: "The same votes, read for control of the House and the Senate, for redraws since 2024 and for close districts."

Een raster van kaarten (vier kolommen vanaf 1280 pixels, twee tot 640, daaronder één), met lijnen van 1 pixel ertussen. Het mockup ging al bij 1080 pixels naar vier kolommen; dan wordt een smalle kaart te smal om de tekst in haar grafiek op 10 pixels te houden.

- **House majority** (twee kolommen breed). De zin uit `majorityView` ("With these votes, Democrats need 52.3% of the two-party vote for a House majority under the enacted maps, ..."), een stemas met drie rijen (Proportional, Neutral baseline met band, Enacted als volle stip, elk met het aandeel ernaast) en een gestippelde lijn op het werkelijke aandeel met "Vote 51.8%". Het domein loopt op hele procenten om de waarden heen (nu 49% tot 53%). Daaronder de vaste regel over de zes staten met één zetel en, als het geldt, de zin over Proportional onder 50%.
- **Senate on the same votes.** Drie getallen ("52.9%" needed for a majority, "51.7%" Democratic share, "22" states won, 26 needed), de zin en de noot uit `senateView`, die zegt dat dit geen effect van kaarten is.
- **Competitive districts.** Twee getallen (81 enacted maps, 96 neutral median), een as met twee rijen (Neutral baseline met band 87 tot 105, Enacted) op stappen van 5, en de regel uit `competitiveText`.
- **Redraws since 2024** (twee kolommen breed). "217 to 213" (Democratic seats, 2024 maps to 2026 maps) en "R+4" (4 seats toward Republicans), de zin uit `redrawView` en de lijst van staten met een andere uitkomst in twee kolommen.
- **By political control** (twee kolommen breed). De twee tabellen van de huidige site naast elkaar (onder 520 pixels onder elkaar) met hun noot.

De teksten zijn die van de huidige site; nieuw zijn alleen de korte labels bij de grote getallen.

## 6. Hoofdstuk 04 en de voet

Onder de kop "Method, scope and uncertainty" één ingeklapt blok (`details`) met de samenvatting "How the three numbers are made" en, kleiner, "Votes, neutral maps, the Voting Rights Act, known limits, sources". Uitgeklapt staat de hele methodetekst van de huidige site, woord voor woord: "How to read the three numbers", "Why neutral maps are not proportional", "Votes", "The Voting Rights Act", "Neutral maps that keep old district cores", "The national band", "Extensions", "Known limits" (de tien punten) en "Sources". Feiten en getallen veranderen niet. Onder "The national band" komt de landelijke zetelas met de verdeling van de neutrale uitkomsten als figuur (open punt 3). Een link naar `#method` klapt het blok open.

De voet: "Data generated <datum>. Legal status as of <datum>. ALARM dataset version 15.", de licenties van D3 en topojson-client, en rechts het logo van de Geodienst met "Geodienst, University of Groningen" als één link naar https://rug.nl/geo (open punt 9). In de donkere modus staat het logo op een licht rondje, zoals nu.

## 7. Tokens en typografie

Het palet van het mockup, in de tokennamen van de huidige site. Zo blijven `main.js` (dat `--party-d`, `--party-r`, `--neutral-d`, `--neutral-r`, `--mid` en `--blank` leest) en `charts.js` (dat `--band`, `--fg`, `--muted` en `--sheet` gebruikt) ongewijzigd. Vier tokens zijn nieuw.

| Token | Licht | Donker | Gebruik | Mockup |
|---|---|---|---|---|
| `--bg` | `#f1f3f0` | `#0f1513` | pagina | `--paper` |
| `--sheet` | `#fbfcfa` | `#151d1a` | metastrook, rijen, blad, kaarten | `--sheet` |
| `--fg` | `#18201c` | `#e6ece8` | tekst | `--ink` |
| `--muted` | `#56615b` | `#9eaba4` | labels, assen | `--muted` |
| `--rule` | `#d3d9d4` | `#2a3531` | lijnen | `--rule` |
| `--ink` | `#1d5c48` | `#8fd0b4` | knoppen, links, focus, nummers | `--accent` |
| `--tint` (nieuw) | `#e2ebe5` | `#1c2a25` | gekozen rij, gekozen staat | `--tint` |
| `--mast` (nieuw) | `#143a2f` | `#0b2920` | kopband | `--band` |
| `--mast-fg` (nieuw) | `#eef4f0` | `#e6efe9` | tekst in de kopband | `--band-ink` |
| `--mast-muted` (nieuw) | `#b2c8bd` | `#9ab8aa` | bovenregel in de kopband | `--band-muted` |
| `--party-d` / `--party-r` | `#2a78d6` / `#e34948` | `#3987e5` / `#e66767` | partijkleuren, wafel | `--d` / `--r` |
| `--neutral-d` / `--neutral-r` | `#01665e` / `#8c510a` | `#5ab4ac` / `#d8b365` | neutrale kleuren | (niet in het mockup) |
| `--mid` | `#ecebe7` | `#3a3a37` | middenpunt van de schalen | `--mid` |
| `--blank` | `#c9ccd1` | `#4a4f56` | staten met één zetel | `--blank` |
| `--water` | `#e5eae6` | `#1b2421` | achtergrond van de kaart | (aangepast aan `--bg`) |
| `--band` | `rgba(29, 92, 72, 0.14)` | `rgba(143, 208, 180, 0.16)` | band in de grafieken | (afgeleid van `--ink`) |

De polen en `--mid` en `--blank` zijn dezelfde als nu; alleen de neutrale tinten van de pagina verschuiven naar het groenige papier van het mockup. Berekend contrast (WCAG 2): tekst `--muted` op `--sheet` 6,27:1 licht en 7,21:1 donker, op `--tint` 5,30:1 en 6,26:1, op `--bg` 5,78:1 en 7,75:1; `--ink` op `--sheet` 7,62:1 en 9,69:1 (ook omgekeerd, voor de ingedrukte knoppen); `--mast-fg` op `--mast` 11,24:1 en 13,23:1, `--mast-muted` op `--mast` 7,09:1 en 7,25:1. Markeringen: `--party-d` en `--party-r` op `--bg` (de wafel) 3,96:1 en 3,54:1 licht, 5,08:1 en 5,72:1 donker; de staafjes van de zetelas 3,55:1 en 4,66:1; `--fg` op `--water` 13,66:1 en 13,27:1. Alles haalt 4,5:1 voor tekst en 3:1 voor markeringen.

Dark mode volgt alleen de instelling van het systeem (`prefers-color-scheme`), zoals nu; de `data-theme`-schakelaar uit het mockup komt niet op de site.

**Letters.** Het mockup gebruikt Merriweather en Public Sans van Google Fonts; de site laadt geen lettertypebestanden. Koppen, de titel en de grote getallen in de serif van het systeem, `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` (de huidige `--font-head`); al het andere in `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (de huidige `--font-body`). Deze serifs hebben geen 900; de titel en de grote getallen krijgen 700. Tabulaire cijfers in rijen, tabellen, wafel en assen. De basisgrootte groeit zoals nu van 15 pixels tot 21 pixels op grote schermen; maten in rem.

## 8. Toegankelijkheid

- **Rijen van 01.** `role="radiogroup"` met `aria-label="Way of counting"`; elke rij `role="radio"` met `aria-checked`. Eén tabstop (de gekozen rij, `tabindex="0"`, de andere `-1`). Pijl omlaag en rechts kiezen de volgende rij, omhoog en links de vorige, met doorlopen; Home en End de eerste en de laatste. Kiezen verplaatst de focus mee.
- **Live regions.** De regel boven de wafel (`#readout`) is `aria-live="polite"`; de wafel zelf is `role="img"` met een titel die de gekozen rij in getallen noemt ("Enacted: 213 Democratic and 216 Republican seats of 429."). Het blad houdt `#sheet-status` zoals nu.
- **Contrast.** Minstens 4,5:1 voor tekst en 3:1 voor markeringen, in licht en donker, vastgelegd in `style.test.js` (hoofdstuk 7).
- **Beweging.** Met `prefers-reduced-motion` geen overgang in de wafel en geen animatie bij het zoomen, zoals nu.
- **Grafieken.** Elke grafiek heeft `role="img"` en een beschrijving met de getallen. Tekst in grafieken is op het scherm minstens 10 pixels, ook in de wafel op 375 pixels.
- **Toetsenbord verder zoals nu.** Het keuzemenu en de knoppen bereiken elke staat; de vlakken van de kaart zijn geen tabstops; Escape gaat van het blad terug naar de lijst; zichtbare focus in `--ink`.

## 9. Wat blijft en wat vervalt

**Blijft:**

- De staat in de link (`#TX`), de terugknop, en de ankers naar onderdelen. Nieuw: `#method` klapt de methode open.
- De pure modules en hun tests: `format.js`, `colors.js`, `hash.js`, `axes.js`, `model.js`, `extensions.js`. Ze krijgen kleine uitbreidingen met eigen tests (`hash.js` en `model.js` een optioneel argument voor de staten met één zetel, `axes.js` de geometrie van wafel en stippenrijen). Nieuw is `chapters.js` met de weergavemodellen van de vier hoofdstukken, met `chapters.test.js`.
- De DOM-modules `map.js`, `charts.js` en `sheet.js`, aangepast. Nieuw: `outcomes.js` (hoofdstuk 01) en `decide.js` (hoofdstuk 03). `national.js` vervalt.
- Het datacontract: `site/data/results.json`, `site/data/map.topojson` en `contract.test.js` veranderen niet. De pijplijn verandert niet.
- De headless controle (`tools/check_site.mjs`) met de groepen in `tools/site_checks.mjs`, per hoofdstuk bijgewerkt; `page.test.js` (alleen eigen bestanden, geen em-dashes, onder 1,5 MB) en `style.test.js` (tokens en contrast).

**Vervalt:**

- Het blok "How to read this" en `explainerView` met zijn tests. Hoofdstuk 01 doet dit werk voor het hele land in plaats van voor één staat.
- De regel met kerncijfers onder de kop (`nationalView().keyline`) en de links "National picture" en "Method" erin.
- De landelijke strook met de klokvormige zetelas. Drie getallen, effecten en positie gaan naar 01; de zetelas wordt een figuur in de methode (open punt 3). De blokken van de uitbreidingen gaan naar 03.
- De stemas met markeringen boven de as (`drawVoteAxis`, `VOTE_AXIS`, `voteDomain`, `voteTicks`), vervangen door de stippenrijen van 03.
- In het staatsblad de staafjes van de zetelas (open punt 4).

## 10. Open punten voor de eigenaar

Het plan volgt bij elk punt de aanbeveling. Een ander besluit raakt alleen de genoemde taak.

1. **Labels van de drie rijen.** Het mockup noemt ze "Vote-proportional", "Neutral-map median" en "Enacted maps"; CLAUDE.md legt "Proportional", "Neutral baseline" en "Enacted" vast. Aanbeveling: de labels van CLAUDE.md, met de regel eronder als uitleg. Wie de labels van het mockup wil, past eerst CLAUDE.md aan; in de code zijn het drie tekenreeksen in `chapters.js` (taak 7.3).
2. **Namen van de twee effecten.** Het mockup zegt "Geography" en "Map drawing" in 01 en "drawing effect" in 02. Aanbeveling: overal "Geographic effect" en "Drawing effect", de namen uit de methode, het blad en de kaartknop. Eén naam per begrip helpt juist de lezer die over onduidelijke termen viel. Alternatief: de woorden van het mockup in 01 (twee tekenreeksen in `chapters.js`, taak 7.3).
3. **De landelijke zetelas.** Aanbeveling: als figuur in de methode onder "The national band", met het bestaande onderschrift; de figuur laat zien hoe de band van 217 tot 229 ontstaat. Alternatief: weglaten (in taak 7.10 vervallen dan de figuur in Step 2 en het tekenen ervan in Step 3).
4. **De staafjes in het staatsblad.** De strook met drie rijen vervangt de zetelas met staafjes per zetelaantal; de positiezin houdt de verdeling in woorden. Aanbeveling: zo. Alternatief: de zetelas met staafjes onder de strook laten staan (`drawSeatAxis` bestaat nog; taak 7.8).
5. **Het blad zonder gekozen staat.** Het mockup opent op Texas. Aanbeveling: zonder `#` in de link de lijst "Drawing effect by state" van nu, met alle 44 staten en het saldostaafje; die lijst is de enige plek met elke staat op volgorde. Alternatief: openen op Texas (taak 7.7).
6. **Staten met één zetel kiezen.** Nu kiest een klik op Wyoming niets. Aanbeveling: zoals het mockup in het keuzemenu, ook via de kaart en `#WY`, met het korte blad uit hoofdstuk 4 (taak 7.4 en 7.8).
7. **De knop "Party colors / Neutral colors".** Het mockup heeft hem niet; het siteontwerp (hoofdstuk 3) besloot hem wel. Aanbeveling: houden, rechts in de werkbalk. Alternatief: weglaten met de tokens `--neutral-d` en `--neutral-r` (taak 7.7).
8. **Breedte op grote schermen.** Het mockup stopt bij 1240 pixels; het siteontwerp schrapte die grens (wel 2400 pixels) en liet alles meeschalen. Aanbeveling: een kolom van maximaal 83rem, wat bij 15 pixels gelijk is aan 1245 pixels en met de basisgrootte meegroeit tot ongeveer 1700 pixels op 2560 pixels breed (taak 7.6).
9. **Tekst bij het logo.** Het besluit van 7 oktober zegt "Geodienst", het mockup "Geodienst, University of Groningen". Aanbeveling: het mockup, omdat de naam van de universiteit zegt wie de Geodienst is (taak 7.10).
