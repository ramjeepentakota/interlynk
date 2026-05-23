/* InterLynk chat feature kit — emoji picker, voice recorder,
   speech-to-text, attachment preview/rendering and read-receipt ticks.
   All UI primitives match the existing design tokens in theme.css. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Ic } from './icons';
import { Tip } from './ui';
import type { Attachment, Poll } from './data';

/* ════════════════════════════════════════════════════════════
   Emoji picker
   ════════════════════════════════════════════════════════════ */

export const EMOJI_CATEGORIES: { id: string; icon: string; emojis: string[] }[] = [
  {
    id: 'Smileys & People',
    icon: '😀',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😶‍🌫️ 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤 👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🫃 🫄 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 👭 👫 👬 💏 💑 👪'.split(' '),
  },
  {
    id: 'Animals & Nature',
    icon: '🐶',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪶 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪨 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 🫧 ☔ ☂️ 🌊 🌫️'.split(' '),
  },
  {
    id: 'Food & Drink',
    icon: '🍔',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂'.split(' '),
  },
  {
    id: 'Activities',
    icon: '⚽',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    id: 'Travel & Places',
    icon: '🚗',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🪝 ⛽ 🚧 🚦 🚥 🚏 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁'.split(' '),
  },
  {
    id: 'Objects',
    icon: '💡',
    emojis: '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'.split(' '),
  },
  {
    id: 'Symbols',
    icon: '❤️',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧️ 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 👁️‍🗨️ 🔚 🔙 🔛 🔝 🔜 〰️ ➰ ➿ ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢'.split(' '),
  },
  {
    id: 'Flags',
    icon: '🏁',
    emojis: '🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇺🇳 🇺🇸 🇬🇧 🇮🇳 🇨🇦 🇦🇺 🇩🇪 🇫🇷 🇮🇹 🇪🇸 🇵🇹 🇧🇷 🇲🇽 🇯🇵 🇰🇷 🇨🇳 🇷🇺 🇿🇦 🇳🇬 🇪🇬 🇸🇦 🇦🇪 🇮🇱 🇹🇷 🇬🇷 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇮🇪 🇵🇱 🇺🇦 🇨🇿 🇭🇺 🇷🇴 🇵🇭 🇮🇩 🇲🇾 🇸🇬 🇹🇭 🇻🇳 🇵🇰 🇧🇩 🇱🇰 🇳🇿 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇻🇪'.split(' '),
  },
];

const RECENTS_KEY = 'il-emoji-recents';

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function pushRecent(emoji: string) {
  try {
    const cur = loadRecents().filter((e) => e !== emoji);
    cur.unshift(emoji);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 36)));
  } catch {
    /* private mode / quota — recents are best-effort */
  }
}

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(loadRecents);

  const pick = (e: string) => {
    pushRecent(e);
    setRecents(loadRecents());
    onPick(e);
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    // Dedup while preserving order.
    return [...new Set(all)];
  }, [query]);

  const cat = EMOJI_CATEGORIES[active];

  return (
    <div
      className="il-scale-in"
      style={{
        width: 340, height: 380, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)',
        boxShadow: '0 12px 40px rgba(0,0,0,.5)', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderBottom: '1px solid var(--bd)' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 9, color: 'var(--t3)', display: 'flex' }}><Ic.Search s={14} /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            style={{ width: '100%', padding: '6px 8px 6px 30px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
          />
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6, display: 'flex' }}>
          <Ic.X s={15} />
        </button>
      </div>

      {!filtered && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--bd)', overflowX: 'auto' }}>
          {recents.length > 0 && (
            <button onClick={() => setActive(-1)} title="Recent" style={tabStyle(active === -1)}>🕘</button>
          )}
          {EMOJI_CATEGORIES.map((c, i) => (
            <button key={c.id} onClick={() => setActive(i)} title={c.id} style={tabStyle(active === i)}>{c.icon}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filtered ? (
          <EmojiGrid emojis={filtered.filter(Boolean)} onPick={pick} />
        ) : active === -1 ? (
          recents.length ? <EmojiGrid emojis={recents} onPick={pick} /> : <Empty label="No recent emoji yet" />
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '2px 4px 6px' }}>{cat.id}</div>
            <EmojiGrid emojis={cat.emojis} onPick={pick} />
          </>
        )}
      </div>
    </div>
  );
}

