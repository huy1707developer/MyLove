/**
 * Vercel Serverless Function — XOÁ ẢNH trên Cloudinary.
 *
 * POST /api/delete
 * Body: { "public_id": "lovegallery/abc123" }
 *
 * ⚠️ Endpoint ĐÚNG của Cloudinary để xóa 1 ảnh là:
 *      POST /v1_1/{cloud}/image/destroy?public_id=...
 *    (Admin API `DELETE /resources/image` KHÔNG tồn tại → trả 404)
 *
 * Cloudinary Admin API không hỗ trợ CORS nên phải gọi qua server-side.
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
  if (!publicId.startsWith('lovegallery')) {
    res.status(403).json({
      error: { message: 'Chỉ được xóa ảnh trong folder "lovegallery"' }
    });
    return;
  }

  try {
    const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // Endpoint chuẩn Cloudinary để xóa 1 asset
    const url =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy` +
      `?public_id=${encodeURIComponent(publicId)}&invalidate=true`;

    const cldRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth }
    });

    const body = await cldRes.text();

    let data = {};
    try { data = JSON.parse(body); } catch (e) { /* giữ nguyên body */ }

    // Cloudinary trả { "result": "ok" } khi xóa thành công,
    // { "result": "not found" } khi ảnh đã bị xóa trước đó.
    const result = data.result;

    if (!cldRes.ok) {
      res.status(cldRes.status).json({
        error: { message: data.error?.message || ('HTTP ' + cldRes.status) }
      });
      return;
    }

    if (result === 'not found') {
      // Ảnh đã bị xóa trước đó → coi như thành công (web vẫn cần bỏ nó khỏi danh sách)
      res.status(200).json({
        result: 'not found',
        message: 'Ảnh đã không còn trên Cloudinary (coi như đã xóa)'
      });
      return;
    }

    res.status(200).json({ result: result || 'ok', public_id: publicId });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi khi xóa trên Cloudinary: ' + err.message }
    });
  }
};
