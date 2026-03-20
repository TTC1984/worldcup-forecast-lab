import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "data", "source");
const outputDir = resolve(rootDir, "data", "generated");

const teams = JSON.parse(readFileSync(resolve(sourceDir, "teams.json"), "utf8"));
const tournamentConfig = JSON.parse(readFileSync(resolve(sourceDir, "tournament.json"), "utf8"));

const teamMap = new Map(teams.map((team) => [team.name, team]));

const pairings = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2],
];

const roundOffsets = [0, 0, 4, 4, 8, 8];
const kickoffSlots = ["13:00", "20:00", "16:00", "22:00", "18:00", "22:00"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentage(probability) {
  return `${(probability * 100).toFixed(1)}%`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function poisson(lambda, maxGoals = 6) {
  const distribution = [];
  let sum = 0;

  for (let goals = 0; goals <= maxGoals; goals += 1) {
    const probability = Math.exp(-lambda) * Math.pow(lambda, goals) / factorial(goals);
    distribution.push(probability);
    sum += probability;
  }

  distribution[maxGoals] += Math.max(0, 1 - sum);
  return distribution;
}

function factorial(number) {
  if (number <= 1) {
    return 1;
  }

  let result = 1;

  for (let index = 2; index <= number; index += 1) {
    result *= index;
  }

  return result;
}

function outcomeKey(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) {
    return "home";
  }

  if (homeGoals < awayGoals) {
    return "away";
  }

  return "draw";
}

function outcomeLabel(key) {
  if (key === "home") {
    return "主胜";
  }

  if (key === "away") {
    return "客胜";
  }

  return "平";
}

function statusLabel(key) {
  if (key === "home") {
    return "胜";
  }

  if (key === "away") {
    return "负";
  }

  return "平";
}

function createScoreMatrix(homeLambda, awayLambda, maxGoals = 6) {
  const homeDistribution = poisson(homeLambda, maxGoals);
  const awayDistribution = poisson(awayLambda, maxGoals);
  const entries = [];

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      entries.push({
        homeGoals,
        awayGoals,
        probability: homeDistribution[homeGoals] * awayDistribution[awayGoals],
      });
    }
  }

  return entries;
}

function normalize(items) {
  const total = items.reduce((sum, item) => sum + item.probability, 0);

  return items.map((item) => ({
    ...item,
    probability: total === 0 ? 0 : item.probability / total,
  }));
}

function rankOutcomeConfidence(probabilities) {
  const sorted = [...probabilities].sort((left, right) => right - left);
  const gap = sorted[0] - sorted[1];

  if (sorted[0] >= 0.52 && gap >= 0.14) {
    return "高置信";
  }

  if (sorted[0] >= 0.46 && gap >= 0.09) {
    return "中高置信";
  }

  if (gap >= 0.05) {
    return "中置信";
  }

  return "低置信";
}

