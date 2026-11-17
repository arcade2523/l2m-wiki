// Shared behaviour: topic filters, guide search, video player, trade/clan boards.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e){ return false; } },
  };

  // ----- light / dark toggle (light is the default; the choice is remembered per browser) -----
  const themeBtn = $('#mxTheme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('l2mwiki-theme', dark ? 'dark' : 'light'); } catch (e){}
  });

  // ----- filter chips + text search over a card list -----
  $$('[data-filter]').forEach(box => {
    const list = $(box.dataset.filter);
    if (!list) return;
    const items = $$('[data-cat]', list);
    const input = box.dataset.search ? $(box.dataset.search) : null;
    const empty = box.dataset.empty ? $(box.dataset.empty) : null;
    const limit = +box.dataset.limit || Infinity;
    let cat = 'all';
    const apply = () => {
      const q = input ? input.value.trim().toLowerCase() : '';
      let shown = 0;
      for (const it of items){
        const ok = (cat === 'all' || it.dataset.cat === cat) && (!q || it.dataset.text.includes(q));
        it.hidden = !(ok && shown < limit);
        if (ok) shown++;
      }
      if (empty) empty.hidden = shown > 0;
    };
    box.addEventListener('click', e => {
      const b = e.target.closest('.mx-chip'); if (!b) return;
      cat = b.dataset.cat;
      $$('.mx-chip', box).forEach(x => x.setAttribute('aria-pressed', x === b));
      apply();
    });
    if (input){
      const q = new URLSearchParams(location.search).get('q');
      if (q) input.value = q;
      input.addEventListener('input', apply);
    }
    apply();
  });

  // ----- video page: click a row to play it -----
  const player = $('#mxPlayer');
  if (player){
    $$('.mx-vrow').forEach(row => row.addEventListener('click', () => {
      player.src = `https://www.youtube-nocookie.com/embed/${row.dataset.id}?autoplay=1&rel=0`;
      $$('.mx-vrow').forEach(r => r.setAttribute('aria-current', r === row));
      $('#mxPlayerTitle').textContent = row.dataset.title;
      player.scrollIntoView({ block: 'nearest' });
    }));
  }

  // ----- boards: example rows from the page + rows saved in this browser -----
  const board = $('#mxBoard');
  if (board){
    const kind = board.dataset.board;                       // "trade" | "clan"
    const KEY = 'l2mwiki-board-' + kind;
    const seed = JSON.parse($('#mxBoardSeed').textContent);
    const form = $('#mxForm'), err = $('#mxFormErr');
    const fServer = $('#fServer'), fType = $('#fType'), fText = $('#fText');
    const mine = () => store.get(KEY) || [];
    const today = () => new Date().toISOString().slice(0, 10);

    // only the author (for now: the browser that wrote the post) gets the done / delete controls
    const DONE = kind === 'trade' ? '거래 완료' : '모집 완료';
    const owner = p => p.example ? '<span class="mx-badge ex">예시</span>'
      : `<button class="act" data-done="${p.id}">${p.done ? '완료 취소' : DONE + '로 표시'}</button><button class="del" data-del="${p.id}">내 글 삭제</button>`;
    const badge = (p, sellType) => p.done ? `<span class="mx-badge done">${DONE}</span>`
      : `<span class="mx-badge ${p.type === sellType ? 'sell' : 'buy'}">${esc(p.type)}</span>`;
    const row = p => kind === 'trade' ? `
      <div class="mx-post${p.done ? ' done' : ''}">
        ${badge(p, '팝니다')}
        <span class="tt">${esc(p.title)}</span>
        <span class="rt"><span class="price">${esc(p.price || '가격 협의')}</span><br><span class="num" style="color:var(--muted)">${esc(p.date)}</span></span>
        <span class="sub"><span>${esc(p.server)} 서버</span>${p.contact ? `<span>연락: ${esc(p.contact)}</span>` : ''}${p.body ? `<span>${esc(p.body)}</span>` : ''}
          <span class="own">${owner(p)}</span></span>
      </div>` : `
      <div class="mx-post${p.done ? ' done' : ''}">
        ${badge(p, '혈맹원 모집')}
        <span class="tt">${esc(p.title)}</span>
        <span class="rt"><span class="num" style="color:var(--muted)">${esc(p.date)}</span></span>
        <span class="sub"><span>${esc(p.server)} 서버</span>${p.style ? `<span>성향: ${esc(p.style)}</span>` : ''}${p.time ? `<span>활동: ${esc(p.time)}</span>` : ''}${p.contact ? `<span>연락: ${esc(p.contact)}</span>` : ''}${p.body ? `<span>${esc(p.body)}</span>` : ''}
          <span class="own">${owner(p)}</span></span>
      </div>`;

    const render = () => {
      const all = [...mine(), ...seed];
      const servers = [...new Set(all.map(p => p.server))].sort();
      const cur = fServer.value;
      fServer.innerHTML = '<option value="">모든 서버</option>' + servers.map(s => `<option${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const q = fText.value.trim().toLowerCase();
      const hideDone = $('#fHideDone').checked;
      const rows = all.filter(p => (!fServer.value || p.server === fServer.value) && (!fType.value || p.type === fType.value)
        && (!hideDone || !p.done) && (!q || (p.title + ' ' + (p.body || '')).toLowerCase().includes(q)));
      board.innerHTML = rows.length ? rows.map(row).join('') : '<div class="mx-empty" style="border:0">조건에 맞는 글이 없습니다. 조건을 바꾸거나 첫 글을 올려 보세요.</div>';
      $('#mxCount').textContent = rows.length + '건';
    };
    [fServer, fType, $('#fHideDone')].forEach(el => el.addEventListener('change', render));
    fText.addEventListener('input', render);
    $('#mxWrite').addEventListener('click', () => { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('input,select').focus(); });
    $('#mxCancel').addEventListener('click', () => { form.hidden = true; err.textContent = ''; });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      for (const k in d) d[k] = d[k].trim();
      if (!d.title || !d.server || !d.contact){ err.textContent = '제목, 서버, 연락 방법은 꼭 적어 주세요.'; return; }
      const saved = store.set(KEY, [{ ...d, id: Date.now(), date: today() }, ...mine()]);
      if (!saved){ err.textContent = '이 브라우저에서는 저장할 수 없습니다. 개인정보 보호 모드를 끄고 다시 시도해 주세요.'; return; }
      form.reset(); form.hidden = true; err.textContent = ''; render();
    });
    board.addEventListener('click', e => {
      const d = e.target.closest('[data-done]');
      if (d){ store.set(KEY, mine().map(p => String(p.id) === d.dataset.done ? { ...p, done: !p.done } : p)); render(); return; }
      const b = e.target.closest('[data-del]'); if (!b) return;
      store.set(KEY, mine().filter(p => String(p.id) !== b.dataset.del)); render();
    });
    render();
  }
})();
