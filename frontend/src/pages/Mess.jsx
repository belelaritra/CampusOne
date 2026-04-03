import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getMessMenu, upsertMessMenu,
  getMessSettings, updateMessSettings,
  getGuestCoupons, buyGuestCoupons,
  getRebates, submitRebate, reviewRebate,
  getMessSMA, getMessAnalytics,
} from '../services/api.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESS_HOSTELS = [
  ['hostel_1','Hostel 1'],['hostel_2','Hostel 2'],['hostel_3','Hostel 3'],
  ['hostel_4','Hostel 4'],['hostel_5','Hostel 5'],['hostel_6','Hostel 6'],
  ['hostel_7','Hostel 7'],['hostel_8','Hostel 8'],['hostel_9','Hostel 9'],
  ['hostel_10','Hostel 10'],['hostel_11','Hostel 11'],['hostel_12','Hostel 12'],
  ['hostel_13','Hostel 13'],['hostel_14','Hostel 14'],['hostel_15','Hostel 15'],
  ['hostel_16','Hostel 16'],['hostel_17','Hostel 17'],['hostel_18','Hostel 18'],
  ['hostel_19','Hostel 19'],['hostel_21','Hostel 21'],['tansa_house','Tansa House'],
];
const HOSTEL_LABEL = Object.fromEntries(MESS_HOSTELS);

const MEALS = ['BREAKFAST','LUNCH','SNACKS','DINNER'];
const MEAL_LABEL = { BREAKFAST:'Breakfast', LUNCH:'Lunch', SNACKS:'Snacks', DINNER:'Dinner' };
const MEAL_ICON  = { BREAKFAST:'🌅', LUNCH:'☀️', SNACKS:'🍵', DINNER:'🌙' };
const MEAL_COLOR = {
  BREAKFAST:'#fef3c7', LUNCH:'#dcfce7', SNACKS:'#fce7f3', DINNER:'#e0e7ff'
};
const MEAL_TEXT  = {
  BREAKFAST:'#92400e', LUNCH:'#166534', SNACKS:'#9d174d', DINNER:'#3730a3'
};

function today() { return new Date().toISOString().slice(0,10); }

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

const CARD = {
  background:'var(--card-bg,#fff)',
  borderRadius:12,
  boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
  border:'1px solid var(--border-color,#e5e7eb)',
  overflow:'hidden',
};
const GRID = {
  display:'grid',
  gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
  gap:'1rem',
};

