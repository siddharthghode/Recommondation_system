# Book Recommendation System - Entity Relationship Diagram

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BOOK RECOMMENDATION SYSTEM DATABASE                      │
│                            ER Diagram                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Generated: January 22, 2026
```

---

## Entities and Relationships

### 1. DEPARTMENT
```
┌──────────────────────┐
│    DEPARTMENT        │
├──────────────────────┤
│ PK  id              │
│     name (unique)    │
└──────────────────────┘
```

**Relationships:**
- ONE Department → MANY Users (librarians)
- ONE Department → MANY UserProfiles (students)

---

### 2. USER (extends AbstractUser)
```
┌─────────────────────────────┐
│         USER                │
├─────────────────────────────┤
│ PK  id                     │
│     username (unique)       │
│     email                   │
│     password                │
│     first_name              │
│     last_name               │
│     role (choices)          │
│       - student             │
│       - librarian           │
│       - admin               │
│ FK  department_id (null)    │
│     is_active               │
│     is_staff                │
│     is_superuser            │
│     date_joined             │
│     last_login              │
└─────────────────────────────┘
```

**Relationships:**
- MANY Users → ONE Department (for librarians)
- ONE User → ONE UserProfile (student profile)
- ONE User → MANY Notifications
- ONE User → MANY BookInteractions
- ONE User → MANY Borrows

---

### 3. USERPROFILE (Student Profile)
```
┌─────────────────────────────┐
│      USERPROFILE            │
├─────────────────────────────┤
│ PK  id                     │
│ FK  user_id (1:1, unique)   │
│     student_id (unique)     │
│ FK  department_id (null)    │
│     year                    │
│     preferred_categories    │
└─────────────────────────────┘
```

**Relationships:**
- ONE UserProfile → ONE User
- MANY UserProfiles → ONE Department

---

### 4. BOOK
```
┌─────────────────────────────┐
│          BOOK               │
├─────────────────────────────┤
│ PK  id                     │
│     title                   │
│     subtitle                │
│     authors                 │
│     categories              │
│     description             │
│     published_year          │
│     num_pages               │
│     average_rating          │
│     ratings_count           │
│     thumbnail (URL)         │
│     quantity                │
└─────────────────────────────┘
```

**Relationships:**
- ONE Book → MANY BookInteractions
- ONE Book → MANY Borrows

---

### 5. BOOKINTERACTION
```
┌─────────────────────────────┐
│    BOOKINTERACTION          │
├─────────────────────────────┤
│ PK  id                     │
│ FK  user_id                 │
│ FK  book_id                 │
│     interaction_type        │
│       - view                │
│       - like                │
│       - borrow              │
│     created_at              │
└─────────────────────────────┘
```

**Relationships:**
- MANY BookInteractions → ONE User
- MANY BookInteractions → ONE Book

---

### 6. BORROW
```
┌─────────────────────────────┐
│         BORROW              │
├─────────────────────────────┤
│ PK  id                     │
│ FK  user_id                 │
│ FK  book_id                 │
│     status (choices)        │
│       - requested           │
│       - approved            │
│       - returned            │
│       - rejected            │
│     requested_at            │
│     approved_at (null)      │
│     borrow_date (null)      │
│     due_date (null)         │
│     return_date (null)      │
│     rejection_reason (null) │
└─────────────────────────────┘
```

**Relationships:**
- MANY Borrows → ONE User
- MANY Borrows → ONE Book

**Business Rules:**
- `due_date` is automatically set to 30 days after `approved_at`
- `borrow_date` is set when status changes to 'approved'
- Book quantity is decremented when borrow is approved
- Book quantity is incremented when borrow is returned

---

### 7. NOTIFICATION
```
┌─────────────────────────────┐
│      NOTIFICATION           │
├─────────────────────────────┤
│ PK  id                     │
│ FK  user_id                 │
│     message                 │
│     is_read (default=False) │
│     created_at              │
└─────────────────────────────┘
```

**Relationships:**
- MANY Notifications → ONE User

---

## Complete ER Diagram (ASCII Art)

```
                                    ┌──────────────┐
                                    │  DEPARTMENT  │
                                    │              │
                                    │ PK id        │
                                    │    name      │
                                    └──────┬───────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        │ (department_id)  │ (department_id)  │
                        │                  │                  │
                  ┌─────▼─────┐     ┌─────▼──────┐          │
                  │   USER     │     │ USERPROFILE│          │
                  │            │     │            │          │
                  │ PK id      │◄────┤ FK user_id │          │
                  │    username│ 1:1 │    student_│          │
                  │    email   │     │    id      │          │
                  │    role    │     │    year    │          │
                  │ FK dept_id │     │    preferred│          │
                  └─────┬──────┘     └────────────┘          │
                        │                                     │
            ┌───────────┼────────────┬───────────────────────┘
            │           │            │
            │           │            │
  ┌─────────▼────┐ ┌───▼──────┐ ┌──▼────────────┐
  │ NOTIFICATION │ │  BORROW   │ │ BOOKINTER-    │
  │              │ │           │ │ ACTION        │
  │ PK id        │ │ PK id     │ │               │
  │ FK user_id   │ │ FK user_id│ │ PK id         │
  │    message   │ │ FK book_id│ │ FK user_id    │
  │    is_read   │ │    status │ │ FK book_id    │
  │    created_at│ │    request│ │    inter_type │
  └──────────────┘ │    ed_at  │ │    created_at │
                   │    approved│ └───────┬───────┘
                   │    _at    │         │
                   │    borrow │         │
                   │    _date  │         │
                   │    due_date│        │
                   │    return │         │
                   │    _date  │         │
                   │    rejectio│        │
                   │    n_reason│        │
                   └─────┬─────┘         │
                         │               │
                         │(book_id)      │(book_id)
                         │               │
                    ┌────▼───────────────▼────┐
                    │        BOOK             │
                    │                         │
                    │ PK id                   │
                    │    title                │
                    │    authors              │
                    │    categories           │
                    │    description          │
                    │    published_year       │
                    │    average_rating       │
                    │    quantity             │
                    │    thumbnail            │
                    └─────────────────────────┘
