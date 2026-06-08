"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type {
  ChatMessage,
  PeerMeta,
  RemotePeer,
  SignalKind,
  SignalPayload,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// ICE configuration
//
// STUN alone only works when both peers can reach each other directly. For
// users on different networks (the normal case once deployed) at least one is
// usually behind a NAT/firewall that requires a TURN relay, otherwise the peer
// connection silently fails. We therefore ALWAYS include TURN servers:
//   1. Credentials from env (NEXT_PUBLIC_TURN_*) if provided — best for prod.
//   2. Otherwise, free public OpenRelay TURN servers as a fallback so the app
//      works cross-network out of the box.
// For a reliable production deployment, get free TURN credentials from
// https://www.metered.ca/tools/openrelay/ (50GB/mo free) and set the env vars.
// -----------------------------------------------------------------------------
let warnedNoTurn = false;

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
      ],
    },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  } else if (typeof window !== "undefined" && !warnedNoTurn) {
    warnedNoTurn = true;
    console.warn(
      "[meet] No TURN server configured (NEXT_PUBLIC_TURN_URL). Calls between " +
        "users on different networks behind NAT/firewalls will likely fail. " +
        "Get free TURN credentials at https://dashboard.metered.ca and set the " +
        "NEXT_PUBLIC_TURN_* env vars (see README)."
    );
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

interface MeetingPeerRow {
  meeting_code: string;
  peer_id: string;
  name: string;
  audio: boolean;
  video: boolean;
  sharing: boolean;
  updated_at: string;
}

interface MeetingSignalRow {
  id: string;
  meeting_code: string;
  sender_id: string;
  recipient_id: string;
  kind: string;
  sdp: RTCSessionDescriptionInit | null;
  candidate: RTCIceCandidateInit | null;
  created_at: string;
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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenSignalIdsRef = useRef<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);
  // Peers discovered via each transport; reconciled into one set so neither
  // path tears down a connection the other path still considers live.
  const presencePeersRef = useRef<Map<string, PeerMeta>>(new Map());
  const dbPeersRef = useRef<Map<string, PeerMeta>>(new Map());
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
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const signalPayload = { ...payload, id };
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: signalPayload,
    });
    const supabase = getSupabase();
    void supabase
      .from("meeting_signals")
      .insert({
        id,
        meeting_code: code,
        sender_id: payload.from,
        recipient_id: payload.to,
        kind: payload.kind,
        sdp: payload.sdp ?? null,
        candidate: payload.candidate ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn("[meet] signal persist failed", error.message);
      });
  }, [code]);

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
      // De-duplicate across transports: the same signal can arrive via both the
      // Realtime broadcast and the database poll. Process each id at most once.
      if (payload.id) {
        if (seenSignalIdsRef.current.has(payload.id)) return;
        seenSignalIdsRef.current.add(payload.id);
      }
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

  /**
   * Reconcile the live peer connections against the union of peers discovered
   * via Realtime presence and the database fallback. A connection is only torn
   * down when BOTH transports agree the peer is gone, so the slower fallback can
   * never close a connection the faster presence path still considers live.
   */
  const reconcilePeers = useCallback(() => {
    const union = new Map<string, PeerMeta>();
    presencePeersRef.current.forEach((m, id) => union.set(id, m));
    dbPeersRef.current.forEach((m, id) => {
      if (!union.has(id)) union.set(id, m);
    });

    union.forEach((meta, id) => {
      const existing = peersRef.current.get(id);
      if (!existing) {
        createPeer(id, meta);
        // Deterministic initiator: the greater id sends the offer.
        if (peerId > id) void makeOffer(id);
      } else {
        existing.meta = meta;
      }
    });

    peersRef.current.forEach((conn, id) => {
      if (!union.has(id)) {
        conn.pc.close();
        peersRef.current.delete(id);
      }
    });

    syncPeerState();
  }, [peerId, createPeer, makeOffer, syncPeerState]);

  /** Write/refresh our own row so the DB fallback can discover us. */
  const upsertSelfPeerRow = useCallback(() => {
    const supabase = getSupabase();
    void supabase
      .from("meeting_peers")
      .upsert({
        meeting_code: code,
        peer_id: peerId,
        name: localMetaRef.current.name,
        audio: localMetaRef.current.audio,
        video: localMetaRef.current.video,
        sharing: localMetaRef.current.sharing,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn("[meet] peer upsert failed", error.message);
      });
  }, [code, peerId]);

  const syncPeersFromDatabase = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const supabase = getSupabase();
      const [{ data: peersData }, { data: signalsData }] = await Promise.all([
        supabase
          .from("meeting_peers")
          .select("meeting_code, peer_id, name, audio, video, sharing, updated_at")
          .eq("meeting_code", code)
          .order("updated_at", { ascending: false }),
        supabase
          .from("meeting_signals")
          .select("id, meeting_code, sender_id, recipient_id, kind, sdp, candidate, created_at")
          .eq("meeting_code", code)
          .eq("recipient_id", peerId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (peersData) {
        // Only trust rows refreshed recently; stale rows mean the peer left or
        // crashed without cleaning up. Heartbeat runs every 5s, so 15s is safe.
        const STALE_MS = 15000;
        const now = Date.now();
        const fresh = new Map<string, PeerMeta>();
        (peersData as MeetingPeerRow[]).forEach((row) => {
          if (row.peer_id === peerId) return;
          const age = now - new Date(row.updated_at).getTime();
          if (age > STALE_MS) return;
          fresh.set(row.peer_id, {
            id: row.peer_id,
            name: row.name,
            audio: row.audio,
            video: row.video,
            sharing: row.sharing,
          });
        });
        dbPeersRef.current = fresh;
        reconcilePeers();
      }

      if (signalsData) {
        // Fetched newest-first; process oldest-first so offers precede answers.
        const ordered = [...(signalsData as MeetingSignalRow[])].reverse();
        for (const row of ordered) {
          // handleSignal de-duplicates by id internally.
          await handleSignal({
            id: row.id,
            from: row.sender_id,
            to: row.recipient_id,
            kind: row.kind as SignalKind,
            sdp: row.sdp ?? undefined,
            candidate: row.candidate ?? undefined,
          });
        }
      }

      // A successful poll means signaling works (even if Realtime is down).
      setStatus((prev) => (prev === "connected" ? prev : "connected"));
    } catch (err) {
      console.warn("[meet] database sync failed", err);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [code, handleSignal, peerId, reconcilePeers]);

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

    presencePeersRef.current = present;
    reconcilePeers();
  }, [peerId, reconcilePeers]);

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

      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      pollTimerRef.current = setInterval(() => {
        void syncPeersFromDatabase();
      }, 2000);
    };

    attachChannel();
    // Announce ourselves to the DB fallback immediately, then keep the row
    // fresh with a heartbeat so other peers' staleness filter doesn't drop us.
    upsertSelfPeerRow();
    void syncPeersFromDatabase();
    heartbeatTimerRef.current = setInterval(upsertSelfPeerRow, 5000);

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
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      peersMap.forEach((conn) => conn.pc.close());
      peersMap.clear();
      presencePeersRef.current.clear();
      dbPeersRef.current.clear();
      const channel = channelRef.current;
      if (channel) {
        void channel.untrack();
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
      // Remove our presence row so other peers stop trying to reach us.
      void supabase
        .from("meeting_peers")
        .delete()
        .eq("meeting_code", code)
        .eq("peer_id", peerId);
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, localStream, clearReconnectTimer, handlePresenceSync, syncPeersFromDatabase]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const setLocalMeta = useCallback(
    (patch: Partial<Omit<PeerMeta, "id">>) => {
      localMetaRef.current = { ...localMetaRef.current, ...patch };
      void channelRef.current?.track(localMetaRef.current);
      upsertSelfPeerRow();
    },
    [upsertSelfPeerRow]
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
