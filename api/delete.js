/**
 * Vercel Serverless Function — XOÁ ẢNH trên Cloudinary.
 *
 * POST /api/delete
 * Body: { "public_id": "lovegallery/abc123" }
 *
 * Cloudinary Admin API không hỗ trợ CORS nên phải gọi qua server-side.
 * Endpoint chuẩn của Cloudinary để xóa nhiều ảnh:
 *   DELETE /v1_1/{cloud}/resources/image?public_ids[]=id1&public_ids[]=id2
 *
 * Nếu ảnh nằm trong folder (public_id có dấu /) thì dùng:
 *   DELETE /v1_1/{cloud}/resources/image/{type}/{public_id}
 * hoặc bọc public_id vào query array.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dppt775qk';
const API_KEY = process.env.CLOUDINARY_API_KEY || '521171572676425';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'OvJ6emfFxxwm6BSEjj-fHbMEsS4';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Chỉ nhận POST' } });
    return;
  }

  // Lấy public_id từ body
  let publicId = '';
  try {
    const raw = req.body;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw || '{}');
      publicId = parsed.public_id || parsed.publicId || '';
    } else if (raw && typeof raw === 'object') {
      publicId = raw.public_id || raw.publicId || '';
    }
  } catch (err) {
    res.status(400).json({ error: { message: 'Body không hợp lệ' } });
    return;
  }

  if (!publicId) {
    res.status(400).json({ error: { message: 'Thiếu public_id' } });
    return;
  }

  // Chỉ cho xóa trong phạm vi folder lovegallery (an toàn)
  if (!publicId.startsWith('lovegallery/') && !publicId.startsWith('lovegallery')) {
    res.status(403).json({
      error: { message: 'Chỉ được xóa ảnh trong folder "lovegallery"' }
    });
    return;
  }

  try {
    const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // Cloudinary Admin API: DELETE /resources/image?public_ids[]=...
    const url =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image` +
      `?public_ids%5B%5D=${encodeURIComponent(publicId)}&invalidate=true`;

    const cldRes = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });

    const body = await cldRes.text();

    res.status(cldRes.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(body);
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi khi xóa trên Cloudinary: ' + err.message }
    });
  }
};
