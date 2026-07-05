import { useState, useMemo, useEffect } from "react";
import { getGroceryList } from "../api/mealPlans";
import { useSearch } from "./layout/AppLayout";
import { matchesSearch, isSearchActive } from "../utils/search";

const USER_ID = 1;

export default function GroceryList({ onSearchResultsChange }) {
  const { searchQuery } = useSearch();
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

  function formatAmount(item) {
    if (item.unit) return `${item.quantity} ${item.unit}`;
    if (item.occurrences > 1) return `x${item.occurrences}`;
    return "";
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!isSearchActive(searchQuery)) return items;
    return items.filter((item) => matchesSearch(searchQuery, item.name, item.unit));
  }, [items, searchQuery]);

  const isSearching = isSearchActive(searchQuery);

  useEffect(() => {
    if (!onSearchResultsChange) return;
    if (!isSearching) {
      onSearchResultsChange(true);
      return;
    }
    onSearchResultsChange(Boolean(items && filteredItems.length > 0));
  }, [isSearching, items, filteredItems.length, onSearchResultsChange]);

  if (isSearching && (!items || filteredItems.length === 0)) {
    return null;
  }

  return (
    <div className="soft-card p-6 sm:p-8">
      <div className="flex justify-between items-center mb-5">
        <h2 className="section-title">{isSearching ? 'Search Results' : 'Grocery List'}</h2>
        {!isSearching && (
        <button
          onClick={generateList}
          disabled={loading}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {loading ? "Generating..." : items ? "Regenerate" : "Generate from plan"}
        </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-medium p-3 rounded-xl mb-5 text-red-600 bg-red-50 border border-red-100">
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
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-slate-500">
          No grocery items match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <>
          {!isSearching && (
          <p className="text-sm text-slate-500 mb-2">
            Aggregated from {totalRecipes} planned meal{totalRecipes !== 1 ? "s" : ""}.
          </p>
          )}
          {isSearching && (
          <p className="text-sm text-brand mb-2">
            {filteredItems.length} grocery item{filteredItems.length !== 1 ? "s" : ""} match &ldquo;{searchQuery.trim()}&rdquo;
          </p>
          )}
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {filteredItems.map((item) => (
              <li
                key={`${item.name}-${item.unit}`}
                className="flex justify-between items-center text-sm px-3 py-2 rounded-xl hover:bg-brand-light cursor-pointer transition-colors"
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
