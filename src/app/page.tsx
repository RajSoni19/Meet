"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  generateMeetingCode,
  isValidMeetingCode,
} from "@/lib/utils";
import { VideoCallIcon, ShieldIcon, PeopleIcon, ChatIcon } from "@/components/Icons";

export default function HomePage() {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Extract a meeting code from a raw code or a full invite URL. */
  function parseCode(input: string): string {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/meeting\/([^/?#\s]+)/i);
    if (urlMatch) return urlMatch[1].toLowerCase();
    return trimmed.toLowerCase();
  }

  async function handleCreate() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
      );
      return;
    }
    setCreating(true);
    try {
      const code = generateMeetingCode();
      const supabase = getSupabase();
      console.log("[DEBUG] Inserting meeting with code:", code);
      const { data, error: insertError } = await supabase
        .from("meetings")
        .insert({ code, title: "New meeting", is_active: true });
      console.log("[DEBUG] Insert response - data:", data, "error:", insertError);
      if (insertError) throw insertError;
      router.push(`/meeting/${code}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[DEBUG] Meeting creation error:", errorMsg, err);
      setError(
        `Could not create the meeting: ${errorMsg}. Ensure the 'meetings' table exists in Supabase and RLS policies allow inserts.`
      );
      setCreating(false);
    }
  }

  function handleJoin() {
    setError(null);
    const code = parseCode(joinInput);
    if (!code) {
      setError("Enter a meeting code or link.");
      return;
    }
    if (!isValidMeetingCode(code)) {
      setError("That doesn't look like a valid meeting code.");
      return;
    }
    router.push(`/meeting/${code}`);
  }

  return (
    <main className="min-h-screen bg-surface text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <span className="text-brand-light">
            <VideoCallIcon width={32} height={32} />
          </span>
          <span className="text-xl font-medium tracking-tight">Meetly</span>
        </div>
        <span className="text-sm text-gray-400">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 md:grid-cols-2 md:px-10 md:py-20">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-normal leading-tight md:text-5xl">
            Video calls and meetings for{" "}
            <span className="text-brand-light">everyone</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-gray-400">
            Connect, collaborate and celebrate from anywhere with Meetly. Start
            a meeting in one click and share the link — no downloads required.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              <VideoCallIcon width={20} height={20} />
              {creating ? "Creating…" : "New meeting"}
            </button>

            <div className="flex flex-1 overflow-hidden rounded-md border border-surface-lighter focus-within:border-brand-light">
              <input
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter a code or link"
                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-500"
              />
              <button
                onClick={handleJoin}
                className="px-4 text-sm font-medium text-brand-light hover:bg-surface-light"
              >
                Join
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="mt-10 flex flex-wrap gap-6 text-sm text-gray-400">
            <Feature icon={<ShieldIcon width={18} height={18} />} label="Encrypted in transit" />
            <Feature icon={<PeopleIcon width={18} height={18} />} label="Group meetings" />
            <Feature icon={<ChatIcon width={18} height={18} />} label="In-call chat" />
          </div>
        </div>

        {/* Illustration */}
        <div className="relative hidden md:block">
          <div className="aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-brand/30 to-purple-500/20 p-1 shadow-2xl">
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-xl bg-surface-light"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-medium text-white"
                    style={{
                      backgroundColor: ["#1a73e8", "#ea4335", "#34a853", "#fbbc04"][i],
                    }}
                  >
                    {["A", "B", "C", "D"][i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 -z-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-brand-light">{icon}</span>
      {label}
    </span>
  );
}
