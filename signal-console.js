const elements = {
  status: document.getElementById("console-status"),
  teamSignalCount: document.getElementById("console-team-signal-count"),
  fixtureSignalCount: document.getElementById("console-fixture-signal-count"),
  coverageCount: document.getElementById("console-coverage-count"),
  validationCount: document.getElementById("console-validation-count"),
  validationList: document.getElementById("validation-list"),
  feedName: document.getElementById("feed-name"),
  feedMode: document.getElementById("feed-mode"),
  feedGeneratedAt: document.getElementById("feed-generated-at"),
  feedDescription: document.getElementById("feed-description"),
  defaultLineupConfidence: document.getElementById("default-lineup-confidence"),
  defaultFreshnessHours: document.getElementById("default-freshness-hours"),
  defaultMarketVolatility: document.getElementById("default-market-volatility"),
  defaultSourceLabels: document.getElementById("default-source-labels"),
  teamSelect: document.getElementById("team-select"),
  teamLastUpdated: document.getElementById("team-last-updated"),
  teamLineupConfidence: document.getElementById("team-lineup-confidence"),
  teamAttackDelta: document.getElementById("team-attack-delta"),
  teamDefenseDelta: document.getElementById("team-defense-delta"),
  teamMarketSentiment: document.getElementById("team-market-sentiment"),
  teamAlerts: document.getElementById("team-alerts"),
  teamSourceLabels: document.getElementById("team-source-labels"),
  fixtureGroupFilter: document.getElementById("fixture-group-filter"),
  fixtureSelect: document.getElementById("fixture-select"),
  fixtureHeadline: document.getElementById("fixture-headline"),
  fixtureLastUpdated: document.getElementById("fixture-last-updated"),
  fixtureHomeLineupConfidence: document.getElementById("fixture-home-lineup-confidence"),
  fixtureAwayLineupConfidence: document.getElementById("fixture-away-lineup-confidence"),
  fixtureHomeLambdaDelta: document.getElementById("fixture-home-lambda-delta"),
  fixtureAwayLambdaDelta: document.getElementById("fixture-away-lambda-delta"),
  fixtureMarketHomeShift: document.getElementById("fixture-market-home-shift"),
  fixtureMarketVolatility: document.getElementById("fixture-market-volatility"),
  fixtureAlerts: document.getElementById("fixture-alerts"),
  fixtureSourceLabels: document.getElementById("fixture-source-labels"),
  downloadFeed: document.getElementById("download-feed"),
  copyFeed: document.getElementById("copy-feed"),
  resetFeed: document.getElementById("reset-feed"),
  importFeed: document.getElementById("import-feed"),
  clearTeamSignal: document.getElementById("clear-team-signal"),
  clearFixtureSignal: document.getElementById("clear-fixture-signal"),
  draftStatusBadge: document.getElementById("draft-status-badge"),
  draftChangeCount: document.getElementById("draft-change-count"),
  draftFeedChangeCount: document.getElementById("draft-feed-change-count"),
  draftTeamChangeCount: document.getElementById("draft-team-change-count"),
  draftFixtureChangeCount: document.getElementById("draft-fixture-change-count"),
  draftBaselineMeta: document.getElementById("draft-baseline-meta"),
  draftSummaryList: document.getElementById("draft-summary-list"),
  releaseNotePreview: document.getElementById("release-note-preview"),
  copyReleaseNote: document.getElementById("copy-release-note"),
  downloadReleaseNote: document.getElementById("download-release-note"),
  downloadPublishPackage: document.getElementById("download-publish-package"),
  previewTitle: document.getElementById("preview-title"),
  previewCoverage: document.getElementById("preview-coverage"),
  previewHeadline: document.getElementById("preview-headline"),
  previewMeta: document.getElementById("preview-meta"),
  previewTagGrid: document.getElementById("preview-tag-grid"),
  previewAlerts: document.getElementById("preview-alerts"),
  previewSources: document.getElementById("preview-sources"),
};

const state = {
  teams: [],
  fixtures: [],
  baselineSignals: null,
  signals: null,
  selectedTeam: null,
  selectedGroup: null,
  selectedFixtureKey: null,
};

const feedFieldDefs = [
  { key: "name", label: "Feed 名称", type: "text" },
  { key: "mode", label: "Feed 模式", type: "text" },
  { key: "generatedAt", label: "Feed 生成时间", type: "text" },
  { key: "description", label: "Feed 描述", type: "text" },
];

const defaultFieldDefs = [
  { key: "lineupConfidence", label: "默认首发确认", type: "number" },
  { key: "freshnessHours", label: "默认新鲜度小时", type: "number" },
  { key: "marketVolatility", label: "默认波动等级值", type: "number" },
  { key: "sourceLabels", label: "默认来源标签", type: "array" },
];

const teamFieldDefs = [
  { key: "lastUpdated", label: "更新时间", type: "text" },
  { key: "lineupConfidence", label: "首发确认度", type: "number" },
  { key: "attackDelta", label: "进攻修正", type: "number" },
  { key: "defenseDelta", label: "防守修正", type: "number" },
  { key: "marketSentiment", label: "市场情绪", type: "number" },
  { key: "alerts", label: "情报提示", type: "array" },
  { key: "sourceLabels", label: "来源标签", type: "array" },
];

const fixtureFieldDefs = [
  { key: "headline", label: "Headline", type: "text" },
  { key: "lastUpdated", label: "更新时间", type: "text" },
  { key: "homeLineupConfidence", label: "主队首发确认", type: "number" },
  { key: "awayLineupConfidence", label: "客队首发确认", type: "number" },
  { key: "homeLambdaDelta", label: "主队 xG 修正", type: "number" },
  { key: "awayLambdaDelta", label: "客队 xG 修正", type: "number" },
  { key: "marketHomeShift", label: "市场偏移", type: "number" },
  { key: "marketVolatility", label: "波动值", type: "number" },
  { key: "alerts", label: "情报提示", type: "array" },
  { key: "sourceLabels", label: "来源标签", type: "array" },
];

