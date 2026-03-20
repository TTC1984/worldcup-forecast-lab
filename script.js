const elements = {
  moduleTabs: [...document.querySelectorAll("[data-module-target]")],
  moduleLinks: [...document.querySelectorAll("[data-module-link]")],
  modulePanels: [...document.querySelectorAll("[data-module-panel]")],
  heroMatchTitle: document.getElementById("hero-match-title"),
  heroMainPick: document.getElementById("hero-main-pick"),
  heroRiskLevel: document.getElementById("hero-risk-level"),
  heroUpdateNote: document.getElementById("hero-update-note"),
  summaryTeamCount: document.getElementById("summary-team-count"),
  summaryFixtureCount: document.getElementById("summary-fixture-count"),
  summaryCoverageCount: document.getElementById("summary-coverage-count"),
  summaryBacktestCount: document.getElementById("summary-backtest-count"),
  dataStatus: document.getElementById("data-status"),
  groupFilter: document.getElementById("group-filter"),
  switcher: document.getElementById("match-switcher"),
  title: document.getElementById("fixture-title"),
  stage: document.getElementById("fixture-stage"),
  meta: document.getElementById("fixture-meta"),
  advice: document.getElementById("fixture-advice"),
  engine: document.getElementById("fixture-engine"),
  bestPick: document.getElementById("best-pick"),
  confidenceText: document.getElementById("confidence-text"),
  riskText: document.getElementById("risk-text"),
  outcomeBars: document.getElementById("outcome-bars"),
  scoreGrid: document.getElementById("score-grid"),
  goalsGrid: document.getElementById("goals-grid"),
  halftimeGrid: document.getElementById("halftime-grid"),
  prematchHeadline: document.getElementById("prematch-headline"),
  prematchMeta: document.getElementById("prematch-meta"),
  prematchPulseGrid: document.getElementById("prematch-pulse-grid"),
  prematchAlertList: document.getElementById("prematch-alert-list"),
  prematchSourceList: document.getElementById("prematch-source-list"),
  riskList: document.getElementById("risk-list"),
  groupProjectionTitle: document.getElementById("group-projection-title"),
  groupProjectionBody: document.getElementById("group-projection-body"),
  titleContenders: document.getElementById("title-contenders"),
  simulationNotes: document.getElementById("simulation-notes"),
  backtestStatus: document.getElementById("backtest-status"),
  backtestMatchCount: document.getElementById("backtest-match-count"),
  backtestOutcomeAccuracy: document.getElementById("backtest-outcome-accuracy"),
  backtestTop3Coverage: document.getElementById("backtest-top3-coverage"),
  backtestConfidence: document.getElementById("backtest-confidence"),
  backtestBrier: document.getElementById("backtest-brier"),
  backtestLogLoss: document.getElementById("backtest-logloss"),
  backtestSeasonBody: document.getElementById("backtest-season-body"),
  backtestCalibrationBody: document.getElementById("backtest-calibration-body"),
  backtestNotes: document.getElementById("backtest-notes"),
  backtestSurpriseList: document.getElementById("backtest-surprise-list"),
  updateFeedTitle: document.getElementById("update-feed-title"),
  updateFeedMeta: document.getElementById("update-feed-meta"),
  updateFeedList: document.getElementById("update-feed-list"),
  updateRefreshList: document.getElementById("update-refresh-list"),
  updateGapList: document.getElementById("update-gap-list"),
};

const state = {
  model: null,
  summary: null,
  fixtures: [],
  groups: [],
  simulation: null,
  backtest: null,
  prematchFeed: null,
  sources: [],
  activeGroup: null,
  activeModule: "pick",
};

