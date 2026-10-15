# QuickNotes System Architecture

## 1. Overview

QuickNotes is a web-based note-taking service that allows registered users to create, view, update, delete, and organize notes. The current frontend prototype uses JSONPlaceholder for practice. This architecture describes the production system that a backend team could build to support 1 million registered users.

The proposed design uses a horizontally scalable application tier, caching, a relational database with a read replica, object-independent note storage, and asynchronous background processing.

## 2. Functional Requirements

The system must allow users to:

1. Register and authenticate securely.
2. Create notes with a required title and optional body.
3. View, search, and paginate through their notes.
4. Update and delete their own notes.
5. Create tags and attach them to notes.
6. Access their notes from a browser using an API.
7. Receive clear success, validation, and error responses.
8. Prevent unauthorized users from accessing private notes.

## 3. Non-Functional Requirements

- **Scalability:** Add application servers and supporting capacity as traffic increases.
- **Availability:** Continue serving requests during individual server failures.
- **Performance:** Keep common note-list and note-detail requests responsive.
- **Security:** Use HTTPS, authentication, authorization, input validation, and secure password hashing.
- **Data integrity:** Use database constraints and transactions to protect relationships between users, notes, and tags.
- **Reliability:** Use retries and monitoring for background jobs and transient failures.
- **Maintainability:** Separate frontend, application logic, data storage, caching, and background processing.
- **Observability:** Collect application logs, metrics, traces, and alerts without exposing sensitive information.

## 4. Workload Estimates for 1 Million Users

### Assumptions

- 1,000,000 registered users.
- 10% of registered users are active daily, giving 100,000 daily active users.
- Each daily active user reads or lists notes 50 times per day.
- Each daily active user creates one note per day.
- Average note storage is 2 KB, including a reasonable allowance for its text and basic metadata.
- Traffic is evenly distributed across 86,400 seconds for the average-rate calculation.
- Peak traffic is estimated at five times the average rate.
- Storage estimates exclude replicas, backups, indexes, logs, and other overhead.

These are planning assumptions, not measured production traffic.

### Daily Active Users

\[
1{,}000{,}000 \times 0.10 = 100{,}000
\]

Estimated daily active users: **100,000**.

### Reads Per Second

Daily reads:

\[
100{,}000 \times 50 = 5{,}000{,}000
\]

Average reads per second:

\[
\frac{5{,}000{,}000}{86{,}400} \approx 57.87
\]

Peak reads per second:

\[
57.87 \times 5 \approx 289.35
\]

Estimated average: **58 reads/second**.

Estimated peak: **290 reads/second**.

### Writes Per Second

Assume each active user creates one note per day.

Daily note creations:

\[
100{,}000 \times 1 = 100{,}000
\]

Average writes per second:

\[
\frac{100{,}000}{86{,}400} \approx 1.16
\]

Peak writes per second:

\[
1.16 \times 5 \approx 5.79
\]

Estimated average: **1.16 note creations/second**.

Estimated peak: **6 note creations/second**.

Updates, deletes, authentication events, and tag changes would add to the actual write load.

### Storage Per Year

Assume each stored note, including its average text and basic metadata, occupies 2 KB.

Daily storage growth:

\[
100{,}000 \times 2\text{ KB} = 200{,}000\text{ KB}
\]

Using decimal units, this is approximately 200 MB per day.

Annual storage growth:

\[
200\text{ MB} \times 365 = 73{,}000\text{ MB}
\]

Estimated annual storage growth: **73 GB per year** before database overhead, replicas, backups, and indexes.

Actual storage will depend on note length, attachments, retention policies, and user activity. If attachments are introduced, their storage should be estimated separately.

## 5. Architecture Diagram

```text
                         +----------------------+
                         |        Client        |
                         | Browser / Web App    |
                         +----------------------+
                            |               |
                       DNS lookup       Static assets
                            |               |
                            v               v
                     +-------------+   +-------------+
                     |     DNS     |   |     CDN     |
                     | Name lookup |   | Cached files|
                     +-------------+   +-------------+
                            |               |
                            v               |
                     +-------------+        |
                     |    Load     |        |
                     |  Balancer   |        |
                     +-------------+        |
                            |               |
                 +----------+----------+    |
                 |          |          |    |
                 v          v          v    |
             +--------+ +--------+ +--------+
             | App 1  | | App 2  | | App 3  |
             +--------+ +--------+ +--------+
                 |          |          |
                 +----------+----------+
                            |
              +-------------+--------------+
              |             |              |
              v             v              v
         +---------+  +-------------+  +-----------+
         |  Cache  |  | Primary DB  |  |  Queue    |
         | Hot data|  | Reads/Writes|  | Background|
         +---------+  +-------------+  | jobs      |
                            |          +-----------+
                            |               |
                       Replication          v
                            |          +-----------+
                            v          |  Worker   |
                      +-------------+  | Async jobs|
                      | Read Replica|  +-----------+
                      | Read queries|
                      +-------------+
```

