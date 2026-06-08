export interface Meeting {
  id: string;
  code: string;
  title: string | null;
  host_name: string | null;
  created_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  meeting_code: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

/** Metadata shared between peers via Realtime presence. */
export interface PeerMeta {
  id: string;
  name: string;
  audio: boolean;
  video: boolean;
  sharing: boolean;
}

/** A connected remote participant as tracked in the UI. */
export interface RemotePeer extends PeerMeta {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
}

export type SignalKind = "offer" | "answer" | "ice";

export interface SignalPayload {
  id?: string;
  from: string;
  to: string;
  kind: SignalKind;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
