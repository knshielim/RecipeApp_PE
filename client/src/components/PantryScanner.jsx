import { useState } from "react";

const API = "http://localhost:5237";

export default function PantryScanner({ onAdded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  function onPick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setParsedItems([]);
    setDone(false);
  }

  async function parseReceipt() {
    if (!file) return;
    setParsing(true);
    setParsedItems([]);
    setDone(false);

    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${API}/api/receipt/parse`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Failed to parse receipt");
      const items = await res.json();
      setParsedItems(items.map((it) => ({ ...it, selected: true })));
    } catch (err) {
      alert(`Error: ${err.message}`);
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

    try {
      const res = await fetch(`${API}/api/pantry/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected.map(({ name, quantity, unit }) => ({ name, quantity, unit }))),
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
      <h3 className="font-semibold text-brand mb-3">🧾 Scan Grocery Receipt</h3>

      <input
        type="file"
        accept="image/*"
        onChange={onPick}
        className="mb-3 w-full text-sm"
      />

      {preview && (
        <img
          src={preview}
          alt="Receipt preview"
          className="rounded-xl mb-3 max-h-48 object-contain w-full"
        />
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
            disabled={adding || parsedItems.filter((i) => i.selected).length === 0}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {adding ? "Adding..." : `Add ${parsedItems.filter((i) => i.selected).length} items to Pantry`}
          </button>
          {done && (
            <span className="ml-3 text-sm text-green-600">Added to pantry ✓</span>
          )}
        </div>
      )}
    </div>
  );
}