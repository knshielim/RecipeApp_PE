const storageKey = (userId) => `nomly_favoriteMeals_${userId}`;

export function getFavoriteMeals(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavoriteMeals(userId, meals) {
  localStorage.setItem(storageKey(userId), JSON.stringify(meals));
}

export function isFavoriteMeal(userId, recipeId) {
  return getFavoriteMeals(userId).some((m) => m.id === recipeId);
}

export function toggleFavoriteMeal(userId, recipe) {
  const favorites = getFavoriteMeals(userId);
  const exists = favorites.some((m) => m.id === recipe.id);
  const next = exists
    ? favorites.filter((m) => m.id !== recipe.id)
    : [
        ...favorites,
        {
          id: recipe.id,
          title: recipe.title,
          category: recipe.category,
          ingredients: recipe.ingredients || "",
          addedAt: new Date().toISOString(),
        },
      ];
  saveFavoriteMeals(userId, next);
  return next;
}

export function removeFavoriteMeal(userId, recipeId) {
  const next = getFavoriteMeals(userId).filter((m) => m.id !== recipeId);
  saveFavoriteMeals(userId, next);
  return next;
}
