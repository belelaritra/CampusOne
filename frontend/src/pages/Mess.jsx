import { useState, useEffect, useCallback, useMemo } from 'react';
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

const MEALS      = ['BREAKFAST','LUNCH','SNACKS','DINNER'];
const MEAL_LABEL = { BREAKFAST:'Breakfast', LUNCH:'Lunch', SNACKS:'Snacks', DINNER:'Dinner' };
const MEAL_ICON  = { BREAKFAST:'🌅', LUNCH:'☀️', SNACKS:'🍵', DINNER:'🌙' };
const MEAL_GRAD  = {
  BREAKFAST: 'linear-gradient(135deg,#fef3c7,#fde68a)',
  LUNCH:     'linear-gradient(135deg,#d1fae5,#a7f3d0)',
  SNACKS:    'linear-gradient(135deg,#fce7f3,#fbcfe8)',
  DINNER:    'linear-gradient(135deg,#e0e7ff,#c7d2fe)',
};
const MEAL_TEXT  = { BREAKFAST:'#92400e', LUNCH:'#065f46', SNACKS:'#9d174d', DINNER:'#3730a3' };
const MEAL_BORDER= { BREAKFAST:'#f59e0b', LUNCH:'#10b981', SNACKS:'#ec4899', DINNER:'#6366f1' };

function todayStr() { return new Date().toISOString().slice(0,10); }
function todayLabel() {
  return new Date().toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function addDays(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------
function Banner({ msg, onClose }) {
  if (!msg) return null;
  const isErr = msg.startsWith('❌');
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'0.75rem 1rem', borderRadius:'var(--radius-md)',
      marginBottom:'1rem',
      background: isErr ? '#fee2e2' : '#dcfce7',
      color:      isErr ? '#991b1b' : '#166534',
      fontSize:'0.875rem', border: isErr ? '1px solid #fca5a5' : '1px solid #86efac',
    }}>
      <span>{msg}</span>
      {onClose && (
        <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',lineHeight:1,color:'inherit',marginLeft:'0.5rem' }}>×</button>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    PENDING:  { bg:'#fef3c7',color:'#92400e',border:'#fde68a' },
    APPROVED: { bg:'#dcfce7',color:'#166534',border:'#86efac' },
    REJECTED: { bg:'#fee2e2',color:'#991b1b',border:'#fca5a5' },
  };
  const s = map[status] || { bg:'#f3f4f6',color:'#374151',border:'#e5e7eb' };
  return (
    <span style={{
      fontSize:'0.7rem', fontWeight:700, padding:'0.2rem 0.6rem',
      borderRadius:999, background:s.bg, color:s.color,
      border:`1px solid ${s.border}`, letterSpacing:'0.04em',
    }}>
      {status}
    </span>
  );
}

function SectionCard({ children, style = {} }) {
  return (
    <div className="request-card" style={{ marginBottom:'1.5rem', ...style }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <span style={{ display:'block', fontSize:'0.8rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.35rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Meal Card
// ---------------------------------------------------------------------------
function MealCard({ meal }) {
  const type  = meal.meal_type;
  const empty = !meal.items;
  return (
    <div style={{
      background:'var(--white-glass)',
      backdropFilter:'blur(20px)',
      borderRadius:'var(--radius-lg)',
      border:`1px solid ${MEAL_BORDER[type]}40`,
      boxShadow:'var(--shadow-sm)',
      overflow:'hidden',
      transition:'var(--transition)',
      display:'flex', flexDirection:'column',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='var(--shadow-md)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='var(--shadow-sm)'; }}
    >
      {/* header strip */}
      <div style={{ background:MEAL_GRAD[type], padding:'0.7rem 1rem', display:'flex', alignItems:'center', gap:'0.6rem', borderBottom:`2px solid ${MEAL_BORDER[type]}60` }}>
        <span style={{ fontSize:'1.5rem' }}>{MEAL_ICON[type]}</span>
        <div>
          <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'0.95rem', color:MEAL_TEXT[type] }}>
            {MEAL_LABEL[type]}
          </div>
          {meal.updated_at && !empty && (
            <div style={{ fontSize:'0.67rem', color:MEAL_TEXT[type], opacity:0.7 }}>
              Updated {new Date(meal.updated_at).toLocaleTimeString('en-IN',{ hour:'2-digit',minute:'2-digit' })}
            </div>
          )}
        </div>
      </div>
      {/* body */}
      <div style={{ padding:'0.85rem 1rem', flex:1 }}>
        {empty
          ? <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-light)', fontStyle:'italic', textAlign:'center', padding:'0.5rem 0' }}>
              Menu not posted yet
            </p>
          : <p style={{ margin:0, fontSize:'0.875rem', lineHeight:1.65, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>
              {meal.items}
            </p>
        }
      </div>
    </div>
  );
}

// ===========================================================================
// STUDENT TABS
// ===========================================================================

// ── Menu ────────────────────────────────────────────────────────────────────
function StudentMenuTab({ userHostel }) {
  const [hostel,  setHostel]  = useState(userHostel || 'hostel_1');
  const [menu,    setMenu]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setMenu(await getMessMenu(hostel, todayStr())); }
    catch { setMsg('❌ Failed to load menu.'); }
    finally { setLoading(false); }
  }, [hostel]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Date + hostel selector row */}
      <SectionCard>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:'1.1rem', fontWeight:700, color:'var(--iitb-blue-primary)' }}>
              📅 {todayLabel()}
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginTop:'0.1rem' }}>Today's mess menu</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <FieldLabel>Hostel</FieldLabel>
            <select value={hostel} onChange={e => setHostel(e.target.value)}
              className="search-input" style={{ fontSize:'0.875rem', padding:'0.4rem 0.75rem' }}>
              {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={load} style={{ padding:'0.4rem 0.75rem', fontSize:'0.82rem' }}>🔄</button>
          </div>
        </div>
      </SectionCard>

      {loading
        ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
            <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>⏳</div>Loading menu…
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem' }}>
            {(menu.length ? menu : MEALS.map(m => ({ meal_type:m, items:'', updated_at:null })))
              .map(m => <MealCard key={m.meal_type} meal={m} />)}
          </div>
      }
    </div>
  );
}

