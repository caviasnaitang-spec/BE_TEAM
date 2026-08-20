import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { cacheGet, cacheSet, cacheDelete, queuePush, isOnline, notifyChange } from "./offline";

const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_BASE = RAW_BASE.replace(/\/$/, "");
const TOKEN_KEY = "fm_auth_token";

export type User = { id: string; email: string; name?: string | null; status?: string; is_admin?: boolean };
export type AuthResponse = { access_token: string; token_type: string; user: User; status?: string };
export type District = { key: string; name: string; site_count: number; active_count: number; completed_count: number };
export type Site = { id: string; name: string; plot_number: string; district: string; location: string; status: "Active" | "Completed"; owner_id: string; visit_count: number; photo_count: number; created_at: string; updated_at: string; _pending?: boolean };
export type Visit = { id: string; site_id: string; owner_id: string; sequence: number; title: string; note: string; progress_pct: number | null; issues: string; recommendations: string; photo_count: number; created_at: string; updated_at: string; _pending?: boolean };
export type Photo = { id: string; site_id: string; visit_id: string; image_base64: string; latitude: number | null; longitude: number | null; accuracy: number | null; captured_at: string; note: string; created_at: string; _pending?: boolean };

export async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") { try { return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null; } catch { return null; } }
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function writeToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") { if (typeof localStorage === "undefined") return; if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); return; }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token); else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  return data as T;
}

