// Compacts the raw purple2m alchemy files (data/alchemy-raw) into data/alchemy.json.
// raw files: n{N}.json (normal, field "normal"), a{N}.json (advanced, field "top"),
// _meta_{kind}.json (slot markers + materials scraped from the recipe list pages).
// Normal steps 2-7 are missing from the site's current files (alchemist/normal/); they come from the
// author's January 2023 copy (alchemist/normal2/). Steps present in both copies have identical
// probabilities, so the older copy is used as-is and marked with src: "2023-01".
const fs = require('fs'), path = require('path');
const RAW = path.join(__dirname, '..', 'data', 'alchemy-raw');
const OUT = path.join(__dirname, '..', 'data', 'alchemy.json');

const items = [], idx = new Map();
function cat(icon){
  if (/^WP_/i.test(icon)) return 'wp';
  if (/^AR_/.test(icon)) return 'ar';
  if (/^ACC_/.test(icon)) return 'acc';
  if (/SkillBook/.test(icon)) return 'book';
  return 'etc';
}
// Grade 5 전설 … 1 일반. Equipment icon tiers run inverted (G2 = 전설 … G6 = 일반).
// Confirmed by the site owner: 룬·그레시아 마력석 = 희귀, skill books use the number as-is
// (_02 고급 … _05 전설).
function grade(icon){
  if (/_Rune_|Gracia_Collection/.test(icon)) return 3;
  const b = icon.match(/SkillBook_.*_0(\d)\.png$/); if (b) return +b[1];
  const m = icon.match(/_G(\d)_/) || icon.match(/_0(\d)\.png$/);
  return m ? Math.max(0, 7 - +m[1]) : 0;
}
function itemIndex(o){
  if (!idx.has(o.id)){ idx.set(o.id, items.length); items.push([o.ko, cat(o.icon), grade(o.icon)]); }
  return idx.get(o.id);
}
const mark = x => /lune|Rune/.test(x) ? 'rune' : /pendant/.test(x) ? 'pend' : /Gracia/.test(x) ? 'stone'
  : x.includes('legendary') ? 'legend' : x.includes('epic') ? 'epic' : '';

function load(kind, prefix, field){
  const META = JSON.parse(fs.readFileSync(path.join(RAW, `_meta_${kind}.json`), 'utf8'));
  return META.map(r => {
    const f = path.join(RAW, prefix + r.n + '.json');
    const arr = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const has = Array.isArray(arr) && arr.length > 0;
    const slots = [[], [], [], [], []];
    const sp = [[], [], [], [], []];            // special items found in each slot's data
    if (has) for (const o of arr){
      const i = itemIndex(o), k = mark(o.icon);
      for (const e of (o[field] || [])){
        const [enc, p, s] = e.split(',');
        const slot = +s.split('-')[1] - 1;
        slots[slot].push([i, +enc, Math.round(parseFloat(p) * 10000)]);
        if (['rune', 'pend', 'stone'].includes(k) && !sp[slot].includes(k)) sp[slot].push(k);
      }
    }
    // src: where the numbers came from when it differs from the current files (e.g. "2023-01"), note: free text
    return { n: +r.n, mats: r.mats, marks: r.slots.map(mark), has, slots, sp, ...(r.src ? { src: r.src } : {}), ...(r.note ? { note: r.note } : {}) };
  });
}
const kinds = { normal: load('normal', 'n', 'normal'), advanced: load('advanced', 'a', 'top') };
fs.writeFileSync(OUT, JSON.stringify({ items, kinds }));
console.log('alchemy items', items.length, '| normal', kinds.normal.length, '| advanced', kinds.advanced.length);
