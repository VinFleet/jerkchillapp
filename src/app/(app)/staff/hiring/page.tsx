"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/lib/auth/RoleContext";
import {
  getCandidates,
  addCandidate,
  updateCandidateStatus,
  getQuestionBank,
  addQuestion,
  getScorecards,
  addScorecard,
} from "@/lib/repo/staff";
import { CANDIDATE_STATUS_LABEL, CANDIDATE_STATUS_ORDER } from "@/lib/staffLabels";
import type { Candidate, CandidateStatus, QuestionBankItem, InterviewScorecard, ScorecardEntry } from "@/lib/types";

const STATUS_TONE: Record<CandidateStatus, "muted" | "warning" | "brand" | "success" | "danger"> = {
  applied: "muted",
  interviewing: "warning",
  offered: "brand",
  hired: "success",
  rejected: "danger",
};

function AddCandidateForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleApplied, setRoleApplied] = useState("");
  const [phone, setPhone] = useState("");
  const [cvNote, setCvNote] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full min-h-14 rounded-2xl border-2 border-dashed border-brand-tint text-brand font-semibold flex items-center justify-center gap-2 mb-4"
      >
        <Plus size={18} /> Add candidate · Thêm ứng viên
      </button>
    );
  }

  const reset = () => {
    setName("");
    setRoleApplied("");
    setPhone("");
    setCvNote("");
    setOpen(false);
  };

  return (
    <Card className="mb-4">
      <p className="font-semibold text-sm mb-2">New candidate · Ứng viên mới</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name · Tên"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={roleApplied}
        onChange={(e) => setRoleApplied(e.target.value)}
        placeholder="Role applied for · Vị trí ứng tuyển"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional) · Điện thoại"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
      />
      <input
        value={cvNote}
        onChange={(e) => setCvNote(e.target.value)}
        placeholder="CV note / link · Ghi chú CV"
        className="w-full min-h-12 rounded-xl border-2 border-border px-3 mb-3 text-sm focus:outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!name.trim() || !roleApplied.trim()}
          onClick={() => {
            addCandidate(name.trim(), roleApplied.trim(), phone.trim() || undefined, cvNote.trim() || undefined);
            reset();
            onAdded();
          }}
        >
          Add · Thêm
        </Button>
      </div>
    </Card>
  );
}

