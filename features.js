/* ==========================================================
   TINH NANG MO RONG — Cac module bo sung
   (Gate dang nhap, dem ngay, time capsule, dia diem, cam xuc, nhac)
   ========================================================== */

/* ------------------------------------------------------------
   1. CANH CONG KY NIEM — DANG NHAP 2 LOP
   ------------------------------------------------------------
   ⚠️ BAO MAT: Web deploy cong khai. Neu muon bao mat THAT SU
   cho anh chi em, hay dung Firebase Auth / Supabase thay vi
   kiem tra o frontend. Kiem tra frontend chi chan nguoi la.
   ------------------------------------------------------------ */

const GATE_PASS = '1605';

/** Ngay chinh thuc chung ta bat dau yeu nhau (co the doi trong "Cai dat") */
const DEFAULT_LOVE_START = '2024-05-16';

const LOVE_QUESTIONS = [
  {
    question: '1. Ngày chính thức hẹn hò của hai đứa mình là ngày nào?',
    options: ['Ngày 14/02', 'Ngày 16/05', 'Ngày 20/10', 'Ngày 08/03'],
    correctIndex: 1
  },
  {
    question: '2. Tên gợi nhớ đầy yêu thương của Bé Yêu là gì?',
    options: ['Thương Uyên', 'Thảo Uyên', 'Phương Uyên', 'Minh Uyên'],
    correctIndex: 0
  },
  {
    question: '3. Lời hứa thiêng liêng nhất của hai đứa mình là gì?',
    options: [
      'Mỗi tuần đi ăn ngon một lần',
      'Không bao giờ bỏ rơi đối phương, cùng nhau đồng hành đến trọn đời',
      'Đi du lịch khắp mọi miền đất nước',
      'Luôn nhắn tin chúc ngủ ngon mỗi tối'
    ],
    correctIndex: 1
  },
  {
    question: '4. Điều gì mà Bé Yêu luôn tâm đắc và để ý nhất?',
    options: [
      'Ngủ nướng vào cuối tuần',
      'Sự xinh đẹp và không được mụp',
      'Uống trà sữa full topping',
      'Xem phim xuyên đêm'
    ],
    correctIndex: 1
  },
  {
    question: '5. Đâu là những điều Bé Yêu thích nhất?',
    options: [
      'Ở nhà đọc sách và nấu ăn',
      'Đi du lịch, đi chơi, sống thoải mái tự do, sống hạnh phúc bình yên',
      'Mua sắm đồ công nghệ',
      'Chơi thể thao mạo hiểm'
    ],
    correctIndex: 1
  }
];

let gateRole = 'Anh';
let gateQuestion = null;
let gateOptionIndex = null;

/**
 * Khoi tao man hinh dang nhap.
 * Neu localStorage da co role -> bo qua (van co the "doi nguoi" sau).
 */
function initGate() {
  // Migration role cu -> role moi
  const raw = localStorage.getItem('love_user_role');
  if (raw === 'Bé Gấu' || raw === 'Be Gau') {
    localStorage.setItem('love_user_role', 'Bé Yêu');
  }

  const saved = currentRole();
  if (saved) {
    gateRole = saved;
    const btn = document.querySelector('.role-btn[data-role="' + saved + '"]');
    if (btn) {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    $('loveGate').hidden = true;
    document.body.classList.add('gate-passed');
    // Đã đăng nhập từ trước → vẫn phải khởi tạo các module
    onGatePassed();
    return;
  }

  $('loveGate').hidden = false;
  rollGateQuestion();
}

function rollGateQuestion() {
  const i = Math.floor(Math.random() * LOVE_QUESTIONS.length);
  gateQuestion = LOVE_QUESTIONS[i];
  gateOptionIndex = null;

  $('gateQuestion').textContent = gateQuestion.question;
  const box = $('gateOptions');
  box.innerHTML = '';

  gateQuestion.options.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option-item';
    b.textContent = opt;
    b.addEventListener('click', () => {
      box.querySelectorAll('.option-item').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      gateOptionIndex = idx;
    });
    box.appendChild(b);
  });
}

function bindGate() {
  const roles = document.querySelectorAll('.role-btn');
  roles.forEach(b => {
    b.addEventListener('click', () => {
      roles.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      gateRole = b.getAttribute('data-role');
    });
  });

  $('gateSubmit').addEventListener('click', verifyGate);
}

