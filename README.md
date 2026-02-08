# Bulk Action Platform for CRM

A highly scalable, entity-agnostic bulk action platform designed for CRM systems. This platform enables efficient bulk operations on CRM entities (Contacts, Companies, Leads, etc.) with enterprise-grade features including batch processing, rate limiting, de-duplication, and scheduling.

## 🎯 What is This?

The Bulk Action Platform allows you to perform operations on thousands of CRM entities simultaneously. For example:
- Update status for 10,000 contacts
- Change email domains for multiple companies
- Bulk assign leads to sales reps
- Schedule bulk updates for future execution

All operations are processed asynchronously via a queue system, ensuring your API remains responsive even under heavy load.

## ✨ Key Features

- **🚀 High Performance**: Processes thousands of entities per minute with batch processing
- **📊 Real-time Progress**: Track bulk action progress and get detailed statistics
- **🔄 Entity-Agnostic**: Easy to extend for new entity types (Companies, Leads, etc.)
- **⚡ Rate Limiting**: 10,000 entities per minute per account (configurable)
- **🔍 De-duplication**: Automatically skips duplicate entities by email
- **⏰ Scheduling**: Schedule bulk actions for future execution
- **📝 Comprehensive Logging**: Detailed logs for every processed entity (success, failure, skipped)
- **🎯 Extensible**: Add new bulk actions with minimal code changes

## 🏗️ Architecture

The platform uses a **queue-based architecture**:
- **API Layer**: Express.js REST API with rate limiting
- **Queue Layer**: BullMQ + Redis for job management
- **Worker Layer**: Background workers process jobs in batches
- **Data Layer**: PostgreSQL for persistence, Redis for caching/queues

See `docs/ARCHITECTURE.md` for detailed architecture diagrams.

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

## 🚀 Quick Start

For detailed setup instructions, see [START.md](START.md).

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup PostgreSQL and Redis

**Option A: Using Docker (Recommended)**
```bash
docker run -d --name bulk-action-postgres -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bulk_action_platform postgres:16

docker run -d --name bulk-action-redis -p 6379:6379 redis:7-alpine
```

**Option B: Using Homebrew (macOS)**
```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
createdb bulk_action_platform
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/bulk_action_platform"
REDIS_URL="redis://localhost:6379"
```

### 4. Setup Database

```bash
npm run db:migrate
npm run db:seed  # Seeds 2500 sample contacts
```

### 5. Start Services

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker:dev
```

### 6. Verify Installation

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |
| GET | `/contacts` | List contacts (helper endpoint for testing) |
| GET | `/bulk-actions` | List all bulk actions (with filters: `accountId`, `status`, `limit`, `offset`) |
| POST | `/bulk-actions` | Create a new bulk action |
| GET | `/bulk-actions/:id` | Get bulk action details including progress |
| GET | `/bulk-actions/:id/stats` | Get summary statistics (success, failure, skipped counts) |
| GET | `/bulk-actions/:id/logs` | Get paginated logs (filter by `status`, `limit`, `offset`) |
| POST | `/bulk-actions/from-csv` | Create bulk action from CSV file upload |

## 💡 Usage Examples

### Example 1: Basic Bulk Update

**Step 1: Get Contact IDs**
```bash
curl "http://localhost:3000/contacts?accountId=acc_001&limit=5"
```

**Response:**
```json
{
  "contacts": [
    {"id": "clx123abc", "name": "John Smith", "email": "john@example.com"},
    {"id": "clx456def", "name": "Jane Doe", "email": "jane@example.com"}
  ]
}
```

**Step 2: Create Bulk Action**
```bash
curl -X POST http://localhost:3000/bulk-actions \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_001",
    "entityType": "Contact",
    "actionType": "bulk-update",
    "entityIds": ["clx123abc", "clx456def"],
    "payload": {
      "status": "active",
      "age": 30
    }
  }'
