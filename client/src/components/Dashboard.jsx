import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = "http://localhost:5237";
const USER_ID = 1;

export default function Dashboard() {
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [stats, setStats] = useState({ totalRecipes: 0, totalMealPlans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch recent recipes
      const recipesRes = await fetch(`${API}/api/dashboard/recent-recipes/${USER_ID}`);
      const recipesData = await recipesRes.json();
      setRecentRecipes(recipesData);

      // Fetch weekly plan
      const planRes = await fetch(`${API}/api/dashboard/weekly-summary/${USER_ID}`);
      const planData = await planRes.json();
      setWeeklyPlan(planData);

      // Fetch stats
      const statsRes = await fetch(`${API}/api/dashboard/stats/${USER_ID}`);
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDate = () => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Welcome Section */}
      <div className="bg-gradient-to-r from-[#203966] to-[#2a4a7a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome to Your Kitchen!</h1>
              <p className="text-lg text-blue-100 mb-1">{getCurrentDate()}</p>
              <p className="text-blue-200">Your meal planning journey starts here. Let's cook something amazing!</p>
            </div>
            <div className="hidden md:block text-right">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-sm text-blue-100">Total Recipes</p>
                <p className="text-3xl font-bold">{stats.totalRecipes}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Recipes Saved</p>
                <p className="text-3xl font-bold text-[#203966]">{stats.totalRecipes}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Meals Planned</p>
                <p className="text-3xl font-bold text-[#203966]">{stats.totalMealPlans}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">AI Assistant</p>
                <p className="text-3xl font-bold text-[#203966]">Ready</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Recent Recipes */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Your Recent Recipes</h2>
                <Link to="/ai-assistant" className="text-[#203966] hover:text-[#2a4a7a] font-medium text-sm">
                  View All →
                </Link>
              </div>
              
              {recentRecipes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentRecipes.map((recipe) => (
                    <div key={recipe.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="bg-gradient-to-br from-orange-100 to-orange-200 h-32 flex items-center justify-center">
                        <svg className="w-16 h-16 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="p-4">
                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                          {recipe.category}
                        </span>
                        <h3 className="font-semibold text-gray-900 mt-2">{recipe.title}</h3>
                        <p className="text-sm text-gray-500 mt-1 truncate">{recipe.ingredients}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 mb-4">No recipes saved yet</p>
                  <Link
                    to="/ai-assistant"
                    className="bg-[#203966] text-white px-6 py-2 rounded-lg hover:bg-[#2a4a7a] transition-colors inline-block"
                  >
                    Ask AI for Recipe Ideas
                  </Link>
                </div>
              )}
            </div>

            {/* What Now Section - Tips */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What's Next?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                  <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Quick Meal Ideas</h3>
                  <p className="text-sm text-gray-500">Ask our AI assistant for personalized meal suggestions based on your preferences.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                  <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Plan Your Week</h3>
                  <p className="text-sm text-gray-500">Generate a complete weekly meal plan with breakfast, lunch, and dinner.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                  <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Set Preferences</h3>
                  <p className="text-sm text-gray-500">Customize your diet goals, allergies, and food preferences for better recommendations.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Weekly Plan Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Weekly Plan Summary</h2>
              
              {weeklyPlan.length > 0 ? (
                <div className="space-y-3">
                  {weeklyPlan.slice(0, 5).map((day) => (
                    <div key={day.day} className="border-b border-gray-100 pb-3 last:border-0">
                      <p className="font-semibold text-gray-900 capitalize text-sm">{day.day}</p>
                      <div className="mt-1 space-y-1">
                        {day.meals.slice(0, 2).map((meal, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
                              {meal.mealSlot}
                            </span>
                            <span className="text-xs text-gray-600 truncate">{meal.recipeTitle}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm mb-3">No meals planned yet</p>
                  <Link
                    to="/ai-assistant"
                    className="text-[#203966] hover:text-[#2a4a7a] font-medium text-sm"
                  >
                    Generate Plan →
                  </Link>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link
                  to="/ai-assistant"
                  className="w-full bg-[#203966] text-white px-4 py-2 rounded-lg hover:bg-[#2a4a7a] transition-colors text-center block font-medium"
                >
                  Go to AI Assistant
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
