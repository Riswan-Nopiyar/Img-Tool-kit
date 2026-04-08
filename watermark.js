/**
 * NPRIMG — watermark.js
 * Watermark with:
 *  - Text or Photo/Logo watermark
 *  - Drag handle to reposition on live canvas preview
 *  - 9-point position grid (synced with drag)
 *  - Tile mode
 *  - Opacity, color, font size, photo size controls
 */

const wmState = {
  type: 'text',           // 'text' | 'photo'
  position: 'center',     // named position string
  // Drag position (as fraction 0–1 of canvas)
  dragX: 0.5,
  dragY: 0.5,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  // Preview
  bgImg: null,
  fileIdx: 0,
  // Photo watermark
  photoImg: null,
};

// ── Named position → fractions ─────────────────────────────────────────────
const POS_MAP = {
  'top-left':      [0.05, 0.05], 'top-center':    [0.5, 0.05], 'top-right':     [0.95, 0.05],
  'middle-left':   [0.05, 0.5],  'center':         [0.5, 0.5],  'middle-right':  [0.95, 0.5],
  'bottom-left':   [0.05, 0.95], 'bottom-center':  [0.5, 0.95], 'bottom-right':  [0.95, 0.95],
};

function setPosFromName(name) {
  wmState.position = name;
  const [fx, fy] = POS_MAP[name] || [0.5, 0.5];
  wmState.dragX = fx;
  wmState.dragY = fy;
}

