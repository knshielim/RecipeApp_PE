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

export async function generateGroceryList(userId, weekStart) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list/generate${params}`, {
    method: "POST",
  });

  return handleResponse(res, "Failed to generate grocery list.");
}

export async function addGroceryItem(userId, weekStart, { name, quantity, unit }) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list/items${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, quantity: quantity || 0, unit: unit || "" }),
  });

  return handleResponse(res, "Failed to add grocery item.");
}

export async function updateGroceryItem(userId, itemId, changes) {
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });

  return handleResponse(res, "Failed to update grocery item.");
}

export async function deleteGroceryItem(userId, itemId) {
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list/items/${itemId}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete grocery item.");
}

export async function uncheckAllGroceryItems(userId, weekStart) {
  const params = buildWeekStartParam(weekStart);
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list/uncheck-all${params}`, {
    method: "POST",
  });

  return handleResponse(res, "Failed to reset checked items.");
}

async function handleResponse(res, fallback = "Request failed.") {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data;
}