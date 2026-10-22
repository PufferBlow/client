"""Run the instance for the voice end-to-end run.

    python serve_instance.py <home> <api_port> <sfu_port>

A sqlite instance ignores the runtime-config rows that say where the media server is, so the address is
set here. The ActivityPub tables (which direct messages need) are created because ``create_all`` cannot
build the whole schema on sqlite.
"""

import os
import sys

home, api_port, sfu_port = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
os.environ["PUFFERBLOW_HOME"] = home
os.environ["PUFFERBLOW_DATABASE_URI"] = f"sqlite:///{home}/pb.db"

import uvicorn  # noqa: E402

from pufferblow.api.api import api  # noqa: E402
from pufferblow.core.bootstrap import api_initializer  # noqa: E402


def point_at_sfu():
    api_initializer.load_objects(database_uri=os.environ["PUFFERBLOW_DATABASE_URI"])
    import pufferblow.api.database.tables.activitypub  # noqa: F401  (registers the tables with the metadata)
    from pufferblow.api.database.tables.declarative_base import Base

    Base.metadata.create_all(
        api_initializer.database_handler.database_engine,
        tables=[t for t in Base.metadata.sorted_tables if t.name.startswith("activitypub")],
    )
    cfg = api_initializer.config
    cfg.RTC_SIGNALING_URL = f"ws://127.0.0.1:{sfu_port}/rtc/v1/ws"
    cfg.RTC_INTERNAL_API_BASE = f"http://127.0.0.1:{api_port}/api/internal/v1/voice"
    cfg.RTC_STUN_SERVERS = os.environ.get("E2E_STUN", "")
    api_initializer.voice_session_manager.signaling_url = cfg.RTC_SIGNALING_URL


if __name__ == "__main__":
    point_at_sfu()
    uvicorn.run(api, host="127.0.0.1", port=api_port, log_level="warning")
