/**
 * NPRIMG — script.js
 * Core App: File Management, UI Tabs, Upload, Queue
 */

// ===================== STATE =====================
const state = {
  files: [],        // { id, file, name, size, type, url, thumb, resultUrl, resultName, resultSize, status }
  activeTab: 'compress',
  aspectLocked: true,
  cropAR: 'free',
  wmPosition: 'center',
  cropImg: null,
};

let fileCounter = 0;

// ===================== DOM =====================
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const statsBar     = document.getElementById('statsBar');
const statCount    = document.getElementById('statCount');
const statSize     = document.getElementById('statSize');
const statFormats  = document.getElementById('statFormats');
const clearAllBtn  = document.getElementById('clearAllBtn');
const queueSection = document.getElementById('queueSection');
const fileList     = document.getElementById('fileList');
const queueCount   = document.getElementById('queueCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const toastCont    = document.getElementById('toastContainer');

// ===================== TABS =====================
function switchTab(tab) {
  document.querySelectorAll('.nav-btn, .btab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab)?.classList.add('active');
  state.activeTab = tab;
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.btab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ===================== UPLOAD =====================
dropZone.addEventListener('click', (e) => {
  if (e.target.classList.contains('file-label') || e.target === fileInput) return;
  fileInput.click();
});
fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-hover');
});
dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-hover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-hover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
  else toast('Only image files are supported', 'error');
});

function handleFiles(files) {
  if (!files.length) return;
  let added = 0;
  files.forEach(file => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(svg|ico|bmp|tiff?)$/i)) {
      toast(`Skipped: ${file.name} (not an image)`, 'error');
      return;
    }
    const id = ++fileCounter;
    const url = URL.createObjectURL(file);
    const entry = {
      id, file, name: file.name, size: file.size,
      type: file.type || getMimeFromName(file.name),
      url, thumb: url, resultUrl: null, resultName: null,
      resultSize: null, status: 'ready'
    };
    state.files.push(entry);
    renderFileItem(entry);
    added++;
  });
  if (added > 0) {
    updateStats();
    updateQueue();
    toast(`${added} image${added > 1 ? 's' : ''} added`, 'success');
    fileInput.value = '';
    window.dispatchEvent(new CustomEvent('nprimg:filesChanged'));
  }
}

function getMimeFromName(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    tiff: 'image/tiff', tif: 'image/tiff', ico: 'image/x-icon',
    avif: 'image/avif', svg: 'image/svg+xml' };
  return map[ext] || 'image/jpeg';
}

