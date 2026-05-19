/* InterLynk mock data + domain types — ported from il-base.jsx */

export interface User {
  id: string;
  name: string;
  username?: string;
  initials?: string;
  color?: string;
  status?: 'online' | 'away' | 'busy' | 'dnd' | 'offline';
  role?: 'ADMIN' | 'MOD' | 'MEMBER';
  avatar?: string;
}

export interface Channel {
  id: string;
  name: string;
  type?: 'text' | 'announcement';
  unread?: number;
  description?: string;
  locked?: boolean;
}

export interface VoiceChannel {
  id: string;
  name: string;
  participants: string[];
}

export interface DM {
  id: string;
  userId: string;
  name?: string;
  lastMsg: string;
  unread: number;
  isBot?: boolean;
  color?: string;
  initials?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  time: string;
  date: string;
  reactions?: Reaction[];
  replies?: number;
  isEdited?: boolean;
}

export const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  busy: '#ef4444',
  dnd: '#ef4444',
  offline: '#5a587c',
};

export const USERS: Record<string, User> = {
  me: { id: 'me', name: 'Jordan Kim', username: 'jordankim', initials: 'JK', color: '#8b5cf6', status: 'online', role: 'ADMIN' },
  alice: { id: 'alice', name: 'Alice Chen', username: 'alicechen', initials: 'AC', color: '#f43f5e', status: 'online', role: 'MEMBER' },
  bob: { id: 'bob', name: 'Bob Martinez', username: 'bobm', initials: 'BM', color: '#f59e0b', status: 'away', role: 'MEMBER' },
  carol: { id: 'carol', name: 'Carol Wu', username: 'carolwu', initials: 'CW', color: '#10b981', status: 'busy', role: 'MOD' },
  david: { id: 'david', name: 'David Park', username: 'davidpark', initials: 'DP', color: '#ec4899', status: 'offline', role: 'MEMBER' },
  emma: { id: 'emma', name: 'Emma Torres', username: 'emmat', initials: 'ET', color: '#a78bfa', status: 'online', role: 'MEMBER' },
  james: { id: 'james', name: 'James Liu', username: 'jamesliu', initials: 'JL', color: '#84cc16', status: 'offline', role: 'MEMBER' },
};

// No default channels — users create their own
export const CHANNELS: Channel[] = [];

export const VOICE_CHANNELS: VoiceChannel[] = [
  { id: 'vc-standup', name: 'Team Standup', participants: ['alice', 'carol'] },
  { id: 'vc-design', name: 'Design Review', participants: [] },
  { id: 'vc-eng', name: 'Engineering', participants: ['bob'] },
  { id: 'vc-lounge', name: 'Lounge', participants: [] },
];

