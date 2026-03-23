# OpenAtlas - Improvements & To-Do List

Based on a test run and analysis of the OpenAtlas application, here are the core technical, functional, and UI/UX improvements that should be implemented to make the product robust and user-friendly.

## 🚨 Critical Fixes
- [ ] **Fix Chat API Endpoint**: The "Atlas Chat" is currently throwing a `Failed to fetch` (`net::ERR_CONNECTION_REFUSED`) error on `/api/chat`. Need to ensure the Gemini integration in `server.py` and `llm.py` is correctly returning data without crashing the backend thread, and that the frontend handles the POST request properly.
- [ ] **Backend Stability Check**: Implement proper application logging and process managers so that if the LLM module throws an error, the Uvicorn server does not silently die.

## 🎨 UI & UX Improvements
- [ ] **Better Error Handling UI**: Instead of raw technical errors like `Failed to fetch`, the UI should display user-friendly messages (e.g., *"Connection lost. Retrying..."*) alongside a "Retry" button.
- [ ] **Smart Node Clustering**: The graph center currently suffers from node overlap. Implement a stronger force-directed layout or collision detection algorithm to space nodes evenly.
- [ ] **Semantic Zooming**: For larger datasets, nodes should group into broad domain clusters when zoomed out, only revealing individual article titles when the user zooms in closer.
- [ ] **Search Highlighting**: When using the search bar, matching nodes should visually "glow" or pulse, while non-matching nodes should automatically dim, instantly guiding the user's attention.

## 🚀 Functional Additions
- [ ] **Automated Real-Time Ingestion Pipeline**: Implement a backend background worker that continuously aggregates news from diverse global platforms and industries in real-time. The system should automatically process new articles via the active LLM pipeline and dynamically update the knowledge graph on the frontend. The end-user should act strictly as an observer and explorer, never having to manually upload or enter news data.
- [ ] **Clear Chat Option**: Add a button to reset the Atlas Chat conversation context.
- [ ] **Backend Health Check**: The React app should ping a `/api/health` endpoint on initial load and display a warning banner if the backend or LLM service is offline.
