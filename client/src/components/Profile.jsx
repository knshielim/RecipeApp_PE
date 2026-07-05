import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PantryScanner from './PantryScanner';
import PantryObjectDetector from './PantryObjectDetector';
import { getFavoriteMeals, removeFavoriteMeal } from '../utils/favoriteMeals';
import { useUserProfile } from '../context/UserProfileContext';
import UserAvatar from './UserAvatar';
import { resizeImageFile } from '../utils/profilePicture';

const API = "http://localhost:5237";
const USER_ID = 1;

const CATEGORIES = ["Vegetables", "Proteins", "Dairy", "Grains", "Spices", "Fruits", "Oils", "Other"];

export default function Profile({ token, username }) {
  const { displayName, profile, updateProfilePicture } = useUserProfile();
  const pictureInputRef = useRef(null);
  const [pictureStatus, setPictureStatus] = useState({ type: '', msg: '' });
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pantryItems, setPantryItems] = useState([]);
  const [mealStats, setMealStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({ totalRecipes: 0, totalMealPlans: 0 });
  const [loading, setLoading] = useState(true);

  // Account information state
  const [account, setAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    fullName: '', email: '', phoneNumber: '', dateOfBirth: '', gender: ''
  });
  const [accountStatus, setAccountStatus] = useState({ type: '', msg: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    ingredientName: '',
    category: 'Vegetables',
    quantity: 1,
    unit: '',
    expiryDate: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDetector, setShowDetector] = useState(false);
  const [favoriteMeals, setFavoriteMeals] = useState([]);

  useEffect(() => {
    fetchProfileData();
    fetchAccount();
    setFavoriteMeals(getFavoriteMeals(USER_ID));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccount = async () => {
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not load account information.');
      const data = await res.json();
      setAccount(data);
      setAccountForm({
        fullName: data.fullName || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: data.gender || ''
      });
    } catch (error) {
      setAccountStatus({ type: 'error', msg: error.message });
    }
  };

  const handleAccountInput = (e) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(accountForm)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update profile.');

      setAccountStatus({ type: 'success', msg: data.message || 'Profile updated.' });
      setEditingAccount(false);
      fetchAccount();
    } catch (error) {
      setAccountStatus({ type: 'error', msg: error.message });
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
        gender: account.gender || ''
      });
    }
  };

  const fetchProfileData = async () => {
    try {
      const [pantryRes, statsRes, activityRes, dashStatsRes] = await Promise.all([
        fetch(`${API}/api/pantry/${USER_ID}`),
        fetch(`${API}/api/profile/meal-stats/${USER_ID}`),
        fetch(`${API}/api/profile/recent-activity/${USER_ID}`),
        fetch(`${API}/api/dashboard/stats/${USER_ID}`),
      ]);

      const pantryData = await pantryRes.json();
      const statsData = await statsRes.json();
      const activityData = await activityRes.json();
      const dashStatsData = await dashStatsRes.json();

      setPantryItems(pantryData);
      setMealStats(statsData);
      setRecentActivity(activityData);
      setDashboardStats(dashStatsData);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const validateForm = () => {
    if (!formData.ingredientName.trim()) {
      setFormError('Ingredient name is required');
      return false;
    }
    if (!formData.category) {
      setFormError('Category is required');
      return false;
    }
    if (formData.quantity === '' || isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      setFormError('Quantity must be a number greater than 0');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);

      const payload = {
        userId: USER_ID,
        ingredientName: formData.ingredientName.trim(),
        category: formData.category,
        quantity: parseInt(formData.quantity, 10),
        unit: formData.unit.trim(),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : defaultExpiry
      };

      const res = editingId
        ? await fetch(`${API}/api/pantry/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch(`${API}/api/pantry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to save item (status ${res.status}).`);
      }

      setFormData({ ingredientName: '', category: 'Vegetables', quantity: 1, unit: '', expiryDate: '' });
      setEditingId(null);
      setFormError('');
      setShowPantryModal(false);
      fetchProfileData();
    } catch (error) {
      setFormError(error.message || 'Failed to save item. Please try again.');
    }
  };

  const openAddModal = () => {
    setFormData({ ingredientName: '', category: 'Vegetables', quantity: 1, unit: '', expiryDate: '' });
    setEditingId(null);
    setFormError('');
    setShowPantryModal(true);
  };

  const handleEdit = (item) => {
    setFormData({
      ingredientName: item.ingredientName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : ''
    });
    setEditingId(item.id);
    setFormError('');
    setShowPantryModal(true);
  };

  const closePantryModal = () => {
    setShowPantryModal(false);
    setEditingId(null);
    setFormData({ ingredientName: '', category: 'Vegetables', quantity: 1, unit: '', expiryDate: '' });
    setFormError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await fetch(`${API}/api/pantry/${id}`, { method: 'DELETE' });
      fetchProfileData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleCancelEdit = () => {
    closePantryModal();
  };

  const handleRemoveFavorite = (recipeId) => {
    setFavoriteMeals(removeFavoriteMeal(USER_ID, recipeId));
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

  const isExpiringSoon = (dateString) => {
    if (!dateString) return false;
    const expiryDate = new Date(dateString);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Profile header */}
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
          <p className="text-slate-500 text-sm mt-1">Manage your account, pantry and track your cooking journey</p>
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
          </div>
          {pictureStatus.msg && (
            <p className={`text-sm mt-2 ${
              pictureStatus.type === 'success'
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Account & Pantry Management */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Information */}
            <div className="soft-card p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Account Information</h2>
                {!editingAccount && (
                  <button
                    onClick={() => { setEditingAccount(true); setAccountStatus({ type: '', msg: '' }); }}
                    className="btn-primary text-sm"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {accountStatus.msg && (
                <p className={`text-sm font-medium p-3 rounded-lg mb-5 ${
                  accountStatus.type === 'success'
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                    : 'text-red-600 bg-red-50 border border-red-100'
                }`}>
                  {accountStatus.msg}
                </p>
              )}

              {!editingAccount ? (
                /* ---- View mode ---- */
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
              ) : (
                /* ---- Edit mode ---- */
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
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      disabled={savingAccount}
                      className="btn-primary disabled:opacity-50"
                    >
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
              )}
            </div>

            {/* Pantry Items List */}
            <div className="soft-card p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">My Pantry</h2>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-sm font-semibold text-brand bg-brand-light px-3 sm:px-4 py-1.5 rounded-full">{pantryItems.length} items</span>
                  <button
                    onClick={openAddModal}
                    title="Add pantry item"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setShowScanner((v) => !v); setShowDetector(false); }}
                    title="Scan a grocery receipt"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm text-lg"
                  >
                    🧾
                  </button>
                  <button
                    onClick={() => { setShowDetector((v) => !v); setShowScanner(false); }}
                    title="Detect items from a photo"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm text-lg"
                  >
                    📷
                  </button>
                </div>
              </div>

              {showScanner && (
                <div className="mb-6">
                  <PantryScanner
                    onAdded={() => {
                      fetchProfileData();
                      setShowScanner(false);
                    }}
                  />
                </div>
              )}

              {showDetector && (
                <div className="mb-6">
                  <PantryObjectDetector
                    onAdded={() => {
                      fetchProfileData();
                      setShowDetector(false);
                    }}
                  />
                </div>
              )}

              {pantryItems.length > 0 ? (
                <div className="space-y-4">
                  {pantryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-2xl p-5 flex justify-between items-start transition-all hover:shadow-md ${
                        isExpired(item.expiryDate) ? 'border-red-300 bg-red-50' :
                        isExpiringSoon(item.expiryDate) ? 'border-yellow-300 bg-yellow-50' :
                        'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-slate-900 text-lg">{item.ingredientName}</h3>
                          <span className="text-xs font-semibold bg-green-50 text-green-600 px-3 py-1 rounded-full">{item.category}</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                          Quantity: <span className="font-semibold">{item.quantity}</span> {item.unit}
                        </p>
                        <p className="text-xs text-slate-500">
                          Expires: {formatDate(item.expiryDate)}
                          {isExpired(item.expiryDate) && <span className="text-red-500 font-semibold ml-2">(Expired)</span>}
                          {isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate) && <span className="text-yellow-600 font-semibold ml-2">(Expiring Soon)</span>}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-green-600 hover:text-green-700 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-lg font-semibold text-slate-600">Your pantry is empty</p>
                  <p className="text-sm">Press the + button to add ingredients!</p>
                </div>
              )}
            </div>

            {/* Favorite Meals */}
            <div className="soft-card p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title">Favourite Meals</h2>
                <span className="text-sm font-semibold text-brand bg-brand-light px-3 sm:px-4 py-1.5 rounded-full">
                  {favoriteMeals.length} saved
                </span>
              </div>

              {favoriteMeals.length > 0 ? (
                <div className="space-y-4">
                  {favoriteMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="border border-slate-100 rounded-2xl p-5 flex justify-between items-start bg-white hover:shadow-md transition-all"
                    >
                      <div className="flex gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center text-2xl">
                          ❤️
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-slate-900 text-lg">{meal.title}</h3>
                            {meal.category && (
                              <span className="text-xs font-semibold bg-brand-light text-brand px-3 py-1 rounded-full">
                                {meal.category}
                              </span>
                            )}
                          </div>
                          {meal.ingredients && (
                            <p className="text-sm text-slate-500 truncate">{meal.ingredients}</p>
                          )}
                          {meal.addedAt && (
                            <p className="text-xs text-slate-400 mt-1">
                              Saved {formatDate(meal.addedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFavorite(meal.id)}
                        title="Remove from favourites"
                        className="text-red-500 hover:text-red-700 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
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
          </div>

          {/* Right Column - Stats & Activity */}
          <div className="lg:col-span-1 space-y-6">
            {/* Meals Per Week Chart */}
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
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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

            {/* Recent Activity Feed */}
            <div className="soft-card p-6">
              <h2 className="section-title mb-4">Recent Activity</h2>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'Recipe' ? 'bg-blue-100' : 'bg-purple-100'
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

            {/* Quick Stats */}
            <div className="soft-card p-6 bg-brand text-white">
              <h2 className="text-xl font-bold mb-5">Quick Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-green-100">Recipes Saved</span>
                  <span className="font-bold text-2xl">{dashboardStats.totalRecipes}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-green-100">Meals Planned</span>
                  <span className="font-bold text-2xl">{dashboardStats.totalMealPlans}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-green-100">Pantry Items</span>
                  <span className="font-bold text-2xl">{pantryItems.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/20">
                  <span className="text-green-100">Expiring Soon</span>
                  <span className="font-bold text-2xl">{pantryItems.filter(i => isExpiringSoon(i.expiryDate) && !isExpired(i.expiryDate)).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-100">Expired</span>
                  <span className="font-bold text-2xl text-red-300">{pantryItems.filter(i => isExpired(i.expiryDate)).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Add / Edit Pantry Modal */}
      {showPantryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="soft-card p-6 sm:p-8 w-full max-w-md">
            <h2 className="section-title text-xl mb-5">
              {editingId ? 'Edit Pantry Item' : 'Add to Pantry'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  name="ingredientName"
                  value={formData.ingredientName}
                  onChange={handleInputChange}
                  className="input-field w-full"
                  placeholder="e.g., Rice, Eggs, Soy Sauce"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="input-field w-full"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  min="1"
                  className="input-field w-full"
                  required
                />
              </div>
              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      className="input-field w-full"
                      placeholder="e.g., kg, pieces, cups"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expiry Date</label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className="input-field w-full"
                    />
                  </div>
                </>
              )}
              {formError && (
                <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{formError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 btn-primary">
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-full hover:bg-slate-200 transition-colors font-semibold text-sm"
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
