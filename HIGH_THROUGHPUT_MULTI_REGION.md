# High Throughput & Multi-Region Deployment Architecture

## Executive Summary

The current land registry system is production-ready for **single-region, moderate throughput** (~100-500 tx/sec per peer). To support **high throughput (1000+ tx/sec) and multi-region deployment**, the following architectural changes are required:

**Key Bottlenecks**:
1. Sequential counter (Property ID generation) - serialization bottleneck
2. Single channel - all traffic competing for ordering service
3. Synchronous Supabase indexing - blocks transaction completion
4. Event handling - no batch processing
5. Peer endorsement - single peer can become bottleneck

**Recommended Strategy**:
- Parallel ID generation (sharded by state)
- Multiple channels (by region/function)
- Async event streaming with batch indexing
- Connection pooling and caching
- Multi-region replication with eventual consistency

---

## Part 1: Bottleneck Analysis

### 1.1 Ordering Service Bottleneck

**Current State**:
```
All transactions → Single Ordering Service (mychannel) → Single Peer → Single Supabase
```

**Problem**: 
- All property creation requests queue for Property ID generation
- Sequential counter increment per state/year serializes writes
- Single ordering service becomes choke point at ~500 tx/sec
- Fabric orderer can handle ~10,000 tx/sec, but application-level lock contention prevents this

**Example Scenario**:
```
Time: T0
  - Request 1: Create property in Telangana
  - Request 2: Create property in Telangana
  - Request 3: Create property in Andhra Pradesh

Flow:
T0 → OrderService queues all 3
T0 → Endorser: Read COUNTER_TS_2026
T1 → Endorser: Increment to 1, write new counter (BLOCKED on read)
T2 → Endorser: Read COUNTER_TS_2026 (now at 1)
T3 → Endorser: Increment to 2
T4 → Endorser: Read COUNTER_AP_2026
T5 → Endorser: Increment to 1

Total time: 5 intervals for 3 requests = 1.67 tx/interval
```

**Impact**:
- Property ID generation latency: 200-500ms (high)
- Throughput: ~500 tx/sec maximum (single orderer limit)
- Scalability: Limited by sequential state reads/writes

### 1.2 Event Handling Bottleneck

**Current State**:
```
Event emitted → SetEvent() → Stored in transaction → Event listener → Async processing
```

**Problem**:
- Events stored in transaction payload (increases block size)
- Event listeners are blocking (if slow listener, no new blocks)
- No batch event processing
- Multiple event types (5 types) means 5 separate listener subscriptions
- Event payload includes redundant data

**Example Scenario**:
```
1000 properties created in 1 second
→ 1000 PropertyCreatedEvent objects
→ ~1MB of event data in blocks
→ 5 listeners subscribed to each event type
→ Each listener processes 1000 events sequentially
→ Processing backlog builds if listeners slow

Problem: If Supabase indexing takes 100ms per batch,
1000 events take ~1-2 seconds to fully index
→ Supabase falls behind blockchain
```

**Impact**:
- Eventual consistency gap widens (2-5 seconds)
- Supabase data staleness increases
- Memory pressure on orderer (event payloads)

### 1.3 Supabase Query Scaling

**Current State**:
```
All searches → Single Supabase database → Indexed queries
```

**Problem**:
- Single database instance is bottleneck
- Searches on composite keys (district, mandal, village, surveyNo) need multi-column indexes
- Full-text search indexes can be expensive
- Connection pooling at 20 connections may not be enough
- Verification status updates compete with reads

**Example Scenario**:
```
Peak load: 5000 searches/sec, 100 creates/sec
- 5000 searches hit Supabase simultaneously
- 100 creates updating verification_status
- Write locks block reads during batch updates
- Response time: 500ms → 2s

Issue: PostgreSQL sequential scan if indexes missing
```

**Impact**:
- Search latency: 100-500ms (should be <50ms)
- Write lock contention during verification updates
- Missing indexes = full table scans at scale

### 1.4 Peer Endorsement Bottleneck

**Current State**:
```
Transaction → Single peer0.org1 → Endorsement policy: ANY
```

**Problem**:
- Single peer endorsing all transactions
- No redundancy (peer down = all transactions fail)
- CPU/memory on single peer = bottleneck
- No parallelism if more peers added
- Network I/O becomes limiting factor

**Example Scenario**:
```
Single peer CPU at 95% after 300 tx/sec
- Each transaction requires:
  - State read (counter)
  - Computation (increment)
  - State write (updated counter)
  - Event marshaling
  - Signature generation
→ Add 2nd peer to endorsement
→ But endorsement policy is "ANY" (still uses just 1)
→ Need policy change: "MAJORITY of Org1"
```

