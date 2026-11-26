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
let confirmResolver = null; // resolver của hộp thoại xác nhận (dùng chung)

// Khi đang thêm ảnh vào 1 album cụ thể (không null = gom vào album đó)
let uploadTargetGroupId = null;
let uploadTargetGroupTitle = '';

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

  // Cánh cổng kỷ niệm — phải qua đăng nhập mới vào được trang chính
  initGate();

  // Dữ liệu dùng chung (time capsule, cảm xúc) — tải sẵn
  loadSharedData();

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
    btn.title = 'Đang quét...';

    try {
      // Dùng loadPhotos() để Cloudinary là nguồn quyết định:
      // ảnh đã xóa trong Media Library sẽ biến mất khỏi web.
      await loadPhotos();

      if (window.__cldError) {
        toast('Không đọc được Cloudinary: ' + window.__cldError, 'error');
      } else {
        toast('Đã quét: ' + photos.length + ' ảnh ☁️', 'success');
      }
    } catch (err) {
      toast('Lỗi khi quét: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.title = 'Quét lại ảnh từ Cloudinary';
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

  // Album view
  $('albumClose').addEventListener('click', closeAlbum);
  $('albumView').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-album')) closeAlbum();
  });
  $('btnEditAlbum').addEventListener('click', () => toggleAlbumEdit());
  $('btnCancelAlbumEdit').addEventListener('click', () => toggleAlbumEdit(false));
  $('btnSaveAlbumEdit').addEventListener('click', saveAlbumEdit);
  $('btnDeleteAlbum').addEventListener('click', deleteAlbum);
  $('btnAddToAlbum').addEventListener('click', startAddToAlbum);

  // ======== Tính năng mở rộng =====
  bindGate();

  // Đổi người đang đăng nhập
  if ($('btnSwitchUser')) $('btnSwitchUser').addEventListener('click', switchUser);

  // Nút thêm time capsule
  if ($('btnAddCapsule')) $('btnAddCapsule').addEventListener('click', addCapsule);

  // Đĩa nhạc
  bindMusic();

  // Chọn người đăng trong form upload
  document.querySelectorAll('#authorPicker .author-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#authorPicker .author-btn')
        .forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  // Nút thả cảm xúc trong lightbox
  document.querySelectorAll('.react-btn').forEach(b => {
    b.addEventListener('click', () => {
      addReaction(b.getAttribute('data-react'), '');
    });
  });

  // Gửi lời hồi đáp
  if ($('reactForm')) {
    $('reactForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('reactInput');
      const text = input.value.trim();
      if (!text) return;
      addReaction('', text);
      input.value = '';
    });
  }

  // Phím tắt
  document.addEventListener('keydown', (e) => {
    // Lightbox đang mở → ưu tiên xử lý lightbox
    if (!$('lightbox').hidden) {
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
      return;
    }

    // Album view đang mở → Escape đóng album
    if (!$('albumView').hidden && e.key === 'Escape') {
      closeAlbum();
      return;
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

  // Vẽ lại đường nối timeline khi đổi kích thước màn hình
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const stories = $('stories');
      const svg = stories && stories.querySelector('.timeline-svg');
      const path = svg && svg.querySelector('.timeline-path');
      if (stories && svg && path) drawTimelinePath(stories, svg, path);
    }, 150);
  });
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
 * Kiểm kê ảnh — thứ tự ưu tiên:
 *
 *   1. Cloudinary API → nguồn CHÍNH THÁC. Đây là "sự thật" về ảnh nào còn tồn tại.
 *      Ảnh đã bị xóa trong Cloudinary Media Library sẽ BIẾN MẤT khỏi web.
 *   2. localStorage   → chỉ dùng khi KHÔNG đọc được Cloudinary (chạy local,
 *                      hoặc /api/photos lỗi). Giữ để không mất ảnh vừa upload.
 *   3. gallery.json   → dữ liệu fallback cuối cùng.
 *
 * ⚠️ Trước đây hàm này GỘP localStorage với Cloudinary (mergePhotos) nên ảnh
 * đã xóa trên Cloudinary vẫn hiện trên web. Đã đảo lại: Cloudinary là thứ
 * quyết định, localStorage chỉ là bộ đệm tạm.
 */
