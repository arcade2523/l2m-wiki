// Builds the static site into dist/.  node tools/build.js
// Inputs: data/posts.json (scrape-blog.js), data/videos.json (fetch-videos.js),
//         data/alchemy.json (build-alchemy-data.js), data/start.json, data/boards.json,
//         src/site.css, src/site.js, src/alchemy.src.html, public/ (copied as-is).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
// cache-buster for site.css / site.js / notes.js so visitors get the new files right after a deploy
const BUILD = Date.now().toString(36);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SITE = {
  name: '오락실의 리니지2M 백과사전',
  short: '리니지2M 백과사전',
  desc: '리니지2M을 처음 시작하는 분부터 오래 한 분까지, 직접 실험하고 정리한 공략과 도구를 한곳에 모았습니다.',
  youtube: 'https://www.youtube.com/channel/UCDfaOyaSG0VrCfqWd6YVeUQ',
  blog: 'https://tobebetter32.tistory.com/',
  repo: 'arcade2523/l2m-wiki',        // GitHub repository the site (and the idea notes) live in
  branch: 'main',
};

// ---------- data ----------
const CATS = {
  start:  { name: '입문·성장', color: 'var(--c-start)' },
  hunt:   { name: '사냥터',   color: 'var(--c-hunt)' },
  test:   { name: '실험',     color: 'var(--c-test)' },
  class:  { name: '클래스',   color: 'var(--c-class)' },
  info:   { name: '정보',     color: 'var(--c-info)' },
  update: { name: '업데이트', color: 'var(--c-update)' },
};
function catOf(title){
  if (/\[사냥터/.test(title)) return 'hunt';
  if (/\[실험\s*\//.test(title)) return 'class';
  if (/\[실험/.test(title)) return 'test';
  if (/업데이트|소식/.test(title)) return 'update';
  if (/무과금|초보|입문|레벨업|전승|가이드/.test(title)) return 'start';
  return 'info';
}
// posts = articles brought over from the Tistory blog ("블로그 게시글")
const posts = json('data/posts.json').map(p => {
  const cat = catOf(p.title);
  const weapon = (p.title.match(/\[실험\s*\/\s*([^\]]+)\]/) || [])[1] || '';
  return { ...p, cat, weapon, url: `blog/${p.id}.html`, clean: p.title.replace(/^\s*\[[^\]]+\]\s*/, '').trim() || p.title };
});
const byId = new Map(posts.map(p => [p.id, p]));

// guides = articles written for this site in the admin screen (content/guides/*.md → "공략")
const md = require('./markdown');
const GUIDE_DIR = path.join(ROOT, 'content', 'guides');
const catByName = name => Object.keys(CATS).find(c => CATS[c].name === String(name).trim()) || 'info';
const local = src => /^(https?:)?\/\//.test(src) ? src : '{{ROOT}}' + src.replace(/^\/+/, '');   // "/uploads/a.png" → site-relative
const guides = (fs.existsSync(GUIDE_DIR) ? fs.readdirSync(GUIDE_DIR) : []).filter(f => f.endsWith('.md')).map(f => {
  const { data, body } = md.frontMatter(fs.readFileSync(path.join(GUIDE_DIR, f), 'utf8'));
  if (String(data.draft) === 'true') return null;
  const slug = f.replace(/\.md$/, '');
  const html = md.render(body).replace(/(<img src=")([^"]+)"/g, (_, a, src) => `${a}${local(src)}"`);
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const cover = data.cover ? local(data.cover) : (html.match(/<img src="([^"]+)"/) || [])[1] || '';
  return { slug, id: slug, title: data.title || slug, clean: data.title || slug, date: String(data.date || '').slice(0, 10),
    desc: data.summary || plain.slice(0, 150), cat: catByName(data.category), weapon: '', tags: [],
    thumb: cover.replace('{{ROOT}}', ''), external: /^(https?:)?\/\//.test(cover), url: `guides/${slug}.html`, html, own: true };
}).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
const { videos, channel } = json('data/videos.json');
const start = json('data/start.json');
const boards = json('data/boards.json');
const alchemyData = read('data/alchemy.json');

// ---------- icons (own drawings) ----------
const I = {
  logo: '<path fill="currentColor" d="M12 2a3 3 0 0 1 1.2 5.75V11h4.3A3.5 3.5 0 0 1 21 14.5V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3.5A3.5 3.5 0 0 1 6.5 11h4.3V7.75A3 3 0 0 1 12 2Zm-5 13.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm9.2-.7h-3v1.6h3v-1.6Zm0 2.6h-3v1.4h3v-1.4Z"/>',
  home: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  start: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
  guides: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
  alchemy: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>',
  archive: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/>',
  videos: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M10 9l5 3-5 3z"/>',
  trade: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 8h13l-3-3M20 16H7l3 3"/>',
  clan: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  search: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20 20l-4.5-4.5"/>',
  yt: '<path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.200 0-7.800.4A2.500 2.500 0 0 0 2.400 7.200 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.800 2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.800ZM10 15V9l5.200 3Z"/>',
  blog: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  play: '<path fill="currentColor" d="M6 4l14 8-14 8z"/>',
  notes: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.600.500 1 1.200 1 2.100h5c0-.900.400-1.600 1-2.100A6 6 0 0 0 12 3z"/>',
  camera: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500" fill="none" stroke="currentColor" stroke-width="2"/>',
  moon: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M20 14.5A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500Z"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5"/>',
};
const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${I[k]}</svg>`;

const NAV = [
  { id: 'home', label: '홈', href: 'index.html' },
  { id: 'start', label: '처음 시작', href: 'start/index.html' },
  { id: 'guides', label: '공략', href: 'guides/index.html' },
  { id: 'archive', label: '블로그 게시글', href: 'blog/index.html' },
  { id: 'alchemy', label: '연금술', href: 'alchemy/index.html' },
  { id: 'videos', label: '영상', href: 'videos/index.html' },
  { id: 'trade', label: '거래소', href: 'trade/index.html' },
  { id: 'clan', label: '혈맹 모집', href: 'clan/index.html' },
  { id: 'notes', label: '아이디어 노트', href: 'notes/index.html' },
];

// ---------- layout ----------
function page({ file, nav, title, desc, body, head = '', scripts = '' }){
  const depth = file.split('/').length - 1;
  const R = depth ? '../'.repeat(depth) : './';
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title ? `${title} | ${SITE.name}` : SITE.name)}</title>
<meta name="description" content="${esc(desc || SITE.desc)}">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${R}assets/site.css?v=${BUILD}">
<script>try{if(localStorage.getItem('l2mwiki-theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}</script>
${head}</head>
<body>
<nav class="mx-rail" aria-label="바로가기">
  <a class="mx-logo" href="${R}index.html" aria-label="${esc(SITE.name)} 홈">${svg('logo')}</a>
  ${NAV.map(n => `<a href="${R}${n.href}"${n.id === nav ? ' aria-current="page"' : ''} aria-label="${n.label}">${svg(n.id)}<span class="mx-tip">${n.label}</span></a>`).join('\n  ')}
</nav>
<div class="mx-shell">
  <header class="mx-top">
    <div class="mx-top-in">
      <a class="mx-brand" href="${R}index.html"><b>오락실</b>의 ${SITE.short}</a>
      <form class="mx-search" action="${R}search/index.html" method="get" role="search">
        ${svg('search')}<input type="search" name="q" id="siteSearch" placeholder="글 검색 (예: 명중, 오브, 상아탑)" aria-label="공략과 블로그 게시글 검색" autocomplete="off">
      </form>
      <button class="mx-pill" id="mxTheme" type="button" aria-label="밝은 화면과 어두운 화면 전환">
        <span class="to-dark">${svg('moon')}<em>어두운 화면</em></span><span class="to-light">${svg('sun')}<em>밝은 화면</em></span>
      </button>
      <div class="mx-top-links" style="margin-left:0">
        <a class="mx-pill" href="${SITE.youtube}" target="_blank" rel="noopener">${svg('yt')}<span>유튜브</span></a>
        <a class="mx-pill" href="${SITE.blog}" target="_blank" rel="noopener">${svg('blog')}<span>블로그</span></a>
      </div>
    </div>
    <nav class="mx-tabs" aria-label="메뉴">
      ${NAV.map(n => `<a href="${R}${n.href}"${n.id === nav ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
    </nav>
  </header>
  <main class="mx-main">
${body.replace(/\{\{ROOT\}\}/g, R)}
  </main>
  <footer class="mx-foot">
    ${esc(SITE.name)} · 팬이 만든 비공식 사이트이며 엔씨소프트와 관련이 없습니다. 리니지2M과 관련 명칭의 권리는 엔씨소프트에 있습니다.<br>
    <a href="${SITE.youtube}" target="_blank" rel="noopener">유튜브 오락실</a> · <a href="${SITE.blog}" target="_blank" rel="noopener">티스토리 블로그</a> · <a href="${R}admin/index.html">관리자</a>
  </footer>
</div>
<script src="${R}assets/site.js?v=${BUILD}"></script>
${scripts.replace(/\{\{ROOT\}\}/g, R)}</body>
</html>`;
  const out = path.join(DIST, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

// ---------- components ----------
const cc = c => `--cc:${CATS[c].color}`;
const imgSrc = p => (p.external ? '' : '{{ROOT}}') + p.thumb;
const thumb = (p, cls) => p.thumb
  ? `<img class="${cls}" src="${imgSrc(p)}" alt="" loading="lazy">`
  : `<span class="${cls} ph">${esc(CATS[p.cat].name[0])}</span>`;
const text = p => esc((p.title + ' ' + p.desc + ' ' + p.tags.join(' ') + ' ' + CATS[p.cat].name).toLowerCase());
const topic = p => `<a class="mx-topic" style="${cc(p.cat)}" href="{{ROOT}}${p.url}" data-cat="${p.cat}" data-text="${text(p)}">
  ${thumb(p, 'mx-thumb')}<span><b>${esc(p.clean)}</b><time>${p.date}</time></span></a>`;
const card = p => `<a class="mx-card" style="${cc(p.cat)}" href="{{ROOT}}${p.url}" data-cat="${p.cat}" data-text="${text(p)}">
  <span class="mx-cover">${p.thumb ? `<img src="${imgSrc(p)}" alt="" loading="lazy">` : `<span class="ph">${esc(CATS[p.cat].name[0])}</span>`}
    <span class="mx-tag"><i></i>${CATS[p.cat].name}${p.weapon ? ' · ' + esc(p.weapon) : ''}${p.own ? '' : ' · 블로그'}</span></span>
  <span class="mx-body"><h3>${esc(p.clean)}</h3><p>${esc(p.desc)}</p><span class="mx-meta">${p.date}</span></span></a>`;
const vcard = v => `<a class="mx-card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
  <span class="mx-cover"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><span class="mx-play"><span>${svg('play')}</span></span></span>
  <span class="mx-body"><h3>${esc(v.title)}</h3><span class="mx-meta">${v.date}</span></span></a>`;
const chips = (target, extra = '', list = posts) => {
  const count = c => list.filter(p => p.cat === c).length;
  return `<div class="mx-chips" data-filter="${target}"${extra}>
    <button class="mx-chip" data-cat="all" aria-pressed="true"><i style="background:var(--accent)"></i>전체 <span class="n">${list.length}</span></button>
    ${Object.entries(CATS).filter(([c]) => count(c)).map(([c, v]) => `<button class="mx-chip" data-cat="${c}" aria-pressed="false" style="--cc:${v.color}"><i></i>${v.name} <span class="n">${count(c)}</span></button>`).join('\n    ')}
  </div>`;
};
const head = (h, sub, more) => `<div class="mx-h"><h2>${h}</h2>${sub ? `<p>${sub}</p>` : ''}${more ? `<a class="mx-more" href="{{ROOT}}${more[1]}">${more[0]} →</a>` : ''}</div>`;

// ---------- pages ----------
function home(){
  const tradeRows = boards.trade.slice(0, 3).map(p => `<div><span class="mx-badge ${p.type === '팝니다' ? 'sell' : 'buy'}">${p.type}</span><span class="t">${esc(p.title)}</span><span class="mx-badge ex">예시</span></div>`).join('');
  const clanRows = boards.clan.slice(0, 3).map(p => `<div><span class="mx-badge ${p.type === '혈맹원 모집' ? 'sell' : 'buy'}">${p.type}</span><span class="t">${esc(p.title)}</span><span class="mx-badge ex">예시</span></div>`).join('');
  page({ file: 'index.html', nav: 'home', body: `
<section class="mx-hero">
  <div>
    <h1><b>오락실</b>의 리니지2M 백과사전</h1>
    <p>${SITE.desc}</p>
    <div class="mx-hero-cta">
      <a class="mx-btn primary" href="{{ROOT}}start/index.html">${svg('start')}처음이라면 여기부터</a>
      <a class="mx-btn" href="{{ROOT}}alchemy/index.html">${svg('alchemy')}연금술 확률표</a>
      <a class="mx-btn" href="${SITE.youtube}" target="_blank" rel="noopener">${svg('yt')}유튜브 채널</a>
    </div>
  </div>
  <div class="mx-stats">
    <div class="mx-stat"><b>${guides.length + posts.length}</b><span>공략·실험 글</span></div>
    <div class="mx-stat"><b>${Object.values(json('data/alchemy.json').kinds).reduce((a, k) => a + k.length, 0)}</b><span>연금 단계 확률표</span></div>
    <div class="mx-stat"><b>${videos[0].date.slice(5).replace('-', '/')}</b><span>최근 영상 올린 날</span></div>
    <div class="mx-stat"><b>${Object.keys(CATS).length}</b><span>공략 주제</span></div>
  </div>
</section>

<section class="mx-sec">
  ${head('새로 올라온 글', '사이트에 직접 쓴 공략이 먼저 나옵니다.', ['공략 전체 보기', 'guides/index.html'])}
  <div class="mx-cards four">${[...guides, ...posts].slice(0, 4).map(card).join('\n')}</div>
</section>

<section class="mx-sec">
  ${head('블로그 게시글', '티스토리 블로그에 올렸던 글입니다. 주제를 눌러 골라 보세요.', ['블로그 게시글 전체 보기', 'blog/index.html'])}
  ${chips('#homeTopics', ' data-limit="20"')}
  <div class="mx-topics" id="homeTopics">${posts.map(topic).join('\n')}</div>
</section>

<section class="mx-sec">
  ${head('최신 영상', `유튜브 ${esc(channel)} 채널의 새 영상이 자동으로 올라옵니다.`, ['영상 전체 보기', 'videos/index.html'])}
  <div class="mx-cards four">${videos.slice(0, 4).map(vcard).join('\n')}</div>
</section>

<section class="mx-sec">
  ${head('도구와 커뮤니티')}
  <div class="mx-feature">
    <h3>연금술 확률표</h3>
    <p>일반·상급 연금의 단계별, 슬롯별 결과 확률을 등급순으로 보고, 원하는 아이템이 어느 레시피에서 가장 잘 나오는지 찾아볼 수 있습니다.</p>
    <a class="mx-btn primary" href="{{ROOT}}alchemy/index.html">${svg('alchemy')}확률표 열기</a>
  </div>
  <div class="mx-two">
    <div class="mx-feature"><h3>거래소</h3><p>장비를 사고파는 글을 서버별로 모아 봅니다.</p><div class="mx-mini">${tradeRows}</div><a class="mx-btn" href="{{ROOT}}trade/index.html">${svg('trade')}거래 글 보기</a></div>
    <div class="mx-feature"><h3>혈맹 모집</h3><p>혈맹원을 모집하거나 들어갈 혈맹을 찾습니다.</p><div class="mx-mini">${clanRows}</div><a class="mx-btn" href="{{ROOT}}clan/index.html">${svg('clan')}모집 글 보기</a></div>
  </div>
</section>` });
}

function startPage(){
  const steps = start.steps.map(s => {
    const links = [
      ...(s.posts || []).map(id => byId.get(id)).filter(Boolean).map(p => `<li><a href="{{ROOT}}${p.url}">${esc(p.clean)}</a></li>`),
      ...(s.links || []).map(l => `<li><a href="{{ROOT}}${l.href}">${esc(l.label)}</a></li>`),
    ];
    return `<div class="mx-step"><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><ul>${links.join('')}</ul></div></div>`;
  }).join('\n');
  page({ file: 'start/index.html', nav: 'start', title: '처음 시작', desc: '리니지2M에 처음 입문했을 때 무엇부터 하면 좋은지 순서대로 정리했습니다.', body: `
<div class="mx-pagehead">
  <h1>리니지2M, 처음이라면 이 순서로</h1>
  <p>입문해서 무엇부터 해야 할지 모를 때 따라가는 순서입니다. 각 단계에서 직접 실험하고 정리한 글로 이어집니다.</p>
</div>
<div class="mx-steps">${steps}</div>` });
}

// A filterable list page (chips + search box + cards), used for 공략, 블로그 게시글 and 검색.
function listPage({ file, nav, title, lead, list, emptyAll, withChips = true }){
  page({ file, nav, title, desc: lead, body: `
<div class="mx-pagehead"><h1>${title}</h1><p>${lead}</p></div>
<div class="mx-sec">
  <div class="mx-toolbar">
    <label class="mx-search" style="max-width:360px">${svg('search')}<input type="search" id="listSearch" placeholder="제목이나 내용으로 찾기" aria-label="${title} 안에서 찾기" autocomplete="off"></label>
  </div>
  ${withChips ? chips('#cardList', ' data-search="#listSearch" data-empty="#listEmpty"', list) : '<div data-filter="#cardList" data-search="#listSearch" data-empty="#listEmpty"></div>'}
  ${list.length ? `<div class="mx-cards" id="cardList">${list.map(card).join('\n')}</div>` : `<div id="cardList"></div><div class="mx-empty">${emptyAll}</div>`}
  <div class="mx-empty" id="listEmpty" hidden>조건에 맞는 글이 없습니다. 검색어를 줄이거나 다른 주제를 눌러 보세요.</div>
</div>` });
}

// One article page. `list` is the collection it belongs to (for previous / next and related links).
function articlePages(list, { nav, crumb, indexHref, indexLabel, source }){
  list.forEach((p, i) => {
    const newer = list[i - 1], older = list[i + 1];
    const related = list.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 8);
    page({ file: p.url, nav, title: p.clean, desc: p.desc, body: `
<div class="mx-article-wrap">
  <div>
    <article class="mx-article">
      <header>
        <div class="mx-crumb"><a href="{{ROOT}}${indexHref}">${crumb}</a> / ${CATS[p.cat].name}</div>
        <h1>${esc(p.clean)}</h1>
        <div class="mx-meta">
          <span class="mx-cat" style="${cc(p.cat)}"><i></i>${CATS[p.cat].name}${p.weapon ? ' · ' + esc(p.weapon) : ''}</span>
          <time class="num">${p.date}</time>
          ${source ? source(p) : ''}
        </div>
      </header>
      <div class="mx-prose">${p.html}</div>
    </article>
    <nav class="mx-pn" aria-label="이전 글과 다음 글">
      ${older ? `<a href="{{ROOT}}${older.url}"><span>← 이전 글</span>${esc(older.clean)}</a>` : '<span></span>'}
      ${newer ? `<a href="{{ROOT}}${newer.url}"><span>다음 글 →</span>${esc(newer.clean)}</a>` : '<span></span>'}
    </nav>
  </div>
  <aside class="mx-side">
    ${related.length ? `<h4>같은 주제의 글</h4>
    <div>${related.map(r => `<a href="{{ROOT}}${r.url}">${esc(r.clean)}<time>${r.date}</time></a>`).join('')}</div>` : ''}
    <a class="mx-btn" href="{{ROOT}}${indexHref}" style="justify-content:center">${indexLabel}</a>
  </aside>
</div>` });
  });
}

function guidesSection(){
  listPage({ file: 'guides/index.html', nav: 'guides', title: '공략', list: guides,
    lead: '이 사이트에 직접 쓰는 공략입니다. 예전에 블로그에 올린 글은 블로그 게시글 탭에 있습니다.',
    emptyAll: '아직 올라온 공략이 없습니다. 예전 글은 <a href="{{ROOT}}blog/index.html" style="text-decoration:underline">블로그 게시글</a>에서 볼 수 있습니다.' });
  articlePages(guides, { nav: 'guides', crumb: '공략', indexHref: 'guides/index.html', indexLabel: '공략 전체 보기' });
}

function blogSection(){
  listPage({ file: 'blog/index.html', nav: 'archive', title: '블로그 게시글', list: posts,
    lead: `티스토리 블로그에 올렸던 사냥터 정보, 스킬과 스탯 실험, 클래스 분석 글 ${posts.length}편을 주제별로 골라 볼 수 있습니다.` });
  articlePages(posts, { nav: 'archive', crumb: '블로그 게시글', indexHref: 'blog/index.html', indexLabel: '블로그 게시글 전체 보기',
    source: p => `<a href="${SITE.blog}${p.id}" target="_blank" rel="noopener">블로그 원문</a>` });
}

function searchPage(){
  listPage({ file: 'search/index.html', nav: '', title: '글 검색', list: [...guides, ...posts], withChips: false,
    lead: '공략과 블로그 게시글을 한꺼번에 찾습니다.' });
}

function videosPage(){
  const first = videos[0];
  const uploads = 'UU' + json('data/videos.json').channelId.slice(2);
  page({ file: 'videos/index.html', nav: 'videos', title: '영상', desc: `유튜브 ${channel} 채널의 최신 리니지2M 영상.`, body: `
<div class="mx-pagehead">
  <h1>영상</h1>
  <p>유튜브 ${esc(channel)} 채널에 새 영상이 올라오면 이 목록에 자동으로 나타납니다.</p>
</div>
<div class="mx-video-top">
  <div class="mx-sec" style="gap:10px">
    <iframe class="mx-player" id="mxPlayer" src="https://www.youtube-nocookie.com/embed/${first.id}?rel=0" title="영상 재생기" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    <b id="mxPlayerTitle" style="font-size:18px">${esc(first.title)}</b>
    <div><a class="mx-btn primary" href="${SITE.youtube}?sub_confirmation=1" target="_blank" rel="noopener">${svg('yt')}채널 구독하기</a></div>
  </div>
  <div class="mx-vlist">
    ${videos.map((v, i) => `<button class="mx-vrow" data-id="${v.id}" data-title="${esc(v.title)}" aria-current="${i === 0}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><span><b>${esc(v.title)}</b><time>${v.date}</time></span></button>`).join('\n    ')}
  </div>
</div>
<section class="mx-sec">
  ${head('채널 전체 재생목록', '유튜브가 직접 보내 주는 목록이라 사이트를 다시 만들지 않아도 항상 최신입니다.')}
  <iframe class="mx-player" src="https://www.youtube-nocookie.com/embed/videoseries?list=${uploads}" title="채널 전체 재생목록" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</section>` });
}

function boardPage(kind){
  const T = kind === 'trade'
    ? { nav: 'trade', title: '거래소', lead: '장비와 아이템을 사고파는 글을 서버별로 모아 봅니다.', types: ['팝니다', '삽니다'], write: '거래 글 쓰기',
        fields: `<label>구분<select name="type"><option>팝니다</option><option>삽니다</option></select></label>
      <label>서버<input name="server" placeholder="예: 바츠" maxlength="20"></label>
      <label class="wide">제목<input name="title" placeholder="예: +8 시르 블레이드" maxlength="60"></label>
      <label>가격<input name="price" placeholder="예: 다이아 12,000 / 협의" maxlength="30"></label>
      <label>연락 방법<input name="contact" placeholder="예: 인게임 귓말 닉네임" maxlength="40"></label>
      <label class="wide">설명 (선택)<textarea name="body" maxlength="200"></textarea></label>` }
    : { nav: 'clan', title: '혈맹 모집', lead: '혈맹원을 모집하거나, 들어갈 혈맹을 찾는 글을 올리는 곳입니다.', types: ['혈맹원 모집', '혈맹 구함'], write: '모집 글 쓰기',
        fields: `<label>구분<select name="type"><option>혈맹원 모집</option><option>혈맹 구함</option></select></label>
      <label>서버<input name="server" placeholder="예: 바츠" maxlength="20"></label>
      <label class="wide">제목<input name="title" placeholder="예: 저녁 시간대 보스 레이드 함께할 분" maxlength="60"></label>
      <label>성향<input name="style" placeholder="예: PVE 중심 / 쟁 / 친목" maxlength="30"></label>
      <label>활동 시간<input name="time" placeholder="예: 평일 21시~24시" maxlength="30"></label>
      <label class="wide">연락 방법<input name="contact" placeholder="예: 인게임 귓말 닉네임, 디스코드" maxlength="40"></label>
      <label class="wide">소개 (선택)<textarea name="body" maxlength="200"></textarea></label>` };
  page({ file: `${kind}/index.html`, nav: T.nav, title: T.title, desc: T.lead, body: `
<div class="mx-pagehead"><h1>${T.title}</h1><p>${T.lead}</p></div>
<div class="mx-notice"><b>미리보기 단계</b><span>아직 서버에 연결되지 않았습니다. 지금 쓰는 글은 이 브라우저에만 저장되어 다른 사람에게 보이지 않습니다. '예시' 표시가 붙은 글은 화면을 보여 주기 위한 견본입니다.</span></div>
<div class="mx-sec">
  <div class="mx-toolbar">
    <select class="mx-input" id="fServer" aria-label="서버"></select>
    <select class="mx-input" id="fType" aria-label="구분"><option value="">전체 구분</option>${T.types.map(t => `<option>${t}</option>`).join('')}</select>
    <label class="mx-search" style="max-width:300px">${svg('search')}<input type="search" id="fText" placeholder="제목으로 찾기" aria-label="제목으로 찾기" autocomplete="off"></label>
    <label class="mx-check"><input type="checkbox" id="fHideDone">완료된 글 숨기기</label>
    <span class="num" id="mxCount" style="color:var(--muted)"></span>
    <button class="mx-btn primary" id="mxWrite" style="margin-left:auto">${T.write}</button>
  </div>
  <form class="mx-form" id="mxForm" hidden>
      ${T.fields}
      <div class="acts"><span class="err" id="mxFormErr" role="alert"></span><button type="button" class="mx-btn" id="mxCancel">취소</button><button class="mx-btn primary">올리기</button></div>
  </form>
  <div class="mx-board" id="mxBoard" data-board="${kind}"></div>
</div>
<script type="application/json" id="mxBoardSeed">${JSON.stringify(boards[kind]).replace(/</g, '\\u003c')}</script>` });
}

// The alchemy tool is kept as one self-contained source file (src/alchemy.src.html);
// here its own page chrome is swapped for the site's.
function alchemyPage(){
  const src = read('src/alchemy.src.html');
  const must = (cond, what) => { if (!cond) throw new Error('alchemy.src.html: ' + what); };
  let css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
  must(css.includes('.num{') && css.includes('/* top bar */') && css.includes('.seg{'), 'style markers missing');
  css = css.slice(css.indexOf('.num{'));                                    // drop tokens + body rules (site.css owns them)
  css = css.slice(0, css.indexOf('/* top bar */')) + css.slice(css.indexOf('.seg{'));
  css = css.replace(/\nmain\{[^}]*\}/, '');
  let markup = src.slice(src.indexOf('<svg width="0"'), src.indexOf('<script>'));
  must(/<header class="top">[\s\S]*?<\/header>/.test(markup), 'header missing');
  markup = markup
    .replace(/<header class="top">[\s\S]*?<\/header>/, `
<div class="mx-pagehead"><h1>연금술 확률표</h1><p>단계와 슬롯을 고르면 나올 수 있는 아이템을 등급이 높은 순서로 보여 줍니다. '아이템으로 찾기'에서는 원하는 아이템이 가장 잘 나오는 레시피를 찾습니다.</p></div>
<div class="alc-bar">
  <span id="brandSub">리니지2M · 일반 연금</span>
  <div class="seg" role="group" aria-label="연금 종류" id="kindSeg">
    <button data-k="normal" aria-pressed="true">일반 연금</button>
    <button data-k="advanced" aria-pressed="false">상급 연금</button>
  </div>
  <div class="seg" role="group" aria-label="보기 방식">
    <button id="view-recipe" aria-pressed="true">레시피별 보기</button>
    <button id="view-overview" aria-pressed="false">한눈에 보기</button>
    <button id="view-find" aria-pressed="false">아이템으로 찾기</button>
  </div>
</div>`)
    .replace('<main class="gutter">', '<div class="alc mx-sec">').replace('</main>', '</div>');
  const script = src.slice(src.indexOf('<script>')).replace('/*__DATA__*/null', alchemyData);
  must(script.includes('"kinds"'), 'data placeholder missing');
  page({ file: 'alchemy/index.html', nav: 'alchemy', title: '연금술 확률표', desc: '리니지2M 일반·상급 연금의 단계별 슬롯 확률과 아이템 역검색.',
    head: `<style>${css}</style>\n`, body: markup, scripts: script + '\n' });
}

// Idea board. Notes live in the repository (notes/notes.json) and are read and written from the
// browser through the GitHub API, so this page needs no rebuild when a note changes.
function notesPage(){
  const types = [['guide', '팁·공략'], ['video', '영상'], ['bug', '버그·수정요청'], ['suggest', '제안']];
  page({ file: 'notes/index.html', nav: 'notes', title: '아이디어 노트', desc: '게임하다 떠오른 공략·영상·버그 메모를 모아 두는 보드.', body: `
<div class="mx-pagehead">
  <h1>아이디어 노트</h1>
  <p>게임하다 떠오른 걸 한 줄로 붙여 두고, 나중에 살을 붙여 공략이나 영상으로 만듭니다. 카드를 끌어서 다음 칸으로 옮기고, 눌러서 자세히 씁니다.</p>
</div>
<div class="nt-auth" id="ntAuth">
  <p><b>보기 전용입니다.</b> 이 기기에서 메모를 쓰려면 관리자 글쓰기에 쓰는 GitHub 토큰을 한 번 입력하세요. 토큰은 이 브라우저에만 저장됩니다.</p>
  <form id="ntConnect">
    <input class="mx-input" type="password" id="ntToken" placeholder="github_pat_로 시작하는 토큰" autocomplete="off" aria-label="GitHub 토큰">
    <button class="mx-btn primary">연결</button>
    <span class="err" id="ntAuthErr" role="alert"></span>
  </form>
</div>
<form class="nt-quick" id="ntQuick" hidden>
  <input type="text" id="ntText" placeholder="떠오른 걸 한 줄로 (예: 상아탑 3층 자폭 피하는 자리 #상아탑)" autocomplete="off" aria-label="한 줄 메모">
  <div class="nt-types" id="ntTypes" role="group" aria-label="분류">
    ${types.map(([k, v], i) => `<button type="button" data-type="${k}" aria-pressed="${i === 0}" style="--tc:var(--nt-${k})">${v}</button>`).join('')}
  </div>
  <label class="nt-photo">${svg('camera')}사진<input type="file" id="ntFile" accept="image/*" hidden></label>
  <span class="nt-filename" id="ntFileName"></span>
  <button class="mx-btn primary">붙이기</button>
  <p class="nt-status" id="ntStatus" role="status"></p>
</form>
<div class="nt-bar">
  <div class="mx-chips" id="ntFilter" aria-label="분류와 태그로 거르기"></div>
  <label class="mx-search" style="max-width:260px">${svg('search')}<input type="search" id="ntSearch" placeholder="메모 찾기" aria-label="메모 찾기" autocomplete="off"></label>
  <span class="nt-signed" id="ntSignedIn" hidden>편집 가능 <button type="button" id="ntSignOut">이 기기 연결 끊기</button></span>
</div>
<div class="nt-tabs" id="ntTabs" role="group" aria-label="단계"></div>
<div class="nt-board" id="ntBoard"></div>
<div class="nt-sheet" id="ntSheet" hidden><div class="nt-sheet-in" id="ntSheetBody" role="dialog" aria-label="메모 자세히"></div></div>`,
    head: '<meta name="robots" content="noindex">\n',
    scripts: `<script>window.NT_CONFIG = ${JSON.stringify({ repo: SITE.repo, branch: SITE.branch, file: 'notes/notes.json', imgDir: 'notes/images', cats: Object.values(CATS).map(c => c.name) })};</script>
<script src="{{ROOT}}assets/notes.js?v=${BUILD}"></script>
` });
}

// ---------- run ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'site.css'), path.join(DIST, 'assets', 'site.css'));
fs.copyFileSync(path.join(ROOT, 'src', 'site.js'), path.join(DIST, 'assets', 'site.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'notes.js'), path.join(DIST, 'assets', 'notes.js'));
home(); startPage(); guidesSection(); blogSection(); searchPage(); videosPage(); boardPage('trade'); boardPage('clan'); alchemyPage(); notesPage();
console.log(`built ${guides.length} guides, ${posts.length} blog posts, ${videos.length} videos → dist/`);
