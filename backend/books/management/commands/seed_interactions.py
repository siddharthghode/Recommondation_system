import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from books.models import Book, BookInteraction

try:
    from faker import Faker
except Exception:  # pragma: no cover
    Faker = None


class Command(BaseCommand):
    help = "Generates fake BookInteraction records for testing"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=500, help="Number of interactions to create")

    def handle(self, *args, **kwargs):
        if Faker is None:
            self.stderr.write(
                self.style.ERROR(
                    "Faker is not installed. Run: pip install Faker (or add it to requirements.txt)"
                )
            )
            return

        target = int(kwargs.get("count", 500))
        fake = Faker()
        User = get_user_model()

        users = list(User.objects.all())
        books = list(Book.objects.all())

        if not users or not books:
            self.stderr.write(self.style.ERROR("No users or books found in database."))
            return

        types = ["view", "like", "borrow"]
        weights = [0.7, 0.2, 0.1]
        created = 0

        while created < target:
            user = random.choice(users)
            book = random.choice(books)
            i_type = random.choices(types, weights=weights, k=1)[0]

            # Generate a timestamp within last 30 days
            base_ts = fake.date_time_between(
                start_date="-30d",
                end_date="now",
                tzinfo=timezone.get_current_timezone(),
            )

            # Ensure borrow implies a prior view
            if i_type == "borrow":
                has_view = BookInteraction.objects.filter(
                    user=user, book=book, interaction_type="view"
                ).exists()

                if not has_view and created < target:
                    view_ts = base_ts - timedelta(hours=random.randint(1, 72))
                    view = BookInteraction.objects.create(
                        user=user, book=book, interaction_type="view"
                    )
                    BookInteraction.objects.filter(pk=view.pk).update(created_at=view_ts)
                    created += 1

                if created >= target:
                    break

            interaction = BookInteraction.objects.create(
                user=user, book=book, interaction_type=i_type
            )
            BookInteraction.objects.filter(pk=interaction.pk).update(created_at=base_ts)
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully created {created} interactions"))
