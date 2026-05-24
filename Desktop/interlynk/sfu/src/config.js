'use strict';

/**
 * SFU configuration, all overridable via environment (see .env.example).
 *
 * The two values you MUST get right per environment:
 *   - SFU_ANNOUNCED_IP: the IP browsers use to reach this server. On a VPS this
 *     is the server's PUBLIC IP. On localhost dev, 127.0.0.1.
 *   - SFU_JWT_SECRET: shared HMAC secret with the Spring backend that mints
 *     join tokens. Must be identical on both sides.
 */
const os = require('os');

function intEnv(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

const numWorkers = intEnv('SFU_NUM_WORKERS', Math.max(1, os.cpus().length));

module.exports = {
  // HTTP + Socket.IO signaling port.
  listenPort: intEnv('SFU_PORT', 4443),
  // Bind address for the signaling HTTP server (0.0.0.0 = all interfaces).
  listenHost: process.env.SFU_HOST || '0.0.0.0',

  // Shared secret with the Spring backend (HS256). REQUIRED in production.
  jwtSecret: process.env.SFU_JWT_SECRET || 'change-me-shared-with-spring',

  // Allowed CORS origins for the Socket.IO handshake (comma-separated).
  // '*' is acceptable only because the JWT — not the Origin — is what
  // authorizes a join. Lock down to your real origins in production.
  corsOrigins: (process.env.SFU_CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Hard cap on participants per room. The product target is 20; we leave a
  // little headroom and reject joins beyond it so one room can't exhaust a worker.
  maxPeersPerRoom: intEnv('SFU_MAX_PEERS_PER_ROOM', 24),

  mediasoup: {
    numWorkers,
    worker: {
      // RTC media port range. Open this UDP (and TCP) range on the VPS firewall.
      rtcMinPort: intEnv('SFU_RTC_MIN_PORT', 40000),
      rtcMaxPort: intEnv('SFU_RTC_MAX_PORT', 40100),
      logLevel: process.env.SFU_LOG_LEVEL || 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    // Codecs offered by every room router. VP8 + Opus are the safe, universal
    // baseline; H264 is included for Safari/hardware-encode interop.
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: { 'x-google-start-bitrate': 1000 },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    // WebRTC transport settings. announcedIp is what the SFU advertises in ICE
    // candidates — it must be reachable by the browser.
    webRtcTransport: {
      listenInfos: [
        {
          protocol: 'udp',
          ip: process.env.SFU_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.SFU_ANNOUNCED_IP || '127.0.0.1',
        },
        {
          protocol: 'tcp',
          ip: process.env.SFU_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.SFU_ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      // Initial outbound bitrate ceiling per consumer; mediasoup adapts from here.
      initialAvailableOutgoingBitrate: intEnv('SFU_INITIAL_BITRATE', 1000000),
      maxIncomingBitrate: intEnv('SFU_MAX_INCOMING_BITRATE', 1500000),
    },
  },
};
