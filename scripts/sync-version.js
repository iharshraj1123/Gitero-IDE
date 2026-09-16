import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const neuPath = path.join(rootDir, 'neutralino.config.json');
const issPath = path.join(rootDir, 'installer', 'gitero.iss');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

if (!version) {
  console.error('[sync-version] Error: No version found in package.json');
  process.exit(1);
}

console.log(`[sync-version] Synchronizing project version to ${version}...`);

let modified = false;

// 1. Sync neutralino.config.json
if (fs.existsSync(neuPath)) {
  const neu = JSON.parse(fs.readFileSync(neuPath, 'utf8'));
  if (neu.version !== version) {
    neu.version = version;
    fs.writeFileSync(neuPath, JSON.stringify(neu, null, 2) + '\n', 'utf8');
    console.log(`[sync-version] Updated neutralino.config.json -> ${version}`);
    modified = true;
  } else {
    console.log(`[sync-version] neutralino.config.json is already up-to-date (${version})`);
  }
}

// 2. Sync installer/gitero.iss
if (fs.existsSync(issPath)) {
  const iss = fs.readFileSync(issPath, 'utf8');
  const issRegex = /#define\s+MyAppVersion\s+"[^"]+"/;
  if (issRegex.test(iss)) {
    const updated = iss.replace(issRegex, `#define MyAppVersion "${version}"`);
    if (updated !== iss) {
      fs.writeFileSync(issPath, updated, 'utf8');
      console.log(`[sync-version] Updated installer/gitero.iss -> ${version}`);
      modified = true;
    } else {
      console.log(`[sync-version] installer/gitero.iss is already up-to-date (${version})`);
    }
  } else {
    console.warn('[sync-version] Warning: #define MyAppVersion not found in installer/gitero.iss');
  }
}

// 3. Stage updated files if executed during npm version lifecycle or with --stage
if (process.env.npm_lifecycle_event === 'version' || process.argv.includes('--stage')) {
  try {
    execSync('git add neutralino.config.json installer/gitero.iss', { cwd: rootDir, stdio: 'inherit' });
    console.log('[sync-version] Staged neutralino.config.json and installer/gitero.iss for git commit.');
  } catch (e) {
    console.warn('[sync-version] Note: Could not auto-stage files via git:', e.message);
  }
}

console.log('[sync-version] Version synchronization complete.');
