const elements = {
  version: document.getElementById("delivery-version"),
  generatedAt: document.getElementById("delivery-generated-at"),
  feedMeta: document.getElementById("delivery-feed-meta"),
  heroSummary: document.getElementById("delivery-hero-summary"),
  readinessScore: document.getElementById("delivery-readiness-score"),
  fixtureCount: document.getElementById("delivery-fixture-count"),
  coverageCount: document.getElementById("delivery-coverage-count"),
  gapCount: document.getElementById("delivery-gap-count"),
  status: document.getElementById("delivery-status"),
  readinessGrid: document.getElementById("readiness-grid"),
  acceptanceGrid: document.getElementById("acceptance-grid"),
  gapList: document.getElementById("delivery-gap-list"),
  nextSteps: document.getElementById("delivery-next-steps"),
  copyDeliverySummary: document.getElementById("copy-delivery-summary"),
  downloadDeliverySummary: document.getElementById("download-delivery-summary"),
};

const state = {
  forecast: null,
};

async function loadDeliveryBoard() {
  try {
    const response = await fetch("./data/generated/worldcup-forecast.json");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.forecast = await response.json();
    bindEvents();
    renderBoard();
  } catch (error) {
    elements.status.textContent = "交付看板加载失败。请先运行 `npm run generate:predictions` 并通过静态服务打开页面。";
    console.error(error);
  }
}

function bindEvents() {
  elements.copyDeliverySummary.addEventListener("click", copyDeliverySummary);
  elements.downloadDeliverySummary.addEventListener("click", downloadDeliverySummary);
}

function renderBoard() {
  const { model, summary, prematchFeed } = state.forecast;
  const generatedAt = new Date(model.generatedAt).toLocaleString("zh-CN", { hour12: false });
  const readinessChecks = buildReadinessChecks();
  const completedChecks = readinessChecks.filter((item) => item.status === "ready").length;
  const readinessScore = Math.round((completedChecks / readinessChecks.length) * 100);
  const gaps = buildGapList();
  const acceptanceSections = buildAcceptanceSections();

  elements.version.textContent = `${model.name} ${model.version}`;
  elements.generatedAt.textContent = generatedAt;
  elements.feedMeta.textContent = `${prematchFeed.name} · ${prematchFeed.coverageCount} 场覆盖`;
  elements.heroSummary.textContent =
    readinessScore >= 80 ? "适合进入客户演示与第一轮验收" : "适合内部评审，还需补强交付闭环";
  elements.readinessScore.textContent = `${readinessScore}%`;
  elements.fixtureCount.textContent = String(summary.fixtureCount);
  elements.coverageCount.textContent = String(summary.prematchCoverageCount);
  elements.gapCount.textContent = String(gaps.length);
  elements.status.textContent =
    `${completedChecks} / ${readinessChecks.length} 个关键交付项达到当前阶段目标`;

  renderReadiness(readinessChecks);
  renderAcceptance(acceptanceSections);
  renderGaps(gaps);
  renderNextSteps();
}