The CDN serves static frontend assets. DNS resolves the application's domain, and API requests go through the load balancer to the application servers. The cache and read replica support frequent reads, while the queue and worker handle asynchronous work.

## 6. Components and the Problems They Solve

- **Client:** Provides the user interface for creating and managing notes without requiring users to interact directly with the database.
- **DNS:** Resolves the service's domain name to the appropriate network endpoint so clients can locate the application.
- **CDN:** Caches static assets near users to reduce download latency and traffic reaching the application infrastructure.
- **Load balancer:** Distributes API requests across healthy application servers and stops routing requests to unhealthy instances.
- **Application servers:** Execute business logic, authenticate users, validate input, enforce permissions, and communicate with the database.
- **Cache:** Stores frequently accessed note data and query results in memory to reduce repeated database reads and improve response time.
- **Primary database:** Stores authoritative user, note, and tag data and handles database writes.
- **Read replica:** Handles eligible read queries to reduce pressure on the primary database.
- **Queue:** Holds background jobs so tasks can be processed asynchronously instead of delaying user-facing requests.
- **Worker:** Processes queued jobs, such as sending notifications, generating exports, or running other background tasks.

## 7. GET /notes Request Flow

1. The browser resolves the service domain through DNS if the address is not already cached.
2. The browser sends `GET /v1/notes` with its authentication token.
3. The load balancer forwards the request to a healthy application server.
4. The application server validates the token and confirms that the user is authenticated.
5. The application checks the cache for the requested user's notes or the appropriate paginated result.
6. If the cache contains valid data, the application returns it. Otherwise, the application queries the read replica when suitable.
7. If the replica is unavailable or stronger read consistency is required, the application can query the primary database according to its fallback policy.
8. The application returns the notes as JSON, including pagination metadata.
9. The application caches eligible results with a suitable expiration and invalidation policy.

The application must apply user-specific authorization to every query and cache key so one user's notes are never exposed to another user.

## 8. POST /notes Request Flow

1. The browser submits `POST /v1/notes` with a JSON body containing the title and optional body.
2. The load balancer forwards the request to a healthy application server.
3. The application validates the authentication token and confirms the user's identity.
4. The application validates the title, body length, and other request fields.
5. The application inserts the new note into the primary database using a parameterized query or equivalent safe database operation.
6. The database generates the note ID and records the timestamps.
7. The application invalidates or updates relevant cached note lists so subsequent reads do not continue returning stale data.
8. If a background task is required, the application records or queues the job using a reliable mechanism, such as a transactional outbox, where appropriate.
9. The application returns `201 Created` with the new note's representation.

Writes go to the primary database. Read replicas receive changes through replication and may briefly lag behind the primary.

## 9. Trade-Offs

### Trade-Off 1: Caching vs. Data Freshness

Caching reduces database load and improves response times. However, cached notes may be stale after a create, update, or delete operation. QuickNotes should use expiration policies and invalidate affected cache entries after successful writes.

### Trade-Off 2: Read Replicas vs. Consistency

Read replicas increase read capacity, but replication lag can cause a recent update to be temporarily missing from a read. The application can read from the primary when a user needs to see a change immediately.

### Trade-Off 3: More Application Servers vs. Operational Cost

Multiple application servers improve capacity and availability, but increase infrastructure and monitoring costs. Autoscaling and sensible resource limits can help match capacity to demand.

### Trade-Off 4: Asynchronous Processing vs. Immediate Completion

Queues and workers prevent nonessential background tasks from delaying API responses. However, queued tasks may not finish immediately and can fail. Workers need retries, dead-letter handling, monitoring, and idempotent job processing.

## 10. Avoiding Single Points of Failure

- **Application tier:** Run at least two application servers across separate failure domains and use health checks with the load balancer.
- **Load balancer:** Use a managed or redundant load-balancing service rather than depending on one manually maintained instance.
- **Database:** Configure automated backups, monitoring, and a tested failover process for the primary and read replica. A read replica alone is not a complete backup strategy.
- **Cache:** Use a highly available cache deployment where justified, and allow the application to fall back to the database if the cache is temporarily unavailable.
- **Queue and workers:** Use a durable queue, run multiple workers, retry transient failures, and monitor jobs that repeatedly fail.
- **DNS and CDN:** Use reliable managed services and health monitoring; keep configuration and recovery procedures documented.
- **Recovery:** Regularly test restoring backups and recovering from a zone or service outage.

These measures reduce the impact of individual component failures. They do not guarantee zero downtime; recovery objectives, capacity, and failover behavior must be tested.

## 11. Conclusion

QuickNotes can support 1 million registered users with a scalable application tier, caching, a primary relational database, and a read replica. Under the stated assumptions, the system handles approximately 58 reads per second and 1.16 note creations per second on average, with five-times peak estimates of approximately 290 reads per second and 6 note creations per second. Estimated note storage growth is 73 GB per year before overhead.

The design should be validated with load testing, monitoring, realistic note sizes, and measured traffic before production deployment. Capacity should be increased based on actual performance rather than estimates alone.