// Navigation System
function switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Main navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Sub-tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.content-section');
            const subtab = btn.getAttribute('data-subtab');

            // Update buttons
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update sub-sections
            parent.querySelectorAll('.sub-section').forEach(s => s.classList.remove('active'));
            parent.querySelector(`#${subtab}`).classList.add('active');
        });
    });

    // Initialize all features
    initHostels();
    initFoodOutlets();
    initRequests();
    initGroups();
    initCourses();
    initBuildingList();
    initDoctors();
    initBuggyPass();
    initLostFound();
    initContacts();
    initMarketplace();
    initEvents();
});

// ===================== HOSTELS & MESS =====================
const hostels = [
    { id: 1, name: 'Hostel 1', capacity: 400, occupancy: 380 },
    { id: 2, name: 'Hostel 2', capacity: 450, occupancy: 420 },
    { id: 3, name: 'Hostel 3', capacity: 400, occupancy: 395 },
    { id: 4, name: 'Hostel 4', capacity: 500, occupancy: 475 },
    { id: 5, name: 'Hostel 5', capacity: 450, occupancy: 430 },
    { id: 6, name: 'Hostel 6', capacity: 420, occupancy: 405 }
];

const messMenus = {
    breakfast: ['Poha', 'Idli-Sambar', 'Upma', 'Tea/Coffee', 'Bread-Butter-Jam', 'Banana'],
    lunch: ['Rice', 'Dal', 'Roti', 'Mixed Veg', 'Paneer Curry', 'Salad', 'Buttermilk'],
    snacks: ['Samosa', 'Tea/Coffee', 'Biscuits'],
    dinner: ['Rice', 'Roti', 'Dal', 'Chicken Curry', 'Veg Curry', 'Curd', 'Papad']
};

function initHostels() {
    const grid = document.getElementById('hostelGrid');
    if (!grid) return;

    grid.innerHTML = hostels.map(hostel => `
        <div class="hostel-card" onclick="showMessMenu(${hostel.id})">
            <h4>${hostel.name}</h4>
            <p>Capacity: ${hostel.capacity}</p>
            <p>Current: ${hostel.occupancy}</p>
        </div>
    `).join('');
}

function showMessMenu(hostelId) {
    const hostel = hostels.find(h => h.id === hostelId);
    const timeline = document.getElementById('messTimeline');
    
    timeline.innerHTML = `
        <h3>${hostel.name} - Mess Menu</h3>
        
        <div class="meal-section">
            <div class="meal-time">🌅 Breakfast (7:30 AM - 9:30 AM)</div>
            <div class="meal-items">
                ${messMenus.breakfast.map(item => `<span class="meal-item">${item}</span>`).join('')}
            </div>
        </div>

        <div class="meal-section">
            <div class="meal-time">🌞 Lunch (12:00 PM - 2:00 PM)</div>
            <div class="meal-items">
                ${messMenus.lunch.map(item => `<span class="meal-item">${item}</span>`).join('')}
            </div>
        </div>

        <div class="meal-section">
            <div class="meal-time">☕ Snacks (4:30 PM - 5:30 PM)</div>
            <div class="meal-items">
                ${messMenus.snacks.map(item => `<span class="meal-item">${item}</span>`).join('')}
            </div>
        </div>

        <div class="meal-section">
            <div class="meal-time">🌙 Dinner (8:00 PM - 10:00 PM)</div>
            <div class="meal-items">
                ${messMenus.dinner.map(item => `<span class="meal-item">${item}</span>`).join('')}
            </div>
        </div>
    `;
}

