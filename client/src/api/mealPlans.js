const API = "http://localhost:5237";

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export async function getMealPlans(userId) {
  const res = await fetch(`${API}/api/mealplans/${userId}`);
  return handleResponse(res);
}

export async function getRecipes(userId) {
  const res = await fetch(`${API}/api/mealplans/recipes/${userId}`);
  return handleResponse(res);
}

export async function createMealPlan({ userId, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, day, mealSlot, recipeId }),
  });
  return handleResponse(res);
}

export async function updateMealPlan(id, { userId, day, mealSlot, recipeId }) {
  const res = await fetch(`${API}/api/mealplans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, day, mealSlot, recipeId }),
  });
  return handleResponse(res);
}

export async function deleteMealPlan(id) {
  const res = await fetch(`${API}/api/mealplans/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function autoGenerateWeek(userId) {
  const res = await fetch(`${API}/api/mealplans/${userId}/auto-generate`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function getGroceryList(userId) {
  const res = await fetch(`${API}/api/mealplans/${userId}/grocery-list`);
  return handleResponse(res);
}
