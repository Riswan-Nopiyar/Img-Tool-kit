/**
 * NPRIMG — watermark.js
 * Watermark Feature: text overlay with position, opacity, color, tile mode
 * Depends on: window.processWithCanvas, window.canvasToBlob,
 *             window.setFileStatus, window.addSuffix, window.sleep, window.toast
 */

// ===================== WATERMARK STATE =====================
const watermarkState = {
  position: 'center',
};

// ===================== WATERMARK PROCESSING =====================
window.applyWatermark = async function(files, opts) {
  if (!files.length) return;

  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        // Draw original image first
        ctx.drawImage(img, 0, 0);

        // Watermark style
        ctx.globalAlpha  = opts.opacity;
        ctx.fillStyle    = opts.color;
        ctx.font         = `bold ${opts.size}px Syne, Arial, sans-serif`;
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(opts.text).width;

        if (opts.tile) {
          // Tiled / repeating watermark across entire image
          const stepX = textWidth + 80;
          const stepY = opts.size * 3;

          for (let ty = -opts.size; ty < canvas.height + stepY; ty += stepY) {
            for (let tx = -textWidth; tx < canvas.width + stepX; tx += stepX) {
              ctx.save();
              ctx.translate(tx, ty);
              ctx.rotate(-Math.PI / 6);
              ctx.fillText(opts.text, 0, 0);
              ctx.restore();
            }
          }
        } else {
          // Single positioned watermark
          const pad = Math.max(20, opts.size * 0.5);
          const pos = opts.position;
          let tx, ty;

          // Horizontal
          if (pos.includes('left'))        tx = pad;
          else if (pos.includes('right'))  tx = canvas.width - textWidth - pad;
          else                             tx = (canvas.width - textWidth) / 2;

          // Vertical
          if (pos.includes('top'))         ty = pad + opts.size / 2;
          else if (pos.includes('bottom')) ty = canvas.height - pad - opts.size / 2;
          else                             ty = canvas.height / 2;

          ctx.fillText(opts.text, tx, ty);
        }

        return window.canvasToBlob(canvas, f.type, 0.92);
      });

      const blob = await result;
      const url  = URL.createObjectURL(blob);
      const name = window.addSuffix(f.name, '_watermarked');
      window.setFileStatus(f.id, 'done', { url, name, size: blob.size });

    } catch (e) {
      console.error('[NPRIMG Watermark]', f.name, e);
      window.setFileStatus(f.id, 'error', { msg: 'Watermark failed' });
    }

    await window.sleep(30);
  }

  window.toast(`Watermarked ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ===================== WATERMARK UI BINDINGS =====================
(function initWatermarkUI() {
  // Font size slider
  const wmSize    = document.getElementById('wmSize');
  const wmSizeVal = document.getElementById('wmSizeVal');
  wmSize.addEventListener('input', () => {
    wmSizeVal.textContent = wmSize.value + 'px';
  });

  // Opacity slider
  const wmOpacity = document.getElementById('wmOpacity');
  const wmOpacVal = document.getElementById('wmOpacVal');
  wmOpacity.addEventListener('input', () => {
    wmOpacVal.textContent = wmOpacity.value + '%';
  });

  // Color picker
  const wmColor    = document.getElementById('wmColor');
  const wmColorHex = document.getElementById('wmColorHex');
  wmColor.addEventListener('input', () => {
    wmColorHex.textContent = wmColor.value;
  });

  // Position grid buttons
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      watermarkState.position = btn.dataset.pos;
    });
  });

  // Action button
  document.getElementById('watermarkBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }

    const text = document.getElementById('wmText').value.trim();
    if (!text) { window.toast('Enter watermark text', 'error'); return; }

    const opts = {
      text,
      size:     parseInt(wmSize.value),
      opacity:  parseInt(wmOpacity.value) / 100,
      position: watermarkState.position,
      color:    wmColor.value,
      tile:     document.getElementById('wmTile').checked,
    };

    window.applyWatermark(files, opts);
  });
})();