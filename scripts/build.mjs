#!/usr/bin/env node
// 共通部分（ヘッダー・フッター）の差し込みと、昆虫一覧・昆虫詳細の生成。
// 生成結果はリポジトリにコミットする。アプリ側のリポジトリには触れない。

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(repoRoot, 'assets', 'catalog', 'catalog.json');

const navItems = [
  { path: '', label: 'ホーム' },
  { path: 'app/', label: 'アプリについて' },
  { path: 'catalog/', label: '昆虫一覧' },
  { path: 'catalog/about/', label: 'この図鑑について' },
  { path: 'privacy/', label: 'プライバシー・利用規約' },
];

// ガイドラインで決まっている科の色。それ以外は科名から安定して割り当てる。
const fixedFamilyAccents = new Map([
  ['コガネムシ科', 'sunset'],
  ['クワガタムシ科', 'soil'],
]);
const accentNames = ['leaf', 'sky', 'sunset', 'sunflower', 'berry', 'violet', 'soil'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function accentForFamily(family) {
  const fixed = fixedFamilyAccents.get(family);
  if (fixed) return fixed;
  let hash = 0x811c9dc5;
  for (const character of family) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return accentNames[hash % accentNames.length];
}

function familyChip(label, family) {
  const accent = accentForFamily(family);
  const style = `background: var(--accent-${accent}-pale); color: var(--accent-${accent}-text)`;
  return `<span class="family-chip" style="${style}">${escapeHtml(label)}</span>`;
}

function pageContext(relativePath) {
  // 404 はどのパスでも配信されるため、ルートからの絶対パスで書く。
  if (relativePath === '404.html') return { prefix: '/', currentPath: null };

  const segments = relativePath.split('/');
  const prefix = '../'.repeat(segments.length - 1);
  const directory = segments.slice(0, -1).join('/');
  let currentPath = directory === '' ? '' : `${directory}/`;
  if (currentPath.startsWith('catalog/insect/')) currentPath = 'catalog/';
  return { prefix, currentPath };
}

function renderHeader({ prefix, currentPath }) {
  const home = prefix === '' ? './' : prefix;
  const items = navItems
    .map((item) => {
      const href = item.path === '' ? home : `${prefix}${item.path}`;
      const current = item.path === currentPath ? ' aria-current="page"' : '';
      return `        <li><a href="${href}"${current}>${item.label}</a></li>`;
    })
    .join('\n');

  return `
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${home}"><img class="logotype" src="${prefix}assets/logotype.webp" alt="ARむしめがね" width="602" height="144"></a>
    <button class="nav-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.25"></path></svg>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="メインメニュー">
      <div class="site-nav-head">
        <p class="site-nav-title">メニュー</p>
        <button class="nav-close" type="button" aria-label="メニューを閉じる" data-nav-close>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2.25"></path></svg>
        </button>
      </div>
      <ul>
${items}
      </ul>
    </nav>
  </div>
</header>
<div class="nav-scrim" data-nav-scrim></div>
`;
}

function renderFooter({ prefix }) {
  const home = prefix === '' ? './' : prefix;
  return `
<footer class="site-footer">
  <div class="wrap footer-inner">
    <a class="brand" href="${home}"><img class="logotype" src="${prefix}assets/logotype.webp" alt="ARむしめがね" width="602" height="144"></a>
  </div>
</footer>
`;
}

function replaceRegion(html, name, replacement) {
  const pattern = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `$1${replacement}$2`);
}

