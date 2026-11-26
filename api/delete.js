/**
 * Vercel Serverless Function — XOÁ ẢNH trên Cloudinary.
 *
 * POST /api/delete
 * Body: { "public_id": "lovegallery/abc" }              → xóa 1 ảnh
 *       { "public_ids": ["lovegallery/a", "…/b"] }       → xóa nhiều ảnh
 *
 * ⚠️ Endpoint ĐÚNG của Cloudinary để xóa ảnh là:
 *      POST /v1_1/{cloud}/image/destroy?public_id=...
 *
 *    Các endpoint sau KHÔNG tồn tại (trả 404):
 *      - DELETE /resources/image?public_ids[]=...
 *      - POST  /resources/image/delete_resources
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

    const deleted = [];
    const notFound = [];
    const failed = [];

    // Xóa từng ảnh qua POST /image/destroy
    for (const id of safeIds) {
      const url =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy` +
        `?public_id=${encodeURIComponent(id)}&invalidate=true`;

      try {
        const cldRes = await fetch(url, {
          method: 'POST',
          headers: { Authorization: auth }
        });

        const body = await cldRes.text();
        let data = {};
        try { data = JSON.parse(body); } catch (e) { /* giữ nguyên body */ }

        if (!cldRes.ok) {
          failed.push({ id, message: data.error?.message || ('HTTP ' + cldRes.status) });
        } else if (data.result === 'not found') {
          // Ảnh đã bị xóa trước đó → coi như đã xóa (web vẫn cần bỏ khỏi list)
          notFound.push(id);
        } else {
          deleted.push(id);
        }
      } catch (err) {
        failed.push({ id, message: err.message });
      }
    }

    // Có ảnh nào lỗi không → trả lỗi để web biết
    if (failed.length && !deleted.length && !notFound.length) {
      res.status(500).json({
        error: { message: 'Xóa thất bại: ' + failed[0].message }
      });
      return;
    }

    res.status(200).json({
      deleted: deleted,
      not_found: notFound,
      failed: failed,
      requested: safeIds
    });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi khi xóa trên Cloudinary: ' + err.message }
    });
  }
};
