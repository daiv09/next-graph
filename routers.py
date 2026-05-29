# routers.py
import os
import json
import httpx
from fastapi import APIRouter, HTTPException, status
from schemas import (
    ParseRepoRequest, ParseRepoResponse, FileContentRequest, 
    ChatRequest, ChatResponse, CommitHistoryRequest, CommitHistoryResponse
)
from services import (
    extract_owner_repo, build_headers, raise_forbidden, 
    raise_rate_limit, build_graph, calculate_metrics, calculate_analytics
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
        tree_items = tree_data.get("tree", [])
        nodes, edges = build_graph(tree_items, owner, repo)
        analytics = calculate_analytics(tree_items)

        return ParseRepoResponse(
            nodes=nodes, edges=edges,
            meta={
                "owner": owner, "repo": repo, "default_branch": default_branch,
                "description": repo_data.get("description") or "",
                "stars": repo_data.get("stargazers_count", 0),
                "language": repo_data.get("language") or "",
                "total_nodes": len(nodes), "total_edges": len(edges),
                "truncated": tree_data.get("truncated", False),
                "analytics": analytics,
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
        return ChatResponse(text=json.dumps({"path": [], "summary": "Hello! How can I help you explore this repository today?"}))

    files = [n for n in body.nodes if n.get("type") in ("file", "dependency") or n.get("data", {}).get("nodeType") in ("file", "dependency")]
    file_paths = []
    for f in files:
        path = f.get("data", {}).get("path") or f.get("id")
        if path:
            file_paths.append(path)
    file_paths.sort()
    file_tree_str = "\n".join(f"- {p}" for p in file_paths)

    groq_api_key = os.getenv("GROQ_API_KEY")
    
    system_prompt = (
        "You are an expert Senior Developer Mentor specializing in Codebase Navigation.\n"
        "Your task is to trace the implementation of a specific feature/query within the repository and generate an 'Execution Path'.\n\n"
        "Input Repo Structure:\n"
        f"{file_tree_str}\n\n"
        "Instructions:\n"
        "1. Identify the entry points, state management, and API calls related to the query/feature.\n"
        "2. Trace and order the files by the logical flow of data (e.g., UI Event -> Service/API call -> State Update -> Component Re-render).\n"
        "3. For each file in the path, explain exactly which lines, functions, or roles handle the logic.\n"
        "4. Provide a 3-sentence high-level summary overview of how this feature functions in this codebase.\n\n"
        "You MUST respond with a valid JSON object matching this schema:\n"
        "{\n"
        '  "path": [\n'
        '    { "file": "path/to/file", "role": "UI" | "State" | "API" | "Service" | "Other", "explanation": "Brief reasoning of what it does" }\n'
        '  ],\n'
        '  "summary": "A 3-sentence high-level overview of how this feature functions in this codebase."\n'
        "}\n"
    )

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User query: {last_user_message}"}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            if resp.status_code == 200:
                result = resp.json()
                content = result["choices"][0]["message"]["content"]
                # Validate JSON structure
                try:
                    data = json.loads(content)
                    if "path" not in data or "summary" not in data:
                        data = {
                            "path": [],
                            "summary": content
                        }
                    return ChatResponse(text=json.dumps(data))
                except Exception:
                    return ChatResponse(text=json.dumps({
                        "path": [],
                        "summary": content
                    }))
            else:
                return ChatResponse(text=json.dumps({
                    "path": [],
                    "summary": f"Failed to connect to Groq (status {resp.status_code}): {resp.text}"
                }))
        except Exception as e:
            return ChatResponse(text=json.dumps({
                "path": [],
                "summary": f"Error communicating with AI service: {str(e)}"
            }))

import asyncio

@router.post("/commit-files", response_model=CommitHistoryResponse, summary="Get commit history with file changes")
async def get_commit_files(body: CommitHistoryRequest) -> CommitHistoryResponse:
    owner, repo = extract_owner_repo(body.url)
    headers = build_headers()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        branch = body.branch or "main"
        commits_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits?sha={branch}&per_page={body.limit}"
        commits_resp = await client.get(commits_url, headers=headers)

        if commits_resp.status_code == 403:
            raise_forbidden(commits_resp)
        if commits_resp.status_code != 200:
            raise HTTPException(status_code=commits_resp.status_code, detail="Failed to fetch commits")

        commits_data = commits_resp.json()

        async def fetch_commit_details(sha: str):
            detail_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{sha}"
            resp = await client.get(detail_url, headers=headers)
            if resp.status_code != 200:
                return None
            return resp.json()

        tasks = [fetch_commit_details(c["sha"]) for c in commits_data]
        details_results = await asyncio.gather(*tasks)

        results = []
        for c_meta, detail in zip(commits_data, details_results):
            if not detail:
                continue

            added = []
            modified = []
            deleted = []

            for f in detail.get("files", []):
                status = f.get("status")
                path = f.get("filename")
                if status == "added":
                    added.append(path)
                elif status in ("modified", "renamed", "changed"):
                    modified.append(path)
                elif status == "removed":
                    deleted.append(path)

            results.append({
                "sha": c_meta["sha"],
                "message": c_meta["commit"]["message"],
                "date": c_meta["commit"]["author"]["date"],
                "added": added,
                "modified": modified,
                "deleted": deleted
            })

        return CommitHistoryResponse(commits=results)

from schemas import GenerateTourRequest
from services import generate_tour_steps

@router.post("/generate-tour")
def api_generate_tour(body: GenerateTourRequest):
    steps = generate_tour_steps(body.nodes, body.edges)
    return {"steps": steps}