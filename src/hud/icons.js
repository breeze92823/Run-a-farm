// HUD icons: small flat SVGs with a dark outline, drawn on a 64x64 grid so they
// read like the chunky cartoon icons in the reference screenshots.

const O = 'stroke="#3a1f0e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"'
const svg = (body) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`

export const ICONS = {
  // Red barn with a white X door.
  home: svg(`
    <path d="M8 30 L32 12 L56 30 L56 54 L8 54 Z" fill="#d6342c" ${O}/>
    <path d="M4 32 L32 10 L60 32" fill="none" stroke="#6b6e75" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 32 L32 10 L60 32" fill="none" stroke="#3a1f0e" stroke-width="2"/>
    <rect x="22" y="34" width="20" height="20" fill="#f7f4ec" ${O}/>
    <path d="M22 34 L42 54 M42 34 L22 54" stroke="#d6342c" stroke-width="3"/>
    <rect x="27" y="20" width="10" height="8" fill="#f7f4ec" ${O}/>`),
  coin: svg(`
    <circle cx="32" cy="32" r="28" fill="#f2b51f" ${O}/>
    <circle cx="32" cy="32" r="21" fill="#ffd34a" stroke="#d99a12" stroke-width="3"/>
    <path d="M38 22 C34 19 25 20 25 26 C25 33 39 30 39 38 C39 44 30 45 25 42 M32 16 V48" fill="none" stroke="#c0392b" stroke-width="5" stroke-linecap="round"/>`),
  // Money boost: a green farmer's hat with a $ band.
  boostMoney: svg(`
    <ellipse cx="32" cy="44" rx="28" ry="9" fill="#6b8f3a" ${O}/>
    <path d="M16 44 C16 22 22 16 32 16 C42 16 48 22 48 44 Z" fill="#7fa64a" ${O}/>
    <rect x="17" y="34" width="30" height="7" fill="#4c6b28"/>
    <text x="32" y="33" text-anchor="middle" font-size="16" font-weight="700" font-family="Fredoka, sans-serif" fill="#e9f5c9">$</text>`),
  // Friends boost: three little blocky people.
  boostFriends: svg(`
    <rect x="6" y="26" width="16" height="22" rx="2" fill="#2f7bd6" ${O}/><rect x="9" y="12" width="10" height="12" rx="2" fill="#f2c79a" ${O}/>
    <rect x="42" y="26" width="16" height="22" rx="2" fill="#3fae4a" ${O}/><rect x="45" y="12" width="10" height="12" rx="2" fill="#f2c79a" ${O}/>
    <rect x="23" y="30" width="18" height="24" rx="2" fill="#d6342c" ${O}/><rect x="26" y="14" width="12" height="14" rx="2" fill="#f2c79a" ${O}/>`),
  // Shop: a red gift box with a gold ribbon.
  shop: svg(`
    <rect x="9" y="26" width="46" height="30" rx="3" fill="#e2392f" ${O}/>
    <rect x="6" y="18" width="52" height="11" rx="3" fill="#f04a3a" ${O}/>
    <rect x="28" y="18" width="8" height="38" fill="#ffd34a" stroke="#3a1f0e" stroke-width="2"/>
    <path d="M32 18 C24 6 12 10 18 17 Z M32 18 C40 6 52 10 46 17 Z" fill="#ffd34a" ${O}/>`),
  settings: svg(`
    <path d="M32 6 l5 6 8-2 2 8 8 2-2 8 6 5-6 5 2 8-8 2-2 8-8-2-5 6-5-6-8 2-2-8-8-2 2-8-6-5 6-5-2-8 8-2 2-8 8 2z" fill="#c9d3dc" ${O}/>
    <circle cx="32" cy="32" r="10" fill="#4a7bd0" ${O}/>`),
  // Index: a red book with a gold emblem.
  index: svg(`
    <path d="M12 10 H48 a4 4 0 0 1 4 4 V54 a4 4 0 0 1 -4 4 H12 Z" fill="#d6342c" ${O}/>
    <path d="M12 10 V58" stroke="#8f1d20" stroke-width="6"/>
    <rect x="16" y="52" width="34" height="4" fill="#f7f4ec"/>
    <circle cx="33" cy="30" r="9" fill="#ffd34a" ${O}/><circle cx="33" cy="30" r="4" fill="#e2392f"/>`),
  pumpkin: svg(`
    <ellipse cx="32" cy="38" rx="27" ry="20" fill="#ef7a1c" ${O}/>
    <ellipse cx="32" cy="38" rx="11" ry="20" fill="#f7953a" ${O}/>
    <path d="M20 22 C14 30 14 46 20 55 M44 22 C50 30 50 46 44 55" fill="none" stroke="#c45a12" stroke-width="2.5"/>
    <path d="M32 18 C31 12 33 8 37 6" fill="none" stroke="#4f7a24" stroke-width="5" stroke-linecap="round"/>`),
  // The goal: a green combine harvester.
  harvester: svg(`
    <rect x="16" y="22" width="30" height="18" rx="2" fill="#3a9a46" ${O}/>
    <rect x="30" y="10" width="14" height="14" rx="2" fill="#bfe3f2" ${O}/>
    <rect x="2" y="36" width="20" height="10" rx="2" fill="#f2c230" ${O}/>
    <path d="M4 38 H20 M4 42 H20" stroke="#c99a1d" stroke-width="2"/>
    <circle cx="40" cy="46" r="10" fill="#2a2a2e" ${O}/><circle cx="40" cy="46" r="4" fill="#f2c230"/>
    <circle cx="20" cy="50" r="6" fill="#2a2a2e" ${O}/>
    <rect x="46" y="16" width="14" height="4" fill="#3a9a46" ${O}/>`),
  // Bag: a woven basket with carrot and wheat poking out.
  bag: svg(`
    <path d="M36 22 L46 4" stroke="#4f8a2c" stroke-width="4" stroke-linecap="round"/>
    <path d="M30 26 L40 6 L44 8 Z" fill="#ef7a1c" ${O}/>
    <path d="M22 24 L18 6 M26 24 L26 4" stroke="#e3b84e" stroke-width="4" stroke-linecap="round"/>
    <path d="M12 26 H52 L48 56 H16 Z" fill="#e8d8a8" ${O}/>
    <path d="M14 36 H50 M15 46 H49" stroke="#c9b27a" stroke-width="3"/>
    <rect x="10" y="22" width="44" height="7" rx="3" fill="#cdb684" ${O}/>`),
  eggs: svg(`
    <ellipse cx="22" cy="36" rx="14" ry="18" fill="#f7f4ec" ${O}/>
    <ellipse cx="42" cy="38" rx="14" ry="18" fill="#eef0f4" ${O}/>
    <ellipse cx="38" cy="30" rx="4" ry="6" fill="#ffffff"/>`),
  // Storage: an open crate of produce.
  crate: svg(`
    <circle cx="22" cy="22" r="8" fill="#e2392f" ${O}/><circle cx="36" cy="20" r="8" fill="#f2c230" ${O}/><path d="M44 26 L54 8" stroke="#ef7a1c" stroke-width="7" stroke-linecap="round"/>
    <rect x="8" y="26" width="48" height="30" rx="2" fill="#c9965a" ${O}/>
    <path d="M8 36 H56 M8 46 H56" stroke="#8a5a2b" stroke-width="3"/>`),
  // Cargo: stacked cardboard boxes.
  cargo: svg(`
    <rect x="6" y="32" width="26" height="24" fill="#e2b779" ${O}/><rect x="32" y="32" width="26" height="24" fill="#d6a86a" ${O}/>
    <rect x="18" y="8" width="26" height="24" fill="#e8c48a" ${O}/>
    <path d="M19 32 V40 M45 32 V40 M31 8 V16" stroke="#a87a3a" stroke-width="3"/>`),
  // Seeds.
  wheat: svg(`
    <g fill="#f2c94e" ${O}>
      <path d="M18 56 L28 26" fill="none"/><path d="M32 58 L32 24" fill="none"/><path d="M46 56 L36 26" fill="none"/>
      <ellipse cx="26" cy="20" rx="6" ry="12" transform="rotate(-18 26 20)"/>
      <ellipse cx="32" cy="16" rx="6" ry="13"/>
      <ellipse cx="38" cy="20" rx="6" ry="12" transform="rotate(18 38 20)"/>
    </g>
    <path d="M14 46 C24 40 40 40 50 46 L50 52 C40 47 24 47 14 52 Z" fill="#c9963a" ${O}/>`),
  corn: svg(`
    <path d="M30 60 C14 46 12 28 18 18 C26 30 28 44 32 58 Z" fill="#6cbf45" ${O}/>
    <path d="M34 60 C50 46 52 28 46 18 C38 30 36 44 32 58 Z" fill="#5aaa3a" ${O}/>
    <ellipse cx="32" cy="28" rx="9" ry="20" fill="#f2cf3a" ${O}/>
    <path d="M27 18 H37 M25 26 H39 M25 34 H39 M27 42 H37" stroke="#d6a91f" stroke-width="2"/>`),
  sunflower: svg(`
    <path d="M32 40 V62" stroke="#4f8a2c" stroke-width="4"/><path d="M32 52 C24 46 18 50 16 54 C22 56 28 56 32 52" fill="#5aaa3a" ${O}/>
    <g fill="#f7c531" ${O}>${Array.from({ length: 10 }, (_, i) => `<ellipse cx="32" cy="10" rx="5" ry="10" transform="rotate(${i * 36} 32 26)"/>`).join('')}</g>
    <circle cx="32" cy="26" r="9" fill="#7a4a1e" ${O}/>`),
  potato: svg(`
    <path d="M10 36 C8 24 22 14 36 16 C52 18 58 30 54 42 C50 54 30 56 20 52 C12 48 11 42 10 36 Z" fill="#c8945a" ${O}/>
    <circle cx="24" cy="30" r="2.5" fill="#8a5a2b"/><circle cx="40" cy="26" r="2.5" fill="#8a5a2b"/><circle cx="36" cy="42" r="2.5" fill="#8a5a2b"/><circle cx="22" cy="44" r="2" fill="#8a5a2b"/>`),
  pumpkinSeed: '',
  lock: svg(`
    <path d="M20 30 V22 a12 12 0 0 1 24 0 V30" fill="none" stroke="#3a1f0e" stroke-width="9"/>
    <path d="M20 30 V22 a12 12 0 0 1 24 0 V30" fill="none" stroke="#c9ccd1" stroke-width="5"/>
    <rect x="12" y="28" width="40" height="30" rx="5" fill="#f2b51f" ${O}/>
    <circle cx="32" cy="40" r="4" fill="#3a1f0e"/><rect x="30" y="42" width="4" height="9" fill="#3a1f0e"/>`),
  back: svg(`
    <path d="M30 10 L8 32 L30 54 V42 H56 V22 H30 Z" fill="#ffd34a" ${O}/>`),
  sun: svg(`
    ${Array.from({ length: 12 }, (_, i) => `<path d="M32 2 L35 12 L29 12 Z" fill="#ffd34a" transform="rotate(${i * 30} 32 32)"/>`).join('')}
    <circle cx="32" cy="32" r="18" fill="#f7a531" ${O}/><circle cx="26" cy="27" r="3" fill="#e2852a"/><circle cx="37" cy="36" r="4" fill="#e2852a"/><circle cx="36" cy="25" r="2" fill="#e2852a"/>`),
  close: svg(`<path d="M18 18 L46 46 M46 18 L18 46" stroke="#3b0606" stroke-width="13" stroke-linecap="round" transform="translate(-2 3)"/><path d="M18 18 L46 46 M46 18 L18 46" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`),
  check: svg(`<path d="M12 34 L26 48 L52 18" fill="none" stroke="#3a1f0e" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 34 L26 48 L52 18" fill="none" stroke="#7ee05a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  quest: svg(`<rect x="12" y="6" width="40" height="52" rx="5" fill="#f3e6c4" ${O}/><path d="M20 20 H44 M20 30 H44 M20 40 H36" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/><rect x="24" y="2" width="16" height="9" rx="3" fill="#8a5a2b" ${O}/>`),
  sound: svg(`<path d="M8 24 H20 L34 12 V52 L20 40 H8 Z" fill="#ffd34a" ${O}/><path d="M42 22 C47 27 47 37 42 42 M48 16 C57 25 57 39 48 48" fill="none" stroke="#3a1f0e" stroke-width="4" stroke-linecap="round"/>`),
  moonIcon: svg(`<path d="M40 8 A24 24 0 1 0 56 44 A18 18 0 1 1 40 8 Z" fill="#ffd34a" ${O}/>`),
}
ICONS.pumpkinSeed = ICONS.pumpkin
// Farm Office workers: a blocky farmhand with a hat in the job's colours, holding its load.
const worker = (shirt, hat, load) => svg(`
    <rect x="22" y="44" width="8" height="14" fill="#2c4f8e" ${O}/><rect x="34" y="44" width="8" height="14" fill="#2c4f8e" ${O}/>
    <rect x="18" y="26" width="28" height="20" rx="3" fill="${shirt}" ${O}/>
    <rect x="22" y="8" width="20" height="18" rx="3" fill="#f2c79a" ${O}/>
    <circle cx="28" cy="16" r="1.8" fill="#3a1f0e"/><circle cx="36" cy="16" r="1.8" fill="#3a1f0e"/>
    ${hat}${load}`)
