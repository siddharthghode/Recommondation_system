from django.core.management.base import BaseCommand
from accounts.models import User
from borrows.models import Borrow
from books.models import BookInteraction


DEMO_USERNAMES = [
    "admin", "librarian_cs",
    "aarav_sharma", "priya_patil", "rohan_desai", "sneha_kulkarni",
    "vikram_joshi", "ananya_mehta", "karan_singh", "pooja_nair",
    "arjun_rao", "divya_iyer",
]


class Command(BaseCommand):
    help = "Remove all demo users and their associated data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--all", action="store_true",
            help="Delete ALL users (not just demo ones)"
        )

    def handle(self, *args, **options):
        if options["all"]:
            count, _ = User.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f"✓ Deleted all {count} users"))
        else:
            users = User.objects.filter(username__in=DEMO_USERNAMES)
            count = users.count()
            # Cascade deletes borrows/interactions via FK, but be explicit
            Borrow.objects.filter(user__in=users).delete()
            BookInteraction.objects.filter(user__in=users).delete()
            users.delete()
            self.stdout.write(self.style.SUCCESS(
                f"✓ Deleted {count} demo users and their borrow/interaction data"
            ))

        self.stdout.write("\nNext steps:")
        self.stdout.write("  1. python manage.py createsuperuser")
        self.stdout.write("     → set role='admin' via Django admin or shell")
        self.stdout.write("  2. Log in at http://localhost:8000/admin")
        self.stdout.write("     → create Librarian user (role=librarian, assign department)")
        self.stdout.write("  3. Students self-register via the frontend, or create via admin panel")
