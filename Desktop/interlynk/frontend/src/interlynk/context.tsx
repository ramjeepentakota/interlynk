/* InterLynk app context — typed port of the App state from InterLynk.html */
import { createContext, useContext } from 'react';
import type { Channel, Message } from './data';

export type Screen = 'login' | 'app';
export type Theme = 'dark' | 'light';
export type Accent = 'violet' | 'rose' | 'emerald' | 'amber' | 'coral';
export type CallType = 'video' | 'voice';

export interface AppCtxValue {
  screen: Screen;
  setScreen: (s: Screen) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
  activeChannel: string | null;
  setActiveChannel: (id: string | null) => void;
  activeDm: string | null;
  setActiveDm: (id: string | null) => void;
  activeView: string;
  setActiveView: (v: string) => void;
  sideOpen: boolean;
  setSideOpen: (v: boolean) => void;
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showTweaks: boolean;
  setShowTweaks: (v: boolean) => void;
  showNotif: boolean;
  setShowNotif: (v: boolean) => void;
  inCall: boolean;
  setInCall: (v: boolean) => void;
  callType: CallType;
  setCallType: (t: CallType) => void;
  incomingCall: boolean;
  setIncomingCall: (v: boolean) => void;
  messages: Record<string, Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
  addMessage: (channelId: string, content: string) => void;
  threadMsg: Message | null;
  setThreadMsg: (m: Message | null) => void;
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
}

export const AppCtx = createContext<AppCtxValue | null>(null);

export const useApp = (): AppCtxValue => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppCtx.Provider');
  return ctx;
};