async function loadPhotos() {
  const sources = [];

  // Tầng 1: Cloudinary — nguồn chính thức
  const fromCloud = await loadPhotosFromCloudinary();

  // `cloudOk` = đọc Cloudinary THÀNH CÔNG (kể cả khi không còn ảnh nào).
  // Chỉ khi đọc LỖI mới fallback sang localStorage.
  const cloudOk = fromCloud !== null && !window.__cldError;

  if (cloudOk) {
    photos = fromCloud;
    sources.push('Cloudinary (' + fromCloud.length + ')');

    // Dọn ảnh đã bị xóa trên Cloudinary ra khỏi localStorage
    const cloudIds = new Set(fromCloud.map(p => p.id));
    const local = loadPhotosFromLocal() || [];
    const stale = local.filter(p => !cloudIds.has(p.id));

    if (stale.length) {
      const kept = local.filter(p => cloudIds.has(p.id));
      try {
        localStorage.setItem('LOVE_GALLERY_PHOTOS', JSON.stringify(kept));
        console.info('🧹 Đã dọn', stale.length, 'ảnh không còn trên Cloudinary khỏi localStorage');
      } catch (err) { /* bỏ qua */ }
    }
  }

  // Tầng 2: localStorage — chỉ khi Cloudinary KHÔNG đọc được
  if (!cloudOk) {
    const local = loadPhotosFromLocal();
    if (local && local.length) {
      photos = local;
      sources.push('localStorage (' + local.length + ')');
    }
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
      album: p.album || (old ? old.album : ''),
      place: p.place || (old ? old.place : ''),
      author: p.author || (old ? old.author : ''),
      music: p.music || (old ? old.music : ''),
      cover: p.cover || (old ? old.cover : '')
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

  // Cloud rỗng KHÔNG phải lỗi — nghĩa là bạn đã xóa hết ảnh.
  // Chỉ báo lỗi khi thực sự không đọc được.
  window.__cldError = null;

  if (!resources.length) {
    console.info('☁️  Cloud "' + CONFIG.cloudName + '" hiện không có ảnh nào (đã xóa hết?)');
  } else {
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
  let groupId = '';
  let cover = '';
  let place = '';
  let author = '';
  let music = '';

  // 1. Dạng object: context.custom.* hoặc context.* trực tiếp
  const ctx = r.context;

  if (ctx && typeof ctx === 'object') {
    const src = (ctx.custom && typeof ctx.custom === 'object') ? ctx.custom : ctx;

    note    = src.note  || src.caption || '';
    date    = src.date  || '';
    album   = src.album || '';
    groupId = src.gid   || src.groupId || src.group || '';
    cover   = src.cover || src.coverId || '';
    place   = src.place || src.location || '';
    author  = src.author || src.by || '';
    music   = src.music || src.song || '';
  }

  // 2. Dạng chuỗi "k=v|k=v" (một số phiên bản SDK trả về)
  if (!note && typeof ctx === 'string') {
    ctx.split('|').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx < 0) return;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k === 'note')    note = v;
      if (k === 'date')    date = v;
      if (k === 'album')   album = v;
      if (k === 'gid')     groupId = v;
      if (k === 'cover')   cover = v;
      if (k === 'place')   place = v;
      if (k === 'author')  author = v;
      if (k === 'music')   music = v;
    });
  }

  // 3. Fallback: dùng tag làm album (bỏ các tag hệ thống)
  const SYSTEM_TAGS = ['uploaded', 'lovegallery', 'public_id', 'context', 'metadata'];
  if (!album && Array.isArray(r.tags) && r.tags.length) {
    album = r.tags.find(t => !SYSTEM_TAGS.includes(t)) || '';
  }

  // 4. Fallback: dùng tên file làm ghi chú
  if (!note) note = r.display_name || r.original_filename || '';

  // 5. Ảnh cũ (upload trước khi có groupId) → tự gom theo ngày chụp
  if (!groupId) {
    groupId = 'legacy-' + (date || r.created_at || r.public_id);
  }

  return {
    id: r.public_id,
    url: r.secure_url,
    filename: r.original_filename || r.public_id,
    note: note,
    date: date,
    album: album,
    groupId: groupId,
    cover: cover,
    place: place,
    author: author,
    music: music,
    uploadedAt: r.created_at || r.uploaded_at || ''
  };
}

