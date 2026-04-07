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
# For Security User Creation 

cd backend
/Users/aritrabelel/myenv/bin/python manage.py create_security_user \
  --username security_office \
  --password mysecurepass \
  --full-name "Security Office" \
  --phone 9876543210


---
# Keycloak Integration:
How to Run
Step 1 — Start Keycloak

# From project root
docker compose up -d

# Wait ~30s for Keycloak to be ready, then run the setup script
./keycloak/setup-realm.sh
This creates the campusone realm, all 4 roles, the frontend client, and a test admin user (campus_admin / Admin@123).

Step 2 — Backend

cd backend

# Install new dependencies
pip install -r requirements.txt

# Apply the migration (adds keycloak_id to User, removes PasswordResetToken)
python manage.py migrate

# Sync existing Django users → Keycloak (run once)
python manage.py sync_keycloak

# Start Django
python manage.py runserver
Step 3 — Frontend

cd frontend

# Install keycloak-js
npm install

# Start dev server
npm run dev
What Happens Now
Browser opens → Keycloak check-sso runs silently in background
No session → user goes to /login → immediately redirected to Keycloak's login page
User logs in on Keycloak → redirected back to app with auth code
Keycloak JS exchanges code for tokens (PKCE, RS256)
AuthContext calls GET /api/auth/me/ with the Keycloak token
Django's KeycloakAuthentication validates the token via JWKS, provisions/syncs the user
App loads — all existing APIs work identically
Files Created/Changed Summary
File	Change
backend/api/keycloak_authentication.py	NEW — custom DRF auth backend
backend/api/migrations/0013_keycloak_integration.py	NEW — adds keycloak_id, removes PasswordResetToken
backend/api/management/commands/sync_keycloak.py	NEW — one-time user migration command
backend/campus_portal/settings.py	Replaced SIMPLE_JWT with KEYCLOAK_* config
backend/api/models.py	Added keycloak_id, removed PasswordResetToken
backend/api/serializers.py	Removed auth serializers
backend/api/views.py	Removed 6 auth views, kept UserProfileView
backend/api/urls.py	Removed auth endpoints, kept /auth/me/
frontend/src/keycloak.js	NEW — Keycloak singleton
frontend/public/silent-check-sso.html	NEW — silent SSO iframe page
frontend/src/main.jsx	Init Keycloak before React renders
frontend/src/context/AuthContext.jsx	Rewritten with Keycloak adapter
frontend/src/services/api.js	Token from keycloak.token directly
frontend/src/App.jsx	Removed manual token wiring
frontend/src/pages/Login.jsx	Redirects to keycloak.login()
frontend/src/pages/Register.jsx	Redirects to keycloak.register()
frontend/src/pages/ForgotPassword.jsx	Redirects to Keycloak reset flow
frontend/src/pages/Profile.jsx	Password section → Keycloak account link
docker-compose.yml	NEW — Keycloak + PostgreSQL
keycloak/setup-realm.sh	NEW — realm/client/roles setup script