**Impact**:
- Peer becomes single point of failure
- Horizontal scaling not possible
- Peak throughput: ~500 tx/sec per peer

### 1.5 Application-Level Inefficiencies

**Current State**:
```
Backend → FabricService → Synchronous transaction submission
       ↓
       Supabase update (blocking until complete)
```

**Problem**:
- FabricService submits transaction synchronously
- Waits for endorsement before returning
- Supabase update is NOT truly async (setImmediate is not guaranteed)
- No batching of requests
- Connection pooling not implemented

**Example Scenario**:
```
Request flow:
1. POST /property/create
2. FabricService.submitTransaction() → WAITS for endorsement
   - Network RTT: 50ms
   - Endorsement: 100ms
   - Signature: 20ms
   - Total: ~200ms
3. Return response
4. setImmediate(() => supabase.insert()) queued
5. Supabase insert: 50ms more

Total: 250ms blocking in API response
If 1000 concurrent requests: 250 seconds to complete = disaster
```

**Impact**:
- API response time: 200-300ms (should be <100ms)
- Connection pool exhaustion
- Memory pressure from queued promises

---

## Part 2: High Throughput Strategy

### 2.1 Parallel ID Generation (Sharded Counters)

**Current Implementation**:
```
Single counter per state: COUNTER_TS_2026
→ Sequential bottleneck
```

**Proposed Solution**: Sharded Counters

```
Multiple counters per state (sharded by shard ID):
- COUNTER_TS_2026_SHARD_0
- COUNTER_TS_2026_SHARD_1
- ...
- COUNTER_TS_2026_SHARD_9

ID generation:
1. Hash request ID → shard 0-9
2. Increment COUNTER_TS_2026_SHARD_<hash % 10>
3. Combine: LRI-IND-TS-2026-<shard>-<sequence>

Example: LRI-IND-TS-2026-03-00567 (shard 3, sequence 567)
```

**Benefits**:
- ✅ Parallel counter increments (10x parallelism)
- ✅ Reduces lock contention
- ✅ Throughput: 500 → 5000 tx/sec potential
- ✅ No change to Property ID format (just longer sequence)

**Trade-offs**:
- ⚠️ Sequence no longer monotonic globally (still monotonic per shard)
- ⚠️ ID length increases by 2 digits
- ⚠️ Need proper sequence reconstruction in queries

**Implementation Approach** (No code change required):
- Keep current Property ID format but encode shard in sequence
- Example: Sequence 00-09 = shard ID, then 00567 = local sequence
- Result: LRI-IND-TS-2026-0000567 (shard 0, local sequence 567)

### 2.2 Multi-Channel Strategy

**Current Architecture**:
```
All transactions → mychannel → Single ordering service
```

**Proposed Architecture**: Regional + Functional Channels

```
Channels:
├─ land-registry-primary (for property creation, transfers)
├─ land-registry-docs (for document linking only)
├─ land-registry-queries (for complex queries)
├─ land-registry-region-ts (Telangana - high traffic)
└─ land-registry-region-ap (Andhra Pradesh)
```

