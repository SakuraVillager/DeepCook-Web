"""Bounded, private account data. Images are references, never inline JSON blobs."""
import re
from errors import ApiError

PRIVATE_PHOTO = re.compile(r'/deepcook-api/v1/account/media/([a-f0-9]{64}\.jpg)\Z')
STATIC_PHOTO = re.compile(r'photos/(?:[\w-]+/)*[\w.-]+\.(?:jpg|jpeg|png|webp)\Z')
ID = re.compile(r'[a-zA-Z0-9_-]{1,128}\Z')
LIKES = {'甜','咸','辣','酸','麻','鲜','清淡','油炸','汤羹','下饭'}
AVOIDS = {'辣','香菜','葱','姜','蒜','海鲜','花生','牛肉','羊肉','内脏'}


def empty_data(name=''):
    return {'favorites': [], 'recent': [], 'recipes': [],
            'profile': {'name': name, 'avatar': None, 'likes': [], 'avoids': []},
            'preferences': {'theme': 'system', 'readingSize': 'standard', 'showStepImages': True, 'keepScreenOn': False}}


def validate_data(data):
    photos = set()

    def fail(): raise ApiError(400, '厨房资料格式不正确，原数据已保留。')
    def text(value, maximum=2000):
        if not isinstance(value, str) or len(value) > maximum: fail()
        try: value.encode('utf-8')
        except UnicodeError: fail()
    def array(value, maximum):
        if not isinstance(value, list) or len(value) > maximum: fail()
    def image(value, static=True):
        if value is None: return
        if not isinstance(value, str): fail()
        match = PRIVATE_PHOTO.fullmatch(value)
        if match: photos.add(match[1]); return
        if static and STATIC_PHOTO.fullmatch(value) and '..' not in value.split('/'): return
        fail()
    def identifier(value):
        if not isinstance(value, str) or not ID.fullmatch(value): fail()
    if not isinstance(data, dict) or set(data) != {'favorites','recent','recipes','profile','preferences'}: fail()
    profile, preferences = data['profile'], data['preferences']
    if not isinstance(profile, dict) or set(profile) != {'name','avatar','likes','avoids'}: fail()
    text(profile['name'], 12); image(profile['avatar'], static=False)
    for kind, allowed in [('likes', LIKES), ('avoids', AVOIDS)]:
        array(profile[kind], len(allowed))
        if any(not isinstance(tag, str) or tag not in allowed for tag in profile[kind]) or len(set(profile[kind])) != len(profile[kind]): fail()
    if set(profile['likes']) & set(profile['avoids']): fail()
    if not isinstance(preferences, dict) or set(preferences) != {'theme','readingSize','showStepImages','keepScreenOn'}: fail()
    if preferences['theme'] not in ('system','light','dark') or preferences['readingSize'] not in ('standard','large','extra'): fail()
    if any(type(preferences[k]) is not bool for k in ['showStepImages','keepScreenOn']): fail()
    for kind, limit in [('favorites', 5000), ('recent', 50)]:
        array(data[kind], limit)
        ids = set()
        for row in data[kind]:
            if not isinstance(row, dict) or set(row) != {'recipeId','timestamp'}: fail()
            identifier(row['recipeId'])
            if type(row['timestamp']) is not int or not 0 <= row['timestamp'] <= 8640000000000000 or row['recipeId'] in ids: fail()
            ids.add(row['recipeId'])
    array(data['recipes'], 200)
    recipe_ids = set()
    for recipe in data['recipes']:
        required = {'id','version','title','region','description','categories','minutes','difficulty','servings','ingredients','preparation','steps','notes','source'}
        optional = {'cover','featured','aliases','collection'}
        if not isinstance(recipe, dict) or not required <= set(recipe) or not set(recipe) <= required | optional: fail()
        identifier(recipe['id'])
        if not recipe['id'].startswith('user-') or recipe['id'] in recipe_ids: fail()
        recipe_ids.add(recipe['id'])
        if type(recipe['version']) is not int or not 0 <= recipe['version'] <= 1000000000: fail()
        for key in ['title','region','servings']: text(recipe[key], 200)
        text(recipe['description'], 20000)
        if not recipe['title'].strip(): fail()
        image(recipe.get('cover'))
        if recipe['minutes'] is not None and (type(recipe['minutes']) is not int or not 1 <= recipe['minutes'] <= 100000): fail()
        if recipe['difficulty'] is not None and (type(recipe['difficulty']) is not int or not 1 <= recipe['difficulty'] <= 5): fail()
        for key in ['categories','aliases','preparation','notes']:
            values = recipe.get(key, [])
            array(values, 200)
            for value in values: text(value, 20000 if key in ['preparation','notes'] else 200)
        if 'collection' in recipe: text(recipe['collection'], 200)
        if 'featured' in recipe and type(recipe['featured']) is not bool: fail()
        array(recipe['ingredients'], 200); array(recipe['steps'], 200)
        if not recipe['ingredients'] or not recipe['steps']: fail()
        for ingredient in recipe['ingredients']:
            if not isinstance(ingredient, dict) or set(ingredient) != {'id','name','amount'}: fail()
            identifier(ingredient['id']); text(ingredient['name']); text(ingredient['amount'])
        steps = set()
        for step in recipe['steps']:
            if not isinstance(step, dict) or not {'id','order','title','text'} <= set(step) or not set(step) <= {'id','order','title','text','image','ingredientRefs','cue'}: fail()
            identifier(step['id'])
            if step['id'] in steps or type(step['order']) is not int or not 0 <= step['order'] <= 1000: fail()
            steps.add(step['id']); text(step['title'], 200); text(step['text'], 20000); image(step.get('image'))
            if step.get('cue') is not None: text(step['cue'], 2000)
            if 'ingredientRefs' in step:
                array(step['ingredientRefs'], 200)
                for ref in step['ingredientRefs']: identifier(ref)
        source = recipe['source']
        if not isinstance(source, dict) or not {'author','license'} <= set(source) or not set(source) <= {'author','license','url','imageSource'}: fail()
        for key, value in source.items():
            if value is not None: text(value, 2000)
    return photos
