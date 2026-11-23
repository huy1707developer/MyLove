/* ==========================================================
   Khoảnh Khắc Của Chúng Mình — App Logic
   ========================================================== */

/* ------------------------------------------------------------
   CẤU HÌNH
   ------------------------------------------------------------
   Cloudinary: sửa trong file  data/config.json
   → {
   →   "cloudName": "xxxxxxx",
   →   "uploadPreset": "gallery_unsigned",
   →   "apiKey": "123456789012345",
   →   "apiSecret": "abc..."
   → }

   apiKey / apiSecret lấy tại Cloudinary → Settings → API Keys.
   Chúng giúp web đọc lại danh sách ảnh sau khi reload
   (Admin API). Xem file .gitignore nếu muốn giữ bí mật.

   Ngoài ra có thể gán từ console:
   → window.setCloudName('xxxxxxx')
   → window.setCloudKeys('key', 'secret')
   ------------------------------------------------------------ */
const CONFIG = {
  // Cloudinary Cloud Name (để trống = sẽ đọc từ data/config.json)
  cloudName: '',

  // Upload preset (đặt tên là "gallery_unsigned" hoặc tên bạn chọn)
  uploadPreset: 'gallery_unsigned',

  // API Key + Secret để đọc danh sách ảnh từ Cloudinary (Admin API)
  apiKey: '',
  apiSecret: '',

  // Link file chứa metadata (ghi chú, ngày, album)
  dataUrl: 'data/gallery.json',

  // File chứa cấu hình Cloudinary
  configUrl: 'data/config.json'
};

const PAGE_SIZE = 24;   // số ảnh hiện mỗi lần
const MAX_FILE_MB = 10;

/* ------------------------------------------------------------
   STATE
   ------------------------------------------------------------ */
let photos = [];          // toàn bộ ảnh
let filtered = [];        // ảnh sau khi lọc/tìm kiếm
let visibleCount = PAGE_SIZE;
let currentAlbum = 'all';
let searchTerm = '';
let currentIndex = -1;    // index trong filtered của lightbox
let pendingFiles = [];    // file đang chờ upload

const $ = (id) => document.getElementById(id);

/* ==========================================================
   KHỞI ĐỘNG
   ========================================================== */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  startHearts();

  try {
    bindEvents();
  } catch (err) {
    console.error('Lỗi khi gắn sự kiện:', err);
  }

  try {
    await loadConfig();
  } catch (err) {
    console.error('Lỗi khi đọc config:', err);
  }

  try {
    await loadPhotos();
  } catch (err) {
    console.error('Lỗi khi tải ảnh:', err);
    photos = [];
    applyFilters();
  }
}

/**
 * Đọc cấu hình Cloudinary.
 *
 * Thứ tự ưu tiên:
 *   1. data/config.json  — nguồn chính (được commit lên GitHub, ai cũng dùng chung)
 *   2. localStorage       — chỉ dùng khi config.json thiếu hoặc đọc lỗi
 *                        (trường hợp bạn tự nhập tay trên máy mình)
 *
 * LƯU Ý: trước đây localStorage được đọc trước nên giá trị cũ (sai) đè lên
 * config.json → web cứ đòi nhập lại Cloud Name. Đã đảo lại.
 */
