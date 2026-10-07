#!/usr/bin/env python3
"""Regenerate the readable script files from the episode modules.

The episode modules are the source. This writes scripts/episode-0N-narration.txt
and scripts/episode-0N-script.txt so a narration edit cannot drift from its cue.
"""

import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "production"
result = subprocess.run(["node", "src/export-scripts.mjs"], cwd=root)
sys.exit(result.returncode)
