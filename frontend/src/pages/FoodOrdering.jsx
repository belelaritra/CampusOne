import { useState, useEffect, useCallback, useRef } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getFoodOutlets, getOutletMenu,
  placeFoodOrder, getPendingFoodOrders, getFoodOrderHistory,
  cancelFoodOrder, submitFoodReview,
  getAdminFoodOrders, acceptFoodOrder, cancelFoodOrderAdmin,
  updateFoodOrderStatus, getAdminMenu, addMenuItem, updateMenuItem, deleteMenuItem,
  getHostelAnalytics, getTopFoodItems, getTimeWiseAnalytics,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DELIVERY_LOCATIONS = [
  { group: 'Hostels', items: [
    { value: 'hostel_1',  label: 'Hostel 1' },  { value: 'hostel_2',  label: 'Hostel 2' },
    { value: 'hostel_3',  label: 'Hostel 3' },  { value: 'hostel_4',  label: 'Hostel 4' },
    { value: 'hostel_5',  label: 'Hostel 5' },  { value: 'hostel_6',  label: 'Hostel 6' },
    { value: 'hostel_7',  label: 'Hostel 7' },  { value: 'hostel_8',  label: 'Hostel 8' },
    { value: 'hostel_9',  label: 'Hostel 9' },  { value: 'hostel_10', label: 'Hostel 10' },
    { value: 'hostel_11', label: 'Hostel 11' }, { value: 'hostel_12', label: 'Hostel 12' },
    { value: 'hostel_13', label: 'Hostel 13' }, { value: 'hostel_14', label: 'Hostel 14' },
    { value: 'hostel_15', label: 'Hostel 15' }, { value: 'hostel_16', label: 'Hostel 16' },
    { value: 'hostel_17', label: 'Hostel 17' }, { value: 'hostel_18', label: 'Hostel 18' },
    { value: 'hostel_19', label: 'Hostel 19' }, { value: 'hostel_21', label: 'Hostel 21' },
    { value: 'tansa_house', label: 'Tansa House' },
  ]},
  { group: 'Academic & Common', items: [
    { value: 'kresit',        label: 'KReSIT' },
    { value: 'sjmsom',        label: 'SJMSOM' },
    { value: 'lecture_hall',  label: 'Lecture Hall Complex' },
    { value: 'conv_hall',     label: 'Convocation Hall' },
    { value: 'main_building', label: 'Main Building' },
    { value: 'central_lib',   label: 'Central Library' },
    { value: 'sac',           label: 'Students Activity Centre' },
    { value: 'gymkhana',      label: 'Students Gymkhana' },
  ]},
];

const ORDER_STATUS_META = {
  PENDING:          { color: '#d97706', bg: '#fef3c7', label: 'Pending',          icon: '🕐' },
  ACCEPTED:         { color: '#2563eb', bg: '#dbeafe', label: 'Accepted',         icon: '✅' },
  PREPARING:        { color: '#7c3aed', bg: '#ede9fe', label: 'Preparing',        icon: '👨‍🍳' },
  OUT_FOR_DELIVERY: { color: '#0891b2', bg: '#cffafe', label: 'Out for Delivery', icon: '🛵' },
  DELIVERED:        { color: '#16a34a', bg: '#dcfce7', label: 'Delivered',        icon: '🎉' },
  CANCELLED:        { color: '#dc2626', bg: '#fee2e2', label: 'Cancelled',        icon: '❌' },
};

const OUTLET_EMOJIS = {
  'Aromas Dhaba': '🍛',
  'H2 Canteen':   '🍱',
  'Amul Parlour': '🍦',
  'Cafe 92':      '☕',
  'Chayoos':      '🍵',
  'CCD':          '☕',
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function fmtPrice(p) { return `₹${parseFloat(p).toFixed(0)}`; }
function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
  });
}
function deliveryLabel(val) {
  for (const g of DELIVERY_LOCATIONS) {
    const f = g.items.find(i => i.value === val);
    if (f) return f.label;
  }
  return val;
}

