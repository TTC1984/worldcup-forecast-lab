import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  Aug: "08",
  August: "08",
  Sep: "09",
  September: "09",
  Oct: "10",
  October: "10",
  Nov: "11",
  November: "11",
  Dec: "12",
  December: "12",
};

export function resolveProjectPaths(importMetaUrl) {
  const __dirname = dirname(fileURLToPath(importMetaUrl));
  const rootDir = resolve(__dirname, "..");
  const sourceDir = resolve(rootDir, "data", "source");
  const liveDir = resolve(sourceDir, "live");
  return { rootDir, sourceDir, liveDir };
}

export function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function readJson(filePath, fallback = null) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function loadOptionalEnvFiles(rootDir) {
  [".env.local", ".env"].forEach((name) => {
    const filePath = resolve(rootDir, name);

    if (!existsSync(filePath)) {
      return;
    }

    const rows = readFileSync(filePath, "utf8").split("\n");

    rows.forEach((row) => {
      const line = row.trim();

      if (!line || line.startsWith("#")) {
        return;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "");

      if (!(key in process.env)) {
        process.env[key] = normalizedValue;
      }
    });
  });
}

export function createFixtureKey({ date, homeTeam, awayTeam }) {
  return `${date}__${homeTeam}__${awayTeam}`;
}

export function formatUtcWindowStart(date) {
  return `${date}T00:00:00Z`;
}

export function formatUtcWindowEnd(date) {
  return `${date}T23:59:59Z`;
}

export function normalizeTeamToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function parseWorldCupFixtures(groupStageSource) {
  const groupDefinitions = parseGroupDefinitions(groupStageSource);
  const lines = groupStageSource.split("\n");
  const fixtures = [];
  let currentGroup = null;
  let currentDate = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith("▪ ") && !trimmed.startsWith("▪ Group ")) {
      currentGroup = null;
      return;
    }

    if (trimmed.startsWith("▪ Group ")) {
      currentGroup = groupDefinitions.get(trimmed.replace("▪ ", ""));
      return;
    }

    const dateMatch = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]+)\s+(\d{1,2})$/);

    if (dateMatch) {
      currentDate = toDateString(dateMatch[1], Number(dateMatch[2]));
      return;
    }

    const normalizedLine = normalizeWhitespace(line);
    const fixtureMatch = normalizedLine.match(/^(\d{1,2}:\d{2}) (UTC[+-]\d) (.+) @ (.+)$/);

    if (!fixtureMatch || !currentGroup || !currentDate) {
      return;
    }

    const [, kickoff, utcOffset, matchup, venue] = fixtureMatch;
    const [homeTeam, awayTeam] = matchup.split(/\s+v\s+/);

    fixtures.push({
      date: currentDate,
      kickoff,
      utcOffset,
      group: currentGroup.label,
      groupId: currentGroup.id,
      homeTeam: normalizeWhitespace(homeTeam),
      awayTeam: normalizeWhitespace(awayTeam),
      venue: normalizeWhitespace(venue),
    });
  });

  return fixtures;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  return {
    data: await response.json(),
    headers: Object.fromEntries(response.headers.entries()),
  };
}

function parseGroupDefinitions(text) {
  const lines = text.split("\n");
  const groups = new Map();

  lines
    .filter((line) => line.startsWith("Group "))
    .forEach((line) => {
      const [groupLabel] = line.split("|");
      const label = normalizeWhitespace(groupLabel);
      groups.set(label, {
        id: label.split(" ")[1],
        label,
      });
    });

  return groups;
}

function toDateString(monthName, day, year = "2026") {
  return `${year}-${monthMap[monthName]}-${String(day).padStart(2, "0")}`;
}
