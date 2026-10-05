# Haalbaarheidscontrole van de dataketen

Uitgevoerd op 5 oktober 2026 in een tijdelijke map, niet in de pijplijn. Acht staten in zes testcases. Per testcase rekende één agent de hele keten door en een tweede agent rekende het onafhankelijk na met eigen scripts. Alle kerngetallen kwamen terug.

## Opzet

- Stemmen: ALARM census-vest-2020, per VTD (CA per blok, WV per county).
- Composiet: president 2016 + 2020, stemmen opgeteld (WV alleen 2020). Een district is Democratisch bij een aandeel boven 0,5.
- Huidige kaart: Census CD120-blokbestand (CD119 voor NV; voor NV, IA en WV zijn ze gelijk).
- Stemmen per VTD verdeeld over de blokken naar VAP uit P.L. 94-171, daarna opgeteld per district.
- Neutrale band: uit de ALARM-stats-bestanden, met dezelfde kolommen.

## Uitkomst

| Staat | Zetels | D-aandeel | Proportional | Neutral baseline (mediaan, 5e-95e) | Enacted | Enacted tegenover ensemble |
|---|---|---|---|---|---|---|
| NV | 4 | 51,3% | 2 | 3 (2-3) | 3 | 62% van de plannen gelijk, 0% meer |
| TX | 38 | 46,4% | 18 | 17 (15-20) | 11 | alle 5.000 plannen meer |
| CA | 52 | 65,4% | 34 | 45 (44-46) | 48 | 99,9% minder |
| IA | 4 | 45,4% | 2 | 1 (1-2) | 0 | 98,4% meer |
| WV | 2 | 30,2% | 1 | 0 (0-0) | 0 | alle plannen gelijk |
| UT | 4 | 38,7% | 2 | 1 (0-1) | 1 | 72% gelijk, 28% minder |
| NC | 14 | 48,8% | 7 | 6 (5-7) | 3 | 1 plan gelijk, de rest meer |
| LA | 6 | 40,2% | 2 | 1 (1-1) | 1 | 99,8% gelijk |

Dit zijn controlegetallen, geen eindresultaten. De pijplijn rekent ze straks opnieuw uit, met tests.

## Wat werkt

- Alle ALARM-eenheden in de acht staten zijn aan Census-blokken te koppelen, zonder verlies van stemmen.
- Opgetelde blok-VAP per eenheid is exact gelijk aan de VAP van ALARM, in elke staat. De staatstotalen kloppen drievoudig: blokken, ALARM en het staatsrecord in P.L. 94-171.
- De methode reproduceert ALARM's eigen referentiekaart. Met dezelfde blokmethode op de kaarten van 2022 (CD118- of CD119-blokbestand) komt het D-aandeel per district binnen 0,05 procentpunt van ALARM's `cd_2020` in de VTD-staten, en binnen 0,4 punt in TX en CA. Het aantal zetels is overal gelijk. Dit wordt een vaste test in de pijplijn.
- Verdelen over blokken tegenover een eenheid in zijn geheel aan één district toewijzen: hooguit 0,57 procentpunt verschil (TX-11), en in geen enkele staat een andere winnaar. Blokverdeling blijft de standaard omdat de stemtotalen per district dan kloppen; de eenvoudige methode wordt een controle.

## Valkuilen voor de pijplijn

- Plannummers lopen niet van 1 tot 5000. TX begint bij 2, NC springt van 2500 naar 10001, UT mist 2501 tot 3000. Selecteer simulaties met `draw != "cd_2020"`.
- Het stats-bestand slaat stemmen per district op als gehele getallen. Staatstotalen per plan wijken daardoor een paar stemmen af. Toets de afwijking van het totaal uit het eenhedenbestand, met een tolerantie van 0,5 maal het aantal districten.
- In CA liggen de totalen in het stats-bestand 0,005 tot 0,03% onder die van het blokbestand, zonder aanwijsbare oorzaak. Tolerantie nodig, en een notitie.
- GEOID's zijn tekst: koppeltekens (`32001008-03`) en `ZZZZZZ` komen voor. Nooit naar een getal omzetten.
- Eenheden zonder VAP maar met stemmen bestaan (NV 0,12%, UT 0,67% van de stemmen). Als zo'n eenheid gesplitst is, verdelen we naar aantal blokken en loggen we het.
- West Virginia: het VTD-bestand mist stemmen voor 13 county's (38% van de VAP). Voor WV moeten we ALARM's county-data uit `map.rds` lezen. Het pakket `rdata` doet dat zonder R. Er zijn ook geen kolommen voor 2016, dus de pijplijn heeft per staat een lijst verkiezingen nodig.
- California: twee blokken hebben lege stemvelden; zet die op 0. De stemmen per blok volgen de bevolking slecht, maar county-totalen kloppen en we gebruiken ze ongewijzigd.
- Toets vastgestelde kaarten niet op gelijke bevolking volgens P.L. 94-171. NV en CA tellen gevangenen anders mee en wijken daardoor tot 2,9% af.
- Het CD118-blokbestand heeft een spatie in de header (`GEOID, CDFP`).
- Gebruik geen bestandsgrootte om te zien of een kaart veranderd is. TX en CA hebben voor CD119 en CD120 even grote bestanden met verschillende inhoud.

## Lessen voor de weergave

- Het geografische effect kan beide kanten op. In CA ligt de neutrale band 11 zetels boven proportioneel: winner-take-all versterkt de grote meerderheid. In TX en NC ligt de band iets onder proportioneel.
- Een paar staten staan op het randje. In IA liggen drie districten binnen 2,5 punt van 50%, in NV en UT kantelen veel simulaties bij een kleine verschuiving. Toon daarom ook de stemaandelen per district, niet alleen zetels.
- Zetels vertellen niet alles. In UT geeft de vastgestelde kaart evenveel zetels als de meeste neutrale kaarten (1), maar het Democratische district is met 63% geconcentreerder dan in 89% van de plannen. Een grafiek met de districten gesorteerd op aandeel, tegen de band van de neutrale kaarten per positie, laat dat zien.
- Sommige ensembles liggen bijna vast door hun beperkingen. LA geeft in 99,8% van de plannen 1 zetel, door de VRA-beperking en het behoud van kernen. WV geeft altijd 0. De toelichting per staat moet dat zeggen.
- Op een basis van 2016-2020 blijven TX-15, TX-28 en TX-34 Democratisch, terwijl de kaart van 2025 op uitslagen van 2024 is getekend. Dat hoort bij de stembasis-noot.
