"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import { ArrowUp, Loader2 } from "lucide-react";
import { askAssistant } from "@/app/actions/student";
import { Icon3D } from "./icon-3d";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "USER" | "ASSISTANT"; content: string; needsReview: boolean };

function Pending({ question }: { question: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <>
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-navy-950 px-4 py-3 text-sm text-white">{question}</div>
      <div className="flex w-16 gap-1 rounded-2xl rounded-bl-md border border-[#e8ebf1] bg-white px-4 py-3">
        {[0, 1, 2].map((d) => (
          <motion.span key={d} className="size-1.5 rounded-full bg-muted-500" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
        ))}
      </div>
    </>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-950 text-white transition hover:bg-navy-800 disabled:opacity-50" aria-label="Send">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
    </button>
  );
}

export function AssistantChat({
  conversationId,
  courseId,
  courses,
  messages,
  initialQuestion,
  suggestions,
}: {
  conversationId: string | null;
  courseId: string | null;
  courses: { id: string; title: string }[];
  messages: Msg[];
  initialQuestion?: string;
  suggestions: string[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(askAssistant, undefined);
  const [text, setText] = useState(initialQuestion ?? "");
  const [sent, setSent] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    if (state?.ok && state.conversationId && state.conversationId !== conversationId) router.replace(`/dashboard/assistant?c=${state.conversationId}`);
  }, [state, conversationId, router]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sent]);
  useEffect(() => {
    if (initialQuestion && !autoSent.current) {
      autoSent.current = true;
      formRef.current?.requestSubmit();
    }
  }, [initialQuestion]);

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col overflow-hidden rounded-2xl border border-[#e8ebf1] bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-5">
        {messages.length === 0 && !sent && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Icon3D name="bot" size={72} />
            <h2 className="mt-5 font-display text-xl font-semibold text-navy-950">How can I help you learn today?</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-600">Ask about your classes, deadlines, certificates or how the platform works — in Bangla or English.</p>
            <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setText(s)} className="rounded-xl border border-[#e8ebf1] bg-white px-3 py-2 text-sm text-navy-950 transition hover:border-azure-200 hover:bg-azure-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "USER" && "justify-end")}>
            <div className={cn("max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed", m.role === "USER" ? "rounded-br-md bg-navy-950 text-white" : "rounded-bl-md border border-[#e8ebf1] bg-white text-navy-950")}>
              {m.content}
              {m.needsReview && <div className="mt-2 text-[11px] font-medium text-tangerine-500">Forwarded to the learning team</div>}
            </div>
          </motion.div>
        ))}
        <form ref={formRef} id="ask" action={(fd) => { setSent(String(fd.get("question") ?? "")); setText(""); action(fd); }} className="contents">
          <Pending question={sent} />
          {state?.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
          <div ref={endRef} />
          <input type="hidden" name="conversationId" value={conversationId ?? ""} />
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto border-t border-[#e8ebf1] bg-white p-3">
            <div className="flex items-end gap-2">
              {!conversationId && courses.length > 0 && (
                <select name="courseId" defaultValue={courseId ?? ""} className="h-10 max-w-[180px] rounded-xl border border-[#e8ebf1] bg-azure-50/60 px-2 text-xs text-navy-950">
                  <option value="">General question</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
              <textarea
                name="question"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim()) formRef.current?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask DoB AI…"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-[#e8ebf1] px-3.5 py-2.5 text-sm focus:border-azure-500 focus:outline-none focus:ring-4 focus:ring-azure-500/10"
              />
              <SendButton />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