async function loadConfig() {
  let fromFile = false;

  // 1. Ưu tiên data/config.json
  try {
    const res = await fetch(CONFIG.configUrl + '?t=' + Date.now(), {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const cfg = await res.json();

    if (cfg.cloudName)    CONFIG.cloudName = cfg.cloudName.trim();
    if (cfg.uploadPreset) CONFIG.uploadPreset = cfg.uploadPreset.trim();
    if (cfg.apiKey)       CONFIG.apiKey = cfg.apiKey.trim();
    if (cfg.apiSecret)    CONFIG.apiSecret = cfg.apiSecret.trim();

    fromFile = !!(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
  } catch (err) {
    console.warn('⚠️ Không đọc được data/config.json:', err.message);
  }

  // 2. Fallback: giá trị đã lưu trong trình duyệt
  if (!fromFile) {
    try {
      const saved = localStorage.getItem('CLOUDINARY_NAME');
      if (saved) CONFIG.cloudName = saved.trim();

      const savedKey = localStorage.getItem('CLOUDINARY_KEY');
      if (savedKey) CONFIG.apiKey = savedKey.trim();

      const savedSecret = localStorage.getItem('CLOUDINARY_SECRET');
      if (savedSecret) CONFIG.apiSecret = savedSecret.trim();
    } catch (err) {
      // localStorage bị chặn -> bỏ qua
    }
  }

  console.info(
    '✅ Cloudinary config:',
    CONFIG.cloudName || '(chưa có)',
    '/',
    CONFIG.uploadPreset,
    fromFile ? '(từ config.json)' : '(từ localStorage)'
  );
}

/**
 * Gán Cloud Name trực tiếp từ console trình duyệt.
 * Dùng khi chưa muốn sửa file config.json:
 *   window.setCloudName('dxyz12345')
 */
window.setCloudName = function (name, preset) {
  CONFIG.cloudName = (name || '').trim();
  if (preset) CONFIG.uploadPreset = preset.trim();

  console.info('☁️  Cloudinary đã cấu hình:', CONFIG.cloudName, '/', CONFIG.uploadPreset);

  toast('Đã cấu hình Cloudinary: ' + CONFIG.cloudName, 'success');
  return CONFIG;
};

/**
 * Gán API Key + Secret từ console (để đọc danh sách ảnh sau reload).
 *   window.setCloudKeys('123456789012345', 'abc123...')
 */
window.setCloudKeys = function (key, secret) {
  CONFIG.apiKey = (key || '').trim();
  CONFIG.apiSecret = (secret || '').trim();

  console.info('🔑 Đã cấu hình API keys');
  toast('Đã lưu API Key/Secret — ảnh sẽ không mất khi reload', 'success');

  // Đọc lại danh sách ngay
  loadPhotosFromCloudinary().then(list => {
    if (list && list.length) {
      photos = list;
      applyFilters();
      renderStats();
      renderAlbumList();
      toast('Đã tải ' + list.length + ' ảnh từ Cloudinary ☁️', 'success');
    }
  });

  return CONFIG;
};

function bindEvents() {
  // Nút thêm ảnh
  $('btnUpload').addEventListener('click', openUploadModal);

  // Tìm kiếm
  let searchTimer;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTerm = e.target.value.trim().toLowerCase();
      visibleCount = PAGE_SIZE;
      applyFilters();
    }, 220);
  });

  // Xem ngẫu nhiên
  $('btnShuffle').addEventListener('click', () => {
    if (!filtered.length) {
      toast('Chưa có ảnh nào để xem ngẫu nhiên', 'error');
      return;
    }
    const i = Math.floor(Math.random() * filtered.length);
    openLightbox(i);
  });

  // Quét lại ảnh từ Cloudinary
  $('btnRefresh').addEventListener('click', async () => {
    const btn = $('btnRefresh');
    btn.disabled = true;

    const list = await loadPhotosFromCloudinary();

    if (list && list.length) {
      photos = mergePhotos(list, photos);
      savePhotosToLocal();
      applyFilters();
      renderStats();
      renderAlbumList();
      renderCloudStatus();
      toast('Đã quét: ' + photos.length + ' ảnh ☁️', 'success');
    } else {
      renderCloudStatus();
      toast(
        window.__cldError || 'Cloudinary không trả về ảnh nào (có thể do gói Free)',
        'error'
      );
    }

    btn.disabled = false;
  });

  // Export / Import danh sách ảnh
  if ($('btnExport')) $('btnExport').addEventListener('click', exportPhotos);
  if ($('btnImport')) $('btnImport').addEventListener('click', () => $('importFile').click());
  if ($('importFile')) $('importFile').addEventListener('change', (e) => {
    importPhotos(e.target.files[0]);
    e.target.value = '';
  });

  // Xem thêm
  $('btnLoadMore').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderGallery();
  });

  // Modal upload
  $('btnPick').addEventListener('click', (e) => {
    e.stopPropagation();
    $('fileInput').click();
  });
  $('dropzone').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  });
  $('modalClose').addEventListener('click', closeUploadModal);
  $('btnCancelUpload').addEventListener('click', closeUploadModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeUploadModal);
  $('btnDoUpload').addEventListener('click', doUpload);

  // Drag & drop
  const dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(ev =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); })
  );
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  // Lightbox
  $('lbClose').addEventListener('click', closeLightbox);
  $('lbPrev').addEventListener('click', () => navigateLightbox(-1));
  $('lbNext').addEventListener('click', () => navigateLightbox(1));
  $('lbDelete').addEventListener('click', deleteCurrentPhoto);
  $('lightbox').addEventListener('click', (e) => {
    if (e.target === $('lightbox')) closeLightbox();
  });

  // Phím tắt
  document.addEventListener('keydown', (e) => {
    if (!$('lightbox').hidden) {
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    }
    if (!$('uploadModal').hidden && e.key === 'Escape') closeUploadModal();
  });

  // Lưu Cloud Name từ ô trong modal
  $('btnSaveCloud').addEventListener('click', saveCloudNameFromInput);
  $('cloudNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCloudNameFromInput();
  });

  // Lưu API Key + Secret từ ô trong modal
  $('btnSaveKeys').addEventListener('click', saveCloudKeysFromInput);

  // Dùng cấu hình có sẵn trong data/config.json
  const btnDefault = $('btnUseDefaultCloud');
  if (btnDefault) {
    btnDefault.addEventListener('click', useDefaultCloudConfig);
  }
}

/**
 * Nạp cấu hình Cloudinary từ data/config.json và lưu vào localStorage.
 * Dùng khi người dùng không muốn tự nhập tay.
 */
