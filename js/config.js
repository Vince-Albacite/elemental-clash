const HAND_SIZE = 10;
const THROW_COOLDOWN_MS = 500;
const DRAW_COOLDOWN_MS = 100;
const TIE_WINDOW_MS = 40;
const SWIPE_THROW_PX = 60;
const WEAKNESS_BONUS_MULTIPLIER = 0.5;
const BOOST_POINTS = 1;
const PARTICLE_MARGIN_PX = 14;
const PARTICLE_SPREAD_PX = 50;
/* Bot roster. icon = {colorIndex, eyesIndex, mouthIndex} indexes from icons.js. actDelayMs = [fastest, slowest] wait between two actions.
   reactionMs = [fastest, slowest] wait after any card is thrown before the bot may act (optional, default BOT_DEFAULT_REACTION_MS).
   mistakeChance 0..1 = chance it throws a random legal card instead of its pick (optional, default BOT_DEFAULT_MISTAKE_CHANCE).
   randomness 0..1 = how often the bot ignores its best card. Risk throw (hand full, no card counters the last element):
   riskTolerance 0..1 = chance it gambles, riskMinNumber 1..9 = smallest number it counts as a big card to gamble with.
   Add or edit entries freely; names max 12 characters. */
const BOT_PROFILES = [
  {
    name: "Blaze",
    personality: "aggressive",
    icon: { colorIndex: 1, eyesIndex: 5, mouthIndex: 4 },
    actDelayMs: [600, 1200],
    randomness: 0.2,
    riskTolerance: 0.9,
    riskMinNumber: 5,
    reactionMs: [300, 600],
    mistakeChance: 0.12,
  },
  {
    name: "Zen",
    personality: "calm",
    icon: { colorIndex: 8, eyesIndex: 2, mouthIndex: 0 },
    actDelayMs: [1400, 2400],
    randomness: 0.1,
    riskTolerance: 0.2,
    riskMinNumber: 8,
    reactionMs: [700, 1200],
    mistakeChance: 0.04,
  },
  {
    name: "Dizzy",
    personality: "chaotic",
    icon: { colorIndex: 4, eyesIndex: 6, mouthIndex: 7 },
    actDelayMs: [500, 2200],
    randomness: 1,
    riskTolerance: 0.6,
    riskMinNumber: 3,
    reactionMs: [200, 1100],
    mistakeChance: 0.25,
  },
  {
    name: "Sage",
    personality: "tactical",
    icon: { colorIndex: 3, eyesIndex: 3, mouthIndex: 3 },
    actDelayMs: [1000, 1600],
    randomness: 0,
    riskTolerance: 0.4,
    riskMinNumber: 7,
    reactionMs: [500, 800],
    mistakeChance: 0.03,
  },
  {
    name: "Spark",
    personality: "speedy",
    icon: { colorIndex: 0, eyesIndex: 4, mouthIndex: 5 },
    actDelayMs: [400, 900],
    randomness: 0.5,
    riskTolerance: 0.7,
    riskMinNumber: 5,
    reactionMs: [200, 450],
    mistakeChance: 0.15,
  },
  {
    name: "Frost",
    personality: "cool",
    icon: { colorIndex: 2, eyesIndex: 7, mouthIndex: 1 },
    actDelayMs: [1100, 1800],
    randomness: 0.15,
    riskTolerance: 0.3,
    riskMinNumber: 7,
    reactionMs: [550, 900],
    mistakeChance: 0.05,
  },
  {
    name: "Rocky",
    personality: "steady",
    icon: { colorIndex: 5, eyesIndex: 0, mouthIndex: 6 },
    actDelayMs: [1000, 2000],
    randomness: 0.3,
    riskTolerance: 0.5,
    riskMinNumber: 6,
    reactionMs: [500, 950],
    mistakeChance: 0.08,
  },
  {
    name: "Rosie",
    personality: "playful",
    icon: { colorIndex: 6, eyesIndex: 8, mouthIndex: 8 },
    actDelayMs: [700, 1700],
    randomness: 0.8,
    riskTolerance: 0.8,
    riskMinNumber: 4,
    reactionMs: [350, 850],
    mistakeChance: 0.2,
  },
  {
    name: "Gojo",
    personality: "cocky",
    icon: { colorIndex: 9, eyesIndex: 2, mouthIndex: 4 },
    actDelayMs: [100,100],
    randomness: 10,
    riskTolerance: 10,
    riskMinNumber: 10,
    reactionMs: [0, 0],
    mistakeChance: 1,
  },
];
const ELEMENT_NAMES = ["red", "green", "blue", "brown"];
const ELEMENT_COUNT = ELEMENT_NAMES.length;
/* DEV TABLE: key = element, value = the element it is weak to (the element that beats it). Rewire freely. */
const WEAKNESS_OF_BY_NAME = {
  red: "blue",
  blue: "brown",
  brown: "green",
  green: "red",
};
const WEAKNESS_OF = ELEMENT_NAMES.map(function (name) {
  return ELEMENT_NAMES.indexOf(WEAKNESS_OF_BY_NAME[name]);
});
const STEP_SECONDS = 0.25;
const STEPS_PER_BAR = 16;
const CARD_NUMBER_MAX = 9;
const MENU_TRACK_INDEX =
  ELEMENT_COUNT; /* music track used by menu, lobby and results */
