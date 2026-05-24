/**
 * useSfu — connects the browser to the self-hosted mediasoup SFU for multi-party
 * (up to ~20) audio/video calls over plain WebRTC.
 *
 * Design goal: expose the SAME surface as the old `useLiveKit` hook so the call
 * panel can switch between this and the 1:1 mesh WebRTC path with minimal logic.
 * Each participant carries plain MediaStreams (cameraStream / screenStream) that
 * a video tile binds via `el.srcObject`; remote audio is auto-attached to hidden
 * <audio> elements here.
 *
 * Signaling protocol (Socket.IO, see /sfu/src/server.js):
 *   getRouterRtpCapabilities → createWebRtcTransport(send/recv) →
 *   connectWebRtcTransport → produce / consume / resumeConsumer, plus the
 *   server-pushed events: newProducer, producerClosed, peerClosed,
 *   producerPaused/Resumed, consumerClosed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Device, types } from 'mediasoup-client';

export type SfuState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SfuParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  /** Active-speaker flag. Always false for now; populated in the active-speaker
   *  pass (server-side AudioLevelObserver) — kept so UI can render a speaking ring. */
  isSpeaking: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  /** Live camera video for this participant (null when camera off). */
  cameraStream: MediaStream | null;
  /** Live screen-share video for this participant (null when not sharing). */
  screenStream: MediaStream | null;
}

interface UseSfuOptions {
  /** Socket.IO origin of the SFU, e.g. https://host:4443 */
  url?: string;
  /** Spring-minted join token (room + identity + canPublish). */
  token?: string;
  /** Local display name, used for the local roster entry. */
  identity?: string;
  displayName?: string;
  /** Start with the camera on (video calls). */
  withVideo: boolean;
  /** Only connect when true (token resolved + panel open). */
  enabled: boolean;
}

/** HTMLMediaElement.setSinkId is part of the Audio Output Devices API but not
 *  in every TS lib.dom version, so we feature-detect through a narrow type. */
type WithSinkId = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
function applySink(el: HTMLMediaElement, deviceId: string): Promise<void> {
  const fn = (el as WithSinkId).setSinkId;
  return typeof fn === 'function' ? fn.call(el, deviceId).catch(() => undefined) : Promise.resolve();
}

const SIMULCAST_ENCODINGS = [
  { rid: 'r0', maxBitrate: 100_000, scalabilityMode: 'S1T3' },
  { rid: 'r1', maxBitrate: 300_000, scalabilityMode: 'S1T3' },
  { rid: 'r2', maxBitrate: 900_000, scalabilityMode: 'S1T3' },
];

/** Internal mutable record of a remote participant's tracks. */
interface RemoteRec {
  identity: string;
  name: string;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  micPaused: boolean;
  cameraConsumerId: string | null;
  screenConsumerId: string | null;
  audioConsumerId: string | null;
}

