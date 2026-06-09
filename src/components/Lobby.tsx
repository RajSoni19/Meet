"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JoinConfig } from "@/app/meeting/[code]/page";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/Icons";
import { initials, colorFromString } from "@/lib/utils";

interface LobbyProps {
  code: string;
  onJoin: (config: JoinConfig) => void;
}

type Permission = "pending" | "granted" | "denied";

export default function Lobby({ code, onJoin }: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);

  const [name, setName] = useState("");
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const audioOnRef = useRef(true);
  const videoOnRef = useRef(true);

  const [permission, setPermission] = useState<Permission>("pending");
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("meetly:name");
    if (saved) setName(saved);
  }, []);

  // ---- Acquire camera + microphone -----------------------------------------
  const acquire = useCallback(async () => {
    setPermission("pending");
    setErrorMsg(null);
    const videoQuality = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, ...videoQuality }
          : videoQuality,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;

      const aTracks = stream.getAudioTracks();
      const vTracks = stream.getVideoTracks();
      setHasAudio(aTracks.length > 0);
      setHasVideo(vTracks.length > 0);
      aTracks.forEach((t) => (t.enabled = audioOnRef.current));
      vTracks.forEach((t) => (t.enabled = videoOnRef.current));
      if (vTracks.length === 0) setVideoOn(false);

      if (videoRef.current) videoRef.current.srcObject = stream;

      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list);
      setPermission("granted");
    } catch (err) {
      const name = (err as DOMException)?.name || "";
      console.error("[lobby] getUserMedia failed:", name, err);

      // Camera failed but maybe the mic is fine — try audio only so the user
      // can at least be heard (the #1 thing people care about).
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = audioStream;
          setHasAudio(true);
          setHasVideo(false);
          setVideoOn(false);
          const list = await navigator.mediaDevices.enumerateDevices();
          setDevices(list);
          setPermission("granted");
          setErrorMsg("No camera found — you'll join with audio only.");
          return;
        } catch {
          /* fall through to denied */
        }
      }

      setPermission("denied");
      setErrorMsg(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera & microphone access was blocked."
          : "Couldn't access your camera or microphone."
      );
    }
  }, [audioDeviceId, videoDeviceId]);

  // Request on mount and whenever the chosen device changes.
  useEffect(() => {
    acquire();
  }, [acquire]);

  // Cleanup if the user navigates away without joining.
  useEffect(() => {
    return () => {
      if (!joinedRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function toggleAudio() {
    if (!hasAudio) return;
    const next = !audioOn;
    setAudioOn(next);
    audioOnRef.current = next;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

  function toggleVideo() {
    if (!hasVideo) return;
    const next = !videoOn;
    setVideoOn(next);
    videoOnRef.current = next;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  }

  function handleJoin() {
    const displayName = name.trim() || "Guest";
    localStorage.setItem("meetly:name", displayName);
    const stream = streamRef.current ?? new MediaStream();
    joinedRef.current = true;
    onJoin({
      displayName,
      audio: audioOn && hasAudio,
      video: videoOn && hasVideo,
      stream,
    });
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  const showVideoPreview = permission === "granted" && videoOn && hasVideo;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-10 lg:flex-row lg:gap-16">
      {/* Preview */}
      <div className="w-full max-w-xl">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
          {showVideoPreview ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="mirror h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-light">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-medium text-white"
                style={{ backgroundColor: colorFromString(name || "Guest") }}
              >
                {initials(name || "Guest")}
              </div>
            </div>
          )}

          {/* Permission overlay (the in-app prompt) */}
          {permission !== "granted" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              {permission === "pending" ? (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-500 border-t-brand-light" />
                  <p className="text-sm font-medium text-gray-100">
                    Allow camera &amp; microphone
                  </p>
                  <p className="max-w-xs text-xs text-gray-400">
                    Your browser is asking for permission — click{" "}
                    <span className="font-semibold text-gray-200">Allow</span>{" "}
                    so others can see and hear you.
                  </p>
                </>
              ) : (
                <>
                  <span className="text-red-400">
                    <MicOffIcon width={36} height={36} />
                  </span>
                  <p className="text-sm font-medium text-gray-100">
                    Camera &amp; microphone are blocked
                  </p>
                  <p className="max-w-xs text-xs text-gray-400">
                    Click the camera / lock icon in your browser&apos;s address
                    bar, choose <span className="font-semibold">Allow</span>,
                    then press the button below.
                  </p>
                  <button
                    onClick={acquire}
                    className="mt-1 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
                  >
                    Allow access &amp; retry
                  </button>
                </>
              )}
            </div>
          )}

          {/* Toggle controls (only meaningful once granted) */}
          {permission === "granted" && (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4">
              <button
                onClick={toggleAudio}
                disabled={!hasAudio}
                aria-label={audioOn ? "Turn off microphone" : "Turn on microphone"}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
                  audioOn && hasAudio
                    ? "bg-surface-lighter/80 text-white hover:bg-surface-lighter"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {audioOn && hasAudio ? <MicIcon /> : <MicOffIcon />}
              </button>
              <button
                onClick={toggleVideo}
                disabled={!hasVideo}
                aria-label={videoOn ? "Turn off camera" : "Turn on camera"}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-50 ${
                  videoOn && hasVideo
                    ? "bg-surface-lighter/80 text-white hover:bg-surface-lighter"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {videoOn && hasVideo ? <VideoIcon /> : <VideoOffIcon />}
              </button>
            </div>
          )}
        </div>

        {/* Device pickers — shown once access is granted */}
        {permission === "granted" &&
          (audioInputs.length > 0 || videoInputs.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DeviceSelect
                label="Microphone"
                value={audioDeviceId}
                devices={audioInputs}
                onChange={setAudioDeviceId}
              />
              <DeviceSelect
                label="Camera"
                value={videoDeviceId}
                devices={videoInputs}
                onChange={setVideoDeviceId}
              />
            </div>
          )}
      </div>

      {/* Join panel */}
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-normal text-gray-100">Ready to join?</h1>
        <p className="mt-2 text-sm text-gray-400">
          Meeting code: <span className="font-mono text-gray-200">{code}</span>
        </p>

        {/* Warnings */}
        {permission === "granted" && !hasAudio && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-300">
            ⚠️ No microphone — others won&apos;t hear you.{" "}
            <button onClick={acquire} className="font-semibold underline">
              Try again
            </button>
          </p>
        )}
        {errorMsg && permission === "granted" && hasAudio && (
          <p className="mt-4 rounded-md bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            {errorMsg}
          </p>
        )}
        {permission === "denied" && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {errorMsg} Allow access above so you can be seen and heard.
          </p>
        )}

        <input
          id="name-input"
          name="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && permission === "granted" && handleJoin()
          }
          placeholder="Your name"
          className="mt-6 w-full rounded-md border border-surface-lighter bg-surface-light px-4 py-3 text-center text-sm outline-none focus:border-brand-light"
        />

        {permission === "denied" ? (
          <div className="mt-4 space-y-2">
            <button
              onClick={acquire}
              className="w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark"
            >
              Allow camera &amp; microphone
            </button>
            <button
              onClick={handleJoin}
              className="w-full text-xs text-gray-400 underline hover:text-gray-200"
            >
              Join without camera &amp; microphone
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={permission !== "granted"}
            className="mt-4 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {permission === "granted" ? "Join now" : "Waiting for access…"}
          </button>
        )}
      </div>
    </main>
  );
}

function DeviceSelect({
  label,
  value,
  devices,
  onChange,
}: {
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-surface-lighter bg-surface-light px-3 py-2 text-sm outline-none focus:border-brand-light"
      >
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
