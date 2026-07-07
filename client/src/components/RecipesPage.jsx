import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe,
} from "../api/recipes";

const emptyForm = {
  userId: 1,
  title: "",
  ingredients: "",
  steps: "",
  category: "",
  imageUrl: "",
};

function RecipesPage({ username }) {
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  async function loadRecipes() {
    try {
      let data = [];

      if (showFavoritesOnly && username) {
        data = await getFavoriteRecipes(username);
      } else {
        data = await getRecipes(search, category);
      }

      setRecipes(data);

      if (username) {
        const favorites = await getFavoriteRecipes(username);
        setFavoriteIds(new Set(favorites.map((recipe) => recipe.id)));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load recipes.");
    }
  }

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

  useEffect(() => {
    loadRecipes();
  }, [showFavoritesOnly]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function validateForm() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.ingredients.trim()) return "Ingredients are required.";
    if (!form.steps.trim()) return "Steps are required.";
    if (!form.category.trim()) return "Category is required.";

    if (form.imageUrl.trim() && !form.imageUrl.startsWith("http")) {
      return "Image URL must start with http or https.";
    }

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (editingId) {
        await updateRecipe(editingId, {
          title: form.title,
          ingredients: form.ingredients,
          steps: form.steps,
          category: form.category,
          imageUrl: form.imageUrl,
        });
      } else {
        await createRecipe({
          ...form,
          ownerUsername: username || "",
          writerUsername: username || "",
        });
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadRecipes();
    } catch (err) {
      console.error(err);
      setError("Failed to save recipe.");
    }
  }

  function startEdit(recipe) {
    setEditingId(recipe.id);

    setForm({
      userId: recipe.userId,
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps || "",
      category: recipe.category,
      imageUrl: recipe.imageUrl || "",
    });

    setError("");
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

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSearch(e) {
    e.preventDefault();
    await loadRecipes();
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>Recipes</h1>

      <form onSubmit={handleSearch} style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginRight: "8px" }}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ marginRight: "8px" }}
        >
          <option value="">All Categories</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack">Snack</option>
          <option value="Test">Test</option>
        </select>

        <button type="submit">Search</button>

        <button
          type="button"
          onClick={() => setShowFavoritesOnly((prev) => !prev)}
          style={{ marginLeft: "8px" }}
        >
          {showFavoritesOnly ? "Show All Recipes" : "Show Favorites"}
        </button>
      </form>

      <form onSubmit={handleSubmit} style={{ marginBottom: "24px" }}>
        <h2>{editingId ? "Edit Recipe" : "Add Recipe"}</h2>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div>
          <input
            name="title"
            placeholder="Title"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div>
          <textarea
            name="ingredients"
            placeholder="Ingredients"
            value={form.ingredients}
            onChange={handleChange}
          />
        </div>

        <div>
          <textarea
            name="steps"
            placeholder="Steps"
            value={form.steps}
            onChange={handleChange}
          />
        </div>

        <div>
          <input
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
          />
        </div>

        <div>
          <input
            name="imageUrl"
            placeholder="Image URL"
            value={form.imageUrl}
            onChange={handleChange}
          />
        </div>

        <button type="submit">
          {editingId ? "Update Recipe" : "Create Recipe"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={cancelEdit}
            style={{ marginLeft: "8px" }}
          >
            Cancel
          </button>
        )}
      </form>

      <h2>{showFavoritesOnly ? "Favorite Recipes" : "Recipe List"}</h2>

      {recipes.length === 0 ? (
        <p>No recipes found.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <h3>{recipe.title}</h3>

              <p>
                <strong>Category:</strong> {recipe.category}
              </p>

              <p>
                <strong>Ingredients:</strong> {recipe.ingredients}
              </p>

              <p>
                <strong>Steps:</strong> {recipe.steps || "No steps provided."}
              </p>

              {recipe.ownerUsername && (
                <p>
                  <strong>Owner:</strong> {recipe.ownerUsername}
                </p>
              )}

              {recipe.writerUsername && (
                <p>
                  <strong>Writer:</strong> {recipe.writerUsername}
                </p>
              )}

              {recipe.imageUrl && (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  style={{
                    width: "180px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "6px",
                  }}
                />
              )}

              <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                >
                  View Details
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(recipe.id)}
                >
                  {favoriteIds.has(recipe.id)
                    ? "★ Favorited"
                    : "☆ Add to Favorite"}
                </button>

                <button type="button" onClick={() => startEdit(recipe)}>
                  Edit
                </button>

                <button type="button" onClick={() => handleDelete(recipe.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecipesPage;