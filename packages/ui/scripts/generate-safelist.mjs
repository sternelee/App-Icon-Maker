import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentsDir = path.resolve(__dirname, "../src/components");

function extractClassesFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const classes = new Set();

  // Match className="..." or className={`...`} or className={cn("...", ...)}
  const regex = /className=(?:cn\()?{?[`"]([^`"]+)[`"]}?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1];
    // Remove template literal interpolations like ${...}
    const cleaned = raw.replace(/\$\{[^}]+\}/g, " ");
    // Split by whitespace and common separators
    cleaned.split(/[\s\n\r]+/).forEach((c) => {
      c = c.trim();
      // Keep valid-looking tailwind classes (contain dash, no quotes/parens)
      if (
        c &&
        c.includes("-") &&
        !c.includes('"') &&
        !c.includes("'") &&
        !c.includes("(") &&
        !c.includes(")")
      ) {
        classes.add(c);
      }
    });
  }

  // Also catch className={cn("...")} variants with nested quotes
  const cnRegex = /cn\([`"]([^`"]+)[`"]/g;
  while ((match = cnRegex.exec(content)) !== null) {
    match[1].split(/[\s\n\r]+/).forEach((c) => {
      c = c.trim();
      if (
        c &&
        c.includes("-") &&
        !c.includes('"') &&
        !c.includes("'") &&
        !c.includes("(") &&
        !c.includes(")")
      ) {
        classes.add(c);
      }
    });
  }

  return classes;
}

function collectAllClasses(dir) {
  const all = new Set();
  const files = fs.readdirSync(dir, { recursive: true });
  for (const file of files) {
    if (typeof file === "string" && file.endsWith(".tsx")) {
      const fp = path.join(dir, file);
      const classes = extractClassesFromFile(fp);
      for (const c of classes) all.add(c);
    }
  }
  return [...all].sort();
}

const classes = collectAllClasses(componentsDir);

// Filter out non-Tailwind-looking entries and known false positives
const tailwindLike = classes.filter((c) => {
  // Skip if it's just a number or looks like a CSS value
  if (/^(\d+|#[0-9a-f]+|rgba?|hsla?|oklch)/i.test(c)) return false;
  // Skip if it contains invalid chars
  if (/[;{}]/.test(c)) return false;
  return true;
});

// Split into chunks for @apply (too many classes in one line causes issues)
const chunkSize = 80;
const chunks = [];
for (let i = 0; i < tailwindLike.length; i += chunkSize) {
  chunks.push(tailwindLike.slice(i, i + chunkSize));
}

const css = `/* Auto-generated safelist for @app-icon-maker/ui */
/* Regenerate with: node scripts/generate-safelist.mjs */
@layer utilities {
${chunks
  .map(
    (chunk, i) => `  .ui-safelist-${i} {
    @apply ${chunk.join(" ")};
  }`,
  )
  .join("\n")}
}
`;

const outPath = path.resolve(__dirname, "../safelist.css");
fs.writeFileSync(outPath, css);
console.log(
  `Generated safelist.css with ${tailwindLike.length} classes in ${chunks.length} chunks`,
);