```

**Response:**
```json
{
  "id": "clx789xyz",
  "message": "Bulk action created and queued"
}
```

**Step 3: Check Progress**
```bash
curl "http://localhost:3000/bulk-actions/clx789xyz"
```

**Response:**
```json
{
  "id": "clx789xyz",
  "accountId": "acc_001",
  "entityType": "Contact",
  "actionType": "bulk-update",
  "status": "processing",
  "totalCount": 2,
  "processedCount": 1,
  "progress": 50.0,
  "createdAt": "2025-02-08T10:00:00Z"
}
```

**Step 4: Get Statistics**
```bash
curl "http://localhost:3000/bulk-actions/clx789xyz/stats"
```

**Response:**
```json
{
  "bulkActionId": "clx789xyz",
  "totalCount": 2,
  "success": 2,
  "failure": 0,
  "skipped": 0,
  "status": "completed"
}
```

### Example 2: Using CSV String

```bash
curl -X POST http://localhost:3000/bulk-actions \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_001",
    "entityType": "Contact",
    "actionType": "bulk-update",
    "entityIdsCsv": "clx123abc,clx456def,clx789ghi",
    "payload": {
      "status": "inactive"
    }
  }'
```

### Example 3: CSV File Upload

Create `entity_ids.csv`:
```
clx123abc
clx456def
clx789ghi
```

```bash
curl -X POST http://localhost:3000/bulk-actions/from-csv \
  -F "file=@entity_ids.csv" \
  -F "accountId=acc_001" \
  -F "entityType=Contact" \
  -F "actionType=bulk-update" \
  -F 'payload={"status":"active"}'
```

### Example 4: Scheduled Bulk Action

```bash
curl -X POST http://localhost:3000/bulk-actions \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_001",
    "entityType": "Contact",
    "actionType": "bulk-update",
    "entityIds": ["clx123abc", "clx456def"],
    "payload": { "status": "archived" },
    "scheduledAt": "2025-12-31T23:15:00Z"
  }'
```

The bulk action will execute automatically at the specified time.

### Example 5: List Bulk Actions

```bash
# List all actions for an account
curl "http://localhost:3000/bulk-actions?accountId=acc_001&limit=10"

# Filter by status
curl "http://localhost:3000/bulk-actions?accountId=acc_001&status=completed"

# Pagination
curl "http://localhost:3000/bulk-actions?accountId=acc_001&limit=20&offset=0"
```

### Example 6: View Logs

```bash
# Get all logs
curl "http://localhost:3000/bulk-actions/clx789xyz/logs"

# Filter by status
curl "http://localhost:3000/bulk-actions/clx789xyz/logs?status=success"

# Get failed entities
curl "http://localhost:3000/bulk-actions/clx789xyz/logs?status=failure"

# Get skipped entities (duplicates)
curl "http://localhost:3000/bulk-actions/clx789xyz/logs?status=skipped"
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log1",
      "entityId": "clx123abc",
      "status": "success",
      "processedAt": "2025-02-08T10:00:05Z"
    },
    {
      "id": "log2",
      "entityId": "clx456def",
      "status": "skipped",
      "skipReason": "duplicate_email",
      "processedAt": "2025-02-08T10:00:05Z"
    }
  ],
  "total": 2
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | API server port | `3000` |
| `BATCH_SIZE` | Entities processed per batch | `100` |
| `RATE_LIMIT_PER_MINUTE` | Rate limit per account | `10000` |

### Batch Processing

The worker processes entities in configurable batches (default: 100). This reduces database load and improves performance. Adjust `BATCH_SIZE` in `.env` based on your needs.

### Rate Limiting

Each account is limited to 10,000 entities per minute. The rate limit counts each entity in a bulk action, not each bulk action request. For example:
- Bulk action with 100 entities = 100 events toward the limit
- Bulk action with 5,000 entities = 5,000 events toward the limit

If the limit is exceeded, the API returns `429 Too Many Requests`.

## 📬 Postman Collection

