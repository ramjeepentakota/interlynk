import { defineConfig, type ProxyOptions } from 'vite'
import type { ClientRequest } from 'http'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

// ── HTTPS ────────────────────────────────────────────────────────────────────
// Serve the dev/preview server over a self-signed TLS cert by default.
// WebRTC media APIs (getUserMedia / getDisplayMedia) require a secure context,
// i.e. https:// or http://localhost. Hitting the app from another device on
// the LAN over http://<ip>:5173 blocks the camera/microphone entirely, so
// HTTPS is the right default for this project. Set HTTPS=false to opt out.
const useHttps = !(process.env.HTTPS === 'false' || process.env.HTTPS === '0')

// ── LAN IP auto-detection ───────────────────────────────────────────────────
// We deliberately do NOT bind to localhost. The app must be served on a real
// network interface so that other devices on the LAN can reach it and so that
// the URL pattern matches production (single LAN/public IP behind TLS).
//
// Pick the first private-range IPv4 (192.168.x, 10.x, 172.16-31.x). Override
// with HOST=192.168.x.y when needed.
// Interface name fragments that indicate a virtual/hypervisor adapter.
// These are never the right address for LAN access or WebRTC peer discovery.
const VIRTUAL_ADAPTER_PATTERNS = [
  'virtualbox',
  'vmware',
  'vethernet',   // Hyper-V / WSL
  'wsl',
  'loopback',
  'pseudo',
  'tunnel',
  'teredo',
  'isatap',
]

function isVirtualAdapter(name: string): boolean {
  const lower = name.toLowerCase()
  return VIRTUAL_ADAPTER_PATTERNS.some((p) => lower.includes(p))
}

// On Windows, os.networkInterfaces() uses the adapter SHORT NAME (e.g. "Ethernet 6"),
// NOT the InterfaceDescription ("VirtualBox Host-Only Ethernet Adapter"). Query
// Get-NetAdapter to build the name→description map so we can skip virtual adapters
// that have generic names.
function getVirtualAdapterNames(): Set<string> {
  const result = new Set<string>()
  if (process.platform !== 'win32') return result
  try {
    const json = execSync(
      'powershell -NoProfile -NonInteractive -Command "Get-NetAdapter | Select-Object Name,InterfaceDescription | ConvertTo-Json -Compress"',
      { timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim()
    const raw: unknown = JSON.parse(json)
    const list = Array.isArray(raw) ? raw : [raw]
    for (const a of list as Array<{ Name?: string; InterfaceDescription?: string }>) {
      if (a?.Name && a?.InterfaceDescription && isVirtualAdapter(a.InterfaceDescription)) {
        result.add(a.Name)
      }
    }
  } catch {
    // PowerShell unavailable or failed — fall back to name-only detection
  }
  return result
}

const virtualAdapterNames = getVirtualAdapterNames()

function detectLanIpv4(): string {
  const interfaces = os.networkInterfaces()
  for (const ifaceName of Object.keys(interfaces)) {
    if (isVirtualAdapter(ifaceName) || virtualAdapterNames.has(ifaceName)) continue
    const addrs = interfaces[ifaceName] || []
    for (const a of addrs) {
      if (a.family !== 'IPv4' || a.internal) continue
      const ip = a.address
      if (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
      ) {
        return ip
      }
    }
  }
  // Fall back to binding all interfaces if no physical private IPv4 was found.
  return '0.0.0.0'
}

const host = process.env.HOST || detectLanIpv4()
const port = Number(process.env.PORT || 5173)
// The proxy target is SERVER-SIDE and never visible to the browser. Default
// to loopback so we don't depend on inbound LAN firewall rules for the dev
// machine. Override BACKEND_URL when the backend lives on a different host.
const backendHost = process.env.BACKEND_HOST || '127.0.0.1'
const backendPort = process.env.BACKEND_PORT || '8082'
const backendTarget = process.env.BACKEND_URL || `http://${backendHost}:${backendPort}`

// Self-hosted mediasoup SFU Socket.IO signaling. Proxied under the same TLS dev
// origin (path /sfu-io) so the browser connects over wss:// with no second
// self-signed cert and no mixed-content block — nginx does the identical proxy
// in production. ONLY signaling is proxied here; the WebRTC *media* (SRTP/DTLS
// over UDP/TCP) flows directly to the SFU's announced IP and is exempt from
// mixed-content rules.
const sfuHost = process.env.SFU_HOST || '127.0.0.1'
const sfuPort = process.env.SFU_PORT || '4443'
const sfuTarget = process.env.SFU_URL_TARGET || `http://${sfuHost}:${sfuPort}`

// Strip the browser's Origin/Referer headers on the way to the backend. The
// proxy is inside our trust boundary, so the backend's CORS doesn't need to
// validate the browser origin. Removing Origin makes Spring's CORS
// short-circuit, which keeps the prebuilt backend JAR working without a
// rebuild regardless of how the dev server is opened.
const stripOriginHeader = (proxyReq: ClientRequest) => {
  proxyReq.removeHeader('Origin')
  proxyReq.removeHeader('Referer')
}

const proxy: Record<string, ProxyOptions> = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    configure: (p) => {
      p.on('proxyReq', (proxyReq) => stripOriginHeader(proxyReq))
    },
  },
  '/ws': {
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    ws: true,
    configure: (p) => {
      p.on('proxyReq', (proxyReq) => stripOriginHeader(proxyReq))
      p.on('proxyReqWs', (proxyReq) => stripOriginHeader(proxyReq))
    },
  },
  // SFU Socket.IO signaling. Strip the /sfu-io prefix so the SFU sees its native
  // /socket.io/ path. ws:true upgrades the long-poll → websocket transport.
  '/sfu-io': {
    target: sfuTarget,
    changeOrigin: true,
    secure: false,
    ws: true,
    rewrite: (p) => p.replace(/^\/sfu-io/, ''),
    configure: (p) => {
      p.on('proxyReq', (proxyReq) => stripOriginHeader(proxyReq))
      p.on('proxyReqWs', (proxyReq) => stripOriginHeader(proxyReq))
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    // Replace Vite's default `Local: https://localhost:5173/` banner — we
    // intentionally bind to the LAN IP only, so the localhost URL would just
    // be misleading (and confused the team during testing). Show only the
    // bound address.
    {
      name: 'interlynk:print-only-bound-url',
      configureServer(server) {
        const originalPrint = server.printUrls.bind(server)
        server.printUrls = () => {
          const proto = useHttps ? 'https' : 'http'
          const url = `${proto}://${host}:${port}/`
          // eslint-disable-next-line no-console
          console.log(`\n  → InterLynk dev server: ${url}\n  Open this URL on any device on the LAN.\n`)
          // Suppress Vite's own banner.
          void originalPrint
        }
      },
      configurePreviewServer(server) {
        const originalPrint = server.printUrls.bind(server)
        server.printUrls = () => {
          const proto = useHttps ? 'https' : 'http'
          const url = `${proto}://${host}:${port}/`
          // eslint-disable-next-line no-console
          console.log(`\n  → InterLynk preview server: ${url}\n`)
          void originalPrint
        }
      },
    },
  ],
  server: {
    host,
    port,
    strictPort: true,
    proxy,
  },
  preview: {
    host,
    port,
    strictPort: true,
    proxy,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  css: {
    postcss: './postcss.config.js',
  },
})
