"""Local integration tests only. Production uses Gunicorn behind OpenResty."""
import argparse
import tempfile
import atexit
import signal
import sys
import json
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, make_server, WSGIRequestHandler
from community import CommunityApp

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=4199)
parser.add_argument('--database')
args = parser.parse_args()
if not args.database:
    temporary = tempfile.TemporaryDirectory(prefix='deepcook-community-test-')
    atexit.register(temporary.cleanup)
    args.database = str(Path(temporary.name) / 'community.sqlite3')
signal.signal(signal.SIGTERM, lambda *args: sys.exit(0))
app = CommunityApp(args.database, json.loads(Path(__file__).with_name('recipe-ids.json').read_text()), ['http://127.0.0.1:4173', 'http://127.0.0.1:5173'], rate_limits=False, reserve_bytes=0)
class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True
class Quiet(WSGIRequestHandler):
    def log_message(self, *args):
        pass
with make_server('127.0.0.1', args.port, app, server_class=ThreadedServer, handler_class=Quiet) as server:
    print(f'Community test API on 127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
