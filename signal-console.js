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
    state.baselineSignals = await signalsResponse.json();
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
  });

  elements.fixtureGroupFilter.addEventListener("change", () => {
    state.selectedGroup = elements.fixtureGroupFilter.value;
    const nextFixture = getVisibleFixtures()[0];
    state.selectedFixtureKey = createFixtureKey(nextFixture);
    renderFixtureOptions();
    renderFixtureForm();
    renderPreview();
  });

  elements.fixtureSelect.addEventListener("change", () => {
    state.selectedFixtureKey = elements.fixtureSelect.value;
    renderFixtureForm();
    renderPreview();
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
  elements.importFeed.addEventListener("change", importSignals);
}

function renderAll() {
  renderStatus();
  renderStats();
  renderFeedForm();
  renderTeamOptions();
  renderTeamForm();
  renderGroupOptions();
  renderFixtureOptions();
  renderFixtureForm();
  renderValidation();
  renderPreview();
}

function renderStatus() {
  const validation = validateSignals(state.signals);
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  elements.status.textContent =
    `${state.signals.feed.name} · ${state.signals.feed.mode} · ${timestamp} 打开 · ${validation.errors.length} 个错误 / ${validation.warnings.length} 个提醒`;
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

function updateFeedForm() {
  state.signals.feed.name = elements.feedName.value.trim();
  state.signals.feed.mode = elements.feedMode.value.trim();
  state.signals.feed.generatedAt = elements.feedGeneratedAt.value.trim();
  state.signals.feed.description = elements.feedDescription.value.trim();
  state.signals.defaults.lineupConfidence = readNumber(elements.defaultLineupConfidence.value);
  state.signals.defaults.freshnessHours = readNumber(elements.defaultFreshnessHours.value);
  state.signals.defaults.marketVolatility = readNumber(elements.defaultMarketVolatility.value);
  state.signals.defaults.sourceLabels = parseCommaList(elements.defaultSourceLabels.value);
  renderStatus();
  renderStats();
  renderValidation();
  renderPreview();
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
  renderStatus();
  renderStats();
  renderValidation();
  renderPreview();
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

  renderStatus();
  renderStats();
  renderValidation();
  renderPreview();
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
    fixtureSignal.marketHomeShift ?? (((homeTeamSignal.marketSentiment || 0) - (awayTeamSignal.marketSentiment || 0)) * 4).toFixed(1);
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

function downloadSignals() {
  const payload = serializeSignals();
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "prematch-signals.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function copySignals() {
  const payload = serializeSignals();
  await navigator.clipboard.writeText(payload);
  elements.status.textContent = "JSON 已复制到剪贴板。";
}

async function importSignals(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  const text = await file.text();
  state.signals = JSON.parse(text);
  state.baselineSignals = cloneSignals(state.signals);
  renderAll();
  event.target.value = "";
}

function serializeSignals() {
  const normalized = {
    feed: {
      ...state.signals.feed,
      generatedAt: new Date().toISOString(),
    },
    defaults: {
      ...state.signals.defaults,
    },
    teamSignals: Object.fromEntries(
      Object.entries(state.signals.teamSignals)
        .filter(([, signal]) => Object.keys(signal).length > 0)
        .sort(([left], [right]) => left.localeCompare(right))
    ),
    fixtureSignals: [...state.signals.fixtureSignals]
      .filter((signal) => signal.headline || signal.lastUpdated || (signal.alerts || []).length > 0)
      .sort((left, right) =>
        createFixtureKey(left).localeCompare(createFixtureKey(right), "zh-CN", { numeric: true })
      ),
  };

  return `${JSON.stringify(normalized, null, 2)}\n`;
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

loadConsole();
