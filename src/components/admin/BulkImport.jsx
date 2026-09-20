
import React, { useState } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Upload, FileUp, CheckCircle, AlertTriangle } from "lucide-react";

const ENTITY_OPTIONS = [
  { name: "Property", label: "Property" },
  { name: "Business", label: "Business" },
  { name: "Vehicle", label: "Vehicle" },
  { name: "PoliticalParty", label: "Political Party" },
  { name: "NewsItem", label: "News Item" },
  { name: "Task", label: "Task" },
];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      const v = (vals[idx] || "").trim();
      // try number
      obj[h] = (v !== "" && !isNaN(v) && /^-?\d+(\.\d+)?$/.test(v)) ? Number(v) : v;
    });
    rows.push(obj);
  }
  return rows;
}

export default function BulkImport() {
  const [entity, setEntity] = useState("Property");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      let parsed = [];
      try {
        if (file.name.endsWith(".json")) parsed = JSON.parse(text);
        else parsed = parseCSV(text);
      } catch (err) { setResult({ error: "Parse error: " + err.message }); }
      setRows(Array.isArray(parsed) ? parsed : []);
    };
    reader.readAsText(file);
  }

  async function importNow() {
    if (rows.length === 0) return;
    setBusy(true); setResult(null);
    let ok = 0, fail = 0;
    try {
      for (let i = 0; i < rows.length; i += 400) {
        const batch = rows.slice(i, i + 400);
        try {
          await bharat01.entities[entity].bulkCreate(batch);
          ok += batch.length;
        } catch (e) {
          fail += batch.length;
        }
      }
      setResult({ ok, fail, total: rows.length });
      setRows([]); setFileName("");
    } catch (e) {
      setResult({ error: e.message || "import failed" });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <select value={entity} onChange={e => setEntity(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
          {ENTITY_OPTIONS.map(o => <option key={o.name} value={o.name}>{o.label}</option>)}
        </select>
        <label className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 cursor-pointer flex items-center gap-2">
          <Upload className="w-4 h-4" /> {fileName || "Choose CSV or JSON…"}
          <input type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
        </label>
      </div>
      {rows.length > 0 && (
        <div className="bg-zinc-800/40 rounded-xl p-3 mb-3">
          <p className="text-xs text-white mb-1">{rows.length} records ready</p>
          <p className="text-[10px] text-zinc-500 truncate">Fields: {Object.keys(rows[0]).join(", ")}</p>
        </div>
      )}
      <button onClick={importNow} disabled={busy || rows.length === 0} className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
        <FileUp className="w-4 h-4" /> {busy ? "Importing…" : `Import ${rows.length || ""} into ${entity}`}
      </button>
      {result && !result.error && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mt-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <p className="text-xs text-green-400">Imported {result.ok} records{result.fail ? `, ${result.fail} failed` : ""}.</p>
        </div>
      )}
      {result?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mt-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-xs text-red-400">{result.error}</p>
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">CSV: first row = headers. JSON: array of objects. Numbers auto-detected. Existing records are not updated — import appends.</p>
    </div>
  );
}