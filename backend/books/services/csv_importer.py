import csv
import io
from django.db import transaction
from books.models import Book
from accounts.models import Department


def _to_int(val, default=None):
    if val is None or val == "":
        return default
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return default


def _to_float(val, default=None):
    if val is None or val == "":
        return default
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return default


def _clean_str(val, max_len=900):
    if val is None:
        return ""
    s = str(val).strip()
    return s[:max_len]


def import_books_from_csv(file_obj, department: Department) -> dict:
    """
    Import books from an uploaded CSV file for the given department.
    Ensures all books belong to the specified department and handles duplicates gracefully.
    
    Returns a dictionary summarizing the import result:
    {
        "success": bool,
        "message": str,
        "total_rows": int,
        "created": int,
        "updated": int,
        "skipped": int,
        "errors": int,
        "row_errors": list[str]
    }
    """
    if not department:
        return {
            "success": False,
            "error": "A valid department is required for book import.",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": ["No department assigned."]
        }

    # Read and decode file
    try:
        content = file_obj.read()
        if isinstance(content, bytes):
            # Try utf-8-sig (handles UTF-8 with BOM), fallback to latin-1
            try:
                decoded = content.decode('utf-8-sig')
            except UnicodeDecodeError:
                decoded = content.decode('latin-1')
        else:
            decoded = content
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read file: {str(e)}",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": ["File encoding could not be parsed."]
        }

    if not decoded.strip():
        return {
            "success": False,
            "error": "The uploaded CSV file is empty.",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": ["File contains no data."]
        }

    f = io.StringIO(decoded)
    reader = csv.reader(f)
    try:
        raw_headers = next(reader, None)
    except Exception as e:
        return {
            "success": False,
            "error": "Invalid CSV file format.",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": [str(e)]
        }

    if not raw_headers:
        return {
            "success": False,
            "error": "The uploaded CSV file has no header row.",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": ["Missing header row."]
        }

    # Normalize headers (lower-case, stripped)
    header_map = {}
    for idx, h in enumerate(raw_headers):
        clean_h = h.strip().lower()
        if clean_h:
            header_map[clean_h] = idx

    if 'title' not in header_map:
        return {
            "success": False,
            "error": "Missing required CSV column: 'title'.",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 1,
            "row_errors": ["Required column 'title' not found in CSV headers."]
        }

    # Query existing books for this department to avoid per-row queries
    existing_books = {
        (b.title.strip().lower(), (b.authors or "").strip().lower()): b
        for b in Book.objects.filter(department=department)
    }

    # Also build a title-only index for fallback matching
    existing_by_title = {
        b.title.strip().lower(): b
        for b in Book.objects.filter(department=department)
    }

    created_count = 0
    updated_count = 0
    skipped_count = 0
    row_errors = []
    total_rows = 0

    books_to_create = []
    books_to_update = []

    for row_idx, row in enumerate(reader, start=2):  # 1-indexed, starting after header
        if not row or not any(field.strip() for field in row):
            continue  # skip empty lines

        total_rows += 1

        def get_val(col_name, default=""):
            idx = header_map.get(col_name)
            if idx is not None and idx < len(row):
                return row[idx].strip()
            return default

        raw_title = get_val('title')
        if not raw_title:
            row_errors.append(f"Row {row_idx}: Missing required 'title' field.")
            continue

        title = _clean_str(raw_title, 900)
        subtitle = _clean_str(get_val('subtitle'), 900) or None
        authors = _clean_str(get_val('authors', 'Unknown'), 900)
        if not authors:
            authors = "Unknown"
        categories = _clean_str(get_val('categories'), 900)
        description = get_val('description')
        published_year = _to_int(get_val('published_year'))
        num_pages = _to_int(get_val('num_pages'))
        average_rating = _to_float(get_val('average_rating'))
        ratings_count = _to_int(get_val('ratings_count'))
        thumbnail = get_val('thumbnail')
        raw_qty = _to_int(get_val('quantity'), default=1)
        quantity = max(0, raw_qty if raw_qty is not None else 1)

        key = (title.lower(), authors.lower())
        existing_book = existing_books.get(key) or existing_by_title.get(title.lower())

        if existing_book:
            # Update existing book
            updated = False
            if quantity != existing_book.quantity:
                existing_book.quantity = quantity
                updated = True
            if authors and authors != "Unknown" and existing_book.authors != authors:
                existing_book.authors = authors
                updated = True
            if categories and existing_book.categories != categories:
                existing_book.categories = categories
                updated = True
            if description and existing_book.description != description:
                existing_book.description = description
                updated = True
            if subtitle and existing_book.subtitle != subtitle:
                existing_book.subtitle = subtitle
                updated = True
            if published_year and existing_book.published_year != published_year:
                existing_book.published_year = published_year
                updated = True
            if num_pages and existing_book.num_pages != num_pages:
                existing_book.num_pages = num_pages
                updated = True
            if average_rating and existing_book.average_rating != average_rating:
                existing_book.average_rating = average_rating
                updated = True
            if ratings_count and existing_book.ratings_count != ratings_count:
                existing_book.ratings_count = ratings_count
                updated = True
            if thumbnail and existing_book.thumbnail != thumbnail:
                existing_book.thumbnail = thumbnail
                updated = True

            if updated:
                books_to_update.append(existing_book)
                updated_count += 1
            else:
                skipped_count += 1
        else:
            # Create new book for this department
            new_book = Book(
                title=title,
                subtitle=subtitle,
                authors=authors,
                categories=categories,
                description=description,
                published_year=published_year,
                num_pages=num_pages,
                average_rating=average_rating,
                ratings_count=ratings_count,
                thumbnail=thumbnail,
                quantity=quantity,
                department=department
            )
            books_to_create.append(new_book)
            # Add to local maps to prevent duplicates if repeated within the same CSV file
            existing_books[key] = new_book
            existing_by_title[title.lower()] = new_book
            created_count += 1

    # Execute inside transaction
    with transaction.atomic():
        if books_to_create:
            Book.objects.bulk_create(books_to_create, batch_size=500)
        if books_to_update:
            fields_to_update = [
                'quantity', 'authors', 'categories', 'description', 
                'subtitle', 'published_year', 'num_pages', 
                'average_rating', 'ratings_count', 'thumbnail'
            ]
            Book.objects.bulk_update(books_to_update, fields_to_update, batch_size=500)

    error_count = len(row_errors)
    return {
        "success": True,
        "message": f"Import completed. {created_count} created, {updated_count} updated, {skipped_count} skipped, {error_count} errors.",
        "total_rows": total_rows,
        "created": created_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "errors": error_count,
        "row_errors": row_errors[:50]
    }
