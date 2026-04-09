import os
import django
import sys
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_recommondation.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from accounts.models import Department
from books.models import Book
from borrows.models import Borrow

User = get_user_model()
client = APIClient()

results = {}

# Setup departments
dept_a, _ = Department.objects.get_or_create(name='DeptA')
dept_b, _ = Department.objects.get_or_create(name='DeptB')

# Create book
book, _ = Book.objects.get_or_create(title='Librarian Test Book', defaults={'authors':'Author','categories':'Test','quantity':2, 'description':'desc'})
book.quantity = 2
book.save()

# Create student in DeptA
stu_a, created = User.objects.get_or_create(username='stu_depta', defaults={'email':'a@example.com','role':'student'})
if created:
    stu_a.set_password('pass1234')
    stu_a.save()
    # ensure profile department set
    if hasattr(stu_a, 'profile'):
        stu_a.profile.department = dept_a
        stu_a.profile.save()

# Create student in DeptB
stu_b, created = User.objects.get_or_create(username='stu_deptb', defaults={'email':'b@example.com','role':'student'})
if created:
    stu_b.set_password('pass1234')
    stu_b.save()
    if hasattr(stu_b, 'profile'):
        stu_b.profile.department = dept_b
        stu_b.profile.save()

# Create librarian for DeptA
lib, created = User.objects.get_or_create(username='lib_depta', defaults={'email':'lib@example.com','role':'librarian','department':dept_a})
if created:
    lib.set_password('libpass')
    lib.department = dept_a
    lib.save()

# Students login and request borrows
print('Student A login and request...')
resp = client.post('/api/auth/login/', {'username':'stu_depta','password':'pass1234'}, format='json')
results['stu_a_login_status'] = resp.status_code
access = resp.json().get('access')
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
resp = client.post('/api/borrow/request/', {'book_id': book.id}, format='json')
results['stu_a_request_status'] = resp.status_code

# Student B request
client.credentials()  # clear
resp = client.post('/api/auth/login/', {'username':'stu_deptb','password':'pass1234'}, format='json')
results['stu_b_login_status'] = resp.status_code
access = resp.json().get('access')
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
resp = client.post('/api/borrow/request/', {'book_id': book.id}, format='json')
results['stu_b_request_status'] = resp.status_code

# Librarian login
print('Librarian login...')
client.credentials()
resp = client.post('/api/auth/login/', {'username':'lib_depta','password':'libpass'}, format='json')
results['lib_login_status'] = resp.status_code
access = resp.json().get('access')
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

# View pending borrows
print('Getting pending borrows...')
resp = client.get('/api/borrow/pending/')
results['pending_status'] = resp.status_code
try:
    pending = resp.json()
except Exception:
    pending = []
results['pending_count'] = len(pending) if isinstance(pending, list) else None

# Ensure pending only contains DeptA requests (should include stu_depta but not stu_deptb)
pending_usernames = [p['user'] if 'user' in p else p.get('user') for p in pending] if isinstance(pending, list) else []
results['pending_usernames'] = pending_usernames

# Approve first pending borrow if present
if pending and isinstance(pending, list) and len(pending) > 0:
    borrow_id = pending[0]['id'] if 'id' in pending[0] else pending[0].get('id')
    # capture quantity before
    book.refresh_from_db()
    before_q = book.quantity
    resp = client.post(f'/api/borrow/approve/{borrow_id}/')
    results['approve_status'] = resp.status_code
    book.refresh_from_db()
    results['quantity_before'] = before_q
    results['quantity_after'] = book.quantity
    # fetch borrow
    b = Borrow.objects.get(id=borrow_id)
    results['borrow_status_after'] = b.status
else:
    results['approve_status'] = 'no_pending'

print(json.dumps(results, indent=2))

# Assertions / exit codes
if results.get('lib_login_status') != 200:
    print('Librarian login failed')
    sys.exit(2)

# Librarian should only see DeptA (1 request)
if results.get('pending_count') != 1:
    print('Pending borrows not filtered by department')
    sys.exit(3)

if results.get('approve_status') != 200:
    print('Approve failed')
    sys.exit(4)

if results.get('quantity_after') != results.get('quantity_before') - 1:
    print('Quantity not decremented correctly')
    sys.exit(5)

if results.get('borrow_status_after') != 'approved':
    print('Borrow status not updated')
    sys.exit(6)

print('Librarian E2E passed')
