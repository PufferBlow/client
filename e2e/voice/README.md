# Voice end-to-end checks

Real browsers talking to a real instance and media server. They exist because the unit tests use fake
peer connections: the call bugs that mattered (the SFU and the client offering at once, DTLS roles,
frame encryption) only show up with real WebRTC.

```bash
npm install
npx playwright-core install chromium     # once
npm run e2e:voice                        # every scenario
npm run e2e:voice -- dm-relay            # one scenario
```

| Scenario        | What it checks                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `channel-voice` | Three people in a voice channel, decoded audio both ways, mute and deafen agreeing with the instance, leaving, rejoining                                                                                     |
| `dm-call`       | A direct 1:1 call: ring, accept, end-to-end encrypted, same safety number on both sides, a changed key stops the call until accepted, decline, closing a tab ends the call                                   |
| `dm-relay`      | The same call through the media server (the direct attempt is skipped with `localStorage.pb_calls_force_relay = "1"`); audio is only decodable if the sealed frames were opened with the signed key exchange |

## What it needs

- Node, Go (to build `media-sfu`), and Python with Pufferblow's dependencies importable (`E2E_PYTHON`,
  default `python`; for a Poetry setup use `E2E_PYTHON="poetry run python"` is not supported, point it at the
  virtualenv's interpreter).
- The repositories side by side: `client/`, `pufferblow/` and `media-sfu/` under one folder.
- A Chromium (`npx playwright-core install chromium`, or `E2E_CHROMIUM=/path/to/chrome`).

Everything runs in the OS temp folder (`pufferblow-voice-e2e-*`): a fresh sqlite database, its own
config, ports 7600 (instance), 8790 (media server) and 5199 (Vite), overridable with `E2E_API_PORT`,
`E2E_SFU_PORT` and `E2E_WEB_PORT`. A real `~/.pufferblow` is never read or written. Logs of each process
are left in that folder.

The microphone is Chromium's fake device (a beep), so "audio decoded" is measured from the receiver's
`totalAudioEnergy`: packets arriving is not enough, the decoder has to have been given real audio.

## What it does not cover

- Calls across two instances (not built).
- A strict-NAT path that needs TURN: there is no TURN server in this setup, so the relay is tested by
  skipping the direct attempt rather than by blocking it.
- Firefox and Safari. Frame encryption uses `RTCRtpScriptTransform` where the browser has it and the
  older `createEncodedStreams` otherwise; only Chromium is run here.
