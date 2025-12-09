# MindMap Studio

A powerful XMind-like mind mapping application built with Vue 3, TypeScript, and Tauri for desktop support.

## Features

- **Multiple Layout Types**: Mind Map (radial), Org Chart, Tree, Logic Chart, Fishbone (Ishikawa), Timeline
- **Rich Node System**: Topics with markers, labels, and styling
- **Relationships**: Visual connections between any nodes
- **Boundaries**: Group related topics together
- **Canvas Controls**: Pan, zoom, selection box
- **Keyboard Shortcuts**: Tab (add child), Enter (add sibling), Delete, Ctrl+Z/Y (undo/redo)
- **Dark Mode Support**
- **Desktop App**: Native desktop application via Tauri

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Icons**: Lucide Vue
- **Desktop**: Tauri (Rust)

## Development

```bash
# Install dependencies
npm install

# Run web dev server
npm run dev

# Run desktop app in development
npm run tauri:dev

# Build for production
npm run build

# Build desktop app
npm run tauri:build
```

## Prerequisites

For desktop development, you need:
- [Rust](https://www.rust-lang.org/tools/install)
- Platform-specific dependencies (see [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

## Project Structure

```
mindmap-studio/
├── src/
│   ├── components/       # Vue components
│   │   ├── MindMapCanvas.vue  # Main canvas rendering
│   │   ├── Toolbar.vue        # Top toolbar
│   │   └── Sidebar.vue        # Right sidebar
│   ├── layouts/          # Layout algorithms
│   ├── stores/           # Pinia stores
│   ├── types/            # TypeScript types
│   └── main.ts           # Entry point
├── src-tauri/            # Tauri (Rust) backend
└── public/               # Static assets
```

## Roadmap

- [ ] AI Integration (Ollama)
- [ ] File import/export (XMind, Markdown, JSON)
- [ ] More themes and styling options
- [ ] Collaboration features
- [ ] Mobile support

## License

MIT
