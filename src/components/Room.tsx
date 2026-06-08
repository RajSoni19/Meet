"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JoinConfig } from "@/app/meeting/[code]/page";
import { useMeeting } from "@/hooks/useMeeting";
import VideoTile from "@/components/VideoTile";
import Controls from "@/components/Controls";
import ChatPanel from "@/components/ChatPanel";
import ParticipantsPanel from "@/components/ParticipantsPanel";
import { CopyIcon } from "@/components/Icons";

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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [inviteUrl]);

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
      <header className="flex items-center justify-between px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium">Meetly</span>
          <span className="hidden text-gray-400 sm:inline">|</span>
          <span className="hidden font-mono text-gray-300 sm:inline">{code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-1.5 text-xs sm:flex ${
              status === "connected" ? "text-green-400" : "text-yellow-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected" ? "bg-green-400" : "bg-yellow-400"
              }`}
            />
            {status === "connected" ? "Connected" : "Connecting…"}
          </span>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 rounded-md bg-surface-light px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-surface-lighter"
          >
            <CopyIcon width={16} height={16} />
            {copied ? "Copied!" : "Copy link"}
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
