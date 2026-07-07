import axios from "axios";

const API_BASE_URL = "http://localhost:5237/api/recipe";

export async function getRecipes(search = "", category = "") {
  const response = await axios.get(API_BASE_URL, {
    params: {
      search,
      category,
    },
  });

  return response.data;
}

export async function getRecipeById(id) {
  const response = await axios.get(`${API_BASE_URL}/${id}`);
  return response.data;
}

export async function createRecipe(recipe) {
  const response = await axios.post(API_BASE_URL, recipe);
  return response.data;
}

export async function updateRecipe(id, recipe) {
  await axios.put(`${API_BASE_URL}/${id}`, recipe);
}

export async function deleteRecipe(id) {
  await axios.delete(`${API_BASE_URL}/${id}`);
}

export async function addFavoriteRecipe(id, username) {
  const response = await axios.post(`${API_BASE_URL}/${id}/favorite`, null, {
    params: { username },
  });

  return response.data;
}

export async function removeFavoriteRecipe(id, username) {
  await axios.delete(`${API_BASE_URL}/${id}/favorite`, {
    params: { username },
  });
}

export async function getFavoriteRecipes(username) {
  const response = await axios.get(`${API_BASE_URL}/favorites`, {
    params: { username },
  });

  return response.data;
}