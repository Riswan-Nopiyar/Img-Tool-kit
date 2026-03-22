/**
 * NPRIMG — crop.js
 * Crop Feature: trim images by coordinates or aspect ratio preset
 * Depends on: window.processWithCanvas, window.canvasToBlob,
 *             window.setFileStatus, window.addSuffix, window.sleep, window.toast
 */

// ===================== CROP STATE =====================
const cropState = {
  aspectRatio: 'free',  // 'free' | '1:1' | '4:3' | '16:9' | etc.
};

// ===================== CROP PROCESSING =====================
window.cropFiles = async function(files, x, y, w, h) {
  if (!files.length) return;

  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;

        // Clamp values to image bounds
        const cx = Math.max(0, Math.min(x, iw - 1));
        const cy = Math.max(0, Math.min(y, ih - 1));
        const cw = Math.max(1, Math.min(w, iw - cx));
        const ch = Math.max(1, Math.min(h, ih - cy));

        const canvas = document.createElement('canvas');
        canvas.width  = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        return window.canvasToBlob(canvas, f.type, 0.92);
      });

      const blob = await result;
      const url  = URL.createObjectURL(blob);
      const name = window.addSuffix(f.name, '_cropped');
      window.setFileStatus(f.id, 'done', { url, name, size: blob.size });

    } catch (e) {
      console.error('[NPRIMG Crop]', f.name, e);
      window.setFileStatus(f.id, 'error', { msg: 'Crop failed' });
    }

    await window.sleep(30);
  }

  window.toast(`Cropped ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ===================== ASPECT RATIO HELPER =====================
function applyCropAspectRatio() {
  const cw = parseInt(document.getElementById('cropW').value) || 100;
  if (cropState.aspectRatio === 'free') return;
  const [aw, ah] = cropState.aspectRatio.split(':').map(Number);
  document.getElementById('cropH').value = Math.round(cw * ah / aw);
}

// ===================== CROP UI BINDINGS =====================
(function initCropUI() {
  // Aspect ratio chips
  document.querySelectorAll('[data-ar]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-ar]').forEach(x => x.classList.remove('active'));
      chip.classList.add('active');
      cropState.aspectRatio = chip.dataset.ar;
      applyCropAspectRatio();
    });
  });

  // Re-apply AR constraint when width changes
  document.getElementById('cropW').addEventListener('input', applyCropAspectRatio);

  // Action button
  document.getElementById('cropBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }

    const x = parseInt(document.getElementById('cropX').value) || 0;
    const y = parseInt(document.getElementById('cropY').value) || 0;
    const w = parseInt(document.getElementById('cropW').value) || 0;
    const h = parseInt(document.getElementById('cropH').value) || 0;

    if (!w || !h) { window.toast('Set crop width and height', 'error'); return; }

    window.cropFiles(files, x, y, w, h);
  });
})();