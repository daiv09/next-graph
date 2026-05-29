# backend/routers/topology.py
import os
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from backend.helpers import _calculate_metrics

router = APIRouter(prefix="/api")
logger = logging.getLogger("uvicorn")

class InferTopologyRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    repo_url: Optional[str] = None

class InferSlideNotesRequest(BaseModel):
    step_title: str
    step_narration: str
    target_node_label: str
    target_node_path: Optional[str] = None
    target_node_type: str
    visible_nodes: List[Dict[str, Any]]
    inferred_infrastructure: str

# Heuristics helper to infer Tech Stack
def infer_stack(nodes: List[Dict[str, Any]]) -> List[str]:
    stack = []
    has_py = False
    has_js_ts = False
    has_rs = False
    has_go = False
    has_docker = False
    has_next = False
    has_fastapi = False
    has_db = False

    for n in nodes:
        label = (n.get("data", {}).get("label") or "").lower()
        path = (n.get("data", {}).get("path") or "").lower()
        
        if label.endswith(".py"):
            has_py = True
            if "fastapi" in label or "app.py" in label or "main.py" in label:
                has_fastapi = True
        if label.endswith(".ts") or label.endswith(".tsx") or label.endswith(".js") or label.endswith(".jsx"):
            has_js_ts = True
            if "next.config" in label or "_app" in label or "layout.tsx" in label:
                has_next = True
        if label.endswith(".rs") or "cargo.toml" in label:
            has_rs = True
        if label.endswith(".go") or "go.mod" in label:
            has_go = True
        if "dockerfile" in label or "docker-compose" in label:
            has_docker = True
        if "sqlite" in label or "postgres" in label or "mysql" in label or "db.ts" in label or "database" in label or "models.py" in label:
            has_db = True

    if has_next:
        stack.append("Next.js App Router (React)")
    elif has_js_ts:
        stack.append("TypeScript/JavaScript")
    
    if has_fastapi:
        stack.append("FastAPI Python Backend")
    elif has_py:
        stack.append("Python Backend")

    if has_go:
        stack.append("Go Programming Language")
    if has_rs:
        stack.append("Rust Programming Language")
    if has_docker:
        stack.append("Docker Containerization")
    if has_db:
        stack.append("Relational/Embedded Database Integration")
        
    if not stack:
        stack.append("Generic Software Repository")
        
    return stack

# Heuristic to compute high-coupling areas
def analyze_coupling(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Compute degree centrality
    degrees: Dict[str, int] = {}
    for e in edges:
        s = e.get("source")
        t = e.get("target")
        if s:
            degrees[s] = degrees.get(s, 0) + 1
        if t:
            degrees[t] = degrees.get(t, 0) + 1
            
    # Sort nodes by degree
    node_map = {n.get("id"): n for n in nodes}
    sorted_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)
    
    hotspots = []
    count = 0
    for nid, deg in sorted_nodes:
        if nid == "root":
            continue
        node = node_map.get(nid)
        if not node:
            continue
            
        label = node.get("data", {}).get("label") or nid
        path = node.get("data", {}).get("path") or ""
        ntype = node.get("type") or node.get("data", {}).get("nodeType") or "file"
        
        # Inferred role
        role = "Core Application Node"
        if ntype == "folder":
            role = "Architectural Module Directory"
        elif ntype == "dependency":
            role = "System Dependency Manifest"
        elif "context" in label.lower() or "store" in label.lower() or "provider" in label.lower():
            role = "Global State/Context Manager"
        elif "route" in label.lower() or "api" in label.lower() or "controller" in label.lower():
            role = "API Interface Router"
        elif "service" in label.lower() or "helper" in label.lower() or "utils" in label.lower():
            role = "Utility Helper Services"
            
        hotspots.append({
            "id": nid,
            "path": path,
            "label": label,
            "connections": deg,
            "role": role,
            "description": f"Acts as a central nexus with {deg} active connections in the system topology graph."
        })
        count += 1
        if count >= 5:
            break
            
    return hotspots

