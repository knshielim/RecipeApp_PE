import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSearch } from './layout/AppLayout';
import { getFavoriteMeals, toggleFavoriteMeal } from '../utils/favoriteMeals';
import UserAvatar from './UserAvatar';
import { useUserProfile } from '../context/UserProfileContext';

const API = "http://localhost:5237";
const USER_ID = 1;

const RECIPE_CATEGORIES = [
  { name: 'Tacos', emoji: '🌮', color: 'from-amber-100 to-orange-200' },
  { name: 'Bowls', emoji: '🥗', color: 'from-green-100 to-emerald-200' },
  { name: 'Veggie', emoji: '🥦', color: 'from-lime-100 to-green-200' },
  { name: 'Breakfast', emoji: '🍳', color: 'from-yellow-100 to-amber-200' },
  { name: 'Dessert', emoji: '🍰', color: 'from-pink-100 to-rose-200' },
  { name: 'Thai', emoji: '🍜', color: 'from-red-100 to-orange-200' },
  { name: 'Grilled', emoji: '🥩', color: 'from-stone-100 to-amber-200' },
];

const MEAL_TIMES = {
  breakfast: '8:00 AM',
  lunch: '12:30 PM',
  dinner: '6:30 PM',
};

const SITE_FEATURES = [
  {
    icon: '🏠',
    title: 'Dashboard',
    desc: 'Browse your saved recipes, filter by category, search by name or ingredients, and heart meals to save them as favourites.',
  },
  {
    icon: '📅',
    title: 'Events',
    desc: 'Plan breakfast, lunch, and dinner for each day of the week, auto-generate a full plan from your recipes, and create a grocery shopping list.',
  },
  {
    icon: '💬',
    title: 'AI Assistant',
    desc: 'Ask for meal ideas, summarize your recipes, generate a weekly plan, check what you can cook from your pantry, and set dietary preferences.',
  },
  {
    icon: '👤',
    title: 'Profile',
    desc: 'Update your account details, manage pantry items, scan grocery receipts or photos, and view your favourite saved meals.',
  },
];

function StarRating() {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-500">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      4.7
    </span>
  );
}

