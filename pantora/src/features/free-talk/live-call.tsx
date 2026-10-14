"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, Clock, Flag, Mic, MicOff, PhoneOff, Radio, Users, X } from "lucide-react";
import type { Proficiency, Topic } from "@/lib/types";
import { PROFICIENCY_LABELS } from "@/lib/labels";
import { api, errorMessage } from "@/lib/api-client";
import { formatClock } from "@/lib/dates";
import { MIN_COMPLETED_CONVERSATION_SECONDS } from "@/lib/game-rules";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useMicrophone } from "@/features/audio/use-microphone";
import { LevelMeter } from "@/features/audio/level-meter";
import { BlockDialog, ReportDialog } from "@/features/safety/safety-dialogs";

interface Room {
  id: string;
  role: "caller" | "callee";
  partner: { id: string; displayName: string; avatar: string; proficiency: Proficiency };
  topicId: string | null;
  durationMinutes: number;
}

type Phase = "idle" | "queue" | "connecting" | "active" | "ended";

/**
 * Real peer-to-peer voice call between two people signed in to this Pantora
 * server. Matching and WebRTC signaling go through Pantora's API (HTTP polling);
 * audio flows directly between browsers (or via TURN if configured).
 */
export function LiveCall({
  duration,
  topic,
  onExit,
}: {
  duration: 5 | 10 | 15;
  topic: Topic | null;
  onExit: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const mic = useMicrophone();
  const [phase, setPhase] = useState<Phase>("idle");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [connState, setConnState] = useState<string>("new");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const lastSignal = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const startedAt = useRef<Date | null>(null);
  const elapsedRef = useRef(0);
  const idem = useRef("");
  const iceServers = useRef<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const endedRef = useRef(false);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const save = useCallback(
    async (reason: string) => {
      if (!room || !startedAt.current) return;
      try {
        const res = await api<{ sessionId: string }>("/api/sessions/free-talk", {
          body: {
            idempotencyKey: idem.current,
            partnerId: room.partner.id,
            partnerKind: "user",
            liveRoomId: room.id,
            topicId: room.topicId,
            startedAt: startedAt.current.toISOString(),
            endedAt: new Date().toISOString(),
            plannedSeconds: room.durationMinutes * 60,
            activeSeconds: elapsedRef.current,
            endReason: reason,
            captions: null,
          },
        });
        setSavedSessionId(res.sessionId);
        router.refresh();
      } catch (e) {
        setError(`Your call ended, but it couldn't be saved: ${errorMessage(e)}`);
      }
    },
    [room, router],
  );

  const hangUp = useCallback(
    async (reason: string, notifyPartner = true) => {
      if (endedRef.current) return;
      endedRef.current = true;
      stopPolling();
      if (notifyPartner && room) api(`/api/live/rooms/${room.id}/signal`, { body: { kind: "bye", payload: { reason } } }).catch(() => {});
      pcRef.current?.close();
      pcRef.current = null;
      mic.stop();
      setPhase("ended");
      await save(reason);
    },
    [mic, room, save],
  );

  // Queue polling
  async function joinQueue() {
    setError(null);
    const stream = await mic.start();
    if (!stream) {
      setError("Live calls need microphone access.");
      return;
    }
    try {
      const res = await api<{ status: string; room?: Room }>("/api/live/queue", { body: { topicId: topic?.id ?? null, durationMinutes: duration } });
      setPhase("queue");
      if (res.status === "matched" && res.room) return onMatched(res.room);
      pollRef.current = setInterval(async () => {
        try {
          const poll = await api<{ status: string; room?: Room; iceServers: RTCIceServer[] }>("/api/live/queue");
          if (poll.iceServers?.length) iceServers.current = poll.iceServers;
          if (poll.status === "matched" && poll.room) {
            stopPolling();
            onMatched(poll.room);
          } else if (poll.status === "idle") {
            await api("/api/live/queue", { body: { topicId: topic?.id ?? null, durationMinutes: duration } });
          }
        } catch {
          /* transient; keep polling */
        }
      }, 1500);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function leaveQueue() {
    stopPolling();
    mic.stop();
    await api("/api/live/queue", { method: "DELETE" }).catch(() => {});
    setPhase("idle");
  }

  async function onMatched(r: Room) {
    setRoom(r);
    setPhase("connecting");
    idem.current = crypto.randomUUID();
    endedRef.current = false;
    const pc = new RTCPeerConnection({ iceServers: iceServers.current });
    pcRef.current = pc;
    mic.stream.current?.getTracks().forEach((t) => pc.addTrack(t, mic.stream.current!));
    pc.ontrack = (e) => {
      if (audioRef.current) {
        audioRef.current.srcObject = e.streams[0];
        audioRef.current.play().catch(() => {});
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) api(`/api/live/rooms/${r.id}/signal`, { body: { kind: "candidate", payload: e.candidate.toJSON() } }).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      setConnState(pc.connectionState);
      if (pc.connectionState === "connected" && !startedAt.current) {
        startedAt.current = new Date();
        setPhase("active");
      }
      if (pc.connectionState === "failed") {
        toast({ tone: "error", title: "Connection failed", description: "A direct audio connection couldn't be made. A TURN server may be required on this network." });
        hangUpRef.current?.("connection_lost");
      }
    };
    if (r.role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await api(`/api/live/rooms/${r.id}/signal`, { body: { kind: "offer", payload: offer } });
    }
    lastSignal.current = 0;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api<{ status: string; signals: { id: number; kind: string; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }[] }>(
          `/api/live/rooms/${r.id}/signal?after=${lastSignal.current}`,
        );
        for (const s of res.signals) {
          lastSignal.current = s.id;
          if (s.kind === "offer" && r.role === "callee") {
            await pc.setRemoteDescription(s.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await api(`/api/live/rooms/${r.id}/signal`, { body: { kind: "answer", payload: answer } });
          } else if (s.kind === "answer" && r.role === "caller") {
            await pc.setRemoteDescription(s.payload);
          } else if (s.kind === "candidate") {
            await pc.addIceCandidate(s.payload).catch(() => {});
          } else if (s.kind === "bye") {
            toast({ tone: "info", title: `${r.partner.displayName} ended the call` });
            hangUpRef.current?.("left", false);
          }
        }
      } catch {
        /* transient */
      }
    }, 1000);
  }

  const hangUpRef = useRef(hangUp);
  useEffect(() => {
    hangUpRef.current = hangUp;
  }, [hangUp]);

  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (room && elapsedRef.current >= room.durationMinutes * 60) hangUpRef.current?.("time_up");
    }, 1000);
    return () => clearInterval(t);
  }, [phase, room]);

  useEffect(
    () => () => {
      stopPolling();
      pcRef.current?.close();
    },
    [],
  );

  const target = room ? { id: room.partner.id, kind: "user" as const, name: room.partner.displayName } : null;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardBody className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={async () => (phase === "queue" ? leaveQueue().then(onExit) : onExit())} disabled={phase === "active" || phase === "connecting"}>
            <ArrowLeft className="h-4 w-4" /> Demo mode
          </Button>
          <Badge tone="success">
            <Radio className="h-3.5 w-3.5" /> Live mode (experimental)
          </Badge>
        </div>

        {phase === "idle" && (
          <div className="text-center">
            <Users className="mx-auto h-10 w-10 text-brand-600" />
            <h2 className="mt-3 text-xl font-bold">Talk with a real person on this server</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              You&apos;ll be matched with another signed-in Pantora user whose level range includes yours. Audio is peer-to-peer and isn&apos;t recorded. Calls last up to {duration} minutes.
            </p>
            <Button size="lg" className="mt-6" onClick={joinQueue} loading={mic.state === "requesting"}>
              <Mic className="h-5 w-5" /> Join the queue
            </Button>
          </div>
        )}

        {phase === "queue" && (
          <div className="py-6 text-center">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 animate-ping-slow rounded-full bg-brand-200" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
                <Users className="h-7 w-7" />
              </span>
            </div>
            <h2 className="mt-5 text-lg font-bold">Waiting for another learner…</h2>
            <p className="mt-1 text-sm text-muted">Keep this tab open. You&apos;ll connect automatically when someone joins.</p>
            <Button variant="outline" className="mt-5" onClick={leaveQueue}>
              <X className="h-4 w-4" /> Leave queue
            </Button>
          </div>
        )}

        {(phase === "connecting" || phase === "active") && room && (
          <div className="text-center">
            <Avatar name={room.partner.displayName} avatar={room.partner.avatar} size="xl" className="mx-auto" />
            <p className="mt-3 text-xl font-bold">{room.partner.displayName}</p>
            <p className="text-sm text-muted">{PROFICIENCY_LABELS[room.partner.proficiency]} · real Pantora user</p>
            <p className="mt-3 flex items-center justify-center gap-2 font-mono font-semibold tabular-nums">
              <Clock className="h-4 w-4 text-muted" />
              {phase === "active" ? `${formatClock(elapsed)} / ${formatClock(room.durationMinutes * 60)}` : `Connecting… (${connState})`}
            </p>
            {topic && <p className="mx-auto mt-4 max-w-md rounded-xl bg-lavender p-3 text-sm font-semibold">{topic.openingQuestion}</p>}
            <div className="mt-4 flex justify-center">
              <LevelMeter level={mic.level} bars={14} />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => mic.setMuted(!mic.muted)} aria-pressed={mic.muted}>
                {mic.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {mic.muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="outline" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" /> Report
              </Button>
              <Button variant="outline" onClick={() => setBlockOpen(true)}>
                <Ban className="h-4 w-4" /> Block
              </Button>
              <Button variant="danger" onClick={() => setConfirmEnd(true)}>
                <PhoneOff className="h-4 w-4" /> End call
              </Button>
            </div>
          </div>
        )}

        {phase === "ended" && (
          <div className="py-4 text-center">
            <h2 className="text-xl font-bold">Call ended</h2>
            <p className="mt-1 text-sm text-muted">
              {elapsed >= MIN_COMPLETED_CONVERSATION_SECONDS ? `You talked for ${formatClock(elapsed)}.` : "Calls under a minute are saved as incomplete."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {savedSessionId && <ButtonLink href={`/history/${savedSessionId}`}>Review session</ButtonLink>}
              <Button
                variant="outline"
                onClick={() => {
                  setRoom(null);
                  setElapsed(0);
                  elapsedRef.current = 0;
                  startedAt.current = null;
                  setSavedSessionId(null);
                  setPhase("idle");
                }}
              >
                Find another partner
              </Button>
            </div>
          </div>
        )}

        {(error || mic.error) && (
          <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error || mic.error}
          </p>
        )}
        <audio ref={audioRef} autoPlay className="hidden" />
      </CardBody>

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this call?" confirmLabel="End call" tone="danger" onConfirm={() => { setConfirmEnd(false); hangUp("ended_early"); }} />
      {target && (
        <>
          <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} target={{ ...target, sessionId: null }} onReported={({ alsoBlocked }) => alsoBlocked && hangUp("reported")} />
          <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} target={target} onBlocked={() => hangUp("blocked")} />
        </>
      )}
    </Card>
  );
}
