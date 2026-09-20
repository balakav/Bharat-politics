
import React, { useState } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";

// Party leader bulk candidate upload: one Excel/CSV file with columns
// State Name | Constituency Number | Candidate Name | Party Name.
// The file is uploaded from the browser; the AI extraction + candidate
// registration run inside the importCandidates backend function, which
// protects the app's integration credits.

export default function BulkCandidateUpload({ election, party, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const isNational = election?.election_type === "national";

  function downloadSample() {
    // Two separate templates: a national election covers 500+ Lok Sabha
    // constituencies across every state, so the national sample lists one
    // row per state; the state template stays small.
    const rows = isNational
      ? [
          ["State Name", "Constituency Number", "Candidate Name", "Party Name"],
          ...BHARAT_STATES.map(s => [s.name, "1", `Candidate · ${s.name}`, party?.name || "Your Party"]),
        ]
      : [
          ["State Name", "Constituency Number", "Candidate Name", "Party Name"],
          ["Anga-Desam", "1", "Arjunan Velayudham", party?.name || "Your Party"],
          ["Anga-Desam", "2", "Meenakshi Sundaram", party?.name || "Your Party"],
          ["Anga-Desam", "3", "Kavitha Rajendran", party?.name || "Your Party"],
          ["Hastinapura", "1", "Devraj Sharma", party?.name || "Your Party"],
          ["Hastinapura", "2", "Ishani Verma", party?.name || "Your Party"],
        ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = isNational ? "sample-national-candidate-list.csv" : "sample-candidate-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const { file_url } = await bharat01.integrations.Core.UploadPublicFile({ file });
      const res = await bharat01.functions.invoke("importCandidates", {
        file_url,
        election_id: election.id,
        party_id: party.id,
      });
      const created = res.data?.created || 0;
      setResult({ created, skipped: res.data?.skipped || 0, reasons: res.data?.skipped_reasons || [] });
      // After a successful bulk submission, return to the election page.
      if (onDone && created > 0) setTimeout(onDone, 1500);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Upload failed");
    }
    setBusy(false);
  }

  return (
    <div className="bg-zinc-800/40 rounded-xl p-3 border border-yellow-500/20">
      <p className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5 mb-2">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Party Leader — Bulk Candidate Upload
      </p>
      <p className="text-[10px] text-zinc-500 mb-2">
        Excel/CSV columns: State Name, Constituency Number, Candidate Name, Party Name. All candidates register in one click.
        {isNational
          ? `National election — ${NATION.lokSabhaSeats} constituencies across every state. Use the national sample file and add one row per constituency your party contests (finalize the split on the Seat Sharing screen).`
          : "Include rows for every constituency your party contests."}
      </p>
      <button onClick={downloadSample}
        className="w-full mb-2 bg-zinc-700 text-zinc-100 text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-zinc-600 transition-all">
        <Download className="w-3.5 h-3.5" /> Download {isNational ? "National" : "State"} Sample File
      </button>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
        className="w-full text-xs text-zinc-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:text-white file:text-xs" />
      <button onClick={handleUpload} disabled={busy || !file}
        className="w-full mt-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
        {busy ? "Processing…" : (<><Upload className="w-3.5 h-3.5" /> Register All Candidates</>)}
      </button>
      {error && <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
      {result && (
        <div className="mt-2">
          <p className="text-[11px] text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {result.created} candidates registered{result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}.
          </p>
          {result.created > 0 && <p className="text-[10px] text-zinc-500 mt-1">Opening the election page…</p>}
          {result.reasons.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {result.reasons.map((r, i) => (
                <li key={i} className="text-[10px] text-yellow-400/80 flex items-start gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" /> {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}