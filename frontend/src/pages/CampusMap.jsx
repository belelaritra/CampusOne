import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import Modal from '../components/Modal.jsx';
import { buildingsDatabase, hostelData } from '../data/buildingsData.js';

// Marker data for campus map
const MARKERS = [
  { id: 'main-building',    category: 'academic',     top: '38%', left: '48%', label: 'Main'     },
  { id: 'central-library',  category: 'academic',     top: '32%', left: '46%', label: 'Library'  },
  { id: 'som',              category: 'academic',     top: '52%', left: '47%', label: 'SOM'      },
  { id: 'idc',              category: 'academic',     top: '37%', left: '63%', label: 'IDC'      },
  { id: 'hospital',         category: 'facility',     top: '51%', left: '36%', label: 'Hospital' },
  { id: 'sports-ground',    category: 'facility',     top: '30%', left: '31%', label: 'Sports'   },
  { id: 'gymkhana',         category: 'facility',     top: '52%', left: '49%', label: 'Gym'      },
  { id: 'convocation-hall', category: 'admin',        top: '45%', left: '40%', label: 'Conv Hall'},
  { id: 'ncair',            category: 'admin',        top: '29%', left: '78%', label: 'NCAIR'    },
  { id: 'boat-house',       category: 'recreational', top: '54%', left: '13%', label: 'Boat'     },
  { id: 'hostel-1',         category: 'hostel',       top: '24%', left: '7%',  label: 'H1'       },
  { id: 'hostel-5',         category: 'hostel',       top: '27%', left: '25%', label: 'H5'       },
  { id: 'hostel-8',         category: 'hostel',       top: '29%', left: '36%', label: 'H8'       },
  { id: 'hostel-10',        category: 'hostel',       top: '65%', left: '68%', label: 'H10'      },
  { id: 'tansa-house',      category: 'hostel',       top: '23%', left: '35%', label: 'Tansa'    },
  { id: 'market-gate',      category: 'facility',     top: '80%', left: '73%', label: 'Market'   },
  { id: 'power-house',      category: 'facility',     top: '22%', left: '77%', label: 'Power'    },
  { id: 'post-office',      category: 'facility',     top: '73%', left: '83%', label: 'Post'     },
  { id: 'temple',           category: 'recreational', top: '85%', left: '16%', label: 'Temple'   },
  { id: 'campus-school',    category: 'academic',     top: '70%', left: '45%', label: 'School'   },
];

const CAT_COLORS = { academic: '#003D82', hostel: '#8b5cf6', admin: '#ec4899', facility: '#f59e0b', recreational: '#10b981' };

export default function CampusMap() {
  const [selected, setSelected] = useState(null);
  const allBuildings = { ...buildingsDatabase, ...hostelData };

  function openBuilding(id) {
    const b = allBuildings[id];
    if (b) setSelected({ id, ...b });
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Campus Map & Navigation" subtitle="Click a location to view details" />

      <Tabs
        tabs={[{ id: 'interactive', label: 'Interactive Map' }, { id: 'gmaps', label: 'Google Maps' }]}
        renderContent={(tab) => {
          if (tab === 'interactive') {
            return (
              <div className="map-view-container" style={{ position: 'relative' }}>
                <div className="interactive-campus-map" style={{ position: 'relative', background: 'linear-gradient(135deg,#e0f0ff 0%,#d0e8ff 100%)', borderRadius: 16, minHeight: 500, border: '1px solid rgba(0,61,130,0.1)' }}>
                  {/* Map legend */}
                  <div className="map-legend">
                    <div className="legend-title">Legend</div>
                    {Object.entries(CAT_COLORS).map(([cat, color]) => (
                      <div key={cat} className="legend-item">
                        <span className="legend-color" style={{ background: color }} />
                        <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Markers */}
                  <div className="map-buildings-overlay">
                    {MARKERS.map(m => (
                      <div
                        key={m.id}
                        className={`map-marker ${m.category}`}
                        style={{ top: m.top, left: m.left }}
                        onClick={() => openBuilding(m.id)}
                      >
                        <span className="marker-dot" style={{ background: CAT_COLORS[m.category] }} />
                        <span className="marker-label">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="google-map-container">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770.228966!2d72.9112460!3d19.133462!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c7f1b380c4e5%3A0x4e3d8f85f8c8c68a!2sIIT%20Bombay!5e0!3m2!1sen!2sin"
                width="100%" height="560" style={{ border: 0, borderRadius: 12 }} allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="map-info-cards">
                {[
                  { title: '📍 Address', content: 'IIT Bombay, Powai, Mumbai – 400076, Maharashtra, India' },
                  { title: '🚌 How to Reach', content: 'By Train: Kanjurmarg (2.5 km)\nBy Bus: BEST buses to Powai\nBy Metro: Upcoming Powai Metro' },
                  { title: '📞 Contact', content: 'Phone: +91-22-2576-4994\nEmail: info@iitb.ac.in\nWeb: www.iitb.ac.in' },
                ].map(card => (
                  <div key={card.title} className="map-info-card">
                    <h4>{card.title}</h4>
                    <p style={{ whiteSpace: 'pre-line' }}>{card.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      />

      {/* Building detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} size="lg">
        {selected && (
          <div className="building-detail-content">
            <div className={`building-category-badge ${selected.category}`}>{selected.category}</div>
            <p style={{ margin: '1rem 0' }}>{selected.description}</p>
            <div className="building-info-grid">
              {selected.departments?.length > 0 && (
                <div className="info-item">
                  <div className="info-label">📚 Departments</div>
                  <div className="info-value">{selected.departments.map(d => <div key={d}>• {d}</div>)}</div>
                </div>
              )}
              {selected.timings && (
                <div className="info-item"><div className="info-label">🕐 Timings</div><div className="info-value">{selected.timings}</div></div>
              )}
              {selected.contact && (
                <div className="info-item"><div className="info-label">📞 Contact</div><div className="info-value">{selected.contact}</div></div>
              )}
              {selected.capacity && (
                <div className="info-item"><div className="info-label">👥 Capacity</div><div className="info-value">{selected.capacity}</div></div>
              )}
            </div>
            {selected.features?.length > 0 && (
              <div className="building-features">
                {selected.features.map(f => <span key={f} className="tag">{f}</span>)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
