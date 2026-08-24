// onnxruntime-web loads its WASM binaries at runtime. A static export has no
// bundler hook for that, so we copy them into public/ort/ and point ORT there.
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const dst = path.join(process.cwd(), "public", "ort");

if (!existsSync(src)) {
  console.error("onnxruntime-web not installed; run npm install first");
  process.exit(1);
}
await mkdir(dst, { recursive: true });
const files = (await readdir(src)).filter((f) => f.endsWith(".wasm") || f.endsWith(".mjs"));
for (const f of files) await cp(path.join(src, f), path.join(dst, f));
console.log(`copied ${files.length} onnxruntime assets -> public/ort/`);
