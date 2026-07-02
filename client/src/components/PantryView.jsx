import { useState, useEffect } from "react";

const API = "http://localhost:5237";

export default function PantryView() {
  const [pantry, setPantry] = useState([]);
  const [loadingPantry, setLoadingPantry] = useState(true);

  // "What can I make" state
  const [makeSuggestions, setMakeSuggestions] = useState("");
  const [loadingMake, setLoadingMake] = useState(false);

  // "Missing ingredients" state
  const [mealInput, setMealInput] = useState("");
  const [missingResult, setMissingResult] = useState("");
  const [loadingMissing, setLoadingMissing] = useState(false);

  useEffect(() => {
    fetchPantry();
  }, []);

  async function fetchPantry() {
    setLoadingPantry(true);
    try {
      const res = await fetch(`${API}/api/pantry`);
      const data = await res.json();
      setPantry(data);
    } catch {
      setPantry([]);
    } finally {
      setLoadingPantry(false);
    }
  }

  async function removeItem(id) {
    try {
      await fetch(`${API}/api/pantry/${id}`, { method: "DELETE" });
      setPantry((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert("Failed to remove item");
    }
  }

  async function whatCanIMake() {
    setLoadingMake(true);
    setMakeSuggestions("");
    try {
      const res = await fetch(`${API}/api/ai/what-can-i-make`, { method: "POST" });
      const data = await res.json();
      setMakeSuggestions(data.reply || data.detail || "No suggestions available.");
    } catch (err) {
      setMakeSuggestions("Something went wrong — please try again.");
    } finally {
      setLoadingMake(false);
    }
  }

  async function checkMissingIngredients() {
    if (!mealInput.trim()) return;
    setLoadingMissing(true);
    setMissingResult("");
    try {
      const res = await fetch(`${API}/api/ai/missing-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal: mealInput }),
      });
      const data = await res.json();
      setMissingResult(data.reply || data.detail || "No result.");
    } catch (err) {
      setMissingResult("Something went wrong — please try again.");
    } finally {
      setLoadingMissing(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-4">

      {/* Pantry list */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-[#203966]">🥦 My Pantry</h2>
          <button
            onClick={fetchPantry}
            className="text-sm text-slate-500 hover:text-[#203966]"
          >
            Refresh
          </button>
        </div>

        {loadingPantry ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : pantry.length === 0 ? (
          <p className="text-sm text-slate-400">
            Your pantry is empty — scan a receipt to add items.
          </p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {pantry.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center text-sm px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <span className="capitalize">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{item.quantity}</span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={whatCanIMake}
          disabled={loadingMake || pantry.length === 0}
          className="mt-3 w-full bg-[#203966] text-white py-2 rounded-xl disabled:opacity-50 text-sm"
        >
          {loadingMake ? "Thinking..." : "🍳 What can I make with this?"}
        </button>

        {makeSuggestions && (
          <div className="mt-3 p-3 bg-slate-100 rounded-xl text-sm whitespace-pre-wrap">
            {makeSuggestions}
          </div>
        )}
      </div>

      {/* Missing ingredients checker */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-bold text-[#203966] mb-3">
          🔍 Do I have enough for a meal?
        </h2>
        <p className="text-sm text-slate-500 mb-2">
          Enter a meal name and the AI will check your pantry for what's missing.
        </p>
        <div className="flex gap-2">
          <input
            value={mealInput}
            onChange={(e) => setMealInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkMissingIngredients()}
            placeholder="e.g. spaghetti carbonara"
            className="flex-1 border rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={checkMissingIngredients}
            disabled={!mealInput.trim() || loadingMissing}
            className="bg-[#203966] text-white px-4 rounded-xl disabled:opacity-50 text-sm"
          >
            {loadingMissing ? "Checking..." : "Check"}
          </button>
        </div>

        {missingResult && (
          <div className="mt-3 p-3 bg-slate-100 rounded-xl text-sm whitespace-pre-wrap">
            {missingResult}
          </div>
        )}
      </div>
    </div>
  );
}