function Alert({ msg, onClose }) {
  if (!msg) return null;
  const isSuccess = msg.startsWith('✅');
  return (
    <div style={{
      padding: '0.7rem 1rem', borderRadius: 8, marginBottom: '1rem',
      background: isSuccess ? '#dcfce7' : '#fee2e2',
      color: isSuccess ? '#166534' : '#991b1b',
      fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between',
    }}>
      <span>{msg}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      <p style={{ margin: 0 }}>Loading…</p>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}

function StarRating({ value, onChange, size = 20 }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange && onChange(n)}
          style={{
            fontSize: size, cursor: onChange ? 'pointer' : 'default',
            color: n <= value ? '#f59e0b' : '#d1d5db',
          }}
        >★</span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CART logic (local to FoodOrdering)
// ---------------------------------------------------------------------------
function useCart() {
  const [cart, setCart] = useState({ outletId: null, outletName: '', items: [] });

  const addItem = useCallback((outletId, outletName, item) => {
    setCart(prev => {
      // Different outlet — clear cart first
      if (prev.outletId && prev.outletId !== outletId) {
        if (!window.confirm(`Your cart has items from "${prev.outletName}". Clear cart and switch to "${outletName}"?`)) {
          return prev;
        }
        return { outletId, outletName, items: [{ ...item, qty: 1 }] };
      }
      const existing = prev.items.find(i => i.id === item.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i =>
            i.id === item.id ? { ...i, qty: Math.min(5, i.qty + 1) } : i
          ),
        };
      }
      return { outletId, outletName, items: [...prev.items, { ...item, qty: 1 }] };
    });
  }, []);

  const updateQty = useCallback((itemId, qty) => {
    setCart(prev => ({
      ...prev,
      items: prev.items
        .map(i => i.id === itemId ? { ...i, qty } : i)
        .filter(i => i.qty > 0),
    }));
  }, []);

  const removeItem = useCallback((itemId) => {
    setCart(prev => {
      const items = prev.items.filter(i => i.id !== itemId);
      return items.length === 0
        ? { outletId: null, outletName: '', items: [] }
        : { ...prev, items };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({ outletId: null, outletName: '', items: [] });
  }, []);

  const total = cart.items.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0);
  const itemCount = cart.items.reduce((s, i) => s + i.qty, 0);

  return { cart, addItem, updateQty, removeItem, clearCart, total, itemCount };
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function FoodOrdering() {
  const { user } = useAuth();
  const isOutletAdmin = user?.is_outlet_admin;

  // User tabs: 'outlets' | 'pending' | 'history' | 'admin'
  const [activeTab, setActiveTab] = useState('outlets');

  const tabs = [
    { id: 'outlets', label: '🏪 Outlets' },
    { id: 'pending', label: '📦 My Orders' },
    { id: 'history', label: '📜 History' },
    ...(isOutletAdmin ? [{ id: 'admin', label: '🔧 Admin Panel' }] : []),
  ];

  return (
    <section className="content-section active">
      <SectionHeader title="Food Ordering" subtitle="Order from campus outlets — fast & easy" />

      {/* Tab Navigation */}
      <div className="tab-navigation" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'outlets' && <OutletsTab />}
      {activeTab === 'pending' && <PendingOrdersTab onNavigate={setActiveTab} />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'admin' && isOutletAdmin && <AdminPanel user={user} />}
    </section>
  );
}

