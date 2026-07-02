import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PantryScanner from './PantryScanner';
import PantryObjectDetector from './PantryObjectDetector';

const API = "http://localhost:5237";
const USER_ID = 1;

const CATEGORIES = ["Vegetables", "Proteins", "Dairy", "Grains", "Spices", "Fruits", "Oils", "Other"];

export default function Profile() {
  const [pantryItems, setPantryItems] = useState([]);
  const [mealStats, setMealStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
  const [showScanner, setShowScanner] = useState(false);
  const [showDetector, setShowDetector] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [pantryRes, statsRes, activityRes] = await Promise.all([
        fetch(`${API}/api/pantry/${USER_ID}`),
        fetch(`${API}/api/profile/meal-stats/${USER_ID}`),
        fetch(`${API}/api/profile/recent-activity/${USER_ID}`)
      ]);

      const pantryData = await pantryRes.json();
      const statsData = await statsRes.json();
      const activityData = await activityRes.json();

      setPantryItems(pantryData);
      setMealStats(statsData);
      setRecentActivity(activityData);
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
      fetchProfileData();
    } catch (error) {
      setFormError(error.message || 'Failed to save item. Please try again.');
    }
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setFormData({ ingredientName: '', category: 'Vegetables', quantity: 1, unit: '', expiryDate: '' });
    setEditingId(null);
    setFormError('');
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
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-gray-600">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 backdrop-blur rounded-full w-28 h-28 flex items-center justify-center border-4 border-white/30">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">My Profile</h1>
              <p className="text-green-100 text-lg">Manage your pantry and track your cooking journey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pantry Management */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add/Edit Item Form */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-green-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                {editingId ? 'Edit Pantry Item' : 'Add to Pantry'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ingredient Name *</label>
                    <input
                      type="text"
                      name="ingredientName"
                      value={formData.ingredientName}
                      onChange={handleInputChange}
                      className="w-full border-2 border-green-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="e.g., Tomatoes"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full border-2 border-green-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      required
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full border-2 border-green-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      className="w-full border-2 border-green-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="e.g., kg, pieces, cups"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date</label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      className="w-full border-2 border-green-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>
                </div>
                {formError && (
                  <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg">{formError}</p>
                )}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 transition-all font-semibold shadow-md hover:shadow-lg"
                  >
                    {editingId ? 'Update Item' : 'Add Item'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-200 transition-all font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Pantry Items List */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-green-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Pantry</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-green-600 bg-green-50 px-4 py-2 rounded-full">{pantryItems.length} items</span>
                  <button
                    onClick={() => { setShowScanner((v) => !v); setShowDetector(false); }}
                    title="Scan a grocery receipt"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 transition-all shadow-md text-lg"
                  >
                    🧾
                  </button>
                  <button
                    onClick={() => { setShowDetector((v) => !v); setShowScanner(false); }}
                    title="Detect items from a photo"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 transition-all shadow-md text-lg"
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
                      className={`border-2 rounded-2xl p-5 flex justify-between items-start transition-all hover:shadow-md ${
                        isExpired(item.expiryDate) ? 'border-red-300 bg-red-50' :
                        isExpiringSoon(item.expiryDate) ? 'border-yellow-300 bg-yellow-50' :
                        'border-green-100 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-800 text-lg">{item.ingredientName}</h3>
                          <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">{item.category}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          Quantity: <span className="font-semibold">{item.quantity}</span> {item.unit}
                        </p>
                        <p className="text-xs text-gray-500">
                          Expires: {formatDate(item.expiryDate)}
                          {isExpired(item.expiryDate) && <span className="text-red-500 font-semibold ml-2">(Expired)</span>}
                          {isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate) && <span className="text-yellow-600 font-semibold ml-2">(Expiring Soon)</span>}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-green-600 hover:text-green-800 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-green-50 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-20 h-20 text-green-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-lg font-semibold text-gray-600">Your pantry is empty</p>
                  <p className="text-sm">Add ingredients to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Stats & Activity */}
          <div className="lg:col-span-1 space-y-6">
            {/* Meals Per Week Chart */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Meals Planned</h2>
              {mealStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mealStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="Day" tick={{ fontSize: 11, fill: '#6b7280' }} />
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
                    <Bar dataKey="Count" fill="#16a34a" name="Meals" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <p>No meal plan data yet</p>
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-4 border-b border-green-50 last:border-0 last:pb-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'Recipe' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {activity.type === 'Recipe' ? (
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{activity.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <p>No recent activity</p>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-5">Quick Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-green-500/30">
                  <span className="text-green-100">Pantry Items</span>
                  <span className="font-bold text-2xl">{pantryItems.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-green-500/30">
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
      </div>
    </div>
  );
}