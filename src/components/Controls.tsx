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
    <div className="flex items-center justify-center gap-2 px-2 py-3 sm:gap-3">
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

      <button
        onClick={props.onLeave}
        aria-label="Leave call"
        className="ml-1 flex h-12 items-center justify-center rounded-full bg-red-600 px-5 text-white transition hover:bg-red-700 sm:ml-3"
      >
        <PhoneOffIcon />
      </button>
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
    ? "bg-surface-lighter text-white hover:bg-surface-lighter/70"
    : "bg-red-500 text-white hover:bg-red-600";

  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative flex h-12 w-12 items-center justify-center rounded-full transition ${color}`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-light px-1 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
