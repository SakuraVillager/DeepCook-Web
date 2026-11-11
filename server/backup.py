"""Ask the local service for a consistent SQLite plus immutable-media snapshot."""
import json
import os
import urllib.request

request = urllib.request.Request('http://127.0.0.1:8391/internal/backup', method='POST', headers={'Authorization':'Bearer '+os.environ['DEEPCOOK_BACKUP_TOKEN']})
with urllib.request.urlopen(request, timeout=120) as response:
    result = json.load(response)
    if not result.get('ok'): raise RuntimeError('Backup failed')
    print('Verified database and media snapshot:', result['snapshot'])