async function loadConsole() {
  try {
    const [teamsResponse, forecastResponse, signalsResponse] = await Promise.all([
      fetch("./data/source/teams.json"),
      fetch("./data/generated/worldcup-forecast.json"),
      fetch("./data/source/prematch-signals.json"),
    ]);

    if (!teamsResponse.ok || !forecastResponse.ok || !signalsResponse.ok) {
      throw new Error("Resource load failed.");
    }

    state.teams = await teamsResponse.json();
    const forecast = await forecastResponse.json();
    state.fixtures = forecast.fixtures;
    state.baselineSignals = normalizeSignalDocument(await signalsResponse.json());
    state.signals = cloneSignals(state.baselineSignals);
    state.selectedTeam = state.teams[0]?.name || null;
    state.selectedGroup = forecast.groups[0]?.label || null;
    state.selectedFixtureKey = createFixtureKey(getVisibleFixtures()[0]);

    bindEvents();
    renderAll();
  } catch (error) {
    elements.status.textContent = "控制台加载失败。请先确保静态站点和数据文件可访问。";
    console.error(error);
  }
}

function bindEvents() {
  [
    elements.feedName,
    elements.feedMode,
    elements.feedGeneratedAt,
    elements.feedDescription,
    elements.defaultLineupConfidence,
    elements.defaultFreshnessHours,
    elements.defaultMarketVolatility,
    elements.defaultSourceLabels,
  ].forEach((element) => element.addEventListener("input", updateFeedForm));

  [
    elements.teamLastUpdated,
    elements.teamLineupConfidence,
    elements.teamAttackDelta,
    elements.teamDefenseDelta,
    elements.teamMarketSentiment,
    elements.teamAlerts,
    elements.teamSourceLabels,
  ].forEach((element) => element.addEventListener("input", updateTeamForm));

  [
    elements.fixtureHeadline,
    elements.fixtureLastUpdated,
    elements.fixtureHomeLineupConfidence,
    elements.fixtureAwayLineupConfidence,
    elements.fixtureHomeLambdaDelta,
    elements.fixtureAwayLambdaDelta,
    elements.fixtureMarketHomeShift,
    elements.fixtureMarketVolatility,
    elements.fixtureAlerts,
    elements.fixtureSourceLabels,
  ].forEach((element) => element.addEventListener("input", updateFixtureForm));

  elements.teamSelect.addEventListener("change", () => {
    state.selectedTeam = elements.teamSelect.value;
    renderTeamForm();
    renderDirtyState();
  });

  elements.fixtureGroupFilter.addEventListener("change", () => {
    state.selectedGroup = elements.fixtureGroupFilter.value;
    const nextFixture = getVisibleFixtures()[0];
    state.selectedFixtureKey = createFixtureKey(nextFixture);
    renderFixtureOptions();
    renderFixtureForm();
    renderPreview();
    renderDirtyState();
  });

  elements.fixtureSelect.addEventListener("change", () => {
    state.selectedFixtureKey = elements.fixtureSelect.value;
    renderFixtureForm();
    renderPreview();
    renderDirtyState();
  });

  elements.clearTeamSignal.addEventListener("click", () => {
    delete state.signals.teamSignals[state.selectedTeam];
    renderAll();
  });

  elements.clearFixtureSignal.addEventListener("click", () => {
    state.signals.fixtureSignals = state.signals.fixtureSignals.filter(
      (signal) => createFixtureKey(signal) !== state.selectedFixtureKey
    );
    renderAll();
  });

  elements.resetFeed.addEventListener("click", () => {
    state.signals = cloneSignals(state.baselineSignals);
    renderAll();
  });

  elements.downloadFeed.addEventListener("click", downloadSignals);
  elements.copyFeed.addEventListener("click", copySignals);
  elements.copyReleaseNote.addEventListener("click", copyReleaseNote);
  elements.downloadReleaseNote.addEventListener("click", downloadReleaseNote);
  elements.downloadPublishPackage.addEventListener("click", downloadPublishPackage);
  elements.importFeed.addEventListener("change", importSignals);
}

function renderAll() {
  renderFeedForm();
  renderTeamOptions();
  renderTeamForm();
  renderGroupOptions();
  renderFixtureOptions();
  renderFixtureForm();
  renderWorkingState();
}

function renderWorkingState() {
  renderStatus();
  renderStats();
  renderValidation();
  renderDraftSummary();
  renderPreview();
  renderDirtyState();
}

function renderStatus() {
  const validation = validateSignals(state.signals);
  const draft = buildDraftSummary();
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  elements.status.textContent =
    `${state.signals.feed.name} · ${state.signals.feed.mode} · ${timestamp} 打开 · 草稿 ${draft.totalChangeCount} 项变更 · ${validation.errors.length} 个错误 / ${validation.warnings.length} 个提醒`;
}

function renderStats() {
  const validation = validateSignals(state.signals);
  elements.teamSignalCount.textContent = String(Object.keys(state.signals.teamSignals).length);
  elements.fixtureSignalCount.textContent = String(state.signals.fixtureSignals.length);
  elements.coverageCount.textContent = String(computeCoverageCount(state.signals));
  elements.validationCount.textContent = String(validation.errors.length + validation.warnings.length);
}

function renderFeedForm() {
  elements.feedName.value = state.signals.feed.name || "";
  elements.feedMode.value = state.signals.feed.mode || "";
  elements.feedGeneratedAt.value = state.signals.feed.generatedAt || "";
  elements.feedDescription.value = state.signals.feed.description || "";
  elements.defaultLineupConfidence.value = state.signals.defaults.lineupConfidence ?? "";
  elements.defaultFreshnessHours.value = state.signals.defaults.freshnessHours ?? "";
  elements.defaultMarketVolatility.value = state.signals.defaults.marketVolatility ?? "";
  elements.defaultSourceLabels.value = (state.signals.defaults.sourceLabels || []).join(", ");
}

