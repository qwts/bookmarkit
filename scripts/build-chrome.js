// build-chrome.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, "../dist");
const publicDir = path.resolve(__dirname, "../public");
const rootDir = path.resolve(__dirname, "..");

// #51: popup.html is no longer copied from public/ — it's a real Vite entry point now
// (built to dist/popup.html with hashed assets). Copying a placeholder over it here
// would clobber the built popup.
["manifest.json", "background.js", "icon16.png", "icon48.png", "icon128.png"].forEach((file) => {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to dist.`);
  }
});

// Legal notices belong in every distributed extension archive, not only in
// the source repository.
["LICENSE", "THIRD-PARTY-NOTICES.md"].forEach((file) => {
  fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
  console.log(`Copied ${file} to dist.`);
});
