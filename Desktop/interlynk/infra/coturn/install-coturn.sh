#!/usr/bin/env bash
# Native coturn install for a Hostinger (or any Ubuntu/Debian) VPS — NO Docker.
# Installs the system `coturn` package, drops in our config, opens the firewall,
# and starts it as a systemd service.
#
# Usage (run on the VPS as root):
#   sudo TURN_PASSWORD='a-strong-password' bash infra/coturn/install-coturn.sh
# If TURN_PASSWORD is omitted, a random one is generated and printed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="$SCRIPT_DIR/turnserver.conf"
CONF_DST="/etc/turnserver.conf"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root:  sudo bash $0" >&2
  exit 1
fi
if [[ ! -f "$CONF_SRC" ]]; then
  echo "Cannot find turnserver.conf next to this script ($CONF_SRC)" >&2
  exit 1
fi

# 1. Install coturn from the distro repos (BSD-licensed, free).
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y coturn curl

# 2. Figure out the VPS public IP (clients must reach the relay here).
PUBLIC_IP="${TURN_EXTERNAL_IP:-$(curl -fsS https://api.ipify.org || true)}"
if [[ -z "${PUBLIC_IP}" ]]; then
  PUBLIC_IP="$(hostname -I | awk '{print $1}')"
  echo "WARNING: could not auto-detect a public IP; using ${PUBLIC_IP}." >&2
  echo "         If that is a private address, set TURN_EXTERNAL_IP and re-run." >&2
fi

# 3. Credential (use TURN_PASSWORD if provided, else generate one).
PASS="${TURN_PASSWORD:-$(openssl rand -hex 16)}"

# 4. Install our config, then patch in the IP + password.
cp "$CONF_SRC" "$CONF_DST"
sed -i "s|^user=interlynk:.*|user=interlynk:${PASS}|" "$CONF_DST"
sed -i "s|^# *external-ip=.*|external-ip=${PUBLIC_IP}|" "$CONF_DST"

# 5. Let the systemd service actually start (Debian/Ubuntu gate).
if [[ -f /etc/default/coturn ]]; then
  sed -i 's/^#\s*TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
  grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn || echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
fi

# 6. Open the firewall (ufw) if it's in use. The Hostinger hPanel firewall, if
#    enabled, must ALSO allow these — see the note printed below.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 3478/udp || true
  ufw allow 3478/tcp || true
  ufw allow 49152:49252/udp || true
fi

# 7. Start / restart the service.
systemctl enable coturn
systemctl restart coturn
sleep 1
systemctl --no-pager --full status coturn || true

cat <<EOF

────────────────────────────────────────────────────────────────────────
 coturn is installed and running natively (no Docker).

 Put these in frontend/.env, then rebuild the frontend:

   VITE_TURN_URLS=turn:${PUBLIC_IP}:3478
   VITE_TURN_USERNAME=interlynk
   VITE_TURN_CREDENTIAL=${PASS}

 IMPORTANT — open these ports in the Hostinger hPanel firewall too (the OS
 firewall above isn't enough if the panel firewall is enabled):
   • 3478  UDP and TCP
   • 49152-49252  UDP   (media relay range)

 Verify with https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
 using turn:${PUBLIC_IP}:3478 — you should see candidates of type "relay".
────────────────────────────────────────────────────────────────────────
EOF
