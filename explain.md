# OpenAtlas: Project Explanation

## 🌍 What is OpenAtlas?

**OpenAtlas** is an AI-powered Global Ontology Engine. Its primary goal is to process raw, fragmented news items and transform them into a structured, interactive **Knowledge Graph**. This allows geopolitical analysts, researchers, or anyone interested in world events to visualize and uncover hidden connections between global occurrences.

Instead of reading isolated news articles, OpenAtlas acts as a "macroscope," organizing world events intelligently to show causal links, themes, and chronological developments. 

---

## 🏗️ Architecture & Component Breakdown

The project follows a standard decoupled full-stack architecture, utilizing a language model (LLM) at its core for data processing and reasoning:

### 1. The Brain & Data Processing (`main.py` and `/model`)
- **Core Technology**: Python, NetworkX, Google Gemini 2.5 Flash.
- **Functionality**: `main.py` acts as the ingestion script. It reads scraped news articles stored in a local `.cache` directory or from external sources.
- **AI Processing**: It sends these articles in bulk to the **Gemini 2.5** LLM with a specific system prompt. The LLM extracts distinct factual events without duplicates, categorizing them with domains (e.g., geopolitics, economics), key elements, and determining if they are speculative.
- **Graph Building**: Nodes (events) sharing common key elements are mathematically linked together using NetworkX. 
- **Output**: The finalized graph is exported to a static file `data/graph.json`.

### 2. The Backend Server (`/backend`)
- **Core Technology**: Python, FastAPI, Uvicorn.
- **Functionality**: `server.py` acts as the bridge connecting the generated knowledge graph to the user interface.
- **Endpoints**: 
  - `GET /api/graph`: Returns the entire parsed knowledge graph.
  - `GET /api/nodes/{node_id}`: Fetches specific details for a single event/node.
  - `GET /api/search`: Allows searching the graph for specific topics.
  - `POST /api/chat`: The **Atlas Chat (RAG)** endpoint. It accepts user questions and queries the knowledge graph to provide an AI-generated, natural-language response, citing specific map nodes.
- **Static Serving**: The backend also acts as a web server, serving the built frontend React application directly so the entire service exists on one port (8000).

### 3. The Frontend Interface (`/frontend`)
- **Core Technology**: React 19, Vite, `@xyflow/react` (React Flow), Vanilla CSS.
- **Functionality**: The visual representation of the engine.
- **Features**: 
  - Automatically loads the network graph and renders it as an aesthetic, interactive map via React Flow. 
  - Users can pan, zoom, click on distinct nodes to see a detailed panel of the news event.
  - An integrated **Atlas Chat** copilot interface on the UI, which interacts with the `/api/chat` route. When the AI cites an event, clicking the citation smoothly pans the user to that node on the canvas.

### 4. Running the Application (`start.bat` / `start.sh`)
- Providing easy bootstrap functionality, these scripts simply install required python packages (`requirements.txt`), build the React frontend automatically using `npm build` if `dist` cannot be found, and launch the FastAPI server. All you need is your Google API key inside `.env`.

---

## 🎯 Summary

In short, **OpenAtlas** is a sophisticated **RAG (Retrieval-Augmented Generation) application built on top of a Knowledge Graph**. 

It uses Gemini chronologically on the backend to meticulously connect dots between news articles, saving that brainwork into a JSON graph structure. Then, it uses a lightweight Python API and an interactive React map interface so that users can interact with, query, and chat with a holistic map of global intelligence.