function verifyGate() {
  const err = $('gateError');
  const pass = $('gatePassword').value.trim();

  if (pass !== GATE_PASS) {
    err.textContent = 'Sai mật mã bí mật rồi nha, thử lại nào!';
    err.className = 'gate-error';
    return;
  }

  if (gateOptionIndex === null) {
    err.textContent = 'Ban chua chon cau tra loi ky niem kia!';
    err.className = 'gate-error';
    return;
  }

  if (gateOptionIndex !== gateQuestion.correctIndex) {
    err.textContent = 'Chưa đúng rồi! Nghĩ kỹ về Bé Yêu xem nào';
    err.className = 'gate-error';
    return;
  }

  localStorage.setItem('love_user_role', gateRole);
  err.textContent = 'Chào mừng ' + gateRole + ' quay trở lại!';
  err.className = 'gate-error ok';

  setTimeout(() => {
    $('loveGate').hidden = true;
    document.body.classList.add('gate-passed');
    onGatePassed();
  }, 700);
}

/** Doi nguoi dang nhap (Anh <-> Be Yeu) */
function switchUser() {
  const cur = currentRole();
  const next = cur === 'Anh' ? 'Bé Yêu' : 'Anh';
  localStorage.setItem('love_user_role', next);
  toast('Chào ' + next + '! 💕', 'success');
  renderRoleBadges();
  renderAuthorPicker();
}

function currentRole() {
  // Migration: role cu la "Be Gau" -> "Be Yeu"
  const raw = localStorage.getItem('love_user_role') || 'Anh';
  if (raw === 'Bé Gấu' || raw === 'Be Gau') {
    localStorage.setItem('love_user_role', 'Bé Yêu');
    return 'Bé Yêu';
  }
  return raw;
}

/** Callback sau khi dang nhap thanh cong */
function onGatePassed() {
  renderRoleBadges();
  renderAuthorPicker();
  startLoveCounter();
  loadSharedData();
  bindLoveSettings();
}

/* ------------------------------------------------------------
   2. BO DEM NGAY YEU & DEM NGUOC
   ------------------------------------------------------------ */

const LOVE_START = DEFAULT_LOVE_START;   // ngay chinh thuc yêu nhau
let counterTimer = null;

function startLoveCounter() {
  stopLoveCounter();
  tickLoveCounter();
  counterTimer = setInterval(tickLoveCounter, 1000);
}

function stopLoveCounter() {
  if (counterTimer) { clearInterval(counterTimer); counterTimer = null; }
}

function tickLoveCounter() {
  const start = new Date(loveStartDate() + 'T00:00:00');
  const now = new Date();
  let diff = Math.floor((now - start) / 1000);
  if (diff < 0) diff = 0;

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;

  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('cdDays', days);
  set('cdHours', String(hours).padStart(2, '0'));
  set('cdMins', String(mins).padStart(2, '0'));
  set('cdSecs', String(secs).padStart(2, '0'));
}

/**
 * Dem nguoc toi cac moc ky niem.
 * Moc lay tu `shared.milestones` (neu co) + tuong lai gan nhat.
 */
function renderCountdown() {
  const row = $('countdownRow');
  if (!row) return;

  const items = [];

  // Moc thuoc shared data
  const milestones = (window.SHARED && window.SHARED.milestones) || [];
  milestones.forEach(m => {
    const d = new Date(m.date + 'T00:00:00');
    if (isNaN(d)) return;
    const left = d - new Date();
    items.push({
      label: m.label || m.title || 'Kỷ niệm',
      date: d,
      left: left,
      emoji: m.emoji || '💗'
    });
  });

  // Moc mac dinh: 1 nam yeu, sinh nhat...
  const base = new Date(loveStartDate() + 'T00:00:00');
  const thisYear = new Date(nowYear(base), base.getMonth(), base.getDate());
  const nextAnniv = thisYear > new Date() ? thisYear : new Date(nowYear(base) + 1, base.getMonth(), base.getDate());
  items.push({ label: 'Kỷ niệm 1 năm yêu nhau', date: nextAnniv, left: nextAnniv - new Date(), emoji: '💍' });

  // Loc ra nhung moc con tuong lai
  const upcoming = items.filter(i => i.left > 0).sort((a, b) => a.left - b.left).slice(0, 3);

  if (!upcoming.length) {
    row.innerHTML = '';
    return;
  }

  row.innerHTML = upcoming.map(i => {
    const d = Math.floor(i.left / 86400000);
    const h = Math.floor((i.left % 86400000) / 3600000);
    const mnt = Math.floor((i.left % 3600000) / 60000);
    return '<div class="cd-item">' +
      '<span class="cd-emoji">' + i.emoji + '</span>' +
      '<span class="cd-text">Còn <b>' + d + ' ngày ' + h + ' giờ ' + mnt + ' phút</b> đến ' + escapeHtml(i.label) + '</span>' +
      '</div>';
  }).join('');
}

