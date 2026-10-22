"""Build an isolated Pufferblow home for the voice end-to-end run: config, database, three people, two channels.

    python setup_instance.py <home> <api_port> <sfu_port>

Run from the ``pufferblow`` package directory (so ``import pufferblow`` works). Writes ``ids.json`` into
the home folder. Nothing outside ``<home>`` is touched.
"""

import json
import os
import sys
from pathlib import Path

home = Path(sys.argv[1]).resolve()
api_port, sfu_port = int(sys.argv[2]), int(sys.argv[3])
(home / ".pufferblow").mkdir(parents=True, exist_ok=True)
database = home / "pb.db"

os.environ["PUFFERBLOW_HOME"] = str(home)
os.environ["PUFFERBLOW_DATABASE_URI"] = f"sqlite:///{database.as_posix()}"

(home / ".pufferblow" / "config.toml").write_text(
    f"""[server]
api_host = "127.0.0.1"
api_port = {api_port}

[media-sfu]
bootstrap_config_url = "http://127.0.0.1:{api_port}/api/internal/v1/voice/bootstrap-config"
bootstrap_secret = "e2e-bootstrap-secret"
internal_secret = "e2e-internal-secret"
join_secret = "e2e-join-secret"
bind_addr = "127.0.0.1:{sfu_port}"
max_total_peers = 100
max_room_peers = 20
room_end_grace_seconds = 5
udp_port_min = 52000
udp_port_max = 52100

[security]
cors_origin_regex = ".*"
cors_allow_credentials = true
""",
    encoding="utf-8",
)

from pufferblow.core.bootstrap import api_initializer  # noqa: E402

api_initializer.load_objects(database_uri=os.environ["PUFFERBLOW_DATABASE_URI"])
if not api_initializer.server_manager.check_server_exists():
    api_initializer.server_manager.create_server(server_name="Voice E2E", server_welcome_message="hi")

people = {}
for name, owner in (("alice", True), ("bob", False), ("carol", False)):
    people[name] = str(api_initializer.user_manager.sign_up(username=name, password="12345678", is_owner=owner).user_id)
lounge = api_initializer.channels_manager.create_channel(user_id=people["alice"], channel_name="lounge", is_private=False, channel_type="voice")
general = api_initializer.channels_manager.create_channel(user_id=people["alice"], channel_name="general", is_private=False, channel_type="text")
(home / "ids.json").write_text(json.dumps({**people, "voice_channel": str(lounge.channel_id), "text_channel": str(general.channel_id)}), encoding="utf-8")
