import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getFavoriteRecipes, removeFavoriteRecipe } from '../api/recipes';
import { useUserProfile } from '../context/UserProfileContext';
import { useSearch } from './layout/AppLayout';
import { matchesSearch, isSearchActive } from '../utils/search';
import RecipeCard from './RecipeCard';
import UserAvatar from './UserAvatar';
import { resizeImageFile } from '../utils/profilePicture';
import { API_BASE, parseApiResponse, formatFetchError } from '../utils/apiError';

const API = API_BASE;
const USER_ID = 1;

export default function Profile({ token, username }) {
  const { displayName, profile, updateProfilePicture } = useUserProfile();
  const { searchQuery } = useSearch();
  const pictureInputRef = useRef(null);
  const [pictureStatus, setPictureStatus] = useState({ type: '', msg: '' });
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [mealStats, setMealStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({ totalRecipes: 0, totalMealPlans: 0 });
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    fullName: '', email: '', phoneNumber: '', dateOfBirth: '', gender: '',
  });
  const [accountStatus, setAccountStatus] = useState({ type: '', msg: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [favoriteMeals, setFavoriteMeals] = useState([]);

  useEffect(() => {
    fetchProfileData();
    fetchAccount();
    if (username) loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function loadFavorites() {
    try {
      const data = await getFavoriteRecipes(username);
      setFavoriteMeals(data);
    } catch {
      setFavoriteMeals([]);
    }
  }

  const fetchAccount = async () => {
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await parseApiResponse(res, 'Could not load account information.');

      setAccount(data);
      setAccountForm({
        fullName: data.fullName || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: data.gender || '',
      });
    } catch (error) {
      setAccountStatus({ type: 'error', msg: formatFetchError(error) });
    }
  };

  const handleAccountInput = (e) => {
    const { name, value } = e.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
    setAccountStatus({ type: '', msg: '' });
  };

  const handleAccountSave = async (e) => {
    e.preventDefault();

    if (!accountForm.fullName.trim()) {
      setAccountStatus({ type: 'error', msg: 'Full name is required.' });
      return;
    }

    if (!accountForm.email.trim() || !accountForm.email.includes('@')) {
      setAccountStatus({ type: 'error', msg: 'A valid email is required.' });
      return;
    }

    setSavingAccount(true);

    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: accountForm.fullName.trim(),
          email: accountForm.email.trim(),
          phoneNumber: accountForm.phoneNumber.trim(),
          dateOfBirth: accountForm.dateOfBirth,
          gender: accountForm.gender,
        }),
      });

      const data = await parseApiResponse(res, 'Failed to update profile.');

      setAccountStatus({ type: 'success', msg: data.message || 'Profile updated.' });
      setEditingAccount(false);
      fetchAccount();
    } catch (error) {
      setAccountStatus({ type: 'error', msg: formatFetchError(error) });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleAccountCancel = () => {
    setEditingAccount(false);
    setAccountStatus({ type: '', msg: '' });
    if (account) {
      setAccountForm({
        fullName: account.fullName || '',
        email: account.email || '',
        phoneNumber: account.phoneNumber || '',
        dateOfBirth: account.dateOfBirth || '',
        gender: account.gender || '',
      });
    }
  };

  const fetchProfileData = async () => {
    try {
      const [statsRes, activityRes, dashStatsRes] = await Promise.all([
        fetch(`${API}/api/profile/meal-stats/${USER_ID}`),
        fetch(`${API}/api/profile/recent-activity/${USER_ID}`),
        fetch(`${API}/api/dashboard/stats/${USER_ID}`),
      ]);

      setMealStats(await statsRes.json());
      setRecentActivity(await activityRes.json());
      setDashboardStats(await dashStatsRes.json());
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (recipeId) => {
    try {
      await removeFavoriteRecipe(recipeId, username);
      setFavoriteMeals((prev) => prev.filter((m) => m.id !== recipeId));
    } catch (err) {
      console.error('Failed to remove favourite:', err);
    }
  };

  const handlePicturePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPicture(true);
    setPictureStatus({ type: '', msg: '' });
    try {
      const dataUrl = await resizeImageFile(file);
      const result = await updateProfilePicture(dataUrl);
      setPictureStatus({
        type: result.localOnly ? 'warning' : 'success',
        msg: result.message || 'Profile picture updated.',
      });
    } catch (error) {
      setPictureStatus({ type: 'error', msg: error.message || 'Failed to update profile picture.' });
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleRemovePicture = async () => {
    setUploadingPicture(true);
    setPictureStatus({ type: '', msg: '' });
    try {
      const result = await updateProfilePicture(null);
      setPictureStatus({
        type: result.localOnly ? 'warning' : 'success',
        msg: result.message || 'Profile picture removed.',
      });
    } catch (error) {
      setPictureStatus({ type: 'error', msg: error.message || 'Failed to remove profile picture.' });
    } finally {
      setUploadingPicture(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredFavoriteMeals = useMemo(() => {
    if (!searchQuery.trim()) return favoriteMeals;
    return favoriteMeals.filter((meal) =>
      matchesSearch(searchQuery, meal.title, meal.category, meal.ingredients)
    );
  }, [favoriteMeals, searchQuery]);

  const isSearching = isSearchActive(searchQuery);
  const showFavoritesSection = !isSearching || filteredFavoriteMeals.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {!isSearching && (
        <div className="flex items-center gap-5 mb-8">
          <div className="relative shrink-0">
            <UserAvatar size="lg" className="border-4 border-white shadow-md" />
            <button
              type="button"
              onClick={() => pictureInputRef.current?.click()}
              disabled={uploadingPicture}
              title="Change profile picture"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-md hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePicturePick}
            />
          </div>
          <div>
            <h1 className="section-title text-2xl">
              {account?.fullName || displayName || 'My Profile'}
            </h1>
            {account && (
              <p className="text-brand-muted text-sm mt-0.5">
                @{account.username} · {account.role}
              </p>
            )}
            <p className="text-slate-500 text-sm mt-1">Manage your account and track your cooking journey</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => pictureInputRef.current?.click()}
                disabled={uploadingPicture}
                className="text-sm font-semibold text-brand hover:underline disabled:opacity-50"
              >
                {uploadingPicture ? 'Uploading...' : 'Change photo'}
              </button>
              <button
                type="button"
                onClick={handleRemovePicture}
                disabled={uploadingPicture || !profile.profilePicture}
                className="text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                Remove photo
              </button>
              <Link to="/pantry" className="text-sm font-semibold text-brand hover:underline">
                Go to My Pantry →
              </Link>
            </div>
            {pictureStatus.msg && (
              <p className={`text-sm mt-2 ${pictureStatus.type === 'success'
                ? 'text-brand'
                : pictureStatus.type === 'warning'
                  ? 'text-amber-700'
                  : 'text-red-600'
                }`}>
                {pictureStatus.msg}
              </p>
            )}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isSearching ? '' : 'lg:grid-cols-3'} gap-6`}>
        <div className={`${isSearching ? '' : 'lg:col-span-2'} space-y-6`}>
          {!isSearching && (
            <div className="soft-card p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Account Information</h2>
                <button
                  onClick={() => { setEditingAccount(true); setAccountStatus({ type: '', msg: '' }); }}
                  className="btn-primary text-sm"
                >
                  Edit Profile
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-sm text-slate-500">Username</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.username || username || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.fullName || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone Number</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.phoneNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date of Birth</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.dateOfBirth ? formatDate(account.dateOfBirth) : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Gender</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{account?.gender || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {showFavoritesSection && (
            <div className="soft-card p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">{isSearching ? 'Search Results — Favourites' : 'Favourite Meals'}</h2>
                <span className="text-sm font-semibold text-brand bg-brand-light px-3 sm:px-4 py-1.5 rounded-full">
                  {isSearching
                    ? `${filteredFavoriteMeals.length} match${filteredFavoriteMeals.length !== 1 ? 'es' : ''}`
                    : `${favoriteMeals.length} saved`}
                </span>
              </div>

              {filteredFavoriteMeals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFavoriteMeals.map((meal) => (
                    <div key={meal.id} className="relative">
                      <RecipeCard
                        recipe={meal}
                        detailPath={`/recipes/${meal.id}`}
                        favoriteButton={
                          <button
                            onClick={() => handleRemoveFavorite(meal.id)}
                            title="Remove from favourites"
                            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-red-500/90 text-white shadow-sm hover:bg-red-600 transition-colors"
                          >
                            <span className="text-lg">★</span>
                          </button>
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : favoriteMeals.length > 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <p className="text-lg font-semibold text-slate-600">No favourite meals match your search</p>
                  <p className="text-sm mt-1">Try a different recipe name or category.</p>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-light flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-8 h-8 text-brand">
                      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-slate-600">No favourite meals yet</p>
                  <p className="text-sm mt-1 max-w-sm mx-auto">
                    Save meals you love from the Dashboard using the heart icon — they&apos;ll show up here.
                  </p>
                </div>
              )}
            </div>
          )}

          {isSearching && !showFavoritesSection && (
            <div className="soft-card p-10 text-center text-slate-500">
              {favoriteMeals.length > 0 ? (
                <>
                  <p className="text-lg font-semibold text-slate-600">No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
                  <p className="text-sm mt-1">Try a different recipe name or category.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-600">Nothing to search here yet</p>
                  <p className="text-sm mt-1">Save favourite meals from the Dashboard to search them here.</p>
                </>
              )}
            </div>
          )}
        </div>

        {!isSearching && (
          <div className="lg:col-span-1 space-y-6">
            <div className="soft-card p-6">
              <h2 className="section-title mb-4">Meals Planned</h2>
              {mealStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mealStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#16a34a" name="Meals" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-slate-500">
                  <p>No meal plan data yet</p>
                </div>
              )}
            </div>

            <div className="soft-card p-6">
              <h2 className="section-title mb-4">Recent Activity</h2>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.type === 'Recipe' ? 'bg-blue-100' : 'bg-purple-100'
                        }`}>
                        {activity.type === 'Recipe' ? (
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{activity.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="soft-card p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Edit Profile</h2>
              <button
                onClick={handleAccountCancel}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {accountStatus.msg && (
              <p className={`text-sm font-medium p-3 rounded-lg mb-5 whitespace-pre-line ${accountStatus.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                : 'text-red-600 bg-red-50 border border-red-100'
                }`}>
                {accountStatus.msg}
              </p>
            )}

            <form onSubmit={handleAccountSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={account?.username || username || ''}
                    disabled
                    className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-4 py-3 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400 mt-1">Username cannot be changed.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={accountForm.fullName}
                    onChange={handleAccountInput}
                    className="input-field w-full"
                    placeholder="e.g., Alice Tan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={accountForm.email}
                    onChange={handleAccountInput}
                    className="input-field w-full"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={accountForm.phoneNumber}
                    onChange={handleAccountInput}
                    className="input-field w-full"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={accountForm.dateOfBirth}
                    onChange={handleAccountInput}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                  <select
                    name="gender"
                    value={accountForm.gender}
                    onChange={handleAccountInput}
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" disabled={savingAccount} className="btn-primary disabled:opacity-50 flex-1">
                  {savingAccount ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleAccountCancel}
                  className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-full hover:bg-slate-200 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
