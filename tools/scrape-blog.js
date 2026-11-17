// Pulls every post of the blog's 리니지2M category into data/posts.json and saves the
// post images under public/blog/ (the blog's image URLs are signed and expire, so they
// cannot be hot-linked). Re-run any time to pick up new posts: node tools/scrape-blog.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://tobebetter32.tistory.com';
const CATEGORY = '리니지2M';
const IMG_DIR = path.join(ROOT, 'public', 'blog');
const OUT = path.join(ROOT, 'data', 'posts.json');
const UA = { 'User-Agent': 'Mozilla/5.0' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, binary){
  for (let i = 0; i < 3; i++){
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(r.status);
      return binary ? { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' } : await r.text();
    } catch (e){ if (i === 2) throw e; await sleep(800); }
  }
}
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, prop) => { const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`)); return m ? decode(m[1]) : ''; };

// the post body is the balanced <div class="... contents_style"> element
function body(html){
  const start = html.indexOf('<div class="tt_article_useless_p_margin contents_style">');
  if (start < 0) return '';
  const re = /<\/?div\b[^>]*>/g; re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))){
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(html.indexOf('>', start) + 1, m.index);
  }
  return '';
}

async function listIds(){
  const ids = [];
  for (let page = 1; page < 50; page++){
    const c = await get(`${BASE}/category/${encodeURIComponent(CATEGORY)}?page=${page}`);
    // only links inside the article list, not sidebar "recent posts"
    const area = c.slice(c.indexOf('id="content"') > 0 ? c.indexOf('id="content"') : 0);
    const found = [...new Set([...area.matchAll(/href="\/(\d+)(?:\?category=\d+)?"/g)].map(m => +m[1]))].filter(id => !ids.includes(id));
    if (!found.length) break;
    ids.push(...found);
  }
  return ids;
}

async function saveImage(url, name){
  const { buf, type } = await get(url, true);
  const ext = /png/.test(type) ? 'png' : /gif/.test(type) ? 'gif' : /webp/.test(type) ? 'webp' : 'jpg';
  const file = `${name}.${ext}`;
  fs.writeFileSync(path.join(IMG_DIR, file), buf);
  return 'blog/' + file;
}

async function post(id){
  const html = await get(`${BASE}/${id}`);
  const cat = (html.match(/<a href="\/category\/[^"]*" class="category"[^>]*>([^<]*)/) || html.match(/class="category"[^>]*>([^<]*)/) || [])[1] || '';
  let content = body(html)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<ins class="adsbygoogle"[\s\S]*?<\/ins>/g, '')
    .replace(/<div[^>]*data-tistory-react-app[^>]*><\/div>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  // images → local copies
  const imgs = [...content.matchAll(/<img\b[^>]*>/g)];
  let n = 0;
  for (const m of imgs){
    const src = decode((m[0].match(/\bsrc="([^"]+)"/) || [])[1] || '');
    if (!/^https?:/.test(src)) continue;
    const w = (m[0].match(/data-origin-width="(\d+)"/) || m[0].match(/\bwidth="(\d+)"/) || [])[1];
    const h = (m[0].match(/data-origin-height="(\d+)"/) || m[0].match(/\bheight="(\d+)"/) || [])[1];
    const alt = (m[0].match(/\balt="([^"]*)"/) || [])[1] || '';
    try {
      const local = await saveImage(src, `${id}-${++n}`);
      content = content.replace(m[0], `<img src="{{ROOT}}${local}" alt="${alt}" loading="lazy"${w && h ? ` width="${w}" height="${h}"` : ''}>`);
    } catch (e){ console.log('  image failed', id, e.message); content = content.replace(m[0], ''); }
  }
  content = content.replace(/<span data-url="[^"]*"[^>]*>/g, '<span>').replace(/\sdata-(?:ke|origin|filename|phocus|lightbox|alt|url)[\w-]*="[^"]*"/g, '');
  let thumb = '';
  const first = content.match(/<img src="\{\{ROOT\}\}([^"]+)"/);
  if (first) thumb = first[1];
  return {
    id,
    title: meta(html, 'og:title').replace(/^[#\s]+/, '').trim(),
    date: meta(html, 'article:published_time').slice(0, 10),
    desc: meta(html, 'og:description').slice(0, 160),
    category: cat.trim(),
    thumb,
    tags: [...new Set([...html.matchAll(/<a href="\/tag\/[^"]*"[^>]*>([^<]+)<\/a>/g)].map(m => decode(m[1]).replace(/^#/, '').trim()))],
    html: content.trim(),
  };
}

(async () => {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // already-saved posts are kept as they are (pass --all to re-download everything)
  const old = !process.argv.includes('--all') && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const posts = old.filter(p => p.category === CATEGORY || /리니지\s*2m/i.test(p.title));
  const have = new Set(old.map(p => p.id));
  const ids = (await listIds()).filter(id => !have.has(id));
  // posts filed outside the category but about the game (found through the sitemap)
  const sm = await get(BASE + '/sitemap.xml');
  const extra = [...sm.matchAll(/<loc>[^<]*\/(\d+)<\/loc>/g)].map(m => +m[1]).filter(id => !have.has(id) && !ids.includes(id));
  console.log('new in category:', ids.length, '| other new posts to check:', extra.length);
  for (const id of [...ids, ...extra]){
    try {
      const p = await post(id);
      const keep = p.category === CATEGORY || /리니지\s*2m/i.test(p.title);
      if (keep) posts.push(p);
      console.log(keep ? 'kept   ' : 'skipped', id, p.date, p.category, '|', p.title);
    } catch (e){ console.log(id, 'FAILED', e.message); }
    await sleep(150);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  fs.writeFileSync(OUT, JSON.stringify(posts, null, 1));
  console.log('saved', posts.length, 'posts,', fs.readdirSync(IMG_DIR).length, 'images');
})();
