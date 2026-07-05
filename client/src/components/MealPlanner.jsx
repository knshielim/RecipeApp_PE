import { useState, useEffect, useMemo } from "react";
import {
  getMealPlans,
  getRecipes,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  autoGenerateWeek,
} from "../api/mealPlans";
import GroceryList from "./GroceryList";
import { useSearch } from "./layout/AppLayout";
import { matchesSearch, isSearchActive } from "../utils/search";

const USER_ID = 1;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["breakfast", "lunch", "dinner"];

export default function MealPlanner() {
  const { searchQuery } = useSearch();
  const [plans, setPlans] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // form state: null = closed, otherwise { day, mealSlot, planId (null = create), recipeId }
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // auto-generate state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [searchHasGroceryResults, setSearchHasGroceryResults] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [planData, recipeData] = await Promise.all([
        getMealPlans(USER_ID),
        getRecipes(USER_ID),
      ]);
      setPlans(planData);
      setRecipes(recipeData);
    } catch {
      setPlans([]);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }

  function findPlan(day, slot) {
    return plans.find((p) => p.day === day && p.mealSlot === slot);
  }

  function planMatchesSearch(plan) {
    if (!searchQuery.trim()) return true;
    return matchesSearch(
      searchQuery,
      plan.recipeTitle,
      plan.recipeCategory,
      plan.day,
      plan.mealSlot
    );
  }

  const matchingPlanCount = useMemo(() => {
    if (!isSearchActive(searchQuery)) return plans.length;
    return plans.filter(planMatchesSearch).length;
  }, [plans, searchQuery]);

  const matchingPlans = useMemo(() => {
    if (!isSearchActive(searchQuery)) return plans;
    return plans.filter(planMatchesSearch);
  }, [plans, searchQuery]);

  const isSearching = isSearchActive(searchQuery);
  const showPlannerSection = !isSearching || matchingPlans.length > 0;

  function openForm(day, slot) {
    const existing = findPlan(day, slot);
    setFormError("");
    setForm({
      day,
      mealSlot: slot,
      planId: existing ? existing.id : null,
      recipeId: existing ? String(existing.recipeId) : "",
    });
  }

  function closeForm() {
    setForm(null);
    setFormError("");
  }

  // ---- form validation ----
  function validateForm() {
    if (!form.day || !DAYS.includes(form.day)) return "Please choose a valid day.";
    if (!form.mealSlot || !SLOTS.includes(form.mealSlot)) return "Please choose a valid meal slot.";
    if (!form.recipeId) return "Please choose a recipe.";

    // duplicate slot check (only for a slot other than the one being edited)
    const occupied = findPlan(form.day, form.mealSlot);
    if (occupied && occupied.id !== form.planId)
      return `${form.day} ${form.mealSlot} already has a meal planned.`;

    return "";
  }

  async function handleSave() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        userId: USER_ID,
        day: form.day,
        mealSlot: form.mealSlot,
        recipeId: Number(form.recipeId),
      };
      if (form.planId) {
        await updateMealPlan(form.planId, payload);
      } else {
        await createMealPlan(payload);
      }
      closeForm();
      await fetchData();
    } catch (err) {
      setFormError(err.message || "Failed to save meal plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.planId) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteMealPlan(form.planId);
      closeForm();
      await fetchData();
    } catch (err) {
      setFormError(err.message || "Failed to delete meal plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoGenerate() {
    setConfirmGenerate(false);
    setGenerating(true);
    setGenerateError("");
    try {
      await autoGenerateWeek(USER_ID);
      await fetchData();
    } catch (err) {
      setGenerateError(err.message || "Failed to generate the weekly plan.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your meal planner...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {!isSearching && (
      <div>
        <h1 className="section-title text-2xl">Weekly Meal Planner</h1>
        <p className="text-slate-500 text-sm mt-1">
          Assign your saved recipes to each day of the week, then generate your grocery list.
        </p>
      </div>
      )}

      {!isSearching && recipes.length === 0 && (
        <div className="soft-card p-8">
          <p className="text-sm text-slate-500">
            You have no saved recipes yet. Add some recipes first to start planning meals.
          </p>
        </div>
      )}

      {showPlannerSection && (
      /* Weekly grid */
      <div className="soft-card p-6 sm:p-8 overflow-x-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="section-title">{isSearching ? 'Search Results' : 'This Week'}</h2>
          {!isSearching && (
          <button
            onClick={() => setConfirmGenerate(true)}
            disabled={generating || recipes.length === 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {generating ? "Generating..." : "Auto-generate week"}
          </button>
          )}
        </div>

        {isSearching && (
          <p className="text-sm text-brand mb-5">
            {matchingPlanCount} planned meal{matchingPlanCount !== 1 ? "s" : ""} match &ldquo;{searchQuery.trim()}&rdquo;
          </p>
        )}

          {!isSearching && generateError && (
            <p className="text-sm font-medium p-3 rounded-lg mb-5 text-red-600 bg-red-50 border border-red-100">
              {generateError}
            </p>
          )}

          {isSearching ? (
            matchingPlans.length > 0 ? (
              <div className="space-y-3">
                {matchingPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => openForm(plan.day, plan.mealSlot)}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-brand-light border border-brand/10 text-slate-700 hover:bg-brand/10 transition-colors"
                  >
                    <span className="block font-semibold">{plan.recipeTitle}</span>
                    <span className="block text-xs text-slate-500 capitalize">
                      {plan.day} · {plan.mealSlot}
                      {plan.recipeCategory ? ` · ${plan.recipeCategory}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                No planned meals match &ldquo;{searchQuery.trim()}&rdquo;.
              </p>
            )
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-slate-500 font-medium px-2 py-1 w-24"></th>
                {SLOTS.map((slot) => (
                  <th key={slot} className="text-left text-slate-500 font-medium px-2 py-1 capitalize">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-700">{day}</td>
                  {SLOTS.map((slot) => {
                    const plan = findPlan(day, slot);
                    return (
                      <td key={slot} className="px-2 py-2">
                        {plan ? (
                          <button
                            onClick={() => openForm(day, slot)}
                            className="w-full text-left px-4 py-3 rounded-2xl bg-brand-light border border-brand/10 text-slate-700 hover:bg-brand/10 transition-colors"
                          >
                            <span className="block font-semibold">{plan.recipeTitle}</span>
                            <span className="block text-xs text-slate-500">{plan.recipeCategory}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openForm(day, slot)}
                            disabled={recipes.length === 0}
                            className="w-full px-4 py-3 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
                          >
                            + Add
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {isSearching && matchingPlans.length === 0 && !searchHasGroceryResults && (
        <div className="soft-card p-10 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-600">No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
          <p className="text-sm mt-1">Try a recipe name, day, meal slot, or grocery item.</p>
        </div>
      )}

      {/* Grocery list */}
      <GroceryList onSearchResultsChange={setSearchHasGroceryResults} />

      {/* Auto-generate confirmation */}
      {confirmGenerate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="soft-card p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Auto-generate week</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will replace your current weekly plan with one generated from your saved
              recipes and dietary preferences. You can still edit any slot afterwards.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAutoGenerate}
                className="flex-1 btn-primary text-sm"
              >
                Generate
              </button>
              <button
                onClick={() => setConfirmGenerate(false)}
                className="bg-slate-100 text-slate-700 px-5 py-2 rounded-full hover:bg-slate-200 transition-colors font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="soft-card p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-5">
              {form.planId ? "Edit meal" : "Add meal"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Day</label>
                <select
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  className="input-field w-full"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meal slot</label>
                <select
                  value={form.mealSlot}
                  onChange={(e) => setForm({ ...form, mealSlot: e.target.value })}
                  className="input-field w-full capitalize"
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipe</label>
                <select
                  value={form.recipeId}
                  onChange={(e) => setForm({ ...form, recipeId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">Choose a recipe</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <p className="text-sm font-medium p-3 rounded-lg mt-4 text-red-600 bg-red-50 border border-red-100">
                {formError}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 btn-primary text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {form.planId && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="bg-red-500 text-white px-5 py-2 rounded-full hover:bg-red-600 transition-colors font-semibold text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <button
                onClick={closeForm}
                disabled={saving}
                className="bg-slate-100 text-slate-700 px-5 py-2 rounded-full hover:bg-slate-200 transition-colors font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
