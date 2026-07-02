import { useState } from "react";

function decodePayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const SEGMENT_COLORS = ["text-rose-500", "text-violet-500", "text-sky-500"];
const SEGMENT_LABELS = ["header", "payload", "signature"];

function TokenCard({ token }) {
  const [open, setOpen] = useState(false);
  const parts = token.split(".");
  const payload = decodePayload(token);
  const expires =
    payload?.exp ? new Date(payload.exp * 1000).toLocaleTimeString() : "—";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">Your token</h2>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
        >
          {open ? "Hide claims" : "Decode claims"}
        </button>
      </div>

      {/* Color-segmented token, jwt.io style */}
      <p className="font-mono text-[11px] leading-relaxed break-all bg-slate-50 rounded-lg p-3.5 border border-slate-100">
        {parts.map((part, i) => (
          <span key={i}>
            <span className={SEGMENT_COLORS[i]}>{part}</span>
            {i < parts.length - 1 && <span className="text-slate-400">.</span>}
          </span>
        ))}
      </p>
      <div className="flex gap-4 mt-2">
        {SEGMENT_LABELS.map((label, i) => (
          <span key={label} className={`text-[11px] font-mono ${SEGMENT_COLORS[i]}`}>
            ● {label}
          </span>
        ))}
      </div>

      {open && payload && (
        <div className="mt-4 grid sm:grid-cols-2 gap-2 font-mono text-xs">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <span className="text-slate-400">{key}: </span>
              <span className="text-slate-700 break-all">{String(value)}</span>
            </div>
          ))}
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="text-slate-400">expires at: </span>
            <span className="text-slate-700">{expires}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenCard;
