"""Deploy the community service only. Reverse proxy and DNS are managed by the operator."""
import argparse
import base64
import io
import json
import pathlib
import re
import subprocess
import tarfile
import tempfile
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--identity', required=True)
parser.add_argument('--api-host', required=True)
parser.add_argument('--origin', action='append', required=True)
parser.add_argument('--service-only', action='store_true', help='Leave all reverse-proxy configuration to the operator')
args = parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9.-]+', args.api_host):
    parser.error('Invalid API hostname')
for origin in args.origin:
    if origin == '*': continue
    parsed = urlsplit(origin)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or any(c in origin for c in '\n\r,"'):
        parser.error('Origins must contain only scheme and hostname (and optional port)')
files = ['community.py', 'gunicorn.conf.py', 'requirements.txt', 'recipe-ids.json', 'backup.py',
         'deepcook-community.service', 'deepcook-backup.service', 'deepcook-backup.timer']
root = pathlib.Path(__file__).parent
archive = io.BytesIO()
with tarfile.open(fileobj=archive, mode='w:gz') as tar:
    for name in files: tar.add(root / name, arcname=name)
config = json.dumps({'api_host': args.api_host, 'origins': args.origin})
payload = base64.b64encode(archive.getvalue()).decode('ascii')
remote = '''
import base64, io, json, os, pathlib, pwd, shutil, subprocess, tarfile, time, urllib.request, secrets
CONFIG = json.loads(CONFIG_JSON)
root = pathlib.Path('/opt/deepcook-community')
root.mkdir(mode=0o755, exist_ok=True)
try: pwd.getpwnam('deepcook')
except KeyError:
    subprocess.run(['useradd','--system','--user-group','--home-dir','/var/lib/deepcook-community','--no-create-home','--shell','/usr/sbin/nologin','deepcook'],check=True)
stamp = time.strftime('%Y%m%d-%H%M%S')
with tarfile.open(fileobj=io.BytesIO(base64.b64decode(PAYLOAD)), mode='r:gz') as tar:
    for member in tar.getmembers():
        if not member.isfile() or '/' in member.name: raise RuntimeError('Invalid deployment archive')
        target = root / member.name
        if target.exists():
            previous = root / ('previous-' + stamp)
            previous.mkdir(exist_ok=True)
            shutil.copy2(target, previous / member.name)
        target.write_bytes(tar.extractfile(member).read())
        target.chmod(0o644)
if not (root/'venv/bin/python').exists():
    subprocess.run(['python3','-m','venv','--without-pip',str(root/'venv')],check=True)
subprocess.run(['python3','-m','pip','--python',str(root/'venv/bin/python'),'install','--index-url','https://pypi.org/simple','--timeout','20','--retries','1','--no-cache-dir','--disable-pip-version-check','-r',str(root/'requirements.txt')],check=True)
env = pathlib.Path('/etc/deepcook-community.env')
previous_env=env.read_text().splitlines() if env.exists() else []
backup_token=next((line.split('=',1)[1] for line in previous_env if line.startswith('DEEPCOOK_BACKUP_TOKEN=')),secrets.token_hex(32))
env.write_text('DEEPCOOK_ORIGINS='+','.join(CONFIG['origins'])+'\\nDEEPCOOK_DATABASE=/var/lib/deepcook-community/community.sqlite3\\nDEEPCOOK_BACKUP_TOKEN='+backup_token+'\\n')
env.chmod(0o600)
for name in ['deepcook-community.service','deepcook-backup.service','deepcook-backup.timer']:
    shutil.copy2(root/name, pathlib.Path('/etc/systemd/system')/name)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','deepcook-community.service','deepcook-backup.timer'],check=True)
subprocess.run(['systemctl','restart','deepcook-community.service'],check=True)
for attempt in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8391/deepcook-api/v1/health',timeout=2) as response:
            assert json.load(response)['ok']
        break
    except Exception:
        if attempt == 29: raise
        time.sleep(0.2)
host=CONFIG['api_host']
subprocess.run(['systemctl','start','deepcook-backup.timer','deepcook-backup.service'],check=True)
print(json.dumps({'service':'deepcook-community','listen':'127.0.0.1:8391','api':'https://'+host+'/deepcook-api/v1','proxy':'managed by operator'}))
'''
remote = remote.replace('CONFIG_JSON', repr(config)).replace('PAYLOAD', repr(payload))
with tempfile.NamedTemporaryFile(prefix='deepcook-server-key-') as key:
    key.write(pathlib.Path(args.identity).read_bytes())
    key.flush()
    result = subprocess.run(['ssh','-i',key.name,'-o','BatchMode=yes','-o','ConnectTimeout=12','-o','StrictHostKeyChecking=yes',args.host,'python3 -'], input=remote, text=True)
    raise SystemExit(result.returncode)
