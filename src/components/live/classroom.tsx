"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useDataChannel,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipants,
  useRoomContext,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { RoomEvent, Track, type Participant } from "livekit-client";
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, PhoneOff, Hand, LogOut, Users, MessageSquare, HelpCircle, Send,
  CircleCheck, Circle, Radio, Loader2, ShieldCheck, UserMinus, Volume2, ArrowLeft, Clock, Sparkles, CalendarClock,
} from "lucide-react";
import { ClassRecorder } from "./recorder";
import { LogoMark } from "../logo";
import { cn } from "@/lib/utils";

type Role = "host" | "moderator" | "learner";
type State = "too-early" | "waiting" | "live" | "ended" | "cancelled";

export type ClassroomProps = {
  sessionId: string;
  title: string;
  courseTitle: string;
  batchName: string;
  startsAt: string;
  endsAt: string;
  role: Role;
  initialState: State;
  hostName: string;
  chatEnabled: boolean;
  recordingEnabled: boolean;
  configured: boolean;
  backHref: string;
  courseHref: string;
};

type ChatMsg = { id: string; kind: "CHAT" | "QUESTION"; body: string; offsetSec: number; answered: boolean; at: string; user: { id: string; name: string; avatarColor: string } };

const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hourCycle: "h12", timeZone: "Asia/Dhaka" }).format(new Date(iso));
const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date(iso));
const clock = (sec: number) => `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}:` : ""}${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function Classroom(props: ClassroomProps) {
  const [state, setState] = useState<State>(props.initialState);
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [media, setMedia] = useState({ cam: props.role === "host", mic: props.role === "host" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);
  const [replay, setReplay] = useState<{ status: string; lessonId: string | null; courseId: string } | null>(null);

  // Poll status while waiting (learners auto-detect go-live) and after the class (replay readiness).
  useEffect(() => {
    if (conn) return;
    const poll = async () => {
      const r = await fetch(`/api/live/${props.sessionId}/status`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!r) return;
      setState(r.state);
      if (r.state === "ended") setReplay({ status: r.recordingStatus, lessonId: r.replayLessonId, courseId: r.courseId });
    };
    void poll();
    const t = setInterval(poll, state === "ended" ? 8000 : 5000);
    return () => clearInterval(t);
  }, [conn, props.sessionId, state]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (props.role === "host" && state !== "live") {
        const s = await fetch(`/api/live/${props.sessionId}/start`, { method: "POST" });
        if (!s.ok) throw new Error((await s.json()).error ?? "Couldn’t start the class");
        setState("live");
      }
      const r = await fetch(`/api/live/${props.sessionId}/token`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Couldn’t join the class");
      setConn({ token: data.token, url: data.url });
      setLeft(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [props.role, props.sessionId, state]);

  if (conn) {
    return (
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        video={props.role !== "learner" && media.cam}
        audio={props.role !== "learner" && media.mic}
        options={{ adaptiveStream: true, dynacast: true }}
        onDisconnected={() => setConn(null)}
        className="h-dvh"
      >
        <Room {...props} onEnded={() => { setConn(null); setState("ended"); }} onLeave={() => { setConn(null); setLeft(true); }} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return <Lobby {...props} state={state} media={media} setMedia={setMedia} busy={busy} error={error} left={left} replay={replay} onJoin={connect} />;
}

// ───────────────────────── Lobby / waiting room / ended ─────────────────────────

function Lobby(p: ClassroomProps & {
  state: State; media: { cam: boolean; mic: boolean }; setMedia: (m: { cam: boolean; mic: boolean }) => void;
  busy: boolean; error: string | null; left: boolean; replay: { status: string; lessonId: string | null; courseId: string } | null; onJoin: () => void;
}) {
  const preview = useRef<HTMLVideoElement>(null);
  // Start null so server and client render the same markup; the countdown appears after mount.
  const [now, setNow] = useState<number | null>(null);
  const isHost = p.role === "host";

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Camera preview for the instructor before going live.
  useEffect(() => {
    if (!isHost || p.state === "ended" || !p.media.cam) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => {
      stream = s;
      if (preview.current) preview.current.srcObject = s;
    }).catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [isHost, p.state, p.media.cam]);

  const until = now === null ? 0 : Math.max(0, Math.round((new Date(p.startsAt).getTime() - now) / 1000));
  const ended = p.state === "ended";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      <div className="rf-glow-top pointer-events-none absolute left-1/2 top-[-200px] h-[800px] w-[1400px] -translate-x-1/2" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href={p.backHref} className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Back</Link>
        <div className="flex items-center gap-2"><LogoMark size={28} /><span className="text-sm font-semibold text-ink">DoB Live</span></div>
        <span className="w-12" />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="text-center">
          <div className="rf-badge mx-auto text-sm"><span className="rf-badge-text font-medium">{p.courseTitle} · {p.batchName}</span></div>
          <h1 className="rf-title mt-4 font-display text-[clamp(2rem,4.5vw,3.2rem)] font-medium leading-tight tracking-[-0.03em]">{p.title}</h1>
          <p className="mt-2 flex items-center justify-center gap-2 text-ink-soft"><CalendarClock className="size-4" /> {fmtDay(p.startsAt)} · {fmtTime(p.startsAt)} – {fmtTime(p.endsAt)} · with {p.hostName}</p>
        </div>

        {!p.configured && (
          <div className="mt-10 max-w-lg rounded-2xl bg-amber-50 p-5 text-center text-sm text-amber-900 ring-1 ring-amber-200">
            Live streaming isn’t configured on this server yet. An administrator needs to set <code>LIVEKIT_URL</code>, <code>LIVEKIT_API_KEY</code> and <code>LIVEKIT_API_SECRET</code>.
          </div>
        )}

        {ended ? (
          <div className="rf-card mt-10 w-full max-w-lg p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-lilac-500/10 text-lilac-500"><CircleCheck className="size-7" /></div>
            <h2 className="mt-4 text-xl font-semibold text-ink">This class has ended</h2>
            {p.replay?.status === "READY" && p.replay.lessonId ? (
              <>
                <p className="mt-2 text-ink-soft">The recording is published to the course.</p>
                <Link href={isHost ? `/instructor/courses/${p.replay.courseId}` : `/dashboard/courses/${p.replay.courseId}?lesson=${p.replay.lessonId}`} className="rf-btn rf-btn-primary mt-6">Watch the replay</Link>
              </>
            ) : p.replay?.status === "PROCESSING" ? (
              <p className="mt-2 flex items-center justify-center gap-2 text-ink-soft"><Loader2 className="size-4 animate-spin" /> The recording is being processed and will be added to the course automatically.</p>
            ) : p.replay?.status === "FAILED" ? (
              <p className="mt-2 text-ink-soft">The recording couldn’t be processed. The learning team has been notified.</p>
            ) : (
              <p className="mt-2 text-ink-soft">Your attendance has been recorded.</p>
            )}
            <Link href={p.courseHref} className="rf-btn mt-4">Back to the course</Link>
          </div>
        ) : p.state === "cancelled" ? (
          <div className="rf-card mt-10 max-w-lg p-8 text-center text-ink-soft">This class was cancelled. Check your schedule for updates.</div>
        ) : (
          <div className={cn("mt-10 grid w-full gap-6", isHost ? "max-w-4xl md:grid-cols-[1.4fr_1fr]" : "max-w-lg")}>
            {isHost && (
              <div className="rf-frame">
                <div className="relative aspect-video overflow-hidden rounded-[16px] bg-[#0b0a1a]">
                  {p.media.cam ? <video ref={preview} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" /> : (
                    <div className="flex size-full items-center justify-center text-white/60"><VideoOff className="size-8" /></div>
                  )}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                    <RoundToggle on={p.media.mic} onClick={() => p.setMedia({ ...p.media, mic: !p.media.mic })} onIcon={<Mic />} offIcon={<MicOff />} label="Microphone" />
                    <RoundToggle on={p.media.cam} onClick={() => p.setMedia({ ...p.media, cam: !p.media.cam })} onIcon={<Video />} offIcon={<VideoOff />} label="Camera" />
                  </div>
                </div>
              </div>
            )}
            <div className="rf-card flex flex-col justify-center p-7 text-center">
              {p.state === "live" ? (
                <>
                  <div className="mx-auto flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200"><span className="size-2 animate-pulse rounded-full bg-red-500" /> LIVE NOW</div>
                  <h2 className="mt-4 text-lg font-semibold text-ink">{isHost ? "Your class is live" : p.left ? "You left the class" : "The class has started"}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{isHost ? "Rejoin to continue teaching." : "Join to watch, chat and ask questions."}</p>
                </>
              ) : isHost ? (
                <>
                  <h2 className="text-lg font-semibold text-ink">Ready when you are</h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    Learners in the waiting room join automatically when you go live.{p.recordingEnabled ? " The class is recorded and published as a replay." : ""}
                  </p>
                  {until > 0 && <p className="mt-3 text-sm text-ink-faint">Scheduled to start in {clock(until)}</p>}
                </>
              ) : (
                <>
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-lilac-500/10 text-lilac-500"><Clock className="size-6" /></div>
                  <h2 className="mt-4 text-lg font-semibold text-ink">{p.state === "too-early" ? "The waiting room isn’t open yet" : "Waiting for the instructor"}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{now === null ? "" : until > 0 ? `Class starts in ${clock(until)}.` : "Class should start any moment."} This page updates automatically.</p>
                </>
              )}
              {p.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{p.error}</p>}
              {(isHost || p.role === "moderator" || p.state === "live") && p.state !== "too-early" && p.configured && (
                <button onClick={p.onJoin} disabled={p.busy || (p.role === "moderator" && p.state !== "live")} className="rf-btn rf-btn-primary mx-auto mt-6 px-6 py-3 text-[15px] disabled:opacity-50">
                  {p.busy ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                  {isHost ? (p.state === "live" ? "Rejoin as host" : "Go live") : p.role === "moderator" ? "Join as moderator" : "Join live class"}
                </button>
              )}
              {p.role === "moderator" && p.state !== "live" && <p className="mt-3 text-xs text-ink-faint">You can join once the instructor is live.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RoundToggle({ on, onClick, onIcon, offIcon, label, danger }: { on: boolean; onClick: () => void; onIcon: React.ReactNode; offIcon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${on ? "Turn off" : "Turn on"} ${label.toLowerCase()}`}
      aria-pressed={on}
      className={cn("flex size-11 items-center justify-center rounded-full transition [&>svg]:size-5", on ? "bg-white/15 text-white hover:bg-white/25" : danger ? "bg-red-500 text-white" : "bg-red-500/90 text-white hover:bg-red-500")}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}

// ───────────────────────── In the room ─────────────────────────

function Room(p: ClassroomProps & { onEnded: () => void; onLeave: () => void }) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const perms = useLocalParticipantPermissions();
  const participants = useParticipants({
    updateOnlyOn: [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantAttributesChanged, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantPermissionsChanged],
  });
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false });
  const [tab, setTab] = useState<"chat" | "qa" | "people">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, rerender] = useState(0);
  const recorder = useRef<ClassRecorder | null>(null);
  const isHost = p.role === "host";
  const canModerate = p.role !== "learner";
  const hand = localParticipant.attributes?.hand === "1";
  const canSpeak = !!perms?.canPublish;

  // Clock + server status (go-live time)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    fetch(`/api/live/${p.sessionId}/status`).then((r) => r.json()).then((s) => s.liveStartedAt && setStartedAt(new Date(s.liveStartedAt).getTime())).catch(() => {});
    return () => clearInterval(t);
  }, [p.sessionId]);

  // Presence heartbeat → automatic attendance
  const onEndedRef = useRef(p.onEnded);
  onEndedRef.current = p.onEnded;
  useEffect(() => {
    const beat = () => fetch(`/api/live/${p.sessionId}/presence`, { method: "POST" }).then((r) => r.json()).then((s) => s.state === "ended" && onEndedRef.current()).catch(() => {});
    void beat();
    const t = setInterval(beat, 30_000);
    // Final heartbeat when the tab closes, so the last minutes still count toward attendance.
    const bye = () => navigator.sendBeacon(`/api/live/${p.sessionId}/presence`);
    window.addEventListener("pagehide", bye);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", bye);
    };
  }, [p.sessionId]);
  const finalBeat = () => fetch(`/api/live/${p.sessionId}/presence`, { method: "POST" }).catch(() => {});

  // Chat history
  useEffect(() => {
    fetch(`/api/live/${p.sessionId}/chat`).then((r) => (r.ok ? r.json() : [])).then(setMessages).catch(() => {});
  }, [p.sessionId]);

  // Realtime events from the server
  useDataChannel("dob", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "chat") setMessages((m) => (m.some((x) => x.id === data.message.id) ? m : [...m, data.message]));
      if (data.type === "chat-update") setMessages((m) => m.map((x) => (x.id === data.message.id ? data.message : x)));
      if (data.type === "ended" && !isHost) {
        void room.disconnect();
        p.onEnded();
      }
    } catch {
      /* ignore malformed packets */
    }
  });

  // Host records the class
  useEffect(() => {
    if (!isHost || !p.recordingEnabled) return;
    const r = new ClassRecorder(room, p.sessionId, p.title, () => rerender((n) => n + 1));
    recorder.current = r;
    void r.start();
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      r.dispose();
      recorder.current = null;
    };
  }, [isHost, p.recordingEnabled, p.sessionId, p.title, room]);

  // Tell learners when they're given the floor
  const prevCanSpeak = useRef(canSpeak);
  useEffect(() => {
    if (p.role === "learner" && canSpeak && !prevCanSpeak.current) setNotice("The instructor gave you the floor — turn on your mic to speak.");
    if (p.role === "learner" && !canSpeak && prevCanSpeak.current) {
      setNotice("Your speaking turn has ended.");
      void localParticipant.setMicrophoneEnabled(false).catch(() => {});
      void localParticipant.setCameraEnabled(false).catch(() => {});
    }
    prevCanSpeak.current = canSpeak;
  }, [canSpeak, p.role, localParticipant]);

  const host = participants.find((x) => x.attributes?.role === "host");
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare && t.publication && !t.publication.isMuted) as TrackReference | undefined;
  const hostCam = tracks.find((t) => t.source === Track.Source.Camera && t.participant.attributes?.role === "host" && t.publication && !t.publication.isMuted) as TrackReference | undefined;
  const others = tracks.filter((t) => t.source === Track.Source.Camera && t.participant.attributes?.role !== "host" && t.publication && !t.publication.isMuted) as TrackReference[];
  const main = screen ?? hostCam;
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const hands = participants.filter((x) => x.attributes?.hand === "1").length;
  const rec = recorder.current;

  const endClass = async () => {
    if (!window.confirm("End the class for everyone? The recording will be processed and published to the course.")) return;
    setEnding(true);
    try {
      await finalBeat();
      await recorder.current?.stop();
      await fetch(`/api/live/${p.sessionId}/end`, { method: "POST" });
    } finally {
      await room.disconnect();
      p.onEnded();
    }
  };

  const leave = async () => {
    await finalBeat();
    await room.disconnect();
    p.onLeave();
  };

  return (
    <div className="flex h-dvh flex-col bg-[#0b0a1a] text-white lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <LogoMark size={28} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{p.title}</div>
            <div className="truncate text-xs text-white/50">{p.courseTitle} · {p.batchName}</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/30"><span className="size-1.5 animate-pulse rounded-full bg-red-400" /> LIVE {clock(elapsed)}</span>
          {isHost && rec && (
            <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", rec.phase === "error" ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "bg-white/10 text-white/80 ring-white/15")} title={rec.error ?? undefined}>
              <Circle className={cn("size-2.5", rec.phase === "recording" ? "fill-red-500 text-red-500" : "")} />
              {rec.phase === "recording" ? `REC${rec.pendingChunks > 2 ? " · uploading" : ""}` : rec.phase === "stopping" ? "Saving recording…" : rec.phase === "error" ? "Not recording" : "REC"}
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80"><Users className="size-3.5" /> {participants.length}</span>
        </div>

        {/* stage */}
        <div className="relative mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
          {main ? (
            <VideoTrack trackRef={main} className={cn("size-full", screen ? "object-contain" : "object-cover")} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <span className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-lilac-300 to-lilac-500 text-2xl font-semibold text-white">{initials(host?.name || p.hostName)}</span>
              <span className="text-sm">{host ? `${host.name}’s camera is off` : "Waiting for the instructor to connect…"}</span>
            </div>
          )}
          {screen && hostCam && (
            <div className="absolute bottom-4 right-4 aspect-video w-56 overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/20">
              <VideoTrack trackRef={hostCam} className="size-full object-cover" />
            </div>
          )}
          {others.length > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {others.slice(0, 4).map((t) => (
                <div key={t.publication.trackSid} className="relative aspect-video w-40 overflow-hidden rounded-xl ring-2 ring-white/20">
                  <VideoTrack trackRef={t} className="size-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px]">{t.participant.name}</span>
                </div>
              ))}
            </div>
          )}
          {notice && (
            <button onClick={() => setNotice(null)} className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink shadow-xl">{notice}</button>
          )}
          <StartAudio label="Click to enable class audio" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink shadow-xl" />
        </div>

        {/* controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4">
          {(canModerate || canSpeak) && (
            <>
              <RoundToggle on={isMicrophoneEnabled} onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} onIcon={<Mic />} offIcon={<MicOff />} label="Microphone" />
              <RoundToggle on={isCameraEnabled} onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)} onIcon={<Video />} offIcon={<VideoOff />} label="Camera" />
            </>
          )}
          {canModerate && (
            <button
              onClick={() => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true }).catch(() => {})}
              className={cn("flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition", isScreenShareEnabled ? "bg-lilac-500 text-white" : "bg-white/15 text-white hover:bg-white/25")}
            >
              {isScreenShareEnabled ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />} {isScreenShareEnabled ? "Stop sharing" : "Share screen"}
            </button>
          )}
          {p.role === "learner" && !canSpeak && (
            <button
              onClick={() => void localParticipant.setAttributes({ hand: hand ? "" : "1" })}
              className={cn("flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition", hand ? "bg-amber-400 text-ink" : "bg-white/15 text-white hover:bg-white/25")}
              aria-pressed={hand}
            >
              <Hand className="size-5" /> {hand ? "Lower hand" : "Raise hand"}
            </button>
          )}
          <span className="mx-2 h-6 w-px bg-white/15" />
          {canModerate ? (
            <button onClick={endClass} disabled={ending} className="flex h-11 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
              {ending ? <Loader2 className="size-5 animate-spin" /> : <PhoneOff className="size-5" />} {ending ? "Ending…" : "End class"}
            </button>
          ) : (
            <button onClick={leave} className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-medium text-white hover:bg-white/25">
              <LogOut className="size-5" /> Leave
            </button>
          )}
        </div>
      </section>

      {/* side panel */}
      <aside className="flex h-[45dvh] w-full flex-col bg-white text-navy-950 lg:h-auto lg:w-[360px]">
        <div className="flex gap-1 border-b border-[#eef1f6] p-2">
          {([
            ["chat", "Chat", <MessageSquare key="c" className="size-4" />],
            ["qa", "Q&A", <HelpCircle key="q" className="size-4" />],
            ["people", `People${hands ? ` · ✋${hands}` : ""}`, <Users key="p" className="size-4" />],
          ] as const).map(([k, l, icon]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition", tab === k ? "bg-azure-50 text-azure-500" : "text-muted-500 hover:bg-slate-50")}>
              {icon} {l}
            </button>
          ))}
        </div>
        {tab === "people" ? (
          <People participants={participants} sessionId={p.sessionId} canModerate={canModerate} />
        ) : (
          <ChatPanel sessionId={p.sessionId} messages={messages} kind={tab === "qa" ? "QUESTION" : "CHAT"} canModerate={canModerate} enabled={p.chatEnabled} meId={localParticipant.identity} />
        )}
      </aside>
    </div>
  );
}

function ChatPanel({ sessionId, messages, kind, canModerate, enabled, meId }: { sessionId: string; messages: ChatMsg[]; kind: "CHAT" | "QUESTION"; canModerate: boolean; enabled: boolean; meId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const list = useMemo(() => messages.filter((m) => m.kind === kind), [messages, kind]);
  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollIntoView, which React must not receive.
    void end.current?.scrollIntoView({ behavior: "smooth" });
  }, [list.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setErr(null);
    const r = await fetch(`/api/live/${sessionId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, body }) });
    setSending(false);
    if (r.ok) setText("");
    else setErr((await r.json().catch(() => ({}))).error ?? "Couldn’t send");
  };
  const toggleAnswered = (m: ChatMsg) =>
    fetch(`/api/live/${sessionId}/chat`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: m.id, answered: !m.answered }) });

  if (!enabled) return <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-500">Chat is turned off for live classes.</div>;
  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {list.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-500">
            {kind === "QUESTION" ? <HelpCircle className="size-6" /> : <Sparkles className="size-6" />}
            {kind === "QUESTION" ? "Questions for the instructor appear here." : "Say hello to the class 👋"}
          </div>
        )}
        {list.map((m) => (
          <div key={m.id} className={cn("flex gap-2.5", kind === "QUESTION" && "rounded-xl border border-[#e8ebf1] p-3", m.answered && "opacity-60")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: m.user.avatarColor }}>{initials(m.user.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-navy-950">{m.user.id === meId ? "You" : m.user.name}</span>
                <span className="text-muted-500">{clock(m.offsetSec)}</span>
                {m.answered && <span className="flex items-center gap-1 text-brand-700"><CircleCheck className="size-3" /> Answered</span>}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-navy-950/90">{m.body}</p>
              {kind === "QUESTION" && canModerate && (
                <button onClick={() => void toggleAnswered(m)} className="mt-1.5 text-xs font-medium text-azure-500 hover:underline">{m.answered ? "Mark unanswered" : "Mark answered"}</button>
              )}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-[#eef1f6] p-3">
        {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={kind === "QUESTION" ? "Ask the instructor a question…" : "Message the class…"} aria-label={kind === "QUESTION" ? "Your question" : "Chat message"} className="h-10 flex-1 rounded-xl border border-[#e8ebf1] px-3 text-sm focus:border-azure-500 focus:outline-none focus:ring-4 focus:ring-azure-500/10" />
          <button disabled={sending || !text.trim()} className="flex size-10 items-center justify-center rounded-xl bg-navy-950 text-white disabled:opacity-40" aria-label="Send">{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
        </div>
      </form>
    </>
  );
}

function People({ participants, sessionId, canModerate }: { participants: Participant[]; sessionId: string; canModerate: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (identity: string, action: string, trackSid?: string) => {
    setBusy(identity + action);
    await fetch(`/api/live/${sessionId}/moderate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity, action, trackSid }) });
    setBusy(null);
  };
  const sorted = [...participants].sort((a, b) => {
    const rank = (x: Participant) => (x.attributes?.role === "host" ? 0 : x.attributes?.role === "moderator" ? 1 : x.attributes?.hand === "1" ? 2 : 3);
    return rank(a) - rank(b) || (a.name ?? "").localeCompare(b.name ?? "");
  });
  return (
    <ul className="flex-1 divide-y divide-[#eef1f6] overflow-y-auto">
      {sorted.map((x) => {
        const role = x.attributes?.role;
        const speaker = x.attributes?.speaker === "1" || (role === "learner" && x.permissions?.canPublish);
        const mic = x.getTrackPublication(Track.Source.Microphone);
        return (
          <li key={x.identity} className="flex flex-wrap items-center gap-2.5 px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-lilac-300 to-lilac-500 text-xs font-semibold text-white">{initials(x.name || "?")}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm font-medium text-navy-950">
                {x.name}{x.isLocal && <span className="text-muted-500">(you)</span>}
                {x.attributes?.hand === "1" && <Hand className="size-4 text-amber-500" aria-label="Hand raised" />}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-500">
                {role === "host" ? <><ShieldCheck className="size-3" /> Instructor</> : role === "moderator" ? <><ShieldCheck className="size-3" /> Moderator</> : speaker ? <><Volume2 className="size-3" /> Speaking</> : "Learner"}
              </div>
            </div>
            {canModerate && role === "learner" && (
              <div className="flex gap-1">
                {speaker ? (
                  <button disabled={!!busy} onClick={() => act(x.identity, "revoke-speak")} className="rounded-lg px-2 py-1 text-xs font-medium text-azure-500 hover:bg-azure-50">End turn</button>
                ) : (
                  <button disabled={!!busy} onClick={() => act(x.identity, "allow-speak")} className={cn("rounded-lg px-2 py-1 text-xs font-medium", x.attributes?.hand === "1" ? "bg-amber-100 text-amber-800" : "text-azure-500 hover:bg-azure-50")}>Let speak</button>
                )}
                {mic && !mic.isMuted && <button disabled={!!busy} onClick={() => act(x.identity, "mute", mic.trackSid)} className="rounded-lg p-1 text-muted-500 hover:bg-slate-100" aria-label={`Mute ${x.name}`}><MicOff className="size-4" /></button>}
                <button disabled={!!busy} onClick={() => window.confirm(`Remove ${x.name} from the class?`) && act(x.identity, "remove")} className="rounded-lg p-1 text-muted-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${x.name}`}><UserMinus className="size-4" /></button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
