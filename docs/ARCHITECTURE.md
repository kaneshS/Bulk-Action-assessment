# Bulk Action Platform - Architecture

## Overview

The Bulk Action Platform is designed for high scalability, extensibility, and robust error handling. It processes bulk operations on CRM entities (currently Contact) using a queue-based architecture.

**Note:** This document contains both text-based (ASCII) diagrams and Mermaid diagrams. ASCII diagrams are visible in all text viewers. Mermaid diagrams render in:
- GitHub (automatically)
- VS Code (with Mermaid extension)
- [mermaid.live](https://mermaid.live) (copy/paste code blocks)
- Most modern markdown viewers

---

## Proposed Architecture

**Note:** Mermaid diagrams below require a viewer that supports Mermaid (GitHub, VS Code with Mermaid extension, or [mermaid.live](https://mermaid.live)). See ASCII diagrams below for text-only view.

### Visual Diagram (Mermaid)

```mermaid
flowchart TB
    subgraph api [API Layer]
        Index[index.ts]
        Routes[Route Handler]
        RateLimit[Rate Limiter]
    end

    subgraph io [I/O]
        Request[HTTP Request]
        Response[HTTP Response]
    end

    subgraph core [Core Logic]
        Config[Config: entityTypes, actionTypes, batchSize, rateLimit]
        ActionRegistry[Action Registry]
        Validator[Payload Validator]
        BulkActionService[Bulk Action Service]
        BulkUpdateHandler[Bulk Update Handler]
    end

    subgraph queue [Queue Layer]
        BullMQ[BullMQ]
        Worker[Worker]
    end

    subgraph data [Data Layer]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
    end

    Request --> Index
    Index --> Routes
    Routes --> RateLimit
    RateLimit --> BulkActionService
    Config --> ActionRegistry
    Config --> Validator
    Config --> BulkUpdateHandler
    BulkActionService --> ActionRegistry
    BulkActionService --> Validator
    ActionRegistry --> BulkUpdateHandler
    BulkActionService --> BullMQ
    BullMQ --> Worker
    Worker --> BulkUpdateHandler
    BulkActionService --> PostgreSQL
    Worker --> PostgreSQL
    RateLimit --> Redis
    BullMQ --> Redis
    BulkActionService --> Response
```

### Text Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Request → index.ts → Route Handler → Rate Limiter        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Logic                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Config: entityTypes, actionTypes, batchSize, rateLimit    │  │
│  └──────┬──────────────┬──────────────┬─────────────────────┘  │
│         │              │              │                         │
│         ▼              ▼              ▼                         │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐     │
│  │   Action    │ │  Payload    │ │   Bulk Update        │     │
│  │  Registry   │ │  Validator  │ │   Handler            │     │
│  └─────────────┘ └─────────────┘ └──────────────────────┘     │
│         ▲              ▲              ▲                         │
│         └──────────────┴──────────────┘                         │
│                    │                                             │
│                    ▼                                             │
│         ┌──────────────────────┐                                 │
│         │ Bulk Action Service  │                                 │
│         └──────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────┐
│      Queue Layer         │  │     Data Layer       │
├──────────────────────────┤  ├──────────────────────┤
│ BullMQ ──────► Worker    │  │ PostgreSQL           │
│                          │  │ Redis                │
└──────────────────────────┘  └──────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌──────────────────┐
                    │  HTTP Response   │
                    └──────────────────┘
```

---

## System Architecture (Component Diagram)

```mermaid
flowchart TB
    subgraph api [API Layer]
        Express[Express.js REST API]
        RateLimit[Rate Limiter Middleware]
    end

    subgraph core [Core Services]
        BulkActionService[Bulk Action Service]
        ActionRegistry[Action Registry]
        BulkUpdateHandler[Bulk Update Handler]
    end

    subgraph queue [Queue Layer]
        BullMQ[BullMQ + Redis]
        Worker[Bulk Action Worker]
    end

    subgraph data [Data Layer]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
    end

    Express --> RateLimit
    RateLimit --> BulkActionService
    BulkActionService --> ActionRegistry
    ActionRegistry --> BulkUpdateHandler
    BulkActionService --> BullMQ
    BullMQ --> Worker
    Worker --> BulkUpdateHandler
    BulkActionService --> PostgreSQL
    Worker --> PostgreSQL
    RateLimit --> Redis
    BullMQ --> Redis
```

---

## Request Flow

### Text Flow (Step-by-Step)

```
┌─────────┐
│ Client  │
└────┬────┘
     │ POST /bulk-actions
     ▼
┌─────────┐
│   API   │ (index.ts → Routes)
└────┬────┘
     │
     ▼
┌─────────────┐
│ Rate Limiter│ Check accountId (10k entities/min)
└────┬────────┘
     │
     ├─ Rate Exceeded? ──► 429 Response
     │
     └─ OK ──►
              ▼
         ┌──────────────┐
         │   Service    │ createBulkAction()
         └──────┬───────┘
                 │
                 ├─► Insert BulkAction (PostgreSQL)
                 │
                 └─► Enqueue Job (BullMQ + Redis)
                     │
                     └─► 201 Created { id } ──► Client

┌─────────────────────────────────────────────┐
│         Async Processing (Worker)            │
├─────────────────────────────────────────────┤
│                                              │
│  BullMQ ──► Worker receives job             │
│              │                                │
│              ├─► Deduplicate by email        │
│              │                                │
│              ├─► Log skipped (duplicate_email)│
│              │                                │
│              └─► Process in batches (100)     │
│                  │                            │
│                  ├─► Execute handler          │
│                  ├─► Update entities          │
│                  └─► Log to BulkActionLog     │
│                                              │
│  Update BulkAction status = completed        │
└─────────────────────────────────────────────┘
```

### Visual Diagram (Mermaid)
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant RateLimit
    participant Service
    participant Queue
    participant Worker
    participant DB

    Client->>API: POST /bulk-actions
    API->>RateLimit: Check accountId
    RateLimit->>RateLimit: Validate entity count vs 10k/min
    alt Rate exceeded
        RateLimit-->>Client: 429 Too Many Requests
    else OK
        RateLimit->>Service: createBulkAction()
        Service->>DB: Insert BulkAction
        Service->>Queue: Add job (with delay if scheduled)
        Service-->>Client: 201 Created { id }
    end

    Note over Queue,Worker: Async processing
    Queue->>Worker: Job ready
    Worker->>DB: Deduplicate by email
    Worker->>DB: Log skipped (duplicate_email)
    loop Batch processing
        Worker->>Worker: Execute handler (batch)
        Worker->>DB: Update entities + BulkActionLog
    end
    Worker->>DB: Update BulkAction status=completed
```

---

## Data Model

### Text Diagram (Entity Relationships)

```
┌─────────────────────────────────┐
│         BulkAction              │
├─────────────────────────────────┤
│ id (PK)                         │
│ accountId                        │
│ entityType                       │
│ actionType                       │
│ status (queued/processing/       │
│          completed/failed)       │
│ totalCount                       │
│ scheduledAt                      │
│ completedAt                      │
└──────────┬──────────────────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────────────────┐
│      BulkActionLog               │
├─────────────────────────────────┤
│ id (PK)                         │
│ bulkActionId (FK) ───────────┐   │
│ entityId                     │   │
│ status (success/failure/     │   │
│          skipped)            │   │
│ errorMessage                  │   │
│ skipReason                    │   │
│ processedAt                   │   │
└──────────────────────────────┘   │
                                    │
┌─────────────────────────────────┐ │
│         Contact                 │ │
├─────────────────────────────────┤ │
│ id (PK)                         │ │
│ name                            │ │
│ email                           │ │
│ age                             │ │
│ status                          │ │
│ accountId                       │ │
└─────────────────────────────────┘ │
                                    │
BulkAction updates Contact entities │
(via entityId references)           │
```

### Visual Diagram (Mermaid)
```mermaid
erDiagram
    BulkAction ||--o{ BulkActionLog : has
    BulkAction {
        string id PK
        string accountId
        string entityType
        string actionType
        enum status
        int totalCount
        datetime scheduledAt
        datetime completedAt
    }
    BulkActionLog {
        string id PK
        string bulkActionId FK
        string entityId
        enum status
        string errorMessage
        string skipReason
        datetime processedAt
    }
    Contact {
        string id PK
        string name
        string email
        int age
        string status
        string accountId
    }
    BulkAction }o--|| Contact : "updates"
```

---

## API Endpoints (Flowchart)

```mermaid
flowchart LR
    subgraph endpoints [API Endpoints]
        A[GET /bulk-actions]
        B[POST /bulk-actions]
        C[GET /bulk-actions/:id]
        D[GET /bulk-actions/:id/stats]
        E[GET /bulk-actions/:id/logs]
    end

    A --> ListActions[List + Filter]
    B --> CreateAction[Create + Enqueue]
    C --> ActionDetails[Details + Progress]
    D --> Stats[Success, Failure, Skipped]
    E --> Logs[Logs + Filter]
```

---

## Worker Processing Flow

```mermaid
flowchart TD
    Start([Job Received]) --> Dedup[Deduplicate by Email]
    Dedup --> LogSkipped[Log Skipped Entities]
    LogSkipped --> Batch{More Entities?}
    Batch -->|Yes| ProcessBatch[Process Batch]
    ProcessBatch --> LogResults[Log Success/Failure]
    LogResults --> Batch
    Batch -->|No| UpdateStatus[Update BulkAction status]
    UpdateStatus --> End([Complete])
```

---

## Data Flow

1. **Create**: Client POSTs to `/bulk-actions` with entityIds, payload, and optional scheduledAt
2. **Validate**: Handler validates payload; rate limit checked per accountId
3. **Enqueue**: BulkAction record created; job added to BullMQ (with delay if scheduled)
4. **Process**: Worker picks up job, deduplicates by email, processes in batches
5. **Log**: Each entity result (success/failure/skipped) written to BulkActionLog
6. **Complete**: BulkAction status updated to completed/failed

## Extensibility

### Adding a New Entity (e.g., Company)

1. Add Prisma model for Company
2. Create `src/actions/bulk-update-company/handler.ts` implementing `IBulkActionHandler`
3. Register handler in `src/actions/index.ts`
4. No changes to queue, API routes, or BulkAction table

### Adding a New Action Type (e.g., bulk-delete)

1. Create `src/actions/bulk-delete/handler.ts`
2. Implement `IBulkActionHandler` with `validate()` and `execute()`
3. Register handler
4. API accepts `actionType: "bulk-delete"` automatically

## Scalability

- **Horizontal scaling**: Run multiple worker processes; BullMQ distributes jobs
- **Batch processing**: Configurable batch size (default 100) reduces DB round-trips
- **Indexes**: `(accountId, entityType)`, `(bulkActionId, status)` for fast queries
- **Rate limiting**: Redis sliding window prevents account overload

## Optional Enhancements Implemented

| Feature | Implementation |
|---------|----------------|
| Rate limiting | Redis counter, 10k entities/min per accountId |
| De-duplication | Group by email before processing; first kept, rest skipped |
| Scheduling | BullMQ `job.opts.delay` from scheduledAt |

## Loom Video Outline

1. Architecture overview (this diagram)
2. Demo: Create bulk action via Postman
3. Show worker processing, logs, stats
4. Extensibility: How to add new action/entity
