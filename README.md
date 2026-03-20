# World Cup Forecast Lab

一个可直接部署到 GitHub Pages 的静态 MVP，用来演示“世界杯预测分析系统”在中国合规边界内的产品形态。

## Demo Focus

- 用 baseline 引擎生成世界杯预测 JSON，而不是把结果手写在前端里
- 使用 2026 世界杯真实赛程快照，而不是演示性假分组
- 支持胜平负、Top3 比分、总进球、半全场
- 强调回测指标、风险提示和合法边界
- 不提供在线购彩、代投、出票或跟单能力

## Stack

- Plain HTML
- CSS
- Vanilla JavaScript
- Node.js scripts
- GitHub Pages via GitHub Actions

## Project Layout

- `data/source/teams.json`：球队强度种子数据
- `data/source/worldcup-2026-openfootball-cup.txt`：2026 小组赛快照
- `data/source/worldcup-2026-openfootball-cup_finals.txt`：2026 淘汰赛结构快照
- `data/source/tournament.json`：赛事元数据与来源说明
- `scripts/sync-2026-source.mjs`：同步 openfootball 最新快照
- `scripts/generate-predictions.mjs`：baseline 预测生成脚本
- `data/generated/worldcup-forecast.json`：前端直接消费的预测结果

## Data Source

当前版本使用仓库内快照文件作为“可重复构建”的真实数据源，快照来自：

- [openfootball/worldcup 2026--usa](https://github.com/openfootball/worldcup/tree/master/2026--usa)

其内容和 FIFA 在 2025-12-06 公布的 2026 世界杯赛程框架一致，但仍包含 6 个尚未决出的资格赛占位队，因此部分比赛会保留 `UEFA Path X winner` / `IC Path X winner` 的占位名称。

如需刷新快照：

```bash
npm run sync:source
```

## Generate Predictions

先生成最新的预测数据：

```bash
npm run generate:predictions
```

## Local Preview

推荐在目录下起一个静态服务：

```bash
npm run generate:predictions
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`

## Deployment

仓库推送到 GitHub 后，GitHub Actions 会自动把站点部署到 GitHub Pages。

## Notes

这个项目是分析系统原型，不是投注工具。

当前版本的关键限制：

- 小组赛已切到 2026 真实赛程快照，但淘汰赛仍是结构模板，尚未做晋级模拟
- 仍有 6 个资格赛占位队未最终落位
- 还没有接入真实赔率、伤停流与历史回测数据库
