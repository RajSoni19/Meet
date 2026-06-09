"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JoinConfig } from "@/app/meeting/[code]/page";
import { useMeeting } from "@/hooks/useMeeting";
import VideoTile from "@/components/VideoTile";
import Controls from "@/components/Controls";
import ChatPanel from "@/components/ChatPanel";
import ParticipantsPanel from "@/components/ParticipantsPanel";
import { CopyIcon, PeopleIcon } from "@/components/Icons";
import { useToast } from "@/components/ui/Toast";

interface RoomProps {
  code: string;
  peerId: string;
  config: JoinConfig;
  onLeave: () => void;
}

interface Tile {
  key: string;
  name: string;
  stream: MediaStream | null;
  audio: boolean;
  video: boolean;
  sharing: boolean;
  isLocal: boolean;
  mirror: boolean;
}

export default function Room({ code, peerId, config, onLeave }: RoomProps) {
  const localStream = config.stream;
  const { toast } = useToast();

  // Meeting timer (UI only).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  const [audioOn, setAudioOn] = useState(config.audio);
  const [videoOn, setVideoOn] = useState(config.video);
  const [sharing, setSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [copied, setCopied] = useState(false);

  const cameraTrackRef = useRef<MediaStreamTrack | null>(
    localStream.getVideoTracks()[0] ?? null
  );

  const { peers, messages, status, setLocalMeta, replaceVideoTrack, sendChat } =
    useMeeting({
      code,
      peerId,
      displayName: config.displayName,
      localStream,
      initialAudio: config.audio,
      initialVideo: config.video,
    });

  // ---- Unread chat tracking -------------------------------------------------
  const lastSeenCount = useRef(messages.length);
  useEffect(() => {
    if (chatOpen) {
      lastSeenCount.current = messages.length;
      setUnreadChat(0);
    } else {
      const unread = messages.length - lastSeenCount.current;
      setUnreadChat(unread > 0 ? unread : 0);
    }
  }, [messages, chatOpen]);

  // Make sure the local tracks' enabled state matches the UI on join (and any
  // time it changes) — so a participant who joined unmuted is actually sending
  // audio, not silently disabled by a stale track state.
  useEffect(() => {
    localStream.getAudioTracks().forEach((t) => (t.enabled = audioOn));
  }, [localStream, audioOn]);
  useEffect(() => {
    localStream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
  }, [localStream, videoOn]);

  // ---- Toggles --------------------------------------------------------------
  const toggleAudio = useCallback(() => {
    const next = !audioOn;
    setAudioOn(next);
    localStream.getAudioTracks().forEach((t) => (t.enabled = next));
    setLocalMeta({ audio: next });
  }, [audioOn, localStream, setLocalMeta]);

  const toggleVideo = useCallback(() => {
    const next = !videoOn;
    setVideoOn(next);
    localStream.getVideoTracks().forEach((t) => (t.enabled = next));
    setLocalMeta({ video: next });
  }, [videoOn, localStream, setLocalMeta]);

  // ---- Screen sharing -------------------------------------------------------
  const stopShare = useCallback(async () => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setSharing(false);
    // Restore the camera track on all peer connections.
    await replaceVideoTrack(videoOn ? cameraTrackRef.current : null);
    setLocalMeta({ sharing: false });
  }, [screenStream, replaceVideoTrack, videoOn, setLocalMeta]);

  const startShare = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      setScreenStream(display);
      setSharing(true);
      setLocalMeta({ sharing: true });
      await replaceVideoTrack(screenTrack);
      // When the user stops sharing via the browser's native control.
      screenTrack.onended = () => {
        void stopShare();
      };
    } catch (err) {
      // User cancelled the picker — ignore.
      console.debug("[meet] screen share cancelled", err);
    }
  }, [replaceVideoTrack, setLocalMeta, stopShare]);

  const toggleShare = useCallback(() => {
    if (sharing) void stopShare();
    else void startShare();
  }, [sharing, startShare, stopShare]);

  // ---- Invite link ----------------------------------------------------------
  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/meeting/${code}`;
  }, [code]);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast("Invite link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy the link", "error");
    }
  }, [inviteUrl, toast]);

  // ---- Leave on unload ------------------------------------------------------
  useEffect(() => {
    const handler = () => {
      localStream.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [localStream, screenStream]);

  // ---- Build tiles ----------------------------------------------------------
  const selfTile: Tile = {
    key: "self",
    name: config.displayName,
    stream: sharing ? screenStream : localStream,
    audio: audioOn,
    video: videoOn,
    sharing,
    isLocal: true,
    mirror: !sharing && videoOn,
  };

  const remoteTiles: Tile[] = peers.map((p) => ({
    key: p.id,
    name: p.name,
    stream: p.stream,
    audio: p.audio,
    video: p.video,
    sharing: p.sharing,
    isLocal: false,
    mirror: false,
  }));

  const allTiles = [selfTile, ...remoteTiles];
  const spotlight = allTiles.find((t) => t.sharing) ?? null;
  const sidePanelOpen = chatOpen || peopleOpen;

  return (
    <div className="flex h-screen flex-col bg-surface text-gray-100">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 border-b border-surface-border/60 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Meetly</p>
            <p className="truncate font-mono text-[11px] leading-tight text-gray-500">
              {code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <span className="hidden items-center gap-1.5 rounded-full bg-surface-light px-3 py-1.5 text-xs font-medium tabular-nums text-gray-300 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
            {elapsedLabel}
          </span>
          {/* Participant count */}
          <span className="flex items-center gap-1.5 rounded-full bg-surface-light px-3 py-1.5 text-xs font-medium text-gray-300">
            <PeopleIcon width={14} height={14} />
            {allTiles.length}
          </span>
          {/* Network / connection status */}
          <span
            className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:flex ${
              status === "connected"
                ? "bg-success/15 text-success"
                : status === "error"
                ? "bg-danger/15 text-danger"
                : "bg-warning/15 text-warning"
            }`}
            title="Network status"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected"
                  ? "bg-success"
                  : status === "error"
                  ? "bg-danger"
                  : "animate-pulse bg-warning"
              }`}
            />
            {status === "connected"
              ? "Connected"
              : status === "error"
              ? "Reconnecting"
              : "Connecting…"}
          </span>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 rounded-full bg-surface-light px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-lighter active:scale-95"
          >
            <CopyIcon width={15} height={15} />
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy link"}</span>
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        {/* Video region */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-2 sm:p-3">
            {spotlight ? (
              <SpotlightLayout
                spotlight={spotlight}
                others={allTiles.filter((t) => t.key !== spotlight.key)}
              />
            ) : (
              <GridLayout tiles={allTiles} />
            )}
          </div>

          {/* Controls */}
          <div className="shrink-0">
            <Controls
              audioOn={audioOn}
              videoOn={videoOn}
              sharing={sharing}
              chatOpen={chatOpen}
              peopleOpen={peopleOpen}
              unreadChat={unreadChat}
              participantCount={allTiles.length}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onToggleShare={toggleShare}
              onToggleChat={() => {
                setChatOpen((v) => !v);
                setPeopleOpen(false);
              }}
              onTogglePeople={() => {
                setPeopleOpen((v) => !v);
                setChatOpen(false);
              }}
              onLeave={onLeave}
            />
          </div>
        </main>

        {/* Side panel */}
        {sidePanelOpen && (
          <div className="absolute inset-0 z-20 md:relative md:inset-auto md:z-auto">
            {chatOpen && (
              <ChatPanel
                messages={messages}
                selfId={peerId}
                onSend={sendChat}
                onClose={() => setChatOpen(false)}
              />
            )}
            {peopleOpen && (
              <ParticipantsPanel
                selfName={config.displayName}
                selfAudio={audioOn}
                selfVideo={videoOn}
                selfSharing={sharing}
                peers={peers}
                inviteUrl={inviteUrl}
                onClose={() => setPeopleOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Layout helpers
// -----------------------------------------------------------------------------
function gridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function GridLayout({ tiles }: { tiles: Tile[] }) {
  const cols = gridColumns(tiles.length);
  return (
    <div
      className="grid h-full w-full gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: "1fr",
      }}
    >
      {tiles.map((t) => (
        <TileView key={t.key} tile={t} />
      ))}
    </div>
  );
}

function SpotlightLayout({
  spotlight,
  others,
}: {
  spotlight: Tile;
  others: Tile[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-2 lg:flex-row">
      <div className="min-h-0 flex-1">
        <TileView tile={spotlight} />
      </div>
      {others.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto">
          {others.map((t) => (
            <div
              key={t.key}
              className="aspect-video w-40 shrink-0 lg:w-full"
            >
              <TileView tile={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TileView({ tile }: { tile: Tile }) {
  return (
    <VideoTile
      stream={tile.stream}
      name={tile.name}
      audioOn={tile.audio}
      videoOn={tile.video}
      sharing={tile.sharing}
      isLocal={tile.isLocal}
      mirror={tile.mirror}
    />
  );
}