function renderStats() {
  $('statPhotos').textContent = photos.length;

  // Số "câu chuyện" = số nhóm ảnh
  const groups = groupPhotos(photos);
  const statAlbums = document.getElementById('statAlbums');
  if (statAlbums) statAlbums.textContent = groups.length;

  // Đổi nhãn "album" → "câu chuyện"
  const statLabel = statAlbums && statAlbums.nextElementSibling;
  if (statLabel && statLabel.classList.contains('stat-label')) {
    statLabel.textContent = 'câu chuyện';
  }

  const dates = photos.map(p => p.date).filter(Boolean).sort();
  if (dates.length) {
    const d = new Date(dates[0]);
    $('statSince').textContent = d.toLocaleDateString('vi-VN', {
      month: '2-digit', year: 'numeric'
    });
    $('footerSub').textContent =
      'Từ ' + d.toLocaleDateString('vi-VN') + ' đến nay — ' +
      photos.length + ' khoảnh khắc trong ' + groups.length + ' câu chuyện 💗';
  }

  // Danh sách địa điểm kỷ niệm
  if (typeof renderPlaces === 'function') renderPlaces();
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

/**
 * Đánh dấu ảnh đã bị xóa (URL trả 404) — thay bằng placeholder "đã xóa".
 * Ảnh này có thể đã bị xóa trong Cloudinary Media Library.
 */
function markMissing(img, p) {
  img.onerror = null;
  img.removeAttribute('src');
  img.classList.add('card-img-missing');

  const ph = document.createElement('div');
  ph.className = 'card-missing';
  ph.innerHTML = '<span>🗑</span><small>Đã xóa</small>';

  if (p && p.note) {
    const note = document.createElement('small');
    note.className = 'card-missing-note';
    note.textContent = p.note;
    ph.appendChild(note);
  }

  if (img.parentNode) img.parentNode.appendChild(ph);
}

/**
 * Gom ảnh thành các "câu chuyện" (nhóm).
 *
 * Quy tắc:
 *   1. Ảnh có `groupId` (mã lần upload) → gom theo groupId.
 *      → Ảnh upload cùng lúc luôn nằm chung 1 nhóm. ✅
 *   2. Ảnh cũ không có groupId → gom theo album, sau đó theo ngày.
 */
function groupPhotos(list) {
  const map = new Map();

  list.forEach(p => {
    // Ảnh có groupId → nhóm theo groupId
    // Ảnh cũ → nhóm theo album, hoặc theo ngày nếu không có album
    let key;
    if (p.groupId) {
      key = p.groupId;
    } else if (p.album) {
      key = 'album:' + p.album;
    } else if (p.date) {
      key = 'date:' + p.date;
    } else {
      key = 'solo:' + p.id;
    }

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        title: p.album || '',
        note: p.note || '',
        date: p.date || '',
        cover: p.cover || '',
        place: p.place || '',
        music: p.music || '',
        photos: []
      });
    }

    const g = map.get(key);
    g.photos.push(p);

    // Lấy thông tin nhóm từ ảnh đầu tiên có metadata đầy đủ nhất
    if (!g.title && p.album) g.title = p.album;
    if (!g.date && p.date) g.date = p.date;
    if (!g.note && p.note) g.note = p.note;
    if (!g.cover && p.cover) g.cover = p.cover;
    if (!g.place && p.place) g.place = p.place;
    if (!g.music && p.music) g.music = p.music;
  });

  // Ảnh bìa: ưu tiên ảnh được đánh dấu "cover", không thì lấy ảnh đầu tiên
  [...map.values()].forEach(g => {
    if (g.cover) {
      const found = g.photos.find(p => p.id === g.cover);
      if (found) {
        // Đưa ảnh bìa lên đầu danh sách
        g.photos = [found, ...g.photos.filter(p => p.id !== found.id)];
      } else {
        g.cover = '';
      }
    }
  });

  // Sắp xếp nhóm mới nhất lên đầu
  return [...map.values()].sort((a, b) => {
    const ta = a.photos[0]?.uploadedAt || '';
    const tb = b.photos[0]?.uploadedAt || '';
    return (tb || '').localeCompare(ta || '');
  });
}

/**
 * Render danh sách câu chuyện dạng "story grid" — mỗi nhóm là 1 ô lớn
 * với các ảnh con xếp lệch nhau (giống hình Instagram / bảng ghép ảnh).
 */
