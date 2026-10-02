// Cloudflare Worker: ตัวกลาง (CORS proxy) สำหรับข้อมูลสดของ กทม. จาก now.bangkok.go.th
// อนุญาตเฉพาะไฟล์ JSON ที่หน้าเว็บใช้ และแคช 5 นาทีเพื่อไม่ให้ยิงเซิร์ฟเวอร์ กทม. ถี่เกินไป
const UPSTREAM = 'https://now.bangkok.go.th/';
const ALLOWED = new Set(['road-flood-data.json', 'canal-water-data.json', 'nowcast-data.json', 'cctv-flood-data.json']);
// ใส่โดเมนเว็บของคุณ เช่น 'https://flood.example.com' หรือ '*' ถ้าไม่จำกัด
const ALLOW_ORIGIN = '*';

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const file = new URL(request.url).pathname.replace(/^\/+/, '');
    if (!ALLOWED.has(file)) return new Response('Not found', { status: 404, headers: cors });

    const cache = caches.default;
    const key = new Request(UPSTREAM + file);
    let res = await cache.match(key);
    if (!res) {
      const up = await fetch(UPSTREAM + file + '?t=' + Date.now(), { headers: { 'User-Agent': 'flood-watch-proxy' } });
      if (!up.ok) return new Response('Upstream error ' + up.status, { status: 502, headers: cors });
      res = new Response(up.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
