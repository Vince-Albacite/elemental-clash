let audioCtx = null, masterGain = null, musicGain = null, sfxGain = null;
let trackGains = [], stepIndex = 0, nextStepTime = 0;
const volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
/* Four loops: all 16 steps x 0.25s = identical 4 second bars, so they stay phase-locked. */
const TRACKS = [
  { wave: 'sawtooth', base: 110, pattern: [0, -1, 3, 0, 7, -1, 5, 3, 0, -1, 3, 0, 10, -1, 7, 5] },
  { wave: 'triangle', base: 165, pattern: [0, 3, 7, -1, 10, 7, 3, -1, 5, 7, 10, -1, 12, 10, 7, -1] },
  { wave: 'sine', base: 220, pattern: [0, -1, -1, 7, -1, -1, 5, -1, 3, -1, -1, 10, -1, -1, 7, -1] },
  { wave: 'square', base: 55, pattern: [0, -1, 0, -1, 3, -1, 0, -1, 5, -1, 5, -1, 3, -1, 0, -1] }];
const ELEMENT_SFX = [[440, 220, 'sawtooth', 0.15], [330, 495, 'triangle', 0.2], [660, 880, 'sine', 0.25], [110, 70, 'square', 0.2]];
function semitoneToFrequency(base, semitones) { return base * Math.pow(2, semitones / 12); }
function playToneAt(destination, when, freq, endFreq, seconds, wave, volume) {
  const osc = audioCtx.createOscillator(), env = audioCtx.createGain();
  osc.type = wave; osc.frequency.setValueAtTime(freq, when);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, when + seconds);
  env.gain.setValueAtTime(volume, when); env.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  osc.connect(env); env.connect(destination); osc.start(when); osc.stop(when + seconds + 0.02);
}
function scheduleStepOnAllTracks(when) {
  TRACKS.forEach(function (track, i) {
    const semi = track.pattern[stepIndex];
    if (semi >= 0) playToneAt(trackGains[i], when, semitoneToFrequency(track.base, semi), 0, STEP_SECONDS * 1.6, track.wave, 0.18);
  });
}
function runMusicScheduler() {
  while (nextStepTime < audioCtx.currentTime + 0.3) {
    scheduleStepOnAllTracks(nextStepTime);
    nextStepTime += STEP_SECONDS;
    stepIndex = (stepIndex + 1) % STEPS_PER_BAR;
  }
}
function createGainTo(destination, value) { const g = audioCtx.createGain(); g.gain.value = value; g.connect(destination); return g; }
function ensureAudioStarted() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  masterGain = createGainTo(audioCtx.destination, volumes.master);
  musicGain = createGainTo(masterGain, volumes.music);
  sfxGain = createGainTo(masterGain, volumes.sfx);
  trackGains = TRACKS.map(function (t, i) { return createGainTo(musicGain, i === 0 ? 1 : 0); });
  nextStepTime = audioCtx.currentTime + 0.1;
  setInterval(runMusicScheduler, 100);
}
function switchMusicToElement(element) {
  if (!audioCtx) return;
  trackGains.forEach(function (g, i) { g.gain.setTargetAtTime(i === element ? 1 : 0, audioCtx.currentTime, 0.4); });
}
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
