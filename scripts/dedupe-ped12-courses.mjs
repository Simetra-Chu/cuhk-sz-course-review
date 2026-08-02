import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "data", "courses.json");
const courses = JSON.parse(fs.readFileSync(file, "utf8"));
const ped11 = courses.filter((c) => /^PED11\d{2}$/.test(c.code));
const ped12 = courses.filter((c) => /^PED12\d{2}$/.test(c.code));
const byEn = new Map(
  ped11.map((c) => [c.name_en.trim().toLowerCase(), c])
);

const toDelete = [];
for (const c of ped12) {
  const twin = byEn.get(c.name_en.trim().toLowerCase());
  if (!twin) continue;
  toDelete.push({ drop: c.code, keep: twin.code, name: c.name_en });
  const terms = new Set([
    ...(twin.offered_terms ?? []),
    ...(c.offered_terms ?? []),
  ]);
  twin.offered_terms = Array.from(terms).sort();
}

const dropSet = new Set(toDelete.map((x) => x.drop));
const next = courses.filter((c) => !dropSet.has(c.code));
fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(JSON.stringify(toDelete, null, 2));
console.log(`removed ${toDelete.length}, remaining ${next.length}`);
