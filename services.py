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

def calculate_analytics(tree_items: list[dict[str, Any]]) -> dict[str, Any]:
    typology = {
        "Implementation": 0, "Tests": 0, "Configuration": 0,
        "Documentation": 0, "Infrastructure": 0
    }
    scatter_data = []
    folder_stats: dict[str, dict[str, Any]] = {}
    size_distribution = {
        "<1KB": 0, "1-10KB": 0, "10-50KB": 0, "50-100KB": 0, "100KB+": 0
    }
    root_folders: dict[str, dict[str, int]] = {}
    
    for item in tree_items:
        if item.get("type") == "tree": continue
            
        path = item.get("path", "")
        size = item.get("size") or 0
        depth = len(path.split("/")) - 1
        
        # 1. Typology
        filename = path.split("/")[-1].lower()
        if "test" in path.lower() or "spec" in filename or "mock" in filename:
            typology["Tests"] += 1
        elif filename.endswith((".md", ".txt", ".rst")):
            typology["Documentation"] += 1
        elif filename.endswith((".json", ".yml", ".yaml", ".toml", ".ini", ".env")) or "config" in filename:
            typology["Configuration"] += 1
        elif "docker" in filename or "makefile" in filename or ".github" in path:
            typology["Infrastructure"] += 1
        else:
            typology["Implementation"] += 1
            
        # 2. Scatter
        scatter_data.append({"path": path, "size": size, "depth": depth})
        
        # 3. Treemap
        parent = path.rsplit("/", 1)[0] if "/" in path else "/"
        if parent not in folder_stats:
            folder_stats[parent] = {"name": parent, "size": 0, "fileCount": 0}
        folder_stats[parent]["size"] += size
        folder_stats[parent]["fileCount"] += 1
        
        # 4. Size Dist
        if size < 1024: size_distribution["<1KB"] += 1
        elif size < 10240: size_distribution["1-10KB"] += 1
        elif size < 51200: size_distribution["10-50KB"] += 1
        elif size < 102400: size_distribution["50-100KB"] += 1
        else: size_distribution["100KB+"] += 1
            
        # 5. Radar
        if "/" in path:
            root_folder = path.split("/")[0]
            if root_folder not in root_folders:
                root_folders[root_folder] = {"size_sum": 0, "depth_sum": 0, "fileCount": 0}
            root_folders[root_folder]["size_sum"] += size
            root_folders[root_folder]["depth_sum"] += depth
            root_folders[root_folder]["fileCount"] += 1

    typology_list = [{"name": k, "value": v} for k, v in typology.items() if v > 0]
    treemap_list = list(folder_stats.values())
    distribution_list = [{"name": k, "value": v} for k, v in size_distribution.items()]
    
    top_roots = sorted(root_folders.items(), key=lambda x: x[1]["fileCount"], reverse=True)[:5]
    radar_list = []
    for name, stats in top_roots:
        c = stats["fileCount"]
        radar_list.append({
            "name": name,
            "avgSize": round(stats["size_sum"] / c),
            "avgDepth": round(stats["depth_sum"] / c, 2),
            "fileCount": c
        })
        
    return {
        "typology": typology_list,
        "scatter": scatter_data,
        "treemap": treemap_list,
        "sizeDistribution": distribution_list,
        "radar": radar_list
    }

def generate_tour_steps(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps = []
    
    # 1. Start at root
    steps.append({
        "stepId": "tour-step-1",
        "targetNodeId": "root",
        "title": "Welcome to the Repository",
        "narration": "This is the root of the project. Let's take a guided tour to understand the architecture and key components of this codebase.",
        "zoomLevel": 0.8
    })
    
    # 2. Find a main dependency file (e.g. package.json, requirements.txt, go.mod)
    deps = [n for n in nodes if n.get("type") == "dependency" or n.get("data", {}).get("nodeType") == "dependency"]
    if deps:
        target = deps[0]
        steps.append({
            "stepId": "tour-step-2",
            "targetNodeId": target.get("id", ""),
            "title": "Dependencies & Configuration",
            "narration": f"Here is {target.get('data', {}).get('label', 'a dependency file')}. This file defines the core libraries and system requirements needed to run the project.",
            "zoomLevel": 1.2
        })
        
    # 3. Find the largest file (often core logic)
    files = [n for n in nodes if n.get("type") not in ("folder", "root", "dir") and n.get("data", {}).get("nodeType") not in ("folder", "root", "dir")]
    files.sort(key=lambda x: x.get("data", {}).get("size", 0), reverse=True)
    if files:
        target = files[0]
        label = target.get("data", {}).get("label", "file")
        steps.append({
            "stepId": "tour-step-3",
            "targetNodeId": target.get("id", ""),
            "title": "Heavyweight Logic",
            "narration": f"This is {label}, the largest file in the codebase. It likely contains complex business logic or a massive component structure.",
            "zoomLevel": 1.5
        })
        
    # 4. Find the deepest nested folder
    folders = [n for n in nodes if n.get("type") in ("folder", "dir") or n.get("data", {}).get("nodeType") in ("folder", "dir")]
    folders.sort(key=lambda x: str(x.get("data", {}).get("path", "")).count("/"), reverse=True)
    if folders:
        target = folders[0]
        label = target.get("data", {}).get("label", "folder")
        steps.append({
            "stepId": "tour-step-4",
            "targetNodeId": target.get("id", ""),
            "title": "Deepest Architecture",
            "narration": f"We've reached {label}, the most deeply nested module in the architecture. This represents highly specific sub-domain logic.",
            "zoomLevel": 1.3
        })
        
    return steps