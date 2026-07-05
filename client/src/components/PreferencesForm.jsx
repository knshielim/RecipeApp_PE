import { useState, useEffect } from "react";

const API = "http://localhost:5237";
const USER_ID = 1;

const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Soy",
  "Wheat",
  "Sesame",
];

export default function PreferencesForm() {
  const [goal, setGoal] = useState("maintain");
  const [dietType, setDietType] = useState("none");
  const [allergies, setAllergies] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch(`${API}/api/ai/preferences/${USER_ID}`);
        const data = await res.json();
        setGoal(data.goal);
        setDietType(data.dietType);
        setAllergies(data.allergies || "");
      } catch {
        // No saved preferences yet
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  async function handleSave() {
    setStatus("Saving...");
    try {
      const res = await fetch(`${API}/api/ai/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, goal, dietType, allergies }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStatus("Saved!");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Failed to save. Try again.");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading preferences...</p>;
  }

  return (
    <div className="soft-card p-5">
      <h2 className="section-title mb-4">Your Preferences</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Goal</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="input-field w-full text-sm"
          >
            <option value="cutting">Cutting</option>
            <option value="bulking">Bulking</option>
            <option value="maintain">Maintain</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Diet Type</label>
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="input-field w-full text-sm"
          >
            <option value="none">No Restriction</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="halal">Halal</option>
            <option value="keto">Keto</option>
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-semibold text-slate-600 mb-2">Allergies</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {ALLERGY_OPTIONS.map((allergy) => (
            <label key={allergy} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allergies.split(",").includes(allergy)}
                onChange={(e) => {
                  const selected = allergies ? allergies.split(",").filter(Boolean) : [];
                  if (e.target.checked) selected.push(allergy);
                  else {
                    const index = selected.indexOf(allergy);
                    if (index > -1) selected.splice(index, 1);
                  }
                  setAllergies(selected.join(","));
                }}
                className="accent-brand rounded"
              />
              {allergy}
            </label>
          ))}
        </div>
        {allergies && (
          <p className="text-xs text-slate-500 mt-3">
            <strong>Selected:</strong> {allergies}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary text-sm">
          Save Preferences
        </button>
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>
    </div>
  );
}
