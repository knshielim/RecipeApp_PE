import { useEffect, useState } from "react";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe,
} from "../api/recipes";
import RecipeCard from "./RecipeCard";
import { canManageRecipe } from "../utils/recipePermissions";
import { useUserProfile } from "../context/UserProfileContext";
import { DIET_OPTIONS } from "../utils/dietLabels";
import { getCategoryGradient } from "../utils/recipeCategoryColors";

const API = "http://localhost:5237";

const emptyForm = {
  userId: 1,
  title: "",
  ingredients: "",
  steps: "",
  categoryIds: [],
  dietRestriction: "none",
  allergens: "",
  imageUrl: "",
};

const FALLBACK_CATEGORIES = ["Asian", "Bowls", "Breakfast", "Comfort Food", "Curry", "Dessert", "Grilled", "Healthy", "Italian", "Kids Friendly", "Mediterranean", "Mexican", "Pasta", "Quick & Easy", "Salad", "Sandwich", "Seafood", "Soup", "Thai", "Tacos", "Veggie"];

function RecipesPage({ username, isAdmin = false }) {
  const { displayName } = useUserProfile();
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]); // names only, used by the "Top Recipe Categories" strip
  const [categoryList, setCategoryList] = useState([]); // full {id, name, emoji, colorKey} objects, used by the form
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadRecipes() {
    setLoading(true);
    try {
      let data = [];

      if (showFavoritesOnly && username) {
        data = await getFavoriteRecipes(username);
      } else {
        data = await getRecipes(search, activeCategory || "");
      }

      setRecipes(data);

      if (username) {
        const favorites = await getFavoriteRecipes(username);
        setFavoriteIds(new Set(favorites.map((recipe) => recipe.id)));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${API}/api/dashboard/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategoryList(data);
        setCategories(data.map((c) => c.name).filter(Boolean).sort());
        return;
      }
    } catch {
      // fall through to fallback below
    }
    setCategories([...FALLBACK_CATEGORIES].sort());
    setCategoryList(FALLBACK_CATEGORIES.map((name, i) => ({ id: i, name, emoji: "", colorKey: "" })));
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [showFavoritesOnly, activeCategory]);

  async function toggleFavorite(recipeId) {
    if (!username) {
      setError("You must be logged in to favorite recipes.");
      return;
    }

    try {
      if (favoriteIds.has(recipeId)) {
        await removeFavoriteRecipe(recipeId, username);
      } else {
        await addFavoriteRecipe(recipeId, username);
      }
      await loadRecipes();
    } catch (err) {
      console.error(err);
      setError("Failed to update favorite.");
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleCategoryId(id) {
    setForm((prev) => {
      const has = prev.categoryIds.includes(id);
      return {
        ...prev,
        categoryIds: has
          ? prev.categoryIds.filter((cid) => cid !== id)
          : [...prev.categoryIds, id],
      };
    });
  }

  function validateForm() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.ingredients.trim()) return "Ingredients are required.";
    if (!form.steps.trim()) return "Steps are required.";
    if (!form.categoryIds || form.categoryIds.length === 0) return "Select at least one category.";
    if (form.imageUrl.trim() && !form.imageUrl.startsWith("http")) {
      return "Image URL must start with http or https.";
    }
    return "";
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEditModal(recipe) {
    setEditingId(recipe.id);
    setForm({
      userId: recipe.userId,
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps || "",
      categoryIds: recipe.categories?.map((c) => c.id) || [],
      dietRestriction: recipe.dietRestriction || "none",
      allergens: recipe.allergens || "",
      imageUrl: recipe.imageUrl || "",
    });
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // "category" (singular, string) is kept for backward compatibility with
    // older parts of the app; it's derived from the first selected category.
    const primaryCategoryName =
      categoryList.find((c) => c.id === form.categoryIds[0])?.name || "";

    try {
      if (editingId) {
        await updateRecipe(editingId, {
          title: form.title,
          ingredients: form.ingredients,
          steps: form.steps,
          category: primaryCategoryName,
          categoryIds: form.categoryIds,
          dietRestriction: form.dietRestriction,
          allergens: form.allergens,
          imageUrl: form.imageUrl,
        });
      } else {
        await createRecipe({
          ...form,
          category: primaryCategoryName,
          ownerName: displayName || username || "",
        });
      }

      closeModal();
      await loadRecipes();
    } catch (err) {
      console.error(err);
      setError("Failed to save recipe.");
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this recipe?");
    if (!confirmed) return;

    try {
      await deleteRecipe(id);
      await loadRecipes();
    } catch (err) {
      console.error(err);
      setError("Failed to delete recipe.");
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    await loadRecipes();
  }

  async function clearFilters() {
    setSearch("");
    setActiveCategory(null);
    setShowFavoritesOnly(false);
    setLoading(true);
    try {
      const data = await getRecipes("", "");
      setRecipes(data);
      if (username) {
        const favorites = await getFavoriteRecipes(username);
        setFavoriteIds(new Set(favorites.map((recipe) => recipe.id)));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = search.trim() || activeCategory || showFavoritesOnly;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title text-2xl sm:text-3xl">Recipes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, search, and manage your recipe collection
          </p>
        </div>
        <button type="button" onClick={openCreateModal} className="btn-primary text-sm shrink-0">
          + Create New Recipe
        </button>
      </div>

      {/* Filters */}
      <div className="soft-card p-4 sm:p-5 space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by title or ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-9"
            />
          </div>

          <button type="submit" className="btn-primary text-sm sm:px-6">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            className={`text-sm font-semibold px-4 py-2 rounded-full border transition-colors ${
              showFavoritesOnly
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand/40 hover:text-brand"
            }`}
          >
            {showFavoritesOnly ? "★ Favourites only" : "☆ Show favourites"}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-slate-500 hover:text-brand px-3 py-2"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-slate-400 sm:ml-auto">
            {loading ? "Loading..." : `${recipes.length} recipe${recipes.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* Top Recipe Categories */}
      <section>
        <h2 className="section-title mb-4">Top Recipe Categories</h2>
        <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className="flex flex-col items-center gap-2 shrink-0 group"
            >
              <div
                className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-gradient-to-br ${getCategoryGradient(
                  cat === "Tacos" ? "amber" :
                  cat === "Bowls" ? "green" :
                  cat === "Veggie" ? "lime" :
                  cat === "Breakfast" ? "yellow" :
                  cat === "Dessert" ? "pink" :
                  cat === "Thai" ? "red" :
                  cat === "Grilled" ? "stone" :
                  cat === "Pasta" ? "orange" :
                  cat === "Soup" ? "blue" :
                  cat === "Salad" ? "emerald" :
                  cat === "Sandwich" ? "brown" :
                  cat === "Curry" ? "purple" :
                  cat === "Seafood" ? "cyan" :
                  cat === "Mexican" ? "rose" :
                  cat === "Italian" ? "violet" :
                  cat === "Asian" ? "indigo" :
                  cat === "Mediterranean" ? "teal" :
                  cat === "Comfort Food" ? "warm" :
                  cat === "Quick & Easy" ? "sky" :
                  cat === "Healthy" ? "mint" :
                  "baby"
                )} flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all ${
                  activeCategory === cat
                    ? 'border-brand shadow-md scale-105'
                    : 'border-brand/30 group-hover:border-brand/60'
                }`}
              >
                {cat === "Tacos" ? "🌮" :
                 cat === "Bowls" ? "🥗" :
                 cat === "Veggie" ? "🥦" :
                 cat === "Breakfast" ? "🍳" :
                 cat === "Dessert" ? "🍰" :
                 cat === "Thai" ? "🍜" :
                 cat === "Grilled" ? "🥩" :
                 cat === "Pasta" ? "🍝" :
                 cat === "Soup" ? "🍲" :
                 cat === "Salad" ? "🥬" :
                 cat === "Sandwich" ? "🥪" :
                 cat === "Curry" ? "🍛" :
                 cat === "Seafood" ? "🦐" :
                 cat === "Mexican" ? "🇲🇽" :
                 cat === "Italian" ? "🇮🇹" :
                 cat === "Asian" ? "🥡" :
                 cat === "Mediterranean" ? "🫒" :
                 cat === "Comfort Food" ? "🍲" :
                 cat === "Quick & Easy" ? "⚡" :
                 cat === "Healthy" ? "💚" :
                 cat === "Kids Friendly" ? "👶" : "🍽️"}
              </div>
              <span className={`text-xs font-semibold ${activeCategory === cat ? 'text-brand' : 'text-slate-600'}`}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      </section>

      {error && !showModal && (
        <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Recipe list */}
      <section>
        <h2 className="section-title text-lg mb-4">
          {showFavoritesOnly ? "Favourite Recipes" : "All Recipes"}
        </h2>

        {loading ? (
          <div className="soft-card p-10 text-center text-slate-500">Loading recipes...</div>
        ) : recipes.length === 0 ? (
          <div className="soft-card p-10 text-center">
            <span className="text-4xl">🍳</span>
            <p className="text-slate-500 mt-3">
              {hasActiveFilters ? "No recipes match your filters." : "No recipes found yet."}
            </p>
            {!hasActiveFilters && (
              <button type="button" onClick={openCreateModal} className="btn-primary text-sm mt-4">
                Create your first recipe
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipes.map((recipe) => {
              const canManage = canManageRecipe(recipe, username, isAdmin, displayName);

              return (
                <div key={recipe.id}>
                  <RecipeCard
                    recipe={recipe}
                    detailPath={`/recipes/${recipe.id}`}
                    favoriteButton={
                      <button
                        type="button"
                        onClick={() => toggleFavorite(recipe.id)}
                        title={
                          favoriteIds.has(recipe.id)
                            ? "Remove from favourites"
                            : "Add to favourites"
                        }
                        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/90 shadow-sm hover:scale-105 transition-transform"
                      >
                        <span className="text-lg">
                          {favoriteIds.has(recipe.id) ? "★" : "☆"}
                        </span>
                      </button>
                    }
                  />
                  {canManage && (
                    <div className="flex gap-3 mt-2 ml-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(recipe)}
                        className="text-sm text-brand font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(recipe.id)}
                        className="text-sm text-red-600 font-semibold hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create / Edit modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8"
          onClick={closeModal}
        >
          <div
            className="soft-card p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <h2 className="section-title text-xl">
                {editingId ? "Edit Recipe" : "Create New Recipe"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title *</label>
                <input
                  name="title"
                  placeholder="e.g. Chicken Stir Fry"
                  value={form.title}
                  onChange={handleChange}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ingredients *</label>
                <textarea
                  name="ingredients"
                  placeholder="Comma-separated, e.g. chicken, soy sauce, garlic"
                  value={form.ingredients}
                  onChange={handleChange}
                  rows={3}
                  className="input-field w-full resize-y"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Steps *</label>
                <textarea
                  name="steps"
                  placeholder="One step per line"
                  value={form.steps}
                  onChange={handleChange}
                  rows={4}
                  className="input-field w-full resize-y"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Categories * <span className="font-normal text-slate-400">(select one or more)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryList.map((cat) => {
                    const selected = form.categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategoryId(cat.id)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                          selected
                            ? "bg-brand text-white border-brand"
                            : "bg-white text-slate-600 border-slate-200 hover:border-brand/40 hover:text-brand"
                        }`}
                      >
                        {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Diet Restriction *</label>
                <select
                  name="dietRestriction"
                  value={form.dietRestriction}
                  onChange={handleChange}
                  className="input-field w-full"
                  required
                >
                  {DIET_OPTIONS.map((diet) => (
                    <option key={diet.value} value={diet.value}>
                      {diet.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Allergens <span className="font-normal text-slate-400">(optional, comma-separated)</span>
                </label>
                <input
                  name="allergens"
                  placeholder="e.g., Peanuts, Dairy, Gluten"
                  value={form.allergens}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Image URL <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  name="imageUrl"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary text-sm flex-1">
                  {editingId ? "Save Changes" : "Create Recipe"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipesPage;