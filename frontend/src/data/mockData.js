// All mock data extracted from app.js — will be replaced by API calls

export const hostels = [
  { id: 1, name: 'Hostel 12', capacity: 400, occupancy: 380 },
  { id: 2, name: 'Hostel 13', capacity: 450, occupancy: 420 },
  { id: 3, name: 'Hostel 14', capacity: 400, occupancy: 395 },
  { id: 4, name: 'Hostel 17', capacity: 500, occupancy: 475 },
  { id: 5, name: 'Hostel 18', capacity: 450, occupancy: 430 },
  { id: 6, name: 'Hostel 6', capacity: 420, occupancy: 405 },
];

export const messMenus = {
  breakfast: ['Poha', 'Idli-Sambar', 'Upma', 'Tea/Coffee', 'Bread-Butter-Jam', 'Banana'],
  lunch: ['Rice', 'Dal', 'Roti', 'Mixed Veg', 'Paneer Curry', 'Salad', 'Buttermilk'],
  snacks: ['Samosa', 'Tea/Coffee', 'Biscuits'],
  dinner: ['Rice', 'Roti', 'Dal', 'Chicken Curry', 'Veg Curry', 'Curd', 'Papad'],
};

export const outlets = [
  { id: 1, name: 'Aromas Dhaba', icon: '🍽️', type: 'canteen', hours: '8:00 AM - 10:00 PM', status: 'open' },
  { id: 2, name: 'Cafe 92', icon: '🥤', type: 'cafe', hours: '9:00 AM - 9:00 PM', status: 'open' },
  { id: 3, name: 'Chayoos', icon: '🌙', type: 'night', hours: '8:00 PM - 2:00 AM', status: 'open' },
  { id: 4, name: 'CCD', icon: '☕', type: 'cafe', hours: '10:00 AM - 8:00 PM', status: 'open' },
  { id: 5, name: 'Amul Parlour', icon: '🍦', type: 'cafe', hours: '11:00 AM - 10:00 PM', status: 'open' },
  { id: 6, name: 'H2 Canteen', icon: '🏃', type: 'canteen', hours: '9:00 AM - 3:00 AM', status: 'open' },
];

export const menuItems = {
  1: [
    { name: 'Veg Thali', price: 80 }, { name: 'Chicken Biryani', price: 120 },
    { name: 'Paneer Butter Masala', price: 100 }, { name: 'Masala Dosa', price: 60 }, { name: 'Coffee', price: 20 },
  ],
  2: [
    { name: 'Fresh Orange Juice', price: 40 }, { name: 'Mango Shake', price: 50 },
    { name: 'Watermelon Juice', price: 35 }, { name: 'Mixed Fruit Juice', price: 60 },
  ],
  3: [
    { name: 'Maggi', price: 40 }, { name: 'Sandwich', price: 50 },
    { name: 'Paratha', price: 30 }, { name: 'Tea', price: 15 }, { name: 'Omelette', price: 25 },
  ],
  4: [
    { name: 'Cappuccino', price: 50 }, { name: 'Cold Coffee', price: 60 },
    { name: 'Brownie', price: 70 }, { name: 'Pasta', price: 90 },
  ],
  5: [
    { name: 'Vanilla Ice Cream', price: 30 }, { name: 'Chocolate Ice Cream', price: 30 },
    { name: 'Butter Milk', price: 20 }, { name: 'Lassi', price: 40 },
  ],
  6: [
    { name: 'Chole Bhature', price: 70 }, { name: 'Dal Baati', price: 80 },
    { name: 'Rajma Rice', price: 60 }, { name: 'Lemon Soda', price: 25 },
  ],
};

export const requests = [
  { id: 1, item: 'Stationery from Market Gate', pickup: 'Market Gate', delivery: 'H7 Room 203', points: 30, urgency: 'normal', status: 'open' },
  { id: 2, item: 'Medicine from Pharmacy', pickup: 'Hospital', delivery: 'H3 Room 105', points: 50, urgency: 'urgent', status: 'open' },
  { id: 3, item: 'Parcel from Main Gate', pickup: 'Main Gate', delivery: 'H12 Room 301', points: 25, urgency: 'normal', status: 'open' },
];

export const groups = [
  { id: 1, name: 'Robotics Club', category: 'technical', members: 156, privacy: 'public', description: 'Building autonomous robots and exploring automation.' },
  { id: 2, name: 'Dance Team', category: 'cultural', members: 89, privacy: 'public', description: 'Contemporary and classical dance performances.' },
  { id: 3, name: 'Football Team', category: 'sports', members: 45, privacy: 'public', description: 'Inter-hostel and inter-college competitions.' },
  { id: 4, name: 'Coding Club', category: 'technical', members: 234, privacy: 'public', description: 'Competitive programming and hackathons.' },
  { id: 5, name: 'Photography Club', category: 'cultural', members: 112, privacy: 'public', description: 'Campus photography and visual storytelling.' },
];

