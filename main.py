import re
import os
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator, HttpUrl

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

GITHUB_API_BASE = "https://api.github.com"

# Files that signal a dependency manifest; node type is flagged accordingly.
DEPENDENCY_FILES: frozenset[str] = frozenset(
    {
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
    }
)

# Glob-style patterns that are simple suffix/prefix checks (not real globs).
DEPENDENCY_PATTERNS: tuple[str, ...] = (".csproj", ".fsproj", ".vbproj")

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────


class ParseRepoRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        v = v.strip().rstrip("/")
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme.")
        if parsed.netloc not in ("github.com", "www.github.com"):
            raise ValueError("URL must be a github.com repository URL.")
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 2:
            raise ValueError(
                "URL must point to a repository: https://github.com/owner/repo"
            )
        return v


class ReactFlowNode(BaseModel):
    id: str
    type: Literal["root", "folder", "file", "dependency"]
    data: dict[str, Any]
    position: dict[str, float] = {"x": 0.0, "y": 0.0}


class ReactFlowEdge(BaseModel):
    id: str
    source: str
    target: str


class ParseRepoResponse(BaseModel):
    nodes: list[ReactFlowNode]
    edges: list[ReactFlowEdge]
    meta: dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# App & Middleware
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="RepoGraph API",
    description="Parses a GitHub repository into a React Flow-compatible node/edge graph.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _extract_owner_repo(url: str) -> tuple[str, str]:
    """Return (owner, repo) from a validated github.com URL."""
    path = urlparse(url).path
    parts = [p for p in path.split("/") if p]
    # Strip .git suffix if present
    repo = parts[1].removesuffix(".git")
    return parts[0], repo


def _is_dependency_file(filename: str) -> bool:
    """Return True if the bare filename is a known dependency manifest."""
    if filename in DEPENDENCY_FILES:
        return True
    for suffix in DEPENDENCY_PATTERNS:
        if filename.endswith(suffix):
            return True
    return False


def _node_id(path: str) -> str:
    """Stable, filesystem-safe node id derived from the tree path."""
    # Replace characters that are awkward in React Flow ids
    return path.replace("/", "__").replace(".", "_")


def _build_graph(
    tree_items: list[dict[str, Any]],
    owner: str,
    repo: str,
) -> tuple[list[ReactFlowNode], list[ReactFlowEdge]]:
    """
    Walk the flat list of Git tree items and construct nodes + edges.

    Strategy
    ────────
    1. Insert the repository root as the first node.
    2. For every blob (file) and tree (folder) item, ensure all ancestor
       folder nodes exist before creating the item's own node.
    3. Connect each node to its parent via a directed edge.
    """
    nodes: dict[str, ReactFlowNode] = {}
    edges: list[ReactFlowEdge] = []
    root_id = "root"

    # ── root node ────────────────────────────────────────────────────────────
    nodes[root_id] = ReactFlowNode(
        id=root_id,
        type="root",
        data={
            "label": repo,
            "owner": owner,
            "repo": repo,
            "description": f"github.com/{owner}/{repo}",
        },
        position={"x": 0.0, "y": 0.0},
    )

    def ensure_folder(folder_path: str) -> str:
        """Recursively ensure a folder node (and all its ancestors) exist."""
        folder_id = _node_id(folder_path)
        if folder_id in nodes:
            return folder_id

        parts = folder_path.rsplit("/", 1)
        if len(parts) == 1:
            # Direct child of root
            parent_id = root_id
        else:
            parent_id = ensure_folder(parts[0])

        folder_name = folder_path.split("/")[-1]
        nodes[folder_id] = ReactFlowNode(
            id=folder_id,
            type="folder",
            data={"label": folder_name + "/", "path": folder_path},
            position={"x": 0.0, "y": 0.0},
        )
        edges.append(
            ReactFlowEdge(
                id=f"e_{parent_id}__{folder_id}",
                source=parent_id,
                target=folder_id,
            )
        )
        return folder_id

    # ── process every tree item ───────────────────────────────────────────────
    for item in tree_items:
        path: str = item.get("path", "")
        item_type: str = item.get("type", "blob")  # "blob" | "tree"
        item_size: int | None = item.get("size")

        if item_type == "tree":
            # Folders are created on demand via ensure_folder; skip here
            # to avoid duplicate entries when a parent is listed before its child.
            ensure_folder(path)
            continue

        # ── file node ────────────────────────────────────────────────────────
        file_id = _node_id(path)
        filename = path.split("/")[-1]

        node_type: Literal["file", "dependency"] = (
            "dependency" if _is_dependency_file(filename) else "file"
        )

        # Determine parent
        if "/" in path:
            parent_folder = path.rsplit("/", 1)[0]
            parent_id = ensure_folder(parent_folder)
        else:
            parent_id = root_id

        nodes[file_id] = ReactFlowNode(
            id=file_id,
            type=node_type,
            data={
                "label": filename,
                "path": path,
                "size": item_size,
                "sha": item.get("sha"),
            },
            position={"x": 0.0, "y": 0.0},
        )
        edges.append(
            ReactFlowEdge(
                id=f"e_{parent_id}__{file_id}",
                source=parent_id,
                target=file_id,
            )
        )

    return list(nodes.values()), edges


