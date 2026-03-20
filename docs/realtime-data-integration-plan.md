# 世界杯真实动态数据接入实施稿

日期：2026-03-20  
适用版本：`worldcup-forecast-lab`

## 1. 目标

把当前仓库里的本地 `seed feed` 升级成“**供应商快照 + 人工兜底**”的赛前动态信号流，让前台看到的：

- 伤停
- 预计首发 / 官方首发
- 赔率热度
- 赛前新闻

都能通过统一结构进入现有预测链路，而不是继续手工维护整份 `prematch-signals.json`。

## 2. 当前落地内容

本次已经在仓库内落下以下工程入口：

- [.env.example](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/.env.example)
- [scripts/live-data-utils.mjs](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/scripts/live-data-utils.mjs)
- [scripts/sync-live-snapshots.mjs](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/scripts/sync-live-snapshots.mjs)
- [scripts/build-live-signals.mjs](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/scripts/build-live-signals.mjs)

新增命令：

```bash
npm run sync:live:snapshots
npm run build:live:signals
npm run sync:live
```

接入后的输出文件：

- 原始供应商快照：`data/source/live/*.json`
- 合成后的实时信号：`data/source/prematch-signals.live.json`

现有链路已经改成：

- [scripts/validate-prematch-signals.mjs](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/scripts/validate-prematch-signals.mjs) 会优先校验 `prematch-signals.live.json`
- [scripts/generate-predictions.mjs](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/scripts/generate-predictions.mjs) 会优先消费 `prematch-signals.live.json`

也就是说，只要 live feed 生成成功，前台和预测结果就会自动跟着吃到真实动态信号。

## 3. 供应商组合

当前工程按这套组合实现：

### Sportmonks

负责：

- fixtures
- venue / state
- lineups
- expectedLineups
- sidelined
- prematchNews

当前脚本使用的官方思路是：

- `GET /v3/football/fixtures/between/date/{start}/{end}`
- `include=participants;venue;state;lineups;expectedLineups;sidelined;prematchNews`
- `filters=fixtureLeagues:{WORLD_CUP_LEAGUE_ID}`

### The Odds API

负责：

- h2h
- totals
- bookmaker consensus
- market volatility

当前脚本使用的官方思路是：

- `GET /v4/sports/{sport}/odds/`
- `markets=h2h,totals`
- `regions=eu`
- `commenceTimeFrom / commenceTimeTo` 限制到世界杯赛程窗口

## 4. 字段映射

### Sportmonks -> prematch signal

- `participants` -> 主客队对齐
- `lineups` -> `homeLineupConfidence` / `awayLineupConfidence`
- `expectedLineups` -> 当官方首发未出时的阵容确定度
- `sidelined` -> 伤停 alerts 与轻微 xG 扣减
- `prematchNews` -> news alert 与 headline 辅助

### The Odds API -> prematch signal

- `h2h` -> 主客热度差，映射为 `marketHomeShift`
- `totals` -> 总进球倾向，映射为 `homeLambdaDelta` / `awayLambdaDelta` 的共同进球偏置
- 不同 bookmaker 的分散度 -> `marketVolatility`

## 5. 输出策略

最终不会直接替换种子 feed，而是先生成：

- `prematch-signals.live.json`

这份 live feed 的策略是：

1. 先保留原始 seed feed 作为兜底
2. 再叠加 Sportmonks 的阵容、伤停、赛前新闻
3. 再叠加 The Odds API 的市场热度和总进球倾向
4. 最后写成前台已经能消费的统一结构

这样做的好处是：

- 没有 API 数据时，系统仍可回落到 seed feed
- 有些场次供应商数据不全时，不会把已有人工线索冲掉
- 可以渐进式替换，不需要一次性推倒现有前台

## 6. 推荐执行顺序

### 第一步

把 [.env.example](/Users/ttc/Documents/New%20project/worldcup-predictor-mvp/.env.example) 复制成 `.env.local`，填入：

- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_WORLD_CUP_LEAGUE_ID`
- `THE_ODDS_API_KEY`
- `THE_ODDS_API_SPORT_KEY`

### 第二步

拉供应商快照：

```bash
npm run sync:live:snapshots
```

### 第三步

把原始快照转成前台可用的 live signal：

```bash
npm run build:live:signals
```

### 第四步

刷新整站预测结果：

```bash
npm run generate:predictions
```

或直接完整检查：

```bash
npm run check
```

## 7. 已知边界

- 现在的脚本已经是“可跑的接入脚手架”，但还不是完整生产调度系统
- `SPORTMONKS_WORLD_CUP_LEAGUE_ID` 仍需要在真实账号里确认
- `THE_ODDS_API_SPORT_KEY` 需要以实际可用 sport key 为准
- 当前匹配逻辑是“日期 + 主队 + 客队名”的标准化匹配，不是供应商 fixture id 级联
- 前台仍保留人工兜底口径，因为真实供应商数据并不保证每一场都同样完整

## 8. 下一步建议

下一轮建议继续补 3 件事：

1. 增加供应商 fixture id 对照表，减少名字匹配误差
2. 增加自动调度和失败重试，把 `sync:live` 做成定时任务
3. 给运营补一个“实时信号审核页”，允许人工确认后再发布到前台

## 9. 官方参考

- Sportmonks fixtures tutorial: [https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/livescores-and-fixtures/fixtures](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/livescores-and-fixtures/fixtures)
- Sportmonks lineups tutorial: [https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/lineups-and-formations](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/lineups-and-formations)
- The Odds API docs v4: [https://the-odds-api.com/liveapi/guides/v4/](https://the-odds-api.com/liveapi/guides/v4/)
