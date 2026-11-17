# scripts

このサイトは素のHTML/CSSで、ビルドは行いません。繰り返しになる部分だけ、ここのスクリプトで
生成し、生成結果もリポジトリにコミットします。

## convert_catalog.py

アプリ（ARLoupe）のカタログから、Web公開用のカタログと画像を作ります。
**アプリ側のリポジトリは読むだけで、書き込みは行いません。**

```bash
python3 scripts/convert_catalog.py [アプリの arloupe ディレクトリ]
```

- 既定の入力元は `../ARLoupe/arloupe`
- Pillow が必要（`pip install Pillow`）
- 和名がある昆虫だけを対象にします
- 画像は一覧用（幅480px）と詳細用（幅960px）のWebPを作ります
- 出力は `assets/catalog/catalog.json` と `assets/catalog/images/`

## build.mjs

共通部分（ヘッダー・フッター）の差し込みと、昆虫一覧・昆虫詳細の生成を行います。

```bash
node scripts/build.mjs
```

- `assets/catalog/catalog.json` から `catalog/index.html` と
  `catalog/insect/<insectId>/index.html` を作ります
- すべてのHTMLの `<!-- site-header:start -->` 〜 `<!-- site-header:end -->` と
  `<!-- site-footer:start -->` 〜 `<!-- site-footer:end -->` の間を書き換えます
- ナビの項目を増やすときは `build.mjs` の `navItems` を直してから実行します
- Node の追加パッケージは使いません

## 手順

アプリのカタログが更新されたときは、次の順に実行します。

```bash
python3 scripts/convert_catalog.py ../ARLoupe/arloupe
node scripts/build.mjs
```
