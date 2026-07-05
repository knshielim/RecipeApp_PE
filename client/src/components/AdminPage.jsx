import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:5237";

// Some responses (e.g. 401 from expired tokens) have an empty body —
// parse safely instead of crashing with "Unexpected end of JSON input".
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function TopBar({ username, role, onLogout }) {
  return (
    <nav className="bg-white soft-shadow border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-brand">RecipeApp</h1>
            <span className="text-xs font-semibold bg-brand-light text-brand px-3 py-1 rounded-full">
              {role}
            </span>
          </div>
          <div className="flex items-center gap-4">
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
  fullName: "", email: "", phoneNumber: "", dateOfBirth: "", gender: "", newPassword: ""
};

function AdminPage({ token, username, onLogout }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Edit-user state
  const [editUser, setEditUser] = useState(null); // username being edited, or null
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: authHeaders(),
      });
      if (res.status === 401) throw new Error("Session expired. Please log out and sign in again.");
      if (res.status === 403) throw new Error("Admin access required.");
      if (!res.ok) throw new Error("Could not load users.");
      setUsers(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }, [authHeaders]);

  const loadContent = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/content`, {
        headers: authHeaders(),
      });
      if (res.status === 401) throw new Error("Session expired. Please log out and sign in again.");
      if (res.status === 403) throw new Error("Admin access required.");
      if (!res.ok) throw new Error("Could not load content.");
      setContent(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadUsers();
    loadContent();
  }, [loadUsers, loadContent]);

  async function handleAction(promise, refresh) {
    setError("");
    setNotice("");
    try {
      const res = await promise;
      if (res.status === 401)
        throw new Error("Session expired. Please log out and sign in again.");
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message ?? "Action failed.");
      setNotice(data.message ?? "Done.");
      refresh();
    } catch (err) {
      setError(err.message);
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

  const deleteContent = (id) =>
    window.confirm("Delete this content? This cannot be undone.") &&
    handleAction(
      fetch(`${API}/api/admin/content/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      loadContent
    );

  // ---- Edit user information ----
  const startEdit = (u) => {
    setError("");
    setNotice("");
    setEditUser(u.username);
    setEditForm({
      fullName: u.fullName || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      dateOfBirth: u.dateOfBirth || "",
      gender: u.gender || "",
      newPassword: "",
    });
  };

  const cancelEdit = () => {
    setEditUser(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleEditInput = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) return setError("Full name is required.");
    if (!editForm.email.trim() || !editForm.email.includes("@"))
      return setError("A valid email is required.");
    if (editForm.newPassword && editForm.newPassword.length < 6)
      return setError("New password must be at least 6 characters.");

    setSavingEdit(true);
    await handleAction(
      fetch(`${API}/api/admin/users/${encodeURIComponent(editUser)}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...editForm,
          newPassword: editForm.newPassword || null,
        }),
      }),
      () => {
        loadUsers();
        cancelEdit();
      }
    );
    setSavingEdit(false);
  };

  const tabClass = (active) =>
    `px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
      active
        ? "bg-green-600 text-white"
        : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700"
    }`;

  const inputClass =
    "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm " +
    "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition-all";

  return (
    <div className="min-h-screen bg-surface">
      <TopBar username={username} role="Admin" onLogout={onLogout} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-bold text-2xl text-slate-900">
            Admin panel
          </h1>
          <div className="flex gap-2">
            <button onClick={() => setTab("users")} className={tabClass(tab === "users")}>
              Users{" "}
              <span className="font-mono text-xs opacity-60">{users.length}</span>
            </button>
            <button onClick={() => setTab("content")} className={tabClass(tab === "content")}>
              All content{" "}
              <span className="font-mono text-xs opacity-60">{content.length}</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
            {notice}
          </p>
        )}

        {/* Edit user card */}
        {tab === "users" && editUser && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-bold text-lg text-slate-900 mb-1">
              Edit user information
            </h2>
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
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reset Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={editForm.newPassword}
                    onChange={handleEditInput}
                    className={inputClass}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current"
                  />
                  <p className="text-xs text-slate-400 mt-1">Optional — at least 6 characters if set.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm shadow-sm disabled:opacity-50"
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
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3.5 font-medium">user</th>
                  <th className="px-5 py-3.5 font-medium">contact</th>
                  <th className="px-5 py-3.5 font-medium">role</th>
                  <th className="px-5 py-3.5 font-medium">created</th>
                  <th className="px-5 py-3.5 font-medium text-right">actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.username}
                    className={`border-b border-slate-50 last:border-0 ${
                      editUser === u.username ? "bg-green-50/50" : ""
                    }`}
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

        {/* Content tab */}
        {tab === "content" && (
          <div className="space-y-3">
            {content.length === 0 ? (
              <p className="text-sm text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                No content in the system yet.
              </p>
            ) : (
              content.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    {item.body && (
                      <p className="text-sm text-slate-600 mt-1">{item.body}</p>
                    )}
                    <p className="font-mono text-[11px] text-slate-400 mt-2.5">
                      by{" "}
                      <span className="text-slate-600 font-medium">{item.author}</span>{" "}
                      · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteContent(item.id)}
                    className="text-red-500 text-sm font-medium hover:underline self-start shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminPage;
