# 🌸 Khoảnh Khắc Của Chúng Mình

Trang web lưu ảnh cho bạn và bạn gái. Ảnh nằm trên **Cloudinary**, ghi chú nằm trong **GitHub**, web chạy trên **Vercel** — hoàn toàn miễn phí.

---

## 📁 Cấu trúc

```
love-gallery/
├── index.html          # Giao diện
├── style.css           # Giao diện (màu hồng, dễ thương)
├── app.js              # Logic: upload, lưới ảnh, lightbox
├── api/
│   └── photos.js       # ⚠️ Serverless Function của Vercel: proxy tới Cloudinary
├── data/
│   ├── config.json     # Cấu hình Cloudinary (Cloud Name, API Key/Secret)
│   └── gallery.json    # Ảnh fallback khi chưa cấu hình
├── vercel.json         # Cấu hình deploy
└── README.md
```

---

## ⚡ Vì sao cần `api/photos.js`?

**Cloudinary Admin API không trả header CORS** → trình duyệt chặn → web không
đọc được danh sách ảnh sau khi reload (lỗi `Failed to fetch`).

`api/photos.js` là **Vercel Serverless Function** đóng vai trò proxy:

```
Trình duyệt  →  /api/photos  (Vercel, server-side)  →  Cloudinary Admin API
                  ↑ có CORS                              ↑ không cần CORS
```

Nó cũng giúp **giấu API Secret** khỏi mã nguồn client.

> ⚠️ Chỉ hoạt động **sau khi deploy lên Vercel**. Khi chạy local bằng
> `python -m http.server` thì `/api/photos` không có → web fallback sang
> `localStorage` + `data/gallery.json` (vẫn xem được ảnh đã upload trên máy đó).

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

**Không cần làm gì thêm!** Ghi chú, ngày tháng và album được lưu **ngay trong Cloudinary** (trường `context` + `tags`) → reload trang ảnh vẫn còn đầy đủ. ✅

### Điều kiện: cần API Key + API Secret

Cloudinary **Admin API** dùng Basic Auth, nên web cần 3 giá trị:

| Tên | Dùng để | Bắt buộc? |
|---|---|---|
| **Cloud Name** | Upload ảnh | ✅ Bắt buộc |
| **API Key** | Đọc danh sách ảnh | ⭐ Nên có |
| **API Secret** | Đọc danh sách ảnh | ⭐ Nên có |

Lấy cả 3 tại: **Cloudinary → Settings → API Keys**

### Cách nhập

**Cách A — Sửa `data/config.json` (dùng chung mọi thiết bị, khuyến nghị)**
```json
{
  "cloudName": "dppt775qk",
  "uploadPreset": "gallery_unsigned",
  "apiKey": "123456789012345",
  "apiSecret": "abc123..."
}
```
→ Commit lên GitHub → Vercel deploy lại → xong. **Không còn phải nhập tay.**

**Cách B — Nhập trên web (nhanh nhất, chỉ máy này)**
1. Bấm **"Thêm ảnh"**
2. Khối **☁️ Cấu hình Cloudinary** hiện ra
3. Dán Cloud Name + API Key + API Secret → bấm **Lưu**
4. Hoặc bấm **⚡ Dùng cấu hình có sẵn trong data/config.json**

**Cách C — Console trình duyệt**
```javascript
window.setCloudName('dppt775qk')
window.setCloudKeys('123456789012345', 'abc123...')
```

### ⚠️ Thứ tự ưu tiên cấu hình

1. `data/config.json` ← **nguồn chính**
2. `localStorage` ← chỉ dùng khi `config.json` thiếu/lỗi

> Trước đây `localStorage` được đọc trước nên giá trị cũ (sai) đè lên
> `config.json` → web cứ đòi nhập lại Cloud Name. Đã đảo lại rồi.

### ⚠️ Bảo mật

`apiSecret` trong `data/config.json` là **public** (ai có link cũng đọc được repo). Đây là web gia đình nên chấp nhận được.

Muốn giấu secret hoàn toàn thì set biến môi trường trên Vercel:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

→ `api/photos.js` sẽ tự dùng các biến này, và có thể xoá `apiKey`/`apiSecret`
khỏi `data/config.json`.

### Dữ liệu mẫu `data/gallery.json`

File này chỉ làm **fallback** khi chưa cấu hình API Key hoặc chạy local. Khi
deploy Vercel và có config đầy đủ, web sẽ **đọc ảnh thật từ Cloudinary**.

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
| "Chưa cấu hình Cloudinary" | `data/config.json` chưa đủ 3 giá trị | Điền `cloudName` + `apiKey` + `apiSecret` |
| "Failed to fetch" (đỏ) | Chạy local, chưa deploy Vercel → không có `/api/photos` | Deploy lên Vercel, hoặc bấm ⚡ dùng cấu hình có sẵn |
| Ảnh không hiện sau khi upload | Chưa lưu `localStorage` / chưa deploy | Kiểm tra Console (F12) xem có lỗi gì |
| Web cứ đòi nhập Cloud Name | `localStorage` có giá trị cũ | Bấm ⚡ dùng cấu hình có sẵn trong `data/config.json` |
| Upload báo lỗi 401 | Preset không phải `Unsigned` | Vào Cloudinary sửa lại preset |
| "không đọc được gallery.json" | Thiếu file `data/gallery.json` | Đảm bảo file có trong repo (không bị `.gitignore`) |

---

Made with 💗
