// Cloudflare Worker «gtg-upload» – Video-Upload für Gate-to-Gate Coach-Links (R2)
// ---------------------------------------------------------------------------------
// Neu (10/2026): Teil-Upload für grosse Videos. Cloudflare nimmt pro Anfrage höchstens
// 100 MB an («413 Payload Too Large»). Die App lädt Videos > 90 MB jetzt in 64-MB-Teilen hoch.
//
// Einrichten im Cloudflare-Dashboard: Workers & Pages → gtg-upload → «Edit code»
// → diesen Code komplett einfügen → «Deploy».
//
// Erwartet (wie bisher, unter Settings → Variables / Bindings):
//   • R2-Bucket-Binding  – Name egal (z. B. BUCKET); der Code findet es automatisch.
//   • Upload-Passwort    – als Secret UPLOAD_SECRET (oder UPLOAD_KEY / WKEY / KEY / PASSWORD).
//     Gleiches Passwort wie im Coach-Link-Dialog («Worker-Passwort»). Ohne Variable: kein Passwort.
//
// Schnittstelle (alles POST mit Content-Type text/plain -> kein CORS-Vorabcheck):
//   POST /?path=…&ct=…&key=…                    Body = Datei      -> ganze Datei speichern (bis 100 MB)
//   POST /?mpu=create&path=…&ct=…&key=…                           -> {uploadId}
//   POST /?mpu=part&path=…&uploadId=…&part=N&key=…  Body = Teil   -> {etag}
//   POST /?mpu=complete&path=…&uploadId=…&key=…  Body = [{partNumber,etag}]
//   POST /?mpu=abort&path=…&uploadId=…&key=…

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function findBucket(env) {
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (v && typeof v.put === 'function' && typeof v.createMultipartUpload === 'function') return v;
  }
  return null;
}
function needKey(env) {
  return env.UPLOAD_SECRET || env.UPLOAD_KEY || env.WKEY || env.KEY || env.PASSWORD || env.UPLOAD_PASSWORD || '';
}
function cleanPath(p) {
  p = String(p || '').replace(/^\/+/, '');
  if (!p || p.includes('..') || p.length > 400) return null;
  return p;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST' && req.method !== 'PUT') return json({ error: 'method' }, 405);

    const url = new URL(req.url);
    const q = url.searchParams;
    const want = needKey(env);
    if (want && q.get('key') !== want) return json({ error: 'forbidden' }, 403);

    const bucket = findBucket(env);
    if (!bucket) return json({ error: 'kein R2-Bucket gebunden' }, 500);

    const path = cleanPath(q.get('path'));
    if (!path) return json({ error: 'path' }, 400);
    const ct = q.get('ct') || 'application/octet-stream';
    const mpu = q.get('mpu');

    try {
      if (!mpu) {
        if (path === '__syscheck__') return json({ ok: true });
        await bucket.put(path, req.body, { httpMetadata: { contentType: ct } });
        return json({ ok: true, path });
      }
      if (mpu === 'create') {
        const up = await bucket.createMultipartUpload(path, { httpMetadata: { contentType: ct } });
        return json({ uploadId: up.uploadId, path });
      }
      const uploadId = q.get('uploadId');
      if (!uploadId) return json({ error: 'uploadId' }, 400);
      const up = bucket.resumeMultipartUpload(path, uploadId);
      if (mpu === 'part') {
        const n = parseInt(q.get('part'), 10);
        if (!(n >= 1 && n <= 10000)) return json({ error: 'part' }, 400);
        const buf = await req.arrayBuffer();   // R2 braucht eine bekannte Länge
        const part = await up.uploadPart(n, buf);
        return json({ etag: part.etag, partNumber: part.partNumber });
      }
      if (mpu === 'complete') {
        const parts = await req.json();
        await up.complete(parts);
        return json({ ok: true, path });
      }
      if (mpu === 'abort') {
        await up.abort();
        return json({ ok: true });
      }
      return json({ error: 'mpu' }, 400);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};
