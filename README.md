# World Cup Forecast Lab

一个可直接部署到 GitHub Pages 的静态原型，用来演示“世界杯预测分析系统”在中国合规边界内的产品形态。

## Demo Focus

- 概率化输出，而不是“必中推荐”
- 支持胜平负、Top3 比分、总进球、半全场
- 强调回测指标、风险提示和合法边界
- 不提供在线购彩、代投、出票或跟单能力

## Stack

- Plain HTML
- CSS
- Vanilla JavaScript
- GitHub Pages via GitHub Actions

## Local Preview

直接用浏览器打开 `index.html` 即可，或者在目录下起一个静态服务：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`

## Deployment

仓库推送到 GitHub 后，GitHub Actions 会自动把站点部署到 GitHub Pages。

## Notes

这个项目是产品原型，不是投注工具。页面中的比赛数据全部为样例数据，仅用于演示信息结构和界面效果。
