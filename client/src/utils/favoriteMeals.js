import { API_BASE } from "../utils/apiError";

const API = API_BASE;

// Note: recipe endpoints use /api/recipe, not /api/recipes.
const RECIPE_API = `${API}/api/recipe`;

export async function getFavoriteMeals(username) {
  try {
    if (!username) return [];

    const response = await fetch(
      `${RECIPE_API}/favorites?username=${encodeURIComponent(username)}`
    );

    if (!response.ok) return [];

    const data = await response.json().catch(() => []);

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function isFavoriteMeal(username, recipeId) {
  try {
    const favorites = await getFavoriteMeals(username);

    return favorites.some((m) => m.id === recipeId);
  } catch {
    return false;
  }
}

export async function toggleFavoriteMeal(username, recipe) {
  try {
    if (!username || !recipe?.id) return [];

    const isFav = await isFavoriteMeal(username, recipe.id);

    if (isFav) {
      await removeFavoriteMeal(username, recipe.id);
      return [];
    }

    await addFavoriteMeal(username, recipe.id);
    return await getFavoriteMeals(username);
  } catch {
    return [];
  }
}

export async function addFavoriteMeal(username, recipeId) {
  try {
    if (!username || !recipeId) return;

    const response = await fetch(
      `${RECIPE_API}/${recipeId}/favorite?username=${encodeURIComponent(username)}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) return;
  } catch {
    // Silently fail - UI will show current state
  }
}

export async function removeFavoriteMeal(username, recipeId) {
  try {
    if (!username || !recipeId) return;

    const response = await fetch(
      `${RECIPE_API}/${recipeId}/favorite?username=${encodeURIComponent(username)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) return;
  } catch {
    // Silently fail - UI will show current state
  }
}