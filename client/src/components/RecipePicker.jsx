import { useState, useEffect } from "react";
import { API_BASE, parseApiResponse, formatFetchError } from "../utils/apiError";

const API = API_BASE;

export default function RecipePicker({ token, onSelect, onClose }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API}/api/mealplans/recipes`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseApiResponse(res, "Couldn't load your recipes.");

        if (!cancelled) {
          setRecipes(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatFetchError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="border rounded-xl p-3 bg-slate-50 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">Pick a saved recipe</span>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">
          ✕ Close
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading your recipes…</p>}

      {error && (
        <p className="text-sm text-red-500 whitespace-pre-line">
          {error}
        </p>
      )}

      {!loading && !error && recipes.length === 0 && (
        <p className="text-sm text-slate-500">You don't have any saved recipes yet.</p>
      )}

      {!loading && !error && recipes.length > 0 && (
        <div className="max-h-64 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="flex flex-col items-center gap-1 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow p-2 transition text-center"
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-200 flex items-center justify-center">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🍽️</span>
                )}
              </div>
              <span className="text-xs text-slate-700 leading-tight line-clamp-2">{r.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}