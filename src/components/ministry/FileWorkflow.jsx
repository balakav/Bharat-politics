
import React, { useState } from "react";
import { FileText, Send, CheckCircle, XCircle, Eye, FilePlus } from "lucide-react";

// Ministry file workflow: anyone in the office can send a file; the head
// moves it through Submitted → Under Review → Approved / Rejected (with note).

const STATUS_STYLE = {
  submitted: { label: "Submitted", cls: "bg-yellow-500/20 text-yellow-400" },
  under_review: { label: "Under Review", cls: "bg-blue-500/20 text-blue-400" },
  approved: { label: "Approved", cls: "bg-green-500/20 text-green-400" },
  rejected: { label: "Rejected", cls: "bg-red-500/20 text-red-400" },
};

export default function FileWorkflow({ files, isHead, busy, onAction, onSubmit }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState({});
  const [showForm, setShowForm] = useState(false);

  function send() {
    if (!title.trim() || busy) return;
    onSubmit(title.trim(), summary.trim());
    setTitle(""); setSummary(""); setShowForm(false);
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
          <FileText className="w-3 h-3" /> File Workflow ({files.length})
        </p>
        <button onClick={() => setShowForm(!showForm)} disabled={busy}
          className="text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
          <FilePlus className="w-3 h-3" /> New File
        </button>
      </div>

      {showForm && (
        <div className="space-y-1.5 mb-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="File title (e.g. Road repair proposal)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-orange-500" />
          <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="One-line summary (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-orange-500" />
          <button onClick={send} disabled={busy || !title.trim()}
            className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Submit File
          </button>
        </div>
      )}

      {files.length === 0 && <p className="text-[11px] text-zinc-600">No files yet — the office's paperwork appears here.</p>}
      <div className="space-y-2">
        {files.map(f => {
          const st = STATUS_STYLE[f.status] || STATUS_STYLE.submitted;
          return (
            <div key={f.id} className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-[11px] font-bold text-white truncate">{f.title}</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              {f.summary && <p className="text-[10px] text-zinc-400 truncate">{f.summary}</p>}
              <p className="text-[9px] text-zinc-600 mt-0.5">By {f.submitted_by_name || "—"}{f.handled_by_name ? ` · Handled by ${f.handled_by_name}` : ""}</p>

              {isHead && f.status === "submitted" && (
                <button onClick={() => onAction(f, "under_review", "")} disabled={busy}
                  className="mt-1.5 w-full bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                  <Eye className="w-3 h-3" /> Take Up for Review
                </button>
              )}
              {isHead && f.status === "under_review" && (
                <div className="mt-1.5 space-y-1.5">
                  <input value={notes[f.id] || ""} onChange={e => setNotes(p => ({ ...p, [f.id]: e.target.value }))}
                    placeholder="Decision note (optional)"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-orange-500" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => onAction(f, "approved", notes[f.id] || "")} disabled={busy}
                      className="bg-green-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => onAction(f, "rejected", notes[f.id] || "")} disabled={busy}
                      className="bg-red-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              )}
              {f.decision_note && (f.status === "approved" || f.status === "rejected") && (
                <p className="text-[9px] text-zinc-500 mt-1 italic">Note: {f.decision_note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}