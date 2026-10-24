# 🏨 ATHITHI
> **Athithi Devo Bhava. Their safety, our responsibility.**  
> *Hospitality Crisis Coordination & Service Platform*  
> **SDG Alignment:** SDG 11 — Sustainable Cities and Communities  
> **Version:** 1.0 — Hackathon MVP

---

## 🌟 Overview

**Athithi** is a centralized hospitality safety and service coordination platform that bridges hotel guests, on-duty responders, control room operators, and the public into a unified, real-time crisis dispatch and task management system.

Traditional hospitality relies on delayed telephone calls and fragmented channels. Athithi introduces immediate SOS dispatch, room-level floor plan tracking, automated acknowledgement workflows, and real-time synchronization via Socket.IO.

---

## 🚀 The 4 Interfaces

| Portal | Role | Core Capabilities |
|---|---|---|
| **Guest Portal** (`/guest`) | Hotel Guest | • **One-Tap Emergency SOS** (high-contrast, immediate dispatch)<br>• Optional category & details modal (Fire, Medical, Electrical, Water, Security)<br>• **Routine Service & Amenities tab** (Housekeeping, Plumbing, Towels)<br>• Real-time request tracking (Reported → Assigned → Responding → Resolved) |
| **Command Centre** (`/admin`) | Control Room Operator | • **Live Incident Queue** with priority filtering (Critical, High, Medium, Low)<br>• **Interactive Hotel Floor Plan & Rooms** (Floors 1–3, room occupancy, guest stays, active hazard flags)<br>• **Staff Dispatch Modal** showing responder workload<br>• Priority escalation & **Verified Closure** with external emergency services logs<br>• **Routine Service Requests Queue** |
| **Staff Portal** (`/staff`) | Security & Maintenance | • Task inbox with urgent pending acknowledgement cards<br>• One-tap **"Acknowledge Assignment"** & **"Decline"** (with operational reason)<br>• Step-by-step response milestones (**En Route**, **On Scene**, **Completed**) |
| **Public Portal** (`/report-incident`) | Visitors & Passersby | • Unauthenticated reporting for exterior or public hazards<br>• Rate-limited with unique reference confirmation numbers (`ATH-...`)<br>• Zero access to private hotel data or guest records |

---

## 🛠️ Technology Stack

- **Frontend:** React (Vite), Vanilla CSS with custom Hospitality Design Tokens, React Router, Socket.IO Client.
- **Backend:** Node.js, Express.js, Socket.IO, PostgreSQL, Prisma ORM, express-session (PostgreSQL-backed store), Argon2 password hashing, Zod validation.
- **Architecture:** Modular monolith with transactional database integrity and authenticated real-time room broadcasting.

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (running locally or remote)

### 2. Backend Setup
```bash
cd server
npm install

# Configure environment
cp .env.example .env
# Update DATABASE_URL in .env if needed (default: postgresql://postgres:postgres@localhost:5432/athithi)

# Run migrations and seed demo data
npx prisma migrate dev
node prisma/seed.js

# Start backend server
npm start
# Server runs on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd client
npm install

# Start Vite development server
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 🔑 Demo Credentials (Password: `Demo1234!`)

A **1-Tap Demo Switcher** is built directly into the login screen (`/login`):

- **Admin (Control Room):** `admin@athithi.demo`
- **Staff (Security):** `staff.security@athithi.demo`
- **Staff (Maintenance):** `staff.maintenance@athithi.demo`
- **Staff (Housekeeping):** `staff.housekeeping@athithi.demo`
- **Guest (Room 101):** `guest.ananya@athithi.demo`
- **Guest (Room 201):** `guest.vikram@athithi.demo`
- **Guest (Room 301):** `guest.meera@athithi.demo`

---

## 📑 Documentation
- [PRD (Product Requirements Document)](./PRD.md)
- [Tech Stack Architecture](./TECH_STACK.md)
- [Task & Development Log](./TODO.md)