// ===================== FOOD ORDERING =====================
const outlets = [
    { id: 1, name: 'Aromas Dhaba', icon: '🍽️', type: 'canteen', hours: '8:00 AM - 10:00 PM', status: 'open' },
    { id: 2, name: 'Cafe 92', icon: '🥤', type: 'cafe', hours: '9:00 AM - 9:00 PM', status: 'open' },
    { id: 3, name: 'Chayoos', icon: '🌙', type: 'night', hours: '8:00 PM - 2:00 AM', status: 'open' },
    { id: 4, name: 'CCD', icon: '☕', type: 'cafe', hours: '10:00 AM - 8:00 PM', status: 'open' },
    { id: 5, name: 'Amul Parlour', icon: '🍦', type: 'cafe', hours: '11:00 AM - 10:00 PM', status: 'open' },
    { id: 6, name: 'H2 Canteen', icon: '🏃', type: 'canteen', hours: '9:00 PM - 3:00 AM', status: 'open' }
];

const menuItems = {
    1: [
        { name: 'Veg Thali', price: 80 },
        { name: 'Chicken Biryani', price: 120 },
        { name: 'Paneer Butter Masala', price: 100 },
        { name: 'Masala Dosa', price: 60 },
        { name: 'Coffee', price: 20 }
    ],
    2: [
        { name: 'Fresh Orange Juice', price: 40 },
        { name: 'Mango Shake', price: 50 },
        { name: 'Watermelon Juice', price: 35 },
        { name: 'Mixed Fruit Juice', price: 60 }
    ],
    3: [
        { name: 'Maggi', price: 40 },
        { name: 'Sandwich', price: 50 },
        { name: 'Paratha', price: 30 },
        { name: 'Tea', price: 15 },
        { name: 'Omelette', price: 25 }
    ],
    4: [
        { name: 'Cappuccino', price: 50 },
        { name: 'Cold Coffee', price: 60 },
        { name: 'Brownie', price: 70 },
        { name: 'Pasta', price: 90 }
    ],
    5: [
        { name: 'Vanilla Ice Cream', price: 40 },
        { name: 'Chocolate Ice Cream', price: 45 },
        { name: 'Sundae', price: 80 },
        { name: 'Milkshake', price: 60 }
    ],
    6: [
        { name: 'Energy Bar', price: 30 },
        { name: 'Protein Shake', price: 80 },
        { name: 'Fruit Salad', price: 50 },
        { name: 'Sports Drink', price: 40 }
    ]
};

let cart = [];

function initFoodOutlets() {
    const grid = document.getElementById('outletsGrid');
    if (!grid) return;

    grid.innerHTML = outlets.map(outlet => `
        <div class="outlet-card" onclick="showOutletMenu(${outlet.id})">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">${outlet.icon}</div>
            <h3>${outlet.name}</h3>
            <p>⏰ ${outlet.hours}</p>
            <span style="color: #10B981; font-weight: 600;">🟢 Open</span>
        </div>
    `).join('');
}

function showOutletMenu(outletId) {
    const outlet = outlets.find(o => o.id === outletId);
    const items = menuItems[outletId];

    document.getElementById('outletsGrid').style.display = 'none';
    document.getElementById('selectedOutlet').style.display = 'block';
    document.getElementById('outletName').textContent = outlet.name;
    document.getElementById('outletHours').textContent = outlet.hours;

    const menuItemsContainer = document.getElementById('menuItems');
    menuItemsContainer.innerHTML = items.map((item, index) => `
        <div class="outlet-card">
            <h4>${item.name}</h4>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--iitb-blue-primary); margin: 1rem 0;">₹${item.price}</div>
            <button onclick="addToCart(${outletId}, ${index})" class="btn btn-primary">Add to Cart</button>
        </div>
    `).join('');
}

function backToOutlets() {
    document.getElementById('outletsGrid').style.display = 'grid';
    document.getElementById('selectedOutlet').style.display = 'none';
}

function addToCart(outletId, itemIndex) {
    const item = menuItems[outletId][itemIndex];
    const outlet = outlets.find(o => o.id === outletId);
    
    cart.push({ outletName: outlet.name, itemName: item.name, price: item.price });
    updateCartUI();
}

