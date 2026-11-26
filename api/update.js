/**
 * Vercel Serverless Function — CẬP NHẬT metadata của ảnh trên Cloudinary.
 *
 * POST /api/update
 * Body: {
 *   "public_ids": ["lovegallery/a", "lovegallery/b"],
 *   "album": "Tên album",
 *   "date": "2026-11-23",
 *   "note": "Ghi chú",
 *   "cover": "lovegallery/xyz"      // (tuỳ chọn) public_id của ảnh bìa
 * }
 *
 * ⚠️ Endpoint ĐÚNG của Cloudinary:
 *      POST /v1_1/{cloud}/image/context
 *    với body { "command": "add", "context": "k=v|k=v", "public_ids": [...] }
 *
 *    Endpoint `POST /resources/image/context` KHÔNG tồn tại (trả 404).
 *
 * `command: "add"` sẽ GHI ĐÈ các key được gửi và GIỮ nguyên các key khác
 * (ví dụ set ảnh bìa mà không mất album/date/note đã có).
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dppt775qk';
const API_KEY = process.env.CLOUDINARY_API_KEY || '521171572676425';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'OvJ6emfFxxwm6BSEjj-fHbMEsS4';

/** Escape giá trị cho Cloudinary context (dùng `|` làm dấu phân cách). */
function esc(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/=/g, '\\=')
    .replace(/[\r\n]/g, ' ');
}

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

  // Parse body
  let body = {};
  try {
    const raw = req.body;
    if (typeof raw === 'string') body = JSON.parse(raw || '{}');
    else if (raw && typeof raw === 'object') body = raw;
  } catch (err) {
    res.status(400).json({ error: { message: 'Body không hợp lệ' } });
    return;
  }

  const ids = Array.isArray(body.public_ids) ? body.public_ids : [];
  if (!ids.length) {
    res.status(400).json({ error: { message: 'Thiếu public_ids' } });
    return;
  }

  // Chỉ cho sửa ảnh trong folder lovegallery
  const safeIds = ids.filter(id => typeof id === 'string' && id.startsWith('lovegallery'));
  if (!safeIds.length) {
    res.status(403).json({
      error: { message: 'Chỉ được sửa ảnh trong folder "lovegallery"' }
    });
    return;
  }

  try {
    const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // Ghép context từ các giá trị được gửi lên
    const ctxParts = [];
    if (body.album !== undefined) ctxParts.push('album=' + esc(body.album));
    if (body.date !== undefined) ctxParts.push('date=' + esc(body.date));
    if (body.note !== undefined) ctxParts.push('note=' + esc(body.note));
    if (body.cover !== undefined) ctxParts.push('cover=' + esc(body.cover));

    if (!ctxParts.length) {
      res.status(400).json({ error: { message: 'Không có gì để cập nhật' } });
      return;
    }

    const url =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/context`;

    const cldRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'add',
        context: ctxParts.join('|'),
        public_ids: safeIds
      })
    });

    const bodyText = await cldRes.text();

    if (!cldRes.ok) {
      let msg = 'HTTP ' + cldRes.status;
      try {
        const j = JSON.parse(bodyText);
        msg = j.error?.message || msg;
      } catch (e) { /* giữ msg mặc định */ }

      res.status(cldRes.status).json({ error: { message: msg } });
      return;
    }

    let data = {};
    try { data = JSON.parse(bodyText); } catch (e) { /* bỏ qua */ }

    res.status(200).json({
      updated: data.public_ids || safeIds,
      public_ids: safeIds
    });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi khi cập nhật trên Cloudinary: ' + err.message }
    });
  }
};