async function useDefaultCloudConfig() {
  try {
    const res = await fetch(CONFIG.configUrl + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const cfg = await res.json();

    if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
      toast('data/config.json chưa đủ thông tin', 'error');
      return;
    }

    CONFIG.cloudName = cfg.cloudName.trim();
    CONFIG.apiKey = cfg.apiKey.trim();
    CONFIG.apiSecret = cfg.apiSecret.trim();
    if (cfg.uploadPreset) CONFIG.uploadPreset = cfg.uploadPreset.trim();

    try {
      localStorage.setItem('CLOUDINARY_NAME', CONFIG.cloudName);
      localStorage.setItem('CLOUDINARY_KEY', CONFIG.apiKey);
      localStorage.setItem('CLOUDINARY_SECRET', CONFIG.apiSecret);
    } catch (err) { /* localStorage bị chặn -> không sao */ }

    $('cloudSetup').hidden = true;

    toast('Đã dùng cấu hình có sẵn ✓', 'success');

    // Đọc lại danh sách ảnh ngay
    await loadPhotos();
  } catch (err) {
    toast('Không đọc được data/config.json: ' + err.message, 'error');
  }
}

/**
 * Lưu Cloud Name đã nhập trong modal.
 * Ghi vào localStorage để nhớ qua các lần tải trang,
 * và khuyến nghị lưu vào data/config.json để dùng lâu dài.
 */
function saveCloudNameFromInput() {
  const name = $('cloudNameInput').value.trim();

  if (!name) {
    toast('Vui lòng nhập Cloud Name', 'error');
    return;
  }

  CONFIG.cloudName = name;

  try {
    localStorage.setItem('CLOUDINARY_NAME', name);
  } catch (err) {
    // localStorage bị chặn -> không sao, vẫn dùng được trong phiên này
  }

  toast('Đã lưu Cloud Name: ' + name, 'success');
}

/**
 * Lưu API Key + Secret để đọc lại danh sách ảnh sau khi reload.
 */
function saveCloudKeysFromInput() {
  const key = $('apiKeyInput').value.trim();
  const secret = $('apiSecretInput').value.trim();

  if (!key || !secret) {
    toast('Cần đủ API Key và API Secret', 'error');
    return;
  }

  CONFIG.apiKey = key;
  CONFIG.apiSecret = secret;

  try {
    localStorage.setItem('CLOUDINARY_KEY', key);
    localStorage.setItem('CLOUDINARY_SECRET', secret);
  } catch (err) {
    // bỏ qua
  }

  toast('Đã lưu API Key/Secret 🔑', 'success');

  // Đọc lại danh sách ảnh ngay
  loadPhotosFromCloudinary().then(list => {
    if (list && list.length) {
      photos = list;
      applyFilters();
      renderStats();
      renderAlbumList();
      toast('Đã tải ' + list.length + ' ảnh từ Cloudinary ☁️', 'success');
    } else {
      toast('Không tìm thấy ảnh nào trên Cloudinary', 'error');
    }
  });
}

/* ==========================================================
   HIỆU ỨNG TRÁI TIM BAY
   ========================================================== */

function startHearts() {
  const wrap = $('hearts');
  const icons = ['💗', '💖', '💕', '🌸', '✨', '💝'];
  const count = 16;

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = icons[Math.floor(Math.random() * icons.length)];
    heart.style.left = Math.random() * 100 + '%';
    heart.style.fontSize = (12 + Math.random() * 16) + 'px';
    heart.style.animationDuration = (11 + Math.random() * 12) + 's';
    heart.style.animationDelay = (-Math.random() * 20) + 's';
    wrap.appendChild(heart);
  }
}

/* ==========================================================
   LOAD DỮ LIỆU
   ========================================================== */

/**
 * Kiểm kê ảnh — 3 tầng nguồn dữ liệu:
 *
 *   1. localStorage   → ảnh đã upload trên CHÍNH máy này (tức thì, luôn đúng)
 *   2. Cloudinary API → đọc ảnh đã upload (cần API Key/Secret có quyền đọc)
 *   3. gallery.json   → dữ liệu mẫu / dữ liệu đã export từ máy khác
 *
 * Ghi chú: Cloudinary Free plan / môi trường Test có thể không cho đọc
 * resources qua Admin API. Vì vậy localStorage luôn được ưu tiên cao nhất,
 * và có thêm chức năng Export/Import để đồng bộ giữa các thiết bị.
 */
