#!/bin/bash

cleanup() {
    echo "==> Stopping servers..."
    kill $(jobs -p) 2>/dev/null
    wait
    exit 0
}
trap cleanup SIGINT SIGTERM

#backend
echo "==> Starting Backend..."
cd /home/sidhharth/sppu/git/Recommondation_system/backend
source bookenv/bin/activate
python manage.py runserver &

#frontend
echo "==> Starting Frontend..."
cd /home/sidhharth/sppu/git/Recommondation_system/frontend
npm run dev &

wait
