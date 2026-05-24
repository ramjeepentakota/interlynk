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
            style={{ width: '100%', padding: '6px 8px 6px 30px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: 'var(--ff-body)' }}
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

function FileTypeIcon({ fileName, size = 46 }: { fileName: string; size?: number }) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  const s = size;
  const label = (ext || 'FILE').toUpperCase().slice(0, 4);

  if (ext === 'pdf') {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#FDECEA"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#E63946" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#E63946" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#E63946" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <text x="20" y="24" fontFamily="Arial,sans-serif" fontSize="6.5" fontWeight="800" fill="#E63946" textAnchor="middle">PDF</text>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#E63946"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">PDF</text>
      </svg>
    );
  }
  if (['doc', 'docx'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#E8F0FE"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#185ABC" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#185ABC" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#185ABC" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <path d="M14 16h12M14 20h12M14 24h8" stroke="#185ABC" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#185ABC"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#E6F4EA"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#1A7F37" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#1A7F37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#1A7F37" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <rect x="13" y="15" width="14" height="12" rx="1.5" stroke="#1A7F37" strokeWidth="1.2" fill="none"/>
        <path d="M13 19h14M13 23h14M17 15v12M24 15v12" stroke="#1A7F37" strokeWidth="1" strokeLinecap="round"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#1A7F37"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#FEF0E6"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#C43E00" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#C43E00" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#C43E00" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <rect x="13" y="15" width="14" height="9" rx="1.5" stroke="#C43E00" strokeWidth="1.2" fill="none"/>
        <path d="M20 24v4" stroke="#C43E00" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M17 28h6" stroke="#C43E00" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#C43E00"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#FEF9E7"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#F59E0B" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <rect x="18" y="9" width="4" height="3" rx="0.5" fill="#F59E0B" opacity="0.6"/>
        <rect x="18" y="14" width="4" height="3" rx="0.5" fill="#F59E0B" opacity="0.8"/>
        <rect x="18" y="19" width="4" height="3" rx="0.5" fill="#F59E0B"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#F59E0B"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['txt', 'md', 'rtf', 'log'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#F3F4F6"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#6B7280" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <path d="M14 16h12M14 20h12M14 24h9" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#6B7280"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#EDE9FE"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#7C3AED" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <path d="M15 16l11 5.5-11 5.5V16z" fill="#7C3AED"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#7C3AED"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return (
      <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
        <rect width="46" height="46" rx="10" fill="#FCE7F3"/>
        <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#DB2777" strokeWidth="1.4"/>
        <path d="M24 5v8h6" stroke="#DB2777" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M24 5l6 8" stroke="#DB2777" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <path d="M14 22v-4M17 22v-7M20 22v-5M23 22v-8M26 22v-3" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="8" y="31" width="30" height="10" rx="3" fill="#DB2777"/>
        <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
      </svg>
    );
  }
  // Generic file
  return (
    <svg width={s} height={s} viewBox="0 0 46 46" fill="none">
      <rect width="46" height="46" rx="10" fill="#EFF6FF"/>
      <rect x="10" y="5" width="20" height="26" rx="3" fill="white" stroke="#3B82F6" strokeWidth="1.4"/>
      <path d="M24 5v8h6" stroke="#3B82F6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M24 5l6 8" stroke="#3B82F6" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M14 18h12M14 22h9" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="8" y="31" width="30" height="10" rx="3" fill="#3B82F6"/>
      <text x="23" y="39" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" fill="white" textAnchor="middle">{label}</text>
    </svg>
  );
}

function isPreviewable(a: Attachment): boolean {
  const ext = (a.fileName || '').split('.').pop()?.toLowerCase() || '';
  return ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ||
    (a.fileType || '').startsWith('image/') ||
    a.fileType === 'application/pdf' ||
    a.fileType === 'text/plain';
}

