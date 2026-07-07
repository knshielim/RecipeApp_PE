import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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

function LoginWrapper({ onLoginSuccess }) {
  const navigate = useNavigate();
  return (
    <LoginPage
      onLoginSuccess={onLoginSuccess}
      onGoToRegister={() => navigate("/register")}
    />
  );
}

function RegisterWrapper() {
  const navigate = useNavigate();
  return (
    <RegistrationPage
      onGoToLogin={() => navigate("/login")}
    />
  );
}

function App() {
  const [auth, setAuth] = useState(null);

  function handleLoginSuccess(token, username, role) {
    setAuth({ token, username, role });
  }

  function handleLogout() {
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

  if (auth.role === "Admin") {
    return (
      <AdminPage
        token={auth.token}
        username={auth.username}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Router>
      <UserProfileProvider token={auth.token} username={auth.username}>
        <AppLayout username={auth.username} onLogout={handleLogout}>
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  token={auth.token}
                  username={auth.username}
                  role={auth.role}
                  onLogout={handleLogout}
                />
              }
            />
            <Route path="/meal-planner" element={<MealPlanner />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/recipes" element={<RecipesPage username={auth.username} />} />
            <Route path="/recipes/:id" element={<RecipeDetail username={auth.username} />} />
            <Route path="/profile" element={<Profile token={auth.token} username={auth.username} />} />
            <Route path="/ai-assistant" element={<AIAssistantChat token={auth.token} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </UserProfileProvider>
    </Router>
  );
}

export default App;