const NOTICE_MS = 3500;
/* READY 3 2 1 GO: at = start offset in ms. The three numbers last 1 s each (3 second count). */
const COUNTDOWN_STAGES = [
  { text: "READY", at: 0 },
  { text: "3", at: 750 },
  { text: "2", at: 1750 },
  { text: "1", at: 2750 },
  { text: "GO", at: 3750 },
];
const COUNTDOWN_TOTAL_MS = 4350;
/* Element colors by name [bright, gradient end]. Reordering ELEMENT_NAMES keeps every color and music track attached to its element. */
const ELEMENT_COLORS_BY_NAME = {
  red: ["#ff2a3a", "#ff9a3c"],
  green: ["#19e65a", "#b6ff3c"],
  blue: ["#2a7bff", "#35e0ff"],
  brown: ["#b5651d", "#e8b27a"],
};
const ELEMENT_COLORS = ELEMENT_NAMES.map(function (elementName) {
  return ELEMENT_COLORS_BY_NAME[elementName];
});
/* Wild draw: a thrown 0 card is assigned a random value min..max as its points (enabled false = it scores 0). */
const ZERO_WILD_VALUE = { enabled: true, min: 0, max: CARD_NUMBER_MAX };
/* Advantage stack: each consecutive advantage draw by the same player adds BOOST to the multiplier (1st = x1, 2nd = x2 ...), capped at MAX. */
const ADVANTAGE_STACK_BOOST = 2;
const ADVANTAGE_STACK_MAX = 4.5;
/* How the How to Play diagram orders its elements around the circle: 'weakness' = key order of WEAKNESS_OF_BY_NAME, 'elements' = order of ELEMENT_NAMES. */
const GUIDE_LAYOUT_SOURCE = "weakness";
/* The hand is shown as two rows: a front row (throwable) and a back row, each holding up to HAND_STACK_SIZE cards. */
const HAND_STACK_SIZE = 5;
const SWIPE_DOWN_PREVIEW_PX = 40;
/* Performance limits (multiplayer lag fix). */
const MAX_ACTIVE_TRACKS = 2; /* music tracks scheduled at the same time during a crossfade */
const MUSIC_SWITCH_MIN_MS = 2500; /* shortest time between music track changes */
const MAX_PARTICLES = 40; /* particle elements alive at once */
const EFFECT_MIN_GAP_MS = 120; /* shortest time between full sound and particle bursts */
const SNAPSHOT_COALESCE_MS = 80; /* bot draws are merged into one snapshot per this window */
const MAX_BUFFERED_BYTES = 8192; /* slow link: stale snapshots are skipped above this send backlog */
/* Fading hints shown during a match. */
const HINT_VISIBLE_MS = 2800;
const HINT_TEXTS = {
  outOfCards: "Out of cards. Tap the Deck to draw more.",
  backRow: "Back row cards cannot be thrown. Swipe down to bring them forward.",
};

/* Bot friction. BOT_PACE_MULTIPLIER scales every bot wait (reaction and action): 1 = unchanged, 1.5 = 50% slower, 0.5 = twice as fast. */
const BOT_PACE_MULTIPLIER = 1;
const BOT_DEFAULT_REACTION_MS = [250, 600];
const BOT_DEFAULT_MISTAKE_CHANCE = 0.1;
/* Telegraph: a distinct note (one pitch per player seat) that plays before a throw so the others can anticipate it. */
const BOT_TELEGRAPH_MS = 350;               /* a bot announces its move this long before it throws */
const HUMAN_WINDUP_TELEGRAPH = true;        /* a human swipe that passes the throw distance announces itself before release */
const TELEGRAPH_ON_DECK_DRAW = false;       /* also announce bot deck draws */
const TELEGRAPH_MIN_GAP_MS = 300;           /* shortest gap between two announcements of the same player */
const TELEGRAPH_NOTE_SEMITONES = [0, 3, 7, 10];
const TELEGRAPH_BASE_FREQUENCY = 659;