function ScorecardForm({ candidate, interviewer, onSaved }: { candidate: Candidate; interviewer: string; onSaved: () => void }) {
  const questions = getQuestionBank(candidate.roleApplied);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  if (questions.length === 0) {
    return <p className="text-xs text-muted">No questions in the bank for &ldquo;{candidate.roleApplied}&rdquo; yet.</p>;
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q.id}>
          <p className="text-sm mb-1">
            {q.question.en} <span className="text-muted">· {q.question.vi}</span>
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setScores((s) => ({ ...s, [q.id]: n }))}
                className={`flex-1 min-h-9 rounded-lg font-bold text-sm border-2 ${
                  scores[q.id] === n ? "bg-brand text-white border-brand" : "border-border text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Overall note · Nhận xét chung"
        rows={2}
        className="w-full rounded-xl border-2 border-border px-3 py-2 text-sm focus:outline-none focus:border-brand"
      />
      <Button
        className="w-full min-h-11 text-sm"
        disabled={Object.keys(scores).length < questions.length}
        onClick={() => {
          const entries: ScorecardEntry[] = questions.map((q) => ({ questionId: q.id, score: scores[q.id] }));
          addScorecard(candidate.id, interviewer, entries, note.trim() || undefined);
          setScores({});
          setNote("");
          onSaved();
        }}
      >
        Save scorecard · Lưu đánh giá
      </Button>
    </div>
  );
}

function CandidateCard({ candidate, interviewer, onChanged }: { candidate: Candidate; interviewer: string; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [scorecards, setScorecards] = useState<InterviewScorecard[]>([]);

  useEffect(() => {
    if (expanded) setScorecards(getScorecards(candidate.id));
  }, [expanded, candidate.id]);

  return (
    <Card>
      <button className="w-full flex items-center justify-between gap-2 text-left" onClick={() => setExpanded((e) => !e)}>
        <div>
          <p className="font-semibold text-sm">{candidate.name}</p>
          <p className="text-xs text-muted">{candidate.roleApplied}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={STATUS_TONE[candidate.status]}>{CANDIDATE_STATUS_LABEL[candidate.status].en}</Badge>
          {expanded ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {candidate.phone && <p className="text-sm">📞 {candidate.phone}</p>}
          {candidate.cvNote && <p className="text-sm text-muted">{candidate.cvNote}</p>}

          <div className="flex flex-wrap gap-2">
            {CANDIDATE_STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => {
                  updateCandidateStatus(candidate.id, s);
                  onChanged();
                }}
                className={`min-h-9 px-3 rounded-full text-xs font-semibold border-2 ${
                  candidate.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
                }`}
              >
                {CANDIDATE_STATUS_LABEL[s].en}
              </button>
            ))}
          </div>

          {scorecards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Scorecards · Đánh giá</p>
              {scorecards.map((sc) => {
                const avg = sc.scores.reduce((sum, s) => sum + s.score, 0) / sc.scores.length;
                return (
                  <div key={sc.id} className="text-sm">
                    {sc.interviewer} · {sc.date} · avg {avg.toFixed(1)}/5
                    {sc.overallNote && <span className="text-muted"> — {sc.overallNote}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <details>
            <summary className="text-xs text-brand font-semibold cursor-pointer">+ New scorecard · Đánh giá mới</summary>
            <div className="mt-2">
              <ScorecardForm
                candidate={candidate}
                interviewer={interviewer}
                onSaved={() => setScorecards(getScorecards(candidate.id))}
              />
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}

function QuestionBankSection() {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [role, setRole] = useState("");
  const [en, setEn] = useState("");
  const [vi, setVi] = useState("");

  const refresh = () => setQuestions(getQuestionBank());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const grouped = questions.reduce<Record<string, QuestionBankItem[]>>((acc, q) => {
    (acc[q.role] ??= []).push(q);
    return acc;
  }, {});

  return (
    <Card className="mb-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <p className="font-semibold text-sm">Question bank · Ngân hàng câu hỏi</p>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {Object.entries(grouped).map(([r, qs]) => (
            <div key={r}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{r}</p>
              {qs.map((q) => (
                <p key={q.id} className="text-sm mb-1">
                  {q.question.en} <span className="text-muted">· {q.question.vi}</span>
                </p>
              ))}
            </div>
          ))}
          <div className="pt-2 border-t border-border">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role · Vai trò"
              className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
            />
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="Question (English)"
              className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
            />
            <input
              value={vi}
              onChange={(e) => setVi(e.target.value)}
              placeholder="Câu hỏi (Tiếng Việt)"
              className="w-full min-h-11 rounded-xl border-2 border-border px-3 mb-2 text-sm focus:outline-none focus:border-brand"
            />
            <Button
              className="w-full min-h-11 text-sm"
              disabled={!role.trim() || !en.trim() || !vi.trim()}
              onClick={() => {
                addQuestion(role.trim(), en.trim(), vi.trim());
                setRole("");
                setEn("");
                setVi("");
                refresh();
              }}
            >
              Add question · Thêm câu hỏi
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function HiringContent() {
  const { session } = useSession();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const refresh = () => setCandidates(getCandidates());

  useEffect(() => {
    refresh();
  }, []);

  if (!session) return null;

  return (
    <div className="pb-6">
      <BackLink href="/staff" label="Staff · Nhân viên" />
      <PageHeader title="Hiring & Recruitment · Tuyển Dụng" subtitle="Candidates and interviews · Ứng viên và phỏng vấn" />
      <div className="px-4 md:px-8">
        <QuestionBankSection />
        <AddCandidateForm onAdded={refresh} />
        <div className="space-y-2">
          {candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} interviewer={session.name} onChanged={refresh} />
          ))}
          {candidates.length === 0 && <p className="text-muted text-center py-10 text-sm">No candidates yet · Chưa có ứng viên</p>}
        </div>
      </div>
    </div>
  );
}

export default function HiringPage() {
  return (
    <RoleGate module="staff">
      <HiringContent />
    </RoleGate>
  );
}
