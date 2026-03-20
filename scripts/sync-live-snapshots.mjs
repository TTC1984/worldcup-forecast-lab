import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  fetchJson,
  formatUtcWindowEnd,
  formatUtcWindowStart,
  loadOptionalEnvFiles,
  parseWorldCupFixtures,
  resolveProjectPaths,
  writeJson,
} from "./live-data-utils.mjs";

const { rootDir, sourceDir, liveDir } = resolveProjectPaths(import.meta.url);
loadOptionalEnvFiles(rootDir);

const groupStageSource = readFileSync(resolve(sourceDir, "worldcup-2026-openfootball-cup.txt"), "utf8");
const fixtures = parseWorldCupFixtures(groupStageSource);
const dateRange = {
  start: fixtures[0]?.date,
  end: fixtures[fixtures.length - 1]?.date,
};

const summaries = [];

if (process.env.SPORTMONKS_API_TOKEN && process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID) {
  summaries.push(await syncSportmonksSnapshot());
}

if (process.env.THE_ODDS_API_KEY && process.env.THE_ODDS_API_SPORT_KEY) {
  summaries.push(await syncTheOddsApiSnapshot());
}

if (summaries.length === 0) {
  console.error(
    "没有检测到可用的实时数据配置。请先在 `.env.local` 或环境变量里设置 `SPORTMONKS_API_TOKEN` / `SPORTMONKS_WORLD_CUP_LEAGUE_ID` 或 `THE_ODDS_API_KEY` / `THE_ODDS_API_SPORT_KEY`。"
  );
  process.exit(1);
}

summaries.forEach((summary) => console.log(summary));

async function syncSportmonksSnapshot() {
  const include = [
    "participants",
    "venue",
    "state",
    "lineups",
    "expectedLineups",
    "sidelined",
    "prematchNews",
  ].join(";");
  const allRows = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      `https://api.sportmonks.com/v3/football/fixtures/between/date/${dateRange.start}/${dateRange.end}`
    );
    url.searchParams.set("api_token", process.env.SPORTMONKS_API_TOKEN);
    url.searchParams.set("include", include);
    url.searchParams.set("filters", `fixtureLeagues:${process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID}`);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("page", String(page));

    const response = await fetchJson(url);
    const payload = response.data;
    const rows = payload.data || [];
    allRows.push(...rows);

    const pagination = payload.pagination || payload.meta?.pagination || {};
    hasMore = Boolean(pagination.has_more);
    page += 1;
  }

  const outputPath = resolve(liveDir, "sportmonks-worldcup.json");
  writeJson(outputPath, {
    provider: "sportmonks",
    syncedAt: new Date().toISOString(),
    request: {
      range: dateRange,
      include,
      leagueId: process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID,
    },
    resultCount: allRows.length,
    data: allRows,
  });

  return `Sportmonks snapshot saved: ${allRows.length} fixtures -> data/source/live/sportmonks-worldcup.json`;
}

async function syncTheOddsApiSnapshot() {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${process.env.THE_ODDS_API_SPORT_KEY}/odds/`);
  url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY);
  url.searchParams.set("regions", process.env.THE_ODDS_REGIONS || "eu");
  url.searchParams.set("markets", process.env.THE_ODDS_MARKETS || "h2h,totals");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  url.searchParams.set("commenceTimeFrom", formatUtcWindowStart(dateRange.start));
  url.searchParams.set("commenceTimeTo", formatUtcWindowEnd(dateRange.end));

  const response = await fetchJson(url);
  const outputPath = resolve(liveDir, "the-odds-api-worldcup.json");
  writeJson(outputPath, {
    provider: "the-odds-api",
    syncedAt: new Date().toISOString(),
    request: {
      sportKey: process.env.THE_ODDS_API_SPORT_KEY,
      regions: process.env.THE_ODDS_REGIONS || "eu",
      markets: process.env.THE_ODDS_MARKETS || "h2h,totals",
      range: dateRange,
    },
    quota: {
      remaining: response.headers["x-requests-remaining"] || null,
      used: response.headers["x-requests-used"] || null,
      last: response.headers["x-requests-last"] || null,
    },
    resultCount: Array.isArray(response.data) ? response.data.length : 0,
    data: response.data,
  });

  return `The Odds API snapshot saved: ${Array.isArray(response.data) ? response.data.length : 0} events -> data/source/live/the-odds-api-worldcup.json`;
}
