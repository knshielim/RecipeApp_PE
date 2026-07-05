import { useState, useEffect } from "react";
import {
  getMealPlans,
  getRecipes,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  autoGenerateWeek,
} from "../api/mealPlans";
import GroceryList from "./GroceryList";

const USER_ID = 1;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["breakfast", "lunch", "dinner"];

export default function MealPlanner() {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading your meal planner...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero section */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-2">Weekly Meal Planner</h1>
          <p className="text-green-100 text-lg">
            Assign your saved recipes to each day of the week, then generate your grocery list.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {recipes.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-100">
            <p className="text-sm text-slate-500">
              You have no saved recipes yet. Add some recipes first to start planning meals.
            </p>
          </div>
        )}

        {/* Weekly grid */}
        <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-100 overflow-x-auto">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold text-slate-800">This Week</h2>
            <button
              onClick={() => setConfirmGenerate(true)}
              disabled={generating || recipes.length === 0}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm disabled:opacity-50"
            >
              {generating ? "Generating..." : "Auto-generate week"}
            </button>
          </div>

          {generateError && (
            <p className="text-sm font-medium p-3 rounded-lg mb-5 text-red-600 bg-red-50 border border-red-100">
              {generateError}
            </p>
          )}

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
                            className="w-full text-left px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-slate-700 hover:bg-green-100 transition-colors"
                          >
                            <span className="block font-semibold">{plan.recipeTitle}</span>
                            <span className="block text-xs text-slate-500">{plan.recipeCategory}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openForm(day, slot)}
                            disabled={recipes.length === 0}
                            className="w-full px-4 py-3 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-green-600 hover:text-green-600 transition-colors disabled:opacity-50"
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
        </div>

        {/* Grocery list */}
        <GroceryList />
      </div>

      {/* Auto-generate confirmation */}
      {confirmGenerate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Auto-generate week</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will replace your current weekly plan with one generated from your saved
              recipes and dietary preferences. You can still edit any slot afterwards.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAutoGenerate}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm"
              >
                Generate
              </button>
              <button
                onClick={() => setConfirmGenerate(false)}
                className="bg-slate-100 text-slate-700 px-5 py-2 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-5">
              {form.planId ? "Edit meal" : "Add meal"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Day</label>
                <select
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white"
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
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white capitalize"
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
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white"
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
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {form.planId && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <button
                onClick={closeForm}
                disabled={saving}
                className="bg-slate-100 text-slate-700 px-5 py-2 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
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