function tabStyle(activeTab: boolean): React.CSSProperties {
  return {
    background: activeTab ? 'var(--primary-dim)' : 'none',
    border: 'none', cursor: 'pointer', fontSize: 17, padding: '5px 7px', borderRadius: 8, lineHeight: 1, flexShrink: 0,
  };
}

function EmojiGrid({ emojis, onPick }: { emojis: string[]; onPick: (e: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
      {emojis.map((e, i) => (
        <button
          key={`${e}-${i}`}
          onClick={() => onPick(e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 21, padding: 4, borderRadius: 8, lineHeight: 1, transition: 'background .1s' }}
          onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(ev) => (ev.currentTarget.style.background = 'none')}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>{label}</div>;
}

/* ════════════════════════════════════════════════════════════
   Speech-to-text (Web Speech API)
   ════════════════════════════════════════════════════════════ */

export const STT_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'ur-PK', label: 'Urdu' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'nl-NL', label: 'Dutch' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'id-ID', label: 'Indonesian' },
  { code: 'vi-VN', label: 'Vietnamese' },
  { code: 'th-TH', label: 'Thai' },
];

const STT_LANG_KEY = 'il-stt-lang';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const isSpeechSupported = (): boolean => getSpeechRecognitionCtor() !== null;

/** Dictation hook: streams interim + final transcripts via callbacks. The final
 *  transcript is appended to the input; interim text is shown as a live hint. */
export function useSpeechToText(opts: {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}) {
  const { onFinal, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<string>(() => localStorage.getItem(STT_LANG_KEY) || 'en-US');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callbacks without re-creating the recognizer on every render.
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  finalRef.current = onFinal;
  interimRef.current = onInterim;
  // Highest result index already emitted as "final". Chrome's recognizer
  // sometimes re-fires the same isFinal result in a later onresult event
  // (especially when continuous=true with interimResults=true), which used
  // to cause every spoken word to be appended twice ("hai" → "hai hai").
  const lastFinalIndexRef = useRef<number>(-1);

  const setLanguage = useCallback((code: string) => {
    setLang(code);
    try { localStorage.setItem(STT_LANG_KEY, code); } catch { /* best-effort */ }
    if (recRef.current) recRef.current.lang = code;
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    // Tear down any previous instance so we don't stack recognizers.
    recRef.current?.abort();
    lastFinalIndexRef.current = -1;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          // Skip results we have already committed — guards against the
          // Chrome quirk where the same final SpeechRecognitionResult is
          // re-emitted in subsequent onresult events.
          if (i > lastFinalIndexRef.current) {
            finalText += (finalText ? ' ' : '') + r[0].transcript;
            lastFinalIndexRef.current = i;
          }
        } else {
          interim += r[0].transcript;
        }
      }
      if (finalText) finalRef.current(finalText);
      interimRef.current?.(interim);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => { setListening(false); interimRef.current?.(''); };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang]);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { listening, lang, setLanguage, start, stop, supported: !!getSpeechRecognitionCtor() };
}

/* ════════════════════════════════════════════════════════════
   Voice recorder (MediaRecorder)
   ════════════════════════════════════════════════════════════ */

export interface RecordedVoice { blob: Blob; durationMs: number; mimeType: string }

function pickAudioMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((v: RecordedVoice | null) => void) | null>(null);

  const cleanup = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async (): Promise<boolean> => {
    if (recording) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMime();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const durationMs = Date.now() - startedAt.current;
        cleanup();
        setRecording(false);
        resolveRef.current?.({ blob, durationMs, mimeType: type });
        resolveRef.current = null;
      };
      recRef.current = rec;
      startedAt.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsedMs(0);
      timer.current = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 200);
      return true;
    } catch {
      cleanup();
      setRecording(false);
      return false;
    }
  }, [recording]);

  /** Stop and resolve with the recorded clip. */
  const stop = useCallback((): Promise<RecordedVoice | null> => {
    return new Promise((resolve) => {
      if (!recRef.current || recRef.current.state === 'inactive') { resolve(null); return; }
      resolveRef.current = resolve;
      recRef.current.stop();
    });
  }, []);

  /** Abort without producing a clip (discard). */
  const cancel = useCallback(() => {
    resolveRef.current = null;
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = null;
      recRef.current.stop();
    }
    cleanup();
    setRecording(false);
    setElapsedMs(0);
  }, []);

  useEffect(() => () => cleanup(), []);

  return { recording, elapsedMs, start, stop, cancel };
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/* ════════════════════════════════════════════════════════════
   Attachment rendering
   ════════════════════════════════════════════════════════════ */

