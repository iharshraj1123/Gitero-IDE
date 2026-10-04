import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const assetsDir = path.join(rootDir, 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('[verify-bundle] Error: dist/assets directory not found. Run npm run build first.');
  process.exit(1);
}

let expectedSha = 'HEAD';
try {
  expectedSha = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim().toLowerCase();
} catch (e) {
  console.warn('[verify-bundle] Warning: Could not resolve git HEAD SHA:', e.message);
  process.exit(0);
}

const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('[verify-bundle] Error: No JavaScript bundles found in dist/assets.');
  process.exit(1);
}

let matched = false;
for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  if (content.toLowerCase().includes(expectedSha)) {
    matched = true;
    console.log(`[verify-bundle] Success: Verified commit SHA "${expectedSha}" is baked into ${file}`);
    break;
  }
}

if (!matched) {
  console.error(`[verify-bundle] Error: Bundle does NOT contain current git HEAD SHA (${expectedSha}).`);
  console.error('[verify-bundle] The bundle was likely compiled before the latest git commit was created.');
  process.exit(1);
}
