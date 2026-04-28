/**
 * NPRIMG — crop.js  (FIXED)
 *
 * Fixes:
 * 1. evToCanvas sekarang pakai pointer/mouse event langsung tanpa ambiguitas
 * 2. active flag dipindah ke cropState agar tidak terkunci di closure
 * 3. Event listener hanya didaftarkan SEKALI, tidak duplikat
 * 4. onMove & onUp di window menggunakan cropState.dragging (bukan closure var)
 * 5. Cursor feedback diperbaiki agar tidak konflik
 */

const cropState = {
  img:          null,
  fileIdx:      0,
  ar:           'free',
  sel:          { x: 0, y: 0, w: 0, h: 0 },
  drag:         null,        // { mode, hd?, sx, sy, orig }
  dragging:     false,       // flag yang bisa dibaca dari luar closure
  canvasScale:  1,
  natural:      { x: 0, y: 0, w: 0, h: 0 },
};

const HANDLE_R = 12; // hit-test radius (px dalam koordinat canvas)
const HANDLE_S = 8;  // ukuran handle saat digambar

function getCanvas() {
  return document.getElementById('cropCanvas');
}

// ─────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────
function drawCrop() {
  const canvas = getCanvas();
  if (!cropState.img || !canvas || !canvas.width) return;

  const ctx          = canvas.getContext('2d');
  const { x, y, w, h } = cropState.sel;
  const cW = canvas.width;
  const cH = canvas.height;

  ctx.clearRect(0, 0, cW, cH);
  ctx.drawImage(cropState.img, 0, 0, cW, cH);

  if (w < 4 || h < 4) {
    syncNatural();
    refreshCoordUI();
    return;
  }

  // Overlay gelap di luar seleksi
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0,     0,     cW,         y);
  ctx.fillRect(0,     y + h, cW,         cH - y - h);
  ctx.fillRect(0,     y,     x,          h);
  ctx.fillRect(x + w, y,     cW - x - w, h);

  // Border seleksi
  ctx.strokeStyle = '#48f955';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Rule-of-thirds
  ctx.strokeStyle = 'rgba(72,249,85,0.28)';
  ctx.lineWidth   = 0.7;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 3, y);
    ctx.lineTo(x + (w * i) / 3, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + (h * i) / 3);
    ctx.lineTo(x + w, y + (h * i) / 3);
    ctx.stroke();
  }

  // Handle corners + edges
  ctx.fillStyle   = '#48f955';
  ctx.strokeStyle = '#0e0e0e';
  ctx.lineWidth   = 1.2;
  getHandles(x, y, w, h).forEach(hd => {
    ctx.beginPath();
    ctx.rect(hd.cx - HANDLE_S / 2, hd.cy - HANDLE_S / 2, HANDLE_S, HANDLE_S);
    ctx.fill();
    ctx.stroke();
  });

  syncNatural();
  refreshCoordUI();
}

// ─────────────────────────────────────────────────────────────────
// HANDLE POSITIONS
// ─────────────────────────────────────────────────────────────────
function getHandles(x, y, w, h) {
  return [
    { id: 'nw', cx: x,         cy: y         },
    { id: 'n',  cx: x + w / 2, cy: y         },
    { id: 'ne', cx: x + w,     cy: y         },
    { id: 'w',  cx: x,         cy: y + h / 2 },
    { id: 'e',  cx: x + w,     cy: y + h / 2 },
    { id: 'sw', cx: x,         cy: y + h     },
    { id: 's',  cx: x + w / 2, cy: y + h     },
    { id: 'se', cx: x + w,     cy: y + h     },
  ];
}

function hitHandle(px, py) {
  const { x, y, w, h } = cropState.sel;
  for (const hd of getHandles(x, y, w, h)) {
    if (Math.abs(px - hd.cx) <= HANDLE_R && Math.abs(py - hd.cy) <= HANDLE_R) {
      return hd.id;
    }
  }
  return null;
}