function renderGallery() {
  const gallery = $('gallery');
  const stories = $('stories');
  const empty = $('emptyState');
  const noRes = $('noResult');
  const loadMore = $('loadMoreWrap');

  gallery.innerHTML = '';
  stories.innerHTML = '';

  // Chưa có ảnh nào
  if (!photos.length) {
    gallery.hidden = true;
    stories.hidden = true;
    empty.hidden = false;
    noRes.hidden = true;
    loadMore.hidden = true;
    return;
  }

  empty.hidden = true;

  // Có ảnh nhưng không tìm thấy
  if (!filtered.length) {
    gallery.hidden = true;
    stories.hidden = true;
    noRes.hidden = false;
    loadMore.hidden = true;
    return;
  }

  noRes.hidden = true;
  gallery.hidden = true;
  stories.hidden = false;
  loadMore.hidden = true;

  const groups = groupPhotos(filtered);

  // --- SVG vẽ đường nét đứt nối các album ---
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'timeline-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  stories.appendChild(svg);

  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'timeline-path');
  svg.appendChild(path);

  groups.forEach((g, gi) => {
    // --- Hàng chứa 1 album ---
    const row = document.createElement('div');
    row.className = 'story-row ' + (gi % 2 === 1 ? 'odd' : 'even');

    // --- Thẻ album (ảnh bìa) ---
    const cell = document.createElement('article');
    cell.className = 'story';
    cell.style.animationDelay = Math.min(gi * 45, 600) + 'ms';
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `Mở album ${g.title || 'câu chuyện'} (${g.photos.length} ảnh)`);

    // Ảnh bìa = ảnh đầu tiên của nhóm
    const cover = document.createElement('div');
    cover.className = 'story-cover';

    const first = g.photos[0];
    if (first) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = cloudinaryUrl(first.url, 'w_500,q_auto,f_auto');
      img.alt = first.note || g.title || 'Ảnh bìa album';
      img.onerror = function () {
        if (this.src !== first.url) {
          this.onerror = null;
          this.src = first.url;
          this.onerror = function () { markMissing(this, first); };
        } else {
          markMissing(this, first);
        }
      };
      cover.appendChild(img);
    }

    // Badge số ảnh
    const badge = document.createElement('span');
    badge.className = 'story-badge';
    badge.textContent = g.photos.length;
    badge.title = g.photos.length + ' ảnh trong album';
    cell.appendChild(badge);

    // Dấu "+" nhỏ dưới thẻ
    const plus = document.createElement('span');
    plus.className = 'story-plus';
    plus.textContent = '+';
    plus.setAttribute('aria-hidden', 'true');
    cell.appendChild(plus);

    cell.appendChild(cover);

    // --- Thông tin album (bên đối diện thẻ) ---
    const info = document.createElement('div');
    info.className = 'story-info';
    info.style.animationDelay = Math.min(gi * 45 + 80, 660) + 'ms';

    const title = document.createElement('h3');
    title.className = 'story-title';
    title.textContent = g.title || 'Khoảnh khắc của chúng mình';
    info.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'story-sub';

    if (g.date) {
      const d = document.createElement('span');
      d.textContent = formatDate(g.date);
      sub.appendChild(d);
    }

    const sep = document.createElement('span');
    sep.textContent = '·';
    sub.appendChild(sep);

    const cnt = document.createElement('span');
    cnt.textContent = g.photos.length + ' ảnh';
    sub.appendChild(cnt);

    info.appendChild(sub);

    // Địa điểm + người đăng + nhạc
    const tags = document.createElement('div');
    tags.className = 'story-tags';

    if (g.place) {
      const pl = document.createElement('span');
      pl.className = 'story-tag place';
      pl.textContent = '📍 ' + g.place;
      tags.appendChild(pl);
    }

    const author = g.photos.find(p => p.author);
    if (author && author.author) {
      const au = document.createElement('span');
      const isAnh = author.author === 'Anh';
      au.className = 'story-tag ' + (isAnh ? 'by-anh' : 'by-gau');
      au.textContent = (isAnh ? '👦 Anh đăng' : '🧸 Bé Yêu đăng');
      tags.appendChild(au);
    }

    if (g.music) {
      const mu = document.createElement('button');
      mu.type = 'button';
      mu.className = 'story-tag music';
      mu.textContent = '🎵 Nhạc kỷ niệm';
      mu.title = g.music;
      mu.addEventListener('click', (e) => {
        e.stopPropagation();
        playAlbumMusic(g.music);
      });
      tags.appendChild(mu);
    }

    if (tags.children.length) info.appendChild(tags);

    if (g.note) {
      const note = document.createElement('p');
      note.className = 'story-note';
      note.textContent = g.note;
      info.appendChild(note);
    }

    // Mở album khi bấm
    const open = () => openAlbum(g.id);
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    row.appendChild(cell);
    row.appendChild(info);
    stories.appendChild(row);
  });

  // --- Nút thêm album ở cuối timeline ---
  const addRow = document.createElement('div');
  addRow.className = 'story-row story-row-add';

  const addBtn = document.createElement('button');
  addBtn.className = 'story-add';
  addBtn.type = 'button';
  addBtn.innerHTML =
    '<span class="story-add-icon">+</span>' +
    '<span>Thêm album</span>';

  addBtn.addEventListener('click', () => {
    uploadTargetGroupId = null;
    uploadTargetGroupTitle = '';
    openUploadModal();
  });

  addRow.appendChild(addBtn);
  stories.appendChild(addRow);

  // Vẽ đường nối sau khi DOM đã có kích thước
  requestAnimationFrame(() => drawTimelinePath(stories, svg, path));
}

