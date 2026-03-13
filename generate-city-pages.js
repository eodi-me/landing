#!/usr/bin/env node
/**
 * generate-city-pages.js
 *
 * VDB 완료 후 실행: cities.edb에서 도시 메타데이터를 읽어
 * eodi-me/landing 레포에 도시별 정적 HTML 페이지를 생성합니다.
 *
 * 사용법:
 *   node generate-city-pages.js --edb path/to/cities.edb --out path/to/landing/city
 *
 * 생성 결과:
 *   landing/city/tokyo/index.html
 *   landing/city/berlin/index.html
 *   landing/city/seoul/index.html
 *   ... (68,000+)
 *
 * 참고:
 * - .edb 파일은 암호화되어 있으므로 rust-collector의 export 커맨드를
 *   먼저 실행해서 JSON으로 추출한 후 이 스크립트에 넘겨주세요.
 *   예: eodi-collector.exe export --format json --output cities.json
 */

const fs   = require('fs');
const path = require('path');

// ── CLI 인수 파싱 ───────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const citiesJsonPath = getArg('--cities') || 'cities.json';
const outDir         = getArg('--out')    || path.join(__dirname, '..', 'landing', 'city');
const limit          = parseInt(getArg('--limit') || '0', 10); // 0 = 전체

if (!fs.existsSync(citiesJsonPath)) {
  console.error(`cities.json not found at: ${citiesJsonPath}`);
  console.error('Run: eodi-collector.exe export --format json --output cities.json');
  process.exit(1);
}

// ── 데이터 로드 ─────────────────────────────────────────────────
console.log(`Loading cities from ${citiesJsonPath}...`);
const cities = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf8'));
const total  = limit > 0 ? Math.min(limit, cities.length) : cities.length;
console.log(`Generating ${total} city pages...`);

// ── 슬러그 생성 ─────────────────────────────────────────────────
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // 악센트 제거
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── 바이브 차원 레이블 ───────────────────────────────────────────
const DIMS = [
  { key: 'food',      icon: '🍽️', label: 'Food & Drink' },
  { key: 'culture',   icon: '🎭', label: 'Culture' },
  { key: 'nightlife', icon: '🌙', label: 'Nightlife' },
  { key: 'green',     icon: '🌳', label: 'Green Space' },
  { key: 'transit',   icon: '🚇', label: 'Transit' },
  { key: 'commerce',  icon: '🛍️', label: 'Commerce' },
];

// ── 밀도 레이블 ──────────────────────────────────────────────────
function densityLabel(v) {
  if (v >= 80) return 'Very Dense';
  if (v >= 60) return 'Dense';
  if (v >= 38) return 'Moderate';
  if (v >= 18) return 'Sparse';
  return 'Very Sparse';
}

function densityColor(v) {
  if (v >= 80) return '#00CF95';
  if (v >= 60) return '#34d399';
  if (v >= 38) return '#FFB000';
  if (v >= 18) return '#FF9F0A';
  return '#8E8E93';
}
}

