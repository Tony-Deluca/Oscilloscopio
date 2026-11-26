// Rigenera banco-rc.html, la versione autonoma, da index.html e dai sorgenti.
// Uso: node tools/build-standalone.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => fs.readFileSync(root + name, "utf8");
let html = read("index.html");
const replace = (pattern, text) => {
  if (!html.includes(pattern)) throw new Error("Manca in index.html: " + pattern);
  html = html.replace(pattern, () => text);
};
replace(
  '    <link rel="stylesheet" href="style.css" />\n',
  "    <style>\n" + read("style.css") + "    </style>\n",
);
replace('    <script defer src="physics.js"></script>\n', "");
replace('    <script defer src="bench.js"></script>\n', "");
// La versione autonoma è un file solo: niente manifest, icone esterne né
// service worker, che richiedono i file accanto e un server http(s).
for (const line of [
  '    <link rel="manifest" href="manifest.webmanifest" />\n',
  '    <link rel="icon" href="icons/icon.svg" type="image/svg+xml" />\n',
  '    <link rel="apple-touch-icon" href="icons/icon-192.png" />\n',
  '    <script defer src="pwa.js"></script>\n',
])
  replace(line, "");
replace(
  "  </body>",
  "    <script>\n" + read("physics.js") + "    </script>\n" +
    "    <script>\n" + read("bench.js") + "    </script>\n  </body>",
);
fs.writeFileSync(root + "banco-rc.html", html);
console.log("banco-rc.html rigenerato");
