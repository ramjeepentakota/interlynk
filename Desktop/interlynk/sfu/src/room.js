'use strict';

const config = require('./config');
const { getWorker } = require('./workers');

/**
 * A Room owns one mediasoup Router (on one worker) and the set of connected
 * peers. Each peer has up to two WebRTC transports (one for sending, one for
 * receiving), its producers (the tracks it publishes), and its consumers (the
 * tracks it receives from others).
 *
 * Rooms are created lazily on first join and destroyed when the last peer
 * leaves, so idle rooms hold no resources.
 */
const rooms = new Map(); // roomId -> Room

class Peer {
  constructor(socketId, identity, displayName, canPublish) {
    this.socketId = socketId;
    this.identity = identity;
    this.displayName = displayName;
    this.canPublish = canPublish;
    this.transports = new Map(); // transportId -> WebRtcTransport
    this.producers = new Map(); // producerId -> Producer
    this.consumers = new Map(); // consumerId -> Consumer
  }

  close() {
    for (const t of this.transports.values()) {
      try { t.close(); } catch { /* already closed */ }
    }
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();
  }
}

class Room {
  constructor(roomId, router) {
    this.id = roomId;
    this.router = router;
    this.peers = new Map(); // socketId -> Peer
  }

  static async getOrCreate(roomId) {
    let room = rooms.get(roomId);
    if (room) return room;
    const worker = getWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    });
    room = new Room(roomId, router);
    rooms.set(roomId, room);
    // eslint-disable-next-line no-console
    console.log(`[sfu] room "${roomId}" created on worker ${worker.pid}`);
    return room;
  }

  get rtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  addPeer(peer) {
    this.peers.set(peer.socketId, peer);
  }

  getPeer(socketId) {
    return this.peers.get(socketId);
  }

  /** Producers from every OTHER peer — what a (re)joining peer should consume. */
  otherProducers(socketId) {
    const list = [];
    for (const peer of this.peers.values()) {
      if (peer.socketId === socketId) continue;
      for (const producer of peer.producers.values()) {
        list.push({
          producerId: producer.id,
          identity: peer.identity,
          displayName: peer.displayName,
          kind: producer.kind,
          appData: producer.appData,
        });
      }
    }
    return list;
  }

  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    peer.close();
    this.peers.delete(socketId);
    // Tear the room (and its router) down once empty so workers stay lean.
    if (this.peers.size === 0) {
      try { this.router.close(); } catch { /* noop */ }
      rooms.delete(this.id);
      // eslint-disable-next-line no-console
      console.log(`[sfu] room "${this.id}" closed (empty)`);
    }
  }

  async createWebRtcTransport() {
    const { webRtcTransport } = config.mediasoup;
    const transport = await this.router.createWebRtcTransport({
      listenInfos: webRtcTransport.listenInfos,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: webRtcTransport.initialAvailableOutgoingBitrate,
    });

    if (webRtcTransport.maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(webRtcTransport.maxIncomingBitrate);
      } catch { /* not fatal */ }
    }
    return transport;
  }
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function roomStats() {
  const out = [];
  for (const room of rooms.values()) {
    out.push({ roomId: room.id, peers: room.peers.size });
  }
  return out;
}

module.exports = { Room, Peer, getRoom, roomStats };