function documentHead({ prefix, title, description }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#FFFCF7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0B0D0B" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${prefix}assets/icon.png" type="image/png">
  <link rel="stylesheet" href="${prefix}assets/site.css">
  <script src="${prefix}assets/nav.js" defer></script>
</head>
<body>
<a class="skip" href="#main">本文へ移動</a>
<!-- site-header:start --><!-- site-header:end -->`;
}

const documentTail = `<!-- site-footer:start --><!-- site-footer:end -->
</body>
</html>
`;

function renderCatalogIndex(insects) {
  const prefix = '../';
  const cards = insects
    .map((insect) => {
      const chip = insect.family ? `\n        ${familyChip(insect.family, insect.family)}` : '';
      return `      <li><a class="insect-card" href="insect/${escapeHtml(insect.id)}/">
        <img src="${prefix}${escapeHtml(insect.image.card)}" alt="${escapeHtml(insect.name)}" loading="lazy">${chip}
        <div class="name">${escapeHtml(insect.name)}</div>
      </a></li>`;
    })
    .join('\n');

  return `${documentHead({
    prefix,
    title: '昆虫一覧 | ARむしめがね',
    description: 'ARむしめがねに収録された昆虫の一覧です。写真と名前から選んで、特徴と観察するときのポイントを確認できます。',
  })}
<main id="main" class="wrap page">
  <div class="page-head">
    <div class="page-title-row">
      <h1>昆虫一覧</h1>
      <span class="count-chip">${insects.length}件</span>
    </div>
    <p class="intro">気になる昆虫を選ぶと、特徴や観察するときのポイントを確認できます。</p>
  </div>

  <ul class="catalog-grid">
${cards}
  </ul>
</main>
${documentTail}`;
}

function renderInsectPage(insect) {
  const prefix = '../../../';
  const sections = [];

  for (const fact of insect.basicInformation) {
    sections.push(`      <section class="section">
        <h2>${escapeHtml(fact.label || '紹介')}</h2>
        <p>${escapeHtml(fact.value)}</p>
      </section>`);
  }

  if (insect.featurePoints.length > 0) {
    const points = insect.featurePoints
      .map((point) => `          <li>${escapeHtml(point)}</li>`)
      .join('\n');
    sections.push(`      <section class="section">
        <h2>観察するときのポイント</h2>
        <ul class="points">
${points}
        </ul>
      </section>`);
  }

  if (insect.similarSpeciesNote) {
    sections.push(`      <section class="panel">
        <h2>似ている昆虫</h2>
        <p>${escapeHtml(insect.similarSpeciesNote)}</p>
      </section>`);
  }

  if (sections.length === 0) {
    sections.push(`      <section class="section">
        <h2>準備中</h2>
        <p>この昆虫の説明は準備中です。写真と名前のみを掲載しています。</p>
      </section>`);
  }

  const creditLines = [];
  const image = insect.image;
  if (image.credit) {
    let line = `画像：${escapeHtml(image.credit)}`;
    if (image.license) line += `（${escapeHtml(image.license)}）`;
    if (image.sourceUrl) line += ` <a href="${escapeHtml(image.sourceUrl)}">出典</a>`;
    creditLines.push(line);
  }
  if (insect.nameReviewedAt) {
    creditLines.push(`学名の確認日：${escapeHtml(insect.nameReviewedAt)}`);
  }
  const credit = creditLines.map((line) => `    <p>${line}</p>`).join('\n');

  const scientificName = insect.scientificName
    ? `\n    <p class="sci-name">${escapeHtml(insect.scientificName)}</p>`
    : '';
  const chipRow = insect.classification
    ? `\n    <div class="chip-row">${familyChip(insect.classification, insect.family || insect.classification)}</div>`
    : '';

  return `${documentHead({
    prefix,
    title: `${insect.name} | ARむしめがね`,
    description: `${insect.name}の写真、分類、特徴、観察するときのポイントです。`,
  })}
<main id="main" class="wrap page">
  <a class="back" href="${prefix}catalog/"><span aria-hidden="true">←</span> 昆虫一覧</a>
  <div class="page-head">
    <h1>${escapeHtml(insect.name)}</h1>${scientificName}${chipRow}
  </div>

  <div class="insect-cols">
    <figure class="insect-photo">
      <img src="${prefix}${escapeHtml(image.detail)}" alt="${escapeHtml(insect.name)}">
    </figure>

    <div>
${sections.join('\n')}
    </div>
  </div>

  <div class="credit">
${credit}
  </div>
</main>
${documentTail}`;
}

function collectHtmlFiles(directory, basePath = '') {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'scripts') continue;
    const fullPath = join(directory, entry);
    const relativePath = basePath === '' ? entry : `${basePath}/${entry}`;
    if (statSync(fullPath).isDirectory()) {
      found.push(...collectHtmlFiles(fullPath, relativePath));
    } else if (entry.endsWith('.html')) {
      found.push(relativePath);
    }
  }
  return found;
}

function main() {
  if (existsSync(catalogPath)) {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    const insects = catalog.insects || [];

    const catalogDirectory = join(repoRoot, 'catalog');
    mkdirSync(catalogDirectory, { recursive: true });
    writeFileSync(join(catalogDirectory, 'index.html'), renderCatalogIndex(insects), 'utf8');

    for (const insect of insects) {
      const directory = join(catalogDirectory, 'insect', insect.id);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'index.html'), renderInsectPage(insect), 'utf8');
    }
    console.log(`生成: catalog/index.html と昆虫詳細 ${insects.length} ページ`);
  } else {
    console.log(`公開カタログが無いため、図鑑のページは生成しません: ${catalogPath}`);
  }

  let injected = 0;
  for (const relativePath of collectHtmlFiles(repoRoot)) {
    const fullPath = join(repoRoot, relativePath);
    const original = readFileSync(fullPath, 'utf8');
    const context = pageContext(relativePath);
    let updated = replaceRegion(original, 'site-header', renderHeader(context));
    updated = replaceRegion(updated, 'site-footer', renderFooter(context));
    if (updated !== original) {
      writeFileSync(fullPath, updated, 'utf8');
      injected += 1;
    }
  }
  console.log(`共通部分を差し込み: ${injected} ページ`);
}

main();
