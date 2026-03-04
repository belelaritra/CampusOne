# 🎓 Campus One (React + Django)

A full-stack **IITB Student Portal** built using a modern frontend and scalable backend architecture.

---

## 🚀 Tech Stack

### Frontend

* **React (Vite)** – Fast frontend build tool
* **Axios** – API communication
* **JavaScript (ES6+)**
* **CSS / Tailwind (optional upgrade)**

### Backend

* **Django** – Web framework
* **Django REST Framework (DRF)** – API layer

---

## 📦 Project Structure

```
CampusOne/
│
├── frontend/        # React (Vite) app
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/         # Django project
│   ├── campus_portal/
│   ├── api/
│   └── manage.py
│
├── index.html       # Original static HTML 
├── style.css
├── app.js
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repo

```bash
git clone <your-repo-url>
cd CampusOne
```

---

# 🖥️ FRONTEND SETUP (React)

### 📦 Install dependencies

```bash
cd frontend
npm install
```

### ▶️ Run frontend

```bash
npm run dev
```

### 🌐 Frontend URL

```
http://localhost:5173/
```

---

# 🐍 BACKEND SETUP (Django)

### 📦 Create virtual environment (recommended)

```bash
cd backend
python -m venv venv
source venv/bin/activate     # Mac/Linux
venv\Scripts\activate        # Windows
```

---

### 📦 Install dependencies

```bash
pip install django djangorestframework
```

---

### ▶️ Run backend server

```bash
python manage.py runserver
```

### 🌐 Backend URL

```
http://127.0.0.1:8000/
```

---

### 🔗 API Base URL

```
http://127.0.0.1:8000/api/
```

Example:

```
http://127.0.0.1:8000/api/hostels/
```

---

## 🔌 Frontend ↔ Backend Connection

Configured in:

```
frontend/src/services/api.js
```

```javascript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
```

---

## 🧪 Testing Connection

1. Start backend
2. Start frontend
3. Open browser:

```
http://localhost:5173/
```

4. Open DevTools → Network

You should see:

```
GET /api/hostels/ → 200 OK
```

---

## 📚 Available API Endpoints

| Feature       | Endpoint                  |
| ------------- | ------------------------- |
| Hostels       | `/api/hostels/`           |
| Mess Menu     | `/api/hostels/{id}/menu/` |
| Food Outlets  | `/api/outlets/`           |
| Orders        | `/api/orders/`            |
| Help Requests | `/api/requests/`          |
| Groups        | `/api/groups/`            |
| Events        | `/api/events/`            |
| Marketplace   | `/api/marketplace/`       |
| Doctors       | `/api/doctors/`           |

---

## 🛠️ Dependencies

### Frontend (`package.json`)

* react
* react-dom
* vite
* axios

### Backend

* django
* djangorestframework

---

## ⚠️ Common Issues

### ❌ 404 on `/`

This is expected.

Django only serves:

```
/admin/
/api/
```

---

### ❌ API not working in frontend

Check:

* Backend is running on port **8000**
* No CORS issue (install `django-cors-headers` if needed)

---

## 🚀 Future Improvements

* 🔐 Authentication (JWT)
* 🗄️ Database integration (PostgreSQL)
* 🎨 Tailwind UI redesign
* 📱 Responsive mobile UI
* 🔔 Notifications system

---
