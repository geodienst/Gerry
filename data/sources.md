# Map sources and status by state

Status checked on 2026-10-03. Check again right before publishing.

The tables list the congressional map that governs the general election of November 3, 2026 for every state, whether it differs from the map used in November 2024, its legal status, and the file the pipeline uses. Each map name links to the official source.

Status values, used exactly as written so the pipeline can compare them with `pipeline/config.yaml`. They describe the legal status of a map and are separate from the scenario label "Enacted" on the site:

- In effect: no pending challenge found.
- Challenged: in effect, litigation pending.
- Blocked: adopted, but a court or a referendum keeps it from being used.
- At-large: one seat, no districts.

Pipeline file: `CD120` is the Census 120th Congress block equivalency file (2026-08-31). `CD118` is the 118th Congress file (the 2022 maps). For the 34 states without a new map, CD120 and the 2024 file (CD119) are identical.

Where a note says "No state-specific 2026 source", the status rests on the Census CD120 file, which lists the states with new maps, and on national trackers from late September 2026.

## Multi-seat states

| State | Seats | Map for Nov 3, 2026 | New since Nov 2024 | Adopted | By | Status | Pipeline file | Notes and litigation |
|---|---|---|---|---|---|---|---|---|
| AL | 7 | [Livingston Congressional Plan 3-2023](https://www.sos.alabama.gov/sites/default/files/2026-5-14/Livingston%20Congressional%20Plan%203-2023%20Legal%20Description.pdf) | Yes | 2023-07-21 | Legislature | Challenged | CD120 | First used in 2026. Allen v. Milligan and related cases: district court injunction 2026-05-26, stayed by the Supreme Court 2026-06-02 (No. 25A1314). Retrial expected by January 2027 |
| AZ | 9 | [Independent Redistricting Commission map v14.0](https://redistricting-irc-az.hub.arcgis.com/pages/official-maps) | No | 2021-12-22 | Commission | In effect | CD120 | A threatened post-Callais suit was dropped 2026-08-10 |
| AR | 4 | [Acts 1114 and 1116 of 2021](https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Boundaries/FeatureServer/6) | No | 2021-10-13 | Legislature | In effect | CD120 | No state-specific 2026 source. Christian Ministerial Alliance v. Jester, judgment for the state June 2025 |
| CA | 52 | [AB 604 (Proposition 50)](https://aelc.assembly.ca.gov/proposed-congressional-map) | Yes | 2025-08-21, approved by voters 2025-11-04 | Legislature and ballot measure | Challenged | CD120 | Tangipa v. Newsom, consolidated with Noyes v. Newsom. Preliminary injunction denied 2026-01-14. Supreme Court denied an injunction 2026-02-04 (No. 25A839). Motions to dismiss pending |
| CO | 8 | [Independent Congressional Redistricting Commission plan](https://redistricting.colorado.gov/content/congressional-final-approved) | No | 2021-11-01 | Commission, approved by the Colorado Supreme Court | In effect | CD120 | Census splits one block (080010096072000) and assigns it to district 08 |
| CT | 5 | [Special master plan](https://www.cga.ct.gov/rr/tfs/20210401_2021%20Redistricting%20Project/cmaps.asp) | No | 2022-02-10 | Court | In effect | CD120 | Ingersoll v. Connecticut dismissed 2026-01-20. Appeal status unknown |
| FL | 28 | [EOGPCRP2026 (HB 1-D)](https://www.flsenate.gov/Session/Redistricting/Congressional) | Yes | 2026-05-04 | Legislature | Challenged | CD120 | Equal Ground Education Fund v. Byrd and related cases, Leon County. Preliminary injunction denied 2026-05-26. Florida Supreme Court declined review 2026-06-10 (some reports say June 11). Jury trial denied 2026-09-03, merits pending |
| GA | 14 | [December 2023 remedial plan (SB 3EX)](https://www.legis.ga.gov/joint-office/reapportionment) | No | 2023-12-08 | Legislature, court-ordered remedy | Challenged | CD120 | Alpha Phi Alpha, Pendergrass and Grant v. Raffensperger. 11th Circuit vacated the liability rulings and remanded 2026-08-25, citing Callais. The plan stays in use for 2026 |
| HI | 2 | [Reapportionment Commission plan](https://elections.hawaii.gov/about-us/boards-and-commissions/reapportionment/) | No | 2022-01-28 | Commission | In effect | CD120 | No state-specific 2026 source |
| ID | 2 | [Commission for Reapportionment plan](https://legislature.idaho.gov/redistricting/2021/) | No | 2021-11-10 | Commission | In effect | CD120 | No state-specific 2026 source. Pentico v. Denney, upheld 2022-02-11 |
| IL | 17 | [HB 1291 of 2021](https://redistrictingdatahub.org/dataset/2021-illinois-congressional-districts-approved-plan/) | No | 2021-11-23 | Legislature | Challenged | CD120 | Ives v. Pritzker (C.D. Ill., filed 2026-05-08). Motions to dismiss briefed 2026-08-07, no ruling found |
| IN | 9 | [HEA 1581 of 2021](https://gisdata.in.gov/server/rest/services/Hosted/Congressional_Districts_of_Indiana_Current/FeatureServer) | No | 2021-10-04 | Legislature | In effect | CD120 | A redraw (HB 1032) failed in the Senate 2025-12-11 |
| IA | 4 | [SF 621, LSA Plan 2](https://services2.arcgis.com/KhKjlwEBlPJd6v51/arcgis/rest/services/RedistrictingPlan2/FeatureServer) | No | 2021-11-04 | Legislature, nonpartisan staff plan | In effect | CD120 | Keeps all 99 counties whole |
| KS | 4 | [SB 355, Ad Astra 2](https://klrd.gov/redistricting/enacted-plans-2022/) | No | 2022-02-09 | Legislature, veto overridden | In effect | CD120 | Rivera v. Schwab, upheld 2022-05-18. A 2025-2026 redraw push failed |
| KY | 6 | [SB 3 of 2022](https://apps.legislature.ky.gov/record/22RS/sb3.html) | No | 2022-01-20 | Legislature, veto overridden | In effect | CD120 | Graham v. Adams, upheld 2023-12-14 |
| LA | 6 | [SB 121 of 2026 (Act 2)](https://redist.legis.la.gov/) | Yes | 2026-05-29 | Legislature | Challenged | CD120 | Louisiana v. Callais, Supreme Court 2026-04-29, struck the 2024 map. Remedial review in Callais v. Landry (W.D. La.), hearing 2026-06-17, no ruling found. Open primary Nov 3, runoff Dec 12, 2026 |
| ME | 2 | [LD 1739 of 2021](https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/MaineVotingDistricts2021USCongress/FeatureServer) | No | 2021-09-29 | Legislature | In effect | CD120 | No state-specific 2026 source |
| MD | 8 | [SB 1012 of 2022](https://redistrictingdatahub.org/dataset/2021-maryland-us-congressional-adopted-plan/) | No | 2022-04-04 | Legislature | In effect | CD120 | A 2026 redraw (HB 488) died in the Senate. A constitutional amendment (Question 3, Nov 3, 2026) could affect 2028 at the earliest |
| MA | 9 | [Chapter 93 of the Acts of 2021](https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/Congress118/FeatureServer) | No | 2021-11-22 | Legislature | In effect | CD120 | No state-specific 2026 source |
| MI | 13 | [Independent Citizens Redistricting Commission, Chestnut plan](https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/michigan_geographic_framework/MapServer/23) | No | 2021-12-28 | Commission | In effect | CD120 | No suit since 2022 |
| MN | 8 | [Court plan C2022 with the 2022 CD7/CD8 fix](https://gis.lcc.mn.gov/redist2020/cong20.php?plname=C2022&pltype=court) | No | 2022-02-15, fix 2022-06-02 | Court panel, small legislative fix | In effect | CD120 | No state-specific 2026 source |
| MS | 4 | [HB 384 of 2022](https://redistrictingdatahub.org/dataset/2022-mississippi-congressional-districts-approved-plan/) | No | 2022-01-24 | Legislature | In effect | CD120 | The governor plans a redraw after the 2026 election |
| MO | 8 | [HB 2909 of 2022](https://redistrictingdatahub.org/dataset/2022-missouri-congressional-districts-approved-plan/) | No | 2022-05-18 | Legislature | In effect | CD118 | In effect for 2026 by court order; see the blocked map below. von Glahn v. Hoskins, Missouri Supreme Court 2026-09-03. Supreme Court stays 2026-09-10 and 2026-09-25 (Nos. 26A326 and 26A388). The August 2026 primary used HB 1 lines |
| MT | 2 | [Districting and Apportionment Commission plan](https://mtredistricting.gov/congressional-maps/) | No | 2021-11-12 | Commission | In effect | CD120 | No state-specific 2026 source |
| NE | 3 | [LB 1 of 2021](https://gis.ne.gov/Enterprise/rest/services/PoliticalBoundaries_2021/FeatureServer/1) | No | 2021-09-30 | Legislature | In effect | CD120 | No state-specific 2026 source |
| NV | 4 | [SB 1 of 2021](https://services9.arcgis.com/UU5yXg9PV67U0ebq/arcgis/rest/services/2021Congressional_Final_SB1_Amd2/FeatureServer) | No | 2021-11-16 | Legislature | In effect | CD120 | No state-specific 2026 source. Koenig v. Nevada, dismissed 2022-06-16 |
| NH | 2 | [Special master plan](https://ftp.granit.unh.edu/GRANIT_Data/Vector_Data/Administrative_and_Political_Boundaries/d-congressional/) | No | 2022-05-31 | Court | In effect | CD120 | Redraw bills dropped in January 2026 |
| NJ | 12 | [Congressional Redistricting Commission plan](https://njogis-newjersey.opendata.arcgis.com/datasets/2d5a9cbb86da4519899ff56e4d094f4c_1/about) | No | 2021-12-22 | Commission | In effect | CD120 | |
| NM | 3 | [SB 1 of 2021](https://www.nmlegis.gov/Redistricting2021/Maps_And_Data) | No | 2021-12-17 | Legislature | In effect | CD120 | No state-specific 2026 source. Republican Party of N.M. v. Toulouse Oliver, upheld 2023-11-27 |
| NY | 26 | [2024 plan](https://latfor.state.ny.us/maps/?sec=2024_congress) | No | 2024-02-28 | Legislature | In effect | CD120 | Williams v. N.Y. State Bd. of Elections: NY-11 struck 2026-01-21, Supreme Court stay 2026-03-02, dismissed 2026-03-19 |
| NC | 14 | [SL 2025-95 (SB 249)](https://webservices.ncleg.gov/ViewBillDocument/2025/7669/0/SL%202025-95%20-%20Block%20Assignment%20File) | Yes | 2025-10-22 | Legislature | Challenged | CD120 | Only districts 1 and 3 changed. Williams v. Hall: preliminary injunction denied 2025-11-26, dismissed 2026-01-16. Gallop v. Hirsch: dismissal recommended 2026-07-13, pending |
| OH | 15 | [Ohio Redistricting Commission plan](https://www.ohiosos.gov/assets/uscongressionaldistricts-2026-2032-adopted-2025-10-31-equivalencyfile.xlsx) | Yes | 2025-10-31 | Commission | In effect | CD120 | No suit found |
| OK | 5 | [HB 1002X of 2021](https://www.arcgis.com/home/item.html?id=7aeb90448393499c8367cd426ff511d1) | No | 2021-11-22 | Legislature | In effect | CD120 | No state-specific 2026 source |
| OR | 6 | [SB 881 of 2021](https://geohub.oregon.gov/datasets/oregon-geo::congressional-districts) | No | 2021-09-27 | Legislature | In effect | CD120 | Clarno v. Fagan, upheld 2021-11-24 |
| PA | 17 | [Carter plan](https://www.redistricting.state.pa.us/maps/) | No | 2022-02-23 | Court | In effect | CD120 | No state-specific 2026 source. Carter v. Chapman, 2022 |
| RI | 2 | [S 2162 / H 7323 of 2022](https://services3.arcgis.com/KZcv0G0UvX0bPG3L/arcgis/rest/services/RI_Congressional_Districts_as_of_2022_/FeatureServer) | No | 2022-02-16 | Legislature | In effect | CD120 | No state-specific 2026 source |
| SC | 7 | [S. 865 of 2022](https://redistricting.scsenate.gov/) | No | 2022-01-26 | Legislature | In effect | CD120 | Alexander v. S.C. NAACP, Supreme Court 2024-05-23. A 2026 redraw (H. 5683) failed in the Senate 2026-05-26 |
| TN | 9 | [HB 7003 / SB 7004 of 2026](https://comptroller.tn.gov/maps/u-s--congress-districts.html) | Yes | 2026-05-07 | Legislature | Challenged | CD120 | Sherman v. Hargett: preliminary injunction denied 2026-07-23. Tennessee NAACP v. Hargett pending |
| TX | 38 | [PLANC2333 (HB 4)](https://data.capitol.texas.gov/dataset/planc2333) | Yes | 2025-08-29 | Legislature | Challenged | CD120 | LULAC v. Abbott: preliminary injunction 2025-11-18, stayed by the Supreme Court 2025-12-04 (No. 25A608), summary reversal 2026-04-27 (No. 25-845). Merits pending |
| UT | 4 | [Court-adopted Map 1](https://gis.utah.gov/products/sgid/political/us-congressional-districts/) | Yes | 2025-11-10 | Court | Challenged | CD120 | League of Women Voters of Utah v. Utah State Legislature: the Utah Supreme Court rejected the Legislature's appeal 2026-02-20. Federal suit dismissed 2026-07-08. A challenge to HB 392 is pending |
| VA | 11 | [2021 Supreme Court of Virginia plan](https://www.virginiaredistricting.org/) | No | 2021-12-28 | Court | In effect | CD120 | Scott v. McDougle: the Virginia Supreme Court voided the April 2026 redistricting amendment 2026-05-08 (4-3). Supreme Court denied a stay 2026-05-15 (No. 25A1240) |
| WA | 10 | [Redistricting Commission plan as amended](https://www.redistricting.wa.gov/district-maps-handouts.html) | No | 2022-02-08 | Commission, amended by the Legislature | In effect | CD120 | |
| WV | 2 | [SB 3033 of 2021](https://www.wvlegislature.gov/redistricting.cfm) | No | 2021-10-22 | Legislature | In effect | CD120 | No state-specific 2026 source |
| WI | 8 | [Least-change plan, Johnson v. WEC](https://gis-ltsb.hub.arcgis.com/datasets/e0c6f0979bc04c56b346042e34497f9e_0/about) | No | 2022-03-03 | Court | Challenged | CD120 | Bothfeld v. WEC and Wis. Business Leaders for Democracy v. WEC, dismissed in 2026. Appeals argued at the Wisconsin Supreme Court 2026-09-16, no decision. Earliest effect 2028 |

The 44 states hold 429 seats.

## Blocked maps

| State | Map | Adopted | By | Status | Pipeline file | Notes and litigation |
|---|---|---|---|---|---|---|
| MO | [HB 1 of 2025](https://redistrictingdatahub.org/dataset/2025-missouri-congressional-districts-plan/) | 2025-09-28 | Legislature | Blocked | CD120 | Suspended until voters decide on it as Proposition A on Nov 3, 2026. Shown as an extra row in the Missouri panel; not part of the totals |

## At-large states

| State | Seats | Map for Nov 3, 2026 | Status | Pipeline file | Notes |
|---|---|---|---|---|---|
| AK | 1 | At large | At-large | CD120 | Not part of the comparison |
| DE | 1 | At large | At-large | CD120 | Not part of the comparison |
| ND | 1 | At large | At-large | CD120 | Not part of the comparison |
| SD | 1 | At large | At-large | CD120 | Not part of the comparison |
| VT | 1 | At large | At-large | CD120 | Not part of the comparison |
| WY | 1 | At large | At-large | CD120 | Not part of the comparison |

## Block assignment files

| File | Covers | Date |
|---|---|---|
| [Census CD118 block equivalency file](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2023/118-congressional-district-bef/cd118.zip) | Maps used in November 2022 | 2022-12-16 |
| [Census CD119 block equivalency file](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip) | Maps used in November 2024 | 2024-07-29 |
| [Census CD120 block equivalency file](https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip) | Maps adopted for 2026 in AL, CA, FL, LA, MO, NC, OH, TN, TX and UT | 2026-08-31 |

CD120 contains Missouri's HB 1, which is not used in November 2026. The Census Bureau notes this on its [congressional districts page](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html). Missouri's 2022 map is identical in CD118 and CD119.

Comparison of CD120 with the states' own files:

| State | Result |
|---|---|
| TX | Identical, block for block |
| CA | Identical, block for block |
| NC | Identical, block for block |
| FL | Identical on all rows checked |
| LA | Identical on every block in both files. The state file contains 1,751 GEOIDs that are not 2020 tabulation blocks |
| AL, OH, TN, UT, MO (HB 1) | To be checked with `tools/compare_state_files.py` (block files for OH and MO HB 1; official shapes for AL from ALGeoHub, TN from the state GIS layer, UT from UGRC) |

## Maps that changed between 2022 and 2024

The ALARM simulations use the maps of the 2022 election as their reference plan. Five states redrew between the 2022 and 2024 elections: Alabama, Georgia, Louisiana, New York and North Carolina (Census 119th Congress page). Compared with 2022, the 2026 map differs in eleven states: AL, CA, FL, GA, LA, NC, NY, OH, TN, TX and UT.

## Open items

- Louisiana: whether the court in Callais v. Landry ruled on SB 121, and whether new suits were filed.
- North Carolina: any ruling in Gallop v. Hirsch after 2026-07-27.
- Illinois: any ruling in Ives v. Pritzker after 2026-08-07.
- Connecticut: whether Ingersoll v. Connecticut was appealed.
- Missouri: how nominees chosen on HB 1 lines map onto the 2022 districts.
- Compare CD120 with the official files for AL, OH, TN, UT and MO HB 1.
- Utah: settle the official name of the map ("Map 1" in court filings, "Map 1A" in the state GIS layer).
- Several state sites block requests from outside the US (Texas, North Carolina, Ohio, Missouri). Their URLs come from archived copies.
