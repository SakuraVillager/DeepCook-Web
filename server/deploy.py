"""Deploy only the lightweight community service; never uploads website/media files."""
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
import base64, io, json, os, pathlib, pwd, shutil, subprocess, tarfile, time, urllib.request
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
env.write_text('DEEPCOOK_ORIGINS='+','.join(CONFIG['origins'])+'\\nDEEPCOOK_DATABASE=/var/lib/deepcook-community/community.sqlite3\\n')
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
proxy = pathlib.Path('/opt/1panel/www/sites')/host/'proxy/deepcook-community.conf'
if not proxy.parent.is_dir(): raise RuntimeError('Existing HTTPS virtual host not found')
previous_proxy = proxy.read_bytes() if proxy.exists() else None
proxy.write_text(''' + '"""' + '''location ^~ /deepcook-api/ {
    proxy_pass http://127.0.0.1:8391;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_request_buffering on;
    proxy_buffering on;
    proxy_connect_timeout 2s;
    proxy_read_timeout 12s;
    client_body_timeout 5s;
    client_max_body_size 12k;
    access_log off;
}
''' + '"""' + ''')
containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
container=next(name for name in containers if name.startswith('1Panel-openresty-'))
check=subprocess.run(['docker','exec',container,'nginx','-t'],capture_output=True,text=True)
if check.returncode:
    if previous_proxy is None: proxy.unlink()
    else: proxy.write_bytes(previous_proxy)
    raise RuntimeError(check.stderr)
subprocess.run(['docker','exec',container,'nginx','-s','reload'],check=True)
subprocess.run(['systemctl','start','deepcook-backup.timer','deepcook-backup.service'],check=True)
print(json.dumps({'service':'deepcook-community','api':'https://'+host+'/deepcook-api/v1','database':'/var/lib/deepcook-community/community.sqlite3','backup':'daily, 7 copies','proxy_test':'passed'}))
'''
remote = remote.replace('CONFIG_JSON', repr(config)).replace('PAYLOAD', repr(payload))
with tempfile.NamedTemporaryFile(prefix='deepcook-server-key-') as key:
    key.write(pathlib.Path(args.identity).read_bytes())
    key.flush()
    result = subprocess.run(['ssh','-i',key.name,'-o','BatchMode=yes','-o','ConnectTimeout=12','-o','StrictHostKeyChecking=yes',args.host,'python3 -'], input=remote, text=True)
    raise SystemExit(result.returncode)