function humanSize(bytes: number): string {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/** Inline gallery for a message's attachments (images, video, audio/voice, docs). */
export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxWidth: 420 }}>
      {attachments.map((a, i) => <AttachmentView key={a.id || `${a.fileUrl}-${i}`} a={a} />)}
    </div>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === 'image' || a.kind === 'gif') {
    return (
      <a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bd)', maxWidth: 320 }}>
        <img src={a.fileUrl} alt={a.fileName} loading="lazy" style={{ display: 'block', maxWidth: 320, maxHeight: 320, objectFit: 'cover' }} />
      </a>
    );
  }
  if (a.kind === 'video') {
    return (
      <video src={a.fileUrl} controls preload="metadata" style={{ maxWidth: 360, maxHeight: 300, borderRadius: 'var(--r-lg)', border: '1px solid var(--bd)', background: '#000' }} />
    );
  }
  if (a.kind === 'voice' || a.kind === 'audio') {
    return <VoiceBubble a={a} />;
  }
  // Generic document/file chip.
  return (
    <a
      href={a.fileUrl}
      target="_blank"
      rel="noreferrer"
      download={a.fileName}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 'var(--r-lg)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', textDecoration: 'none', maxWidth: 320 }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--primary)' }}>
        <Ic.File s={18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{humanSize(a.fileSize)}</div>
      </div>
      <span style={{ color: 'var(--t3)', display: 'flex', flexShrink: 0 }}><Ic.Download s={16} /></span>
    </a>
  );
}

/** Compact audio player styled as a voice note. */
function VoiceBubble({ a }: { a: Attachment }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', maxWidth: 280 }}>
      <button
        onClick={toggle}
        style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {playing ? <Ic.Pause s={15} /> : <Ic.Play s={15} />}
      </button>
      <span style={{ color: 'var(--primary)', display: 'flex' }}><Ic.Volume s={16} /></span>
      <span style={{ fontSize: 12.5, color: 'var(--t2)', fontWeight: 600 }}>Voice message</span>
      <audio
        ref={audioRef}
        src={a.fileUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />
    </div>
  );
}

