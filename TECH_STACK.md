# ATHITHI — Technology Stack Document

**Project:** Athithi — Guest Safety & Hospitality Coordination Platform  
**Version:** 1.0  
**Purpose:** Define the technologies, architecture, libraries, and development conventions for the hackathon MVP.

---

## 1. Technology Stack Overview

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Component-based user interfaces |
| Build tool | Vite | Development server and production builds |
| Styling | Vanilla CSS | Custom, responsive UI without Tailwind |
| Routing | React Router | Role-specific pages and navigation |
| HTTP communication | Native Fetch API | Frontend-to-backend API requests |
| Real-time communication | Socket.IO Client | Live incident and task updates |
| Backend | Node.js | JavaScript runtime |
| API framework | Express.js | REST API and middleware |
| Real-time server | Socket.IO | Authorised event broadcasting |
| Database | PostgreSQL | Persistent relational data |
| ORM | Prisma ORM | Database schema, queries, migrations |
| Authentication | Server-managed sessions | Secure, role-based access |
| Password security | Argon2id or bcrypt | Password hashing |
| Validation | Zod | Request and data validation |
| File uploads | Multer | Validated multipart uploads |
| Testing | Vitest + React Testing Library | Frontend component and logic tests |
| Backend testing | Node.js test runner or Vitest + Supertest | API and integration tests |
| End-to-end testing | Playwright | Complete multi-role workflow tests |
| Version control | Git + GitHub | Collaboration and source management |
| API documentation | OpenAPI / Swagger UI | API contract documentation |
| Deployment | Vercel + Render or equivalent | Frontend and backend hosting |
| Database hosting | Managed PostgreSQL | Hosted persistent database |

> [!IMPORTANT]
> Use JavaScript throughout the application unless TypeScript is explicitly adopted by the team before development begins. Do not mix conventions unnecessarily.

---

## 2. Frontend Architecture

### 2.1 React + Vite

React will power the guest portal, staff interface, public reporting page, and administrator command centre.

Vite will provide local development, hot module replacement, and production bundling.

### 2.2 Styling

Use vanilla CSS with reusable component classes and CSS variables.

**Do not use Tailwind CSS.**

Define shared design tokens for:
- Colours and semantic status indicators.
- Typography and spacing.
- Border radii and shadows.
- Responsive breakpoints.
- Focus indicators and accessibility states.

Create reusable UI components rather than duplicating markup and styles across pages.

### 2.3 React Router

Use React Router for navigation.

**Suggested routes:**

**Public**
- `/`
- `/report-incident`
- `/report-submitted`

**Guest**
- `/guest`
- `/guest/emergency`
- `/guest/requests`
- `/guest/requests/:id`
- `/guest/notifications`

**Staff**
- `/staff`
- `/staff/tasks/:id`
- `/staff/history`

**Admin**
- `/admin`
- `/admin/incidents`
- `/admin/incidents/:id`
- `/admin/requests`
- `/admin/rooms`
- `/admin/rooms/:id`
- `/admin/public-reports`
- `/admin/audit-logs`

> [!WARNING]
> Route guards improve navigation and user experience, but **backend authorisation remains mandatory**. Hiding a page in React is not a security control.

### 2.4 Frontend State Management

Use React's built-in state and context for the MVP.

- `useState` for local UI state.
- `useEffect` for synchronising with external systems.
- Context for authenticated user and session information.
- A small custom hook for API communication and error handling.

Avoid adding Redux or another global state library unless the implementation demonstrates a genuine need.

Do not treat frontend state as the authoritative source for incident status or permissions.

---

## 3. Backend Architecture

### 3.1 Node.js + Express

The backend will expose a REST API and enforce business rules.

Responsibilities include:
- Authentication and session management.
- Role-based access control.
- Incident creation and lifecycle management.
- Service request management.
- Staff assignment and escalation.
- Database transactions.
- Notification creation.
- Attachment validation.
- Audit logging.
- API input validation and error handling.

### 3.2 Backend Design Principles

Use a modular architecture that separates routes, controllers, services, database access, and validation.

**Suggested structure:**

```text
server/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── config/
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── incidents/
│   │   ├── assignments/
│   │   ├── serviceRequests/
│   │   ├── rooms/
│   │   ├── notifications/
│   │   └── audit/
│   ├── realtime/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── tests/
├── .env.example
└── package.json
```

