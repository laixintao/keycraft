"""Refresh the offline frontend reference from the original CSV."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
with (root / "data/builtin_mappings.csv").open() as source:
    mappings = list(csv.DictReader(source))
output = root / "keycraft/src/data/builtinMappings.json"
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(mappings, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Bundled {len(mappings)} mappings into {output.relative_to(root)}")