/** Pending attachments shown above the composer before the message is sent. */
export function PendingAttachments({ items, onRemove }: { items: PendingAttachment[]; onRemove: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--bd)' }}>
      {items.map((p) => (
        <div key={p.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: p.previewUrl ? 0 : '6px 10px', borderRadius: 'var(--r)', border: '1px solid var(--bd2)', background: 'var(--bg-elv)', maxWidth: 200 }}>
          {p.previewUrl ? (
            <img src={p.previewUrl} alt={p.file.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--r)' }} />
          ) : (
            <>
              <Ic.File s={15} c="var(--t3)" />
              <span style={{ fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{p.file.name}</span>
            </>
          )}
          {p.uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ic.Loader s={16} c="#fff" className="il-spin" />
            </div>
          )}
          <button
            onClick={() => onRemove(p.id)}
            style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%', background: 'var(--err)', border: '2px solid var(--bg-main)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <Ic.X s={9} />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;   // object URL for image/video thumbnails
  uploading: boolean;
  uploaded?: Attachment;
  error?: boolean;
}

/* ════════════════════════════════════════════════════════════
   Polls
   ════════════════════════════════════════════════════════════ */

/** Renders a poll inside a message with live result bars. Voting is delegated
 *  to the parent via onVote(optionIds). */
export function PollCard({ poll, onVote }: { poll: Poll; onVote: (optionIds: string[]) => void }) {
  const voted = new Set(poll.votedOptionIds);
  const total = poll.totalVotes;

  const toggle = (optionId: string) => {
    if (poll.closed) return;
    if (poll.allowMultiple) {
      const next = new Set(voted);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      onVote([...next]);
    } else {
      // Single choice: clicking the current selection clears it, else replaces.
      onVote(voted.has(optionId) ? [] : [optionId]);
    }
  };

  return (
    <div style={{ marginTop: 6, maxWidth: 460, border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', background: 'var(--bg-elv)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: 'var(--primary)', display: 'flex' }}><Ic.BarChart s={16} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4 }}>{poll.question}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
          const mine = voted.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              disabled={poll.closed}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '9px 12px', borderRadius: 'var(--r)', cursor: poll.closed ? 'default' : 'pointer',
                border: `1.5px solid ${mine ? 'var(--primary)' : 'var(--bd2)'}`, background: 'var(--bg-hover)', overflow: 'hidden',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {/* result bar */}
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mine ? 'var(--primary-dim)' : 'var(--bg-active)', transition: 'width .35s ease', zIndex: 0 }} />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: poll.allowMultiple ? 5 : '50%', border: `1.5px solid ${mine ? 'var(--primary)' : 'var(--bd2)'}`, background: mine ? 'var(--primary)' : 'transparent', flexShrink: 0 }}>
                {mine && <Ic.Check s={11} c="#fff" />}
              </span>
              <span style={{ position: 'relative', zIndex: 1, flex: 1, fontSize: 13.5, color: 'var(--t1)', fontWeight: mine ? 600 : 500 }}>{opt.text}</span>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 12.5, color: 'var(--t2)', fontWeight: 600, flexShrink: 0 }}>{pct}%</span>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 11.5, color: 'var(--t3)', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>
                {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, fontSize: 11.5, color: 'var(--t3)' }}>
        <span>{total} {total === 1 ? 'vote' : 'votes'}</span>
        {poll.allowMultiple && <span>· Multiple choice</span>}
        {poll.closed && <span style={{ color: 'var(--err)', fontWeight: 600 }}>· Closed</span>}
      </div>
    </div>
  );
}

/** Compact poll-builder popover used from the composer. */
export function PollComposer({ onCreate, onClose }: { onCreate: (question: string, options: string[], allowMultiple: boolean) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const setOption = (i: number, v: string) => setOptions((p) => p.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions((p) => (p.length >= 12 ? p : [...p, '']));
  const removeOption = (i: number) => setOptions((p) => (p.length <= 2 ? p : p.filter((_, idx) => idx !== i)));

  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && cleaned.length >= 2;

  const submit = () => {
    if (!valid) return;
    onCreate(question.trim(), cleaned, allowMultiple);
    onClose();
  };

  return (
    <div
      className="il-scale-in"
      style={{ width: 340, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', boxShadow: '0 12px 40px rgba(0,0,0,.5)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--bd)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13.5, color: 'var(--t1)' }}>
          <Ic.BarChart s={15} c="var(--primary)" /> Create poll
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6, display: 'flex' }}><Ic.X s={15} /></button>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
        <input
          autoFocus
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          style={{ width: '100%', padding: '9px 11px', fontSize: 13.5, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && i === options.length - 1 && o.trim()) addOption(); }}
                placeholder={`Option ${i + 1}`}
                style={{ flex: 1, padding: '8px 11px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 5, borderRadius: 6, display: 'flex', flexShrink: 0 }}><Ic.X s={13} /></button>
              )}
            </div>
          ))}
          {options.length < 12 && (
            <button onClick={addOption} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px dashed var(--bd2)', cursor: 'pointer', color: 'var(--t-link)', padding: '7px 11px', borderRadius: 'var(--r)', fontSize: 12.5, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
              <Ic.Plus s={13} /> Add option
            </button>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--t2)' }}>
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
          Allow selecting multiple options
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--bd)' }}>
        <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--t2)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} disabled={!valid} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, background: valid ? 'var(--primary)' : 'var(--bg-active)', color: valid ? '#fff' : 'var(--t3)', border: 'none', borderRadius: 'var(--r)', cursor: valid ? 'pointer' : 'default' }}>Create poll</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Read-receipt ticks
   ════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   Composer — the message/typing box, shared by channels and DMs
   ════════════════════════════════════════════════════════════ */

