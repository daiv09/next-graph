# backend/helpers.py
import os
from urllib.parse import urlparse
import httpx
from fastapi import HTTPException, status
from typing import Any, Literal

GITHUB_API_BASE = "https://api.github.com"

# Dependency file definitions (same as original)
DEPENDENCY_FILES: frozenset[str] = frozenset({
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "requirements.txt",
    "requirements.in",
    "Pipfile",
    "Pipfile.lock",
    "pyproject.toml",
    "poetry.lock",
    "setup.py",
    "setup.cfg",
    "Gemfile",
    "Gemfile.lock",
    "go.mod",
    "go.sum",
    "Cargo.toml",
    "Cargo.lock",
    "composer.json",
    "composer.lock",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "pubspec.yaml",
    "pubspec.lock",
    "mix.exs",
    "mix.lock",
    "deps.edn",
    "project.clj",
    "Package.swift",
    "*.csproj",
    "*.fsproj",
    "*.vbproj",
    "nuget.config",
    "packages.config",
})

DEPENDENCY_PATTERNS: tuple[str, ...] = (".csproj", ".fsproj", ".vbproj")

def _extract_owner_repo(url: str) -> tuple[str, str]:
    """Return (owner, repo) from a validated GitHub URL."""
    path = urlparse(url).path
    parts = [p for p in path.split('/') if p]
    repo = parts[1].removesuffix('.git')
    return parts[0], repo

def _is_dependency_file(filename: str) -> bool:
    if filename in DEPENDENCY_FILES:
        return True
    for suffix in DEPENDENCY_PATTERNS:
        if filename.endswith(suffix):
            return True
    return False

def _node_id(path: str) -> str:
    """Stable, filesystem-safe node id derived from the tree path."""
    return path.replace('/', '__').replace('.', '_')

def _build_graph(tree_items: list[dict[str, Any]], owner: str, repo: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    root_id = "root"
    nodes[root_id] = {
        "id": root_id,
        "type": "root",
        "data": {"label": repo, "owner": owner, "repo": repo, "description": f"github.com/{owner}/{repo}"},
        "position": {"x": 0.0, "y": 0.0},
    }

    def ensure_folder(folder_path: str) -> str:
        folder_id = _node_id(folder_path)
        if folder_id in nodes:
            return folder_id
        parts = folder_path.rsplit('/', 1)
        if len(parts) == 1:
            parent_id = root_id
        else:
            parent_id = ensure_folder(parts[0])
        folder_name = folder_path.split('/')[-1]
        nodes[folder_id] = {
            "id": folder_id,
            "type": "folder",
            "data": {"label": folder_name + "/", "path": folder_path},
            "position": {"x": 0.0, "y": 0.0},
        }
        edges.append({"id": f"e_{parent_id}__{folder_id}", "source": parent_id, "target": folder_id})
        return folder_id

    for item in tree_items:
        path: str = item.get("path", "")
        item_type: str = item.get("type", "blob")
        item_size: int | None = item.get("size")
        if item_type == "tree":
            ensure_folder(path)
            continue
        file_id = _node_id(path)
        filename = path.split('/')[-1]
        node_type: Literal["file", "dependency"] = "dependency" if _is_dependency_file(filename) else "file"
        if "/" in path:
            parent_folder = path.rsplit('/', 1)[0]
            parent_id = ensure_folder(parent_folder)
        else:
            parent_id = root_id
        nodes[file_id] = {
            "id": file_id,
            "type": node_type,
            "data": {"label": filename, "path": path, "size": item_size, "sha": item.get("sha")},
            "position": {"x": 0.0, "y": 0.0},
        }
        edges.append({"id": f"e_{parent_id}__{file_id}", "source": parent_id, "target": file_id})
    return list(nodes.values()), edges

def _build_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoGraph-API/1.0",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def _raise_forbidden(resp: httpx.Response) -> None:
    if resp.headers.get("x-ratelimit-remaining") == "0":
        _raise_rate_limit(resp)
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    message = body.get("message", "")
    if "rate limit" in message.lower():
        _raise_rate_limit(resp)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. The repository may be private, or your GitHub token lacks the required permissions.")

def _raise_rate_limit(resp: httpx.Response) -> None:
    reset_ts = resp.headers.get("x-ratelimit-reset", "unknown")
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"GitHub API rate limit exceeded. Resets at Unix timestamp: {reset_ts}. Set the GITHUB_TOKEN environment variable to increase limits.",
        headers={"Retry-After": reset_ts},
    )

def _calculate_metrics(content: str, filename: str) -> dict[str, Any]:
    import os
    lines = content.splitlines()
    loc = len(lines)
    func_count = 0
    class_count = 0
    complexity_score = 1
    ext = os.path.splitext(filename)[1].lower()
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if ext in ('.py', '.pyw'):
            if stripped.startswith('def '):
                func_count += 1
            if stripped.startswith('class '):
                class_count += 1
        elif ext in ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'):
            if stripped.startswith('function ') or 'function(' in stripped:
                func_count += 1
            elif '=> ' in stripped and ('const ' in stripped or 'let ' in stripped or 'var ' in stripped):
                func_count += 1
            elif stripped.startswith('class ') or 'class extends' in stripped:
                class_count += 1
        words = stripped.split()
        for w in words:
            clean_w = w.strip('():{}[],;')
            if clean_w in ('if', 'elif', 'for', 'while', 'catch', 'case', '&&', '||', 'and', 'or'):
                complexity_score += 1
    if complexity_score <= 6:
        rating = "Low"
        recommendation = "Highly maintainable code. Simple and straightforward."
    elif complexity_score <= 18:
        rating = "Moderate"
        recommendation = "Moderate complexity. Well-structured but monitor growth."
    elif complexity_score <= 32:
        rating = "High"
        recommendation = "High complexity. Consider refactoring or splitting functions."
    else:
        rating = "Critical"
        recommendation = "Critical complexity! Refactoring is highly recommended to improve readability."
    return {
        "loc": loc,
        "functions": func_count,
        "classes": class_count,
        "complexity": complexity_score,
        "rating": rating,
        "recommendation": recommendation,
    }