function renderTeamOptions() {
  elements.teamSelect.innerHTML = state.teams
    .map((team) => `<option value="${team.name}">${team.name}</option>`)
    .join("");
  elements.teamSelect.value = state.selectedTeam;
}

function renderTeamForm() {
  const signal = state.signals.teamSignals[state.selectedTeam] || {};
  elements.teamLastUpdated.value = signal.lastUpdated || "";
  elements.teamLineupConfidence.value = signal.lineupConfidence ?? "";
  elements.teamAttackDelta.value = signal.attackDelta ?? "";
  elements.teamDefenseDelta.value = signal.defenseDelta ?? "";
  elements.teamMarketSentiment.value = signal.marketSentiment ?? "";
  elements.teamAlerts.value = (signal.alerts || []).join("\n");
  elements.teamSourceLabels.value = (signal.sourceLabels || []).join(", ");
}

function renderGroupOptions() {
  const groups = [...new Set(state.fixtures.map((fixture) => fixture.group))];
  elements.fixtureGroupFilter.innerHTML = groups.map((group) => `<option value="${group}">${group}</option>`).join("");
  elements.fixtureGroupFilter.value = state.selectedGroup;
}

function renderFixtureOptions() {
  const fixtures = getVisibleFixtures();
  elements.fixtureSelect.innerHTML = fixtures
    .map(
      (fixture) =>
        `<option value="${createFixtureKey(fixture)}">${fixture.date} · ${fixture.homeTeam} vs ${fixture.awayTeam}</option>`
    )
    .join("");

  if (!fixtures.some((fixture) => createFixtureKey(fixture) === state.selectedFixtureKey)) {
    state.selectedFixtureKey = createFixtureKey(fixtures[0]);
  }

  elements.fixtureSelect.value = state.selectedFixtureKey;
}

function renderFixtureForm() {
  const signal = getSelectedFixtureSignal() || {};
  elements.fixtureHeadline.value = signal.headline || "";
  elements.fixtureLastUpdated.value = signal.lastUpdated || "";
  elements.fixtureHomeLineupConfidence.value = signal.homeLineupConfidence ?? "";
  elements.fixtureAwayLineupConfidence.value = signal.awayLineupConfidence ?? "";
  elements.fixtureHomeLambdaDelta.value = signal.homeLambdaDelta ?? "";
  elements.fixtureAwayLambdaDelta.value = signal.awayLambdaDelta ?? "";
  elements.fixtureMarketHomeShift.value = signal.marketHomeShift ?? "";
  elements.fixtureMarketVolatility.value = signal.marketVolatility ?? "";
  elements.fixtureAlerts.value = (signal.alerts || []).join("\n");
  elements.fixtureSourceLabels.value = (signal.sourceLabels || []).join(", ");
}

function renderValidation() {
  const validation = validateSignals(state.signals);
  const lines = [
    ...validation.errors.map((entry) => ({ level: "错误", text: entry })),
    ...validation.warnings.map((entry) => ({ level: "提醒", text: entry })),
  ];

  elements.validationList.innerHTML =
    lines.length === 0
      ? "<li>当前 feed 结构校验通过，可以直接导出。</li>"
      : lines.map((line) => `<li><strong>${line.level}</strong>：${line.text}</li>`).join("");
}

function renderDraftSummary() {
  const draft = buildDraftSummary();
  const baselineTeamCount = Object.keys(state.baselineSignals.teamSignals || {}).length;
  const baselineFixtureCount = (state.baselineSignals.fixtureSignals || []).length;

  elements.draftStatusBadge.textContent = draft.isDirty ? "有草稿改动" : "未改动";
  elements.draftStatusBadge.classList.toggle("badge-dirty", draft.isDirty);
  elements.draftStatusBadge.classList.toggle("badge-clean", !draft.isDirty);
  elements.draftChangeCount.textContent = String(draft.totalChangeCount);
  elements.draftFeedChangeCount.textContent = String(draft.feedChangeCount);
  elements.draftTeamChangeCount.textContent = String(draft.teamChangeCount);
  elements.draftFixtureChangeCount.textContent = String(draft.fixtureChangeCount);
  elements.draftBaselineMeta.textContent =
    `${state.baselineSignals.feed.name} · ${state.baselineSignals.feed.mode} · ${state.baselineSignals.feed.generatedAt || "未设置生成时间"} · ${baselineTeamCount} 支球队信号 / ${baselineFixtureCount} 场覆盖`;
  elements.draftSummaryList.innerHTML = draft.summaryLines.map((line) => `<li>${line}</li>`).join("");
  elements.releaseNotePreview.value = draft.releaseNote;
}

function renderPreview() {
  const fixture = getSelectedFixture();

  if (!fixture) {
    return;
  }

  const signal = buildEffectiveSignal(fixture, state.signals);
  elements.previewTitle.textContent = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  elements.previewCoverage.textContent = signal.coverageLabel;
  elements.previewHeadline.textContent = signal.headline;
  elements.previewMeta.textContent =
    `${fixture.group} · ${fixture.date} · 更新 ${signal.lastUpdated || "未设置"} · 新鲜度 ${signal.freshnessHours}h`;
  elements.previewTagGrid.innerHTML = signal.pulseTags
    .map(
      (item) => `
        <article class="tag">
          <strong>${item.label}</strong>
          <span>${item.note}</span>
        </article>
      `
    )
    .join("");
  elements.previewAlerts.innerHTML = signal.alerts.map((alert) => `<li>${alert}</li>`).join("");
  elements.previewSources.innerHTML = signal.sourceLabels
    .map((label) => `<span class="source-chip">${label}</span>`)
    .join("");
}

