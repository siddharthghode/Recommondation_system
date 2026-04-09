from django.core.management.base import BaseCommand
from django.conf import settings
from pathlib import Path
import csv

from books.models import Book


def to_int(value):
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def to_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


class Command(BaseCommand):
    help = "Import books from CSV"

    def add_arguments(self, parser):
        parser.add_argument(
            "csv_path",
            nargs="?",
            help="Optional path to CSV file (defaults to BASE_DIR/data/books_6k.csv)",
        )

    def handle(self, *args, **kwargs):
        # Use provided path if any, else default to BASE_DIR/data/books_6k.csv
        raw_path = kwargs.get("csv_path")
        csv_path = Path(raw_path) if raw_path else (Path(settings.BASE_DIR) / "data" / "books_6k.csv")

        if not csv_path.exists():
            self.stderr.write(f"❌ CSV not found: {csv_path}")
            return

        Book.objects.all().delete()
        self.stdout.write("🧹 Old books deleted")

        books_to_create = []
        batch_size = 1000

        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                qty = to_int(row.get("quantity")) or 0
                qty = max(0, min(qty, 10))
                
                title = row.get("title", "").strip()[:500]
                subtitle = (row.get("subtitle") or "")[:1000]

                books_to_create.append(Book(
                    title=row.get("title", "").strip(),
                    subtitle=row.get("subtitle"),
                    authors=row.get("authors", ""),
                    categories=row.get("categories", ""),
                    description=row.get("description", ""),
                    published_year=to_int(row.get("published_year")),
                    num_pages=to_int(row.get("num_pages")),
                    average_rating=to_float(row.get("average_rating")),
                    ratings_count=to_int(row.get("ratings_count")),
                    thumbnail=row.get("thumbnail"),
                    quantity=qty,
                ))

                # Bulk create in batches
                if len(books_to_create) >= batch_size:
                    Book.objects.bulk_create(books_to_create, batch_size)
                    self.stdout.write(f"📦 Imported {len(books_to_create)} books...")
                    books_to_create = []

            # Create remaining books
            if books_to_create:
                Book.objects.bulk_create(books_to_create, batch_size)

        total_count = Book.objects.count()
        self.stdout.write(self.style.SUCCESS(f"✅ Imported {total_count} books from {csv_path}"))
