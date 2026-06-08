"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type {
  ChatMessage,
  PeerMeta,
  RemotePeer,
  SignalPayload,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// ICE configuration
// -----------------------------------------------------------------------------
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface PeerConn {
  pc: RTCPeerConnection;
  meta: PeerMeta;
  stream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
  /** true once we have applied a remote description */
  remoteReady: boolean;
  /** the outgoing video sender, kept so we can replaceTrack (camera <-> screen) */
  videoSender: RTCRtpSender;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface UseMeetingArgs {
  code: string;
  peerId: string;
  displayName: string;
  localStream: MediaStream | null;
  initialAudio: boolean;
  initialVideo: boolean;
}

export interface UseMeetingResult {
  peers: RemotePeer[];
  messages: ChatMessage[];
  status: ConnectionStatus;
  /** Update our presence meta (audio/video/sharing/name). */
  setLocalMeta: (patch: Partial<Omit<PeerMeta, "id">>) => void;
  /** Replace the outgoing video track on every peer connection (camera <-> screen). */
  replaceVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
  sendChat: (content: string) => Promise<void>;
}

/**
 * Manages the full lifecycle of a mesh WebRTC meeting using Supabase Realtime
 * for signaling (presence + broadcast). One RTCPeerConnection is maintained per
 * remote participant.
 *
 * Glare avoidance: for any pair of peers, the one with the lexicographically
 * greater id is the *initiator* and sends the offer; the other waits.
 */
export function useMeeting({
  code,
  peerId,
  displayName,
  localStream,
  initialAudio,
  initialVideo,
}: UseMeetingArgs): UseMeetingResult {
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  // Refs hold the live, mutable state used inside async signaling callbacks so
  // we never read stale values from a React closure.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, PeerConn>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localMetaRef = useRef<PeerMeta>({
    id: peerId,
    name: displayName,
    audio: initialAudio,
    video: initialVideo,
    sharing: false,
  });

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // ---------------------------------------------------------------------------
  // React state sync helper
  // ---------------------------------------------------------------------------
  const syncPeerState = useCallback(() => {
    const list: RemotePeer[] = [];
    peersRef.current.forEach((conn, id) => {
      list.push({
        id,
        name: conn.meta.name,
        audio: conn.meta.audio,
        video: conn.meta.video,
        sharing: conn.meta.sharing,
        stream: conn.stream,
        connectionState: conn.pc.connectionState,
      });
    });
    setPeers(list);
  }, []);

  // ---------------------------------------------------------------------------
  // Signaling send
  // ---------------------------------------------------------------------------
  const sendSignal = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Peer connection factory
  // ---------------------------------------------------------------------------
  const createPeer = useCallback(
    (remoteId: string, meta: PeerMeta): PeerConn => {
      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
      const stream = new MediaStream();

      // Always create audio+video transceivers in a fixed order so the m-line
      // layout is identical on both sides. sendrecv lets us replaceTrack later
      // (toggle camera / screen-share) without renegotiation.
      const audioTransceiver = pc.addTransceiver("audio", {
        direction: "sendrecv",
      });
      const videoTransceiver = pc.addTransceiver("video", {
        direction: "sendrecv",
      });

      const local = localStreamRef.current;
      const aTrack = local?.getAudioTracks()[0];
      const vTrack = local?.getVideoTracks()[0];
      if (aTrack) void audioTransceiver.sender.replaceTrack(aTrack);
      if (vTrack) void videoTransceiver.sender.replaceTrack(vTrack);

      const conn: PeerConn = {
        pc,
        meta,
        stream,
        pendingCandidates: [],
        remoteReady: false,
        videoSender: videoTransceiver.sender,
      };
      peersRef.current.set(remoteId, conn);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => {
          if (!stream.getTracks().includes(t)) stream.addTrack(t);
        });
        // Some browsers deliver the track without a stream container.
        if (event.streams.length === 0 && event.track) {
          stream.addTrack(event.track);
        }
        syncPeerState();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            from: peerId,
            to: remoteId,
            kind: "ice",
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        syncPeerState();
        if (pc.connectionState === "failed") {
          // Attempt an ICE restart from the initiator side.
          if (peerId > remoteId) void makeOffer(remoteId, true);
        }
      };

      return conn;
    },
    // makeOffer is declared below; stable via ref pattern, safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peerId, sendSignal, syncPeerState]
  );

  // ---------------------------------------------------------------------------
  // Offer / answer / candidate handling
  // ---------------------------------------------------------------------------
  const makeOffer = useCallback(
    async (remoteId: string, iceRestart = false) => {
      const conn = peersRef.current.get(remoteId);
      if (!conn) return;
      try {
        const offer = await conn.pc.createOffer({ iceRestart });
        await conn.pc.setLocalDescription(offer);
        sendSignal({
          from: peerId,
          to: remoteId,
          kind: "offer",
          sdp: conn.pc.localDescription ?? offer,
        });
      } catch (err) {
        console.error("[meet] makeOffer failed", err);
      }
    },
    [peerId, sendSignal]
  );

  const flushCandidates = useCallback(async (conn: PeerConn) => {
    while (conn.pendingCandidates.length) {
      const cand = conn.pendingCandidates.shift();
      if (cand) {
        try {
          await conn.pc.addIceCandidate(cand);
        } catch (err) {
          console.warn("[meet] addIceCandidate failed", err);
        }
      }
    }
  }, []);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.to !== peerId) return;
      const { from } = payload;

      if (payload.kind === "offer" && payload.sdp) {
        let conn = peersRef.current.get(from);
        if (!conn) {
          // We are the answerer; build a peer with placeholder meta until
          // presence fills it in.
          conn = createPeer(from, {
            id: from,
            name: "Guest",
            audio: true,
            video: true,
            sharing: false,
          });
        }
        try {
          await conn.pc.setRemoteDescription(payload.sdp);
          conn.remoteReady = true;
          await flushCandidates(conn);
          const answer = await conn.pc.createAnswer();
          await conn.pc.setLocalDescription(answer);
          sendSignal({
            from: peerId,
            to: from,
            kind: "answer",
            sdp: conn.pc.localDescription ?? answer,
          });
        } catch (err) {
          console.error("[meet] handle offer failed", err);
        }
      } else if (payload.kind === "answer" && payload.sdp) {
        const conn = peersRef.current.get(from);
        if (!conn) return;
        try {
          await conn.pc.setRemoteDescription(payload.sdp);
          conn.remoteReady = true;
          await flushCandidates(conn);
        } catch (err) {
          console.error("[meet] handle answer failed", err);
        }
      } else if (payload.kind === "ice" && payload.candidate) {
        const conn = peersRef.current.get(from);
        if (!conn) return;
        if (conn.remoteReady) {
          try {
            await conn.pc.addIceCandidate(payload.candidate);
          } catch (err) {
            console.warn("[meet] addIceCandidate failed", err);
          }
        } else {
          conn.pendingCandidates.push(payload.candidate);
        }
      }
    },
    [peerId, createPeer, flushCandidates, sendSignal]
  );

  // ---------------------------------------------------------------------------
  // Presence handling: reconcile the set of remote peers
  // ---------------------------------------------------------------------------
  const handlePresenceSync = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<PeerMeta>();

    const present = new Map<string, PeerMeta>();
    Object.values(state).forEach((entries) => {
      entries.forEach((entry) => {
        if (entry.id && entry.id !== peerId) present.set(entry.id, entry);
      });
    });

    // New / updated peers
    present.forEach((meta, id) => {
      const existing = peersRef.current.get(id);
      if (!existing) {
        createPeer(id, meta);
        // Deterministic initiator: greater id offers.
        if (peerId > id) void makeOffer(id);
      } else {
        existing.meta = meta;
      }
    });

    // Departed peers
    peersRef.current.forEach((conn, id) => {
      if (!present.has(id)) {
        conn.pc.close();
        peersRef.current.delete(id);
      }
    });

    syncPeerState();
  }, [peerId, createPeer, makeOffer, syncPeerState]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Channel lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!localStream) return;
    setStatus("connecting");
    const supabase = getSupabase();
    let cancelled = false;
    let reconnectAttempts = 0;

    const attachChannel = () => {
      if (cancelled) return;

      const channel = supabase.channel(`meet:${code}`, {
        config: {
          broadcast: { self: false },
          presence: { key: peerId },
        },
      });

      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, handlePresenceSync);
      channel.on("presence", { event: "join" }, handlePresenceSync);
      channel.on("presence", { event: "leave" }, handlePresenceSync);
      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void handleSignal(payload as SignalPayload);
      });
      channel.on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages((prev) => {
          const msg = payload as ChatMessage;
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });

      channel.subscribe(async (subStatus) => {
        if (cancelled || channelRef.current !== channel) return;

        if (subStatus === "SUBSCRIBED") {
          clearReconnectTimer();
          reconnectAttempts = 0;
          setStatus("connected");
          await channel.track(localMetaRef.current);
          handlePresenceSync();
        } else if (
          subStatus === "CHANNEL_ERROR" ||
          subStatus === "TIMED_OUT"
        ) {
          setStatus("error");
          clearReconnectTimer();
          void supabase.removeChannel(channel);
          channelRef.current = null;

          if (reconnectAttempts < 3 && !cancelled) {
            reconnectAttempts += 1;
            setStatus("connecting");
            reconnectTimerRef.current = setTimeout(
              attachChannel,
              reconnectAttempts * 1000
            );
          }
        }
      });
    };

    attachChannel();

    // Load chat history
    void supabase
      .from("chat_messages")
      .select("*")
      .eq("meeting_code", code)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            (data as ChatMessage[]).forEach((m) => {
              if (!seen.has(m.id)) merged.push(m);
            });
            merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return merged;
          });
        }
      });

    const peersMap = peersRef.current;
    return () => {
      cancelled = true;
      clearReconnectTimer();
      peersMap.forEach((conn) => conn.pc.close());
      peersMap.clear();
      const channel = channelRef.current;
      if (channel) {
        void channel.untrack();
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, peerId, localStream]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const setLocalMeta = useCallback(
    (patch: Partial<Omit<PeerMeta, "id">>) => {
      localMetaRef.current = { ...localMetaRef.current, ...patch };
      void channelRef.current?.track(localMetaRef.current);
    },
    []
  );

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const tasks: Promise<void>[] = [];
    peersRef.current.forEach((conn) => {
      tasks.push(conn.videoSender.replaceTrack(track));
    });
    await Promise.all(tasks);
  }, []);

  const sendChat = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;
      const supabase = getSupabase();
      const optimistic: ChatMessage = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        meeting_code: code,
        sender_id: peerId,
        sender_name: localMetaRef.current.name,
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      channelRef.current?.send({
        type: "broadcast",
        event: "chat",
        payload: optimistic,
      });
      // Persist (best-effort).
      const { error } = await supabase.from("chat_messages").insert({
        id: optimistic.id,
        meeting_code: code,
        sender_id: peerId,
        sender_name: optimistic.sender_name,
        content: text,
      });
      if (error) console.warn("[meet] chat persist failed", error.message);
    },
    [code, peerId]
  );

  return {
    peers,
    messages,
    status,
    setLocalMeta,
    replaceVideoTrack,
    sendChat,
  };
}
