import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSearch } from './layout/AppLayout';
import { getFavoriteRecipes, addFavoriteRecipe, removeFavoriteRecipe, getRecipes } from '../api/recipes';
import { isSearchActive } from '../utils/search';
import { getRecipeCategoryNames, recipeMatchesCategory } from '../utils/recipeCategories';
import UserAvatar from './UserAvatar';
import { useUserProfile } from '../context/UserProfileContext';
import RecipeCard from './RecipeCard';
import { API_BASE, parseApiResponse, formatFetchError } from '../utils/apiError';

const API = API_BASE;

const MEAL_TIMES = {
  breakfast: '8:00 AM',
  lunch: '12:30 PM',
  dinner: '6:30 PM',
};

const SITE_FEATURES = [
  {
    icon: '/Icon-02.png',
    title: 'Dashboard',
    desc: 'Browse your saved recipes, filter by category, search by name or ingredients, and heart meals to save them as favourites.',
  },
  {
    icon: '/Icon-03.png',
    title: 'Meal Planner',
    desc: 'Plan breakfast, lunch, and dinner for each day of the week, auto-generate a full plan from your recipes, and create a grocery shopping list.',
  },
  {
    icon: '/Icon-04.png',
    title: 'Recipes',
    desc: 'Create and store custom recipes with images, add detailed ingredients and cooking steps, and organize recipes by categories.',
  },
  {
    icon: '/Icon-05.png',
    title: 'AI Assistant',
    desc: 'Ask for meal ideas, summarize your recipes, generate a weekly plan, check what you can cook from your pantry, and set dietary preferences.',
  },
  {
    icon: '/Icon-06.png',
    title: 'My Pantry',
    desc: 'Track ingredients, scan grocery receipts or photos to add items automatically, manage expiry dates, and get meal suggestions based on available ingredients.',
  },
  {
    icon: '/Icon-01.png',
    title: 'Profile',
    desc: 'Update your account details, set dietary goals and restrictions, view favorite saved meals, and track your cooking history.',
  },
];