function nowYear(d) { return d.getFullYear(); }

/* ------------------------------------------------------------
   2b. CAI DAT NGAY BAT DAU & LOI NOI
   ------------------------------------------------------------ */

let loveSettingsBound = false;

/** Hien thi ngay + loi noi len trang */
function renderLoveSettings() {
  const s = (window.SHARED && window.SHARED.settings) || {};
  const noteEl = $('loveNote');
  if (noteEl) {
    const note = (s.note || '').trim();
    noteEl.textContent = note ? '“' + note + '”' : '';
    noteEl.hidden = !note;
  }

  // Dong bo gia tri vao form (neu dang mo)
  const dInput = $('loveStartInput');
  if (dInput && dInput.value !== (s.startDate || DEFAULT_LOVE_START)) {
    dInput.value = s.startDate || DEFAULT_LOVE_START;
  }
  const nInput = $('loveNoteInput');
  if (nInput && document.activeElement !== nInput) {
    nInput.value = s.note || '';
  }
}

/** Gan su kien cho nut cai dat + form (chi 1 lan) */
function bindLoveSettings() {
  if (loveSettingsBound) return;
  loveSettingsBound = true;

  const btn = $('btnLoveSettings');
  const modal = $('loveSettingsModal');
  const closeBtn = $('loveSettingsClose');
  const cancelBtn = $('btnCancelLoveSettings');
  const saveBtn = $('btnSaveLoveSettings');

  if (btn && modal) {
    btn.addEventListener('click', () => {
      renderLoveSettings();
      modal.hidden = false;
      document.body.classList.add('modal-open');
    });
  }

  const close = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) close();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const dateVal = $('loveStartInput').value;
      const noteVal = $('loveNoteInput').value.trim();

      if (!dateVal) {
        toast('Hãy chọn ngày chúng mình bắt đầu nhé!', 'error');
        return;
      }

      window.SHARED.settings = Object.assign({}, window.SHARED.settings, {
        startDate: dateVal,
        note: noteVal
      });

      saveBtn.disabled = true;
      const ok = await saveSharedData();
      saveBtn.disabled = false;

      if (ok) {
        renderLoveSettings();
        tickLoveCounter();
        renderCountdown();
        close();
        toast('Đã lưu cài đặt tình yêu 💕', 'success');
      }
    });
  }
}

/* ------------------------------------------------------------
   3. DU LIEU DUNG CHUNG (Cloudinary raw JSON)
   ------------------------------------------------------------ */

window.SHARED = {
  capsules: [],
  reactions: {},
  music: '',
  milestones: [],
  settings: {
    startDate: '2024-05-16',
    note: ''
  }
};

/** Ngay bat dau: uu tien setting trong shared, fallback gia tri mac dinh */
function loveStartDate() {
  const s = (window.SHARED && window.SHARED.settings) || {};
  return s.startDate || DEFAULT_LOVE_START;
}

async function loadSharedData() {
  try {
    const res = await fetch('/api/shared', { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    const d = j.data || {};

    window.SHARED.capsules = d.capsules || [];
    window.SHARED.reactions = d.reactions || {};
    window.SHARED.music = d.music || '';
    window.SHARED.milestones = d.milestones || [];
    window.SHARED.settings = Object.assign(
      { startDate: DEFAULT_LOVE_START, note: '' },
      d.settings || {}
    );

    renderCapsules();
    renderCountdown();
    renderReactions();
    renderLoveSettings();
    if (window.SHARED.music) {
      setBackgroundMusic(window.SHARED.music);
    }
  } catch (err) {
    console.warn('Không đọc được dữ liệu chung:', err.message);
  }
}

async function saveSharedData() {
  try {
    const res = await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          capsules: window.SHARED.capsules,
          reactions: window.SHARED.reactions,
          music: window.SHARED.music,
          milestones: window.SHARED.milestones,
          settings: window.SHARED.settings || {
            startDate: DEFAULT_LOVE_START,
            note: ''
          }
        }
      })
    });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      throw new Error((t.error && t.error.message) || ('HTTP ' + res.status));
    }
    return true;
  } catch (err) {
    console.error('Loi luu du lieu chung:', err);
    toast('Không lưu được dữ liệu chung: ' + err.message, 'error');
    return false;
  }
}