async function loadPhotos() {
  const sources = [];

  // Tầng 1: localStorage (ảnh đã upload trên máy này)
  const local = loadPhotosFromLocal();
  if (local && local.length) {
    photos = local;
    sources.push('localStorage (' + local.length + ')');
  }

  // Tầng 2: Cloudinary Admin API
  const fromCloud = await loadPhotosFromCloudinary();
  if (fromCloud && fromCloud.length) {
    // Gộp: ảnh từ cloud + ảnh chỉ có ở local (không trùng public_id)
    photos = mergePhotos(fromCloud, photos);
    sources.push('Cloudinary (' + fromCloud.length + ')');
  }

  // Tầng 3: gallery.json (chỉ khi chưa có gì)
  if (!photos.length) {
    try {
      const res = await fetch(CONFIG.dataUrl + '?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      photos = Array.isArray(data) ? data : (data.photos || []);
      sources.push('gallery.json (' + photos.length + ')');
    } catch (err) {
      console.warn('Không đọc được data/gallery.json:', err);
      photos = [];
    }
  }

  console.info('📚 Nguồn ảnh:', sources.join(' + ') || 'không có');
  console.info('📸 photos.length =', photos.length, '| filtered.length =', filtered.length);

  applyFilters();
  renderStats();
  renderAlbumList();
  renderCloudStatus();
  renderExportBar();
}

/**
 * Đọc ảnh đã lưu trong localStorage của máy này.
 */
function loadPhotosFromLocal() {
  try {
    const raw = localStorage.getItem('LOVE_GALLERY_PHOTOS');
    if (!raw) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch (err) {
    console.warn('localStorage lỗi:', err);
    return null;
  }
}

/**
 * Lưu danh sách ảnh vào localStorage để không mất khi reload.
 */
function savePhotosToLocal() {
  try {
    localStorage.setItem('LOVE_GALLERY_PHOTOS', JSON.stringify(photos));
    return true;
  } catch (err) {
    console.warn('Không lưu được localStorage:', err);
    return false;
  }
}

/**
 * Gộp 2 danh sách ảnh, ưu tiên bản có đầy đủ metadata hơn.
 */
function mergePhotos(primary, secondary) {
  const map = new Map();

  (secondary || []).forEach(p => {
    if (p && p.id) map.set(p.id, p);
  });

  (primary || []).forEach(p => {
    if (!p || !p.id) return;
    const old = map.get(p.id);
    map.set(p.id, {
      ...old,
      ...p,
      note: p.note || (old ? old.note : ''),
      date: p.date || (old ? old.date : ''),
      album: p.album || (old ? old.album : '')
    });
  });

  return [...map.values()].sort((a, b) =>
    String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || ''))
  );
}

/* ==========================================================
   EXPORT / IMPORT — đồng bộ ảnh giữa các thiết bị
   ========================================================== */

/**
 * Tải danh sách ảnh về máy (file JSON).
 * Cách này dùng để đưa ảnh đã upload sang thiết bị khác,
 * hoặc dán vào data/gallery.json trên GitHub.
 */
function exportPhotos() {
  if (!photos.length) {
    toast('Chưa có ảnh nào để xuất', 'error');
    return;
  }

  const data = JSON.stringify(photos, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'gallery-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  toast('Đã xuất ' + photos.length + ' ảnh 💾', 'success');
}

/**
 * Nhập danh sách ảnh từ file JSON (do export ra hoặc copy từ gallery.json).
 */
function importPhotos(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const list = Array.isArray(data) ? data : (data.photos || []);

      if (!list.length) {
        toast('File không có ảnh nào', 'error');
        return;
      }

      photos = mergePhotos(list, photos);
      savePhotosToLocal();
      applyFilters();
      renderStats();
      renderAlbumList();

      toast('Đã nhập ' + list.length + ' ảnh 📥', 'success');
    } catch (err) {
      toast('File JSON không hợp lệ: ' + err.message, 'error');
    }
  };

  reader.readAsText(file);
}

/**
 * Hiện thanh công cụ Export/Import khi đã có ảnh.
 */
function renderExportBar() {
  const bar = $('syncBar');
  if (!bar) return;
  bar.hidden = !photos.length;
  $('syncCount').textContent = photos.length;
}

/**
 * Hiện cảnh báo nếu Cloudinary chưa trả về ảnh nào.
 * Giúp biết ngay là Cloud Name sai hay API Key sai.
 */
function renderCloudStatus() {
  let el = $('cloudStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cloudStatus';
    el.className = 'cloud-status';
    $('toolbar').appendChild(el);
  }

  const err = window.__cldError;

  if (err && !photos.length) {
    el.hidden = false;
    el.innerHTML =
      '⚠️ <b>Chưa đọc được ảnh từ Cloudinary.</b> ' + err +
      ' &nbsp;|&nbsp; Nếu bạn đang mở bằng <code>file://</code> hoặc chạy local, ' +
      'hãy deploy lên Vercel (trang đó có <code>/api/photos</code> proxy sẵn).';
  } else if (err && photos.length) {
    el.hidden = false;
    el.innerHTML =
      '⚠️ Cloudinary: ' + err +
      ' &nbsp;|&nbsp; Đang hiển thị ảnh từ <code>gallery.json</code>. ' +
      'Ảnh bạn upload mới sẽ không hiện cho tới khi sửa xong.';
  } else {
    el.hidden = true;
  }
}

/**
 * Đọc danh sách ảnh từ Cloudinary.
 *
 * Ưu tiên 1: /api/photos  — Serverless Function của Vercel proxy tới Cloudinary
 *                      Admin API (CORS OK vì chạy server-side).
 * Ưu tiên 2: gọi thẳng Cloudinary Admin API — dùng được khi chạy local
 *                      hoặc nếu Cloudinary bổ sung CORS.
 *
 * Trả về null nếu không đọc được, [] nếu cloud không có ảnh.
 */
