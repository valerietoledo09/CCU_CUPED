// Unsent edits stay on the device until the matching cloud save is acknowledged.
// IndexedDB keeps full plans/photos outside the small localStorage quota.
const DATABASE = 'cuped-sync-journal';
const STORE = 'drafts';
const PREFIX = 'cuped-sync-draft:';

export function createSyncJournal(config, options = {}) {
 const scope = {url: config?.url, planId: config?.planId};
 if (typeof scope.url !== 'string' || !scope.url || typeof scope.planId !== 'string' || !scope.planId) {
  throw new Error('Connect a calendar before storing pending changes.');
 }
 const scopeKey = JSON.stringify([scope.url, scope.planId]);
 const localPrefix = PREFIX + encodeURIComponent(scopeKey) + ':';
 const databaseFactory = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB;
 let localStorage;
 try { localStorage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage; } catch {}
 let opening = null, chain = Promise.resolve();

 function serial(operation) {
  const result = chain.then(operation, operation);
  chain = result.catch(() => {});
  return result;
 }
 function normalize(record) {
  if (!record || typeof record.id !== 'string' || !record.id || typeof record.token !== 'string' || !record.token || !record.state || typeof record.state !== 'object') {
   throw new Error('Pending calendar changes have an invalid format.');
  }
  return structuredClone({
   id: record.id, token: record.token, ...scope,
   baseState: record.baseState ?? null,
   baseRevision: Number.isInteger(record.baseRevision) ? record.baseRevision : null,
   conflicts: Array.isArray(record.conflicts) ? record.conflicts.filter(value => typeof value === 'string') : [],
   state: record.state, updatedAt: record.updatedAt || new Date().toISOString()
  });
 }
 function storage() {
  if (!localStorage) throw new Error('Device storage is unavailable. Keep this page open and export a backup.');
  return localStorage;
 }
 function openDatabase() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
   let request;
   try { request = databaseFactory.open(DATABASE, 1); } catch (error) { reject(error); return; }
   request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath: 'journalKey'});
   };
   request.onerror = () => reject(request.error || new Error('Could not open device storage.'));
   request.onblocked = () => reject(new Error('Device storage is blocked by another planner tab. Close that tab and try again.'));
   request.onsuccess = () => {
    const database = request.result;
    database.onversionchange = () => database.close();
    resolve(database);
   };
  });
  return opening;
 }
 async function transaction(mode, work) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
   const tx = database.transaction(STORE, mode);
   let result;
   tx.oncomplete = () => resolve(result);
   tx.onabort = () => reject(tx.error || new Error('Device storage could not keep these changes. Export a backup.'));
   tx.onerror = () => {}; // onabort reports the failed transaction once.
   try { work(tx.objectStore(STORE), value => { result = value; }); } catch (error) { tx.abort(); reject(error); }
  });
 }
 function recordKey(id) { return JSON.stringify([scope.url, scope.planId, id]); }
 function publicRecord(record) {
  const {journalKey, ...data} = record;
  return structuredClone(data);
 }

 return {
  list() {
   return serial(async () => {
    let records;
    if (databaseFactory) {
     records = await transaction('readonly', (store, result) => {
      const request = store.getAll();
      request.onsuccess = () => result(request.result.filter(record => record.url === scope.url && record.planId === scope.planId).map(publicRecord));
     });
    } else {
     const saved = storage(); records = [];
     for (let i = 0; i < saved.length; i++) {
      const key = saved.key(i);
      if (!key?.startsWith(localPrefix)) continue;
      const record = JSON.parse(saved.getItem(key));
      if (record?.url === scope.url && record?.planId === scope.planId) records.push(record);
     }
    }
    return records.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
   });
  },
  put(record) {
   // Capture immediately, before another edit mutates the caller's object.
   const data = normalize(record);
   return serial(async () => {
    if (databaseFactory) await transaction('readwrite', (store, result) => {
     store.put({...data, journalKey: recordKey(data.id)}); result(data);
    });
    else storage().setItem(localPrefix + encodeURIComponent(data.id), JSON.stringify(data));
    return structuredClone(data);
   });
  },
  remove(id, expectedToken) {
   if (typeof id !== 'string' || typeof expectedToken !== 'string' || !expectedToken) return Promise.reject(new Error('A matching pending-change token is required.'));
   return serial(async () => {
    if (databaseFactory) return transaction('readwrite', (store, result) => {
     const key = recordKey(id), request = store.get(key);
     request.onsuccess = () => {
      const matched = request.result?.token === expectedToken;
      if (matched) store.delete(key);
      result(matched);
     };
    });
    const saved = storage(), key = localPrefix + encodeURIComponent(id), raw = saved.getItem(key);
    if (!raw || JSON.parse(raw).token !== expectedToken) return false;
    saved.removeItem(key); return true;
   });
  }
 };
}
