import os
import django
import sys
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_recommondation.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from books.models import Book

User = get_user_model()

client = APIClient()

results = {}

# 1. Register student
print('1) Registering student...')
reg_payload = {
    'username': 'teststudent',
    'password': 'strongpass123',
    'student_id': 'S12345',
    'email': 'teststudent@example.com',
    'first_name': 'Test',
    'last_name': 'Student'
}
resp = client.post('/api/auth/register/', reg_payload, format='json')
print('  -> status', resp.status_code)
results['register_status'] = resp.status_code
results['register_data'] = resp.json()

if resp.status_code != 200:
    print('Register failed:', resp.content)

# 2. Login
print('2) Logging in...')
login_payload = {'username': 'teststudent', 'password': 'strongpass123'}
resp = client.post('/api/auth/login/', login_payload, format='json')
print('  -> status', resp.status_code)
results['login_status'] = resp.status_code
results['login_data'] = resp.json()

if resp.status_code != 200:
    print('Login failed:', resp.content)
    sys.exit(1)

access = resp.json().get('access')
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

# 3. Browse books
print('3) Browsing books...')
resp = client.get('/api/books/')
print('  -> status', resp.status_code)
results['books_list_status'] = resp.status_code
try:
    results['books_list_count'] = len(resp.json())
except Exception:
    results['books_list_count'] = None

# 4. Search & filter books
print('4) Searching books (search=Python)...')
resp_search = client.get('/api/books/?search=Python')
print('  -> status', resp_search.status_code)
results['search_status'] = resp_search.status_code

print('   Filtering by category if available...')
resp_cat = client.get('/api/books/?category=Science')
print('  -> status', resp_cat.status_code)
results['category_status'] = resp_cat.status_code

# 5. Request borrow
print('5) Requesting borrow...')
# pick first available book
books = resp.json() if resp.status_code == 200 else []
book_id = None
for b in books:
    if b.get('quantity', 0) > 0:
        book_id = b['id']
        break

if not book_id:
    # try to find any book in DB
    b = Book.objects.filter(quantity__gt=0).first()
    if b:
        book_id = b.id

if not book_id:
    print('No available book to borrow; skipping borrow request')
    results['borrow_request_status'] = 'skipped_no_book'
else:
    resp = client.post('/api/borrow/request/', {'book_id': book_id}, format='json')
    print('  -> status', resp.status_code)
    results['borrow_request_status'] = resp.status_code
    results['borrow_request_data'] = resp.json()

# 6. View My Borrows
print('6) Getting my borrows...')
resp = client.get('/api/borrow/my/')
print('  -> status', resp.status_code)
results['my_borrows_status'] = resp.status_code
try:
    results['my_borrows_count'] = len(resp.json())
except Exception:
    results['my_borrows_count'] = None

# 7. Trigger recommendation update
print('7) Getting recommendations...')
resp = client.get('/api/books/recommendations/')
print('  -> status', resp.status_code)
results['recommendations_status'] = resp.status_code

print('\nSummary:')
print(json.dumps(results, indent=2))

# Exit with non-zero if any critical call failed
critical = ['register_status','login_status','books_list_status','recommendations_status']
for k in critical:
    if results.get(k) != 200:
        print('\nOne or more critical endpoints failed. Exiting with code 2')
        sys.exit(2)

print('\nAll critical endpoints returned 200')
