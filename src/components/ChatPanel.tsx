"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { CloseIcon, SendIcon } from "@/components/Icons";
import { formatTime, colorFromString } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  selfId: string;
  onSend: (content: string) => void;
  onClose: () => void;
}

export default function ChatPanel({
  messages,
  selfId,
  onSend,
  onClose,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  }

  return (
    <aside className="flex h-full w-full flex-col bg-surface-light md:w-80">
      <header className="flex items-center justify-between border-b border-surface-lighter px-4 py-3">
        <h2 className="text-base font-medium">In-call messages</h2>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-full p-1 text-gray-400 hover:bg-surface-lighter hover:text-white"
        >
          <CloseIcon width={20} height={20} />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500">
            Messages can be seen by everyone in the call.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === selfId;
          return (
            <div key={m.id} className="animate-fade-in">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: colorFromString(m.sender_name) }}
                >
                  {mine ? "You" : m.sender_name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(m.created_at)}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-200">
                {m.content}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-surface-lighter p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Send a message"
          className="flex-1 rounded-full bg-surface px-4 py-2 text-sm outline-none placeholder:text-gray-500"
        />
        <button
          onClick={submit}
          aria-label="Send message"
          disabled={!text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-brand-light transition hover:bg-surface-lighter disabled:opacity-40"
        >
          <SendIcon width={20} height={20} />
        </button>
      </div>
    </aside>
  );
}
