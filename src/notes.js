// 아이디어 노트: post-it board saved straight to the GitHub repository (notes/notes.json).
// Anyone can read the board; editing needs the same GitHub token as the admin screen, entered once per browser.
(() => {
  const C = window.NT_CONFIG;
  if (!C) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (e){ return null; } },
    set(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch (e){ return false; } },
  };
  const TOKEN_KEY = 'l2mwiki-notes-token';
  const API = `https://api.github.com/repos/${C.repo}`;
  const RAW = `https://raw.githubusercontent.com/${C.repo}/${C.branch}/`;

  const TYPES = {
    tip:   { name: '팁' },
    guide: { name: '공략' },
    video: { name: '영상' },
    bug:   { name: '버그·수정요청' },
  };
  const COLS = [['idea', '번뜩임'], ['draft', '정리 중'], ['done', '완료']];
  // fields to flesh out a note, per type; progress = filled / total
  const GUIDE_TPL = [['summary', '한 줄 요약'], ['when', '언제 쓰는 팁인가요'], ['proof', '근거 (스샷 설명, 수치)'], ['caution', '주의할 점'], ['video', '관련 영상 주소']];
  const TPL = {
    tip: GUIDE_TPL,
    guide: GUIDE_TPL,
    video: [['thumb', '썸네일 문구'], ['scenes', '핵심 장면'], ['script', '대본 한 줄'], ['refs', '참고 자료']],
    bug: [['where', '발생 위치와 상황'], ['steps', '재현 방법'], ['expected', '기대한 동작'], ['actual', '실제 동작'], ['when', '발생 일시와 서버']],
  };

  const state = { notes: [], token: store.get(TOKEN_KEY), type: 'tip', filter: 'all', tag: null, q: '', col: 'idea', open: null, file: null, loaded: false };
  let queue = Promise.resolve();

  // ---------- helpers ----------
  const now = () => new Date().toISOString();
  const day = iso => (iso || '').slice(0, 10);
  const firstLine = t => (t || '').split('\n')[0].trim() || '(제목 없음)';
  // card / guide title: the first line without its #tags (tags are shown separately)
  const title = t => firstLine(t).replace(/#[^\s#,.]+/g, '').replace(/\s+/g, ' ').trim() || firstLine(t);
  const parseTags = t => [...new Set([...(t || '').matchAll(/#([^\s#,.]+)/g)].map(m => m[1]))];
  const progress = n => { const f = TPL[n.type] || []; const done = f.filter(([k]) => (n.fields || {})[k] && String(n.fields[k]).trim()).length; return [done, f.length]; };
  const encode = s => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
  const decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const imgUrl = p => p.startsWith('data:') ? p : RAW + p;
  const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };

  function status(text, bad){
    const el = $('#ntStatus');
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
  }

  // ---------- GitHub ----------
  async function gh(path, opt = {}){
    const r = await fetch(API + path, { ...opt, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${state.token}`, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (!r.ok){ const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  async function readNotes(){
    if (state.token){
      try {
        const j = await gh(`/contents/${C.file}?ref=${C.branch}&t=${Date.now()}`);
        return { notes: JSON.parse(decode(j.content)), sha: j.sha };
      } catch (e){ if (e.status === 404) return { notes: [], sha: null }; throw e; }
    }
    const r = await fetch(RAW + C.file + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.status === 404) return { notes: [], sha: null };
    if (!r.ok) throw new Error('read ' + r.status);
    return { notes: await r.json(), sha: null };
  }
  const putFile = (path, b64, message, sha) => gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: b64, branch: C.branch, ...(sha ? { sha } : {}) }) });

  // apply a change to the newest copy on GitHub (so two devices don't overwrite each other), one change at a time
  function commit(message, mutate){
    mutate(state.notes);                              // show it right away
    render();
    status('저장 중…');
    queue = queue.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++){
        const { notes, sha } = await readNotes();
        mutate(notes);
        try {
          await putFile(C.file, encode(JSON.stringify(notes, null, 1) + '\n'), '아이디어 노트: ' + message, sha);
          state.notes = notes;
          render();
          status('저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
          return;
        } catch (e){ if (e.status !== 409 && e.status !== 422) throw e; }
      }
      throw new Error('conflict');
    }).catch(e => {
      status(e.status === 401 || e.status === 403 ? '저장하지 못했습니다. 토큰을 다시 연결해 주세요.' : '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', true);
      load();
    });
    return queue;
  }

  // phone screenshots are shrunk to 1600px JPEG before upload
  function shrink(file){
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => fail(new Error('image'));
      img.src = URL.createObjectURL(file);
    });
  }
  async function uploadImage(file, id){
    const data = await shrink(file);
    const path = `${C.imgDir}/${id}-${Date.now().toString(36)}.jpg`;
    await putFile(path, data.split(',')[1], '아이디어 노트: 사진');
    return path;
  }

  // ---------- render ----------
  function render(){
    const editable = !!state.token;
    document.body.classList.toggle('nt-readonly', !editable);
    $('#ntAuth').hidden = editable;
    $('#ntQuick').hidden = !editable;
    $('#ntSignedIn').hidden = !editable;

    // filters
    const tags = [...new Set(state.notes.flatMap(n => n.tags || []))].sort();
    $('#ntFilter').innerHTML = [['all', '전체'], ...Object.entries(TYPES).map(([k, t]) => [k, t.name])]
      .map(([k, v]) => `<button class="mx-chip" data-f="${k}" aria-pressed="${state.filter === k}" style="--cc:var(--nt-${k === 'all' ? 'all' : k})"><i></i>${v} <span class="n">${k === 'all' ? state.notes.length : state.notes.filter(n => n.type === k).length}</span></button>`).join('')
      + tags.map(t => `<button class="nt-tag${state.tag === t ? ' on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');

    const q = state.q.trim().toLowerCase();
    const show = state.notes.filter(n => (state.filter === 'all' || n.type === state.filter) && (!state.tag || (n.tags || []).includes(state.tag))
      && (!q || (n.text + ' ' + Object.values(n.fields || {}).join(' ')).toLowerCase().includes(q)));

    $('#ntTabs').innerHTML = COLS.map(([k, v]) => `<button data-col="${k}" aria-pressed="${state.col === k}">${v} <span>${show.filter(n => n.status === k).length}</span></button>`).join('');
    $('#ntBoard').dataset.col = state.col;
    $('#ntBoard').innerHTML = COLS.map(([k, v]) => {
      const list = show.filter(n => n.status === k);
      return `<section class="nt-col" data-status="${k}">
        <h3>${v} <span>${list.length}</span></h3>
        <div class="nt-drop">${list.length ? list.map(card).join('') : `<p class="nt-empty">${!state.loaded ? '불러오는 중…' : k === 'idea' ? (editable ? '떠오른 걸 위 칸에 한 줄로 적어 보세요.' : '아직 메모가 없습니다.') : k === 'draft' ? '살을 붙이고 있는 메모가 여기에 옵니다.' : '공략으로 올렸거나 제보를 마친 메모가 여기에 옵니다.'}</p>`}</div>
      </section>`;
    }).join('');
  }
  function card(n){
    const [d, t] = progress(n);
    return `<article class="nt-card s-${n.status}" style="--tc:var(--nt-${n.type})" data-id="${n.id}" draggable="${!!state.token}" tabindex="0" role="button" aria-label="${esc(title(n.text))} 열기">
      <span class="nt-chip">${TYPES[n.type] ? TYPES[n.type].name : n.type}</span>
      <h4>${esc(title(n.text))}</h4>
      ${(n.tags || []).length ? `<div class="nt-tags">${n.tags.map(x => `<span>#${esc(x)}</span>`).join('')}</div>` : ''}
      ${n.status === 'draft' ? `<div class="nt-prog" title="채운 항목 ${d}/${t}"><i style="width:${t ? d / t * 100 : 0}%"></i></div>` : ''}
      <div class="nt-meta">${day(n.updated || n.created)}${(n.images || []).length ? ` · 사진 ${n.images.length}` : ''}${n.status === 'draft' ? ` · ${d}/${t}` : ''}${n.guide ? ' · 공략 게시' : ''}${n.reported ? ' · 제보함' : ''}</div>
    </article>`;
  }

  // ---------- detail sheet ----------
  function openSheet(id){
    const n = state.notes.find(x => x.id === id);
    if (!n) return;
    state.open = id;
    const ro = !state.token ? ' disabled' : '';
    const fields = TPL[n.type] || [];
    $('#ntSheetBody').innerHTML = `
      <div class="nt-sh-top">
        <div class="nt-types" role="group" aria-label="분류">${Object.entries(TYPES).map(([k, t]) => `<button type="button" data-stype="${k}" aria-pressed="${n.type === k}" style="--tc:var(--nt-${k})"${ro}>${t.name}</button>`).join('')}</div>
        <button type="button" class="nt-x" data-close aria-label="닫기">✕</button>
      </div>
      <label class="nt-f"><span>메모 <em>첫 줄이 제목이 됩니다 · #태그</em></span><textarea id="shText" rows="4"${ro}>${esc(n.text)}</textarea></label>
      <div class="nt-steps" role="group" aria-label="단계">${COLS.map(([k, v]) => `<button type="button" data-sstatus="${k}" aria-pressed="${n.status === k}"${ro}>${v}</button>`).join('')}</div>
      <h5>살 붙이기 <span id="shProg">${progress(n).join('/')}</span></h5>
      ${fields.map(([k, label]) => `<label class="nt-f"><span>${label}</span><textarea data-field="${k}" rows="${k === 'video' || k === 'thumb' || k === 'summary' ? 1 : 2}"${ro}>${esc((n.fields || {})[k] || '')}</textarea></label>`).join('')}
      ${n.type === 'bug' ? `<label class="nt-check"><input type="checkbox" id="shReported"${n.reported ? ' checked' : ''}${ro}>게임사에 제보함</label>` : ''}
      <h5>사진 <span>${(n.images || []).length}</span></h5>
      <div class="nt-imgs">${(n.images || []).map(p => `<a href="${imgUrl(p)}" target="_blank" rel="noopener"><img src="${imgUrl(p)}" alt="첨부 사진" loading="lazy"></a>`).join('')}
        ${state.token ? `<label class="nt-addimg">＋ 사진 추가<input type="file" accept="image/*" id="shFile" hidden></label>` : ''}</div>
      ${n.guide ? `<p class="nt-done">공략으로 게시했습니다 · <a href="../guides/${esc(n.guide)}.html">공략 보기</a> (올린 직후에는 2~3분 걸립니다)</p>` : ''}
      ${state.token ? `<div class="nt-acts">
        ${n.type === 'bug' ? `<button type="button" class="mx-btn" data-copybug>제보문 복사</button>` : ''}
        ${n.guide ? '' : `<span class="nt-promote"><select id="shCat" aria-label="공략 주제">${C.cats.map(c => `<option${c === (n.type === 'bug' ? '업데이트' : '정보') ? ' selected' : ''}>${c}</option>`).join('')}</select><button type="button" class="mx-btn primary" data-promote>공략으로 올리기</button></span>`}
        <button type="button" class="mx-btn nt-del" data-del>삭제</button>
      </div>` : ''}
      <p class="nt-sh-msg" id="shMsg" role="status"></p>`;
    $('#ntSheet').hidden = false;
    document.body.classList.add('nt-lock');
    setTimeout(() => $('#shText') && $('#shText').focus(), 0);
  }
  // read the sheet back into a note object (null when nothing changed)
  function collect(){
    const n = state.notes.find(x => x.id === state.open);
    if (!n || !state.token) return null;
    const text = $('#shText').value.trim();
    const fields = {};
    $$('[data-field]').forEach(t => { if (t.value.trim()) fields[t.dataset.field] = t.value.trim(); });
    const rep = $('#shReported');
    const next = { ...n, text: text || n.text, tags: parseTags(text), fields, ...(rep ? { reported: rep.checked } : {}) };
    // writing details on a fresh idea moves it to "정리 중"
    if (next.status === 'idea' && Object.keys(fields).length && !Object.keys(n.fields || {}).length) next.status = 'draft';
    const same = JSON.stringify({ ...n, updated: 0 }) === JSON.stringify({ ...next, updated: 0 });
    return same ? null : { ...next, updated: now() };
  }
  function closeSheet(){
    const next = collect();
    if (next) commit('수정 · ' + firstLine(next.text), ns => { const i = ns.findIndex(x => x.id === next.id); if (i >= 0) ns[i] = next; });
    state.open = null;
    $('#ntSheet').hidden = true;
    document.body.classList.remove('nt-lock');
  }
  function patchOpen(change, message){
    const next = collect() || { ...state.notes.find(x => x.id === state.open) };
    change(next);
    next.updated = now();
    return commit(message + ' · ' + firstLine(next.text), ns => { const i = ns.findIndex(x => x.id === next.id); if (i >= 0) ns[i] = { ...next }; }).then(() => openSheet(next.id));
  }

  async function promote(){
    const msg = $('#shMsg');
    const next = collect() || { ...state.notes.find(x => x.id === state.open) };
    const cat = $('#shCat').value, slug = stamp();
    msg.textContent = '공략으로 올리는 중…';
    try {
      const imgs = [];
      for (const p of next.images || []){                       // copy photos to the site's uploads folder
        const j = await gh(`/contents/${p}?ref=${C.branch}`);
        const name = 'notes-' + p.split('/').pop();
        await putFile(`public/uploads/${name}`, j.content.replace(/\s/g, ''), '공략 사진: ' + name);
        imgs.push('/uploads/' + name);
      }
      const lines = next.text.split('\n'), heading = title(next.text);
      const f = next.fields || {}, labels = Object.fromEntries((TPL[next.type] || []).map(([k, l]) => [k, l]));
      const body = [lines.slice(1).join('\n').trim(),
        ...Object.entries(f).filter(([k]) => k !== 'summary' && k !== 'video').map(([k, v]) => `## ${labels[k] || k}\n\n${v}`),
        ...(f.video ? [`## 관련 영상\n\n${f.video.trim()}`] : []),
        ...imgs.map(src => `![](${src})`)].filter(Boolean).join('\n\n');
      const md = `---\ntitle: ${JSON.stringify(heading)}\ndate: ${slug.slice(0, 4)}-${slug.slice(4, 6)}-${slug.slice(6, 8)}\ncategory: ${JSON.stringify(cat)}\nsummary: ${JSON.stringify(f.summary || '')}\n${imgs[0] ? `cover: ${imgs[0]}\n` : ''}draft: false\n---\n\n${body}\n`;
      await putFile(`content/guides/${slug}.md`, encode(md), '공략 글: ' + heading);
      next.status = 'done'; next.guide = slug; next.updated = now();
      await commit('공략으로 올림 · ' + heading,ns => { const i = ns.findIndex(x => x.id === next.id); if (i >= 0) ns[i] = { ...next }; });
      openSheet(next.id);
    } catch (e){
      msg.textContent = '올리지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
      msg.classList.add('bad');
    }
  }

  function bugText(n){
    const f = n.fields || {};
    return [`[리니지2M 버그 제보] ${title(n.text)}`, ...TPL.bug.map(([k, l]) => `- ${l}: ${f[k] || '-'}`), n.text.split('\n').slice(1).join('\n').trim()].filter(Boolean).join('\n');
  }

  // ---------- load + events ----------
  async function load(){
    try {
      const { notes } = await readNotes();
      state.notes = Array.isArray(notes) ? notes : [];
      state.loaded = true;
      render();
    } catch (e){
      state.loaded = true;
      render();
      status(e.status === 401 ? '토큰이 맞지 않습니다. 다시 연결해 주세요.' : '메모를 불러오지 못했습니다. 새로고침해 주세요.', true);
    }
  }

  $('#ntConnect').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#ntToken'), err = $('#ntAuthErr'), t = input.value.trim();
    if (!t){ err.textContent = '토큰을 붙여 넣어 주세요.'; return; }
    state.token = t;
    try {
      await readNotes();
      if (!store.set(TOKEN_KEY, t)) err.textContent = '이 브라우저에 저장할 수 없어서, 새로고침하면 다시 입력해야 합니다.';
      input.value = ''; err.textContent = '';
      render(); load();
    } catch (x){
      state.token = null;
      err.textContent = x.status === 401 ? '토큰이 맞지 않습니다. 다시 확인해 주세요.' : '연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    }
  });
  $('#ntSignOut').addEventListener('click', () => { store.set(TOKEN_KEY, null); state.token = null; render(); });

  $('#ntTypes').addEventListener('click', e => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    state.type = b.dataset.type;
    $$('#ntTypes [data-type]').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  $('#ntFile').addEventListener('change', e => {
    state.file = e.target.files[0] || null;
    $('#ntFileName').textContent = state.file ? '사진 1장 첨부' : '';
  });
  $('#ntQuick').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#ntText'), text = input.value.trim();
    if (!text){ status('한 줄이라도 적어 주세요.', true); input.focus(); return; }
    const id = 'n' + Date.now().toString(36);
    const file = state.file;
    input.value = ''; state.file = null; $('#ntFile').value = ''; $('#ntFileName').textContent = '';
    let images = [];
    if (file){
      status('사진 올리는 중…');
      try { images = [await uploadImage(file, id)]; } catch (x){ status('사진을 올리지 못했습니다. 메모만 저장합니다.', true); }
    }
    const note = { id, type: state.type, status: 'idea', text, tags: parseTags(text), fields: {}, images, created: now(), updated: now() };
    if (state.col !== 'idea'){ state.col = 'idea'; }
    commit('추가 · ' + firstLine(text), ns => { if (!ns.some(x => x.id === id)) ns.unshift(note); });
  });

  $('#ntFilter').addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f){ state.filter = f.dataset.f; render(); return; }
    const t = e.target.closest('[data-tag]'); if (t){ state.tag = state.tag === t.dataset.tag ? null : t.dataset.tag; render(); }
  });
  $('#ntSearch').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('#ntTabs').addEventListener('click', e => { const b = e.target.closest('[data-col]'); if (b){ state.col = b.dataset.col; render(); } });

  const board = $('#ntBoard');
  board.addEventListener('click', e => { const c = e.target.closest('.nt-card'); if (c) openSheet(c.dataset.id); });
  board.addEventListener('keydown', e => { const c = e.target.closest('.nt-card'); if (c && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openSheet(c.dataset.id); } });
  // drag a card to another column
  board.addEventListener('dragstart', e => { const c = e.target.closest('.nt-card'); if (c){ e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); } });
  board.addEventListener('dragend', e => { const c = e.target.closest('.nt-card'); if (c) c.classList.remove('dragging'); $$('.nt-col.over').forEach(x => x.classList.remove('over')); });
  board.addEventListener('dragover', e => { const col = e.target.closest('.nt-col'); if (col && state.token){ e.preventDefault(); $$('.nt-col').forEach(x => x.classList.toggle('over', x === col)); } });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.nt-col'); if (!col || !state.token) return;
    e.preventDefault(); col.classList.remove('over');
    const id = e.dataTransfer.getData('text/plain'), to = col.dataset.status;
    const n = state.notes.find(x => x.id === id);
    if (n && n.status !== to) commit('이동 · ' + firstLine(n.text), ns => { const x = ns.find(y => y.id === id); if (x){ x.status = to; x.updated = now(); } });
  });

  const sheet = $('#ntSheet');
  sheet.addEventListener('click', e => {
    if (e.target === sheet || e.target.closest('[data-close]')){ closeSheet(); return; }
    const ty = e.target.closest('[data-stype]'); if (ty){ patchOpen(n => { n.type = ty.dataset.stype; }, '분류 변경'); return; }
    const st = e.target.closest('[data-sstatus]'); if (st){ patchOpen(n => { n.status = st.dataset.sstatus; }, '이동'); return; }
    if (e.target.closest('[data-promote]')){ promote(); return; }
    if (e.target.closest('[data-copybug]')){
      const n = collect() || state.notes.find(x => x.id === state.open), msg = $('#shMsg');
      navigator.clipboard.writeText(bugText(n)).then(() => { msg.textContent = '제보문을 복사했습니다. 고객센터 문의 칸에 붙여 넣으세요.'; }, () => { msg.textContent = '복사하지 못했습니다. 브라우저 설정을 확인해 주세요.'; });
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del){
      if (!del.classList.contains('armed')){ del.classList.add('armed'); del.textContent = '한 번 더 누르면 삭제'; return; }
      const id = state.open, n = state.notes.find(x => x.id === id);
      state.open = null; sheet.hidden = true; document.body.classList.remove('nt-lock');
      commit('삭제 · ' + firstLine(n ? n.text : ''), ns => { const i = ns.findIndex(x => x.id === id); if (i >= 0) ns.splice(i, 1); });
    }
  });
  sheet.addEventListener('input', e => { if (e.target.matches('[data-field]')){ const n = collect(); if (n) $('#shProg').textContent = progress(n).join('/'); } });
  sheet.addEventListener('change', async e => {
    if (e.target.id !== 'shFile' || !e.target.files[0]) return;
    const msg = $('#shMsg'); msg.textContent = '사진 올리는 중…';
    try { const p = await uploadImage(e.target.files[0], state.open); patchOpen(n => { n.images = [...(n.images || []), p]; }, '사진 추가'); }
    catch (x){ msg.textContent = '사진을 올리지 못했습니다.'; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  window.addEventListener('beforeunload', e => { if (!sheet.hidden && collect()){ e.preventDefault(); e.returnValue = ''; } });

  render();
  load();
})();
