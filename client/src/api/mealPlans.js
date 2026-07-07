import { API_BASE, getApiErrorMessage } from "../utils/apiError";

const API = API_BASE;

function buildWeekStartParam(weekStart) {
  return weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
}

export async function getMealPlans(userId, weekStart) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}${params}`);

  return handleResponse(res, "Could not load meal plans.");
}

export async function getRecipes(userId) {
  const res = await fetch(`${API}/api/mealplans/recipes/${userId}`);

  return handleResponse(res, "Could not load recipes.");
}

export async function createMealPlan({ userId, weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      weekStartDate,
      day,
      mealSlot,
      recipeId,
    }),
  });

  return handleResponse(res, "Failed to create meal plan.");
}

export async function updateMealPlan(id, { userId, weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      weekStartDate,
      day,
      mealSlot,
      recipeId,
    }),
  });

  return handleResponse(res, "Failed to update meal plan.");
}

export async function deleteMealPlan(id) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete meal plan.");
}

export async function autoGenerateWeek(userId, weekStart) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}/auto-generate${params}`, {
    method: "POST",
  });

  return handleResponse(res, "Failed to generate the weekly plan.");
}

export async function getGroceryList(userId, weekStart) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list${params}`);

  return handleResponse(res, "Could not load grocery list.");
}

async function handleResponse(res, fallback = "Request failed.") {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data;
}