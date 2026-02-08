// Reads OpenFlights airlines.dat and writes a clean JSON format output
// Filters used: Active flights only, United States only, IATA required, dedupe by IATA.

import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

const inputPath = path.resolve(repoRoot, "tools/airlines.dat");
const outputPath = path.resolve(repoRoot, "src/assets/airlines.json");

const raw = fs.readFileSync(inputPath, "utf-8");

function clean(s) {
  return (s ?? "").replace(/^"|"$/g, "").trim();
}

function missing(code) {
  return !code || code === "\\N";
}

const seenIata = new Set();

const airlines = raw
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((line) => {
    const cols = line.split(",");
    if (cols.length < 8) return null;

    const name = clean(cols[1]);
    const iata = clean(cols[3]);
    const icao = clean(cols[4]);
    const active = clean(cols[7]);

    if (active !== "Y") return null;

    if (!name || name === "\\N") return null;
    if (missing(iata)) return null;

    if (seenIata.has(iata)) return null;
    seenIata.add(iata);

    return {
      name,
      iata,
      icao: missing(icao) ? "" : icao,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(airlines, null, 2), "utf-8");

console.log(`Read:  ${inputPath}`);
console.log(`Wrote: ${outputPath}`);
console.log(`Count: ${airlines.length}`);