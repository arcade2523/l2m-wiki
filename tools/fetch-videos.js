// Reads the YouTube channel's public feed (latest 15 uploads, no API key needed)
// and writes data/videos.json. Run before tools/build.js; the deploy workflow does
// this on a schedule so new uploads appear on the site automatically.
const fs = require('fs'), path = require('path');
const CHANNEL_ID = 'UCDfaOyaSG0VrCfqWd6YVeUQ';
const OUT = path.join(__dirname, '..', 'data', 'videos.json');
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

(async () => {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('feed ' + r.status);
  const xml = await r.text();
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: (e.match(/<yt:videoId>([^<]+)/) || [])[1],
    title: decode((e.match(/<title>([^<]*)/) || [])[1] || ''),
    date: ((e.match(/<published>([^<]+)/) || [])[1] || '').slice(0, 10),
    views: +((e.match(/<media:statistics views="(\d+)"/) || [])[1] || 0),
  })).filter(v => v.id);
  if (!videos.length) throw new Error('feed had no entries');
  const channel = decode((xml.match(/<author>\s*<name>([^<]*)/) || [])[1] || '');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ channelId: CHANNEL_ID, channel, fetched: new Date().toISOString(), videos }, null, 1));
  console.log('videos:', videos.length, '| latest:', videos[0].date, videos[0].title);
})().catch(e => { console.error('fetch-videos failed:', e.message); process.exit(1); });
