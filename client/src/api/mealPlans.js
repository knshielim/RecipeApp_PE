import { API_BASE, getApiErrorMessage } from "../utils/apiError";

const API = API_BASE;

function buildWeekStartParam(weekStart) {
  return weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function jsonAuthHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ---------- Meal Planner ----------

export async function getMealPlans(token, weekStart) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans${params}`, {
    headers: authHeaders(token),
  });

  return handleResponse(res, "Could not load meal plans.");
}

export async function getRecipes(token) {
  const res = await fetch(`${API}/api/mealplans/recipes`, {
    headers: authHeaders(token),
  });

  return handleResponse(res, "Could not load recipes.");
}

export async function createMealPlan(token, { weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans`, {
    method: "POST",
    headers: jsonAuthHeaders(token),
    body: JSON.stringify({
      weekStartDate,
      day,
      mealSlot,
      recipeId,
    }),
  });

  return handleResponse(res, "Failed to create meal plan.");
}

export async function updateMealPlan(token, id, { weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "PUT",
    headers: jsonAuthHeaders(token),
    body: JSON.stringify({
      weekStartDate,
      day,
      mealSlot,
      recipeId,
    }),
  });

  return handleResponse(res, "Failed to update meal plan.");
}

export async function deleteMealPlan(token, id) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  return handleResponse(res, "Failed to delete meal plan.");
}

export async function autoGenerateWeek(token, weekStart) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans/auto-generate${params}`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return handleResponse(res, "Failed to generate the weekly plan.");
}

// ---------- Grocery List ----------

export async function getGroceryList(token, weekStart) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans/grocery-list${params}`, {
    headers: authHeaders(token),
  });

  return handleResponse(res, "Could not load grocery list.");
}

export async function generateGroceryList(token, weekStart) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans/grocery-list/generate${params}`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return handleResponse(res, "Failed to generate grocery list.");
}

export async function addGroceryItem(token, weekStart, { name, quantity, unit }) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans/grocery-list/items${params}`, {
    method: "POST",
    headers: jsonAuthHeaders(token),
    body: JSON.stringify({
      name,
      quantity: quantity || 0,
      unit: unit || "",
    }),
  });

  return handleResponse(res, "Failed to add grocery item.");
}

export async function updateGroceryItem(token, itemId, changes) {
  const res = await fetch(`${API}/api/mealplans/grocery-list/items/${itemId}`, {
    method: "PATCH",
    headers: jsonAuthHeaders(token),
    body: JSON.stringify(changes),
  });

  return handleResponse(res, "Failed to update grocery item.");
}

export async function deleteGroceryItem(token, itemId) {
  const res = await fetch(`${API}/api/mealplans/grocery-list/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  return handleResponse(res, "Failed to delete grocery item.");
}

export async function uncheckAllGroceryItems(token, weekStart) {
  const params = buildWeekStartParam(weekStart);

  const res = await fetch(`${API}/api/mealplans/grocery-list/uncheck-all${params}`, {
    method: "POST",
    headers: authHeaders(token),
  });

  return handleResponse(res, "Failed to reset checked items.");
}

// ---------- Response Handler ----------

async function handleResponse(res, fallback = "Request failed.") {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data;
}