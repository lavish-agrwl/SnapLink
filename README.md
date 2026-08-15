# SnapLink

SnapLink is a full-stack URL shortener with a React dashboard, cache-first redirects, and asynchronous click analytics.

**Live demo:** [snaplink-by-lavish.vercel.app](https://snaplink-by-lavish.vercel.app/)

## Features

- Create short URLs with generated Base62 slugs or custom alphanumeric slugs.
- Manage links and view click analytics in the React dashboard.
- Redirect through Redis with a MongoDB fallback and soft-expiry validation.
- Capture clicks asynchronously with BullMQ, then batch-write them to MongoDB.
- View total clicks, 30-day trends, top referrers, and top countries.
- Apply sliding-window rate limits to shortening, redirect, and analytics requests.
- Monitor service health and BullMQ queues.
- Automatically remove expired URLs and old click records with MongoDB TTL indexes.

## Project structure

```
.
├── backend/    # Express API, BullMQ worker, MongoDB, and Redis integrations
├── frontend/   # React + TypeScript + Vite dashboard
└── .env.example
```

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Query, Chart.js |
| API | Node.js, Express, Zod |
| Data | MongoDB Atlas (managed), Mongoose |
| Cache and queues | Redis, BullMQ |
| Infrastructure | AWS EC2, Docker Compose, Nginx, Let's Encrypt (Certbot) |
| Operations | Bull Board, Helmet, Morgan, GitHub Actions (CI) |

## Architecture

The dashboard communicates with the Express API. For a redirect, the API checks Redis first and falls back to MongoDB on a cache miss. Redirects enqueue click events without blocking the response; a BullMQ worker batches those events into MongoDB.

```mermaid
flowchart TD
    Browser[Browser] -->|Request short URL| API[Express API]
    API --> Redis[(Redis cache)]
    Redis -->|Cache hit| API
    Redis -->|Cache miss| Mongo[(MongoDB)]
    Mongo -->|URL record| API
    Mongo -->|Repopulate cache| Redis
    API -.->|Enqueue click event| Queue[BullMQ queue]
    Queue --> Worker[Batch worker]
    Worker -->|Bulk-write click events| Mongo
    API -->|301 redirect| Destination[Original URL]
```

## Deployment

**Frontend** is deployed on [Vercel](https://vercel.com), served from `frontend/`, live at [snaplink-by-lavish.vercel.app](https://snaplink-by-lavish.vercel.app/).

**Backend** (API + worker + Redis) runs on an AWS EC2 instance (Ubuntu, t3.micro) via Docker Compose. Nginx reverse-proxies HTTPS traffic to the containerized API, with TLS certificates from Let's Encrypt via Certbot. **MongoDB** is hosted on MongoDB Atlas (managed, free tier) rather than self-hosted.

```
Vercel (frontend) → HTTPS → Nginx (EC2) → Express API + BullMQ worker (Docker) → Redis (Docker) / MongoDB Atlas
```

To deploy your own instance:
1. Provision an EC2 instance and install Docker + Docker Compose.
2. Clone this repo and create `backend/.env` with production values (see table below) — including an Atlas `MONGODB_URI`.
3. Run `docker compose up -d --build` from the repo root.
4. Set up Nginx as a reverse proxy to the API container's port, and obtain a TLS certificate with Certbot for your domain.
5. Deploy `frontend/` to Vercel (or any static host), setting `VITE_API_URL` to your backend's public HTTPS URL.

## Local development

### Prerequisites

- Node.js 20.19 or later
- Docker and Docker Compose (for Redis; MongoDB Atlas is used even in local dev — see note below)

> **Note:** This repo's `docker-compose.yml` is configured for production (Redis only; MongoDB runs on Atlas). For local development, either point `MONGODB_URI` at a free Atlas cluster (simplest — no local Mongo needed), or run a local MongoDB container separately alongside this compose file.

### 1. Configure the backend

The backend loads its environment file from the `backend` directory. Create it from the root template:

```bash
cp .env.example backend/.env
```

Update `backend/.env` for local development:

```dotenv
MONGODB_URI=<your-atlas-connection-string-or-local-mongo-uri>
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
ADMIN_PASSWORD=<a-long-unique-password>
```

Install backend dependencies and start Redis:

```bash
cd backend
npm install
docker compose up -d redis
```

In one terminal, start the API:

```bash
cd backend
npm start
```

In another terminal, start the analytics worker:

```bash
cd backend
npm run start:worker
```

### 2. Configure and start the frontend

Create `frontend/.env` to point the dashboard and redirect route at the backend:

```dotenv
VITE_API_URL=http://localhost:3000
```

Then install dependencies and run Vite:

```bash
cd frontend
npm install
npm run dev
```

Open the address Vite prints (normally `http://localhost:5173`).

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description | Local example | Production example |
| --- | --- | --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb://localhost:27017/url-shortener` | `mongodb+srv://user:pass@cluster.mongodb.net/url-shortener` |
| `REDIS_URL` | Yes | Redis connection string | `redis://localhost:6379` | `redis://redis:6379` |
| `BASE_URL` | Yes | Public backend URL used in generated short links | `http://localhost:3000` | `https://snaplink.lavishagrwl.dev` |
| `FRONTEND_URL` | Yes | Allowed frontend origin for CORS | `http://localhost:5173` | `https://snaplink-by-lavish.vercel.app` |
| `ADMIN_PASSWORD` | Yes | Password for the Bull Board admin login | `a-long-unique-password` | `<stored-secret>` |
| `NODE_ENV` | No | `development`, `test`, or `production` | `development` | `production` |

### Frontend (`frontend/.env`)

| Variable | Required | Description | Local example | Production example |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | No | Backend base URL used for API requests and the frontend redirect route; defaults to `http://localhost:3000` | `http://localhost:3000` | `https://snaplink.lavishagrwl.dev` |

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/shorten` | Create a shortened URL. Body: `{"url":"https://example.com"}` |
| `GET` | `/api/urls` | List shortened URLs. Supports `limit` and `skip` query parameters. |
| `GET` | `/api/analytics/:slug` | Get analytics for a short URL. |
| `GET` | `/:slug` | Redirect to the original URL with `301 Moved Permanently`. |
| `GET` | `/health` | Report MongoDB, Redis, and queue health. |
| `GET` / `POST` | `/admin/login` | Password login for the admin area. |
| `GET` | `/admin/queues` | Authenticated Bull Board queue dashboard. |

Common error responses are `400` for invalid input, `404` for missing or expired slugs, `409` for an already-used custom slug, `429` for rate limits, and `503` when a dependency is unavailable.

## Scripts

### Backend

Run these inside `backend/`.

| Command | Description |
| --- | --- |
| `npm start` | Start the Express API. |
| `npm run start:worker` | Start the click-event worker. |
| `npm test` | Run the test suite. |
| `npm run lint` | Lint backend code. |
| `npm run seed` | Seed test data. |

### Frontend

Run these inside `frontend/`.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run lint` | Lint frontend code. |
| `npm run preview` | Preview the production build locally. |