async function loadPhotosFromCloudinary() {
  if (!CONFIG.cloudName) return null;

  const data = await fetchCloudinaryPhotos();
  if (!data) return null;

  const resources = data.resources || [];

  if (!resources.length) {
    console.warn(
      '⚠️ Cloud "' + CONFIG.cloudName + '" không có ảnh nào (total=' + data.total_count + ').'
    );
    window.__cldError = 'Cloud "' + CONFIG.cloudName + '" không có ảnh nào. Có thể Cloud Name sai.';
  } else {
    window.__cldError = null;
    console.info('☁️  Cloudinary trả về', resources.length, 'ảnh');
  }

  return resources
    .map(r => normalizeCloudinaryResource(r))
    .filter(Boolean)
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
}

/**
 * Thử đọc danh sách ảnh qua proxy /api/photos, sau đó fallback gọi thẳng.
 */
async function fetchCloudinaryPhotos() {
  // 1. Serverless proxy (Vercel) — không bị CORS
  try {
    const res = await fetch('/api/photos?t=' + Date.now(), { cache: 'no-store' });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.resources)) {
        console.info('📡 Đọc ảnh qua /api/photos');
        return data;
      }
    } else {
      console.warn('⚠️ /api/photos trả về HTTP', res.status, '- thử gọi thẳng Cloudinary');
    }
  } catch (err) {
    console.warn('⚠️ Không gọi được /api/photos:', err.message);
  }

  // 2. Gọi thẳng Cloudinary Admin API (chạy local hoặc Cloudinary bật CORS)
  if (!CONFIG.apiKey || !CONFIG.apiSecret) return null;

  const auth = 'Basic ' + btoa(CONFIG.apiKey + ':' + CONFIG.apiSecret);
  const base = `https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/resources/image`;
  const query = '?tags=true&context=true&max_results=500';

  try {
    let res = await fetch(base + query + '&folder=lovegallery', {
      headers: { 'Authorization': auth }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('❌ Cloudinary Admin API lỗi:', res.status, body.substring(0, 200));
      window.__cldError = 'HTTP ' + res.status + ' — kiểm tra lại API Key/Secret';
      return null;
    }

    let data = await res.json();

    // Nếu folder rỗng thì lấy toàn bộ ảnh trong cloud
    if (!data.resources || !data.resources.length) {
      res = await fetch(base + query, { headers: { 'Authorization': auth } });
      if (!res.ok) {
        window.__cldError = 'HTTP ' + res.status + ' — kiểm tra lại API Key/Secret';
        return null;
      }
      data = await res.json();
    }

    return data;
  } catch (err) {
    console.warn('❌ Không gọi được Cloudinary Admin API:', err.message);
    window.__cldError = err.message + ' (CORS — cần deploy lên Vercel để dùng /api/photos)';
    return null;
  }
}

/**
 * Chuyển 1 resource của Cloudinary về format ảnh của web.
 *
 * Cấu trúc `context` của Cloudinary REST API:
 *   {
 *     "custom": { "note": "...", "date": "...", "album": "..." },
 *     "caption": "...", "alt": "..."
 *   }
 * Ngoài ra có thể là chuỗi "k=v|k=v" tuỳ phiên bản.
 */
function normalizeCloudinaryResource(r) {
  if (!r || !r.secure_url) return null;

  let note = '';
  let date = '';
  let album = '';

  // 1. Dạng object: context.custom.* hoặc context.* trực tiếp
  const ctx = r.context;

  if (ctx && typeof ctx === 'object') {
    const src = (ctx.custom && typeof ctx.custom === 'object') ? ctx.custom : ctx;

    note  = src.note  || src.caption || '';
    date  = src.date  || '';
    album = src.album || '';
  }

  // 2. Dạng chuỗi "k=v|k=v" (một số phiên bản SDK trả về)
  if (!note && typeof ctx === 'string') {
    ctx.split('|').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx < 0) return;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k === 'note')  note = v;
      if (k === 'date')  date = v;
      if (k === 'album') album = v;
    });
  }

  // 3. Fallback: dùng tag làm album (bỏ các tag hệ thống)
  const SYSTEM_TAGS = ['uploaded', 'lovegallery', 'public_id', 'context', 'metadata'];
  if (!album && Array.isArray(r.tags) && r.tags.length) {
    album = r.tags.find(t => !SYSTEM_TAGS.includes(t)) || '';
  }

  // 4. Fallback: dùng tên file làm ghi chú
  if (!note) note = r.display_name || r.original_filename || '';

  return {
    id: r.public_id,
    url: r.secure_url,
    filename: r.original_filename || r.public_id,
    note: note,
    date: date,
    album: album,
    uploadedAt: r.created_at || r.uploaded_at || ''
  };
}

function renderStats() {
  $('statPhotos').textContent = photos.length;

  const albums = new Set(photos.map(p => p.album).filter(Boolean));
  $('statAlbums').textContent = albums.size;

  const dates = photos.map(p => p.date).filter(Boolean).sort();
  if (dates.length) {
    const d = new Date(dates[0]);
    $('statSince').textContent = d.toLocaleDateString('vi-VN', {
      month: '2-digit', year: 'numeric'
    });
    $('footerSub').textContent =
      'Từ ' + d.toLocaleDateString('vi-VN') + ' đến nay — ' + photos.length + ' khoảnh khắc đã lưu 💗';
  }
}

