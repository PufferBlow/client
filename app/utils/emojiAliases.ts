/**
 * Emoji alias map — `:name:` → unicode emoji.
 *
 * Curated list (~150 entries) covering the most-typed emoji shortcodes.
 * Not exhaustive — installing `emoji-mart` or `node-emoji` would give
 * us the full 1800+ alias table, but at ~200KB of asset weight that's
 * overkill for the autocomplete affordance. If a user actually wants
 * an obscure emoji they can pull it from the emoji picker.
 *
 * Keys are lowercase, no surrounding colons. Multiple aliases can map
 * to the same emoji (e.g. `joy` and `tears_of_joy` both → 😂).
 *
 * Used by:
 *  - The composer's `:name:` autocomplete popover (DashboardPage)
 *  - Whoever wants to render `:name:` substitutions in message bodies
 *    later on (not wired today, but the data is here when needed).
 */

export const EMOJI_ALIASES: Record<string, string> = {
  // Smileys
  smile: "😄",
  grin: "😁",
  grinning: "😀",
  laughing: "😆",
  satisfied: "😆",
  sweat_smile: "😅",
  joy: "😂",
  tears_of_joy: "😂",
  rofl: "🤣",
  rolling_on_the_floor_laughing: "🤣",
  blush: "😊",
  innocent: "😇",
  slightly_smiling: "🙂",
  upside_down: "🙃",
  wink: "😉",
  relieved: "😌",
  heart_eyes: "😍",
  smiling_face_with_hearts: "🥰",
  kissing_heart: "😘",
  kissing: "😗",
  yum: "😋",
  stuck_out_tongue: "😛",
  zany: "🤪",
  raised_eyebrow: "🤨",
  monocle: "🧐",
  nerd: "🤓",
  sunglasses: "😎",
  star_struck: "🤩",
  partying: "🥳",
  smirk: "😏",
  unamused: "😒",
  disappointed: "😞",
  pensive: "😔",
  worried: "😟",
  cry: "😢",
  sob: "😭",
  rage: "😡",
  angry: "😠",
  triumph: "😤",
  fearful: "😨",
  cold_sweat: "😰",
  flushed: "😳",
  exploding_head: "🤯",
  hot: "🥵",
  cold: "🥶",
  scream: "😱",
  hugs: "🤗",
  thinking: "🤔",
  shushing: "🤫",
  zipper_mouth: "🤐",
  neutral: "😐",
  expressionless: "😑",
  no_mouth: "😶",
  rolling_eyes: "🙄",
  hushed: "😯",
  open_mouth: "😮",
  yawning: "🥱",
  sleeping: "😴",
  drooling: "🤤",
  woozy: "🥴",
  sick: "🤢",
  vomit: "🤮",
  sneeze: "🤧",
  mask: "😷",
  thermometer_face: "🤒",
  bandage_face: "🤕",
  money_mouth: "🤑",
  cowboy: "🤠",
  smiling_imp: "😈",
  imp: "👿",
  clown: "🤡",
  poop: "💩",
  hankey: "💩",
  ghost: "👻",
  skull: "💀",
  alien: "👽",
  robot: "🤖",

  // Gestures
  thumbsup: "👍",
  "+1": "👍",
  thumbsdown: "👎",
  "-1": "👎",
  ok_hand: "👌",
  pinched_fingers: "🤌",
  v: "✌️",
  crossed_fingers: "🤞",
  love_you: "🤟",
  metal: "🤘",
  call_me: "🤙",
  point_left: "👈",
  point_right: "👉",
  point_up: "☝️",
  point_down: "👇",
  middle_finger: "🖕",
  wave: "👋",
  raised_hand: "✋",
  clap: "👏",
  raised_hands: "🙌",
  pray: "🙏",
  muscle: "💪",
  handshake: "🤝",

  // Hearts
  heart: "❤️",
  orange_heart: "🧡",
  yellow_heart: "💛",
  green_heart: "💚",
  blue_heart: "💙",
  purple_heart: "💜",
  black_heart: "🖤",
  white_heart: "🤍",
  brown_heart: "🤎",
  broken_heart: "💔",
  sparkling_heart: "💖",
  cupid: "💘",

  // Common reactions / objects
  fire: "🔥",
  star: "⭐",
  star2: "🌟",
  sparkles: "✨",
  boom: "💥",
  zap: "⚡",
  rainbow: "🌈",
  sun: "☀️",
  moon: "🌙",
  earth: "🌍",
  rocket: "🚀",
  tada: "🎉",
  confetti: "🎊",
  gift: "🎁",
  balloon: "🎈",
  party: "🎉",
  cake: "🎂",
  pizza: "🍕",
  coffee: "☕",
  beer: "🍺",
  wine: "🍷",

  // Animals
  dog: "🐶",
  cat: "🐱",
  mouse: "🐭",
  hamster: "🐹",
  rabbit: "🐰",
  fox: "🦊",
  bear: "🐻",
  panda: "🐼",
  tiger: "🐯",
  lion: "🦁",
  cow: "🐮",
  pig: "🐷",
  frog: "🐸",
  monkey: "🐵",
  unicorn: "🦄",

  // Symbols
  check: "✅",
  checkmark: "✅",
  white_check_mark: "✅",
  x: "❌",
  cross: "❌",
  warning: "⚠️",
  no_entry: "⛔",
  question: "❓",
  exclamation: "❗",
  bell: "🔔",
  mute: "🔕",
  loudspeaker: "📢",
  mega: "📣",
  hourglass: "⏳",
  clock: "🕐",
  calendar: "📅",
  pushpin: "📌",
  link: "🔗",
  paperclip: "📎",
  wrench: "🔧",
  hammer: "🔨",
  key: "🔑",
  lock: "🔒",
  unlock: "🔓",
  bookmark: "🔖",

  // Activities
  computer: "💻",
  keyboard: "⌨️",
  phone: "📱",
  camera: "📷",
  headphones: "🎧",
  microphone: "🎤",
  game: "🎮",
  controller: "🎮",
  soccer: "⚽",
  basketball: "🏀",
  football: "🏈",

  // Misc-popular
  eyes: "👀",
  brain: "🧠",
  raised_eyebrows: "🤨",
  thinking_face: "🤔",
  okay: "👌",
  shrug: "🤷",
  facepalm: "🤦",
  bow: "🙇",
  handsome: "😎",
  cool: "😎",
  hundred: "💯",
  hundred_points: "💯",
};