function updateCartUI() {
    document.getElementById('cartBtn').style.display = 'flex';
    document.getElementById('cartCount').textContent = cart.length;

    const cartItemsContainer = document.getElementById('cartItems');
    cartItemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.itemName}</div>
                <div class="cart-item-outlet">${item.outletName}</div>
            </div>
            <div class="cart-item-actions">
                <div class="cart-item-price">₹${item.price}</div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">✕</button>
            </div>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('cartTotal').textContent = '₹' + total;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
    if (cart.length === 0) {
        document.getElementById('cartBtn').style.display = 'none';
    }
}

function openCart() {
    document.getElementById('cartModal').classList.add('active');
}

function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

function checkout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    alert(`Order placed successfully! Total: ₹${total}\n\n🔄 Order Status: Preparing\nEstimated Time: 20-30 minutes`);
    cart = [];
    updateCartUI();
    closeCart();
    document.getElementById('cartBtn').style.display = 'none';
}

// ===================== HELP & DELIVERY =====================
const requests = [
    { id: 1, category: 'stationary', item: 'A4 Sheets (100 pages)', pickup: 'SAC Stationary', delivery: 'Hostel 5', points: 20 },
    { id: 2, category: 'xerox', item: 'Course Notes Xerox', pickup: 'Main Building', delivery: 'Hostel 2', points: 25 },
    { id: 3, category: 'food', item: 'Lunch from Canteen', pickup: 'Central Canteen', delivery: 'Library', points: 30 },
    { id: 4, category: 'stationary', item: 'Blue Pens', pickup: 'SAC Stationary', delivery: 'Hostel 7', points: 15 },
    { id: 5, category: 'food', item: 'Coffee & Snacks', pickup: 'SAC Cafe', delivery: 'Hostel 3', points: 20 }
];

function initRequests() {
    updateRequestsGrid('all');
    document.getElementById('requestCategory')?.addEventListener('change', (e) => {
        updateRequestsGrid(e.target.value);
    });
}

function updateRequestsGrid(category) {
    const filtered = category === 'all' ? requests : requests.filter(r => r.category === category);
    const grid = document.getElementById('requestsGrid');
    if (!grid) return;

    grid.innerHTML = filtered.map(req => `
        <div class="request-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span class="tag">${req.category}</span>
                <span style="color: var(--iitb-blue-primary); font-weight: 600;">⭐ ${req.points} pts</span>
            </div>
            <h4>${req.item}</h4>
            <p>📍 Pick-up: ${req.pickup}</p>
            <p>🎯 Deliver to: ${req.delivery}</p>
            <button onclick="acceptRequest(${req.id})" class="btn btn-primary">Accept Request</button>
        </div>
    `).join('');
}

function acceptRequest(reqId) {
    const request = requests.find(r => r.id === reqId);
    alert(`Request accepted! 🎉\n\nItem: ${request.item}\nPick-up: ${request.pickup}\nDeliver to: ${request.delivery}\n\nYou'll earn ${request.points} reward points!`);
}

// ===================== GROUPS =====================
const groups = [
    { id: 1, name: 'Robotics Club', category: 'technical', members: 156, privacy: 'public', description: 'Building autonomous robots' },
    { id: 2, name: 'Dance Team', category: 'cultural', members: 89, privacy: 'public', description: 'Contemporary and classical dance' },
    { id: 3, name: 'Football Team', category: 'sports', members: 45, privacy: 'public', description: 'Inter-hostel competitions' },
    { id: 4, name: 'Coding Club', category: 'technical', members: 234, privacy: 'public', description: 'Competitive programming' },
    { id: 5, name: 'Photography Club', category: 'cultural', members: 112, privacy: 'public', description: 'Campus photography' }
];

function initGroups() {
    updateGroupsGrid('all');
    document.getElementById('groupCategory')?.addEventListener('change', (e) => updateGroupsGrid(e.target.value));
}

