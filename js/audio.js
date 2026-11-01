let audioCtx = null, masterGain = null, musicGain = null, sfxGain = null, noiseBuffer = null;
let trackGains = [], distBuses = [], trackLevels = [], trackTargets = [], stepIndex = 0, nextStepTime = 0;
const volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
const REST = -1; /* rest */
const SFX_BY_NAME = { red: [440, 220, 'sawtooth', 0.15], green: [330, 495, 'triangle', 0.2], blue: [660, 880, 'sine', 0.25], brown: [110, 70, 'square', 0.2] };
const ELEMENT_SFX = ELEMENT_NAMES.map(function (elementName) { return SFX_BY_NAME[elementName]; });
/* Five loops, all 16 steps x 0.25 s = one 4 second bar (8th notes at 120 BPM), key A minor pentatonic.
   Tracks 0-3 follow the element order, the last track (MENU_TRACK_INDEX) is the menu and lobby theme.
   Layer pattern values are semitones above layer.base, R = rest, len = note length in steps. */
const TRACK_DEFS = {
  red: { dist: true, layers: [
    { voice: 'guitar', base: 220, vol: 0.09, len: 2, dist: true, pattern: [0, REST, 3, REST, 5, REST, 7, 5, 3, REST, 0, REST, 10, REST, 7, 3] },
    { voice: 'chug', base: 110, vol: 0.1, len: 1, dist: true, pattern: [0, 0, REST, 0, 0, REST, 3, REST, 0, 0, REST, 0, 5, REST, 3, REST] },
    { voice: 'bass', base: 55, vol: 0.16, len: 1, wave: 'sawtooth', pattern: [0, REST, REST, REST, 0, REST, REST, REST, 3, REST, REST, REST, 5, REST, 3, REST] }] },
  green: { layers: [
    { voice: 'flute', base: 440, vol: 0.12, len: 3, pattern: [0, REST, REST, 3, REST, REST, 7, REST, 5, REST, REST, 3, REST, REST, 0, REST] },
    { voice: 'pluck', base: 220, vol: 0.07, len: 1, pattern: [0, 7, 12, 7, 0, 7, 12, 7, 3, 10, 15, 10, 3, 10, 15, 10] },
    { voice: 'pad', base: 110, vol: 0.06, len: 8, pattern: [0, REST, REST, REST, REST, REST, REST, REST, 5, REST, REST, REST, REST, REST, REST, REST] }] },
  blue: { layers: [
    { voice: 'vibraphone', base: 440, vol: 0.12, len: 2, pattern: [0, REST, 3, REST, 7, REST, 5, REST, 3, REST, 7, 10, 12, REST, 10, 7] },
    { voice: 'pad', base: 110, vol: 0.08, len: 8, pattern: [0, REST, REST, REST, REST, REST, REST, REST, 7, REST, REST, REST, REST, REST, REST, REST] },
    { voice: 'bass', base: 55, vol: 0.14, len: 1, wave: 'triangle', pattern: [0, REST, REST, 0, REST, REST, 0, REST, 5, REST, REST, 5, REST, REST, 3, REST] }] },
  brown: { layers: [
    { voice: 'drums', vol: 0.2, kick: [0, 4, 8, 11, 12], snare: [2, 6, 10, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [7, 15] },
    { voice: 'bass', base: 55, vol: 0.14, len: 1, wave: 'sawtooth', pattern: [0, REST, 0, REST, 3, REST, 0, REST, 5, REST, 5, REST, 3, REST, 0, REST] },
    { voice: 'stab', base: 220, vol: 0.07, len: 1, pattern: [REST, REST, REST, 0, REST, REST, REST, 0, REST, REST, 0, REST, REST, REST, 5, REST] }] },
  menu: { layers: [
    { voice: 'pluck', base: 440, vol: 0.06, len: 1, pattern: [0, 7, 12, 7, 3, 10, 12, 10, 5, 12, 15, 12, 3, 10, 12, 10] },
    { voice: 'pad', base: 110, vol: 0.07, len: 8, pattern: [0, REST, REST, REST, REST, REST, REST, REST, 5, REST, REST, REST, REST, REST, REST, REST] },
    { voice: 'bass', base: 55, vol: 0.14, len: 4, wave: 'triangle', pattern: [0, REST, REST, REST, REST, REST, REST, REST, 5, REST, REST, REST, 3, REST, REST, REST] },
    { voice: 'drums', vol: 0.12, kick: [0, 8], snare: [], hat: [2, 6, 10, 14], open: [] }] } };
/* Element tracks follow the order of ELEMENT_NAMES, the menu theme is always last. */
const TRACKS = ELEMENT_NAMES.map(function (elementName) { return TRACK_DEFS[elementName]; }).concat([TRACK_DEFS.menu]);
function semitoneToFrequency(base, semitones) { return base * Math.pow(2, semitones / 12); }
function playToneAt(destination, when, freq, endFreq, seconds, wave, volume) {
  const osc = audioCtx.createOscillator(), env = audioCtx.createGain();
  osc.type = wave; osc.frequency.setValueAtTime(freq, when);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, when + seconds);
  env.gain.setValueAtTime(volume, when); env.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  osc.connect(env); env.connect(destination); osc.start(when); osc.stop(when + seconds + 0.02);
}
function makeOsc(type, freq, when) { const oscillator = audioCtx.createOscillator(); oscillator.type = type; oscillator.frequency.setValueAtTime(freq, when); return oscillator; }
function makeEnv(when, peak, attack, total) {
  const gainNode = audioCtx.createGain(); gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.linearRampToValueAtTime(peak, when + attack); gainNode.gain.exponentialRampToValueAtTime(0.001, when + total); return gainNode;
}
function runVoice(oscs, env, destination, when, total) {
  oscs.forEach(function (oscillator) { oscillator.connect(env); oscillator.start(when); oscillator.stop(when + total + 0.05); });
  env.connect(destination);
}
function playNoiseBurst(destination, when, seconds, filterType, filterFreq, volume) {
  const src = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter(), gainNode = audioCtx.createGain();
  src.buffer = noiseBuffer; filter.type = filterType; filter.frequency.value = filterFreq;
  gainNode.gain.setValueAtTime(volume, when); gainNode.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  src.connect(filter); filter.connect(gainNode); gainNode.connect(destination); src.start(when); src.stop(when + seconds + 0.02);
}
function scoopOsc(type, freq, when) { const oscillator = makeOsc(type, freq * 0.94, when); oscillator.frequency.exponentialRampToValueAtTime(freq, when + 0.05); return oscillator; }
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
  [[1, 1], [4, 0.28], [10, 0.08]].forEach(function (partial) {
    const oscillator = makeOsc('sine', freq * partial[0], when), partialGain = audioCtx.createGain();
    partialGain.gain.value = partial[1]; oscillator.connect(partialGain); partialGain.connect(trem); oscillator.start(when); oscillator.stop(when + total + 0.05);
  });
  trem.connect(env); env.connect(dest);
}
function voiceBell(dest, when, freq, vol) {
  runVoice([makeOsc('sine', freq, when), makeOsc('sine', freq * 2.76, when)], makeEnv(when, vol, 0.003, 1.4), dest, when, 1.4);
}
function voiceKick(dest, when, vol) {
  const oscillator = makeOsc('sine', 150, when); oscillator.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  runVoice([oscillator], makeEnv(when, vol, 0.002, 0.28), dest, when, 0.28);
}
function voiceSnare(dest, when, vol) {
  playNoiseBurst(dest, when, 0.16, 'bandpass', 1800, vol);
  runVoice([makeOsc('triangle', 190, when)], makeEnv(when, vol * 0.6, 0.002, 0.1), dest, when, 0.1);
}
function voiceHat(dest, when, vol, seconds) { playNoiseBurst(dest, when, seconds, 'highpass', 7000, vol); }
const VOICES = { guitar: voiceGuitar, chug: voiceChug, bass: voiceBass, stab: voiceStab, flute: voiceFlute, pluck: voicePluck,
  pad: voicePad, vibraphone: voiceVibraphone, bell: voiceBell };
