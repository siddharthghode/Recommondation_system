import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Department, UserProfile
from books.models import Book, BookInteraction, BookDwellTime
from borrows.models import Borrow


@pytest.fixture
def api_client():
    """Unauthenticated DRF APIClient fixture."""
    return APIClient()


@pytest.fixture
def cs_dept(db):
    """Computer Science Department fixture."""
    return Department.objects.create(name="Computer Science")


@pytest.fixture
def mech_dept(db):
    """Mechanical Engineering Department fixture."""
    return Department.objects.create(name="Mechanical Engineering")


@pytest.fixture
def super_admin(db):
    """Super Admin user fixture."""
    return User.objects.create_superuser(
        username="admin_super",
        email="admin_super@univ.edu",
        password="SuperAdminPassword123!",
        role="admin"
    )


@pytest.fixture
def cs_librarian(db, cs_dept):
    """Librarian assigned to CS Department fixture."""
    return User.objects.create_user(
        username="librarian_cs",
        email="lib_cs@univ.edu",
        password="LibrarianPass123!",
        role="librarian",
        department=cs_dept
    )


@pytest.fixture
def mech_librarian(db, mech_dept):
    """Librarian assigned to Mechanical Dept fixture."""
    return User.objects.create_user(
        username="librarian_mech",
        email="lib_mech@univ.edu",
        password="LibrarianPass123!",
        role="librarian",
        department=mech_dept
    )


@pytest.fixture
def approved_cs_student(db, cs_dept):
    """Approved student belonging to CS Department."""
    user = User.objects.create_user(
        username="student_cs_01",
        email="student_cs_01@univ.edu",
        password="StudentPass123!",
        role="student",
        department=cs_dept
    )
    profile = user.profile
    profile.department = cs_dept
    profile.student_id = "CS-2026-001"
    profile.year = 3
    profile.preferred_categories = "Algorithms, Artificial Intelligence, Python"
    profile.approval_status = "approved"
    profile.save()
    return user


@pytest.fixture
def pending_cs_student(db, cs_dept):
    """Pending student registration in CS Department."""
    user = User.objects.create_user(
        username="student_cs_pending",
        email="pending_cs@univ.edu",
        password="StudentPass123!",
        role="student",
        department=cs_dept
    )
    profile = user.profile
    profile.department = cs_dept
    profile.student_id = "CS-2026-PENDING"
    profile.year = 1
    profile.approval_status = "pending"
    profile.save()
    return user


@pytest.fixture
def approved_mech_student(db, mech_dept):
    """Approved student belonging to Mechanical Department."""
    user = User.objects.create_user(
        username="student_mech_01",
        email="student_mech_01@univ.edu",
        password="StudentPass123!",
        role="student",
        department=mech_dept
    )
    profile = user.profile
    profile.department = mech_dept
    profile.student_id = "ME-2026-001"
    profile.year = 2
    profile.preferred_categories = "Thermodynamics, Fluid Dynamics"
    profile.approval_status = "approved"
    profile.save()
    return user


@pytest.fixture
def cs_sample_books(db, cs_dept):
    """Set of sample books for Computer Science department."""
    b1 = Book.objects.create(
        title="Introduction to Algorithms",
        authors="Thomas H. Cormen, Charles E. Leiserson",
        categories="Algorithms, Computer Science",
        description="Comprehensive textbook covering sorting, graph algorithms, and dynamic programming.",
        department=cs_dept,
        quantity=5,
        average_rating=4.8,
        ratings_count=120
    )
    b2 = Book.objects.create(
        title="Artificial Intelligence: A Modern Approach",
        authors="Stuart Russell, Peter Norvig",
        categories="Artificial Intelligence, Computer Science",
        description="Leading textbook on AI, machine learning, and probabilistic reasoning.",
        department=cs_dept,
        quantity=3,
        average_rating=4.9,
        ratings_count=95
    )
    b3 = Book.objects.create(
        title="Operating System Concepts",
        authors="Abraham Silberschatz, Peter Galvin",
        categories="Systems, Computer Science",
        description="Core concepts in process scheduling, concurrency, virtual memory, and file systems.",
        department=cs_dept,
        quantity=4,
        average_rating=4.7,
        ratings_count=80
    )
    return [b1, b2, b3]


@pytest.fixture
def mech_sample_books(db, mech_dept):
    """Set of sample books for Mechanical Engineering department."""
    b1 = Book.objects.create(
        title="Fundamentals of Engineering Thermodynamics",
        authors="Michael J. Moran, Howard N. Shapiro",
        categories="Thermodynamics, Mechanical Engineering",
        description="Standard textbook covering energy analysis, entropy, and thermodynamic power cycles.",
        department=mech_dept,
        quantity=4,
        average_rating=4.6,
        ratings_count=70
    )
    return [b1]


@pytest.fixture
def auth_headers():
    """Helper fixture to generate JWT Bearer authorization headers for any user."""
    def _get_headers(user):
        refresh = RefreshToken.for_user(user)
        return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}
    return _get_headers