function updateGroupsGrid(category) {
    const filtered = category === 'all' ? groups : groups.filter(g => g.category === category);
    const grid = document.getElementById('groupsGrid');
    if (!grid) return;

    grid.innerHTML = filtered.map(group => `
        <div class="group-card">
            <span class="tag">${group.category}</span>
            <h4>${group.name}</h4>
            <p>${group.description}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 1rem;">
                <span>👥 ${group.members} members</span>
                <span>🌐 ${group.privacy}</span>
            </div>
            <button onclick="joinGroup(${group.id})" class="btn btn-primary" style="margin-top: 1rem; width: 100%;">Join Group</button>
        </div>
    `).join('');
}

function joinGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    alert(`You've joined ${group.name}! 🎉`);
}

// ===================== CAMPUS MAP =====================
const buildings = [
    { name: 'Main Building', category: 'academic', description: 'Administrative offices' },
    { name: 'Hostel 1', category: 'hostel', description: 'Student residential' },
    { name: 'Library', category: 'academic', description: 'Central library' },
    { name: 'SAC', category: 'admin', description: 'Student Activity Center' },
    { name: 'Canteen', category: 'dining', description: 'Main canteen' }
];

function initBuildingList() {
    const list = document.getElementById('buildingList');
    if (!list) return;
    updateBuildingList('all');

    document.getElementById('buildingCategory')?.addEventListener('change', (e) => updateBuildingList(e.target.value));
}

function updateBuildingList(category) {
    const filtered = category === 'all' ? buildings : buildings.filter(b => b.category === category);
    const list = document.getElementById('buildingList');
    list.innerHTML = filtered.map(building => `
        <div class="building-card">
            <h4>${building.name}</h4>
            <p>${building.description}</p>
        </div>
    `).join('');
}

// ===================== COURSES =====================
const courses = [
    { id: 1, code: 'CS101', name: 'Intro to Programming', students: 245 },
    { id: 2, code: 'MA106', name: 'Linear Algebra', students: 312 },
    { id: 3, code: 'PH101', name: 'Quantum Physics', students: 198 },
    { id: 4, code: 'CS203', name: 'Data Structures', students: 156 }
];

const chatMessages = {
    1: [
        { sender: 'Rahul', message: 'When is the next assignment due?', time: '10:30 AM', sent: false },
        { sender: 'You', message: 'Friday at 11:59 PM', time: '10:32 AM', sent: true },
        { sender: 'Priya', message: 'Study group for midterm?', time: '11:15 AM', sent: false }
    ]
};

function initCourses() {
    const list = document.getElementById('courseList');
    if (!list) return;

    list.innerHTML = courses.map(course => `
        <div class="course-item" onclick="openCourse(${course.id})">
            <div style="font-weight: 700; color: var(--iitb-blue-primary);">${course.code}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">${course.name}</div>
        </div>
    `).join('');
}