function buildHalftimeFulltime(homeLambda, awayLambda) {
  const halftimeMatrix = createScoreMatrix(homeLambda * 0.46, awayLambda * 0.46, 4);
  const secondHalfMatrix = createScoreMatrix(homeLambda * 0.54, awayLambda * 0.54, 4);
  const combinationMap = new Map();

  halftimeMatrix.forEach((halftimeEntry) => {
    secondHalfMatrix.forEach((secondHalfEntry) => {
      const halftime = outcomeKey(halftimeEntry.homeGoals, halftimeEntry.awayGoals);
      const fulltime = outcomeKey(
        halftimeEntry.homeGoals + secondHalfEntry.homeGoals,
        halftimeEntry.awayGoals + secondHalfEntry.awayGoals
      );
      const label = `${statusLabel(halftime)} / ${statusLabel(fulltime)}`;
      const probability = halftimeEntry.probability * secondHalfEntry.probability;
      combinationMap.set(label, (combinationMap.get(label) || 0) + probability);
    });
  });

  return [...combinationMap.entries()]
    .map(([label, probability]) => ({ label, probability }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 4)
    .map((item) => ({
      label: item.label,
      note: percentage(item.probability),
    }));
}

function deriveRiskNotes({
  hostAdvantage,
  homeWinProbability,
  drawProbability,
  awayWinProbability,
  over25Probability,
  under25Probability,
  topScoreProbability,
}) {
  const notes = [];

  if (Math.abs(homeWinProbability - awayWinProbability) <= 0.08 || drawProbability >= 0.3) {
    notes.push("对阵接近，平局与临场名单的影响会明显放大。");
  }

  if (under25Probability >= 0.56) {
    notes.push("模型偏向低比分区间，更适合展示胜平负和小比分组合。");
  } else if (over25Probability >= 0.58) {
    notes.push("比赛节奏偏开放，单点比分离散度较高，建议结合总进球一起看。");
  }

  if (topScoreProbability <= 0.14) {
    notes.push("精确比分命中天然偏低，更适合输出 Top3 覆盖而不是单点承诺。");
  }

  if (hostAdvantage) {
    notes.push("主办国在本国城市作赛时已纳入轻微场地熟悉度加成。");
  }

  while (notes.length < 3) {
    notes.push("当前版本尚未接入赔率与伤停流，赛前更新频率仍需继续补强。");
  }

  return notes.slice(0, 3);
}

function deriveBestPick({
  homeWinProbability,
  drawProbability,
  awayWinProbability,
  over25Probability,
  under25Probability,
  topScore,
}) {
  const ordered = [
    { label: "主胜", probability: homeWinProbability },
    { label: "平局倾向", probability: drawProbability },
    { label: "客胜", probability: awayWinProbability },
  ].sort((left, right) => right.probability - left.probability);

  if (ordered[0].label !== "平局倾向" && ordered[0].probability >= 0.47 && over25Probability >= 0.56) {
    return `${ordered[0].label} + 大2.5`;
  }

  if (ordered[0].probability >= 0.45) {
    return ordered[0].label;
  }

  if (under25Probability >= 0.58) {
    return "小2.5";
  }

  return `比分关注 ${topScore}`;
}

function generateFixturePrediction(fixture) {
  const homeTeam = teamMap.get(fixture.homeTeam);
  const awayTeam = teamMap.get(fixture.awayTeam);
  const ratingDelta = (homeTeam.rating - awayTeam.rating) / 400;
  const hostAdvantage =
    fixture.venueCountry === homeTeam.country && homeTeam.hostNation
      ? 0.16
      : fixture.venueCountry === awayTeam.country && awayTeam.hostNation
        ? -0.08
        : 0;

  const homeLambda = clamp(
    1.22 +
      ratingDelta * 0.62 +
      (homeTeam.attack - awayTeam.defense) * 0.72 +
      (homeTeam.form - awayTeam.form) * 0.25 +
      hostAdvantage,
    0.35,
    3.4
  );
  const awayLambda = clamp(
    1.08 -
      ratingDelta * 0.34 +
      (awayTeam.attack - homeTeam.defense) * 0.7 +
      (awayTeam.form - homeTeam.form) * 0.18 -
      hostAdvantage * 0.35,
    0.25,
    3.1
  );

  const matrix = normalize(createScoreMatrix(homeLambda, awayLambda, 6));
  const outcomeTotals = { home: 0, draw: 0, away: 0 };
  const totalGoalsMap = new Map();
  let bothTeamsToScore = 0;

  matrix.forEach((entry) => {
    outcomeTotals[outcomeKey(entry.homeGoals, entry.awayGoals)] += entry.probability;
    const totalGoals = entry.homeGoals + entry.awayGoals;
    totalGoalsMap.set(totalGoals, (totalGoalsMap.get(totalGoals) || 0) + entry.probability);

    if (entry.homeGoals >= 1 && entry.awayGoals >= 1) {
      bothTeamsToScore += entry.probability;
    }
  });

  const topScores = [...matrix]
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 3)
    .map((entry) => ({
      score: `${entry.homeGoals} : ${entry.awayGoals}`,
      probability: percentage(entry.probability),
    }));

  const totalGoalsDistribution = [...totalGoalsMap.entries()]
    .map(([goals, probability]) => ({ goals, probability }))
    .sort((left, right) => right.probability - left.probability);

  const mostLikelyTotals = totalGoalsDistribution.slice(0, 2).map((entry) => ({
    label: `${entry.goals} 球`,
    note: percentage(entry.probability),
  }));

  const over25Probability = totalGoalsDistribution
    .filter((entry) => entry.goals >= 3)
    .reduce((sum, entry) => sum + entry.probability, 0);
  const under25Probability = 1 - over25Probability;
  const confidence = rankOutcomeConfidence([
    outcomeTotals.home,
    outcomeTotals.draw,
    outcomeTotals.away,
  ]);
  const bestPick = deriveBestPick({
    homeWinProbability: outcomeTotals.home,
    drawProbability: outcomeTotals.draw,
    awayWinProbability: outcomeTotals.away,
    over25Probability,
    under25Probability,
    topScore: topScores[0].score,
  });

  return {
    id: fixture.id,
    label: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
    shortMeta: fixture.group,
    stage: fixture.stage,
    meta: `${fixture.group} · ${fixture.date} ${fixture.kickoff} · ${fixture.city}`,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    group: fixture.group,
    venue: `${fixture.city}, ${fixture.venueCountry}`,
    bestPick,
    signal: confidence,
    modelDetail: `Baseline xG ${homeLambda.toFixed(2)} : ${awayLambda.toFixed(2)}`,
    outcomes: [
      { label: "主胜", value: Number((outcomeTotals.home * 100).toFixed(1)) },
      { label: "平", value: Number((outcomeTotals.draw * 100).toFixed(1)) },
      { label: "客胜", value: Number((outcomeTotals.away * 100).toFixed(1)) },
    ],
    scores: topScores,
    goals: [
      ...mostLikelyTotals,
      { label: over25Probability >= under25Probability ? "大 2.5" : "小 2.5", note: percentage(Math.max(over25Probability, under25Probability)) },
      { label: "双方进球", note: percentage(bothTeamsToScore) },
    ],
    halftime: buildHalftimeFulltime(homeLambda, awayLambda),
    risks: deriveRiskNotes({
      hostAdvantage: hostAdvantage > 0,
      homeWinProbability: outcomeTotals.home,
      drawProbability: outcomeTotals.draw,
      awayWinProbability: outcomeTotals.away,
      over25Probability,
      under25Probability,
      topScoreProbability: Number(topScores[0].probability.replace("%", "")) / 100,
    }),
  };
}

