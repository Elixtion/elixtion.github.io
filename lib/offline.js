/**
 * lib/offline.js
 * IndexedDB-based offline queue and local data store for CrowdScout.
 *
 * Provides:
 *  - CS.offline.saveSubmission(data)      → save to IndexedDB + queue sync
 *  - CS.offline.getSyncQueue()            → list pending submissions
 *  - CS.offline.syncAll()                 → attempt to push pending → Supabase
 *  - CS.offline.getSubmissionsForMatch()  → read local cache
 *  - CS.offline.connectivity             → { isOnline, pendingCount, lastSyncTime }
 */
window.CS = window.CS || {};

window.CS.offline = (function () {
  const DB_NAME = "crowdscout_offline";
  const DB_VERSION = 2;
  const STORE_QUEUE = "sync_queue";
  const STORE_MATCHES = "matches_cache";
  const STORE_TEAMS = "teams_cache";
  const STORE_EVENTS = "events_cache";

  let _db = null;

  // ── IndexedDB init ─────────────────────────────────────────────────────────────
  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const qs = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
          qs.createIndex("syncStatus", "syncStatus");
          qs.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains(STORE_MATCHES)) {
          db.createObjectStore(STORE_MATCHES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_TEAMS)) {
          db.createObjectStore(STORE_TEAMS, { keyPath: "team_number" });
        }
        if (!db.objectStoreNames.contains(STORE_EVENTS)) {
          db.createObjectStore(STORE_EVENTS, { keyPath: "event_key" });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function txGet(storeName, key) {
    return openDB().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  }

  function txPut(storeName, value) {
    return openDB().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  }

  function txGetAll(storeName) {
    return openDB().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  }

  function txDelete(storeName, key) {
    return openDB().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    }));
  }

  // ── UUID helper ────────────────────────────────────────────────────────────────
  function uuid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  }

  // ── Connectivity state ─────────────────────────────────────────────────────────
  const state = { isOnline: navigator.onLine, pendingCount: 0, lastSyncTime: null };

  window.addEventListener("online", () => {
    state.isOnline = true;
    _dispatchStatus();
    // Auto-sync when back online
    syncAll().catch(console.error);
  });
  window.addEventListener("offline", () => {
    state.isOnline = false;
    _dispatchStatus();
  });

  function _dispatchStatus() {
    window.dispatchEvent(new CustomEvent("cs-connectivity", { detail: { ...state } }));
  }

  async function _updatePendingCount() {
    const queue = await getSyncQueue();
    state.pendingCount = queue.filter((q) => q.syncStatus === "pending" || q.syncStatus === "failed").length;
    _dispatchStatus();
  }

  // ── Sync queue ─────────────────────────────────────────────────────────────────
  async function saveSubmission(submissionData, type = "match_scout") {
    const item = {
      id: uuid(),
      type,
      data: submissionData,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncAttempt: null,
      errorMessage: null,
    };
    await txPut(STORE_QUEUE, item);
    await _updatePendingCount();
    // Attempt immediate sync if online
    if (state.isOnline) syncAll().catch(console.error);
    return item;
  }

  async function getSyncQueue() {
    return txGetAll(STORE_QUEUE);
  }

  async function syncAll() {
    if (!state.isOnline) return { synced: 0, failed: 0 };
    if (!window.CS || !window.CS.db) return { synced: 0, failed: 0 };

    const session = await window.CS.auth.getSession();
    if (!session) return { synced: 0, failed: 0 };

    const queue = await getSyncQueue();
    const pending = queue.filter((q) => q.syncStatus === "pending" || (q.syncStatus === "failed" && q.syncAttempts < 3));

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await _syncItem(item, session);
        await txDelete(STORE_QUEUE, item.id);
        synced++;
      } catch (err) {
        item.syncStatus = "failed";
        item.syncAttempts = (item.syncAttempts || 0) + 1;
        item.lastSyncAttempt = new Date().toISOString();
        item.errorMessage = err.message;
        await txPut(STORE_QUEUE, item);
        failed++;
      }
    }

    if (synced > 0) {
      state.lastSyncTime = new Date().toISOString();
    }
    await _updatePendingCount();
    return { synced, failed };
  }

  async function _syncItem(item, session) {
    const db = window.CS.db;
    if (item.type === "match_scout" || item.type === "pit_scout") {
      const payload = {
        ...item.data,
        owner_id: session.user.id,
        owner_display: session.user.user_metadata?.full_name || session.user.email,
      };
      const { error } = await db.from("scout_submissions").insert([payload]);
      if (error) throw new Error(error.message);
    }
  }

  // ── Cache helpers (events / teams / matches) ───────────────────────────────────
  const cache = {
    async putEvent(event) { return txPut(STORE_EVENTS, event); },
    async getEvent(key) { return txGet(STORE_EVENTS, key); },
    async getAllEvents() { return txGetAll(STORE_EVENTS); },
    async putTeam(team) { return txPut(STORE_TEAMS, team); },
    async getTeam(number) { return txGet(STORE_TEAMS, number); },
    async getAllTeams() { return txGetAll(STORE_TEAMS); },
    async putMatch(match) { return txPut(STORE_MATCHES, match); },
    async getMatch(id) { return txGet(STORE_MATCHES, id); },
    async getAllMatches() { return txGetAll(STORE_MATCHES); },
  };

  // Init pending count on load
  openDB().then(() => _updatePendingCount()).catch(console.error);

  return {
    saveSubmission,
    getSyncQueue,
    syncAll,
    cache,
    get connectivity() { return { ...state }; },
    _updatePendingCount,
  };
})();
