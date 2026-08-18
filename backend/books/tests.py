from django.test import TestCase
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
