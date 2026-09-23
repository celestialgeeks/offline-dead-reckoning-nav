#!/usr/bin/env node
// PS168 — Release APK sanity gate (run BEFORE publishing a release)
//
// Usage:
//   node tools/verify_release_apk.js [apkPath] [expectedVersion]
//   apkPath          default: android/app/build/outputs/apk/release/app-release.apk
//   expectedVersion  default: version from package.json
//
// Why this exists: the v1.0.10 release shipped with a STALE Hermes JS bundle —
// Gradle's createBundleReleaseJsAndAssets task did not re-run after the version
// bump, so the APK's native versionName was 1.0.10 while the bundled JS still
// reported 1.0.9. The in-app updater (which compares the GitHub tag against the
// JS-side pkg.version) then prompted forever, and reinstalling the same APK via
// "Update Now" never resolved it.
//
// Checks:
//   1. The APK contains assets/index.android.bundle.
//   2. The bundle's string table contains the expected version literal
//      (a stale bundle built before the bump cannot contain it).
//   3. Best effort: if aapt2 from the Android SDK is available, the APK's
//      versionName must equal the expected version and versionCode must equal
//      app.json's expo.android.versionCode.
//
// Release checklist:
//   cd android && ./gradlew clean          # NEVER skip: purges stale bundles
//   cd android && ./gradlew :app:assembleRelease --console=plain -x lint
//   node tools/verify_release_apk.js       # must exit 0 before gh release create
//
// Exits non-zero on any failed check.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const apkPath = path.resolve(
  process.argv[2] || 'android/app/build/outputs/apk/release/app-release.apk'
);
const pkg = require('../package.json');
const appJson = require('../app.json');
const expectedVersion = process.argv[3] || pkg.version;
const expectedVersionCode = appJson.expo?.android?.versionCode;

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

console.log(`Verifying ${apkPath}`);
console.log(`Expected: versionName ${expectedVersion}, versionCode ${expectedVersionCode}\n`);

if (!fs.existsSync(apkPath)) {
  console.error(`APK not found: ${apkPath}`);
  process.exit(1);
}

// --- 1+2: JS bundle freshness ---------------------------------------------
let bundle;
try {
  bundle = execFileSync('unzip', ['-p', apkPath, 'assets/index.android.bundle'], {
    maxBuffer: 512 * 1024 * 1024,
  });
} catch (err) {
  fail(`APK has no assets/index.android.bundle (${err.message})`);
  bundle = null;
}

if (bundle) {
  pass('assets/index.android.bundle present');
  const hay = bundle.toString('latin1');
  const hits = hay.split(expectedVersion).length - 1;
  if (hits > 0) {
    pass(`bundle string table contains "${expectedVersion}" (${hits}×)`);
  } else {
    fail(
      `bundle does NOT contain "${expectedVersion}" — STALE JS bundle baked into the APK. ` +
        'Run `./gradlew clean` and rebuild before publishing.'
    );
  }
}

// --- 3: best-effort native manifest check via aapt2 ------------------------
function findAapt2() {
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!root) return null;
  const bt = path.join(root, 'build-tools');
  if (!fs.existsSync(bt)) return null;
  const versions = fs.readdirSync(bt).sort().reverse();
  for (const v of versions) {
    const candidate = path.join(bt, v, 'aapt2');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const aapt2 = findAapt2();
if (aapt2) {
  try {
    const badging = execFileSync(aapt2, ['dump', 'badging', apkPath], {
      maxBuffer: 16 * 1024 * 1024,
    }).toString();
    const versionName = /versionName='([^']+)'/.exec(badging)?.[1];
    const versionCode = /versionCode='([^']+)'/.exec(badging)?.[1];
    if (versionName === expectedVersion) {
      pass(`manifest versionName = ${versionName}`);
    } else {
      fail(`manifest versionName = ${versionName}, expected ${expectedVersion}`);
    }
    if (String(versionCode) === String(expectedVersionCode)) {
      pass(`manifest versionCode = ${versionCode}`);
    } else {
      fail(`manifest versionCode = ${versionCode}, expected ${expectedVersionCode}`);
    }
  } catch (err) {
    console.log(`  ! aapt2 dump failed, skipping manifest check (${err.message})`);
  }
} else {
  console.log('  ! aapt2 not found (ANDROID_HOME unset?), skipping manifest check');
}

console.log(failed ? '\nFAILED — do not publish this APK.' : '\nOK — safe to publish.');
process.exit(failed ? 1 : 0);