function renderDirtyState() {
  const baselineTeamSignal = state.baselineSignals.teamSignals[state.selectedTeam] || {};
  const baselineFixtureSignal = getBaselineFixtureSignal();

  toggleFieldDirty(elements.feedName, readComparableText(state.baselineSignals.feed.name), elements.feedName.value, "text");
  toggleFieldDirty(elements.feedMode, readComparableText(state.baselineSignals.feed.mode), elements.feedMode.value, "text");
  toggleFieldDirty(
    elements.feedGeneratedAt,
    readComparableText(state.baselineSignals.feed.generatedAt),
    elements.feedGeneratedAt.value,
    "text"
  );
  toggleFieldDirty(
    elements.feedDescription,
    readComparableText(state.baselineSignals.feed.description),
    elements.feedDescription.value,
    "text"
  );
  toggleFieldDirty(
    elements.defaultLineupConfidence,
    readComparableNumber(state.baselineSignals.defaults.lineupConfidence),
    elements.defaultLineupConfidence.value,
    "number"
  );
  toggleFieldDirty(
    elements.defaultFreshnessHours,
    readComparableNumber(state.baselineSignals.defaults.freshnessHours),
    elements.defaultFreshnessHours.value,
    "number"
  );
  toggleFieldDirty(
    elements.defaultMarketVolatility,
    readComparableNumber(state.baselineSignals.defaults.marketVolatility),
    elements.defaultMarketVolatility.value,
    "number"
  );
  toggleFieldDirty(
    elements.defaultSourceLabels,
    readComparableArray(state.baselineSignals.defaults.sourceLabels),
    elements.defaultSourceLabels.value,
    "array"
  );

  toggleFieldDirty(
    elements.teamLastUpdated,
    readComparableText(baselineTeamSignal.lastUpdated),
    elements.teamLastUpdated.value,
    "text"
  );
  toggleFieldDirty(
    elements.teamLineupConfidence,
    readComparableNumber(baselineTeamSignal.lineupConfidence),
    elements.teamLineupConfidence.value,
    "number"
  );
  toggleFieldDirty(
    elements.teamAttackDelta,
    readComparableNumber(baselineTeamSignal.attackDelta),
    elements.teamAttackDelta.value,
    "number"
  );
  toggleFieldDirty(
    elements.teamDefenseDelta,
    readComparableNumber(baselineTeamSignal.defenseDelta),
    elements.teamDefenseDelta.value,
    "number"
  );
  toggleFieldDirty(
    elements.teamMarketSentiment,
    readComparableNumber(baselineTeamSignal.marketSentiment),
    elements.teamMarketSentiment.value,
    "number"
  );
  toggleFieldDirty(elements.teamAlerts, readComparableArray(baselineTeamSignal.alerts, "\n"), elements.teamAlerts.value, "line-array");
  toggleFieldDirty(
    elements.teamSourceLabels,
    readComparableArray(baselineTeamSignal.sourceLabels),
    elements.teamSourceLabels.value,
    "array"
  );

  toggleFieldDirty(
    elements.fixtureHeadline,
    readComparableText(baselineFixtureSignal.headline),
    elements.fixtureHeadline.value,
    "text"
  );
  toggleFieldDirty(
    elements.fixtureLastUpdated,
    readComparableText(baselineFixtureSignal.lastUpdated),
    elements.fixtureLastUpdated.value,
    "text"
  );
  toggleFieldDirty(
    elements.fixtureHomeLineupConfidence,
    readComparableNumber(baselineFixtureSignal.homeLineupConfidence),
    elements.fixtureHomeLineupConfidence.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureAwayLineupConfidence,
    readComparableNumber(baselineFixtureSignal.awayLineupConfidence),
    elements.fixtureAwayLineupConfidence.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureHomeLambdaDelta,
    readComparableNumber(baselineFixtureSignal.homeLambdaDelta),
    elements.fixtureHomeLambdaDelta.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureAwayLambdaDelta,
    readComparableNumber(baselineFixtureSignal.awayLambdaDelta),
    elements.fixtureAwayLambdaDelta.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureMarketHomeShift,
    readComparableNumber(baselineFixtureSignal.marketHomeShift),
    elements.fixtureMarketHomeShift.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureMarketVolatility,
    readComparableNumber(baselineFixtureSignal.marketVolatility),
    elements.fixtureMarketVolatility.value,
    "number"
  );
  toggleFieldDirty(
    elements.fixtureAlerts,
    readComparableArray(baselineFixtureSignal.alerts, "\n"),
    elements.fixtureAlerts.value,
    "line-array"
  );
  toggleFieldDirty(
    elements.fixtureSourceLabels,
    readComparableArray(baselineFixtureSignal.sourceLabels),
    elements.fixtureSourceLabels.value,
    "array"
  );
}

function updateFeedForm() {
  state.signals.feed.name = elements.feedName.value.trim();
  state.signals.feed.mode = elements.feedMode.value.trim();
  state.signals.feed.generatedAt = elements.feedGeneratedAt.value.trim();
  state.signals.feed.description = elements.feedDescription.value.trim();
  state.signals.defaults.lineupConfidence = readNumber(elements.defaultLineupConfidence.value);
  state.signals.defaults.freshnessHours = readNumber(elements.defaultFreshnessHours.value);
  state.signals.defaults.marketVolatility = readNumber(elements.defaultMarketVolatility.value);
  state.signals.defaults.sourceLabels = parseCommaList(elements.defaultSourceLabels.value);
  renderWorkingState();
}

function updateTeamForm() {
  const signal = getOrCreateTeamSignal(state.selectedTeam);
  signal.lastUpdated = elements.teamLastUpdated.value.trim();
  applyNumberField(signal, "lineupConfidence", elements.teamLineupConfidence.value);
  applyNumberField(signal, "attackDelta", elements.teamAttackDelta.value);
  applyNumberField(signal, "defenseDelta", elements.teamDefenseDelta.value);
  applyNumberField(signal, "marketSentiment", elements.teamMarketSentiment.value);
  signal.alerts = parseLineList(elements.teamAlerts.value);
  signal.sourceLabels = parseCommaList(elements.teamSourceLabels.value);
  pruneEmptySignal(signal, ["lastUpdated", "alerts", "sourceLabels"]);

  if (Object.keys(signal).length === 0) {
    delete state.signals.teamSignals[state.selectedTeam];
  }

  renderWorkingState();
}

