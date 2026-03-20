const elements = {
  switcher: document.getElementById("match-switcher"),
  title: document.getElementById("fixture-title"),
  stage: document.getElementById("fixture-stage"),
  meta: document.getElementById("fixture-meta"),
  engine: document.getElementById("fixture-engine"),
  bestPick: document.getElementById("best-pick"),
  signal: document.getElementById("signal-strength"),
  outcomeBars: document.getElementById("outcome-bars"),
  scoreGrid: document.getElementById("score-grid"),
  goalsGrid: document.getElementById("goals-grid"),
  halftimeGrid: document.getElementById("halftime-grid"),
  riskList: document.getElementById("risk-list"),
  dataStatus: document.getElementById("data-status"),
  summaryTeamCount: document.getElementById("summary-team-count"),
  summaryFixtureCount: document.getElementById("summary-fixture-count"),
  summaryGroupCount: document.getElementById("summary-group-count"),
  summarySimulationCount: document.getElementById("summary-simulation-count"),
  groupFilter: document.getElementById("group-filter"),
  groupProjectionTitle: document.getElementById("group-projection-title"),
  groupProjectionBody: document.getElementById("group-projection-body"),
  titleContenders: document.getElementById("title-contenders"),
  simulationNotes: document.getElementById("simulation-notes"),
  backtestStatus: document.getElementById("backtest-status"),
  backtestMatchCount: document.getElementById("backtest-match-count"),
  backtestOutcomeAccuracy: document.getElementById("backtest-outcome-accuracy"),
  backtestTop3Coverage: document.getElementById("backtest-top3-coverage"),
  backtestBrier: document.getElementById("backtest-brier"),
  backtestLogLoss: document.getElementById("backtest-logloss"),
  backtestSeasonBody: document.getElementById("backtest-season-body"),
  backtestCalibrationBody: document.getElementById("backtest-calibration-body"),
  backtestNotes: document.getElementById("backtest-notes"),
  backtestSurpriseList: document.getElementById("backtest-surprise-list"),
};

const state = {
  model: null,
  summary: null,
  fixtures: [],
  groups: [],
  simulation: null,
  backtest: null,
  activeGroup: null,
};

function animateCount(element, value) {
  const target = Number(value);
  let frame = 0;
  const totalFrames = 36;
  const timer = setInterval(() => {
    frame += 1;
    const current = Math.round((target * frame) / totalFrames);
    element.textContent = String(current);

    if (frame >= totalFrames) {
      element.textContent = String(target);
      clearInterval(timer);
    }
  }, 20);
}

function renderSummary() {
  animateCount(elements.summaryTeamCount, state.summary.teamCount);
  animateCount(elements.summaryFixtureCount, state.summary.fixtureCount);
  animateCount(elements.summaryGroupCount, state.summary.groupCount);
  animateCount(elements.summarySimulationCount, state.summary.simulationCount);

  const generatedAt = new Date(state.model.generatedAt).toLocaleString("zh-CN", {
    hour12: false,
  });

  elements.dataStatus.textContent =
    `${state.model.name} ${state.model.version} · ${generatedAt} 生成 · ${state.summary.simulationCount.toLocaleString("zh-CN")} 次模拟 · ${state.summary.backtestMatchCount.toLocaleString("zh-CN")} 场回测 · ${state.summary.scopeNote}`;
}

function getVisibleFixtures() {
  return state.fixtures.filter((fixture) => fixture.group === state.activeGroup);
}

function renderGroupFilter() {
  elements.groupFilter.innerHTML = state.groups
    .map((group) => `<option value="${group.label}">${group.label}</option>`)
    .join("");

  elements.groupFilter.value = state.activeGroup;
  elements.groupFilter.onchange = () => {
    state.activeGroup = elements.groupFilter.value;
    const visibleFixtures = getVisibleFixtures();
    updateFixture(visibleFixtures[0]?.id);
  };
}

