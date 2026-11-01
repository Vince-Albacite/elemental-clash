/* Offline WebRTC handshake: no STUN/TURN servers, codes are exchanged by copy and paste. */
function createPeerConnection() { return new RTCPeerConnection({ iceServers: [] }); }
function waitForIceGathering(peerConnection) {
  return new Promise(function (resolve) {
    if (peerConnection.iceGatheringState === 'complete') return resolve();
    peerConnection.addEventListener('icegatheringstatechange', function () { if (peerConnection.iceGatheringState === 'complete') resolve(); });
    setTimeout(resolve, 4000);
  });
}
const SETUP_TO_CHAR = { actpass: 'p', active: 'a', passive: 's' };
const CHAR_TO_SETUP = { p: 'actpass', a: 'active', s: 'passive' };
const CHAR_TO_TYPE = { o: 'offer', a: 'answer' };
function readSdpValue(sdp, key) { const match = sdp.match(new RegExp('^a=' + key + ':(.+)$', 'm')); return match ? match[1].trim() : ''; }
function fingerprintHexToBase64(hex) {
  const bytes = hex.split(':').map(function (hexPair) { return parseInt(hexPair, 16); });
  return btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fingerprintBase64ToHex(b64) {
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(raw).map(function (character) { return character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'); }).join(':');
}
function listUdpHostCandidates(sdp) {
  return sdp.split(/\r?\n/).filter(function (line) { return line.indexOf('a=candidate:') === 0; })
    .map(function (line) { return line.substring(12).split(' '); })
    .filter(function (tokens) { return tokens.length > 7 && tokens[2].toLowerCase() === 'udp' && tokens[7] === 'host'; })
    .slice(0, 4).map(function (tokens) { return tokens[4] + '|' + tokens[5]; });
}
/* Short code: ufrag~pwd~fingerprint~type+setup~addr|port,addr|port (about 100 characters). */
function encodeDescription(desc) {
  const sdp = desc.sdp, fingerprint = readSdpValue(sdp, 'fingerprint').split(' ')[1];
  return [readSdpValue(sdp, 'ice-ufrag'), readSdpValue(sdp, 'ice-pwd'), fingerprintHexToBase64(fingerprint),
    desc.type.charAt(0) + SETUP_TO_CHAR[readSdpValue(sdp, 'setup')], listUdpHostCandidates(sdp).join(',')].join('~');
}
function expandCandidateLines(list) {
  return list.split(',').map(function (candidateText, candidateIndex) {
    const parts = candidateText.split('|');
    if (parts.length !== 2 || !/^[A-Za-z0-9.:_%-]{1,80}$/.test(parts[0]) || !/^\d{1,5}$/.test(parts[1]) || Number(parts[1]) > 65535) throw new Error('bad code');
    return 'a=candidate:' + (candidateIndex + 1) + ' 1 udp ' + (2113937151 - candidateIndex) + ' ' + parts[0] + ' ' + parts[1] + ' typ host';
  });
}
function decodeDescription(text) {
  const fields = String(text).trim().split('~');
  if (fields.length !== 5 || !/^[A-Za-z0-9+\/]{1,64}$/.test(fields[0]) || !/^[A-Za-z0-9+\/]{1,128}$/.test(fields[1]) || !/^[A-Za-z0-9_-]{43}$/.test(fields[2])) throw new Error('bad code');
  const type = CHAR_TO_TYPE[fields[3].charAt(0)], setup = CHAR_TO_SETUP[fields[3].charAt(1)];
  if (!type || !setup) throw new Error('bad code');
  const lines = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + fields[0], 'a=ice-pwd:' + fields[1],
    'a=fingerprint:sha-256 ' + fingerprintBase64ToHex(fields[2]), 'a=setup:' + setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144']
    .concat(expandCandidateLines(fields[4]), ['a=end-of-candidates']);
  return { type: type, sdp: lines.join('\r\n') + '\r\n' };
}
async function createHostOffer() {
  const peerConnection = createPeerConnection(), channel = peerConnection.createDataChannel('game');
  await peerConnection.setLocalDescription(await peerConnection.createOffer());
  await waitForIceGathering(peerConnection);
  return { peerConnection: peerConnection, channel: channel, code: encodeDescription(peerConnection.localDescription) };
}
async function acceptOfferAndCreateAnswer(offerCode, onChannel) {
  const peerConnection = createPeerConnection();
  peerConnection.ondatachannel = function (channelEvent) { onChannel(channelEvent.channel); };
  await peerConnection.setRemoteDescription(decodeDescription(offerCode));
  await peerConnection.setLocalDescription(await peerConnection.createAnswer());
  await waitForIceGathering(peerConnection);
  return { peerConnection: peerConnection, code: encodeDescription(peerConnection.localDescription) };
}
async function finishHostHandshake(peerConnection, answerCode) { await peerConnection.setRemoteDescription(decodeDescription(answerCode)); }
function sendJson(channel, obj) { if (channel && channel.readyState === 'open') channel.send(JSON.stringify(obj)); }
function parseIncomingJson(raw) {
  if (typeof raw !== 'string' || raw.length > 4000) return null;
  try { const message = JSON.parse(raw); return message && typeof message.type === 'string' ? message : null; } catch (error) { return null; }
}