function Banner({ msg, onClose }) {
  if (!msg) return null;
  const isErr = msg.startsWith('❌');
  return (
    <div style={{
      padding:'0.65rem 1rem', borderRadius:8, marginBottom:'1rem',
      background: isErr ? '#fee2e2' : '#dcfce7',
      color:      isErr ? '#991b1b' : '#166534',
      fontSize:'0.875rem', display:'flex', justifyContent:'space-between',
    }}>
      <span>{msg}</span>
      {onClose && <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1rem' }}>×</button>}
    </div>
  );
}

function statusChip(s) {
  const map = {
    PENDING:  { bg:'#fef3c7',color:'#92400e' },
    APPROVED: { bg:'#dcfce7',color:'#166534' },
    REJECTED: { bg:'#fee2e2',color:'#991b1b' },
  };
  const { bg, color } = map[s] || { bg:'#f3f4f6',color:'#374151' };
  return (
    <span style={{ fontSize:'0.72rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:6, background:bg, color }}>
      {s}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Meal card — shows one meal slot
// ---------------------------------------------------------------------------

function MealCard({ meal }) {
  const icon  = MEAL_ICON[meal.meal_type]  || '🍽️';
  const label = MEAL_LABEL[meal.meal_type] || meal.meal_type;
  const bg    = MEAL_COLOR[meal.meal_type] || '#f3f4f6';
  const tc    = MEAL_TEXT[meal.meal_type]  || '#374151';
  return (
    <div style={{ ...CARD, display:'flex', flexDirection:'column' }}>
      <div style={{ background:bg, padding:'0.75rem 1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <span style={{ fontSize:'1.4rem' }}>{icon}</span>
        <strong style={{ color:tc, fontSize:'0.95rem' }}>{label}</strong>
      </div>
      <div style={{ padding:'0.75rem 1rem', flex:1 }}>
        {meal.items
          ? <p style={{ margin:0, fontSize:'0.875rem', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{meal.items}</p>
          : <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-secondary)', fontStyle:'italic' }}>
              Menu not posted yet
            </p>
        }
      </div>
      {meal.updated_at && (
        <div style={{ padding:'0 1rem 0.5rem', fontSize:'0.7rem', color:'var(--text-secondary)' }}>
          Updated: {new Date(meal.updated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// STUDENT DASHBOARD
// ===========================================================================

// ── Student: Menu Tab ────────────────────────────────────────────────────────

function StudentMenuTab({ userHostel }) {
  const [hostel,  setHostel]  = useState(userHostel || MESS_HOSTELS[0][0]);
  const [date,    setDate]    = useState(today());
  const [menu,    setMenu]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setMenu(await getMessMenu(hostel, date)); }
    catch { setMsg('❌ Failed to load menu.'); }
    finally { setLoading(false); }
  }, [hostel, date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <select value={hostel} onChange={e => setHostel(e.target.value)}
          className="input" style={{ flex:'1 1 160px' }}>
          {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input" style={{ flex:'1 1 160px' }} />
        <button className="btn" onClick={load}>🔄</button>
      </div>
      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : <div style={GRID}>
            {menu.map(m => <MealCard key={m.meal_type} meal={m} />)}
          </div>
      }
    </div>
  );
}

// ── Student: Buy Guest Coupons Tab ───────────────────────────────────────────

function StudentCouponsTab({ userHostel }) {
  const [hostel,    setHostel]    = useState(userHostel || MESS_HOSTELS[0][0]);
  const [date,      setDate]      = useState(today());
  const [meal,      setMeal]      = useState('BREAKFAST');
  const [qty,       setQty]       = useState(1);
  const [settings,  setSettings]  = useState(null);
  const [history,   setHistory]   = useState([]);
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState('');

  // Reload settings when hostel changes
  useEffect(() => {
    getMessSettings(hostel).then(setSettings).catch(() => {});
  }, [hostel]);

  // Load own coupon history
  const loadHistory = useCallback(async () => {
    try { setHistory(await getGuestCoupons()); }
    catch {}
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const unitPrice = settings
    ? Number(settings[`guest_${meal.toLowerCase()}_price`] || 0) : 0;
  const total     = unitPrice * qty;
  const maxPerSlot= settings?.guest_student_slot_limit || 10;

  async function handleBuy() {
    setBusy(true); setMsg('');
    try {
      await buyGuestCoupons({ hostel, date, meal_type: meal, quantity: qty });
      setMsg(`✅ Purchased ${qty} ${MEAL_LABEL[meal]} coupon(s) for ₹${total}`);
      loadHistory();
    } catch (e) {
      const detail = e.response?.data?.non_field_errors?.[0]
                  || e.response?.data?.detail
                  || '❌ Purchase failed.';
      setMsg(`❌ ${detail}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Purchase form */}
      <div style={{ ...CARD, padding:'1.25rem', marginBottom:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'1rem' }}>🎟️ Buy Guest Coupons</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'0.75rem' }}>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            Hostel
            <select value={hostel} onChange={e => setHostel(e.target.value)} className="input" style={{ marginTop:4, display:'block', width:'100%' }}>
              {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            Date
            <input type="date" value={date} min={today()} onChange={e => setDate(e.target.value)}
              className="input" style={{ marginTop:4, display:'block', width:'100%' }} />
          </label>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            Meal
            <select value={meal} onChange={e => setMeal(e.target.value)} className="input" style={{ marginTop:4, display:'block', width:'100%' }}>
              {MEALS.map(m => <option key={m} value={m}>{MEAL_ICON[m]} {MEAL_LABEL[m]}</option>)}
            </select>
          </label>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            Quantity (max {maxPerSlot})
            <input type="number" value={qty} min={1} max={maxPerSlot}
              onChange={e => setQty(Math.min(maxPerSlot, Math.max(1, Number(e.target.value))))}
              className="input" style={{ marginTop:4, display:'block', width:'100%' }} />
          </label>
        </div>

        <div style={{ marginTop:'1rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ fontSize:'0.875rem' }}>
            Unit price: <strong>₹{unitPrice}</strong>&ensp;|&ensp;
            Total: <strong style={{ color:'#2563eb' }}>₹{total}</strong>&ensp;|&ensp;
            Slot limit: <strong>{settings?.guest_slot_daily_limit || 50}/day</strong>
          </div>
          <button className="btn btn-primary" onClick={handleBuy} disabled={busy || qty < 1}>
            {busy ? 'Processing…' : '🛒 Buy Coupons'}
          </button>
        </div>
      </div>

      {/* Purchase history */}
      <h3 style={{ fontSize:'0.95rem', margin:'0 0 0.75rem' }}>📋 My Purchase History</h3>
      {history.length === 0
        ? <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>No purchases yet.</p>
        : <div style={GRID}>
            {history.map(p => (
              <div key={p.id} style={{ ...CARD }}>
                <div style={{ background:MEAL_COLOR[p.meal_type]||'#f3f4f6', padding:'0.6rem 0.9rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                  <span>{MEAL_ICON[p.meal_type]}</span>
                  <strong style={{ fontSize:'0.85rem', color:MEAL_TEXT[p.meal_type]||'#374151' }}>{MEAL_LABEL[p.meal_type]||p.meal_type}</strong>
                  <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:'var(--text-secondary)' }}>{p.date}</span>
                </div>
                <div style={{ padding:'0.65rem 0.9rem', fontSize:'0.82rem', display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                  <div>🏠 {HOSTEL_LABEL[p.hostel]||p.hostel}</div>
                  <div>🎟️ ×{p.quantity} × ₹{p.unit_price} = <strong>₹{p.total_amount}</strong></div>
                  <div style={{ color:'var(--text-secondary)', fontSize:'0.72rem' }}>{new Date(p.purchased_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Student: Rebate Tab ──────────────────────────────────────────────────────

function StudentRebateTab({ userHostel }) {
  const [start,    setStart]    = useState('');
  const [end,      setEnd]      = useState('');
  const [reason,   setReason]   = useState('');
  const [requests, setRequests] = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');

  const loadRequests = useCallback(async () => {
    try { setRequests(await getRebates()); }
    catch {}
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const days = start && end
    ? Math.max(0, Math.round((new Date(end) - new Date(start)) / 86400000) + 1)
    : 0;

  async function handleSubmit() {
    if (!start || !end) { setMsg('❌ Select start and end dates.'); return; }
    if (days < 3 || days > 15) { setMsg('❌ Duration must be 3–15 days.'); return; }
    if (!userHostel) { setMsg('❌ Please set your hostel in Profile first.'); return; }
    setBusy(true); setMsg('');
    try {
      await submitRebate({ start_date: start, end_date: end, reason });
      setMsg('✅ Rebate request submitted.');
      setStart(''); setEnd(''); setReason('');
      loadRequests();
    } catch (e) {
      const detail = e.response?.data?.non_field_errors?.[0]
                  || e.response?.data?.detail
                  || '❌ Submission failed.';
      setMsg(`❌ ${detail}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Application form */}
      <div style={{ ...CARD, padding:'1.25rem', marginBottom:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1rem', fontSize:'1rem' }}>📅 Apply for Rebate</h3>
        {!userHostel && (
          <p style={{ color:'#b45309', background:'#fef3c7', padding:'0.5rem 0.75rem', borderRadius:6, fontSize:'0.82rem', marginBottom:'1rem' }}>
            ⚠️ Please set your hostel in Profile to apply for rebate.
          </p>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'0.75rem' }}>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            Start Date
            <input type="date" value={start} min={today()} onChange={e => setStart(e.target.value)}
              className="input" style={{ marginTop:4, display:'block', width:'100%' }} />
          </label>
          <label style={{ fontSize:'0.82rem', fontWeight:600 }}>
            End Date
            <input type="date" value={end} min={start||today()} onChange={e => setEnd(e.target.value)}
              className="input" style={{ marginTop:4, display:'block', width:'100%' }} />
          </label>
        </div>
        {days > 0 && (
          <p style={{ fontSize:'0.82rem', marginTop:'0.5rem', color: days < 3 || days > 15 ? '#991b1b' : '#166534' }}>
            Duration: <strong>{days} day{days !== 1 ? 's' : ''}</strong>
            {days < 3 && ' (minimum 3)'}
            {days > 15 && ' (maximum 15)'}
          </p>
        )}
        <label style={{ fontSize:'0.82rem', fontWeight:600, display:'block', marginTop:'0.75rem' }}>
          Reason (optional)
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            className="input" placeholder="Vacation, medical leave, etc."
            style={{ marginTop:4, display:'block', width:'100%', resize:'vertical' }} />
        </label>
        <button className="btn btn-primary" onClick={handleSubmit}
          disabled={busy || days < 3 || days > 15 || !userHostel} style={{ marginTop:'0.75rem' }}>
          {busy ? 'Submitting…' : '📤 Submit Request'}
        </button>
      </div>

      {/* My requests */}
      <h3 style={{ fontSize:'0.95rem', margin:'0 0 0.75rem' }}>📋 My Rebate Requests</h3>
      {requests.length === 0
        ? <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>No requests yet.</p>
        : <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {requests.map(r => (
              <div key={r.id} style={{ ...CARD, padding:'1rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                  {statusChip(r.status)}
                  <strong style={{ fontSize:'0.88rem' }}>
                    {r.start_date} → {r.end_date}
                  </strong>
                  <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginLeft:'auto' }}>
                    {r.days} day{r.days !== 1 ? 's' : ''}
                  </span>
                </div>
                {r.reason && (
                  <p style={{ margin:'0 0 0.25rem', fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                    {r.reason}
                  </p>
                )}
                {r.admin_note && (
                  <p style={{ margin:0, fontSize:'0.78rem', color: r.status === 'REJECTED' ? '#991b1b' : '#166534' }}>
                    Admin note: {r.admin_note}
                  </p>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Student: SMA Balance Tab ─────────────────────────────────────────────────

function StudentSMATab() {
  const [sma,     setSma]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSma(await getMessSMA({ year, month })); }
    catch { setMsg('❌ Failed to load SMA.'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const balance = sma ? parseFloat(sma.balance) : null;

  const Row = ({ label, value, bold, color }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.5rem 0', borderBottom:'1px solid var(--border-color,#e5e7eb)', fontSize:'0.875rem' }}>
      <span style={{ color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, color: color || 'inherit' }}>{value}</span>
    </div>
  );

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Month selector */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input" style={{ flex:'1 1 120px' }}>
          {Array.from({length:12},(_,i)=>i+1).map(m=>(
            <option key={m} value={m}>{new Date(2000,m-1).toLocaleString('default',{month:'long'})} </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input" style={{ flex:'1 1 100px' }}>
          {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=>(
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="btn" onClick={load}>🔄</button>
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : !sma
          ? null
          : <>
              {/* Big balance card */}
              <div style={{ ...CARD, padding:'1.5rem', textAlign:'center', marginBottom:'1.5rem' }}>
                <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>
                  SMA Balance — {new Date(sma.year, sma.month-1).toLocaleString('default',{month:'long'})} {sma.year}
                </div>
                <div style={{
                  fontSize:'2.8rem', fontWeight:800,
                  color: sma.balance_negative ? '#dc2626' : '#16a34a',
                }}>
                  ₹{parseFloat(sma.balance).toLocaleString('en-IN', { minimumFractionDigits:2 })}
                </div>
                <div style={{ fontSize:'0.75rem', color: sma.balance_negative ? '#dc2626' : '#16a34a', marginTop:'0.25rem' }}>
                  {sma.balance_negative ? '⚠️ Negative balance' : '✅ Balance OK'}
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ ...CARD, padding:'1rem' }}>
                <h4 style={{ margin:'0 0 0.5rem', fontSize:'0.9rem' }}>📊 Breakdown</h4>
                <Row label="Monthly SMA"          value={`₹${parseFloat(sma.monthly_sma).toLocaleString('en-IN')}`} bold />
                <Row label="Daily deduction rate" value={`₹${sma.daily_rate}/day`} />
                <Row label="Days elapsed"         value={`${sma.days_elapsed} days`} />
                <Row label="Rebate days"          value={`${sma.rebate_days} days`} color="#16a34a" />
                <Row label="Total daily deducted" value={`−₹${parseFloat(sma.total_daily_deduction).toLocaleString('en-IN')}`} color="#dc2626" />
                <Row label="Rebate savings"       value={`+₹${parseFloat(sma.rebate_savings).toLocaleString('en-IN')}`} color="#16a34a" />
                <Row label="Guest coupon extra"   value={`−₹${parseFloat(sma.guest_coupon_extra).toLocaleString('en-IN')}`} color="#dc2626" />
                <Row label="Balance"
                  value={`₹${parseFloat(sma.balance).toLocaleString('en-IN', { minimumFractionDigits:2 })}`}
                  bold color={sma.balance_negative ? '#dc2626' : '#16a34a'} />
              </div>
            </>
      }
    </div>
  );
}

// ── Student root ─────────────────────────────────────────────────────────────

function StudentDashboard({ user }) {
  const TABS = [
    ['menu',    '🍽️ Today\'s Menu'],
    ['coupons', '🎟️ Guest Coupons'],
    ['rebate',  '📅 Rebate'],
    ['sma',     '💰 My SMA'],
  ];
  const [tab, setTab] = useState('menu');
  const hostel = user?.hostel || '';

  return (
    <div>
      {/* Hostel info banner */}
      {hostel
        ? <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>
            🏠 Your hostel: <strong>{HOSTEL_LABEL[hostel] || hostel}</strong>
            {user?.room_number && <> &ensp;· Room: <strong>{user.room_number}</strong></>}
          </div>
        : <div style={{ background:'#fef3c7', color:'#92400e', borderRadius:8, padding:'0.5rem 0.9rem', fontSize:'0.82rem', marginBottom:'1rem' }}>
            ⚠️ Set your hostel in <a href="/profile" style={{ color:'#92400e', fontWeight:700 }}>Profile</a> for personalised SMA tracking.
          </div>
      }

      {/* Tabs */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`tab-btn${tab===k?' active':''}`} style={{ fontSize:'0.85rem' }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'menu'    && <StudentMenuTab    userHostel={hostel} />}
      {tab === 'coupons' && <StudentCouponsTab userHostel={hostel} />}
      {tab === 'rebate'  && <StudentRebateTab  userHostel={hostel} />}
      {tab === 'sma'     && <StudentSMATab />}
    </div>
  );
}


// ===========================================================================
// ADMIN DASHBOARD
// ===========================================================================

// ── Admin: Menu Management Tab ───────────────────────────────────────────────

function AdminMenuTab({ adminHostel }) {
  const [hostel,  setHostel]  = useState(adminHostel || MESS_HOSTELS[0][0]);
  const [date,    setDate]    = useState(today());
  const [menu,    setMenu]    = useState([]);          // [{meal_type, items, ...}]
  const [edits,   setEdits]   = useState({});          // { BREAKFAST: '...', ... }
  const [saving,  setSaving]  = useState({});
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(true);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMessMenu(hostel, date);
      setMenu(data);
      const map = {};
      data.forEach(m => { map[m.meal_type] = m.items || ''; });
      setEdits(map);
    } catch { setMsg('❌ Failed to load menu.'); }
    finally { setLoading(false); }
  }, [hostel, date]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  async function saveSlot(meal_type) {
    setSaving(s => ({ ...s, [meal_type]: true }));
    setMsg('');
    try {
      await upsertMessMenu({ hostel, date, meal_type, items: edits[meal_type] || '' });
      setMsg(`✅ ${MEAL_LABEL[meal_type]} menu saved.`);
      loadMenu();
    } catch { setMsg('❌ Failed to save.'); }
    finally { setSaving(s => ({ ...s, [meal_type]: false })); }
  }

  async function saveAll() {
    setSaving({ BREAKFAST:true, LUNCH:true, SNACKS:true, DINNER:true });
    setMsg('');
    try {
      await Promise.all(
        MEALS.map(m => upsertMessMenu({ hostel, date, meal_type:m, items: edits[m]||'' }))
      );
      setMsg('✅ All slots saved.');
      loadMenu();
    } catch { setMsg('❌ Failed to save all.'); }
    finally { setSaving({}); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        {adminHostel
          ? <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:'2rem' }}>
              🏠 {HOSTEL_LABEL[adminHostel] || adminHostel}
            </span>
          : <select value={hostel} onChange={e => setHostel(e.target.value)} className="input" style={{ flex:'1 1 160px' }}>
              {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
        }
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="input" style={{ flex:'1 1 160px' }} />
        <button className="btn btn-primary" onClick={saveAll}>💾 Save All</button>
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {MEALS.map(meal_type => (
              <div key={meal_type} style={{ ...CARD }}>
                <div style={{ background:MEAL_COLOR[meal_type], padding:'0.65rem 1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <span style={{ fontSize:'1.2rem' }}>{MEAL_ICON[meal_type]}</span>
                  <strong style={{ color:MEAL_TEXT[meal_type], fontSize:'0.9rem' }}>{MEAL_LABEL[meal_type]}</strong>
                </div>
                <div style={{ padding:'0.75rem 1rem', display:'flex', gap:'0.75rem' }}>
                  <textarea
                    rows={3} value={edits[meal_type] || ''}
                    onChange={e => setEdits(s => ({ ...s, [meal_type]: e.target.value }))}
                    className="input" placeholder={`Enter ${MEAL_LABEL[meal_type]} items, one per line…`}
                    style={{ flex:1, resize:'vertical' }}
                  />
                  <button className="btn" onClick={() => saveSlot(meal_type)}
                    disabled={saving[meal_type]} style={{ alignSelf:'flex-start' }}>
                    {saving[meal_type] ? '…' : '💾'}
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Admin: Coupon Purchases Tab ──────────────────────────────────────────────

function AdminCouponsTab({ adminHostel }) {
  const [date,    setDate]    = useState(today());
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setCoupons(await getGuestCoupons({ date, hostel: adminHostel || undefined })); }
    catch { setMsg('❌ Failed to load.'); }
    finally { setLoading(false); }
  }, [date, adminHostel]);

  useEffect(() => { load(); }, [load]);

  // Group by meal for totals
  const mealTotals = MEALS.map(m => ({
    meal: m,
    qty:  coupons.filter(c => c.meal_type === m).reduce((a,b) => a + b.quantity, 0),
    rev:  coupons.filter(c => c.meal_type === m).reduce((a,b) => a + parseFloat(b.total_amount), 0),
  }));

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        <button className="btn" onClick={load}>🔄</button>
      </div>

      {/* Meal totals */}
      <div style={{ ...GRID, marginBottom:'1.25rem' }}>
        {mealTotals.map(({ meal, qty, rev }) => (
          <div key={meal} style={{ ...CARD }}>
            <div style={{ background:MEAL_COLOR[meal], padding:'0.6rem 0.9rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <span>{MEAL_ICON[meal]}</span>
              <strong style={{ fontSize:'0.85rem', color:MEAL_TEXT[meal] }}>{MEAL_LABEL[meal]}</strong>
            </div>
            <div style={{ padding:'0.6rem 0.9rem', fontSize:'0.85rem' }}>
              <div>🎟️ {qty} coupon{qty!==1?'s':''}</div>
              <div style={{ fontWeight:700 }}>₹{rev.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : coupons.length === 0
          ? <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>No purchases on this date.</p>
          : <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                <thead>
                  <tr style={{ background:'var(--bg-secondary,#f9fafb)' }}>
                    {['Student','Roll No','Room','Hostel','Meal','Qty','Unit','Total','Purchased At'].map(h => (
                      <th key={h} style={{ padding:'0.5rem 0.75rem', textAlign:'left', fontWeight:600, borderBottom:'1px solid var(--border-color,#e5e7eb)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(c => (
                    <tr key={c.id} style={{ borderBottom:'1px solid var(--border-color,#e5e7eb)' }}>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{c.student_name||c.student_username}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{c.roll_number||'—'}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{c.room_number||'—'}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{HOSTEL_LABEL[c.hostel_number]||c.hostel_number||'—'}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{MEAL_ICON[c.meal_type]} {MEAL_LABEL[c.meal_type]||c.meal_type}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>{c.quantity}</td>
                      <td style={{ padding:'0.45rem 0.75rem' }}>₹{c.unit_price}</td>
                      <td style={{ padding:'0.45rem 0.75rem', fontWeight:600 }}>₹{c.total_amount}</td>
                      <td style={{ padding:'0.45rem 0.75rem', color:'var(--text-secondary)' }}>{new Date(c.purchased_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// ── Admin: Rebate Requests Tab ───────────────────────────────────────────────

function AdminRebatesTab({ adminHostel }) {
  const [filter,   setFilter]   = useState('PENDING');
  const [rebates,  setRebates]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState({});
  const [note,     setNote]     = useState({});
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRebates(await getRebates({ status: filter || undefined })); }
    catch { setMsg('❌ Failed to load.'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(id, st) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await reviewRebate(id, { status: st, admin_note: note[id] || '' });
      setMsg(`✅ Request ${st}.`);
      load();
    } catch (e) {
      setMsg(`❌ ${e.response?.data?.detail || 'Failed'}`);
    } finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        {[['','All'],['PENDING','Pending'],['APPROVED','Approved'],['REJECTED','Rejected']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`tab-btn${filter===v?' active':''}`} style={{ fontSize:'0.82rem' }}>
            {l}
          </button>
        ))}
        <button className="btn" onClick={load} style={{ marginLeft:'auto', fontSize:'0.82rem' }}>🔄</button>
      </div>
      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : rebates.length === 0
          ? <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>No requests found.</p>
          : <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {rebates.map(r => (
                <div key={r.id} style={{ ...CARD, padding:'1rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                    {statusChip(r.status)}
                    <strong style={{ fontSize:'0.88rem' }}>
                      {r.student_name || r.student_username}
                      {r.student_roll && <span style={{ fontWeight:400, color:'var(--text-secondary)' }}> · {r.student_roll}</span>}
                    </strong>
                    <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginLeft:'auto' }}>
                      {HOSTEL_LABEL[r.hostel] || r.hostel}
                    </span>
                  </div>
                  <div style={{ fontSize:'0.82rem', marginBottom:'0.4rem' }}>
                    📅 <strong>{r.start_date}</strong> → <strong>{r.end_date}</strong>
                    &ensp;({r.days} day{r.days!==1?'s':''})
                  </div>
                  {r.reason && (
                    <p style={{ margin:'0 0 0.4rem', fontSize:'0.78rem', color:'var(--text-secondary)' }}>{r.reason}</p>
                  )}
                  {r.admin_note && (
                    <p style={{ margin:'0 0 0.4rem', fontSize:'0.78rem', color:'#166534' }}>Note: {r.admin_note}</p>
                  )}
                  {r.status === 'PENDING' && (
                    <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
                      <input placeholder="Admin note (optional)" value={note[r.id]||''}
                        onChange={e => setNote(n => ({ ...n, [r.id]: e.target.value }))}
                        className="input" style={{ flex:1, fontSize:'0.8rem' }} />
                      <button className="btn btn-primary" disabled={busy[r.id]}
                        onClick={() => handleReview(r.id,'APPROVED')}>✅ Approve</button>
                      <button className="btn" disabled={busy[r.id]}
                        onClick={() => handleReview(r.id,'REJECTED')}
                        style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5' }}>
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
      }
    </div>
  );
}

// ── Admin: Settings Tab ──────────────────────────────────────────────────────

function AdminSettingsTab({ adminHostel }) {
  const [hostel,   setHostel]   = useState(adminHostel || MESS_HOSTELS[0][0]);
  const [form,     setForm]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try { setForm(await getMessSettings(hostel)); }
    catch { setMsg('❌ Failed to load settings.'); }
    finally { setLoading(false); }
  }, [hostel]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function f(key) {
    return (
      <input type="number" step="0.01" min="0" value={form?.[key] ?? ''}
        onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))}
        className="input" style={{ width:'100%' }} />
    );
  }

  async function handleSave() {
    setSaving(true); setMsg('');
    try {
      const payload = { hostel, ...form };
      await updateMessSettings(payload);
      setMsg('✅ Settings saved.');
    } catch { setMsg('❌ Save failed.'); }
    finally { setSaving(false); }
  }

  const Section = ({ title, children }) => (
    <div style={{ ...CARD, padding:'1rem', marginBottom:'1rem' }}>
      <h4 style={{ margin:'0 0 0.75rem', fontSize:'0.9rem', borderBottom:'1px solid var(--border-color,#e5e7eb)', paddingBottom:'0.5rem' }}>
        {title}
      </h4>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'0.75rem' }}>
        {children}
      </div>
    </div>
  );

  const Field = ({ label, k }) => (
    <label style={{ fontSize:'0.8rem', fontWeight:600 }}>
      {label}
      <div style={{ marginTop:4 }}>{f(k)}</div>
    </label>
  );

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      {!adminHostel && (
        <div style={{ marginBottom:'1rem' }}>
          <select value={hostel} onChange={e => setHostel(e.target.value)} className="input">
            {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      {loading
        ? <p style={{ color:'var(--text-secondary)' }}>Loading…</p>
        : !form ? null
          : <>
              <Section title="💰 SMA & Daily Deductions">
                <Field label="Monthly SMA (₹)" k="monthly_sma" />
                <Field label="Breakfast deduction" k="breakfast_deduction" />
                <Field label="Lunch deduction" k="lunch_deduction" />
                <Field label="Snacks deduction" k="snacks_deduction" />
                <Field label="Dinner deduction" k="dinner_deduction" />
              </Section>
              <Section title="🎟️ Guest Coupon Pricing">
                <Field label="Breakfast price" k="guest_breakfast_price" />
                <Field label="Lunch price" k="guest_lunch_price" />
                <Field label="Snacks price" k="guest_snacks_price" />
                <Field label="Dinner price" k="guest_dinner_price" />
              </Section>
              <Section title="🔢 Coupon Limits">
                <Field label="Daily slot limit (all students)" k="guest_slot_daily_limit" />
                <Field label="Per-student slot limit" k="guest_student_slot_limit" />
              </Section>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Settings'}
              </button>
            </>
      }
    </div>
  );
}

// ── Admin: Analytics Tab ─────────────────────────────────────────────────────

function AdminAnalyticsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    getMessAnalytics()
      .then(setData)
      .catch(() => setMsg('❌ Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color:'var(--text-secondary)' }}>Loading…</p>;
  if (msg)     return <Banner msg={msg} />;
  if (!data)   return null;

  return (
    <div>
      <h3 style={{ margin:'0 0 1rem', fontSize:'0.95rem' }}>
        📊 Monthly Analytics — {new Date(data.year, data.month-1).toLocaleString('default',{month:'long'})} {data.year}
      </h3>
      <div style={{ ...GRID, marginBottom:'1.25rem' }}>
        {[
          { label:'Total Coupon Revenue', value:`₹${parseFloat(data.coupon_total_revenue).toLocaleString('en-IN')}`, icon:'💰' },
          { label:'Total Coupons Sold',   value:data.coupon_total_count, icon:'🎟️' },
          { label:'Rebates Pending',      value:data.rebate_pending,    icon:'⏳' },
          { label:'Rebates Approved',     value:data.rebate_approved,   icon:'✅' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ ...CARD, padding:'1.25rem', textAlign:'center' }}>
            <div style={{ fontSize:'1.8rem', marginBottom:'0.3rem' }}>{icon}</div>
            <div style={{ fontSize:'1.5rem', fontWeight:800 }}>{value}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'0.2rem' }}>{label}</div>
          </div>
        ))}
      </div>
      {data.meal_breakdown?.length > 0 && (
        <div style={{ ...CARD, padding:'1rem' }}>
          <h4 style={{ margin:'0 0 0.75rem', fontSize:'0.9rem' }}>Per-Meal Breakdown</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem' }}>
            {data.meal_breakdown.map(m => (
              <div key={m.meal_type} style={{ background:MEAL_COLOR[m.meal_type]||'#f3f4f6', borderRadius:8, padding:'0.75rem' }}>
                <div style={{ fontSize:'1.2rem' }}>{MEAL_ICON[m.meal_type]}</div>
                <div style={{ fontWeight:700, fontSize:'0.85rem', color:MEAL_TEXT[m.meal_type]||'#374151' }}>
                  {MEAL_LABEL[m.meal_type]||m.meal_type}
                </div>
                <div style={{ fontSize:'0.82rem' }}>Qty: {m.qty}</div>
                <div style={{ fontSize:'0.82rem' }}>Rev: ₹{parseFloat(m.revenue||0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin root ────────────────────────────────────────────────────────────────

function AdminDashboard({ user }) {
  const adminHostel = user?.mess_admin_hostel || null;  // null = staff (all)
  const TABS = [
    ['menu',      '🍽️ Daily Menu'],
    ['coupons',   '🎟️ Coupon Purchases'],
    ['rebates',   '📅 Rebate Requests'],
    ['settings',  '⚙️ Settings'],
    ['analytics', '📊 Analytics'],
  ];
  const [tab, setTab] = useState('menu');

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>
          {adminHostel ? `Admin: ${HOSTEL_LABEL[adminHostel]||adminHostel}` : '🌐 Superadmin (all hostels)'}
        </span>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`tab-btn${tab===k?' active':''}`} style={{ fontSize:'0.85rem' }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'menu'      && <AdminMenuTab      adminHostel={adminHostel} />}
      {tab === 'coupons'   && <AdminCouponsTab   adminHostel={adminHostel} />}
      {tab === 'rebates'   && <AdminRebatesTab   adminHostel={adminHostel} />}
      {tab === 'settings'  && <AdminSettingsTab  adminHostel={adminHostel} />}
      {tab === 'analytics' && <AdminAnalyticsTab />}
    </div>
  );
}


// ===========================================================================
// Page root
// ===========================================================================

export default function MessPage() {
  const { user } = useAuth();
  const isAdmin  = user?.is_mess_admin || false;

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
        <h2 style={{ margin:0 }}>🍱 Mess</h2>
        {isAdmin && (
          <span style={{ fontSize:'0.72rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:6, background:'#dbeafe', color:'#1e40af' }}>
            ADMIN
          </span>
        )}
      </div>
      {isAdmin
        ? <AdminDashboard user={user} />
        : <StudentDashboard user={user} />
      }
    </div>
  );
}
