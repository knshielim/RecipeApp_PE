import { useEffect, useState } from "react";
import { API_BASE, getApiErrorMessage, formatFetchError } from "../utils/apiError";

const API = API_BASE;

export default function PantryObjectDetector({ onAdded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function onPick(e) {
    const f = e.target.files?.[0];

    if (!f) return;

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setDone(false);
    setError("");
  }

  async function detect() {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setDone(false);
    setError("");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API}/api/detect`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to detect objects."));
      }

      setResult(data);
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  async function addDetectedToPantry() {
    if (!result?.objects?.length) return;

    setAdding(true);
    setError("");

    try {
      const items = result.objects.map((o) => ({
        name: o.label,
        quantity: "1",
        unit: o.unit || "",
      }));

      const res = await fetch(`${API}/api/pantry/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to add items to pantry."));
      }

      setDone(true);
      onAdded?.();
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="w-full">
      <h3 className="font-semibold text-brand mb-3">📷 Detect Items from Photo</h3>
      <p className="text-sm text-slate-500 mb-3">
        Snap a photo of your fridge or shelf and we'll spot what's there.
      </p>

      <div className="mb-3">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-slate-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-400">PNG, JPG, GIF (MAX. 10MB)</p>
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />
        </label>
      </div>

      {preview && (
        <div className="relative mb-3">
          <img src={preview} alt="preview" className="rounded-xl w-full" />

          {result?.objects?.map((o, i) => (
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-line">
          {error}
        </p>
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