/** Full-screen preview modal for images, PDFs, and text files. */
function FilePreviewModal({ a, onClose }: { a: Attachment; onClose: () => void }) {
  const ext = (a.fileName || '').split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || a.fileType === 'application/pdf';
  const isText = ext === 'txt' || a.fileType === 'text/plain';
  const isImage = a.kind === 'image' || a.kind === 'gif' || (a.fileType || '').startsWith('image/');

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 860, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-elv)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', border: '1px solid var(--bd2)' }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</span>
        <span style={{ fontSize: 12, color: 'var(--t3)', marginRight: 8 }}>{humanSize(a.fileSize)}</span>
        <a href={a.fileUrl} download={a.fileName} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--r)', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 12.5, fontWeight: 600 }}>
          <Ic.Download s={13} /> Download
        </a>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', marginLeft: 4 }}>
          <Ic.X s={17} />
        </button>
      </div>

      {/* Preview body */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 860, flex: 1, maxHeight: '80vh', background: 'var(--bg-main)', border: '1px solid var(--bd2)', borderTop: 'none', borderRadius: '0 0 var(--r-lg) var(--r-lg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isImage && (
          <img src={a.fileUrl} alt={a.fileName} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
        )}
        {isPdf && (
          <iframe src={a.fileUrl} title={a.fileName} style={{ width: '100%', height: '80vh', border: 'none' }} />
        )}
        {isText && (
          <iframe src={a.fileUrl} title={a.fileName} style={{ width: '100%', height: '80vh', border: 'none', background: '#fff', color: '#000' }} />
        )}
        {!isImage && !isPdf && !isText && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><FileTypeIcon fileName={a.fileName} size={72} /></div>
            <div style={{ fontSize: 15, color: 'var(--t1)', fontWeight: 600, marginBottom: 4 }}>{a.fileName}</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>{humanSize(a.fileSize)}</div>
            <a href={a.fileUrl} download={a.fileName} style={{ padding: '9px 20px', borderRadius: 'var(--r)', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-screen document preview modal — Teams style. */
function DocPreviewModal({ a, blobUrl, fetching, onClose }: {
  a: Attachment; blobUrl: string | null; fetching: boolean; onClose: () => void;
}) {
  const ext = (a.fileName || '').split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || a.fileType === 'application/pdf';
  const isText = ext === 'txt' || a.fileType === 'text/plain';

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', height: '100%',
          maxWidth: 1140, maxHeight: '100%',
          background: 'var(--bg-main)',
          borderRadius: 'var(--r-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 32px 100px rgba(0,0,0,.8)',
          border: '1px solid var(--bd2)',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', flexShrink: 0,
          background: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--bd)',
        }}>
          <FileTypeIcon fileName={a.fileName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 1 }}>{humanSize(a.fileSize)}</div>
          </div>
          <a
            href={a.fileUrl} download={a.fileName}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 'var(--r)', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}
          >
            <Ic.Download s={15} /> Download
          </a>
          <button
            onClick={onClose}
            style={{ width: 38, height: 38, borderRadius: 'var(--r)', border: 'none', cursor: 'pointer', background: 'var(--bg-active)', color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Ic.X s={18} />
          </button>
        </div>

        {/* Preview body — fills all remaining height */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
          {fetching && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Ic.Loader s={34} className="il-spin" c="var(--primary)" />
              <span style={{ fontSize: 14, color: 'var(--t3)' }}>Loading preview…</span>
            </div>
          )}
          {!fetching && blobUrl && (
            isPdf
              ? <embed src={blobUrl} type="application/pdf" style={{ width: '100%', height: '100%', display: 'block' }} />
              : isText
              ? <iframe src={blobUrl} title={a.fileName} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} sandbox="allow-same-origin" />
              : <img src={blobUrl} alt={a.fileName} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          )}
          {!fetching && !blobUrl && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40 }}>
              <FileTypeIcon fileName={a.fileName} size={80} />
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>Preview unavailable for this file type</div>
              <div style={{ fontSize: 13.5, color: 'var(--t3)' }}>Download the file to view it in a compatible application.</div>
              <a href={a.fileUrl} download={a.fileName}
                style={{ padding: '10px 28px', borderRadius: 'var(--r)', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ic.Download s={16} /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact Teams-style file attachment card in chat. */
function DocCard({ a }: { a: Attachment }) {
  const [open, setOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const blobRef = useRef<string | null>(null);

  const ext = (a.fileName || '').split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || a.fileType === 'application/pdf';
  const isText = ext === 'txt' || a.fileType === 'text/plain';
  const isImg  = (a.fileType || '').startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext);
  const canPreview = isPdf || isText || isImg;

  const fileColor =
    ext === 'pdf'                      ? '#e63946' :
    ['doc','docx'].includes(ext)       ? '#185abc' :
    ['xls','xlsx','csv'].includes(ext) ? '#1a7f37' :
    ['ppt','pptx'].includes(ext)       ? '#c43e00' :
    ['zip','rar','7z'].includes(ext)   ? '#f59e0b' :
    'var(--primary)';

  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  const openPreview = async () => {
    setOpen(true);
    if (blobUrl) return;
    setFetching(true);
    try {
      const res = await fetch(a.fileUrl, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const typed = isPdf  ? new Blob([blob], { type: 'application/pdf' })
                  : isText ? new Blob([blob], { type: 'text/plain' })
                  : blob;
      const url = URL.createObjectURL(typed);
      blobRef.current = url;
      setBlobUrl(url);
    } catch { setBlobUrl(null); }
    finally { setFetching(false); }
  };

  return (
    <>
      {/* Compact horizontal card — like Teams file attachment */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--bd)',
        background: 'var(--bg-hover)',
        width: '100%',
      }}>
        {/* Colored file icon */}
        <div style={{ flexShrink: 0 }}>
          <FileTypeIcon fileName={a.fileName} size={46} />
        </div>

        {/* Name + type/size */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</div>
          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
            {(ext || 'FILE').toUpperCase()} · {humanSize(a.fileSize)}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canPreview && (
            <button
              onClick={openPreview}
              style={{
                padding: '6px 14px', borderRadius: 'var(--r)',
                border: `1.5px solid ${fileColor}66`,
                background: `${fileColor}18`,
                color: fileColor,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--ff-body)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Ic.Eye s={13} /> Preview
            </button>
          )}
          <Tip label="Download">
            <a
              href={a.fileUrl} download={a.fileName}
              style={{
                width: 34, height: 34, borderRadius: 'var(--r)',
                border: '1.5px solid var(--bd2)',
                color: 'var(--t2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              <Ic.Download s={15} />
            </a>
          </Tip>
        </div>
      </div>

      {/* Full-screen Teams-style preview modal */}
      {open && (
        <DocPreviewModal
          a={a}
          blobUrl={blobUrl}
          fetching={fetching}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Inline gallery for a message's attachments (images, video, audio/voice, docs). */
export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, maxWidth: 420 }}>
      {attachments.map((a, i) => <AttachmentView key={a.id || `${a.fileUrl}-${i}`} a={a} />)}
    </div>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  const [preview, setPreview] = useState(false);

  if (a.kind === 'image' || a.kind === 'gif') {
    return (
      <>
        <div
          onClick={() => setPreview(true)}
          style={{ display: 'inline-block', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bd)', maxWidth: 320, cursor: 'pointer' }}
        >
          <img src={a.fileUrl} alt={a.fileName} loading="lazy" style={{ display: 'block', maxWidth: 320, maxHeight: 320, objectFit: 'cover' }} />
        </div>
        {preview && <FilePreviewModal a={a} onClose={() => setPreview(false)} />}
      </>
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
  return <DocCard a={a} />;
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
        <div key={p.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: p.previewUrl ? 0 : '4px 8px 4px 4px', borderRadius: 'var(--r)', border: '1px solid var(--bd2)', background: 'var(--bg-elv)', maxWidth: 200 }}>
          {p.previewUrl ? (
            <img src={p.previewUrl} alt={p.file.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--r)' }} />
          ) : (
            <>
              <FileTypeIcon fileName={p.file.name} size={36} />
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

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m left`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h left`;
}

/** Renders a poll inside a message with live result bars and countdown. */
export function PollCard({ poll, onVote, onPollEnd }: { poll: Poll; onVote: (optionIds: string[]) => void; onPollEnd?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!poll.expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [poll.expiresAt]);

  const expiryMs = poll.expiresAt ? new Date(poll.expiresAt).getTime() : null;
  const isExpired = poll.closed || (expiryMs !== null && expiryMs <= now);
  const firedEndRef = useRef(false);
  useEffect(() => {
    if (isExpired && onPollEnd && !firedEndRef.current) {
      firedEndRef.current = true;
      onPollEnd();
    }
  }, [isExpired, onPollEnd]);
  const voted = new Set(poll.votedOptionIds);
  const total = poll.totalVotes;

  const toggle = (optionId: string) => {
    if (isExpired) return;
    if (poll.allowMultiple) {
      const next = new Set(voted);
      if (next.has(optionId)) next.delete(optionId); else next.add(optionId);
      onVote([...next]);
    } else {
      onVote(voted.has(optionId) ? [] : [optionId]);
    }
  };

  return (
    <div style={{ marginTop: 6, maxWidth: 460, border: `1px solid ${isExpired ? 'var(--bd)' : 'var(--primary-dim)'}`, borderRadius: 'var(--r-lg)', background: 'var(--bg-elv)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: isExpired ? 'var(--t3)' : 'var(--primary)', display: 'flex' }}><Ic.BarChart s={16} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4, flex: 1 }}>{poll.question}</span>
        {expiryMs !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: isExpired ? 'var(--err)' : 'var(--ok)', background: isExpired ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
            {isExpired ? 'Ended' : fmtCountdown(expiryMs - now)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
          const mine = voted.has(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} disabled={isExpired}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--r)', cursor: isExpired ? 'default' : 'pointer', border: `1.5px solid ${mine ? 'var(--primary)' : 'var(--bd2)'}`, background: 'var(--bg-hover)', overflow: 'hidden', fontFamily: 'var(--ff-body)' }}
            >
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mine ? 'var(--primary-dim)' : 'var(--bg-active)', transition: 'width .35s ease', zIndex: 0 }} />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: poll.allowMultiple ? 5 : '50%', border: `1.5px solid ${mine ? 'var(--primary)' : 'var(--bd2)'}`, background: mine ? 'var(--primary)' : 'transparent', flexShrink: 0 }}>
                {mine && <Ic.Check s={11} c="#fff" />}
              </span>
              <span style={{ position: 'relative', zIndex: 1, flex: 1, fontSize: 13.5, color: 'var(--t1)', fontWeight: mine ? 600 : 500 }}>{opt.text}</span>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 12.5, color: 'var(--t2)', fontWeight: 600, flexShrink: 0 }}>{pct}%</span>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 11.5, color: 'var(--t3)', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>{opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, fontSize: 11.5, color: 'var(--t3)' }}>
        <span>{total} {total === 1 ? 'vote' : 'votes'}</span>
        {poll.allowMultiple && <span>· Multiple choice</span>}
        {isExpired && <span style={{ color: 'var(--err)', fontWeight: 600 }}>· Poll ended</span>}
      </div>
    </div>
  );
}

const POLL_DURATION_OPTIONS: { label: string; ms: number }[] = [
  { label: 'No limit', ms: 0 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '30 min', ms: 30 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: '6 hours', ms: 6 * 60 * 60_000 },
  { label: '1 day', ms: 24 * 60 * 60_000 },
  { label: '3 days', ms: 3 * 24 * 60 * 60_000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60_000 },
];

/** Compact poll-builder popover used from the composer. */
export function PollComposer({ onCreate, onClose }: { onCreate: (question: string, options: string[], allowMultiple: boolean, durationMs?: number) => void; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const setOption = (i: number, v: string) => setOptions((p) => p.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions((p) => (p.length >= 12 ? p : [...p, '']));
  const removeOption = (i: number) => setOptions((p) => (p.length <= 2 ? p : p.filter((_, idx) => idx !== i)));

  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && cleaned.length >= 2;

  const submit = () => {
    if (!valid) return;
    onCreate(question.trim(), cleaned, allowMultiple, durationMs || undefined);
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
          style={{ width: '100%', padding: '9px 11px', fontSize: 13.5, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: 'var(--ff-body)' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && i === options.length - 1 && o.trim()) addOption(); }}
                placeholder={`Option ${i + 1}`}
                style={{ flex: 1, padding: '8px 11px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: 'var(--ff-body)' }}
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 5, borderRadius: 6, display: 'flex', flexShrink: 0 }}><Ic.X s={13} /></button>
              )}
            </div>
          ))}
          {options.length < 12 && (
            <button onClick={addOption} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px dashed var(--bd2)', cursor: 'pointer', color: 'var(--t-link)', padding: '7px 11px', borderRadius: 'var(--r)', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--ff-body)' }}>
              <Ic.Plus s={13} /> Add option
            </button>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--t2)' }}>
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
          Allow selecting multiple options
        </label>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Duration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {POLL_DURATION_OPTIONS.map((opt) => (
              <button key={opt.ms} type="button" onClick={() => setDurationMs(opt.ms)}
                style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${durationMs === opt.ms ? 'var(--primary)' : 'var(--bd2)'}`, background: durationMs === opt.ms ? 'var(--primary-dim)' : 'transparent', color: durationMs === opt.ms ? 'var(--primary)' : 'var(--t2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--ff-body)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
        fontFamily: 'var(--ff-body)',
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
  onCreatePoll?: (question: string, options: string[], allowMultiple: boolean, durationMs?: number) => void;
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
          <Tip label="Send"><button onClick={toggleVoice} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: '#11183d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-glow)' }}><Ic.Send s={16} /></button></Tip>
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
          style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 15, fontFamily: 'var(--ff-body)', resize: 'none', minHeight: 24, maxHeight: 160, overflowY: 'auto', lineHeight: 1.55, padding: '12px 14px 4px' }}
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
                  <PollComposer onCreate={(q, o, m, d) => onCreatePoll(q, o, m, d)} onClose={() => setPop(null)} />
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
                    <button key={l.code} onClick={() => { stt.setLanguage(l.code); setPop(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '7px 9px', background: stt.lang === l.code ? 'var(--primary-dim)' : 'none', border: 'none', cursor: 'pointer', color: stt.lang === l.code ? 'var(--primary)' : 'var(--t2)', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--ff-body)' }}>
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
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: canSend ? 'pointer' : 'default', background: canSend ? 'var(--primary)' : 'var(--bg-active)', color: canSend ? '#11183d' : 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s var(--ease)', boxShadow: canSend ? 'var(--sh-glow)' : 'none', marginLeft: 2, flexShrink: 0 }}
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
