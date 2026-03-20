# 世界杯预测分析系统第一阶段交付报告

日期：2026-03-20  
项目代号：`World Cup Forecast Lab`  
当前版本：`v0.7.0`

## 1. 报告目的

本报告用于替代“只交一个前端页面”的交付方式，面向客户说明：

1. 当前阶段已经完成了什么。
2. 当前版本适合如何验收。
3. 当前还不能承诺为“最终正式版”的原因。
4. 下一阶段如何接入真实动态数据，把演示型 MVP 推进到可运营版本。

一句话结论：

**当前项目已经具备“第一阶段验收版”的交付条件，但不应被定义为最终正式上线版。**

## 2. 本次实际交付物

本次建议交付给客户的主件，不是单一前端，而是以下四部分的组合：

1. 本报告
2. 在线演示站
3. 赛前情报控制台
4. 生成结果与源码仓库

当前在线入口：

- 预测站：[https://ttc1984.github.io/worldcup-forecast-lab/](https://ttc1984.github.io/worldcup-forecast-lab/)
- 情报控制台：[https://ttc1984.github.io/worldcup-forecast-lab/signal-console.html](https://ttc1984.github.io/worldcup-forecast-lab/signal-console.html)
- 交付看板：[https://ttc1984.github.io/worldcup-forecast-lab/delivery-board.html](https://ttc1984.github.io/worldcup-forecast-lab/delivery-board.html)
- 生成数据 JSON：[https://ttc1984.github.io/worldcup-forecast-lab/data/generated/worldcup-forecast.json](https://ttc1984.github.io/worldcup-forecast-lab/data/generated/worldcup-forecast.json)
- GitHub 仓库：[https://github.com/TTC1984/worldcup-forecast-lab](https://github.com/TTC1984/worldcup-forecast-lab)

## 3. 当前已完成内容

### 3.1 数据与赛事结构

- 已接入 `2026` 世界杯 `48` 支球队结构
- 已覆盖 `12` 个小组
- 已生成 `72` 场小组赛预测
- 已接入 `32` 场淘汰赛结构模板
- 已接入赛事级 Monte Carlo 模拟

### 3.2 预测输出能力

当前单场页面已可展示：

- 胜平负概率
- Top3 比分
- 总进球分布
- 半全场建议
- 风险提示
- 赛前动态脉冲

### 3.3 赛事全景能力

当前赛事页已可展示：

- 小组出线概率
- 最佳第三晋级概率
- 四强概率
- 冠军概率
- 模拟口径说明

### 3.4 历史回测能力

当前版本已完成 `2014 / 2018 / 2022` 三届世界杯小组赛回测，共 `144` 场样本。

核心指标如下：

- `1X2` 命中率：`53.5%`
- `Top3` 比分覆盖率：`31.3%`
- 平均 `Brier`：`0.192`
- 平均 `Log Loss`：`0.974`

### 3.5 运维与发布辅助能力

当前仓库已具备：

- 赛前情报 seed feed
- 静态情报控制台
- 草稿差异对比
- 发布说明生成
- 发布包导出
- 客户交付看板

## 4. 建议客户如何验收本阶段

本阶段建议按“验收版 MVP”而不是“终版上线系统”验收。

建议验收点如下：

1. 是否能完整展示世界杯专题结构，而不只是零散比赛卡片。
2. 是否能输出客户要求的核心玩法口径：胜平负、比分、总进球、半全场。
3. 是否能给出赛事全景结果：小组出线、淘汰赛走向、冠军概率。
4. 是否能拿出历史回测指标，而不是只给主观推荐。
5. 是否已经明确合法边界，只做研究型分析系统，不触达互联网售彩。
6. 是否具备后续接入真实动态数据的技术改造空间。

按以上标准，当前版本**可以通过第一阶段验收**。

## 5. 当前不能直接当“最终正式版”的原因

下面这些点必须明确写进报告，否则客户很容易把现阶段成果误解为已经可长期运营的正式产品。

### 5.1 真实参赛名单尚未完全落位

截至 `2026-03-20`，2026 世界杯赛程虽已公布，但仍存在资格赛占位队。当前生成数据里仍有 `18` 场比赛含占位队，因此在全部参赛名单最终确认后，需要重新生成预测结果。

### 5.2 赛前动态仍是本地 seed feed

当前赛前动态来自仓库内的 `prematch-signals.json`，本质是一个演示型人工维护数据层，不是真实 API，也不是正式 CMS。

### 5.3 发布流仍是静态工作流

虽然现在已经有情报控制台、差异对比、发布说明和发布包导出，但仍没有：

- 登录
- 权限
- 审核流
- 自动回写仓库
- 自动刷新任务
- 监控告警

### 5.4 回测仍属于 MVP 校验口径

当前历史回测使用的是“静态球队强度种子向历史回放”的方式，不是按每届赛前真实 Elo、名单、赔率与伤停逐届重建。因此它适合作为第一阶段能力证明，但不适合作为最终商业承诺。

### 5.5 淘汰赛部分规则仍做了近似处理

当前版本对“最佳第三名落位”仍使用近似分配，并未完整编码 FIFA 的正式分配矩阵。

## 6. 当前版本定位建议

建议对客户的正式命名使用：

**《世界杯预测分析系统 V1 验收版》**

不建议使用：

- 正式上线版
- 最终版
- 商用运营版
- 自动化实盘版

这是为了避免客户对系统成熟度、数据实时性和后续工作量产生误解。

## 7. 真实动态数据接入研究

## 7.1 需要接入的真实动态数据类型

如果要把当前系统推进到更接近正式交付的版本，至少需要补四类动态数据：

1. 赛程与比赛状态  
   内容：开赛时间、状态、比分、事件、红黄牌、换人、技术统计

2. 阵容与伤停  
   内容：确认首发、替补名单、伤停、停赛、预计阵容

3. 赔率与盘口快照  
   内容：赛前赔率、滚球赔率、赔率变动、历史赔率快照

4. 赛事元数据  
   内容：小组、积分榜、晋级关系、裁判、球场、球队与球员信息

## 7.2 官方资料调研结论

基于 `2026-03-20` 能查到的官方资料，当前更适合本项目的真实数据接入路径主要有四类。

### A. Sportmonks Football API

官方资料显示，Sportmonks 的足球 API 已明确提供世界杯覆盖，并且其 2026 世界杯专题页和 FAQ 中提到支持：

- fixtures
- live scores
- in-game events
- squads
- player details
- statistics
- standings
- groups
- knockout information

同时，Sportmonks 官方文档和官方博客明确给出了 livescores、inplay、latest 等接口思路，并强调标准 Football API v3 就可以通过 season、stage、state 等过滤条件获取世界杯数据，不需要单独的“World Cup endpoint”。

我的判断：

**Sportmonks 更适合作为“质量优先”的核心足球数据源。**  
优点是覆盖深、结构完整、对世界杯专题支持明确；缺点通常是采购和预算门槛高于轻量方案。

### B. API-Football

API-Football 官方价格页显示，其套餐内统一包含：

- Livescore
- Fixtures
- Events
- Lineups
- Sidelined
- Injuries
- In-play Odds
- Pre-match Odds
- Statistics
- Predictions

同时，其官方教程明确说明可以通过单一 fixture 维度拿到事件、阵容、统计数据，并建议利用 coverage 与组合接口节省请求次数。官方文章还单独说明了 injuries 端点。

我的判断：

**API-Football 更适合作为“成本优先、最快落地”的一体化方案。**  
优点是一个供应商就能覆盖赛程、比分、阵容、伤停、赔率；缺点是如果后续客户对赔率历史、建模深度和稳定性要求继续提高，可能还要再做二次替换或补充。

### C. The Odds API

The Odds API 官方文档明确提供：

- upcoming events and odds
- scores
- event odds
- historical odds
- historical events

并明确说明了调用成本模型、地区与 market 维度，以及历史赔率快照接口。

我的判断：

**The Odds API 更适合作为“赔率专用源”，不适合作为单独的足球全量数据源。**  
如果后续要做赔率波动、历史赔率快照、赔率回测，它很有价值。

### D. football-data.org

football-data.org 官方覆盖页和价格页显示，其支持：

- World Cup 覆盖
- live scores
- fixtures
- schedules
- league tables
- line-ups & substitutions
- squads

但它并不是以赔率和伤停为强项。

我的判断：

**football-data.org 更适合作为预算敏感型的基础赛程/比分/积分数据源，不适合作为本项目唯一的动态数据来源。**

## 7.3 推荐接入方案

### 方案一：成本优先，最快落地

推荐组合：

- `API-Football` 作为主数据源
- 保留当前 `openfootball` 静态快照作为回退与校验源
- 继续保留内部 `prematch-signals` 归一化层

适用场景：

- 客户先要一个能跑起来的真实动态数据版
- 预算有限
- 希望一个供应商尽量覆盖更多数据类型

优点：

- 接入速度最快
- 供应商数量少
- 阵容、伤停、赔率都能先接进来

缺点：

- 后续如果客户特别重视赔率深度或高级数据，仍可能再补一个专用源

### 方案二：质量优先，更接近正式运营

推荐组合：

- `Sportmonks Football API` 负责核心足球数据
- `The Odds API` 负责赔率与赔率历史
- 保留当前 `openfootball` 静态快照作为赛程回退与校验源

适用场景：

- 客户愿意投入更高预算
- 后续希望做更稳定的世界杯专题、赛事中心和赔率分析
- 需要更清晰的数据分层

优点：

- 核心足球数据与赔率数据分工清晰
- 更利于后续模型升级与回测
- 更适合做正式运营型研究平台

缺点：

- 采购和接入复杂度更高
- 数据对齐工作量更大

## 7.4 对当前项目的推荐结论

如果目标是**下一阶段快速交付“真实动态数据版”**，我建议选：

**方案一：API-Football + 当前内部归一化层**

原因：

1. 它最符合当前项目的推进节奏。
2. 当前项目已经有 `prematch-signals` 这一层，适合把外部实时数据先标准化后再喂给预测脚本。
3. 一个供应商先跑通，能最快拿到阵容、伤停、赔率、赛况等真实输入。

如果目标是**中长期正式运营**，再考虑升级到：

**方案二：Sportmonks + The Odds API**

## 7.5 建议的技术改造路径

建议不要直接让前端调用第三方 API，而是在当前项目中增加一个“数据归一化层”。

建议结构如下：

1. 外部数据采集层  
   从第三方 API 拉取 fixtures、lineups、injuries、odds、scores

2. 内部标准化层  
   统一转成项目自己的结构，避免未来更换供应商时前端和模型一起重写

3. 赛前信号构建层  
   将真实动态数据映射为当前项目已经在用的：
   - lineup confidence
   - market shift
   - volatility
   - alerts
   - source labels

4. 预测生成层  
   保留当前 `generate-predictions.mjs` 的输出合同，继续生成 `worldcup-forecast.json`

建议新增的目录或脚本：

- `data/raw/`
- `data/normalized/`
- `scripts/sync-live-core.mjs`
- `scripts/sync-live-odds.mjs`
- `scripts/build-prematch-signals.mjs`

## 7.6 建议的刷新频率

建议的动态数据刷新节奏如下：

- 赛程、积分榜、淘汰赛结构：每 `1` 小时至 `6` 小时
- 距开赛 `24` 小时内的赔率：每 `10` 分钟
- 距开赛 `90` 分钟内的阵容与赔率：每 `1` 到 `3` 分钟
- 开赛中的比分与事件：每 `30` 秒到 `60` 秒
- 赛后归档与回测快照：比赛结束后立即固化

## 7.7 预计实施周期

在不考虑商务采购和 API 开通等待时间的情况下，下一阶段的真实动态数据改造，建议按下面估算：

1. 供应商选型与字段映射：`1` 到 `2` 个工作日
2. 数据采集与标准化脚本：`2` 到 `4` 个工作日
3. 信号映射与预测链路接入：`2` 到 `3` 个工作日
4. 校验、回归与交付文档补充：`2` 个工作日

合计：

**约 `7` 到 `11` 个工作日**

如果客户还要求：

- 审核流
- 登录权限
- 自动发布
- 运维监控

则需在上述基础上继续追加工期。

## 8. 最终建议

对客户最稳妥的表达是：

1. 当前阶段已经完成世界杯预测分析系统的第一版验收成果。
2. 当前主交付件应是“报告 + 演示链接 + 源码/数据”，而不是单独一个前端页面。
3. 下一阶段工作重点不应是继续堆前端，而应是接入真实动态数据，并补齐审核、权限和运维流程。

因此，本项目当前最合理的交付结论是：

**“第一阶段交付完成，可进入真实动态数据接入阶段。”**

## 9. 参考资料

以下资料均为官方页面或官方文档，检索日期为 `2026-03-20`：

- FIFA 2026 官方赛程说明：  
  [https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums)

- Sportmonks Football Docs：  
  [https://docs.sportmonks.com/football](https://docs.sportmonks.com/football)

- Sportmonks World Cup 2026 API 页面：  
  [https://www.sportmonks.com/football-api/world-cup-api/world-cup-2026/](https://www.sportmonks.com/football-api/world-cup-api/world-cup-2026/)

- Sportmonks FAQ：  
  [https://www.sportmonks.com/faq/](https://www.sportmonks.com/faq/)

- API-Football Pricing：  
  [https://www.api-football.com/pricing](https://www.api-football.com/pricing)

- API-Football Documentation：  
  [https://www.api-football.com/documentation](https://www.api-football.com/documentation)

- API-Football Fixtures 教程：  
  [https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league](https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league)

- API-Football Injuries 说明：  
  [https://www.api-football.com/news/post/new-endpoint-injuries](https://www.api-football.com/news/post/new-endpoint-injuries)

- API-Football 节省请求教程：  
  [https://www.api-football.com/news/post/how-to-save-calls-to-the-api](https://www.api-football.com/news/post/how-to-save-calls-to-the-api)

- The Odds API Docs：  
  [https://the-odds-api.com/liveapi/guides/v4/](https://the-odds-api.com/liveapi/guides/v4/)

- football-data.org Coverage：  
  [https://www.football-data.org/coverage](https://www.football-data.org/coverage)

- football-data.org Pricing：  
  [https://www.football-data.org/pricing](https://www.football-data.org/pricing)

- football-data.org API Reference：  
  [https://www.football-data.org/documentation/api](https://www.football-data.org/documentation/api)