/**
 * Vẽ đường nét đứt uốn lượn nối giữa các thẻ album.
 *
 * Cách tính:
 *   - Lấy vị trí giữa mép trong của mỗi thẻ album (điểm mốc)
 *   - Nối bằng đường cong Bezier, xen kẽ trái-phải
 */
function drawTimelinePath(container, svg, path) {
  const rows = [...container.querySelectorAll('.story-row:not(.story-row-add)')];
  const cards = rows.map(r => r.querySelector('.story')).filter(Boolean);
  if (cards.length < 2) {
    path.setAttribute('d', '');
    return;
  }

  const box = container.getBoundingClientRect();
  svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
  svg.setAttribute('width', box.width);
  svg.setAttribute('height', box.height);

  // Thu thap diem moc: noi tiep giua mep trong cua the (huong ve giua man hinh)
  const points = cards.map((card, i) => {
    const r = card.getBoundingClientRect();
    const isOdd = rows[i].classList.contains('odd');
    const x = isOdd ? r.left - box.left : r.right - box.left;
    const y = r.top - box.top + r.height / 2;
    return { x: x, y: y, side: isOdd ? 'left' : 'right' };
  });

  // Duong cong Bezier mem mai: lan ra phia giua roi quay lai
  let d = 'M ' + points[0].x + ' ' + points[0].y;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dy = (cur.y - prev.y) / 2;

    // Ria sang ben trong duong nho, nhung lui xa de duong cong khong gay
    const out1 = prev.side === 'left' ? -70 : 70;
    const out2 = cur.side === 'left' ? -70 : 70;
    const c1x = prev.x + out1;
    const c1y = prev.y + dy * 0.5;
    const c2x = cur.x + out2;
    const c2y = cur.y - dy * 0.5;

    d += ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + cur.x + ' ' + cur.y;
  }

  path.setAttribute('d', d);
}

/* ==========================================================
   ALBUM VIEW (xem 1 câu chuyện / nhóm ảnh)
   ========================================================== */

let currentAlbumId = null;   // id của nhóm đang mở
let albumPhotos = [];         // ảnh trong nhóm đang mở

/**
 * Mở album (nhóm ảnh) — hiển thị dạng modal toàn màn hình.
 */
function openAlbum(groupId) {
  const groups = groupPhotos(filtered);
  const g = groups.find(x => x.id === groupId);
  if (!g) return;

  currentAlbumId = groupId;
  albumPhotos = g.photos;

  $('albumTitle').textContent = g.title || 'Khoảnh khắc của chúng mình';
  $('albumCount').textContent = g.photos.length + ' ảnh';
  $('albumDate').textContent = g.date ? formatDate(g.date) : '';

  // Điền sẵn form sửa
  $('albumEditName').value = g.title || '';
  $('albumEditDate').value = g.date || '';
  $('albumEditNote').value = g.note || '';
  if ($('albumEditPlace')) $('albumEditPlace').value = g.place || '';
  if ($('albumEditMusic')) $('albumEditMusic').value = g.music || '';
  $('albumEdit').hidden = true;

  renderAlbumGrid();

  $('albumView').hidden = false;
  document.body.style.overflow = 'hidden';
}

/**
 * Render lưới ảnh bên trong album.
 */
