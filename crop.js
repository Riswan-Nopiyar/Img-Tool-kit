/**
 * NPRIMG — crop.js
 * Interactive drag-to-crop.
 *
 * KEY FIX: mousemove + mouseup are on WINDOW (not canvas),
 * so dragging never breaks when the pointer leaves the canvas bounds.
 */

const cropState = {
  img: null,
  fileIdx: 0,
  ar: 'free',
  sel: { x: 0, y: 0, w: 0, h: 0 },   // canvas-pixel coords
  drag: null,
  canvasScale: 1,                       // naturalPx * scale = canvasPx
  natural: { x: 0, y: 0, w: 0, h: 0 },
};

const HANDLE_R = 11; // hit-test radius in canvas pixels

function cc() { return document.getElementById('cropCanvas'); }

// ── Draw ───────────────────────────────────────────────────────────────────
function drawCrop() {
  const canvas = cc();
  if (!cropState.img || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  const { x, y, w, h } = cropState.sel;
  const cW = canvas.width, cH = canvas.height;

  ctx.clearRect(0, 0, cW, cH);
  ctx.drawImage(cropState.img, 0, 0, cW, cH);

  if (w < 4 || h < 4) { syncNatural(); refreshCoordUI(); return; }

  // Darken outside selection
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0,     0,     cW,      y);
  ctx.fillRect(0,     y + h, cW,      cH - y - h);
  ctx.fillRect(0,     y,     x,       h);
  ctx.fillRect(x + w, y,     cW-x-w,  h);

  // Selection border
  ctx.strokeStyle = '#48f955';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Rule-of-thirds grid
  ctx.strokeStyle = 'rgba(72,249,85,0.28)';
  ctx.lineWidth   = 0.7;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke();
  }

  // Handles
  const HS = 8;
  getHandles(x, y, w, h).forEach(hd => {
    ctx.fillStyle   = '#48f955';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.rect(hd.cx - HS / 2, hd.cy - HS / 2, HS, HS);
    ctx.fill();
    ctx.stroke();
  });

  syncNatural();
  refreshCoordUI();
}

// ── Handle positions ───────────────────────────────────────────────────────
function getHandles(x, y, w, h) {
  return [
    { id: 'nw', cx: x,       cy: y       },
    { id: 'n',  cx: x + w/2, cy: y       },
    { id: 'ne', cx: x + w,   cy: y       },
    { id: 'w',  cx: x,       cy: y + h/2 },
    { id: 'e',  cx: x + w,   cy: y + h/2 },
    { id: 'sw', cx: x,       cy: y + h   },
    { id: 's',  cx: x + w/2, cy: y + h   },
    { id: 'se', cx: x + w,   cy: y + h   },
  ];
}

function hitHandle(px, py) {
  const { x, y, w, h } = cropState.sel;
  for (const hd of getHandles(x, y, w, h)) {
    if (Math.abs(px - hd.cx) <= HANDLE_R && Math.abs(py - hd.cy) <= HANDLE_R) return hd.id;
  }
  return null;
}

function inSel(px, py) {
  const { x, y, w, h } = cropState.sel;
  return px > x + HANDLE_R && px < x + w - HANDLE_R &&
         py > y + HANDLE_R && py < y + h - HANDLE_R;
}

// ── Coord mapping ──────────────────────────────────────────────────────────
function evToCanvas(e) {
  const canvas = cc();
  const rect   = canvas.getBoundingClientRect();
  // CSS may scale the canvas element — account for that
  const sx = canvas.width  / rect.width;
  const sy = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  return {
    x: (src.clientX - rect.left) * sx,
    y: (src.clientY - rect.top)  * sy,
  };
}

// ── Clamping & AR ──────────────────────────────────────────────────────────
function clampSel(s) {
  const cW = cc().width, cH = cc().height;
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
  const cW = cc().width, cH = cc().height;
  let { x, y, w } = s;
  let h = Math.round(w * arH / arW);
  if (y + h > cH) { h = cH - y; w = Math.round(h * arW / arH); }
  return clampSel({ x, y, w, h });
}

// ── Sync ───────────────────────────────────────────────────────────────────
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
  document.getElementById('cropX').value = n.x;
  document.getElementById('cropY').value = n.y;
  document.getElementById('cropW').value = n.w;
  document.getElementById('cropH').value = n.h;
}

function syncFromInputs() {
  const s = cropState.canvasScale;
  cropState.sel = clampSel({
    x: (parseInt(document.getElementById('cropX').value) || 0) * s,
    y: (parseInt(document.getElementById('cropY').value) || 0) * s,
    w: (parseInt(document.getElementById('cropW').value) || 10) * s,
    h: (parseInt(document.getElementById('cropH').value) || 10) * s,
  });
  syncNatural();
  drawCrop();
}

function refreshCoordUI() {
  const n = cropState.natural;
  document.getElementById('ciX').textContent   = n.x;
  document.getElementById('ciY').textContent   = n.y;
  document.getElementById('ciW').textContent   = n.w;
  document.getElementById('ciH').textContent   = n.h;
  document.getElementById('ciOut').textContent = `${n.w}×${n.h}`;
  syncInputs();
}

// ── Cursor ─────────────────────────────────────────────────────────────────
const CURSORS = {
  nw:'nw-resize', n:'n-resize', ne:'ne-resize',
  w:'w-resize',                  e:'e-resize',
  sw:'sw-resize', s:'s-resize', se:'se-resize',
};

function setCursor(cur) {
  cc().style.cursor          = cur;
  document.body.style.cursor = cur || '';
}

// ── Load image ─────────────────────────────────────────────────────────────
function loadCropImage(f) {
  const canvas   = cc();
  const stage    = document.getElementById('cropStage');
  const empty    = document.getElementById('cropEmpty');
  const infoRow  = document.getElementById('cropInfoRow');
  const selCtrl  = document.getElementById('cropImgSelector');

  const el = new Image();
  el.onload = () => {
    cropState.img = el;
    requestAnimationFrame(() => {
      const maxW = stage.clientWidth  || 560;
      const maxH = 460;
      const s    = Math.min(maxW / el.naturalWidth, maxH / el.naturalHeight, 1);
      canvas.width  = Math.round(el.naturalWidth  * s);
      canvas.height = Math.round(el.naturalHeight * s);
      cropState.canvasScale = s;

      cropState.sel = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      syncNatural();

      canvas.style.display  = 'block';
      empty.style.display   = 'none';
      infoRow.style.display = 'flex';
      selCtrl.style.display = 'flex';
      drawCrop();
    });
  };
  el.src = f.thumb || f.url || URL.createObjectURL(f.file);
}

