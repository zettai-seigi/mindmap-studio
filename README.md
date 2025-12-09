# MindMap Studio

A modern, feature-rich mind mapping application built with Vue 3, TypeScript, and Canvas. Inspired by XMind, MindMap Studio provides an intuitive interface for creating, organizing, and sharing your ideas.

![MindMap Studio](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript) ![License](https://img.shields.io/badge/License-MIT-blue)

## Features

### Core Mind Mapping
- **Interactive Canvas** - Smooth pan, zoom, and navigation with mouse/trackpad support
- **Multiple Structures** - Support for various layout types:
  - Mind Map (radial)
  - Logic Chart (left-to-right)
  - Org Chart (top-down hierarchy)
  - Tree Chart
  - Fishbone (Ishikawa diagram)
  - Timeline
- **Node Operations** - Add, edit, delete, and reorganize nodes with keyboard shortcuts
- **Drag & Drop** - Freely reposition nodes or restructure the hierarchy
- **Collapse/Expand** - Hide or show branches for better focus

### Rich Content
- **Notes** - Add detailed notes to any node with a rich text editor
- **Comments** - Collaborative commenting system for team feedback
- **Labels** - Color-coded labels for categorization
- **Markers** - Visual indicators including:
  - Priority levels (1-9)
  - Progress indicators
  - Flags and stars
  - Custom icons
- **Hyperlinks** - Link nodes to web URLs or other topics

### Task Management
- **Task Properties** - Convert nodes into tasks with:
  - Assignee
  - Priority (1-9)
  - Start date
  - Duration
  - End date (auto-calculated)
  - Progress percentage
  - Checkpoint markers
  - Dependencies (predecessors)
- **Progress Tracking** - Visual progress bars on task nodes

### Relationships
- **Cross-links** - Create relationships between any two nodes
- **Boundaries** - Group related topics visually
- **Floating Topics** - Add standalone topics anywhere on the canvas

### Customization
- **Themes** - Multiple color themes for different styles
- **Sheet Format** - Customize background color, wallpaper, and visual effects:
  - Tapered lines
  - Gradient colors
  - Multi-branch colors
  - Information card display options
- **Node Styling** - Customize individual node appearance

### File Operations
- **Save/Load JSON** - Native JSON format for full fidelity
- **XMind Import/Export** - Compatible with XMind 8+ (.xmind) files
- **New Map** - Quick start with a fresh canvas

### History & Navigation
- **Undo/Redo** - Full history support with keyboard shortcuts
- **Reset Layout** - Auto-arrange nodes to default positions
- **Zoom Controls** - Zoom in/out with fit-to-view option
- **Minimap Navigator** - Interactive thumbnail overview with:
  - Draggable viewport for quick navigation
  - Toggle visibility (eye icon)
  - Real-time sync with main canvas
- **Smooth Animations** - Elegant sidebar slide transitions

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone https://github.com/zettai-seigi/mindmap-studio.git
cd mindmap-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

### Desktop App (Tauri)

For native desktop support:

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Run desktop app in development
npm run tauri:dev

# Build desktop app
npm run tauri:build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Add child node |
| `Enter` | Add sibling node |
| `Delete` / `Backspace` | Delete selected node |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Space` | Toggle collapse/expand |
| `Double-click` | Edit node text |

## Project Structure

```
src/
├── components/
│   ├── MindMapCanvas.vue   # Main canvas rendering
│   ├── Toolbar.vue         # Top toolbar with actions
│   ├── Sidebar.vue         # Right panel (format, notes, etc.)
│   ├── ContextMenu.vue     # Right-click context menu
│   └── Minimap.vue         # Navigation minimap
├── stores/
│   └── mindmap.ts          # Pinia store for state management
├── types/
│   └── index.ts            # TypeScript type definitions
├── utils/
│   └── fileUtils.ts        # File import/export utilities
└── App.vue                 # Root component
```

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe development
- **Pinia** - State management
- **Canvas API** - High-performance rendering
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Beautiful icon set
- **JSZip** - XMind file handling
- **Tauri** - Native desktop app (optional)

## Roadmap

- [ ] AI Integration (Ollama) - Smart suggestions and auto-expansion
- [ ] Gantt Chart View - Project timeline visualization
- [ ] Collaboration - Real-time multi-user editing
- [ ] More Export Formats - PNG, SVG, PDF, Markdown
- [ ] Presentation Mode - Slideshow from branches
- [ ] Mobile Support - Touch-optimized interface

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [XMind](https://xmind.app/)
- Built with [Vue.js](https://vuejs.org/)
- Icons by [Lucide](https://lucide.dev/)