/** One row inside the "+" attach popover (Image / Video / Document / Poll). */
function AttachMenuItem({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 'var(--r)', border: 'none', cursor: 'pointer',
        background: h ? 'var(--bg-hover)' : 'transparent', color: 'var(--t1)',
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-dim)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.2 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hint}</span>
      </span>
    </button>
  );
}

function ComposerBtn({ label, active, danger, onClick, children }: { label: string; active?: boolean; danger?: boolean; onClick: () => void; children: ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <Tip label={label}>
      <button
        type="button"
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        onClick={onClick}
        style={{
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all .12s',
          background: active ? 'var(--primary-dim)' : h ? 'var(--bg-hover)' : 'transparent',
          color: danger ? 'var(--err)' : active ? 'var(--primary)' : h ? 'var(--t1)' : 'var(--t3)',
        }}
      >
        {children}
      </button>
    </Tip>
  );
}

export interface ComposerProps {
  placeholder: string;
  disabled?: boolean;
  /** Send a message. attachments is omitted for plain text. */
  onSend: (text: string, attachments?: Attachment[]) => Promise<void> | void;
  /** Provide to enable file attachments + voice notes (channel-scoped upload). */
  uploadFile?: (file: File | Blob, filename?: string) => Promise<Attachment>;
  /** Provide to enable the poll builder. */
  onCreatePoll?: (question: string, options: string[], allowMultiple: boolean) => void;
  /** Fired as the user types / stops (for typing indicators). */
  onTyping?: (typing: boolean) => void;
  /** Already-rendered typing indicator row (shown above the box). */
  typingIndicator?: ReactNode;
  /** Change this (e.g. channel/dm id) to reset the composer between conversations. */
  resetKey?: string | null;
}

/** The redesigned message box: a focused, rounded card with the textarea on top
 *  and a clear, always-visible action bar beneath. Used by both channels (full
 *  features) and DMs (emoji / gif / dictation). */
