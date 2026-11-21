# 🌸 Khoảnh Khắc Của Chúng Mình

Trang web lưu ảnh cho bạn và bạn gái. Ảnh nằm trên **Cloudinary**, ghi chú nằm trong **GitHub**, web chạy trên **Vercel** — hoàn toàn miễn phí.

---

## 📁 Cấu trúc

```
love-gallery/
├── index.html          # Giao diện
├── style.css           # Giao diện (màu hồng, dễ thương)
├── app.js              # Logic: upload, lưới ảnh, lightbox
├── data/
│   └── gallery.json    # ⚠️ ĐÂY LÀ NƠI LƯU GHI CHÚ / NGÀY / ALBUM
├── vercel.json         # Cấu hình deploy
└── README.md
```

---

## 🚀 Deploy lên Vercel (5 phút)

### Bước 1 — Đẩy code lên GitHub

```bash
cd love-gallery
git init
git add .
git commit -m "Khoảnh khắc của chúng mình 💕"
git branch -M main
git remote add origin https://github.com/<TENDANGTAIKHOAN>/love-gallery.git
git push -u origin main
```

### Bước 2 — Kết nối Vercel

1. Vào [vercel.com](https://vercel.com) → **Add New → Project**
2. Chọn repo `love-gallery` vừa push
3. Framework preset: **Other**
4. Build command: để trống · Output directory: để trống
5. **Deploy**

Xong! Web sẽ ở dạng `https://love-gallery.vercel.app`.

> Mỗi lần bạn push code lên GitHub, Vercel tự deploy lại trong vài giây.

---

## ☁️ Setup Cloudinary (để upload ảnh)

### Bước 1 — Tạo tài khoản miễn phí

1. Vào [cloudinary.com](https://cloudinary.com) → đăng ký miễn phí
2. Dashboard sẽ hiện **Cloud Name** (ví dụ: `dxyz12345`) — copy lại

### Bước 2 — Tạo Upload Preset

1. Trong Dashboard, vào **Settings → Upload → Upload presets**
2. Bấm **Add upload preset**
3. Đặt tên: `gallery_unsigned`
4. **Signing mode**: chọn `Unsigned`
5. Bấm **Save**

### Bước 3 — Điền vào `app.js`

Mở `app.js`, sửa 2 dòng đầu:

```javascript
const CONFIG = {
  cloudName: 'dxyz12345',        // ← Cloud Name của bạn
  uploadPreset: 'gallery_unsigned',
  dataUrl: 'data/gallery.json'
};
```

### Bước 4 — Đẩy code lên

```bash
git add app.js
git commit -m "Cấu hình Cloudinary"
git push
```

Vercel tự deploy lại. Xong — giờ bạn đã có thể upload ảnh thật!

---

## 📝 Cách lưu ghi chú / ngày / album

Vì web là static hosting nên không tự ghi file được. Cách đơn giản nhất:

### Cách A — Dùng mã tự động (khuyến nghị)

Mở **Console** (F12) trên trình duyệt sau khi upload xong. Mình in ra sẵn JSON đầy đủ ở đó:

```javascript
console.log(JSON.stringify(photos, null, 2))
```

Copy → mở `data/gallery.json` trên GitHub → dán đè → **Commit changes**.

Vercel tự deploy lại trong ~10 giây, xong thẻ mới hiện lên.

### Cách B — Sửa trực tiếp trên GitHub

Mở file `data/gallery.json` trên GitHub → bấm **✏️ Edit** → thêm entry mới theo mẫu:

```json
{
  "id": "ten-file-tren-cloudinary",
  "url": "https://res.cloudinary.com/xxx/image/upload/abc123.jpg",
  "filename": "ten-anh.jpg",
  "note": "Lời nhắn của mình cho bạn 💕",
  "date": "2026-11-21",
  "album": "Tên album",
  "uploadedAt": "2026-11-21T12:00:00.000Z"
}
```

→ **Commit changes** → Vercel deploy lại.

---

## 🎨 Tính năng

| Tính năng | Mô tả |
|---|---|
| 💕 Upload kéo-thả | Chọn nhiều ảnh cùng lúc, có preview trước khi tải |
| 🔍 Lightbox | Click ảnh để xem bản gốc sắc nét, phóng to, tải xuống |
| ⌨️ Phím tắt | `←` `→` đổi ảnh, `Esc` đóng |
| 🎲 Ngẫu nhiên | Nút xem ảnh ngẫu nhiên |
| 🏷️ Album | Tự động gom nhóm, có chip lọc |
| 🔎 Tìm kiếm | Tìm theo ghi chú / ngày / album |
| 📱 Responsive | Đẹp trên điện thoại |
| 💗 Trái tim bay | Hiệu ứng dễ thương |
| 🌸 Lazy loading | Ảnh thumbnail tải theo nhu cầu, không lag |

---

## ⚙️ Tuỳ chỉnh

**Đổi màu chủ đạo** → sửa biến trong `style.css`:

```css
:root {
  --pink-500: #f973a0;   /* màu chính */
  --rose:     #e11d63;   /* gradient */
}
```

**Đổi câu chữ trên đầu trang** → `index.html`, tìm `.hero-title` và `.hero-sub`.

**Đổi số ảnh hiện mỗi lần** → `app.js`, sửa `const PAGE_SIZE = 24;`

**Tắt trái tim bay** → xoá dòng `startHearts();` trong `init()`.

---

## 🔒 Bảo mật

Hiện tại ai có link cũng xem và upload được (upload preset unsigned).

Muốn khóa lại thì trong Cloudinary:
- Settings → Security → **Allowed upload prefixes** → giới hạn
- Hoặc tạo preset có **Signed** (cần server, phức tạp hơn)

Với web gia đình thì mặc định cũng được rồi. Nếu muốn chỉ 2 người xem thì nói mình chỉnh thêm phần đăng nhập.

---

## ❓ Khắc phục sự cố

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| "Chưa cấu hình Cloudinary" | Chưa sửa `CONFIG` trong `app.js` | Điền `cloudName` + `uploadPreset` |
| "không đọc được gallery.json" | Thiếu file `data/gallery.json` | Đảm bảo file có trong repo (không bị `.gitignore`) |
| Upload báo lỗi 401 | Preset không phải `Unsigned` | Vào Cloudinary sửa lại preset |
| Ảnh không hiện sau khi upload | Metadata chưa lưu vào `gallery.json` | Làm theo mục "Cách lưu ghi chú" ở trên |

---

Made with 💗
