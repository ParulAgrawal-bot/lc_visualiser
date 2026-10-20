# LeetCode Visualizer + Hint

A Manifest V3 Chrome extension starter that reads the LeetCode problem you are viewing, walks through its example and constraints, and reveals hints progressively. It never submits code. The storyboard is declarative JSON interpreted by local renderers; no generated JavaScript is evaluated.

## Current scope

- MV3 extension with React, TypeScript, Vite, CRXJS, Framer Motion, and Zod.
- LeetCode GraphQL question-data request with page-DOM fallback, slug detection, and local problem cache.
- Isolated Shadow DOM companion panel with an example player, scrubber, speed controls, replay, reduced-motion behavior, and keyboard shortcuts (`Alt+V`, `Alt+H`). Opening/scanning a problem requests a generated storyboard when the local backend is running; a built-in explanation remains available otherwise.
- Five-level user-controlled hint ladder; level 5 requires an extra confirmation.
- Express LLM proxy. API credentials stay on the server. The extension has no API key.
- Storyboard schemas and a pure frame reducer with bounds checks. Generated storyboards are validated before they are rendered.

The UI contains a safe six-scene fallback walkthrough. For a good release experience, complete structure-specific renderers (matrix/tree/graph/etc.), local example parsing, and storyboard-output verification before enabling generated action-heavy storyboards.

## Run locally

1. Install Node.js 20 or later.
2. From the repository root, run `npm install`.
3. Create `server/.env` from `server/.env.example`; set a server-side LLM API key and model if you want generated hints/storyboards. Keep `.env` private.
4. Install the server dependencies with `npm --prefix server install`. To render narrated MP4 walkthroughs, install Python 3.10+ and FFmpeg, then run `python -m pip install -r server/requirements.txt`. Narration uses Edge text-to-speech online, so the backend needs internet access when rendering. The backend searches PATH and the standard Winget Gyan.FFmpeg package location; otherwise set `FFMPEG_BIN` in `server/.env` to the FFmpeg `bin` directory or full `ffmpeg.exe` path. Set `TTS_VOICE` to choose a voice (default `en-US-AriaNeural`). Start the backend with `npm --prefix server run dev`.
5. In another terminal run `npm run dev` to use the CRXJS development extension, or `npm run build` to create `dist/`.
6. In Chrome, open `chrome://extensions`, enable Developer mode, and load the generated `dist` folder (or use the Vite/CRXJS dev workflow).
7. Open a LeetCode problem. Use the floating sparkle button; `Alt+V` toggles the panel and `Alt+H` opens hints.

Use **Render pictorial MP4** in the Visualizer tab to render the current problem's storyboard with Manim and play the resulting MP4. Rendering requires the Python/Manim/FFmpeg setup above. Set `PYTHON_BIN` in `server/.env` if the Python executable is named differently on your system. The LLM returns validated storyboard data; only the project's fixed Manim renderer is executed.

## Backend configuration

The proxy defaults to Groq's OpenAI-compatible Chat Completions API with strict JSON Schema output. Add `GROQ_API_KEY` to `server/.env`; `LLM_PROVIDER`, `LLM_BASE_URL`, and `LLM_MODEL` are already set for Groq. For OpenAI, set `LLM_PROVIDER=openai` and configure `LLM_API_KEY`. The server validates request shape and asks for JSON output; extension-side Zod validation remains authoritative for storyboards. The in-memory cache is keyed by operation and problem slug. Replace it with a persistent cache and add per-install rate limits before public deployment.

The extension currently connects to `http://localhost:8787`. For a deployed backend, change the API base in `extension/src/background/index.ts` and add that origin to `host_permissions` in `extension/manifest.json`.

## Privacy and limitations

Only the active problem page is read. When you scan/open its walkthrough and the backend is configured, the problem text is sent to that backend to generate the storyboard animation. Hint text is requested only when you reveal a hint. No user code is read or sent. The MVP does not submit solutions, fetch premium problem content from the backend, or support other coding platforms. Review LeetCode's current terms and publish a privacy policy before distribution.