export const raw = {
  signup: (email: string, password: string, name?: string) => request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) => request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: (token: string) => request<User>("/api/auth/me", {}, token),
  listDistricts: (token: string) => request<District[]>("/api/districts", {}, token),
  seedMeghalaya: (token: string) => request<{ inserted: number; total: number }>("/api/seed/meghalaya", { method: "POST" }, token),
  listSites: (token: string, params: any = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.status) usp.set("status", params.status);
    if (params.district) usp.set("district", params.district);
    const qs = usp.toString();
    return request<Site[]>(`/api/sites${qs ? `?${qs}` : ""}`, {}, token);
  },
  getSite: (token: string, id: string) => request<Site>(`/api/sites/${id}`, {}, token),
  createSite: (token: string, body: any) => request<Site>("/api/sites", { method: "POST", body: JSON.stringify(body) }, token),
  updateSite: (token: string, id: string, body: any) => request<Site>(`/api/sites/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteSite: (token: string, id: string) => request<null>(`/api/sites/${id}`, { method: "DELETE" }, token),
  listVisits: (token: string, siteId: string) => request<Visit[]>(`/api/sites/${siteId}/visits`, {}, token),
  createVisit: (token: string, siteId: string, body: any) => request<Visit>(`/api/sites/${siteId}/visits`, { method: "POST", body: JSON.stringify(body) }, token),
  getVisit: (token: string, visitId: string) => request<Visit>(`/api/visits/${visitId}`, {}, token),
  updateVisit: (token: string, visitId: string, body: any) => request<Visit>(`/api/visits/${visitId}`, { method: "PATCH", body: JSON.stringify(body) }, token),

  generateAIReport: (
    token: string,
    visitId: string,
    body: {
      summary: string;
      issues: string;
      recommendations: string;
    }
  ) =>
    request<{
      summary: string;
      issues: string;
      recommendations: string;
    }>(
      `/api/visits/${visitId}/ai-report`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token
    ),

  deleteVisit: (token: string, visitId: string) => request<null>(`/api/visits/${visitId}`, { method: "DELETE" }, token),
  listPhotos: (token: string, visitId: string) => request<Photo[]>(`/api/visits/${visitId}/photos`, {}, token),
  listFullPhotos: (token: string, visitId: string) => request<Photo[]>(`/api/visits/${visitId}/photos/full`, {}, token),
  addPhoto: (token: string, visitId: string, body: any) => request<Photo>(`/api/visits/${visitId}/photos`, { method: "POST", body: JSON.stringify(body) }, token),
  deletePhoto: (token: string, photoId: string) => request<null>(`/api/photos/${photoId}`, { method: "DELETE" }, token),
  adminUsers: (token: string) => request<any[]>(`/api/admin/users`, {}, token),
  adminApproveUser: (token: string, userId: string) => request<any>(`/api/admin/users/${userId}/approve`, { method: "PATCH" }, token),
  adminRejectUser: (token: string, userId: string) => request<any>(`/api/admin/users/${userId}/reject`, { method: "PATCH" }, token),
};

export function cacheKeys(userId: string) {
  return {
    districts: `${userId}:districts`,
    sites: (district?: string) => `${userId}:sites:${district || "ALL"}`,
    site: (id: string) => `${userId}:site:${id}`,
    visits: (siteId: string) => `${userId}:visits:${siteId}`,
    visit: (id: string) => `${userId}:visit:${id}`,
    visitPhotos: (visitId: string) => `${userId}:photos:${visitId}`,
  };
}

export function makeApi(token: string, userId: string) {
  const K = cacheKeys(userId);

  const fetchAndCache = async <T>(fn: () => Promise<T>, key: string, defaultValue?: T): Promise<T> => {
    try { const val = await fn(); await cacheSet(key, val); return val; } catch (e) {
      const cached = await cacheGet<T>(key);
      if (cached !== null) return cached;
      if (defaultValue !== undefined) return defaultValue;
      throw e;
    }
  };

  return {
    listDistricts: () => fetchAndCache(() => raw.listDistricts(token), K.districts, [] as any),
    listSites: async (params: any = {}) => {
      if (params.q) return raw.listSites(token, params);

      const cacheKey = K.sites(params.district);

      try {
        const fresh = await raw.listSites(token, params);
        await cacheSet(cacheKey, fresh);
        return fresh;
      } catch (e) {
        const cached = await cacheGet<Site[]>(cacheKey);
        if (cached) return cached;
        throw e;
      }
    },
    getSite: (id: string) => fetchAndCache(() => raw.getSite(token, id), K.site(id)),
    createSite: async (body: any) => {
      if (isOnline()) {
        try { const created = await raw.createSite(token, body); await cacheDelete(K.sites()); await cacheDelete(K.sites(body.district)); await cacheDelete(K.districts); notifyChange(); return created; } catch {}
      }
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const optimistic: Site = { id: localId, name: body.name, plot_number: body.plot_number, district: body.district, location: body.location || "", status: body.status || "Active", owner_id: userId, visit_count: 0, photo_count: 0, created_at: now, updated_at: now, _pending: true };
      const existing = (await cacheGet<Site[]>(K.sites(body.district))) || [];
      await cacheSet(K.sites(body.district), [optimistic, ...existing]);
      const existingAll = (await cacheGet<Site[]>(K.sites())) || [];
      await cacheSet(K.sites(), [optimistic, ...existingAll]);
      await cacheSet(K.site(localId), optimistic);
      const dcache = await cacheGet<District[]>(K.districts);
      if (dcache) {
        const next = dcache.map(d => d.key === body.district ? { ...d, site_count: d.site_count + 1, active_count: d.active_count + (optimistic.status === "Active" ? 1 : 0) } : d);
        await cacheSet(K.districts, next);
      }
      await queuePush({ kind: "create-site", localId, body, createdAt: now });
      return optimistic;
    },
    updateSite: async (id: string, body: any) => {
      if (isOnline() && !id.startsWith("local-")) {
        const updated = await raw.updateSite(token, id, body);
        await cacheSet(K.site(id), updated);
        await cacheDelete(K.sites());
        await cacheDelete(K.sites(updated.district));
        await cacheDelete(K.districts);
        notifyChange();
        return updated;
      }
      const current = (await cacheGet<Site>(K.site(id))) as Site;
      const merged = { ...current, ...body, updated_at: new Date().toISOString(), _pending: true };
      await cacheSet(K.site(id), merged);
      const list = (await cacheGet<Site[]>(K.sites(merged.district))) || [];
      await cacheSet(K.sites(merged.district), list.map(s => s.id === id ? merged : s));
      if (!id.startsWith("local-")) await queuePush({ kind: "update-site", siteId: id, body, createdAt: new Date().toISOString() });
      return merged;
    },
    deleteSite: async (id: string) => {
      if (isOnline() && !id.startsWith("local-")) await raw.deleteSite(token, id);
      else if (!id.startsWith("local-")) await queuePush({ kind: "delete-site", siteId: id, createdAt: new Date().toISOString() });
      await cacheDelete(K.site(id));
      await cacheDelete(K.visits(id));
      const list = (await cacheGet<Site[]>(K.sites())) || [];
      await cacheSet(K.sites(), list.filter(s => s.id !== id));
      notifyChange();
      return true;
    },
    listVisits: (siteId: string) => fetchAndCache(() => raw.listVisits(token, siteId), K.visits(siteId), [] as any),
    getVisit: (visitId: string) => fetchAndCache(() => raw.getVisit(token, visitId), K.visit(visitId)),

    generateAIReport: (
      visitId: string,
      body: {
        summary: string;
        issues: string;
        recommendations: string;
      }
    ) => raw.generateAIReport(token, visitId, body),

    createVisit: async (siteId: string, body: any) => {
      if (isOnline() && !siteId.startsWith("local-")) {
        try { const created = await raw.createVisit(token, siteId, body); await cacheDelete(K.visits(siteId)); await cacheDelete(K.site(siteId)); notifyChange(); return created; } catch {}
      }
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const existing = (await cacheGet<Visit[]>(K.visits(siteId))) || [];
      const optimistic: Visit = { id: localId, site_id: siteId, owner_id: userId, sequence: existing.length + 1, title: (body.title || `Visit ${existing.length + 1}`).trim(), note: (body.note || "").trim(), progress_pct: null, issues: "", recommendations: "", photo_count: 0, created_at: now, updated_at: now, _pending: true };
      await cacheSet(K.visits(siteId), [...existing, optimistic]);
      await cacheSet(K.visit(localId), optimistic);
      await queuePush({ kind: "create-visit", localId, siteId, body, createdAt: now });
      return optimistic;
    },
    updateVisit: async (visitId: string, body: any) => {
      if (isOnline() && !visitId.startsWith("local-")) {
        const updated = await raw.updateVisit(token, visitId, body);
        await cacheSet(K.visit(visitId), updated);
        await cacheDelete(K.visits(updated.site_id));
        notifyChange();
        return updated;
      }
      const current = (await cacheGet<Visit>(K.visit(visitId))) as Visit;
      const merged = { ...current, ...body, updated_at: new Date().toISOString(), _pending: true };
      await cacheSet(K.visit(visitId), merged);
      const list = (await cacheGet<Visit[]>(K.visits(merged.site_id))) || [];
      await cacheSet(K.visits(merged.site_id), list.map(v => v.id === visitId ? merged : v));
      if (!visitId.startsWith("local-")) await queuePush({ kind: "update-visit", visitId, body, createdAt: new Date().toISOString() });
      return merged;
    },
    listPhotos: (visitId: string) =>
      fetchAndCache(() => raw.listPhotos(token, visitId), K.visitPhotos(visitId), [] as any),

    // Full-resolution photos are fetched only when generating a PDF.
    listFullPhotos: (visitId: string) =>
      raw.listFullPhotos(token, visitId),
    addPhoto: async (visitId: string, body: any, siteId?: string) => {
      if (isOnline() && !visitId.startsWith("local-")) {
        try { const created = await raw.addPhoto(token, visitId, body); const list = (await cacheGet<Photo[]>(K.visitPhotos(visitId))) || []; await cacheSet(K.visitPhotos(visitId), [created, ...list]); notifyChange(); return created; } catch {}
      }
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const optimistic: Photo = { id: localId, site_id: siteId || "", visit_id: visitId, image_base64: body.image_base64, latitude: body.latitude ?? null, longitude: body.longitude ?? null, accuracy: body.accuracy ?? null, captured_at: body.captured_at || now, note: body.note || "", created_at: now, _pending: true };
      const list = (await cacheGet<Photo[]>(K.visitPhotos(visitId))) || [];
      await cacheSet(K.visitPhotos(visitId), [optimistic, ...list]);
      await queuePush({ kind: "add-photo", localId, visitId, siteId: siteId || "", body, createdAt: now });
      return optimistic;
    },
    deletePhoto: async (photoId: string, visitId: string) => {
      if (!isOnline()) {
        throw new Error("PHOTO DELETION REQUIRES AN INTERNET CONNECTION");
      }

      await raw.deletePhoto(token, photoId);

      const list = (await cacheGet<Photo[]>(K.visitPhotos(visitId))) || [];
      await cacheSet(
        K.visitPhotos(visitId),
        list.filter(photo => photo.id !== photoId)
      );

      notifyChange();
      return true;
    },
    seedMeghalaya: async () => {
      const res = await raw.seedMeghalaya(token);
      await cacheDelete(K.districts);
      await cacheDelete(K.sites());
      notifyChange();
      return res;
    },
    adminUsers: () => raw.adminUsers(token),
    adminApproveUser: (userId: string) => raw.adminApproveUser(token, userId),
    adminRejectUser: (userId: string) => raw.adminRejectUser(token, userId),

    _adapters: {
      createSite: (body: any) => raw.createSite(token, body),
      updateSite: (id: string, body: any) => raw.updateSite(token, id, body),
      deleteSite: (id: string) => raw.deleteSite(token, id),
      createVisit: (siteId: string, body: any) => raw.createVisit(token, siteId, body),
      updateVisit: (visitId: string, body: any) => raw.updateVisit(token, visitId, body),
      deleteVisit: (visitId: string) => raw.deleteVisit(token, visitId),
      addPhoto: (visitId: string, body: any) => raw.addPhoto(token, visitId, body),
    },
  };
}
export type OfflineApi = ReturnType<typeof makeApi>;
