# Quick Start Guide

This guide will help you install dependencies and start the Bulk Action Platform.

---

## Prerequisites Check

```bash
# Check Node.js version (requires 20+)
node --version

# Check if PostgreSQL is installed
psql --version

# Check if Redis is installed
redis-cli --version
```

---

## Step 1: Install PostgreSQL

### Option A: macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create database
createdb bulk_action_platform
```

**Note:** If `createdb` command not found, add PostgreSQL to PATH:
```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Option B: Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database (as postgres user)
sudo -u postgres createdb bulk_action_platform
```

### Option C: Docker (Recommended for quick setup)

```bash
# Run PostgreSQL container
docker run -d \
  --name bulk-action-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bulk_action_platform \
  postgres:16

# Verify it's running
docker ps
```

---

## Step 2: Install Redis

### Option A: macOS (Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Option B: Linux (Ubuntu/Debian)

```bash
# Install Redis
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Option C: Docker (Recommended for quick setup)

```bash
# Run Redis container
docker run -d \
  --name bulk-action-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify it's running
docker ps
```

### Option D: Docker Compose (Both PostgreSQL + Redis)

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: bulk_action_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Then run:
```bash
docker compose up -d
```

---

## Step 3: Install Project Dependencies

```bash
# Install npm packages
npm install
```

---

## Step 4: Configure Environment

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` and set:

**For local PostgreSQL (Homebrew/Linux):**
```env
DATABASE_URL="postgresql://your_username@localhost:5432/bulk_action_platform"
```

**For Docker PostgreSQL:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bulk_action_platform"
```

**Redis URL (default is fine if running locally):**
```env
REDIS_URL="redis://localhost:6379"
```

---

## Step 5: Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data (2500 contacts)
npm run db:seed
```

**Troubleshooting:**
- If migration fails with "database doesn't exist", create it first:
  ```bash
  createdb bulk_action_platform  # macOS/Linux
  # or for Docker:
  docker exec -it bulk-action-postgres psql -U postgres -c "CREATE DATABASE bulk_action_platform;"
  ```

---

## Step 6: Start the Application

You need **two terminals** running simultaneously:

### Terminal 1: API Server

```bash
npm run dev
```

Expected output:
```
Bulk Action Platform API running on port 3000
```

### Terminal 2: BullMQ Worker

```bash
npm run worker:dev
```

Expected output:
```
Bulk action worker started
```

---

## Step 7: Verify Everything is Running

### Check API Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-02-08T..."}
```

### Check Contacts (Database)

```bash
curl "http://localhost:3000/contacts?accountId=acc_001&limit=5"
```

Expected response:
```json
{"contacts":[{"id":"...","name":"...","email":"..."}]}
```

### Check Redis Connection

```bash
redis-cli ping
```

Should return: `PONG`

### Check PostgreSQL Connection

```bash
psql -d bulk_action_platform -c "SELECT COUNT(*) FROM \"Contact\";"
```

Should return: `2500` (or number of seeded contacts)

---

## Quick Test: Create a Bulk Action

```bash
# 1. Get contact IDs
curl "http://localhost:3000/contacts?accountId=acc_001&limit=2" | jq '.contacts[].id'

# 2. Create bulk action (replace CONTACT_ID_1 and CONTACT_ID_2 with actual IDs)
curl -X POST http://localhost:3000/bulk-actions \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_001",
    "entityType": "Contact",
    "actionType": "bulk-update",
    "entityIds": ["CONTACT_ID_1", "CONTACT_ID_2"],
    "payload": { "status": "active" }
  }'

# 3. Check action status (replace ACTION_ID with returned id)
curl "http://localhost:3000/bulk-actions/ACTION_ID"

# 4. Check stats
curl "http://localhost:3000/bulk-actions/ACTION_ID/stats"
```

---

## Stopping Services

### Stop Application
- Press `Ctrl+C` in both terminal windows

### Stop PostgreSQL (Homebrew)
```bash
brew services stop postgresql@16
```

### Stop Redis (Homebrew)
```bash
brew services stop redis
```

### Stop Docker Containers
```bash
# Stop specific containers
docker stop bulk-action-postgres bulk-action-redis

# Or if using docker-compose
docker compose down
```

---

## Troubleshooting

### Port Already in Use

If port 3000 is in use:
```bash
# Change PORT in .env
PORT=3001
```

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Check connection
psql -d bulk_action_platform -U your_username
```

### Redis Connection Error

```bash
# Check if Redis is running
redis-cli ping

# Check Redis logs
brew services list  # macOS
sudo systemctl status redis-server  # Linux
```

### Database Migration Errors

```bash
# Reset database (WARNING: deletes all data)
npm run db:push -- --force-reset

# Then re-seed
npm run db:seed
```

---

## Production Deployment

For production, use:

```bash
# Build TypeScript
npm run build

# Start API server
npm start

# Start worker (in separate process/container)
npm run worker

# Run migrations
npm run db:migrate:deploy
```

---

## Next Steps

- Import Postman collection: `postman/Bulk-Action-Platform.postman_collection.json`
- Read `README.md` for API documentation
- Read `docs/ARCHITECTURE.md` for system architecture
- Run load tests: `npm run load-test`
