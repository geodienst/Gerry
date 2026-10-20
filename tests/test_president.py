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


# The national two-party share of a year, for the 2024 example on the vote slider

def test_national_share_adds_the_nominees_on_every_line_in_every_state(tmp_path):
    from gerry.president import national_share
    path = write(tmp_path, [
        # AA: Harris on two lines (60 + 15), Trump 70, a write-in and another candidate that do not count
        row(2024, "AA", "HARRIS, KAMALA D.", "DEMOCRAT", "False", 60),
        row(2024, "AA", "HARRIS, KAMALA D.", "WORKING FAMILIES / DEMOCRAT", "False", 15),
        row(2024, "AA", "TRUMP, DONALD J.", "REPUBLICAN", "False", 70),
        row(2024, "AA", "HARRIS, KAMALA D.", "DEMOCRAT", "True", 9),
        row(2024, "AA", "STEIN, JILL", "GREEN", "False", 4),
        # BB: Harris on a line with another name, Trump on an empty line
        row(2024, "BB", "HARRIS, KAMALA D.", "DFL", "False", 25),
        row(2024, "BB", "TRUMP, DONALD J.", "", "False", 30),
        # another year does not count
        row(2020, "AA", "BIDEN, JOSEPH R. JR", "DEMOCRAT", "False", 500),
    ])
    # Democratic 60 + 15 + 25 = 100, Republican 70 + 30 = 100 -> 0.5
    assert national_share(read_president(path), "2024", states=2) == pytest.approx(0.5)


def test_national_share_needs_every_state(tmp_path):
    from gerry.president import national_share
    path = write(tmp_path, [row(2024, "AA", "HARRIS, KAMALA D.", "DEMOCRAT", "False", 60),
                            row(2024, "AA", "TRUMP, DONALD J.", "REPUBLICAN", "False", 70)])
    with pytest.raises(PresidentError, match="2024: 1 states in the file, expected 51"):
        national_share(read_president(path), "2024")
