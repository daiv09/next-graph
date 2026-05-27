# backend/app.py
"""FastAPI entrypoint for uvicorn.
We simply import the existing FastAPI instance defined in the top‑level ``main.py``
so that ``uvicorn backend.app:app`` works without moving the whole file.
"""
import sys
from pathlib import Path

# Add the project root to ``sys.path`` so we can import ``main``
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import the FastAPI app that is already defined in ``main.py``
from main import app  # noqa: F401  (re‑exported as ``backend.app:app``)
