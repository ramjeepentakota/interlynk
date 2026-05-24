'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const config = require('./config');
const { createWorkers } = require('./workers');
const { Room, Peer, getRoom, roomStats } = require('./room');

/**
 * Narada SFU signaling server.
 *
 * Auth model: the Spring backend is the source of truth for who may join which
 * room. A client first calls Spring to mint a short-lived HS256 JWT (room +
 * identity + canPublish), then connects here passing that token in the
 * Socket.IO handshake. We verify the signature/expiry with the SHARED secret —
 * the SFU never talks to the database and trusts only a valid token.
 */
async function main() {
  await createWorkers();

  const app = express();

  // Liveness/readiness + lightweight room stats (no auth; exposes no media).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/stats', (_req, res) => res.json({ rooms: roomStats() }));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigins, methods: ['GET', 'POST'] },
    // Media signaling messages are tiny; keep transports default (ws + polling).
  });

  // ── Handshake auth ─────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('missing token'));
      const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      const room = String(claims.room || '');
      const identity = String(claims.sub || claims.identity || '');
      if (!room || !identity) return next(new Error('invalid token claims'));
      socket.data.roomId = room;
      socket.data.identity = identity;
      socket.data.displayName = claims.name || identity;
      // Default to publish-allowed unless the token explicitly forbids it.
      socket.data.canPublish = claims.canPublish !== false;
      return next();
    } catch (err) {
      return next(new Error('unauthorized: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    const { roomId, identity, displayName, canPublish } = socket.data;
    let room;
    try {
      room = await Room.getOrCreate(roomId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[sfu] failed to create room', roomId, err);
      socket.emit('sfuError', { message: 'room init failed' });
      socket.disconnect(true);
      return;
    }

    if (room.peers.size >= config.maxPeersPerRoom) {
      socket.emit('sfuError', { message: 'room full' });
      socket.disconnect(true);
      return;
    }

    const peer = new Peer(socket.id, identity, displayName, canPublish);
    room.addPeer(peer);
    socket.join(roomId);

    // Tell the rest of the room someone joined (roster update).
    socket.to(roomId).emit('peerJoined', { socketId: socket.id, identity, displayName });

    // eslint-disable-next-line no-console
    console.log(`[sfu] "${identity}" joined room "${roomId}" (${room.peers.size} peer(s))`);

    // ── Signaling handlers ─────────────────────────────────────────────────
    // Every handler uses Socket.IO ack callbacks for request/response and
    // never throws back to the socket — failures resolve as { error }.

    const ack = (cb, fn) => async (data) => {
      try {
        const result = await fn(data);
        if (typeof cb === 'function') cb(result);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[sfu] handler error (${identity}/${roomId}):`, err.message);
        if (typeof cb === 'function') cb({ error: err.message });
      }
    };

    socket.on('getRouterRtpCapabilities', (data, cb) =>
      ack(cb, async () => room.rtpCapabilities)(data));

    socket.on('createWebRtcTransport', (data, cb) =>
      ack(cb, async ({ direction }) => {
        const transport = await room.createWebRtcTransport();
        transport.appData.direction = direction;
        peer.transports.set(transport.id, transport);

        transport.on('dtlsstatechange', (state) => {
          if (state === 'closed') {
            try { transport.close(); } catch { /* noop */ }
            peer.transports.delete(transport.id);
          }
        });

        return {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        };
      })(data));

    socket.on('connectWebRtcTransport', (data, cb) =>
      ack(cb, async ({ transportId, dtlsParameters }) => {
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error('transport not found');
        await transport.connect({ dtlsParameters });
        return { connected: true };
      })(data));

    socket.on('produce', (data, cb) =>
      ack(cb, async ({ transportId, kind, rtpParameters, appData }) => {
        if (!canPublish) throw new Error('not allowed to publish');
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error('send transport not found');

        const producer = await transport.produce({
          kind,
          rtpParameters,
          appData: { ...appData, identity },
        });
        peer.producers.set(producer.id, producer);

        producer.on('transportclose', () => {
          peer.producers.delete(producer.id);
        });

        // Notify every other peer so they can consume this new track.
        socket.to(roomId).emit('newProducer', {
          producerId: producer.id,
          identity,
          displayName,
          kind: producer.kind,
          appData: producer.appData,
        });

        return { id: producer.id };
      })(data));

    socket.on('consume', (data, cb) =>
      ack(cb, async ({ producerId, rtpCapabilities, transportId }) => {
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('cannot consume this producer');
        }
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error('recv transport not found');

        // Start paused; the client resumes once its <video>/<audio> is attached.
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });
        peer.consumers.set(consumer.id, consumer);

        consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
        consumer.on('producerclose', () => {
          peer.consumers.delete(consumer.id);
          socket.emit('consumerClosed', { consumerId: consumer.id });
        });

        return {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        };
      })(data));

    socket.on('resumeConsumer', (data, cb) =>
      ack(cb, async ({ consumerId }) => {
        const consumer = peer.consumers.get(consumerId);
        if (!consumer) throw new Error('consumer not found');
        await consumer.resume();
        return { resumed: true };
      })(data));

    socket.on('getProducers', (data, cb) =>
      ack(cb, async () => room.otherProducers(socket.id))(data));

    socket.on('closeProducer', (data, cb) =>
      ack(cb, async ({ producerId }) => {
        const producer = peer.producers.get(producerId);
        if (producer) {
          try { producer.close(); } catch { /* noop */ }
          peer.producers.delete(producerId);
          socket.to(roomId).emit('producerClosed', { producerId, identity });
        }
        return { closed: true };
      })(data));

    // Mute/unmute and camera on/off map to pausing/resuming the producer so the
    // SFU stops forwarding the track entirely (saves bandwidth vs. silent frames).
    socket.on('pauseProducer', (data, cb) =>
      ack(cb, async ({ producerId }) => {
        const producer = peer.producers.get(producerId);
        if (producer) {
          await producer.pause();
          socket.to(roomId).emit('producerPaused', { producerId, identity });
        }
        return { paused: true };
      })(data));

    socket.on('resumeProducer', (data, cb) =>
      ack(cb, async ({ producerId }) => {
        const producer = peer.producers.get(producerId);
        if (producer) {
          await producer.resume();
          socket.to(roomId).emit('producerResumed', { producerId, identity });
        }
        return { resumed: true };
      })(data));

    socket.on('disconnect', () => {
      const r = getRoom(roomId);
      if (r) {
        socket.to(roomId).emit('peerClosed', { socketId: socket.id, identity });
        r.removePeer(socket.id);
      }
      // eslint-disable-next-line no-console
      console.log(`[sfu] "${identity}" left room "${roomId}"`);
    });
  });

  server.listen(config.listenPort, config.listenHost, () => {
    // eslint-disable-next-line no-console
    console.log(`[sfu] signaling listening on http://${config.listenHost}:${config.listenPort}`);
    if (config.jwtSecret === 'change-me-shared-with-spring') {
      // eslint-disable-next-line no-console
      console.warn('[sfu] WARNING: using the default SFU_JWT_SECRET — set a real one shared with Spring.');
    }
    if ((process.env.SFU_ANNOUNCED_IP || '127.0.0.1') === '127.0.0.1') {
      // eslint-disable-next-line no-console
      console.warn('[sfu] SFU_ANNOUNCED_IP is 127.0.0.1 — only same-machine browsers can connect. Set the public IP on a VPS.');
    }
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[sfu] fatal startup error', err);
  process.exit(1);
});
