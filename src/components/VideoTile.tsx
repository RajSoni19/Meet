"use client";

import { useEffect, useRef } from "react";
import { MicOffIcon, ScreenShareIcon } from "@/components/Icons";
import { Avatar } from "@/components/ui/Avatar";

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
  const audioRef = useRef<HTMLAudioElement>(null);

  // A signature of the current track ids so the effects below re-run when a
  // track is added LATE (audio/video can arrive after the element mounts).
  const trackSig = stream
    ? stream
        .getTracks()
        .map((t) => t.id)
        .join(",")
    : "";

  const showVideo = videoOn || sharing;

  // Attach the stream to the (always-muted) video element for the picture.
  useEffect(() => {
    const el = videoRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream, trackSig, showVideo]);

  // Remote audio plays through a DEDICATED <audio> element. The video element
  // is muted to avoid double audio/echo. Decoupling audio fixes the common bug
  // where a late-added audio track never plays from the video element. We also
  // explicitly call play() because autoplay-with-sound can need a nudge.
  useEffect(() => {
    if (isLocal) return;
    const el = audioRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = false;
    el.volume = 1;

    const tryPlay = () => {
      el.play().catch(() => {
        /* blocked by autoplay policy — will retry on the next user gesture */
      });
    };
    tryPlay();

    // Browsers (especially on mobile) block audio that starts after page load
    // until the user interacts. Retry playback on ANY user gesture until it
    // actually plays, so a remote participant is never silently inaudible.
    const onGesture = () => {
      if (el.paused) tryPlay();
      if (!el.paused) {
        document.removeEventListener("pointerdown", onGesture);
        document.removeEventListener("touchstart", onGesture);
        document.removeEventListener("keydown", onGesture);
      }
    };
    document.addEventListener("pointerdown", onGesture);
    document.addEventListener("touchstart", onGesture);
    document.addEventListener("keydown", onGesture);

    return () => {
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("touchstart", onGesture);
      document.removeEventListener("keydown", onGesture);
    };
  }, [stream, trackSig, isLocal]);

  return (
    <div
      className={`group relative h-full w-full animate-scale-in overflow-hidden rounded-2xl bg-surface-light shadow-card ring-1 transition-all duration-200 ${
        sharing ? "ring-brand/50" : "ring-white/5 hover:ring-white/10"
      }`}
    >
      {/* Dedicated audio sink for the remote participant. */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted /* video element is visual-only; audio comes from <audio> above */
          className={`h-full w-full ${sharing ? "object-contain bg-black" : "object-cover"} ${
            mirror && !sharing ? "mirror" : ""
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-light to-surface">
          <Avatar name={name} size={84} />
        </div>
      )}

      {/* Sharing badge */}
      {sharing && (
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand/90 px-2.5 py-1 text-xs font-medium text-white shadow-soft">
          <ScreenShareIcon width={14} height={14} />
          Presenting
        </span>
      )}

      {/* Name + status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-2.5 pt-6">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-white drop-shadow">
          <span className="truncate">{name}</span>
          {isLocal && <span className="text-gray-300">(You)</span>}
        </span>
        {!audioOn && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-white shadow-soft">
            <MicOffIcon width={14} height={14} />
          </span>
        )}
      </div>
    </div>
  );
}
