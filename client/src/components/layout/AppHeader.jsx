import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserAvatar from "../UserAvatar";

const SEARCH_PLACEHOLDERS = {
  "/": "Search recipes by name, category, or ingredients…",
  "/meal-planner": "Search planned meals by recipe name…",
  "/pantry": "Search pantry items by name or category…",
  "/recipes": "Search recipes by name, category, or ingredients…",
  "/profile": "Search favourite meals…",
};

export default function AppHeader({ searchQuery, onSearchChange, username, onLogout }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isAiPage = pathname === "/ai-assistant";
  const placeholder = SEARCH_PLACEHOLDERS[pathname] || "Search…";
  const hasSearchText = searchQuery.trim().length > 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  function handleViewProfile() {
    setMenuOpen(false);
    navigate("/profile");
  }

  function handleSignOut() {
    setMenuOpen(false);
    onLogout();
  }

  return (
    <header className="flex items-center gap-4 px-6 py-5 border-b border-slate-100/80">
      {isAiPage ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className={`input-soft w-full text-slate-600 placeholder:text-slate-400 ${
              hasSearchText ? "pr-4" : "pr-12"
            }`}
          />
          {!hasSearchText && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand pointer-events-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>
      )}

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          title={username ? `Account — ${username}` : "Account"}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="rounded-full hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <UserAvatar size="md" className="border-brand/20" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-48 soft-card soft-shadow py-1.5 z-50 border border-slate-100"
          >
            {username && (
              <p className="px-4 py-2 text-xs font-semibold text-slate-400 truncate border-b border-slate-100 mb-1">
                @{username}
              </p>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleViewProfile}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-light hover:text-brand transition-colors"
            >
              View profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
