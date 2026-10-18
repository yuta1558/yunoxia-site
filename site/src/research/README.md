# Research visualizations

Research ページ（`src/pages/research.astro`）で使う図です。

| ファイル | 内容 | JS |
| --- | --- | --- |
| `VerificationChart.astro` | 実機検証（2026 年 9 月、PLA）の造形時間の棒グラフ | なし |
| `ConversionDiagram.astro` | 元の方言 → 物理中間表現 → 目的の方言、の 2 段変換の構造図 | なし |
| `ProfileDensity.astro` | 公開プロファイルの分布（ノズル温度 × 最大体積流量、出典別）。`data/profile-density.json` から描く | なし |
| `ProfileSpace.astro` | プロファイル空間の散布図。`data/profiles.csv` があるときだけ描く | CSV があるときだけ |

図の数値は研究資料に書かれた値だけを使います。データを合成して図を作ることはしません。

## 公開プロファイルの分布（ProfileDensity）

分析用の CSV（OrcaSlicer と PrusaSlicer の公開プロファイル）から、`source`、`nozzle_temp`、`mvs` の 3 列だけを使い、5 °C × 2 mm³/s のマスで件数を数えた図です。数える以外の計算はしていません。元の CSV はリポジトリに入れず、集計結果（`data/profile-density.json`、約 6KB）だけを置きます。

```sh
node scripts/profile-density.mjs <分析用 CSV のパス> > src/research/data/profile-density.json
```

冷却戦略の軸は分析側の計算なので、この図では描きません。その軸の得点列が用意できたら、下の散布図に使います。

## プロファイル空間の散布図

`src/research/data/profiles.csv` を置くと、ビルド時に読み込まれて Research ページに散布図が出ます。ファイルがなければ、図も script も一切出力されません。

### CSV の形式

1 行目は列名です。区切りはカンマで、値にカンマを含めないでください。必須列は次の 7 つで、ほかの列があっても無視します。

| 列名 | 型 | 内容 |
| --- | --- | --- |
| `profile_id` | 文字列 | プロファイルを一意に示す ID |
| `source_ecosystem` | 文字列 | 出典（例：`bambu`、`prusa`、`polymaker`、`orca`）。凡例と色分けに使う |
| `material` | 文字列 | 樹脂の種類（例：`PLA`、`PETG`、`PA`） |
| `filler` | 文字列 | 充填材（`none`、`GF`、`CF` など） |
| `max_volumetric_flow_mm3s` | 数値 | 最大体積流量 (mm³/s) |
| `nozzle_temp_c` | 数値 | ノズル温度 (°C)。熱履歴の代表値 |
| `cooling_axis` | 数値 | 冷却戦略の軸上の位置。分析で求めた主成分得点など |

あると今後の図に使える任意の列（今は読みません）：

| 列名 | 内容 |
| --- | --- |
| `fan_min_pct` / `fan_max_pct` | 冷却ファンの最小・最大出力 (%) |
| `slow_down_layer_time_s` | 冷却のための減速が始まる層時間の閾値 (s) |
| `bed_temp_c` | ベッド温度 (°C) |
| `extrusion_width_mm` / `layer_height_mm` | ビード形状の代表値 |

数値でない値を含む行は、推測で埋めずに読み飛ばします。

### 描き方

- 既定は 2D の SVG 散布図です。横軸が `cooling_axis`、縦軸が `max_volumetric_flow_mm3s` で、色は `source_ecosystem` です。JS がなくても、動きを減らす設定でも、この図が出ます。
- 図が画面に入り、WebGL2 が使え、動きを減らす設定でなければ、three.js を遅延読み込みして 3D の点群に置き換えます。3 つ目の軸は `nozzle_temp_c` です。
- 3D では、冷却戦略の軸を線で示します。点群はドラッグで回せます。自動では回しません。
- canvas は `aria-hidden` です。図の意味は figcaption と 2D の SVG が担います。