export default function Dashboard({ username }) {
  const { searchQuery } = useSearch();
  const { displayName } = useUserProfile();
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [stats, setStats] = useState({ totalMealPlans: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() =>
    new Set(getFavoriteMeals(USER_ID).map((m) => m.id))
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [recipesRes, planRes, statsRes] = await Promise.all([
        fetch(`${API}/api/dashboard/recent-recipes/${USER_ID}`),
        fetch(`${API}/api/dashboard/weekly-summary/${USER_ID}`),
        fetch(`${API}/api/dashboard/stats/${USER_ID}`),
      ]);
      setRecentRecipes(await recipesRes.json());
      setWeeklyPlan(await planRes.json());
      setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = useMemo(() => {
    let list = recentRecipes;
    if (activeCategory) {
      list = list.filter((r) =>
        r.category?.toLowerCase().includes(activeCategory.toLowerCase())
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          r.ingredients?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [recentRecipes, activeCategory, searchQuery]);

  const handleToggleFavorite = (recipe) => {
    toggleFavoriteMeal(USER_ID, recipe);
    setFavoriteIds(new Set(getFavoriteMeals(USER_ID).map((m) => m.id)));
  };

  const eventCards = useMemo(() => {
    const cards = [];
    weeklyPlan.forEach((day) => {
      day.meals?.forEach((meal) => {
        cards.push({
          id: `${day.day}-${meal.mealSlot}`,
          title: meal.recipeTitle,
          day: day.day,
          slot: meal.mealSlot,
          time: MEAL_TIMES[meal.mealSlot] || '6:30 PM',
        });
      });
    });
    return cards.slice(0, 5);
  }, [weeklyPlan]);

  const weeklyChartData = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.map((day) => {
      const entry = weeklyPlan.find((d) => d.day === day);
      return {
        day: day.slice(0, 3),
        meals: entry?.meals?.length ?? 0,
      };
    });
  }, [weeklyPlan]);

  const categoryChartData = useMemo(() => {
    const counts = {};
    recentRecipes.forEach((r) => {
      const cat = r.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [recentRecipes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 lg:gap-8">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Overview: stat + charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="soft-card px-5 py-5 flex flex-col justify-center">
            <p className="text-xs text-slate-400 font-medium">Meals Planned</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.totalMealPlans}</p>
            <p className="text-xs text-slate-500 mt-2">Across your current weekly plan</p>
          </div>

          <div className="soft-card p-5 lg:col-span-2">
            <h2 className="section-title text-base mb-4">Meals This Week</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ece9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value} meal${value !== 1 ? 's' : ''}`, 'Planned']}
                />
                <Bar dataKey="meals" fill="#3d7a52" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {categoryChartData.length > 0 && (
          <div className="soft-card p-5">
            <h2 className="section-title text-base mb-1">Recipes by Category</h2>
            <p className="text-xs text-slate-500 mb-4">A snapshot of your saved recipe collection</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ece9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#5a9a6e" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Recipe Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Recipe Categories</h2>
            <button type="button" className="text-brand p-1 rounded-full hover:bg-brand-light transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-thin">
            {RECIPE_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                className="flex flex-col items-center gap-2 shrink-0 group"
              >
                <div
                  className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all ${
                    activeCategory === cat.name
                      ? 'border-brand shadow-md scale-105'
                      : 'border-brand/30 group-hover:border-brand/60'
                  }`}
                >
                  {cat.emoji}
                </div>
                <span className={`text-xs font-semibold ${activeCategory === cat.name ? 'text-brand' : 'text-slate-600'}`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Popular Recipes */}
        <section>
          <h2 className="section-title mb-4">Popular Recipe</h2>

          {filteredRecipes.length > 0 ? (
            <div className="space-y-4">
              {filteredRecipes.map((recipe) => (
                <article
                  key={recipe.id}
                  className="soft-card flex gap-4 sm:gap-5 p-3 sm:p-4 hover:shadow-lg transition-shadow duration-200 relative"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(recipe)}
                    title={favoriteIds.has(recipe.id) ? 'Remove from favourites' : 'Add to favourites'}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 w-9 h-9 rounded-full flex items-center justify-center bg-white/90 shadow-sm hover:scale-105 transition-transform"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-5 h-5 ${favoriteIds.has(recipe.id) ? 'fill-red-500 text-red-500' : 'fill-none text-slate-400'}`}
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className={`w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center`}>
                    <span className="text-4xl sm:text-5xl">🍽️</span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <h3 className="font-bold text-slate-800 text-base sm:text-lg leading-snug">
                      {recipe.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-slate-500">
                      <StarRating />
                      <span className="text-slate-300">|</span>
                      <span>{recipe.category}</span>
                      <span className="text-slate-300">|</span>
                      <span>20 mins</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 truncate hidden sm:block">
                      {recipe.ingredients}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <UserAvatar size="xs" />
                      <span className="text-xs text-slate-500">
                        Upload by <span className="font-semibold text-slate-700">{displayName}</span>
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="soft-card p-10 text-center">
              <span className="text-5xl">🍳</span>
              <p className="text-slate-500 mt-4 mb-5">
                {searchQuery || activeCategory
                  ? 'No recipes match your search.'
                  : 'No recipes saved yet'}
              </p>
              <Link to="/ai-assistant" className="btn-primary inline-block text-sm">
                Ask AI for Recipe Ideas
              </Link>
            </div>
          )}
        </section>

        {/* What you can do */}
        <section>
          <h2 className="section-title mb-1">What can you do on our website?</h2>
          <p className="text-sm text-slate-500 mb-4">Here&apos;s a quick guide to everything RecipeApp offers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SITE_FEATURES.map((feature) => (
              <div key={feature.title} className="soft-card p-5">
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="font-bold text-slate-800 mt-3">{feature.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Events sidebar */}
      <aside className="hidden xl:block w-72 shrink-0">
        <h2 className="section-title mb-4 leading-snug">
          Events you may be interested
        </h2>

        {eventCards.length > 0 ? (
          <div className="space-y-3">
            {eventCards.map((event) => (
              <article key={event.id} className="soft-card flex gap-3 p-3 hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 shrink-0 rounded-xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center text-2xl">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm leading-snug truncate">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-3.5 h-3.5 text-brand shrink-0">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" strokeLinecap="round" />
                    </svg>
                    <span className="capitalize">{event.day}</span>
                    <span className="text-slate-300">|</span>
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <UserAvatar size="xs" />
                    <span className="text-[11px] text-slate-500">
                      Cook with <span className="font-semibold text-slate-700">{displayName}</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="soft-card p-6 text-center">
            <span className="text-3xl">📅</span>
            <p className="text-sm text-slate-500 mt-3 mb-4">No meals planned yet</p>
            <Link to="/meal-planner" className="text-brand font-semibold text-sm hover:underline">
              Plan your week →
            </Link>
          </div>
        )}

        <div className="mt-5">
          <Link to="/ai-assistant" className="btn-primary w-full text-center block text-sm">
            Go to AI Assistant
          </Link>
        </div>
      </aside>
    </div>
  );
}
