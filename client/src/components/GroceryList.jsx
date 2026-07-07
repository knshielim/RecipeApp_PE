import { useState, useMemo, useEffect } from "react";
import { getGroceryList } from "../api/mealPlans";
import { useSearch } from "./layout/AppLayout";
import { matchesSearch, isSearchActive } from "../utils/search";
import { formatWeekLabel } from "../utils/weekUtils";
import { formatFetchError } from "../utils/apiError";

const USER_ID = 1;

function formatQuantity(qty) {
  if (Number.isInteger(qty) || qty % 1 === 0) return String(Math.round(qty));
  return qty.toFixed(1).replace(/\.0$/, "");
}

function formatAmount(item) {
  if (item.unit) return `${formatQuantity(item.quantity)} ${item.unit}`;
  if (item.occurrences > 1) return `×${item.occurrences}`;
  return "as needed";
}

export default function GroceryList({ weekStart, onSearchResultsChange }) {
  const { searchQuery } = useSearch();
  const [items, setItems] = useState(null);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState({});

  async function generateList() {
    setLoading(true);
    setError("");

    try {
      const data = await getGroceryList(USER_ID, weekStart);

      setItems(data.items || []);
      setTotalRecipes(data.totalRecipes || 0);

      if (data.weekStartDate) {
        const [y, m, d] = data.weekStartDate.split("-").map(Number);
        setWeekLabel(formatWeekLabel(new Date(y, m - 1, d)));
      }

      setChecked({});
    } catch (err) {
      setError(formatFetchError(err) || "Failed to generate grocery list.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!isSearchActive(searchQuery)) return items;

    return items.filter((item) => matchesSearch(searchQuery, item.name, item.unit));
  }, [items, searchQuery]);

  const withUnits = filteredItems.filter((i) => i.hasUnit || i.unit);
  const withoutUnits = filteredItems.filter((i) => !i.hasUnit && !i.unit);

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
        <div>
          <h2 className="section-title">{isSearching ? "Search Results" : "Grocery List"}</h2>
          {weekLabel && !isSearching && (
            <p className="text-xs text-slate-400 mt-1">Week of {weekLabel}</p>
          )}
        </div>

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
        <p className="text-sm font-medium p-3 rounded-xl mb-5 text-red-600 bg-red-50 border border-red-100 whitespace-pre-line">
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
            <p className="text-sm text-slate-500 mb-4">
              Aggregated from {totalRecipes} planned meal{totalRecipes !== 1 ? "s" : ""}.
              {withUnits.length > 0 &&
                ` ${withUnits.length} item${withUnits.length !== 1 ? "s" : ""} with quantities.`}
            </p>
          )}

          {withUnits.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Measured items
              </h3>

              <ul className="space-y-1">
                {withUnits.map((item) => {
                  const key = `${item.name}-${item.unit}`;

                  return (
                    <li
                      key={key}
                      className="flex justify-between items-center text-sm px-3 py-2.5 rounded-xl hover:bg-brand-light cursor-pointer transition-colors border border-slate-100"
                      onClick={() => toggleItem(key)}
                    >
                      <span className={`capitalize font-medium ${checked[key] ? "line-through text-slate-300" : "text-slate-700"}`}>
                        {item.name}
                      </span>
                      <span className="text-brand font-semibold tabular-nums">{formatAmount(item)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {withoutUnits.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Pantry staples
              </h3>

              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {withoutUnits.map((item) => {
                  const key = item.name;

                  return (
                    <li
                      key={key}
                      className="flex justify-between items-center text-sm px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleItem(key)}
                    >
                      <span className={`capitalize ${checked[key] ? "line-through text-slate-300" : "text-slate-700"}`}>
                        {item.name}
                      </span>
                      <span className="text-slate-400 text-xs">{formatAmount(item)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}