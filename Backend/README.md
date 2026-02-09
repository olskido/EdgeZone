# EdgeZone Signal Engine (Backend)

Modular monolith backend built for precomputed signals.

## Required services

- PostgreSQL
- Redis

## Setup

- Install dependencies:
  - `npm install`
- Configure env:
  - copy `.env.example` to `.env` and set values
- Prisma:
  - `npm run prisma:generate`
  - `npm run prisma:migrate`

## Run

- API server:
  - `npm run dev`
- Workers:
  - `npm run dev:workers`

## Endpoints

- `GET /health`
- `GET /tokens`
- `GET /token/:id`