def _build_headers() -> dict[str, str]:
    """Construct GitHub API request headers, injecting a token when available."""
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoGraph-API/1.0",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ─────────────────────────────────────────────────────────────────────────────
# Route
# ─────────────────────────────────────────────────────────────────────────────


@app.post(
    "/parse-repo",
    response_model=ParseRepoResponse,
    summary="Parse a GitHub repository into a React Flow graph",
    responses={
        200: {"description": "Graph payload ready for React Flow"},
        400: {"description": "Invalid or non-GitHub URL"},
        403: {"description": "Private repository or insufficient permissions"},
        404: {"description": "Repository or default branch not found"},
        422: {"description": "Request body failed validation"},
        429: {"description": "GitHub API rate limit exceeded"},
        502: {"description": "Upstream GitHub API error"},
    },
)
async def parse_repo(body: ParseRepoRequest) -> ParseRepoResponse:
    owner, repo = _extract_owner_repo(body.url)
    headers = _build_headers()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # ── Step 1: resolve the default branch via repo metadata ─────────────
        repo_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
        repo_resp = await client.get(repo_url, headers=headers)

        if repo_resp.status_code == 301:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repository has been permanently moved. Please update the URL.",
            )
        if repo_resp.status_code == 403:
            _raise_forbidden(repo_resp)
        if repo_resp.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository '{owner}/{repo}' not found or is private.",
            )
        if repo_resp.status_code == 429 or (
            repo_resp.status_code == 403
            and repo_resp.headers.get("x-ratelimit-remaining") == "0"
        ):
            _raise_rate_limit(repo_resp)
        if repo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub API returned an unexpected status: {repo_resp.status_code}",
            )

        repo_data = repo_resp.json()
        default_branch: str = repo_data.get("default_branch", "main")
        repo_description: str = repo_data.get("description") or ""
        repo_stars: int = repo_data.get("stargazers_count", 0)
        repo_language: str = repo_data.get("language") or ""

        # ── Step 2: fetch the entire tree recursively ─────────────────────────
        tree_url = (
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
            f"/git/trees/{default_branch}?recursive=1"
        )
        tree_resp = await client.get(tree_url, headers=headers)

        if tree_resp.status_code == 403:
            _raise_forbidden(tree_resp)
        if tree_resp.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Default branch '{default_branch}' not found in '{owner}/{repo}'. "
                    "The repository may be empty."
                ),
            )
        if tree_resp.status_code == 409:
            # Git conflict / empty repo
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository '{owner}/{repo}' appears to be empty (no commits).",
            )
        if tree_resp.status_code == 429 or (
            tree_resp.status_code == 403
            and tree_resp.headers.get("x-ratelimit-remaining") == "0"
        ):
            _raise_rate_limit(tree_resp)
        if tree_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub Trees API returned an unexpected status: {tree_resp.status_code}",
            )

        tree_data = tree_resp.json()
        tree_items: list[dict[str, Any]] = tree_data.get("tree", [])
        truncated: bool = tree_data.get("truncated", False)

        # ── Step 3: build graph ───────────────────────────────────────────────
        nodes, edges = _build_graph(tree_items, owner, repo)

        return ParseRepoResponse(
            nodes=nodes,
            edges=edges,
            meta={
                "owner": owner,
                "repo": repo,
                "default_branch": default_branch,
                "description": repo_description,
                "stars": repo_stars,
                "language": repo_language,
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "truncated": truncated,
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Error helpers
# ─────────────────────────────────────────────────────────────────────────────


def _raise_forbidden(resp: httpx.Response) -> None:
    """Distinguish rate-limit 403s from genuine permission errors."""
    if resp.headers.get("x-ratelimit-remaining") == "0":
        _raise_rate_limit(resp)
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    message = body.get("message", "")
    if "rate limit" in message.lower():
        _raise_rate_limit(resp)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "Access denied. The repository may be private, or your GitHub token "
            "lacks the required permissions."
        ),
    )