/* ------------------------------------------------------------
   4. HOP THOI GIAN (TIME CAPSULE)
   ------------------------------------------------------------ */

function renderCapsules() {
  const grid = $('capsuleGrid');
  if (!grid) return;

  const list = window.SHARED.capsules || [];
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<p class="capsule-empty">Chưa có phong bì nào. Hãy tạo một lời nhắn bí mật cho nhóm nhé!</p>';
    return;
  }

  list.forEach((c, i) => {
    const openDate = new Date(c.openDate + 'T00:00:00');
    const isOpen = openDate <= new Date();

    const card = document.createElement('article');
    card.className = 'capsule-card' + (isOpen ? ' is-open' : ' is-locked');

    const emoji = c.emoji || (isOpen ? '💌' : '🔒');
    card.innerHTML =
      '<div class="capsule-emoji">' + emoji + '</div>' +
      '<div class="capsule-title">' + escapeHtml(c.title || 'Phong bi') + '</div>' +
      '<div class="capsule-date">' + (isOpen ? 'Đã mở' : 'Mở khi ' + formatDate(c.openDate)) + '</div>' +
      '<div class="capsule-body">' + (isOpen ? escapeHtml(c.message || '') : 'Phong bì này chưa đến ngày mở.') + '</div>' +
      (isOpen ? '' : '<div class="capsule-count" data-cap="' + i + '"></div>');

    if (!isOpen) {
      const cd = card.querySelector('.capsule-count');
      const target = openDate.getTime();
      const upd = () => {
        const left = target - Date.now();
        if (left <= 0) { renderCapsules(); return; }
        const d = Math.floor(left / 86400000);
        const h = Math.floor((left % 86400000) / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        cd.textContent = 'Còn ' + d + ' ngày ' + h + ' giờ ' + m + ' phút';
      };
      upd();
      setInterval(upd, 60000);
    }

    grid.appendChild(card);
  });
}

/** Them phong bi moi */
function addCapsule() {
  const title = prompt('Tiêu đề phong bì (VD: "Mở khi hai đứa giận nhau"):');
  if (!title) return;

  const dateStr = prompt('Mở khi ngày nào? (YYYY-MM-DD)', '2027-05-16');
  if (!dateStr) return;

  const message = prompt('Lời nhắn bên trong (có thể để trống):', '');
  if (message === null) return;

  const emoji = prompt('Biểu tượng (VD: 💌 🔒 🎁):', '💌') || '💌';

  window.SHARED.capsules.push({
    id: 'cap_' + Date.now(),
    title: title,
    openDate: dateStr,
    message: message,
    emoji: emoji,
    createdAt: new Date().toISOString()
  });

  saveSharedData().then(ok => {
    if (ok) { renderCapsules(); toast('Đã thêm phong bì 💌', 'success'); }
  });
}

/* ------------------------------------------------------------
   5. CAM XUC & HOI DAP
   ------------------------------------------------------------ */

function reactKey(photoId) {
  return photoId;
}

function renderReactions() {
  const list = $('reactList');
  if (!list) return;

  const p = (typeof filtered !== 'undefined' && filtered[currentIndex]) ? filtered[currentIndex] : null;
  const items = p ? (window.SHARED.reactions[reactKey(p.id)] || []) : [];

  list.innerHTML = items.map(it =>
    '<div class="react-item">' +
    '<b>' + escapeHtml(it.who || '') + '</b> ' +
    (it.emoji ? '<span class="react-emoji">' + escapeHtml(it.emoji) + '</span> ' : '') +
    '<span>' + escapeHtml(it.text || '') + '</span>' +
    '</div>'
  ).join('');
}

async function addReaction(emoji, text) {
  const p = (typeof filtered !== 'undefined' && filtered[currentIndex]) ? filtered[currentIndex] : null;
  if (!p) return;

  const key = reactKey(p.id);
  if (!window.SHARED.reactions[key]) window.SHARED.reactions[key] = [];

  window.SHARED.reactions[key].push({
    who: currentRole(),
    emoji: emoji || '',
    text: text || '',
    at: new Date().toISOString()
  });

  renderReactions();
  saveSharedData();
}