export const courses = [
  { id: 1, code: 'CS101', name: 'Intro to Programming', students: 245 },
  { id: 2, code: 'MA106', name: 'Linear Algebra', students: 312 },
  { id: 3, code: 'PH101', name: 'Quantum Physics', students: 198 },
  { id: 4, code: 'CS203', name: 'Data Structures', students: 156 },
];

export const chatMessages = {
  1: [
    { sender: 'Rahul', message: 'When is the next assignment due?', time: '10:30 AM', sent: false },
    { sender: 'You', message: 'Friday at 11:59 PM', time: '10:32 AM', sent: true },
    { sender: 'Priya', message: 'Study group for midterm?', time: '11:15 AM', sent: false },
  ],
};

export const doctors = [
  { id: 1, name: 'Dr. Sharma', specialization: 'General Physician', status: 'available', timings: '9 AM - 1 PM, 5 PM - 8 PM' },
  { id: 2, name: 'Dr. Mehta', specialization: 'Dermatologist', status: 'busy', timings: 'Mon, Wed, Fri 10 AM - 1 PM' },
  { id: 3, name: 'Dr. Patel', specialization: 'Orthopedic', status: 'available', timings: 'Tue, Thu 9 AM - 12 PM' },
  { id: 4, name: 'Dr. Kumar', specialization: 'Dentist', status: 'available', timings: 'Mon-Sat 9 AM - 5 PM' },
  { id: 5, name: 'Dr. Singh', specialization: 'Cardiologist', status: 'unavailable', timings: 'Alternate Mondays' },
  { id: 6, name: 'Dr. Iyer', specialization: 'Psychiatrist', status: 'available', timings: 'Wed, Fri 3 PM - 6 PM' },
];

export const buggyTransactions = [
  { type: 'Recharge', amount: 200, date: '2026-02-10', balance: 250 },
  { type: 'Ride', amount: -30, date: '2026-02-12', balance: 220 },
  { type: 'Ride', amount: -20, date: '2026-02-14', balance: 200 },
  { type: 'Recharge', amount: 100, date: '2026-02-15', balance: 300 },
];

export const lostFoundItems = [
  { id: 1, type: 'lost', name: 'MacBook Pro', category: 'electronics', location: 'Central Library', date: '2026-02-10', contact: '9876543210', tags: ['laptop', 'apple', 'macbook', 'silver'] },
  { id: 2, type: 'found', name: 'Student ID Card', category: 'ids', location: 'Main Building', date: '2026-02-12', contact: '9876543211', tags: ['id', 'card', 'iitb', 'student'] },
  { id: 3, type: 'lost', name: 'Engineering Mathematics Textbook', category: 'books', location: 'LT 101', date: '2026-02-13', contact: '9876543212', tags: ['book', 'math', 'textbook', 'blue cover'] },
  { id: 4, type: 'found', name: 'Water Bottle (Blue)', category: 'accessories', location: 'Gymkhana', date: '2026-02-14', contact: '9876543213', tags: ['bottle', 'blue', 'water', 'sports'] },
  { id: 5, type: 'lost', name: 'Sony Earbuds', category: 'electronics', location: 'H8 Common Room', date: '2026-02-15', contact: '9876543214', tags: ['earbuds', 'sony', 'wireless', 'black'] },
];

export const studentContacts = [
  { id: 1, name: 'Rahul Sharma', roll: '22B1234', dept: 'Computer Science', year: '3rd', interests: ['Web Dev', 'ML', 'Open Source'] },
  { id: 2, name: 'Priya Mehta', roll: '22B5678', dept: 'Electrical', year: '3rd', interests: ['AI', 'Robotics', 'DSP'] },
  { id: 3, name: 'Arjun Patel', roll: '21B9012', dept: 'Mechanical', year: '4th', interests: ['CAD', 'Manufacturing', 'Robotics'] },
  { id: 4, name: 'Sneha Kumar', roll: '23B3456', dept: 'Chemical', year: '2nd', interests: ['Data Science', 'Research', 'Bioinformatics'] },
];

export const facultyContacts = [
  { id: 1, name: 'Prof. Abhiram Ranade', dept: 'Computer Science', specialization: 'Algorithms & Theory', email: 'aranade@cse.iitb.ac.in' },
  { id: 2, name: 'Prof. Ganesh Ramakrishnan', dept: 'Computer Science', specialization: 'Machine Learning', email: 'ganesh@cse.iitb.ac.in' },
  { id: 3, name: 'Prof. Pushpak Bhattacharyya', dept: 'Computer Science', specialization: 'NLP & AI', email: 'pb@cse.iitb.ac.in' },
];