Import `postman/Bulk-Action-Platform.postman_collection.json` into Postman for:
- Pre-configured requests for all endpoints
- Example payloads
- Automatic `actionId` capture for chained requests
- CSV file upload examples

## 🧪 Testing

### Load Testing

```bash
# Ensure API and worker are running, DB is seeded
npm run load-test
```

The load test simulates:
- Sustained load: ~5 bulk actions/sec for 60 seconds
- Spike: 20 bulk actions/sec for 30 seconds
- Target: 1000+ entities processed per minute

### Manual Testing

1. Start API and worker (see Quick Start)
2. Use Postman collection or curl examples above
3. Monitor worker logs for processing details
4. Check stats endpoint for results

## 📁 Project Structure

```
highlevel/
├── src/
│   ├── actions/          # Bulk action handlers (extensible)
│   │   ├── registry.ts   # Action registry (strategy pattern)
│   │   ├── types.ts      # Handler interfaces
│   │   └── bulk-update/  # Bulk update handler
│   ├── config/           # Environment configuration
│   ├── db/               # Prisma client
│   ├── jobs/             # BullMQ queue definitions
│   ├── middleware/       # Rate limiting middleware
│   ├── routes/           # Express API routes
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions (CSV parser, etc.)
│   ├── app.ts            # Express app setup
│   ├── index.ts          # API server entry point
│   └── worker.ts         # BullMQ worker entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── seeds/
│   └── contacts.csv      # Sample contact data (2500 rows)
├── tests/
│   └── load/             # Load testing scripts
├── postman/              # Postman collection
└── docs/                 # Architecture documentation
```

## 🔌 Extending the Platform

### Adding a New Bulk Action Type

Example: Adding a "bulk-delete" action

**1. Create Handler** (`src/actions/bulk-delete/handler.ts`):
```typescript
import { IBulkActionHandler, BulkActionContext, BulkActionResult } from "../types.js";
import { BulkActionLogStatus } from "@prisma/client";
import { registerHandler } from "../registry.js";

export class BulkDeleteHandler implements IBulkActionHandler {
  readonly entityType = "Contact";
  readonly actionType = "bulk-delete";

  validate(payload: unknown): void {
    // Add validation logic
  }

  async execute(
    entityIds: string[],
    payload: unknown,
    context: BulkActionContext
  ): Promise<BulkActionResult[]> {
    // Implement delete logic
    const results = [];
    for (const id of entityIds) {
      try {
        await context.prisma.contact.delete({ where: { id } });
        results.push({ entityId: id, status: BulkActionLogStatus.success });
      } catch (err) {
        results.push({
          entityId: id,
          status: BulkActionLogStatus.failure,
          errorMessage: err.message,
        });
      }
    }
    return results;
  }
}

registerHandler(new BulkDeleteHandler());
```

**2. Register Handler** (`src/actions/index.ts`):
```typescript
import "./bulk-delete/handler.js";
```

**3. Use It:**
```bash
curl -X POST http://localhost:3000/bulk-actions \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_001",
    "entityType": "Contact",
    "actionType": "bulk-delete",
    "entityIds": ["id1", "id2"]
  }'
```

### Adding a New Entity Type

1. Add Prisma model (e.g., `Company`)
2. Create handler for that entity (e.g., `bulk-update-company`)
3. Register handler
4. No changes needed to API routes or queue system!

See `docs/ARCHITECTURE.md` for detailed extensibility guide.

## 📚 Documentation

- **[START.md](START.md)** - Detailed setup and installation guide
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design patterns
- **Postman Collection** - Import `postman/Bulk-Action-Platform.postman_collection.json`

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change PORT in .env
PORT=3001
```

**Database connection error:**
- Verify PostgreSQL is running: `psql -d bulk_action_platform`
- Check `DATABASE_URL` in `.env`

**Redis connection error:**
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` in `.env`

**Worker not processing jobs:**
- Ensure worker is running: `npm run worker:dev`
- Check Redis connection
- Check worker logs for errors

For more troubleshooting, see [START.md](START.md).

## 📄 License

MIT