function updateFixtureForm() {
  const fixture = getSelectedFixture();

  if (!fixture) {
    return;
  }

  const signal = getOrCreateFixtureSignal(fixture);
  signal.date = fixture.date;
  signal.homeTeam = fixture.homeTeam;
  signal.awayTeam = fixture.awayTeam;
  signal.headline = elements.fixtureHeadline.value.trim();
  signal.lastUpdated = elements.fixtureLastUpdated.value.trim();
  applyNumberField(signal, "homeLineupConfidence", elements.fixtureHomeLineupConfidence.value);
  applyNumberField(signal, "awayLineupConfidence", elements.fixtureAwayLineupConfidence.value);
  applyNumberField(signal, "homeLambdaDelta", elements.fixtureHomeLambdaDelta.value);
  applyNumberField(signal, "awayLambdaDelta", elements.fixtureAwayLambdaDelta.value);
  applyNumberField(signal, "marketHomeShift", elements.fixtureMarketHomeShift.value);
  applyNumberField(signal, "marketVolatility", elements.fixtureMarketVolatility.value);
  signal.alerts = parseLineList(elements.fixtureAlerts.value);
  signal.sourceLabels = parseCommaList(elements.fixtureSourceLabels.value);
  pruneEmptySignal(signal, ["headline", "lastUpdated", "alerts", "sourceLabels"]);

  if (Object.keys(signal).length <= 3) {
    state.signals.fixtureSignals = state.signals.fixtureSignals.filter(
      (item) => createFixtureKey(item) !== createFixtureKey(fixture)
    );
  }

  renderWorkingState();
}

function getVisibleFixtures() {
  return state.fixtures.filter((fixture) => fixture.group === state.selectedGroup);
}

function getSelectedFixture() {
  return state.fixtures.find((fixture) => createFixtureKey(fixture) === state.selectedFixtureKey) || null;
}

function getSelectedFixtureSignal() {
  return state.signals.fixtureSignals.find((signal) => createFixtureKey(signal) === state.selectedFixtureKey) || null;
}

function getBaselineFixtureSignal() {
  return state.baselineSignals.fixtureSignals.find((signal) => createFixtureKey(signal) === state.selectedFixtureKey) || {};
}

function getOrCreateTeamSignal(teamName) {
  if (!state.signals.teamSignals[teamName]) {
    state.signals.teamSignals[teamName] = {};
  }

  return state.signals.teamSignals[teamName];
}

function getOrCreateFixtureSignal(fixture) {
  const existing = getSelectedFixtureSignal();

  if (existing) {
    return existing;
  }

  const created = {
    date: fixture.date,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
  };
  state.signals.fixtureSignals.push(created);
  return created;
}

function buildEffectiveSignal(fixture, signals) {
  const defaults = signals.defaults || {};
  const fixtureSignal = signals.fixtureSignals.find((signal) => createFixtureKey(signal) === createFixtureKey(fixture)) || {};
  const homeTeamSignal = signals.teamSignals[fixture.homeTeam] || {};
  const awayTeamSignal = signals.teamSignals[fixture.awayTeam] || {};
  const coverage = fixtureSignal.homeTeam
    ? "fixture"
    : Object.keys(homeTeamSignal).length || Object.keys(awayTeamSignal).length
      ? "team"
      : "default";
  const homeLineup = fixtureSignal.homeLineupConfidence ?? homeTeamSignal.lineupConfidence ?? defaults.lineupConfidence ?? 74;
  const awayLineup = fixtureSignal.awayLineupConfidence ?? awayTeamSignal.lineupConfidence ?? defaults.lineupConfidence ?? 74;
  const marketHomeShift =
    fixtureSignal.marketHomeShift ??
    (((homeTeamSignal.marketSentiment || 0) - (awayTeamSignal.marketSentiment || 0)) * 4).toFixed(1);
  const marketVolatility = fixtureSignal.marketVolatility ?? defaults.marketVolatility ?? 1.2;
  const lastUpdated =
    fixtureSignal.lastUpdated || homeTeamSignal.lastUpdated || awayTeamSignal.lastUpdated || signals.feed.generatedAt;

  return {
    coverageLabel: coverage === "fixture" ? "场次级动态" : coverage === "team" ? "球队级动态" : "基础种子",
    headline:
      fixtureSignal.headline ||
      (coverage === "default"
        ? "当前没有额外临场覆盖，只会使用基础默认值。"
        : "当前场次会叠加球队级情报信号。"),
    lastUpdated,
    freshnessHours: computeFreshnessHours(lastUpdated, defaults.freshnessHours || 18),
    pulseTags: [
      { label: `${fixture.homeTeam} 首发确认`, note: `${homeLineup}%` },
      { label: `${fixture.awayTeam} 首发确认`, note: `${awayLineup}%` },
      { label: "市场摆动", note: `${formatSigned(marketHomeShift)}pt` },
      { label: "波动等级", note: volatilityLabel(marketVolatility) },
    ],
    alerts: unique([
      ...(fixtureSignal.alerts || []),
      ...(homeTeamSignal.alerts || []).map((alert) => `${fixture.homeTeam}：${alert}`),
      ...(awayTeamSignal.alerts || []).map((alert) => `${fixture.awayTeam}：${alert}`),
    ]).slice(0, 5),
    sourceLabels: unique([
      ...(defaults.sourceLabels || []),
      ...(homeTeamSignal.sourceLabels || []),
      ...(awayTeamSignal.sourceLabels || []),
      ...(fixtureSignal.sourceLabels || []),
    ]).slice(0, 5),
  };
}

