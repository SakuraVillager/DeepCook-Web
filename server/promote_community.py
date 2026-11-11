"""One-time import of the former browser-generated community records.

Run as the service user while the API is stopped. Original text and dates are
preserved; the ledger prevents duplicates and prevents deleted records returning.
"""
import argparse
import io
import json
import secrets
import time
from pathlib import Path
from PIL import Image, ImageOps
from community import PHOTO_LIMIT, create_app


def promote(app, manifest, assets):
    namespace = manifest['migration']
    result = {'recipes': 0, 'ratings': 0, 'posts': 0, 'photos': 0, 'skipped': 0}
    assets = Path(assets).resolve()

    def identity(name):
        key = namespace + '/author/' + name
        app.db.execute('INSERT INTO profiles(owner,display_name,import_key) VALUES(?,?,?) ON CONFLICT(import_key) DO NOTHING',
                       [secrets.token_hex(32), name, key])
        return app.db.execute('SELECT owner FROM profiles WHERE import_key=?', [key]).fetchone()[0]

    for recipe in manifest['recipes']:
        recipe_id = recipe['recipeId']
        if recipe_id not in app.recipes: raise ValueError('Unknown recipe: ' + recipe_id)
        key = namespace + '/recipe/' + recipe_id
        with app.lock:
            if app.db.execute('SELECT 1 FROM community_imports WHERE key=?', [key]).fetchone():
                result['skipped'] += 1
                continue
            owners = {name: identity(name) for name in ['阿米', '小禾', '访客']}
            photo_count = 0
            for post in recipe['posts']:
                if not post['submission'] or not recipe.get('cover'): continue
                image_path = (assets / recipe['cover']).resolve()
                if not image_path.is_relative_to(assets): raise ValueError('Invalid import image')
                with Image.open(image_path) as image:
                    image = ImageOps.fit(ImageOps.exif_transpose(image).convert('RGB'), (1200, 900))
                    for quality in [82, 65, 50]:
                        output = io.BytesIO()
                        image.save(output, 'JPEG', quality=quality)
                        raw = output.getvalue()
                        if len(raw) <= PHOTO_LIMIT: break
                    else: raise ValueError('Import image is too large')
                app.upload({'CONTENT_LENGTH': str(len(raw)), 'CONTENT_TYPE': 'image/jpeg', 'wsgi.input': io.BytesIO(raw)},
                           recipe_id, post['id'], owners[post['author']])
                photo_count += 1
            app.db.execute('BEGIN IMMEDIATE')
            try:
                for owner, score in zip(owners.values(), recipe['ratings'], strict=True):
                    app.db.execute('INSERT INTO ratings VALUES(?,?,?)', [recipe_id, owner, score])
                for post in recipe['posts']:
                    app.db.execute('INSERT INTO posts VALUES(?,?,?,?,?,?)',
                                   [post['id'], recipe_id, owners[post['author']], int(post['submission']), post['text'], post['createdAt']])
                    if post['submission'] and recipe.get('cover'):
                        app.db.execute('UPDATE photos SET published=1 WHERE post_id=?', [post['id']])
                app.db.execute('INSERT INTO community_imports VALUES(?,?)', [key, int(time.time()*1000)])
                app.db.execute('COMMIT')
            except Exception:
                app.db.execute('ROLLBACK')
                raise
            result['recipes'] += 1
            result['ratings'] += len(recipe['ratings'])
            result['posts'] += len(recipe['posts'])
            result['photos'] += photo_count
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', required=True, help='Directory containing the original catalog photos')
    parser.add_argument('--manifest', default=str(Path(__file__).with_name('legacy-community.json')))
    args = parser.parse_args()
    app = create_app()
    try:
        print(json.dumps(promote(app, json.loads(Path(args.manifest).read_text()), args.assets)))
        print(json.dumps(app.backup()))
    finally:
        app.db.close()
