import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import RegistrationPage from "./components/RegistrationPage";
import Dashboard from "./components/Dashboard";
import AdminPage from "./components/AdminPage";
import Profile from "./components/Profile";
import AIAssistantChat from "./components/AIAssistantChat";
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
      <div className="min-h-screen bg-slate-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-2xl font-bold text-green-600">RecipeApp</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {[
                    { to: "/", label: "Dashboard", end: true },
                    { to: "/profile", label: "Profile" },
                    { to: "/ai-assistant", label: "AI Assistant" },
                  ].map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                          isActive
                            ? "border-green-600 text-slate-900"
                            : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center">
                <button
                  onClick={handleLogout}
                  className="ml-4 px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

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
          <Route path="/profile" element={<Profile token={auth.token} username={auth.username} />} />
          <Route path="/ai-assistant" element={<AIAssistantChat token={auth.token} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
