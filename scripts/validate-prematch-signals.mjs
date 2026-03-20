import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "data", "source");

const teams = JSON.parse(readFileSync(resolve(sourceDir, "teams.json"), "utf8"));
const prematchSignalsPath = existsSync(resolve(sourceDir, "prematch-signals.live.json"))
  ? resolve(sourceDir, "prematch-signals.live.json")
  : resolve(sourceDir, "prematch-signals.json");
const prematchSignals = JSON.parse(readFileSync(prematchSignalsPath, "utf8"));
const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");

const teamNames = new Set(teams.map((team) => team.name));
const validFixtureKeys = new Set(parseGroupFixtures(groupStageSource).map(createFixtureKey));
const errors = [];
const warnings = [];

validateFeed(prematchSignals.feed);
validateDefaults(prematchSignals.defaults);
validateTeamSignals(prematchSignals.teamSignals || {});
validateFixtureSignals(prematchSignals.fixtureSignals || []);

if (errors.length > 0) {
  console.error("Prematch signal validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Validated prematch signals (${prematchSignals.feed?.mode || "unknown"}): ${Object.keys(prematchSignals.teamSignals || {}).length} team entries, ${(
    prematchSignals.fixtureSignals || []
  ).length} fixture overrides.`
);

if (warnings.length > 0) {
  console.warn("Warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

function normalizeWhitespace(value) {
  return value.replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function createFixtureKey(fixture) {
  return `${fixture.date}__${fixture.homeTeam}__${fixture.awayTeam}`;
}

function validateFeed(feed) {
  if (!feed || typeof feed !== "object") {
    errors.push("`feed` is required and must be an object.");
    return;
  }

  requireString(feed.name, "feed.name");
  requireString(feed.mode, "feed.mode");
  requireString(feed.generatedAt, "feed.generatedAt");
  requireString(feed.description, "feed.description");
}

function validateDefaults(defaults) {
  if (!defaults || typeof defaults !== "object") {
    errors.push("`defaults` is required and must be an object.");
    return;
  }

  validateNumber(defaults.lineupConfidence, "defaults.lineupConfidence", 0, 100);
  validateNumber(defaults.freshnessHours, "defaults.freshnessHours", 1, 240);
  validateNumber(defaults.marketVolatility, "defaults.marketVolatility", 0, 10);
  validateStringArray(defaults.sourceLabels, "defaults.sourceLabels");
}

function validateTeamSignals(teamSignals) {
  Object.entries(teamSignals).forEach(([teamName, signal]) => {
    if (!teamNames.has(teamName)) {
      errors.push(`Unknown team signal key: ${teamName}`);
      return;
    }

    validateSignalObject(signal, `teamSignals.${teamName}`, {
      allowHeadline: false,
      allowFixtureFields: false,
      requireLastUpdated: true,
    });
  });
}

function validateFixtureSignals(fixtureSignals) {
  if (!Array.isArray(fixtureSignals)) {
    errors.push("`fixtureSignals` must be an array.");
    return;
  }

  const seen = new Set();

  fixtureSignals.forEach((signal, index) => {
    const basePath = `fixtureSignals[${index}]`;
    requireString(signal.date, `${basePath}.date`);
    requireString(signal.homeTeam, `${basePath}.homeTeam`);
    requireString(signal.awayTeam, `${basePath}.awayTeam`);
    const key = createFixtureKey(signal);

    if (seen.has(key)) {
      errors.push(`Duplicate fixture override: ${key}`);
    }

    seen.add(key);

    if (!validFixtureKeys.has(key)) {
      errors.push(`Fixture override does not match 2026 schedule: ${key}`);
    }

    validateSignalObject(signal, basePath, {
      allowHeadline: true,
      allowFixtureFields: true,
      requireLastUpdated: true,
    });
  });
}

function validateSignalObject(signal, basePath, options) {
  if (!signal || typeof signal !== "object") {
    errors.push(`${basePath} must be an object.`);
    return;
  }

  if (options.requireLastUpdated) {
    requireString(signal.lastUpdated, `${basePath}.lastUpdated`);
  }

  if (signal.lineupConfidence !== undefined) {
    validateNumber(signal.lineupConfidence, `${basePath}.lineupConfidence`, 0, 100);
  }

  if (signal.attackDelta !== undefined) {
    validateNumber(signal.attackDelta, `${basePath}.attackDelta`, -0.4, 0.4);
  }

  if (signal.defenseDelta !== undefined) {
    validateNumber(signal.defenseDelta, `${basePath}.defenseDelta`, -0.4, 0.4);
  }

  if (signal.marketSentiment !== undefined) {
    validateNumber(signal.marketSentiment, `${basePath}.marketSentiment`, -1, 1);
  }

  if (signal.homeLambdaDelta !== undefined) {
    validateNumber(signal.homeLambdaDelta, `${basePath}.homeLambdaDelta`, -0.4, 0.4);
  }

  if (signal.awayLambdaDelta !== undefined) {
    validateNumber(signal.awayLambdaDelta, `${basePath}.awayLambdaDelta`, -0.4, 0.4);
  }

  if (signal.marketHomeShift !== undefined) {
    validateNumber(signal.marketHomeShift, `${basePath}.marketHomeShift`, -10, 10);
  }

  if (signal.marketVolatility !== undefined) {
    validateNumber(signal.marketVolatility, `${basePath}.marketVolatility`, 0, 10);
  }

  if (signal.homeLineupConfidence !== undefined) {
    validateNumber(signal.homeLineupConfidence, `${basePath}.homeLineupConfidence`, 0, 100);
  }

  if (signal.awayLineupConfidence !== undefined) {
    validateNumber(signal.awayLineupConfidence, `${basePath}.awayLineupConfidence`, 0, 100);
  }

  if (options.allowHeadline && signal.headline !== undefined) {
    requireString(signal.headline, `${basePath}.headline`);
  }

  validateStringArray(signal.alerts, `${basePath}.alerts`);
  validateStringArray(signal.sourceLabels, `${basePath}.sourceLabels`);

  if (!signal.alerts || signal.alerts.length === 0) {
    warnings.push(`${basePath} has no alerts; client cards may feel empty.`);
  }
}

function validateNumber(value, path, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${path} must be a number.`);
    return;
  }

  if (value < min || value > max) {
    errors.push(`${path} must be between ${min} and ${max}.`);
  }
}