const teamTranslations = {
  Mexico: "墨西哥",
  "South Africa": "南非",
  "South Korea": "韩国",
  "UEFA Path D winner": "欧洲附加赛 D 路胜者",
  Canada: "加拿大",
  "UEFA Path A winner": "欧洲附加赛 A 路胜者",
  Qatar: "卡塔尔",
  Switzerland: "瑞士",
  Brazil: "巴西",
  Morocco: "摩洛哥",
  Haiti: "海地",
  Scotland: "苏格兰",
  USA: "美国",
  Paraguay: "巴拉圭",
  Australia: "澳大利亚",
  "UEFA Path C winner": "欧洲附加赛 C 路胜者",
  Germany: "德国",
  Russia: "俄罗斯",
  "Curaçao": "库拉索",
  "Ivory Coast": "科特迪瓦",
  Ecuador: "厄瓜多尔",
  Netherlands: "荷兰",
  Japan: "日本",
  "UEFA Path B winner": "欧洲附加赛 B 路胜者",
  Tunisia: "突尼斯",
  Belgium: "比利时",
  Egypt: "埃及",
  Iran: "伊朗",
  "New Zealand": "新西兰",
  Spain: "西班牙",
  "Cape Verde": "佛得角",
  "Saudi Arabia": "沙特",
  Uruguay: "乌拉圭",
  France: "法国",
  Senegal: "塞内加尔",
  "IC Path 2 winner": "洲际附加赛 2 路胜者",
  Norway: "挪威",
  Argentina: "阿根廷",
  Algeria: "阿尔及利亚",
  Austria: "奥地利",
  Jordan: "约旦",
  Portugal: "葡萄牙",
  "IC Path 1 winner": "洲际附加赛 1 路胜者",
  Uzbekistan: "乌兹别克斯坦",
  Colombia: "哥伦比亚",
  England: "英格兰",
  Croatia: "克罗地亚",
  Ghana: "加纳",
  Panama: "巴拿马",
  Cameroon: "喀麦隆",
  "Costa Rica": "哥斯达黎加",
  Italy: "意大利",
};

function renderSummary() {
  elements.summaryTeamCount.textContent = String(state.summary.teamCount);
  elements.summaryFixtureCount.textContent = String(state.summary.fixtureCount);
  elements.summaryCoverageCount.textContent = String(state.summary.prematchCoverageCount);
  elements.summaryBacktestCount.textContent = String(state.summary.backtestMatchCount);

  const generatedAt = formatDateTime(state.model.generatedAt);
  elements.dataStatus.textContent =
    `整站最近更新于 ${generatedAt}，当前有 ${state.summary.fixtureCount} 场比赛参考、${state.summary.prematchCoverageCount} 场赛前消息覆盖。`;
}

function resolveModuleFromHash() {
  const rawHash = window.location.hash.replace("#", "");
  const matchedPanel = elements.modulePanels.find((panel) => panel.id === rawHash);
  return matchedPanel?.dataset.modulePanel || "pick";
}

function setActiveModule(moduleId, options = {}) {
  document.body.classList.add("has-module-tabs");
  const nextModule = elements.modulePanels.some((panel) => panel.dataset.modulePanel === moduleId) ? moduleId : "pick";
  state.activeModule = nextModule;

  elements.moduleTabs.forEach((button) => {
    const isActive = button.dataset.moduleTarget === nextModule;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  elements.modulePanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.modulePanel === nextModule);
  });

  if (options.updateHash) {
    const nextHash = `#${nextModule}`;

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  if (options.scroll) {
    document.getElementById(nextModule)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindModuleNavigation() {
  elements.moduleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveModule(button.dataset.moduleTarget, { updateHash: true, scroll: true });
    });
  });

  elements.moduleLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const moduleId = link.dataset.moduleLink;

      if (!moduleId) {
        return;
      }

      event.preventDefault();
      setActiveModule(moduleId, { updateHash: true, scroll: true });
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveModule(resolveModuleFromHash(), { updateHash: false, scroll: false });
  });
}

function getVisibleFixtures() {
  return state.fixtures.filter((fixture) => fixture.group === state.activeGroup);
}

function renderGroupFilter() {
  elements.groupFilter.innerHTML = state.groups
    .map((group) => `<option value="${group.label}">${formatGroupLabel(group.label)}</option>`)
    .join("");

  elements.groupFilter.value = state.activeGroup;
  elements.groupFilter.onchange = () => {
    state.activeGroup = elements.groupFilter.value;
    updateFixture(getVisibleFixtures()[0]?.id);
  };
}