/* ==========================================================
   LỌC & TÌM KIẾM
   ========================================================== */

function applyFilters() {
  filtered = photos.filter((p) => {
    // Lọc theo album
    if (currentAlbum !== 'all' && p.album !== currentAlbum) return false;

    // Tìm kiếm
    if (searchTerm) {
      const haystack = [
        p.note, p.album, p.date,
        p.filename
      ].filter(Boolean).join(' ').toLowerCase();

      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  visibleCount = PAGE_SIZE;
  renderGallery();
  renderFilters();
}

function renderFilters() {
  const albums = [...new Set(photos.map(p => p.album).filter(Boolean))].sort();
  const box = $('filters');

  const chips = [{ key: 'all', label: '🌸 Tất cả', count: photos.length }];
  albums.forEach(a => {
    chips.push({
      key: a,
      label: a,
      count: photos.filter(p => p.album === a).length
    });
  });

  box.innerHTML = '';
  chips.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (currentAlbum === c.key ? ' active' : '');
    btn.textContent = c.label + ' (' + c.count + ')';
    btn.addEventListener('click', () => {
      currentAlbum = c.key;
      applyFilters();
      window.scrollTo({ top: $('toolbar').offsetTop - 10, behavior: 'smooth' });
    });
    box.appendChild(btn);
  });
}

function renderAlbumList() {
  const albums = [...new Set(photos.map(p => p.album).filter(Boolean))].sort();
  const list = $('albumList');
  list.innerHTML = '';
  albums.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    list.appendChild(opt);
  });
}

/* ==========================================================
   RENDER LƯỚI ẢNH
   ========================================================== */

function renderGallery() {
  const gallery = $('gallery');
  const empty = $('emptyState');
  const noRes = $('noResult');
  const loadMore = $('loadMoreWrap');

  gallery.innerHTML = '';

  // Chưa có ảnh nào
  if (!photos.length) {
    gallery.hidden = true;
    empty.hidden = false;
    noRes.hidden = true;
    loadMore.hidden = true;
    return;
  }

  empty.hidden = true;

  // Có ảnh nhưng không tìm thấy
  if (!filtered.length) {
    gallery.hidden = true;
    noRes.hidden = false;
    loadMore.hidden = true;
    return;
  }

  noRes.hidden = true;
  gallery.hidden = false;

  const slice = filtered.slice(0, visibleCount);

  slice.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = Math.min(i * 22, 500) + 'ms';

    // Ảnh thumbnail (dùng biến thể w_600 của Cloudinary để load nhanh)
    const img = document.createElement('img');
    img.className = 'card-img';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = cloudinaryUrl(p.url, 'w_600,q_auto,f_auto');
    img.alt = p.note || 'Ảnh khoảnh khắc';
    img.onerror = function () {
      this.onerror = null;
      this.src = p.url;   // fallback về ảnh gốc
    };

    card.appendChild(img);

    // Badge album
    if (p.album) {
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = p.album;
      card.appendChild(badge);
    }

    // Overlay ghi chú
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    if (p.note) {
      const note = document.createElement('p');
      note.className = 'card-note';
      note.textContent = p.note;
      overlay.appendChild(note);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    if (p.date) {
      const d = document.createElement('span');
      d.textContent = formatDate(p.date);
      meta.appendChild(d);
    }
    if (p.note && p.date) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '•';
      meta.appendChild(sep);
    }
    const zoom = document.createElement('span');
    zoom.textContent = '🔍 Xem rõ nét';
    meta.appendChild(zoom);
    overlay.appendChild(meta);

    card.appendChild(overlay);

    card.addEventListener('click', () => openLightbox(i));

    gallery.appendChild(card);
  });

  // Nút xem thêm
  loadMore.hidden = visibleCount >= filtered.length;
}

/* ==========================================================
   LIGHTBOX
   ========================================================== */

function openLightbox(index) {
  currentIndex = index;
  const p = filtered[index];
  if (!p) return;

  const lb = $('lightbox');
  lb.hidden = false;
  document.body.style.overflow = 'hidden';

  // Hiện spinner trong lúc ảnh gốc tải
  const img = $('lbImage');
  const spinner = $('lbSpinner');
  spinner.classList.add('show');
  img.style.opacity = '0';

  img.onload = () => {
    spinner.classList.remove('show');
    img.style.opacity = '1';
  };
  img.onerror = () => {
    spinner.classList.remove('show');
    img.style.opacity = '1';
  };

  // Ảnh bản gốc — dùng q_auto,f_auto để vừa sắc nét vừa nhẹ
  img.src = cloudinaryUrl(p.url, 'q_auto,f_auto');
  img.alt = p.note || 'Ảnh khoảnh khắc';

  $('lbNote').textContent = p.note || '';
  $('lbNote').hidden = !p.note;

  $('lbDate').textContent = p.date ? formatDate(p.date) : '';
  $('lbDate').hidden = !p.date;

  $('lbAlbum').textContent = p.album || '';
  $('lbAlbum').hidden = !p.album;

  const dl = $('lbDownload');
  dl.href = p.url;
  dl.download = (p.filename || 'photo') + (p.note ? '_' + slugify(p.note) : '');

  $('lbShare').href = p.url;

  // Ẩn nút mũi tên nếu chỉ có 1 ảnh
  const multi = filtered.length > 1;
  $('lbPrev').hidden = !multi;
  $('lbNext').hidden = !multi;
}

