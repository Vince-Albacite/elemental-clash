/* Offline WebRTC handshake: no STUN/TURN servers, codes are exchanged by copy and paste. */
function createPeerConnection() { return new RTCPeerConnection({ iceServers: [] }); }
function waitForIceGathering(pc) {
  return new Promise(function (resolve) {
    if (pc.iceGatheringState === 'complete') return resolve();
    pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') resolve(); });
    setTimeout(resolve, 4000);
  });
}
const SETUP_TO_CHAR = { actpass: 'p', active: 'a', passive: 's' };
const CHAR_TO_SETUP = { p: 'actpass', a: 'active', s: 'passive' };
const CHAR_TO_TYPE = { o: 'offer', a: 'answer' };
function readSdpValue(sdp, key) { const m = sdp.match(new RegExp('^a=' + key + ':(.+)$', 'm')); return m ? m[1].trim() : ''; }
function fingerprintHexToBase64(hex) {
  const bytes = hex.split(':').map(function (h) { return parseInt(h, 16); });
  return btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fingerprintBase64ToHex(b64) {
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(raw).map(function (c) { return c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'); }).join(':');
}
function listUdpHostCandidates(sdp) {
  return sdp.split(/\r?\n/).filter(function (l) { return l.indexOf('a=candidate:') === 0; })
    .map(function (l) { return l.substring(12).split(' '); })
    .filter(function (t) { return t.length > 7 && t[2].toLowerCase() === 'udp' && t[7] === 'host'; })
    .slice(0, 4).map(function (t) { return t[4] + '|' + t[5]; });
}
/* Short code: ufrag~pwd~fingerprint~type+setup~addr|port,addr|port (about 100 characters). */
function encodeDescription(desc) {
  const sdp = desc.sdp, fp = readSdpValue(sdp, 'fingerprint').split(' ')[1];
  return [readSdpValue(sdp, 'ice-ufrag'), readSdpValue(sdp, 'ice-pwd'), fingerprintHexToBase64(fp),
    desc.type.charAt(0) + SETUP_TO_CHAR[readSdpValue(sdp, 'setup')], listUdpHostCandidates(sdp).join(',')].join('~');
}
function expandCandidateLines(list) {
  return list.split(',').map(function (c, i) {
    const p = c.split('|');
    if (p.length !== 2 || !/^[A-Za-z0-9.:_%-]{1,80}$/.test(p[0]) || !/^\d{1,5}$/.test(p[1]) || Number(p[1]) > 65535) throw new Error('bad code');
    return 'a=candidate:' + (i + 1) + ' 1 udp ' + (2113937151 - i) + ' ' + p[0] + ' ' + p[1] + ' typ host';
  });
}
function decodeDescription(text) {
  const f = String(text).trim().split('~');
  if (f.length !== 5 || !/^[A-Za-z0-9+\/]{1,64}$/.test(f[0]) || !/^[A-Za-z0-9+\/]{1,128}$/.test(f[1]) || !/^[A-Za-z0-9_-]{43}$/.test(f[2])) throw new Error('bad code');
  const type = CHAR_TO_TYPE[f[3].charAt(0)], setup = CHAR_TO_SETUP[f[3].charAt(1)];
  if (!type || !setup) throw new Error('bad code');
  const lines = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + f[0], 'a=ice-pwd:' + f[1],
    'a=fingerprint:sha-256 ' + fingerprintBase64ToHex(f[2]), 'a=setup:' + setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144']
    .concat(expandCandidateLines(f[4]), ['a=end-of-candidates']);
  return { type: type, sdp: lines.join('\r\n') + '\r\n' };
}
async function createHostOffer() {
  const pc = createPeerConnection(), ch = pc.createDataChannel('game');
  await pc.setLocalDescription(await pc.createOffer());
  await waitForIceGathering(pc);
  return { pc: pc, ch: ch, code: encodeDescription(pc.localDescription) };
}
async function acceptOfferAndCreateAnswer(offerCode, onChannel) {
  const pc = createPeerConnection();
  pc.ondatachannel = function (e) { onChannel(e.channel); };
  await pc.setRemoteDescription(decodeDescription(offerCode));
  await pc.setLocalDescription(await pc.createAnswer());
  await waitForIceGathering(pc);
  return { pc: pc, code: encodeDescription(pc.localDescription) };
}
async function finishHostHandshake(pc, answerCode) { await pc.setRemoteDescription(decodeDescription(answerCode)); }
function sendJson(channel, obj) { if (channel && channel.readyState === 'open') channel.send(JSON.stringify(obj)); }
function parseIncomingJson(raw) {
  if (typeof raw !== 'string' || raw.length > 4000) return null;
  try { const m = JSON.parse(raw); return m && typeof m.t === 'string' ? m : null; } catch (e) { return null; }
}