export default function Dashboard({ token, username }) {
  const { searchQuery } = useSearch();
  const { displayName } = useUserProfile();
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [stats, setStats] = useState({ totalMealPlans: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }

    if (username) {
      loadFavorites();
    }
  }, [token, username]);

  useEffect(() => {
    if (!isSearchActive(searchQuery)) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);

      try {
        const data = await getRecipes(searchQuery.trim(), '');
        if (!cancelled) setSearchResults(data);
      } catch (error) {
        console.error('Error searching recipes:', formatFetchError(error));
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  async function loadFavorites() {
    try {
      const favorites = await getFavoriteRecipes(username);
      setFavoriteIds(new Set(favorites.map((f) => f.id)));
      setFavoriteRecipes(favorites);
    } catch {
      setFavoriteIds(new Set());
      setFavoriteRecipes([]);
    }
  }

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const authHeaders = {
        Authorization: `Bearer ${token}`,
      };

      const [recipesRes, planRes, statsRes, categoriesRes] = await Promise.all([
        fetch(`${API}/api/dashboard/recent-recipes`, {
          headers: authHeaders,
        }),
        fetch(`${API}/api/dashboard/weekly-summary`, {
          headers: authHeaders,
        }),
        fetch(`${API}/api/dashboard/stats`, {
          headers: authHeaders,
        }),
        fetch(`${API}/api/dashboard/categories`),
      ]);

      const [recipesData, planData, statsData] = await Promise.all([
        parseApiResponse(recipesRes, 'Could not load recent recipes.'),
        parseApiResponse(planRes, 'Could not load weekly summary.'),
        parseApiResponse(statsRes, 'Could not load dashboard stats.'),
      ]);

      const categoriesData = categoriesRes.ok
        ? await parseApiResponse(categoriesRes, 'Could not load categories.')
        : [];

      setRecentRecipes(recipesData);
      setWeeklyPlan(planData);
      setStats(statsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching dashboard data:', formatFetchError(error));
      setRecentRecipes([]);
      setWeeklyPlan([]);
      setStats({ totalMealPlans: 0 });
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = useMemo(() => {
    let list = isSearchActive(searchQuery) ? searchResults : recentRecipes;

    if (activeCategory && !isSearchActive(searchQuery)) {
      list = list.filter((r) => recipeMatchesCategory(r, activeCategory));
    }

    return list;
  }, [recentRecipes, searchResults, activeCategory, searchQuery]);

  const isSearching = isSearchActive(searchQuery);

  const handleToggleFavorite = async (recipe) => {
    if (!username) return;

    try {
      if (favoriteIds.has(recipe.id)) {
        await removeFavoriteRecipe(recipe.id, username);

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(recipe.id);
          return next;
        });

        setFavoriteRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
      } else {
        await addFavoriteRecipe(recipe.id, username);

        setFavoriteIds((prev) => new Set(prev).add(recipe.id));

        setFavoriteRecipes((prev) => [...prev, recipe]);
      }
    } catch (err) {
      console.error('Failed to update favourite:', formatFetchError(err));
    }
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

    favoriteRecipes.forEach((r) => {
      const names = getRecipeCategoryNames(r);

      if (names.length === 0) {
        counts.Other = (counts.Other || 0) + 1;
        return;
      }

      names.forEach((cat) => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [favoriteRecipes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-6 lg:gap-8">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-8">
          {!isSearching && (
            <>
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
            </>
          )}

          {/* Recent Recipes */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
              <h2 className="section-title">{isSearching ? 'Search Results' : 'Recent Recipes'}</h2>
              {isSearching && (
                <p className="text-sm text-slate-500">
                  {filteredRecipes.length} result{filteredRecipes.length !== 1 ? 's' : ''} for &ldquo;{searchQuery.trim()}&rdquo;
                </p>
              )}
            </div>

            {searchLoading ? (
              <div className="soft-card p-10 text-center text-slate-500">Searching recipes...</div>
            ) : filteredRecipes.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      detailPath={`/recipes/${recipe.id}`}
                      favoriteButton={
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(recipe)}
                          title={favoriteIds.has(recipe.id) ? 'Remove from favourites' : 'Add to favourites'}
                          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/90 shadow-sm hover:scale-105 transition-transform"
                        >
                          <span className="text-lg">
                            {favoriteIds.has(recipe.id) ? "★" : "☆"}
                          </span>
                        </button>
                      }
                    />
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <Link to="/recipes" className="btn-primary inline-block text-sm">
                    View More Recipes
                  </Link>
                </div>
              </>
            ) : (
              <div className="soft-card p-10 text-center">
                <span className="text-5xl">🍳</span>
                <p className="text-slate-500 mt-4 mb-5">
                  {isSearching || activeCategory
                    ? 'No recipes match your search.'
                    : 'No recipes saved yet'}
                </p>
                {!isSearching && (
                  <Link to="/ai-assistant" className="btn-primary inline-block text-sm">
                    Ask AI for Recipe Ideas
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Events sidebar */}
        {!isSearching && (
          <aside className="hidden xl:block w-72 shrink-0">
            <h2 className="section-title mb-4 leading-snug">
              Meals you may be interested
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
        )}
      </div>

      {/* Full-width features section */}
      {!isSearching && (
        <section className="w-full">
          <h2 className="section-title mb-1">What can you do on our website?</h2>
          <p className="text-sm text-slate-500 mb-4">Here&apos;s a quick guide to everything Nomly offers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SITE_FEATURES.map((feature) => (
              <div key={feature.title} className="soft-card p-5">
                {feature.icon.startsWith('/') ? (
                  <img src={feature.icon} alt={feature.title} className="w-10 h-10" />
                ) : (
                  <span className="text-2xl">{feature.icon}</span>
                )}
                <h3 className="font-bold text-slate-800 mt-3">{feature.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}