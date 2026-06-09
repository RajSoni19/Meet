"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CopyIcon, VideoCallIcon } from "@/components/Icons";

interface CreateMeetingModalProps {
  open: boolean;
  code: string;
  onJoin: () => void;
  onClose: () => void;
}

export function CreateMeetingModal({
  open,
  code,
  onJoin,
  onClose,
}: CreateMeetingModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/meeting/${code}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast("Invite link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy — select and copy manually", "error");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Meetly meeting",
          text: "Here's the link to join my video meeting:",
          url: inviteUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Your meeting is ready">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3">
          <span className="flex h-9 w-9 animate-scale-in items-center justify-center rounded-full bg-success/20 text-success">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
          </span>
          <p className="text-sm text-gray-200">
            Share this link with people you want to meet with.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Invite link
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-sm text-gray-200">
              {inviteUrl}
            </span>
            <button
              onClick={copy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-lighter px-2.5 py-1.5 text-xs font-medium text-brand-light transition hover:bg-surface-overlay"
            >
              <CopyIcon width={15} height={15} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">
            Meeting code: <span className="font-mono text-gray-400">{code}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={share}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92Z" />
            </svg>
            Share
          </Button>
          <Button className="flex-1" onClick={onJoin}>
            <VideoCallIcon width={18} height={18} />
            Join now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
