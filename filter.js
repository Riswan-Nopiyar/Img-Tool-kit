/**
 * NPRIMG — filter.js
 * Filter with live preview using CSS filters on an <img> element
 */

const filterPreview = { fileIdx: 0 };

const FILTER_PRESETS = {
  none:      { brightness: 100, contrast: 100, saturation: 100, blur: 0, hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
  grayscale: { brightness: 100, contrast: 110, saturation: 0,   blur: 0, hue: 0,   grayscale: 100, sepia: 0,  invert: 0 },
  vintage:   { brightness: 95,  contrast: 90,  saturation: 70,  blur: 0, hue: 10,  grayscale: 0,  sepia: 40, invert: 0 },
  vivid:     { brightness: 110, contrast: 120, saturation: 160, blur: 0, hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
  cold:      { brightness: 100, contrast: 105, saturation: 90,  blur: 0, hue: 200, grayscale: 0,  sepia: 0,  invert: 0 },
  warm:      { brightness: 108, contrast: 100, saturation: 110, blur: 0, hue: 15,  grayscale: 0,  sepia: 20, invert: 0 },
  dramatic:  { brightness: 85,  contrast: 150, saturation: 80,  blur: 0, hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
};

const FILTER_SLIDERS = [
  { sliderId: 'brightnessSlider', valId: 'brightnessVal', key: 'brightness', unit: '%' },
  { sliderId: 'contrastSlider',   valId: 'contrastVal',   key: 'contrast',   unit: '%' },
  { sliderId: 'saturationSlider', valId: 'saturationVal', key: 'saturation', unit: '%' },
  { sliderId: 'blurSlider',       valId: 'blurVal',       key: 'blur',       unit: 'px' },
  { sliderId: 'hueSlider',        valId: 'hueVal',        key: 'hue',        unit: '°' },
  { sliderId: 'graySlider',       valId: 'grayVal',       key: 'grayscale',  unit: '%' },
  { sliderId: 'sepiaSlider',      valId: 'sepiaVal',      key: 'sepia',      unit: '%' },
  { sliderId: 'invertSlider',     valId: 'invertVal',     key: 'invert',     unit: '%' },
];

function readFilterValues() {
  const out = {};
  FILTER_SLIDERS.forEach(({ sliderId, key }) => {
    out[key] = parseInt(document.getElementById(sliderId).value);
  });
  return out;
}

function buildFilterString(f) {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) blur(${f.blur}px) hue-rotate(${f.hue}deg) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%)`;
}

function updateFilterPreview() {
  const img = document.getElementById('filterPreviewImg');
  if (!img.src || img.style.display === 'none') return;
  img.style.filter = buildFilterString(readFilterValues());
}

function setFilterPreviewSrc(src) {
  const img   = document.getElementById('filterPreviewImg');
  const empty = document.getElementById('filterPreviewEmpty');
  img.src = src;
  img.style.display = 'block';
  empty.style.display = 'none';
  updateFilterPreview();
}

function applyPresetToUI(preset) {
  FILTER_SLIDERS.forEach(({ sliderId, valId, key, unit }) => {
    const val = preset[key] ?? 0;
    document.getElementById(sliderId).value = val;
    document.getElementById(valId).textContent = val + unit;
  });
  updateFilterPreview();
}

function refreshFilterSelector() {
  const files    = window.appState?.files || [];
  const selector = document.getElementById('filterImgSelector');
  const thumbs   = document.getElementById('filterPisThumbs');
  thumbs.innerHTML = '';

  if (!files.length) {
    selector.style.display = 'none';
    document.getElementById('filterPreviewImg').style.display = 'none';
    document.getElementById('filterPreviewEmpty').style.display = 'flex';
    return;
  }

  selector.style.display = 'flex';
  if (filterPreview.fileIdx >= files.length) filterPreview.fileIdx = 0;

  files.forEach((f, i) => {
    const el = document.createElement('img');
    el.src = f.thumb;
    el.className = 'pis-thumb' + (i === filterPreview.fileIdx ? ' active' : '');
    el.title = f.name;
    el.addEventListener('click', () => {
      filterPreview.fileIdx = i;
      setFilterPreviewSrc(f.thumb);
      thumbs.querySelectorAll('.pis-thumb').forEach((t, j) => t.classList.toggle('active', j === i));
    });
    thumbs.appendChild(el);
  });

  const previewImg = document.getElementById('filterPreviewImg');
  if (!previewImg.src || previewImg.style.display === 'none') {
    setFilterPreviewSrc(files[0].thumb);
  }
}

// ── Processing ─────────────────────────────────────────────────────────────
window.applyFilters = async function(files, filters) {
  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.filter = buildFilterString(filters);
        ctx.drawImage(img, 0, 0);
        return window.canvasToBlob(c, f.type, 0.92);
      });
      const blob = await result;
      window.setFileStatus(f.id, 'done', {
        url:  URL.createObjectURL(blob),
        name: window.addSuffix(f.name, '_filtered'),
        size: blob.size,
      });
    } catch (e) {
      window.setFileStatus(f.id, 'error', { msg: 'Filter failed' });
    }
    await window.sleep(30);
  }
  window.toast(`Filters applied to ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ── UI bindings ────────────────────────────────────────────────────────────
(function initFilterUI() {
  FILTER_SLIDERS.forEach(({ sliderId, valId, unit }) => {
    const slider = document.getElementById(sliderId);
    const label  = document.getElementById(valId);
    slider.addEventListener('input', () => {
      label.textContent = slider.value + unit;
      updateFilterPreview();
    });
  });

  document.querySelectorAll('[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const p = FILTER_PRESETS[chip.dataset.preset];
      if (p) applyPresetToUI(p);
    });
  });

  document.getElementById('filterBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }
    window.applyFilters(files, readFilterValues());
  });

  window.addEventListener('nprimg:filesChanged', refreshFilterSelector);
})();