> [!NOTE]
> Each module should own its related API routes, validation, business logic, and database operations. Do not put the entire backend into one large Express file.

---

## 4. Database and ORM

### 4.1 PostgreSQL

PostgreSQL will store all authoritative application data. It is appropriate because the system has related entities such as users, hotels, stays, rooms, incidents, assignments, notifications, and audit records.

### 4.2 Prisma ORM

Prisma will provide:
- Database schema definition.
- Type-safe database access where supported.
- Schema migrations.
- Database queries and relations.
- Seed scripts for demonstration data.

### 4.3 Core Entities

| # | Entity |
|---|---|
| 1 | `User` |
| 2 | `Hotel` |
| 3 | `Room` |
| 4 | `Stay` |
| 5 | `Incident` |
| 6 | `Assignment` |
| 7 | `ServiceRequest` |
| 8 | `IncidentEvent` |
| 9 | `ServiceRequestEvent` |
| 10 | `Notification` |
| 11 | `Attachment` |
| 12 | `AuditLog` |

Use foreign keys, unique constraints, indexes, and database transactions where appropriate. Store timestamps consistently in UTC.

> [!IMPORTANT]
> An occupied room must not automatically be treated as proof that a guest is physically present.

---

## 5. Authentication and Security

### 5.1 Session Strategy

For the MVP, prefer server-managed sessions stored in a persistent session store, with an appropriately configured secure cookie.

In production:
- Enable HTTPS.
- Set cookies to `HttpOnly` and `Secure`.
- Use an appropriate `SameSite` policy.
- Implement CSRF protection where required by the cookie-based authentication design.
- Rotate or invalidate sessions appropriately.
- Configure session expiry and revocation.

> [!CAUTION]
> Do not use `localStorage` as the primary store for long-lived authentication tokens.

### 5.2 Role-Based Access Control

Supported roles:

| Role | Scope |
|---|---|
| `GUEST` | Own records only |
| `STAFF` | Authorised tasks and records |
| `ADMIN` | Operational records within permitted hotel |

Public reporting is an unauthenticated, restricted capability rather than a privileged user role.

Enforce authorisation on **every** protected API endpoint.

### 5.3 Password Security

Use Argon2id where practical, or bcrypt with an appropriately configured work factor.

Never store plaintext passwords.

### 5.4 Input Validation

Use Zod to validate request bodies, query parameters, route parameters, and relevant configuration.

Apply:
- Request size limits.
- Rate limiting.
- Authentication throttling.
- Safe error responses.
- Upload MIME-type and size checks.
- Strict validation of incident status transitions.

> [!CAUTION]
> Do not trust client-supplied roles, priorities, hotel IDs, assignment ownership, or room associations.

---

## 6. Real-Time Communication

### Technology: Socket.IO

Socket.IO will support real-time updates between authorised clients.

**Event names:**
- `incident:created`
- `incident:updated`
- `incident:assigned`
- `assignment:acknowledged`
- `assignment:escalated`
- `service-request:created`
- `service-request:updated`
- `notification:created`

### Implementation Rules

1. Persist the database change **before** publishing the corresponding event.
2. Authenticate the socket connection.
3. Authorise subscriptions to rooms or channels.
4. Send each event only to the appropriate recipients.
5. Do not broadcast sensitive guest information globally.
6. Fetch authoritative state from the API after reconnection.
7. Record acknowledgements separately from notification delivery.
8. Do not rely on socket events as the only record of an incident.

> [!NOTE]
> For the MVP, use one backend instance. If the deployment later requires multiple instances, introduce an appropriate Socket.IO adapter and shared infrastructure.

---

## 7. File Uploads

Use Multer for receiving multipart uploads through Express.

Initial supported use case: optional photographs attached to incident and service reports.

Requirements:
- Restrict accepted file types.
- Enforce file size limits.
- Generate storage identifiers instead of trusting filenames.
- Store file metadata in PostgreSQL.
- Store file contents in object storage or an appropriate persistent storage service.
- Enforce authorisation when viewing or downloading attachments.

> [!CAUTION]
> Do not rely on a temporary deployment filesystem for persistent production uploads. Photographs must never be required before an SOS can be submitted.

---

## 8. Testing Strategy

### Frontend
Use Vitest and React Testing Library for:
- Component rendering.
- Form validation.
- Role-specific interface behaviour.
- Loading and error states.
- Request status display.

