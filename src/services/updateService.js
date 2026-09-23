// PS168 — In-App GitHub Releases Auto-Updater Service
// Checks GitHub Releases API for new APK releases and delivers updates directly to user's phone

import * as FileSystem from 'expo-file-system/legacy';
import { loadJson, setJson } from './jsonStore';
import pkg from '../../package.json';

export const CURRENT_APP_VERSION = pkg.version;
export const GITHUB_REPO = 'celestialgeeks/ps168-releases';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

/**
 * Semver comparison: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1, v2) {
  const parse = (v) => {
    const clean = (v || '').replace(/^v/i, '').trim();
    const parts = clean.split('-');
    const nums = parts[0].split('.').map((n) => parseInt(n, 10) || 0);
    const prerelease = parts[1] || '';
    return { nums, prerelease };
  };

  const p1 = parse(v1);
  const p2 = parse(v2);
  const len = Math.max(p1.nums.length, p2.nums.length);

  for (let i = 0; i < len; i++) {
    const num1 = p1.nums[i] || 0;
    const num2 = p2.nums[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // If numeric parts equal, release without prerelease tag is higher than prerelease
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Update snooze: remembers the latest version the user dismissed with
 * "Later" so the startup auto-check does not re-prompt on every launch.
 * Manual checks (User Menu / Debug) always show the dialog again.
 */
const SNOOZE_FILE = FileSystem.documentDirectory + 'update_snooze.json';

// Stored value is { version, at } or null. Validate tolerates both so a corrupt
// file is quarantined rather than crashing the update check.
const isSnooze = (v) => v === null || (!!v && typeof v === 'object');
const snoozeOpts = { fallback: null, validate: isSnooze };

export async function getSnoozedVersion() {
  const stored = await loadJson(SNOOZE_FILE, snoozeOpts);
  return (stored && stored.version) || null;
}

export async function snoozeUpdate(version) {
  try {
    await setJson(
      SNOOZE_FILE,
      { version: version || null, at: new Date().toISOString() },
      snoozeOpts
    );
  } catch (err) {
    console.warn('[updateService] Save snooze failed:', err);
  }
}

/**
 * Query GitHub Releases API for the latest release
 * @param {string} currentVersion - Defaults to CURRENT_APP_VERSION
 * @returns {Promise<object>} update metadata
 */
export async function checkForUpdates(currentVersion = CURRENT_APP_VERSION) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'PS168-Navigator-Updater',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { updateAvailable: false, error: `HTTP ${response.status}` };
    }

    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      return { updateAvailable: false, error: 'No releases found' };
    }

    // Get the latest non-draft release
    const targetRelease = releases.find((r) => !r.draft);

    if (!targetRelease) {
      return { updateAvailable: false, error: `No published releases found` };
    }

    const latestVersion = (targetRelease.tag_name || '').replace(/^v/i, '');

    // Find the APK file from release assets
    const apkAsset = (targetRelease.assets || []).find(
      (a) => a.name && a.name.toLowerCase().endsWith('.apk')
    );

    const downloadUrl = apkAsset
      ? apkAsset.browser_download_url
      : targetRelease.html_url;

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    return {
      updateAvailable: isNewer,
      currentVersion,
      latestVersion,
      isPrerelease: !!targetRelease.prerelease,
      releaseTitle: targetRelease.name || targetRelease.tag_name,
      releaseNotes: targetRelease.body || 'Bug fixes and performance improvements.',
      downloadUrl,
      apkName: apkAsset ? apkAsset.name : 'PS168-Navigator.apk',
      apkSizeMb: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) : null,
      publishedAt: targetRelease.published_at,
    };
  } catch (error) {
    console.warn('[updateService] Failed to check for updates:', error);
    return { updateAvailable: false, error: error.message };
  }
}
