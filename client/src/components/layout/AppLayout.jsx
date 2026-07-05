import { useState, createContext, useContext } from "react";
import { NavLink } from "react-router-dom";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";

export const SearchContext = createContext({ searchQuery: "", setSearchQuery: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

export default function AppLayout({ children, username, onLogout }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <div className="min-h-screen bg-surface p-3 sm:p-4 lg:p-6">
        <div className="flex gap-3 sm:gap-4 max-w-[1500px] mx-auto min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)]">
          <Sidebar onLogout={onLogout} />

          <div className="flex-1 soft-card soft-shadow flex flex-col overflow-hidden min-w-0">
            <AppHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              username={username}
            />

            {/* Mobile nav */}
            <nav className="md:hidden flex items-center justify-around px-2 py-2 border-b border-slate-100 bg-white/80">
              {[
                { to: "/", label: "Dashboard", end: true },
                { to: "/meal-planner", label: "Events" },
                { to: "/ai-assistant", label: "AI Assistant" },
              ].map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      isActive ? "bg-brand text-white" : "text-brand hover:bg-brand-light"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SearchContext.Provider>
  );
}
