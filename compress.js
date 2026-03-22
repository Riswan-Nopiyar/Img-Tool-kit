/**
 * NPRIMG — compress.js
 * Image Compression: JPEG, WebP, PNG
 * Each format uses canvas API for client-side compression
 */

/**
 * Compress a single image file using Canvas API
 * @param {File} file - source image
 * @param {string} mime - target mime type
 * @param {string} ext - target extension
 * @param {number} quality - 0.0 to 1.0
 * @returns {Promise<Blob>}
 */
async function compressSingle(file, mime, ext, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(srcUrl);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      // For JPEG, fill white background (JPEG has no transparency)
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const safeMime = getSafeOutputMime(mime);

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error(`Compression failed for ${file.name}`));
      }, safeMime, quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(srcUrl);
      reject(new Error(`Failed to load ${file.name}`));
    };

    img.src = srcUrl;
  });
}

/**
 * Compress multiple files
 * @param {Array} files - array of file state entries
 * @param {string} mime
 * @param {string} ext
 * @param {number} quality
 */
window.compressFiles = async function(files, mime, ext, quality) {
  if (!files.length) return;
  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    window.setFileStatus(f.id, 'processing');
    window.setFileProgress(f.id, 10);

    try {
      // Simulate incremental progress
      const progressTick = setInterval(() => {
        window.setFileProgress(f.id, Math.min(85, (Date.now() % 75) + 10));
      }, 80);

      const blob = await compressSingle(f.file, mime, ext, quality);

      clearInterval(progressTick);
      window.setFileProgress(f.id, 100);

      const url        = URL.createObjectURL(blob);
      const baseName   = f.name.replace(/\.[^.]+$/, '');
      const resultName = `${baseName}_compressed.${ext}`;

      window.setFileStatus(f.id, 'done', { url, name: resultName, size: blob.size });
      successCount++;

    } catch (err) {
      console.error('[NPRIMG Compress]', err);
      window.setFileStatus(f.id, 'error', { msg: 'Failed' });
    }

    await window.sleep(30); // tiny breathing room between files
  }

  const fmt = mime.split('/')[1].toUpperCase();
  window.toast(
    `Compressed ${successCount}/${files.length} image${files.length > 1 ? 's' : ''} → ${fmt}`,
    successCount === files.length ? 'success' : 'error'
  );
};

/**
 * Some browsers don't support all output mimes on toBlob.
 * Fall back gracefully.
 */
function getSafeOutputMime(mime) {
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  return supported.includes(mime) ? mime : 'image/png';
}

/**
 * Utility: estimate compressed size before full processing
 * Uses a small 128×128 thumbnail to gauge quality ratio
 */
window.estimateCompressedSize = async function(file, mime, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const THUMB = 128;
      const scale = Math.min(THUMB / img.naturalWidth, THUMB / img.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return; }
        const ratio = blob.size / (canvas.width * canvas.height);
        const estimated = Math.round(ratio * img.naturalWidth * img.naturalHeight);
        resolve(estimated);
      }, getSafeOutputMime(mime), quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
};