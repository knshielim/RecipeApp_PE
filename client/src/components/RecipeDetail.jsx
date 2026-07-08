import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  getRecipeById,
  deleteRecipe,
  addFavoriteRecipe,
  removeFavoriteRecipe,
  getFavoriteRecipes,
} from "../api/recipes";
import { getCategoryGradient } from "../utils/recipeCategoryColors";
import { canManageRecipe } from "../utils/recipePermissions";
import { formatDietRestriction } from "../utils/dietLabels";
import { useUserProfile } from "../context/UserProfileContext";

function RecipeDetail({ username, isAdmin = false }) {
  const { displayName } = useUserProfile();
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    async function loadRecipe() {
      try {
        const data = await getRecipeById(id);
        setRecipe(data);
        if (username) {
          const favorites = await getFavoriteRecipes(username);
          setIsFavorite(favorites.some((f) => f.id === data.id));
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load recipe details.");
      }
    }

    loadRecipe();
  }, [id, username]);

  async function handleToggleFavorite() {
    if (!username || favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorite) {
        await removeFavoriteRecipe(recipe.id, username);
        setIsFavorite(false);
      } else {
        await addFavoriteRecipe(recipe.id, username);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFavLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this recipe?");
    if (!confirmed) return;

    try {
      await deleteRecipe(id);
      navigate("/recipes");
    } catch (err) {
      console.error(err);
      setError("Failed to delete recipe.");
    }
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{error}</p>
        <Link to="/recipes" className="inline-block mt-4 text-brand font-semibold hover:underline">
          ← Back to Recipes
        </Link>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        Loading recipe...
      </div>
    );
  }

  const ingredients = recipe.ingredients
    ?.split(",")
    .map((i) => i.trim())
    .filter(Boolean) ?? [];

  const steps = recipe.steps
    ?.split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

  const gradient = getCategoryGradient(recipe.category);
  const canManage = canManageRecipe(recipe, username, isAdmin, displayName);
  const dietLabel = formatDietRestriction(recipe.dietRestriction);

  const allergens = recipe.allergens
    ?.split(",")
    .map((a) => a.trim())
    .filter(Boolean) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-slate-500 hover:text-brand font-medium"
      >
        ← Back
      </button>

      {/* Hero */}
      <div className="soft-card overflow-hidden">
        <div className="relative h-56 sm:h-72">
          {recipe.imageUrl && recipe.imageUrl.trim() && recipe.imageUrl !== "" && recipe.imageUrl !== "null" ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src="/DefaultRecipeImage.png"
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="text-2xl sm:text-3xl font-bold">{recipe.title}</h1>
            {(() => {
              // Prefer the full multi-category list; fall back to the
              // legacy single `category` field for older recipes that
              // haven't been re-saved with the new category picker.
              const categoryNames = recipe.categories?.length
                ? recipe.categories.map((c) => c.name)
                : recipe.category
                ? [recipe.category]
                : [];

              return (
                <>
                  {categoryNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 mb-2">
                      {categoryNames.map((name) => (
                        <span
                          key={name}
                          className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-white/90">
                    {dietLabel && (
                      <>
                        <span className="font-bold">Diet:</span>{" "}
                        <span className="font-bold">{dietLabel}</span>
                      </>
                    )}
                    {dietLabel && recipe.ownerName && (
                      <span className="mx-1.5">·</span>
                    )}
                    {recipe.ownerName && (
                      <>
                        <span className="font-bold">Owner:</span>{" "}
                        <span className="font-bold">{recipe.ownerName}</span>
                      </>
                    )}
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        <div className="p-6 flex flex-wrap gap-3">
          {username && (
            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
                isFavorite
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-brand-light text-brand border border-brand/20 hover:bg-brand/10"
              }`}
            >
              {isFavorite ? "★ Favourited" : "☆ Add to Favourites"}
            </button>
          )}
          {canManage && (
            <button
              onClick={handleDelete}
              className="px-5 py-2 rounded-full text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
            >
              Delete Recipe
            </button>
          )}
        </div>
      </div>

      {/* Allergens */}
      {allergens.length > 0 && (
        <div className="soft-card p-6 sm:p-8">
          <h2 className="section-title mb-4">Allergens</h2>
          <div className="flex flex-wrap gap-2">
            {allergens.map((allergen, index) => (
              <span
                key={index}
                className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full font-medium border border-amber-100"
              >
                Contains {allergen}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="soft-card p-6 sm:p-8">
        <h2 className="section-title mb-4">Ingredients</h2>
        {ingredients.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ingredients.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-2.5"
              >
                <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                <span className="capitalize">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        )}
      </div>

      {/* Steps */}
      <div className="soft-card p-6 sm:p-8">
        <h2 className="section-title mb-4">Cooking Steps</h2>
        {steps.length > 0 ? (
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-8 h-8 shrink-0 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700 pt-1 leading-relaxed">{step.replace(/^\d+\.\s*/, "")}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No steps provided.</p>
        )}
      </div>
    </div>
  );
}

export default RecipeDetail;