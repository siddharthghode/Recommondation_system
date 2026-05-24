FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir gunicorn \
    Django==6.0.1 django-cors-headers==4.0.0 django-filter==25.2 \
    djangorestframework==3.16.1 djangorestframework_simplejwt==5.5.1 \
    python-dotenv==1.2.1 psycopg2-binary==2.9.10 \
    scikit-learn==1.6.1 numpy==2.4.1 pandas==2.3.3 \
    argon2-cffi==23.1.0 Faker==25.8.0

COPY . .

EXPOSE 8000

CMD ["gunicorn", "book_recommondation.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
