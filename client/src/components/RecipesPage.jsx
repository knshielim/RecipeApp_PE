import { useEffect, useState, useCallback } from "react";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  uploadRecipeImage,
  getFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe,
} from "../api/recipes";
import RecipeCard from "./RecipeCard";
import { canManageRecipe } from "../utils/recipePermissions";
import { useUserProfile } from "../context/UserProfileContext";
import { DIET_OPTIONS } from "../utils/dietLabels";
import { getCategoryGradient } from "../utils/recipeCategoryColors";
import { useSearch } from "./layout/AppLayout";
import { matchesSearch } from "../utils/search";
import { getRecipeCategoryNames } from "../utils/recipeCategories";
import { API_BASE, parseApiResponse, formatFetchError } from "../utils/apiError";

const API = API_BASE;

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

const FALLBACK_CATEGORIES = [
  "Asian",
  "Breakfast",
  "Comfort Food",
  "Curry",
  "Dessert",
  "Grilled",
  "Healthy",
  "Italian",
  "Kids Friendly",
  "Mediterranean",
  "Mexican",
  "Pasta",
  "Quick & Easy",
  "Salad",
  "Sandwich",
  "Seafood",
  "Soup",
  "Thai",
  "Veggie",
];

function RecipesPage({ username, isAdmin = false }) {
  const { displayName } = useUserProfile();
  const { searchQuery, setSearchQuery } = useSearch();
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]); // names only, used by the "Top Recipe Categories" strip
  const [categoryList, setCategoryList] = useState([]); // full {id, name, emoji, colorKey} objects, used by the form
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [activeCategory, setActiveCategory] = useState(null);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRecipes = useCallback(async (searchTerm = debouncedSearch) => {
    setLoading(true);

    try {
      let data = [];

      if (showFavoritesOnly && username) {
        data = await getFavoriteRecipes(username);

        if (searchTerm.trim()) {
          data = data.filter((recipe) =>
            matchesSearch(
              searchTerm,
              recipe.title,
              recipe.ingredients,
              recipe.category,
              ...getRecipeCategoryNames(recipe)
            )
          );
        }
      } else {
        data = await getRecipes(searchTerm.trim(), activeCategory || "");
      }

      setRecipes(data);

      if (username) {
        const favorites = await getFavoriteRecipes(username);
        setFavoriteIds(new Set(favorites.map((recipe) => recipe.id)));
      }
    } catch (err) {
      console.error(err);
      setError(formatFetchError(err) || "Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, debouncedSearch, showFavoritesOnly, username]);

  async function loadCategories() {
    try {
      const res = await fetch(`${API}/api/dashboard/categories`);
      const data = await parseApiResponse(res, "Could not load categories.");

      setCategoryList(data);
      setCategories(data.map((c) => c.name).filter(Boolean).sort());
      return;
    } catch (err) {
      console.error("Using fallback categories:", formatFetchError(err));
    }

    setCategories([...FALLBACK_CATEGORIES].sort());
    setCategoryList([]);
    setError("Could not load recipe categories. Please refresh the page and try again.");

  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

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
      setError(formatFetchError(err) || "Failed to update favorite.");
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
    if (categoryList.length === 0) {
      return "Recipe categories are not loaded yet. Please refresh the page.";
    }

    const title = form.title.trim();
    const ingredients = form.ingredients.trim();
    const steps = form.steps.trim();
    const imageUrl = form.imageUrl.trim();

    if (!title) return "Title is required.";
    if (title.length < 2) return "Title must be at least 2 characters.";
    if (title.length > 100) return "Title cannot exceed 100 characters.";

    if (!ingredients) return "Ingredients are required.";
    if (!steps) return "Steps are required.";

    if (!form.categoryIds || form.categoryIds.length === 0) {
      return "Select at least one category.";
    }

    if (
      imageUrl &&
      !imageUrl.startsWith("http://") &&
      !imageUrl.startsWith("https://") &&
      !imageUrl.startsWith("/")
    ) {
      return "Image URL must be a valid URL or app upload path.";
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

  async function handleImageFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files can be uploaded.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    setError("");
    setUploadingImage(true);

    try {
      const { url } = await uploadRecipeImage(file);
      setForm((prev) => ({ ...prev, imageUrl: `${API}${url}` }));
    } catch (err) {
      console.error(err);
      setError(formatFetchError(err) || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const primaryCategoryName =
      categoryList.find((c) => c.id === form.categoryIds[0])?.name || "";

    const recipePayload = {
      title: form.title.trim(),
      ingredients: form.ingredients.trim(),
      steps: form.steps.trim(),
      category: primaryCategoryName,
      categoryIds: form.categoryIds,
      dietRestriction: form.dietRestriction || "none",
      allergens: form.allergens.trim(),
      imageUrl: form.imageUrl.trim(),
    };

    try {
      if (editingId) {
        await updateRecipe(editingId, recipePayload);
      } else {
        await createRecipe({
          userId: form.userId || 1,
          ownerName: displayName || username || "User",
          ...recipePayload,
        });
      }

      closeModal();
      await loadRecipes();
    } catch (err) {
      console.error(err);
      setError(formatFetchError(err) || err.message || "Failed to save recipe.");
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
      setError(formatFetchError(err) || "Failed to delete recipe.");
    }
  }

  async function clearFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
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
      setError(formatFetchError(err) || "Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = searchQuery.trim() || activeCategory || showFavoritesOnly;

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
      <div className="soft-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            className={`text-sm font-semibold px-4 py-2 rounded-full border transition-colors ${showFavoritesOnly
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
          {categoryList.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
              className="flex flex-col items-center gap-2 shrink-0 group"
            >
              <div
                className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-gradient-to-br ${getCategoryGradient(cat.colorKey)} flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all ${activeCategory === cat.name
                  ? "border-brand shadow-md scale-105"
                  : "border-brand/30 group-hover:border-brand/60"
                  }`}
              >
                {cat.emoji}
              </div>

              <span className={`text-xs font-semibold ${activeCategory === cat.name ? "text-brand" : "text-slate-600"}`}>
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {error && !showModal && (
        <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-3 whitespace-pre-line">
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
                <div key={recipe.id} className="flex flex-col">
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
                    <div className="flex gap-3 mt-3 px-1">
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
                {categoryList.length === 0 ? (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">
                    Recipe categories could not be loaded. Please refresh the page before creating a recipe.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categoryList.map((cat) => {
                      const selected = form.categoryIds.includes(cat.id);

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategoryId(cat.id)}
                          aria-pressed={selected}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${selected
                            ? "bg-brand text-white border-brand"
                            : "bg-white text-slate-600 border-slate-200 hover:border-brand/40 hover:text-brand"
                            }`}
                        >
                          {cat.emoji ? `${cat.emoji} ` : ""}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                  Recipe Image <span className="font-normal text-slate-400">(optional)</span>
                </label>

                {form.imageUrl ? (
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={form.imageUrl}
                      alt="Recipe preview"
                      className="w-20 h-20 rounded-xl object-cover border border-slate-200"
                      onError={(e) => { e.target.style.opacity = 0.3; }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="text-sm font-semibold text-red-500 hover:text-red-600"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl px-4 py-5 text-sm text-slate-500 cursor-pointer hover:border-brand hover:text-brand transition-colors mb-2 ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
                      <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
                    </svg>
                    {uploadingImage ? "Uploading..." : "Upload an image (JPG, PNG, WebP, GIF — max 5 MB)"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageFile}
                      className="hidden"
                    />
                  </label>
                )}

                <input
                  name="imageUrl"
                  placeholder="...or paste an image URL (https://...)"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl whitespace-pre-line">
                  {error}
                </p>
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