from fastapi import APIRouter, HTTPException, Query
import httpx
import os
import time
from typing import Dict, Tuple

router = APIRouter()

# Simple in-memory cache {key: (timestamp, data)}
_cache: Dict[str, Tuple[float, dict]] = {}
CACHE_TTL = 300  # seconds

def get_github_headers():
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

@router.get("/file-metadata", summary="Get first commit metadata for a file or folder")
async def get_file_metadata(
    repo_url: str = Query(..., description="Full GitHub repo URL, e.g. https://github.com/owner/repo"),
    path: str = Query(..., description="Path within the repository (file or folder)"),
    branch: str = Query("main", description="Branch name"),
):
    # Extract owner/repo
    try:
        parts = repo_url.rstrip("/").split("github.com/")[1].split("/")
        owner, repo = parts[0], parts[1]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid repository URL")

    cache_key = f"metadata:{owner}/{repo}/{branch}/{path}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return data

    api_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    params = {"sha": branch, "path": path, "per_page": 1}
    async with httpx.AsyncClient() as client:
        resp = await client.get(api_url, headers=get_github_headers(), params=params, timeout=15.0)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch file metadata")
        commits = resp.json()
        if not commits:
            raise HTTPException(status_code=404, detail="No commits found for the given path")
        first = commits[0]
        result = {
            "sha": first.get("sha"),
            "date": first.get("commit", {}).get("author", {}).get("date"),
            "message": first.get("commit", {}).get("message").split("\n")[0],
        }
        _cache[cache_key] = (now, result)
        return result