// ===========================================================================
// OUTLETS TAB — list + menu + cart + checkout
// ===========================================================================
function OutletsTab() {
  const [outlets, setOutlets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const { cart, addItem, updateQty, removeItem, clearCart, total, itemCount } = useCart();
  const [showCart, setShowCart]   = useState(false);
  const [orderDone, setOrderDone] = useState(null); // placed order id

  useEffect(() => {
    getFoodOutlets()
      .then(setOutlets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (orderDone) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h3 style={{ color: 'var(--iitb-blue-primary)' }}>Order Placed!</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Order #{orderDone} confirmed. Track it in <strong>My Orders</strong>.</p>
        <button className="btn btn-primary" onClick={() => { setOrderDone(null); setSelectedOutlet(null); }}>
          Order More
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Cart floating button */}
      {itemCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowCart(true)}
            style={{ padding: '0.75rem 1.5rem', borderRadius: 50, fontSize: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
          >
            🛒 Cart ({itemCount}) • {fmtPrice(total)}
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <CartModal
          cart={cart}
          total={total}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onClose={() => setShowCart(false)}
          onOrderPlaced={(id) => { clearCart(); setShowCart(false); setOrderDone(id); }}
        />
      )}

      {selectedOutlet ? (
        <OutletMenu
          outlet={selectedOutlet}
          cart={cart}
          onBack={() => setSelectedOutlet(null)}
          onAddItem={(item) => addItem(selectedOutlet.id, selectedOutlet.name, item)}
          onOpenCart={() => setShowCart(true)}
          itemCount={itemCount}
          total={total}
        />
      ) : (
        <OutletsList outlets={outlets} onSelect={setSelectedOutlet} />
      )}
    </>
  );
}

// --- Outlets List Grid ---
function OutletsList({ outlets, onSelect }) {
  if (!outlets.length) return <EmptyState icon="🍽️" text="No outlets available right now." />;

  return (
    <>
      <h3 style={{ color: 'var(--iitb-blue-primary)', marginBottom: '1.5rem' }}>
        Available Outlets ({outlets.length})
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '1.25rem',
      }}>
        {outlets.map(outlet => (
          <div
            key={outlet.id}
            className="hostel-card"
            onClick={() => onSelect(outlet)}
            style={{ cursor: 'pointer', textAlign: 'center', padding: '1.5rem 1rem' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
              {OUTLET_EMOJIS[outlet.name] || '🍽️'}
            </div>
            <h4 style={{ margin: '0 0 0.35rem', color: 'var(--iitb-blue-primary)' }}>{outlet.name}</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {outlet.description}
            </p>
            <span style={{
              display: 'inline-block', padding: '0.3rem 0.75rem',
              borderRadius: 50, fontSize: '0.78rem', fontWeight: 600,
              background: outlet.is_active ? '#dcfce7' : '#fee2e2',
              color: outlet.is_active ? '#16a34a' : '#dc2626',
            }}>
              {outlet.is_active ? '🟢 Open' : '🔴 Closed'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// --- Outlet Menu ---
function OutletMenu({ outlet, cart, onBack, onAddItem, onOpenCart, itemCount, total }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [isVeg, setIsVeg]           = useState('');        // '' | 'true' | 'false'
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy]         = useState('rating_desc');

  const fetchMenu = useCallback(() => {
    setLoading(true);
    const params = { sort_by: sortBy };
    if (search)        params.search         = search;
    if (isVeg)         params.is_veg         = isVeg;
    if (availableOnly) params.available_only = 'true';

    getOutletMenu(outlet.id, params)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [outlet.id, search, isVeg, availableOnly, sortBy]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const cartQty = (itemId) => {
    const f = cart.items.find(i => i.id === itemId);
    return f ? f.qty : 0;
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h3 style={{ margin: 0, color: 'var(--iitb-blue-primary)' }}>
          {OUTLET_EMOJIS[outlet.name] || '🍽️'} {outlet.name}
        </h3>
        {itemCount > 0 && (
          <button
            className="btn btn-primary"
            onClick={onOpenCart}
            style={{ marginLeft: 'auto', borderRadius: 50 }}
          >
            🛒 {itemCount} item{itemCount !== 1 ? 's' : ''} · {fmtPrice(total)}
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
        background: '#f8fafc', borderRadius: 10, padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
      }}>
        <input
          type="text"
          placeholder="🔍 Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 180px', padding: '0.45rem 0.75rem',
            border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem',
          }}
        />

        <select
          value={isVeg}
          onChange={e => setIsVeg(e.target.value)}
          style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }}
        >
          <option value="">🥗 All</option>
          <option value="true">🟢 Veg Only</option>
          <option value="false">🔴 Non-Veg</option>
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem' }}
        >
          <option value="rating_desc">⭐ Top Rated</option>
          <option value="rating_asc">⭐ Lowest Rated</option>
          <option value="price_asc">💰 Price: Low → High</option>
          <option value="price_desc">💰 Price: High → Low</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={e => setAvailableOnly(e.target.checked)}
          />
          Available only
        </label>
      </div>

      {loading ? <Spinner /> : (
        items.length === 0
          ? <EmptyState icon="🔍" text="No items match your filters." />
          : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}>
              {items.map(item => (
                <FoodItemCard
                  key={item.id}
                  item={item}
                  qty={cartQty(item.id)}
                  onAdd={() => onAddItem(item)}
                  onQtyChange={(q) => {
                    if (q === 0) {
                      onAddItem({ ...item, _remove: true }); // handled by cart
                    } else {
                      // Direct qty update not wired here; user uses cart modal
                      onAddItem(item);
                    }
                  }}
                />
              ))}
            </div>
          )
      )}
    </>
  );
}

// --- Food Item Card ---
function FoodItemCard({ item, qty, onAdd }) {
  const unavailable = !item.is_available;
  return (
    <div className="hostel-card" style={{ padding: '1.1rem', opacity: unavailable ? 0.7 : 1 }}>
      {/* Image placeholder */}
      <div style={{
        width: '100%', paddingBottom: '56%', position: 'relative',
        background: 'linear-gradient(135deg, #e0f2fe, #f0fdf4)',
        borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden',
      }}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
        ) : (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontSize: '2.5rem',
          }}>
            {item.is_veg ? '🥗' : '🍗'}
          </div>
        )}
        {/* Veg/Non-veg badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: item.is_veg ? '#16a34a' : '#dc2626',
          color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 700,
        }}>
          {item.is_veg ? '● VEG' : '● NON-VEG'}
        </div>
      </div>

      <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{item.name}</h4>
      {item.description && (
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--iitb-blue-primary)' }}>
          {fmtPrice(item.price)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <StarRating value={Math.round(parseFloat(item.avg_rating))} size={14} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            ({item.review_count})
          </span>
        </div>
      </div>

      {unavailable ? (
        <div style={{
          textAlign: 'center', padding: '0.5rem', borderRadius: 8,
          background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem', fontWeight: 600,
        }}>
          Not Available
        </div>
      ) : qty === 0 ? (
        <button
          className="btn btn-primary"
          onClick={onAdd}
          style={{ width: '100%', padding: '0.5rem' }}
        >
          + Add to Cart
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            In cart: {qty}
          </span>
          <button
            className="btn btn-primary"
            onClick={onAdd}
            disabled={qty >= 5}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}

// --- Cart Modal ---
function CartModal({ cart, total, onUpdateQty, onRemove, onClose, onOrderPlaced }) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [placing, setPlacing]     = useState(false);
  const [error, setError]         = useState('');

  async function handlePlaceOrder() {
    if (!deliveryLocation) { setError('Please select a delivery location.'); return; }
    setPlacing(true);
    setError('');
    try {
      const payload = {
        outlet_id: cart.outletId,
        delivery_location: deliveryLocation,
        items: cart.items.map(i => ({ food_item_id: i.id, quantity: i.qty })),
      };
      const order = await placeFoodOrder(payload);
      onOrderPlaced(order.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.5rem',
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        margin: '0 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--iitb-blue-primary)' }}>🛒 Your Cart</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          From: <strong>{cart.outletName}</strong>
        </p>

        <Alert msg={error} onClose={() => setError('')} />

        {/* Cart Items */}
        <div style={{ marginBottom: '1rem' }}>
          {cart.items.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <span style={{ fontSize: '1.5rem' }}>{item.is_veg ? '🥗' : '🍗'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{fmtPrice(item.price)} each</div>
              </div>
              {/* Qty control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => onUpdateQty(item.id, item.qty - 1)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', border: '1px solid #e2e8f0',
                    cursor: 'pointer', background: '#f8fafc', fontWeight: 700,
                  }}
                >−</button>
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                <button
                  onClick={() => onUpdateQty(item.id, item.qty + 1)}
                  disabled={item.qty >= 5}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', border: '1px solid #e2e8f0',
                    cursor: item.qty >= 5 ? 'not-allowed' : 'pointer',
                    background: item.qty >= 5 ? '#f1f5f9' : '#f8fafc', fontWeight: 700,
                  }}
                >+</button>
              </div>
              <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                {fmtPrice(parseFloat(item.price) * item.qty)}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem' }}
              >🗑</button>
            </div>
          ))}
        </div>

        {/* Delivery Location */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            📍 Delivery Location
          </label>
          <select
            value={deliveryLocation}
            onChange={e => setDeliveryLocation(e.target.value)}
            style={{
              width: '100%', padding: '0.55rem 0.75rem',
              border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem',
            }}
          >
            <option value="">Select location…</option>
            {DELIVERY_LOCATIONS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Payment info */}
        <div style={{
          background: '#f0fdf4', borderRadius: 8, padding: '0.65rem 0.75rem',
          marginBottom: '1rem', fontSize: '0.85rem', color: '#166534',
        }}>
          💵 Payment: <strong>Cash on Delivery</strong>
        </div>

        {/* Total & CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--iitb-blue-primary)' }}>
            {fmtPrice(total)}
          </span>
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePlaceOrder}
          disabled={placing}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
        >
          {placing ? 'Placing Order…' : '🍴 Place Order'}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// PENDING ORDERS TAB
// ===========================================================================
function PendingOrdersTab({ onNavigate }) {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState('');
  const [reviewOrder, setReviewOrder] = useState(null);
  const intervalRef             = useRef(null);

  const fetchOrders = useCallback(() => {
    getPendingFoodOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(fetchOrders, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders]);

  async function handleCancel(orderId) {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await cancelFoodOrder(orderId);
      setMsg('✅ Order cancelled.');
      fetchOrders();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Cannot cancel this order.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <Alert msg={msg} onClose={() => setMsg('')} />

      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onDone={() => { setReviewOrder(null); fetchOrders(); setMsg('✅ Review submitted! Order moved to History.'); }}
        />
      )}

      {orders.length === 0
        ? <EmptyState icon="📦" text="No active orders. Head to Outlets to order!" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={() => handleCancel(order.id)}
                onReview={() => setReviewOrder(order)}
              />
            ))}
          </div>
        )
      }
    </>
  );
}

// ===========================================================================
// HISTORY TAB
// ===========================================================================
function HistoryTab() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFoodOrderHistory()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return orders.length === 0
    ? <EmptyState icon="📜" text="No order history yet." />
    : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map(order => <OrderCard key={order.id} order={order} readonly />)}
      </div>
    );
}

// --- Order Card (shared by Pending + History) ---
function OrderCard({ order, onCancel, onReview, readonly }) {
  const meta = ORDER_STATUS_META[order.status] || {};
  const canCancel = order.status === 'PENDING' && !readonly;
  const canReview = order.status === 'DELIVERED' && !order.reviewed && !readonly;

  const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="hostel-card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--iitb-blue-primary)' }}>
            Order #{order.id}
          </span>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {fmtTime(order.created_at)}
          </span>
        </div>
        <span style={{
          padding: '0.3rem 0.75rem', borderRadius: 50, fontSize: '0.8rem', fontWeight: 700,
          background: meta.bg, color: meta.color,
        }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
        🏪 {order.outlet_name} &nbsp;|&nbsp; 📍 {order.delivery_location_display}
      </p>

      {/* Status progress bar (not for cancelled) */}
      {!isCancelled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {STATUS_STEPS.map((s, i) => {
            const smeta = ORDER_STATUS_META[s];
            const done  = i <= currentStepIdx;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                  background: done ? smeta.bg : '#f1f5f9',
                  color: done ? smeta.color : '#9ca3af',
                  border: `2px solid ${done ? smeta.color : '#e2e8f0'}`,
                  fontWeight: done ? 700 : 400,
                }}>
                  {done ? smeta.icon : i + 1}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div style={{ height: 2, width: 20, background: i < currentStepIdx ? '#16a34a' : '#e2e8f0' }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Items list */}
      <div style={{ marginBottom: '0.75rem' }}>
        {order.order_items.map(oi => (
          <div key={oi.id} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.88rem', padding: '0.2rem 0',
          }}>
            <span>
              <span style={{ color: oi.food_item_is_veg ? '#16a34a' : '#dc2626' }}>●</span>
              {' '}{oi.food_item_name} × {oi.quantity}
            </span>
            <span style={{ fontWeight: 600 }}>{fmtPrice(parseFloat(oi.price) * oi.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total: {fmtPrice(order.total_price)}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canCancel && (
            <button
              className="btn"
              onClick={onCancel}
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel Order
            </button>
          )}
          {canReview && (
            <button
              className="btn btn-primary"
              onClick={onReview}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
            >
              ⭐ Rate & Review
            </button>
          )}
          {order.status === 'DELIVERED' && order.reviewed && (
            <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>✅ Reviewed</span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Review Modal ---
function ReviewModal({ order, onClose, onDone }) {
  // ratings: { [foodItemId]: 1-5 }
  const [ratings, setRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');

  const items = order.order_items;

  async function handleSubmit() {
    // Check all rated
    const unrated = items.filter(oi => !ratings[oi.food_item]);
    if (unrated.length > 0) {
      setError(`Please rate all ${items.length} item(s).`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitFoodReview(order.id, {
        ratings: items.map(oi => ({
          food_item_id: oi.food_item,
          rating: ratings[oi.food_item],
        })),
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '1.5rem',
        width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
        margin: '0 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--iitb-blue-primary)' }}>⭐ Rate Your Order</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          From {order.outlet_name}
        </p>

        <Alert msg={error} onClose={() => setError('')} />

        {items.map(oi => (
          <div key={oi.id} style={{
            padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{oi.food_item_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Qty: {oi.quantity}</div>
            </div>
            <StarRating
              value={ratings[oi.food_item] || 0}
              onChange={(v) => setRatings(prev => ({ ...prev, [oi.food_item]: v }))}
            />
          </div>
        ))}

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem' }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// OUTLET ADMIN PANEL
// ===========================================================================
function AdminPanel({ user }) {
  const [adminTab, setAdminTab] = useState('orders');

  const adminTabs = [
    { id: 'orders',    label: '📋 Orders' },
    { id: 'menu',      label: '🍔 Menu' },
    { id: 'analytics', label: '📊 Analytics' },
  ];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
        borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.25rem',
        color: '#fff',
      }}>
        <h3 style={{ margin: '0 0 0.25rem' }}>🔧 Admin Panel — {user.outlet_name}</h3>
        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>Manage your outlet's menu and orders.</p>
      </div>

      <div className="tab-navigation" style={{ marginBottom: '1.25rem' }}>
        {adminTabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn${adminTab === t.id ? ' active' : ''}`}
            onClick={() => setAdminTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {adminTab === 'orders'    && <AdminOrders outletId={user.outlet_id} />}
      {adminTab === 'menu'      && <AdminMenu />}
      {adminTab === 'analytics' && <AdminAnalytics />}
    </div>
  );
}

// --- Admin Orders ---
function AdminOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');
  const [filter, setFilter]   = useState('active');
  const intervalRef           = useRef(null);

  const fetchOrders = useCallback(() => {
    getAdminFoodOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(fetchOrders, 20_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders]);

  const NEXT_STATUS = {
    ACCEPTED: 'PREPARING',
    PREPARING: 'OUT_FOR_DELIVERY',
    OUT_FOR_DELIVERY: 'DELIVERED',
  };

  async function handleAction(orderId, action) {
    try {
      if (action === 'accept')  await acceptFoodOrder(orderId);
      else if (action === 'cancel') await cancelFoodOrderAdmin(orderId);
      else await updateFoodOrderStatus(orderId, action);
      fetchOrders();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Action failed.');
    }
  }

  const filtered = orders.filter(o => {
    if (filter === 'active')    return !['DELIVERED','CANCELLED'].includes(o.status);
    if (filter === 'delivered') return o.status === 'DELIVERED';
    if (filter === 'cancelled') return o.status === 'CANCELLED';
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <>
      <Alert msg={msg} onClose={() => setMsg('')} />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['active','Active'],['delivered','Delivered'],['cancelled','Cancelled'],['all','All']].map(([v,l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: 50, fontSize: '0.85rem', cursor: 'pointer',
              border: '1px solid #e2e8f0',
              background: filter === v ? 'var(--iitb-blue-primary)' : '#f8fafc',
              color: filter === v ? '#fff' : 'inherit',
            }}
          >
            {l}
          </button>
        ))}
        <button
          onClick={fetchOrders}
          style={{ marginLeft: 'auto', padding: '0.4rem 0.9rem', borderRadius: 50, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          🔄 Refresh
        </button>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="📋" text="No orders in this category." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(order => {
              const meta = ORDER_STATUS_META[order.status] || {};
              const nextStatus = NEXT_STATUS[order.status];
              return (
                <div key={order.id} className="hostel-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>
                      <strong>Order #{order.id}</strong>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        by {order.user_username} · {fmtTime(order.created_at)}
                      </span>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.65rem', borderRadius: 50, fontSize: '0.8rem', fontWeight: 700,
                      background: meta.bg, color: meta.color,
                    }}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    📍 Deliver to: <strong>{order.delivery_location_display}</strong>
                  </p>

                  <div style={{ marginBottom: '0.75rem' }}>
                    {order.order_items.map(oi => (
                      <div key={oi.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '0.15rem 0' }}>
                        <span>
                          <span style={{ color: oi.food_item_is_veg ? '#16a34a' : '#dc2626' }}>●</span>
                          {' '}{oi.food_item_name} × {oi.quantity}
                        </span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(parseFloat(oi.price) * oi.quantity)}</span>
                      </div>
                    ))}
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.35rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>
                      Total: {fmtPrice(order.total_price)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {order.status === 'PENDING' && (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleAction(order.id, 'accept')}
                          style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                        >
                          ✅ Accept
                        </button>
                        <button
                          onClick={() => handleAction(order.id, 'cancel')}
                          style={{
                            fontSize: '0.85rem', padding: '0.4rem 0.9rem', cursor: 'pointer',
                            background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8,
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </>
                    )}
                    {nextStatus && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleAction(order.id, nextStatus)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                      >
                        {ORDER_STATUS_META[nextStatus]?.icon} Mark as {ORDER_STATUS_META[nextStatus]?.label}
                      </button>
                    )}
                    {['ACCEPTED','PREPARING','OUT_FOR_DELIVERY'].includes(order.status) && (
                      <button
                        onClick={() => handleAction(order.id, 'cancel')}
                        style={{
                          fontSize: '0.85rem', padding: '0.4rem 0.9rem', cursor: 'pointer',
                          background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8,
                        }}
                      >
                        ❌ Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </>
  );
}

// --- Admin Menu ---
function AdminMenu() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState('');
  const [editItem, setEditItem] = useState(null);   // null = closed, {} = new, obj = edit
  const [form, setForm]       = useState({ name: '', description: '', price: '', is_veg: true, is_available: true, image: '' });
  const [saving, setSaving]   = useState(false);

  const fetchMenu = useCallback(() => {
    getAdminMenu()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  function openNew() {
    setForm({ name: '', description: '', price: '', is_veg: true, is_available: true, image: '' });
    setEditItem({});
  }

  function openEdit(item) {
    setForm({
      name: item.name, description: item.description, price: item.price,
      is_veg: item.is_veg, is_available: item.is_available, image: item.image || '',
    });
    setEditItem(item);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) { setMsg('Name and price are required.'); return; }
    setSaving(true);
    setMsg('');
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      if (editItem?.id) {
        await updateMenuItem(editItem.id, payload);
        setMsg('✅ Item updated.');
      } else {
        await addMenuItem(payload);
        setMsg('✅ Item added.');
      }
      setEditItem(null);
      fetchMenu();
    } catch (err) {
      setMsg(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteMenuItem(item.id);
      setMsg('✅ Item deleted.');
      fetchMenu();
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Delete failed.');
    }
  }

  async function toggleAvailability(item) {
    try {
      await updateMenuItem(item.id, { is_available: !item.is_available });
      fetchMenu();
    } catch {
      setMsg('Update failed.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <Alert msg={msg} onClose={() => setMsg('')} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--iitb-blue-primary)' }}>Menu Items ({items.length})</h4>
        <button className="btn btn-primary" onClick={openNew} style={{ fontSize: '0.85rem' }}>
          + Add Item
        </button>
      </div>

      {/* Edit/Add form modal */}
      {editItem !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '1.5rem',
            width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
            margin: '0 1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--iitb-blue-primary)' }}>
                {editItem.id ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>

            {[
              { label: 'Name *', field: 'name', type: 'text', placeholder: 'Item name' },
              { label: 'Price (₹) *', field: 'price', type: 'number', placeholder: '0' },
              { label: 'Description', field: 'description', type: 'text', placeholder: 'Short description' },
              { label: 'Image URL', field: 'image', type: 'text', placeholder: 'https://...' },
            ].map(({ label, field, type, placeholder }) => (
              <div key={field} style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.88rem' }}>{label}</label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.is_veg} onChange={e => setForm(p => ({ ...p, is_veg: e.target.checked }))} />
                Vegetarian
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(p => ({ ...p, is_available: e.target.checked }))} />
                Available
              </label>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: '0.7rem', fontSize: '1rem' }}
            >
              {saving ? 'Saving…' : (editItem.id ? 'Update Item' : 'Add Item')}
            </button>
          </div>
        </div>
      )}

      {items.length === 0
        ? <EmptyState icon="🍔" text="No menu items yet. Add your first item!" />
        : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
          }}>
            {items.map(item => (
              <div key={item.id} className="hostel-card" style={{ padding: '1rem', opacity: item.is_available ? 1 : 0.65 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{item.name}</h4>
                  <div style={{
                    padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                    background: item.is_veg ? '#dcfce7' : '#fee2e2',
                    color: item.is_veg ? '#16a34a' : '#dc2626',
                  }}>
                    {item.is_veg ? '● VEG' : '● NON-VEG'}
                  </div>
                </div>
                {item.description && (
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.description}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--iitb-blue-primary)' }}>{fmtPrice(item.price)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <StarRating value={Math.round(parseFloat(item.avg_rating))} size={13} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({item.review_count})</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => toggleAvailability(item)}
                    style={{
                      flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 8, border: 'none',
                      background: item.is_available ? '#fee2e2' : '#dcfce7',
                      color: item.is_available ? '#dc2626' : '#16a34a',
                    }}
                  >
                    {item.is_available ? '🔴 Disable' : '🟢 Enable'}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </>
  );
}

// --- Admin Analytics ---
function AdminAnalytics() {
  const [hostelData, setHostelData] = useState([]);
  const [topItems, setTopItems]     = useState([]);
  const [timeData, setTimeData]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([getHostelAnalytics(), getTopFoodItems(), getTimeWiseAnalytics()])
      .then(([h, t, tw]) => { setHostelData(h); setTopItems(t); setTimeData(tw); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const maxHostelCount = hostelData[0]?.order_count || 1;
  const maxItemCount   = topItems[0]?.total_quantity || 1;
  const maxTimeCount   = Math.max(...timeData.map(d => d.order_count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Hostel-wise */}
      <div className="hostel-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem', color: 'var(--iitb-blue-primary)' }}>📍 Orders by Location</h4>
        {hostelData.length === 0
          ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No data yet.</p>
          : hostelData.map(row => (
            <div key={row.delivery_location} style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                <span>{row.location_display}</span>
                <strong>{row.order_count} orders</strong>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8 }}>
                <div style={{
                  background: 'var(--iitb-blue-primary)',
                  width: `${(row.order_count / maxHostelCount) * 100}%`,
                  height: '100%', borderRadius: 4,
                }} />
              </div>
            </div>
          ))
        }
      </div>

      {/* Top items */}
      <div className="hostel-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem', color: 'var(--iitb-blue-primary)' }}>🔥 Top Ordered Items</h4>
        {topItems.length === 0
          ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No data yet.</p>
          : topItems.map((row, i) => (
            <div key={row.food_item_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#92400e' : '#e2e8f0',
                color: i < 3 ? '#fff' : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{row.food_item_name}</div>
                <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6, marginTop: 4 }}>
                  <div style={{
                    background: '#f59e0b',
                    width: `${(row.total_quantity / maxItemCount) * 100}%`,
                    height: '100%', borderRadius: 4,
                  }} />
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {row.total_quantity} sold
              </span>
            </div>
          ))
        }
      </div>

      {/* Time-wise */}
      <div className="hostel-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem', color: 'var(--iitb-blue-primary)' }}>⏰ Orders by Hour</h4>
        {timeData.length === 0
          ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No data yet.</p>
          : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, overflowX: 'auto' }}>
              {timeData.map(row => (
                <div key={row.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{row.order_count}</span>
                  <div style={{
                    width: 32,
                    height: `${Math.max(8, (row.order_count / maxTimeCount) * 90)}px`,
                    background: 'var(--iitb-blue-primary)',
                    borderRadius: '4px 4px 0 0',
                  }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {String(row.hour).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
