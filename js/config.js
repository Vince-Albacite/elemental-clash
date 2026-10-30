const HAND_SIZE = 10;
const THROW_COOLDOWN_MS = 500;
const DRAW_COOLDOWN_MS = 800;
const TIE_WINDOW_MS = 40;
const SWIPE_THROW_PX = 60;
const WEAKNESS_BONUS_MULTIPLIER = 0.2;
const BOOST_POINTS = 1;
const PARTICLE_MARGIN_PX = 14;
const PARTICLE_SPREAD_PX = 50;
/* Bot roster. icon = {c color, e eyes, m mouth} indexes from icons.js. actDelayMs = [fastest, slowest] reaction time.
   randomness 0..1 = how often the bot ignores its best card. Risk throw (hand full, no card counters the last element):
   riskTolerance 0..1 = chance it gambles, riskMinNumber 1..9 = smallest number it counts as a big card to gamble with.
   Add or edit entries freely; names max 12 characters. */
const BOT_PROFILES = [
  { name: 'Blaze', personality: 'aggressive', icon: { c: 1, e: 5, m: 4 }, actDelayMs: [600, 1200], randomness: 0.2, riskTolerance: 0.9, riskMinNumber: 5 },
  { name: 'Zen', personality: 'calm', icon: { c: 8, e: 2, m: 0 }, actDelayMs: [1400, 2400], randomness: 0.1, riskTolerance: 0.2, riskMinNumber: 8 },
  { name: 'Dizzy', personality: 'chaotic', icon: { c: 4, e: 6, m: 7 }, actDelayMs: [500, 2200], randomness: 1, riskTolerance: 0.6, riskMinNumber: 3 },
  { name: 'Sage', personality: 'tactical', icon: { c: 3, e: 3, m: 3 }, actDelayMs: [1000, 1600], randomness: 0, riskTolerance: 0.4, riskMinNumber: 7 },
  { name: 'Spark', personality: 'speedy', icon: { c: 0, e: 4, m: 5 }, actDelayMs: [400, 900], randomness: 0.5, riskTolerance: 0.7, riskMinNumber: 5 },
  { name: 'Frost', personality: 'cool', icon: { c: 2, e: 7, m: 1 }, actDelayMs: [1100, 1800], randomness: 0.15, riskTolerance: 0.3, riskMinNumber: 7 },
  { name: 'Rocky', personality: 'steady', icon: { c: 5, e: 0, m: 6 }, actDelayMs: [1000, 2000], randomness: 0.3, riskTolerance: 0.5, riskMinNumber: 6 },
  { name: 'Rosie', personality: 'playful', icon: { c: 6, e: 8, m: 8 }, actDelayMs: [700, 1700], randomness: 0.8, riskTolerance: 0.8, riskMinNumber: 4 }];
const ELEMENT_NAMES = ['red', 'green', 'blue', 'brown'];
const ELEMENT_COUNT = ELEMENT_NAMES.length;
/* DEV TABLE: key = element, value = the element it is weak to (the element that beats it). Rewire freely. */
const WEAKNESS_OF_BY_NAME = { red: 'blue', blue: 'brown', brown: 'green', green: 'red' };
const WEAKNESS_OF = ELEMENT_NAMES.map(function (name) { return ELEMENT_NAMES.indexOf(WEAKNESS_OF_BY_NAME[name]); });
const STEP_SECONDS = 0.25;
const STEPS_PER_BAR = 16;
const CARD_NUMBER_MAX = 9;
const MENU_TRACK_INDEX = ELEMENT_COUNT; /* music track used by menu, lobby and results */
const NOTICE_MS = 3500;
/* READY 3 2 1 GO: at = start offset in ms. The three numbers last 1 s each (3 second count). */
const COUNTDOWN_STAGES = [{ text: 'READY', at: 0 }, { text: '3', at: 750 }, { text: '2', at: 1750 }, { text: '1', at: 2750 }, { text: 'GO', at: 3750 }];
const COUNTDOWN_TOTAL_MS = 4350;
/* Element colors by name [bright, gradient end]. Reordering ELEMENT_NAMES keeps every color and music track attached to its element. */
const ELEMENT_COLORS_BY_NAME = { red: ['#ff2a3a', '#ff9a3c'], green: ['#19e65a', '#b6ff3c'], blue: ['#2a7bff', '#35e0ff'], brown: ['#b5651d', '#e8b27a'] };
const ELEMENT_COLORS = ELEMENT_NAMES.map(function (n) { return ELEMENT_COLORS_BY_NAME[n]; });
/* Wild draw: a thrown 0 card is assigned a random value min..max as its points (enabled false = it scores 0). */
const ZERO_WILD_VALUE = { enabled: true, min: 0, max: CARD_NUMBER_MAX };
/* Advantage stack: each consecutive advantage draw by the same player adds BOOST to the multiplier (1st = x1, 2nd = x2 ...), capped at MAX. */
const ADVANTAGE_STACK_BOOST = 1;
const ADVANTAGE_STACK_MAX = 5;
/* How the How to Play diagram orders its elements around the circle: 'weakness' = key order of WEAKNESS_OF_BY_NAME, 'elements' = order of ELEMENT_NAMES. */
const GUIDE_LAYOUT_SOURCE = 'weakness';
/* The hand is shown as two rows: a front row (throwable) and a back row, each holding up to HAND_STACK_SIZE cards. */
const HAND_STACK_SIZE = 5;
const SWIPE_DOWN_PREVIEW_PX = 40;
