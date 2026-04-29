import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, UserProfile, Department
from books.models import Book, BookInteraction
from borrows.models import Borrow


STUDENT_DATA = [
    ("aarav_sharma",   "Aarav",    "Sharma",    "CS2021001"),
    ("priya_patil",    "Priya",    "Patil",     "CS2021002"),
    ("rohan_desai",    "Rohan",    "Desai",     "CS2021003"),
    ("sneha_kulkarni", "Sneha",    "Kulkarni",  "CS2021004"),
    ("vikram_joshi",   "Vikram",   "Joshi",     "CS2021005"),
    ("ananya_mehta",   "Ananya",   "Mehta",     "CS2021006"),
    ("karan_singh",    "Karan",    "Singh",     "CS2021007"),
    ("pooja_nair",     "Pooja",    "Nair",      "CS2021008"),
    ("arjun_rao",      "Arjun",    "Rao",       "CS2021009"),
    ("divya_iyer",     "Divya",    "Iyer",      "CS2021010"),
]

CATEGORIES = [
    "Computers", "Science", "Mathematics", "Fiction",
    "History", "Philosophy", "Technology", "Engineering",
]


class Command(BaseCommand):
    help = "Seed demo users, realistic borrow history, pending requests, and ML interactions"

    def handle(self, *args, **options):
        now = timezone.now()

        # ── 1. Department ──────────────────────────────────────────────
        dept, _ = Department.objects.get_or_create(name="Computer Science")
        self.stdout.write("✓ Department: Computer Science")

        # ── 2. Admin ───────────────────────────────────────────────────
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "first_name": "Admin", "last_name": "User",
                "role": "admin", "is_staff": True, "is_superuser": True,
            },
        )
        admin.set_password("admin123")
        admin.save()
        self.stdout.write("✓ Admin: admin / admin123")

        # ── 3. Librarian ───────────────────────────────────────────────
        lib, _ = User.objects.get_or_create(
            username="librarian_cs",
            defaults={
                "first_name": "Jessica", "last_name": "Pearson",
                "role": "librarian", "department": dept,
            },
        )
        lib.set_password("test1234")
        lib.department = dept
        lib.save()
        self.stdout.write("✓ Librarian: librarian_cs / test1234")

        # ── 4. Students ────────────────────────────────────────────────
        students = []
        for username, first, last, sid in STUDENT_DATA:
            student, _ = User.objects.get_or_create(
                username=username,
                defaults={"first_name": first, "last_name": last, "role": "student"},
            )
            student.set_password("test1234")
            student.save()

            profile, _ = UserProfile.objects.get_or_create(
                user=student,
                defaults={"student_id": sid},
            )
            profile.student_id = sid
            profile.department = dept
            profile.year = random.randint(1, 4)
            profile.preferred_categories = ",".join(random.sample(CATEGORIES, 3))
            profile.save()

            students.append(student)

        self.stdout.write(f"✓ {len(students)} students created (password: test1234)")

        # ── 5. Check books exist ───────────────────────────────────────
        books = list(Book.objects.filter(quantity__gt=0))
        if not books:
            self.stdout.write(self.style.WARNING(
                "⚠ No books found. Run: python manage.py import_books first."
            ))
            return

        self.stdout.write(f"✓ Found {len(books)} available books in catalogue")

        # ── 5b. Assign books to CS department ─────────────────────────
        # Pick 200 random books and tag them to CS dept so dept-scoped
        # stats show a realistic non-zero count
        dept_book_count = Book.objects.filter(department=dept).count()
        if dept_book_count == 0:
            cs_books = random.sample(books, min(200, len(books)))
            Book.objects.filter(id__in=[b.id for b in cs_books]).update(department=dept)
            self.stdout.write(f"✓ Assigned {len(cs_books)} books to Computer Science dept")
        else:
            self.stdout.write(f"✓ CS dept already has {dept_book_count} books")

        # ── 6. Borrow history (approved + returned) ────────────────────
        # Each student gets 3–6 past borrows spread over last 60 days
        history_count = 0
        for student in students:
            n = random.randint(3, 6)
            chosen_books = random.sample(books, min(n, len(books)))
            for i, book in enumerate(chosen_books):
                days_ago = random.randint(5, 60)
                requested_at = now - timedelta(days=days_ago)
                approved_at  = requested_at + timedelta(hours=random.randint(1, 8))
                borrow_date  = approved_at
                due_date     = borrow_date + timedelta(days=30)

                # 70% returned, 30% still approved (active)
                if random.random() < 0.7:
                    status = "returned"
                    return_date = borrow_date + timedelta(days=random.randint(3, 25))
                else:
                    status = "approved"
                    return_date = None
                    # decrement stock for active borrows
                    book.quantity = max(0, book.quantity - 1)
                    book.save()

                Borrow.objects.get_or_create(
                    user=student,
                    book=book,
                    status=status,
                    defaults={
                        "requested_at": requested_at,
                        "approved_at":  approved_at,
                        "borrow_date":  borrow_date,
                        "due_date":     due_date,
                        "return_date":  return_date,
                    },
                )

                # Record borrow interaction for ML
                BookInteraction.objects.get_or_create(
                    user=student, book=book, interaction_type="borrow"
                )
                history_count += 1

        self.stdout.write(f"✓ {history_count} borrow history records created")

        # ── 7. Pending borrow requests ─────────────────────────────────
        # Pick 4–6 students and give each 1 pending request
        pending_students = random.sample(students, min(5, len(students)))
        pending_books    = random.sample(books, min(5, len(books)))
        pending_count    = 0

        for student, book in zip(pending_students, pending_books):
            # Skip if student already has an active/requested borrow for this book
            already = Borrow.objects.filter(
                user=student, book=book, status__in=["requested", "approved"]
            ).exists()
            if already:
                continue

            minutes_ago = random.randint(10, 300)
            Borrow.objects.create(
                user=student,
                book=book,
                status="requested",
                requested_at=now - timedelta(minutes=minutes_ago),
            )
            pending_count += 1

        self.stdout.write(f"✓ {pending_count} pending borrow requests created")

        # ── 8. ML interactions (views + likes) ────────────────────────
        interaction_count = 0
        for student in students:
            # 15–25 view/like interactions per student
            sample_books = random.sample(books, min(20, len(books)))
            for book in sample_books:
                i_type = random.choices(
                    ["view", "like", "borrow"], weights=[65, 25, 10]
                )[0]
                BookInteraction.objects.create(
                    user=student,
                    book=book,
                    interaction_type=i_type,
                    created_at=now - timedelta(days=random.randint(1, 45)),
                )
                interaction_count += 1

        self.stdout.write(f"✓ {interaction_count} ML interactions created")

        # ── Summary ────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            "\n✅ Seed complete!\n"
            "   Admin:     admin / admin123\n"
            "   Librarian: librarian_cs / test1234\n"
            f"  Students:  {', '.join(u for u, *_ in STUDENT_DATA[:3])} ... / test1234"
        ))
