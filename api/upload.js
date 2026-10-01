// Vercel Serverless Function: /api/upload?host=catbox|imgur|imgbb
//   POST  raw file binary (header x-filename)  ya  JSON { "url": "https://..." }
//   GET   kon kon host e token set ache (token er man dekhay na)
// Token gulo shudhu server e thake, browser e jay na. Host na dile default = catbox (bot er jonno).

let fileConfig = {};
try {
  fileConfig = require('../config.json');
} catch (e) {}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const PLACEHOLDER = /^PUT_YOUR_/;

// Priority: Vercel Environment Variable > config.json
function pick(...values) {
  for (const v of values) if (v && !PLACEHOLDER.test(v)) return String(v);
  return '';
}
const tokens = () => ({
  catbox: pick(process.env.CATBOX_USERHASH, fileConfig.catbox?.userhash, fileConfig.catboxUserhash),
  imgur: pick(process.env.IMGUR_CLIENT_ID, fileConfig.imgur?.clientId),
  imgbb: pick(process.env.IMGBB_API_KEY, fileConfig.imgbb?.apiKey)
});
const accessKey = () => pick(process.env.ACCESS_KEY, process.env.API_KEY, fileConfig.accessKey, fileConfig.apiKey);

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v)$/i;

// ---------- Hosts ----------
async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { _raw: text }; }
}

const HOSTS = {
  catbox: {
    label: 'Catbox',
    async upload({ token, buffer, filename, url }) {
      const form = new FormData();
      form.append('userhash', token);
      if (url) {
        form.append('reqtype', 'urlupload');
        form.append('url', url);
      } else {
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', new Blob([buffer]), filename);
      }
      const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST', body: form, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000)
      });
      const text = (await res.text()).trim();
      if (!res.ok) throw new Error(`Catbox HTTP ${res.status}: ${text.slice(0, 150)}`);
      if (!/^https?:\/\//i.test(text)) throw new Error(`Catbox: ${text.slice(0, 150)}`);
      return text;
    }
  },

  imgur: {
    label: 'Imgur',
    async upload({ token, buffer, filename, url }) {
      const form = new FormData();
      let endpoint = 'https://api.imgur.com/3/image';

      if (url) {
        form.append('image', url);
        form.append('type', 'url');
      } else if (VIDEO_EXT.test(filename)) {
        endpoint = 'https://api.imgur.com/3/upload';
        form.append('video', new Blob([buffer]), filename);
      } else if (IMAGE_EXT.test(filename)) {
        form.append('image', new Blob([buffer]), filename);
        form.append('type', 'file');
      } else {
        throw new Error('Imgur supports images and videos only');
      }

      const res = await fetch(endpoint, {
        method: 'POST', body: form,
        headers: { Authorization: `Client-ID ${token}`, 'User-Agent': UA },
        signal: AbortSignal.timeout(25000)
      });
      const json = await readJson(res);
      if (!res.ok || !json.success) {
        const e = json?.data?.error;
        throw new Error(`Imgur: ${typeof e === 'string' ? e : e?.message || `HTTP ${res.status}`}`);
      }
      return json.data.link;
    }
  },

  imgbb: {
    label: 'ImgBB',
    async upload({ token, buffer, filename, url }) {
      const form = new FormData();
      if (url) {
        form.append('image', url);
      } else {
        if (!IMAGE_EXT.test(filename)) throw new Error('ImgBB supports images only');
        form.append('image', new Blob([buffer]), filename);
      }
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(token)}`, {
        method: 'POST', body: form, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000)
      });
      const json = await readJson(res);
      if (!res.ok || !json.success) {
        throw new Error(`ImgBB: ${json?.error?.message || `HTTP ${res.status}`}`);
      }
      return json.data.url;
    }
  }
};

// ---------- Helpers ----------
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readRaw(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// accessKey set thakle: x-api-key sothik hobe, ba request nijer website theke ashte hobe
function isAllowed(req) {
  const key = accessKey();
  if (!key) return true;
  if (req.headers['x-api-key'] === key) return true;

  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return !!origin && new URL(origin).host === host;
  } catch (e) {
    return false;
  }
}

function cleanFilename(raw) {
  let name = 'file.bin';
  try { name = decodeURIComponent(raw || name); } catch (e) { name = raw || name; }
  name = name.split(/[\\/]/).pop().replace(/[^\w.\-() ]+/g, '_').trim();
  return name || 'file.bin';
}

module.exports = async (req, res) => {
  const t = tokens();

  if (req.method === 'GET') {
    return send(res, 200, {
      success: true,
      hosts: { catbox: !!t.catbox, imgur: !!t.imgur, imgbb: !!t.imgbb }
    });
  }
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Use POST' });
  if (!isAllowed(req)) return send(res, 401, { success: false, error: 'Invalid API key' });

  const hostName = (new URL(req.url || '/', 'http://x').searchParams.get('host') || 'catbox').toLowerCase();
  const host = HOSTS[hostName];
  if (!host) return send(res, 400, { success: false, error: `Unknown host "${hostName}"` });

  const token = t[hostName];
  if (!token) {
    return send(res, 500, { success: false, error: `${host.label} token is not set in config.json (or environment variable)` });
  }

  try {
    const type = (req.headers['content-type'] || '').toLowerCase();
    let payload;

    if (type.includes('application/json')) {
      // Link theke upload -> { "url": "https://..." }
      let body = req.body;
      if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) {
        body = JSON.parse((await readRaw(req)).toString() || '{}');
      }
      if (!body.url || !/^https?:\/\//i.test(body.url)) {
        return send(res, 400, { success: false, error: 'Valid "url" is required' });
      }
      payload = { url: body.url, filename: 'remote' };
    } else {
      // Raw file binary (header: x-filename)
      const buffer = await readRaw(req);
      if (!buffer || !buffer.length) return send(res, 400, { success: false, error: 'Empty file' });
      payload = { buffer, filename: cleanFilename(req.headers['x-filename']) };
    }

    const link = await host.upload({ token, ...payload });
    return send(res, 200, { success: true, url: link, host: hostName });
  } catch (err) {
    return send(res, 502, { success: false, error: err.message });
  }
};
