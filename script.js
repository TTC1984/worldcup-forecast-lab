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
  groupFilter: document.getElementById("group-filter"),
};

const state = {
  model: null,
  summary: null,
  fixtures: [],
  groups: [],
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

  const generatedAt = new Date(state.model.generatedAt).toLocaleString("zh-CN", {
    hour12: false,
  });

  elements.dataStatus.textContent =
    `${state.model.name} ${state.model.version} · ${generatedAt} 生成 · ${state.summary.scopeNote}`;
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
    state.activeGroup = forecast.groups[0]?.label || null;

    renderSummary();
    renderGroupFilter();
    updateFixture(getVisibleFixtures()[0]?.id);
  } catch (error) {
    elements.dataStatus.textContent =
      "预测数据加载失败。请先运行 `npm run generate:predictions`，再通过静态服务打开页面。";
    console.error(error);
  }
}

loadForecast();
