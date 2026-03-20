# World Cup Forecast Lab

一个可直接部署到 GitHub Pages 的静态 MVP，用来演示“世界杯预测分析系统”在中国合规边界内的产品形态。

## Demo Focus

- 用 baseline 引擎生成世界杯预测 JSON，而不是把结果手写在前端里
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
- `data/source/tournament.json`：赛事范围与分组种子
- `scripts/generate-predictions.mjs`：baseline 预测生成脚本
- `data/generated/worldcup-forecast.json`：前端直接消费的预测结果

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

- 先用 4 个演示小组跑通“数据 -> 模型 -> JSON -> 前端”主链路
- 还没有接入官方抽签后的正式 48 队世界杯赛程
- 还没有接入真实赔率、伤停流与历史回测数据库
