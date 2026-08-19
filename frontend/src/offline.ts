import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const CACHE_PREFIX = "fm:cache:";
const QUEUE_KEY = "fm:sync:queue";
const LAST_STATUS_KEY = "fm:sync:last-status";

export type QueueOp =
  | { kind: "create-site"; localId: string; body: any; createdAt: string }
  | { kind: "update-site"; siteId: string; body: any; createdAt: string }
  | { kind: "delete-site"; siteId: string; createdAt: string }
  | { kind: "create-visit"; localId: string; siteId: string; body: any; createdAt: string }
  | { kind: "update-visit"; visitId: string; body: any; createdAt: string }
  | { kind: "delete-visit"; visitId: string; siteId: string; createdAt: string }
  | { kind: "add-photo"; localId: string; visitId: string; siteId: string; body: any; createdAt: string };

export async function cacheGet<T>(key: string): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(CACHE_PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try { await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch {}
}
export async function cacheDelete(key: string): Promise<void> {
  try { await AsyncStorage.removeItem(CACHE_PREFIX + key); } catch {}
}
export async function cacheClearAllForUser(userId: string): Promise<void> {
  try { const keys = await AsyncStorage.getAllKeys(); const target = keys.filter(k => k.startsWith(CACHE_PREFIX + userId + ":")); if (target.length) await AsyncStorage.multiRemove(target); } catch {}
}

export async function queueRead(): Promise<QueueOp[]> {
  try { const raw = await AsyncStorage.getItem(QUEUE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export async function queueWrite(ops: QueueOp[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}
export async function queuePush(op: QueueOp): Promise<void> {
  const list = await queueRead(); list.push(op); await queueWrite(list); notifyChange();
}
export async function queueClear(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY); notifyChange();
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void { listeners.add(fn); return () => listeners.delete(fn); }
export function notifyChange() { for (const fn of listeners) try { fn(); } catch {} }

let currentOnline: boolean = true;
let netUnsub: (() => void) | null = null;
export function isOnline(): boolean { return currentOnline; }

export function startConnectivity(onChange: (online: boolean) => void) {
  if (netUnsub) return;
  const sub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (online !== currentOnline) { currentOnline = online; onChange(online); notifyChange(); }
  });
  netUnsub = sub;
  NetInfo.fetch().then((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (online !== currentOnline) { currentOnline = online; onChange(online); notifyChange(); }
  });
  if (typeof window !== "undefined" && typeof (window as any).addEventListener === "function") {
    const onWebOffline = () => { if (currentOnline) { currentOnline = false; onChange(false); notifyChange(); } };
    const onWebOnline = () => { if (!currentOnline) { currentOnline = true; onChange(true); notifyChange(); } };
    window.addEventListener("offline", onWebOffline);
    window.addEventListener("online", onWebOnline);
    const prevUnsub = netUnsub;
    netUnsub = () => { prevUnsub && prevUnsub(); window.removeEventListener("offline", onWebOffline); window.removeEventListener("online", onWebOnline); };
  }
}

export function stopConnectivity() { if (netUnsub) { netUnsub(); netUnsub = null; } }

export type SyncStatus = "idle" | "syncing" | "error";
let syncStatus: SyncStatus = "idle";
export function getSyncStatus(): SyncStatus { return syncStatus; }
export async function setLastSyncStatus(msg: string) { await AsyncStorage.setItem(LAST_STATUS_KEY, msg); }
export async function getLastSyncStatus(): Promise<string | null> { return AsyncStorage.getItem(LAST_STATUS_KEY); }

let draining = false;
export async function drainQueue(adapters: any): Promise<{ drained: number; remaining: number; error?: string }> {
  if (draining) return { drained: 0, remaining: (await queueRead()).length };
  draining = true;
  syncStatus = "syncing";
  notifyChange();
  let drained = 0;
  try {
    let list = await queueRead();
    while (list.length > 0) {
      const op = list[0];
      try {
        if (op.kind === "create-site") {
          const server = await adapters.createSite(op.body);
          for (let i = 1; i < list.length; i++) { const next = list[i] as any; if (next.siteId === op.localId) next.siteId = server.id; }
          await adapters.onIdRewrite("site", op.localId, server.id);
        } else if (op.kind === "update-site") {
          await adapters.updateSite(op.siteId, op.body);
        } else if (op.kind === "delete-site") {
          await adapters.deleteSite(op.siteId);
        } else if (op.kind === "create-visit") {
          const server = await adapters.createVisit(op.siteId, op.body);
          for (let i = 1; i < list.length; i++) { const next = list[i] as any; if (next.visitId === op.localId) next.visitId = server.id; }
          await adapters.onIdRewrite("visit", op.localId, server.id);
        } else if (op.kind === "update-visit") {
          await adapters.updateVisit(op.visitId, op.body);
        } else if (op.kind === "delete-visit") {
          await adapters.deleteVisit(op.visitId);
        } else if (op.kind === "add-photo") {
          const server = await adapters.addPhoto(op.visitId, op.body);
          await adapters.onIdRewrite("photo", op.localId, server.id);
        }
        drained += 1;
      } catch (e: any) {
        const msg = (e?.message || "").toLowerCase();
        if (msg.includes("not found") || msg.includes("400") || msg.includes("invalid")) {
          drained += 1;
        } else {
          syncStatus = "error";
          await queueWrite(list);
          notifyChange();
          return { drained, remaining: list.length, error: e?.message || "sync-failed" };
        }
      }
      list = list.slice(1);
      await queueWrite(list);
      notifyChange();
    }
    syncStatus = "idle";
    await setLastSyncStatus(new Date().toISOString());
    return { drained, remaining: 0 };
  } finally {
    draining = false;
    notifyChange();
  }
}
