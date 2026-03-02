import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { courses, chatMessages } from '../data/mockData.js';

export default function Courses() {
  const [selected, setSelected] = useState(courses[0]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(chatMessages[1] || []);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(prev => [...prev, { sender: 'You', message: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), sent: true }]);
    setInput('');
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Courses & Chat" subtitle="Connect with classmates in your courses" />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', minHeight: 500 }}>
        {/* Course list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {courses.map(c => (
            <div
              key={c.id}
              className="hostel-card"
              onClick={() => setSelected(c)}
              style={{ cursor: 'pointer', border: selected?.id === c.id ? '2px solid var(--iitb-blue-light)' : '', padding: '1rem' }}
            >
              <span className="tag">{c.code}</span>
              <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>{c.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>👥 {c.students} students</div>
            </div>
          ))}
        </div>

        {/* Chat panel */}
        <div className="hostel-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--iitb-blue-primary)' }}>#{selected?.code} Group Chat</h4>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', maxHeight: 350 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.sent ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: msg.sent ? 'var(--gradient-blue)' : 'white',
                  color: msg.sent ? 'white' : 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 12,
                  maxWidth: '70%',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  {!msg.sent && <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{msg.sender}</div>}
                  <div>{msg.message}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.25rem', textAlign: 'right' }}>{msg.time}</div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              className="search-input"
              style={{ flex: 1 }}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button type="submit" className="btn btn-primary">Send</button>
          </form>
        </div>
      </div>
    </section>
  );
}