function renderSwitcher(activeId) {
  elements.switcher.innerHTML = getVisibleFixtures()
    .map(
      (fixture) => `
        <button class="match-button ${fixture.id === activeId ? "is-active" : ""}" data-id="${fixture.id}">
          <strong>${formatFixtureLabel(fixture.homeTeam, fixture.awayTeam)}</strong>
          <small>${formatGroupLabel(fixture.group)} · ${fixture.date}</small>
        </button>
      `
    )
    .join("");

  elements.switcher.querySelectorAll(".match-button").forEach((button) => {
    button.addEventListener("click", () => {
      updateFixture(button.dataset.id);
    });
  });
}

function renderOutcomeBars(outcomes) {
  elements.outcomeBars.innerHTML = outcomes
    .map(
      (outcome) => `
        <div class="bar-item">
          <span>${friendlyOutcome(outcome.label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${outcome.value}%;">
              <span>${friendlyOutcome(outcome.label)}</span>
              <strong>${outcome.value}%</strong>
            </div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderScores(scores) {
  elements.scoreGrid.innerHTML = scores
    .map(
      (item) => `
        <article class="score-chip">
          <strong>${item.score}</strong>
          <span>${item.probability}</span>
        </article>
      `
    )
    .join("");
}

function renderTags(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <article class="tag">
          <strong>${item.label}</strong>
          <span>${item.note}</span>
        </article>
      `
    )
    .join("");
}

function renderGoals(goals) {
  renderTags(
    elements.goalsGrid,
    goals.map((item) => ({
      label: friendlyGoalLabel(item.label),
      note: item.note,
    }))
  );
}

function renderHalftime(halftime) {
  renderTags(
    elements.halftimeGrid,
    halftime.map((item) => ({
      label: friendlyHalfFullLabel(item.label),
      note: item.note,
    }))
  );
}

function renderPrematch(prematch) {
  if (!prematch) {
    elements.prematchHeadline.textContent = "这场暂时还没有新的赛前消息。";
    elements.prematchMeta.textContent = "";
    elements.prematchPulseGrid.innerHTML = "";
    elements.prematchAlertList.innerHTML = "";
    elements.prematchSourceList.innerHTML = "";
    return;
  }

  elements.prematchHeadline.textContent = simplifyHeadline(prematch.headline);
  elements.prematchMeta.textContent =
    `${friendlyCoverageLabel(prematch.coverage)} · ${formatDateTime(prematch.lastUpdated)} 更新 · 大约 ${prematch.freshnessHours} 小时前`;

  renderTags(
    elements.prematchPulseGrid,
    prematch.pulseTags.map((item) => ({
      label: simplifyPulseLabel(translateFixtureText(item.label)),
      note: item.note,
    }))
  );

  elements.prematchAlertList.innerHTML = prematch.alerts
    .map((alert) => `<li>${simplifyRiskText(translateFixtureText(alert))}</li>`)
    .join("");
  elements.prematchSourceList.innerHTML = prematch.sourceLabels
    .map((label) => `<span class="source-chip">${simplifySourceLabel(label)}</span>`)
    .join("");
}

function renderRisks(risks, fixture) {
  const combined = [...risks.map(simplifyRiskText)];

  if (fixture.hasPlaceholderTeam) {
    combined.push("这场还有资格赛占位队，等最终分组确认后结果可能会变。");
  }

  elements.riskList.innerHTML = unique(combined).map((risk) => `<li>${risk}</li>`).join("");
}

function renderHeroQuickLook(fixture) {
  elements.heroMatchTitle.textContent = formatFixtureLabel(fixture.homeTeam, fixture.awayTeam);
  elements.heroMainPick.textContent = fixture.bestPick;
  elements.heroRiskLevel.textContent = getRiskTone(fixture);
  elements.heroUpdateNote.textContent = fixture.prematch
    ? `${friendlyCoverageLabel(fixture.prematch.coverage)} · ${fixture.prematch.freshnessHours} 小时前`
    : "暂无新消息";
}