function validateSignals(signals) {
  const errors = [];
  const warnings = [];
  const teamNames = new Set(state.teams.map((team) => team.name));
  const fixtureKeys = new Set(state.fixtures.map(createFixtureKey));

  if (!signals.feed.name?.trim()) {
    errors.push("Feed 名称不能为空。");
  }

  if (!signals.feed.mode?.trim()) {
    errors.push("Feed 模式不能为空。");
  }

  if (!signals.feed.generatedAt?.trim()) {
    errors.push("Feed 生成时间不能为空。");
  }

  if (!signals.feed.description?.trim()) {
    warnings.push("Feed 描述为空，交付说明会偏弱。");
  }

  if (!isFiniteNumber(signals.defaults.lineupConfidence, 0, 100)) {
    errors.push("默认首发确认度必须在 0 到 100 之间。");
  }

  Object.entries(signals.teamSignals).forEach(([teamName, signal]) => {
    if (!teamNames.has(teamName)) {
      errors.push(`未知球队信号：${teamName}`);
    }

    if (signal.lineupConfidence !== undefined && !isFiniteNumber(signal.lineupConfidence, 0, 100)) {
      errors.push(`${teamName} 的首发确认度超出范围。`);
    }
  });

  const seenFixtureKeys = new Set();
  signals.fixtureSignals.forEach((signal) => {
    const key = createFixtureKey(signal);

    if (!fixtureKeys.has(key)) {
      errors.push(`场次覆盖未命中真实赛程：${key}`);
    }

    if (seenFixtureKeys.has(key)) {
      errors.push(`场次覆盖重复：${key}`);
    }

    seenFixtureKeys.add(key);

    if (!signal.headline?.trim()) {
      warnings.push(`场次 ${signal.homeTeam} vs ${signal.awayTeam} 缺少 headline。`);
    }
  });

  return { errors, warnings };
}

function buildDraftSummary() {
  const baseline = state.baselineSignals;
  const current = state.signals;
  const feedChanges = [
    ...collectFieldChanges(baseline.feed || {}, current.feed || {}, feedFieldDefs),
    ...collectFieldChanges(baseline.defaults || {}, current.defaults || {}, defaultFieldDefs),
  ];
  const teamDiffs = collectEntityDiffs(
    baseline.teamSignals || {},
    current.teamSignals || {},
    teamFieldDefs,
    "team"
  );
  const fixtureDiffs = collectFixtureDiffs();
  const totalChangeCount =
    feedChanges.length +
    teamDiffs.reduce((sum, item) => sum + item.fields.length, 0) +
    fixtureDiffs.reduce((sum, item) => sum + item.fields.length, 0);
  const addedTeams = teamDiffs.filter((item) => item.changeType === "added").length;
  const removedTeams = teamDiffs.filter((item) => item.changeType === "removed").length;
  const addedFixtures = fixtureDiffs.filter((item) => item.changeType === "added").length;
  const removedFixtures = fixtureDiffs.filter((item) => item.changeType === "removed").length;

  return {
    isDirty: totalChangeCount > 0,
    totalChangeCount,
    feedChangeCount: feedChanges.length,
    teamChangeCount: teamDiffs.length,
    fixtureChangeCount: fixtureDiffs.length,
    summaryLines: buildSummaryLines({
      totalChangeCount,
      feedChanges,
      teamDiffs,
      fixtureDiffs,
      addedTeams,
      removedTeams,
      addedFixtures,
      removedFixtures,
    }),
    releaseNote: buildReleaseNote({
      feedChanges,
      teamDiffs,
      fixtureDiffs,
      totalChangeCount,
    }),
    feedChanges,
    teamDiffs,
    fixtureDiffs,
  };
}

function collectEntityDiffs(baselineMap, currentMap, fieldDefs, scopeType) {
  return unique([...Object.keys(baselineMap), ...Object.keys(currentMap)])
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((entityName) => {
      const before = baselineMap[entityName];
      const after = currentMap[entityName];
      const fields = collectFieldChanges(before || {}, after || {}, fieldDefs);

      if (fields.length === 0) {
        return null;
      }

      return {
        scopeType,
        entityKey: entityName,
        entityLabel: entityName,
        changeType: resolveEntityChangeType(before, after),
        fields,
      };
    })
    .filter(Boolean);
}

function collectFixtureDiffs() {
  const baselineMap = new Map((state.baselineSignals.fixtureSignals || []).map((signal) => [createFixtureKey(signal), signal]));
  const currentMap = new Map((state.signals.fixtureSignals || []).map((signal) => [createFixtureKey(signal), signal]));

  return unique([...baselineMap.keys(), ...currentMap.keys()])
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((fixtureKey) => {
      const before = baselineMap.get(fixtureKey);
      const after = currentMap.get(fixtureKey);
      const fields = collectFieldChanges(before || {}, after || {}, fixtureFieldDefs);

      if (fields.length === 0) {
        return null;
      }

      return {
        scopeType: "fixture",
        entityKey: fixtureKey,
        entityLabel: formatFixtureLabel(after || before),
        changeType: resolveEntityChangeType(before, after),
        fields,
      };
    })
    .filter(Boolean);
}

function collectFieldChanges(before, after, fieldDefs) {
  return fieldDefs
    .map((field) => {
      const beforeValue = before?.[field.key];
      const afterValue = after?.[field.key];

      if (valuesEqual(beforeValue, afterValue, field.type)) {
        return null;
      }

      return {
        fieldKey: field.key,
        label: field.label,
        beforeValue,
        afterValue,
        beforeText: formatFieldValue(beforeValue, field.type),
        afterText: formatFieldValue(afterValue, field.type),
      };
    })
    .filter(Boolean);
}

