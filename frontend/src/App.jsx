import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Public pages (Keycloak redirects)
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';

// Protected pages
import Dashboard from './pages/Dashboard.jsx';
import Hostels from './pages/Hostels.jsx';
import FoodOrdering from './pages/FoodOrdering.jsx';
import CampusMap from './pages/CampusMap.jsx';
import HelpDelivery from './pages/HelpDelivery.jsx';
import Groups from './pages/Groups.jsx';
import Courses from './pages/Courses.jsx';
import Hospital from './pages/Hospital.jsx';
import BuggyPass from './pages/BuggyPass.jsx';
import LostFound from './pages/LostFound.jsx';
import Mess from './pages/Mess.jsx';
import Contacts from './pages/Contacts.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Events from './pages/Events.jsx';
import Profile from './pages/Profile.jsx';
import AdminConsole from './pages/AdminConsole.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public routes — these pages redirect immediately to Keycloak */}
      <Route path="/login"           element={<Login />} />
      <Route path="/register"        element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index                  element={<Dashboard />} />
        <Route path="hostels"         element={<Hostels />} />
        <Route path="food"            element={<FoodOrdering />} />
        <Route path="map"             element={<CampusMap />} />
        <Route path="help"            element={<HelpDelivery />} />
        <Route path="groups"          element={<Groups />} />
        <Route path="courses"         element={<Courses />} />
        <Route path="hospital"        element={<Hospital />} />
        <Route path="buggy"           element={<BuggyPass />} />
        <Route path="lostfound"       element={<LostFound />} />
        <Route path="mess"            element={<Mess />} />
        <Route path="contacts"        element={<Contacts />} />
        <Route path="marketplace"     element={<Marketplace />} />
        <Route path="events"          element={<Events />} />
        <Route path="profile"         element={<Profile />} />
        <Route path="admin-console"   element={<AdminConsole />} />
        <Route path="admin"           element={<AdminConsole />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
