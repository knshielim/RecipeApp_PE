const API = "http://localhost:5237";

export async function getFavoriteMeals(username) {
  try {
    const response = await fetch(`${API}/api/recipes/favorites?username=${encodeURIComponent(username)}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data || [];
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
    const isFav = await isFavoriteMeal(username, recipe.id);
    if (isFav) {
      await removeFavoriteMeal(username, recipe.id);
      return [];
    } else {
      await addFavoriteMeal(username, recipe.id);
      return await getFavoriteMeals(username);
    }
  } catch {
    return [];
  }
}

export async function addFavoriteMeal(username, recipeId) {
  try {
    await fetch(`${API}/api/recipes/${recipeId}/favorite?username=${encodeURIComponent(username)}`, {
      method: "POST",
    });
  } catch {
    // Silently fail - UI will show current state
  }
}

export async function removeFavoriteMeal(username, recipeId) {
  try {
    await fetch(`${API}/api/recipes/${recipeId}/favorite?username=${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
  } catch {
    // Silently fail - UI will show current state
  }
}
