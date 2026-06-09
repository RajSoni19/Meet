"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateMeetingCode, isValidMeetingCode } from "@/lib/utils";
import {
  getRecentMeetings,
  recordMeeting,
  clearRecentMeetings,
  type RecentMeeting,
} from "@/lib/history";
import { Button } from "@/components/ui/Button";
import { Card, Skeleton } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { CreateMeetingModal } from "@/components/CreateMeetingModal";
import {
  VideoCallIcon,
  PeopleIcon,
  CopyIcon,
  ChatIcon,
  ScreenShareIcon,
} from "@/components/Icons";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [meetings, setMeetings] = useState<RecentMeeting[]>([]);
  const [joinInput, setJoinInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    setMeetings(getRecentMeetings());
    setMounted(true);
  }, []);

  async function handleCreate() {
    if (!isSupabaseConfigured) return toast("Supabase not configured.", "error");
    setCreating(true);
    try {
      const code = generateMeetingCode();
      const { error } = await getSupabase()
        .from("meetings")
        .insert({ code, title: "New meeting", is_active: true });
      if (error) throw error;
      recordMeeting({ code, role: "host" });
      setMeetings(getRecentMeetings());
      setCreatedCode(code);
    } catch {
      toast("Could not create the meeting.", "error");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin() {
    const raw = joinInput.trim();
    const m = raw.match(/meeting\/([^/?#\s]+)/i);
    const code = (m ? m[1] : raw).toLowerCase();
    if (!isValidMeetingCode(code)) return toast("Invalid meeting code.", "error");
    recordMeeting({ code, role: "guest" });
    router.push(`/meeting/${code}`);
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${code}`);
      toast("Invite link copied", "success");
    } catch {
      toast("Couldn't copy link", "error");
    }
  }

  const hosted = meetings.filter((m) => m.role === "host").length;
  const joined = meetings.length - hosted;
  const thisWeek = meetings.filter(
    (m) => Date.now() - m.lastJoined < 7 * 864e5
  ).length;

  const stats = [
    { label: "Total meetings", value: meetings.length, icon: <VideoCallIcon width={20} height={20} /> },
    { label: "Hosted", value: hosted, icon: <ScreenShareIcon width={20} height={20} /> },
    { label: "Joined", value: joined, icon: <PeopleIcon width={20} height={20} /> },
    { label: "This week", value: thisWeek, icon: <ChatIcon width={20} height={20} /> },
  ];

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-glow">
              <VideoCallIcon width={20} height={20} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Meetly</span>
          </Link>
          <Button size="sm" onClick={handleCreate} loading={creating}>
            <VideoCallIcon width={16} height={16} />
            New meeting
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        <div className="animate-slide-up">
          <h1 className="font-display text-2xl font-bold md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Start a new meeting or jump back into a recent one.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              {!mounted ? (
                <Skeleton className="h-10 w-16" />
              ) : (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand-light">
                    {s.icon}
                  </span>
                  <p className="mt-3 font-display text-3xl font-bold">{s.value}</p>
                  <p className="text-sm text-gray-400">{s.label}</p>
                </>
              )}
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card hover className="flex items-center justify-between p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">New meeting</h3>
              <p className="mt-1 text-sm text-gray-400">Create an instant room and share the link.</p>
            </div>
            <Button onClick={handleCreate} loading={creating}>
              <VideoCallIcon width={18} height={18} />
              Create
            </Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold">Join with a code</h3>
            <div className="mt-3 flex items-center overflow-hidden rounded-full border border-surface-border bg-surface pl-1">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="abc-defg-hij"
                aria-label="Meeting code"
                className="h-11 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-gray-500"
              />
              <Button size="sm" variant="secondary" className="m-1" onClick={handleJoin}>
                Join
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent meetings */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Recent meetings</h2>
          {mounted && meetings.length > 0 && (
            <button
              onClick={() => {
                clearRecentMeetings();
                setMeetings([]);
                toast("History cleared", "info");
              }}
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Clear history
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {!mounted ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))
          ) : meetings.length === 0 ? (
            <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand-light">
                <VideoCallIcon width={30} height={30} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">No meetings yet</h3>
              <p className="mt-1 max-w-xs text-sm text-gray-400">
                Your created and joined meetings will appear here for quick access.
              </p>
              <Button className="mt-5" onClick={handleCreate} loading={creating}>
                <VideoCallIcon width={18} height={18} />
                Start your first meeting
              </Button>
            </Card>
          ) : (
            meetings.map((m) => (
              <Card
                key={m.code}
                hover
                className="flex items-center gap-4 p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-lighter text-brand-light">
                  <VideoCallIcon width={20} height={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{m.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        m.role === "host"
                          ? "bg-brand/20 text-brand-light"
                          : "bg-surface-lighter text-gray-300"
                      }`}
                    >
                      {m.role === "host" ? "Host" : "Guest"}
                    </span>
                  </div>
                  <p className="truncate font-mono text-xs text-gray-500">
                    {m.code} · {timeAgo(m.lastJoined)}
                  </p>
                </div>
                <button
                  onClick={() => copyLink(m.code)}
                  aria-label="Copy invite link"
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-surface-lighter hover:text-white"
                >
                  <CopyIcon width={18} height={18} />
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    recordMeeting({ code: m.code, role: m.role });
                    router.push(`/meeting/${m.code}`);
                  }}
                >
                  Rejoin
                </Button>
              </Card>
            ))
          )}
        </div>
      </main>

      <CreateMeetingModal
        open={!!createdCode}
        code={createdCode ?? ""}
        onClose={() => setCreatedCode(null)}
        onJoin={() => createdCode && router.push(`/meeting/${createdCode}`)}
      />
    </div>
  );
}
