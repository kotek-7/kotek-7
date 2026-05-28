import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicFontDir = "public/fonts";
const generatedStylePath = "src/styles/fonts.generated.css";
const generatedPreloadPath = "src/components/FontPreloads.astro";
const layoutText = readFileSync("src/layouts/Layout.astro", "utf8");

function collectFiles(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(path, extensions);
      }

      return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
    })
    .sort();
}

const postContentSources = collectFiles("src/content/posts", [".md", ".mdx"]);

// 日本語フォントのフルサイズは大きいため、表示範囲ごとに必要なグリフだけを切り出す。
// /posts 配下は一覧と記事本文を同じサブセットにまとめ、ページ間のフォント再取得を避ける。
const routes = [
  { path: "/", key: "home", sources: ["src/pages/index.astro"], usesBodyBold: true },
  { path: "/about", key: "about", sources: ["src/pages/about.astro"], usesBodyBold: true },
  {
    path: "/activities",
    key: "activities",
    sources: ["src/pages/activities.astro"],
    usesBodyBold: false,
  },
  {
    path: "/posts",
    key: "posts",
    sources: [
      "src/pages/posts/index.astro",
      "src/pages/posts/[...id].astro",
      ...postContentSources,
    ],
    usesBodyBold: false,
  },
];

function uniqueCharacters(text) {
  return [...new Set([...text])].sort().join("");
}

function subsetFont({ source, stem, text }) {
  const temporaryPath = join(publicFontDir, `${stem}.tmp.woff2`);

  // 未使用グリフを除外しつつ、約物や日本語組版の挙動は元フォントに合わせる。
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
  [
    layoutText,
    ...routes.flatMap(({ sources }) => sources.map((source) => readFileSync(source, "utf8"))),
  ].join("\n"),
);

// 英字とアイコンフォントはサブセット化後のサイズが小さいため、全ページで共有してキャッシュを効かせる。
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

// 日本語の見出し・本文フォントは、各ページと共通レイアウトの文字だけを含むサブセットを生成する。
// 生成した Astro コンポーネント側で、現在のルートに対応するフォントを選ぶ。
const routeFonts = Object.fromEntries(
  routes.map(({ key, path, sources, usesBodyBold }) => {
    const text = uniqueCharacters(
      [layoutText, ...sources.map((source) => readFileSync(source, "utf8"))].join("\n"),
    );

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

// 共通フォントの @font-face は global CSS に出し、日本語フォントは FontPreloads.astro でページごとに埋め込む。
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

// 現在のルートで使うフォントだけを preload する。
// 記事ページは /posts 一覧と同じサブセットを再利用する。
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