function validateStringArray(value, path) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of strings.`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      errors.push(`${path}[${index}] must be a non-empty string.`);
    }
  });
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
  }
}

function parseGroupDefinitions(text) {
  const lines = text.split("\n");
  const groups = new Map();

  lines
    .filter((line) => line.startsWith("Group "))
    .forEach((line) => {
      const [groupLabel, teamsPart] = line.split("|");
      const label = normalizeWhitespace(groupLabel);
      const groupId = label.split(" ")[1];
      const teamsInGroup = teamsPart
        .replace(/\t/g, "  ")
        .trim()
        .split(/\s{2,}/)
        .map((team) => normalizeWhitespace(team));

      groups.set(label, {
        id: groupId,
        label,
        teams: teamsInGroup,
      });
    });

  return groups;
}

function parseGroupFixtures(text) {
  const groupDefinitions = parseGroupDefinitions(text);
  const lines = text.split("\n");
  const fixtures = [];
  let currentGroup = null;
  let currentDate = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith("▪ Group ")) {
      currentGroup = groupDefinitions.get(trimmed.replace("▪ ", ""));
      return;
    }

    const dateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]+)\s+(\d{1,2})$/);

    if (dateMatch) {
      currentDate = `2026-${monthIndex(dateMatch[1])}-${String(Number(dateMatch[2])).padStart(2, "0")}`;
      return;
    }

    const normalizedLine = normalizeWhitespace(line);
    const fixtureMatch = normalizedLine.match(/^(\d{1,2}:\d{2}) (UTC[+-]\d) (.+) @ (.+)$/);

    if (fixtureMatch && currentGroup && currentDate) {
      const [, , , matchup] = fixtureMatch;
      const [homeTeam, awayTeam] = matchup.split(/\s+v\s+/);

      fixtures.push({
        date: currentDate,
        homeTeam: normalizeWhitespace(homeTeam),
        awayTeam: normalizeWhitespace(awayTeam),
      });
    }
  });

  return fixtures;
}

function monthIndex(monthName) {
  const monthMap = {
    Jan: "01",
    January: "01",
    Feb: "02",
    February: "02",
    Mar: "03",
    March: "03",
    Apr: "04",
    April: "04",
    May: "05",
    Jun: "06",
    June: "06",
    Jul: "07",
    July: "07",
  };

  return monthMap[monthName];
}