// ── Pre-computed lookup structures ─────────────────────────────────
//
// These are built ONCE at module init so the composer's per-keystroke
// autocomplete doesn't repeatedly call Object.entries() + filter +
// sort on every character the user types. With ~150 entries the per-
// call cost was small in isolation but compounded with the rest of
// the keystroke pipeline (full DashboardPage re-render, draft-persist
// scheduling, textarea resize) it added measurable latency.
//
// `EMOJI_ALIASES_SORTED` is the full alias list, sorted alphabetically.
// Used as the "browse" list when the user types just `:` (empty query).
//
// `EMOJI_ALIASES_BY_PREFIX` buckets entries by their first character so
// a prefixed query like `:smi` skips straight to the `s` bucket and
// scans ~15 entries instead of the full 150. Each bucket is itself
// sorted, so result order matches the all-sorted case.

export interface EmojiAliasEntry {
  alias: string;
  emoji: string;
}

const ALL_ENTRIES: EmojiAliasEntry[] = Object.entries(EMOJI_ALIASES)
  .map(([alias, emoji]) => ({ alias, emoji }))
  .sort((a, b) => a.alias.localeCompare(b.alias));

export const EMOJI_ALIASES_SORTED: EmojiAliasEntry[] = ALL_ENTRIES;

export const EMOJI_ALIASES_BY_PREFIX: Map<string, EmojiAliasEntry[]> = (() => {
  const map = new Map<string, EmojiAliasEntry[]>();
  for (const entry of ALL_ENTRIES) {
    const key = entry.alias.charAt(0);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    bucket.push(entry);
  }
  return map;
})();

/**
 * Find up to `limit` alias entries whose alias starts with the query.
 * Empty query returns the head of the all-sorted list as a browse
 * affordance. Lookup is O(1) on the bucket + at most a linear scan
 * within that bucket; no sort happens at call time.
 */
export function findEmojiAliasMatches(
  query: string,
  limit: number = 8,
): EmojiAliasEntry[] {
  const lowered = query.toLowerCase();
  if (!lowered) {
    return EMOJI_ALIASES_SORTED.slice(0, limit);
  }
  const bucket = EMOJI_ALIASES_BY_PREFIX.get(lowered.charAt(0));
  if (!bucket) return [];
  const out: EmojiAliasEntry[] = [];
  for (const entry of bucket) {
    if (entry.alias.startsWith(lowered)) {
      out.push(entry);
      if (out.length >= limit) break;
    }
  }
  return out;
}
