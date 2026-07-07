const API = "http://localhost:5237";

export async function getMealPlans(userId, weekStart) {
  const params = weekStart ? `?weekStart=${weekStart}` : "";
  const res = await fetch(`${API}/api/mealplans/${userId}${params}`);
  return handleResponse(res);
}

export async function getRecipes(userId) {
  const res = await fetch(`${API}/api/mealplans/recipes/${userId}`);
  return handleResponse(res);
}

export async function createMealPlan({ userId, weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, weekStartDate, day, mealSlot, recipeId }),
  });
  return handleResponse(res);
}

export async function updateMealPlan(id, { userId, weekStartDate, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, weekStartDate, day, mealSlot, recipeId }),
  });
  return handleResponse(res);
}

export async function deleteMealPlan(id) {
  const res = await fetch(`${API}/api/mealplans/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function autoGenerateWeek(userId, weekStart) {
  const params = weekStart ? `?weekStart=${weekStart}` : "";
  const res = await fetch(`${API}/api/mealplans/${userId}/auto-generate${params}`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function getGroceryList(userId, weekStart) {
  const params = weekStart ? `?weekStart=${weekStart}` : "";
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list${params}`);
  return handleResponse(res);
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