function buildSummaryLines({ totalChangeCount, feedChanges, teamDiffs, fixtureDiffs, addedTeams, removedTeams, addedFixtures, removedFixtures }) {
  if (totalChangeCount === 0) {
    return ["当前草稿与已发布版本一致，可以直接关闭或继续录入。"];
  }

  const lines = [`当前草稿共改动 ${totalChangeCount} 个字段。`];

  if (feedChanges.length > 0) {
    lines.push(`Feed 与默认值变更 ${feedChanges.length} 项。`);
  }

  if (teamDiffs.length > 0) {
    lines.push(
      `球队信号变更 ${teamDiffs.length} 队：${teamDiffs
        .slice(0, 3)
        .map((item) => item.entityLabel)
        .join("、")}${teamDiffs.length > 3 ? " 等" : ""}。`
    );
  }

  if (fixtureDiffs.length > 0) {
    lines.push(
      `场次覆盖变更 ${fixtureDiffs.length} 场：${fixtureDiffs
        .slice(0, 2)
        .map((item) => item.entityLabel)
        .join("；")}${fixtureDiffs.length > 2 ? " 等" : ""}。`
    );
  }

  if (addedTeams > 0 || removedTeams > 0) {
    lines.push(`球队层新增 ${addedTeams} 队，删除 ${removedTeams} 队。`);
  }

  if (addedFixtures > 0 || removedFixtures > 0) {
    lines.push(`场次层新增 ${addedFixtures} 场，删除 ${removedFixtures} 场。`);
  }

  return lines;
}

function buildReleaseNote({ feedChanges, teamDiffs, fixtureDiffs, totalChangeCount }) {
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const lines = [
    "# Prematch Signal 发布说明",
    "",
    `导出时间：${exportedAt}`,
    `已发布基线：${state.baselineSignals.feed.name} / ${state.baselineSignals.feed.mode} / ${state.baselineSignals.feed.generatedAt || "未设置"}`,
    `当前草稿：${state.signals.feed.name || "未命名草稿"} / ${state.signals.feed.mode || "未设置模式"} / ${state.signals.feed.generatedAt || "未设置"}`,
    "",
    `变更统计：字段 ${totalChangeCount} 项，Feed ${feedChanges.length} 项，球队 ${teamDiffs.length} 队，场次 ${fixtureDiffs.length} 场。`,
  ];

  if (totalChangeCount === 0) {
    lines.push("", "当前草稿与已发布版本一致，没有待发布改动。");
    return lines.join("\n");
  }

  if (feedChanges.length > 0) {
    lines.push("", "Feed / 默认值");
    feedChanges.forEach((change) => {
      lines.push(`- ${change.label}：${change.beforeText} -> ${change.afterText}`);
    });
  }

  if (teamDiffs.length > 0) {
    lines.push("", "球队信号");
    teamDiffs.forEach((diff) => {
      lines.push(`- ${diff.entityLabel}（${changeTypeLabel(diff.changeType)} ${diff.fields.length} 项）`);
      diff.fields.forEach((field) => {
        lines.push(`  ${field.label}：${field.beforeText} -> ${field.afterText}`);
      });
    });
  }

  if (fixtureDiffs.length > 0) {
    lines.push("", "场次覆盖");
    fixtureDiffs.forEach((diff) => {
      lines.push(`- ${diff.entityLabel}（${changeTypeLabel(diff.changeType)} ${diff.fields.length} 项）`);
      diff.fields.forEach((field) => {
        lines.push(`  ${field.label}：${field.beforeText} -> ${field.afterText}`);
      });
    });
  }

  return lines.join("\n");
}

function resolveEntityChangeType(before, after) {
  const hasBefore = hasAnySignalValue(before);
  const hasAfter = hasAnySignalValue(after);

  if (!hasBefore && hasAfter) {
    return "added";
  }

  if (hasBefore && !hasAfter) {
    return "removed";
  }

  return "updated";
}

function formatFixtureLabel(fixture) {
  if (!fixture) {
    return "未知场次";
  }

  const linkedFixture =
    state.fixtures.find((item) => createFixtureKey(item) === createFixtureKey(fixture)) || fixture;
  return `${linkedFixture.group || "Unknown"} · ${linkedFixture.date} · ${linkedFixture.homeTeam} vs ${linkedFixture.awayTeam}`;
}

function changeTypeLabel(changeType) {
  if (changeType === "added") {
    return "新增";
  }

  if (changeType === "removed") {
    return "删除";
  }

  return "更新";
}

function valuesEqual(beforeValue, afterValue, type) {
  if (type === "array") {
    return JSON.stringify(normalizeArrayValue(beforeValue)) === JSON.stringify(normalizeArrayValue(afterValue));
  }

  if (type === "number") {
    return normalizeNumberValue(beforeValue) === normalizeNumberValue(afterValue);
  }

  return readComparableText(beforeValue) === readComparableText(afterValue);
}

function formatFieldValue(value, type) {
  if (type === "array") {
    const list = normalizeArrayValue(value);
    return list.length > 0 ? list.join(" | ") : "空";
  }

  if (type === "number") {
    const number = normalizeNumberValue(value);
    return number === "" ? "空" : String(number);
  }

  const text = readComparableText(value);
  return text === "" ? "空" : text;
}

function downloadSignals() {
  downloadBlob("prematch-signals.json", serializeSignals(), "application/json");
}

async function copySignals() {
  try {
    await navigator.clipboard.writeText(serializeSignals());
    elements.status.textContent = "JSON 已复制到剪贴板。";
  } catch (error) {
    console.error(error);
    elements.status.textContent = "复制失败，请改用下载 JSON。";
  }
}

async function copyReleaseNote() {
  try {
    await navigator.clipboard.writeText(elements.releaseNotePreview.value);
    elements.status.textContent = "发布说明已复制到剪贴板。";
  } catch (error) {
    console.error(error);
    elements.status.textContent = "复制失败，请改用下载说明。";
  }
}

function downloadReleaseNote() {
  downloadBlob("prematch-signal-release-note.md", `${elements.releaseNotePreview.value}\n`, "text/markdown");
  elements.status.textContent = "发布说明已下载。";
}

