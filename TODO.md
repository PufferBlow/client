# TODO

Bugs and known limits for `client-new`. Items marked **backend** need a change in `pufferblow/`.

## Needs verification first

- [ ] **backend — profile payload may leak secrets.** `UserManager.user_profile()` only drops empty
  strings, and `Users.to_dict()` includes `password`, `auth_token` and `raw_auth_token`. If those
  are populated, `POST /api/v1/users/profile` (any `user_id`) and `GET /api/v1/users/list` return
  them to every signed-in user. Check a real response, and if confirmed, strip them in
  `user_profile()` and rotate affected tokens. (`pufferblow/pufferblow/api/user/user_manager.py`)

## Security

- [ ] **backend — password in the sign-in URL.** `GET /api/v1/users/signin?username=&password=` puts
  the password in the query string (server access logs, proxies, history). Add a `POST` signin and
  switch `services/auth.ts` to it.
- [ ] **backend — password change never checks the old password.** `PUT /users/profile` requires
  `old_password` but only the new one is used. The settings form collects it, but the server does
  not enforce it.
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
- [ ] **backend — tokens in URLs.** The websocket takes `?auth_token=` and most routes take it in
  the query string, so tokens appear in logs. Move to an `Authorization` header (the server ignores
  it today).

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
- [ ] **Existing tests fail at baseline here.** Signup returns 503 because `create_server_row` skips SQLite,
  so no server row exists in the test database (tests 01 to 07, 16, 17, 19, 23 to 25). The new tests stub
  `get_server`; fix it properly in `conftest.py`. `test_sequence_numbers_are_per_channel` failed once in a
  full-suite run and passed on every rerun; cause not found.
- [ ] `import magic` hangs in some shells (libmagic); use `python-magic-bin` on Windows or stub it, and
  confirm the signature-sniffing fallback in `storage/mime.py`.
- [ ] **Persist per-channel sequence numbers.** Sequence is in memory and resets with the process `epoch`;
  clients resync on an epoch change. A persisted sequence (or an outbox) would close the gap between
  commit and publish after a crash.
- [ ] **Publish `channel.updated` for role/privilege changes** and call `revalidate_subscriptions` and
  `grant_subscriptions` from those routes. Today they run on channel create, update, delete and
  member add/remove only, so gaining or losing `view_private_channels` takes effect on reconnect.
- [x] **Close the legacy private-channel leak.** Closed by removing the legacy `/ws` loop, the per-channel
  socket and `broadcast_to_eligible_users`; the v1 path checks `view_private_channels`.
- [ ] **Bots**: reactions (needs a schema change like `sender_bot_id`), creating and revoking bots (owner
  only API), end-to-end scope tests.
- [ ] **Credentials in the URL.** `/ws?auth_token=` puts the token in the query string. Logs redact it, but add
  a first-frame `auth` command or a subprotocol header.
- [ ] **Attachments over the socket.** Files still use the HTTP `send_message` upload path.
- [ ] **Per-IP and global connection limits**, in addition to the 10 sockets per user.
- [ ] **Run command handlers off the event loop** once the database layer is thread safe.
- [ ] **Audit `with self.database_session() as session:` blocks.** The context manager does not commit.
  Seven writers lacked a commit and are fixed; check new ones in review.
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
- [ ] **Manual check against a running instance** with two browsers: send, edit, delete, react, drop the
  network and watch the resync, retry a failed send. Only unit tests have run so far.

### Docs and examples
- [x] `docs/protocol/v1.md` written (in `pufferblow/`).
- [ ] **Write `docs/architecture/commands-and-events.md`** (layers: protocol, dispatcher, services, authorizer,
  publisher, connection manager).
- [x] Python SDK: `pypufferblow.realtime.ProtocolClient`, `Client.realtime()`, `websocket(protocol=True)` and
  `BotOptions(use_protocol=True)`, documented in the SDK README and `docs/realtime.rst`.
- [ ] **Add `examples/bot_client.py`** to `pufferblow/` using `ProtocolClient` and a bot token from an
  environment variable; never embed credentials.
- [ ] **Document the observability counters** exposed under `realtime` in `/api/v1/system/instance-health`.
