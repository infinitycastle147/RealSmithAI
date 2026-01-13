# Database Plan for Token Quota System

## Context

- **Platform**: Vercel Serverless Functions (Free Tier)
- **Use Case**: Token quota tracking for ~100 daily active users
- **Data Requirements**: 
  - User quotas (user_id, tokens_used, requests_used, last_reset_date)
  - Usage logs (for analytics)
  - Daily reset functionality

## Vercel Serverless Constraints

⚠️ **Critical Constraint**: Vercel serverless functions are **stateless** and **ephemeral**:
- Each function invocation is isolated
- No shared memory between requests
- Filesystem is **read-only** (cannot write files)
- No persistent local storage
- Functions can be cold-started at any time

## Database Options Evaluation

### Option 1: In-Memory Database ❌ **NOT VIABLE**

**Why it won't work:**
- Data lost between function invocations
- No shared state across concurrent requests
- Cold starts reset all data
- Multiple users would have separate memory spaces

**Conclusion**: In-memory databases are **not suitable** for Vercel serverless.

---

### Option 2: Local SQLite File ❌ **NOT VIABLE**

**Why it won't work:**
- Vercel filesystem is **read-only**
- Cannot create or write to local files
- Each function invocation has no access to previous writes
- File would be lost on every cold start

**Conclusion**: Local SQLite files **will not work** on Vercel serverless.

---

### Option 3: Turso (Cloud SQLite) ✅ **RECOMMENDED**

**What it is:**
- Serverless SQLite database (libSQL)
- Cloud-hosted, accessible via HTTP
- SQLite-compatible API

**Pros:**
- ✅ **Free tier**: 500 databases, 500MB storage, 1B rows read/month
- ✅ **Perfect for small apps**: Designed for your use case
- ✅ **Serverless-compatible**: Works with Vercel functions
- ✅ **SQL interface**: Familiar SQL queries
- ✅ **No setup complexity**: Just URL + token
- ✅ **Persistent**: Data survives function invocations
- ✅ **Concurrent access**: Handles multiple users

**Cons:**
- ⚠️ Requires external service (but free)
- ⚠️ Network latency (minimal, ~10-50ms)

**Free Tier Limits:**
- 500 databases per org
- 500MB storage per database
- 1 billion rows read/month
- 10 million rows written/month
- **Perfect for 100 users**

**Setup:**
1. Sign up at turso.tech (free)
2. Create database
3. Get URL + auth token
4. Set environment variables

**Cost**: $0 (free tier sufficient)

---

### Option 4: Vercel KV (Redis) ✅ **ALTERNATIVE**

**What it is:**
- Vercel's managed Redis service
- Key-value store

**Pros:**
- ✅ **Free tier**: 256MB storage, 30K commands/day
- ✅ **Native Vercel integration**: Built-in
- ✅ **Fast**: In-memory performance
- ✅ **Serverless-compatible**: Works with Vercel

**Cons:**
- ⚠️ **Key-value only**: No SQL queries (need to structure data manually)
- ⚠️ **More complex**: Need to design data structure
- ⚠️ **Less familiar**: Not SQL-based

**Free Tier Limits:**
- 256MB storage
- 30,000 commands/day
- **May be tight for 100 users** (300 commands/user/day)

**Setup:**
1. Enable in Vercel dashboard
2. Use `@vercel/kv` package
3. Store data as JSON strings

**Cost**: $0 (free tier)

---

### Option 5: Upstash Redis ✅ **ALTERNATIVE**

**What it is:**
- Serverless Redis (similar to Vercel KV)
- Pay-per-request pricing

**Pros:**
- ✅ **Free tier**: 10K commands/day
- ✅ **Serverless**: Auto-scaling
- ✅ **Fast**: Redis performance

**Cons:**
- ⚠️ **Key-value only**: No SQL
- ⚠️ **Free tier limited**: 10K commands/day (100 commands/user/day)
- ⚠️ **External service**: Another account to manage

**Cost**: $0 (free tier), then pay-per-use

---

