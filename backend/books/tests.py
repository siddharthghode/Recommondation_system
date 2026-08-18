from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department
from books.models import Book, BookInteraction, BookDwellTime


class BooksDepartmentAuthorizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Departments
        self.dept_a = Department.objects.create(name="Computer Science")
        self.dept_b = Department.objects.create(name="Mechanical Engineering")

        # Super Admin
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="AdminPassword123!",
            role="admin"
        )

        # Librarian A (Dept A)
        self.lib_a = User.objects.create_user(
            username="librarian_a",
            email="lib_a@test.com",
            password="Password123!",
            role="librarian",
            department=self.dept_a
        )

        # Librarian B (Dept B)
        self.lib_b = User.objects.create_user(
            username="librarian_b",
            email="lib_b@test.com",
            password="Password123!",
            role="librarian",
            department=self.dept_b
        )

        # Student A (Dept A)
        self.student_a = User.objects.create_user(
            username="student_a",
            email="student_a@test.com",
            password="Password123!",
            role="student"
        )
        self.student_a.profile.department = self.dept_a
        self.student_a.profile.approval_status = "approved"
        self.student_a.profile.preferred_categories = "Algorithms, AI"
        self.student_a.profile.save()

        # Student B (Dept B)
        self.student_b = User.objects.create_user(
            username="student_b",
            email="student_b@test.com",
            password="Password123!",
            role="student"
        )
        self.student_b.profile.department = self.dept_b
        self.student_b.profile.approval_status = "approved"
        self.student_b.profile.preferred_categories = "Thermodynamics"
        self.student_b.profile.save()

        # Books in Dept A
        self.book_a1 = Book.objects.create(
            title="Intro to Algorithms",
            authors="Cormen et al.",
            categories="Algorithms, Computer Science",
            department=self.dept_a,
            quantity=5,
            average_rating=4.8,
            ratings_count=100
        )
        self.book_a2 = Book.objects.create(
            title="Artificial Intelligence: A Modern Approach",
            authors="Russell & Norvig",
            categories="AI, Computer Science",
            department=self.dept_a,
            quantity=3,
            average_rating=4.9,
            ratings_count=90
        )

        # Books in Dept B
        self.book_b1 = Book.objects.create(
            title="Fundamentals of Thermodynamics",
            authors="Borgnakke & Sonntag",
            categories="Thermodynamics, Mechanical Engineering",
            department=self.dept_b,
            quantity=4,
            average_rating=4.5,
            ratings_count=50
        )
        self.book_b2 = Book.objects.create(
            title="Fluid Mechanics",
            authors="White",
            categories="Fluid Mechanics, Mechanical Engineering",
            department=self.dept_b,
            quantity=2,
            average_rating=4.6,
            ratings_count=60
        )

    def _authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    # --- Super Admin Tests ---
    def test_admin_can_list_all_books_across_departments(self):
        self._authenticate(self.admin)
        response = self.client.get("/api/books/")
        self.assertEqual(response.status_code, 200)
        book_ids = [b["id"] for b in response.data["results"]]
        self.assertIn(self.book_a1.id, book_ids)
        self.assertIn(self.book_b1.id, book_ids)

    def test_admin_can_retrieve_any_book(self):
        self._authenticate(self.admin)
        resp_a = self.client.get(f"/api/books/{self.book_a1.id}/")
        resp_b = self.client.get(f"/api/books/{self.book_b1.id}/")
        self.assertEqual(resp_a.status_code, 200)
        self.assertEqual(resp_b.status_code, 200)

    # --- Librarian A Tests ---
    def test_librarian_a_can_only_list_department_a_books(self):
        self._authenticate(self.lib_a)
        response = self.client.get("/api/books/")
        self.assertEqual(response.status_code, 200)
        book_ids = [b["id"] for b in response.data["results"]]
        self.assertIn(self.book_a1.id, book_ids)
        self.assertIn(self.book_a2.id, book_ids)
        self.assertNotIn(self.book_b1.id, book_ids)
        self.assertNotIn(self.book_b2.id, book_ids)

    def test_librarian_a_cannot_bypass_via_query_params(self):
        self._authenticate(self.lib_a)
        response = self.client.get(f"/api/books/?department_id={self.dept_b.id}")
        self.assertEqual(response.status_code, 200)
        book_ids = [b["id"] for b in response.data["results"]]
        self.assertNotIn(self.book_b1.id, book_ids)

    def test_librarian_a_cannot_retrieve_department_b_book_detail(self):
        self._authenticate(self.lib_a)
        response = self.client.get(f"/api/books/{self.book_b1.id}/")
        self.assertEqual(response.status_code, 404)

    def test_librarian_a_creates_book_forced_to_own_department(self):
        self._authenticate(self.lib_a)
        # Even if payload specifies dept_b, server forces dept_a
        payload = {
            "title": "Clean Architecture in Python",
            "authors": "Robert Martin",
            "categories": "Software Engineering",
            "quantity": 10,
            "department": self.dept_b.id
        }
        response = self.client.post("/api/books/manage/", payload)
        self.assertEqual(response.status_code, 201)
        created_book = Book.objects.get(id=response.data["id"])
        self.assertEqual(created_book.department, self.dept_a)

    def test_librarian_a_cannot_modify_department_b_book(self):
        self._authenticate(self.lib_a)
        response = self.client.put(f"/api/books/manage/{self.book_b1.id}/", {"title": "Hacked Title"})
        self.assertEqual(response.status_code, 404)

    def test_librarian_a_cannot_delete_department_b_book(self):
        self._authenticate(self.lib_a)
        response = self.client.delete(f"/api/books/manage/{self.book_b1.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Book.objects.filter(id=self.book_b1.id).exists())

    # --- Student A Tests ---
    def test_student_a_can_only_list_department_a_books(self):
        self._authenticate(self.student_a)
        response = self.client.get("/api/books/")
        self.assertEqual(response.status_code, 200)
        book_ids = [b["id"] for b in response.data["results"]]
        self.assertIn(self.book_a1.id, book_ids)
        self.assertNotIn(self.book_b1.id, book_ids)

    def test_student_a_cannot_retrieve_department_b_book_detail(self):
        self._authenticate(self.student_a)
        response = self.client.get(f"/api/books/{self.book_b1.id}/")
        self.assertEqual(response.status_code, 404)

    def test_student_a_cannot_track_or_interact_with_department_b_book(self):
        self._authenticate(self.student_a)
        resp_track = self.client.post(f"/api/books/track/{self.book_b1.id}/")
        self.assertIn(resp_track.status_code, [403, 404])

        resp_interact = self.client.post("/api/interactions/", {"book_id": self.book_b1.id, "interaction_type": "like"})
        self.assertIn(resp_interact.status_code, [403, 404])

        resp_dwell = self.client.post("/api/dwell-time/", {"book_id": self.book_b1.id, "duration": 15.0})
        self.assertIn(resp_dwell.status_code, [403, 404])

    def test_student_a_recommendations_do_not_leak_department_b_books(self):
        self._authenticate(self.student_a)
        response = self.client.get("/api/books/recommendations/")
        self.assertEqual(response.status_code, 200)
        rec_ids = [b["id"] for b in response.data]
        self.assertNotIn(self.book_b1.id, rec_ids)
        self.assertNotIn(self.book_b2.id, rec_ids)

    def test_similar_books_scoped_to_department(self):
        response = self.client.get(f"/api/books/{self.book_a1.id}/similar/")
        self.assertEqual(response.status_code, 200)
        similar_ids = [b["id"] for b in response.data]
        self.assertNotIn(self.book_b1.id, similar_ids)
        self.assertNotIn(self.book_b2.id, similar_ids)

    def test_student_cannot_manage_books(self):
        self._authenticate(self.student_a)
        resp_post = self.client.post("/api/books/manage/", {"title": "Student Book", "quantity": 1})
        self.assertEqual(resp_post.status_code, 403)

    # --- Phase 3 Approval Access Control Tests ---
    def test_pending_student_cannot_list_books(self):
        pending_user = User.objects.create_user(
            username="pending_student_access",
            email="paccess@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        response = self.client.get("/api/books/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 0)

    def test_pending_student_cannot_retrieve_book_detail(self):
        pending_user = User.objects.create_user(
            username="pending_student_detail",
            email="pdetail@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        response = self.client.get(f"/api/books/{self.book_a1.id}/")
        self.assertEqual(response.status_code, 404)

    def test_pending_student_cannot_interact_or_dwell(self):
        pending_user = User.objects.create_user(
            username="pending_student_interact",
            email="pinteract@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        resp_track = self.client.post(f"/api/books/track/{self.book_a1.id}/")
        self.assertEqual(resp_track.status_code, 403)

        resp_interact = self.client.post("/api/interactions/", {"book_id": self.book_a1.id, "interaction_type": "like"})
        self.assertEqual(resp_interact.status_code, 403)

        resp_dwell = self.client.post("/api/dwell-time/", {"book_id": self.book_a1.id, "duration": 10.0})
        self.assertEqual(resp_dwell.status_code, 403)

    def test_pending_student_cannot_receive_recommendations(self):
        pending_user = User.objects.create_user(
            username="pending_student_recs",
            email="precs@test.com",
            password="Password123!",
            role="student"
        )
        pending_user.profile.department = self.dept_a
        pending_user.profile.approval_status = "pending"
        pending_user.profile.save()

        self._authenticate(pending_user)
        response = self.client.get("/api/books/recommendations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_rejected_student_cannot_list_or_access_books(self):
        rejected_user = User.objects.create_user(
            username="rejected_student",
            email="prej@test.com",
            password="Password123!",
            role="student"
        )
        rejected_user.profile.department = self.dept_a
        rejected_user.profile.approval_status = "rejected"
        rejected_user.profile.save()

        self._authenticate(rejected_user)
        resp_list = self.client.get("/api/books/")
        self.assertEqual(resp_list.status_code, 200)
        self.assertEqual(len(resp_list.data["results"]), 0)

        resp_detail = self.client.get(f"/api/books/{self.book_a1.id}/")
        self.assertEqual(resp_detail.status_code, 404)

        resp_recs = self.client.get("/api/books/recommendations/")
        self.assertEqual(resp_recs.status_code, 200)
        self.assertEqual(len(resp_recs.data), 0)

    # --- Phase 5 Librarian CSV Catalog Import Tests ---
    def test_unauthenticated_cannot_import_csv(self):
        csv_file = SimpleUploadedFile("books.csv", b"title,authors\nTest Book,Author A\n", content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 401)

    def test_student_cannot_import_csv(self):
        self._authenticate(self.student_a)
        csv_file = SimpleUploadedFile("books.csv", b"title,authors\nTest Book,Author A\n", content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 403)

    def test_librarian_without_department_cannot_import_csv(self):
        rogue_lib = User.objects.create_user(
            username="rogue_lib",
            email="rogue@test.com",
            password="Password123!",
            role="librarian",
            department=None
        )
        self._authenticate(rogue_lib)
        csv_file = SimpleUploadedFile("books.csv", b"title,authors\nTest Book,Author A\n", content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 403)
        self.assertIn("not assigned to a department", response.data["error"])

    def test_librarian_a_imports_csv_successfully_forced_to_dept_a(self):
        self._authenticate(self.lib_a)
        csv_content = (
            "title,subtitle,authors,categories,description,published_year,average_rating,quantity\n"
            "Data Structures in Rust,Fast & Safe,Steve Klabnik,Computer Science,Learn Rust DSA,2021,4.9,5\n"
            "Operating Systems: Three Easy Pieces,,Remzi Arpaci-Dusseau,Systems,OS Principles,2018,4.85,7\n"
        )
        csv_file = SimpleUploadedFile("catalog.csv", csv_content.encode("utf-8"), content_type="text/csv")
        # Attempt to pass department_id for Dept B
        response = self.client.post("/api/books/import/", {"file": csv_file, "department": self.dept_b.id}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(response.data["errors"], 0)

        # Verify books were created in Dept A, NOT Dept B
        rust_book = Book.objects.get(title="Data Structures in Rust")
        self.assertEqual(rust_book.department, self.dept_a)
        self.assertEqual(rust_book.quantity, 5)

        os_book = Book.objects.get(title="Operating Systems: Three Easy Pieces")
        self.assertEqual(os_book.department, self.dept_a)
        self.assertEqual(os_book.quantity, 7)

        # Librarian B cannot see these books
        self._authenticate(self.lib_b)
        resp_b = self.client.get("/api/books/")
        book_ids = [b["id"] for b in resp_b.data["results"]]
        self.assertNotIn(rust_book.id, book_ids)
        self.assertNotIn(os_book.id, book_ids)

    def test_csv_with_department_column_does_not_override_librarian_department(self):
        self._authenticate(self.lib_a)
        csv_content = (
            "title,authors,department,quantity\n"
            "Hacker Book,Hacker X,Mechanical Engineering,10\n"
        )
        csv_file = SimpleUploadedFile("hacked.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 200)
        book = Book.objects.get(title="Hacker Book")
        self.assertEqual(book.department, self.dept_a)

    def test_import_missing_file_returns_400(self):
        self._authenticate(self.lib_a)
        response = self.client.post("/api/books/import/", {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("No CSV file provided", response.data["error"])

    def test_import_empty_file_returns_400(self):
        self._authenticate(self.lib_a)
        empty_file = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": empty_file}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.data["error"])

    def test_import_missing_required_title_header_returns_400(self):
        self._authenticate(self.lib_a)
        invalid_header = SimpleUploadedFile("no_title.csv", b"authors,categories\nAuthor A,Cat B\n", content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": invalid_header}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing required CSV column: 'title'", response.data["error"])

    def test_import_with_row_errors_reports_useful_summary(self):
        self._authenticate(self.lib_a)
        csv_content = (
            "title,authors,quantity\n"
            "Valid Book 1,Author 1,5\n"
            ",Author 2,3\n"  # Missing title
            "Valid Book 2,Author 3,abc\n"  # Invalid integer qty handled gracefully
        )
        csv_file = SimpleUploadedFile("mixed.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(response.data["errors"], 1)
        self.assertIn("Row 3: Missing required 'title' field.", response.data["row_errors"])

    def test_repeated_import_does_not_create_unwanted_duplicates(self):
        self._authenticate(self.lib_a)
        csv_content = (
            "title,authors,quantity,average_rating\n"
            "Duplicate Test Book,Author Dup,5,4.2\n"
        )
        # First import
        csv_file_1 = SimpleUploadedFile("dup.csv", csv_content.encode("utf-8"), content_type="text/csv")
        res1 = self.client.post("/api/books/import/", {"file": csv_file_1}, format="multipart")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data["created"], 1)
        self.assertEqual(res1.data["updated"], 0)

        # Second import of same file
        csv_file_2 = SimpleUploadedFile("dup.csv", csv_content.encode("utf-8"), content_type="text/csv")
        res2 = self.client.post("/api/books/import/", {"file": csv_file_2}, format="multipart")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["created"], 0)
        self.assertEqual(res2.data["skipped"], 1)

        # Verify only 1 book exists in database
        self.assertEqual(Book.objects.filter(title="Duplicate Test Book", department=self.dept_a).count(), 1)

    def test_import_is_non_destructive_to_existing_books(self):
        self._authenticate(self.lib_a)
        # Dept A already has book_a1 and book_a2
        initial_dept_a_count = Book.objects.filter(department=self.dept_a).count()
        self.assertEqual(initial_dept_a_count, 2)

        csv_content = (
            "title,authors,quantity\n"
            "Brand New Non Destructive Book,Author X,3\n"
        )
        csv_file = SimpleUploadedFile("nondestructive.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post("/api/books/import/", {"file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 200)

        # Existing books must still exist
        self.assertTrue(Book.objects.filter(id=self.book_a1.id).exists())
        self.assertTrue(Book.objects.filter(id=self.book_a2.id).exists())
        self.assertEqual(Book.objects.filter(department=self.dept_a).count(), 3)