function renderAlbumGrid() {
  const grid = $('albumGrid');
  grid.innerHTML = '';

  albumPhotos.forEach((p, i) => {
    const cell = document.createElement('figure');
    cell.className = 'album-cell';
    cell.style.animationDelay = Math.min(i * 30, 400) + 'ms';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = cloudinaryUrl(p.url, 'w_800,q_auto,f_auto');
    img.alt = p.note || 'Ảnh khoảnh khắc';
    img.onerror = function () {
      if (this.src !== p.url) {
        this.onerror = null;
        this.src = p.url;
        this.onerror = function () { markMissing(this, p); };
      } else {
        markMissing(this, p);
      }
    };

    cell.appendChild(img);

    // Ghi chú riêng của ảnh (chỉ hiện khi hover - xem CSS)
    if (p.note && p.note !== $('albumEditNote').value) {
      const cap = document.createElement('figcaption');
      cap.textContent = p.note;
      cell.appendChild(cap);
    }

    // Nút "đặt làm ảnh bìa" — chỉ hiện khi hover
    const coverBtn = document.createElement('button');
    coverBtn.type = 'button';
    coverBtn.className = 'album-cell-cover';
    coverBtn.title = 'Đặt ảnh này làm bìa album';
    coverBtn.innerHTML = '⭐ Bìa';
    coverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setAlbumCover(p);
    });
    cell.appendChild(coverBtn);

    // Đánh dấu ảnh đang là bìa
    const groups = groupPhotos(filtered);
    const cur = groups.find(x => x.id === currentAlbumId);
    if (cur && cur.cover === p.id) {
      cell.classList.add('is-cover');
      const tag = document.createElement('span');
      tag.className = 'album-cell-tag';
      tag.textContent = '⭐ Bìa';
      cell.appendChild(tag);
    }

    cell.addEventListener('click', () => openAlbumLightbox(i));

    grid.appendChild(cell);
  });
}

/**
 * Đặt 1 ảnh làm ảnh bìa của album đang mở.
 * Ghi `cover=<public_id>` vào context của TẤT CẢ ảnh trong album.
 */
async function setAlbumCover(photo) {
  if (!currentAlbumId || !photo) return;

  const btn = document.querySelector('.album-cell-cover');
  const oldText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳...'; }

  try {
    const res = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_ids: albumPhotos.map(p => p.id),
        cover: photo.id
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
    }

    // Cập nhật trong bộ nhớ
    albumPhotos.forEach(p => { p.cover = photo.id; });
    photos.forEach(p => {
      if (albumPhotos.some(a => a.id === p.id)) p.cover = photo.id;
    });
    savePhotosToLocal();

    renderAlbumGrid();
    applyFilters();
    renderStats();
    renderAlbumList();

    toast('Đã đặt ảnh làm bìa album ⭐', 'success');
  } catch (err) {
    console.error('❌ Lỗi đặt ảnh bìa:', err);
    toast('Không đặt được bìa: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
  }
}

/**
 * Mở lightbox nhưng chỉ trong phạm vi album đang xem.
 */
function openAlbumLightbox(index) {
  // Tạm đổi filtered sang ảnh của album để lightbox dùng chung logic
  const savedFiltered = filtered;
  filtered = albumPhotos;
  openLightbox(index, () => { filtered = savedFiltered; });
}

/**
 * Đóng album view.
 */
function closeAlbum() {
  $('albumView').hidden = true;
  $('albumEdit').hidden = true;
  document.body.style.overflow = '';
  currentAlbumId = null;
  albumPhotos = [];
}

/**
 * Bắt đầu thêm ảnh vào album đang mở.
 * Ảnh mới sẽ dùng chung groupId → tự động nằm chung 1 câu chuyện.
 */
function startAddToAlbum() {
  if (!currentAlbumId) return;

  uploadTargetGroupId = currentAlbumId;
  uploadTargetGroupTitle = $('albumTitle').textContent;

  // Mở modal upload (album view vẫn mở phía sau)
  openUploadModal();
}

/**
 * Bật/tắt form sửa thông tin album.
 */
function toggleAlbumEdit(show) {
  const box = $('albumEdit');
  box.hidden = show === undefined ? !box.hidden : !show;
  $('btnEditAlbum').textContent = box.hidden ? '✏️ Sửa thông tin' : '✏️ Đang sửa...';
}

/**
 * Lưu thông tin album mới → ghi đè lên tất cả ảnh trong nhóm.
 */
