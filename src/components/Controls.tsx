"use client";

import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  StopShareIcon,
  ChatIcon,
  PeopleIcon,
  PhoneOffIcon,
} from "@/components/Icons";

interface ControlsProps {
  audioOn: boolean;
  videoOn: boolean;
  sharing: boolean;
  chatOpen: boolean;
  peopleOpen: boolean;
  unreadChat: number;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onToggleChat: () => void;
  onTogglePeople: () => void;
  onLeave: () => void;
}

export default function Controls(props: ControlsProps) {
  return (
    <div className="flex justify-center px-2 pb-4 pt-2">
      <div className="glass flex items-center gap-1.5 rounded-2xl border border-surface-border px-2.5 py-2 shadow-card sm:gap-2 sm:px-3">
        <CircleButton
          active={props.audioOn}
          onClick={props.onToggleAudio}
          label={props.audioOn ? "Mute microphone" : "Unmute microphone"}
        >
          {props.audioOn ? <MicIcon /> : <MicOffIcon />}
        </CircleButton>

        <CircleButton
          active={props.videoOn}
          onClick={props.onToggleVideo}
          label={props.videoOn ? "Turn off camera" : "Turn on camera"}
        >
          {props.videoOn ? <VideoIcon /> : <VideoOffIcon />}
        </CircleButton>

        <CircleButton
          active={!props.sharing}
          highlight={props.sharing}
          onClick={props.onToggleShare}
          label={props.sharing ? "Stop presenting" : "Present screen"}
        >
          {props.sharing ? <StopShareIcon /> : <ScreenShareIcon />}
        </CircleButton>

        <span className="mx-1 hidden h-7 w-px bg-surface-border sm:block" />

        <CircleButton
          active={!props.peopleOpen}
          highlight={props.peopleOpen}
          onClick={props.onTogglePeople}
          label="Participants"
          badge={props.participantCount}
        >
          <PeopleIcon />
        </CircleButton>

        <CircleButton
          active={!props.chatOpen}
          highlight={props.chatOpen}
          onClick={props.onToggleChat}
          label="Chat"
          badge={props.unreadChat > 0 ? props.unreadChat : undefined}
        >
          <ChatIcon />
        </CircleButton>

        <span className="mx-1 hidden h-7 w-px bg-surface-border sm:block" />

        <button
          onClick={props.onLeave}
          aria-label="Leave call"
          className="group relative flex h-12 items-center justify-center rounded-2xl bg-danger px-5 text-white transition-all hover:bg-danger-dark active:scale-95"
        >
          <PhoneOffIcon />
          <Tooltip label="Leave call" />
        </button>
      </div>
    </div>
  );
}

function CircleButton({
  children,
  active,
  highlight,
  onClick,
  label,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  const color = highlight
    ? "bg-brand text-white hover:bg-brand-dark"
    : active
    ? "bg-surface-lighter text-white hover:bg-surface-overlay"
    : "bg-danger text-white hover:bg-danger-dark";

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all active:scale-95 ${color}`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-light px-1 text-xs font-semibold text-white ring-2 ring-surface">
          {badge}
        </span>
      )}
      <Tooltip label={label} />
    </button>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
}
