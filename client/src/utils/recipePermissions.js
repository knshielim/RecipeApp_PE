export function canManageRecipe(recipe, username, isAdmin = false, displayName = "") {
  if (!recipe || !username) return false;
  if (isAdmin) return true;

  const owner = recipe.ownerName?.trim().toLowerCase();
  const name = displayName?.trim().toLowerCase();
  if (owner && name && owner === name) return true;

  return false;
}
