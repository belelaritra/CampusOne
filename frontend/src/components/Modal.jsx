import { useEffect } from 'react';

/**
 * Generic modal overlay.
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {string}   title
 * @param {ReactNode} children
 * @param {string}   size - 'sm' | 'md' | 'lg' (default md)
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = { sm: '400px', md: '500px', lg: '700px' };

  return (
    <div className="modal active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content building-detail-modal" style={{ maxWidth: maxWidths[size] }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
