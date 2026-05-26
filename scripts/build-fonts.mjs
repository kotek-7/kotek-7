import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicFontDir = "public/fonts";
const generatedStylePath = "src/styles/fonts.generated.css";
const generatedPreloadPath = "src/components/FontPreloads.astro";
const layoutText = readFileSync("src/layouts/Layout.astro", "utf8");

const routes = [
  { path: "/", key: "home", source: "src/pages/index.astro", usesBodyBold: true },
  { path: "/about", key: "about", source: "src/pages/about.astro", usesBodyBold: true },
  { path: "/activities", key: "activities", source: "src/pages/activities.astro", usesBodyBold: false },
  { path: "/posts", key: "posts", source: "src/pages/posts/index.astro", usesBodyBold: false },
];

function uniqueCharacters(text) {
  return [...new Set([...text])].sort().join("");
}

function subsetFont({ source, stem, text }) {
  const temporaryPath = join(publicFontDir, `${stem}.tmp.woff2`);

  execFileSync("pyftsubset", [
    source,
    `--text=${text}`,
    "--layout-features=*",
    "--flavor=woff2",
    `--output-file=${temporaryPath}`,
  ]);

  const contents = readFileSync(temporaryPath);
  const hash = createHash("sha256").update(contents).digest("hex").slice(0, 10);
  const filename = `${stem}.${hash}.woff2`;

  writeFileSync(join(publicFontDir, filename), contents);
  rmSync(temporaryPath);

  const size = (contents.byteLength / 1024).toFixed(1);
  console.log(`${filename}: ${size} KiB`);

  return filename;
}

mkdirSync(publicFontDir, { recursive: true });

for (const file of readdirSync(publicFontDir)) {
  if (file.endsWith(".woff2")) {
    rmSync(join(publicFontDir, file));
  }
}

const commonText = uniqueCharacters(
  [layoutText, ...routes.map(({ source }) => readFileSync(source, "utf8"))].join("\n"),
);

const commonFonts = {
  jostRegular: subsetFont({
    source: "font-source/Jost-Regular.ttf",
    stem: "jost-regular",
    text: commonText,
  }),
  jostBold: subsetFont({
    source: "font-source/Jost-Bold.ttf",
    stem: "jost-bold",
    text: commonText,
  }),
  symbols: subsetFont({
    source: "font-source/MaterialSymbolsOutlined-Regular.ttf",
    stem: "material-symbols-outlined",
    text: "open_in_new",
  }),
};

const routeFonts = Object.fromEntries(
  routes.map(({ key, path, source, usesBodyBold }) => {
    const text = uniqueCharacters(`${layoutText}\n${readFileSync(source, "utf8")}`);

    return [
      path,
      {
        heading: subsetFont({
          source: "font-source/FOT-TsukuAntiqueLGoStd-B.otf",
          stem: `${key}-tsukushi-antique-gothic-bold`,
          text,
        }),
        body: subsetFont({
          source: "font-source/FOT-DNPShueiGoGinStd-L.otf",
          stem: `${key}-dnp-shuei-go-gin-regular`,
          text,
        }),
        bodyBold: usesBodyBold
          ? subsetFont({
              source: "font-source/FOT-DNPShueiGoGinStd-B.otf",
              stem: `${key}-dnp-shuei-go-gin-bold`,
              text,
            })
          : null,
      },
    ];
  }),
);

const css = `@font-face {
  font-family: "Jost";
  src: url("/fonts/${commonFonts.jostRegular}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Jost";
  src: url("/fonts/${commonFonts.jostBold}") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Material Symbols Outlined";
  src: url("/fonts/${commonFonts.symbols}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`;

const preloadComponent = `---
const pathname = Astro.url.pathname.replace(/\\/+$/, "") || "/";
const routePath = pathname.startsWith("/posts/") ? "/posts" : pathname;
const fonts = ${JSON.stringify(routeFonts, null, 2)}[routePath] ?? ${JSON.stringify(routeFonts["/"])};
const commonFonts = ${JSON.stringify(commonFonts, null, 2)};
const bodyBoldFontFace = fonts.bodyBold ? \`

@font-face {
  font-family: "DNP Shuei Go Gin";
  src: url("/fonts/\${fonts.bodyBold}") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}\` : "";
const japaneseFontFaces = \`@font-face {
  font-family: "Tsukushi Antique Gothic";
  src: url("/fonts/\${fonts.heading}") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "DNP Shuei Go Gin";
  src: url("/fonts/\${fonts.body}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}\${bodyBoldFontFace}\`;
---

<style is:inline set:html={japaneseFontFaces}></style>
<link rel="preload" href={\`/fonts/\${fonts.heading}\`} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={\`/fonts/\${fonts.body}\`} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={\`/fonts/\${commonFonts.jostRegular}\`} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={\`/fonts/\${commonFonts.jostBold}\`} as="font" type="font/woff2" crossorigin />
`;

writeFileSync(generatedStylePath, css);
writeFileSync(generatedPreloadPath, preloadComponent);