async function saveAlbumEdit() {
  if (!currentAlbumId) return;

  const name = $('albumEditName').value.trim();
  const date = $('albumEditDate').value;
  const note = $('albumEditNote').value.trim();
  const place = $('albumEditPlace') ? $('albumEditPlace').value.trim() : '';
  const music = $('albumEditMusic') ? $('albumEditMusic').value.trim() : '';

  const btn = $('btnSaveAlbumEdit');
  btn.disabled = true;
  btn.textContent = '⏳ Đang lưu...';

  try {
    // Gọi API cập nhật metadata trên Cloudinary cho từng ảnh
    const res = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_ids: albumPhotos.map(p => p.id),
        album: name,
        date: date,
        note: note,
        place: place,
        music: music
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
    }

    // Cập nhật trong bộ nhớ
    albumPhotos.forEach(p => {
      p.album = name;
      p.date = date;
      if (note) p.note = note;
      p.place = place;
      p.music = music;
    });

    // Đồng bộ lại toàn bộ photos (cùng groupId)
    photos.forEach(p => {
      if (p.groupId === currentAlbumId) {
        p.album = name;
        p.date = date;
        if (note) p.note = note;
        p.place = place;
        p.music = music;
      }
    });

    savePhotosToLocal();

    // Render lại
    applyFilters();
    renderStats();
    renderAlbumList();

    $('albumTitle').textContent = name || 'Khoảnh khắc của chúng mình';
    $('albumCount').textContent = albumPhotos.length + ' ảnh';
    $('albumDate').textContent = date ? formatDate(date) : '';
    renderAlbumGrid();

    toggleAlbumEdit(false);
    toast('Đã lưu thông tin album 💾', 'success');
  } catch (err) {
    console.error('❌ Lỗi lưu album:', err);
    toast('Không lưu được: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Lưu';
  }
}

/**
 * Xóa cả album (tất cả ảnh trong nhóm) khỏi Cloudinary.
 */
async function deleteAlbum() {
  if (!currentAlbumId) return;

  const n = albumPhotos.length;
  const title = $('albumTitle').textContent;

  const ok = await confirmDialog(
    'Xóa cả album?',
    `Xóa album "${title}" gồm ${n} ảnh? Tất cả ảnh sẽ bị xóa vĩnh viễn trên Cloudinary và không thể khôi phục.`,
    'Xóa album'
  );

  if (!ok) return;

  const btn = $('btnDeleteAlbum');
  btn.disabled = true;
  btn.textContent = '⏳ Đang xóa...';

  try {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_ids: albumPhotos.map(p => p.id) })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
    }

    // Xóa khỏi bộ nhớ
    const ids = new Set(albumPhotos.map(p => p.id));
    photos = photos.filter(p => !ids.has(p.id));
    savePhotosToLocal();

    closeAlbum();
    applyFilters();
    renderStats();
    renderAlbumList();

    toast('Đã xóa album "' + title + '" 🗑', 'success');
  } catch (err) {
    console.error('❌ Lỗi xóa album:', err);
    toast('Không xóa được: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🗑 Xóa album';
  }
}

/* ==========================================================
   LIGHTBOX
   ========================================================== */

function openLightbox(index, onClose) {
  currentIndex = index;
  const p = filtered[index];
  if (!p) return;

  // Callback sẽ chạy khi đóng lightbox (dùng cho album view)
  window.__lightboxOnClose = onClose || null;

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

  // Địa điểm + người đăng
  const meta = $('lbMeta');
  if (meta) {
    const bits = [];
    if (p.place) bits.push('📍 ' + p.place);
    if (p.author) bits.push(p.author === 'Anh' ? '👦 Anh đăng' : '🧸 Bé Yêu đăng');
    meta.textContent = bits.join('  ·  ');
    meta.hidden = !bits.length;
  }

  // Cảm xúc & hồi đáp
  if (typeof renderReactions === 'function') renderReactions();

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
  openLightbox(currentIndex, window.__lightboxOnClose);
}

function closeLightbox() {
  $('lightbox').hidden = true;
  currentIndex = -1;

  // Gọi callback (khôi phục filtered khi đóng lightbox trong album view)
  const cb = window.__lightboxOnClose;
  window.__lightboxOnClose = null;
  if (cb) {
    try { cb(); } catch (e) { /* bỏ qua */ }
  }

  // Nếu đang ở trong album view → giữ nguyên overflow hidden
  if ($('albumView').hidden) {
    document.body.style.overflow = '';
  }
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

      // Ảnh không còn trên Cloudinary vẫn coi là đã xóa (web cần bỏ nó khỏi list)
      if (data.not_found && data.not_found.includes(p.id)) {
        console.info('ℹ️ Ảnh đã không còn trên Cloudinary:', p.id);
      }
    }

    // Xóa khỏi bộ nhớ + localStorage
    photos = photos.filter(x => x.id !== p.id);
    savePhotosToLocal();

    // Nếu đang ở trong album view → cập nhật album đó
    if (!$('albumView').hidden) {
      albumPhotos = albumPhotos.filter(x => x.id !== p.id);
      if (!albumPhotos.length) {
        closeAlbum();
      } else {
        $('albumCount').textContent = albumPhotos.length + ' ảnh';
        renderAlbumGrid();
      }
    }

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

      // ⚠️ Resolver dùng chung cho MỌI lần gọi.
      // Nếu để closure trong listener thì lần gọi thứ 2 sẽ resolve nhầm
      // promise cũ → promise mới treo vĩnh viễn → thao tác xóa không chạy.
      overlay.addEventListener('click', (e) => {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') { closeConfirm(true); }
        else if (act === 'cancel' || e.target === overlay) { closeConfirm(false); }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) { closeConfirm(false); }
      });
    }

    // Gán resolver hiện tại
    confirmResolver = resolve;

    overlay.querySelector('.confirm-title').textContent = title;
    overlay.querySelector('.confirm-msg').textContent = message;
    overlay.querySelector('[data-act="ok"]').textContent = okText || 'Xác nhận';
    overlay.hidden = false;
  });
}

