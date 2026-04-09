import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, UserProfile, Department
from books.models import Book, BookInteraction

class Command(BaseCommand):
    help = 'Creates demo users (Admin, Lib, 3 Students) and 200 random ML interactions'

    def handle(self, *args, **options):
        # 1. Setup Admin
        admin, _ = User.objects.get_or_create(
            username='admin', 
            defaults={'first_name': 'Admin', 'role': 'admin', 'is_staff': True, 'is_superuser': True}
        )
        admin.set_password('admin123')
        admin.save()

        # 2. Setup Librarian
        dept, _ = Department.objects.get_or_create(name='Computer Science')
        lib, _ = User.objects.get_or_create(
            username='librarian_cs', 
            defaults={'first_name': 'Jessica', 'last_name': 'Pearson', 'role': 'librarian', 'department': dept}
        )
        lib.set_password('password123')
        lib.save()

        # 3. Setup 3 Students
        students = []
        for i in range(1, 4):
            username = f'student{i}'
            student, _ = User.objects.get_or_create(
                username=username,
                defaults={'first_name': f'Student', 'last_name': str(i), 'role': 'student'}
            )
            student.set_password('password123')
            student.save()
            
            # Ensure profile exists for ML category tracking
            UserProfile.objects.get_or_create(
                user=student, 
                defaults={'student_id': f'STU00{i}'}
            )
            students.append(student)

        self.stdout.write(self.style.SUCCESS('✓ Users and Profiles created (Admin, Librarian, 3 Students)'))

        # 4. Generate 200 Random Interactions
        self.stdout.write(self.style.HTTP_INFO('Generating 200 ML interactions...'))
        
        books = list(Book.objects.all())
        if not books:
            self.stdout.write(self.style.WARNING('No books found! Run import_books first.'))
            return

        interaction_types = ['view', 'like', 'borrow']
        total_goal = 200
        created_count = 0

        while created_count < total_goal:
            # Pick a random student and book
            current_student = random.choice(students)
            current_book = random.choice(books)
            
            # Weighted choice: 70% view, 20% like, 10% borrow
            i_type = random.choices(interaction_types, weights=[70, 20, 10])[0]

            # We use .create() instead of .get_or_create() to allow 
            # multiple interactions for better ML signals.
            BookInteraction.objects.create(
                user=current_student,
                book=current_book,
                interaction_type=i_type,
                created_at=timezone.now() - timedelta(days=random.randint(1, 30))
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(f'✅ Successfully added {created_count} interactions.'))