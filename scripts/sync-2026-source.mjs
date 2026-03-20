import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const files = [
  {
    url: "https://raw.githubusercontent.com/openfootball/worldcup/master/2014--brazil/cup.txt",
    target: resolve(rootDir, "data", "source", "worldcup-2014-openfootball-cup.txt"),
  },
  {
    url: "https://raw.githubusercontent.com/openfootball/worldcup/master/2018--russia/cup.txt",
    target: resolve(rootDir, "data", "source", "worldcup-2018-openfootball-cup.txt"),
  },
  {
    url: "https://raw.githubusercontent.com/openfootball/worldcup/master/2022--qatar/cup.txt",
    target: resolve(rootDir, "data", "source", "worldcup-2022-openfootball-cup.txt"),
  },
  {
    url: "https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup.txt",
    target: resolve(rootDir, "data", "source", "worldcup-2026-openfootball-cup.txt"),
  },
  {
    url: "https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup_finals.txt",
    target: resolve(rootDir, "data", "source", "worldcup-2026-openfootball-cup_finals.txt"),
  },
];

for (const file of files) {
  const response = await fetch(file.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${file.url}: HTTP ${response.status}`);
  }

  writeFileSync(file.target, await response.text());
  console.log(`Synced ${file.target}`);
}
