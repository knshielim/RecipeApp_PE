import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipeById, deleteRecipe } from "../api/recipes";

function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRecipe() {
      try {
        const data = await getRecipeById(id);
        setRecipe(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load recipe details.");
      }
    }

    loadRecipe();
  }, [id]);

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
      <div style={{ padding: "24px" }}>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={() => navigate("/recipes")}>Back to Recipes</button>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div style={{ padding: "24px" }}>
        <p>Loading recipe...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <button onClick={() => navigate("/recipes")} style={{ marginBottom: "16px" }}>
        Back to Recipes
      </button>

      <h1>{recipe.title}</h1>

      <p>
        <strong>Category:</strong> {recipe.category}
      </p>

      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          style={{
            width: "320px",
            height: "200px",
            objectFit: "cover",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        />
      )}

      <section style={{ marginTop: "16px" }}>
        <h2>Ingredients</h2>
        <p>{recipe.ingredients}</p>
      </section>

      <section style={{ marginTop: "16px" }}>
        <h2>Steps</h2>
        <p>{recipe.steps || "No steps provided."}</p>
      </section>

      <div style={{ marginTop: "24px" }}>
        <button onClick={() => navigate("/recipes")}>
          Back
        </button>

        <button
          onClick={handleDelete}
          style={{ marginLeft: "8px" }}
        >
          Delete Recipe
        </button>
      </div>
    </div>
  );
}

export default RecipeDetail;