// ── Drag events — WINDOW-level move+up so drag never drops ────────────────
function initCropEvents() {
  const canvas = cc();
  let active = false;

  // ↓ mousedown / touchstart on canvas only
  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('touchstart', onDown, { passive: false });

  // ↓ move + up on WINDOW — this is the critical fix
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('mouseup',    onUp);
  window.addEventListener('touchmove',  onMove, { passive: false });
  window.addEventListener('touchend',   onUp);

  // Hover feedback (no drag)
  canvas.addEventListener('mousemove', onHover);

  function onDown(e) {
    if (!cropState.img) return;
    e.preventDefault();
    const p  = evToCanvas(e);
    const hd = hitHandle(p.x, p.y);

    if (hd) {
      cropState.drag = { mode: 'handle', hd, sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      setCursor(CURSORS[hd]);
    } else if (inSel(p.x, p.y)) {
      cropState.drag = { mode: 'move', sx: p.x, sy: p.y, orig: { ...cropState.sel } };
      setCursor('move');
    } else {
      cropState.drag = { mode: 'draw', sx: p.x, sy: p.y };
      cropState.sel  = { x: p.x, y: p.y, w: 1, h: 1 };
      setCursor('crosshair');
    }
    active = true;
  }

  function onMove(e) {
    if (!active || !cropState.drag || !cropState.img) return;
    e.preventDefault();

    const p = evToCanvas(e);
    const d = cropState.drag;

    if (d.mode === 'draw') {
      const x = Math.min(p.x, d.sx);
      const y = Math.min(p.y, d.sy);
      const w = Math.abs(p.x - d.sx);
      const h = Math.abs(p.y - d.sy);
      cropState.sel = applyAR({ x, y, w: Math.max(w, 8), h: Math.max(h, 8) });

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

    drawCrop();
  }

  function onUp() {
    if (!active) return;
    active = false;
    cropState.drag = null;
    setCursor('');
    cc().style.cursor = 'crosshair';
  }

  function onHover(e) {
    if (active || !cropState.img) return;
    const p  = evToCanvas(e);
    const hd = hitHandle(p.x, p.y);
    if (hd)              canvas.style.cursor = CURSORS[hd];
    else if (inSel(p.x, p.y)) canvas.style.cursor = 'move';
    else                 canvas.style.cursor = 'crosshair';
  }
}

// ── Image selector ─────────────────────────────────────────────────────────
function refreshCropSelector() {
  const files   = window.appState?.files || [];
  const thumbEl = document.getElementById('cropPisThumbs');
  thumbEl.innerHTML = '';

  if (!files.length) {
    document.getElementById('cropEmpty').style.display       = 'flex';
    cc().style.display = 'none';
    document.getElementById('cropInfoRow').style.display     = 'none';
    document.getElementById('cropImgSelector').style.display = 'none';
    cropState.img = null;
    return;
  }

  if (cropState.fileIdx >= files.length) cropState.fileIdx = 0;

  files.forEach((f, i) => {
    const el = document.createElement('img');
    el.src       = f.thumb;
    el.className = 'pis-thumb' + (i === cropState.fileIdx ? ' active' : '');
    el.title     = f.name;
    el.addEventListener('click', () => {
      cropState.fileIdx = i;
      loadCropImage(f);
      thumbEl.querySelectorAll('.pis-thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbEl.appendChild(el);
  });

  if (!cropState.img) loadCropImage(files[0]);
}

// ── Processing ─────────────────────────────────────────────────────────────
window.cropFiles = async function(files, x, y, w, h) {
  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const cx = Math.max(0, Math.min(x, iw - 1));
        const cy = Math.max(0, Math.min(y, ih - 1));
        const cw = Math.max(1, Math.min(w, iw - cx));
        const ch = Math.max(1, Math.min(h, ih - cy));
        const c  = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        return window.canvasToBlob(c, f.type, 0.92);
      });
      const blob = await result;
      window.setFileStatus(f.id, 'done', {
        url:  URL.createObjectURL(blob),
        name: window.addSuffix(f.name, '_cropped'),
        size: blob.size,
      });
    } catch (e) {
      window.setFileStatus(f.id, 'error', { msg: 'Crop failed' });
    }
    await window.sleep(30);
  }
  window.toast(`Cropped ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ── UI init ────────────────────────────────────────────────────────────────
(function initCropUI() {
  initCropEvents();

  document.querySelectorAll('[data-ar]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-ar]').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      cropState.ar = chip.dataset.ar;
      if (cropState.img) {
        cropState.sel = applyAR(cropState.sel);
        syncNatural(); syncInputs(); drawCrop();
      }
    });
  });

  ['cropX', 'cropY', 'cropW', 'cropH'].forEach(id => {
    document.getElementById(id).addEventListener('input', syncFromInputs);
  });

  document.getElementById('cropPresetFull')?.addEventListener('click', () => {
    if (!cropState.img) return;
    cropState.sel = { x: 0, y: 0, w: cc().width, h: cc().height };
    syncNatural(); syncInputs(); drawCrop();
  });
  document.getElementById('cropPresetCenter')?.addEventListener('click', () => {
    if (!cropState.img) return;
    const cW = cc().width, cH = cc().height;
    cropState.sel = applyAR({ x: cW / 4, y: cH / 4, w: cW / 2, h: cH / 2 });
    syncNatural(); syncInputs(); drawCrop();
  });
  document.getElementById('cropPresetTop')?.addEventListener('click', () => {
    if (!cropState.img) return;
    cropState.sel = applyAR({ x: 0, y: 0, w: cc().width, h: cc().height / 2 });
    syncNatural(); syncInputs(); drawCrop();
  });
  document.getElementById('cropPresetBottom')?.addEventListener('click', () => {
    if (!cropState.img) return;
    const cH = cc().height;
    cropState.sel = applyAR({ x: 0, y: cH / 2, w: cc().width, h: cH / 2 });
    syncNatural(); syncInputs(); drawCrop();
  });

  document.getElementById('cropBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }
    const n = cropState.natural;
    if (!n.w || !n.h) { window.toast('Draw a crop area first', 'error'); return; }
    window.cropFiles(files, n.x, n.y, n.w, n.h);
  });

  window.addEventListener('nprimg:filesChanged', refreshCropSelector);
})();