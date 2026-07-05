import { useState } from "react";

const API = "http://localhost:5237";

export default function PantryObjectDetector({ onAdded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  function onPick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setDone(false);
  }

  async function detect() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setDone(false);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${API}/api/detect`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Failed to detect objects");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function addDetectedToPantry() {
    if (!result?.objects?.length) return;
    setAdding(true);
    try {
      const items = result.objects.map((o) => ({ name: o.label, quantity: "1", unit: o.unit || "" }));
      const res = await fetch(`${API}/api/pantry/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!res.ok) throw new Error("Failed to add to pantry");
      setDone(true);
      onAdded?.();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="w-full bg-brand-light rounded-2xl p-4">
      <h3 className="font-semibold text-brand mb-3">📷 Detect Items from Photo</h3>
      <p className="text-sm text-slate-500 mb-3">
        Snap a photo of your fridge or shelf and we'll spot what's there.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={onPick}
        className="mb-3 w-full text-sm"
      />

      {preview && (
        <div className="relative mb-3">
          <img src={preview} alt="preview" className="rounded-xl w-full" />
          {result &&
            result.objects.map((o, i) => (
              <div
                key={i}
                className="absolute border-2 border-red-500"
                style={{
                  top: `${o.yMin / 10}%`,
                  left: `${o.xMin / 10}%`,
                  width: `${(o.xMax - o.xMin) / 10}%`,
                  height: `${(o.yMax - o.yMin) / 10}%`,
                }}
              >
                <span className="absolute -top-5 left-0 bg-red-500 text-white text-xs px-1 rounded">
                  {o.label}
                </span>
              </div>
            ))}
        </div>
      )}

      <button
        onClick={detect}
        disabled={!file || loading}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {loading ? "Detecting..." : "Detect Objects"}
      </button>

      {result && (
        <div className="mt-4 p-3 bg-slate-100 rounded-xl text-sm">
          <p className="italic mb-2">{result.summary}</p>
          <ul className="list-disc pl-5 mb-3">
            {result.objects.map((o, i) => (
              <li key={i}>
                {o.label} — {Math.round(o.confidence * 100)}%
                {o.unit && <span className="text-slate-400"> ({o.unit})</span>}
              </li>
            ))}
          </ul>

          <button
            onClick={addDetectedToPantry}
            disabled={adding || result.objects.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {adding ? "Adding..." : `Add ${result.objects.length} items to Pantry`}
          </button>
          {done && (
            <span className="ml-3 text-sm text-green-600">Added to pantry ✓</span>
          )}
        </div>
      )}
    </div>
  );
}