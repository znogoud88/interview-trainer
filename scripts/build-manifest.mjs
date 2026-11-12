// Scans topics/<category>/*.md and writes topics.json for the page (the card text is embedded, so the site works offline from one file).
// Runs in the GitHub Pages workflow on every push; run it locally before `node scripts/serve.mjs`.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const categories = JSON.parse(fs.readFileSync(path.join(root, "categories.json"), "utf8"));
const SECTIONS = ["Что это", "Пример", "Подводные камни", "Вопросы вдогонку"];
const LEVELS = new Set(["junior", "middle", "senior"]);

const topics = [];
let warnings = 0;
const warn = (m) => { warnings++; console.warn("  " + m); };

for (const cat of categories) {
  const dir = path.join(root, "topics", cat.id);
  if (!fs.existsSync(dir)) { warn(cat.id + ": no topics folder"); continue; }
  for (const file of fs.readdirSync(dir).sort()) {
    if (path.extname(file) !== ".md") continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) { warn(cat.id + "/" + file + ": no frontmatter, skipped"); continue; }
    const meta = {};
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(["'«])(.*)(["'»])$/, "$2");
    }
    const md = m[2].trim();
    const slug = path.basename(file, ".md");
    if (!meta.title) { warn(cat.id + "/" + file + ": no title, skipped"); continue; }
    if (meta.category && meta.category !== cat.id) warn(cat.id + "/" + file + ": frontmatter category is " + meta.category + ", folder wins");
    if (meta.level && !LEVELS.has(meta.level)) warn(cat.id + "/" + file + ": unknown level " + meta.level);
    for (const s of SECTIONS) if (!new RegExp("^## " + s + "\\s*$", "m").test(md)) warn(cat.id + "/" + file + ": no section «" + s + "»");
    topics.push({ id: cat.id + "/" + slug, category: cat.id, slug, title: meta.title, level: meta.level || "middle", md });
  }
}

fs.writeFileSync(path.join(root, "topics.json"), JSON.stringify({ built: new Date().toISOString(), topics }, null, 1) + "\n");
console.log("topics.json: " + topics.length + " topics in " + categories.length + " categories" + (warnings ? ", " + warnings + " warning(s)" : ""));
