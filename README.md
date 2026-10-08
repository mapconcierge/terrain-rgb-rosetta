# terrain-rgb-rosetta

DEM の画素値（DN）を RGB にどう詰めるかを、Terrarium / Terrain-RGB / 地理院標高タイルで比べる教育用シングルページアプリ。

## 起動

```sh
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを出力
npm test         # 検算（往復変換）
```

GitHub Pages: Settings → Pages → Source を「GitHub Actions」にすると、`main` への push で `.github/workflows/pages.yml` が公開する。

## 式の出典メモ

- Terrarium: `(R*256 + G + B/256) - 32768` — [Tilezen Joerd](https://github.com/tilezen/joerd/blob/master/docs/formats.md)
- Terrain-RGB: `-10000 + ((R*256*256 + G*256 + B)*0.1)` — [Mapbox](https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/)
- 地理院: `x = 2^16 R + 2^8 G + B`、`u = 0.01`、`x = 2^23` は無効、`x > 2^23` は `x - 2^24` — [国土地理院](https://maps.gsi.go.jp/development/demtile.html)
- 地図の標高タイル: [Mapterhorn](https://mapterhorn.com/)（Terrarium 形式）
