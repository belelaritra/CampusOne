import { SectionHeader, StatusBadge } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { doctors } from '../data/mockData.js';

const VACCINATIONS = [
  { name: 'COVID-19 Booster', date: 'Every 6 months', venue: 'Hospital OPD' },
  { name: 'Influenza', date: 'Oct-Nov annually', venue: 'Hospital OPD' },
  { name: 'Hepatitis B', date: 'On request', venue: 'Hospital OPD' },
  { name: 'Typhoid', date: 'On request', venue: 'Hospital OPD' },
];

const OPD = [
  { dept: 'General Medicine', days: 'Mon-Sat', timing: '9 AM – 1 PM, 5 PM – 8 PM' },
  { dept: 'Dental', days: 'Mon-Sat', timing: '9 AM – 5 PM' },
  { dept: 'Orthopedic', days: 'Tue, Thu, Sat', timing: '9 AM – 12 PM' },
  { dept: 'Gynecology', days: 'Mon, Wed, Fri', timing: '10 AM – 1 PM' },
  { dept: 'Ophthalmology', days: 'Fri', timing: '2 PM – 5 PM' },
  { dept: 'Psychiatry', days: 'Wed, Fri', timing: '3 PM – 6 PM' },
];

export default function Hospital() {
  return (
    <section className="content-section active">
      <SectionHeader title="Hospital Services" subtitle="Doctors availability, vaccination, and OPD timings" />
      <Tabs
        tabs={[{ id: 'doctors', label: 'Doctors' }, { id: 'vaccination', label: 'Vaccination' }, { id: 'opd', label: 'OPD Timings' }]}
        renderContent={(tab) => {
          if (tab === 'doctors') return (
            <div className="doctors-grid">
              {doctors.map(d => (
                <div key={d.id} className="doctor-card hostel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4>👨‍⚕️ {d.name}</h4>
                    <StatusBadge status={d.status} />
                  </div>
                  <p style={{ fontWeight: 600, color: 'var(--iitb-blue-primary)' }}>{d.specialization}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>🕐 {d.timings}</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => alert(`Appointment booked with ${d.name}`)}>Book Appointment</button>
                </div>
              ))}
            </div>
          );

          if (tab === 'vaccination') return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {VACCINATIONS.map(v => (
                <div key={v.name} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><h4>💉 {v.name}</h4><p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📅 {v.date} | 📍 {v.venue}</p></div>
                  <button className="btn btn-primary" onClick={() => alert(`Registered for ${v.name}!`)}>Register</button>
                </div>
              ))}
            </div>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {OPD.map(o => (
                <div key={o.dept} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><h4>🏥 {o.dept}</h4><p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{o.days}</p></div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--iitb-blue-primary)' }}>{o.timing}</div>
                </div>
              ))}
            </div>
          );
        }}
      />
    </section>
  );
}
