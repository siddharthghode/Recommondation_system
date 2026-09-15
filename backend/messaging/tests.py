from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department
from messaging.models import Message


class MessagingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dept = Department.objects.create(name="Computer Science")

        self.admin = User.objects.create_superuser(
            username="admin_msg",
            email="admin_msg@test.com",
            password="Password123!",
            role="admin"
        )

        self.librarian = User.objects.create_user(
            username="librarian_msg",
            email="librarian_msg@test.com",
            password="Password123!",
            role="librarian",
            department=self.dept
        )

        self.student1 = User.objects.create_user(
            username="student1_msg",
            email="student1_msg@test.com",
            password="Password123!",
            role="student",
            department=self.dept
        )

        self.student2 = User.objects.create_user(
            username="student2_msg",
            email="student2_msg@test.com",
            password="Password123!",
            role="student",
            department=self.dept
        )

    def _auth(self, user):
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_unauthenticated_access_denied(self):
        response = self.client.get("/api/messages/")
        self.assertEqual(response.status_code, 401)

    def test_send_message(self):
        self._auth(self.student1)
        response = self.client.post("/api/messages/", {
            "recipient": self.librarian.id,
            "subject": "Question about book",
            "body": "Is this book available for next week?"
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Message.objects.count(), 1)
        msg = Message.objects.first()
        self.assertEqual(msg.sender, self.student1)
        self.assertEqual(msg.recipient, self.librarian)
        self.assertEqual(msg.subject, "Question about book")
        self.assertFalse(msg.is_read)

    def test_inbox_and_sent(self):
        Message.objects.create(
            sender=self.student1,
            recipient=self.librarian,
            subject="Hello",
            body="Hello Librarian"
        )
        Message.objects.create(
            sender=self.librarian,
            recipient=self.student1,
            subject="Reply",
            body="Hello Student"
        )

        # Student inbox
        self._auth(self.student1)
        res_inbox = self.client.get("/api/messages/inbox/")
        self.assertEqual(res_inbox.status_code, 200)
        self.assertEqual(len(res_inbox.data), 1)
        self.assertEqual(res_inbox.data[0]["subject"], "Reply")

        # Student sent
        res_sent = self.client.get("/api/messages/sent/")
        self.assertEqual(res_sent.status_code, 200)
        self.assertEqual(len(res_sent.data), 1)
        self.assertEqual(res_sent.data[0]["subject"], "Hello")

    def test_mark_read_and_permissions(self):
        msg = Message.objects.create(
            sender=self.student1,
            recipient=self.librarian,
            subject="Urgent",
            body="Please check"
        )

        # Sender cannot mark as read for recipient
        self._auth(self.student1)
        res_forbidden = self.client.post(f"/api/messages/{msg.id}/mark_read/")
        self.assertEqual(res_forbidden.status_code, 403)

        # Recipient can mark as read
        self._auth(self.librarian)
        res_ok = self.client.post(f"/api/messages/{msg.id}/mark_read/")
        self.assertEqual(res_ok.status_code, 200)
        msg.refresh_from_db()
        self.assertTrue(msg.is_read)

    def test_mark_all_read_and_unread_count(self):
        Message.objects.create(sender=self.student1, recipient=self.librarian, body="Msg 1")
        Message.objects.create(sender=self.student2, recipient=self.librarian, body="Msg 2")

        self._auth(self.librarian)
        res_count = self.client.get("/api/messages/unread_count/")
        self.assertEqual(res_count.status_code, 200)
        self.assertEqual(res_count.data["unread_count"], 2)

        res_mark_all = self.client.post("/api/messages/mark_all_read/")
        self.assertEqual(res_mark_all.status_code, 200)

        res_count_after = self.client.get("/api/messages/unread_count/")
        self.assertEqual(res_count_after.data["unread_count"], 0)

    def test_librarians_list_accessible_to_students(self):
        self._auth(self.student1)
        res = self.client.get("/api/messages/librarians/")
        self.assertEqual(res.status_code, 200)
        usernames = [u["username"] for u in res.data]
        self.assertIn("librarian_msg", usernames)

    def test_students_list_librarian_only(self):
        # Student cannot access student directory
        self._auth(self.student1)
        res = self.client.get("/api/messages/students/")
        self.assertEqual(res.status_code, 403)

        # Librarian can access student directory
        self._auth(self.librarian)
        res_lib = self.client.get("/api/messages/students/")
        self.assertEqual(res_lib.status_code, 200)
        usernames = [u["username"] for u in res_lib.data]
        self.assertIn("student1_msg", usernames)
        self.assertIn("student2_msg", usernames)

    def test_conversation_thread(self):
        m1 = Message.objects.create(
            sender=self.student1,
            recipient=self.librarian,
            subject="Question",
            body="When is the library open?"
        )
        m2 = Message.objects.create(
            sender=self.librarian,
            recipient=self.student1,
            subject="Answer",
            body="9 AM to 5 PM"
        )

        self._auth(self.librarian)
        res = self.client.get(f"/api/messages/{self.student1.id}/conversation/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

        # Calling conversation marks incoming messages as read
        m1.refresh_from_db()
        self.assertTrue(m1.is_read)

    def test_conversation_nonexistent_user(self):
        self._auth(self.librarian)
        res = self.client.get("/api/messages/999999/conversation/")
        self.assertEqual(res.status_code, 404)
