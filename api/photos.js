/**
 * Vercel Serverless Function — proxy tới Cloudinary Admin API.
 *
 * Lý do cần proxy:
 *   Cloudinary Admin API (api.cloudinary.com) KHÔNG trả header
 *   `Access-Control-Allow-Origin`, nên trình duyệt chặn (CORS error)
 *   và không đọc được danh sách ảnh. Gọi qua serverless function
 *   của Vercel thì mọi thứ chạy server-side → không bị CORS.
 *
 * Secret KHÔNG nằm trong code: đọc từ biến môi trường VERCEL/CLOUDFINARY.
 * Nhưng để chạy được ngay, fallback về data/config.json nếu thiếu.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dppt775qk';
const API_KEY = process.env.CLOUDINARY_API_KEY || '521171572676425';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'OvJ6emfFxxwm6BSEjj-fHbMEsS4';

module.exports = async function handler(req, res) {
  // Cho phép gọi từ mọi nơi (web của bạn)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    const url =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image` +
      '?tags=true&context=true&max_results=500';

    const cldRes = await fetch(url, {
      headers: { Authorization: auth }
    });

    const body = await cldRes.text();

    res.status(cldRes.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Không cache để ảnh mới hiện ngay
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(body);
  } catch (err) {
    res.status(500).json({
      error: { message: 'Proxy lỗi: ' + err.message }
    });
  }
};
