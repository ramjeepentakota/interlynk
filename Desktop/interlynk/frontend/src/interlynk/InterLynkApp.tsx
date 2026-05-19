/* InterLynk root app — ported from the App() component in InterLynk.html */
import { useEffect, useState } from 'react';
import './theme.css';
import { AppCtx, type Accent, type CallType, type Screen, type Theme } from './context';
import { CHANNELS, MOCK_MESSAGES, type Channel, type Message } from './data';
import { LoginScreen, CallPanel, IncomingCallOverlay, SettingsModal, TweaksPanel } from './Screens';
import { MainLayout } from './Panels';

const TWEAK_DEFAULTS = {
  theme: 'dark' as Theme,
  accent: 'violet' as Accent,
};

export default function InterLynkApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [theme, setTheme] = useState<Theme>(TWEAK_DEFAULTS.theme);
  const [accent, setAccent] = useState<Accent>(TWEAK_DEFAULTS.accent);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [activeView, setActiveView] = useState('chat');
  const [sideOpen, setSideOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('video');
  const [incomingCall, setIncomingCall] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const [threadMsg, setThreadMsg] = useState<Message | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, [theme, accent]);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === '__activate_edit_mode') setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);

  const addMessage = (channelId: string, content: string) => {
    const msg: Message = {
      id: String(Date.now()),
      userId: 'me',
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: 'Today',
      reactions: [],
    };
    setMessages((p) => ({ ...p, [channelId]: [...(p[channelId] || []), msg] }));
  };

  const ctx = {
    screen, setScreen,
    theme, setTheme,
    accent, setAccent,
    activeChannel, setActiveChannel,
    activeDm, setActiveDm,
    activeView, setActiveView,
    sideOpen, setSideOpen,
    rightOpen, setRightOpen,
    showSettings, setShowSettings,
    showTweaks, setShowTweaks,
    showNotif, setShowNotif,
    inCall, setInCall,
    callType, setCallType,
    incomingCall, setIncomingCall,
    messages, setMessages, addMessage,
    threadMsg, setThreadMsg,
    channels, setChannels,
  };

  return (
    <AppCtx.Provider value={ctx}>
      {screen === 'login' ? <LoginScreen /> : inCall ? <CallPanel /> : <MainLayout />}
      {showSettings && <SettingsModal />}
      {incomingCall && <IncomingCallOverlay />}
      {showTweaks && <TweaksPanel />}
    </AppCtx.Provider>
  );
}
