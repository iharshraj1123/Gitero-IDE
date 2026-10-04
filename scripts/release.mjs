import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: rootDir, stdio: 'inherit', ...options });
}

function runOutput(cmd, options = {}) {
  return execSync(cmd, { cwd: rootDir, stdio: ['pipe', 'pipe', 'pipe'], ...options }).toString().trim();
}

const args = process.argv.slice(2);
const buildInstaller = args.includes('--installer') || args.includes('-i');
const versionArg = args.find(a => !a.startsWith('-'));

if (!versionArg) {
  console.error('[release] Error: Missing version argument.');
  console.log('[release] Usage: npm run release <version> [-- --installer]');
  console.log('[release] Example: npm run release 0.4.5-beta -- --installer');
  process.exit(1);
}

const targetVersion = versionArg.replace(/^v/i, '');
console.log(`[release] Preparing release version: ${targetVersion}`);
if (buildInstaller) {
  console.log('[release] Installer build flag enabled (--installer)');
}

// 1. Pre-flight Checks
console.log('\n[release] Step 1/7: Pre-flight git status validation...');
try {
  const branch = runOutput('git rev-parse --abbrev-ref HEAD');
  console.log(`[release] Current active branch: ${branch}`);

  const status = runOutput('git status --porcelain');
  const dirtyLines = status.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.includes('dist/') || trimmed.includes('.storage/') || trimmed.includes('neutralino.log')) return false;
    return true;
  });

  if (dirtyLines.length > 0) {
    console.error('[release] Error: Uncommitted changes detected in working tree:');
    dirtyLines.forEach(l => console.error(`  ${l}`));
    console.error('[release] Please commit or stash changes before running release.');
    process.exit(1);
  }
} catch (err) {
  console.error('[release] Git pre-flight check failed:', err.message);
  process.exit(1);
}

// 2. Version Bump and Configuration Synchronization
console.log('\n[release] Step 2/7: Synchronizing version across project files...');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = targetVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

run('node scripts/sync-version.js');

// 3. Commit Version Bump and Push
console.log('\n[release] Step 3/7: Creating release commit and pushing to origin...');
const currentBranch = runOutput('git rev-parse --abbrev-ref HEAD');
run('git add package.json neutralino.config.json installer/gitero.iss README.md gemini.md docs/ src/version.ts');
run(`git commit -m "chore: release version ${targetVersion}"`);
run(`git push origin ${currentBranch}`);

const commitSha = runOutput('git rev-parse --short HEAD');
console.log(`[release] Release commit created at HEAD: ${commitSha}`);

// 4. Create and Push Git Tag
console.log(`\n[release] Step 4/7: Tagging v${targetVersion} and pushing tag...`);
try {
  run(`git tag v${targetVersion}`);
  run(`git push origin v${targetVersion}`);
} catch (e) {
  console.warn(`[release] Tag v${targetVersion} might already exist locally or remotely: ${e.message}`);
}

// 5. Compile Frontend Bundle and Verify Commit SHA
console.log('\n[release] Step 5/7: Compiling frontend bundle and verifying baked SHA...');
run('npx tsc');
run('npx vite build');
run('node scripts/verify-bundle.mjs');

// 6. Build Neutralino Package
console.log('\n[release] Step 6/7: Generating Neutralino runtime package (resources.neu)...');
run('npx @neutralinojs/neu build');

const resourcesNeu = path.join(rootDir, 'dist', 'gitero', 'resources.neu');
if (!fs.existsSync(resourcesNeu)) {
  console.error('[release] Error: resources.neu was not generated.');
  process.exit(1);
}

// 7. Optional Installer Compilation
let installerPath = '';
if (buildInstaller) {
  console.log('\n[release] Compiling Windows standalone installer...');
  try {
    run('cmd /c src-native\\explorer-hotkey\\build.bat');
  } catch (err) {
    console.warn('[release] Hotkey companion build step warning:', err.message);
  }

  const isccCmd = 'iscc installer/gitero.iss 2>nul || "C:\\Users\\ihars\\AppData\\Local\\Programs\\Inno Setup 6\\iscc.exe" installer/gitero.iss';
  run(isccCmd);

  installerPath = path.join(rootDir, 'installer-output', `Gitero-Setup-${targetVersion}.exe`);
  if (!fs.existsSync(installerPath)) {
    console.error(`[release] Error: Expected installer executable not found at ${installerPath}`);
    process.exit(1);
  }
  console.log(`[release] Installer successfully generated at: ${installerPath}`);
}

// 8. Publish Release on GitHub
console.log('\n[release] Step 7/7: Publishing release and assets on GitHub...');
const assetArgs = [`"${resourcesNeu}"`];
if (installerPath && fs.existsSync(installerPath)) {
  assetArgs.push(`"${installerPath}"`);
}

const releaseTitle = `Gitero IDE ${targetVersion}`;
const releaseNotes = `### Gitero IDE ${targetVersion} Release Notes\n\n- Automated release build for commit ${commitSha}.\n- In-app live hot-update runtime package (resources.neu).\n${installerPath ? `- Windows 64-bit standalone installer (Gitero-Setup-${targetVersion}.exe).\n` : ''}`;

try {
  run(`gh release create v${targetVersion} ${assetArgs.join(' ')} --title "${releaseTitle}" --notes "${releaseNotes}"`);
} catch {
  console.log(`[release] Release v${targetVersion} already exists on GitHub, uploading assets...`);
  run(`gh release upload v${targetVersion} ${assetArgs.join(' ')} --clobber`);
}

// 9. Update Continuous Rolling Branch Release
try {
  console.log(`[release] Updating rolling branch release (continuous-${currentBranch})...`);
  run(`gh release upload continuous-${currentBranch} "${resourcesNeu}" --clobber`);
} catch (e) {
  console.warn(`[release] Could not update rolling release continuous-${currentBranch}:`, e.message);
}

console.log(`\n======================================================`);
console.log(`[release] Version ${targetVersion} (${commitSha}) released successfully!`);
console.log(`[release] Tag: v${targetVersion}`);
console.log(`[release] Branch: ${currentBranch}`);
if (installerPath) {
  console.log(`[release] Installer: ${installerPath}`);
}
console.log(`======================================================\n`);
