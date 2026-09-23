// PS168 — JSON Store (shared local-persistence primitive)
//
// Every local "database" in this app is a single JSON file in
// FileSystem.documentDirectory. This module centralizes the three guarantees
// the previous per-service hand-rolled read/write loops were missing:
//
//   1. ATOMIC WRITES  — serialize to a `.tmp` sibling then rename over the
//      target, so a crash mid-write can never leave a truncated file that the
//      next launch silently parses to `[]` and wipes.
//   2. WRITE SERIALIZATION — a per-file promise chain, so two overlapping
//      read-modify-write mutations can't both read the same base and have the
//      last writer clobber the first (lost updates).
//   3. VALIDATION + QUARANTINE — a caller-supplied `validate` predicate; a
//      malformed/corrupt file is moved aside to `.corrupt-<ts>` (never
//      silently overwritten-then-lost) and the in-memory cache rolls back on
//      a failed write so memory and disk never diverge.
//
// Callers keep their own optimistic semantics: mutateJson hands the updater the
// current value and persists whatever it returns, throwing on write failure so
// the caller can react (e.g. flip a "saved" flag back to false).

import * as FileSystem from 'expo-file-system/legacy';

// file path -> { cache, lock }
const stores = new Map();

function cloneFallback(fallback) {
  if (Array.isArray(fallback)) return [];
  if (fallback && typeof fallback === 'object') return { ...fallback };
  return fallback;
}

function getStore(file, fallback) {
  let s = stores.get(file);
  if (!s) {
    s = { cache: undefined, lock: Promise.resolve(), fallback };
    stores.set(file, s);
  }
  return s;
}

// Read + parse with corruption quarantine. Never throws: falls back to the
// caller's default after moving any unreadable/unparseable file aside.
async function readFromDisk(file, store, validate) {
  try {
    const info = await FileSystem.getInfoAsync(file);
    if (!info.exists) {
      store.cache = cloneFallback(store.fallback);
      return store.cache;
    }
    const raw = await FileSystem.readAsStringAsync(file);
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      throw new Error('value failed validation');
    }
    store.cache = parsed;
    return parsed;
  } catch (err) {
    console.warn(`[jsonStore] read/parse failed for ${file}:`, err);
    // Quarantine the corrupt file so a subsequent write can't silently
    // overwrite (and permanently lose) whatever was there.
    try {
      const info = await FileSystem.getInfoAsync(file);
      if (info.exists) {
        const bak = `${file}.corrupt-${Date.now()}`;
        await FileSystem.moveAsync({ from: file, to: bak });
        console.warn(`[jsonStore] moved corrupt file aside: ${bak}`);
      }
    } catch (e) {
      /* best-effort quarantine */
    }
    store.cache = cloneFallback(store.fallback);
    return store.cache;
  }
}

// Write to a temp sibling then rename over the target (atomic overwrite).
async function writeAtomic(file, value) {
  const tmp = `${file}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(value));
  try {
    await FileSystem.moveAsync({ from: tmp, to: file });
  } catch (e) {
    // Some platforms refuse to rename onto an existing file — clear and retry.
    await FileSystem.deleteAsync(file, { idempotent: true });
    await FileSystem.moveAsync({ from: tmp, to: file });
  }
}

/**
 * Load a JSON file (cached after first read).
 * @param {string} file
 * @param {{fallback: any, validate?: (v:any)=>boolean}} opts
 */
export async function loadJson(file, opts = {}) {
  const store = getStore(file, opts.fallback);
  if (store.cache !== undefined) return store.cache;
  return readFromDisk(file, store, opts.validate);
}

/**
 * Serialized read-modify-write. `updater` receives the current value and
 * returns the next value to persist. Throws (after rolling the cache back to
 * its pre-write snapshot) if the write fails, so callers can surface errors.
 * @param {string} file
 * @param {(current:any)=>any} updater
 * @param {{fallback: any, validate?: (v:any)=>boolean}} opts
 */
export async function mutateJson(file, updater, opts = {}) {
  const store = getStore(file, opts.fallback);
  // Chain onto this file's lock so mutations never interleave their
  // read → write window.
  const run = async () => {
    const current =
      store.cache !== undefined
        ? store.cache
        : await readFromDisk(file, store, opts.validate);
    const next = updater(current);
    const prevCache = store.cache;
    store.cache = next;
    try {
      await writeAtomic(file, next);
    } catch (err) {
      store.cache = prevCache; // rollback optimistic update
      throw err;
    }
    return next;
  };
  const result = store.lock.then(run, run);
  // Keep the chain alive even if this link rejects (otherwise a later
  // mutation would inherit a rejected promise and never run).
  store.lock = result.then(
    () => {},
    () => {}
  );
  return result;
}

/**
 * Replace the whole file value (serialized + atomic).
 */
export async function setJson(file, value, opts = {}) {
  return mutateJson(file, () => value, opts);
}

/**
 * Delete the file and reset its cache (used by "clear" actions).
 */
export async function removeJson(file, opts = {}) {
  const store = getStore(file, opts.fallback);
  const run = async () => {
    try {
      await FileSystem.deleteAsync(file, { idempotent: true });
    } catch (err) {
      console.warn(`[jsonStore] delete failed for ${file}:`, err);
      throw err;
    } finally {
      store.cache = cloneFallback(store.fallback);
    }
    return store.cache;
  };
  const result = store.lock.then(run, run);
  store.lock = result.then(
    () => {},
    () => {}
  );
  return result;
}
