# QuickNotes Data Model

## 1. Overview

QuickNotes uses a relational database to store users, notes, tags, and the relationships between notes and tags.

The design uses SQL data types, primary keys to identify records, and foreign keys to maintain referential integrity. The examples use PostgreSQL-compatible SQL.

## 2. Entities and Columns

### 2.1 Users

Stores registered user accounts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGINT | Primary key, generated identity | Unique user identifier |
| username | VARCHAR(50) | NOT NULL, UNIQUE | User's username |
| email | VARCHAR(255) | NOT NULL, UNIQUE | User's email address |
| password_hash | VARCHAR(255) | NOT NULL | Secure password hash |
| created_at | TIMESTAMPTZ | NOT NULL, default current timestamp | Account creation time |

Passwords are stored as hashes, never as plaintext.

### 2.2 Notes

Stores notes created by users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGINT | Primary key, generated identity | Unique note identifier |
| user_id | BIGINT | Foreign key to users.id, NOT NULL | Owner of the note |
| title | VARCHAR(100) | NOT NULL | Note title |
| body | TEXT | NOT NULL, default empty string | Note content |
| created_at | TIMESTAMPTZ | NOT NULL, default current timestamp | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, default current timestamp | Last update time |

A note belongs to one user. The `user_id` column identifies its owner.

### 2.3 Tags

Stores reusable labels that users can apply to notes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGINT | Primary key, generated identity | Unique tag identifier |
| user_id | BIGINT | Foreign key to users.id, NOT NULL | Owner of the tag |
| name | VARCHAR(50) | NOT NULL | Tag name |
| created_at | TIMESTAMPTZ | NOT NULL, default current timestamp | Creation time |

A tag belongs to one user. A unique constraint on `(user_id, name)` prevents the same user from creating duplicate tag names.

### 2.4 Note_Tags

Connects notes and tags to support many-to-many relationships.

| Column | Type | Constraints | Description |
|---|---|---|---|
| note_id | BIGINT | Foreign key to notes.id, primary key component | Linked note |
| tag_id | BIGINT | Foreign key to tags.id, primary key component | Linked tag |

The combination `(note_id, tag_id)` forms a composite primary key, preventing the same tag from being assigned to the same note more than once.

## 3. Relationships

### One-to-many

- **Users → Notes:** One user can own many notes, but each note has one owner.
- **Users → Tags:** One user can create many tags, but each tag belongs to one user.

### Many-to-many

- **Notes ↔ Tags:** A note can have multiple tags, and a tag can be used on multiple notes.
- The `note_tags` junction table stores each note-tag association.

The database should also enforce that a note and its tag belong to the same user. This can be implemented through additional composite foreign keys or server-side validation within a transaction.

## 4. CREATE TABLE Statements

The following statements create the four tables in PostgreSQL.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tag_per_user UNIQUE (user_id, name),
    CONSTRAINT unique_tag_owner_id UNIQUE (user_id, id)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes(id)
        ON DELETE CASCADE,
    tag_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (user_id, tag_id)
        REFERENCES tags(user_id, id)
        ON DELETE CASCADE,
    FOREIGN KEY (user_id, note_id)
        REFERENCES notes(user_id, id)
        ON DELETE CASCADE
);
```

The composite foreign keys on `note_tags` ensure that the note and tag associated through a junction row belong to the same user. The corresponding `(user_id, id)` unique constraints needed for those references are already defined on `tags`; PostgreSQL also requires a matching unique constraint on `notes`, so add this constraint to the `notes` table definition before executing the SQL:

```sql
ALTER TABLE notes
ADD CONSTRAINT unique_note_owner_id UNIQUE (user_id, id);
```

For a fresh database, you can instead put `CONSTRAINT unique_note_owner_id UNIQUE (user_id, id)` directly inside the `CREATE TABLE notes` statement.

## 5. Indexes

```sql
CREATE INDEX idx_notes_user_created
ON notes (user_id, created_at DESC);

CREATE INDEX idx_note_tags_tag
ON note_tags (tag_id);
```

**Why these indexes?**

- `idx_notes_user_created` helps retrieve a user's notes in newest-first order without scanning every note.
- `idx_note_tags_tag` helps find notes associated with a particular tag. The composite primary key already supports lookups beginning with `note_id`.

## 6. Example SQL Queries

### Query 1: Retrieve a user's notes

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 7
ORDER BY created_at DESC
LIMIT 20;
```

This query returns the 20 newest notes belonging to user 7.

### Query 2: Retrieve notes with their tags (JOIN)

```sql
SELECT
    n.id AS note_id,
    n.title,
    t.name AS tag_name
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id
WHERE n.user_id = 7
ORDER BY n.created_at DESC, t.name;
```

This query joins notes, the junction table, and tags to show the labels attached to a user's notes.

### Query 3: Count notes per user

```sql
SELECT
    u.id,
    u.username,
    COUNT(n.id) AS total_notes
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_notes DESC;
```

The `LEFT JOIN` includes users who have not created any notes.

### Query 4: Create a note

```sql
INSERT INTO notes (user_id, title, body)
VALUES (7, 'Network revision', 'Review DNS and DHCP.')
RETURNING id, user_id, title, body, created_at;
```

The database generates the note ID and creation timestamp.

## 7. SQL vs NoSQL Decision

QuickNotes should begin with a relational SQL database such as PostgreSQL. Users, notes, and tags have clear relationships, and foreign keys help protect data integrity. SQL transactions also allow related operations to succeed or fail together. Indexes support common operations such as listing a user's notes and retrieving notes by tag. A NoSQL database could offer advantages for some flexible or high-volume workloads, but it would add complexity without a clear need at this stage. The team should monitor actual traffic and query performance before considering additional storage technologies.

## 8. Data Integrity and Security

- Enforce ownership checks on every note and tag operation.
- Use parameterized queries to prevent SQL injection.
- Use transactions when creating or updating related records.
- Use cascading deletes to prevent orphaned notes and note-tag associations.
- Validate titles and other input on the server.
- Never store plaintext passwords.
- Restrict database access to authorized application services.

The schema is a starting point for the production backend and can be extended with sharing permissions, soft deletion, audit logs, and additional indexes when requirements justify them.