function renderFixture(fixture) {
  elements.title.textContent = formatFixtureLabel(fixture.homeTeam, fixture.awayTeam);
  elements.stage.textContent = formatStageLabel(fixture.stage);
  elements.meta.textContent = `${formatGroupLabel(fixture.group)} · ${fixture.date} ${fixture.kickoff} · ${mapVenueName(fixture.venue)}`;
  elements.advice.textContent = buildFixtureAdvice(fixture);
  elements.engine.textContent = buildTechnicalNote(fixture);
  elements.bestPick.textContent = fixture.bestPick;
  elements.confidenceText.textContent = getConfidenceTone(fixture);
  elements.riskText.textContent = getRiskTone(fixture);

  renderHeroQuickLook(fixture);
  renderOutcomeBars(fixture.outcomes);
  renderScores(fixture.scores);
  renderGoals(fixture.goals);
  renderHalftime(fixture.halftime);
  renderPrematch(fixture.prematch);
  renderRisks(fixture.risks, fixture);
}

function renderGroupProjection() {
  const groupProjection = state.simulation?.groupProjections.find((group) => group.label === state.activeGroup);

  if (!groupProjection) {
    elements.groupProjectionTitle.textContent = "本组走势暂不可用";
    elements.groupProjectionBody.innerHTML = "";
    return;
  }

  elements.groupProjectionTitle.textContent = `${formatGroupLabel(groupProjection.label)} 谁更容易出线`;
  elements.groupProjectionBody.innerHTML = [...groupProjection.teams]
    .sort((left, right) => right.qualifyProbability - left.qualifyProbability)
    .map(
      (team) => `
        <tr>
          <td>
            <div class="table-team">
              <strong>${mapTeamName(team.team)}</strong>
              <span>平均 ${team.averagePoints} 分</span>
            </div>
          </td>
          <td>${team.qualifyProbability}%</td>
          <td>${team.positionProbabilities.first}%</td>
          <td>${team.championProbability}%</td>
        </tr>
      `
    )
    .join("");
}

