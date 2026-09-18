import sys
import os

# Add the project root to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app

# Vercel expects a variable named `app` (WSGI callable)
