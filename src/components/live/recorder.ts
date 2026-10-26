import { Track, type Room } from "livekit-client";

/**
 * Records the live class in the host's browser and streams it to the server in 5-second chunks.
 *
 * Composition (1280×720): the screen share fills the frame with the host camera as picture-in-picture;
 * without a screen share the host camera fills it. Learners who were given the floor appear in a strip.
 * Audio mixes the host mic, shared-tab audio and every speaking participant.
 *
 * Frames are driven by a Web Worker clock so recording keeps going while the instructor presents
 * from another tab or window (main-thread timers are throttled in background tabs).
 */

type Phase = "idle" | "recording" | "stopping" | "stopped" | "error";

const W = 1280;
const H = 720;
const CHUNK_MS = 5000;

function pickMime() {
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export class ClassRecorder {
  phase: Phase = "idle";
  error: string | null = null;
  startedAt = 0;
  uploadedChunks = 0;
  pendingChunks = 0;

  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private host = document.createElement("div");
  private videos = new Map<string, { el: HTMLVideoElement; trackId: string }>();
  private audio: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private audioSources = new Map<string, MediaStreamAudioSourceNode>();
  private worker: Worker | null = null;
  private recorder: MediaRecorder | null = null;
  private queue: Promise<void> = Promise.resolve();
  private seq = 0;
  private segment = String(Date.now());
  private lastAudioSync = 0;
  private disposed = false;

  constructor(
    private room: Room,
    private sessionId: string,
    private label: string,
    private onChange: () => void,
  ) {
    this.canvas.width = W;
    this.canvas.height = H;
    Object.assign(this.host.style, { position: "fixed", left: "-10px", top: "-10px", width: "1px", height: "1px", opacity: "0", overflow: "hidden", pointerEvents: "none" });
    document.body.appendChild(this.host);
  }

  async start() {
    const mimeType = pickMime();
    if (!mimeType) {
      this.fail("This browser can’t record the class. Use the latest Chrome, Edge or Firefox.");
      return;
    }
    const audio = new AudioContext();
    this.audio = audio;
    await audio.resume();
    if (this.disposed) {
      void audio.close().catch(() => {});
      return;
    }
    this.dest = audio.createMediaStreamDestination();
    // A silent oscillator keeps the audio track alive even when nobody is speaking.
    const silence = audio.createGain();
    silence.gain.value = 0;
    const osc = audio.createOscillator();
    osc.connect(silence).connect(this.dest);
    osc.start();

    const stream = new MediaStream([...this.canvas.captureStream(30).getVideoTracks(), ...this.dest.stream.getAudioTracks()]);
    this.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.enqueue(e.data);
    };
    this.recorder.onerror = () => this.fail("Recording stopped unexpectedly.");

    const tick = new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / 30)})`], { type: "application/javascript" });
    this.worker = new Worker(URL.createObjectURL(tick));
    this.worker.onmessage = () => this.frame();

    this.segment = String(Date.now());
    this.seq = 0;
    this.startedAt = Date.now();
    this.recorder.start(CHUNK_MS);
    this.phase = "recording";
    this.onChange();
  }

  /** Stops recording and resolves once every chunk has been uploaded. */
  async stop() {
    if (this.phase !== "recording") return;
    this.phase = "stopping";
    this.onChange();
    await new Promise<void>((resolve) => {
      if (!this.recorder || this.recorder.state === "inactive") return resolve();
      this.recorder.addEventListener("stop", () => resolve(), { once: true });
      this.recorder.stop();
    });
    await this.queue;
    this.cleanup();
    this.phase = "stopped";
    this.onChange();
  }

  dispose() {
    this.disposed = true;
    try {
      if (this.recorder?.state === "recording") this.recorder.stop();
    } catch {
      /* already stopped */
    }
    this.cleanup();
  }

  private cleanup() {
    this.worker?.terminate();
    this.worker = null;
    this.audioSources.forEach((n) => n.disconnect());
    this.audioSources.clear();
    void this.audio?.close().catch(() => {});
    this.audio = null;
    this.videos.forEach(({ el }) => (el.srcObject = null));
    this.host.remove();
  }

  private fail(msg: string) {
    this.error = msg;
    this.phase = "error";
    this.onChange();
  }

  // ── uploads (sequential, retried) ──

  private enqueue(blob: Blob) {
    const seq = this.seq++;
    this.pendingChunks++;
    this.onChange();
    this.queue = this.queue.then(async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const res = await fetch(`/api/live/${this.sessionId}/recording?segment=${this.segment}&seq=${seq}`, { method: "POST", body: blob });
          if (res.ok) {
            this.uploadedChunks++;
            break;
          }
          if (res.status === 409 || res.status === 403) break; // class ended / not recording — nothing to retry
        } catch {
          /* network blip — retry */
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
      this.pendingChunks--;
      this.onChange();
    });
  }

  // ── composition ──

  private videoFor(slot: string, track: MediaStreamTrack) {
    let v = this.videos.get(slot);
    if (!v) {
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      this.host.appendChild(el);
      v = { el, trackId: "" };
      this.videos.set(slot, v);
    }
    if (v.trackId !== track.id) {
      v.el.srcObject = new MediaStream([track]);
      v.trackId = track.id;
      void v.el.play().catch(() => {});
    }
    return v.el;
  }

  private drawCover(el: HTMLVideoElement, x: number, y: number, w: number, h: number, contain = false) {
    const vw = el.videoWidth;
    const vh = el.videoHeight;
    if (!vw || !vh) return;
    const scale = contain ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, contain ? 0 : 14);
    this.ctx.clip();
    this.ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    this.ctx.restore();
  }

  private frame() {
    const c = this.ctx;
    const lp = this.room.localParticipant;
    const live = (src: Track.Source) => {
      const pub = lp.getTrackPublication(src);
      return pub && !pub.isMuted ? pub.track?.mediaStreamTrack : undefined;
    };
    const screen = live(Track.Source.ScreenShare);
    const cam = live(Track.Source.Camera);
    const speakers: MediaStreamTrack[] = [];
    for (const p of this.room.remoteParticipants.values()) {
      const pub = p.getTrackPublication(Track.Source.Camera);
      if (pub?.track && !pub.isMuted) speakers.push(pub.track.mediaStreamTrack);
      if (speakers.length === 3) break;
    }

    c.fillStyle = "#0b0a1a";
    c.fillRect(0, 0, W, H);
    if (screen) {
      this.drawCover(this.videoFor("main", screen), 0, 0, W, H, true);
      if (cam) {
        c.fillStyle = "rgba(255,255,255,.9)";
        c.beginPath();
        c.roundRect(W - 296, H - 182, 272, 158, 16);
        c.fill();
        this.drawCover(this.videoFor("pip", cam), W - 292, H - 178, 264, 150);
      }
    } else if (cam) {
      this.drawCover(this.videoFor("main", cam), 0, 0, W, H);
    } else {
      c.fillStyle = "#cfb8ff";
      c.font = "600 34px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(this.label, W / 2, H / 2);
      c.textAlign = "start";
    }
    speakers.forEach((t, i) => this.drawCover(this.videoFor(`s${i}`, t), 24 + i * 232, H - 154, 216, 130));

    // Watermark
    c.fillStyle = "rgba(11,10,26,.55)";
    c.beginPath();
    c.roundRect(20, 20, 330, 34, 10);
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = "500 15px system-ui, sans-serif";
    c.fillText("DoB Innovation & Learning Hub · Live class", 34, 42);

    if (Date.now() - this.lastAudioSync > 1000) this.syncAudio();
  }

  private syncAudio() {
    this.lastAudioSync = Date.now();
    if (!this.audio || !this.dest) return;
    const tracks: MediaStreamTrack[] = [];
    const lp = this.room.localParticipant;
    for (const src of [Track.Source.Microphone, Track.Source.ScreenShareAudio]) {
      const t = lp.getTrackPublication(src)?.track?.mediaStreamTrack;
      if (t) tracks.push(t);
    }
    for (const p of this.room.remoteParticipants.values()) {
      for (const src of [Track.Source.Microphone, Track.Source.ScreenShareAudio]) {
        const t = p.getTrackPublication(src)?.track?.mediaStreamTrack;
        if (t) tracks.push(t);
      }
    }
    const live = new Set(tracks.map((t) => t.id));
    for (const [id, node] of this.audioSources) {
      if (!live.has(id)) {
        node.disconnect();
        this.audioSources.delete(id);
      }
    }
    for (const t of tracks) {
      if (this.audioSources.has(t.id) || t.readyState !== "live") continue;
      const node = this.audio.createMediaStreamSource(new MediaStream([t]));
      node.connect(this.dest);
      this.audioSources.set(t.id, node);
    }
  }
}
