# Run from the repository root after activating .venv.
# Every recipe is one command without shell tools, so it runs the same under
# cmd.exe and sh on Windows.

PY ?= python
export PYTHONUTF8 := 1

.PHONY: all download join metrics export test test-py test-js serve

all: download join metrics export

download:
	$(PY) pipeline/01_download.py

join:
	$(PY) pipeline/02_join.py

metrics:
	$(PY) pipeline/03_metrics.py

export:
	$(PY) pipeline/04_export.py

test: test-py test-js

test-py:
	$(PY) -m pytest

test-js:
	node --test "site/js/*.test.js"

serve:
	$(PY) -m http.server 8000 --bind 127.0.0.1 --directory site
