import { useEffect, useState } from "react";
import { API_BASE, getApiErrorMessage, formatFetchError } from "../utils/apiError";

const API = API_BASE;

export default function PantryScanner({ onAdded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [parsing, setParsing] = useState(false);
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
    setParsedItems([]);
    setDone(false);
    setError("");
  }

  async function parseReceipt() {
    if (!file) return;

    setParsing(true);
    setParsedItems([]);
    setDone(false);
    setError("");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`${API}/api/receipt/parse`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Failed to parse receipt."));
      }

      setParsedItems(
        Array.isArray(data)
          ? data.map((it) => ({ ...it, selected: true }))
          : []
      );
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setParsing(false);
    }
  }

  function toggleItem(index) {
    setParsedItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, selected: !it.selected } : it))
    );
  }

  function updateField(index, field, value) {
    setParsedItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  }

  async function addToPantry() {
    const selected = parsedItems.filter((it) => it.selected);

    if (selected.length === 0) return;

    setAdding(true);
    setError("");

    try {
      const res = await fetch(`${API}/api/pantry/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selected.map(({ name, quantity, unit }) => ({
            name,
            quantity,
            unit,
          }))
        ),
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

  const selectedCount = parsedItems.filter((i) => i.selected).length;

  return (
    <div className="w-full">
      <h3 className="font-semibold text-brand mb-3">🧾 Scan Grocery Receipt</h3>

      <div className="mb-3">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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
        <img
          src={preview}
          alt="Receipt preview"
          className="rounded-xl mb-3 max-h-48 object-contain w-full"
        />
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-line">
          {error}
        </p>
      )}

      <button
        onClick={parseReceipt}
        disabled={!file || parsing}
        className="btn-primary text-sm disabled:opacity-50 mb-3"
      >
        {parsing ? "Reading receipt..." : "Read Receipt"}
      </button>

      {parsedItems.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-slate-500 mb-2">
            Select items to add to your pantry:
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {parsedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(i)}
                  className="accent-brand"
                />

                <span className="flex-1 text-sm capitalize">{item.name}</span>

                <input
                  value={item.quantity ?? ""}
                  onChange={(e) => updateField(i, "quantity", e.target.value)}
                  placeholder="qty"
                  className="w-16 border rounded-lg px-2 py-1 text-sm"
                />

                <input
                  value={item.unit ?? ""}
                  onChange={(e) => updateField(i, "unit", e.target.value)}
                  placeholder="unit"
                  className="w-20 border rounded-lg px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={addToPantry}
            disabled={adding || selectedCount === 0}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {adding ? "Adding..." : `Add ${selectedCount} items to Pantry`}
          </button>

          {done && (
            <span className="ml-3 text-sm text-green-600">Added to pantry ✓</span>
          )}
        </div>
      )}
    </div>
  );
}