// ── Guest Coupons ─────────────────────────────────────────────────────────
function StudentCouponsTab({ userHostel }) {
  const [hostel,   setHostel]   = useState(userHostel || 'hostel_1');
  const [meal,     setMeal]     = useState('BREAKFAST');
  const [qty,      setQty]      = useState(1);
  const [settings, setSettings] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');

  useEffect(() => { getMessSettings(hostel).then(setSettings).catch(() => {}); }, [hostel]);

  const loadHistory = useCallback(async () => {
    try { setHistory(await getGuestCoupons()); } catch {}
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const priceKey   = `guest_${meal.toLowerCase()}_price`;
  const unitPrice  = settings ? Number(settings[priceKey] || 0) : 0;
  const maxPerSlot = settings?.guest_student_slot_limit || 10;
  const slotLimit  = settings?.guest_slot_daily_limit || 50;
  const total      = unitPrice * qty;

  async function handleBuy() {
    setBusy(true); setMsg('');
    try {
      await buyGuestCoupons({ hostel, date: todayStr(), meal_type: meal, quantity: qty });
      setMsg(`✅ Purchased ${qty} ${MEAL_LABEL[meal]} coupon(s) — ₹${total} charged`);
      loadHistory();
    } catch (e) {
      const detail = e.response?.data?.non_field_errors?.[0]
                  || e.response?.data?.detail || 'Purchase failed';
      setMsg(`❌ ${detail}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Purchase form */}
      <SectionCard>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:'1rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          🎟️ Buy Guest Coupons
          <span style={{ fontSize:'0.72rem', fontWeight:500, color:'var(--text-secondary)', padding:'0.2rem 0.6rem', borderRadius:999, background:'rgba(0,61,130,0.08)' }}>
            Today · {todayStr()}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Hostel</label>
            <select value={hostel} onChange={e => setHostel(e.target.value)}>
              {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Meal Slot</label>
            <select value={meal} onChange={e => setMeal(e.target.value)}>
              {MEALS.map(m => <option key={m} value={m}>{MEAL_ICON[m]} {MEAL_LABEL[m]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Quantity (max {maxPerSlot})</label>
            <input type="number" min={1} max={maxPerSlot} value={qty}
              onChange={e => setQty(Math.min(maxPerSlot, Math.max(1, +e.target.value)))} />
          </div>
        </div>

        {/* Summary + buy */}
        <div style={{ marginTop:'1.25rem', display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
            {[
              { label:'Unit Price', val:`₹${unitPrice}` },
              { label:'Total',      val:`₹${total}`, highlight:true },
              { label:'Slot Limit', val:`${slotLimit}/day` },
            ].map(({ label, val, highlight }) => (
              <div key={label}>
                <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
                <div style={{ fontFamily:'var(--font-heading)', fontSize:'1.25rem', fontWeight:700, color: highlight ? 'var(--iitb-blue-primary)' : 'var(--text-primary)' }}>{val}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleBuy} disabled={busy || qty < 1}
            style={{ marginLeft:'auto', padding:'0.6rem 1.5rem' }}>
            {busy ? '⏳ Processing…' : '🛒 Buy Now'}
          </button>
        </div>
      </SectionCard>

      {/* History */}
      <div style={{ fontFamily:'var(--font-heading)', fontSize:'0.95rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'0.75rem' }}>
        📋 Purchase History
      </div>
      {history.length === 0
        ? <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-secondary)', background:'var(--white-glass)', borderRadius:'var(--radius-lg)', border:'1px dashed rgba(0,61,130,0.15)' }}>
            <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>🎟️</div>
            <p style={{ margin:0, fontSize:'0.875rem' }}>No coupon purchases yet</p>
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem' }}>
            {history.map(p => (
              <div key={p.id} style={{
                background:'var(--white-glass)', backdropFilter:'blur(20px)',
                borderRadius:'var(--radius-lg)', overflow:'hidden',
                border:`1px solid ${MEAL_BORDER[p.meal_type] || '#e5e7eb'}40`,
                boxShadow:'var(--shadow-sm)',
              }}>
                <div style={{ background:MEAL_GRAD[p.meal_type]||'#f3f4f6', padding:'0.55rem 0.85rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                  <span style={{ fontSize:'1.1rem' }}>{MEAL_ICON[p.meal_type]}</span>
                  <span style={{ fontWeight:700, fontSize:'0.85rem', color:MEAL_TEXT[p.meal_type] }}>{MEAL_LABEL[p.meal_type]||p.meal_type}</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:MEAL_TEXT[p.meal_type], opacity:0.8 }}>{p.date}</span>
                </div>
                <div style={{ padding:'0.65rem 0.85rem', fontSize:'0.82rem', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <div style={{ fontWeight:600 }}>🏠 {HOSTEL_LABEL[p.hostel]||p.hostel}</div>
                  <div>🎟️ ×{p.quantity} × ₹{p.unit_price}</div>
                  <div style={{ fontFamily:'var(--font-heading)', fontSize:'1rem', fontWeight:800, color:'var(--iitb-blue-primary)' }}>₹{p.total_amount}</div>
                  <div style={{ fontSize:'0.7rem', color:'var(--text-light)' }}>{new Date(p.purchased_at).toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Rebate ────────────────────────────────────────────────────────────────
function StudentRebateTab({ userHostel }) {
  const [start,    setStart]    = useState('');
  const [duration, setDuration] = useState(3);
  const [reason,   setReason]   = useState('');
  const [requests, setRequests] = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');

  // Auto-compute end date
  const endDate = useMemo(() => start ? addDays(start, duration - 1) : '', [start, duration]);

  const loadRequests = useCallback(async () => {
    try { setRequests(await getRebates()); } catch {}
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleSubmit() {
    if (!start) { setMsg('❌ Please select a start date.'); return; }
    if (!userHostel) { setMsg('❌ Set your hostel in Profile first.'); return; }
    setBusy(true); setMsg('');
    try {
      await submitRebate({ start_date: start, end_date: endDate, reason });
      setMsg('✅ Rebate request submitted successfully.');
      setStart(''); setDuration(3); setReason('');
      loadRequests();
    } catch (e) {
      const detail = e.response?.data?.non_field_errors?.[0]
                  || e.response?.data?.detail || 'Submission failed';
      setMsg(`❌ ${detail}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {/* Application form */}
      <SectionCard>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:'1rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'1.25rem' }}>
          📅 Apply for Mess Rebate
        </div>

        {!userHostel && (
          <div style={{ background:'#fef3c7', color:'#92400e', padding:'0.65rem 1rem', borderRadius:'var(--radius-md)', fontSize:'0.82rem', marginBottom:'1rem', border:'1px solid #fde68a' }}>
            ⚠️ Please set your hostel in Profile to apply for rebate.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Start Date</label>
            <input type="date" value={start} min={todayStr()}
              onChange={e => setStart(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Duration</label>
            <select value={duration} onChange={e => setDuration(+e.target.value)}>
              {Array.from({length:15},(_,i)=>i+1).map(n => (
                <option key={n} value={n}>{n} day{n!==1?'s':''}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>End Date (auto)</label>
            <input type="date" value={endDate} readOnly
              style={{ background:'rgba(0,61,130,0.04)', cursor:'not-allowed' }} />
          </div>
        </div>

        {start && (
          <div style={{ marginTop:'0.75rem', display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ fontSize:'0.82rem', padding:'0.4rem 0.9rem', borderRadius:999, background:'rgba(0,61,130,0.08)', color:'var(--iitb-blue-primary)', fontWeight:600 }}>
              📆 {start} → {endDate} · <strong>{duration} day{duration!==1?'s':''}</strong> rebate
            </div>
          </div>
        )}

        <div className="form-group" style={{ margin:'1rem 0 0' }}>
          <label>Reason (optional)</label>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Vacation, medical leave, semester break…"
            style={{ resize:'vertical' }} />
        </div>

        <div style={{ marginTop:'1rem' }}>
          <button className="btn btn-primary" onClick={handleSubmit}
            disabled={busy || !start || !userHostel}>
            {busy ? '⏳ Submitting…' : '📤 Submit Rebate Request'}
          </button>
        </div>
      </SectionCard>

      {/* My requests */}
      <div style={{ fontFamily:'var(--font-heading)', fontSize:'0.95rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'0.75rem' }}>
        📋 My Rebate Requests
      </div>
      {requests.length === 0
        ? <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-secondary)', background:'var(--white-glass)', borderRadius:'var(--radius-lg)', border:'1px dashed rgba(0,61,130,0.15)' }}>
            <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>📅</div>
            <p style={{ margin:0, fontSize:'0.875rem' }}>No rebate requests yet</p>
          </div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {requests.map(r => (
              <div key={r.id} className="request-card" style={{ padding:'1rem 1.25rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                  <StatusPill status={r.status} />
                  <span style={{ fontFamily:'var(--font-heading)', fontWeight:700 }}>
                    {r.start_date} → {r.end_date}
                  </span>
                  <span style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginLeft:'auto' }}>
                    {r.days} day{r.days!==1?'s':''}
                  </span>
                </div>
                {r.reason && <p style={{ margin:'0 0 0.25rem', fontSize:'0.8rem', color:'var(--text-secondary)' }}>{r.reason}</p>}
                {r.admin_note && (
                  <p style={{ margin:0, fontSize:'0.78rem', padding:'0.35rem 0.65rem', borderRadius:'var(--radius-sm)', background: r.status==='APPROVED' ? '#dcfce7' : '#fee2e2', color: r.status==='APPROVED' ? '#166534' : '#991b1b' }}>
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

// ── SMA Balance ────────────────────────────────────────────────────────────
function StudentSMATab() {
  const [sma,     setSma]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    try { setSma(await getMessSMA({ year: now.getFullYear(), month: now.getMonth()+1 })); }
    catch { setMsg('❌ Failed to load SMA.'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const balance = sma ? parseFloat(sma.balance) : null;
  const isNeg   = sma?.balance_negative;

  const LedgerRow = ({ label, value, color, borderTop }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'0.55rem 0', borderBottom:'1px solid rgba(0,61,130,0.08)', borderTop: borderTop ? '2px solid rgba(0,61,130,0.15)' : undefined, marginTop: borderTop ? '0.25rem' : undefined }}>
      <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight:600, fontSize:'0.875rem', color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />

      {loading
        ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
            <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>⏳</div>Loading SMA…
          </div>
        : !sma ? null
          : <>
              {/* Big balance hero card */}
              <SectionCard style={{ textAlign:'center', padding:'2rem 1.5rem', background: isNeg ? 'linear-gradient(135deg,#fee2e2,#fecaca)' : 'linear-gradient(135deg,#dcfce7,#bbf7d0)', border: isNeg ? '1px solid #fca5a5' : '1px solid #86efac' }}>
                <div style={{ fontSize:'0.82rem', fontWeight:600, color: isNeg ? '#991b1b' : '#166534', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>
                  {isNeg ? '⚠️ Negative Balance' : '✅ Current SMA Balance'}
                </div>
                <div style={{ fontFamily:'var(--font-heading)', fontSize:'3rem', fontWeight:800, color: isNeg ? '#dc2626' : '#16a34a', lineHeight:1.1 }}>
                  ₹{Math.abs(balance).toLocaleString('en-IN',{minimumFractionDigits:2})}
                </div>
                {isNeg && <div style={{ fontSize:'0.82rem', color:'#991b1b', marginTop:'0.4rem' }}>You owe this amount to the mess</div>}
                <div style={{ marginTop:'1rem', fontSize:'0.78rem', color: isNeg ? '#991b1b' : '#166534' }}>
                  {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · auto-updated
                </div>
              </SectionCard>

              {/* Breakdown */}
              <SectionCard style={{ padding:'1.25rem' }}>
                <div style={{ fontFamily:'var(--font-heading)', fontSize:'0.95rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'0.75rem' }}>
                  📊 {sma.semester} Semester Breakdown — {sma.year}
                </div>
                <LedgerRow label="Semester Period"              value={`${sma.semester_start} → ${sma.semester_end}`} />
                <LedgerRow label="Semester SMA Allocation"      value={`₹${parseFloat(sma.semester_sma).toLocaleString('en-IN')}`} />
                <LedgerRow label="Daily Deduction Rate"         value={`₹${sma.daily_rate}/day`} />
                <LedgerRow label="Days Elapsed (this semester)" value={`${sma.days_elapsed} days`} />
                <LedgerRow label="Rebate Days (approved)"       value={`${sma.rebate_days} days`} color="#16a34a" />
                <LedgerRow label="Total Meal Deductions"        value={`−₹${parseFloat(sma.total_daily_deduction).toLocaleString('en-IN')}`} color="#dc2626" />
                <LedgerRow label="Rebate Savings"               value={`+₹${parseFloat(sma.rebate_savings).toLocaleString('en-IN')}`} color="#16a34a" />
                <LedgerRow label="Guest Coupon Charges"         value={`−₹${parseFloat(sma.guest_coupon_extra).toLocaleString('en-IN')}`} color="#dc2626" />
                <LedgerRow label="Current Balance" borderTop
                  value={`₹${parseFloat(sma.balance).toLocaleString('en-IN',{minimumFractionDigits:2})}`}
                  color={isNeg ? '#dc2626' : '#16a34a'} />
              </SectionCard>
            </>
      }
    </div>
  );
}

// ── Student Root ──────────────────────────────────────────────────────────
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
      {hostel
        ? <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            <span>🏠</span>
            <span>Your hostel: <strong style={{ color:'var(--iitb-blue-primary)' }}>{HOSTEL_LABEL[hostel]||hostel}</strong></span>
            {user?.room_number && <><span>·</span><span>Room <strong style={{ color:'var(--iitb-blue-primary)' }}>{user.room_number}</strong></span></>}
          </div>
        : <div style={{ background:'#fef3c7', color:'#92400e', borderRadius:'var(--radius-md)', padding:'0.55rem 1rem', fontSize:'0.82rem', marginBottom:'1rem', border:'1px solid #fde68a', display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <span>⚠️</span>
            <span>Set your hostel in <a href="/profile" style={{ color:'#92400e', fontWeight:700 }}>Profile</a> for personalised SMA & rebate tracking.</span>
          </div>
      }
      <div className="tab-navigation">
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-btn${tab===k?' active':''}`}>{l}</button>
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
// ADMIN TABS
// ===========================================================================

// ── Menu ──────────────────────────────────────────────────────────────────
function AdminMenuTab({ adminHostel }) {
  const [hostel,  setHostel]  = useState(adminHostel || 'hostel_1');
  const [date,    setDate]    = useState(todayStr());
  const [edits,   setEdits]   = useState({ BREAKFAST:'',LUNCH:'',SNACKS:'',DINNER:'' });
  const [saving,  setSaving]  = useState({});
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(true);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMessMenu(hostel, date);
      const map = {}; data.forEach(m => { map[m.meal_type] = m.items || ''; });
      setEdits(prev => ({ BREAKFAST:'',LUNCH:'',SNACKS:'',DINNER:'', ...map }));
    } catch { setMsg('❌ Failed to load menu.'); }
    finally { setLoading(false); }
  }, [hostel, date]);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  async function saveSlot(meal_type) {
    setSaving(s => ({ ...s, [meal_type]: true })); setMsg('');
    try {
      await upsertMessMenu({ hostel, date, meal_type, items: edits[meal_type] });
      setMsg(`✅ ${MEAL_LABEL[meal_type]} saved.`);
    } catch { setMsg('❌ Save failed.'); }
    finally { setSaving(s => ({ ...s, [meal_type]: false })); }
  }

  async function saveAll() {
    setSaving({ BREAKFAST:true,LUNCH:true,SNACKS:true,DINNER:true }); setMsg('');
    try {
      await Promise.all(MEALS.map(m => upsertMessMenu({ hostel, date, meal_type:m, items:edits[m]||'' })));
      setMsg('✅ All meal slots saved.');
      loadMenu();
    } catch { setMsg('❌ Save failed.'); }
    finally { setSaving({}); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <SectionCard>
        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          {adminHostel
            ? <div>
                <FieldLabel>Hostel</FieldLabel>
                <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--iitb-blue-primary)', padding:'0.5rem 0' }}>{HOSTEL_LABEL[adminHostel]||adminHostel}</div>
              </div>
            : <div className="form-group" style={{ margin:0, flex:1, minWidth:160 }}>
                <label>Hostel</label>
                <select value={hostel} onChange={e => setHostel(e.target.value)}>
                  {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
          }
          <div className="form-group" style={{ margin:0, flex:1, minWidth:160 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={saveAll} style={{ marginBottom:0 }}>
            💾 Save All Slots
          </button>
        </div>
      </SectionCard>
      {loading
        ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>Loading…</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {MEALS.map(meal_type => (
              <div key={meal_type} style={{
                background:'var(--white-glass)', backdropFilter:'blur(20px)',
                borderRadius:'var(--radius-lg)', border:`1px solid ${MEAL_BORDER[meal_type]}40`,
                overflow:'hidden', boxShadow:'var(--shadow-sm)',
              }}>
                <div style={{ background:MEAL_GRAD[meal_type], padding:'0.65rem 1rem', display:'flex', alignItems:'center', gap:'0.6rem', borderBottom:`2px solid ${MEAL_BORDER[meal_type]}60` }}>
                  <span style={{ fontSize:'1.3rem' }}>{MEAL_ICON[meal_type]}</span>
                  <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'0.9rem', color:MEAL_TEXT[meal_type] }}>{MEAL_LABEL[meal_type]}</span>
                </div>
                <div style={{ padding:'0.85rem 1rem', display:'flex', gap:'0.75rem' }}>
                  <textarea rows={3} value={edits[meal_type]||''}
                    onChange={e => setEdits(s => ({ ...s, [meal_type]: e.target.value }))}
                    placeholder={`Enter ${MEAL_LABEL[meal_type]} items, one per line…`}
                    style={{ flex:1, resize:'vertical', border:'2px solid rgba(0,61,130,0.15)', borderRadius:'var(--radius-md)', padding:'0.6rem 0.85rem', fontFamily:'var(--font-body)', fontSize:'0.875rem', outline:'none', transition:'var(--transition)' }}
                    onFocus={e => { e.target.style.borderColor='var(--iitb-blue-light)'; e.target.style.boxShadow='0 0 0 4px rgba(0,61,130,0.1)'; }}
                    onBlur={e  => { e.target.style.borderColor='rgba(0,61,130,0.15)'; e.target.style.boxShadow=''; }}
                  />
                  <button className="btn btn-secondary" onClick={() => saveSlot(meal_type)}
                    disabled={saving[meal_type]} style={{ alignSelf:'flex-start', padding:'0.5rem 0.9rem' }}>
                    {saving[meal_type] ? '⏳' : '💾'}
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Admin Coupons ──────────────────────────────────────────────────────────
function AdminCouponsTab({ adminHostel }) {
  const [date,    setDate]    = useState(todayStr());
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setCoupons(await getGuestCoupons({ date, hostel: adminHostel||undefined })); }
    catch { setMsg('❌ Failed to load.'); }
    finally { setLoading(false); }
  }, [date, adminHostel]);
  useEffect(() => { load(); }, [load]);

  const mealTotals = MEALS.map(m => ({
    meal: m,
    qty:  coupons.filter(c=>c.meal_type===m).reduce((a,b)=>a+b.quantity,0),
    rev:  coupons.filter(c=>c.meal_type===m).reduce((a,b)=>a+parseFloat(b.total_amount),0),
  }));
  const grandTotal = coupons.reduce((a,b) => a+parseFloat(b.total_amount),0);

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <SectionCard>
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end', flexWrap:'wrap' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width:'auto' }} />
          </div>
          <button className="btn btn-secondary" onClick={load} style={{ marginBottom:0 }}>🔄 Refresh</button>
          {grandTotal > 0 && (
            <div style={{ marginLeft:'auto', fontFamily:'var(--font-heading)', fontSize:'1.1rem', fontWeight:800, color:'var(--iitb-blue-primary)' }}>
              Total: ₹{grandTotal.toFixed(2)}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Per-meal summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.25rem' }}>
        {mealTotals.map(({ meal, qty, rev }) => (
          <div key={meal} style={{
            background:MEAL_GRAD[meal], borderRadius:'var(--radius-lg)',
            border:`1px solid ${MEAL_BORDER[meal]}60`, padding:'0.85rem 1rem',
          }}>
            <div style={{ fontSize:'1.3rem', marginBottom:'0.3rem' }}>{MEAL_ICON[meal]}</div>
            <div style={{ fontWeight:700, fontSize:'0.82rem', color:MEAL_TEXT[meal] }}>{MEAL_LABEL[meal]}</div>
            <div style={{ fontSize:'0.78rem', color:MEAL_TEXT[meal], opacity:0.8 }}>×{qty} coupons</div>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:'1rem', fontWeight:800, color:MEAL_TEXT[meal], marginTop:'0.25rem' }}>₹{rev.toFixed(0)}</div>
          </div>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>Loading…</div>
        : coupons.length === 0
          ? <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-secondary)', background:'var(--white-glass)', borderRadius:'var(--radius-lg)', border:'1px dashed rgba(0,61,130,0.15)' }}>
              <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>🎟️</div>No purchases on this date.
            </div>
          : <div style={{ overflowX:'auto', background:'var(--white-glass)', backdropFilter:'blur(20px)', borderRadius:'var(--radius-lg)', border:'1px solid rgba(0,61,130,0.1)', boxShadow:'var(--shadow-sm)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                <thead>
                  <tr style={{ background:'rgba(0,61,130,0.06)' }}>
                    {['Student','Roll','Room','Hostel','Meal','Qty','Unit','Total','Time'].map(h => (
                      <th key={h} style={{ padding:'0.6rem 0.85rem', textAlign:'left', fontWeight:700, color:'var(--iitb-blue-primary)', borderBottom:'2px solid rgba(0,61,130,0.12)', whiteSpace:'nowrap', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c,i) => (
                    <tr key={c.id} style={{ borderBottom:'1px solid rgba(0,61,130,0.07)', background: i%2===0 ? 'transparent' : 'rgba(0,61,130,0.02)' }}>
                      <td style={{ padding:'0.5rem 0.85rem', fontWeight:600 }}>{c.student_name||c.student_username}</td>
                      <td style={{ padding:'0.5rem 0.85rem', color:'var(--text-secondary)' }}>{c.roll_number||'—'}</td>
                      <td style={{ padding:'0.5rem 0.85rem', color:'var(--text-secondary)' }}>{c.room_number||'—'}</td>
                      <td style={{ padding:'0.5rem 0.85rem' }}>{HOSTEL_LABEL[c.hostel_number]||c.hostel_number||'—'}</td>
                      <td style={{ padding:'0.5rem 0.85rem' }}>{MEAL_ICON[c.meal_type]} {MEAL_LABEL[c.meal_type]||c.meal_type}</td>
                      <td style={{ padding:'0.5rem 0.85rem' }}>{c.quantity}</td>
                      <td style={{ padding:'0.5rem 0.85rem' }}>₹{c.unit_price}</td>
                      <td style={{ padding:'0.5rem 0.85rem', fontWeight:700, color:'var(--iitb-blue-primary)' }}>₹{c.total_amount}</td>
                      <td style={{ padding:'0.5rem 0.85rem', color:'var(--text-light)', fontSize:'0.75rem' }}>{new Date(c.purchased_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// ── Admin Rebates ──────────────────────────────────────────────────────────
function AdminRebatesTab({ adminHostel }) {
  const [filter,  setFilter]  = useState('PENDING');
  const [rebates, setRebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState({});
  const [note,    setNote]    = useState({});
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRebates(await getRebates({ status: filter||undefined })); }
    catch { setMsg('❌ Failed.'); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function handleReview(id, st) {
    setBusy(b => ({ ...b, [id]:true }));
    try {
      await reviewRebate(id, { status:st, admin_note: note[id]||'' });
      setMsg(`✅ Request ${st}.`);
      load();
    } catch (e) { setMsg(`❌ ${e.response?.data?.detail||'Failed'}`); }
    finally { setBusy(b => ({ ...b, [id]:false })); }
  }

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <div className="tab-navigation" style={{ margin:0 }}>
          {[['','All'],['PENDING','Pending'],['APPROVED','Approved'],['REJECTED','Rejected']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`tab-btn${filter===v?' active':''}`} style={{ fontSize:'0.82rem', padding:'0.5rem 1rem' }}>{l}</button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={load} style={{ fontSize:'0.82rem' }}>🔄</button>
      </div>
      {loading
        ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>Loading…</div>
        : rebates.length === 0
          ? <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-secondary)', background:'var(--white-glass)', borderRadius:'var(--radius-lg)', border:'1px dashed rgba(0,61,130,0.15)' }}>
              <div style={{ fontSize:'2rem',marginBottom:'0.5rem' }}>📅</div>No requests found.
            </div>
          : <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {rebates.map(r => (
                <div key={r.id} className="request-card" style={{ padding:'1rem 1.25rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                    <StatusPill status={r.status} />
                    <span style={{ fontFamily:'var(--font-heading)', fontWeight:700 }}>
                      {r.student_name||r.student_username}
                    </span>
                    {r.student_roll && <span style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{r.student_roll}</span>}
                    <span style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginLeft:'auto' }}>{HOSTEL_LABEL[r.hostel]||r.hostel}</span>
                  </div>
                  <div style={{ fontSize:'0.82rem', marginBottom:'0.4rem', fontWeight:600 }}>
                    📆 {r.start_date} → {r.end_date} &nbsp;·&nbsp; {r.days} day{r.days!==1?'s':''}
                  </div>
                  {r.reason && <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', color:'var(--text-secondary)' }}>{r.reason}</p>}
                  {r.admin_note && <p style={{ margin:'0 0 0.5rem', fontSize:'0.78rem', color:'#166534' }}>Note: {r.admin_note}</p>}
                  {r.status === 'PENDING' && (
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <input className="search-input" placeholder="Admin note (optional)" value={note[r.id]||''}
                        onChange={e => setNote(n => ({ ...n, [r.id]:e.target.value }))}
                        style={{ flex:1, fontSize:'0.8rem', padding:'0.45rem 0.75rem', minWidth:0 }} />
                      <button className="btn btn-primary" disabled={busy[r.id]}
                        onClick={() => handleReview(r.id,'APPROVED')} style={{ padding:'0.45rem 1rem', fontSize:'0.82rem' }}>
                        ✅ Approve
                      </button>
                      <button className="btn" disabled={busy[r.id]}
                        onClick={() => handleReview(r.id,'REJECTED')}
                        style={{ padding:'0.45rem 1rem', fontSize:'0.82rem', background:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5' }}>
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

// ── Admin Settings ────────────────────────────────────────────────────────
function AdminSettingsTab({ adminHostel }) {
  const [hostel,  setHostel]  = useState(adminHostel || 'hostel_1');
  const [form,    setForm]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setForm(await getMessSettings(hostel)); }
    catch { setMsg('❌ Failed to load settings.'); }
    finally { setLoading(false); }
  }, [hostel]);
  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true); setMsg('');
    try { await updateMessSettings({ hostel, ...form }); setMsg('✅ Settings saved.'); }
    catch { setMsg('❌ Save failed.'); }
    finally { setSaving(false); }
  }

  const F = ({ label, k }) => (
    <div className="form-group" style={{ margin:0 }}>
      <label>{label}</label>
      <input type="number" step="0.01" min="0" value={form?.[k]??''} onChange={e => setForm(s => ({ ...s, [k]:e.target.value }))} />
    </div>
  );

  const Section = ({ title, children }) => (
    <SectionCard style={{ padding:'1.25rem' }}>
      <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'0.9rem', color:'var(--iitb-blue-primary)', marginBottom:'1rem', paddingBottom:'0.5rem', borderBottom:'1px solid rgba(0,61,130,0.1)' }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'0.75rem' }}>{children}</div>
    </SectionCard>
  );

  return (
    <div>
      <Banner msg={msg} onClose={() => setMsg('')} />
      {!adminHostel && (
        <SectionCard>
          <div className="form-group" style={{ margin:0 }}>
            <label>Hostel</label>
            <select value={hostel} onChange={e => setHostel(e.target.value)}>
              {MESS_HOSTELS.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </SectionCard>
      )}
      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>Loading…</div>
        : !form ? null
          : <>
              <Section title="💰 SMA & Daily Deductions">
                <F label="Monthly SMA (₹)" k="monthly_sma" />
                <F label="Breakfast deduction" k="breakfast_deduction" />
                <F label="Lunch deduction" k="lunch_deduction" />
                <F label="Snacks deduction" k="snacks_deduction" />
                <F label="Dinner deduction" k="dinner_deduction" />
              </Section>
              <Section title="🎟️ Guest Coupon Prices">
                <F label="Breakfast price" k="guest_breakfast_price" />
                <F label="Lunch price" k="guest_lunch_price" />
                <F label="Snacks price" k="guest_snacks_price" />
                <F label="Dinner price" k="guest_dinner_price" />
              </Section>
              <Section title="🔢 Coupon Limits">
                <F label="Daily slot limit (all students)" k="guest_slot_daily_limit" />
                <F label="Per-student slot limit" k="guest_student_slot_limit" />
              </Section>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving…' : '💾 Save Settings'}
              </button>
            </>
      }
    </div>
  );
}

// ── Admin Analytics ────────────────────────────────────────────────────────
function AdminAnalyticsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    getMessAnalytics()
      .then(setData).catch(() => setMsg('❌ Failed.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-secondary)' }}>Loading…</div>;
  if (msg)     return <Banner msg={msg} />;
  if (!data)   return null;

  const stats = [
    { icon:'💰', label:'Coupon Revenue', value:`₹${parseFloat(data.coupon_total_revenue).toLocaleString('en-IN')}` },
    { icon:'🎟️', label:'Coupons Sold',   value:data.coupon_total_count },
    { icon:'⏳', label:'Pending Rebates', value:data.rebate_pending },
    { icon:'✅', label:'Approved Rebates',value:data.rebate_approved },
  ];

  return (
    <div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:'0.95rem', fontWeight:700, color:'var(--iitb-blue-primary)', marginBottom:'1rem' }}>
        📊 {new Date(data.year,data.month-1).toLocaleString('default',{month:'long'})} {data.year} Analytics
      </div>
      <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
        {stats.map(({ icon, label, value }) => (
          <div key={label} className="stat-card">
            <span style={{ fontSize:'2rem',marginBottom:'0.5rem',display:'block' }}>{icon}</span>
            <span className="stat-value" style={{ fontSize:'1.8rem' }}>{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>
      {data.meal_breakdown?.length > 0 && (
        <SectionCard style={{ padding:'1.25rem' }}>
          <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'0.9rem', color:'var(--iitb-blue-primary)', marginBottom:'1rem' }}>Per-Meal Breakdown</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem' }}>
            {data.meal_breakdown.map(m => (
              <div key={m.meal_type} style={{ background:MEAL_GRAD[m.meal_type]||'#f3f4f6', borderRadius:'var(--radius-md)', padding:'0.85rem 1rem', border:`1px solid ${MEAL_BORDER[m.meal_type]||'#e5e7eb'}60` }}>
                <div style={{ fontSize:'1.5rem' }}>{MEAL_ICON[m.meal_type]}</div>
                <div style={{ fontWeight:700, fontSize:'0.85rem', color:MEAL_TEXT[m.meal_type]||'#374151', marginTop:'0.25rem' }}>{MEAL_LABEL[m.meal_type]||m.meal_type}</div>
                <div style={{ fontSize:'0.78rem', color:MEAL_TEXT[m.meal_type]||'#374151', opacity:0.8 }}>×{m.qty} coupons</div>
                <div style={{ fontFamily:'var(--font-heading)', fontWeight:800, fontSize:'1rem', color:MEAL_TEXT[m.meal_type]||'var(--iitb-blue-primary)' }}>₹{parseFloat(m.revenue||0).toFixed(0)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Admin Root ──────────────────────────────────────────────────────────────
function AdminDashboard({ user }) {
  const adminHostel = user?.mess_admin_hostel || null;
  const TABS = [
    ['menu',      '🍽️ Daily Menu'],
    ['coupons',   '🎟️ Coupons'],
    ['rebates',   '📅 Rebates'],
    ['settings',  '⚙️ Settings'],
    ['analytics', '📊 Analytics'],
  ];
  const [tab, setTab] = useState('menu');

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <span style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>
          {adminHostel ? `🏠 Managing: ${HOSTEL_LABEL[adminHostel]||adminHostel}` : '🌐 Superadmin — all hostels'}
        </span>
      </div>
      <div className="tab-navigation">
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-btn${tab===k?' active':''}`}>{l}</button>
        ))}
      </div>
      {tab==='menu'      && <AdminMenuTab      adminHostel={adminHostel} />}
      {tab==='coupons'   && <AdminCouponsTab   adminHostel={adminHostel} />}
      {tab==='rebates'   && <AdminRebatesTab   adminHostel={adminHostel} />}
      {tab==='settings'  && <AdminSettingsTab  adminHostel={adminHostel} />}
      {tab==='analytics' && <AdminAnalyticsTab />}
    </div>
  );
}

// ===========================================================================
// Page Root
// ===========================================================================
export default function MessPage() {
  const { user } = useAuth();
  const isAdmin  = user?.is_mess_admin || false;

  return (
    <section className="content-section active">
      <div className="section-header">
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <h2 style={{ margin:0 }}>🍱 Mess</h2>
          {isAdmin && (
            <span className="card-badge" style={{ fontSize:'0.72rem' }}>ADMIN</span>
          )}
        </div>
        <p>{isAdmin ? 'Manage menus, coupons, rebates and settings' : 'View menu, buy guest coupons, apply for rebate'}</p>
      </div>
      {isAdmin ? <AdminDashboard user={user} /> : <StudentDashboard user={user} />}
    </section>
  );
}
