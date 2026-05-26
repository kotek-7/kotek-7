import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const fontDir = "dist/fonts";
const pages = [
  "dist/index.html",
  "dist/about/index.html",
  "dist/activities/index.html",
  "dist/posts/index.html",
];
const fontFiles = readdirSync(fontDir).map((file) => ({
  file,
  bytes: statSync(join(fontDir, file)).size,
}));

const problems = [];
const maximumFontBytes = 225 * 1024;
const maximumCombinedFontBytes = 1250 * 1024;

for (const { file, bytes } of fontFiles) {
  if (extname(file) !== ".woff2") {
    problems.push(`Unexpected public font format: ${file}`);
  }

  if (bytes > maximumFontBytes) {
    problems.push(`Font exceeds 225 KiB budget: ${file} (${bytes} bytes)`);
  }
}

const combinedFontBytes = fontFiles.reduce((total, { bytes }) => total + bytes, 0);

if (combinedFontBytes > maximumCombinedFontBytes) {
  problems.push(`Combined fonts exceed 1250 KiB budget: ${combinedFontBytes} bytes`);
}

for (const page of pages) {
  const html = readFileSync(page, "utf8");

  if (html.includes("fonts.googleapis.com") || html.includes("fonts.gstatic.com")) {
    problems.push(`External font dependency found in ${page}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`Font asset budget passed: ${(combinedFontBytes / 1024).toFixed(1)} KiB total.`);