function openCourse(courseId) {
    const course = courses.find(c => c.id === courseId);
    const messages = chatMessages[courseId] || [];

    document.querySelectorAll('.course-item').forEach(item => item.classList.remove('active'));
    event.target.closest('.course-item').classList.add('active');

    const main = document.getElementById('courseMain');
    main.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <h3>${course.code} - ${course.name}</h3>
                <p>${course.students} students</p>
            </div>
            <div class="chat-messages">
                ${messages.map(msg => `
                    <div class="message ${msg.sent ? 'sent' : ''}">
                        <div class="message-avatar">${msg.sent ? '😊' : '👤'}</div>
                        <div class="message-bubble">
                            <div style="font-weight: 600; margin-bottom: 0.25rem;">${msg.sender}</div>
                            ${msg.message}
                            <div class="message-time">${msg.time}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="chat-input-container">
                <textarea class="chat-input" placeholder="Type a message..." rows="1"></textarea>
                <button class="send-btn">Send</button>
            </div>
        </div>
    `;
}

// ===================== HOSPITAL SERVICES =====================
const doctors = [
    { id: 1, name: 'Dr. Anil Sharma', specialization: 'General Physician', available: true, timing: 'Mon-Fri 9AM-5PM' },
    { id: 2, name: 'Dr. Priya Desai', specialization: 'Dermatologist', available: true, timing: 'Mon, Wed, Fri 10AM-4PM' },
    { id: 3, name: 'Dr. Raj Kumar', specialization: 'Orthopedic', available: false, timing: 'Tue, Thu 11AM-3PM' },
    { id: 4, name: 'Dr. Sneha Patel', specialization: 'Dentist', available: true, timing: 'Mon-Sat 9AM-6PM' },
    { id: 5, name: 'Dr. Vikram Singh', specialization: 'Cardiologist', available: false, timing: 'Wed, Fri 2PM-6PM' },
    { id: 6, name: 'Dr. Meera Reddy', specialization: 'Psychiatrist', available: true, timing: 'Mon-Thu 10AM-4PM' }
];

function initDoctors() {
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    grid.innerHTML = doctors.map(doctor => `
        <div class="doctor-card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div style="font-size: 3rem;">👨‍⚕️</div>
                <span class="status-badge ${doctor.available ? 'available' : 'unavailable'}">
                    ${doctor.available ? '🟢 Available' : '🔴 Busy'}
                </span>
            </div>
            <h4>${doctor.name}</h4>
            <p style="color: var(--iitb-blue-primary); font-weight: 600;">${doctor.specialization}</p>
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">⏰ ${doctor.timing}</p>
        </div>
    `).join('');
}

// ===================== BUGGY PASS =====================
let buggyBalance = 250;
let transactions = [
    { type: 'Recharge', amount: 500, date: '2026-02-10', balance: 500 },
    { type: 'Ride', amount: -50, date: '2026-02-12', balance: 450 },
    { type: 'Ride', amount: -100, date: '2026-02-14', balance: 350 },
    { type: 'Ride', amount: -100, date: '2026-02-15', balance: 250 }
];

function initBuggyPass() {
    // Recharge amount calculator
    document.getElementById('rechargeAmount')?.addEventListener('change', (e) => {
        const amount = parseInt(e.target.value) || 0;
        document.getElementById('rechargeAmountDisplay').textContent = amount;
        document.getElementById('newBalance').textContent = buggyBalance + amount;
    });

    displayTransactionHistory();
}

function displayTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    container.innerHTML = transactions.map(txn => `
        <div style="display: flex; justify-content: space-between; padding: 1rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid ${txn.amount > 0 ? '#10B981' : '#EF4444'};">
            <div>
                <strong>${txn.type}</strong>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${txn.date}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: ${txn.amount > 0 ? '#10B981' : '#EF4444'};">
                    ${txn.amount > 0 ? '+' : ''}₹${Math.abs(txn.amount)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Balance: ₹${txn.balance}</div>
            </div>
        </div>
    `).join('');
}

// ===================== LOST & FOUND =====================
const lostFoundItems = [
    { id: 1, type: 'lost', category: 'electronics', item: 'Black HP Laptop', location: 'Library', date: '2026-02-14', tags: ['black', 'laptop', 'hp'], contact: '9876543210' },
    { id: 2, type: 'found', category: 'ids', item: 'Student ID Card', location: 'SAC', date: '2026-02-15', tags: ['id', 'card', 'student'], contact: '9876543211' },
    { id: 3, type: 'lost', category: 'books', item: 'Linear Algebra Textbook', location: 'Hostel 3', date: '2026-02-13', tags: ['book', 'math', 'textbook'], contact: '9876543212' },
    { id: 4, type: 'found', category: 'accessories', item: 'Blue Water Bottle', location: 'Gymkhana', date: '2026-02-16', tags: ['blue', 'bottle', 'water'], contact: '9876543213' },
    { id: 5, type: 'lost', category: 'electronics', item: 'Wireless Earbuds', location: 'Canteen', date: '2026-02-12', tags: ['earbuds', 'white', 'wireless'], contact: '9876543214' }
];

function initLostFound() {
    displayLostFoundItems();
    displayTagFilters();

    document.getElementById('lostFoundSearch')?.addEventListener('input', () => displayLostFoundItems());
    document.getElementById('categoryFilter')?.addEventListener('change', () => displayLostFoundItems());
}

function displayLostFoundItems() {
    const searchQuery = document.getElementById('lostFoundSearch')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';

    const filtered = lostFoundItems.filter(item => {
        const matchesSearch = item.item.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const grid = document.getElementById('lostFoundItems');
    if (!grid) return;

    grid.innerHTML = filtered.map(item => `
        <div class="item-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span class="status-badge ${item.type === 'lost' ? 'unavailable' : 'available'}">
                    ${item.type === 'lost' ? '🔴 Lost' : '🟢 Found'}
                </span>
                <span class="tag">${item.category}</span>
            </div>
            <h4>${item.item}</h4>
            <p>📍 Location: ${item.location}</p>
            <p>📅 Date: ${item.date}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.75rem 0;">
                ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <p style="font-weight: 600; color: var(--iitb-blue-primary);">📞 ${item.contact}</p>
        </div>
    `).join('');
}

function displayTagFilters() {
    const allTags = [...new Set(lostFoundItems.flatMap(item => item.tags))];
    const container = document.getElementById('tagFilters');
    if (!container) return;

    container.innerHTML = allTags.map(tag => `
        <span class="tag" style="cursor: pointer;" onclick="filterByTag('${tag}')">${tag}</span>
    `).join('');
}

function filterByTag(tag) {
    document.getElementById('lostFoundSearch').value = tag;
    displayLostFoundItems();
}

// ===================== CONTACT DIRECTORY =====================
const students = [
    { id: 1, name: 'Arjun Mehta', department: 'cse', year: '3rd', interests: ['Web Dev', 'AI/ML'], email: 'arjun@iitb.ac.in' },
    { id: 2, name: 'Priya Sharma', department: 'ee', year: '2nd', interests: ['Robotics', 'IoT'], email: 'priya@iitb.ac.in' },
    { id: 3, name: 'Rahul Kumar', department: 'me', year: '4th', interests: ['CAD', 'Manufacturing'], email: 'rahul@iitb.ac.in' },
    { id: 4, name: 'Sneha Patel', department: 'cse', year: '3rd', interests: ['Data Science', 'Blockchain'], email: 'sneha@iitb.ac.in' }
];

const faculty = [
    { id: 1, name: 'Prof. Amit Sethi', department: 'cse', specialization: 'Machine Learning', email: 'amit.sethi@iitb.ac.in' },
    { id: 2, name: 'Prof. Rekha Jain', department: 'ee', specialization: 'Power Systems', email: 'rekha.jain@iitb.ac.in' },
    { id: 3, name: 'Prof. Suresh Nair', department: 'me', specialization: 'Thermodynamics', email: 'suresh.nair@iitb.ac.in' }
];

function initContacts() {
    displayStudents();
    displayFaculty();
    displayDepartments();
}

function displayStudents() {
    const grid = document.getElementById('studentsGrid');
    if (!grid) return;

    grid.innerHTML = students.map(student => `
        <div class="contact-card">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">👤</div>
            <h4>${student.name}</h4>
            <p style="color: var(--iitb-blue-primary); font-weight: 600;">${student.department.toUpperCase()} • ${student.year} Year</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.75rem 0;">
                ${student.interests.map(interest => `<span class="tag">${interest}</span>`).join('')}
            </div>
            <p style="font-size: 0.875rem;">📧 ${student.email}</p>
            <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">Contact</button>
        </div>
    `).join('');
}

function displayFaculty() {
    const grid = document.getElementById('facultyGrid');
    if (!grid) return;

    grid.innerHTML = faculty.map(prof => `
        <div class="contact-card">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">👨‍🏫</div>
            <h4>${prof.name}</h4>
            <p style="color: var(--iitb-blue-primary); font-weight: 600;">${prof.department.toUpperCase()}</p>
            <p style="margin: 0.5rem 0;">${prof.specialization}</p>
            <p style="font-size: 0.875rem;">📧 ${prof.email}</p>
            <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">Contact</button>
        </div>
    `).join('');
}

function displayDepartments() {
    const departments = [
        { name: 'Computer Science & Engg', code: 'CSE', contact: 'cse.office@iitb.ac.in' },
        { name: 'Electrical Engineering', code: 'EE', contact: 'ee.office@iitb.ac.in' },
        { name: 'Mechanical Engineering', code: 'ME', contact: 'me.office@iitb.ac.in' }
    ];

    const grid = document.getElementById('departmentsGrid');
    if (!grid) return;

    grid.innerHTML = departments.map(dept => `
        <div class="contact-card">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🏢</div>
            <h4>${dept.name}</h4>
            <p style="color: var(--iitb-blue-primary); font-weight: 700; font-size: 1.5rem; margin: 0.5rem 0;">${dept.code}</p>
            <p style="font-size: 0.875rem;">📧 ${dept.contact}</p>
        </div>
    `).join('');
}

// ===================== MARKETPLACE =====================
const marketplaceItems = [
    { id: 1, title: 'Engineering Mathematics Textbook', category: 'books', price: 400, condition: 'good', seller: 'Amit', contact: '9876543210', date: '2026-02-15' },
    { id: 2, title: 'HP Laptop i5 8GB RAM', category: 'electronics', price: 25000, condition: 'likenew', seller: 'Priya', contact: '9876543211', date: '2026-02-14' },
    { id: 3, title: 'Study Desk with Chair', category: 'furniture', price: 3000, condition: 'good', seller: 'Rahul', contact: '9876543212', date: '2026-02-13' },
    { id: 4, title: 'Cricket Bat (SS TON)', category: 'sports', price: 2500, condition: 'good', seller: 'Vikram', contact: '9876543213', date: '2026-02-16' },
    { id: 5, title: 'Programming in C Book', category: 'books', price: 200, condition: 'fair', seller: 'Sneha', contact: '9876543214', date: '2026-02-12' }
];

function initMarketplace() {
    displayMarketplaceItems();

    document.getElementById('marketplaceSearch')?.addEventListener('input', () => displayMarketplaceItems());
    document.getElementById('marketplaceCategory')?.addEventListener('change', () => displayMarketplaceItems());
    document.getElementById('priceSort')?.addEventListener('change', () =>displayMarketplaceItems());
}

function displayMarketplaceItems() {
    const searchQuery = document.getElementById('marketplaceSearch')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('marketplaceCategory')?.value || 'all';
    const sortOrder = document.getElementById('priceSort')?.value || 'newest';

    let filtered = marketplaceItems.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Sort
    if (sortOrder === 'priceLow') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortOrder === 'priceHigh') {
        filtered.sort((a, b) => b.price - a.price);
    }

    const grid = document.getElementById('marketplaceItems');
    if (!grid) return;

    grid.innerHTML = filtered.map(item => `
        <div class="item-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span class="tag">${item.category}</span>
                <span class="tag">${item.condition}</span>
            </div>
            <h4>${item.title}</h4>
            <div style="font-size: 2rem; font-weight: 700; color: var(--iitb-blue-primary); margin: 1rem 0;">₹${item.price}</div>
            <p style="margin-bottom: 0.5rem;">👤 Seller: ${item.seller}</p>
            <p style="font-weight: 600; color: var(--iitb-blue-primary);">📞 ${item.contact}</p>
            <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">Contact Seller</button>
        </div>
    `).join('');
}

// ===================== EVENTS & CALENDAR =====================
const events = [
    { id: 1, title: 'AI Workshop', category: 'technical', date: '2026-02-20', time: '4:00 PM', location: 'Main Building', organizer: 'Coding Club' },
    { id: 2, title: 'Cultural Night', category: 'cultural', date: '2026-02-22', time: '6:00 PM', location: 'SAC', organizer: 'Cultural Committee' },
    { id: 3, title: 'Inter-Hostel Football', category: 'sports', date: '2026-02-25', time: '5:00 PM', location: 'Sports Ground', organizer: 'Sports Council' },
    { id: 4, title: 'Guest Lecture: Blockchain', category: 'academic', date: '2026-02-18', time: '3:00 PM', location: 'LH-1', organizer: 'CSE Dept' },
    { id: 5, title: 'Photography Walk', category: 'social', date: '2026-02-21', time: '7:00 AM', location: 'Campus', organizer: 'Photography Club' }
];

function initEvents() {
    displayUpcomingEvents();
    generateCalendar();

    document.getElementById('eventCategoryFilter')?.addEventListener('change', () => displayUpcomingEvents());
}

function displayUpcomingEvents() {
    const categoryFilter = document.getElementById('eventCategoryFilter')?.value || 'all';
    const filtered = categoryFilter === 'all' ? events : events.filter(e => e.category === categoryFilter);

    const grid = document.getElementById('upcomingEvents');
    if (!grid) return;

    grid.innerHTML = filtered.map(event => `
        <div class="event-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span class="tag">${event.category}</span>
                <span style="font-weight: 600; color: var(--iitb-blue-primary);">📅 ${event.date}</span>
            </div>
            <h4>${event.title}</h4>
            <p>⏰ ${event.time}</p>
            <p>📍 ${event.location}</p>
            <p style="font-size: 0.875rem; color: var(--text-secondary);">Organized by: ${event.organizer}</p>
            <button class="btn btn-primary" style="margin-top: 1rem; width: 100%;">RSVP</button>
        </div>
    `).join('');
}

function generateCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const daysInMonth = 28; // February 2026
    const startDay = 0; // Starts on Sunday

    let calendarHTML = '';
    
    // Add empty cells for days before the 1st
    for (let i = 0; i < startDay; i++) {
        calendarHTML += '<div class="calendar-day" style="opacity: 0.3;"></div>';
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const hasEvent = events.some(e => e.date === `2026-02-${day.toString().padStart(2, '0')}`);
        calendarHTML += `
            <div class="calendar-day ${hasEvent ? 'has-event' : ''}">
                <div style="font-weight: 600;">${day}</div>
            </div>
        `;
    }

    grid.innerHTML = calendarHTML;
}

function previousMonth() {
    alert('Previous month navigation - demo mode');
}

function nextMonth() {
    alert('Next month navigation - demo mode');
}

function saveSubscriptions() {
    alert('Event subscription preferences saved! 🔔\n\nYou will receive notifications for selected event types.');
}

// ===================== FORM HANDLERS =====================
document.getElementById('vaccinationForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Vaccination appointment booked! You will receive a confirmation email.');
    e.target.reset();
});

document.getElementById('rechargeForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('rechargeAmount').value);
    buggyBalance += amount;
    document.getElementById('buggyBalance').textContent = buggyBalance;
    transactions.unshift({ type: 'Recharge', amount: amount, date: '2026-02-16', balance: buggyBalance });
    displayTransactionHistory();
    alert(`Recharge successful! ₹${amount} added.\nNew Balance: ₹${buggyBalance}`);
    e.target.reset();
});

document.getElementById('reportLostForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Lost item reported successfully!\n\nYou will be notified if someone finds it.');
    e.target.reset();
});

document.getElementById('reportFoundForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Found item reported successfully!\n\nThe owner will be able to contact you.');
    e.target.reset();
});

document.getElementById('sellItemForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Item listed successfully!\n\nBuyers can now see your listing.');
    e.target.reset();
});