def _raise_rate_limit(resp: httpx.Response) -> None:
    reset_ts = resp.headers.get("x-ratelimit-reset", "unknown")
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=(
            f"GitHub API rate limit exceeded. "
            f"Resets at Unix timestamp: {reset_ts}. "
            "Set the GITHUB_TOKEN environment variable to increase limits."
        ),
        headers={"Retry-After": reset_ts},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Chat Schemas and Endpoint
# ─────────────────────────────────────────────────────────────────────────────


class FileContentRequest(BaseModel):
    repo_url: str
    path: str
    branch: str | None = None


@app.post(
    "/file-content",
    summary="Retrieve file contents from GitHub or local workspace",
)
async def get_file_content(body: FileContentRequest):
    # For placeholder/local file preview testing
    if "owner/repository" in body.repo_url or "next-graph" in body.repo_url:
        import os
        # Convert path delimiters if needed
        norm_path = body.path.replace("/", os.sep)
        local_path = os.path.join(os.getcwd(), norm_path)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            try:
                with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                    return {"content": f.read()}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Local read error: {str(e)}")

    try:
        owner, repo = _extract_owner_repo(body.repo_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    branch = body.branch or "main"
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{body.path}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(raw_url, follow_redirects=True, timeout=10.0)
            if resp.status_code == 404 and not body.branch:
                # Try fallback branch "master"
                fallback_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{body.path}"
                resp = await client.get(fallback_url, follow_redirects=True, timeout=10.0)
            
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Failed to fetch file content from GitHub (status: {resp.status_code})"
                )
            
            return {"content": resp.text}
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"GitHub connection error: {str(exc)}")


class FileContentRequest(BaseModel):
    repo_url: str
    path: str
    branch: str | None = None


@app.post(
    "/file-content",
    summary="Retrieve file contents from GitHub or local workspace",
)
async def get_file_content(body: FileContentRequest):
    # For placeholder/local file preview testing
    if "owner/repository" in body.repo_url or "next-graph" in body.repo_url:
        import os
        # Convert path delimiters if needed
        norm_path = body.path.replace("/", os.sep)
        local_path = os.path.join(os.getcwd(), norm_path)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            try:
                with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                    return {"content": f.read()}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Local read error: {str(e)}")

    try:
        owner, repo = _extract_owner_repo(body.repo_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    branch = body.branch or "main"
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{body.path}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(raw_url, follow_redirects=True, timeout=10.0)
            if resp.status_code == 404 and not body.branch:
                # Try fallback branch "master"
                fallback_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{body.path}"
                resp = await client.get(fallback_url, follow_redirects=True, timeout=10.0)
            
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Failed to fetch file content from GitHub (status: {resp.status_code})"
                )
            
            return {"content": resp.text}
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"GitHub connection error: {str(exc)}")


class ChatMessageModel(BaseModel):
    sender: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    repo_name: str
    messages: list[ChatMessageModel]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    selected_node: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    text: str


