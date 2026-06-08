"use client";

import { useEffect, useRef } from "react";
import { MicOffIcon, ScreenShareIcon } from "@/components/Icons";
import { initials, colorFromString } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  audioOn: boolean;
  videoOn: boolean;
  sharing?: boolean;
  isLocal?: boolean;
  /** Mirror the video (true for local camera, false for screen share). */
  mirror?: boolean;
}

export default function VideoTile({
  stream,
  name,
  audioOn,
  videoOn,
  sharing = false,
  isLocal = false,
  mirror = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const showVideo = videoOn || sharing;

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-xl bg-surface-light shadow-lg">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`h-full w-full ${sharing ? "object-contain bg-black" : "object-cover"} ${
            mirror && !sharing ? "mirror" : ""
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-medium text-white"
            style={{ backgroundColor: colorFromString(name) }}
          >
            {initials(name)}
          </div>
        </div>
      )}

      {/* Name + status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
          {sharing && <ScreenShareIcon width={16} height={16} />}
          {name}
          {isLocal && " (You)"}
        </span>
        {!audioOn && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <MicOffIcon width={14} height={14} />
          </span>
        )}
      </div>
    </div>
  );
}
