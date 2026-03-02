import { createContext, useContext, useReducer } from 'react';

const CartContext = createContext(null);

const initialState = { cart: [], balance: 250, transactions: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, cart: [...state.cart, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, cart: state.cart.filter((_, i) => i !== action.index) };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'RECHARGE':
      return {
        ...state,
        balance: state.balance + action.amount,
        transactions: [
          { type: 'Recharge', amount: action.amount, date: new Date().toLocaleDateString(), balance: state.balance + action.amount },
          ...state.transactions,
        ],
      };
    case 'DEDUCT': {
      const newBal = state.balance - action.amount;
      return {
        ...state,
        balance: newBal,
        transactions: [
          { type: 'Ride', amount: -action.amount, date: new Date().toLocaleDateString(), balance: newBal },
          ...state.transactions,
        ],
      };
    }
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const cartTotal = state.cart.reduce((s, i) => s + i.price, 0);

  return (
    <CartContext.Provider value={{ ...state, cartTotal, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