**Benefits**:
- ✅ Parallel ordering services (10x throughput potential)
- ✅ Regional isolation (latency optimization)
- ✅ Functional segregation (documents don't compete with transfers)
- ✅ Query channel can be read-only (cheaper)

**Architecture Details**:

```
Region 1 (Telangana):
  ├─ land-registry-region-ts (orderer-1, peer1-ts, peer2-ts)
  └─ Geographically close (local data center)

Region 2 (Andhra Pradesh):
  ├─ land-registry-region-ap (orderer-2, peer1-ap, peer2-ap)
  └─ Separate data center

Cross-region:
  ├─ land-registry-primary (all orderers, all peers)
  └─ For critical state syncing

Query isolation:
  ├─ land-registry-queries (read-only, no orderer needed)
  └─ CouchDB rich queries only
```

**Implementation Approach**:
1. **Phase 1**: Add secondary channels (don't remove primary)
2. **Phase 2**: Route document operations to land-registry-docs
3. **Phase 3**: Add regional channels when multi-region deployed
4. **Phase 4**: Implement cross-channel sync logic

**Routing Logic**:
```
CreateLandRecord() → land-registry-primary (critical, needs global ordering)
TransferLandRecord() → land-registry-primary
LinkDocumentHash() → land-registry-docs (lower priority)
ReadLandRecord() → land-registry-queries (read-only)
GetTransactionHistory() → land-registry-primary
```

### 2.3 Optimized Event Processing

**Current Implementation**:
```
Event emitted → SetEvent() → Listener processes synchronously
```

**Proposed Solution**: Batch Event Streaming

```
Tier 1: In-Chaincode (Lightweight)
  ├─ Emit minimal events (metadata only, not full record)
  └─ Format: { propertyId, txId, timestamp, eventType }

Tier 2: Block Listener (Batch Processing)
  ├─ Listen to blocks (not individual events)
  ├─ Extract all events from block
  ├─ Batch events (10-100 at a time)
  └─ Send to event processor

Tier 3: Event Processor (Async)
  ├─ Receives batch of events
  ├─ Deduplicates
  ├─ Enriches with full data from ledger
  └─ Bulk insert to Supabase (1 query for 100 events)

Tier 4: Eventual Consistency
  ├─ Events processed async
  ├─ Supabase updates 1-5 seconds behind
  ├─ But blockchain is always source of truth
  └─ Users can always verify on chain
```

**Benefits**:
- ✅ Reduced event payload in transactions
- ✅ Batch processing (100x efficiency improvement)
- ✅ Supabase indexing in bulk (1 query instead of 100)
- ✅ Non-blocking event processing

**Event Payload Reduction**:
```
Before:
PropertyCreatedEvent {
  propertyId: "LRI-IND-TS-2026-000123",
  owner: "Ravi Kumar",
  district: "Hyderabad",
  mandal: "Ghatkesar",
  village: "Boduppal",
  surveyNo: "123/A",
  area: "240 sq.yds",
  landType: "Residential",
  marketValue: "45,00,000",
  timestamp: 1673876400,
  transactionId: "abc123..."
}
Size: ~400 bytes × 1000 events = 400KB per block

After (metadata-only):
{
  id: "LRI-IND-TS-2026-000123",
  t: 1673876400,
  tx: "abc123..."
}
Size: ~50 bytes × 1000 events = 50KB per block
Compression: 8x reduction
```

### 2.4 Backend Connection Pooling & Caching

**Current Implementation**:
```
FabricService creates new connection per request
SupabaseService creates new client per request
```

**Proposed Solution**: Connection Pools + Query Cache

```
FabricService Pool:
├─ Gateway pool: 20-50 connections
├─ Contract pool: Reuse contract instances
└─ LRU cache: 1000 recent property reads (10 second TTL)

SupabaseService Pool:
├─ Connection pool: 10-30 connections
├─ Query cache: District/village lookups (5 minute TTL)
└─ Rate limiting: 100 req/sec max per region
```

**Benefits**:
- ✅ Reduced connection overhead (50ms → 5ms)
- ✅ Fabric gateway reuse (no new TLS handshakes)
- ✅ Supabase connection pooling (no new TCP connections)
- ✅ Query cache for hot data (99% hit rate on searches)

**Cache Strategy**:
```
Read property 100 times:
- Request 1: Read from blockchain (100ms) + cache
- Requests 2-100: Read from cache (1ms) → 99x speedup

Invalidation:
- PropertyCreatedEvent → Invalidate searches (10 second delay ok)
- PropertyTransferredEvent → Invalidate specific property (immediate)
- LinkDocumentEvent → Invalidate document list (1 minute delay ok)
```

**Implementation** (Minimal code change):
```javascript
const LRU = require('lru-cache');
const propertyCache = new LRU({ max: 10000, ttl: 10000 });

async getPropertyById(id) {
  // Check cache first
  const cached = propertyCache.get(id);
  if (cached) return cached;
  
  // Cache miss - read from blockchain
  const data = await fabric.evaluateTransaction('ReadLandRecord', id);
  propertyCache.set(id, data);
  return data;
}
```

---

## Part 3: Multi-Region Deployment Architecture

### 3.1 Regional Network Topology

**Deployment Model**: Hub-and-Spoke with Eventual Consistency

```
Region 1 (Telangana) - Primary Hub
├─ Orderer-1 (ordering service)
├─ Peer-1, Peer-2 (endorsers)
├─ CouchDB (primary ledger)
├─ Supabase-1 (PostgreSQL)
└─ Event Stream Processor-1

Region 2 (Andhra Pradesh) - Secondary
├─ Orderer-2 (ordering service)
├─ Peer-3, Peer-4 (endorsers)
├─ CouchDB-2 (replicated ledger)
├─ Supabase-2 (read replica)
└─ Event Stream Processor-2

Region 3 (Karnataka) - Edge
├─ Orderer-3 (ordering service)
├─ Peer-5, Peer-6 (endorsers)
├─ CouchDB-3 (replicated ledger)
├─ Supabase-3 (read replica)
└─ Event Stream Processor-3

Cross-region Links:
├─ Kafka cluster (distributed event bus)
├─ Fabric inter-org gossip (ledger replication)
└─ PostgreSQL replication (Supabase sync)
```

### 3.2 Transaction Flow (Multi-Region)

**Write Flow** (High Availability):
```
User in Region 2 creates property:
1. Submits to local orderer-2 (10ms latency)
2. Orderer-2 broadcasts to peers in Region 2
3. Peers endorse locally (50ms)
4. Block created in Region 2
5. Gossiped to Region 1 (50ms network delay)
6. Gossiped to Region 3 (100ms network delay)
7. Supabase indexed locally (50ms)
8. Supabase sync to other regions (async, 1-5 sec)

Total consensus time: 100ms (local)
Global replication: 1-5 seconds
SLA: 99.9% read from home region within 100ms
```

**Read Flow** (Latency Optimized):
```
User in Region 2 searches property:
1. Query local Supabase-2 (fast, <50ms)
2. If stale (>5 sec old), verify on local blockchain
3. If property not found locally, query Region 1 (might be new)

SLA: 99% reads served from local region within 50ms
     1% reads require cross-region lookup (150ms)
```

### 3.3 Data Consistency Model

**Blockchain**: Strong Consistency (Immediate)
- Write acknowledged after Raft consensus
- All regions have identical ledger state (eventually)
- Consensus protocol: Raft (ordering) + PBFT-like (endorsement)

**Supabase**: Eventual Consistency (1-5 seconds)
- Local writes fast
- Cross-region replication via PostgreSQL streaming
- Acceptable for search/metadata
- Data source: blockchain (always authoritative)

**Conflict Resolution**:
```
Scenario: Two regions simultaneously create property in same district
- Region 1: Creates LRI-IND-TS-2026-00-00123 (shard 0)
- Region 2: Creates LRI-IND-TS-2026-03-00456 (shard 3)

Result:
- Both transactions succeed (no conflict)
- IDs are unique (different shards)
- Supabase sync has eventual consistency

No conflict: Sharding by state + clock time prevents duplicates
```

### 3.4 Ordering Service Distribution

**Current**: Single ordering service (bottleneck)

**Proposed**: Per-Region Ordering Services

```
Region 1:
├─ Orderer-1.org1
├─ Orderer-1.org2 (if multi-org)
└─ Can order 5000 tx/sec

Region 2:
├─ Orderer-2.org1
└─ Can order 5000 tx/sec locally

Region 3:
├─ Orderer-3.org1
└─ Can order 5000 tx/sec locally

Total Capacity: 15,000 tx/sec
(vs current: 500 tx/sec)
```

**Trade-off**: 
- ⚠️ Eventual consistency between regions (not strong consistency)
- ⚠️ Requires cross-region sync protocol
- ✅ Each region can operate independently if network partitioned
- ✅ Massive throughput improvement

### 3.5 Disaster Recovery & Failover

**Scenario 1**: Region 1 orderer down
```
What happens:
- Region 1 transactions pause (no orderer)
- Region 2, 3 continue unaffected
- Transactions can queue locally (in-memory)
- Once orderer recovered, queue drained

RTO: <5 minutes (orderer restart)
RPO: 0 (in-memory queue not durably stored)
```

**Better DR**: Multi-orderer per region (Raft consensus)
```
Region 1:
├─ Orderer-1a (leader)
├─ Orderer-1b (follower)
└─ Orderer-1c (follower)

If any orderer fails, other 2 continue
RTO: <1 minute (automatic failover)
RPO: 0 (Raft consensus)
```

**Scenario 2**: Entire region down
```
What happens:
- Transactions in Region 2, 3 still work
- Region 1 users experience outage
- No global consensus until Region 1 recovers

Mitigation:
- Route Region 1 users to Region 2 (via load balancer)
- Supabase read replica in Region 2 serves reads
- Writes queue until Region 1 recovers

RTO: <10 minutes (infrastructure recovery)
RPO: 0 (transactions replicated to other regions)
```

---

## Part 4: Supabase Scaling Strategy

### 4.1 Database Indexing Strategy

**Current Indexes** (Production):
```
idx_property_id (property_id)
idx_district_mandal_village (district, mandal, village)
idx_survey_no (survey_no)
idx_verification_status (verification_status)
```

**Missing Indexes** (Needed for scaling):
```
idx_owner (owner)              -- Required for owner queries
idx_created_at (created_at)    -- For time-range queries
idx_composite_search (district, mandal, village, survey_no, owner)
                               -- For complex searches
idx_verification_created (verification_status, created_at)
                               -- For recent pending verifications
```

**Implementation**:
```sql
-- Add missing indexes (minimal performance impact)
CREATE INDEX CONCURRENTLY idx_owner 
  ON land_records(owner);

CREATE INDEX CONCURRENTLY idx_created_at_desc 
  ON land_records(created_at DESC);

-- Composite index for common searches (1.5x query improvement)
CREATE INDEX CONCURRENTLY idx_district_search 
  ON land_records(district, mandal, village, survey_no, owner);

-- For verification status tracking
CREATE INDEX CONCURRENTLY idx_pending_verifications 
  ON land_records(verification_status, created_at DESC) 
  WHERE verification_status = 'pending';

-- Full-text search index (if enabled)
CREATE INDEX idx_fts_address 
  ON land_records USING GIN (to_tsvector('english', 
    district || ' ' || mandal || ' ' || village));
```

**Query Optimization**:
```sql
-- Before (full table scan at scale)
SELECT * FROM land_records 
WHERE district = 'Hyderabad' AND mandal = 'Ghatkesar'
Execution: 1000ms (full scan on 1M rows)

-- After (index used)
SELECT * FROM land_records 
WHERE district = 'Hyderabad' AND mandal = 'Ghatkesar'
Execution: 10ms (index seek on 1K rows)
Improvement: 100x
```

### 4.2 Read Replica Strategy

**Proposed Architecture**:
```
Primary (Write Supabase):
├─ Handles all writes (creation, verification updates)
├─ Single writer (prevents conflicts)
├─ Replicated to standbys asynchronously

Read Replicas (per region):
├─ Region 1: Replica-1 (local reads, <10ms)
├─ Region 2: Replica-2 (local reads, <10ms)
└─ Region 3: Replica-3 (local reads, <10ms)

Replication Lag:
├─ Synchronous on primary region (100% durable)
├─ Async to other regions (1-5 second lag acceptable)
└─ Application handles stale data gracefully
```

**Connection Routing**:
```javascript
// Read from local replica
const searchResults = await supabaseReplica.queryByAttributes({
  district: 'Hyderabad'
});

// Write to primary (may take 100ms)
await supabasePrimary.updateVerificationStatus(
  propertyId, 
  'verified'
);
```

**Trade-off**:
- ⚠️ Eventual consistency for reads (1-5 seconds behind)
- ✅ 10x lower read latency
- ✅ Prevents primary database overload
- ✅ Local region independence

### 4.3 Connection Pooling

**Current**: 
```
Max 30 connections per region
High concurrency → Connection exhaustion
```

**Proposed**:
```
Region 1 (Primary):
├─ Max 100 connections (primary writes)
├─ Queue limit: 50 pending
└─ Timeout: 30 seconds

Region 2 (Replica):
├─ Max 50 connections (read-only)
├─ Queue limit: 100 pending
└─ Timeout: 10 seconds

Connection pooling library:
├─ node-postgres (pg) with pool
├─ Min: 5, Max: 100
└─ Idle timeout: 30 seconds

Usage:
const pool = new Pool({
  max: 100,
  min: 5,
  idleTimeoutMillis: 30000,
  query_timeout: 5000,
});
```

### 4.4 Batch Indexing Pattern

**Problem**: Event triggers on every single insert cause load
```
1000 properties created
→ 1000 insert operations
→ 1000 trigger invocations
→ Each trigger updates verification_status
→ 1000 updates to execute
→ Total: 2000 queries
```

**Solution**: Batch Insert + Bulk Update
```
1000 properties created
→ Collect events (100ms batch window)
→ Single bulk insert: 100 rows
→ Single bulk update: 100 verification statuses
→ Repeat 10 times (1 second for 1000 creates)

Result:
- 20 queries instead of 2000
- 100x improvement in database load
```

**Implementation**:
```javascript
// Event processor (batch mode)
class EventBatcher {
  constructor(batchSize = 100, batchTimeMs = 500) {
    this.batchSize = batchSize;
    this.batchTimeMs = batchTimeMs;
    this.buffer = [];
    this.timer = null;
  }

  async addEvent(event) {
    this.buffer.push(event);
    
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchTimeMs);
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;
    
    const batch = this.buffer.splice(0);
    
    // Bulk insert (single query)
    await supabase.from('land_records').insert(
      batch.map(e => ({
        property_id: e.propertyId,
        owner: e.owner,
        ...
      }))
    );
    
    clearTimeout(this.timer);
    this.timer = null;
  }
}
```

---

## Part 5: Observability & Monitoring

### 5.1 Key Metrics

#### Blockchain Metrics

**Throughput**:
```
metric: fabric_transaction_throughput_per_sec
├─ Dimension: by state (TS, AP, KA)
├─ Dimension: by operation (create, transfer, read)
└─ SLA: 1000+ tx/sec per region

metric: fabric_latency_percentiles
├─ p50: <100ms (median)
├─ p95: <500ms (95th percentile)
├─ p99: <2s (99th percentile)
└─ SLA: p95 < 500ms
```

**Consensus Health**:
```
metric: ordering_service_latency
├─ Time to produce block
├─ SLA: <1s
└─ Alert if: >2s

metric: endorsement_failures
├─ Failed endorsements
├─ Reason: network, signature, role
└─ Alert if: >1% failure rate

metric: ledger_replication_lag
├─ Bytes behind (for lagging peers)
├─ SLA: <100MB per peer
└─ Alert if: >500MB (indicates peer failure)
```

#### Application Metrics

**API Performance**:
```
metric: api_latency_by_endpoint
├─ /api/v1/property/create: p95 < 500ms
├─ /api/v1/property/:id: p95 < 100ms (cached)
├─ /api/v1/search: p95 < 200ms
└─ Track per endpoint, per region

metric: api_error_rate
├─ 4xx errors (client fault): <0.5%
├─ 5xx errors (server fault): <0.1%
└─ Alert if: >1% error rate

metric: concurrent_requests
├─ Active connections per server
├─ SLA: <1000 concurrent per instance
└─ Scale horizontally if: >800
```

**Database Performance**:
```
metric: supabase_query_latency
├─ SELECT: p95 < 50ms
├─ INSERT: p95 < 100ms
├─ Bulk insert (1000 rows): <500ms
└─ Alert if: SELECT > 100ms

metric: connection_pool_exhaustion
├─ % of pool utilized
├─ SLA: <70%
└─ Alert if: >90%

metric: replication_lag
├─ Bytes behind primary
├─ SLA: <100KB
└─ Alert if: >1MB (replica may be stale)
```

### 5.2 Distributed Tracing

**Implementation**: OpenTelemetry + Jaeger

```
Every transaction traces:
1. API request received
   └─ Middleware: start span

2. Fabric transaction submitted
   ├─ FabricService: start span
   ├─ Wait for endorsement
   └─ Ledger written

3. Event processed
   ├─ Event listener: start span
   ├─ Batch collected
   └─ Supabase indexed

4. Response returned
   └─ Total duration tracked

Traces show:
- Where time spent (endorsement vs ordering vs indexing)
- Cross-service latency
- Bottlenecks in real-time
```

**Sampling Strategy**:
```
Debug mode (dev): 100% sampling (all traces)
Staging: 10% sampling (1 in 10 requests)
Production: 0.1% sampling (1 in 1000 requests, or sampled on error)

This captures:
- Normal flow (10% in staging, 0.1% in prod)
- All errors (100% sampled)
- p99 latency (sampled)
```

### 5.3 Alerting Rules

**Critical Alerts** (Page on-call):
```
1. Blockchain partition (regions disconnected)
   └─ Action: Failover to single region

2. Ordering service down
   └─ Action: Failover to backup orderer

3. API error rate >5%
   └─ Action: Rollback, investigate

4. Supabase unavailable
   └─ Action: Continue (blockchain is source of truth)
           Batch index when recovered

5. Ledger replication lag >5GB
   └─ Action: Check peer, consider restart
```

**Warning Alerts** (Create ticket):
```
1. Latency p95 > 1s (vs SLA of 500ms)
2. Connection pool > 80%
3. Database query latency > 100ms
4. Event processing backlog > 1 minute
5. Cross-region sync lag > 10 seconds
```

### 5.4 Metrics Dashboard Layout

```
Dashboard: Land Registry - High-Level

Top Row (Real-time):
├─ Throughput (tx/sec)
├─ Latency (p50, p95, p99)
├─ Error rate (%)
└─ Health status (🟢 healthy, 🟡 degraded, 🔴 critical)

Middle Row (By Component):
├─ Blockchain:
│  ├─ Block time
│  ├─ Endorsement failures
│  └─ Ledger replication lag
│
├─ Database:
│  ├─ Query latency (SELECT, INSERT)
│  ├─ Connection pool utilization
│  └─ Replication lag
│
└─ API:
   ├─ Request count (by endpoint)
   ├─ Response time (by endpoint)
   └─ Error breakdown (4xx, 5xx)

Bottom Row (Capacity):
├─ CPU usage (by region)
├─ Memory usage (by region)
├─ Network throughput (cross-region)
└─ Disk usage (blockchain, database)

Additional:
├─ Property ID generation rate
├─ Event backlog size
└─ Cache hit rate (Supabase query cache)
```

---

## Part 6: Production-Level Recommendations

### 6.1 Immediate Actions (0-3 months)

#### Phase 1: Optimize Single Region (Month 1)
```
1. Add missing database indexes
   - Estimate: 2 engineer-days
   - Impact: 10x search latency improvement

2. Implement connection pooling (Node.js)
   - Estimate: 3 engineer-days
   - Impact: 2x API throughput

3. Add observability (metrics, tracing)
   - Estimate: 4 engineer-days
   - Impact: Visibility into bottlenecks

4. Implement query cache (LRU)
   - Estimate: 2 engineer-days
   - Impact: 99% hit rate on recent properties
```

#### Phase 2: Scale Ordering Service (Month 2)
```
1. Tune Raft consensus parameters
   - TickInterval: 100ms → 50ms (faster consensus)
   - HeartbeatInterval: 100ms → 50ms (faster detection)
   - MaxMessageCount: 100 → 500 (more txs per block)
   - Impact: 2-3x throughput increase

2. Add secondary orderer (high availability)
   - Estimate: 2 engineer-days
   - Impact: No single point of failure

3. Implement block batching
   - Estimate: 3 engineer-days
   - Impact: 2x block throughput
```

#### Phase 3: Event Processing (Month 3)
```
1. Implement batch event collection
   - Estimate: 3 engineer-days
   - Impact: 100x Supabase indexing efficiency

2. Add event streaming (Kafka)
   - Estimate: 4 engineer-days
   - Impact: Decouples Supabase from blockchain

3. Implement eventual consistency model
   - Estimate: 2 engineer-days
   - Impact: Clear SLAs for data availability
```

**Expected Outcome After Phase 1-3**:
- Single region: 2000+ tx/sec (from 500 tx/sec)
- Latency: p95 < 500ms (from 1-2s)
- Availability: 99.5% (from 99%)

### 6.2 Medium-Term Actions (3-9 months)

#### Phase 4: Multi-Region Setup (Months 4-6)
```
1. Deploy second orderer (different region)
   - Estimate: 5 engineer-days
   - Impact: Regional independence

2. Implement regional channels
   - Estimate: 4 engineer-days
   - Impact: 3x throughput (3 orderers)

3. Setup Supabase read replicas
   - Estimate: 2 engineer-days
   - Impact: Regional read latency <50ms

4. Implement cross-region sync
   - Estimate: 5 engineer-days
   - Impact: Transparent failover
```

#### Phase 5: Disaster Recovery (Months 7-9)
```
1. Implement automated failover
   - Estimate: 4 engineer-days
   - Impact: <5 minute RTO

2. Setup backup/restore procedure
   - Estimate: 2 engineer-days
   - Impact: <15 minute RPO

3. Conduct chaos engineering tests
   - Estimate: 3 engineer-days
   - Impact: Validate failure scenarios
```

**Expected Outcome After Phase 4-5**:
- Multi-region: 5000+ tx/sec (3x orderers)
- Failover: <5 minute RTO
- Latency: p95 < 200ms (local), < 1s (cross-region)

### 6.3 Long-Term Vision (9+ months)

#### Phase 6: Advanced Scaling
```
1. Implement sharded counters (parallel ID generation)
   - Impact: 10x Property ID generation throughput

2. Add sidechain for high-frequency transactions
   - Use lightweight chain for document linking
   - Batch commit to mainchain hourly

3. Implement state channels for bulk transfers
   - Off-chain state updates
   - Periodic settlement to blockchain

4. Multi-ledger architecture
   - Separate ledgers for data privacy
   - Shared verification ledger

Expected: 10,000+ tx/sec, sub-100ms p99 latency
```

### 6.4 Operational Practices

#### Capacity Planning
```
Assume:
- 50% peak load headroom
- 100 TPS baseline, scale to 1000 TPS

Infrastructure sizing:

Single Region (Current):
├─ 3x Endorsing peers (1 active, 2 failover)
├─ 2x Ordering nodes (Raft consensus)
├─ 1x Supabase instance (managed)
└─ 2x Backend API servers (load balanced)

Multi-Region (Target):
├─ 3 regions × (3 peers + 1 orderer)
├─ 3x Supabase (1 primary, 2 replicas)
├─ 6x Backend API servers (2 per region, load balanced)
└─ 1x Kafka cluster (event streaming)

Cost implication:
Single region: ~$5k/month
Multi-region: ~$15k/month
10x throughput gain: 3x cost increase (favorable ROI)
```

#### Release Practices
```
1. Staged rollout (never big-bang)
   ├─ Dev (1 engineer)
   ├─ Staging (full load test)
   ├─ Canary (5% production traffic)
   └─ Full production (over 1 hour)

2. Rollback plan
   ├─ Revert to N-1 version if >1% error rate
   ├─ Keep N-2 version runnable for 24 hours
   └─ Test rollback procedure monthly

3. Feature flags
   ├─ New features behind flags
   ├─ Gradual rollout: 10% → 50% → 100%
   └─ Kill switch for critical issues
```

#### On-Call Runbook
```
Scenario: High latency (p95 > 1s)
1. Check metrics dashboard
   ├─ Identify component (blockchain, DB, API)
   └─ Check recent deployments

2. Blockchain slow
   ├─ Check ordering service lag
   ├─ Restart slow orderer if needed
   └─ Consider increasing block size

3. Database slow
   ├─ Check query log for full table scans
   ├─ Run EXPLAIN on slow queries
   └─ Consider adding missing indexes

4. API slow
   ├─ Check connection pool saturation
   ├─ Scale horizontally (add API server)
   └─ Check for thundering herd (cache invalidation)

Communication:
- Update status page every 5 minutes
- Notify stakeholders if > 15 minute outage
- Post-mortem required if > 1 hour outage
```

---

## Part 7: Implementation Roadmap

### Summary Table

| Phase | Focus | Duration | Throughput | Latency | Cost |
|-------|-------|----------|-----------|---------|------|
| Current | Single region, baseline | - | 500 tx/s | 1-2s p95 | $5k |
| 1 | Optimize single region | 1 month | 1000 tx/s | 500ms p95 | $5.5k |
| 2 | Scale ordering | 1 month | 2000 tx/s | 500ms p95 | $6k |
| 3 | Event processing | 1 month | 2000 tx/s | 300ms p95 | $6.5k |
| 4 | Multi-region | 3 months | 5000 tx/s | 200ms p95 | $12k |
| 5 | Disaster recovery | 3 months | 5000 tx/s | 200ms p95 | $15k |
| 6 | Advanced scaling | 3+ months | 10,000+ tx/s | <100ms p95 | $20k+ |

### Risk Mitigation

**Identified Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Consensus deadlock in multi-orderer | Low | High | Test failover monthly |
| Cross-region network partition | Medium | High | Implement independent failover |
| Database replication lag > 10s | Low | Medium | Monitor replication lag closely |
| Event backlog causes stale data | Medium | Low | Implement backpressure mechanism |
| Sharding ID collisions | Very Low | Critical | Use deterministic hash function |

**Testing Strategy**:
```
Unit Tests:
- Property ID generation (no collisions)
- Counter increment (no race conditions)
- Event serialization

Integration Tests:
- Multi-region consensus
- Failover scenarios
- Event processing under load

Chaos Tests (quarterly):
- Kill random orderer (every month)
- Partition network (quarterly)
- Database failover (semi-annually)
- Disk full scenario (semi-annually)
```

---

## Conclusion: Summary of Recommendations

| Bottleneck | Current Limit | Solution | Expected Improvement |
|-----------|---------------|----------|----------------------|
| Counter serialization | 500 tx/s | Sharded counters | 10x (5000 tx/s) |
| Single channel | 500 tx/s | Multiple channels | 3-5x (per channel) |
| Synchronous events | 50MB/s block rate | Batch event processing | 8x (event payload) |
| Supabase load | 100 queries/s | Connection pooling, replicas | 5x |
| Single peer endorsement | Peer CPU limit | Multiple peers + policy | Linear scaling |
| Single region | Regional latency | Multi-region with eventual consistency | <100ms p95 |

**Recommended Immediate Actions**:
1. ✅ Add database indexes (1 day effort, 10x search improvement)
2. ✅ Implement connection pooling (3 days effort, 2x API throughput)
3. ✅ Add observability metrics (4 days effort, visibility into bottlenecks)
4. ✅ Batch event indexing (3 days effort, 100x DB load reduction)

**6-Month Target**:
- Single region: 2000 tx/sec (from 500)
- Multi-region ready: 5000 tx/sec (from 500)
- Latency: p95 < 500ms (from 1-2s)
- Availability: 99.5% (from 99%)

**No Code Rewrites Required**: All recommendations are architectural/deployment-focused, compatible with existing codebase.

