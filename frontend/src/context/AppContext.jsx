import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user] = useState({
    name: 'Aritra Belel',
    roll: '24M0814',
    hostel: 'Hostel 14',
    year: '2nd Year',
    branch: 'Computer Science',
  });

  const [notifications, setNotifications] = useState([]);

  function addNotification(msg) {
    setNotifications(prev => [{ id: Date.now(), msg }, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  }

  return (
    <AppContext.Provider value={{ user, notifications, addNotification }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
