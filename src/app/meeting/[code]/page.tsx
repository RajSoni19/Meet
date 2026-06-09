"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { generatePeerId } from "@/lib/utils";
import { recordMeeting } from "@/lib/history";

// Dynamically import components to prevent hydration issues
const Lobby = dynamic(() => import("@/components/Lobby"), { ssr: false });
const Room = dynamic(() => import("@/components/Room"), { ssr: false });

export interface JoinConfig {
  displayName: string;
  audio: boolean;
  video: boolean;
  stream: MediaStream;
}

export default function MeetingPage() {
  const params = useParams<{ code: string }>();
  const [mounted, setMounted] = useState(false);
  
  const code = useMemo(() => {
    if (!mounted) return "";
    return (params?.code ?? "").toString().toLowerCase();
  }, [params?.code, mounted]);

  // One stable peer id per browser tab / session.
  const peerId = useMemo(() => generatePeerId(), []);

  const [joinConfig, setJoinConfig] = useState<JoinConfig | null>(null);

  // Ensure we only render after mounting on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleJoin = useCallback(
    (config: JoinConfig) => {
      if (code) recordMeeting({ code, role: "guest" });
      setJoinConfig(config);
    },
    [code]
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-gray-300">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-surface-lighter border-t-brand-light" />
        <p className="text-sm text-gray-500">Setting up your meeting…</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-gray-300">
        Invalid meeting link.
      </div>
    );
  }

  if (!joinConfig) {
    return <Lobby code={code} onJoin={handleJoin} />;
  }

  return (
    <Room
      code={code}
      peerId={peerId}
      config={joinConfig}
      onLeave={() => {
        joinConfig.stream.getTracks().forEach((t) => t.stop());
        setJoinConfig(null);
      }}
    />
  );
}
