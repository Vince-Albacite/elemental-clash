const ICON_COLORS = ['#ffd23c', '#ff7a7a', '#7ad0ff', '#8affa0', '#d49bff', '#ffb36b'];
const ICON_EYES = [
  '<circle cx="20" cy="23" r="3.5" fill="#222"/><circle cx="36" cy="23" r="3.5" fill="#222"/>',
  '<path d="M16 23h8M32 23h8" stroke="#222" stroke-width="3" stroke-linecap="round"/>',
  '<path d="M16 25q4-6 8 0M32 25q4-6 8 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>',
  '<circle cx="20" cy="23" r="5" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="36" cy="23" r="5" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="20" cy="23" r="2" fill="#222"/><circle cx="36" cy="23" r="2" fill="#222"/>'];
const ICON_MOUTHS = [
  '<path d="M18 36q10 9 20 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>',
  '<path d="M19 40h18" stroke="#222" stroke-width="3" stroke-linecap="round"/>',
  '<ellipse cx="28" cy="39" rx="6" ry="4" fill="#222"/>',
  '<path d="M18 40q10-9 20 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>'];
function clampIndex(value, length) { const n = Number(value); return Number.isInteger(n) && n >= 0 && n < length ? n : 0; }
function cleanIcon(icon) {
  const i = icon || {};
  return { c: clampIndex(i.c, ICON_COLORS.length), e: clampIndex(i.e, ICON_EYES.length), m: clampIndex(i.m, ICON_MOUTHS.length) };
}
function cleanName(text) { return String(text || '').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 12) || 'Player'; }
function cycleIconPart(icon, part) {
  const lengths = { c: ICON_COLORS.length, e: ICON_EYES.length, m: ICON_MOUTHS.length };
  icon[part] = (icon[part] + 1) % lengths[part];
}
function buildFaceSvg(icon) {
  return '<svg viewBox="0 0 56 56" class="face" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="' +
    ICON_COLORS[icon.c] + '"/>' + ICON_EYES[icon.e] + ICON_MOUTHS[icon.m] + '</svg>';
}
