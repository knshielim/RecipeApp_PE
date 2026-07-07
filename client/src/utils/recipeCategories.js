export function getRecipeCategoryNames(recipe) {
  if (recipe?.categories?.length) {
    return recipe.categories.map((c) => c.name).filter(Boolean);
  }
  if (recipe?.category) {
    return [recipe.category];
  }
  return [];
}

export function getRecipeCategoryLabel(recipe) {
  const names = getRecipeCategoryNames(recipe);
  return names.length > 0 ? names.join(", ") : "";
}

export function recipeMatchesCategory(recipe, categoryName) {
  if (!categoryName) return true;
  const q = categoryName.toLowerCase();
  const names = getRecipeCategoryNames(recipe);
  return names.some((name) => name.toLowerCase() === q);
}
