<p align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/check-circle-2.svg" width="80" height="80" alt="TaskFlow Logo" />
</p>

<h1 align="center">TaskFlow</h1>

<p align="center">
  <strong>Modern task management for productive minds</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API</a> •
  <a href="#deployment">Deploy</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version" />
  <img src="https://img.shields.io/badge/react-18.2.0-blue" alt="React Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Overview

TaskFlow is a feature-rich task management application designed for developers and teams who value clean architecture and modern UX. Built with React and Express, it offers a seamless experience across devices with real-time updates and smart organization features.

## Features

### Task Management
- **Rich task metadata** — titles, descriptions, due dates, and custom tags
- **Priority system** — visual indicators with automatic sorting (High → Medium → Low)
- **Subtasks** — break complex tasks into trackable steps
- **Categories** — organize work, personal, and custom project tasks
- **Bulk operations** — complete, archive, or delete multiple tasks at once

### User Experience
- **Dark/Light themes** — eye-friendly interface with smooth transitions
- **Real-time search** — instant filtering across all task fields
- **Progress dashboard** — visual statistics and completion tracking
- **Responsive design** — optimized for desktop, tablet, and mobile
- **Optimistic updates** — instant feedback for all interactions

### Technical
- **RESTful API** — clean, documented endpoints following best practices
- **In-memory storage** — ready for database integration (PostgreSQL, MongoDB)
- **Docker support** — containerized deployment with docker-compose
- **CI/CD pipeline** — automated testing with GitHub Actions

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express |
| **Testing** | Vitest, Jest, Testing Library |
| **DevOps** | Docker, GitHub Actions, Nginx |

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/ngeff/taskflow.git
cd taskflow

# Backend setup
cd backend
npm install

# Frontend setup
cd ../frontend
npm install
```

### Development

```bash
# Terminal 1 — Start API (http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — Start client (http://localhost:5173)
cd frontend
npm run dev
```

### Using Docker

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Project Structure

```
taskflow/
├── backend/
│   ├── src/
│   │   └── index.js          # Express API server
│   ├── tests/
│   │   └── tasks.test.js     # API integration tests
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API client
│   │   ├── styles/           # Global CSS
│   │   ├── App.jsx           # Main component
│   │   └── main.jsx          # Entry point
│   ├── tests/
│   │   └── App.test.jsx      # Component tests
│   ├── Dockerfile
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml            # CI/CD pipeline
│
├── docker-compose.yml
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## API Reference

### Base URL

```
http://localhost:5000/api
```

### Endpoints

#### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tasks` | List all tasks |
| `GET` | `/tasks/:id` | Get single task |
| `POST` | `/tasks` | Create task |
| `PATCH` | `/tasks/:id` | Update task |
| `DELETE` | `/tasks/:id` | Delete task |
| `POST` | `/tasks/bulk` | Bulk operations |

#### Subtasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tasks/:id/subtasks` | Add subtask |
| `PATCH` | `/tasks/:taskId/subtasks/:subtaskId` | Update subtask |
| `DELETE` | `/tasks/:taskId/subtasks/:subtaskId` | Delete subtask |

#### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories` | List categories |
| `POST` | `/categories` | Create category |
| `GET` | `/stats` | Get statistics |
| `GET` | `/health` | Health check |

### Query Parameters

```
GET /api/tasks?category=work&priority=high&completed=false&search=meeting
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category ID |
| `priority` | string | `high`, `medium`, or `low` |
| `completed` | boolean | Filter by completion status |
| `archived` | boolean | Filter by archive status |
| `search` | string | Search in title, description, tags |

### Request Examples

**Create Task**

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review pull request",
    "description": "Check the new authentication feature",
    "priority": "high",
    "category": "work",
    "tags": ["code-review", "urgent"],
    "dueDate": "2025-01-20"
  }'
```

**Response**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Review pull request",
    "description": "Check the new authentication feature",
    "priority": "high",
    "category": "work",
    "tags": ["code-review", "urgent"],
    "dueDate": "2025-01-20",
    "completed": false,
    "archived": false,
    "subtasks": [],
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "completedAt": null
  }
}
```

**Bulk Complete**

```bash
curl -X POST http://localhost:5000/api/tasks/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "action": "complete",
    "ids": ["id-1", "id-2", "id-3"]
  }'
```

## Configuration

### Environment Variables

Create `.env` files based on `.env.example`:

**Backend**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `NODE_ENV` | `development` | Environment mode |

**Frontend**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API URL |

## Deployment

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.yml build

# Deploy
docker-compose up -d
```

### Manual Deployment

**Backend**

```bash
cd backend
npm install --production
NODE_ENV=production npm start
```

**Frontend**

```bash
cd frontend
npm run build
# Serve the 'dist' folder with Nginx or any static server
```

## Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:coverage
```

## Roadmap

- [ ] User authentication (JWT)
- [ ] PostgreSQL/MongoDB integration
- [ ] Real-time sync (WebSocket)
- [ ] Drag-and-drop reordering
- [ ] Calendar view
- [ ] Recurring tasks
- [ ] Mobile app (React Native)
- [ ] Browser extension
- [ ] Import/Export (CSV, JSON)
- [ ] Team collaboration

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with dedication and ☕
  <br />
  <a href="https://github.com/ngeff/taskflow/issues">Report Bug</a>
  •
  <a href="https://github.com/ngeff/taskflow/issues">Request Feature</a>
</p>