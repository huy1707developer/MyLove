/**
 * Vercel Serverless Function — LƯU / ĐỌC DỮ LIỆU DÙNG CHUNG cho 2 người.
 *
 * Dùng Cloudinary "raw" resource để lưu 1 file JSON chung:
 *   public_id = lovegallery/lovestuff.json
 *
 * GET  /api/shared            → đọc toàn bộ dữ liệu chung
 * POST /api/shared            → ghi đè toàn bộ dữ liệu chung
 *
 * Body POST: { data: { ...bất kỳ... } }
 *
 * Ghi chú:
 *   - Cloudinary Admin API không có CORS → phải qua server-side.
 *   - Raw upload với `public_id` đầy đủ + `overwrite=true` sẽ ghi đè
 *     bản cũ (tăng version), nên cần đọc bằng version mới nhất.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dppt775qk';
const API_KEY = process.env.CLOUDINARY_API_KEY || '521171572676425';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'OvJ6emfFxxwm6BSEjj-fHbMEsS4';

const RAW_ID = 'lovegallery/lovestuff.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const auth = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

  try {
    // ---------- ĐỌC ----------
    if (req.method === 'GET') {
      const listUrl =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw` +
        `?type=upload&max_results=500`;

      const listRes = await fetch(listUrl, { headers: { Authorization: auth } });
      if (!listRes.ok) {
        res.status(listRes.status).json({
          error: { message: 'HTTP ' + listRes.status + ' khi lấy danh sách raw' }
        });
        return;
      }

      const listData = await listRes.json();
      const resources = listData.resources || [];
      const file = resources.find(r => r.public_id === RAW_ID);

      if (!file) {
        // Chưa có dữ liệu chung → trả về object rỗng
        res.status(200).json({ data: {}, version: null });
        return;
      }

      // Tải nội dung file (cần đúng version + đường dẫn đầy đủ)
      const downloadUrl =
        `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/` +
        `v${file.version}/${RAW_ID}`;

      const dlRes = await fetch(downloadUrl);
      if (!dlRes.ok) {
        res.status(200).json({ data: {}, version: file.version });
        return;
      }

      const text = await dlRes.text();
      let data = {};
      try { data = JSON.parse(text); } catch (e) { data = {}; }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json({ data: data, version: file.version });
      return;
    }

    // ---------- GHI ----------
    if (req.method === 'POST') {
      let body = {};
      try {
        const raw = req.body;
        if (typeof raw === 'string') body = JSON.parse(raw || '{}');
        else if (raw && typeof raw === 'object') body = raw;
      } catch (err) {
        res.status(400).json({ error: { message: 'Body không hợp lệ' } });
        return;
      }

      if (body.data === undefined || body.data === null) {
        res.status(400).json({ error: { message: 'Thiếu trường "data"' } });
        return;
      }

      const payload = JSON.stringify(body.data);

      // Cloudinary raw upload cần multipart → gửi dạng Blob
      const form = new FormData();
      form.append(
        'file',
        new Blob([payload], { type: 'application/json' }),
        'lovestuff.json'
      );
      form.append('public_id', RAW_ID);
      form.append('overwrite', 'true');
      form.append('invalidate', 'true');

      const uploadUrl =
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: auth },
        body: form
      });

      const upText = await upRes.text();

      if (!upRes.ok) {
        let msg = 'HTTP ' + upRes.status;
        try { msg = JSON.parse(upText).error?.message || msg; } catch (e) { /* ignore */ }
        res.status(upRes.status).json({ error: { message: msg } });
        return;
      }

      let upData = {};
      try { upData = JSON.parse(upText); } catch (e) { /* ignore */ }

      res.status(200).json({
        ok: true,
        version: upData.version || null,
        bytes: upData.bytes || 0
      });
      return;
    }

    res.status(405).json({ error: { message: 'Chỉ nhận GET hoặc POST' } });
  } catch (err) {
    res.status(500).json({
      error: { message: 'Lỗi dữ liệu chung: ' + err.message }
    });
  }
};
