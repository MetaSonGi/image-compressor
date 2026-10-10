/* 이미지 압축기 — 포맷 변환 + 품질 + 리사이즈 (100% 클라이언트) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const items = []; // {id, name, origSize, img, w, h, blob, outSize, url, el...}
  let seq = 0;

  const dropZone = $('dropZone'), fileInput = $('fileInput');
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => { addFiles(e.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  ['outFmt', 'quality', 'maxW'].forEach((id) => $(id).addEventListener('input', () => {
    $('qVal').textContent = $('quality').value;
    recompressAll();
  }));

  function fmtSize(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB';
    if (b >= 102400) return Math.round(b / 1024) + ' KB';
    return (b / 1024).toFixed(1) + ' KB';
  }

  function addFiles(files) {
    [...files].filter((f) => f.type.startsWith('image/')).forEach((f) => {
      const id = 'f' + (++seq);
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const it = { id, name: f.name.replace(/\.[^.]+$/, ''), origSize: f.size, img, w: img.naturalWidth, h: img.naturalHeight, thumb: url };
        items.push(it);
        buildCard(it);
        compress(it);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  function buildCard(it) {
    const card = document.createElement('div');
    card.className = 'fcard'; card.id = 'card_' + it.id;
    card.innerHTML = `
      <img alt="" />
      <div class="finfo">
        <div class="fname">${escapeHtml(it.name)}</div>
        <div class="fmeta">${it.w}×${it.h}px · 원본 ${fmtSize(it.origSize)}</div>
        <div class="fmeta result">압축 중…</div>
        <div class="sbar"><div class="fill" style="width:100%"></div></div>
      </div>
      <div class="factions">
        <span class="status">⏳</span>
        <button class="btn small" disabled>⬇ 저장</button>
        <button class="btn small ghost">✕</button>
      </div>`;
    card.querySelector('img').src = it.thumb;
    const [dlBtn, delBtn] = card.querySelectorAll('.btn');
    it.statusEl = card.querySelector('.status');
    it.resultEl = card.querySelector('.result');
    it.fillEl = card.querySelector('.fill');
    dlBtn.addEventListener('click', () => downloadOne(it));
    delBtn.addEventListener('click', () => {
      const i = items.indexOf(it);
      if (i >= 0) items.splice(i, 1);
      card.remove();
      updateTotal();
    });
    it.dlBtn = dlBtn;
    $('fileList').prepend(card);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function compress(it) {
    it.statusEl.textContent = '⏳ 압축 중…';
    it.statusEl.className = 'status working';
    const fmt = $('outFmt').value, q = $('quality').value / 100;
    const maxW = Math.max(320, +$('maxW').value || 1920);
    const scale = Math.min(1, maxW / it.w);
    const w = Math.round(it.w * scale), h = Math.round(it.h * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (fmt === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // 투명 → 흰 배경
    ctx.drawImage(it.img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, fmt, q));
    if (!blob) { it.statusEl.textContent = '❌ 실패'; return; }
    it.blob = blob; it.outSize = blob.size; it.outW = w; it.outH = h; it.fmt = fmt;
    const savePct = Math.max(0, Math.round((1 - blob.size / it.origSize) * 100));
    const ext = fmt === 'image/jpeg' ? 'jpg' : fmt === 'image/webp' ? 'webp' : 'png';
    it.outName = `${it.name}_compressed.${ext}`;
    it.resultEl.innerHTML = `${w}×${h}px · 압축 후 <b>${fmtSize(blob.size)}</b> · <span class="save">-${savePct}%</span>`;
    it.fillEl.style.width = Math.max(2, 100 - savePct) + '%';
    it.statusEl.textContent = '✅ 완료';
    it.statusEl.className = 'status';
    it.dlBtn.disabled = false;
    updateTotal();
  }

  function recompressAll() {
    items.forEach((it) => { it.dlBtn.disabled = true; compress(it); });
  }

  function updateTotal() {
    const done = items.filter((it) => it.blob);
    if (!done.length) {
      $('totalInfo').textContent = items.length ? '압축 중…' : '이미지를 넣어주세요';
      $('downloadAll').disabled = true;
      return;
    }
    const o = done.reduce((a, it) => a + it.origSize, 0);
    const n = done.reduce((a, it) => a + it.outSize, 0);
    const pct = Math.round((1 - n / o) * 100);
    $('totalInfo').innerHTML = `총 ${done.length}장 · ${fmtSize(o)} → <b>${fmtSize(n)}</b> · <span class="save">${pct}% 절약</span>`;
    $('downloadAll').disabled = false;
  }

  function downloadOne(it) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(it.blob);
    a.download = it.outName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $('downloadAll').addEventListener('click', () => {
    const done = items.filter((it) => it.blob);
    (function next(i) {
      if (i >= done.length) return;
      downloadOne(done[i]);
      setTimeout(() => next(i + 1), 400);
    })(0);
  });
})();
