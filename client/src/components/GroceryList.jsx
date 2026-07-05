import { useState } from "react";
import { getGroceryList } from "../api/mealPlans";

const USER_ID = 1;

export default function GroceryList() {
  const [items, setItems] = useState(null);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState({});

  async function generateList() {
    setLoading(true);
    setError("");
    try {
      const data = await getGroceryList(USER_ID);
      setItems(data.items);
      setTotalRecipes(data.totalRecipes);
      setChecked({});
    } catch (err) {
      setError(err.message || "Failed to generate grocery list.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(name) {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  // "200 g rice" style entries show summed quantity + unit;
  // plain entries show an occurrence count when mentioned more than once.
  function formatAmount(item) {
    if (item.unit) return `${item.quantity} ${item.unit}`;
    if (item.occurrences > 1) return `x${item.occurrences}`;
    return "";
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-100">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold text-slate-800">Grocery List</h2>
        <button
          onClick={generateList}
          disabled={loading}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm disabled:opacity-50"
        >
          {loading ? "Generating..." : items ? "Regenerate" : "Generate from plan"}
        </button>
      </div>

      {error && (
        <p className="text-sm font-medium p-3 rounded-lg mb-5 text-red-600 bg-red-50 border border-red-100">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-slate-500">
          Generate a shopping list from all the recipes in your weekly plan.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Your meal plan is empty. Assign some recipes first.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-2">
            Aggregated from {totalRecipes} planned meal{totalRecipes !== 1 ? "s" : ""}.
          </p>
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <li
                key={`${item.name}-${item.unit}`}
                className="flex justify-between items-center text-sm px-2 py-1 rounded-lg hover:bg-green-50 cursor-pointer transition-colors"
                onClick={() => toggleItem(item.name)}
              >
                <span className={`capitalize ${checked[item.name] ? "line-through text-slate-300" : "text-slate-700"}`}>
                  {item.name}
                </span>
                <span className="text-slate-500">{formatAmount(item)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