function downloadPublishPackage() {
  const draft = buildDraftSummary();
  const payload = {
    exportedAt: new Date().toISOString(),
    baseline: {
      feed: state.baselineSignals.feed,
      teamSignalCount: Object.keys(state.baselineSignals.teamSignals || {}).length,
      fixtureSignalCount: (state.baselineSignals.fixtureSignals || []).length,
    },
    draft: {
      feed: state.signals.feed,
      totalChangeCount: draft.totalChangeCount,
      feedChangeCount: draft.feedChangeCount,
      teamChangeCount: draft.teamChangeCount,
      fixtureChangeCount: draft.fixtureChangeCount,
      summaryLines: draft.summaryLines,
      releaseNote: draft.releaseNote,
    },
    signals: buildNormalizedSignals(),
  };

  downloadBlob("prematch-signal-publish-package.json", `${JSON.stringify(payload, null, 2)}\n`, "application/json");
  elements.status.textContent = "发布包已下载。";
}

async function importSignals(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    state.signals = normalizeSignalDocument(JSON.parse(text));
    renderAll();
    elements.status.textContent = `已载入草稿 ${file.name}，当前仍以仓库内版本作为已发布基线。`;
  } catch (error) {
    console.error(error);
    elements.status.textContent = "导入失败，文件不是有效的 JSON。";
  }

  event.target.value = "";
}

function serializeSignals() {
  return `${JSON.stringify(buildNormalizedSignals(), null, 2)}\n`;
}

function buildNormalizedSignals() {
  return {
    feed: {
      ...state.signals.feed,
      generatedAt: state.signals.feed.generatedAt?.trim() || new Date().toISOString(),
    },
    defaults: {
      ...state.signals.defaults,
    },
    teamSignals: Object.fromEntries(
      Object.entries(state.signals.teamSignals)
        .filter(([, signal]) => hasAnySignalValue(signal))
        .sort(([left], [right]) => left.localeCompare(right))
    ),
    fixtureSignals: [...state.signals.fixtureSignals]
      .filter((signal) => hasAnySignalValue(signal, ["date", "homeTeam", "awayTeam"]))
      .sort((left, right) =>
        createFixtureKey(left).localeCompare(createFixtureKey(right), "zh-CN", { numeric: true })
      ),
  };
}

function downloadBlob(filename, payload, mimeType) {
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function computeCoverageCount(signals) {
  return state.fixtures.filter((fixture) => {
    const fixtureKey = createFixtureKey(fixture);
    const hasFixtureSignal = signals.fixtureSignals.some((signal) => createFixtureKey(signal) === fixtureKey);
    const hasTeamSignal = Boolean(signals.teamSignals[fixture.homeTeam] || signals.teamSignals[fixture.awayTeam]);
    return hasFixtureSignal || hasTeamSignal;
  }).length;
}

function cloneSignals(signals) {
  return JSON.parse(JSON.stringify(signals));
}

function normalizeSignalDocument(document) {
  const source = document?.signals ? document.signals : document;

  return {
    feed: {
      name: source?.feed?.name || "",
      mode: source?.feed?.mode || "",
      generatedAt: source?.feed?.generatedAt || "",
      description: source?.feed?.description || "",
    },
    defaults: {
      lineupConfidence: source?.defaults?.lineupConfidence ?? null,
      freshnessHours: source?.defaults?.freshnessHours ?? null,
      marketVolatility: source?.defaults?.marketVolatility ?? null,
      sourceLabels: Array.isArray(source?.defaults?.sourceLabels) ? source.defaults.sourceLabels : [],
    },
    teamSignals: source?.teamSignals || {},
    fixtureSignals: Array.isArray(source?.fixtureSignals) ? source.fixtureSignals : [],
  };
}

function createFixtureKey(fixture) {
  return `${fixture.date}__${fixture.homeTeam}__${fixture.awayTeam}`;
}

function parseCommaList(value) {
  return unique(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseLineList(value) {
  return unique(
    value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function applyNumberField(target, key, rawValue) {
  if (rawValue === "") {
    delete target[key];
    return;
  }

  target[key] = Number(rawValue);
}

function pruneEmptySignal(target, stringKeys) {
  stringKeys.forEach((key) => {
    if (Array.isArray(target[key]) && target[key].length === 0) {
      delete target[key];
    }

    if (typeof target[key] === "string" && target[key].trim() === "") {
      delete target[key];
    }
  });
}

function readNumber(value) {
  return value === "" ? null : Number(value);
}

function computeFreshnessHours(lastUpdated, fallback) {
  const parsed = Date.parse(lastUpdated);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.round((Date.now() - parsed) / 3600000));
}

function formatSigned(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}`;
}

function volatilityLabel(value) {
  if (value >= 2.8) {
    return "高";
  }

  if (value >= 1.8) {
    return "中";
  }

  return "低";
}

function isFiniteNumber(value, min, max) {
  return typeof value === "number" && !Number.isNaN(value) && value >= min && value <= max;
}

function toggleFieldDirty(element, baselineValue, currentValue, type) {
  const normalizedCurrent =
    type === "number"
      ? readComparableNumber(currentValue)
      : type === "array"
        ? readComparableArray(currentValue)
        : type === "line-array"
          ? readComparableArray(currentValue, "\n")
          : readComparableText(currentValue);
  element.closest(".field")?.classList.toggle("is-dirty", baselineValue !== normalizedCurrent);
}

function readComparableText(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function readComparableNumber(value) {
  if (value === "" || value == null) {
    return "";
  }

  return Number(value);
}

function readComparableArray(value, separator = ",") {
  if (Array.isArray(value)) {
    return normalizeArrayValue(value).join(separator === "\n" ? "\n" : ", ");
  }

  if (typeof value === "string") {
    return separator === "\n" ? parseLineList(value).join("\n") : parseCommaList(value).join(", ");
  }

  return "";
}

function normalizeArrayValue(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(value.map((item) => String(item).trim()));
}

function normalizeNumberValue(value) {
  if (value === "" || value == null) {
    return "";
  }

  return Number(value);
}

function hasAnySignalValue(signal, ignoreKeys = []) {
  if (!signal) {
    return false;
  }

  return Object.entries(signal).some(([key, value]) => {
    if (ignoreKeys.includes(key)) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return value !== undefined && value !== null;
  });
}

loadConsole();
