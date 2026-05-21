/**
 * IncomingCallOverlay
 *
 * A full-screen backdrop overlay that appears when another user calls you.
 * Reads from `useCallStore.incomingCall` and shows accept/reject buttons.
 * On accept: joins the backend call room, then sets `isInCall = true` + `currentCall`.
 * On reject: clears the state silently.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';
import { useCallStore, useAuthStore } from '@/store/useAppStore';
import { callApi } from '@/api/client';

export function IncomingCallOverlay() {
  const { incomingCall, clearIncomingCall, setCurrentCall, setInCall } = useCallStore();
  const { user } = useAuthStore();
  const [isAccepting, setIsAccepting] = React.useState(false);

  // Pulse animation for the ringing ring
  const ringVariants = {
    animate: {
      scale: [1, 1.4, 1],
      opacity: [0.7, 0, 0.7],
      transition: { duration: 1.5, repeat: Infinity },
    },
  };

  const handleAccept = async () => {
    if (!incomingCall || isAccepting) return;
    setIsAccepting(true);
    try {
      await callApi.joinCall(String(incomingCall.roomId));
      const roomResponse = await callApi.getCall(String(incomingCall.roomId));
      setCurrentCall(roomResponse.data);
      setInCall(true);
      clearIncomingCall();

      // Notify the caller we accepted AFTER the CallPanel is mounted so the
      // resulting WebRTC offer has a listener on this client.
      const stompClient = (window as any).__stompClient;
      if (stompClient?.connected && user) {
        setTimeout(() => {
          stompClient.publish({
            destination: '/app/call/signal',
            body: JSON.stringify({
              type: 'call-accepted',
              roomId: Number(incomingCall.roomId),
              senderUserId: Number(user.id),
              targetUserId: Number(incomingCall.callerUserId),
              callType: incomingCall.callType,
            }),
          });
        }, 50);
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;

    // Notify caller that we rejected
    const stompClient = (window as any).__stompClient;
    if (stompClient?.connected && user) {
      stompClient.publish({
        destination: '/app/call/signal',
        body: JSON.stringify({
          type: 'call-rejected',
          roomId: Number(incomingCall.roomId),
          senderUserId: Number(user.id),
          targetUserId: Number(incomingCall.callerUserId),
        }),
      });
    }

    clearIncomingCall();
  };


  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          key="incoming-call"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative flex flex-col items-center gap-6 p-10 rounded-3xl border border-white/10"
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              minWidth: 320,
            }}
          >
            {/* Call type badge */}
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: incomingCall.callType === 'video' ? '#60a5fa' : '#34d399',
                border: `1px solid ${incomingCall.callType === 'video' ? 'rgba(96,165,250,0.3)' : 'rgba(52,211,153,0.3)'}`,
              }}
            >
              {incomingCall.callType === 'video' ? (
                <Video className="w-3 h-3" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
              {incomingCall.callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </div>

            {/* Avatar with ripple */}
            <div className="relative flex items-center justify-center">
              {/* Ripple rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2"
                  style={{
                    width: 96 + i * 32,
                    height: 96 + i * 32,
                    borderColor:
                      incomingCall.callType === 'video'
                        ? 'rgba(96,165,250,0.4)'
                        : 'rgba(52,211,153,0.4)',
                  }}
                  variants={ringVariants}
                  animate="animate"
                  transition={{ delay: i * 0.4 }}
                />
              ))}

              {/* Avatar circle */}
              <div
                className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 0 0 3px rgba(255,255,255,0.15)',
                }}
              >
                {incomingCall.callerAvatarUrl ? (
                  <img
                    src={incomingCall.callerAvatarUrl}
                    alt={incomingCall.callerDisplayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  incomingCall.callerDisplayName.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Caller info */}
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{incomingCall.callerDisplayName}</p>
              <p className="text-sm text-white/50 mt-1">@{incomingCall.callerUsername}</p>
              <p className="text-sm text-white/40 mt-2 animate-pulse">is calling you…</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-8 mt-2">
              {/* Reject */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReject}
                className="flex flex-col items-center gap-2 group"
                id="reject-call-btn"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '2px solid rgba(239,68,68,0.4)',
                  }}
                >
                  <PhoneOff className="w-7 h-7 text-red-400 group-hover:text-red-300" />
                </div>
                <span className="text-xs text-white/50 group-hover:text-white/70">Decline</span>
              </motion.button>

              {/* Accept */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAccept}
                disabled={isAccepting}
                className="flex flex-col items-center gap-2 group"
                id="accept-call-btn"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background:
                      incomingCall.callType === 'video'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow:
                      incomingCall.callType === 'video'
                        ? '0 8px 24px rgba(99,102,241,0.5)'
                        : '0 8px 24px rgba(16,185,129,0.5)',
                  }}
                >
                  {isAccepting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : incomingCall.callType === 'video' ? (
                    <Video className="w-7 h-7 text-white" />
                  ) : (
                    <Phone className="w-7 h-7 text-white" />
                  )}
                </div>
                <span className="text-xs text-white/50 group-hover:text-white/70">
                  {isAccepting ? 'Joining…' : 'Accept'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IncomingCallOverlay;
