/**
 * NPRIMG — resize.js
 * Resize with live canvas preview + image selector strip
 */

const resizePreview = { img: null, fileIdx: 0 };

function updateResizePreview() {
  const canvas  = document.getElementById('resizeCanvas');
  const empty   = document.getElementById('resizePreviewEmpty');
  const infoBar = document.getElementById('resizeInfoBar');

  if (!resizePreview.img) {
    canvas.style.display  = 'none';
    empty.style.display   = 'flex';
    infoBar.style.display = 'none';
    return;
  }

  const img   = resizePreview.img;
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const lock  = document.getElementById('aspectToggle').checked;

  let targetW = parseInt(document.getElementById('resizeW').value) || origW;
  let targetH = parseInt(document.getElementById('resizeH').value) || origH;

  if (lock) {
    const wHasVal = !!document.getElementById('resizeW').value;
    const hHasVal = !!document.getElementById('resizeH').value;
    if (wHasVal && !hHasVal) targetH = Math.round(origH * targetW / origW);
    if (!wHasVal && hHasVal) targetW = Math.round(origW * targetH / origH);
  }

  const BOX   = 380;
  const scale = Math.min(BOX / targetW, BOX / targetH, 1);
  canvas.width  = Math.round(targetW * scale);
  canvas.height = Math.round(targetH * scale);

  const smooth = document.querySelector('#panel-resize .pill.active')?.dataset.val !== 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = smooth ? 'high' : 'pixelated';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  canvas.style.display  = 'block';
  empty.style.display   = 'none';
  infoBar.style.display = 'flex';
  document.getElementById('resizeOrigDim').textContent = `${origW}×${origH}`;
  document.getElementById('resizeNewDim').textContent  = `${targetW}×${targetH}`;
}

function refreshResizeSelector() {
  const files    = window.appState?.files || [];
  const selector = document.getElementById('resizeImgSelector');
  const thumbs   = document.getElementById('resizePisThumbs');
  thumbs.innerHTML = '';

  if (!files.length) {
    selector.style.display = 'none';
    resizePreview.img = null;
    updateResizePreview();
    return;
  }

  selector.style.display = 'flex';
  if (resizePreview.fileIdx >= files.length) resizePreview.fileIdx = 0;

  files.forEach((f, i) => {
    const img = document.createElement('img');
    img.src = f.thumb;
    img.className = 'pis-thumb' + (i === resizePreview.fileIdx ? ' active' : '');
    img.title = f.name;
    img.addEventListener('click', () => {
      resizePreview.fileIdx = i;
      loadResizeImg(f.thumb);
      thumbs.querySelectorAll('.pis-thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbs.appendChild(img);
  });

  if (!resizePreview.img) loadResizeImg(files[0].thumb);
}

function loadResizeImg(src) {
  const el = new Image();
  el.onload = () => { resizePreview.img = el; updateResizePreview(); };
  el.src = src;
}

// ── Processing ─────────────────────────────────────────────────────────────
window.resizeFiles = async function(files, targetW, targetH, smooth, lock) {
  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const blob = await window.processWithCanvas(f.file, (img) => {
        let w = targetW || img.naturalWidth;
        let h = targetH || img.naturalHeight;
        if (lock) {
          if (targetW && !targetH) h = Math.round(img.naturalHeight * targetW / img.naturalWidth);
          if (!targetW && targetH) w = Math.round(img.naturalWidth  * targetH / img.naturalHeight);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = smooth;
        ctx.imageSmoothingQuality = smooth ? 'high' : 'pixelated';
        ctx.drawImage(img, 0, 0, w, h);
        return window.canvasToBlob(c, f.type, 0.92);
      });
      const result = await blob;
      window.setFileStatus(f.id, 'done', {
        url:  URL.createObjectURL(result),
        name: window.addSuffix(f.name, `_${targetW || 'auto'}x${targetH || 'auto'}`),
        size: result.size,
      });
    } catch (e) {
      window.setFileStatus(f.id, 'error', { msg: 'Resize failed' });
    }
    await window.sleep(30);
  }
  window.toast(`Resized ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ── UI bindings ────────────────────────────────────────────────────────────
(function initResizeUI() {
  const rW = document.getElementById('resizeW');
  const rH = document.getElementById('resizeH');
  const at = document.getElementById('aspectToggle');
  const li = document.getElementById('lockAspect');

  li.addEventListener('click', () => { at.checked = !at.checked; li.classList.toggle('locked', at.checked); updateResizePreview(); });
  at.addEventListener('change', () => { li.classList.toggle('locked', at.checked); updateResizePreview(); });

  rW.addEventListener('input', () => {
    if (at.checked && resizePreview.img && rW.value) {
      rH.value = Math.round(parseInt(rW.value) * resizePreview.img.naturalHeight / resizePreview.img.naturalWidth) || '';
    }
    updateResizePreview();
  });
  rH.addEventListener('input', () => {
    if (at.checked && resizePreview.img && rH.value) {
      rW.value = Math.round(parseInt(rH.value) * resizePreview.img.naturalWidth / resizePreview.img.naturalHeight) || '';
    }
    updateResizePreview();
  });

  document.querySelectorAll('.chip[data-w]').forEach(c => {
    c.addEventListener('click', () => { rW.value = c.dataset.w; rH.value = c.dataset.h; updateResizePreview(); });
  });

  document.querySelectorAll('#panel-resize .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#panel-resize .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      updateResizePreview();
    });
  });

  document.getElementById('resizeBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }
    const w = parseInt(rW.value) || null;
    const h = parseInt(rH.value) || null;
    if (!w && !h) { window.toast('Enter width or height', 'error'); return; }
    const smooth = document.querySelector('#panel-resize .pill.active')?.dataset.val !== 'pixelated';
    window.resizeFiles(files, w, h, smooth, at.checked);
  });

  window.addEventListener('nprimg:filesChanged', refreshResizeSelector);
})();