export function Composer({ placeholder, disabled, onSend, uploadFile, onCreatePoll, onTyping, typingIndicator, resetKey }: ComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pop, setPop] = useState<null | 'emoji' | 'lang' | 'poll' | 'attach'>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [interim, setInterim] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  // Distinct file inputs per attach category so the OS picker only shows the
  // relevant filter. The grouped "+" attach menu drives each one explicitly —
  // a single shared input meant the picker always showed every file type.
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stt = useSpeechToText({
    onFinal: (t) => { setText((cur) => (cur ? `${cur} ${t}`.replace(/\s+/g, ' ') : t)); setInterim(''); },
    onInterim: setInterim,
  });
  const voice = useVoiceRecorder();

  // Reset between conversations.
  useEffect(() => {
    setText(''); setPending([]); setPop(null); setInterim('');
    if (stt.listening) stt.stop();
    if (voice.recording) voice.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; };

  const onType = (v: string) => {
    setText(v);
    if (onTyping) {
      onTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTyping(false), 2500);
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = ref.current;
    if (!el) { setText((t) => t + emoji); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => { el.focus(); const c = start + emoji.length; el.setSelectionRange(c, c); });
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    if (!uploadFile) return;
    Array.from(files).forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined;
      setPending((p) => [...p, { id, file, previewUrl, uploading: true }]);
      uploadFile(file)
        .then((uploaded) => setPending((p) => p.map((x) => (x.id === id ? { ...x, uploading: false, uploaded } : x))))
        .catch(() => setPending((p) => p.map((x) => (x.id === id ? { ...x, uploading: false, error: true } : x))));
    });
  }, [uploadFile]);

  const removePending = (id: string) => setPending((p) => {
    const t = p.find((x) => x.id === id);
    if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
    return p.filter((x) => x.id !== id);
  });

  const onPaste = (e: React.ClipboardEvent) => {
    if (!uploadFile) return;
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) { e.preventDefault(); addFiles(files); }
  };

  const stillUploading = pending.some((p) => p.uploading);
  const ready = pending.filter((p) => p.uploaded).map((p) => p.uploaded!) as Attachment[];
  const canSend = (text.trim().length > 0 || ready.length > 0) && !stillUploading;

  const send = async () => {
    if (sending || stillUploading) return;
    const content = text.trim();
    if (!content && ready.length === 0) return;
    setText(''); setPending([]); setPop(null);
    setSending(true);
    try {
      await onSend(content, ready.length ? ready : undefined);
      onTyping?.(false);
    } catch {
      setText(content);
    } finally {
      setSending(false);
      setTimeout(() => ref.current?.focus(), 30);
    }
  };

  const toggleVoice = async () => {
    if (!uploadFile) return;
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      const ext = clip.mimeType.includes('ogg') ? 'ogg' : clip.mimeType.includes('mp4') ? 'm4a' : 'webm';
      setSending(true);
      try {
        const uploaded = await uploadFile(clip.blob, `voice-note-${Date.now()}.${ext}`);
        await onSend('', [{ ...uploaded, kind: 'voice' }]);
      } catch { /* ignore */ } finally { setSending(false); }
    } else {
      const ok = await voice.start();
      if (!ok) alert('Microphone permission is required to record a voice message.');
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') setPop(null);
  };

  // Recording mode takes over the whole box.
  if (voice.recording) {
    return (
      <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elv)', border: '1.5px solid var(--err)', borderRadius: 16, padding: '12px 16px' }}>
          <span className="il-rec-dot" style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--err)', flexShrink: 0 }} />
          <span style={{ fontSize: 15, color: 'var(--t1)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(voice.elapsedMs)}</span>
          <span style={{ fontSize: 13, color: 'var(--t3)' }}>Recording voice message…</span>
          <div style={{ flex: 1 }} />
          <Tip label="Cancel"><button onClick={() => voice.cancel()} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--bg-active)', color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Trash s={16} /></button></Tip>
          <Tip label="Send"><button onClick={toggleVoice} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Send s={16} /></button></Tip>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
      {typingIndicator}
      <div
        style={{
          background: 'var(--bg-elv)', borderRadius: 16, overflow: 'visible', position: 'relative',
          border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--bd)'}`,
          boxShadow: focused ? '0 0 0 3px var(--primary-dim)' : '0 1px 2px rgba(0,0,0,.18)',
          transition: 'border-color .15s, box-shadow .15s', opacity: disabled ? 0.6 : 1,
        }}
      >
        <PendingAttachments items={pending} onRemove={removePending} />

        {stt.listening && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--bd)', color: 'var(--primary)' }}>
            <span className="il-rec-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Listening…</span>
            {interim && <span style={{ fontSize: 12.5, color: 'var(--t3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{interim}</span>}
          </div>
        )}

        {/* Row 1 — textarea */}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => { onType(e.target.value); grow(e.target); }}
          onKeyDown={onKey}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          lang={stt.lang.split('-')[0]}
          style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 15, fontFamily: "'DM Sans',sans-serif", resize: 'none', minHeight: 24, maxHeight: 160, overflowY: 'auto', lineHeight: 1.55, padding: '12px 14px 4px' }}
        />

        {/* Row 2 — action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px 7px' }}>
          {/* Hidden file inputs driven by the grouped "+" attach menu. Keeping
              them out of the rendered button row avoids accidental visual
              clutter while still exposing distinct accept filters per category. */}
          <input ref={imageInput} type="file" multiple hidden accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={videoInput} type="file" multiple hidden accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={docInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-rar-compressed,application/x-7z-compressed" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />

          {(uploadFile || onCreatePoll) && (
            <div style={{ position: 'relative' }}>
              {/* Single "+" attach button — opens a small menu with Image,
                  Video, Document and Poll. Replaces the previous separate
                  paperclip + Poll buttons and is the canonical way to add
                  anything non-text to a message. */}
              <ComposerBtn
                label="Attach"
                active={pop === 'attach'}
                onClick={() => setPop(pop === 'attach' ? null : 'attach')}
              >
                <Ic.Plus s={20} />
              </ComposerBtn>
              {pop === 'attach' && (
                <div
                  className="il-scale-in"
                  style={{
                    position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 260,
                    minWidth: 200, background: 'var(--bg-elv)', border: '1px solid var(--bd2)',
                    borderRadius: 'var(--r-lg)', boxShadow: '0 12px 36px rgba(0,0,0,.45)',
                    padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  {uploadFile && (
                    <>
                      <AttachMenuItem icon={<Ic.Image s={16} />} label="Image" hint="JPG · PNG · GIF · WEBP" onClick={() => { setPop(null); imageInput.current?.click(); }} />
                      <AttachMenuItem icon={<Ic.Video s={16} />} label="Video" hint="MP4 · WebM · MOV" onClick={() => { setPop(null); videoInput.current?.click(); }} />
                      <AttachMenuItem icon={<Ic.File s={16} />} label="Document" hint="PDF · DOC · XLS · PPT · TXT · ZIP" onClick={() => { setPop(null); docInput.current?.click(); }} />
                    </>
                  )}
                  {onCreatePoll && (
                    <>
                      {uploadFile && <div style={{ height: 1, background: 'var(--bd)', margin: '4px 2px' }} />}
                      <AttachMenuItem icon={<Ic.BarChart s={16} />} label="Poll" hint="Ask a question with options" onClick={() => setPop('poll')} />
                    </>
                  )}
                </div>
              )}
              {pop === 'poll' && onCreatePoll && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 270 }}>
                  <PollComposer onCreate={(q, o, m) => onCreatePoll(q, o, m)} onClose={() => setPop(null)} />
                </div>
              )}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <ComposerBtn label="Emoji" active={pop === 'emoji'} onClick={() => setPop(pop === 'emoji' ? null : 'emoji')}><Ic.Smile s={19} /></ComposerBtn>
            {pop === 'emoji' && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 250 }}>
                <EmojiPicker onPick={insertEmoji} onClose={() => setPop(null)} />
              </div>
            )}
          </div>

          {stt.supported && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <ComposerBtn label={stt.listening ? 'Stop dictation' : 'Dictate — speech to text'} active={stt.listening} onClick={() => (stt.listening ? stt.stop() : stt.start())}>
                {stt.listening ? <Ic.MicOff s={19} /> : <Ic.Mic s={19} />}
              </ComposerBtn>
              <ComposerBtn label="Dictation language" active={pop === 'lang'} onClick={() => setPop(pop === 'lang' ? null : 'lang')}><Ic.Languages s={16} /></ComposerBtn>
              {pop === 'lang' && (
                <div className="il-scale-in" style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: 210, maxHeight: 280, overflowY: 'auto', background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 250, padding: 5 }}>
                  {STT_LANGUAGES.map((l) => (
                    <button key={l.code} onClick={() => { stt.setLanguage(l.code); setPop(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '7px 9px', background: stt.lang === l.code ? 'var(--primary-dim)' : 'none', border: 'none', cursor: 'pointer', color: stt.lang === l.code ? 'var(--primary)' : 'var(--t2)', borderRadius: 6, fontSize: 12.5, fontFamily: "'DM Sans',sans-serif" }}>
                      {l.label}{stt.lang === l.code && <Ic.Check s={13} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {uploadFile && !canSend && (
            <ComposerBtn label="Record voice message" onClick={toggleVoice}><Ic.Waveform s={19} /></ComposerBtn>
          )}

          <button
            onClick={send}
            disabled={!canSend || disabled || sending}
            title="Send"
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: canSend ? 'pointer' : 'default', background: canSend ? 'var(--primary)' : 'var(--bg-active)', color: canSend ? '#fff' : 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', boxShadow: canSend ? '0 2px 10px var(--primary-dim)' : 'none', marginLeft: 2, flexShrink: 0 }}
          >
            {sending ? <Ic.Loader s={16} className="il-spin" /> : <Ic.Send s={16} c="currentColor" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Renders the sender-side delivery state, WhatsApp-style:
 *  - sending  → single grey tick
 *  - delivered to server (not yet seen) → double grey tick
 *  - seen     → double coloured tick
 *  Only meaningful on the current user's own messages. */
export function ReadTicks({ delivered, seen }: { delivered: boolean; seen: boolean }) {
  if (!delivered) {
    return (
      <Tip label="Sent">
        <span style={{ display: 'inline-flex', color: 'var(--t3)', opacity: 0.8 }}><Ic.Check s={13} /></span>
      </Tip>
    );
  }
  return (
    <Tip label={seen ? 'Seen' : 'Delivered'}>
      <span style={{ display: 'inline-flex', color: seen ? 'var(--ok)' : 'var(--t3)' }}>
        <Ic.CheckCheck s={14} />
      </span>
    </Tip>
  );
}
