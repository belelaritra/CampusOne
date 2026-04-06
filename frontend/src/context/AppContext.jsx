import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  function addNotification(msg) {
    setNotifications(prev => [{ id: Date.now(), msg }, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  }

  return (
    <AppContext.Provider value={{ notifications, addNotification }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
