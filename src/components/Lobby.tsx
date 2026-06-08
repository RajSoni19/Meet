"use client";

import { useEffect, useRef, useState } from "react";
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

export default function Lobby({ code, onJoin }: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [name, setName] = useState("");
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");

  // Restore a previously used display name.
  useEffect(() => {
    const saved = localStorage.getItem("meetly:name");
    if (saved) setName(saved);
  }, []);

  // Acquire the media stream (and re-acquire when a device is changed).
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Always request 720p (with a fixed deviceId too) and noise/echo
        // processing, otherwise the browser falls back to a low default
        // resolution (e.g. 640x480) which looks blurry when scaled up.
        const videoQuality = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        };
        const constraints: MediaStreamConstraints = {
          audio: {
            ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: videoDeviceId
            ? { deviceId: { exact: videoDeviceId }, ...videoQuality }
            : videoQuality,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Stop the old stream before swapping.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;

        // Apply current toggle state.
        stream.getAudioTracks().forEach((t) => (t.enabled = audioOn));
        stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));

        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
        setError(null);

        // Populate device list (labels are only available after permission).
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(list);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            "We couldn't access your camera or microphone. Please allow " +
              "permissions in your browser and reload."
          );
          setReady(true); // allow joining without media
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // Re-run only when a specific device is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDeviceId, videoDeviceId]);

  // Cleanup on unmount if we never joined.
  useEffect(() => {
    return () => {
      // Only stop if join wasn't pressed (join hands the stream off).
      if (!joinedRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const joinedRef = useRef(false);

  function toggleAudio() {
    const next = !audioOn;
    setAudioOn(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

  function toggleVideo() {
    const next = !videoOn;
    setVideoOn(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  }

  function handleJoin() {
    const displayName = name.trim() || "Guest";
    localStorage.setItem("meetly:name", displayName);
    const stream = streamRef.current ?? new MediaStream();
    joinedRef.current = true;
    onJoin({ displayName, audio: audioOn, video: videoOn, stream });
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-10 lg:flex-row lg:gap-16">
      {/* Preview */}
      <div className="w-full max-w-xl">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
          {videoOn ? (
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

          {/* Toggle controls */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4">
            <button
              onClick={toggleAudio}
              aria-label={audioOn ? "Turn off microphone" : "Turn on microphone"}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                audioOn
                  ? "bg-surface-lighter/80 text-white hover:bg-surface-lighter"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {audioOn ? <MicIcon /> : <MicOffIcon />}
            </button>
            <button
              onClick={toggleVideo}
              aria-label={videoOn ? "Turn off camera" : "Turn on camera"}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                videoOn
                  ? "bg-surface-lighter/80 text-white hover:bg-surface-lighter"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {videoOn ? <VideoIcon /> : <VideoOffIcon />}
            </button>
          </div>
        </div>

        {/* Device pickers */}
        {(audioInputs.length > 0 || videoInputs.length > 0) && (
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

        {error && (
          <p className="mt-4 rounded-md bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            {error}
          </p>
        )}

        <input
          id="name-input"
          name="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ready && handleJoin()}
          placeholder="Your name"
          className="mt-6 w-full rounded-md border border-surface-lighter bg-surface-light px-4 py-3 text-center text-sm outline-none focus:border-brand-light"
        />

        <button
          onClick={handleJoin}
          disabled={!ready}
          className="mt-4 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ready ? "Join now" : "Preparing…"}
        </button>
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