/* ------------------------------------------------------------
   6. DIA DIEM KY NIEM
   ------------------------------------------------------------ */

function renderPlaces() {
  const grid = $('placesGrid');
  if (!grid) return;

  const count = {};
  (typeof photos !== 'undefined' ? photos : []).forEach(p => {
    const pl = (p.place || '').trim();
    if (!pl) return;
    count[pl] = (count[pl] || 0) + 1;
  });

  const entries = Object.entries(count).sort((a, b) => b[1] - a[1]);

  const el = $('placesCount');
  if (el) el.textContent = entries.length ? entries.length + ' noi' : '';

  if (!entries.length) {
    grid.innerHTML = '<p class="places-empty">Chưa có địa điểm nào. Khi upload anh thêm "Địa điểm" nhé!</p>';
    return;
  }

  grid.innerHTML = entries.map(([name, n]) =>
    '<div class="place-card">' +
    '<span class="place-pin">&#128205;</span>' +
    '<span class="place-name">' + escapeHtml(name) + '</span>' +
    '<span class="place-num">' + n + ' lan</span>' +
    '</div>'
  ).join('');
}

/* ------------------------------------------------------------
   7. NHAC KY NIEM
   ------------------------------------------------------------ */

let ytPlayer = null;        // instance cua YT.Player
let ytReady = false;        // da san sang chua
let ytPending = null;       // video id cho san
let ytIsPlaying = false;    // trang thai phat
let currentTrackUrl = '';   // link hien tai

function bindMusic() {
  const disc = $('musicDisc');
  const audio = $('bgMusic');
  if (!disc || !audio) return;

  disc.addEventListener('click', () => {
    if (!currentTrackUrl) {
      toast('Chưa có bài hát nào. Hãy thêm link YouTube ở album nhé!', 'error');
      return;
    }
    togglePlay();
  });

  audio.addEventListener('play', () => {
    disc.classList.add('playing');
    ytIsPlaying = true;
  });
  audio.addEventListener('pause', () => {
    if (isYouTube(currentTrackUrl)) return;
    disc.classList.remove('playing');
    ytIsPlaying = false;
  });
  audio.addEventListener('ended', () => disc.classList.remove('playing'));
}

/** Bat/tay nhac theo trang thai hien tai */
function togglePlay() {
  const disc = $('musicDisc');
  const audio = $('bgMusic');

  // Truong hop la YouTube
  if (isYouTube(currentTrackUrl)) {
    if (!ytReady) { toast('Đang tải trình phát nhạc...', 'info'); return; }
    if (ytIsPlaying) {
      ytPlayer.pauseVideo();
      ytIsPlaying = false;
      if (disc) disc.classList.remove('playing');
    } else {
      try {
        ytPlayer.playVideo();
        ytIsPlaying = true;
        if (disc) disc.classList.add('playing');
      } catch (err) {
        toast('Không phát được nhạc: ' + err.message, 'error');
      }
    }
    return;
  }

  // Truong hop la file audio thuong
  if (!audio || !audio.src) {
    toast('Chưa có bài hát nào. Hãy thêm link YouTube ở album nhé!', 'error');
    return;
  }
  if (audio.paused) {
    audio.play()
      .then(() => { if (disc) disc.classList.add('playing'); })
      .catch(() => toast('Không phát được nhạc. Thử mở nhạc từ album khác nhé!', 'error'));
  } else {
    audio.pause();
    if (disc) disc.classList.remove('playing');
  }
}

/**
 * Phat nhac gan voi 1 album (YouTube / mp3 / dropbox...).
 * YouTube duoc phat qua IFrame Player API (xem createYouTubePlayer).
 */
function playAlbumMusic(url) {
  if (!url) return;
  currentTrackUrl = url;

  const audio = $('bgMusic');
  const disc = $('musicDisc');

  if (isYouTube(url)) {
    // Tat audio neu dang phat file thuong
    if (audio) { audio.pause(); audio.removeAttribute('src'); }

    const id = youtubeId(url);
    if (!id) { toast('Không tìm thấy video trong link này', 'error'); return; }

    if (!ytReady) {
      ytPending = id;
      loadYouTubeApi();
      return;
    }
    ytPlayer.cueVideoById({ videoId: id, startSeconds: 0 });
    ytPlayer.playVideo();
    ytIsPlaying = true;
    if (disc) disc.classList.add('playing');
    toast('🎵 Đang phát nhạc kỷ niệm', 'success');
    return;
  }

  // Khong phai YouTube -> phat truc tiep (mp3, dropbox...)
  if (audio) {
    audio.src = url;
    audio.play()
      .then(() => {
        if (disc) disc.classList.add('playing');
        toast('🎵 Đang phát nhạc kỷ niệm', 'success');
      })
      .catch(() => toast('Không phát được link này', 'error'));
  }
}

