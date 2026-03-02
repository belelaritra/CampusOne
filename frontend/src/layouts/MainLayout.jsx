import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import CartModal from '../components/CartModal.jsx';

export default function MainLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <CartModal />
    </div>
  );
}