function renderSwitcher(activeId) {
  elements.switcher.innerHTML = getVisibleFixtures()
    .map(
      (fixture) => `
        <button class="match-button ${fixture.id === activeId ? "is-active" : ""}" data-id="${fixture.id}">
          ${fixture.label}
          <small>${fixture.shortMeta}</small>
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
          <span>${outcome.label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${outcome.value}%;">
              <span>${outcome.label}</span>
              <strong>${outcome.value}%</strong>
            </div>
          </div>
        </div>
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

function renderRisks(risks) {
  elements.riskList.innerHTML = risks.map((risk) => `<li>${risk}</li>`).join("");
}

function renderGroupProjection() {
  const groupProjection = state.simulation?.groupProjections.find((group) => group.label === state.activeGroup);

  if (!groupProjection) {
    elements.groupProjectionTitle.textContent = "分组模拟暂不可用";
    elements.groupProjectionBody.innerHTML = "";
    return;
  }

  elements.groupProjectionTitle.textContent = `${groupProjection.label} 出线概率`;
  elements.groupProjectionBody.innerHTML = groupProjection.teams
    .map(
      (team, index) => `
        <tr>
          <td>
            <div class="table-team">
              <strong>${index + 1}. ${team.team}</strong>
              <span>小组第一 ${team.positionProbabilities.first}%</span>
            </div>
          </td>
          <td>${team.averagePoints}</td>
          <td>${team.topTwoProbability}%</td>
          <td>${team.bestThirdQualificationProbability}%</td>
          <td>${team.qualifyProbability}%</td>
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
            <span>No. ${index + 1}</span>
            <strong>${team.team}</strong>
            <p>${team.group}</p>
          </div>
          <div class="contender-metrics">
            <div>
              <span>夺冠</span>
              <strong>${team.championProbability}%</strong>
            </div>
            <div>
              <span>决赛</span>
              <strong>${team.reachFinalProbability}%</strong>
            </div>
            <div>
              <span>四强</span>
              <strong>${team.reachSemiFinalProbability}%</strong>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSimulationNotes() {
  const notes = state.simulation?.notes || [];
  elements.simulationNotes.innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
}

function renderTournamentOutlook() {
  renderGroupProjection();
  renderTitleContenders();
  renderSimulationNotes();
}

function renderBacktest() {
  const backtest = state.backtest;

  if (!backtest) {
    elements.backtestStatus.textContent = "历史回测暂不可用。";
    return;
  }

  elements.backtestStatus.textContent =
    `${backtest.sampleLabel} · ${backtest.matchCount.toLocaleString("zh-CN")} 场样本`;
  elements.backtestMatchCount.textContent = String(backtest.matchCount);
  elements.backtestOutcomeAccuracy.textContent = `${backtest.metrics.outcomeAccuracy}%`;
  elements.backtestTop3Coverage.textContent = `${backtest.metrics.top3ScoreCoverage}%`;
  elements.backtestBrier.textContent = String(backtest.metrics.averageBrier);
  elements.backtestLogLoss.textContent = String(backtest.metrics.averageLogLoss);

  elements.backtestSeasonBody.innerHTML = backtest.seasonBreakdown
    .map(
      (season) => `
        <tr>
          <td>
            <div class="table-team">
              <strong>${season.season}</strong>
              <span>${season.hostCountry}</span>
            </div>
          </td>
          <td>${season.matchCount}</td>
          <td>${season.outcomeAccuracy}%</td>
          <td>${season.top3ScoreCoverage}%</td>
          <td>${season.averageBrier}</td>
          <td>${season.averageLogLoss}</td>
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

  elements.backtestNotes.innerHTML = backtest.notes.map((note) => `<li>${note}</li>`).join("");
  elements.backtestSurpriseList.innerHTML = backtest.surpriseMatches
    .map(
      (match) => `
        <article class="surprise-card">
          <span>${match.season} · ${match.fixture}</span>
          <strong>${match.actualScore}</strong>
          <p>模型判断 ${match.predictedOutcome}，置信 ${match.modelConfidence}%</p>
          <p>真实赛果概率仅 ${match.actualOutcomeProbability}%</p>
        </article>
      `
    )
    .join("");
}

function updateFixture(id) {
  const visibleFixtures = getVisibleFixtures();
  const fixture = visibleFixtures.find((item) => item.id === id) || visibleFixtures[0];

  if (!fixture) {
    return;
  }

  elements.title.textContent = fixture.label;
  elements.stage.textContent = fixture.stage;
  elements.meta.textContent = fixture.meta;
  elements.engine.textContent = `${fixture.modelDetail} · ${fixture.venue}`;
  elements.bestPick.textContent = fixture.bestPick;
  elements.signal.textContent = fixture.signal;

  renderSwitcher(fixture.id);
  renderOutcomeBars(fixture.outcomes);
  renderScores(fixture.scores);
  renderTags(elements.goalsGrid, fixture.goals);
  renderTags(elements.halftimeGrid, fixture.halftime);
  renderRisks(fixture.risks);
  renderTournamentOutlook();
}

async function loadForecast() {
  try {
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
    state.activeGroup = forecast.groups[0]?.label || null;

    renderSummary();
    renderBacktest();
    renderGroupFilter();
    updateFixture(getVisibleFixtures()[0]?.id);
  } catch (error) {
    elements.dataStatus.textContent =
      "预测数据加载失败。请先运行 `npm run generate:predictions`，再通过静态服务打开页面。";
    console.error(error);
  }
}

loadForecast();
