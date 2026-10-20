# TODO

Bugs and known limits for `client-new`. Items marked **backend** need a change in `pufferblow/`.

## Needs verification first

- [x] **backend — profile payload may leak secrets.** `UserManager.user_profile()` only drops empty
  strings, and `Users.to_dict()` includes `password`, `auth_token` and `raw_auth_token`. If those
  are populated, `POST /api/v1/users/profile` (any `user_id`) and `GET /api/v1/users/list` return
  them to every signed-in user. **Confirmed and fixed** (`b0eaed6`): `Users.to_dict()` no longer carries
  credentials and `Users.__repr__` masks them (`test_42_profile_has_no_secrets.py`; not re-checked against
  a live response). Tokens issued before the fix were exposed; on an instance that matters, sign everyone
  out or reset their tokens.

## Security

- [x] **backend — password in the sign-in URL.** `POST /api/v1/users/signin` takes a JSON body and
  `services/auth.ts` uses it; the `GET` form is deprecated and kept only for older clients (the client
  falls back to it on a 405). Remove the `GET` route once old instances are gone.
- [x] **backend — password change never checks the old password.** `PUT /users/profile` now verifies
  `old_password` (`4036e8c`, `test_43_signin_body_and_password_change.py`).
- [x] **Session storage (desktop).** The desktop app hands the refresh token to the main process
  at sign-in (`electron/sessionVault.ts`): encrypted with the OS keychain (`safeStorage`) when
  "stay signed in" is on, memory only when off. The main process refreshes and revokes itself and
  returns only access tokens, so page script can't read the long-lived credential.
- [ ] **Session storage (web, and desktop without a keychain).** The refresh token is still in
  `localStorage` / `sessionStorage` and the access token is a JS-readable cookie, so XSS can read
  both. Fixing it needs the backend to issue the refresh token as an `HttpOnly; Secure;
  SameSite=Strict` cookie on its own origin and accept it on `/auth/refresh`, which only works when
  the web client is served from the instance's origin (cross-site, browsers drop such cookies).
  **backend**
- [x] **backend — tokens in URLs.** The server accepts `Authorization: Bearer <token>` on HTTP and
  websocket upgrades, and `Sec-WebSocket-Protocol: pufferblow.v1, bearer.<token>` for browsers
  (`core/header_auth.py`; the token is copied into the `auth_token` parameter on a copy of the request
  scope, so the access log never sees it). client-new sends the header for query-token routes and the
  subprotocol for the socket; pypufferblow's `ProtocolClient` and websocket use the subprotocol. An
  instance from before this change answers that `auth_token` is missing and gets the URL form.
- [ ] **Tokens in URLs, what is left.** The server still accepts `?auth_token=`, so a client can still
  leak it; routes that read the token from a JSON body or form field (`authed.body`, `send_message`)
  keep it there (bodies are not logged). Decide when to refuse the query form. **backend**

## Bugs

Fixed:

- [x] `resolveInstance("http://")` resolved to `https://http` (trailing slashes were trimmed
  before the scheme check). Now rejected.
- [x] Saving a username or about text erased its own success message (the card was keyed on the
  saved value, so the profile refetch remounted it).

Open:

- [ ] **Login redirect drops the `#fragment`.** Route loaders only see the request URL, which never
  includes a fragment. Harmless today (no route uses hashes); covered by a test in `router.test.tsx`.
- [x] **Deleted messages only disappeared for other people on refetch.** Deletes now go through
  `message.delete` and publish `message.deleted` (DMs: `dm.message.deleted`); the client removes
  the row live.
- [x] **New channels needed a reconnect.** The backend now subscribes open sockets when a channel
  is created, made public or shared with them (`channel.created`, `access: "granted"`), and
  unsubscribes them on removal; the client refreshes its channel list. People added to a private
  channel also receive its events now (the protocol used to admit only `view_private_channels`).
- [x] **Slow pongs.** The protocol session answers a ping as soon as it reads it, so the client
  now drops a link 10 s after an unanswered ping (`PONG_TIMEOUT_MS`) instead of up to a minute.
- [ ] Message history is capped by `MAX_OFFSET_PAGINATION_ROWS` for the first page mode, and the
  first page has no cursor, so the client derives one from the oldest message. **backend**