### Backend
Use an automated test runner and Supertest for:
- Authentication.
- Authorisation.
- Incident creation.
- Assignment transitions.
- Service request workflows.
- Escalation rules.
- Invalid status transitions.
- Data isolation between guests.

### End-to-End (Playwright)

Primary flow:
> Guest submits SOS → Admin receives incident → Admin assigns staff → Staff acknowledges → Staff updates status → Admin closes incident.

Also test:
- Routine service request completion.
- Public report submission and review.
- Unacknowledged assignment escalation.
- Reconnection and data recovery.
- Unauthorised access attempts.

> [!TIP]
> Prioritise the core end-to-end flow before expanding test coverage.

---

## 9. Deployment Architecture

| Service | Host |
|---|---|
| Frontend | Vercel or equivalent static host |
| Backend | Render or equivalent Node.js host |
| Database | Managed PostgreSQL |
| File storage | Optional object storage (if image uploads implemented) |

**Example `.env` configuration:**

```dotenv
# Backend
NODE_ENV=development
PORT=5000
DATABASE_URL=
SESSION_SECRET=
FRONTEND_ORIGIN=http://localhost:5173

# Frontend
VITE_API_BASE_URL=http://localhost:5000/api
```

Use separate production values and HTTPS URLs when deployed.

> [!CAUTION]
> Do not commit `.env` files, database credentials, session secrets, or API keys to GitHub.

Verify that the selected backend host supports persistent WebSocket connections and configure CORS, cookies, and proxy settings accordingly.

---

## 10. Development and Collaboration

### Tools
- Visual Studio Code
- Git and GitHub
- npm
- Postman or an equivalent API testing tool
- Prisma CLI
- Browser developer tools

### Code Quality
- Use ESLint for linting.
- Use Prettier for formatting.
- Keep naming conventions consistent.
- Create small, focused components and modules.
- Document non-obvious business rules.
- Use environment variables for configuration.
- Avoid duplicated business logic across frontend and backend.

### Git Workflow
- Use a shared `main` branch protected from unreviewed changes where practical.
- Develop features on separate branches.
- Use focused commits.
- Review and test changes before merging.
- Keep database migrations in version control.

---

## 11. Recommended Installation Order

### Frontend

**Runtime:**
- `react`
- `react-dom`
- `react-router-dom`
- `socket.io-client`

**Dev dependencies:**
- `vite`
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `eslint`
- `prettier`

### Backend

**Runtime:**
- `express`
- `socket.io`
- `@prisma/client`
- `prisma`
- `zod`
- `express-session`
- `connect-pg-simple`
- `argon2`
- `multer`
- `helmet`
- `cors`
- `express-rate-limit`

**Dev dependencies:**
- `nodemon`
- `supertest`
- `vitest` or Node.js built-in test runner
- `eslint`
- `prettier`

> [!TIP]
> Select compatible package versions and verify their current installation requirements before setup. Do not install every dependency at once if the corresponding feature has not yet been implemented.

---

## 12. What Not to Add Yet

Avoid the following until the core product works:

- Redux or another complex state-management system.
- Microservices.
- Kubernetes.
- Kafka or a separate message broker.
- Multiple backend services.
- Complex GIS infrastructure for a basic hotel floor plan.
- A native mobile application.
- AI-dependent emergency handling.
- Unnecessary third-party notification integrations.

These additions increase implementation and debugging costs without being necessary for the initial demonstration.

---

## 13. Definition of a Technically Complete MVP

The technology stack is successfully implemented when:

- [ ] The React application communicates with the Express API.
- [ ] PostgreSQL persists users, stays, rooms, incidents, requests, and assignments.
- [ ] Prisma migrations and seed scripts work reproducibly.
- [ ] Server-side authentication and authorisation are enforced.
- [ ] SOS and service requests are persisted correctly.
- [ ] Real-time updates reach authorised clients.
- [ ] Staff assignments and incident transitions are validated.
- [ ] Important actions are audit-logged.
- [ ] Failed or disconnected clients can recover the latest state.
- [ ] Automated tests cover the primary workflows and access restrictions.
- [ ] The deployed application works with its configured database and environment variables.

---

> **Final architectural principle:**
>
> Keep the application as a modular monolith with one React frontend, one Express backend, and one PostgreSQL database. Make emergency coordination reliable before adding optional integrations or advanced features.
