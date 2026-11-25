/**
 * geoVaultDb.js — Offline-first IndexedDB vault for GEO-SPECTRA.
 * 5 object stores + offline mutation sync queue + report exporter.
 * Pure ES2024 JavaScript. Falls back to in-memory when IndexedDB is
 * unavailable (SSR / private mode) so the app never crashes.
 */

const DB_NAME = 'geo-spectra-vault';
const DB_VERSION = 1;
const STORES = [
  'hvsr_soil_surveys',
  'structural_crack_logs',
  'seismograph_events',
  'slope_wall_audits',
  'foundation_quote_reviews',
  'sync_queue'
];

let memFallback = new Map();

function hasIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDb();
  if (!db) return fn(null);
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}

export async function saveRecord(store, record) {
  const payload = { ...record, savedAt: new Date().toISOString(), synced: false };
  if (!hasIndexedDB()) {
    if (!memFallback.has(store)) memFallback.set(store, []);
    memFallback.get(store).push(payload);
    await queueMutation(store, payload);
    return payload;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const req = t.objectStore(store).add(payload);
    req.onsuccess = () => resolve({ ...payload, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export async function listRecords(store) {
  if (!hasIndexedDB()) return memFallback.get(store) || [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function queueMutation(store, payload) {
  const entry = { store, payload, queuedAt: new Date().toISOString() };
  if (!hasIndexedDB()) {
    if (!memFallback.has('sync_queue')) memFallback.set('sync_queue', []);
    memFallback.get('sync_queue').push(entry);
    return entry;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('sync_queue', 'readwrite').objectStore('sync_queue').add(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

export async function pendingSyncCount() {
  const rows = await listRecords('sync_queue');
  return rows.length;
}

/** Flush queue to the Python solver endpoint; returns { sent, failed }. */
export async function flushSyncQueue(fetchImpl = fetch) {
  const rows = await listRecords('sync_queue');
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const res = await fetchImpl('/api/geo_structural_solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: row.store, record: row.payload })
      });
      if (res.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { sent, failed, total: rows.length };
}

/** Export all stores as a single JSON inspection report. */
export async function exportReport() {
  const report = { app: 'GEO-SPECTRA', version: '1.25.0', exportedAt: new Date().toISOString(), stores: {} };
  for (const s of STORES) {
    if (s === 'sync_queue') continue;
    report.stores[s] = await listRecords(s);
  }
  return report;
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
