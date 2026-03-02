import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
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
import Contacts from './pages/Contacts.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Events from './pages/Events.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="hostels" element={<Hostels />} />
        <Route path="food" element={<FoodOrdering />} />
        <Route path="map" element={<CampusMap />} />
        <Route path="help" element={<HelpDelivery />} />
        <Route path="groups" element={<Groups />} />
        <Route path="courses" element={<Courses />} />
        <Route path="hospital" element={<Hospital />} />
        <Route path="buggy" element={<BuggyPass />} />
        <Route path="lostfound" element={<LostFound />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="events" element={<Events />} />
      </Route>
    </Routes>
  );
}
