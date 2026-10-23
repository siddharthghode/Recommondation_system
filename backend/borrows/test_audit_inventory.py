"""
P0 Inventory & Transaction Correctness Audit Tests.

Invariants verified:
  INV-01: Stock never goes negative.
  INV-02: Approving beyond available stock is rejected.
  INV-03: Double-return does not increment stock twice.
  INV-04: Rejected borrow leaves stock unchanged.
  INV-05: Rollback on out-of-stock approval leaves borrow in 'requested'.
  INV-06: Notification is NOT created when approval is rejected (rollback).
  INV-07: Duplicate borrow request blocked by DB constraint.
  INV-08: Return of another user's borrow is blocked (ownership).
  INV-09: Librarian from wrong dept cannot approve/return.
  INV-10: Sequential last-copy scenario — only one approval succeeds.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, Department, Notification
from books.models import Book
from borrows.models import Borrow


def _auth(client, user):
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")


def _make_approved_student(username, email, dept):
    u = User.objects.create_user(username=username, email=email,
                                  password="Pass1234!", role="student")
    p = u.profile
    p.department = dept
    p.approval_status = "approved"
    p.student_id = username
    p.save()
    return u


def _make_librarian(username, email, dept):
    return User.objects.create_user(username=username, email=email,
                                     password="Pass1234!", role="librarian",
                                     department=dept)


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def setup(db):
    cs = Department.objects.create(name="CS-Inv")
    mech = Department.objects.create(name="Mech-Inv")
    lib = _make_librarian("lib_inv", "lib_inv@t.edu", cs)
    lib_mech = _make_librarian("lib_mech_inv", "lib_mech_inv@t.edu", mech)
    s1 = _make_approved_student("s_inv1", "s_inv1@t.edu", cs)
    s2 = _make_approved_student("s_inv2", "s_inv2@t.edu", cs)
    book = Book.objects.create(title="Inv Book", authors="A",
                                department=cs, quantity=2)
    return dict(cs=cs, mech=mech, lib=lib, lib_mech=lib_mech,
                s1=s1, s2=s2, book=book)


@pytest.mark.django_db
class TestInventoryInvariants:

    def test_inv01_stock_never_negative_after_approval(self, setup):
        """INV-01: quantity floor is 0 — Book.save() enforces it."""
        book = setup["book"]
        book.quantity = 0
        book.save()
        book.refresh_from_db()
        assert book.quantity == 0

        # Force a negative write directly — model must clamp it
        book.quantity = -5
        book.save()
        book.refresh_from_db()
        assert book.quantity == 0, "INV-01: Book.save() did not clamp negative quantity"

    def test_inv02_approval_blocked_when_out_of_stock(self, setup):
        """INV-02: Approving a borrow when quantity=0 returns 400, borrow stays 'requested'."""
        client = APIClient()
        book = setup["book"]
        book.quantity = 0
        book.save()
        borrow = Borrow.objects.create(user=setup["s1"], book=book, status="requested")

        _auth(client, setup["lib"])
        resp = client.post(f"/api/borrows/approve/{borrow.id}/")
        assert resp.status_code == 400
        borrow.refresh_from_db()
        assert borrow.status == "requested"
        book.refresh_from_db()
        assert book.quantity == 0

    def test_inv03_double_return_blocked(self, setup):
        """INV-03: Returning an already-returned borrow is rejected; stock not incremented twice."""
        client = APIClient()
        book = setup["book"]
        book.quantity = 1
        book.save()
        borrow = Borrow.objects.create(user=setup["s1"], book=book, status="approved")

        _auth(client, setup["s1"])
        r1 = client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert r1.status_code == 200
        book.refresh_from_db()
        assert book.quantity == 2  # restored

        r2 = client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert r2.status_code == 400
        book.refresh_from_db()
        assert book.quantity == 2, "INV-03: Stock incremented twice on double return"

    def test_inv04_rejection_leaves_stock_unchanged(self, setup):
        """INV-04: Rejecting a borrow must not touch book quantity."""
        client = APIClient()
        book = setup["book"]
        original_qty = book.quantity
        borrow = Borrow.objects.create(user=setup["s1"], book=book, status="requested")

        _auth(client, setup["lib"])
        resp = client.post(f"/api/borrows/reject/{borrow.id}/", {"reason": "test"})
        assert resp.status_code == 200
        book.refresh_from_db()
        assert book.quantity == original_qty, "INV-04: Rejection changed book quantity"

    def test_inv05_notification_not_created_on_failed_approval(self, setup):
        """INV-05/06: When approval fails (out of stock), no approval notification is created."""
        book = setup["book"]
        book.quantity = 0
        book.save()
        borrow = Borrow.objects.create(user=setup["s1"], book=book, status="requested")
        notif_count_before = Notification.objects.filter(
            user=setup["s1"], notification_type="borrow_approved"
        ).count()

        client = APIClient()
        _auth(client, setup["lib"])
        client.post(f"/api/borrows/approve/{borrow.id}/")

        notif_count_after = Notification.objects.filter(
            user=setup["s1"], notification_type="borrow_approved"
        ).count()
        assert notif_count_after == notif_count_before, (
            "INV-06: Approval notification created even though approval failed"
        )

    def test_inv07_duplicate_borrow_blocked_by_constraint(self, setup):
        """INV-07: Second borrow request for same book by same user is rejected."""
        client = APIClient()
        _auth(client, setup["s1"])
        r1 = client.post("/api/borrows/request/", {"book_id": setup["book"].id})
        assert r1.status_code == 200
        r2 = client.post("/api/borrows/request/", {"book_id": setup["book"].id})
        assert r2.status_code == 400
        assert Borrow.objects.filter(user=setup["s1"], book=setup["book"]).count() == 1

    def test_inv08_student_cannot_return_another_students_borrow(self, setup):
        """INV-08: Student returning another student's borrow gets 404."""
        borrow = Borrow.objects.create(user=setup["s2"], book=setup["book"], status="approved")
        client = APIClient()
        _auth(client, setup["s1"])
        resp = client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert resp.status_code == 404
        borrow.refresh_from_db()
        assert borrow.status == "approved"

    def test_inv09_wrong_dept_librarian_cannot_approve(self, setup):
        """INV-09: Librarian from Mech cannot approve CS borrow."""
        borrow = Borrow.objects.create(user=setup["s1"], book=setup["book"], status="requested")
        client = APIClient()
        _auth(client, setup["lib_mech"])
        resp = client.post(f"/api/borrows/approve/{borrow.id}/")
        assert resp.status_code == 403
        borrow.refresh_from_db()
        assert borrow.status == "requested"
        setup["book"].refresh_from_db()
        assert setup["book"].quantity == 2

    def test_inv10_last_copy_sequential_only_one_approval(self, setup):
        """INV-10: With 1 copy, sequential approvals — second must fail."""
        book = setup["book"]
        book.quantity = 1
        book.save()

        b1 = Borrow.objects.create(user=setup["s1"], book=book, status="requested")
        b2 = Borrow.objects.create(user=setup["s2"], book=book, status="requested")

        client = APIClient()
        _auth(client, setup["lib"])

        r1 = client.post(f"/api/borrows/approve/{b1.id}/")
        assert r1.status_code == 200
        book.refresh_from_db()
        assert book.quantity == 0

        r2 = client.post(f"/api/borrows/approve/{b2.id}/")
        assert r2.status_code == 400

        book.refresh_from_db()
        assert book.quantity == 0, "INV-10: Stock went negative"
        b2.refresh_from_db()
        assert b2.status == "requested"

    def test_inv11_approved_borrow_cannot_be_approved_again(self, setup):
        """Double-approval attempt on already-approved borrow is rejected."""
        borrow = Borrow.objects.create(user=setup["s1"], book=setup["book"], status="requested")
        client = APIClient()
        _auth(client, setup["lib"])

        r1 = client.post(f"/api/borrows/approve/{borrow.id}/")
        assert r1.status_code == 200
        qty_after_first = Book.objects.get(id=setup["book"].id).quantity

        r2 = client.post(f"/api/borrows/approve/{borrow.id}/")
        assert r2.status_code == 400
        assert Book.objects.get(id=setup["book"].id).quantity == qty_after_first

    def test_inv12_return_restores_stock_exactly_one(self, setup):
        """Return increments quantity by exactly 1."""
        book = setup["book"]
        book.quantity = 1
        book.save()
        borrow = Borrow.objects.create(user=setup["s1"], book=book, status="approved")

        client = APIClient()
        _auth(client, setup["s1"])
        resp = client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert resp.status_code == 200
        book.refresh_from_db()
        assert book.quantity == 2

    def test_inv13_rejected_borrow_cannot_be_returned(self, setup):
        """A rejected borrow cannot be returned."""
        borrow = Borrow.objects.create(user=setup["s1"], book=setup["book"], status="rejected")
        client = APIClient()
        _auth(client, setup["s1"])
        resp = client.post("/api/borrows/return/", {"borrow_id": borrow.id})
        assert resp.status_code == 400

    def test_inv14_student_cannot_approve_own_borrow(self, setup):
        """Students must not be able to self-approve borrows."""
        borrow = Borrow.objects.create(user=setup["s1"], book=setup["book"], status="requested")
        client = APIClient()
        _auth(client, setup["s1"])
        resp = client.post(f"/api/borrows/approve/{borrow.id}/")
        assert resp.status_code == 403
        borrow.refresh_from_db()
        assert borrow.status == "requested"
