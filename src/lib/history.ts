"use client";

/**
 * Lightweight per-browser meeting history (no auth needed). Stores meetings the
 * user created or joined so the dashboard can show "recent meetings". Purely a
 * UI convenience — the source of truth remains Supabase.
 */
export interface RecentMeeting {
  code: string;
  title: string;
  role: "host" | "guest";
  lastJoined: number; // epoch ms
}

const KEY = "meetly:recent";
const MAX = 24;

export function getRecentMeetings(): RecentMeeting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentMeeting[];
    return list.sort((a, b) => b.lastJoined - a.lastJoined);
  } catch {
    return [];
  }
}

export function recordMeeting(entry: {
  code: string;
  title?: string;
  role: "host" | "guest";
}): void {
  if (typeof window === "undefined") return;
  try {
    const all = getRecentMeetings();
    const prev = all.find((m) => m.code === entry.code);
    const list = all.filter((m) => m.code !== entry.code);
    list.unshift({
      code: entry.code,
      title: entry.title || prev?.title || "Meeting",
      // Never downgrade a host to guest on a later visit.
      role: prev?.role === "host" ? "host" : entry.role,
      lastJoined: Date.now(),
    });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRecentMeetings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
