import axios from "axios";
import { API_BASE, getApiErrorMessage } from "../utils/apiError";

const API_BASE_URL = `${API_BASE}/api/recipe`;

function handleAxiosError(error, fallback = "Request failed.") {
  if (error.response) {
    throw new Error(getApiErrorMessage(error.response.data, fallback));
  }

  if (error.request) {
    throw new Error("Unable to connect to the server. Please make sure the backend is running.");
  }

  throw new Error(error.message || fallback);
}

export async function getRecipes(search = "", category = "") {
  try {
    const response = await axios.get(API_BASE_URL, {
      params: {
        search,
        category,
      },
    });

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Could not load recipes.");
  }
}

export async function getRecipeById(id) {
  try {
    const response = await axios.get(`${API_BASE_URL}/${id}`);

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Could not load recipe details.");
  }
}

export async function createRecipe(recipe) {
  try {
    const response = await axios.post(API_BASE_URL, recipe);

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Failed to create recipe.");
  }
}

export async function updateRecipe(id, recipe) {
  try {
    const response = await axios.put(`${API_BASE_URL}/${id}`, recipe);

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Failed to update recipe.");
  }
}

export async function uploadRecipeImage(file) {
  try {
    const data = new FormData();
    data.append("image", file);

    const response = await axios.post(`${API_BASE_URL}/upload-image`, data);

    return response.data; // { url: "/uploads/recipes/<name>.jpg" }
  } catch (error) {
    handleAxiosError(error, "Failed to upload image.");
  }
}

export async function deleteRecipe(id) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/${id}`);

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Failed to delete recipe.");
  }
}

export async function addFavoriteRecipe(id, username) {
  try {
    const response = await axios.post(`${API_BASE_URL}/${id}/favorite`, null, {
      params: { username },
    });

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Failed to add recipe to favourites.");
  }
}

export async function removeFavoriteRecipe(id, username) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/${id}/favorite`, {
      params: { username },
    });

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Failed to remove recipe from favourites.");
  }
}

export async function getFavoriteRecipes(username) {
  try {
    const response = await axios.get(`${API_BASE_URL}/favorites`, {
      params: { username },
    });

    return response.data;
  } catch (error) {
    handleAxiosError(error, "Could not load favourite recipes.");
  }
}