function scheduleDrumStep(layer, dest, when) {
  const volume = layer.vol;
  if (layer.kick.indexOf(stepIndex) >= 0) voiceKick(dest, when, volume * 1.4);
  if (layer.snare.indexOf(stepIndex) >= 0) voiceSnare(dest, when, volume);
  if (layer.hat.indexOf(stepIndex) >= 0) voiceHat(dest, when, volume * 0.5, 0.04);
  if (layer.open.indexOf(stepIndex) >= 0) voiceHat(dest, when, volume * 0.6, 0.12);
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
  return TRACKS.map(function (track, trackIndex) { return trackIndex; }).filter(function (trackIndex) { return trackLevels[trackIndex] >= 0.05; })
    .sort(function (firstIndex, secondIndex) { return trackLevels[secondIndex] - trackLevels[firstIndex]; }).slice(0, MAX_ACTIVE_TRACKS);
}
/* Only the loudest MAX_ACTIVE_TRACKS tracks are scheduled, so rapid element changes can never stack 4 tracks of voices. */
function scheduleStepOnTracks(when) {
  listActiveTracks().forEach(function (trackIndex) { TRACKS[trackIndex].layers.forEach(function (layer) { scheduleLayerStep(layer, trackIndex, when); }); });
}
function smoothTrackLevels() {
  trackLevels = trackLevels.map(function (level, trackIndex) { const difference = trackTargets[trackIndex] - level; return Math.abs(difference) < 0.02 ? trackTargets[trackIndex] : level + difference * 0.3; });
}
function runMusicScheduler() {
  smoothTrackLevels();
  while (nextStepTime < audioCtx.currentTime + 0.3) {
    scheduleStepOnTracks(nextStepTime);
    nextStepTime += STEP_SECONDS; stepIndex = (stepIndex + 1) % STEPS_PER_BAR;
  }
}
function createGainTo(destination, value) { const gainNode = audioCtx.createGain(); gainNode.gain.value = value; gainNode.connect(destination); return gainNode; }
function createNoiseBuffer() {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate), samples = buf.getChannelData(0);
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) samples[sampleIndex] = Math.random() * 2 - 1;
  return buf;
}
function buildDistortionCurve() {
  const curve = new Float32Array(256);
  for (let sampleIndex = 0; sampleIndex < 256; sampleIndex++) curve[sampleIndex] = Math.tanh((sampleIndex / 127.5 - 1) * 3);
  return curve;
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
  trackTargets = TRACKS.map(function (track, trackIndex) { return trackIndex === MENU_TRACK_INDEX ? 1 : 0; }); trackLevels = trackTargets.slice();
  trackGains = TRACKS.map(function (track, trackIndex) { return createGainTo(musicGain, trackTargets[trackIndex]); });
  distBuses = TRACKS.map(function (track, trackIndex) { return track.dist ? createDistortionBus(trackGains[trackIndex]) : null; });
  nextStepTime = audioCtx.currentTime + 0.1;
  setInterval(runMusicScheduler, 100);
}
/* One crossfade algorithm for everything: menu theme, element themes, silence (-1). */
let musicSwitchAt = 0, pendingMusicElement = -1, musicSwitchTimer = 0;
function switchMusicToTrack(index) {
  clearTimeout(musicSwitchTimer); musicSwitchTimer = 0;
  if (!audioCtx) return;
  trackTargets = TRACKS.map(function (track, trackIndex) { return trackIndex === index ? 1 : 0; });
  trackGains.forEach(function (gainNode, trackIndex) { gainNode.gain.setTargetAtTime(trackTargets[trackIndex], audioCtx.currentTime, 0.4); });
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
function playElementSfx(element) { const sfxSettings = ELEMENT_SFX[element]; playSfxTone(sfxSettings[0], sfxSettings[1], sfxSettings[3], sfxSettings[2], 0.5); }
function playWeaknessSfx() { playSfxTone(320, 50, 0.45, 'sawtooth', 0.6); }
function playMenuSfx() { playSfxTone(800, 1000, 0.06, 'sine', 0.3); }
/* Hype tune, one beat per countdown stage: arpeggio, three rising kicks, final crash chord. */
function playCountdownHype(stage) {
  if (!audioCtx) return;
  const startTime = audioCtx.currentTime, last = COUNTDOWN_STAGES.length - 1;
  if (stage === 0) [0, 3, 7, 12].forEach(function (semitones, noteIndex) { playToneAt(musicGain, startTime + noteIndex * 0.15, semitoneToFrequency(220, semitones), 0, 0.3, 'sawtooth', 0.22); });
  else if (stage < last) {
    voiceKick(musicGain, startTime, 0.9); voiceHat(musicGain, startTime + 0.5, 0.4, 0.05);
    playToneAt(musicGain, startTime, semitoneToFrequency(220, stage * 3), 0, 0.35, 'square', 0.2);
  } else {
    voiceKick(musicGain, startTime, 1); voiceSnare(musicGain, startTime, 0.5); playNoiseBurst(musicGain, startTime, 0.9, 'highpass', 5000, 0.35);
    [0, 7, 12].forEach(function (semitones) { playToneAt(musicGain, startTime, semitoneToFrequency(220, semitones), 0, 0.9, 'sawtooth', 0.2); });
  }
}
/* Stack chime: 5 variations (stack x1 to x5), each a rising bell arpeggio that starts higher and gains a note. */
const CHIME_NOTES = [[0, 7], [0, 7, 12], [0, 7, 12, 16], [0, 7, 12, 16, 19], [0, 7, 12, 16, 19, 24]];
function playStackChime(stack) {
  if (!audioCtx) return;
  const level = Math.min(Math.max(1, stack), CHIME_NOTES.length) - 1, startTime = audioCtx.currentTime, base = semitoneToFrequency(520, level * 2);
  CHIME_NOTES[level].forEach(function (semi, noteIndex) { voiceBell(sfxGain, startTime + noteIndex * 0.07, semitoneToFrequency(base, semi), 0.2 + level * 0.02); });
}
/* Telegraph note: a short upward glide pitched per player seat, distinct from the element sounds and the stack chime. */
function playTelegraphSignal(playerId) {
  if (!audioCtx) return;
  const semitones = TELEGRAPH_NOTE_SEMITONES[playerId % TELEGRAPH_NOTE_SEMITONES.length];
  const frequency = semitoneToFrequency(TELEGRAPH_BASE_FREQUENCY, semitones), startTime = audioCtx.currentTime;
  playToneAt(sfxGain, startTime, frequency * 0.84, frequency, 0.16, 'triangle', 0.32);
  playToneAt(sfxGain, startTime + 0.02, frequency * 2, 0, 0.12, 'sine', 0.12);
}
