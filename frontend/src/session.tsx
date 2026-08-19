import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { AppState } from "react-native";
import { raw, readToken, writeToken, User, makeApi, OfflineApi, cacheKeys } from "./api";
import { startConnectivity, stopConnectivity, drainQueue, queueRead, subscribe, isOnline, cacheGet, cacheSet, cacheDelete, cacheClearAllForUser } from "./offline";

type Session = { token: string; user: User } | null;
type Ctx = {
  session: Session; loading: boolean; online: boolean; pendingCount: number;
  api: OfflineApi | null; syncNow: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const api: OfflineApi | null = useMemo(() => session ? makeApi(session.token, session.user.id) : null, [session]);

  const refreshPending = useCallback(async () => {
    const list = await queueRead();
    setPendingCount(list.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (!api || !session) return;
    const K = cacheKeys(session.user.id);
    await drainQueue({
      createSite: api._adapters.createSite,
      updateSite: api._adapters.updateSite,
      deleteSite: api._adapters.deleteSite,
      createVisit: api._adapters.createVisit,
      updateVisit: api._adapters.updateVisit,
      deleteVisit: api._adapters.deleteVisit,
      addPhoto: api._adapters.addPhoto,
      onIdRewrite: async (kind: string, localId: string, serverId: string) => {
        if (kind === "site") {
          const doc = await cacheGet<any>(K.site(localId));
          if (doc) { await cacheDelete(K.site(localId)); await cacheSet(K.site(serverId), { ...doc, id: serverId, _pending: false }); if (doc.district) await cacheDelete(K.sites(doc.district)); }
          await cacheDelete(K.sites()); await cacheDelete(K.districts);
        } else if (kind === "visit") {
          const doc = await cacheGet<any>(K.visit(localId));
          if (doc) { await cacheDelete(K.visit(localId)); await cacheSet(K.visit(serverId), { ...doc, id: serverId, _pending: false }); await cacheDelete(K.visits(doc.site_id)); }
        }
      },
    });
    await refreshPending();
  }, [api, session, refreshPending]);

  useEffect(() => {
    (async () => {
      const token = await readToken();
      if (token) {
        try { const user = await raw.me(token); setSession({ token, user }); } catch { await writeToken(null); }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    startConnectivity((next) => setOnline(next));
    setOnline(isOnline());
    const unsub = subscribe(refreshPending);
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active") { refreshPending(); if (isOnline()) syncNow(); } });
    refreshPending();
    return () => { stopConnectivity(); unsub(); appSub.remove(); };
  }, [refreshPending, syncNow]);

  useEffect(() => { if (session && online) syncNow(); }, [session, online, syncNow]);

  const establish = useCallback(async (result: { access_token: string; user: User }) => {
    await writeToken(result.access_token);
    setSession({ token: result.access_token, user: result.user });
  }, []);

  const value: Ctx = {
    session, loading, online, pendingCount, api, syncNow,
    signIn: async (email, password) => { const result = await raw.login(email, password); await establish(result); },
    signUp: async (email, password, name) => {
      const result = await raw.signup(email, password, name);

      if (!result.access_token || result.status === "pending") {
        throw new Error("ACCOUNT CREATED. YOUR REGISTRATION IS AWAITING ADMINISTRATOR APPROVAL.");
      }

      await establish(result);
    },
    signOut: async () => { if (session) await cacheClearAllForUser(session.user.id); await writeToken(null); setSession(null); },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
