from fastapi import APIRouter, HTTPException, Query
import httpx
import os
import time
from typing import List, Dict, Tuple

router = APIRouter()

# Simple in-memory cache {key: (timestamp, data)}
_commit_cache: Dict[str, Tuple[float, List[dict]]] = {}
CACHE_TTL = 300  # seconds


def get_github_headers():
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _fetch_commits(owner: str, repo: str, branch: str, limit: int, client: httpx.AsyncClient) -> List[dict]:
    """Try fetching commits with the given branch; fallback to 'master' if 404."""
    api_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    params = {"sha": branch, "per_page": min(limit, 100)}
    resp = await client.get(api_url, headers=get_github_headers(), params=params, timeout=20.0)

    if resp.status_code == 404 and branch == "main":
        # Fallback to master
        params["sha"] = "master"
        resp = await client.get(api_url, headers=get_github_headers(), params=params, timeout=20.0)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch commits from GitHub")

    raw = resp.json()
    commits = []
    for c in raw:
        commits.append({
            "sha": c.get("sha"),
            "date": c.get("commit", {}).get("author", {}).get("date"),
            "message": (c.get("commit", {}).get("message") or "").split("\n")[0],
        })
    return commits


@router.get("/commits", summary="Fetch recent commit history for a repository")
async def get_commits(
    repo_url: str = Query(..., description="Full GitHub repo URL, e.g. https://github.com/owner/repo"),
    branch: str = Query("main", description="Default branch name"),
    per_page: int = Query(100, ge=1, le=200, description="Maximum number of commits to return"),
):
    # Extract owner and repo
    try:
        parts = repo_url.rstrip("/").split("github.com/")[1].split("/")
        owner, repo = parts[0], parts[1]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    cache_key = f"{owner}/{repo}/{branch}/{per_page}"
    now = time.time()
    if cache_key in _commit_cache:
        ts, data = _commit_cache[cache_key]
        if now - ts < CACHE_TTL:
            return {"commits": data}

    async with httpx.AsyncClient() as client:
        commits = await _fetch_commits(owner, repo, branch, per_page, client)
        _commit_cache[cache_key] = (now, commits)
        return {"commits": commits}