function navigateLightbox(direction) {
  if (!filtered.length) return;
  currentIndex = (currentIndex + direction + filtered.length) % filtered.length;
  openLightbox(currentIndex);
}

function closeLightbox() {
  $('lightbox').hidden = true;
  document.body.style.overflow = '';
  currentIndex = -1;
}

/* ==========================================================
   XÓA ẢNH
   ========================================================== */

/**
 * Xóa ảnh đang xem trong lightbox.
 *
 * Quy trình:
 *   1. Hỏi xác nhận người dùng
 *   2. Gọi /api/delete để xóa thật trên Cloudinary (nếu ảnh nằm trên Cloudinary)
 *   3. Xóa khỏi mảng photos + localStorage
 *   4. Render lại gallery
 */
async function deleteCurrentPhoto() {
  if (currentIndex < 0 || !filtered[currentIndex]) return;

  const p = filtered[currentIndex];
  const label = p.note ? `"${p.note}"` : (p.filename || 'ảnh này');

  const ok = await confirmDialog(
    'Xóa ảnh?',
    `Bạn có chắc muốn xóa ${label}? Ảnh sẽ bị xóa vĩnh viễn trên Cloudinary và không thể khôi phục.`,
    'Xóa'
  );

  if (!ok) return;

  const btn = $('lbDelete');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Đang xóa...';

  const isCloudinary = p.url && p.url.includes('res.cloudinary.com');

  try {
    if (isCloudinary && p.id) {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: p.id })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
        throw new Error(msg);
      }

      // Cloudinary trả { deleted: { "public_id": "ok" } } hoặc { deleted: [...] }
      const deleted = data.deleted;
      const failed = data.not_found || [];

      if (deleted && typeof deleted === 'object' && !Array.isArray(deleted)) {
        const status = deleted[p.id];
        if (status === 'not found') {
          throw new Error('Ảnh không còn trên Cloudinary (có thể đã xóa trước đó)');
        }
      }
    }

    // Xóa khỏi bộ nhớ + localStorage
    photos = photos.filter(x => x.id !== p.id);
    savePhotosToLocal();

    // Đóng lightbox, rồi render lại (applyFilters lọc lại filtered từ photos)
    closeLightbox();
    applyFilters();
    renderStats();
    renderAlbumList();

    toast('Đã xóa ảnh 🗑', 'success');
  } catch (err) {
    console.error('❌ Xóa ảnh lỗi:', err);
    toast('Không xóa được: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

/**
 * Hộp thoại xác nhận (thay thế window.confirm cho đẹp hơn).
 * Trả về Promise<boolean>.
 */
function confirmDialog(title, message, okText) {
  return new Promise(resolve => {
    // Tạo modal nếu chưa có
    let overlay = $('confirmOverlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirmOverlay';
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box" role="dialog" aria-modal="true">
          <h3 class="confirm-title"></h3>
          <p class="confirm-msg"></p>
          <div class="confirm-actions">
            <button class="btn btn-soft" data-act="cancel">Hủy</button>
            <button class="btn btn-danger btn-danger-solid" data-act="ok"></button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') { close(true); }
        else if (act === 'cancel' || e.target === overlay) { close(false); }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) { close(false); }
      });
    }

    function close(result) {
      overlay.hidden = true;
      resolve(result);
    }

    overlay.querySelector('.confirm-title').textContent = title;
    overlay.querySelector('.confirm-msg').textContent = message;
    overlay.querySelector('[data-act="ok"]').textContent = okText || 'Xác nhận';
    overlay.hidden = false;
  });
}

/* ==========================================================
   UPLOAD
   ========================================================== */

function openUploadModal() {
  $('uploadModal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('dropzone').hidden = false;
  $('uploadForm').hidden = true;
  $('noteInput').value = '';
  $('dateInput').value = new Date().toISOString().slice(0, 10);
  $('albumInput').value = currentAlbum !== 'all' ? currentAlbum : '';

  // Hiện ô cấu hình Cloudinary nếu chưa đủ thông tin
  const needSetup = !CONFIG.cloudName || !CONFIG.apiKey || !CONFIG.apiSecret;
  $('cloudSetup').hidden = !needSetup;

  if (needSetup) {
    $('cloudNameInput').value = CONFIG.cloudName || '';
    $('apiKeyInput').value = CONFIG.apiKey || '';
    $('apiSecretInput').value = CONFIG.apiSecret || '';
  }
}
function closeUploadModal() {
  $('uploadModal').hidden = true;
  document.body.style.overflow = '';
  pendingFiles = [];
  renderPreviews();
}

function addFiles(fileList) {
  const files = Array.from(fileList);

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      toast(`"${file.name}" không phải là ảnh`, 'error');
      continue;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast(`"${file.name}" vượt quá ${MAX_FILE_MB}MB`, 'error');
      continue;
    }
    pendingFiles.push(file);
  }

  if (pendingFiles.length) {
    $('dropzone').hidden = true;
    $('uploadForm').hidden = false;
    renderPreviews();
  }
}