## Known limits (backend does not support it yet)

- [ ] **One server.** A Pufferblow "server" is the instance you signed in to. Joining other
  instances needs a separate account on each; the rail shows only the home instance.
- [x] **Typing indicators, replies and embeds.** Typing: `typing.start` / `typing.started` in
  channels and DMs (DM typing reaches a local peer who has written in the conversation; not
  federated). Replies: `reply_to_message_id` with a preview. Embeds: client-side iframes for
  popular sites and direct media.
- [ ] **No direct messages.** `conversation_id` exists on messages but there are no DM routes, so
  the friends view has no message button.
- [ ] **Member list is the whole instance.** There is no per-channel members endpoint.
- [x] **Channel voice is wired** (`src/features/voice/`): join/leave through `/api/v2/voice`, the media
  server's signalling socket and WebRTC audio, mute, deafen, live roster, a call bar, and a failed-call
  state with Rejoin. Only unit and component tests have run; **it has never been tried against a real
  `media-sfu`, microphone or browser.** Check with two browsers and a TURN-less and a TURN network.
- [ ] **Voice leftovers.** No automatic rejoin after a drop (the join token is single use, so the user taps
  Rejoin); no push-to-talk, input/output device pickers, volume or noise settings (the old client had
  them); no screen share or video (the SFU supports `screen_share_*`); `mixed` channels are listed under
  text and cannot be joined as voice; voice menu entries (Join/Leave) are not added; DM calls
  (`/api/v1/dm-calls`, P2P with SFU fallback) are not built; the roster of channels you are not in is
  polled every 10 seconds because the API has no push for it; a voice channel's roster is read-only
  (no per-user volume or moderation actions).
- [ ] **Message menu is missing Reply, Pin/Unpin, Forward, Mark unread and Copy link.** The backend has
  no reply field, pin or forward endpoints, per-message unread marker, or message permalink route,
  so the context menu only lists what works (reactions, copy text/ID, edit, delete, report). Add each
  entry in `components/dashboard/messageMenu.tsx` once the API exists.
- [ ] **Sidebar menus cover channels and the server only.** There are no categories, DMs, group
  conversations, invites, notification-settings screen, per-channel mention-only toggle, leave/delete
  server, or channel reordering in the backend or client, so those menu entries are not offered. Mute
  works through `/api/v1/notifications/preferences`; the server menu mutes every channel in one request.
- [ ] **Voice channel menus are minimal** (copy ID plus admin actions); add Join/Leave.
- [ ] **No emoji button in the message composer.** Reactions use the emoji picker, but typing an emoji
  into a message still relies on the OS emoji keyboard. `EmojiPickerPopover` can be reused for it.
- [ ] **Bundle size.** The main chunk is ~830 kB (it carries the Twemoji file map); the picker and its
  data load lazily. Splitting the emoji map out would shrink first load.
- [ ] **No "game activity" / rich presence.** Statuses are online, idle, dnd, away, offline.

## Not built yet

- [ ] Avatar and banner image upload (multipart endpoints exist).
- [ ] Notifications: unread count, list, and per-channel mute preferences.
- [ ] Remaining Switchyard mockups: 2b account picker, 2d hub home, 2f friends roster.
- [ ] Control panel sections beyond the overview, channel list and member list: role management,
  moderation (timeouts, bans, blocked IPs), server settings and branding. (Channel create/edit/delete is done.)
- [ ] PNG app icons for the Electron window and installer (only SVGs are in the brand folder).
- [ ] Background token refresh runs only while the dashboard is mounted.

## Test gaps

- [ ] No tests for the layout shells or the small UI primitives (`Button`, `Input`, `Modal`, ...).
- [ ] Websocket-to-screen path is tested in pieces (client, parser, cache updater) but not
  end to end.
- [ ] No Electron or real-backend integration tests.

## Command/event protocol

Wired end to end: backend (`pufferblow`), `client-new` and `pypufferblow`. The spec is
`pufferblow/docs/protocol/v1.md`; the shared fixtures are copied into `client-new`
(`src/features/realtime/__fixtures__/`) and `pypufferblow` (`tests/fixtures/protocol_v1/`), and each
repo's tests parse every one. What is left:

