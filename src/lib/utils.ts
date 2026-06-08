/** Generate a Google-Meet-style meeting code, e.g. "abc-defg-hij". */
export function generateMeetingCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part = (len: number) =>
    Array.from({ length: len }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  return `${part(3)}-${part(4)}-${part(3)}`;
}

/** Generate a random, unique-enough peer id for this browser session. */
export function generatePeerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Validate a meeting code shape: lower-case letters/numbers and dashes. */
export function isValidMeetingCode(code: string): boolean {
  return /^[a-z0-9]{3,}(-[a-z0-9]{3,}){0,3}$/i.test(code.trim());
}

/** Deterministic colour from a string (for avatar backgrounds). */
export function colorFromString(str: string): string {
  const colors = [
    "#1a73e8",
    "#ea4335",
    "#34a853",
    "#fbbc04",
    "#9334e6",
    "#00acc1",
    "#ff7043",
    "#5e35b1",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** First letter(s) for an avatar from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Format an ISO timestamp as HH:MM. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