function renderPreviews() {
  const row = $('previewRow');
  row.innerHTML = '';

  pendingFiles.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.textContent = '×';
    rm.title = 'Bỏ ảnh này';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingFiles.splice(i, 1);
      renderPreviews();
      if (!pendingFiles.length) {
        $('dropzone').hidden = false;
        $('uploadForm').hidden = true;
      }
    });

    item.appendChild(img);
    item.appendChild(rm);
    row.appendChild(item);
  });

  $('uploadBtnText').textContent = pendingFiles.length
    ? `Tải lên ${pendingFiles.length} ảnh`
    : 'Tải lên';
}

async function doUpload() {
  if (!pendingFiles.length) {
    toast('Hãy chọn ảnh trước nhé', 'error');
    return;
  }

  if (!CONFIG.cloudName) {
    toast(
      'Chưa cấu hình Cloudinary. Mở Console (F12) và chạy: ' +
      "window.setCloudName('Tên cloud của bạn')",
      'error'
    );
    return;
  }

  const note = $('noteInput').value.trim();
  const date = $('dateInput').value;
  const album = $('albumInput').value.trim();
  const btn = $('btnDoUpload');
  btn.disabled = true;

  const uploaded = [];

  for (let i = 0; i < pendingFiles.length; i++) {
    $('uploadBtnText').textContent = `Đang tải ${i + 1}/${pendingFiles.length}...`;

    try {
      const result = await uploadToCloudinary(pendingFiles[i], note, date, album);
      uploaded.push(result);
    } catch (err) {
      console.error(err);
      toast(`Lỗi khi tải "${pendingFiles[i].name}": ${err.message}`, 'error');
    }
  }

  btn.disabled = false;
  $('uploadBtnText').textContent = 'Tải lên';

  if (!uploaded.length) return;

  // Thêm vào danh sách (mới nhất lên đầu)
  photos = uploaded.concat(photos);

  // Lưu vào localStorage → reload không bị mất
  savePhotosToLocal();

  closeUploadModal();
  currentAlbum = 'all';
  applyFilters();
  renderStats();
  renderAlbumList();
  renderExportBar();

  toast(`Đã thêm ${uploaded.length} ảnh vào thư viện 💕`, 'success');

  // Nhắc nhở cách lưu metadata lâu dài
  console.info(
    '💡 Ảnh đã lên Cloudinary kèm ghi chú/ngày/album.\n' +
    '   Ảnh đã lưu trong trình duyệt này (không mất khi reload).\n' +
    '   Để dùng trên máy khác: bấm nút "Xuất ảnh" rồi mở file JSON,\n' +
    '   hoặc dán vào data/gallery.json trên GitHub.'
  );
}

/**
 * Escape ký tự đặc biệt của Cloudinary context.
 * Cloudinary dùng `|` làm dấu phân cách và `=` trong key/value,
 * nên phải escape bằng backslash.
 */
function escapeContextValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/=/g, '\\=')
    .replace(/[\r\n]/g, ' ');
}

/**
 * Upload 1 file lên Cloudinary.
 * Trả về object metadata theo đúng format của gallery.json
 */
function uploadToCloudinary(file, note, date, album) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.uploadPreset);

    // Ghi chú / ngày / album lưu kèm trong Cloudinary (context)
    if (note || date || album) {
      const ctx = [
        'note=' + escapeContextValue(note),
        'date=' + escapeContextValue(date),
        'album=' + escapeContextValue(album)
      ].join('|');
      formData.append('context', ctx);
    }

    // Gom ảnh vào folder riêng cho dễ quản lý trong Media Library
    formData.append('folder', 'lovegallery');

    // Lưu album thành tag → dễ lọc trong Media Library
    if (album) {
      formData.append('tags', escapeContextValue(album) + ',lovegallery');
    } else {
      formData.append('tags', 'lovegallery');
    }

    // Tự động nén + tối ưu
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');

    fetch(url, { method: 'POST', body: formData })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          reject(new Error(data.error.message || data.error));
          return;
        }
        resolve({
          id: data.public_id,
          url: data.secure_url,
          filename: file.name,
          note: note || '',
          date: date || '',
          album: album || '',
          uploadedAt: new Date().toISOString()
        });
      })
      .catch(err => reject(err));
  });
}

/**
 * Cố gắng lưu metadata. Với static hosting (Vercel/GitHub Pages) không ghi được
 * file server, nên hàm này sẽ báo hướng dẫn lưu thủ công vào data/gallery.json.
 */

/* ==========================================================
   TIỆN ÍCH
   ========================================================== */

/**
 * Chèn biến thể Cloudinary vào URL.
 * Nếu URL không phải Cloudinary, trả về nguyên bản.
 */
function cloudinaryUrl(url, transformation) {
  if (!url) return '';
  if (!url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/${transformation}/`);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Hiển thị thông báo nhỏ góc dưới màn hình.
 */
function toast(message, type = '') {
  const wrap = $('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  wrap.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
