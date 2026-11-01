const ICON_COLORS = ['#ffd23c', '#ff7a7a', '#7ad0ff', '#8affa0', '#d49bff', '#ffb36b', '#ff9ad5', '#b8e04a', '#5fe0c4', '#c4c4d4', '#a58cff', '#ff5f5f'];
const INK = 'stroke="#222" stroke-width="3" stroke-linecap="round" fill="none"';
const ICON_EYES = [
  '<circle cx="20" cy="23" r="3.5" fill="#222"/><circle cx="36" cy="23" r="3.5" fill="#222"/>',
  '<path d="M16 23h8M32 23h8" ' + INK + '/>',
  '<path d="M16 25q4-6 8 0M32 25q4-6 8 0" ' + INK + '/>',
  '<circle cx="20" cy="23" r="5" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="36" cy="23" r="5" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="20" cy="23" r="2" fill="#222"/><circle cx="36" cy="23" r="2" fill="#222"/>',
  '<circle cx="20" cy="23" r="6" fill="#222"/><circle cx="36" cy="23" r="6" fill="#222"/><circle cx="22" cy="21" r="2" fill="#fff"/><circle cx="38" cy="21" r="2" fill="#fff"/>',
  '<path d="M14 17l10 4M42 17l-10 4" ' + INK + '/><circle cx="20" cy="26" r="3" fill="#222"/><circle cx="36" cy="26" r="3" fill="#222"/>',
  '<path d="M16 19l8 8M24 19l-8 8M32 19l8 8M40 19l-8 8" ' + INK + '/>',
  '<circle cx="20" cy="23" r="3.5" fill="#222"/><path d="M32 23h8" ' + INK + '/>',
  '<path d="M20 29l-6-7a3.5 3.5 0 0 1 6-3.5a3.5 3.5 0 0 1 6 3.5z" fill="#d22"/><path d="M36 29l-6-7a3.5 3.5 0 0 1 6-3.5a3.5 3.5 0 0 1 6 3.5z" fill="#d22"/>'];
const ICON_MOUTHS = [
  '<path d="M18 36q10 9 20 0" ' + INK + '/>',
  '<path d="M19 40h18" ' + INK + '/>',
  '<ellipse cx="28" cy="39" rx="6" ry="4" fill="#222"/>',
  '<path d="M18 42q10-9 20 0" ' + INK + '/>',
  '<path d="M16 34q12 16 24 0z" fill="#222"/>',
  '<path d="M18 36q10 9 20 0" ' + INK + '/><path d="M25 42q3 8 6 0z" fill="#ff6b8a"/>',
  '<path d="M16 35h24v4q-12 8-24 0z" fill="#fff" stroke="#222" stroke-width="2"/><path d="M28 35v8" stroke="#222" stroke-width="2"/>',
  '<path d="M20 38q4 5 8 0q4 5 8 0" ' + INK + '/>',
  '<path d="M20 41q10 2 18-6" ' + INK + '/>'];
function clampIndex(value, length) { const numericValue = Number(value); return Number.isInteger(numericValue) && numericValue >= 0 && numericValue < length ? numericValue : 0; }
function cleanIcon(icon) {
  const safeIcon = icon || {};
  return { colorIndex: clampIndex(safeIcon.colorIndex, ICON_COLORS.length), eyesIndex: clampIndex(safeIcon.eyesIndex, ICON_EYES.length), mouthIndex: clampIndex(safeIcon.mouthIndex, ICON_MOUTHS.length) };
}
function cleanName(text) { return String(text || '').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 12) || 'Player'; }
function stepIconPart(icon, part, direction) {
  const length = { colorIndex: ICON_COLORS.length, eyesIndex: ICON_EYES.length, mouthIndex: ICON_MOUTHS.length }[part];
  if (length) icon[part] = (icon[part] + direction + length) % length;
}
function buildFaceSvg(icon) {
  return '<svg viewBox="0 0 56 56" class="face" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="' +
    ICON_COLORS[icon.colorIndex] + '"/>' + ICON_EYES[icon.eyesIndex] + ICON_MOUTHS[icon.mouthIndex] + '</svg>';
}