export const DMS: DM[] = [
  { id: 'dm-ai', userId: 'ai', name: 'InterLynk AI', lastMsg: 'How can I help you today?', unread: 0, isBot: true, color: 'var(--primary)', initials: 'AI' },
  { id: 'dm-alice', userId: 'alice', lastMsg: "sounds good, I'll review it!", unread: 2 },
  { id: 'dm-bob', userId: 'bob', lastMsg: "let's sync tomorrow ☕", unread: 0 },
  { id: 'dm-carol', userId: 'carol', lastMsg: 'the new designs look 🔥', unread: 1 },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  general: [
    { id: 'g0', userId: 'alice', content: 'Hey team! Just pushed the new authentication changes. Can someone take a look at the PR?', time: '2:34 PM', date: 'Yesterday', reactions: [{ emoji: '👍', count: 2, reacted: false }] },
    { id: 'g1', userId: 'bob', content: "I'll take a look! Give me 10 minutes ⚡", time: '2:36 PM', date: 'Yesterday' },
    { id: 'g2', userId: 'alice', content: 'Thanks Bob! There are some tricky edge cases in the OAuth flow I want a second pair of eyes on', time: '2:37 PM', date: 'Yesterday', replies: 2 },
    { id: 'g3', userId: 'carol', content: 'GM everyone 👋', time: '9:14 AM', date: 'Today' },
    { id: 'g4', userId: 'alice', content: 'Morning Carol! Ready for standup?', time: '9:15 AM', date: 'Today' },
    { id: 'g5', userId: 'bob', content: 'Morning! Just finishing my coffee ☕', time: '9:18 AM', date: 'Today', reactions: [{ emoji: '☕', count: 3, reacted: true }, { emoji: '😂', count: 1, reacted: false }] },
    { id: 'g6', userId: 'carol', content: "I'm already in the voice channel if anyone wants to join", time: '9:20 AM', date: 'Today' },
    { id: 'g7', userId: 'me', content: 'On my way! Just finishing a quick PR review', time: '9:21 AM', date: 'Today' },
    { id: 'g8', userId: 'alice', content: 'No worries, the standup today should be short — mostly design review items and the new onboarding flow', time: '9:22 AM', date: 'Today' },
    { id: 'g9', userId: 'emma', content: 'Quick update: I pushed the new component library to Figma. Would love feedback on the card styles before we implement ✨', time: '10:05 AM', date: 'Today', reactions: [{ emoji: '🎉', count: 4, reacted: false }] },
    { id: 'g10', userId: 'me', content: "@Alice I reviewed your PR. The OAuth flow looks clean. Left two minor comments but overall it's ready to merge 🙌", time: '10:47 AM', date: 'Today', replies: 3 },
    { id: 'g11', userId: 'alice', content: 'Thanks Jordan! Addressing the comments now and will merge after CI passes', time: '10:49 AM', date: 'Today', reactions: [{ emoji: '🚀', count: 2, reacted: false }] },
  ],
  engineering: [
    { id: 'e0', userId: 'bob', content: 'Heads up: deploying the new WebSocket handler to staging in ~30 min. Hold off on pushes until I confirm 🚦', time: '10:02 AM', date: 'Today' },
    { id: 'e1', userId: 'david', content: "ACK, I'll hold my branch until you give the all-clear", time: '10:04 AM', date: 'Today' },
    { id: 'e2', userId: 'bob', content: 'Deployment done ✅  All services green, staging looks healthy', time: '10:38 AM', date: 'Today', reactions: [{ emoji: '✅', count: 3, reacted: true }] },
    { id: 'e3', userId: 'david', content: 'Nice. Pushing now 🚀', time: '10:41 AM', date: 'Today' },
    { id: 'e4', userId: 'james', content: 'Anyone seen the latency spike on the /api/messages endpoint? P99 is around 340ms which seems high', time: '11:20 AM', date: 'Today' },
    { id: 'e5', userId: 'bob', content: "Yeah I saw that — think it's the N+1 query issue. I have a fix in draft", time: '11:23 AM', date: 'Today', replies: 5 },
  ],
  design: [
    { id: 'd0', userId: 'emma', content: 'New component library designs are up in Figma! Would love feedback on the card styles and the updated button hierarchy 🎨', time: '11:30 AM', date: 'Today' },
    { id: 'd1', userId: 'carol', content: 'These cards look really polished Emma, great work 🔥  The new violet accent fits perfectly', time: '11:45 AM', date: 'Today', reactions: [{ emoji: '❤️', count: 2, reacted: false }] },
    { id: 'd2', userId: 'alice', content: 'Love the direction! One suggestion: maybe increase the border-radius on the primary cards to 14px for that extra premium feel?', time: '12:01 PM', date: 'Today' },
    { id: 'd3', userId: 'emma', content: "Good call! I'll update and share a revised version this afternoon", time: '12:04 PM', date: 'Today' },
  ],
  random: [
    { id: 'r0', userId: 'bob', content: "Does anyone else find it physically impossible to name variables? I've been staring at this function for 20 minutes 😅", time: '3:15 PM', date: 'Yesterday', reactions: [{ emoji: '😂', count: 5, reacted: false }] },
    { id: 'r1', userId: 'carol', content: 'Naming things and cache invalidation. The two hard problems', time: '3:17 PM', date: 'Yesterday', reactions: [{ emoji: '💯', count: 4, reacted: true }] },
    { id: 'r2', userId: 'david', content: "What's everyone having for lunch? Trying to decide between the Thai place or the new ramen spot", time: '12:30 PM', date: 'Today' },
    { id: 'r3', userId: 'alice', content: 'Ramen 100% — that place has incredible tonkotsu 🍜', time: '12:32 PM', date: 'Today' },
    { id: 'r4', userId: 'me', content: "Hard agree, I was there yesterday. Get the spicy miso if you haven't tried it", time: '12:34 PM', date: 'Today' },
  ],
  'dm-alice': [
    { id: 'da0', userId: 'alice', content: 'Hey Jordan! Quick question — can you review the access control changes in the PR before EOD?', time: '10:15 AM', date: 'Today' },
    { id: 'da1', userId: 'me', content: 'Sure! On it now, should have feedback in ~30 min', time: '10:18 AM', date: 'Today' },
    { id: 'da2', userId: 'alice', content: 'No rush! The changes look straightforward but wanted a second pair of eyes', time: '10:19 AM', date: 'Today' },
    { id: 'da3', userId: 'me', content: 'All good — left a couple comments but mostly looks great. Ship it 🚀', time: '10:52 AM', date: 'Today' },
    { id: 'da4', userId: 'alice', content: "sounds good, I'll review it!", time: '11:00 AM', date: 'Today' },
  ],
};
