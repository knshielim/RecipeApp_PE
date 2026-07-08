import { useState, useMemo, useEffect, useCallback } from "react";
import {
  getGroceryList,
  generateGroceryList,
  addGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  uncheckAllGroceryItems,
} from "../api/mealPlans";
import { useSearch } from "./layout/AppLayout";
import { matchesSearch, isSearchActive } from "../utils/search";
import { formatWeekLabel } from "../utils/weekUtils";
import { formatFetchError } from "../utils/apiError";

const USER_ID = 1;

function formatQuantity(qty) {
  if (Number.isInteger(qty) || qty % 1 === 0) return String(Math.round(qty));
  return qty.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function formatAmount(item) {
  if (item.unit) return `${formatQuantity(item.quantity)} ${item.unit}`;
  if (item.quantity > 0 && item.quantity !== item.occurrences) return formatQuantity(item.quantity);
  if (item.occurrences > 0) return `×${item.occurrences}`;
  return "—";
}

const EMPTY_NEW_ITEM = { name: "", quantity: "", unit: "" };

export default function GroceryList({ weekStart, onSearchResultsChange }) {
  const { searchQuery } = useSearch();
  const [items, setItems] = useState(null);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newItem, setNewItem] = useState(EMPTY_NEW_ITEM);
  const [addingItem, setAddingItem] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: "", unit: "" });
  const [showDone, setShowDone] = useState(true);

  const applyResponse = useCallback((data) => {
    setItems(data.items ?? null);
    setTotalRecipes(data.totalRecipes || 0);

    if (data.weekStartDate) {
      const [y, m, d] = data.weekStartDate.split("-").map(Number);
      setWeekLabel(formatWeekLabel(new Date(y, m - 1, d)));
    }
  }, []);

  // Load the saved list whenever the selected week changes.
  useEffect(() => {
    let cancelled = false;

    setInitialLoading(true);
    setError("");

    getGroceryList(USER_ID, weekStart)
      .then((data) => {
        if (!cancelled) applyResponse(data);
      })
      .catch((err) => {
        if (!cancelled) setError(formatFetchError(err) || "Could not load grocery list.");
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart, applyResponse]);

  async function generateList() {
    setLoading(true);
    setError("");

    try {
      const data = await generateGroceryList(USER_ID, weekStart);
      applyResponse(data);
    } catch (err) {
      setError(formatFetchError(err) || "Failed to generate grocery list.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(item) {
    const nextChecked = !item.isChecked;

    // Optimistic update; roll back if the save fails.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isChecked: nextChecked } : i)));

    try {
      await updateGroceryItem(USER_ID, item.id, { isChecked: nextChecked });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isChecked: item.isChecked } : i)));
      setError(formatFetchError(err) || "Failed to save item.");
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();

    const name = newItem.name.trim();
    if (!name) return;

    setAddingItem(true);
    setError("");

    try {
      const created = await addGroceryItem(USER_ID, weekStart, {
        name,
        quantity: Number(newItem.quantity) || 0,
        unit: newItem.unit.trim(),
      });

      setItems((prev) =>
        [...(prev || []), created].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        )
      );
      setNewItem(EMPTY_NEW_ITEM);
    } catch (err) {
      setError(formatFetchError(err) || "Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteItem(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      await deleteGroceryItem(USER_ID, item.id);
    } catch (err) {
      setItems((prev) =>
        [...prev, item].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        )
      );
      setError(formatFetchError(err) || "Failed to delete item.");
    }
  }

  function startEditItem(item) {
    setEditItemId(item.id);
    setEditForm({
      quantity: item.quantity > 0 ? String(item.quantity) : "",
      unit: item.unit || "",
    });
  }

  async function saveEditItem(item) {
    const changes = {
      quantity: Number(editForm.quantity) || 0,
      unit: editForm.unit.trim(),
    };

    setEditItemId(null);

    try {
      const updated = await updateGroceryItem(USER_ID, item.id, changes);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      setError(formatFetchError(err) || "Failed to update item.");
    }
  }

  async function handleUncheckAll() {
    setItems((prev) => prev.map((i) => ({ ...i, isChecked: false })));

    try {
      await uncheckAllGroceryItems(USER_ID, weekStart);
    } catch (err) {
      setError(formatFetchError(err) || "Failed to reset checked items.");
    }
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!isSearchActive(searchQuery)) return items;

    return items.filter((item) => matchesSearch(searchQuery, item.name, item.unit));
  }, [items, searchQuery]);

  const toBuy = filteredItems.filter((i) => !i.isChecked);
  const done = filteredItems.filter((i) => i.isChecked);

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

  const renderRow = (item) => (
    <li
      key={item.id}
      className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-xl hover:bg-brand-light transition-colors border border-slate-100 group"
    >
      <button
        type="button"
        onClick={() => toggleItem(item)}
        aria-label={item.isChecked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
        className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
          item.isChecked
            ? "bg-brand border-brand text-white"
            : "border-slate-300 hover:border-brand"
        }`}
      >
        {item.isChecked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span
        className={`capitalize font-medium flex-1 min-w-0 truncate cursor-pointer ${
          item.isChecked ? "line-through text-slate-300" : "text-slate-700"
        }`}
        onClick={() => toggleItem(item)}
      >
        {item.name}
        {item.isCustom && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-300 no-underline">added</span>
        )}
      </span>

      {editItemId === item.id ? (
        <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            min="0"
            step="any"
            value={editForm.quantity}
            onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && saveEditItem(item)}
            className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand"
            placeholder="qty"
            autoFocus
          />
          <input
            type="text"
            value={editForm.unit}
            onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && saveEditItem(item)}
            className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand"
            placeholder="unit"
          />
          <button
            type="button"
            onClick={() => saveEditItem(item)}
            className="text-brand font-semibold text-xs px-1.5"
          >
            Save
          </button>
        </span>
      ) : (
        <span
          className="text-brand font-semibold tabular-nums text-right cursor-pointer"
          title={
            item.occurrences > 0
              ? `Used in ${item.occurrences} planned meal${item.occurrences !== 1 ? "s" : ""}. Click to edit.`
              : "Click to edit amount."
          }
          onClick={() => startEditItem(item)}
        >
          {formatAmount(item)}
        </span>
      )}

      <button
        type="button"
        onClick={() => handleDeleteItem(item)}
        aria-label={`Remove ${item.name}`}
        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );

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

      {initialLoading ? (
        <p className="text-sm text-slate-400">Loading your list...</p>
      ) : items === null ? (
        <p className="text-sm text-slate-500">
          Generate a shopping list from all the recipes in your weekly plan.
          {totalRecipes === 0 && " Your meal plan for this week is empty — assign some recipes first."}
        </p>
      ) : filteredItems.length === 0 && items.length > 0 ? (
        <p className="text-sm text-slate-500">
          No grocery items match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Your meal plan is empty. Assign some recipes first, or add items below.
        </p>
      ) : (
        <>
          {!isSearching && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                Aggregated from {totalRecipes} planned meal{totalRecipes !== 1 ? "s" : ""}.
              </p>
              <p className="text-sm font-semibold text-slate-600 tabular-nums">
                {done.length} of {filteredItems.length} bought
              </p>
            </div>
          )}

          {toBuy.length > 0 && (
            <ul className="space-y-1 mb-5">{toBuy.map(renderRow)}</ul>
          )}

          {toBuy.length === 0 && done.length > 0 && !isSearching && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-5">
              All done — everything on your list is bought! 🎉
            </p>
          )}

          {done.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setShowDone((s) => !s)}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`w-3 h-3 transition-transform ${showDone ? "rotate-90" : ""}`}
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Bought ({done.length})
                </button>

                <button
                  type="button"
                  onClick={handleUncheckAll}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Uncheck all
                </button>
              </div>

              {showDone && <ul className="space-y-1">{done.map(renderRow)}</ul>}
            </div>
          )}
        </>
      )}

      {!isSearching && !initialLoading && items !== null && (
        <form onSubmit={handleAddItem} className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <input
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem((f) => ({ ...f, name: e.target.value }))}
            placeholder="Add your own item (e.g. paper towels)"
            className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
          />
          <input
            type="number"
            min="0"
            step="any"
            value={newItem.quantity}
            onChange={(e) => setNewItem((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="qty"
            className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-brand"
          />
          <input
            type="text"
            value={newItem.unit}
            onChange={(e) => setNewItem((f) => ({ ...f, unit: e.target.value }))}
            placeholder="unit"
            className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={addingItem || !newItem.name.trim()}
            className="btn-primary text-sm disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
