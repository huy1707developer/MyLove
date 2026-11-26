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

  // Lấy danh sách public_id từ body
  let publicIds = [];
  try {
    const raw = req.body;
    let parsed = {};
    if (typeof raw === 'string') {
      parsed = JSON.parse(raw || '{}');
    } else if (raw && typeof raw === 'object') {
      parsed = raw;
    }

    if (Array.isArray(parsed.public_ids)) {
      publicIds = parsed.public_ids.filter(x => typeof x === 'string' && x);
    } else if (parsed.public_id || parsed.publicId) {
      publicIds = [parsed.public_id || parsed.publicId];
    }
  } catch (err) {
    res.status(400).json({ error: { message: 'Body không hợp lệ' } });
    return;
  }

  if (!publicIds.length) {
    res.status(400).json({ error: { message: 'Thiếu public_id' } });
    return;
  }

  // Chỉ cho xóa trong phạm vi folder lovegallery (an toàn)
  const safeIds = publicIds.filter(id => id.startsWith('lovegallery'));
  if (!safeIds.length) {
    res.status(403).json({
      error: { message: 'Chỉ được xóa ảnh trong folder "lovegallery"' }
    });
    return;
  }

  try {
    const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // Cloudinary Admin API xóa nhiều ảnh:
    //   POST /v1_1/{cloud}/resources/image/delete_resources
    const url =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/delete_resources`;

    const cldRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ public_ids: safeIds, invalidate: true })
    });

    const body = await cldRes.text();

    let data = {};
    try { data = JSON.parse(body); } catch (e) { /* giữ nguyên body */ }

    if (!cldRes.ok) {
      res.status(cldRes.status).json({
        error: { message: data.error?.message || ('HTTP ' + cldRes.status) }
      });
      return;
    }

    // Cloudinary trả:
    //   { deleted: { "id1": "ok", "id2": "not found" } }
    //   { not_found: ["id3"] }
    const deleted = data.deleted || {};
    const notFound = data.not_found || [];

    // Ảnh nào không còn trên Cloudinary cũng coi như đã xóa
    const okIds = Object.keys(deleted).filter(k => deleted[k] === 'ok');

    res.status(200).json({
      deleted: okIds,
      not_found: notFound,
      requested: safeIds
    });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi khi xóa trên Cloudinary: ' + err.message }
    });
  }
};
