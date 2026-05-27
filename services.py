# services.py
import os
import re
from typing import Any, Literal
from urllib.parse import urlparse
import httpx
from fastapi import HTTPException, status

from constants import DEPENDENCY_FILES, DEPENDENCY_PATTERNS
from schemas import ReactFlowNode, ReactFlowEdge

def extract_owner_repo(url: str) -> tuple[str, str]:
    path = urlparse(url).path
    parts = [p for p in path.split("/") if p]
    repo = parts[1].removesuffix(".git")
    return parts[0], repo

def is_dependency_file(filename: str) -> bool:
    if filename in DEPENDENCY_FILES:
        return True
    for suffix in DEPENDENCY_PATTERNS:
        if filename.endswith(suffix):
            return True
    return False

def node_id(path: str) -> str:
    return path.replace("/", "__").replace(".", "_")

def build_headers() -> dict[str, str]:
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoGraph-API/1.0",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def raise_forbidden(resp: httpx.Response) -> None:
    if resp.headers.get("x-ratelimit-remaining") == "0":
        raise_rate_limit(resp)
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    message = body.get("message", "")
    if "rate limit" in message.lower():
        raise_rate_limit(resp)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. The repository may be private, or your GitHub token lacks the required permissions.",
    )

def raise_rate_limit(resp: httpx.Response) -> None:
    reset_ts = resp.headers.get("x-ratelimit-reset", "unknown")
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"GitHub API rate limit exceeded. Resets at Unix timestamp: {reset_ts}. Set the GITHUB_TOKEN environment variable to increase limits.",
        headers={"Retry-After": reset_ts},
    )

def build_graph(tree_items: list[dict[str, Any]], owner: str, repo: str) -> tuple[list[ReactFlowNode], list[ReactFlowEdge]]:
    nodes: dict[str, ReactFlowNode] = {}
    edges: list[ReactFlowEdge] = []
    root_id = "root"

    nodes[root_id] = ReactFlowNode(
        id=root_id, type="root",
        data={"label": repo, "owner": owner, "repo": repo, "description": f"github.com/{owner}/{repo}"}
    )

    def ensure_folder(folder_path: str) -> str:
        folder_node_id = node_id(folder_path)
        if folder_node_id in nodes:
            return folder_node_id

        parts = folder_path.rsplit("/", 1)
        parent_id = root_id if len(parts) == 1 else ensure_folder(parts[0])
        folder_name = folder_path.split("/")[-1]
        
        nodes[folder_node_id] = ReactFlowNode(
            id=folder_node_id, type="folder",
            data={"label": folder_name + "/", "path": folder_path}
        )
        edges.append(ReactFlowEdge(id=f"e_{parent_id}__{folder_node_id}", source=parent_id, target=folder_node_id))
        return folder_node_id

    for item in tree_items:
        path: str = item.get("path", "")
        item_type: str = item.get("type", "blob")
        item_size: int | None = item.get("size")

        if item_type == "tree":
            ensure_folder(path)
            continue

        file_id = node_id(path)
        filename = path.split("/")[-1]
        node_type: Literal["file", "dependency"] = "dependency" if is_dependency_file(filename) else "file"

        parent_id = ensure_folder(path.rsplit("/", 1)[0]) if "/" in path else root_id

        nodes[file_id] = ReactFlowNode(
            id=file_id, type=node_type,
            data={"label": filename, "path": path, "size": item_size, "sha": item.get("sha")}
        )
        edges.append(ReactFlowEdge(id=f"e_{parent_id}__{file_id}", source=parent_id, target=file_id))

    return list(nodes.values()), edges

def calculate_metrics(content: str, filename: str) -> dict[str, Any]:
    lines = content.splitlines()
    loc = len(lines)
    func_count, class_count, complexity_score = 0, 0, 1
    ext = os.path.splitext(filename)[1].lower()
    
    for line in lines:
        stripped = line.strip()
        if not stripped: continue
        
        if ext in ('.py', '.pyw'):
            if stripped.startswith('def '): func_count += 1
            if stripped.startswith('class '): class_count += 1
        elif ext in ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'):
            if stripped.startswith('function ') or 'function(' in stripped: func_count += 1
            elif '=>' in stripped and ('const ' in stripped or 'let ' in stripped or 'var ' in stripped): func_count += 1
            elif stripped.startswith('class ') or 'class extends' in stripped: class_count += 1
        
        for w in stripped.split():
            if w.strip('():{}[],;') in ('if', 'elif', 'for', 'while', 'catch', 'case', '&&', '||', 'and', 'or'):
                complexity_score += 1

    if complexity_score <= 6:
        rating, rec = "Low", "Highly maintainable code. Simple and straightforward."
    elif complexity_score <= 18:
        rating, rec = "Moderate", "Moderate complexity. Well-structured but monitor growth."
    elif complexity_score <= 32:
        rating, rec = "High", "High complexity. Consider refactoring or splitting functions."
    else:
        rating, rec = "Critical", "Critical complexity! Refactoring is highly recommended to improve readability."

    return {"loc": loc, "functions": func_count, "classes": class_count, "complexity": complexity_score, "rating": rating, "recommendation": rec}