### Option 6: JSON File in Git Repository ❌ **NOT RECOMMENDED**

**What it is:**
- Store data in a JSON file committed to git
- Read/write via API

**Why it's problematic:**
- ❌ **No writes**: Vercel filesystem is read-only
- ❌ **Git writes**: Would require git operations (slow, complex)
- ❌ **Concurrency issues**: Multiple users writing simultaneously
- ❌ **Not production-ready**: Hacky solution

**Conclusion**: **Not viable** for production.

---

## Recommendation: **Turso (Cloud SQLite)**

### Why Turso?

1. **Best fit for your constraints:**
   - Free tier covers 100 users easily
   - SQL interface (familiar, maintainable)
   - Serverless-compatible
   - Persistent storage

2. **Simple implementation:**
   - Standard SQL queries
   - No complex data modeling
   - Easy to debug

3. **Future-proof:**
   - Can scale if needed
   - SQLite ecosystem
   - Easy migration path

### Implementation Approach

**Architecture:**
```
Vercel Function → HTTP Request → Turso Database
                (libSQL client)
```

**Data Flow:**
1. Function receives request
2. Creates libSQL client (singleton pattern)
3. Executes SQL query via HTTP
4. Returns result

**Storage:**
- `user_quotas` table: Per-user quota tracking
- `token_usage_log` table: Usage analytics

**Connection:**
- Singleton client pattern (reuse connection)
- Environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

---

## Alternative: Vercel KV (If You Prefer Simplicity)

If you want to avoid external services, **Vercel KV** is viable but requires:
- Restructuring data as key-value pairs
- Manual query logic (no SQL)
- More code complexity

**Example Structure:**
```typescript
// Instead of SQL:
await kv.set(`quota:${userId}`, JSON.stringify({
  tokensUsed: 100,
  requestsUsed: 5,
  lastReset: '2025-01-15'
}));

// Instead of:
SELECT * FROM user_quotas WHERE user_id = ?
```

---

## Decision Matrix

| Option | Free Tier | SQL Support | Serverless | Complexity | Recommendation |
|--------|-----------|-------------|------------|------------|----------------|
| In-Memory | ✅ | ❌ | ❌ | Low | ❌ Not viable |
| Local SQLite | ✅ | ✅ | ❌ | Low | ❌ Not viable |
| **Turso** | ✅ | ✅ | ✅ | **Low** | ✅ **Best choice** |
| Vercel KV | ✅ | ❌ | ✅ | Medium | ⚠️ Alternative |
| Upstash Redis | ✅ | ❌ | ✅ | Medium | ⚠️ Alternative |
| JSON in Git | ✅ | ❌ | ❌ | High | ❌ Not viable |

---

## Recommended Implementation Plan

### Phase 1: Setup Turso
1. Create Turso account (free)
2. Create database
3. Get credentials
4. Set environment variables

### Phase 2: Database Schema
1. Create `user_quotas` table
2. Create `token_usage_log` table
3. Add indexes
4. Initialize via `/api/init-db`

### Phase 3: Integration
1. Install `@libsql/client`
2. Update `lib/db.ts` to use Turso
3. Test quota operations
4. Deploy and verify

### Phase 4: Monitoring
1. Monitor quota usage
2. Check database performance
3. Verify daily resets
4. Track usage logs

---

## Questions to Answer

1. **Do you want SQL or key-value?**
   - SQL (Turso) = More familiar, easier queries
   - Key-value (Vercel KV) = Simpler service, but more code

2. **How important is external dependency?**
   - Turso = External service (but free, reliable)
   - Vercel KV = Native Vercel (but key-value only)

3. **Expected growth?**
   - < 1000 users: Turso free tier sufficient
   - > 1000 users: Both options scale, but Turso has better SQL support

---

## Final Recommendation

**Use Turso (Cloud SQLite)** because:
- ✅ Free tier sufficient for your needs
- ✅ SQL interface (easier to maintain)
- ✅ Serverless-compatible
- ✅ Simple setup
- ✅ Future-proof

**Next Step**: Confirm this approach, then we'll implement with Turso.
