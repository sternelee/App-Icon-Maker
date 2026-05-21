import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "..");

const cssPath = path.join(webDir, "src/styles/global.css");
const css = fs.readFileSync(cssPath, "utf-8");

const result = await postcss([tailwindcss()]).process(css, {
	from: cssPath,
});

const outPath = path.join(webDir, "src/styles/tailwind.generated.css");
fs.writeFileSync(outPath, result.css);
console.log("Generated", outPath, result.css.length, "chars");

// Also write to packages/ui so the desktop app can import it
const pkgOutPath = path.join(
	webDir,
	"..",
	"packages/ui/tailwind.generated.css",
);
fs.writeFileSync(pkgOutPath, result.css);
console.log("Generated", pkgOutPath, result.css.length, "chars");
