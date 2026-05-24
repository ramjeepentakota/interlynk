# Narada SFU (mediasoup)

Self-hosted WebRTC SFU that powers **group voice/video calls** (target: 20 participants).
No third-party, paid, cloud, or proprietary services — this is your own code running
on your own server, forwarding standard WebRTC media.

## How it fits together

```
Browser ──(1) GET /api/calls/sfu/token──> Spring Boot  (verifies you're a room participant,
   │                                                     mints a short-lived HS256 JWT)
   │
   └──(2) Socket.IO connect with that token──> THIS SFU service
                                                 (verifies JWT with the SHARED secret,
                                                  routes mediasoup WebRTC media)
```

- **Spring** is the authority on *who may join which room*. The SFU trusts only a valid token.
- `sfu.jwt-secret` (Spring) **must equal** `SFU_JWT_SECRET` (here).

## Requirements

- **Node.js >= 18**
- Build toolchain for the mediasoup native worker: **python3, make, g++** (Linux) —
  the project `scripts/install.sh` already installs these. On Windows, prebuilt
  binaries are downloaded automatically.

## Setup

```bash
cd sfu
cp .env.example .env        # then edit .env (see below)
npm install                 # builds/downloads the mediasoup worker
npm start
```

### The two settings you must get right

| Env | Localhost dev | Hostinger VPS |
|-----|---------------|---------------|
| `SFU_ANNOUNCED_IP` | `127.0.0.1` | your server's **public IPv4** |
| `SFU_JWT_SECRET` | any value, but **must match** Spring's `sfu.jwt-secret` | a long random string, matched on both |

Generate a secret: `openssl rand -hex 32`

### Firewall (VPS)

Open these inbound ports on the VPS:

- **TCP `4443`** (or your `SFU_PORT`) — Socket.IO signaling
- **UDP and TCP `40000-40100`** (your `SFU_RTC_MIN_PORT`–`SFU_RTC_MAX_PORT`) — RTC media

A **TURN server (coturn, see `/infra/coturn`)** is still recommended so participants
behind strict NAT/firewalls can reach the SFU.

## Wiring Spring to the SFU

In the backend environment (e.g. `backend/env.local.bat` for local):

```
SFU_URL=https://<your-host>:4443     # the Socket.IO origin the browser connects to
SFU_JWT_SECRET=<same secret as the SFU>
```

When `SFU_URL`/`SFU_JWT_SECRET` are unset, group calling is reported unavailable and
the app continues to run (1:1 calls use the mesh WebRTC path).

> TLS: browsers require a secure context for camera/mic. In production put the SFU
> behind your HTTPS reverse proxy (or give it a cert) so the Socket.IO origin is
> `https://`/`wss://`. For localhost, `http://localhost` is already a secure context.

## Run as a service (systemd, no Docker)

```ini
# /etc/systemd/system/narada-sfu.service
[Unit]
Description=Narada mediasoup SFU
After=network.target

[Service]
WorkingDirectory=/opt/narada/sfu
EnvironmentFile=/opt/narada/sfu/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
User=narada

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now narada-sfu
```

## Health

- `GET /health` → `{"status":"ok"}`
- `GET /stats`  → active rooms and peer counts

## Notes / roadmap

- Simulcast (3 spatial layers) is enabled on published video so the SFU can adapt
  quality per receiver — important at 20 participants.
- **Active-speaker selection** (server-side `AudioLevelObserver`) and **selective
  forwarding** (only fetch full-res for the speaker) are the next hardening step
  before sustained 20-way *video*; audio scales comfortably already.