/**
 * Đóng hộp thoại xác nhận và trả kết quả về promise đang chờ.
 */
function closeConfirm(result) {
  const overlay = $('confirmOverlay');
  if (overlay) overlay.hidden = true;
  const r = confirmResolver;
  confirmResolver = null;
  if (r) r(result);
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

  // Nếu đang thêm ảnh vào một album cụ thể → ghi nhớ để gom vào cùng nhóm
  if (uploadTargetGroupId) {
    $('albumInput').value = uploadTargetGroupTitle || $('albumInput').value;
  }

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

  // Album view vẫn mở phía sau → giữ nguyên overflow hidden
  if (!$('albumView').hidden) {
    document.body.style.overflow = 'hidden';
  } else {
    // Không còn album view → reset mục tiêu thêm ảnh
    uploadTargetGroupId = null;
    uploadTargetGroupTitle = '';
  }
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
  const place = $('placeInput') ? $('placeInput').value.trim() : '';

  // Nguoi dang: mac dinh la nguoi dang nhap, hoac chon trong form
  let author = currentRole();
  const activeAuthor = document.querySelector('#authorPicker .author-btn.active');
  if (activeAuthor) author = activeAuthor.getAttribute('data-author');

  // Mỗi lần upload = 1 nhóm/câu chuyện riêng.
  // Nếu đang thêm vào 1 album cụ thể → dùng lại groupId của album đó.
  const groupId = uploadTargetGroupId
    ? uploadTargetGroupId
    : 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const btn = $('btnDoUpload');
  btn.disabled = true;

  const uploaded = [];

  for (let i = 0; i < pendingFiles.length; i++) {
    $('uploadBtnText').textContent = `Đang tải ${i + 1}/${pendingFiles.length}...`;

    try {
      const result = await uploadToCloudinary(
        pendingFiles[i],
        note,
        date,
        album,
        groupId,
        { place: place, author: author, music: '' }
      );
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

  const wasAddingToAlbum = !!uploadTargetGroupId;
  const addedGroupId = groupId;

  closeUploadModal();
  uploadTargetGroupId = null;
  uploadTargetGroupTitle = '';

  currentAlbum = 'all';
  applyFilters();
  renderStats();
  renderAlbumList();
  renderExportBar();

  // Nếu đang thêm vào album → mở lại album đó để user thấy ảnh mới
  if (wasAddingToAlbum) {
    const g = groupPhotos(filtered).find(x => x.id === addedGroupId);
    if (g) {
      openAlbum(g.id);
      toast(`Đã thêm ${uploaded.length} ảnh vào album 💕`, 'success');
      return;
    }
  }

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
 *
 * `groupId` là mã định danh của "lần upload" (mỗi lần bấm Tải lên = 1 nhóm).
 * Nhờ đó web gom các ảnh upload cùng lúc thành 1 album/câu chuyện.
 */
function uploadToCloudinary(file, note, date, album, groupId, extra) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.uploadPreset);

    const ex = extra || {};

    // Ghi chú / ngày / album / mã nhóm lưu kèm trong Cloudinary (context)
    const ctxParts = [
      'note=' + escapeContextValue(note),
      'date=' + escapeContextValue(date),
      'album=' + escapeContextValue(album),
      'gid=' + escapeContextValue(groupId),
      'place=' + escapeContextValue(ex.place || ''),
      'author=' + escapeContextValue(ex.author || ''),
      'music=' + escapeContextValue(ex.music || '')
    ];
    formData.append('context', ctxParts.join('|'));

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
          groupId: groupId || '',
          place: ex.place || '',
          author: ex.author || '',
          music: ex.music || '',
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

/** Escape HTML để tránh injection khi chèn text của người dùng */
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