export function useSfu({ url, token, identity, displayName, withVideo, enabled }: UseSfuOptions) {
  const [state, setState] = useState<SfuState>('idle');
  const [participants, setParticipants] = useState<SfuParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(withVideo);
  const [screenSharing, setScreenSharing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<types.Transport | null>(null);
  const recvTransportRef = useRef<types.Transport | null>(null);

  const micProducerRef = useRef<types.Producer | null>(null);
  const camProducerRef = useRef<types.Producer | null>(null);
  const screenProducerRef = useRef<types.Producer | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const consumersRef = useRef<Map<string, types.Consumer>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // identity -> RemoteRec
  const remotesRef = useRef<Map<string, RemoteRec>>(new Map());
  // Selected audio-output (speaker/earpiece) deviceId applied to every remote
  // <audio> element via setSinkId. Empty string = browser default sink.
  const sinkIdRef = useRef<string>('');

  const selfIdentity = identity || 'me';
  const selfName = displayName || identity || 'You';

  // ── Roster snapshot ────────────────────────────────────────────────────────
  const publishRoster = useCallback(() => {
    const list: SfuParticipant[] = [];
    // Local participant first.
    const cam = camProducerRef.current && !camProducerRef.current.paused
      ? localStreamRef.current?.getVideoTracks().find((t) => t.kind === 'video') ?? null
      : null;
    list.push({
      identity: selfIdentity,
      name: selfName,
      isLocal: true,
      isSpeaking: false,
      micEnabled,
      cameraEnabled,
      screenSharing,
      cameraStream: cam ? new MediaStream([cam]) : null,
      screenStream: screenStreamRef.current
        ? new MediaStream(screenStreamRef.current.getVideoTracks())
        : null,
    });
    // Remote participants.
    for (const rec of remotesRef.current.values()) {
      list.push({
        identity: rec.identity,
        name: rec.name,
        isLocal: false,
        isSpeaking: false,
        micEnabled: !rec.micPaused && Boolean(rec.audioConsumerId),
        cameraEnabled: Boolean(rec.cameraTrack),
        screenSharing: Boolean(rec.screenTrack),
        cameraStream: rec.cameraTrack ? new MediaStream([rec.cameraTrack]) : null,
        screenStream: rec.screenTrack ? new MediaStream([rec.screenTrack]) : null,
      });
    }
    setParticipants(list);
  }, [selfIdentity, selfName, micEnabled, cameraEnabled, screenSharing]);

  // ── Socket request/response helper (Socket.IO ack) ──────────────────────────
  const request = useCallback(<T = unknown>(event: string, data?: unknown): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const sock = socketRef.current;
      if (!sock) return reject(new Error('socket not connected'));
      sock.timeout(15000).emit(event, data, (err: Error | null, res: T | { error?: string }) => {
        if (err) return reject(err);
        if (res && typeof res === 'object' && 'error' in res && res.error) {
          return reject(new Error(String(res.error)));
        }
        resolve(res as T);
      });
    });
  }, []);

  const getRemote = (id: string, name?: string): RemoteRec => {
    let rec = remotesRef.current.get(id);
    if (!rec) {
      rec = {
        identity: id,
        name: name || id,
        cameraTrack: null,
        screenTrack: null,
        micPaused: false,
        cameraConsumerId: null,
        screenConsumerId: null,
        audioConsumerId: null,
      };
      remotesRef.current.set(id, rec);
    } else if (name) {
      rec.name = name;
    }
    return rec;
  };

  // ── Consume a remote producer ───────────────────────────────────────────────
  const consume = useCallback(
    async (producerId: string, producerIdentity: string, producerName: string, source: string) => {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;
      try {
        const params = await request<{
          id: string;
          producerId: string;
          kind: 'audio' | 'video';
          rtpParameters: unknown;
        }>('consume', {
          producerId,
          rtpCapabilities: device.rtpCapabilities,
          transportId: recvTransport.id,
        });

        const consumer = await recvTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rtpParameters: params.rtpParameters as any,
        });
        consumersRef.current.set(consumer.id, consumer);

        const rec = getRemote(producerIdentity, producerName);

        if (consumer.kind === 'audio') {
          rec.audioConsumerId = consumer.id;
          // Attach remote audio to a hidden, always-playing element.
          const el = document.createElement('audio');
          el.autoplay = true;
          el.srcObject = new MediaStream([consumer.track]);
          el.style.position = 'fixed';
          el.style.left = '-9999px';
          el.style.opacity = '0';
          document.body.appendChild(el);
          // Route to the currently selected output (speaker/earpiece) so a
          // participant who joins AFTER the user picked an output still plays
          // through it. Best-effort: unsupported browsers (iOS Safari) ignore.
          if (sinkIdRef.current) void applySink(el, sinkIdRef.current);
          el.play().catch(() => { /* gesture-unlock handled by panel */ });
          audioElsRef.current.set(consumer.id, el);
        } else if (source === 'screen') {
          rec.screenTrack = consumer.track;
          rec.screenConsumerId = consumer.id;
        } else {
          rec.cameraTrack = consumer.track;
          rec.cameraConsumerId = consumer.id;
        }

        // Server creates consumers paused; resume now that the track is wired up.
        await request('resumeConsumer', { consumerId: consumer.id });
        publishRoster();
      } catch (err) {
        console.warn('[sfu] consume failed', err);
      }
    },
    [request, publishRoster]
  );

  // ── Main connect lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !url || !token) return;
    let cancelled = false;

    setState('connecting');
    // A url beginning with "/" is a same-origin proxy PATH (e.g. "/sfu-io"):
    // the dev server / nginx forwards it to the SFU, so the browser uses the
    // page's own (TLS) origin — no second cert, no mixed-content block. An
    // absolute http(s) url connects directly (dedicated SFU host in prod).
    const isProxyPath = url.startsWith('/');
    const socket = isProxyPath
      ? io(window.location.origin, {
          path: `${url.replace(/\/+$/, '')}/socket.io`,
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
        })
      : io(url, {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
        });
    socketRef.current = socket;

    // Server-pushed events.
    socket.on('newProducer', ({ producerId, identity: pid, displayName: pname, appData }) => {
      const source = (appData && (appData as { source?: string }).source) || 'camera';
      void consume(producerId, pid, pname, source);
    });
    socket.on('producerClosed', ({ producerId, identity: pid }) => {
      // We don't track producerId→consumer directly; rebuild on consumerClosed.
      const rec = remotesRef.current.get(pid);
      if (rec) publishRoster();
      void producerId;
    });
    socket.on('consumerClosed', ({ consumerId }: { consumerId: string }) => {
      cleanupConsumer(consumerId);
      publishRoster();
    });
    socket.on('producerPaused', ({ identity: pid }: { identity: string }) => {
      const rec = remotesRef.current.get(pid);
      if (rec) { rec.micPaused = true; publishRoster(); }
    });
    socket.on('producerResumed', ({ identity: pid }: { identity: string }) => {
      const rec = remotesRef.current.get(pid);
      if (rec) { rec.micPaused = false; publishRoster(); }
    });
    socket.on('peerJoined', () => publishRoster());
    socket.on('peerClosed', ({ identity: pid }: { identity: string }) => {
      const rec = remotesRef.current.get(pid);
      if (rec) {
        [rec.audioConsumerId, rec.cameraConsumerId, rec.screenConsumerId].forEach((cid) => {
          if (cid) cleanupConsumer(cid);
        });
        remotesRef.current.delete(pid);
        publishRoster();
      }
    });
    socket.on('sfuError', ({ message }: { message: string }) => {
      console.error('[sfu] server error:', message);
      if (!cancelled) setState('error');
    });
    socket.on('disconnect', () => {
      if (!cancelled) setState('disconnected');
    });
    socket.on('connect_error', (err) => {
      console.error('[sfu] connect_error', err.message);
      if (!cancelled) setState('error');
    });

    const cleanupConsumer = (consumerId: string) => {
      const consumer = consumersRef.current.get(consumerId);
      if (consumer) { try { consumer.close(); } catch { /* noop */ } }
      consumersRef.current.delete(consumerId);
      const el = audioElsRef.current.get(consumerId);
      if (el) { try { el.srcObject = null; el.remove(); } catch { /* noop */ } audioElsRef.current.delete(consumerId); }
      // Clear any remote rec slot that referenced this consumer.
      for (const rec of remotesRef.current.values()) {
        if (rec.audioConsumerId === consumerId) rec.audioConsumerId = null;
        if (rec.cameraConsumerId === consumerId) { rec.cameraConsumerId = null; rec.cameraTrack = null; }
        if (rec.screenConsumerId === consumerId) { rec.screenConsumerId = null; rec.screenTrack = null; }
      }
    };

    const start = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          socket.on('connect_error', (e) => reject(e));
        });
        if (cancelled) return;

        // 1) Load the mediasoup device with the router's capabilities.
        const routerRtpCapabilities = await request('getRouterRtpCapabilities');
        const device = new Device();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await device.load({ routerRtpCapabilities: routerRtpCapabilities as any });
        deviceRef.current = device;
        if (cancelled) return;

        // 2) Create send + recv transports.
        const sendParams = await request<TransportParams>('createWebRtcTransport', { direction: 'send' });
        const sendTransport = device.createSendTransport(toClientTransport(sendParams));
        sendTransportRef.current = sendTransport;
        wireTransport(sendTransport, request);

        const recvParams = await request<TransportParams>('createWebRtcTransport', { direction: 'recv' });
        const recvTransport = device.createRecvTransport(toClientTransport(recvParams));
        recvTransportRef.current = recvTransport;
        wireTransport(recvTransport, request);

        if (cancelled) return;

        // 3) Capture and publish local mic (+ camera for video calls).
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          micProducerRef.current = await sendTransport.produce({
            track: audioTrack,
            appData: { source: 'mic' },
          });
          setMicEnabled(true);
        }
        const videoTrack = stream.getVideoTracks()[0];
        if (withVideo && videoTrack) {
          camProducerRef.current = await sendTransport.produce({
            track: videoTrack,
            encodings: SIMULCAST_ENCODINGS,
            codecOptions: { videoGoogleStartBitrate: 1000 },
            appData: { source: 'camera' },
          });
          setCameraEnabled(true);
        }

        // 4) Consume everyone already in the room.
        const existing = await request<Array<{
          producerId: string; identity: string; displayName: string; kind: string;
          appData?: { source?: string };
        }>>('getProducers');
        for (const p of existing) {
          await consume(p.producerId, p.identity, p.displayName, p.appData?.source || 'camera');
        }

        if (!cancelled) {
          setState('connected');
          publishRoster();
        }
      } catch (err) {
        console.error('[sfu] connect error', err);
        if (!cancelled) setState('error');
      }
    };
    void start();

    return () => {
      cancelled = true;
      consumersRef.current.forEach((c) => { try { c.close(); } catch { /* noop */ } });
      consumersRef.current.clear();
      audioElsRef.current.forEach((el) => { try { el.remove(); } catch { /* noop */ } });
      audioElsRef.current.clear();
      remotesRef.current.clear();
      [micProducerRef, camProducerRef, screenProducerRef].forEach((r) => {
        if (r.current) { try { r.current.close(); } catch { /* noop */ } r.current = null; }
      });
      localStreamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
      screenStreamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
      localStreamRef.current = null;
      screenStreamRef.current = null;
      try { sendTransportRef.current?.close(); } catch { /* noop */ }
      try { recvTransportRef.current?.close(); } catch { /* noop */ }
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      deviceRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url, token, withVideo]);

  // ── Controls ────────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const producer = micProducerRef.current;
    if (!producer) return;
    if (producer.paused) {
      producer.resume();
      await request('resumeProducer', { producerId: producer.id }).catch(() => {});
      setMicEnabled(true);
    } else {
      producer.pause();
      await request('pauseProducer', { producerId: producer.id }).catch(() => {});
      setMicEnabled(false);
    }
    publishRoster();
  }, [request, publishRoster]);

  const toggleCamera = useCallback(async () => {
    const sendTransport = sendTransportRef.current;
    if (!sendTransport) return;
    const existing = camProducerRef.current;
    if (existing && !existing.closed) {
      // Turn camera off: close the producer and stop the track.
      try { existing.close(); } catch { /* noop */ }
      await request('closeProducer', { producerId: existing.id }).catch(() => {});
      camProducerRef.current = null;
      localStreamRef.current?.getVideoTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } t.kind; });
      setCameraEnabled(false);
    } else {
      // Turn camera on: capture and produce a fresh video track.
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const track = cam.getVideoTracks()[0];
        if (localStreamRef.current) localStreamRef.current.addTrack(track);
        else localStreamRef.current = cam;
        camProducerRef.current = await sendTransport.produce({
          track,
          encodings: SIMULCAST_ENCODINGS,
          codecOptions: { videoGoogleStartBitrate: 1000 },
          appData: { source: 'camera' },
        });
        setCameraEnabled(true);
      } catch (err) {
        console.error('[sfu] camera enable failed', err);
      }
    }
    publishRoster();
  }, [request, publishRoster]);

  const toggleScreenShare = useCallback(async () => {
    const sendTransport = sendTransportRef.current;
    if (!sendTransport) return;
    if (screenProducerRef.current) {
      try { screenProducerRef.current.close(); } catch { /* noop */ }
      await request('closeProducer', { producerId: screenProducerRef.current.id }).catch(() => {});
      screenProducerRef.current = null;
      screenStreamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
      screenStreamRef.current = null;
      setScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screen;
        const track = screen.getVideoTracks()[0];
        screenProducerRef.current = await sendTransport.produce({
          track,
          encodings: [{ maxBitrate: 1_500_000 }],
          appData: { source: 'screen' },
        });
        track.onended = () => { void toggleScreenShare(); };
        setScreenSharing(true);
      } catch (err) {
        const e = err as DOMException & { message?: string };
        if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
          console.error('[sfu] screen share failed', err);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('il-toast', { detail: {
              title: 'Screen share failed',
              message: e?.message || 'This device/browser cannot share its screen. Try a desktop browser.',
              tone: 'warn',
            } }));
          }
        }
      }
    }
    publishRoster();
  }, [request, publishRoster]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  // Route all remote call audio to a specific output device (speaker/earpiece).
  // Applied to every existing element and remembered for elements created later.
  const setAudioOutput = useCallback(async (deviceId: string) => {
    sinkIdRef.current = deviceId;
    await Promise.all(Array.from(audioElsRef.current.values()).map((el) => applySink(el, deviceId)));
  }, []);

  return {
    state,
    participants,
    micEnabled,
    cameraEnabled,
    screenSharing,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    setAudioOutput,
    disconnect,
  };
}

// ── Transport helpers ──────────────────────────────────────────────────────────

interface TransportParams {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClientTransport(p: TransportParams): any {
  return {
    id: p.id,
    iceParameters: p.iceParameters,
    iceCandidates: p.iceCandidates,
    dtlsParameters: p.dtlsParameters,
  };
}

/** Wire a mediasoup-client transport's connect/produce events to the SFU. */
function wireTransport(
  transport: types.Transport,
  request: <T = unknown>(event: string, data?: unknown) => Promise<T>
) {
  transport.on(
    'connect',
    (
      { dtlsParameters }: { dtlsParameters: types.DtlsParameters },
      callback: () => void,
      errback: (e: Error) => void
    ) => {
      request('connectWebRtcTransport', { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch((err) => errback(err as Error));
    }
  );
  // Only send transports emit 'produce'.
  transport.on(
    'produce',
    (
      { kind, rtpParameters, appData }:
        { kind: types.MediaKind; rtpParameters: types.RtpParameters; appData: types.AppData },
      callback: (arg: { id: string }) => void,
      errback: (e: Error) => void
    ) => {
      request<{ id: string }>('produce', {
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      })
        .then(({ id }) => callback({ id }))
        .catch((err) => errback(err as Error));
    }
  );
}
