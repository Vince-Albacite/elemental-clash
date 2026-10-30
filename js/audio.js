let audioCtx = null, masterGain = null, musicGain = null, sfxGain = null, noiseBuffer = null;
let trackGains = [], distBuses = [], trackLevels = [], trackTargets = [], stepIndex = 0, nextStepTime = 0;
const volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
const R = -1; /* rest */
const SFX_BY_NAME = { red: [440, 220, 'sawtooth', 0.15], green: [330, 495, 'triangle', 0.2], blue: [660, 880, 'sine', 0.25], brown: [110, 70, 'square', 0.2] };
const ELEMENT_SFX = ELEMENT_NAMES.map(function (n) { return SFX_BY_NAME[n]; });
/* Five loops, all 16 steps x 0.25 s = one 4 second bar (8th notes at 120 BPM), key A minor pentatonic.
   Tracks 0-3 follow the element order, the last track (MENU_TRACK_INDEX) is the menu and lobby theme.
   Layer pattern values are semitones above layer.base, R = rest, len = note length in steps. */
const TRACK_DEFS = {
  red: { dist: true, layers: [
    { voice: 'guitar', base: 220, vol: 0.09, len: 2, dist: true, pattern: [0, R, 3, R, 5, R, 7, 5, 3, R, 0, R, 10, R, 7, 3] },
    { voice: 'chug', base: 110, vol: 0.1, len: 1, dist: true, pattern: [0, 0, R, 0, 0, R, 3, R, 0, 0, R, 0, 5, R, 3, R] },
    { voice: 'bass', base: 55, vol: 0.16, len: 1, wave: 'sawtooth', pattern: [0, R, R, R, 0, R, R, R, 3, R, R, R, 5, R, 3, R] }] },
  green: { layers: [
    { voice: 'flute', base: 440, vol: 0.12, len: 3, pattern: [0, R, R, 3, R, R, 7, R, 5, R, R, 3, R, R, 0, R] },
    { voice: 'pluck', base: 220, vol: 0.07, len: 1, pattern: [0, 7, 12, 7, 0, 7, 12, 7, 3, 10, 15, 10, 3, 10, 15, 10] },
    { voice: 'pad', base: 110, vol: 0.06, len: 8, pattern: [0, R, R, R, R, R, R, R, 5, R, R, R, R, R, R, R] }] },
  blue: { layers: [
    { voice: 'vibraphone', base: 440, vol: 0.12, len: 2, pattern: [0, R, 3, R, 7, R, 5, R, 3, R, 7, 10, 12, R, 10, 7] },
    { voice: 'pad', base: 110, vol: 0.08, len: 8, pattern: [0, R, R, R, R, R, R, R, 7, R, R, R, R, R, R, R] },
    { voice: 'bass', base: 55, vol: 0.14, len: 1, wave: 'triangle', pattern: [0, R, R, 0, R, R, 0, R, 5, R, R, 5, R, R, 3, R] }] },
  brown: { layers: [
    { voice: 'drums', vol: 0.2, kick: [0, 4, 8, 11, 12], snare: [2, 6, 10, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [7, 15] },
    { voice: 'bass', base: 55, vol: 0.14, len: 1, wave: 'sawtooth', pattern: [0, R, 0, R, 3, R, 0, R, 5, R, 5, R, 3, R, 0, R] },
    { voice: 'stab', base: 220, vol: 0.07, len: 1, pattern: [R, R, R, 0, R, R, R, 0, R, R, 0, R, R, R, 5, R] }] },
  menu: { layers: [
    { voice: 'pluck', base: 440, vol: 0.06, len: 1, pattern: [0, 7, 12, 7, 3, 10, 12, 10, 5, 12, 15, 12, 3, 10, 12, 10] },
    { voice: 'pad', base: 110, vol: 0.07, len: 8, pattern: [0, R, R, R, R, R, R, R, 5, R, R, R, R, R, R, R] },
    { voice: 'bass', base: 55, vol: 0.14, len: 4, wave: 'triangle', pattern: [0, R, R, R, R, R, R, R, 5, R, R, R, 3, R, R, R] },
    { voice: 'drums', vol: 0.12, kick: [0, 8], snare: [], hat: [2, 6, 10, 14], open: [] }] } };
/* Element tracks follow the order of ELEMENT_NAMES, the menu theme is always last. */
const TRACKS = ELEMENT_NAMES.map(function (n) { return TRACK_DEFS[n]; }).concat([TRACK_DEFS.menu]);
function semitoneToFrequency(base, semitones) { return base * Math.pow(2, semitones / 12); }
function playToneAt(destination, when, freq, endFreq, seconds, wave, volume) {
  const osc = audioCtx.createOscillator(), env = audioCtx.createGain();
  osc.type = wave; osc.frequency.setValueAtTime(freq, when);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, when + seconds);
  env.gain.setValueAtTime(volume, when); env.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  osc.connect(env); env.connect(destination); osc.start(when); osc.stop(when + seconds + 0.02);
}
function makeOsc(type, freq, when) { const o = audioCtx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, when); return o; }
function makeEnv(when, peak, attack, total) {
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack); g.gain.exponentialRampToValueAtTime(0.001, when + total); return g;
}
function runVoice(oscs, env, destination, when, total) {
  oscs.forEach(function (o) { o.connect(env); o.start(when); o.stop(when + total + 0.05); });
  env.connect(destination);
}
function playNoiseBurst(destination, when, seconds, filterType, filterFreq, volume) {
  const src = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = noiseBuffer; filter.type = filterType; filter.frequency.value = filterFreq;
  g.gain.setValueAtTime(volume, when); g.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  src.connect(filter); filter.connect(g); g.connect(destination); src.start(when); src.stop(when + seconds + 0.02);
}
function scoopOsc(type, freq, when) { const o = makeOsc(type, freq * 0.94, when); o.frequency.exponentialRampToValueAtTime(freq, when + 0.05); return o; }
/* Electric guitar: two scooped saws (root + fifth) into the distortion bus. */
function voiceGuitar(dest, when, freq, vol, dur) {
  runVoice([scoopOsc('sawtooth', freq, when), scoopOsc('sawtooth', freq * 1.5, when)], makeEnv(when, vol, 0.005, dur + 0.3), dest, when, dur + 0.3);
}
function voiceChug(dest, when, freq, vol) {
  runVoice([makeOsc('sawtooth', freq, when), makeOsc('sawtooth', freq * 1.5, when)], makeEnv(when, vol, 0.004, 0.12), dest, when, 0.12);
}
function voiceBass(dest, when, freq, vol, dur, wave) {
  const total = Math.max(0.25, dur);
  runVoice([makeOsc(wave || 'sawtooth', freq, when)], makeEnv(when, vol, 0.005, total), dest, when, total);
}
function voiceStab(dest, when, freq, vol) {
  runVoice([makeOsc('sawtooth', freq, when), makeOsc('sawtooth', freq * 1.5, when)], makeEnv(when, vol, 0.004, 0.16), dest, when, 0.16);
}
/* Flute: sine with delayed-feel vibrato (LFO on detune) and a breath noise puff. */
function voiceFlute(dest, when, freq, vol, dur) {
  const osc = makeOsc('sine', freq, when), lfo = makeOsc('sine', 5.2, when), depth = audioCtx.createGain(), total = dur + 0.15;
  depth.gain.value = 12; lfo.connect(depth); depth.connect(osc.detune); lfo.start(when); lfo.stop(when + total + 0.05);
  runVoice([osc], makeEnv(when, vol, 0.09, total), dest, when, total);
  playNoiseBurst(dest, when, 0.08, 'bandpass', freq * 2, vol * 0.5);
}
function voicePluck(dest, when, freq, vol) {
  runVoice([makeOsc('triangle', freq, when), makeOsc('sine', freq * 2, when)], makeEnv(when, vol, 0.005, 0.55), dest, when, 0.55);
}
function voicePad(dest, when, freq, vol, dur) {
  runVoice([makeOsc('sine', freq, when), makeOsc('sine', freq * 1.004, when), makeOsc('sine', freq * 1.5, when)], makeEnv(when, vol, 0.5, dur), dest, when, dur);
}
/* Vibraphone (pop): soft mallet attack, metal-bar partials 1 : 4 : 10, long decay and a 5.5 Hz motor tremolo. */
function voiceVibraphone(dest, when, freq, vol, dur) {
  const total = dur + 0.6, env = makeEnv(when, vol, 0.004, total), trem = audioCtx.createGain();
  const lfo = makeOsc('sine', 5.5, when), depth = audioCtx.createGain();
  trem.gain.value = 0.75; depth.gain.value = 0.25; lfo.connect(depth); depth.connect(trem.gain); lfo.start(when); lfo.stop(when + total + 0.05);
  [[1, 1], [4, 0.28], [10, 0.08]].forEach(function (p) {
    const o = makeOsc('sine', freq * p[0], when), g = audioCtx.createGain();
    g.gain.value = p[1]; o.connect(g); g.connect(trem); o.start(when); o.stop(when + total + 0.05);
  });
  trem.connect(env); env.connect(dest);
}
function voiceBell(dest, when, freq, vol) {
  runVoice([makeOsc('sine', freq, when), makeOsc('sine', freq * 2.76, when)], makeEnv(when, vol, 0.003, 1.4), dest, when, 1.4);
}
function voiceKick(dest, when, vol) {
  const o = makeOsc('sine', 150, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  runVoice([o], makeEnv(when, vol, 0.002, 0.28), dest, when, 0.28);
}
function voiceSnare(dest, when, vol) {
  playNoiseBurst(dest, when, 0.16, 'bandpass', 1800, vol);
  runVoice([makeOsc('triangle', 190, when)], makeEnv(when, vol * 0.6, 0.002, 0.1), dest, when, 0.1);
}
function voiceHat(dest, when, vol, seconds) { playNoiseBurst(dest, when, seconds, 'highpass', 7000, vol); }
const VOICES = { guitar: voiceGuitar, chug: voiceChug, bass: voiceBass, stab: voiceStab, flute: voiceFlute, pluck: voicePluck,
  pad: voicePad, vibraphone: voiceVibraphone, bell: voiceBell };
function scheduleDrumStep(layer, dest, when) {
  const v = layer.vol;
  if (layer.kick.indexOf(stepIndex) >= 0) voiceKick(dest, when, v * 1.4);
  if (layer.snare.indexOf(stepIndex) >= 0) voiceSnare(dest, when, v);
  if (layer.hat.indexOf(stepIndex) >= 0) voiceHat(dest, when, v * 0.5, 0.04);
  if (layer.open.indexOf(stepIndex) >= 0) voiceHat(dest, when, v * 0.6, 0.12);
}
function getLayerDestination(layer, trackIndex) { return layer.dist ? distBuses[trackIndex] : trackGains[trackIndex]; }
function scheduleLayerStep(layer, trackIndex, when) {
  const dest = getLayerDestination(layer, trackIndex);
  if (layer.voice === 'drums') { scheduleDrumStep(layer, dest, when); return; }
  const semi = layer.pattern[stepIndex];
  if (semi >= 0) VOICES[layer.voice](dest, when, semitoneToFrequency(layer.base, semi), layer.vol, layer.len * STEP_SECONDS, layer.wave);
}
/* Tracks that are faded out are not scheduled at all, which keeps CPU use low on old devices. */
function listActiveTracks() {
  return TRACKS.map(function (t, i) { return i; }).filter(function (i) { return trackLevels[i] >= 0.05; })
    .sort(function (a, b) { return trackLevels[b] - trackLevels[a]; }).slice(0, MAX_ACTIVE_TRACKS);
}
/* Only the loudest MAX_ACTIVE_TRACKS tracks are scheduled, so rapid element changes can never stack 4 tracks of voices. */
function scheduleStepOnTracks(when) {
  listActiveTracks().forEach(function (i) { TRACKS[i].layers.forEach(function (layer) { scheduleLayerStep(layer, i, when); }); });
}
function smoothTrackLevels() {
  trackLevels = trackLevels.map(function (level, i) { const d = trackTargets[i] - level; return Math.abs(d) < 0.02 ? trackTargets[i] : level + d * 0.3; });
}
function runMusicScheduler() {
  smoothTrackLevels();
  while (nextStepTime < audioCtx.currentTime + 0.3) {
    scheduleStepOnTracks(nextStepTime);
    nextStepTime += STEP_SECONDS; stepIndex = (stepIndex + 1) % STEPS_PER_BAR;
  }
}
function createGainTo(destination, value) { const g = audioCtx.createGain(); g.gain.value = value; g.connect(destination); return g; }
function createNoiseBuffer() {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function buildDistortionCurve() {
  const c = new Float32Array(256);
  for (let i = 0; i < 256; i++) c[i] = Math.tanh((i / 127.5 - 1) * 3);
  return c;
}
function createDistortionBus(destination) {
  const pre = audioCtx.createGain(), shaper = audioCtx.createWaveShaper(), tone = audioCtx.createBiquadFilter(), post = audioCtx.createGain();
  pre.gain.value = 6; shaper.curve = buildDistortionCurve(); tone.type = 'lowpass'; tone.frequency.value = 3200; post.gain.value = 0.2;
  pre.connect(shaper); shaper.connect(tone); tone.connect(post); post.connect(destination);
  return pre;
}
function ensureAudioStarted() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  masterGain = createGainTo(audioCtx.destination, volumes.master);
  musicGain = createGainTo(masterGain, volumes.music);
  sfxGain = createGainTo(masterGain, volumes.sfx);
  noiseBuffer = createNoiseBuffer();
  trackTargets = TRACKS.map(function (t, i) { return i === MENU_TRACK_INDEX ? 1 : 0; }); trackLevels = trackTargets.slice();
  trackGains = TRACKS.map(function (t, i) { return createGainTo(musicGain, trackTargets[i]); });
  distBuses = TRACKS.map(function (t, i) { return t.dist ? createDistortionBus(trackGains[i]) : null; });
  nextStepTime = audioCtx.currentTime + 0.1;
  setInterval(runMusicScheduler, 100);
}
/* One crossfade algorithm for everything: menu theme, element themes, silence (-1). */
let musicSwitchAt = 0, pendingMusicElement = -1, musicSwitchTimer = 0;
function switchMusicToTrack(index) {
  clearTimeout(musicSwitchTimer); musicSwitchTimer = 0;
  if (!audioCtx) return;
  trackTargets = TRACKS.map(function (t, i) { return i === index ? 1 : 0; });
  trackGains.forEach(function (g, i) { g.gain.setTargetAtTime(trackTargets[i], audioCtx.currentTime, 0.4); });
}
/* Element changes happen on almost every throw; music only follows them at most once per MUSIC_SWITCH_MIN_MS. */
function requestMusicElement(element) {
  const wait = MUSIC_SWITCH_MIN_MS - (Date.now() - musicSwitchAt);
  if (wait <= 0) { musicSwitchAt = Date.now(); switchMusicToTrack(element); return; }
  pendingMusicElement = element;
  if (musicSwitchTimer) return;
  musicSwitchTimer = setTimeout(function () { musicSwitchTimer = 0; musicSwitchAt = Date.now(); switchMusicToTrack(pendingMusicElement); }, wait);
}
function switchMusicToElement(element) { requestMusicElement(element); }
function silenceMusic() { switchMusicToTrack(-1); }
function setVolume(kind, value) {
  volumes[kind] = value;
  const node = { master: masterGain, music: musicGain, sfx: sfxGain }[kind];
  if (node) node.gain.value = value;
}
function playSfxTone(freq, endFreq, seconds, wave, volume) {
  if (audioCtx) playToneAt(sfxGain, audioCtx.currentTime, freq, endFreq, seconds, wave, volume);
}
function playElementSfx(element) { const s = ELEMENT_SFX[element]; playSfxTone(s[0], s[1], s[3], s[2], 0.5); }
function playWeaknessSfx() { playSfxTone(320, 50, 0.45, 'sawtooth', 0.6); }
function playMenuSfx() { playSfxTone(800, 1000, 0.06, 'sine', 0.3); }
/* Hype tune, one beat per countdown stage: arpeggio, three rising kicks, final crash chord. */
function playCountdownHype(stage) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime, last = COUNTDOWN_STAGES.length - 1;
  if (stage === 0) [0, 3, 7, 12].forEach(function (s, i) { playToneAt(musicGain, t + i * 0.15, semitoneToFrequency(220, s), 0, 0.3, 'sawtooth', 0.22); });
  else if (stage < last) {
    voiceKick(musicGain, t, 0.9); voiceHat(musicGain, t + 0.5, 0.4, 0.05);
    playToneAt(musicGain, t, semitoneToFrequency(220, stage * 3), 0, 0.35, 'square', 0.2);
  } else {
    voiceKick(musicGain, t, 1); voiceSnare(musicGain, t, 0.5); playNoiseBurst(musicGain, t, 0.9, 'highpass', 5000, 0.35);
    [0, 7, 12].forEach(function (s) { playToneAt(musicGain, t, semitoneToFrequency(220, s), 0, 0.9, 'sawtooth', 0.2); });
  }
}
/* Stack chime: 5 variations (stack x1 to x5), each a rising bell arpeggio that starts higher and gains a note. */
const CHIME_NOTES = [[0, 7], [0, 7, 12], [0, 7, 12, 16], [0, 7, 12, 16, 19], [0, 7, 12, 16, 19, 24]];
function playStackChime(stack) {
  if (!audioCtx) return;
  const level = Math.min(Math.max(1, stack), CHIME_NOTES.length) - 1, t = audioCtx.currentTime, base = semitoneToFrequency(520, level * 2);
  CHIME_NOTES[level].forEach(function (semi, i) { voiceBell(sfxGain, t + i * 0.07, semitoneToFrequency(base, semi), 0.2 + level * 0.02); });
}
