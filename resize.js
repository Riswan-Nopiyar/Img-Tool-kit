/**
 * NPRIMG — resize.js
 * Resize Feature: change image dimensions with aspect ratio lock
 * Depends on: window.processWithCanvas, window.canvasToBlob,
 *             window.setFileStatus, window.addSuffix, window.sleep, window.toast
 */

// ===================== RESIZE PROCESSING =====================
window.resizeFiles = async function(files, targetW, targetH, smooth, lock) {
  if (!files.length) return;

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

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = smooth;
        ctx.imageSmoothingQuality = smooth ? 'high' : 'pixelated';
        ctx.drawImage(img, 0, 0, w, h);
        return window.canvasToBlob(canvas, f.type, 0.92);
      });

      const result = await blob;
      const url    = URL.createObjectURL(result);
      const name   = window.addSuffix(f.name, `_${targetW || 'auto'}x${targetH || 'auto'}`);
      window.setFileStatus(f.id, 'done', { url, name, size: result.size });

    } catch (e) {
      console.error('[NPRIMG Resize]', f.name, e);
      window.setFileStatus(f.id, 'error', { msg: 'Resize failed' });
    }

    await window.sleep(30);
  }

  window.toast(`Resized ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ===================== RESIZE UI BINDINGS =====================
(function initResizeUI() {
  const resizeW      = document.getElementById('resizeW');
  const resizeH      = document.getElementById('resizeH');
  const aspectToggle = document.getElementById('aspectToggle');
  const lockIcon     = document.getElementById('lockAspect');

  // Lock icon click toggles the checkbox
  lockIcon.addEventListener('click', () => {
    aspectToggle.checked = !aspectToggle.checked;
    lockIcon.classList.toggle('locked', aspectToggle.checked);
  });
  aspectToggle.addEventListener('change', () => {
    lockIcon.classList.toggle('locked', aspectToggle.checked);
  });

  // Auto-calculate height when width changes (and vice versa) if locked
  resizeW.addEventListener('input', () => {
    if (!aspectToggle.checked) return;
    const first = window.appState?.files[0];
    if (!first?.width || !resizeW.value) return;
    const ratio = first.height / first.width;
    resizeH.value = Math.round(parseInt(resizeW.value) * ratio) || '';
  });
  resizeH.addEventListener('input', () => {
    if (!aspectToggle.checked) return;
    const first = window.appState?.files[0];
    if (!first?.height || !resizeH.value) return;
    const ratio = first.width / first.height;
    resizeW.value = Math.round(parseInt(resizeH.value) * ratio) || '';
  });

  // Preset size chips
  document.querySelectorAll('.chip[data-w]').forEach(chip => {
    chip.addEventListener('click', () => {
      resizeW.value = chip.dataset.w;
      resizeH.value = chip.dataset.h;
    });
  });

  // Interpolation pills
  document.querySelectorAll('#panel-resize .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#panel-resize .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });

  // Action button
  document.getElementById('resizeBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }

    const w = parseInt(resizeW.value) || null;
    const h = parseInt(resizeH.value) || null;
    if (!w && !h) { window.toast('Enter width or height', 'error'); return; }

    const smooth = document.querySelector('#panel-resize .pill.active')?.dataset.val !== 'pixelated';
    window.resizeFiles(files, w, h, smooth, aspectToggle.checked);
  });
})();