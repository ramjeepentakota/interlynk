# InterLynk TURN relay (coturn) — native VPS install, no Docker

Voice channels use **full-mesh WebRTC** — every participant connects directly to
every other participant, with **no media server / no SFU**. To connect two
browsers on different networks (anything beyond a cooperative LAN), WebRTC needs
a **TURN relay**. We run [coturn](https://github.com/coturn/coturn) **natively**
on your VPS as a normal systemd service — no Docker required.

Everything here is **free and sellable**:

| Component | License | Cost |
|---|---|---|
| WebRTC (browser) | Open standard (W3C/IETF) | Free, royalty-free |
| coturn (this relay) | BSD-3-Clause | Free |

Your VPS already has a public IP, which makes it the ideal place to run TURN:
every user's browser can reach it.

---

## 1. Install (one command)

Copy this repo (or just the `infra/coturn/` folder) to the VPS, then:

```bash
sudo TURN_PASSWORD='choose-a-strong-password' bash infra/coturn/install-coturn.sh
```

The script:
1. `apt install coturn` (from the Ubuntu/Debian repos),
2. auto-detects your VPS public IP and writes it as `external-ip`,
3. installs [`turnserver.conf`](./turnserver.conf) to `/etc/turnserver.conf` with your password,
4. enables + starts the `coturn` systemd service,
5. opens the OS firewall (ufw) and prints the exact `frontend/.env` values.

(Omit `TURN_PASSWORD` and it generates+prints a random one.)

### Prefer to do it by hand?

```bash
sudo apt update && sudo apt install -y coturn
sudo cp infra/coturn/turnserver.conf /etc/turnserver.conf
# edit /etc/turnserver.conf: set  user=interlynk:YOUR_PASSWORD  and  external-ip=YOUR_VPS_PUBLIC_IP
sudo sed -i 's/^#\s*TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl enable --now coturn
sudo systemctl status coturn
```

## 2. Open the firewall

| Port | Proto | Purpose |
|---|---|---|
| 3478 | UDP + TCP | STUN/TURN signaling |
| 49152–49252 | UDP | media relay range (matches `min/max-port`) |
| 5349 | TCP | only if you enable TLS (`turns://`) |

The script handles `ufw`. **Hostinger also has a firewall in hPanel** — if it's
enabled, add the same ports there, or the relay traffic is silently dropped.

## 3. Point the app at it

In `frontend/.env` (the install script prints these filled in):

```env
VITE_TURN_URLS=turn:YOUR_VPS_PUBLIC_IP:3478
VITE_TURN_USERNAME=interlynk
VITE_TURN_CREDENTIAL=your-strong-password
```

Rebuild the frontend. Both voice channels (`useVoiceMesh`) and 1-on-1 calls
(`useWebRTC`) read these and relay through coturn when a direct path isn't
possible.

## 4. Verify

- `sudo systemctl status coturn` → active (running).
- `sudo journalctl -u coturn -f` → watch logs while a call connects.
- [Trickle ICE tester](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):
  enter `turn:YOUR_VPS_PUBLIC_IP:3478` + the username/password, *Gather
  candidates* → you should see a **`relay`** candidate. None ⇒ ports blocked
  (check hPanel firewall) or `external-ip` wrong.

---

## Optional: TLS (`turns://` on 443/5349)

Survives strict corporate firewalls that only allow TLS egress. In
`/etc/turnserver.conf` uncomment `tls-listening-port=5349` and point `cert=` /
`pkey=` at a real certificate (e.g. the Let's Encrypt cert for your domain),
then add `VITE_TURN_URLS=turns:YOUR_DOMAIN:5349` (comma-separate with the plain
`turn:` entry).

## Securing the relay for production

The static `user=` credential is quickest to run, but it ships in the browser
bundle — anyone who reads it can use your relay (bandwidth theft). For a product
you sell, switch to **ephemeral, time-limited credentials** (coturn REST-API):

1. In `/etc/turnserver.conf`, replace the static-user block with:
   ```
   use-auth-secret
   static-auth-secret=A_LONG_RANDOM_SHARED_SECRET
   realm=interlynk
   ```
2. Have the backend mint short-lived credentials (username = `<unix-expiry>`,
   password = `base64(HMAC-SHA1(secret, username))`) and serve them to the
   client at call time instead of using `VITE_TURN_*`.

Ask and I'll wire up the backend endpoint + dynamic ICE config (slots into both
`useVoiceMesh` and `useWebRTC`).