const CAP = (c) => `<path d="M20 11 Q32 0 44 11 L44 12 L20 12 Z" fill="${c}" ${O}/><rect x="40" y="9" width="10" height="4" rx="2" fill="${c}" ${O}/>`
const STRAW = `<ellipse cx="32" cy="11" rx="18" ry="4" fill="#f0cf6a" ${O}/><path d="M23 10 Q32 0 41 10 Z" fill="#f0cf6a" ${O}/>`
const EGG = (x) => `<ellipse cx="${x}" cy="31" rx="4" ry="5" fill="#fff7e6" stroke="#3a1f0e" stroke-width="2"/>`
Object.assign(ICONS, {
  stocker: worker('#d63a2c', CAP('#d63a2c'), `<rect x="12" y="32" width="40" height="8" rx="2" fill="#d8c49a" ${O}/>${EGG(22)}${EGG(32)}${EGG(42)}`),
  hand: worker('#e0a43a', STRAW, `<path d="M20 34 L22 24 M28 34 L28 22 M36 34 L36 23 M44 34 L42 24" stroke="#e8c25a" stroke-width="4" stroke-linecap="round"/><rect x="16" y="32" width="32" height="14" rx="2" fill="#c79a5c" ${O}/>`),
  tractor: svg(`
    <rect x="10" y="30" width="34" height="14" rx="3" fill="#3f8a4a" ${O}/>
    <path d="M30 30 L30 14 L46 14 L48 30 Z" fill="#9fd3ff" ${O}/><rect x="28" y="10" width="22" height="5" rx="2" fill="#f2f2f2" ${O}/>
    <rect x="44" y="26" width="10" height="18" rx="2" fill="#3f8a4a" ${O}/>
    <circle cx="20" cy="48" r="10" fill="#2b2b2b" ${O}/><circle cx="20" cy="48" r="4" fill="#f2c230"/>
    <circle cx="48" cy="50" r="7" fill="#2b2b2b" ${O}/><circle cx="48" cy="50" r="3" fill="#f2c230"/>`),
  truck: svg(`
    <rect x="6" y="22" width="30" height="20" rx="2" fill="#c79a5c" ${O}/>
    <path d="M36 22 L50 22 L58 32 L58 44 L36 44 Z" fill="#d6342c" ${O}/><path d="M40 26 L48 26 L53 32 L40 32 Z" fill="#9fd3ff" ${O}/>
    <rect x="4" y="40" width="56" height="6" rx="2" fill="#555" ${O}/>
    <circle cx="16" cy="48" r="7" fill="#2b2b2b" ${O}/><circle cx="48" cy="48" r="7" fill="#2b2b2b" ${O}/>`),
  speed: svg(`<path d="M30 6 L14 36 H30 L24 58 L50 24 H34 L42 6 Z" fill="#7fd0ff" ${O}/>`),
  carry: svg(`<rect x="10" y="26" width="44" height="28" rx="3" fill="#c79a5c" ${O}/><path d="M10 34 H54 M32 26 V54" stroke="#3a1f0e" stroke-width="3"/><path d="M22 20 L32 8 L42 20 Z" fill="#7ee05a" ${O}/>`),
  office: svg(`<path d="M6 30 L32 10 L58 30 Z" fill="#3fbf4a" ${O}/><rect x="12" y="30" width="40" height="24" fill="#f6ecd2" ${O}/><rect x="28" y="38" width="9" height="16" fill="#3f8a4a" ${O}/><rect x="16" y="22" width="32" height="8" rx="2" fill="#c0662c" ${O}/>`),
})
Object.assign(ICONS, {
  carrot: svg(`<path d="M30 22 L44 22 L36 60 Z" fill="#f08a24" ${O}/><path d="M32 30 H40 M33 38 H39 M34 46 H38" stroke="#b85a14" stroke-width="2"/><path d="M37 22 L30 6 M37 22 L38 4 M37 22 L46 8" stroke="#4f9a3a" stroke-width="5" stroke-linecap="round"/>`),
  bike: svg(`<circle cx="16" cy="42" r="11" fill="none" ${O}/><circle cx="48" cy="42" r="11" fill="none" ${O}/><path d="M16 42 L28 24 L44 24 L48 42 M28 24 L34 42 L44 24 M24 18 H32 M44 24 L42 14 H50" fill="none" stroke="#d6322c" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="34" cy="42" r="3" fill="#3a1f0e"/>`),
  drone: svg(`<ellipse cx="32" cy="34" rx="12" ry="7" fill="#f4f1e8" ${O}/><rect x="26" y="26" width="12" height="5" rx="2" fill="#f07a24" ${O}/><path d="M22 32 L10 22 M42 32 L54 22 M22 36 L10 46 M42 36 L54 46" stroke="#3a1f0e" stroke-width="4"/><ellipse cx="10" cy="20" rx="8" ry="2.5" fill="#9aa0a6" ${O}/><ellipse cx="54" cy="20" rx="8" ry="2.5" fill="#9aa0a6" ${O}/><ellipse cx="10" cy="48" rx="8" ry="2.5" fill="#9aa0a6" ${O}/><ellipse cx="54" cy="48" rx="8" ry="2.5" fill="#9aa0a6" ${O}/>`),
  oil: svg(`<path d="M32 6 C22 22 14 32 14 42 A18 18 0 0 0 50 42 C50 32 42 22 32 6 Z" fill="#2b2b2b" ${O}/><ellipse cx="25" cy="40" rx="4" ry="7" fill="#6b6b6b"/>`),
  pump: svg(`<rect x="6" y="52" width="52" height="6" fill="#9a968c" ${O}/><path d="M26 52 L32 22 L38 52" fill="none" stroke="#f2c230" stroke-width="4"/><rect x="8" y="16" width="46" height="7" rx="2" fill="#f2c230" ${O}/><path d="M8 14 Q2 20 8 30 L12 30 L12 14 Z" fill="#c8302a" ${O}/><path d="M10 30 V52" stroke="#3a1f0e" stroke-width="2"/><circle cx="48" cy="40" r="8" fill="#c8302a" ${O}/>`),
  station: svg(`<rect x="6" y="38" width="52" height="10" fill="#b9b6ae" ${O}/><rect x="4" y="16" width="56" height="6" fill="#c8302a" ${O}/><path d="M10 22 V38 M54 22 V38" stroke="#3a1f0e" stroke-width="3"/><rect x="18" y="26" width="8" height="12" rx="2" fill="#2f4f9a" ${O}/><rect x="30" y="26" width="8" height="12" rx="2" fill="#2f4f9a" ${O}/><path d="M4 54 H60 M10 50 V58 M24 50 V58 M38 50 V58 M52 50 V58" stroke="#3a1f0e" stroke-width="3"/>`),
  cow: svg(`<rect x="10" y="22" width="40" height="22" rx="6" fill="#f6f3ec" ${O}/><path d="M18 24 Q24 30 20 38 L14 36 Z M36 28 Q42 34 38 42 L32 40 Z" fill="#262422"/><rect x="40" y="14" width="18" height="18" rx="5" fill="#f6f3ec" ${O}/><rect x="44" y="26" width="14" height="8" rx="3" fill="#f2b8b0" ${O}/><path d="M14 44 V56 M24 44 V56 M36 44 V56 M46 44 V56" stroke="#3a1f0e" stroke-width="4"/>`),
  pig: svg(`<ellipse cx="30" cy="36" rx="22" ry="15" fill="#f4a6b4" ${O}/><circle cx="48" cy="32" r="10" fill="#f4a6b4" ${O}/><ellipse cx="55" cy="34" rx="5" ry="4" fill="#e98a9c" ${O}/><path d="M42 22 L46 16 L50 23" fill="#e98a9c" ${O}/><path d="M18 48 V56 M38 48 V56" stroke="#3a1f0e" stroke-width="4"/><path d="M8 32 Q2 28 6 24" fill="none" stroke="#3a1f0e" stroke-width="3"/>`),
  horse: svg(`<rect x="10" y="26" width="32" height="16" rx="5" fill="#8a5a32" ${O}/><path d="M38 28 L46 8 L58 14 L54 22 L46 22 L44 32 Z" fill="#8a5a32" ${O}/><path d="M42 10 L36 26" stroke="#2a1a10" stroke-width="5"/><path d="M14 42 V58 M22 42 V58 M32 42 V58 M40 42 V58" stroke="#3a1f0e" stroke-width="4"/><path d="M10 28 Q2 36 6 46" fill="none" stroke="#2a1a10" stroke-width="5"/>`),
  duck: svg(`<ellipse cx="28" cy="40" rx="18" ry="12" fill="#f7f4ec" ${O}/><circle cx="44" cy="22" r="9" fill="#2f7a3a" ${O}/><path d="M52 22 L60 24 L52 27 Z" fill="#f2a02a" ${O}/><path d="M24 52 V58 M32 52 V58" stroke="#f2a02a" stroke-width="4"/>`),
  dealer: svg(`<rect x="6" y="20" width="52" height="34" fill="#e8e4da" ${O}/><rect x="4" y="14" width="56" height="8" fill="#2f6fd0" ${O}/><rect x="12" y="28" width="40" height="20" fill="#9fd8ff" ${O}/><path d="M24 28 V48 M40 28 V48" stroke="#3a1f0e" stroke-width="2"/>`),
  market: svg(`<rect x="8" y="26" width="48" height="30" fill="#b8573a" ${O}/><path d="M4 26 L10 14 H54 L60 26 Z" fill="#2f8a57" ${O}/><path d="M16 14 L14 26 M28 14 L27 26 M40 14 L41 26 M52 14 L54 26" stroke="#f5efd6" stroke-width="3"/><rect x="16" y="36" width="12" height="20" fill="#3a2418" ${O}/><circle cx="42" cy="42" r="5" fill="#f08a24" ${O}/>`),
  milk: svg(`<path d="M24 16 H40 V24 L46 32 V56 H18 V32 L24 24 Z" fill="#ffffff" ${O}/><rect x="24" y="8" width="16" height="8" fill="#2f6fd0" ${O}/><rect x="18" y="36" width="28" height="10" fill="#7fd0ff"/>`),
  truffle: svg(`<path d="M14 40 Q10 22 30 18 Q50 16 52 34 Q54 50 34 52 Q16 54 14 40 Z" fill="#5a3a24" ${O}/><circle cx="26" cy="32" r="2" fill="#8a6a48"/><circle cx="38" cy="28" r="2" fill="#8a6a48"/><circle cx="34" cy="42" r="2" fill="#8a6a48"/>`),
  duckEgg: svg(`<ellipse cx="32" cy="34" rx="16" ry="21" fill="#cfe6d8" ${O}/><ellipse cx="26" cy="26" rx="4" ry="6" fill="#ffffff" opacity="0.7"/>`),
  build: svg(`<path d="M10 54 H54" stroke="#3a1f0e" stroke-width="4"/><rect x="14" y="30" width="36" height="24" fill="#f2c230" ${O}/><path d="M10 32 L32 12 L54 32 Z" fill="#d6322c" ${O}/><rect x="28" y="40" width="9" height="14" fill="#7b4a26" ${O}/>`),
})
ICONS.flower = svg(`<path d="M32 36 V56" stroke="#2f8a3a" stroke-width="4"/><circle cx="32" cy="22" r="7" fill="#f2c230" ${O}/><circle cx="32" cy="10" r="6" fill="#f06aa0" ${O}/><circle cx="43" cy="18" r="6" fill="#f06aa0" ${O}/><circle cx="43" cy="30" r="6" fill="#f06aa0" ${O}/><circle cx="21" cy="30" r="6" fill="#f06aa0" ${O}/><circle cx="21" cy="18" r="6" fill="#f06aa0" ${O}/><circle cx="32" cy="22" r="6" fill="#f2c230" ${O}/><path d="M32 46 Q22 40 18 46 Q24 52 32 46 Z" fill="#3fae4a" ${O}/>`)
ICONS.rancher = worker('#8a5a3a', STRAW, `<rect x="20" y="30" width="6" height="14" rx="2" fill="#ffffff" ${O}/><rect x="38" y="30" width="6" height="14" rx="2" fill="#ffffff" ${O}/>`)
ICONS.oiler = worker('#f2a03a', CAP('#f2c230'), `<ellipse cx="32" cy="38" rx="8" ry="10" fill="#2b2b2b" ${O}/>`)
ICONS.driver = ICONS.truck
ICONS.egg = ICONS.eggs
export const SEED_ICONS = { wheat: ICONS.wheat, corn: ICONS.corn, carrot: ICONS.carrot, sunflower: ICONS.sunflower, potato: ICONS.potato, pumpkin: ICONS.pumpkin }
// The goods the farm sells (GAME.goods ids).
export const GOOD_ICONS = { egg: ICONS.eggs, wheat: ICONS.wheat, corn: ICONS.corn, carrot: ICONS.carrot, sunflower: ICONS.sunflower, pumpkin: ICONS.pumpkin, duckEgg: ICONS.duckEgg, milk: ICONS.milk, truffle: ICONS.truffle }