// ── 도시 페이지 HTML 생성 ────────────────────────────────────────
function generatePage(city) {
  const slug        = toSlug(city.city || city.name || 'unknown');
  const countrySlug = toSlug(city.country || city.country_code || '');
  const displayName = city.city || city.name || 'Unknown';
  const country     = city.country || city.country_code || '';
  const population  = city.population ? city.population.toLocaleString() : null;

  // radar 벡터: 첫 6차원이 바이브 축
  const radar = (city.vector || []).slice(0, 6).map(v => Math.round(v * 100));
  const hasRadar = radar.length === 6;
  const overallScore = hasRadar ? Math.round(radar.reduce((a,b) => a+b, 0) / 6) : null;

  const title       = `${displayName} Neighborhood Vibe — eodi.me`;
  const description = `Explore what ${displayName}${country ? ', ' + country : ''} is like — food, culture, nightlife, green space, transit, and commerce. Data from OpenStreetMap via eodi.me.`;

  const dimsHtml = hasRadar ? DIMS.map((d, i) => {
    const val   = radar[i] ?? 0;
    const color = densityColor(val);
    const label = densityLabel(val);
    return `
      <div class="dim-row">
        <div class="dim-label">
          <span class="dim-icon">${d.icon}</span>
          <span>${d.label}</span>
        </div>
        <div class="dim-right">
          ${barHtml(val, color)}
          <span class="dim-val" style="color:${color}">${label}</span>
        </div>
      </div>`;
  }).join('') : '<p class="no-data">Vibe data not yet available for this city.</p>';

  const scoreHtml = ''; // overall score removed — density labels per dimension are sufficient

  return { slug, countrySlug, html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="https://eodi.me/images/screenshot-map-en.png" />
  <meta property="og:type" content="article" />
  <link rel="canonical" href="https://eodi.me/city/${slug}/" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Place",
    "name": "${displayName}",
    "description": "${description}",
    "url": "https://eodi.me/city/${slug}/"
    ${country ? `,"addressCountry": "${city.country_code || country}"` : ''}
  }
  </script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#080e1a;--surface:#0d1525;--border:rgba(100,150,255,0.12);--text:#e8eef8;--text2:#8da0be;--text3:#4a5d7a;--accent:#6496ff}
    body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;min-height:100vh}
    a{color:inherit;text-decoration:none}
    nav{display:flex;align-items:center;justify-content:space-between;padding:0 2rem;height:52px;background:rgba(8,14,26,0.9);backdrop-filter:blur(16px);border-bottom:0.5px solid var(--border);position:sticky;top:0;z-index:10}
    .nav-logo{font-size:15px;font-weight:700;letter-spacing:-0.02em}.nav-logo span{color:var(--accent)}
    .nav-back{font-size:12.5px;color:var(--text2);border:0.5px solid var(--border);padding:6px 14px;border-radius:20px;transition:color .15s}
    .nav-back:hover{color:var(--text)}
    .container{max-width:680px;margin:0 auto;padding:48px 2rem 80px}
    .breadcrumb{font-size:12px;color:var(--text3);margin-bottom:28px}
    .breadcrumb a{color:var(--text3);transition:color .15s}.breadcrumb a:hover{color:var(--text2)}
    .breadcrumb span{margin:0 6px;opacity:0.5}
    h1{font-size:clamp(26px,5vw,40px);font-weight:800;letter-spacing:-0.03em;margin-bottom:8px}
    .meta{font-size:13px;color:var(--text2);margin-bottom:32px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .meta-tag{background:rgba(255,255,255,0.05);border:0.5px solid var(--border);padding:3px 10px;border-radius:20px;font-size:12px}
    .score-badge{display:flex;align-items:baseline;gap:4px;margin-bottom:32px}
    .score-num{font-size:52px;font-weight:800;letter-spacing:-0.04em;line-height:1}
    .score-label{font-size:18px;font-weight:600;opacity:0.7}
    .card{background:var(--surface);border:0.5px solid var(--border);border-radius:16px;padding:28px;margin-bottom:20px}
    .card-title{font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent);margin-bottom:20px}
    .dim-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .dim-row:last-child{margin-bottom:0}
    .dim-label{display:flex;align-items:center;gap:8px;font-size:13.5px;min-width:130px}
    .dim-icon{font-size:15px}
    .dim-right{display:flex;align-items:center;gap:10px;flex:1}
    .bar-track{flex:1;height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden}
    .bar-fill{height:100%;border-radius:3px;transition:width .3s}
    .dim-val{font-size:13px;font-weight:700;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
    .no-data{font-size:13px;color:var(--text3);font-style:italic}
    .cta-card{background:rgba(100,150,255,0.06);border:0.5px solid rgba(100,150,255,0.2);border-radius:16px;padding:28px;text-align:center;margin-top:32px}
    .cta-card p{font-size:14px;color:var(--text2);margin-bottom:20px;line-height:1.65}
    .btn{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;padding:11px 24px;border-radius:12px;background:var(--accent);color:#080e1a;transition:opacity .15s}
    .btn:hover{opacity:0.88}
    .source-note{margin-top:40px;font-size:12px;color:var(--text3);line-height:1.65}
    .source-note a{color:var(--text3);border-bottom:0.5px solid var(--text3)}
    footer{text-align:center;padding:32px 2rem;border-top:0.5px solid var(--border);font-size:12px;color:var(--text3)}
    footer a{color:var(--text2)}
  </style>
</head>
<body>
<nav>
  <a href="/" class="nav-logo">eodi<span>.</span>me</a>
  <a href="/" class="nav-back">← Back to eodi.me</a>
</nav>
<div class="container">
  <div class="breadcrumb">
    <a href="/">eodi.me</a>
    <span>›</span>
    <span>${country}</span>
    <span>›</span>
    <span>${displayName}</span>
  </div>

  <h1>${displayName}</h1>
  <div class="meta">
    ${country ? `<span class="meta-tag">📍 ${country}</span>` : ''}
    ${population ? `<span class="meta-tag">👥 Pop. ${population}</span>` : ''}
    <span class="meta-tag">🗺️ OpenStreetMap data</span>
  </div>

  ${scoreHtml}

  <div class="card">
    <div class="card-title">Vibe Dimensions</div>
    ${dimsHtml}
  </div>

  <div class="cta-card">
    <p>
      See the full neighborhood map for ${displayName} — explore individual hexagons,
      compare areas side by side, and find similar neighborhoods anywhere in the world.
    </p>
    <a href="/download.html" class="btn">⬇ Download eodi.me — Free</a>
  </div>

  <p class="source-note">
    Scores are based on <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
    point-of-interest data and <a href="https://www.geonames.org" target="_blank" rel="noopener">GeoNames</a>
    city data (CC BY 4.0). They reflect the density and variety of points of interest
    relative to other cities in the dataset — not absolute quality judgments.
    Data is updated periodically.
  </p>
</div>
<footer>
  <p><a href="/">eodi.me</a> &nbsp;·&nbsp; <a href="/privacy.html">Privacy</a> &nbsp;·&nbsp; <a href="/terms.html">Terms</a></p>
  <p style="margin-top:6px">© 2026 eodi.me</p>
</footer>
</body>
</html>` };
}

// ── 파일 출력 ────────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true });

let generated = 0;
let skipped   = 0;

for (let i = 0; i < total; i++) {
  const city = cities[i];
  if (!city || (!city.city && !city.name)) { skipped++; continue; }

  try {
    const { slug, html } = generatePage(city);
    if (!slug) { skipped++; continue; }

    const dir = path.join(outDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    generated++;

    if (generated % 5000 === 0) {
      console.log(`  ${generated} / ${total} done...`);
    }
  } catch (e) {
    skipped++;
  }
}

console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}`);
console.log(`Output: ${outDir}`);
console.log('\nNext step: commit the city/ folder to eodi-me/landing and push.');