function buildReadinessChecks() {
  const { summary, fixtures, simulation, backtest, prematchFeed } = state.forecast;
  const hasFullPlaybook = fixtures.every(
    (fixture) =>
      fixture.outcomes?.length >= 3 &&
      fixture.scores?.length >= 3 &&
      fixture.goals?.length >= 3 &&
      fixture.halftime?.length >= 3
  );
  const hasTournamentProjection =
    simulation?.groupProjections?.length === summary.groupCount && (simulation?.titleContenders?.length || 0) >= 8;
  const hasBacktest = backtest?.matchCount >= 100;
  const hasSignalOps = prematchFeed.coverageCount >= 20 && prematchFeed.fixtureSignalCount >= 1;
  const placeholderFixtureCount = state.forecast.fixtures.filter((fixture) => fixture.hasPlaceholderTeam).length;

  return [
    {
      title: "2026 真实赛程快照",
      status: summary.fixtureCount >= 72 && summary.groupCount === 12 ? "ready" : "watch",
      detail: `${summary.groupCount} 个小组 / ${summary.fixtureCount} 场小组赛预测已接入`,
      note: "可用于客户演示世界杯专题结构与真实赛历视图。",
    },
    {
      title: "玩法输出覆盖",
      status: hasFullPlaybook ? "ready" : "watch",
      detail: "胜平负、Top3 比分、总进球、半全场均已映射",
      note: "当前适合研究型展示，不建议包装成高命中单点推荐。",
    },
    {
      title: "赛事全景模拟",
      status: hasTournamentProjection ? "ready" : "watch",
      detail: `${summary.simulationCount.toLocaleString("zh-CN")} 次模拟，含出线率与冠军概率`,
      note: "客户可以直接看到单场之外的赛事全景预测。",
    },
    {
      title: "历史回测证明",
      status: hasBacktest ? "ready" : "watch",
      detail: `${backtest.matchCount} 场样本，1X2 ${backtest.metrics.outcomeAccuracy}%`,
      note: "已具备展示价值，但仍不是最终业绩承诺口径。",
    },
    {
      title: "赛前情报运维",
      status: hasSignalOps ? "ready" : "watch",
      detail: `${prematchFeed.teamSignalCount} 支球队信号 / ${prematchFeed.fixtureSignalCount} 场覆盖`,
      note: "已能做人工录入与发布包导出，尚未连真实 API / CMS。",
    },
    {
      title: "合规边界表达",
      status: "ready",
      detail: "页面已明确只做预测分析，不做互联网售彩",
      note: "适合中国体彩合法边界内的研究型产品定位。",
    },
    {
      title: "客户交付材料",
      status: "ready",
      detail: "预测站、情报台、交付看板三页已串联",
      note: "当前可以用于售前演示、阶段验收和内部同步。",
    },
    {
      title: "资格赛占位处理",
      status: placeholderFixtureCount > 0 ? "watch" : "ready",
      detail:
        placeholderFixtureCount > 0
          ? `${placeholderFixtureCount} 场仍包含资格赛占位队`
          : "所有参赛队已落位",
      note: "这是当前最直观的真实世界未完成项之一。",
    },
  ];
}

function buildAcceptanceSections() {
  const { summary, prematchFeed, backtest, simulation } = state.forecast;

  return [
    {
      title: "前台展示",
      kicker: "Client Demo",
      items: [
        { label: "世界杯赛程与单场预测面板", status: "pass" },
        { label: "出线率、冠军概率与回测页", status: simulation?.titleContenders?.length ? "pass" : "watch" },
        { label: "合法边界与风险提示可直接展示", status: "pass" },
      ],
    },
    {
      title: "数据与模型",
      kicker: "Model & Data",
      items: [
        { label: `${summary.fixtureCount} 场 2026 小组赛预测数据`, status: summary.fixtureCount >= 72 ? "pass" : "watch" },
        { label: `${summary.simulationCount.toLocaleString("zh-CN")} 次 Monte Carlo 模拟`, status: "pass" },
        { label: `${backtest.matchCount} 场历史回测与指标`, status: backtest.matchCount >= 100 ? "pass" : "watch" },
      ],
    },
    {
      title: "运营与发布",
      kicker: "Ops Workflow",
      items: [
        { label: `${prematchFeed.coverageCount} 场赛前情报覆盖`, status: prematchFeed.coverageCount >= 20 ? "pass" : "watch" },
        { label: "情报控制台支持差异检查与发布包导出", status: "pass" },
        { label: "仍缺真实 API / 审核流 / 自动回写仓库", status: "watch" },
      ],
    },
    {
      title: "合规与风险",
      kicker: "Compliance",
      items: [
        { label: "定位为研究型预测系统，不提供网售彩", status: "pass" },
        { label: "保留模型限制、占位队与近似分配说明", status: "pass" },
        { label: "真实赔率流、伤停流和自动刷新尚未接入", status: "watch" },
      ],
    },
  ];
}

function buildGapList() {
  const { fixtures, simulation, backtest, prematchFeed } = state.forecast;
  const placeholderFixtureCount = fixtures.filter((fixture) => fixture.hasPlaceholderTeam).length;
  const gaps = [];

  if (placeholderFixtureCount > 0) {
    gaps.push(`当前仍有 ${placeholderFixtureCount} 场比赛包含资格赛占位队，完整参赛名单确认后需要重生成预测。`);
  }

  gaps.push(...(simulation?.notes || []).filter((note) => note.includes("近似") || note.includes("尚未")));
  gaps.push(...(backtest?.notes || []).filter((note) => note.includes("静态球队强度") || note.includes("MVP")));

  if (prematchFeed.coverageCount < state.forecast.summary.fixtureCount) {
    gaps.push(
      `赛前动态目前覆盖 ${prematchFeed.coverageCount} 场，小于全部 ${state.forecast.summary.fixtureCount} 场，仍依赖 seed feed 演示临场信号。`
    );
  }

  return [...new Set(gaps)];
}

