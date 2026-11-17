// Small Markdown → HTML converter for the site's own guides (content/guides/*.md).
// Covers what the admin editor produces: headings, paragraphs, bold/italic/strike, inline code,
// code fences, quotes, lists, links, images, tables, rules, raw HTML blocks, and a YouTube
// link alone on a line (becomes an embedded player).
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s){
  const keep = [];
  const stash = html => { keep.push(html); return `\u0000${keep.length - 1}\u0000`; };
  s = s.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (_, alt, src) => stash(`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`));
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (_, t, href) =>
    stash(`<a href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${inline(t)}</a>`));
  s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => stash(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`));
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

const youtubeId = line => {
  const m = line.trim().match(/^(?:<)?https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})[^\s>]*(?:>)?$/);
  return m ? m[1] : null;
};

function render(md){
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlank = l => !l.trim();
  while (i < lines.length){
    const l = lines[i];
    if (isBlank(l)){ i++; continue; }
    let m;
    if ((m = l.match(/^```(.*)$/))){                                   // code fence
      const buf = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))){                    // heading (h1 in a post body becomes h2)
      const n = Math.min(6, Math.max(2, m[1].length)); out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)){ out.push('<hr>'); i++; continue; }
    const yt = youtubeId(l);
    if (yt){ out.push(`<p><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="영상" loading="lazy" allowfullscreen></iframe></p>`); i++; continue; }
    if (/^\s*</.test(l) && !/^\s*<https?:/.test(l)){                     // raw HTML block, kept as written
      const buf = [];
      while (i < lines.length && !isBlank(lines[i])) buf.push(lines[i++]);
      out.push(buf.join('\n')); continue;
    }
    if (/^>\s?/.test(l)){                                               // quote
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])){   // table
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      const head = cells(l); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if ((m = l.match(/^(\s*)([-*+]|\d+[.)])\s+/))){                      // list (one level of nesting by indent)
      const ordered = /\d/.test(m[2]);
      const items = [];
      while (i < lines.length){
        const lm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (lm && lm[1].length <= m[1].length + 1){ items.push([lm[3]]); i++; }
        else if (!isBlank(lines[i]) && /^\s{2,}/.test(lines[i]) && items.length){ items[items.length - 1].push(lines[i].replace(/^\s{2,4}/, '')); i++; }
        else if (isBlank(lines[i]) && i + 1 < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i + 1])){ i++; }
        else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(it => `<li>${inline(it[0])}${it.length > 1 ? render(it.slice(1).join('\n')) : ''}</li>`).join('')}</${tag}>`);
      continue;
    }
    const buf = [];                                                     // paragraph
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) && !(buf.length && youtubeId(lines[i]))) buf.push(lines[i++]);
    const only = buf.length === 1 && /^!\[[^\]]*\]\([^)]+\)$/.test(buf[0].trim());
    out.push(only ? `<figure>${inline(buf[0].trim())}</figure>` : `<p>${buf.map(x => inline(x.replace(/\s+$/, ''))).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// "---\nkey: value\n---\nbody" → { data, body }. Handles plain, quoted and folded (>, |) values.
function frontMatter(text){
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {}, lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++){
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][+-]?$/.test(v)){
      const buf = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) buf.push(lines[++i].trim());
      v = buf.join(v[0] === '|' ? '\n' : ' ').trim();
    } else if (/^"(.*)"$/.test(v)){ try { v = JSON.parse(v); } catch (e){ v = v.slice(1, -1); } }
    else if (/^'(.*)'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

module.exports = { render, frontMatter };
