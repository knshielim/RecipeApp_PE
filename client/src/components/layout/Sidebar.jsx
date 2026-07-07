import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/meal-planner",
    label: "Meal Planner",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/pantry",
    label: "My Pantry",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/recipes",
    label: "Recipes",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <path d="M4 5h16v14H4z" strokeLinejoin="round" />
        <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/ai-assistant",
    label: "AI Assistant",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Sidebar({ isAdmin = false }) {
  return (
    <aside className="hidden md:flex flex-col items-center w-[88px] shrink-0 py-6 gap-1">
      <div className="soft-card flex flex-col items-center py-6 px-3 gap-1 h-full min-h-[520px]">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl w-full transition-all duration-150 ${isActive
                ? "bg-brand text-white"
                : "text-brand hover:bg-brand-light"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? "text-white" : "text-brand"}>
                  {item.icon()}
                </span>
                <span className={`text-[10px] font-semibold leading-tight text-center ${isActive ? "text-white" : "text-brand"}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl w-full transition-all duration-150 mt-2 border-t border-slate-100 pt-4 ${
                isActive ? "bg-amber-600 text-white" : "text-amber-700 hover:bg-amber-50"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? "text-white" : "text-amber-700"}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
                    <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className={`text-[10px] font-semibold leading-tight text-center ${isActive ? "text-white" : "text-amber-700"}`}>
                  Admin
                </span>
              </>
            )}
          </NavLink>
        )}
      </div>
    </aside>
  );
}
