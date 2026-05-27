# routers.py
import os
import httpx
from fastapi import APIRouter, HTTPException, status
from schemas import (
    ParseRepoRequest, ParseRepoResponse, FileContentRequest, 
    ChatRequest, ChatResponse
)
from services import (
    extract_owner_repo, build_headers, raise_forbidden, 
    raise_rate_limit, build_graph, calculate_metrics
)
from constants import GITHUB_API_BASE

router = APIRouter()

@router.post("/parse-repo", response_model=ParseRepoResponse, summary="Parse a GitHub repository into a React Flow graph")
async def parse_repo(body: ParseRepoRequest) -> ParseRepoResponse:
    owner, repo = extract_owner_repo(body.url)
    headers = build_headers()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        repo_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
        repo_resp = await client.get(repo_url, headers=headers)

        if repo_resp.status_code == 301:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Repository moved. Update URL.")
        if repo_resp.status_code == 403:
            raise_forbidden(repo_resp)
        if repo_resp.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Repository '{owner}/{repo}' not found.")
        if repo_resp.status_code == 429 or (repo_resp.status_code == 403 and repo_resp.headers.get("x-ratelimit-remaining") == "0"):
            raise_rate_limit(repo_resp)
        if repo_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Unexpected status: {repo_resp.status_code}")

        repo_data = repo_resp.json()
        default_branch = repo_data.get("default_branch", "main")
        
        tree_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
        tree_resp = await client.get(tree_url, headers=headers)

        if tree_resp.status_code in (403, 429):
            if tree_resp.status_code == 429 or tree_resp.headers.get("x-ratelimit-remaining") == "0":
                raise_rate_limit(tree_resp)
            raise_forbidden(tree_resp)
        if tree_resp.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Default branch not found.")
        if tree_resp.status_code == 409:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository appears to be empty.")

        tree_data = tree_resp.json()
        nodes, edges = build_graph(tree_data.get("tree", []), owner, repo)

        return ParseRepoResponse(
            nodes=nodes, edges=edges,
            meta={
                "owner": owner, "repo": repo, "default_branch": default_branch,
                "description": repo_data.get("description") or "",
                "stars": repo_data.get("stargazers_count", 0),
                "language": repo_data.get("language") or "",
                "total_nodes": len(nodes), "total_edges": len(edges),
                "truncated": tree_data.get("truncated", False),
            },
        )

@router.post("/file-content", summary="Retrieve file contents")
async def get_file_content(body: FileContentRequest):
    if "owner/repository" in body.repo_url or "next-graph" in body.repo_url:
        norm_path = body.path.replace("/", os.sep)
        local_path = os.path.join(os.getcwd(), norm_path)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            try:
                with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                return {"content": content, "metrics": calculate_metrics(content, os.path.basename(local_path))}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Local read error: {str(e)}")

    try:
        owner, repo = extract_owner_repo(body.repo_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    branch = body.branch or "main"
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{body.path}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(raw_url, follow_redirects=True, timeout=10.0)
            if resp.status_code == 404 and not body.branch:
                fallback_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{body.path}"
                resp = await client.get(fallback_url, follow_redirects=True, timeout=10.0)
            
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch file content")
            
            content = resp.text
            return {"content": content, "metrics": calculate_metrics(content, body.path.split("/")[-1])}
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"GitHub connection error: {str(exc)}")

@router.post("/chat", response_model=ChatResponse)
async def chat_about_repo(body: ChatRequest) -> ChatResponse:
    last_user_message = next((m.text for m in reversed(body.messages) if m.sender == "user"), "")
    if not last_user_message:
        return ChatResponse(text="Hello! How can I help you explore this repository today?")

    msg = last_user_message.lower()
    files = [n for n in body.nodes if n.get("type") in ("file", "dependency") or n.get("data", {}).get("nodeType") in ("file", "dependency")]
    folders = [n for n in body.nodes if n.get("type") == "folder" or n.get("data", {}).get("nodeType") == "folder"]
    deps = [n for n in body.nodes if n.get("type") == "dependency" or n.get("data", {}).get("nodeType") == "dependency"]
    
    total_size = sum(n.get("data", {}).get("size") or 0 for n in files)
    languages: dict[str, int] = {}
    for n in files:
        label = n.get("data", {}).get("label") or ""
        ext = label.split(".")[-1] if "." in label else "unknown"
        languages[ext] = languages.get(ext, 0) + 1

    selected = body.selected_node
    if selected:
        label = selected.get("data", {}).get("label") or selected.get("id") or "unknown"
        node_type = selected.get("data", {}).get("nodeType") or selected.get("type") or "file"
        path = selected.get("data", {}).get("path") or label
        size = selected.get("data", {}).get("size")
        size_str = f" ({size:,} bytes)" if size is not None else ""

        if any(w in msg for w in ("what", "explain", "role", "tell me", "details", "info", "this")):
            if node_type == "root":
                text = f"You are focusing on the repository root: **{label}**."
            elif node_type == "folder":
                text = f"You are focusing on the folder **{label}** (path: `{path}`)."
            elif node_type == "dependency":
                text = f"This is **{label}** (path: `{path}`), a dependency config file."
            else:
                text = f"This is the file **{label}**{size_str} located at `{path}`."
            return ChatResponse(text=text)

    if any(w in msg for w in ("dependency", "package", "module", "library")):
        dep_list = ", ".join([d.get("data", {}).get("label") or "" for d in deps])
        text = f"Dependency files: **{dep_list}**." if dep_list else "No dependency files detected."
    elif any(w in msg for w in ("folder", "directory", "structure")):
        folder_list = ", ".join([f.get("data", {}).get("label") or "" for f in folders[:10]])
        text = f"Contains **{len(folders)} folders**. Top folders: **{folder_list}**." + (f" (and {len(folders) - 10} more)." if len(folders) > 10 else "")
    elif any(w in msg for w in ("size", "big", "kilobyte", "megabyte")):
        text = f"Total parsed size: **{total_size:,} bytes** (~{total_size / 1024:.1f} KB)."
    elif any(w in msg for w in ("language", "tech", "stack")):
        lang_str = ", ".join([f"*.{k} ({v} files)" for k, v in sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]])
        text = f"Language breakdown: **{lang_str}**."
    else:
        text = (f"Summary of **{body.repo_name}**:\n"
                f"- **Structure:** {len(folders)} folders, {len(files)} files.\n"
                f"- **Dependencies:** {len(deps)} configurations.\n"
                f"- **Total code size:** {total_size:,} bytes.\n"
                f"- **Primary extensions:** {', '.join(list(languages.keys())[:4])}.\n\n"
                "Ask me about 'dependencies', 'folders', 'size', or 'languages'!")

    return ChatResponse(text=text)