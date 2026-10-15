# QuickNotes API Design

## 1. Overview

The QuickNotes API allows registered users to create, view, update, and delete notes. It also supports searching notes and managing tags.

The API uses REST principles and communicates using JSON over HTTPS.

### Base URL

```text
https://api.quicknotes.example/v1
```

This is a proposed example URL, not a live API endpoint.

### Authentication

Protected endpoints require a valid bearer access token in the HTTP `Authorization` header.

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Users can only access notes they own unless a note is explicitly shared with them.

## 2. REST Endpoints

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | 201 Created |
| POST | `/auth/login` | Authenticate a user and return an access token | 200 OK |
| GET | `/notes` | List the authenticated user's notes, with pagination and optional search | 200 OK |
| POST | `/notes` | Create a new note | 201 Created |
| GET | `/notes/{noteId}` | Retrieve one note by ID | 200 OK |
| PATCH | `/notes/{noteId}` | Update selected fields of a note | 200 OK |
| DELETE | `/notes/{noteId}` | Delete a note | 204 No Content |
| GET | `/tags` | List tags available to the authenticated user | 200 OK |
| POST | `/notes/{noteId}/tags/{tagId}` | Attach a tag to a note | 201 Created |

## 3. Request and Response Examples

### A. Create a Note

**Request**

```http
POST /v1/notes
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "title": "Network revision",
  "body": "Review DNS, DHCP and subnetting."
}
```

**Response — 201 Created**

```json
{
  "id": 101,
  "user_id": 7,
  "title": "Network revision",
  "body": "Review DNS, DHCP and subnetting.",
  "created_at": "2026-10-16T09:30:00Z",
  "updated_at": "2026-10-16T09:30:00Z"
}
```

The server assigns the note ID, associates the note with the authenticated user, and records its creation and update timestamps.

### B. List Notes

**Request**

```http
GET /v1/notes?limit=10&offset=0
Authorization: Bearer <access_token>
```

**Response — 200 OK**

```json
{
  "data": [
    {
      "id": 101,
      "user_id": 7,
      "title": "Network revision",
      "body": "Review DNS, DHCP and subnetting.",
      "created_at": "2026-10-16T09:30:00Z",
      "updated_at": "2026-10-16T09:30:00Z"
    },
    {
      "id": 102,
      "user_id": 7,
      "title": "Project ideas",
      "body": "Plan the next application feature.",
      "created_at": "2026-10-16T10:00:00Z",
      "updated_at": "2026-10-16T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 2
  }
}
```

The API returns only notes the authenticated user is permitted to view. The `limit` and `offset` parameters support pagination.

## 4. Error Status Codes

| Status code | Name | When it is returned |
|---|---|---|
| 400 | Bad Request | The request body or query parameters are invalid |
| 401 | Unauthorized | Authentication is missing or the access token is invalid or expired |
| 403 | Forbidden | The user is authenticated but lacks permission for the requested action |
| 404 | Not Found | The requested resource does not exist or is not accessible to the user |
| 409 | Conflict | The request conflicts with an existing resource or a uniqueness constraint |
| 422 | Unprocessable Content | The request is syntactically valid but fails business validation |
| 429 | Too Many Requests | The client has exceeded the permitted request rate |
| 500 | Internal Server Error | An unexpected server-side error occurs |

## 5. Example Error Response

**Request error — 400 Bad Request**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "message": "Title is required and must not exceed 100 characters."
      }
    ],
    "request_id": "req_8f2a91"
  }
}
```

Error responses use a consistent structure so the frontend can display useful messages. Internal stack traces, database details, passwords, and access tokens must never be returned to clients.

## 6. Validation Rules

- A note title is required and must contain between 1 and 100 characters after trimming whitespace.
- A note body is optional, subject to a configured maximum length.
- Note IDs and tag IDs must be valid identifiers.
- Pagination values must be positive or zero as appropriate and must respect a maximum page size.
- All input is validated on the server; frontend validation alone is not sufficient.
- The server derives the owner ID from the authenticated user rather than trusting a client-supplied owner ID.

## 7. Security and Reliability

- All production API traffic must use HTTPS.
- Protected endpoints require authentication and enforce authorization checks.
- Passwords must be stored using a suitable password-hashing algorithm, never as plaintext.
- Requests should be rate-limited to reduce abuse.
- Database operations should use parameterized queries to reduce SQL injection risk.
- Logs should include request IDs for troubleshooting but must not expose sensitive credentials.
- The API should return appropriate HTTP status codes and avoid leaking whether another user's private notes exist.

## 8. Design Decisions

- **REST:** Resources such as notes and tags have clear URLs and use standard HTTP methods.
- **JSON:** JSON is straightforward to consume from browser-based JavaScript clients.
- **Bearer authentication:** Access tokens identify authenticated requests; authorization checks control which notes can be accessed.
- **Pagination:** Limits the amount of data returned in one response and improves performance for users with many notes.
- **Consistent errors:** A shared error format makes frontend handling and debugging easier.

This document defines the proposed production API. The browser prototype currently uses JSONPlaceholder, so these endpoints will require a separately implemented backend before they can be used in production.