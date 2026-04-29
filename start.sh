#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo "Starting Django backend..."
cd "$ROOT/backend"
source booksenv/bin/activate
python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!

# Start frontend
echo "Starting React frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend  → http://localhost:8000"
echo "Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Stop both on Ctrl+C
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM

wait
