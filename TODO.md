# ATHITHI — TODO

> Design is crafted with the **impeccable** skill — hospitality dark theme, high-contrast critical SOS, clean command centre hierarchy.  
> Status: ✅ Completed · Ready for Hackathon Demonstration

---

## Phase 1 — Project Foundation

### Scaffold
- ✅ Create `/client` with Vite + React
- ✅ Create `/server` with Node.js + Express
- ✅ Configure `.gitignore`, `.env.example` for both
- ✅ Install all dependencies (client + server)
- ✅ Verify development servers for both

### Database
- ✅ Set up PostgreSQL (local)
- ✅ Initialise Prisma in `/server`
- ✅ Write `schema.prisma` with all 12 entities
- ✅ Run initial migration (`20261024035325_init`)
- ✅ Write `seed.js` — 1 hotel, 3 floors, 12 rooms, 3 guests, 3 staff, 1 admin, seeded stays

### Auth
- ✅ `POST /api/auth/login` — validate credentials, create session
- ✅ `POST /api/auth/logout` — destroy session
- ✅ `GET /api/auth/me` — return current user from session
- ✅ `authenticate.js` middleware — attach user to req
- ✅ `authorize.js` middleware — enforce role
- ✅ `connect-pg-simple` session store wired up
- ✅ Passwords hashed with argon2

### Verification
- ✅ All 3 roles can log in and receive correct session
- ✅ Protected routes reject unauthenticated requests
- ✅ Staff cannot hit admin endpoints

---

## Phase 2 — Incident Workflow

### Backend
- ✅ `POST /api/incidents/sos` — create Critical incident, emit `incident:created`
- ✅ `POST /api/incidents` — create general incident
- ✅ `GET /api/incidents/mine` — guest's own incidents
- ✅ `GET /api/incidents/:id` — incident detail (role-scoped)
- ✅ `GET /api/admin/incidents` — all incidents with filters
- ✅ `POST /api/admin/incidents/:id/assign` — assign staff, create Assignment
- ✅ `POST /api/assignments/:id/acknowledge` — staff ack
- ✅ `POST /api/assignments/:id/decline` — staff decline with reason
- ✅ `PATCH /api/assignments/:id/status` — staff status update
- ✅ `POST /api/incidents/:id/events` — add event to timeline
- ✅ `POST /api/admin/incidents/:id/escalate` — escalate
- ✅ `POST /api/admin/incidents/:id/close` — close with resolution note & external emergency log
- ✅ Status transition validation (backend enforced)
- ✅ IncidentEvent written on every status change

### Frontend — Guest Portal
- ✅ **impeccable** Guest dashboard layout + SOS button (large, prominent, glow effect)
- ✅ SOS flow — tap → immediate POST → confirmation screen → optional category/details
- ✅ My Incidents list with status badges
- ✅ Real-time incident updates

### Frontend — Admin Command Centre
- ✅ **impeccable** Admin overview layout
- ✅ Incident queue — sortable by priority/time
- ✅ Incident detail & live status
- ✅ Assign staff modal with on-duty staff workload
- ✅ Escalate / close actions with external service documentation

### Frontend — Staff Portal
- ✅ **impeccable** Staff task inbox layout
- ✅ Task card — priority, type, location, time
- ✅ Task detail — acknowledge / decline / update status
- ✅ Progress notes input

### Verification
- ✅ SOS → Admin sees it → assigns → Staff acks → Admin sees ack → Staff resolves → Admin closes (Tested & Verified end-to-end)

---

## Phase 3 — Real-Time Coordination

### Backend
- ✅ Integrate Socket.IO into Express server
- ✅ Authenticate socket connections via session
- ✅ Scope socket rooms by role + hotel + user
- ✅ Emit `incident:created` on SOS / new incident
- ✅ Emit `incident:updated` on status change
- ✅ Emit `incident:assigned` on assignment
- ✅ Emit `assignment:acknowledged` / `assignment:declined` / `assignment:updated`
- ✅ Emit `service_request:created` / `service_request:updated`
- ✅ Emit `public_report:created`

### Frontend
- ✅ Socket.IO client — connect after login, disconnect on logout
- ✅ Admin dashboard auto-updates on live socket events without refresh
- ✅ Staff inbox auto-updates on assignment
- ✅ Guest status updates on incident progress
- ✅ Live connection indicator dot in Navbar

---

## Phase 4 — Service Management

### Backend
- ✅ `POST /api/service-requests` — create routine service request
- ✅ `GET /api/service-requests/mine` — guest requests
- ✅ `GET /api/admin/service-requests` — admin queue
- ✅ `POST /api/admin/service-requests/:id/assign` — dispatch staff
- ✅ ServiceRequestEvent on state transitions

### Frontend — Guest
- ✅ **impeccable** Service Request tab & form (Housekeeping, Plumbing, Amenities, etc.)
- ✅ My Requests tracker + live status

### Frontend — Admin
- ✅ **impeccable** Routine service queue tab alongside crisis queue
- ✅ Assign service request to staff modal

### Frontend — Staff
- ✅ Service requests appear in task inbox alongside incidents

---

## Phase 5 — Room Overview & Public Reporting

### Backend
- ✅ `GET /api/admin/rooms` — floor/room list with active stay & open incidents
- ✅ `GET /api/admin/rooms/:id` — room detail
- ✅ `POST /api/public/reports` — public report (rate-limited, validated)

### Frontend — Admin Room Overview
- ✅ **impeccable** Hotel floor plan grid (Floors 1, 2, 3)
- ✅ Room card — operational status, active incident markers, active guest stay
- ✅ Room detail modal — stay info, unknown physical presence disclaimer

### Frontend — Public Reporting
- ✅ **impeccable** Public report page (no login required)
- ✅ Category select + description + location
- ✅ Confirmation page with unique reference number (`ATH-...`)

---

## Phase 6 — Polish, Deployment & Live Verification

### Deployment & Cloud Infrastructure
- ✅ Database: Render PostgreSQL (`dpg-dbe2tkom7kps73c5dv90-a.singapore-postgres.render.com`)
- ✅ Backend: Render Web Service (`https://athiti.onrender.com`)
- ✅ Frontend: Vercel SPA (`https://athithi-client.vercel.app`)
- ✅ Cross-domain credentialed CORS & dynamic origin reflection
- ✅ Express session configured with PostgreSQL SSL pool (`rejectUnauthorized: false`)
- ✅ Cookie settings: `Secure; SameSite=None; proxy: true`
- ✅ Frontend production fallback: automatically routes to `https://athiti.onrender.com` in production mode
- ✅ Live verification: 200 OK verified on Render production across all admin endpoints & Socket.IO auth

### Quality & Presentation
- ✅ **impeccable design system** — custom hospitality dark tokens, clean typography, accessible contrast
- ✅ Responsive layouts across mobile & desktop
- ✅ 1-Tap Demo Switcher on Login Page for fast presentations
- ✅ "This does not replace emergency services" safety disclaimers
- ✅ Clean production build: Vite build passing (`dist/` generated with zero errors)

---

## Demo Credentials (all passwords: `Demo1234!`)
- **Admin**: `admin@athithi.demo`
- **Staff (Security)**: `staff.security@athithi.demo`
- **Staff (Maintenance)**: `staff.maintenance@athithi.demo`
- **Staff (Housekeeping)**: `staff.housekeeping@athithi.demo`
- **Guest (Room 101)**: `guest.ananya@athithi.demo`
- **Guest (Room 201)**: `guest.vikram@athithi.demo`
- **Guest (Room 301)**: `guest.meera@athithi.demo`