/** Nhac nen mac dinh */
function setBackgroundMusic(url) {
  currentTrackUrl = url || '';
  const audio = $('bgMusic');
  if (audio && url) {
    audio.src = url;
    audio.loop = true;
  }
}

/** Link co phai YouTube khong? */
function isYouTube(url) {
  if (!url) return false;
  const s = String(url).toLowerCase();
  return s.indexOf('youtube.com') !== -1 ||
         s.indexOf('youtu.be') !== -1 ||
         s.indexOf('youtube-nocookie.com') !== -1;
}

/**
 * Chuyen link YouTube thanh video id.
 * - youtu.be/ID  -> ID
 * - watch?v=ID   -> ID
 * - /embed/ID    -> ID
 * - /shorts/ID   -> ID
 */
function youtubeId(url) {
  if (!url) return '';
  const s = String(url);

  const patterns = [
    /youtu\.be\/([\w-]{6,})/,
    /[?&]v=([\w-]{6,})/,
    /\/embed\/([\w-]{6,})/,
    /\/shorts\/([\w-]{6,})/,
    /\/live\/([\w-]{6,})/
  ];

  for (let i = 0; i < patterns.length; i++) {
    const m = s.match(patterns[i]);
    if (m) return m[1];
  }
  return '';
}

/* --- YouTube IFrame Player API --- */

let ytApiLoading = false;

/** Nap YouTube IFrame Player API (1 lan duy nhat) */
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) { createYouTubePlayer(); return; }
  if (ytApiLoading) return;
  ytApiLoading = true;

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = () => {
    ytApiLoading = false;
    toast('Không tải được trình phát YouTube', 'error');
  };
  document.head.appendChild(tag);
}

/** Callback toan cuc cua YouTube API */
window.onYouTubeIframeAPIReady = function () {
  ytApiLoading = false;
  createYouTubePlayer();
};

function createYouTubePlayer() {
  if (ytPlayer || !window.YT || !window.YT.Player) return;

  const holder = $('ytPlayer');
  if (!holder) return;

  const vid = ytPending || '';

  try {
    ytPlayer = new window.YT.Player('ytPlayer', {
      height: '1',
      width: '1',
      videoId: vid,
      playerVars: {
        autoplay: 1,
        loop: 1,
        playlist: vid,
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        rel: 0
      },
      events: {
        onReady: (e) => {
          ytReady = true;
          if (vid) {
            try {
              e.target.playVideo();
              ytIsPlaying = true;
              const disc = $('musicDisc');
              if (disc) disc.classList.add('playing');
            } catch (err) { /* ignore */ }
          }
        },
        onStateChange: (e) => {
          const disc = $('musicDisc');
          if (e.data === window.YT.PlayerState.PLAYING) {
            ytIsPlaying = true;
            if (disc) disc.classList.add('playing');
          } else if (e.data === window.YT.PlayerState.PAUSED ||
                     e.data === window.YT.PlayerState.ENDED) {
            ytIsPlaying = false;
            if (disc) disc.classList.remove('playing');
          }
        },
        onError: (e) => {
          ytIsPlaying = false;
          const disc = $('musicDisc');
          if (disc) disc.classList.remove('playing');
          toast('Không phát được video này (mã ' + e.data + ')', 'error');
        }
      }
    });
  } catch (err) {
    console.error('Lỗi tạo YouTube player:', err);
  }
}

/* ------------------------------------------------------------
   8. HUY HIU NGUOI DANG (Anh / Be Yeu)
   ------------------------------------------------------------ */

function renderRoleBadges() {
  const role = currentRole();
  document.querySelectorAll('.role-switch-label').forEach(el => {
    el.textContent = role;
  });
  document.querySelectorAll('.role-switch-icon').forEach(el => {
    el.textContent = role === 'Anh' ? '\u{1F466}' : '\u{1F9F8}';  });
}

function renderAuthorPicker() {
  const role = currentRole();
  document.querySelectorAll('#authorPicker .author-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-author') === role);
  });
}

/** Escape HTML de tranh injection (dinh nghia trong app.js) */