# Identify critical files by scanning source files
def scan_complexity(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    critical = []
    # Filter for potential source files
    source_files = []
    src_extensions = (".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".cpp", ".cs")
    
    for n in nodes:
        ntype = n.get("type") or n.get("data", {}).get("nodeType") or "file"
        label = n.get("data", {}).get("label") or ""
        if ntype in ("file", "dependency") and label.endswith(src_extensions):
            # Exclude vendor config or lockfiles
            if not any(x in label.lower() for x in ("lock", "config", "tailwind", "postcss", "eslint")):
                source_files.append(n)
                
    # Sort source files by size descending
    source_files.sort(key=lambda x: x.get("data", {}).get("size") or 0, reverse=True)
    
    # Calculate or estimate metrics for the top files
    for n in source_files[:8]:
        path = n.get("data", {}).get("path") or ""
        label = n.get("data", {}).get("label") or ""
        size = n.get("data", {}).get("size") or 0
        
        # Check if local file exists
        local_path = os.path.join(os.getcwd(), path.replace("/", os.sep))
        metrics = None
        if os.path.exists(local_path) and os.path.isfile(local_path):
            try:
                with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                metrics = _calculate_metrics(content, label)
            except Exception as e:
                logger.error(f"Error reading local file {local_path} for complexity scan: {str(e)}")
                
        # Estimate if we couldn't compute
        if not metrics:
            estimated_loc = int(size / 40) if size else 100
            estimated_complexity = int(estimated_loc / 15) if estimated_loc else 5
            rating = "Low"
            if estimated_complexity > 32:
                rating = "Critical"
            elif estimated_complexity > 18:
                rating = "High"
            elif estimated_complexity > 6:
                rating = "Moderate"
                
            metrics = {
                "loc": estimated_loc,
                "functions": int(estimated_loc / 25),
                "classes": int(estimated_loc / 120),
                "complexity": estimated_complexity,
                "rating": rating,
                "recommendation": "Estimated from size. High code density node."
            }
            
        if metrics["rating"] in ("Critical", "High", "Moderate"):
            critical.append({
                "id": n.get("id"),
                "path": path,
                "label": label,
                "size": size,
                "loc": metrics["loc"],
                "complexity": metrics["complexity"],
                "rating": metrics["rating"],
                "recommendation": metrics["recommendation"]
            })
            
    # Return sorted by complexity score descending
    critical.sort(key=lambda x: x["complexity"], reverse=True)
    return critical[:5]

@router.post("/infer-topology", summary="Infer repository infrastructure and coupling analysis")
async def infer_topology(body: InferTopologyRequest):
    try:
        stack = infer_stack(body.nodes)
        hotspots = analyze_coupling(body.nodes, body.edges)
        critical_files = scan_complexity(body.nodes)
        
        stack_str = ", ".join(stack)
        infra_summary = f"This codebase is built primarily on a {stack_str} architecture. "
        if hotspots:
            top_nexus = hotspots[0]["label"]
            infra_summary += f"The system architecture centers around high-degree components like `{top_nexus}`, " \
                             f"indicating a hub-and-spoke coupling pattern. "
        if critical_files:
            heaviest = critical_files[0]["label"]
            infra_summary += f"Maintenance hotspots include `{heaviest}` due to elevated structural complexity."
            
        return {
            "tech_stack": stack,
            "inferred_infrastructure": infra_summary,
            "hotspots": hotspots,
            "critical_files": critical_files
        }
    except Exception as e:
        logger.error(f"Error in infer-topology endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/infer-slide-notes", summary="Generate AI-augmented slide notes for a tour step")
async def infer_slide_notes(body: InferSlideNotesRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    
    # 1. Try Gemini API if available
    if api_key:
        prompt = f"""
You are an expert software architect auditing a codebase.
Generate a concise, professional "Executive Summary / Architecture Note" (maximum 3 sentences) suitable for a PowerPoint presentation slide.

Context:
- Overall Repository Inferred Infrastructure: {body.inferred_infrastructure}
- Current Slide/Step Title: {body.step_title}
- Slide/Step Narration: {body.step_narration}
- Focused Node: Name: "{body.target_node_label}", Path: "{body.target_node_path or 'Root'}", Type: "{body.target_node_type}"
- Nearby/Visible Nodes: {[n.get('data', {}).get('label') or n.get('id') for n in body.visible_nodes[:10]]}

Your note should analyze:
- What role this focused component serves in the system.
- The design patterns, modularity, or coupling it exhibits.
- Any critical architectural trade-off or significance.

Response Format: Return ONLY the raw generated summary paragraph. No labels, prefix, markdown code blocks, or explanations.
"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                payload = {
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }]
                }
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    note = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if note:
                        return {"slide_note": note}
                else:
                    logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Gemini API call failed: {str(e)}")
            
    # 2. Heuristic Fallback Engine
    ntype = body.target_node_type
    label = body.target_node_label.lower()
    path = (body.target_node_path or "").lower()
    
    # Analyze role and build custom architecture note
    if ntype == "root":
        note = f"This slide represents the architectural entrypoint for the repository. " \
               f"It maps the top-level orchestration and folder hierarchy, demonstrating a clean division " \
               f"into logical subsystems (like {', '.join([n.get('data', {}).get('label') or n.get('id') for n in body.visible_nodes[:4]])})."
    elif ntype == "folder":
        note = f"The `{body.target_node_label}` directory acts as a logical namespace encapsulating local domain assets. " \
               f"It structures boundary interfaces to minimize cross-module coupling, managing {len(body.visible_nodes)} child components."
    elif ntype == "dependency":
        note = f"This dependency manifest manages external integrations and ecosystem packages. " \
               f"It serves as a critical configuration contract defining runtime constraints and development dependencies for the project lifecycle."
    elif "context" in label or "store" in label or "provider" in label:
        note = f"This module implements global state management, providing a centralized reactive data channel. " \
               f"It decouples component synchronization by injecting context down the tree, simplifying client-side data propagation."
    elif "router" in label or "api" in label or "route" in label or "controller" in label:
        note = f"This file establishes boundary network routing, mapping raw client endpoints to service handles. " \
               f"It acts as a primary controller for ingress requests, enforcing request validation and serialization."
    elif "test" in label or "spec" in label or "mock" in label:
        note = f"Integrates suite assertions and mocks to isolate business components under test. " \
               f"This ensures module contract enforcement and regression resilience during continuous integration flows."
    elif "helper" in label or "utils" in label:
        note = f"Contains stateless, reusable utility functions shared across multiple directories. " \
               f"By consolidating common helper logic, it minimizes redundant operations and keeps domain files clean."
    else:
        # Default file
        note = f"Core functional implementation of the `{body.target_node_label}` logic. " \
               f"It works in tandem with neighbouring nodes to execute specific domain logic, supporting " \
               f"the repository's broader {body.inferred_infrastructure.split('.')[0]} architecture."
               
    return {"slide_note": note}
