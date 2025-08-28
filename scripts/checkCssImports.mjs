// Simple checker: scans source files for CSS imports/@imports and verifies targets exist
// Usage: node scripts/checkCssImports.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const SRC_DIR = path.join(root, 'src');

/** @param {string} p */
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
/** @param {string} p */
function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (isDir(full)) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const files = walk(SRC_DIR).filter(f => exts.has(path.extname(f)));

// import ... from '...css' or import '...css'
const reJsCss = /import\s+(?:[^'";]+\s+from\s+)?["']([^"']+\.css)["']/g;
// @import '...css' or @import "...css";
const reCssImport = /@import\s+["']([^"']+\.css)["']/g;

/** @type {{file:string, target:string, resolved:string}[]} */
const missing = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  const dir = path.dirname(file);
  if (/\.(?:[jt]sx?)$/.test(file)) {
    reJsCss.lastIndex = 0;
    while ((m = reJsCss.exec(content))) {
      const spec = m[1];
      if (spec.startsWith('http')) continue;
      const resolved = spec.startsWith('.') ? path.resolve(dir, spec) : path.resolve(root, 'node_modules', spec);
      if (!isFile(resolved)) missing.push({ file, target: spec, resolved });
    }
  }
  if (/\.css$/.test(file)) {
    reCssImport.lastIndex = 0;
    while ((m = reCssImport.exec(content))) {
      const spec = m[1];
      if (spec.startsWith('http')) continue;
      const resolved = spec.startsWith('.') ? path.resolve(dir, spec) : path.resolve(root, 'node_modules', spec);
      if (!isFile(resolved)) missing.push({ file, target: spec, resolved });
    }
  }
}

if (missing.length) {
  console.error(`\n❌ Missing CSS imports detected (${missing.length}):`);
  for (const r of missing) {
    console.error(`- in ${path.relative(root, r.file)} → '${r.target}' (resolved: ${path.relative(root, r.resolved)})`);
  }
  process.exit(1);
} else {
  console.log('✔ CSS imports OK');
}
