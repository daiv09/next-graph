from fastapi import APIRouter, HTTPException, Query
import httpx
import os
import time
from typing import Dict, Tuple

router = APIRouter()

# Cache per SHA (commit content never changes)
_cache: Dict[str, Tuple[float, dict]] = {}
CACHE_TTL = 86400  # 24 hours — commit data is immutable


def get_github_headers():
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


@router.get("/commit-files", summary="Get list of files changed in a single commit")
async def get_commit_files(
    repo_url: str = Query(..., description="Full GitHub repo URL"),
    sha: str = Query(..., description="Commit SHA"),
):
    try:
        parts = repo_url.rstrip("/").split("github.com/")[1].split("/")
        owner, repo = parts[0], parts[1]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    cache_key = f"{owner}/{repo}/{sha}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return data

    api_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            api_url, headers=get_github_headers(), timeout=15.0
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"GitHub API error: {resp.status_code}",
            )
        data = resp.json()
        files = data.get("files", [])
        result = {
            "sha": sha,
            "added": [f["filename"] for f in files if f["status"] == "added"],
            "modified": [
                f["filename"]
                for f in files
                if f["status"] in ("modified", "renamed", "changed", "copied")
            ],
            "deleted": [f["filename"] for f in files if f["status"] == "removed"],
        }
        _cache[cache_key] = (now, result)
        return result
