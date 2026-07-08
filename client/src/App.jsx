import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import LoginPage from "./components/LoginPage";
import RegistrationPage from "./components/RegistrationPage";
import Dashboard from "./components/Dashboard";
import AdminPage from "./components/AdminPage";
import Profile from "./components/Profile";
import AIAssistantChat from "./components/AIAssistantChat";
import PantryPage from "./components/PantryPage";
import RecipesPage from "./components/RecipesPage";
import RecipeDetail from "./components/RecipeDetail";
import MealPlanner from "./components/MealPlanner";
import AppLayout from "./components/layout/AppLayout";
import { UserProfileProvider } from "./context/UserProfileContext";
import "./index.css";

const AUTH_STORAGE_KEY = "nomly_auth";

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredAuth(auth) {
  try {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode errors
  }
}

function clearLegacyAuthStorage() {
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
  } catch {
    // ignore storage errors
  }
}

function LoginWrapper({ onLoginSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <LoginPage
      onLoginSuccess={onLoginSuccess}
      onGoToRegister={() => navigate("/register")}
      initialUsername={location.state?.username || ""}
      justRegistered={Boolean(location.state?.justRegistered)}
    />
  );
}

function RegisterWrapper() {
  const navigate = useNavigate();
  return (
    <RegistrationPage
      onGoToLogin={(username) =>
        navigate(
          "/login",
          typeof username === "string" && username
            ? { state: { username, justRegistered: true } }
            : undefined
        )
      }
    />
  );
}

function ProtectedRoute({ children, allowedRoles, auth }) {
  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    const homePath = auth.role === "Admin" ? "/admin" : "/";
    return <Navigate to={homePath} replace />;
  }

  return children;
}

function UserAppShell({ auth, onLogout }) {
  const isAdmin = auth.role === "Admin";
  return (
    <UserProfileProvider token={auth.token} username={auth.username}>
      <AppLayout username={auth.username} onLogout={onLogout} isAdmin={isAdmin}>
        <Outlet />
      </AppLayout>
    </UserProfileProvider>
  );
}

function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  useEffect(() => {
    setStoredAuth(auth);
  }, [auth]);

  function handleLoginSuccess(token, username, role) {
    clearLegacyAuthStorage();
    setAuth({ token, username, role });
  }

  function handleLogout() {
    clearLegacyAuthStorage();
    setAuth(null);
  }

  if (!auth) {
    return (
      <Router>
        <Routes>
          <Route
            path="/login"
            element={<LoginWrapper onLoginSuccess={handleLoginSuccess} />}
          />
          <Route
            path="/register"
            element={<RegisterWrapper />}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  const isAdmin = auth.role === "Admin";
  const homePath = isAdmin ? "/admin" : "/";

  return (
    <Router>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["Admin"]} auth={auth}>
              <AdminPage
                token={auth.token}
                username={auth.username}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          element={<UserAppShell auth={auth} onLogout={handleLogout} />}
        >
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <Dashboard
                  token={auth.token}
                  username={auth.username}
                  role={auth.role}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meal-planner"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <MealPlanner token={auth.token} username={auth.username} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <PantryPage
                  token={auth.token}
                  username={auth.username}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <RecipesPage username={auth.username} isAdmin={isAdmin} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes/:id"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <RecipeDetail username={auth.username} isAdmin={isAdmin} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <Profile token={auth.token} username={auth.username} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute allowedRoles={["User", "Admin"]} auth={auth}>
                <AIAssistantChat token={auth.token} />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
