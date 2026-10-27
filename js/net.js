/* Offline WebRTC handshake: no STUN/TURN servers, codes are exchanged by copy and paste. */
function createPeerConnection() { return new RTCPeerConnection({ iceServers: [] }); }
function waitForIceGathering(pc) {
  return new Promise(function (resolve) {
    if (pc.iceGatheringState === 'complete') return resolve();
    pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') resolve(); });
    setTimeout(resolve, 4000);
  });
}
function encodeDescription(desc) { return btoa(JSON.stringify({ type: desc.type, sdp: desc.sdp })); }
function decodeDescription(text) {
  const o = JSON.parse(atob(String(text).trim()));
  if ((o.type !== 'offer' && o.type !== 'answer') || typeof o.sdp !== 'string' || o.sdp.length > 20000) throw new Error('bad code');
  return { type: o.type, sdp: o.sdp };
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
