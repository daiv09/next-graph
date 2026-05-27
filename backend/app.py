# backend/app.py
"""FastAPI entrypoint for uvicorn.
We import the FastAPI app defined in main.py and include additional routers.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import the main FastAPI app (re-exported as `app` for uvicorn)
from main import app  # noqa: F401

# Include routers
from routers import router as main_router
from backend.routers.commits import router as commits_router
from backend.routers.file_metadata import router as file_metadata_router
from backend.routers.commit_detail import router as commit_detail_router

app.include_router(main_router)
app.include_router(commits_router)
app.include_router(file_metadata_router)
app.include_router(commit_detail_router)
