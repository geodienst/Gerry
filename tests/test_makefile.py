"""The Makefile keeps to the Windows rules from chapter 9 of the spec."""
import re
from pathlib import Path

MAKEFILE = Path(__file__).resolve().parents[1] / "Makefile"
TARGETS = ("all", "download", "join", "metrics", "export", "test", "serve")
# Shell tools and chaining that break under cmd.exe, plus commands the project bans.
FORBIDDEN = ("&&", "||", ";", "rm ", "cp ", "mv ", "mkdir ", "source ", "cd ", "python3", "npx")


def makefile_lines() -> list[str]:
    return MAKEFILE.read_text(encoding="utf-8").splitlines()


def recipe_lines() -> list[str]:
    return [line[1:] for line in makefile_lines() if line.startswith("\t")]


def test_all_targets_exist():
    targets = {m.group(1) for line in makefile_lines() if (m := re.match(r"^([a-z-]+):", line))}
    assert set(TARGETS) <= targets


def test_python_and_utf8_settings():
    lines = makefile_lines()
    assert "PY ?= python" in lines
    assert "export PYTHONUTF8 := 1" in lines


def test_recipes_are_tab_indented():
    assert not [line for line in makefile_lines() if line.startswith(" ")]


def test_recipes_use_no_shell_tools():
    for line in recipe_lines():
        for token in FORBIDDEN:
            assert token not in line, f"{token!r} in recipe {line!r}"


def test_python_recipes_use_py_variable():
    python_lines = [line for line in recipe_lines() if not line.startswith("node ")]
    assert python_lines
    assert all(line.startswith("$(PY) ") for line in python_lines)
