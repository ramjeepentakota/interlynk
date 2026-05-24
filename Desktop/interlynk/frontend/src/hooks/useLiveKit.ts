/**
 * useLiveKit — connects the browser to a LiveKit (SFU) room for multi-party
 * audio/video. Used by the call panel for both 1:1 direct calls and group /
 * voice-channel calls (every participant joins the same room).
 *
 * The hook owns the LiveKit Room lifecycle, auto-attaches remote audio to the
 * DOM, and exposes a simple participant snapshot + local controls. Video tracks
 * are attached by the rendering tile via {@link attachTrack}.
 *
 * When {@code url}/{@code token} are absent (LiveKit not configured on the
 * server) the hook stays idle — the call panel still renders the roster from
 * the backend, just without live media.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteTrack,
  type Participant,
} from 'livekit-client';

export type LiveKitState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface LiveKitParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  participant: Participant;
}

interface UseLiveKitOptions {
  url?: string;
  token?: string;
  /** Start with the camera on (video calls). */
  withVideo: boolean;
  /** Only connect when true (token resolved + panel open). */
  enabled: boolean;
}

/** Attach a participant's camera (or screen) track to a video element. */
export function attachCameraTrack(
  participant: Participant,
  el: HTMLVideoElement,
  source: Track.Source = Track.Source.Camera
): () => void {
  const pub = participant.getTrackPublication(source);
  const track = pub?.videoTrack;
  if (track) {
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch {
        /* element already gone */
      }
    };
  }
  return () => undefined;
}

export function useLiveKit({ url, token, withVideo, enabled }: UseLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [state, setState] = useState<LiveKitState>('idle');
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(withVideo);
  const [screenSharing, setScreenSharing] = useState(false);

  const snapshot = useCallback((room: Room) => {
    const toInfo = (p: Participant, isLocal: boolean): LiveKitParticipant => ({
      identity: p.identity,
      name: p.name || p.identity,
      isLocal,
      isSpeaking: p.isSpeaking,
      micEnabled: p.isMicrophoneEnabled,
      cameraEnabled: p.isCameraEnabled,
      screenSharing: p.isScreenShareEnabled,
      participant: p,
    });
    const list: LiveKitParticipant[] = [toInfo(room.localParticipant, true)];
    room.remoteParticipants.forEach((p) => list.push(toInfo(p, false)));
    setParticipants(list);
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setScreenSharing(room.localParticipant.isScreenShareEnabled);
  }, []);

  useEffect(() => {
    if (!enabled || !url || !token) return;

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setState('connecting');

    const refresh = () => snapshot(room);

    room
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = 'none';
          if (track.sid) audioEls.current.set(track.sid, el);
          document.body.appendChild(el);
        }
        refresh();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        if (track.sid) audioEls.current.delete(track.sid);
        refresh();
      })
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
        if (s === ConnectionState.Connected) setState('connected');
        else if (s === ConnectionState.Reconnecting) setState('connecting');
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setState('disconnected');
      });

    (async () => {
      try {
        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        await room.localParticipant.setMicrophoneEnabled(true);
        if (withVideo) await room.localParticipant.setCameraEnabled(true);
        setState('connected');
        snapshot(room);
      } catch (e) {
        console.error('LiveKit connect error:', e);
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      audioEls.current.forEach((el) => el.remove());
      audioEls.current.clear();
    };
  }, [enabled, url, token, withVideo, snapshot]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    snapshot(room);
  }, [snapshot]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    snapshot(room);
  }, [snapshot]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
    } catch (e) {
      console.error('Screen share error:', e);
      const err = e as DOMException & { message?: string };
      // Don't toast on user-cancel (NotAllowed/Abort). Anything else — including
      // mobile "NotSupportedError" — is a real failure the user needs to see.
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('il-toast', { detail: {
            title: 'Screen share failed',
            message: err?.message || 'This device/browser cannot share its screen. Try a desktop browser.',
            tone: 'warn',
          } }));
        }
      }
    }
    snapshot(room);
  }, [snapshot]);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
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
    disconnect,
  };
}
