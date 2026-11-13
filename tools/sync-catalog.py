#!/usr/bin/env python3
"""Copy the current Android catalog without fetching or modifying its checkout."""
import json
import shutil
import sys
from pathlib import Path

source = Path(sys.argv[1] if len(sys.argv) > 1 else '~/DeepCook').expanduser() / 'app/src/main/assets'
target = Path(__file__).resolve().parents[1] / 'public/catalog'
recipes = json.loads((source / 'recipes.json').read_text())
assets = {r['cover'] for r in recipes if r.get('cover')}
assets.update(s['image'] for r in recipes for s in r['steps'] if s.get('image'))
for name in assets:
    path = (source / name).resolve()
    if not path.is_relative_to(source.resolve()) or not path.is_file():
        raise ValueError(f'Invalid or missing asset: {name}')
target.mkdir(parents=True, exist_ok=True)
for name in sorted(assets):
    out = target / name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / name, out)
for name in ['recipes.json', 'nutrition_estimates.json', 'catalog_sources.json', 'photo_sources.json', 'howtocook_index.json', 'HOWTOCOOK-LICENSE.txt', 'BASED-COOKING-LICENSE.txt']:
    shutil.copyfile(source / name, target / name)
shutil.copyfile(source.parents[3] / 'THIRD_PARTY_NOTICES.md', target / 'THIRD_PARTY_NOTICES.md')
print(f'Copied {len(recipes)} recipes and {len(assets)} referenced images.')
