import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORY_COLOR_OPTIONS, getCategoryGradient, getCategoryGradientStyle } from "../utils/recipeCategoryColors";
import { API_BASE, getApiErrorMessage, formatFetchError } from "../utils/apiError";

const API = API_BASE;

// Some responses (e.g. 401 from expired tokens) have an empty body —
// parse safely instead of crashing with "Unexpected end of JSON input".
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function readAdminResponse(res, fallback = "Request failed.") {
  const data = await safeJson(res);

  if (res.status === 401) {
    throw new Error("Session expired. Please log out and sign in again.");
  }

  if (res.status === 403) {
    throw new Error("Admin access required.");
  }

  if (!res.ok) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data;
}

function TopBar({ username, role, onLogout, onUserDashboard }) {
  return (
    <nav className="bg-white soft-shadow border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <img src="/NomlyLogo-Green.png" alt="Nomly" className="h-25" />
            <span className="text-xs font-semibold bg-brand-light text-brand px-3 py-1 rounded-full">
              {role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onUserDashboard}
              className="px-3 py-2 text-sm font-semibold rounded-md text-brand bg-brand-light hover:bg-brand/10 border border-brand/20"
            >
              User Dashboard
            </button>
            <span className="text-sm text-slate-500 hidden sm:block">
              Signed in as <span className="font-semibold text-slate-900">{username}</span>
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

const EMPTY_EDIT_FORM = {
  fullName: "", email: "", phoneNumber: "", dateOfBirth: "", gender: ""
};

const EMPTY_CATEGORY_FORM = { name: "", emoji: "🍽️", colorKey: "amber", sortOrder: 0 };
const EMPTY_RECIPE_FORM = {
  title: "",
  category: "",
  categoryIds: [],
  ingredients: "",
  steps: "",
  ownerName: "AI-Generated",
  imageUrl: "",
};

function AdminModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminPage({ token, username, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Edit-user state
  const [editUser, setEditUser] = useState(null); // username being edited, or null
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editUserError, setEditUserError] = useState("");

  // Top Recipe Categories state
  const [editCategoryId, setEditCategoryId] = useState(null); // null | "new" | id
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editCategoryError, setEditCategoryError] = useState("");

  // Popular Recipe state
  const [editRecipeId, setEditRecipeId] = useState(null); // null | "new" | id
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE_FORM);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeFilter, setRecipeFilter] = useState("all");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editRecipeError, setEditRecipeError] = useState("");

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: authHeaders(),
      });

      const data = await readAdminResponse(res, "Could not load users.");
      setUsers(data);
    } catch (err) {
      setError(formatFetchError(err));
    }
  }, [authHeaders]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/categories`, {
        headers: authHeaders(),
      });

      const data = await readAdminResponse(res, "Could not load categories.");
      setCategories(data);
    } catch (err) {
      setError(formatFetchError(err));
    }
  }, [authHeaders]);

  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/recipes`, {
        headers: authHeaders(),
      });

      const data = await readAdminResponse(res, "Could not load recipes.");
      setRecipes(data);
    } catch (err) {
      setError(formatFetchError(err));
    }
  }, [authHeaders]);


  useEffect(() => {
    loadUsers();
    loadCategories();
    loadRecipes();
  }, [loadUsers, loadCategories, loadRecipes]);

  async function handleAction(promise, refresh) {
    setError("");
    setNotice("");

    try {
      const res = await promise;
      const data = await readAdminResponse(res, "Action failed.");

      setNotice(data.message || "Done.");

      if (refresh) {
        await refresh();
      }
    } catch (err) {
      setError(formatFetchError(err));
    }
  }

  const deleteUser = (name) =>
    window.confirm(`Delete user '${name}'? This cannot be undone.`) &&
    handleAction(
      fetch(`${API}/api/admin/users/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      loadUsers
    );

  const changeRole = (name, newRole) =>
    handleAction(
      fetch(`${API}/api/admin/users/${encodeURIComponent(name)}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      }),
      loadUsers
    );

  // Activate / deactivate: a deactivated user cannot log in.
  const toggleStatus = (name, currentlyActive) => {
    const verb = currentlyActive ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${verb} '${name}'?`)) return;
    handleAction(
      fetch(`${API}/api/admin/users/${encodeURIComponent(name)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isActive: !currentlyActive }),
      }),
      loadUsers
    );
  };

  // ---- Edit user information ----
  const startEdit = (u) => {
    setError("");
    setNotice("");
    setEditUserError("");
    setEditUser(u.username);
    setEditForm({
      fullName: u.fullName || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      dateOfBirth: u.dateOfBirth || "",
      gender: u.gender || "",
    });
  };

  const cancelEdit = () => {
    setEditUser(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditUserError("");
  };

  const handleEditInput = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) return setEditUserError("Full name is required.");
    if (!editForm.email.trim() || !editForm.email.includes("@"))
      return setEditUserError("A valid email is required.");

    setSavingEdit(true);
    setEditUserError("");
    try {
      const res = await fetch(`${API}/api/admin/users/${encodeURIComponent(editUser)}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(editForm),
      });
      const data = await readAdminResponse(res, "Failed to update user.");
      setNotice(data.message || "User updated successfully.");
      loadUsers();
      cancelEdit();
    } catch (err) {
      setEditUserError(formatFetchError(err));
    }
    setSavingEdit(false);
  };

  // ---- Top Recipe Categories CRUD ----
  const startNewCategory = () => {
    setError("");
    setNotice("");
    setEditCategoryError("");
    setEditCategoryId("new");
    setCategoryForm(EMPTY_CATEGORY_FORM);
  };

  const startEditCategory = (c) => {
    setError("");
    setNotice("");
    setEditCategoryError("");
    setEditCategoryId(c.id);
    setCategoryForm({
      name: c.name || "",
      emoji: c.emoji || "🍽️",
      colorKey: c.colorKey || "amber",
      sortOrder: c.sortOrder ?? 0,
    });
  };

  const cancelEditCategory = () => {
    setEditCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setEditCategoryError("");
  };

  const handleCategoryInput = (e) => {
    const { name, value } = e.target;
    setCategoryForm((prev) => ({ ...prev, [name]: name === "sortOrder" ? Number(value) : value }));
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return setEditCategoryError("Category name is required.");

    setSavingCategory(true);
    setEditCategoryError("");
    const isNew = editCategoryId === "new";
    try {
      const res = await fetch(
        isNew
          ? `${API}/api/admin/categories`
          : `${API}/api/admin/categories/${editCategoryId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(categoryForm),
        }
      );
      const data = await readAdminResponse(res, "Failed to save category.");
      setNotice(data.message || "Category saved successfully.");
      loadCategories();
      cancelEditCategory();
    } catch (err) {
      setEditCategoryError(formatFetchError(err));
    }
    setSavingCategory(false);
  };

  const deleteCategory = (c) =>
    window.confirm(`Remove category '${c.name}'? It will disappear from every user's dashboard.`) &&
    handleAction(
      fetch(`${API}/api/admin/categories/${c.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      loadCategories
    );

  // ---- Popular Recipe CRUD ----
  const startNewRecipe = () => {
    setError("");
    setNotice("");
    setEditRecipeError("");
    setEditRecipeId("new");
    setRecipeForm(EMPTY_RECIPE_FORM);
  };

  const startEditRecipe = (r) => {
    setError("");
    setNotice("");
    setEditRecipeError("");
    setEditRecipeId(r.id);
    setRecipeForm({
      title: r.title || "",
      category: r.category || "",
      categoryIds: r.categories?.map((c) => c.id) || [],
      ingredients: r.ingredients || "",
      steps: r.steps || "",
      ownerName: r.ownerName || "AI-Generated",
      imageUrl: r.imageUrl || "",
    });
  };

  const cancelEditRecipe = () => {
    setEditRecipeId(null);
    setRecipeForm(EMPTY_RECIPE_FORM);
    setEditRecipeError("");
  };

  const handleRecipeInput = (e) => {
    const { name, value } = e.target;
    setRecipeForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleRecipeCategoryId = (id) => {
    setRecipeForm((prev) => {
      const has = prev.categoryIds.includes(id);

      return {
        ...prev,
        categoryIds: has
          ? prev.categoryIds.filter((cid) => cid !== id)
          : [...prev.categoryIds, id],
      };
    });
  };

  const handleRecipeImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${API}/api/recipe/upload-image`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await readAdminResponse(res, "Failed to upload image.");
      setRecipeForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err) {
      setEditRecipeError(formatFetchError(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const saveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeForm.title.trim()) return setEditRecipeError("Recipe title is required.");
    if (!recipeForm.categoryIds || recipeForm.categoryIds.length === 0) return setEditRecipeError("Select at least one category.");
    if (!recipeForm.ingredients.trim()) return setEditRecipeError("Ingredients are required.");
    if (!recipeForm.steps.trim()) return setEditRecipeError("Cooking instructions are required.");

    // Set the primary category from the first selected category
    const primaryCategory = categories.find(c => c.id === recipeForm.categoryIds[0])?.name || "";
    
    const payload = {
      ...recipeForm,
      category: primaryCategory,
      categoryIds: recipeForm.categoryIds,
    };

    setSavingRecipe(true);
    setEditRecipeError("");
    const isNew = editRecipeId === "new";
    try {
      const res = await fetch(
        isNew
          ? `${API}/api/admin/recipes`
          : `${API}/api/admin/recipes/${editRecipeId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        }
      );
      const data = await readAdminResponse(res, "Failed to save recipe.");
      setNotice(data.message || "Recipe saved successfully.");
      loadRecipes();
      cancelEditRecipe();
    } catch (err) {
      setEditRecipeError(formatFetchError(err));
    }
    setSavingRecipe(false);
  };

  const deleteRecipe = (r) =>
    window.confirm(`Remove recipe '${r.title}'? It will disappear from the Popular Recipe list.`) &&
    handleAction(
      fetch(`${API}/api/admin/recipes/${r.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      loadRecipes
    );

  function openUserDashboard() {
    navigate("/");
  }

  const tabClass = (active) =>
    `px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${active
      ? "bg-green-600 text-white"
      : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700"
    }`;

  const inputClass =
    "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm " +
    "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all";

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    return categories.filter((c) => {
      const matchesSearch =
        !query ||
        c.name?.toLowerCase().includes(query) ||
        c.emoji?.toLowerCase().includes(query) ||
        c.colorKey?.toLowerCase().includes(query);
      const matchesFilter = categoryFilter === "all" || c.colorKey === categoryFilter;
      return matchesSearch && matchesFilter;
    });
  }, [categories, categoryFilter, categorySearch]);

  const filteredRecipes = useMemo(() => {
    const query = recipeSearch.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesSearch =
        !query ||
        r.title?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query) ||
        r.ownerName?.toLowerCase().includes(query) ||
        r.ingredients?.toLowerCase().includes(query) ||
        r.steps?.toLowerCase().includes(query);
      const matchesFilter = recipeFilter === "all" || r.category === recipeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [recipeFilter, recipeSearch, recipes]);

  return (
    <div className="min-h-screen bg-surface">
      <TopBar
        username={username}
        role="Admin"
        onLogout={onLogout}
        onUserDashboard={openUserDashboard}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-bold text-2xl text-slate-900">
            Admin panel
          </h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTab("users")} className={tabClass(tab === "users")}>
              Users{" "}
              <span className="font-mono text-xs opacity-60">{users.length}</span>
            </button>
            <button onClick={() => setTab("categories")} className={tabClass(tab === "categories")}>
              Top Categories{" "}
              <span className="font-mono text-xs opacity-60">{categories.length}</span>
            </button>
            <button onClick={() => setTab("recipes")} className={tabClass(tab === "recipes")}>
              Popular Recipes{" "}
              <span className="font-mono text-xs opacity-60">{recipes.length}</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 whitespace-pre-line">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
            {notice}
          </p>
        )}

        {/* Edit user modal */}
        {editUser && (
          <AdminModal title="Edit user information" onClose={cancelEdit}>
            <p className="text-sm text-slate-500 mb-5">
              Editing <span className="font-semibold text-green-600">@{editUser}</span>
              {" "}— username cannot be changed.
            </p>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={editForm.fullName}
                    onChange={handleEditInput}
                    className={inputClass}
                    placeholder="e.g., Alice Tan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditInput}
                    className={inputClass}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={editForm.phoneNumber}
                    onChange={handleEditInput}
                    className={inputClass}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={editForm.dateOfBirth}
                    onChange={handleEditInput}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                  <select
                    name="gender"
                    value={editForm.gender}
                    onChange={handleEditInput}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              {editUserError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 whitespace-pre-line">
                  {editUserError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 flex-1"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3.5 font-medium">user</th>
                  <th className="px-5 py-3.5 font-medium">contact</th>
                  <th className="px-5 py-3.5 font-medium">role</th>
                  <th className="px-5 py-3.5 font-medium">status</th>
                  <th className="px-5 py-3.5 font-medium">created</th>
                  <th className="px-5 py-3.5 font-medium text-right">actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.username}
                    className={`border-b border-slate-50 last:border-0 ${editUser === u.username ? "bg-green-50/50" : ""
                      } ${u.isActive === false ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {u.username}
                        {u.username === username && (
                          <span className="font-mono text-[11px] text-slate-400 ml-2">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{u.fullName || "—"}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-slate-600">{u.email || "—"}</p>
                      <p className="text-xs text-slate-400">{u.phoneNumber || ""}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-mono text-[11px] px-2.5 py-1 rounded-full
                          ${u.role === "Admin"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-50 text-green-600"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-mono text-[11px] px-2.5 py-1 rounded-full ${u.isActive === false
                          ? "bg-red-50 text-red-600"
                          : "bg-green-50 text-green-600"
                          }`}
                      >
                        {u.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-3">
                      <button
                        onClick={() => startEdit(u)}
                        className="text-green-600 text-sm font-medium hover:text-green-700 hover:underline"
                      >
                        Edit
                      </button>
                      {u.username !== username && (
                        <>
                          <button
                            onClick={() => toggleStatus(u.username, u.isActive !== false)}
                            className={`text-sm font-medium hover:underline ${u.isActive === false
                              ? "text-green-600 hover:text-green-700"
                              : "text-amber-600 hover:text-amber-700"
                              }`}
                          >
                            {u.isActive === false ? "Activate" : "Deactivate"}
                          </button>
                          <button
                            onClick={() =>
                              changeRole(u.username, u.role === "Admin" ? "User" : "Admin")
                            }
                            className="text-green-600 text-sm font-medium hover:text-green-700 hover:underline"
                          >
                            Make {u.role === "Admin" ? "User" : "Admin"}
                          </button>
                          <button
                            onClick={() => deleteUser(u.username)}
                            className="text-red-500 text-sm font-medium hover:underline"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top Recipe Categories tab */}
        {tab === "categories" && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              These tiles appear under <span className="font-semibold">Top Recipe Categories</span> on
              every user's dashboard. Anything added, edited, or removed here shows up there immediately.
            </p>

            <div className="flex flex-col lg:flex-row gap-3">
              <input
                type="search"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories by name, emoji, or color..."
                className={inputClass}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => document.getElementById('colorFilterDropdown').classList.toggle('hidden')}
                  className={`${inputClass} bg-white lg:max-w-xs flex items-center justify-between`}
                >
                  <span>{categoryFilter === "all" ? "All colors" : CATEGORY_COLOR_OPTIONS.find(o => o.key === categoryFilter)?.label}</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div id="colorFilterDropdown" className="hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-10 p-2 min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter("all"); document.getElementById('colorFilterDropdown').classList.add('hidden'); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${categoryFilter === "all" ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}
                  >
                    All colors
                  </button>
                  {CATEGORY_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setCategoryFilter(opt.key); document.getElementById('colorFilterDropdown').classList.add('hidden'); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${categoryFilter === opt.key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-6 h-6 rounded bg-gradient-to-br ${getCategoryGradient(opt.key)}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={startNewCategory}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm shrink-0"
              >
                + Add category
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-50">
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-slate-400 p-5">No categories match your filters.</p>
              ) : (
                filteredCategories.map((c) => {
                  const recipeCount = recipes.filter(r => 
                    r.category === c.name || 
                    (r.categories && r.categories.some(cat => cat.name === c.name))
                  ).length;
                  
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4">
                      <div
                        className={`w-12 h-12 shrink-0 rounded-full bg-gradient-to-br ${getCategoryGradient(c.colorKey)} flex items-center justify-center text-lg border-2 border-brand/20`}
                      >
                        {c.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-400">{recipeCount} recipe{recipeCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button
                          onClick={() => startEditCategory(c)}
                          className="text-green-600 text-sm font-medium hover:text-green-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCategory(c)}
                          className="text-red-500 text-sm font-medium hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {editCategoryId && (
              <AdminModal
                title={editCategoryId === "new" ? "New category" : `Edit '${categoryForm.name}'`}
                onClose={cancelEditCategory}
              >
                <form onSubmit={saveCategory} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={categoryForm.name}
                        onChange={handleCategoryInput}
                        className={inputClass}
                        placeholder="e.g., Mexican"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Emoji</label>
                      <input
                        type="text"
                        name="emoji"
                        value={categoryForm.emoji}
                        onChange={handleCategoryInput}
                        className={inputClass}
                        placeholder="🌮"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Color</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => document.getElementById('colorPickerDropdown').classList.toggle('hidden')}
                          className={`${inputClass} bg-white flex items-center justify-between`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded bg-gradient-to-br ${getCategoryGradient(categoryForm.colorKey)}`} />
                            {CATEGORY_COLOR_OPTIONS.find(o => o.key === categoryForm.colorKey)?.label}
                          </div>
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div id="colorPickerDropdown" className="hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-10 p-2 min-w-[200px]">
                          {CATEGORY_COLOR_OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => { setCategoryForm(prev => ({ ...prev, colorKey: opt.key })); document.getElementById('colorPickerDropdown').classList.add('hidden'); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${categoryForm.colorKey === opt.key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}
                            >
                              <div className={`w-6 h-6 rounded bg-gradient-to-br ${getCategoryGradient(opt.key)}`} />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <span className="text-xs text-slate-500">Preview:</span>
                    <div
                      className={`w-14 h-14 rounded-full bg-gradient-to-br ${getCategoryGradient(categoryForm.colorKey)} flex items-center justify-center text-xl border-2 border-brand/30`}
                    >
                      {categoryForm.emoji}
                    </div>
                  </div>
                  {editCategoryError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 whitespace-pre-line">
                      {editCategoryError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm disabled:opacity-50"
                    >
                      {savingCategory ? "Saving..." : "Save Category"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </AdminModal>
            )}
          </div>
        )}

        {/* Popular Recipes tab */}
        {tab === "recipes" && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              These are the recipes shown under <span className="font-semibold">Popular Recipe</span> on
              the user dashboard. Anything added, edited, or removed here shows up there immediately.
            </p>

            <div className="flex flex-col lg:flex-row gap-3">
              <input
                type="search"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Search recipes by title, category, owner, ingredients, or instructions..."
                className={inputClass}
              />
              <select
                value={recipeFilter}
                onChange={(e) => setRecipeFilter(e.target.value)}
                className={`${inputClass} bg-white lg:max-w-xs`}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={startNewRecipe}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm shrink-0"
              >
                + Add recipe
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-50">
              {filteredRecipes.length === 0 ? (
                <p className="text-sm text-slate-400 p-5">No recipes match your filters.</p>
              ) : (
                filteredRecipes.map((r) => (
                  <div key={r.id} className="flex items-start gap-4 p-4">
                    <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center">
                      {r.imageUrl && r.imageUrl.trim() && r.imageUrl !== "" && r.imageUrl !== "null" ? (
                        <img 
                          src={r.imageUrl} 
                          alt={r.title} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <img 
                          src="/DefaultRecipeImage.png" 
                          alt={r.title} 
                          className="w-full h-full object-cover" 
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">{r.category}</p>
                      <p className="text-xs text-slate-400 mt-1">Owner: {r.ownerName || "AI-Generated"}</p>
                      <p className="text-xs text-slate-400 mt-1 truncate">{r.ingredients}</p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button
                        onClick={() => startEditRecipe(r)}
                        className="text-green-600 text-sm font-medium hover:text-green-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRecipe(r)}
                        className="text-red-500 text-sm font-medium hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {editRecipeId && (
              <AdminModal
                title={editRecipeId === "new" ? "New recipe" : `Edit '${recipeForm.title}'`}
                onClose={cancelEditRecipe}
              >
                <form onSubmit={saveRecipe} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title *</label>
                      <input
                        type="text"
                        name="title"
                        value={recipeForm.title}
                        onChange={handleRecipeInput}
                        className={inputClass}
                        placeholder="e.g., Chicken Rice Bowl"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Owner</label>
                      <input
                        type="text"
                        name="ownerName"
                        value={recipeForm.ownerName}
                        onChange={handleRecipeInput}
                        className={inputClass}
                        placeholder="AI-Generated"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Image URL</label>
                      <input
                        type="text"
                        name="imageUrl"
                        value={recipeForm.imageUrl}
                        onChange={handleRecipeInput}
                        className={inputClass}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Upload Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRecipeImageUpload}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-light file:text-brand hover:file:bg-brand/10"
                      />
                      {recipeForm.imageUrl && (
                        <div className="mt-2">
                          <img
                            src={recipeForm.imageUrl}
                            alt="Recipe preview"
                            className="w-32 h-32 object-cover rounded-lg border border-slate-200"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Categories * <span className="font-normal text-slate-400">(select one or more)</span>
                      </label>
                      {categories.length === 0 ? (
                        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">
                          Recipe categories could not be loaded. Please refresh the page before creating a recipe.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => {
                            const selected = recipeForm.categoryIds.includes(cat.id);

                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleRecipeCategoryId(cat.id)}
                                aria-pressed={selected}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${selected
                                  ? "bg-brand text-white border-brand"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-brand/50"
                                }`}
                              >
                                {cat.emoji} {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ingredients *</label>
                      <textarea
                        name="ingredients"
                        value={recipeForm.ingredients}
                        onChange={handleRecipeInput}
                        className={inputClass}
                        rows={3}
                        placeholder="comma-separated, e.g. chicken breast, rice, broccoli"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cooking Instructions *</label>
                      <textarea
                        name="steps"
                        value={recipeForm.steps}
                        onChange={handleRecipeInput}
                        className={inputClass}
                        rows={4}
                        placeholder="1. Prep ingredients. 2. Cook... 3. Serve."
                        required
                      />
                    </div>
                  </div>
                  {editRecipeError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 whitespace-pre-line">
                      {editRecipeError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={savingRecipe}
                      className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm disabled:opacity-50"
                    >
                      {savingRecipe ? "Saving..." : "Save Recipe"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditRecipe}
                      className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </AdminModal>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminPage;
