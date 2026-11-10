"""Online SQLite backup; never copy a live WAL database using file copy."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

root = Path(os.environ.get("DEEPCOOK_BACKUPS", "/var/lib/deepcook-community/backups"))
root.mkdir(mode=0o700, parents=True, exist_ok=True)
source = os.environ.get("DEEPCOOK_DATABASE", "/var/lib/deepcook-community/community.sqlite3")
target = root / (datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + ".sqlite3")
with sqlite3.connect(source) as db, sqlite3.connect(target) as backup:
    db.backup(backup)
    if backup.execute("PRAGMA quick_check").fetchone()[0] != "ok":
        raise RuntimeError("Backup verification failed")
for old in sorted(root.glob("*.sqlite3"), reverse=True)[7:]:
    old.unlink()
