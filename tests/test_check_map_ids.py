import copy

import pytest

from gerry.checks import CheckError, check_map_ids

RESULTS = {
    "national": {"single_seat": [{"postal": "AK", "fips": "02", "name": "Alaska"}]},
    "states": {
        "HI": {"fips": "15", "districts": [{"id": "1501"}, {"id": "1502"}]},
        "NM": {"fips": "35", "districts": [{"id": "3501"}, {"id": "3502"}, {"id": "3503"}]},
    },
}


def topo(districts, states):
    """Minimal TopoJSON object tree; districts: [(id, state)], states: [(id, postal)]."""
    return {"type": "Topology", "objects": {
        "districts": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "arcs": [], "properties": {"id": i, "state": s}} for i, s in districts]},
        "states": {"type": "GeometryCollection", "geometries": [
            {"type": "Polygon", "arcs": [], "properties": {"id": i, "postal": p}} for i, p in states]},
    }}


DISTRICTS = [("0200", "AK"), ("1501", "HI"), ("1502", "HI"), ("3501", "NM"), ("3502", "NM"), ("3503", "NM")]
STATES = [("02", "AK"), ("15", "HI"), ("35", "NM")]


def test_check_map_ids_passes_when_map_and_results_agree():
    check_map_ids(topo(DISTRICTS, STATES), RESULTS)


def test_check_map_ids_stops_on_missing_district():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS[:-1], STATES), RESULTS)
    assert err.value.check == "map_ids"
    assert "3503" in err.value.detail


def test_check_map_ids_stops_on_duplicate_district():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo([*DISTRICTS, ("1501", "HI")], STATES), RESULTS)
    assert "1501" in err.value.detail


def test_check_map_ids_stops_on_wrong_state_property():
    districts = [("0200", "AK"), ("1501", "HI"), ("1502", "NM"), ("3501", "NM"), ("3502", "NM"), ("3503", "NM")]
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(districts, STATES), RESULTS)
    assert "1502" in err.value.detail


def test_check_map_ids_stops_on_missing_at_large_state():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, STATES[1:]), RESULTS)
    assert "AK" in err.value.detail


def test_check_map_ids_needs_the_at_large_district():
    results = copy.deepcopy(RESULTS)
    results["national"]["single_seat"].append({"postal": "DE", "fips": "10", "name": "Delaware"})
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, [*STATES, ("10", "DE")]), results)
    assert "1000" in err.value.detail


def test_check_map_ids_stops_on_a_district_that_results_does_not_have():
    # DC (11) is not in results.json: the map must not carry it
    with pytest.raises(CheckError) as err:
        check_map_ids(topo([*DISTRICTS, ("1100", "DC")], STATES), RESULTS)
    assert err.value.check == "map_ids"
    assert "extra ['1100']" in err.value.detail


def test_check_map_ids_stops_on_wrong_postal_in_the_states_layer():
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, [("02", "AK"), ("15", "NM"), ("35", "NM")]), RESULTS)
    assert "states in map.topojson" in err.value.detail


def test_check_map_ids_stops_on_a_state_that_occurs_twice():
    # comparing the layer as a dict keyed by id would collapse the duplicate
    with pytest.raises(CheckError) as err:
        check_map_ids(topo(DISTRICTS, [*STATES, ("15", "HI")]), RESULTS)
    assert "states in map.topojson" in err.value.detail