function renderTitleContenders() {
  const contenders = state.simulation?.titleContenders.slice(0, 8) || [];

  elements.titleContenders.innerHTML = contenders
    .map(
      (team, index) => `
        <article class="contender-card">
          <div class="contender-head">
            <span>热门 ${index + 1}</span>
            <strong>${mapTeamName(team.team)}</strong>
            <p>${formatGroupLabel(team.group)}</p>
          </div>
          <div class="contender-metrics">
            <div>
              <span>夺冠</span>
              <strong>${team.championProbability}%</strong>
            </div>
            <div>
              <span>进决赛</span>
              <strong>${team.reachFinalProbability}%</strong>
            </div>
            <div>
              <span>进四强</span>
              <strong>${team.reachSemiFinalProbability}%</strong>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSimulationNotes() {
  const notes = (state.simulation?.notes || []).map(simplifySimulationNote);
  elements.simulationNotes.innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
}

function renderTournamentView() {
  renderGroupProjection();
  renderTitleContenders();
  renderSimulationNotes();
}

function renderBacktest() {
  const backtest = state.backtest;

  if (!backtest) {
    elements.backtestStatus.textContent = "历史表现暂时不可用。";
    return;
  }

  elements.backtestStatus.textContent = `${backtest.sampleLabel} · 共 ${backtest.matchCount} 场`;
  elements.backtestMatchCount.textContent = String(backtest.matchCount);
  elements.backtestOutcomeAccuracy.textContent = `${backtest.metrics.outcomeAccuracy}%`;
  elements.backtestTop3Coverage.textContent = `${backtest.metrics.top3ScoreCoverage}%`;
  elements.backtestConfidence.textContent = `${backtest.metrics.averageConfidence}%`;
  elements.backtestBrier.textContent = String(backtest.metrics.averageBrier);
  elements.backtestLogLoss.textContent = String(backtest.metrics.averageLogLoss);

  elements.backtestSeasonBody.innerHTML = backtest.seasonBreakdown
    .map(
      (season) => `
        <tr>
          <td>
            <div class="table-team">
              <strong>${season.season}</strong>
              <span>${mapTeamName(season.hostCountry)}</span>
            </div>
          </td>
          <td>${season.matchCount}</td>
          <td>${season.outcomeAccuracy}%</td>
          <td>${season.top3ScoreCoverage}%</td>
        </tr>
      `
    )
    .join("");

  elements.backtestCalibrationBody.innerHTML = backtest.confidenceBuckets
    .map(
      (bucket) => `
        <tr>
          <td>${bucket.label}</td>
          <td>${bucket.matchCount}</td>
          <td>${bucket.averageConfidence}%</td>
          <td>${bucket.actualAccuracy}%</td>
        </tr>
      `
    )
    .join("");

  elements.backtestNotes.innerHTML = backtest.notes.map((note) => `<li>${simplifyBacktestNote(note)}</li>`).join("");
  elements.backtestSurpriseList.innerHTML = backtest.surpriseMatches
    .slice(0, 3)
    .map(
      (match) => `
        <article class="surprise-card">
          <span>${match.season} · ${translateFixtureText(match.fixture)}</span>
          <strong>${match.actualScore}</strong>
          <p>当时更看好 ${friendlyOutcome(match.predictedOutcome)}，但最后打成了冷门。</p>
          <p>这类比赛提醒我们：再强的方向也会翻车。</p>
        </article>
      `
    )
    .join("");
}

function renderUpdateSection() {
  const placeholderFixtureCount = state.fixtures.filter((fixture) => fixture.hasPlaceholderTeam).length;
  const generatedAt = formatDateTime(state.model.generatedAt);
  const feedGeneratedAt = formatDateTime(state.prematchFeed.generatedAt);
  const feedTitle = friendlyFeedTitle(state.prematchFeed.name, state.prematchFeed.mode);
  const usesLiveSignals = state.prematchFeed.mode === "hybrid-live" || state.prematchFeed.mode === "live";

  elements.updateFeedTitle.textContent = feedTitle;
  elements.updateFeedMeta.textContent = `整站结果 ${generatedAt} 更新 · 赛前消息 ${feedGeneratedAt} 更新`;
  elements.updateFeedList.innerHTML = [
    `当前一共覆盖 ${state.summary.prematchCoverageCount} 场赛前消息，其中 ${state.summary.prematchFixtureOverrideCount} 场是单场细化更新。`,
    usesLiveSignals
      ? `目前这页用的是“官方赛程快照 + 历史样本 + 实时供应商快照 + 人工兜底”的组合。`
      : `目前这页用的是“官方赛程快照 + 历史样本 + 赛前消息整理”的组合。`,
    usesLiveSignals
      ? `这版已经能吃到真实动态数据，但临近开赛前还是建议再刷一次，确认最后一轮变化。`
      : `现在还没有完全接成正式实时接口，所以临近开赛前最好再刷一次。`,
  ]
    .map((item) => `<li>${item}</li>`)
    .join("");

  elements.updateRefreshList.innerHTML = [
    "离开赛还很远时，看大方向就够了。",
    "离开赛 24 小时内，留意伤停、名单和热度变化。",
    "离开赛 90 分钟内，首发消息最值得再看一遍。",
    "如果临场变化很大，早一点看的结论可能要重估。",
  ]
    .map((item) => `<li>${item}</li>`)
    .join("");

  const gapList = [
    placeholderFixtureCount > 0
      ? `现在还有 ${placeholderFixtureCount} 场带资格赛占位队，完整名单落位后结果会再更新。`
      : null,
    usesLiveSignals ? "目前仍保留人工兜底信号，用来补足供应商暂时没给到的细节。" : "部分赛前消息仍是人工整理后接入的，不是全部自动直连。",
    "整届淘汰赛里，部分第三名落位还是近似处理。",
    "后面如果接入真实接口，这一页的临场参考价值会更高。",
  ].filter(Boolean);

  elements.updateGapList.innerHTML = gapList.map((item) => `<li>${item}</li>`).join("");
}

function updateFixture(id) {
  const visibleFixtures = getVisibleFixtures();
  const fixture = visibleFixtures.find((item) => item.id === id) || visibleFixtures[0];

  if (!fixture) {
    return;
  }

  renderSwitcher(fixture.id);
  renderFixture(fixture);
  renderTournamentView();
}

function buildFixtureAdvice(fixture) {
  const leadOutcome = fixture.outcomes[0];
  const goalLean = summarizeGoals(fixture.goals);
  const riskTone = getRiskTone(fixture);

  return `当前更偏向 ${friendlyOutcome(leadOutcome.label)}（${leadOutcome.value}%），${goalLean}。${riskTone}，更适合先看方向，再等临场消息。`;
}

function buildTechnicalNote(fixture) {
  const homeChance = fixture.outcomes[0]?.value || 0;
  const awayChance = fixture.outcomes[2]?.value || 0;
  const diff = Math.abs(homeChance - awayChance).toFixed(1);
  return `模型底稿里，这场主客两边的强弱差大约是 ${diff} 个百分点。更细的原始建模记录是：${fixture.modelDetail}。`;
}

function getConfidenceTone(fixture) {
  const score = fixture.outcomes[0]?.value || 0;

  if (score >= 60) {
    return "方向较清楚";
  }

  if (score >= 48) {
    return "可以重点看";
  }

  return "更像五五开";
}

function getRiskTone(fixture) {
  const volatility = fixture.prematch?.marketVolatility || 1;

  if (fixture.hasPlaceholderTeam || volatility >= 2.8) {
    return "风险偏高";
  }

  if (volatility >= 1.8) {
    return "临场要再看";
  }

  return "风险适中";
}

function summarizeGoals(goals) {
  const under = goals.find((item) => item.label.includes("小"));
  const bothScore = goals.find((item) => item.label.includes("双方"));

  if (under && Number.parseFloat(under.note) >= 55) {
    return "更像一场进球偏少的比赛";
  }

  if (bothScore && Number.parseFloat(bothScore.note) >= 52) {
    return "更像两边都有机会进球";
  }

  return "总进球数看起来不会特别极端";
}

function simplifyHeadline(headline) {
  return headline
    .replace("市场共振", "临场热度")
    .replace("主队进球上沿", "主队进球预期")
    .replace("模型会据此微调进球期望与风险提示。", "这会影响我们对这场的判断。")
    .replace("球队级动态显示 ", "")
    .replace("场次级动态显示 ", "");
}

function simplifyRiskText(text) {
  if (text.includes("主办国在本国城市作赛时已纳入轻微场地熟悉度加成")) {
    return "主办国在熟悉场地作赛，这点已经提前算进结果里了。";
  }

  if (text.includes("当前场次的市场摆动偏大")) {
    return "这场临场热度变化偏大，越接近开赛越值得再看一遍。";
  }

  if (text.includes("当前版本已接入本地赛前情报")) {
    return "这页已经接入一部分赛前消息，但还没完全连上真实赔率、伤停和首发接口。";
  }

  return text
    .replace("seed feed", "内部整理消息")
    .replace("场地熟悉度加成", "主场熟悉度优势")
    .replace("固化口径", "过早下结论")
    .replace("过早过早下结论", "过早下结论");
}

function simplifySimulationNote(note) {
  if (note.includes("小组赛按每场比分分布")) {
    return "小组走势是把每场比赛反复模拟后，再按积分和净胜球排出来的。";
  }

  if (note.includes("最佳第三名晋级位")) {
    return "部分第三名落位还在用近似方式处理，所以整届走势更适合看大方向。";
  }

  if (note.includes("淘汰赛若常规时间打平")) {
    return "淘汰赛如果常规时间打平，目前还是按近似方式估算谁更容易晋级。";
  }

  return note.replace("Monte Carlo", "多次模拟");
}

function simplifyBacktestNote(note) {
  if (note.includes("首版回测使用")) {
    return "这版先拿 2014、2018、2022 三届世界杯小组赛做对照，主要看看胜平负方向和常见比分有没有参考价值。";
  }

  if (note.includes("当前回测仍使用统一的静态球队强度种子")) {
    return "这版回看过去比赛时，用的是统一的球队强弱底稿，还不是按每一届赛前状态逐年重建，所以更适合当参考，不适合当业绩承诺。";
  }

  if (note.includes("Brier 为三分类均值误差")) {
    return "更专业的误差数字已经放在下方展开区，普通用户不看也不影响使用。";
  }

  return note.replace("1X2", "主胜/平/客胜").replace("Top3", "最可能的几个比分");
}

function simplifySourceLabel(label) {
  return label
    .replace("sportmonks fixtures", "Sportmonks 赛前数据")
    .replace("the odds api", "The Odds API 赔率")
    .replace("market consensus", "市场共识")
    .replace("official lineups", "官方首发")
    .replace("expected lineups", "预计首发")
    .replace("prematch news", "赛前新闻")
    .replace("sidelined", "伤停名单")
    .replace("live sync", "实时同步")
    .replace("manual desk", "人工整理")
    .replace("training brief", "赛前简报")
    .replace("local media", "本地消息")
    .replace("seed feed", "内部消息");
}

function simplifyPulseLabel(label) {
  return label
    .replace("首发确认", "首发确定度")
    .replace("市场摆动", "临场热度")
    .replace("波动等级", "变化程度");
}

function friendlyGoalLabel(label) {
  return label
    .replace("小 2.5", "3 球以下")
    .replace("大 2.5", "3 球以上")
    .replace("双方进球", "两边都有球")
    .replace(/^(\d+) 球$/, "刚好 $1 球");
}

function friendlyHalfFullLabel(label) {
  const [half, full] = label.split("/").map((item) => item.trim());
  return `${shortResultWord(half)} / ${shortResultWord(full)}`;
}

function shortResultWord(value) {
  if (value === "胜") {
    return "主";
  }

  if (value === "负") {
    return "客";
  }

  return "平";
}

function friendlyOutcome(label) {
  if (label === "主胜" || label === "胜") {
    return "主队赢";
  }

  if (label === "客胜" || label === "负") {
    return "客队赢";
  }

  return "打平";
}

function friendlyCoverageLabel(coverage) {
  if (coverage === "fixture") {
    return "这场有单独消息";
  }

  if (coverage === "team") {
    return "球队层面有消息";
  }

  return "还没叠加新消息";
}

function friendlyFeedTitle(name, mode) {
  if (mode === "hybrid-live") {
    return "真实动态信号流";
  }

  if (mode === "live") {
    return "实时赛前信号流";
  }

  if (mode === "seeded" || /seed|prematch/i.test(name || "")) {
    return "赛前消息整理流";
  }

  return name || "赛前消息整理流";
}

function formatGroupLabel(label) {
  return label.replace("Group ", "") + "组";
}

function formatFixtureLabel(homeTeam, awayTeam) {
  return `${mapTeamName(homeTeam)} 对 ${mapTeamName(awayTeam)}`;
}

function formatStageLabel(label) {
  return label === "Group Stage" ? "小组赛" : label;
}

function mapTeamName(name) {
  return teamTranslations[name] || name;
}

function mapVenueName(name) {
  const venueNames = {
    "Mexico City": "墨西哥城",
    Toronto: "多伦多",
    Vancouver: "温哥华",
    Boston: "波士顿",
    "New York New Jersey": "纽约/新泽西",
    Dallas: "达拉斯",
    Houston: "休斯顿",
    Philadelphia: "费城",
    Miami: "迈阿密",
    Atlanta: "亚特兰大",
    Seattle: "西雅图",
    "San Francisco Bay Area": "旧金山湾区",
    "Los Angeles": "洛杉矶",
    "Kansas City": "堪萨斯城",
    Guadalajara: "瓜达拉哈拉",
    Monterrey: "蒙特雷",
  };

  return venueNames[name] || name;
}

function translateFixtureText(text) {
  return Object.entries(teamTranslations)
    .reduce((result, [english, chinese]) => result.replaceAll(english, chinese), text)
    .replaceAll(" vs ", " 对 ");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

async function loadForecast() {
  try {
    bindModuleNavigation();
    const response = await fetch("./data/generated/worldcup-forecast.json");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const forecast = await response.json();
    state.model = forecast.model;
    state.summary = forecast.summary;
    state.fixtures = forecast.fixtures;
    state.groups = forecast.groups;
    state.simulation = forecast.simulation;
    state.backtest = forecast.backtest;
    state.prematchFeed = forecast.prematchFeed;
    state.sources = forecast.model.sources || [];
    state.activeGroup = forecast.groups[0]?.label || null;

    renderSummary();
    renderGroupFilter();
    renderBacktest();
    renderUpdateSection();
    updateFixture(getVisibleFixtures()[0]?.id);
    setActiveModule(resolveModuleFromHash(), { updateHash: false, scroll: false });
  } catch (error) {
    elements.dataStatus.textContent = "页面加载失败。请先运行 `npm run generate:predictions`，再用静态服务打开。";
    console.error(error);
  }
}

loadForecast();
