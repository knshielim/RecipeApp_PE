import { Link } from "react-router-dom";
import UserAvatar from "../UserAvatar";

export default function AppHeader({ searchQuery, onSearchChange, username }) {
  return (
    <header className="flex items-center gap-4 px-6 py-5 border-b border-slate-100/80">
      <div className="flex-1 relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="input-soft w-full pr-12 text-slate-600 placeholder:text-slate-400"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/meal-planner"
          title="Meal Planner & Grocery List"
          className="w-10 h-10 rounded-full flex items-center justify-center text-brand hover:bg-brand-light transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" strokeLinecap="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" strokeLinejoin="round" />
          </svg>
        </Link>

        <Link
          to="/profile"
          title={username ? `Profile — ${username}` : "Profile"}
          className="rounded-full hover:opacity-90 transition-opacity"
        >
          <UserAvatar size="md" className="border-brand/20" />
        </Link>
      </div>
    </header>
  );
}
