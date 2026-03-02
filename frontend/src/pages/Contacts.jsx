import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { studentContacts, facultyContacts, departments } from '../data/mockData.js';

export default function Contacts() {
  const [search, setSearch] = useState('');

  const filterBySearch = (arr, keys) => arr.filter(item => keys.some(k => item[k]?.toLowerCase().includes(search.toLowerCase())));

  return (
    <section className="content-section active">
      <SectionHeader title="Contacts" subtitle="Find students, faculty, and department contacts" />

      <input className="search-input" style={{ width: '100%', marginBottom: '1.5rem' }} placeholder="Search by name, department…" value={search} onChange={e => setSearch(e.target.value)} />

      <Tabs
        tabs={[{ id: 'students', label: 'Students' }, { id: 'faculty', label: 'Faculty' }, { id: 'departments', label: 'Departments' }]}
        renderContent={(tab) => {
          if (tab === 'students') return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '1rem' }}>
              {filterBySearch(studentContacts, ['name', 'dept']).map(s => (
                <div key={s.id} className="hostel-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.25rem' }}>👤</div>
                    <div><h4>{s.name}</h4><p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.roll}</p></div>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}><strong>Dept:</strong> {s.dept} | <strong>Year:</strong> {s.year}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {s.interests.map(i => <span key={i} className="tag">{i}</span>)}
                  </div>
                </div>
              ))}
            </div>
          );

          if (tab === 'faculty') return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: '1rem' }}>
              {filterBySearch(facultyContacts, ['name', 'dept']).map(f => (
                <div key={f.id} className="hostel-card">
                  <h4>👨‍🏫 {f.name}</h4>
                  <p style={{ color: 'var(--iitb-blue-primary)', fontWeight: 600, marginTop: '0.25rem' }}>{f.dept}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{f.specialization}</p>
                  <a href={`mailto:${f.email}`} style={{ display: 'block', marginTop: '0.75rem', color: 'var(--iitb-blue-light)', fontSize: '0.875rem' }}>{f.email}</a>
                </div>
              ))}
            </div>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filterBySearch(departments, ['name', 'code']).map(d => (
                <div key={d.id} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><h4>{d.name}</h4><span className="tag">{d.code}</span></div>
                  <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                    <p>{d.contact}</p>
                    <a href={`mailto:${d.email}`} style={{ color: 'var(--iitb-blue-light)' }}>{d.email}</a>
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      />
    </section>
  );
}
