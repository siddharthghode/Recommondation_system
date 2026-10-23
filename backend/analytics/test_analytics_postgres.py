import pytest
from accounts.models import User
from books.models import Book
from django.db import connection


@pytest.mark.django_db
class TestPostgresSpecificAnalytics:
    """
    Integration tests specifically targeting PostgreSQL-native SQL queries
    such as STRING_TO_ARRAY, UNNEST, and database aggregation.
    """

    @pytest.fixture(autouse=True)
    def verify_postgres(self):
        """Verify the database is PostgreSQL."""
        assert connection.vendor == "postgresql", f"Expected PostgreSQL database; got {connection.vendor}"

    def test_postgres_unnest_string_to_array_category_aggregation(self, api_client, auth_headers, cs_dept):
        """
        Verifies the real PostgreSQL engine executes the TRIM(UNNEST(STRING_TO_ARRAY(...)))
        query properly, correctly splitting comma-separated categories and aggregating counts.
        """
        # Create books with various comma-separated categories in CS department
        Book.objects.create(
            title="Book 1",
            categories="Algorithms, Python, Systems",
            quantity=5,
            department=cs_dept
        )
        Book.objects.create(
            title="Book 2",
            categories="Python, Machine Learning",
            quantity=3,
            department=cs_dept
        )
        Book.objects.create(
            title="Book 3",
            categories="Python, Algorithms",
            quantity=2,
            department=cs_dept
        )

        librarian = User.objects.create_user(
            username="pg_lib_cs",
            email="pg_lib_cs@univ.edu",
            password="Password123!",
            role="librarian",
            department=cs_dept
        )
        headers = auth_headers(librarian)

        resp = api_client.get('/api/analytics/librarian-dashboard/', **headers)
        assert resp.status_code == 200
        top_cats = resp.data.get("top_categories", [])
        assert len(top_cats) > 0

        # Python should have count=3, Algorithms count=2, Machine Learning count=1
        cat_map = {item["category"]: item["count"] for item in top_cats}
        assert cat_map.get("Python") == 3
        assert cat_map.get("Algorithms") == 2
        assert cat_map.get("Machine Learning") == 1

    def test_postgres_unnest_admin_global_aggregation(self, api_client, auth_headers, cs_dept, mech_dept):
        """
        Verifies PostgreSQL UNNEST query executes globally across all departments
        when accessed by Super Admin.
        """
        Book.objects.create(title="CS Book", categories="Algorithms, Systems", quantity=5, department=cs_dept)
        Book.objects.create(title="Mech Book", categories="Thermodynamics, Systems", quantity=4, department=mech_dept)

        admin = User.objects.create_superuser(
            username="pg_admin",
            email="pg_admin@univ.edu",
            password="SuperPassword123!",
            role="admin"
        )
        headers = auth_headers(admin)

        resp = api_client.get('/api/analytics/librarian-dashboard/', **headers)
        assert resp.status_code == 200
        top_cats = resp.data.get("top_categories", [])
        cat_map = {item["category"]: item["count"] for item in top_cats}
        # Systems was in both CS and Mech -> count=2
        assert cat_map.get("Systems") == 2
