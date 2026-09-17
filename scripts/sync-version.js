import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

if (!version) {
  console.error('[sync-version] Error: No version found in package.json');
  process.exit(1);
}

console.log(`[sync-version] Synchronizing project version to ${version}...`);

const stagedFiles = [];

function updateFile(relPath, transform) {
  const absPath = path.join(rootDir, relPath);
  if (!fs.existsSync(absPath)) return;
  const content = fs.readFileSync(absPath, 'utf8');
  const updated = transform(content);
  if (updated !== content) {
    fs.writeFileSync(absPath, updated, 'utf8');
    console.log(`[sync-version] Updated ${relPath} -> ${version}`);
    stagedFiles.push(relPath);
  } else {
    console.log(`[sync-version] ${relPath} is already up-to-date (${version})`);
  }
}

// 1. Sync neutralino.config.json
updateFile('neutralino.config.json', (content) => {
  const neu = JSON.parse(content);
  if (neu.version !== version) {
    neu.version = version;
    return JSON.stringify(neu, null, 2) + '\n';
  }
  return content;
});

// 2. Sync installer/gitero.iss
updateFile('installer/gitero.iss', (content) => {
  return content.replace(/#define\s+MyAppVersion\s+"[^"]+"/, `#define MyAppVersion "${version}"`);
});

// 3. Sync README.md (Shield badge and Quick Start installer link)
updateFile('README.md', (content) => {
  const badgeEscaped = version.replace(/-/g, '--');
  let res = content.replace(
    /(https:\/\/img\.shields\.io\/badge\/version-)[^)]+(-blue\.svg\?style=flat-square)/g,
    `$1${badgeEscaped}$2`
  );
  res = res.replace(
    /Gitero-Setup-[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?\.exe/g,
    `Gitero-Setup-${version}.exe`
  );
  return res;
});

// 4. Sync gemini.md
updateFile('gemini.md', (content) => {
  let res = content.replace(
    /(\*\s*\*\*Current Version\*\*:\s*`)[^`\r\n]+(`)/g,
    `$1${version}$2`
  );
  res = res.replace(
    /Gitero-Setup-[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?\.exe/g,
    `Gitero-Setup-${version}.exe`
  );
  return res;
});

// 5. Sync all markdown documentation files in docs/
const docsDir = path.join(rootDir, 'docs');
if (fs.existsSync(docsDir)) {
  const docFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
  for (const docFile of docFiles) {
    updateFile(path.join('docs', docFile), (content) => {
      let res = content.replace(
        /Gitero-Setup-[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?\.exe/g,
        `Gitero-Setup-${version}.exe`
      );
      res = res.replace(
        /(- \*\*Version\*\*:\s*Current semantic version \(e\.g\.,\s*`)[^`\r\n]+(`\)\.)/g,
        `$1${version}$2`
      );
      return res;
    });
  }
}

// 6. Sync fallback default in src/version.ts
updateFile('src/version.ts', (content) => {
  let res = content.replace(
    /(\(\(typeof window !== 'undefined' && \(window as any\)\.NL_APPVERSION\) \? \(window as any\)\.NL_APPVERSION : ')[^']+/g,
    `$1${version}`
  );
  res = res.replace(
    /(\/\*\*[\s\S]*?Formatted display version \(e\.g\. "v)[^"]+("\)[\s\S]*?\*\/)/g,
    `$1${version}$2`
  );
  return res;
});

// 7. Stage updated files if executed during npm version lifecycle or with --stage
if (process.env.npm_lifecycle_event === 'version' || process.argv.includes('--stage')) {
  if (stagedFiles.length > 0) {
    try {
      const fileList = stagedFiles.map((f) => `"${f}"`).join(' ');
      execSync(`git add ${fileList}`, { cwd: rootDir, stdio: 'inherit' });
      console.log(`[sync-version] Staged ${stagedFiles.length} file(s) for git commit.`);
    } catch (e) {
      console.warn('[sync-version] Note: Could not auto-stage files via git:', e.message);
    }
  }
}

console.log('[sync-version] Version synchronization complete.');
