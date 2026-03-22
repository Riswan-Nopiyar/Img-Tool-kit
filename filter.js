/**
 * NPRIMG — filter.js
 * Filter & Effects Feature: brightness, contrast, saturation, blur,
 * hue-rotate, grayscale, sepia, invert + quick presets
 * Depends on: window.processWithCanvas, window.canvasToBlob,
 *             window.setFileStatus, window.addSuffix, window.sleep, window.toast
 */

// ===================== FILTER PRESETS =====================
const FILTER_PRESETS = {
  none:      { brightness: 100, contrast: 100, saturation: 100, blur: 0,  hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
  grayscale: { brightness: 100, contrast: 110, saturation: 0,   blur: 0,  hue: 0,   grayscale: 100, sepia: 0,  invert: 0 },
  vintage:   { brightness: 95,  contrast: 90,  saturation: 70,  blur: 0,  hue: 10,  grayscale: 0,  sepia: 40, invert: 0 },
  vivid:     { brightness: 110, contrast: 120, saturation: 160, blur: 0,  hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
  cold:      { brightness: 100, contrast: 105, saturation: 90,  blur: 0,  hue: 200, grayscale: 0,  sepia: 0,  invert: 0 },
  warm:      { brightness: 108, contrast: 100, saturation: 110, blur: 0,  hue: 15,  grayscale: 0,  sepia: 20, invert: 0 },
  dramatic:  { brightness: 85,  contrast: 150, saturation: 80,  blur: 0,  hue: 0,   grayscale: 0,  sepia: 0,  invert: 0 },
};

// ===================== FILTER SLIDERS CONFIG =====================
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

// ===================== FILTER PROCESSING =====================
window.applyFilters = async function(files, filters) {
  if (!files.length) return;

  for (const f of files) {
    window.setFileStatus(f.id, 'processing');
    try {
      const result = await window.processWithCanvas(f.file, async (img) => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        ctx.filter = [
          `brightness(${filters.brightness}%)`,
          `contrast(${filters.contrast}%)`,
          `saturate(${filters.saturation}%)`,
          `blur(${filters.blur}px)`,
          `hue-rotate(${filters.hue}deg)`,
          `grayscale(${filters.grayscale}%)`,
          `sepia(${filters.sepia}%)`,
          `invert(${filters.invert}%)`,
        ].join(' ');

        ctx.drawImage(img, 0, 0);
        return window.canvasToBlob(canvas, f.type, 0.92);
      });

      const blob = await result;
      const url  = URL.createObjectURL(blob);
      const name = window.addSuffix(f.name, '_filtered');
      window.setFileStatus(f.id, 'done', { url, name, size: blob.size });

    } catch (e) {
      console.error('[NPRIMG Filter]', f.name, e);
      window.setFileStatus(f.id, 'error', { msg: 'Filter failed' });
    }

    await window.sleep(30);
  }

  window.toast(`Filters applied to ${files.length} image${files.length > 1 ? 's' : ''}`, 'success');
};

// ===================== HELPERS =====================
function readFilterValues() {
  const out = {};
  FILTER_SLIDERS.forEach(({ sliderId, key }) => {
    out[key] = parseInt(document.getElementById(sliderId).value);
  });
  return out;
}

function applyPresetToUI(preset) {
  FILTER_SLIDERS.forEach(({ sliderId, valId, key, unit }) => {
    const val = preset[key] ?? 0;
    document.getElementById(sliderId).value    = val;
    document.getElementById(valId).textContent = val + unit;
  });
}

// ===================== FILTER UI BINDINGS =====================
(function initFilterUI() {
  // Live value labels for all sliders
  FILTER_SLIDERS.forEach(({ sliderId, valId, unit }) => {
    const slider = document.getElementById(sliderId);
    const label  = document.getElementById(valId);
    slider.addEventListener('input', () => {
      label.textContent = slider.value + unit;
    });
  });

  // Quick preset chips
  document.querySelectorAll('[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = FILTER_PRESETS[chip.dataset.preset];
      if (preset) applyPresetToUI(preset);
    });
  });

  // Action button
  document.getElementById('filterBtn').addEventListener('click', () => {
    const files = window.appState?.files;
    if (!files?.length) { window.toast('Upload images first', 'error'); return; }
    window.applyFilters(files, readFilterValues());
  });
})();