// ===================== RENDER FILE ITEM =====================
function renderFileItem(entry) {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.id = `file-${entry.id}`;
  item.innerHTML = `
    <div class="file-thumb">
      <img src="${entry.thumb}" alt="${entry.name}" onerror="this.parentNode.innerHTML='<span class=\\'file-thumb-placeholder\\'>🖼</span>'" />
    </div>
    <div class="file-info">
      <div class="file-name" title="${entry.name}">${entry.name}</div>
      <div class="file-meta">
        <span class="file-tag format">${getExtLabel(entry.type)}</span>
        <span class="file-tag">${formatBytes(entry.size)}</span>
        <span class="file-tag dim-tag" id="dim-${entry.id}">—</span>
      </div>
    </div>
    <div class="file-status" id="status-${entry.id}">
      <span class="status-badge ready">Ready</span>
    </div>
    <button class="remove-btn" data-id="${entry.id}" title="Remove">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  fileList.appendChild(item);

  // Get image dimensions
  const img = new Image();
  img.onload = () => {
    const dimEl = document.getElementById(`dim-${entry.id}`);
    if (dimEl) dimEl.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    entry.width = img.naturalWidth;
    entry.height = img.naturalHeight;
  };
  img.src = entry.url;

  item.querySelector('.remove-btn').addEventListener('click', () => removeFile(entry.id));
}

function removeFile(id) {
  const idx = state.files.findIndex(f => f.id === id);
  if (idx > -1) {
    URL.revokeObjectURL(state.files[idx].url);
    if (state.files[idx].resultUrl) URL.revokeObjectURL(state.files[idx].resultUrl);
    state.files.splice(idx, 1);
  }
  document.getElementById(`file-${id}`)?.remove();
  updateStats();
  updateQueue();
  window.dispatchEvent(new CustomEvent('nprimg:filesChanged'));
}

function clearAll() {
  state.files.forEach(f => {
    URL.revokeObjectURL(f.url);
    if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
  });
  state.files = [];
  fileList.innerHTML = '';
  updateStats();
  updateQueue();
}

clearAllBtn.addEventListener('click', () => {
  clearAll();
  toast('Queue cleared', 'info');
  window.dispatchEvent(new CustomEvent('nprimg:filesChanged'));
});

// ===================== UPDATE UI =====================
function updateStats() {
  if (!state.files.length) {
    statsBar.style.display = 'none';
    return;
  }
  statsBar.style.display = 'flex';
  statCount.textContent = state.files.length;
  const total = state.files.reduce((acc, f) => acc + f.size, 0);
  statSize.textContent = formatBytes(total);
  const fmts = [...new Set(state.files.map(f => getExtLabel(f.type)))];
  statFormats.textContent = fmts.slice(0, 3).join(', ') + (fmts.length > 3 ? '…' : '');
}

function updateQueue() {
  queueSection.style.display = state.files.length ? 'block' : 'none';
  queueCount.textContent = state.files.length;
  const hasDone = state.files.some(f => f.status === 'done');
  downloadAllBtn.style.display = hasDone ? 'flex' : 'none';
}

// ===================== FILE STATUS UPDATE =====================
window.setFileStatus = function(id, status, extra = {}) {
  const entry = state.files.find(f => f.id === id);
  if (!entry) return;
  entry.status = status;
  const item = document.getElementById(`file-${id}`);
  if (!item) return;

  item.className = 'file-item ' + status;

  const statusEl = document.getElementById(`status-${id}`);
  if (!statusEl) return;

  if (status === 'processing') {
    statusEl.innerHTML = `<span class="status-badge processing">Processing…</span>`;
    const prog = document.createElement('div');
    prog.className = 'file-progress';
    prog.id = `prog-${id}`;
    prog.style.width = '0%';
    item.appendChild(prog);

  } else if (status === 'done' && extra.url) {
    entry.resultUrl  = extra.url;
    entry.resultName = extra.name || entry.name;
    entry.resultSize = extra.size || 0;

    // Remove progress bar
    document.getElementById(`prog-${id}`)?.remove();

    // Savings calculation
    const savings = entry.size > 0
      ? Math.round((1 - entry.resultSize / entry.size) * 100)
      : 0;
    const savingsText = savings > 0 ? `-${savings}%` : savings < 0 ? `+${Math.abs(savings)}%` : '0%';

    // Update meta tags
    const metaEl = item.querySelector('.file-meta');
    if (metaEl) {
      const existingResult = metaEl.querySelector('.result-tags');
      if (existingResult) existingResult.remove();
      const div = document.createElement('div');
      div.className = 'result-tags';
      div.style.display = 'contents';
      div.innerHTML = `
        <span class="file-tag format">${getExtFromName(entry.resultName)}</span>
        <span class="file-tag size-new">${formatBytes(entry.resultSize)}</span>
        ${savings > 0 ? `<span class="file-tag savings">${savingsText}</span>` : ''}
      `;
      metaEl.appendChild(div);
    }

    statusEl.innerHTML = `
      <span class="status-badge done">Done</span>
      <a class="download-btn" href="${extra.url}" download="${entry.resultName}" title="Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Download
      </a>
    `;
    updateQueue();

  } else if (status === 'error') {
    document.getElementById(`prog-${id}`)?.remove();
    statusEl.innerHTML = `<span class="status-badge error">${extra.msg || 'Error'}</span>`;
  }
};

window.setFileProgress = function(id, pct) {
  const prog = document.getElementById(`prog-${id}`);
  if (prog) prog.style.width = pct + '%';
};

// ===================== DOWNLOAD ALL =====================
downloadAllBtn.addEventListener('click', async () => {
  const done = state.files.filter(f => f.status === 'done' && f.resultUrl);
  if (!done.length) { toast('No processed files to download', 'info'); return; }
  for (const f of done) {
    const a = document.createElement('a');
    a.href = f.resultUrl;
    a.download = f.resultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    await sleep(120);
  }
  toast(`Downloading ${done.length} file${done.length > 1 ? 's' : ''}`, 'success');
});

// ===================== CONTROLS — COMPRESS =====================
const qualitySlider = document.getElementById('qualitySlider');
const qualityVal    = document.getElementById('qualityVal');
qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

const compressFormatPills = document.getElementById('compressFormatPills');
compressFormatPills.querySelectorAll('.pill').forEach(p => {
  p.addEventListener('click', () => {
    compressFormatPills.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
  });
});

document.getElementById('compressBtn').addEventListener('click', () => {
  if (!state.files.length) { toast('Upload images first', 'error'); return; }
  const quality = parseInt(qualitySlider.value) / 100;
  const fmt = compressFormatPills.querySelector('.pill.active')?.dataset.val || 'jpeg';
  const mimeMap = { jpeg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
  const extMap  = { jpeg: 'jpg', webp: 'webp', png: 'png' };
  window.compressFiles(state.files, mimeMap[fmt], extMap[fmt], quality);
});

// ===================== CONTROLS — CONVERT =====================
const convertFormatGrid = document.getElementById('convertFormatGrid');
convertFormatGrid.querySelectorAll('.fmt-btn').forEach(b => {
  b.addEventListener('click', () => {
    convertFormatGrid.querySelectorAll('.fmt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
});

const convertQualSlider = document.getElementById('convertQualSlider');
const convertQualVal    = document.getElementById('convertQualVal');
convertQualSlider.addEventListener('input', () => { convertQualVal.textContent = convertQualSlider.value + '%'; });

document.getElementById('convertBtn').addEventListener('click', () => {
  if (!state.files.length) { toast('Upload images first', 'error'); return; }
  const active = convertFormatGrid.querySelector('.fmt-btn.active');
  const mime   = active?.dataset.fmt  || 'image/webp';
  const ext    = active?.dataset.ext  || 'webp';
  const qual   = parseInt(convertQualSlider.value) / 100;
  window.convertFiles(state.files, mime, ext, qual);
});

// ===================== CANVAS PROCESSING =====================
window.processWithCanvas = function(file, fn) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const result = fn(img);
        resolve(result);
      } catch(e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
};

// ===================== CANVAS HELPERS =====================
function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    const safeMime = (['image/jpeg', 'image/webp', 'image/png'].includes(mime)) ? mime : 'image/png';
    canvas.toBlob(blob => resolve(blob || new Blob()), safeMime, quality);
  });
}

// ===================== TOAST =====================
window.toast = function(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
};

// ===================== UTILS =====================
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getExtLabel(mime) {
  const map = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP',
    'image/gif': 'GIF', 'image/bmp': 'BMP', 'image/tiff': 'TIFF',
    'image/x-icon': 'ICO', 'image/avif': 'AVIF', 'image/svg+xml': 'SVG' };
  return map[mime] || mime.split('/')[1]?.toUpperCase() || 'IMG';
}

function getExtFromName(name = '') {
  return (name.split('.').pop() || 'img').toUpperCase();
}

function addSuffix(name, suffix) {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return name + suffix;
  return name.slice(0, dot) + suffix + name.slice(dot);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.appState = state;
window.formatBytes = formatBytes;
window.addSuffix = addSuffix;
window.canvasToBlob = canvasToBlob;
window.sleep = sleep;