### Backend (`pufferblow/`)
- [x] Failing `test_30_command_protocol.py` tests fixed. The reaction mystery was a real bug: the
  reaction and notification helpers in `database_handler.py` never called `session.commit()`, so rows
  were not saved. `delete_message` now works on SQLite, and editing a bot's message is limited to that bot.
- [x] **The existing tests failed at baseline here, and now run.** Signup returned 503 because the SQLite test
  database had no server row (`create_server_row` and `check_server_exists` skipped SQLite). The server table now
  exists there and `conftest.py` creates the row. Getting the old suites to run uncovered the rest: ids were passed as
  strings to a UUID column SQLite would not bind (`database/tables/uuid_type.py` makes the column the same on both
  databases), the SQLite password digest was never compared as one, and tests 01 to 08, 16, 17, 19, 23 to 25 asserted
  routes and error shapes from before the error contract (they are rewritten, each making its own account because every
  test has its own database). Full backend suite: 535 passed, 0 failed.
  Real bugs it found, now fixed: **message ids collided** about one time in 52 for repeated short messages (a UUIDv5 of
  a slice of the text plus one random letter), so the second insert failed with an internal error; that is also the
  cause of the `test_sequence_numbers_are_per_channel` flake that was "not found". **A bot could delete its owner's
  messages** (delete compared the owner's id, which the bot shares). **An avatar or banner could be any file** named
  `.png`. Asking for a profile of an id that does not exist was a 500 (now 404).
- [x] `import magic` hangs in some shells. Cause: python-magic on Windows loads Git for Windows' MSYS libmagic, which
  crashes a native Python (`a3fb600`); `create_mime_detector` now detects that and uses the signature fallback.
  The fallback is confirmed: it reads PNG, JPEG, GIF, WebP, PDF, audio and video signatures, and since it can call a
  text file `text/plain`, avatar and banner uploads now also require an image type, so a renamed text file is refused
  with or without libmagic (`test_08_cdn_uploads.py`).
- [x] **Persist per-channel sequence numbers.** Each channel's counter starts from a persisted high-water mark and
  reserves numbers in blocks of 64 (`channel_event_seq`), so a number is never reused after a restart and the
  database is written once per block. `epoch` still changes per process, so clients resync after a restart. The
  commit-to-publish crash gap needs no outbox: the message is committed, the history returns it, and a reconnecting
  client always runs `events.resync`; the database is the log (`test_49_persisted_event_sequence.py`).
- [x] **Publish `channel.updated` for role/privilege changes** and refresh open sockets from those routes: editing
  a role or reassigning a user's roles calls `refresh_channel_access`, which revokes and grants private-channel
  subscriptions (`b698e45`, `test_37_channel_access.py`).
- [x] **Close the legacy private-channel leak.** Closed by removing the legacy `/ws` loop, the per-channel
  socket and `broadcast_to_eligible_users`; the v1 path checks `view_private_channels`.
- [x] **Bots.** The instance owner creates, lists and revokes bots over HTTP (`POST/GET/DELETE /api/v1/bots`; the token
  is shown once, only a hash is stored, non-owners get 403, administrative scopes are refused). Bots can react:
  their reactions live in `bot_message_reactions` and appear in summaries under the bot's principal id. End-to-end
  scope tests over real sockets (`test_48_bots_api.py`): `send_messages` to post, edit, react and delete (only its own
  messages), `view_private_channels` for private channels, a bot with no scopes can read but not write, a revoked bot is
  cut off at its next command and cannot reconnect, a bot token is not a login for the rest of the API.
- [x] **Credentials in the URL.** The socket takes the token as a `bearer.<token>` subprotocol (browsers) or
  an `Authorization` header instead of `?auth_token=`; the query form still works for older clients.
- [x] **Attachments over the socket.** `upload.begin` / `upload.chunk` (base64, in order, 32 KiB) / `upload.abort`, then
  `message.create` with `upload_ids`. Uploads are staged per principal with size, count, process and time limits,
  checked for ownership, and stored by the same function as the HTTP route (`services/attachments.py`); they are kept
  until the message exists, so a refused send can be retried (`test_50_socket_attachments.py`, protocol spec
  "Sending files"). HTTP stays for very large files and progress.
- [x] **Per-IP and global connection limits.** 50 sockets per address and 10,000 per process, checked before the token is
  resolved (`ca7f2fb`, `test_44_socket_limits.py`).
- [x] **Run command handlers off the event loop.** The handlers hand the service and authorizer calls
  to a worker thread (`asyncio.to_thread`), and so do the between-command credential check and the
  idempotency-key reads and writes in the dispatcher; `ctx.subscriptions` and the publisher's sequence
  counters stay on the loop. The database layer already allowed this: every call opens its own session
  from a `sessionmaker`, the Postgres pool is sized for it, SQLite uses `check_same_thread=False`, the
  memcache wrapper locks, and the plain `def` HTTP routes already ran in a thread pool.
  `test_46_handlers_off_the_loop.py` shows a 0.3 s query no longer stalls the loop and that two
  connections overlap. Left on the loop on purpose: the per-command rate-limit check (an in-process
  bucket, or one memcache `incr`).
- [x] **Audit `with self.database_session() as session:` blocks.** The context manager does not commit.
  Ten writers lacked a commit and are fixed (the last three: marking one notification read, saving a
  channel's notification preference, the appearance backfill). `tests/test_41_session_blocks_commit.py`
  now fails on any block that writes without committing, so review doesn't have to catch them.
- [x] **Retire the legacy frames and HTTP routes.** `/ws` requires `protocol=1`; `/ws/channels/{id}`, the
  polling loop and legacy frames are gone, and so are the HTTP edit, delete and reaction routes for channel
  messages (`message.edit`, `message.delete`, `reaction.add` and `reaction.remove` replace them). pypufferblow
  and bots default to the protocol. HTTP stays for sending with files, history, search and read markers.
  Direct messages still use HTTP for edit, delete and reactions (no DM commands yet).

### Frontend (`client-new/src/features/realtime/`)
- [x] Protocol client (`protocol.ts`, `commands.ts`, `session.ts`), shared fixtures, events with de-duplication
  and per-channel sequence tracking (`tracker.ts`), resync on a gap, a restart or a reconnect, sending with a
  nonce and an optimistic pending row, Retry that reuses the nonce, edit/delete/reactions as commands, pending
  and failed states in `MessageItem`, channels created after connect subscribed explicitly. Tests cover each.
- [x] **Attachments** still travel over HTTP, but now get a pending row with on-device previews and a
  Retry that resends the same files with the same nonce (`send_message` takes a `nonce` now).
  Uploads show no progress bar yet.
- [x] **`notification.created`** refreshes unread counts and the Inbox's notification list.
- [x] **Reactions on a pending message** show at once and are added once the message has its id
  (channels and DMs). Reply, edit and the menu still wait for the id.
- [ ] **Manual check against a running instance, through the client UI.** Done at protocol level on
  2026-10-18 against the live instance with two `ProtocolClient`s (16 of 16 checks): send, edit, react,
  delete, permission refusals, a dropped connection with automatic reconnect and resync of missed messages,
  live events resuming, and a send whose ack was lost then retried with the same nonce (one message, not
  two). Still to do by hand: the same flow in two client-new windows, to see pending and failed rows, Retry
  and the resync in the UI.

### Docs and examples
- [x] `docs/protocol/v1.md` written (in `pufferblow/`).
- [x] **`docs/architecture/commands-and-events.md`** written (layers, the path of one command, uploads, sequence
  numbers, where things live).
- [x] Python SDK: `pypufferblow.realtime.ProtocolClient`, `Client.realtime()`, `websocket(protocol=True)` and
  `BotOptions(use_protocol=True)`, documented in the SDK README and `docs/realtime.rst`.
- [x] **`examples/bot_client.py`** (in `pufferblow/`): connects with `ProtocolClient`, answers `!ping`, takes the instance and
  bot token from `PUFFERBLOW_INSTANCE` and `PUFFERBLOW_BOT_TOKEN`, never embeds credentials. Not run against a live
  instance yet.
- [x] **Observability counters** are documented, one row per counter, in the architecture page and linked from the
  `instance-health` entry of the API reference.
- [ ] **client-new does not use the upload commands yet.** It still sends files over HTTP (with a pending row and Retry);
  moving it to `upload.begin` / `upload.chunk` would give a progress bar per chunk and one transport for everything.