export const departments = [
  { id: 1, name: 'Computer Science & Engineering', code: 'CSE', contact: '+91-22-2576-7901', email: 'office@cse.iitb.ac.in' },
  { id: 2, name: 'Electrical Engineering', code: 'EE', contact: '+91-22-2576-7801', email: 'office@ee.iitb.ac.in' },
  { id: 3, name: 'Mechanical Engineering', code: 'ME', contact: '+91-22-2576-7501', email: 'office@me.iitb.ac.in' },
];

export const marketplaceItems = [
  { id: 1, title: 'Engineering Mathematics Textbook', category: 'books', price: 350, condition: 'good', seller: 'Rahul', contact: '9876543210', date: '2026-02-10' },
  { id: 2, title: 'Dell Laptop i5 8GB RAM', category: 'electronics', price: 25000, condition: 'like new', seller: 'Priya', contact: '9876543211', date: '2026-02-11' },
  { id: 3, title: 'Study Table & Chair Set', category: 'furniture', price: 2500, condition: 'good', seller: 'Arjun', contact: '9876543212', date: '2026-02-12' },
  { id: 4, title: 'Cricket Kit (Full)', category: 'sports', price: 3500, condition: 'fair', seller: 'Sneha', contact: '9876543213', date: '2026-02-13' },
  { id: 5, title: 'Data Structures Notes Bundle', category: 'books', price: 200, condition: 'good', seller: 'Vikram', contact: '9876543214', date: '2026-02-14' },
];

export const events = [
  { id: 1, name: 'AI Workshop', category: 'technical', date: '2026-02-18', time: '3:00 PM', location: 'LT 201', organizer: 'Coding Club', description: 'Hands-on intro to neural networks and LLMs.' },
  { id: 2, name: 'Cultural Night – Mood Indigo', category: 'cultural', date: '2026-02-20', time: '7:00 PM', location: 'Convocation Hall', organizer: 'Student Activities', description: 'Annual cultural fest performances.' },
  { id: 3, name: 'Inter-Hostel Football', category: 'sports', date: '2026-02-22', time: '5:00 PM', location: 'Main Ground', organizer: 'Sports Council', description: 'Quarter-finals of the inter-hostel football tournament.' },
  { id: 4, name: 'Guest Lecture: Future of Computing', category: 'academic', date: '2026-02-25', time: '11:00 AM', location: 'Main Building Audi', organizer: 'CSE Dept', description: 'Distinguished lecture on quantum computing.' },
  { id: 5, name: 'Photography Walk', category: 'social', date: '2026-02-28', time: '6:00 AM', location: 'Powai Lake', organizer: 'Photography Club', description: 'Early morning campus photography walk.' },
];

export const dashboardCards = [
  { id: 'hostels', icon: '🏠', title: 'Hostels & Mess', desc: 'View mess menu & hostel info', path: '/hostels', color: '#003D82' },
  { id: 'food', icon: '🍕', title: 'Food Ordering', desc: 'Order from campus outlets', path: '/food', color: '#0055B8' },
  { id: 'map', icon: '🗺️', title: 'Campus Map', desc: 'Find buildings & navigate', path: '/map', color: '#7C3AED' },
  { id: 'help', icon: '🤝', title: 'Help & Delivery', desc: 'Earn rewards helping peers', path: '/help', color: '#059669' },
  { id: 'groups', icon: '👥', title: 'Groups', desc: 'Discover clubs & communities', path: '/groups', color: '#DC2626' },
  { id: 'courses', icon: '📚', title: 'Courses & Chat', desc: 'Course discussions & chat', path: '/courses', color: '#D97706' },
  { id: 'hospital', icon: '🏥', title: 'Hospital', desc: 'Doctors & medical services', path: '/hospital', color: '#0891B2' },
  { id: 'buggy', icon: '🚌', title: 'Buggy Pass', desc: 'Digital pass & recharge', path: '/buggy', color: '#7C3AED' },
  { id: 'lostfound', icon: '🔍', title: 'Lost & Found', desc: 'Report or find lost items', path: '/lostfound', color: '#B45309' },
  { id: 'contacts', icon: '📞', title: 'Contacts', desc: 'Students, faculty & dept contacts', path: '/contacts', color: '#065F46' },
  { id: 'marketplace', icon: '🛍️', title: 'Marketplace', desc: 'Buy & sell on campus', path: '/marketplace', color: '#9D174D' },
  { id: 'events', icon: '📅', title: 'Events', desc: 'Campus events & calendar', path: '/events', color: '#1E40AF' },
];
