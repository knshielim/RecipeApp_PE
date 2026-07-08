import { useState, useEffect, useMemo } from 'react';
import PantryScanner from './PantryScanner';
import PantryObjectDetector from './PantryObjectDetector';
import { useSearch } from './layout/AppLayout';
import { matchesSearch, isSearchActive } from '../utils/search';
import { API_BASE, parseApiResponse, getApiErrorMessage, formatFetchError } from '../utils/apiError';

const API = API_BASE;

const CATEGORIES = ['Vegetables', 'Proteins', 'Dairy', 'Grains', 'Spices', 'Fruits', 'Oils', 'Other'];

function formatDate(dateString) {
  if (!dateString) return 'N/A';

  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isExpiringSoon(dateString) {
  if (!dateString) return false;

  const expiryDate = new Date(dateString);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

  return daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
}

function isExpired(dateString) {
  if (!dateString) return false;

  return new Date(dateString) < new Date();
}

export default function PantryPage({ token, username }) {
  const { searchQuery } = useSearch();
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    ingredientName: '',
    category: 'Vegetables',
    quantity: 1,
    unit: '',
    expiryDate: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDetector, setShowDetector] = useState(false);

  useEffect(() => {
    if (token) {
      fetchPantryItems();
    }
  }, [token]);

  async function fetchPantryItems() {
    setLoading(true);
    setPageError('');

    try {
      const res = await fetch(`${API}/api/pantry`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await parseApiResponse(res, 'Could not load pantry items.');

      setPantryItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching pantry:', formatFetchError(error));
      setPageError(formatFetchError(error));
      setPantryItems([]);
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const validateForm = () => {
    if (!formData.ingredientName.trim()) {
      setFormError('Ingredient name is required.');
      return false;
    }

    if (!formData.category) {
      setFormError('Category is required.');
      return false;
    }

    if (
      formData.quantity === '' ||
      isNaN(Number(formData.quantity)) ||
      Number(formData.quantity) <= 0
    ) {
      setFormError('Quantity must be a number greater than 0.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormError('');

    try {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);

      const payload = {
        ingredientName: formData.ingredientName.trim(),
        category: formData.category,
        quantity: parseInt(formData.quantity, 10),
        unit: formData.unit.trim(),
        expiryDate: formData.expiryDate
          ? new Date(formData.expiryDate)
          : defaultExpiry,
      };

      const res = editingId
        ? await fetch(`${API}/api/pantry/${editingId}`, {
          method: 'PUT',
          headers: jsonAuthHeaders,
          body: JSON.stringify(payload),
        })
        : await fetch(`${API}/api/pantry`, {
          method: 'POST',
          headers: jsonAuthHeaders,
          body: JSON.stringify(payload),
        });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, 'Failed to save pantry item.'));
      }

      setFormData({
        ingredientName: '',
        category: 'Vegetables',
        quantity: 1,
        unit: '',
        expiryDate: '',
      });
      setEditingId(null);
      setFormError('');
      setShowPantryModal(false);

      await fetchPantryItems();
    } catch (error) {
      setFormError(formatFetchError(error) || 'Failed to save item. Please try again.');
    }
  };

  const openAddModal = () => {
    setFormData({
      ingredientName: '',
      category: 'Vegetables',
      quantity: 1,
      unit: '',
      expiryDate: '',
    });
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
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
    });
    setEditingId(item.id);
    setFormError('');
    setShowPantryModal(true);
  };

  const closePantryModal = () => {
    setShowPantryModal(false);
    setEditingId(null);
    setFormData({
      ingredientName: '',
      category: 'Vegetables',
      quantity: 1,
      unit: '',
      expiryDate: '',
    });
    setFormError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    setPageError('');

    try {
      const res = await fetch(`${API}/api/pantry/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, 'Failed to delete pantry item.'));
      }

      await fetchPantryItems();
    } catch (error) {
      console.error('Error deleting item:', formatFetchError(error));
      setPageError(formatFetchError(error));
    }
  };

  const filteredPantryItems = useMemo(() => {
    let items = pantryItems;

    if (searchQuery.trim()) {
      items = items.filter((item) =>
        matchesSearch(searchQuery, item.ingredientName, item.category, item.unit)
      );
    }

    if (categoryFilter) {
      items = items.filter((item) => item.category === categoryFilter);
    }

    return items;
  }, [pantryItems, searchQuery, categoryFilter]);

  const isSearching = isSearchActive(searchQuery);
  const expiringCount = pantryItems.filter((i) => isExpiringSoon(i.expiryDate) && !isExpired(i.expiryDate)).length;
  const expiredCount = pantryItems.filter((i) => isExpired(i.expiryDate)).length;

  if (!token) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Please log in to view your pantry.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500">Loading your pantry...</div>
      </div>
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const jsonAuthHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!isSearching && (
        <div>
          <h1 className="section-title text-2xl">My Pantry</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track ingredients, scan receipts, or detect items from photos.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <span className="text-sm font-semibold text-brand bg-brand-light px-4 py-1.5 rounded-full">
              {pantryItems.length} items
            </span>
            {expiringCount > 0 && (
              <span className="text-sm font-semibold text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full">
                {expiringCount} expiring soon
              </span>
            )}
            {expiredCount > 0 && (
              <span className="text-sm font-semibold text-red-600 bg-red-50 px-4 py-1.5 rounded-full">
                {expiredCount} expired
              </span>
            )}
          </div>
        </div>
      )}

      {pageError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 whitespace-pre-line">
          {pageError}
        </p>
      )}

      <div className="soft-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="section-title">{isSearching ? 'Search Results' : 'Ingredients'}</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {!isSearching && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field text-sm w-full sm:w-auto"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              {isSearching ? (
                <span className="text-sm text-slate-500">
                  {filteredPantryItems.length} match{filteredPantryItems.length !== 1 ? 'es' : ''}
                </span>
              ) : (
                <>
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
                    onClick={() => {
                      setShowScanner((v) => !v);
                      setShowDetector(false);
                    }}
                    title="Scan a grocery receipt"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm text-lg"
                  >
                    🧾
                  </button>

                  <button
                    onClick={() => {
                      setShowDetector((v) => !v);
                      setShowScanner(false);
                    }}
                    title="Detect items from a photo"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark transition-colors shadow-sm text-lg"
                  >
                    📷
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {showScanner && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="soft-card p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title text-xl">Scan Grocery Receipt</h2>
                <button
                  onClick={() => setShowScanner(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <PantryScanner
                onAdded={() => {
                  fetchPantryItems();
                  setShowScanner(false);
                }}
              />
            </div>
          </div>
        )}

        {showDetector && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="soft-card p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title text-xl">Detect Items from Photo</h2>
                <button
                  onClick={() => setShowDetector(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <PantryObjectDetector
                onAdded={() => {
                  fetchPantryItems();
                  setShowDetector(false);
                }}
              />
            </div>
          </div>
        )}

        {filteredPantryItems.length > 0 ? (
          <div className="space-y-4">
            {filteredPantryItems.map((item) => (
              <div
                key={item.id}
                className={`border rounded-2xl p-5 flex justify-between items-start transition-all hover:shadow-md ${isExpired(item.expiryDate)
                  ? 'border-red-300 bg-red-50'
                  : isExpiringSoon(item.expiryDate)
                    ? 'border-yellow-300 bg-yellow-50'
                    : 'border-slate-100 bg-white'
                  }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg">{item.ingredientName}</h3>
                    <span className="text-xs font-semibold bg-green-50 text-green-600 px-3 py-1 rounded-full">
                      {item.category}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-1">
                    Quantity: <span className="font-semibold">{item.quantity}</span> {item.unit}
                  </p>

                  <p className="text-xs text-slate-500">
                    Expires: {formatDate(item.expiryDate)}
                    {isExpired(item.expiryDate) && (
                      <span className="text-red-500 font-semibold ml-2">(Expired)</span>
                    )}
                    {isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate) && (
                      <span className="text-yellow-600 font-semibold ml-2">(Expiring Soon)</span>
                    )}
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
        ) : pantryItems.length > 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg font-semibold text-slate-600">No pantry items match your search</p>
            <p className="text-sm mt-1">Try a different ingredient or category name.</p>
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
                  {CATEGORIES.map((cat) => (
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
                <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl whitespace-pre-line">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 btn-primary">
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>

                <button
                  type="button"
                  onClick={closePantryModal}
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