function syncGridFromDrag() {
  // Find nearest named position
  let best = 'center', bestDist = Infinity;
  for (const [name, [fx, fy]] of Object.entries(POS_MAP)) {
    const d = Math.hypot(wmState.dragX - fx, wmState.dragY - fy);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  wmState.position = best;
  document.querySelectorAll('.pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === best));
}

// ── Draw preview ───────────────────────────────────────────────────────────
function drawWmPreview() {
  const canvas = document.getElementById('wmCanvas');
  const handle = document.getElementById('wmDragHandle');

  if (!wmState.bgImg) return;

  const img   = wmState.bgImg;
  const BOX   = 380;
  const scale = Math.min(BOX / img.naturalWidth, BOX / img.naturalHeight, 1);
  canvas.width  = Math.round(img.naturalWidth  * scale);
  canvas.height = Math.round(img.naturalHeight * scale);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.style.display = 'block';
  document.getElementById('wmPreviewEmpty').style.display = 'none';

  // Position the drag handle
  const opacity  = parseInt(document.getElementById('wmOpacity').value) / 100;
  const color    = document.getElementById('wmColor').value;
  const size     = parseInt(document.getElementById('wmSize').value);
  const text     = document.getElementById('wmText').value || '© Watermark';
  const label    = document.getElementById('wmPreviewLabel');
  const photoEl  = document.getElementById('wmPreviewPhoto');

  if (wmState.type === 'text') {
    label.style.display    = 'inline';
    photoEl.style.display  = 'none';
    label.textContent      = text;
    label.style.color      = color;
    label.style.fontSize   = Math.max(10, Math.min(size * scale, 72)) + 'px';
    label.style.opacity    = opacity;
    label.style.textShadow = '1px 1px 3px rgba(0,0,0,0.6)';
  } else {
    label.style.display   = 'none';
    if (wmState.photoImg) {
      photoEl.style.display  = 'block';
      const pctSize = parseInt(document.getElementById('wmPhotoSize').value) / 100;
      const maxW    = canvas.width * pctSize;
      photoEl.style.maxWidth = Math.max(40, Math.min(maxW, 200)) + 'px';
      photoEl.style.opacity  = opacity;
      photoEl.src = wmState.photoImg.src;
    } else {
      label.style.display   = 'inline';
      label.textContent     = '[ Upload logo ]';
      label.style.color     = '#888';
      label.style.opacity   = 1;
      photoEl.style.display = 'none';
    }
  }

  // Position handle in canvas
  const hx = wmState.dragX * canvas.width;
  const hy = wmState.dragY * canvas.height;
  handle.style.left = hx + 'px';
  handle.style.top  = hy + 'px';

  document.getElementById('wmOverlay').style.display = 'block';
  document.getElementById('wmDragHint').style.display = 'flex';
}

// ── Drag handle ────────────────────────────────────────────────────────────
function initWmDrag() {
  const handle = document.getElementById('wmDragHandle');
  const stage  = document.getElementById('wmStage');

  function getStagePos(e) {
    const rect   = document.getElementById('wmCanvas').getBoundingClientRect();
    const canvas = document.getElementById('wmCanvas');
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      fx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      fy: Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height)),
    };
  }

  handle.addEventListener('mousedown', e => {
    wmState.isDragging = true;
    e.preventDefault();
  });
  handle.addEventListener('touchstart', e => {
    wmState.isDragging = true;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('mousemove', e => {
    if (!wmState.isDragging) return;
    const { fx, fy } = getStagePos(e);
    wmState.dragX = fx; wmState.dragY = fy;
    syncGridFromDrag();
    drawWmPreview();
  });
  window.addEventListener('touchmove', e => {
    if (!wmState.isDragging) return;
    e.preventDefault();
    const { fx, fy } = getStagePos(e);
    wmState.dragX = fx; wmState.dragY = fy;
    syncGridFromDrag();
    drawWmPreview();
  }, { passive: false });

  window.addEventListener('mouseup',  () => { wmState.isDragging = false; });
  window.addEventListener('touchend', () => { wmState.isDragging = false; });
}

// ── Image selector ─────────────────────────────────────────────────────────
function refreshWmSelector() {
  const files    = window.appState?.files || [];
  const selector = document.getElementById('wmImgSelector');
  const thumbs   = document.getElementById('wmPisThumbs');
  thumbs.innerHTML = '';

  if (!files.length) {
    selector.style.display = 'none';
    wmState.bgImg = null;
    document.getElementById('wmPreviewEmpty').style.display = 'flex';
    document.getElementById('wmCanvas').style.display = 'none';
    document.getElementById('wmOverlay').style.display = 'none';
    document.getElementById('wmDragHint').style.display = 'none';
    return;
  }

  selector.style.display = 'flex';
  if (wmState.fileIdx >= files.length) wmState.fileIdx = 0;

  files.forEach((f, i) => {
    const el = document.createElement('img');
    el.src = f.thumb;
    el.className = 'pis-thumb' + (i === wmState.fileIdx ? ' active' : '');
    el.title = f.name;
    el.addEventListener('click', () => {
      wmState.fileIdx = i;
      loadWmBg(f.thumb);
      thumbs.querySelectorAll('.pis-thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbs.appendChild(el);
  });

  if (!wmState.bgImg) loadWmBg(files[0].thumb);
}

function loadWmBg(src) {
  const el = new Image();
  el.onload = () => { wmState.bgImg = el; drawWmPreview(); };
  el.src = src;
}

// ── Processing ─────────────────────────────────────────────────────────────
window.applyWatermark = async function(files, opts) {
  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = opts.opacity;

        if (opts.type === 'photo' && opts.photoImg) {
          // Photo/logo watermark
          const pw = Math.round(c.width * (opts.photoSize / 100));
          const ph = Math.round(pw * opts.photoImg.naturalHeight / opts.photoImg.naturalWidth);
          if (opts.tile) {
            for (let ty = 0; ty < c.height + ph; ty += ph + 60) {
              for (let tx = 0; tx < c.width + pw; tx += pw + 60) {
                ctx.save(); ctx.translate(tx, ty); ctx.rotate(-Math.PI / 8);
                ctx.drawImage(opts.photoImg, 0, 0, pw, ph);
                ctx.restore();
              }
            }
          } else {
            const px = Math.round(opts.fx * c.width  - pw / 2);
            const py = Math.round(opts.fy * c.height - ph / 2);
            ctx.drawImage(opts.photoImg, px, py, pw, ph);
          }
        } else {
          // Text watermark
          ctx.fillStyle = opts.color;
          ctx.font = `bold ${opts.size}px Syne, Arial, sans-serif`;
          ctx.textBaseline = 'middle';
          const tw = ctx.measureText(opts.text).width;

          if (opts.tile) {
            const stepX = tw + 80, stepY = opts.size * 3;
            for (let ty = -opts.size; ty < c.height + stepY; ty += stepY) {
              for (let tx = -tw; tx < c.width + stepX; tx += stepX) {
                ctx.save(); ctx.translate(tx, ty); ctx.rotate(-Math.PI / 6);
                ctx.fillText(opts.text, 0, 0);
                ctx.restore();
              }
            }
          } else {
            const tx = Math.round(opts.fx * c.width  - tw / 2);
            const ty = Math.round(opts.fy * c.height);
            ctx.fillText(opts.text, tx, ty);
          }
        }

        return window.canvasToBlob(c, f.type, 0.92);
      });

      const blob = await result;
      window.setFileStatus(f.id, 'done', {
        url:  URL.createObjectURL(blob),
        name: window.addSuffix(f.name, '_watermarked'),
        size: blob.size,
      });
    } catch (e) {
      console.error('[Watermark]', e);
      window.setFileStatus(f.id, 'error', { msg: 'Watermark failed' });
    }
    await window.sleep(30);
  }
  window.toast(`Watermarked ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ── UI bindings ────────────────────────────────────────────────────────────
(function initWatermarkUI() {
  initWmDrag();
  setPosFromName('center');

  // Live slider updates → redraw preview
  ['wmSize','wmOpacity','wmPhotoSize'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const valEl = document.getElementById(id + 'Val');
      if (valEl) valEl.textContent = el.value + (id === 'wmSize' ? 'px' : '%');
      drawWmPreview();
    });
  });

  document.getElementById('wmText').addEventListener('input', drawWmPreview);

  document.getElementById('wmColor').addEventListener('input', e => {
    document.getElementById('wmColorHex').textContent = e.target.value;
    drawWmPreview();
  });

  // Color swatches
  document.querySelectorAll('.wm-color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.getElementById('wmColor').value = sw.dataset.c;
      document.getElementById('wmColorHex').textContent = sw.dataset.c;
      drawWmPreview();
    });
  });

  document.getElementById('wmTile').addEventListener('change', drawWmPreview);

  // Position grid
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      setPosFromName(btn.dataset.pos);
      drawWmPreview();
    });
  });

  // Type pills
  document.querySelectorAll('[data-wt]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-wt]').forEach(x => x.classList.remove('active'));
      pill.classList.add('active');
      wmState.type = pill.dataset.wt;
      document.getElementById('wmTextControls').style.display  = wmState.type === 'text'  ? 'block' : 'none';
      document.getElementById('wmPhotoControls').style.display = wmState.type === 'photo' ? 'block' : 'none';
      drawWmPreview();
    });
  });

  // Photo upload
  document.getElementById('wmPhotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        wmState.photoImg = img;
        const thumb = document.getElementById('wmPhotoThumb');
        const tImg  = document.getElementById('wmPhotoThumbImg');
        tImg.src = ev.target.result;
        thumb.style.display = 'flex';
        drawWmPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('wmPhotoRemove')?.addEventListener('click', () => {
    wmState.photoImg = null;
    document.getElementById('wmPhotoThumb').style.display = 'none';
    document.getElementById('wmPhotoInput').value = '';
    drawWmPreview();
  });

  // Apply button
  document.getElementById('watermarkBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }

    if (wmState.type === 'text' && !document.getElementById('wmText').value.trim()) {
      window.toast('Enter watermark text', 'error'); return;
    }
    if (wmState.type === 'photo' && !wmState.photoImg) {
      window.toast('Upload a logo/photo first', 'error'); return;
    }

    const opts = {
      type:      wmState.type,
      text:      document.getElementById('wmText').value.trim(),
      size:      parseInt(document.getElementById('wmSize').value),
      opacity:   parseInt(document.getElementById('wmOpacity').value) / 100,
      color:     document.getElementById('wmColor').value,
      tile:      document.getElementById('wmTile').checked,
      fx:        wmState.dragX,
      fy:        wmState.dragY,
      photoImg:  wmState.photoImg,
      photoSize: parseInt(document.getElementById('wmPhotoSize')?.value || 20),
    };

    window.applyWatermark(files, opts);
  });

  window.addEventListener('nprimg:filesChanged', refreshWmSelector);
})();