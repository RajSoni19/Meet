"use client";

import type { RemotePeer } from "@/lib/types";
import {
  CloseIcon,
  MicIcon,
  MicOffIcon,
  VideoOffIcon,
  ScreenShareIcon,
  CopyIcon,
} from "@/components/Icons";
import { initials, colorFromString } from "@/lib/utils";
import { useState } from "react";

interface ParticipantsPanelProps {
  selfName: string;
  selfAudio: boolean;
  selfVideo: boolean;
  selfSharing: boolean;
  peers: RemotePeer[];
  inviteUrl: string;
  onClose: () => void;
}

export default function ParticipantsPanel({
  selfName,
  selfAudio,
  selfVideo,
  selfSharing,
  peers,
  inviteUrl,
  onClose,
}: ParticipantsPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const total = peers.length + 1;

  return (
    <aside className="flex h-full w-full flex-col bg-surface-light md:w-80">
      <header className="flex items-center justify-between border-b border-surface-lighter px-4 py-3">
        <h2 className="text-base font-medium">People ({total})</h2>
        <button
          onClick={onClose}
          aria-label="Close participants"
          className="rounded-full p-1 text-gray-400 hover:bg-surface-lighter hover:text-white"
        >
          <CloseIcon width={20} height={20} />
        </button>
      </header>

      <div className="border-b border-surface-lighter p-3">
        <button
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-surface px-3 py-2 text-sm font-medium text-brand-light transition hover:bg-surface-lighter"
        >
          <CopyIcon width={18} height={18} />
          {copied ? "Link copied!" : "Copy joining info"}
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <Row
          name={`${selfName} (You)`}
          audio={selfAudio}
          video={selfVideo}
          sharing={selfSharing}
        />
        {peers.map((p) => (
          <Row
            key={p.id}
            name={p.name}
            audio={p.audio}
            video={p.video}
            sharing={p.sharing}
          />
        ))}
      </div>
    </aside>
  );
}

function Row({
  name,
  audio,
  video,
  sharing,
}: {
  name: string;
  audio: boolean;
  video: boolean;
  sharing: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface-lighter/50">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: colorFromString(name) }}
        >
          {initials(name)}
        </div>
        <span className="truncate text-sm text-gray-200">{name}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        {sharing && <ScreenShareIcon width={18} height={18} />}
        {!video && <VideoOffIcon width={18} height={18} />}
        {audio ? (
          <MicIcon width={18} height={18} />
        ) : (
          <span className="text-red-400">
            <MicOffIcon width={18} height={18} />
          </span>
        )}
      </div>
    </div>
  );
}