function generateFixtures() {
  return tournamentConfig.groups.flatMap((group) =>
    pairings.map(([homeIndex, awayIndex], fixtureIndex) => ({
      id: `${group.id.toLowerCase()}-${fixtureIndex + 1}-${group.teams[homeIndex].toLowerCase().replace(/\s+/g, "-")}-${group.teams[awayIndex].toLowerCase().replace(/\s+/g, "-")}`,
      homeTeam: group.teams[homeIndex],
      awayTeam: group.teams[awayIndex],
      group: group.label,
      stage: "Group Stage",
      date: addDays(group.baseDate, roundOffsets[fixtureIndex]),
      kickoff: kickoffSlots[fixtureIndex],
      city: group.cities[fixtureIndex % group.cities.length],
      venueCountry: group.venueCountry,
    }))
  );
}

const fixtures = generateFixtures();
const predictions = fixtures.map(generateFixturePrediction);

const output = {
  model: {
    name: "Baseline Elo-Poisson Sandbox",
    version: "v0.1.0",
    generatedAt: new Date().toISOString(),
    notes: tournamentConfig.tournament.assumptions,
  },
  summary: {
    tournamentName: tournamentConfig.tournament.name,
    teamCount: teams.length,
    fixtureCount: predictions.length,
    groupCount: tournamentConfig.groups.length,
    scopeNote: tournamentConfig.tournament.scopeNote,
  },
  fixtures: predictions,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, "worldcup-forecast.json"), JSON.stringify(output, null, 2));

console.log(`Generated ${predictions.length} predictions for ${teams.length} teams.`);