@app.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask questions about the repository structure",
)
async def chat_about_repo(body: ChatRequest) -> ChatResponse:
    last_user_message = next(
        (m.text for m in reversed(body.messages) if m.sender == "user"), ""
    )
    if not last_user_message:
        return ChatResponse(text="Hello! How can I help you explore this repository today?")

    msg = last_user_message.lower()

    # Extract info from nodes
    files = [
        n
        for n in body.nodes
        if n.get("type") in ("file", "dependency")
        or n.get("data", {}).get("nodeType") in ("file", "dependency")
    ]
    folders = [
        n
        for n in body.nodes
        if n.get("type") == "folder" or n.get("data", {}).get("nodeType") == "folder"
    ]
    deps = [
        n
        for n in body.nodes
        if n.get("type") == "dependency" or n.get("data", {}).get("nodeType") == "dependency"
    ]

    total_size = sum(n.get("data", {}).get("size") or 0 for n in files)
    languages: dict[str, int] = {}
    for n in files:
        label = n.get("data", {}).get("label") or ""
        ext = label.split(".")[-1] if "." in label else "unknown"
        languages[ext] = languages.get(ext, 0) + 1

    # Active Node Context handler
    selected = body.selected_node
    if selected:
        label = selected.get("data", {}).get("label") or selected.get("id") or "unknown"
        node_type = selected.get("data", {}).get("nodeType") or selected.get("type") or "file"
        path = selected.get("data", {}).get("path") or label
        size = selected.get("data", {}).get("size")
        size_str = f" ({size:,} bytes)" if size is not None else ""

        # Answer specifically regarding the selected node
        if any(w in msg for w in ("what", "explain", "role", "tell me", "details", "info", "this")):
            if node_type == "root":
                text = f"You are focusing on the repository root: **{label}**. This represents the top-level directory."
            elif node_type == "folder":
                text = f"You are focusing on the folder **{label}** (path: `{path}`). It contains files or subfolders grouped under it."
            elif node_type == "dependency":
                text = f"This is **{label}** (path: `{path}`), which is a **dependency config file** specifying third-party packages or system dependencies."
            else:
                text = f"This is the file **{label}**{size_str} located at `{path}`. It contains source code or assets for the repository."
            return ChatResponse(text=text)

    if "dependency" in msg or "package" in msg or "module" in msg or "library" in msg:
        dep_list = ", ".join([d.get("data", {}).get("label") or "" for d in deps])
        if dep_list:
            text = f"This repository contains the following dependency configuration files: **{dep_list}**."
        else:
            text = "No standard package or dependency manifest files (like `package.json` or `requirements.txt`) were detected."

    elif "folder" in msg or "directory" in msg or "structure" in msg:
        folder_list = ", ".join([f.get("data", {}).get("label") or "" for f in folders[:10]])
        text = f"This repository contains **{len(folders)} folders** in total. The top folders include: **{folder_list}**."
        if len(folders) > 10:
            text += f" (and {len(folders) - 10} more)."

    elif "size" in msg or "big" in msg or "kilobyte" in msg or "megabyte" in msg:
        kb = total_size / 1024
        text = f"The parsed files in this repository sum up to **{total_size:,} bytes** (~{kb:.1f} KB). The largest file is **{max(files, key=lambda f: f.get('data', {}).get('size') or 0, default={}).get('data', {}).get('label', 'none')}**."

    elif "language" in msg or "tech" in msg or "stack" in msg:
        lang_str = ", ".join([f"*.{k} ({v} files)" for k, v in sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]])
        text = f"Based on file extensions, the codebase language breakdown includes: **{lang_str}**."

    else:
        text = (
            f"Here is a quick summary of **{body.repo_name}**:\n\n"
            f"- **Structure:** {len(folders)} folders, {len(files)} files.\n"
            f"- **Dependencies:** {len(deps)} dependency configurations detected.\n"
            f"- **Total code size:** {total_size:,} bytes.\n"
            f"- **Primary extensions:** {', '.join(list(languages.keys())[:4])}.\n\n"
            "Ask me about 'dependencies', 'folders', 'size', or 'languages' to learn more!"
        )

    return ChatResponse(text=text)


# ─────────────────────────────────────────────────────────────────────────────
# Dev entrypoint
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

