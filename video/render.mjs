/**
 * render.mjs — Non-interactive Remotion render script
 *
 * Usage:
 *   node render.mjs \
 *     --props-file=props.example.json \
 *     --out=/tmp/reel.mp4 \
 *     [--composition=PostReel] \
 *     [--duration=60]
 *
 * Or inline props:
 *   node render.mjs --props='{"mediaUrl":"...","mediaType":"photo",...}' --out=out.mp4
 *
 * ENV:
 *   REMOTION_BROWSER_EXECUTABLE=/tmp/chromium   (use a pre-installed Chromium)
 *
 * NOTE on local files:
 *   If mediaUrl is a local path (not http/https), the file is copied to the
 *   project's public/ folder so Remotion's dev server can serve it to the
 *   browser. The mediaUrl prop is then replaced with the public-relative path
 *   (e.g. "media/<filename>"). The PostReel component calls staticFile() on it.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  existsSync,
  readFileSync,
  copyFileSync,
  mkdirSync,
} from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Parse CLI flags ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/s);
    if (match) {
      result[match[1]] = match[2];
    } else if (arg.startsWith("--")) {
      result[arg.slice(2)] = true;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

// ─── Load props ───────────────────────────────────────────────────────────
let inputProps = {};

if (args["props-file"]) {
  const propsPath = resolve(process.cwd(), args["props-file"]);
  if (!existsSync(propsPath)) {
    console.error(`RENDER_FAIL props-file not found: ${propsPath}`);
    process.exit(1);
  }
  try {
    inputProps = JSON.parse(readFileSync(propsPath, "utf-8"));
  } catch (e) {
    console.error(`RENDER_FAIL failed to parse props-file: ${e.message}`);
    process.exit(1);
  }
} else if (args["props"]) {
  try {
    inputProps = JSON.parse(args["props"]);
  } catch (e) {
    console.error(`RENDER_FAIL failed to parse --props JSON: ${e.message}`);
    process.exit(1);
  }
}

// ─── Override durationInFrames ────────────────────────────────────────────
if (args["duration"]) {
  const dur = parseInt(args["duration"], 10);
  if (!isNaN(dur) && dur > 0) {
    inputProps.durationInFrames = dur;
  }
}

// ─── Resolve mediaUrl: local file → copy to public/ and use relative path ─
// Remotion's bundler serves the public/ directory at the root of its dev server.
// We copy the file there and pass the relative path so the component can call
// staticFile("media/<name>") which resolves to the served URL.
if (
  inputProps.mediaUrl &&
  !inputProps.mediaUrl.startsWith("http://") &&
  !inputProps.mediaUrl.startsWith("https://")
) {
  const absMedia = resolve(process.cwd(), inputProps.mediaUrl);
  if (existsSync(absMedia)) {
    const publicMediaDir = resolve(__dirname, "public", "media");
    mkdirSync(publicMediaDir, { recursive: true });
    const destName = basename(absMedia);
    const destPath = resolve(publicMediaDir, destName);
    copyFileSync(absMedia, destPath);
    // Pass the public-relative path — PostReel wraps it with staticFile()
    inputProps.mediaUrl = `media/${destName}`;
    inputProps._isLocalMedia = true;
    console.log(`[render] Local media copied → public/${inputProps.mediaUrl}`);
  } else {
    console.warn(`[render] WARN: mediaUrl path not found: ${absMedia}`);
  }
}

// ─── Config ───────────────────────────────────────────────────────────────
const compositionId = args["composition"] || "PostReel";
const outPath = args["out"]
  ? resolve(process.cwd(), args["out"])
  : resolve(process.cwd(), "out.mp4");

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
const entryPoint = resolve(__dirname, "src/index.jsx");
const publicDir = resolve(__dirname, "public");

console.log(`[render] entry     : ${entryPoint}`);
console.log(`[render] composition: ${compositionId}`);
console.log(`[render] output    : ${outPath}`);
console.log(`[render] props     :`, JSON.stringify(inputProps, null, 2));
if (browserExecutable) {
  console.log(`[render] browser   : ${browserExecutable}`);
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  // 1. Bundle (include public dir)
  console.log("[render] Bundling...");
  let bundled;
  try {
    bundled = await bundle({
      entryPoint,
      publicDir,
      webpackOverride: (config) => config,
    });
    console.log(`[render] Bundle ready: ${bundled}`);
  } catch (e) {
    console.error(`RENDER_FAIL bundling failed: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }

  // 2. Select composition (resolves durationInFrames from defaultProps or inputProps)
  console.log("[render] Selecting composition...");
  let composition;
  try {
    composition = await selectComposition({
      serveUrl: bundled,
      id: compositionId,
      inputProps,
      ...(browserExecutable ? { browserExecutable } : {}),
    });
    console.log(
      `[render] Composition: ${composition.id} — ${composition.durationInFrames} frames @ ${composition.fps}fps`
    );
  } catch (e) {
    console.error(`RENDER_FAIL selectComposition failed: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }

  // 3. Render
  console.log("[render] Rendering...");
  try {
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
      ...(browserExecutable ? { browserExecutable } : {}),
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        process.stdout.write(`\r[render] Progress: ${pct}%   `);
      },
    });
    console.log(`\nRENDER_OK ${outPath}`);
  } catch (e) {
    console.error(`\nRENDER_FAIL rendering failed: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
