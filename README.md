# 🧠 NextGraph

NextGraph is an advanced codebase visualization, navigation, and AI exploration platform. It transforms GitHub repositories into interactive 2D and 3D visual graphs, enabling developers to map directory structures, group files by semantic similarity, trace code paths via an LLM chat assistant, walk through codebases with guided tours, and visualize project evolution over a commit timeline.

---

## 🚀 Key Features

*   **Dual-Dimension Canvas (2D / 3D):**
    *   **2D View:** Rendered using `@xyflow/react` (React Flow) featuring custom interactive glassmorphic nodes representing folders, files, and dependencies.
    *   **3D View:** A spatial browser built on Three.js (via `@react-three/fiber` & `@react-three/drei`) for 3D folder navigation.
*   **Dual-Layout Engine:**
    *   **Filesystem Layout:** Displays the project directory structure.
    *   **Semantic Layout:** Preprocesses files client-side using **TF-IDF** vectorization and groups them into functional "semantic islands" using **K-Means clustering**. It automatically labels these islands with the most descriptive terms found in their filenames and descriptions.
*   **AI Chat Assistant (Llama 3):**
    *   A floating, glassmorphic chat interface powered by Llama 3 (via the Groq API) that answers questions about the codebase.
    *   Generates visual **Execution Paths** (e.g., UI Event → API Call → State Update) that highlight matching files in the graph.
*   **Visual Commit Timeline:**
    *   Retrieves GitHub commit history, tracking exactly which files were added, modified, or deleted in each commit.
    *   Visualizes code churn and revision history interactively.
*   **Interactive Guided Tours:**
    *   Automatically or manually creates walks through critical paths in the codebase (e.g., entry points, API routes, database connections) using automated camera/viewport transitions.
*   **Heatmap Analytics:**
    *   Highlights file hotspots such as size and churn directly on the nodes using gradient colors.
*   **Shareable State Deep Links:**
    *   Encodes and decodes the exact viewport zoom, position, layout mode, and filters into shareable URLs.
*   **Export Integration:**
    *   Generates PowerPoint (`.pptx`) tours and code visual snapshots directly from the browser.

---

## 🛠️ Tech Stack

### Frontend
*   **Framework:** React 19, Next.js 16 (App Router)
*   **Graph rendering:** `@xyflow/react` (React Flow)
*   **3D Graphics:** Three.js, `@react-three/fiber`, `@react-three/drei`
*   **Styling & Animation:** TailwindCSS, Vanilla CSS, Framer Motion
*   **Analytics:** Recharts
*   **Tour Export:** `pptxgenjs`, `html2canvas`

### Backend
*   **Framework:** FastAPI (Python 3)
*   **Server:** Uvicorn
*   **API Client:** HTTPX (Asynchronous integration with GitHub & Groq APIs)
*   **Configuration:** `python-dotenv`, `pydantic`

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
GITHUB_TOKEN=your_github_personal_access_token
GROQ_API_KEY=your_groq_api_key
```

*   `GITHUB_TOKEN`: Required to fetch repository files, commits, and file trees from the GitHub API without hitting rate limits.
*   `GROQ_API_KEY`: Required by the backend AI agent to run LLM chat queries.

---

## 💻 Local Setup & Development

### 1. Prerequisites
Make sure you have **Node.js** (v18+) and **Python** (v3.10+) installed.

### 2. Backend Setup
Activate your Python virtual environment and install the required dependencies:

```bash
# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
The backend server runs at `http://localhost:8000`.

### 3. Frontend Setup
In another terminal tab, install the frontend dependencies and run the Next.js development server:

```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## ☁️ Deployment

### Render Deployment (FastAPI Backend)
When deploying the Python backend on Render, use the following configuration:

*   **Environment:** `Python`
*   **Build Command:** `pip install -r requirements.txt`
*   **Start Command:** `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
*   **Environment Variables:** Add your `GITHUB_TOKEN` and `GROQ_API_KEY`.