```

---

## Cardinality Summary

| Relationship | From | To | Type | Description |
|--------------|------|-----|------|-------------|
| User-Department | User | Department | Many:1 | Librarian belongs to department |
| UserProfile-User | UserProfile | User | 1:1 | Student has one profile |
| UserProfile-Department | UserProfile | Department | Many:1 | Student belongs to department |
| Notification-User | Notification | User | Many:1 | User receives notifications |
| Borrow-User | Borrow | User | Many:1 | User can borrow multiple books |
| Borrow-Book | Borrow | Book | Many:1 | Book can be borrowed by multiple users |
| BookInteraction-User | BookInteraction | User | Many:1 | User has many interactions |
| BookInteraction-Book | BookInteraction | Book | Many:1 | Book has many interactions |

---

## Key Constraints

### Primary Keys (PK)
- All tables have auto-incrementing integer primary keys

### Foreign Keys (FK)
- **User.department_id** → Department.id (SET_NULL)
- **UserProfile.user_id** → User.id (CASCADE)
- **UserProfile.department_id** → Department.id (SET_NULL)
- **Notification.user_id** → User.id (CASCADE)
- **Borrow.user_id** → User.id (CASCADE)
- **Borrow.book_id** → Book.id (CASCADE)
- **BookInteraction.user_id** → User.id (CASCADE)
- **BookInteraction.book_id** → Book.id (CASCADE)

### Unique Constraints
- Department.name (UNIQUE)
- User.username (UNIQUE)
- User.email (UNIQUE)
- UserProfile.student_id (UNIQUE)

### Indexes (Auto-created)
- All primary keys
- All foreign keys
- Unique fields

---

## Database Statistics

| Entity | Estimated Rows | Purpose |
|--------|---------------|---------|
| Department | ~10 | Academic departments |
| User | ~1000+ | Students, Librarians, Admins |
| UserProfile | ~900+ | Student profiles |
| Book | ~6000+ | Library collection |
| Borrow | ~5000+ | Borrow transactions |
| BookInteraction | ~10000+ | User activity tracking |
| Notification | ~3000+ | System notifications |

---

## Database Features

### 1. Authentication & Authorization
- Role-based access control (Student, Librarian, Admin)
- Department-based isolation for librarians
- Custom user model extending Django's AbstractUser

### 2. Book Management
- Inventory tracking with quantity field
- Rich metadata (ratings, categories, descriptions)
- Support for book images via thumbnail URLs

### 3. Borrow Workflow
- Multi-status workflow (requested → approved → borrowed → returned)
- Automatic due date calculation (30 days)
- Rejection with reason tracking
- Book quantity management

### 4. Analytics & Recommendations
- User interaction tracking (view, like, borrow)
- Category preference tracking
- Temporal data for trend analysis

### 5. Notifications
- Real-time user notifications
- Read/unread status tracking
- Chronological ordering

---

## Notes

1. **Date Fields**: All timestamps use Django's DateTimeField with timezone support
2. **Soft Deletes**: Not implemented; uses CASCADE/SET_NULL for integrity
3. **Database Engine**: PostgreSQL (`library_db`)
4. **ORM**: Django ORM with automatic migrations
5. **Indexing**: Automatic on PKs and FKs; consider adding indexes on frequently queried fields (status, created_at)

---

*Generated on January 22, 2026*
*Django Version: 6.0.1*
*Database: PostgreSQL (library_db)*
