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
                def get_field(aliases, default=""):
                    for k, v in row.items():
                        if k and k.strip().lower() in [a.lower() for a in aliases]:
                            return v.strip() if isinstance(v, str) else (v or default)
                    return default

                qty = to_int(get_field(["quantity", "copies", "stock"])) or 0
                qty = max(0, min(qty, 10))
                
                title_val = get_field(["Book_title", "book_title", "Book Title", "title", "name", "book_name"])
                if not title_val:
                    continue

                books_to_create.append(Book(
                    title=title_val[:500],
                    subtitle=(get_field(["subtitle", "sub_title"]) or None),
                    authors=get_field(["authors", "author", "book_author", "creator"], "Unknown")[:500] or "Unknown",
                    categories=get_field(["categories", "category", "genre", "genres"])[:500],
                    description=get_field(["description", "desc", "summary"]),
                    published_year=to_int(get_field(["published_year", "year", "pub_year"])),
                    num_pages=to_int(get_field(["num_pages", "pages", "page_count"])),
                    average_rating=to_float(get_field(["average_rating", "rating", "avg_rating"])),
                    ratings_count=to_int(get_field(["ratings_count", "rating_count"])),
                    thumbnail=get_field(["thumbnail", "image", "cover_image", "cover"]),
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
