# schemas.py
from typing import Any, Literal
from urllib.parse import urlparse
from pydantic import BaseModel, field_validator

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
            raise ValueError("URL must point to a repository: https://github.com/owner/repo")
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

class FileContentRequest(BaseModel):
    repo_url: str
    path: str
    branch: str | None = None

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

class CommitHistoryRequest(BaseModel):
    url: str
    branch: str | None = None
    limit: int = 15

class CommitData(BaseModel):
    sha: str
    message: str
    date: str
    added: list[str]
    modified: list[str]
    deleted: list[str]

class CommitHistoryResponse(BaseModel):
    commits: list[CommitData]