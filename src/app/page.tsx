"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateMeetingCode, isValidMeetingCode } from "@/lib/utils";
import { recordMeeting } from "@/lib/history";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { CreateMeetingModal } from "@/components/CreateMeetingModal";
import {
  VideoCallIcon,
  ShieldIcon,
  PeopleIcon,
  ChatIcon,
  ScreenShareIcon,
  CopyIcon,
} from "@/components/Icons";

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [joinInput, setJoinInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  function parseCode(input: string): string {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/meeting\/([^/?#\s]+)/i);
    if (urlMatch) return urlMatch[1].toLowerCase();
    return trimmed.toLowerCase();
  }

  async function handleCreate() {
    if (!isSupabaseConfigured) {
      toast("Supabase is not configured (.env.local).", "error");
      return;
    }
    setCreating(true);
    try {
      const code = generateMeetingCode();
      const supabase = getSupabase();
      const { error } = await supabase
        .from("meetings")
        .insert({ code, title: "New meeting", is_active: true });
      if (error) throw error;
      recordMeeting({ code, role: "host" });
      setCreatedCode(code);
    } catch (err) {
      console.error(err);
      toast("Could not create the meeting. Try again.", "error");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin() {
    const code = parseCode(joinInput);
    if (!code) return toast("Enter a meeting code or link.", "info");
    if (!isValidMeetingCode(code))
      return toast("That doesn't look like a valid code.", "error");
    recordMeeting({ code, role: "guest" });
    router.push(`/meeting/${code}`);
  }

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-glow">
              <VideoCallIcon width={20} height={20} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Meetly
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-gray-400 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#testimonials" className="transition hover:text-white">Reviews</a>
            <Link href="/dashboard" className="transition hover:text-white">Dashboard</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Dashboard
              </Button>
            </Link>
            <Button size="sm" onClick={handleCreate} loading={creating}>
              <VideoCallIcon width={16} height={16} />
              New meeting
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-2">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-light px-3 py-1 text-xs font-medium text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              No downloads · No sign-up · Free
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Meetings that just{" "}
              <span className="text-gradient">work</span>.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-gray-400">
              Premium video calls in one click. Start a meeting, share the link,
              and connect instantly — secure, HD, and beautifully simple.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={handleCreate} loading={creating} className="sm:w-auto">
                <VideoCallIcon width={20} height={20} />
                Start a meeting
              </Button>
              <div className="flex flex-1 items-center overflow-hidden rounded-full border border-surface-border bg-surface-light pl-1 focus-within:border-brand-light">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Enter a code or link"
                  aria-label="Meeting code or link"
                  className="h-12 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-gray-500"
                />
                <button
                  onClick={handleJoin}
                  className="m-1 rounded-full px-4 py-2 text-sm font-medium text-brand-light transition hover:bg-surface-lighter"
                >
                  Join
                </button>
              </div>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-400">
              <Stat icon={<ShieldIcon width={16} height={16} />} label="Encrypted in transit" />
              <Stat icon={<PeopleIcon width={16} height={16} />} label="Group calls" />
              <Stat icon={<ScreenShareIcon width={16} height={16} />} label="Screen share" />
            </div>
          </div>

          {/* Product mock */}
          <div className="relative animate-scale-in">
            <Card className="overflow-hidden p-2">
              <div className="grid aspect-video grid-cols-2 grid-rows-2 gap-2 rounded-xl bg-surface p-2">
                {[
                  { n: "Aarav", c: "#6366f1" },
                  { n: "Mira", c: "#ec4899" },
                  { n: "Leo", c: "#22c55e" },
                  { n: "Sana", c: "#f59e0b" },
                ].map((p, i) => (
                  <div
                    key={p.n}
                    className="relative flex items-center justify-center rounded-lg bg-surface-light"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white"
                      style={{ background: p.c }}
                    >
                      {p.n[0]}
                    </div>
                    <span className="absolute bottom-1.5 left-2 text-xs text-gray-300">
                      {p.n}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 py-3">
                {["#22242e", "#22242e", "#6366f1", "#22242e", "#ef4444"].map(
                  (c, i) => (
                    <span
                      key={i}
                      className="h-9 w-9 rounded-full"
                      style={{ background: c }}
                    />
                  )
                )}
              </div>
            </Card>
            <div className="absolute -right-4 -top-4 -z-10 h-32 w-32 rounded-full bg-brand/30 blur-3xl" />
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
        <SectionHeading
          eyebrow="Everything you need"
          title="Powerful, yet effortless"
          subtitle="Meetly brings the features of premium conferencing tools into a clean, distraction-free experience."
        />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: <VideoCallIcon />, title: "HD video & audio", desc: "Crisp, low-latency calls with automatic quality tuning." },
            { icon: <ScreenShareIcon />, title: "Screen sharing", desc: "Present your screen with a one-tap spotlight layout." },
            { icon: <ChatIcon />, title: "In-call chat", desc: "Send messages during the call — everyone stays in sync." },
            { icon: <PeopleIcon />, title: "Group meetings", desc: "Bring your whole team together in seconds." },
            { icon: <CopyIcon />, title: "Instant invites", desc: "Share one link. No accounts, no installs, no friction." },
            { icon: <ShieldIcon />, title: "Private & secure", desc: "Peer-to-peer media, encrypted in transit by default." },
          ].map((f) => (
            <Card key={f.title} hover className="p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand-light">
                {f.icon}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="border-y border-surface-border/60 bg-surface-light/30">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <SectionHeading
            eyebrow="Get started in seconds"
            title="Three steps to connect"
          />
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { n: "1", t: "Create a meeting", d: "Click “Start a meeting” — your room is ready instantly." },
              { n: "2", t: "Share the link", d: "Copy and send the invite link to anyone you want to meet." },
              { n: "3", t: "Connect & collaborate", d: "They join in one tap. Talk, share, and chat in HD." },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-white shadow-glow">
                  {s.n}
                </div>
                {i < 2 && (
                  <div className="absolute left-12 top-6 hidden h-px w-full bg-gradient-to-r from-brand/50 to-transparent md:block" />
                )}
                <h3 className="mt-5 font-display text-lg font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section id="testimonials" className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
        <SectionHeading
          eyebrow="Loved by teams"
          title="What people are saying"
        />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { q: "Switched our standups to Meetly — the no-install link is a game changer.", n: "Priya Sharma", r: "Engineering Lead" },
            { q: "Beautiful, fast, and dead simple. My clients join without any confusion.", n: "Daniel Ortiz", r: "Freelance Designer" },
            { q: "Screen sharing and chat just work. Feels like a premium product.", n: "Aisha Khan", r: "Product Manager" },
          ].map((t) => (
            <Card key={t.n} className="flex flex-col p-6">
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
                    <path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-gray-200">“{t.q}”</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 font-semibold text-brand-light">
                  {t.n[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.n}</p>
                  <p className="text-xs text-gray-500">{t.r}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-surface-border bg-gradient-to-br from-brand/20 via-surface-light to-surface-light p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.25),transparent_60%)]" />
          <h2 className="relative font-display text-3xl font-bold md:text-4xl">
            Ready to meet?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-gray-400">
            Start a free meeting now — no account required.
          </p>
          <div className="relative mt-7 flex justify-center">
            <Button size="lg" onClick={handleCreate} loading={creating}>
              <VideoCallIcon width={20} height={20} />
              Start a meeting
            </Button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-surface-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-gray-500 md:flex-row md:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <VideoCallIcon width={16} height={16} />
            </span>
            <span className="font-display font-semibold text-gray-300">Meetly</span>
          </div>
          <p>© {new Date().getFullYear()} Meetly. Built with Next.js & WebRTC.</p>
          <div className="flex gap-5">
            <a href="#features" className="transition hover:text-gray-300">Features</a>
            <Link href="/dashboard" className="transition hover:text-gray-300">Dashboard</Link>
          </div>
        </div>
      </footer>

      <CreateMeetingModal
        open={!!createdCode}
        code={createdCode ?? ""}
        onClose={() => setCreatedCode(null)}
        onJoin={() => createdCode && router.push(`/meeting/${createdCode}`)}
      />
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-brand-light">{icon}</span>
      {label}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-wider text-brand-light">
        {eyebrow}
      </span>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-gray-400">{subtitle}</p>}
    </div>
  );
}