function renderReadiness(checks) {
  elements.readinessGrid.innerHTML = checks
    .map(
      (check) => `
        <article class="readiness-card">
          <div class="card-head">
            <div>
              <p class="card-kicker">${statusKicker(check.status)}</p>
              <h3>${check.title}</h3>
            </div>
            <span class="badge ${statusBadgeClass(check.status)}">${statusLabel(check.status)}</span>
          </div>
          <strong class="readiness-detail">${check.detail}</strong>
          <p class="readiness-note">${check.note}</p>
        </article>
      `
    )
    .join("");
}

function renderAcceptance(sections) {
  elements.acceptanceGrid.innerHTML = sections
    .map(
      (section) => `
        <article class="acceptance-card">
          <div class="card-head">
            <div>
              <p class="card-kicker">${section.kicker}</p>
              <h3>${section.title}</h3>
            </div>
          </div>
          <ul class="check-list">
            ${section.items
              .map(
                (item) => `
                  <li class="check-item">
                    <span class="status-pill ${item.status === "pass" ? "status-pass" : "status-watch"}">${item.status === "pass" ? "通过" : "待增强"}</span>
                    <span>${item.label}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderGaps(gaps) {
  elements.gapList.innerHTML = gaps.map((item) => `<li>${item}</li>`).join("");
}

function renderNextSteps() {
  const nextSteps = [
    "把 prematch seed feed 升级成真实 API / CMS，并补审核流与发布权限。",
    "在完整参赛名单确认后重跑 2026 赛程与冠军概率，消除资格赛占位队影响。",
    "补按届重建的历史 Elo / 阵容快照回测，替代当前静态球队强度回放。",
    "视客户预算决定是否接赔率流、伤停流和自动刷新监控。",
  ];

  elements.nextSteps.innerHTML = nextSteps.map((item) => `<li>${item}</li>`).join("");
}

function buildDeliverySummaryText() {
  const readinessChecks = buildReadinessChecks();
  const acceptanceSections = buildAcceptanceSections();
  const gaps = buildGapList();
  const completedChecks = readinessChecks.filter((item) => item.status === "ready").length;
  const readinessScore = Math.round((completedChecks / readinessChecks.length) * 100);
  const { model, summary, prematchFeed, backtest } = state.forecast;

  const lines = [
    "# 世界杯预测项目交付摘要",
    "",
    `版本：${model.name} ${model.version}`,
    `生成时间：${model.generatedAt}`,
    `整体就绪度：${readinessScore}%（${completedChecks}/${readinessChecks.length}）`,
    `预测场次：${summary.fixtureCount}`,
    `情报覆盖：${summary.prematchCoverageCount}`,
    `历史回测：${backtest.matchCount} 场，1X2 ${backtest.metrics.outcomeAccuracy}%`,
    "",
    "## 当前已具备",
  ];

  readinessChecks
    .filter((item) => item.status === "ready")
    .forEach((item) => {
      lines.push(`- ${item.title}：${item.detail}`);
    });

  lines.push("", "## 验收关注", ...acceptanceSections.flatMap((section) => [`- ${section.title}：${section.items.map((item) => item.label).join("；")}`]));
  lines.push("", "## 待增强项");

  gaps.forEach((gap) => {
    lines.push(`- ${gap}`);
  });

  lines.push("", "## 交付入口");
  lines.push("- 预测站：./");
  lines.push("- 情报控制台：./signal-console.html");
  lines.push("- 数据 JSON：./data/generated/worldcup-forecast.json");
  lines.push("", `情报 feed：${prematchFeed.name} / ${prematchFeed.mode} / ${prematchFeed.generatedAt}`);

  return `${lines.join("\n")}\n`;
}

async function copyDeliverySummary() {
  try {
    await navigator.clipboard.writeText(buildDeliverySummaryText());
    elements.status.textContent = "交付摘要已复制到剪贴板。";
  } catch (error) {
    console.error(error);
    elements.status.textContent = "复制失败，请改用下载摘要。";
  }
}

function downloadDeliverySummary() {
  const blob = new Blob([buildDeliverySummaryText()], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "worldcup-delivery-summary.md";
  link.click();
  URL.revokeObjectURL(url);
  elements.status.textContent = "交付摘要已下载。";
}

function statusKicker(status) {
  return status === "ready" ? "READY NOW" : "WATCH ITEM";
}

function statusLabel(status) {
  return status === "ready" ? "已就绪" : "待增强";
}

function statusBadgeClass(status) {
  return status === "ready" ? "badge-clean" : "badge-dirty";
}

loadDeliveryBoard();
