import { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import Modal from './Modal.jsx';

export default function CartModal() {
  const { cart, cartTotal, dispatch } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  function checkout() {
    if (cart.length === 0) return alert('Cart is empty!');
    alert(`✅ Order placed! Total: ₹${cartTotal}\n\nEstimated delivery: 20–30 mins`);
    dispatch({ type: 'CLEAR_CART' });
    setIsOpen(false);
  }

  if (cart.length === 0 && !isOpen) {
    return null; // hide button when cart is empty
  }

  return (
    <>
      {/* Floating cart button */}
      {cart.length > 0 && (
        <button className="cart-btn" onClick={() => setIsOpen(true)} style={{ display: 'flex' }}>
          🛒
          <span id="cartCount"
            style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: 'white',
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
            {cart.length}
          </span>
        </button>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Your Cart">
        <div id="cartItems">
          {cart.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Cart is empty</p>
            : cart.map((item, i) => (
              <div className="cart-item" key={i}>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-outlet">{item.outletName}</div>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-item-price">₹{item.price}</div>
                  <button className="cart-item-remove" onClick={() => dispatch({ type: 'REMOVE_ITEM', index: i })}>✕</button>
                </div>
              </div>
            ))
          }
          {cart.length > 0 && (
            <div className="cart-total">
              <span>Total:</span>
              <span id="cartTotal">₹{cartTotal}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>Continue Shopping</button>
          <button className="btn btn-primary" onClick={checkout}>Checkout</button>
        </div>
      </Modal>
    </>
  );
}