function inSel(px, py) {
  const { x, y, w, h } = cropState.sel;
  return (
    px > x + HANDLE_R && px < x + w - HANDLE_R &&
    py > y + HANDLE_R && py < y + h - HANDLE_R
  );
}

// ─────────────────────────────────────────────────────────────────
// KOORDINAT — konversi dari client coords ke canvas coords
// ─────────────────────────────────────────────────────────────────
function clientToCanvas(clientX, clientY) {
  const canvas = getCanvas();
  const rect   = canvas.getBoundingClientRect();

  // Canvas bisa di-scale via CSS (max-width:100%) — hitung rasionya
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

function evToCanvas(e) {
  // Tangani mouse, touch, dan pointer events
  if (e.touches && e.touches.length > 0) {
    return clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return clientToCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
  return clientToCanvas(e.clientX, e.clientY);
}

// ─────────────────────────────────────────────────────────────────
// CLAMP & ASPECT RATIO
// ─────────────────────────────────────────────────────────────────
function clampSel(s) {
  const canvas = getCanvas();
  const cW = canvas.width;
  const cH = canvas.height;
  let { x, y, w, h } = s;

  w = Math.max(8, w);
  h = Math.max(8, h);

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > cW) { w = cW - x; if (w < 8) { w = 8; x = cW - 8; } }
  if (y + h > cH) { h = cH - y; if (h < 8) { h = 8; y = cH - 8; } }

  return { x, y, w, h };
}

function applyAR(s) {
  if (cropState.ar === 'free') return clampSel(s);

  const [arW, arH] = cropState.ar.split(':').map(Number);
  const canvas     = getCanvas();
  const cH         = canvas.height;
  let { x, y, w } = s;
  let h            = Math.round(w * arH / arW);

  if (y + h > cH) {
    h = cH - y;
    w = Math.round(h * arW / arH);
  }

  return clampSel({ x, y, w, h });
}

// ─────────────────────────────────────────────────────────────────
// SYNC NATURAL COORDS
// ─────────────────────────────────────────────────────────────────
function syncNatural() {
  const s = cropState.canvasScale;
  cropState.natural = {
    x: Math.round(cropState.sel.x / s),
    y: Math.round(cropState.sel.y / s),
    w: Math.round(cropState.sel.w / s),
    h: Math.round(cropState.sel.h / s),
  };
}

function syncInputs() {
  const n = cropState.natural;
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  setVal('cropX', n.x);
  setVal('cropY', n.y);
  setVal('cropW', n.w);
  setVal('cropH', n.h);
}

function syncFromInputs() {
  const s   = cropState.canvasScale;
  const get = (id) => parseInt(document.getElementById(id)?.value) || 0;
  cropState.sel = clampSel({
    x: get('cropX') * s,
    y: get('cropY') * s,
    w: Math.max(1, get('cropW')) * s,
    h: Math.max(1, get('cropH')) * s,
  });
  syncNatural();
  drawCrop();
}

function refreshCoordUI() {
  const n = cropState.natural;
  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setText('ciX',   n.x);
  setText('ciY',   n.y);
  setText('ciW',   n.w);
  setText('ciH',   n.h);
  setText('ciOut', `${n.w}×${n.h}`);
  syncInputs();
}

// ─────────────────────────────────────────────────────────────────
// CURSOR
// ─────────────────────────────────────────────────────────────────
const CURSORS = {
  nw: 'nw-resize', n: 'n-resize',  ne: 'ne-resize',
  w:  'w-resize',                   e:  'e-resize',
  sw: 'sw-resize', s: 's-resize',  se: 'se-resize',
};

function setCursor(cur) {
  const canvas           = getCanvas();
  if (canvas) canvas.style.cursor = cur || 'crosshair';
  document.body.style.cursor      = cur || '';
}

// ─────────────────────────────────────────────────────────────────
// LOAD IMAGE KE CANVAS
// ─────────────────────────────────────────────────────────────────
function loadCropImage(f) {
  const canvas  = getCanvas();
  const stage   = document.getElementById('cropStage');
  const empty   = document.getElementById('cropEmpty');
  const infoRow = document.getElementById('cropInfoRow');
  const selCtrl = document.getElementById('cropImgSelector');

  if (!canvas || !stage) return;

  const el  = new Image();
  const src = f.thumb || f.url || (f.file ? URL.createObjectURL(f.file) : null);
  if (!src) return;

  el.onload = () => {
    cropState.img = el;

    // Tunggu 1 frame agar stage sudah punya dimensi
    requestAnimationFrame(() => {
      const maxW = stage.clientWidth  || 560;
      const maxH = 460;
      const s    = Math.min(maxW / el.naturalWidth, maxH / el.naturalHeight, 1);

      canvas.width  = Math.round(el.naturalWidth  * s);
      canvas.height = Math.round(el.naturalHeight * s);
      cropState.canvasScale = s;

      // Default seleksi = full image
      cropState.sel = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      syncNatural();

      canvas.style.display = 'block';
      if (empty)   empty.style.display   = 'none';
      if (infoRow) infoRow.style.display = 'flex';
      if (selCtrl) selCtrl.style.display = 'flex';

      drawCrop();
    });
  };

  el.onerror = () => window.toast?.('Gagal memuat gambar untuk crop', 'error');
  el.src = src;
}

// ─────────────────────────────────────────────────────────────────
// DRAG EVENT HANDLERS
// Semua event didaftarkan SEKALI di sini, tidak di dalam IIFE loop
// ─────────────────────────────────────────────────────────────────
function initCropEvents() {
  const canvas = getCanvas();
  if (!canvas) return;

  // ── MOUSE DOWN ──────────────────────────────────────────────────
  canvas.addEventListener('mousedown', (e) => {
    if (!cropState.img) return;
    e.preventDefault();

    const p  = evToCanvas(e);
    const hd = hitHandle(p.x, p.y);

    if (hd) {
      cropState.drag     = { mode: 'handle', hd, sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      cropState.dragging = true;
      setCursor(CURSORS[hd]);
    } else if (inSel(p.x, p.y)) {
      cropState.drag     = { mode: 'move', sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      cropState.dragging = true;
      setCursor('move');
    } else {
      // Mulai draw selection baru
      cropState.drag     = { mode: 'draw', sx: p.x, sy: p.y };
      cropState.dragging = true;
      cropState.sel      = { x: p.x, y: p.y, w: 1, h: 1 };
      setCursor('crosshair');
    }
  });

  // ── TOUCH START ─────────────────────────────────────────────────
  canvas.addEventListener('touchstart', (e) => {
    if (!cropState.img) return;
    e.preventDefault();

    const p  = evToCanvas(e);
    const hd = hitHandle(p.x, p.y);

    if (hd) {
      cropState.drag     = { mode: 'handle', hd, sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      cropState.dragging = true;
    } else if (inSel(p.x, p.y)) {
      cropState.drag     = { mode: 'move', sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      cropState.dragging = true;
    } else {
      cropState.drag     = { mode: 'draw', sx: p.x, sy: p.y };
      cropState.dragging = true;
      cropState.sel      = { x: p.x, y: p.y, w: 1, h: 1 };
    }
  }, { passive: false });

  // ── MOUSE MOVE — di window agar drag tidak putus ─────────────────
  window.addEventListener('mousemove', (e) => {
    if (!cropState.dragging || !cropState.drag || !cropState.img) return;

    const p = evToCanvas(e);
    processDragMove(p);
    drawCrop();
  });

  // ── TOUCH MOVE — di window ───────────────────────────────────────
  window.addEventListener('touchmove', (e) => {
    if (!cropState.dragging || !cropState.drag || !cropState.img) return;
    e.preventDefault();

    const p = evToCanvas(e);
    processDragMove(p);
    drawCrop();
  }, { passive: false });

  // ── MOUSE UP — di window ─────────────────────────────────────────
  window.addEventListener('mouseup', () => {
    if (!cropState.dragging) return;
    cropState.dragging = false;
    cropState.drag     = null;
    setCursor('');
    if (getCanvas()) getCanvas().style.cursor = 'crosshair';
  });

  // ── TOUCH END — di window ────────────────────────────────────────
  window.addEventListener('touchend', () => {
    if (!cropState.dragging) return;
    cropState.dragging = false;
    cropState.drag     = null;
  });

  // ── HOVER FEEDBACK (tanpa drag) ──────────────────────────────────
  canvas.addEventListener('mousemove', (e) => {
    if (cropState.dragging || !cropState.img) return;
    const p  = evToCanvas(e);
    const hd = hitHandle(p.x, p.y);

    if (hd)              canvas.style.cursor = CURSORS[hd];
    else if (inSel(p.x, p.y)) canvas.style.cursor = 'move';
    else                 canvas.style.cursor = 'crosshair';
  });
}

// ─────────────────────────────────────────────────────────────────
// PROSES DRAG MOVE (dipanggil dari mousemove & touchmove)
// ─────────────────────────────────────────────────────────────────
function processDragMove(p) {
  const d = cropState.drag;
  if (!d) return;

  if (d.mode === 'draw') {
    const x = Math.min(p.x, d.sx);
    const y = Math.min(p.y, d.sy);
    const w = Math.max(Math.abs(p.x - d.sx), 8);
    const h = Math.max(Math.abs(p.y - d.sy), 8);
    cropState.sel = applyAR({ x, y, w, h });

  } else if (d.mode === 'move') {
    cropState.sel = clampSel({
      x: d.orig.x + (p.x - d.sx),
      y: d.orig.y + (p.y - d.sy),
      w: d.orig.w,
      h: d.orig.h,
    });

  } else if (d.mode === 'handle') {
    const dx = p.x - d.sx;
    const dy = p.y - d.sy;
    const o  = d.orig;
    const hd = d.hd;

    let nx = o.x, ny = o.y, nw = o.w, nh = o.h;

    if (hd.includes('e')) nw = Math.max(8, o.w + dx);
    if (hd.includes('s')) nh = Math.max(8, o.h + dy);
    if (hd.includes('w')) { nx = o.x + dx; nw = Math.max(8, o.w - dx); }
    if (hd.includes('n')) { ny = o.y + dy; nh = Math.max(8, o.h - dy); }

    cropState.sel = applyAR(clampSel({ x: nx, y: ny, w: nw, h: nh }));
    setCursor(CURSORS[hd]);
  }
}

// ─────────────────────────────────────────────────────────────────
// IMAGE SELECTOR STRIP
// ─────────────────────────────────────────────────────────────────
function refreshCropSelector() {
  const files   = window.appState?.files || [];
  const thumbEl = document.getElementById('cropPisThumbs');
  if (!thumbEl) return;

  thumbEl.innerHTML = '';

  if (!files.length) {
    const empty   = document.getElementById('cropEmpty');
    const canvas  = getCanvas();
    const infoRow = document.getElementById('cropInfoRow');
    const selCtrl = document.getElementById('cropImgSelector');
    if (empty)   empty.style.display   = 'flex';
    if (canvas)  canvas.style.display  = 'none';
    if (infoRow) infoRow.style.display = 'none';
    if (selCtrl) selCtrl.style.display = 'none';
    cropState.img = null;
    return;
  }

  if (cropState.fileIdx >= files.length) cropState.fileIdx = 0;

  files.forEach((f, i) => {
    const el     = document.createElement('img');
    el.src       = f.thumb;
    el.className = 'pis-thumb' + (i === cropState.fileIdx ? ' active' : '');
    el.title     = f.name;
    el.addEventListener('click', () => {
      cropState.fileIdx = i;
      loadCropImage(f);
      thumbEl.querySelectorAll('.pis-thumb')
             .forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbEl.appendChild(el);
  });

  // Load gambar pertama jika belum ada
  if (!cropState.img) loadCropImage(files[0]);
}

// ─────────────────────────────────────────────────────────────────
// PROCESSING — APPLY CROP KE SEMUA FILE
// ─────────────────────────────────────────────────────────────────
window.cropFiles = async function(files, x, y, w, h) {
  let successCount = 0;

  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const blob = await window.processWithCanvas(f.file, (img) => {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const cx = Math.max(0, Math.min(x, iw - 1));
        const cy = Math.max(0, Math.min(y, ih - 1));
        const cw = Math.max(1, Math.min(w, iw - cx));
        const ch = Math.max(1, Math.min(h, ih - cy));

        const c   = document.createElement('canvas');
        c.width   = cw;
        c.height  = ch;
        c.getContext('2d').drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

        return window.canvasToBlob(c, f.type, 0.92);
      });

      // processWithCanvas mengembalikan Promise<Blob> dari canvasToBlob
      const finalBlob = blob instanceof Blob ? blob : await blob;

      window.setFileStatus(f.id, 'done', {
        url:  URL.createObjectURL(finalBlob),
        name: window.addSuffix(f.name, '_cropped'),
        size: finalBlob.size,
      });
      successCount++;
    } catch (err) {
      console.error('Crop error:', err);
      window.setFileStatus(f.id, 'error', { msg: 'Crop gagal' });
    }
    await window.sleep(30);
  }

  window.toast(`${successCount} gambar berhasil di-crop`, 'success');
};

// ─────────────────────────────────────────────────────────────────
// INIT UI
// ─────────────────────────────────────────────────────────────────
(function initCropUI() {
  // Init event drag SEKALI saja
  initCropEvents();

  // Aspect ratio chips
  document.querySelectorAll('[data-ar]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-ar]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      cropState.ar = chip.dataset.ar;
      if (cropState.img) {
        cropState.sel = applyAR(cropState.sel);
        syncNatural();
        syncInputs();
        drawCrop();
      }
    });
  });

  // Input manual koordinat
  ['cropX', 'cropY', 'cropW', 'cropH'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncFromInputs);
  });

  // Quick presets
  const presets = {
    cropPresetFull: () => {
      const canvas = getCanvas();
      if (!cropState.img || !canvas) return;
      cropState.sel = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    },
    cropPresetCenter: () => {
      const canvas = getCanvas();
      if (!cropState.img || !canvas) return;
      const cW = canvas.width, cH = canvas.height;
      cropState.sel = applyAR({ x: cW / 4, y: cH / 4, w: cW / 2, h: cH / 2 });
    },
    cropPresetTop: () => {
      const canvas = getCanvas();
      if (!cropState.img || !canvas) return;
      cropState.sel = applyAR({ x: 0, y: 0, w: canvas.width, h: canvas.height / 2 });
    },
    cropPresetBottom: () => {
      const canvas = getCanvas();
      if (!cropState.img || !canvas) return;
      const cH = canvas.height;
      cropState.sel = applyAR({ x: 0, y: cH / 2, w: canvas.width, h: cH / 2 });
    },
  };

  Object.entries(presets).forEach(([id, fn]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      fn();
      syncNatural();
      syncInputs();
      drawCrop();
    });
  });

  // Tombol Apply Crop
  document.getElementById('cropBtn')?.addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload gambar dulu', 'error'); return; }
    const n = cropState.natural;
    if (!n.w || !n.h) { window.toast('Tentukan area crop terlebih dahulu', 'error'); return; }
    window.cropFiles(files, n.x, n.y, n.w, n.h);
  });

  // Dengarkan perubahan file
  window.addEventListener('nprimg:filesChanged', refreshCropSelector);
})();