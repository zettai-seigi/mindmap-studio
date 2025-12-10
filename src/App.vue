<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import MindMapCanvas from './components/MindMapCanvas.vue';
import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import Minimap from './components/Minimap.vue';
import OutlineView from './components/OutlineView.vue';
import SearchPanel from './components/SearchPanel.vue';
import ExportDialog from './components/ExportDialog.vue';
import { useMindMapStore } from './stores/mindmap';
import { Eye, EyeOff, Minus, Plus, Equal, SlidersHorizontal, Map, List, Focus, Search, Maximize } from 'lucide-vue-next';

const store = useMindMapStore();

// Search panel visibility
const showSearch = ref(false);

function toggleSearch() {
  showSearch.value = !showSearch.value;
}

function closeSearch() {
  showSearch.value = false;
}

// Sidebar tab selection (for keyboard shortcuts)
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);

// Sidebar tab names for keyboard shortcuts (Ctrl/Cmd + 1-6)
const sidebarTabs = ['themes', 'outline', 'markers', 'tags', 'style', 'relationships'] as const;

// Global keyboard handler for Cmd+F and panel shortcuts
function handleGlobalKeyDown(e: KeyboardEvent) {
  // Cmd+F for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    toggleSearch();
    return;
  }

  // Cmd+V for paste from clipboard (create new map)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'v') {
    e.preventDefault();
    handlePasteAsNewMap();
    return;
  }

  // Ctrl/Cmd + 1-6 for sidebar panels
  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    const tabId = sidebarTabs[index];
    if (tabId) {
      // Ensure sidebar is visible
      if (!showSidebar.value) {
        showSidebar.value = true;
      }
      // Set the active tab via the sidebar component
      if (sidebarRef.value) {
        sidebarRef.value.setActiveTab(tabId);
      }
    }
    return;
  }
}

// Handle paste as new map from clipboard
async function handlePasteAsNewMap() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) {
      store.importFromClipboardText(text);
    }
  } catch (error) {
    console.error('Failed to read clipboard:', error);
  }
}

// Canvas ref to get dimensions
const canvasRef = ref<InstanceType<typeof MindMapCanvas> | null>(null);

// Computed canvas dimensions
const canvasWidth = computed(() => canvasRef.value?.canvasWidth || window.innerWidth);
const canvasHeight = computed(() => canvasRef.value?.canvasHeight || window.innerHeight);

// Minimap visibility
const showMinimap = ref(true);

// View mode: 'mindmap' or 'outline'
const viewMode = ref<'mindmap' | 'outline'>('mindmap');

// Focus mode
const focusMode = ref(false);

// Tag filter
const activeTagFilters = ref<string[]>([]);

function handleTagFilterChange(tags: string[]) {
  activeTagFilters.value = tags;
}

function toggleMinimap() {
  showMinimap.value = !showMinimap.value;
}

function setViewMode(mode: 'mindmap' | 'outline') {
  viewMode.value = mode;
}

function toggleFocusMode() {
  focusMode.value = !focusMode.value;
}

function zoomIn() {
  store.setZoom(store.viewState.zoom * 1.2);
}

function zoomOut() {
  store.setZoom(store.viewState.zoom / 1.2);
}

function resetZoom() {
  store.setZoom(1);
  store.setPan(0, 0);
}

function fitToView() {
  canvasRef.value?.fitToView();
}

function openFilter() {
  // TODO: Implement filter functionality
}

// Export dialog
const showExportDialog = ref(false);

function openExportDialog() {
  showExportDialog.value = true;
}

function closeExportDialog() {
  showExportDialog.value = false;
}

function handleMinimapNavigate(panX: number, panY: number) {
  store.setPan(panX, panY);
  canvasRef.value?.render();
}

const showSidebar = ref(true);

function toggleSidebar() {
  showSidebar.value = !showSidebar.value;
}

onMounted(() => {
  // Add global keyboard listener for search
  window.addEventListener('keydown', handleGlobalKeyDown);

  // Try to load saved mind map from localStorage
  const loaded = store.loadFromLocalStorage();

  if (!loaded) {
    // No saved data - create a sample mind map for first-time users
    store.newMap('My Mind Map');

    // Add some sample children
    const child1 = store.addChild(store.root.id, 'Main Idea 1');
    const child2 = store.addChild(store.root.id, 'Main Idea 2');
    const child3 = store.addChild(store.root.id, 'Main Idea 3');

    if (child1) {
      store.addChild(child1.id, 'Sub-topic 1.1');
      store.addChild(child1.id, 'Sub-topic 1.2');
    }

    if (child2) {
      store.addChild(child2.id, 'Sub-topic 2.1');
      const sub22 = store.addChild(child2.id, 'Sub-topic 2.2');
      if (sub22) {
        store.addChild(sub22.id, 'Detail 2.2.1');
      }
    }

    if (child3) {
      store.addChild(child3.id, 'Sub-topic 3.1');
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden" style="background: var(--bg-canvas);">
    <!-- Toolbar -->
    <Toolbar :canvas-ref="canvasRef?.canvasRef" @toggle-sidebar="toggleSidebar" @open-export-dialog="openExportDialog" />

    <!-- Main content -->
    <div class="main-content">
      <!-- Mind Map View -->
      <div v-show="viewMode === 'mindmap'" class="canvas-container">
        <MindMapCanvas ref="canvasRef" :focus-mode="focusMode" :tag-filters="activeTagFilters" />

        <!-- Minimap Navigator -->
        <Minimap
          :canvas-width="canvasWidth"
          :canvas-height="canvasHeight"
          :visible="showMinimap && viewMode === 'mindmap'"
          @navigate="handleMinimapNavigate"
        />
      </div>

      <!-- Outline View -->
      <div v-show="viewMode === 'outline'" class="outline-container">
        <OutlineView />
      </div>

      <!-- Sidebar (overlays canvas) -->
      <Transition name="sidebar-slide">
        <div v-if="showSidebar" class="sidebar-wrapper">
          <Sidebar ref="sidebarRef" @filter-change="handleTagFilterChange" />
        </div>
      </Transition>

      <!-- Search Panel -->
      <Transition name="search-fade">
        <div v-if="showSearch" class="search-wrapper" @click.self="closeSearch">
          <SearchPanel @close="closeSearch" />
        </div>
      </Transition>
    </div>

    <!-- Footer bar with status and minimap controls -->
    <div class="footer-bar">
      <!-- Left: Map tab and view mode -->
      <div class="footer-left">
        <div class="map-tab">
          <span class="map-tab-name">{{ store.currentMap.name }}</span>
        </div>

        <!-- View Mode Toggle -->
        <div class="view-toggle">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'mindmap' }"
            title="Mind Map View"
            @click="setViewMode('mindmap')"
          >
            <Map :size="14" />
          </button>
          <button
            class="view-btn"
            :class="{ active: viewMode === 'outline' }"
            title="Outline View"
            @click="setViewMode('outline')"
          >
            <List :size="14" />
          </button>
        </div>

        <!-- Focus Mode Toggle -->
        <button
          v-if="viewMode === 'mindmap'"
          class="footer-btn focus-btn"
          :class="{ active: focusMode }"
          title="Focus Mode"
          @click="toggleFocusMode"
        >
          <Focus :size="14" />
        </button>
      </div>

      <!-- Center: Status info -->
      <div class="footer-center">
        <span class="status-item">{{ store.canvasState.selectedNodeIds.length }} selected</span>
        <span class="status-dot">·</span>
        <span class="status-item capitalize">{{ viewMode === 'outline' ? 'Outline' : store.structure }}</span>
        <span v-if="focusMode && viewMode === 'mindmap'" class="status-dot">·</span>
        <span v-if="focusMode && viewMode === 'mindmap'" class="status-focus">Focus Mode</span>
        <span v-if="store.canUndo" class="status-dot">·</span>
        <span v-if="store.canUndo" class="status-hint">⌘Z to undo</span>
      </div>

      <!-- Right: Minimap controls -->
      <div class="footer-right">
        <!-- Toggle Minimap (only in mindmap view) -->
        <button
          v-if="viewMode === 'mindmap'"
          class="footer-btn"
          :class="{ active: showMinimap }"
          :title="showMinimap ? 'Hide Navigator' : 'Show Navigator'"
          @click="toggleMinimap"
        >
          <Eye v-if="showMinimap" :size="14" />
          <EyeOff v-else :size="14" />
        </button>

        <div v-if="viewMode === 'mindmap'" class="footer-divider" />

        <!-- Zoom Out -->
        <button v-if="viewMode === 'mindmap'" class="footer-btn" title="Zoom Out" @click="zoomOut">
          <Minus :size="14" />
        </button>

        <!-- Zoom Display -->
        <span v-if="viewMode === 'mindmap'" class="zoom-display">{{ Math.round(store.viewState.zoom * 100) }}%</span>

        <!-- Zoom In -->
        <button v-if="viewMode === 'mindmap'" class="footer-btn" title="Zoom In" @click="zoomIn">
          <Plus :size="14" />
        </button>

        <!-- Reset Zoom -->
        <button v-if="viewMode === 'mindmap'" class="footer-btn" title="Reset to 100%" @click="resetZoom">
          <Equal :size="12" />
        </button>

        <!-- Fit to View -->
        <button v-if="viewMode === 'mindmap'" class="footer-btn" title="Fit All to View" @click="fitToView">
          <Maximize :size="14" />
        </button>

        <div v-if="viewMode === 'mindmap'" class="footer-divider" />

        <!-- Search -->
        <button class="footer-btn" :class="{ active: showSearch }" title="Search (Cmd+F)" @click="toggleSearch">
          <Search :size="14" />
        </button>

        <!-- Filter -->
        <button class="footer-btn" title="Filter" @click="openFilter">
          <SlidersHorizontal :size="14" />
        </button>
      </div>
    </div>

    <!-- Export Dialog -->
    <ExportDialog
      :visible="showExportDialog"
      :canvas-ref="canvasRef"
      @close="closeExportDialog"
    />
  </div>
</template>

<style scoped>
/* Footer Bar */
.footer-bar {
  height: 32px;
  display: flex;
  align-items: center;
  background: var(--bg-toolbar);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-primary);
  padding: 0 8px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--border-secondary);
  border-radius: 4px;
  margin-right: 12px;
}

.map-tab-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.status-item {
  color: var(--text-muted);
}

.status-dot {
  color: var(--text-muted);
  opacity: 0.5;
  margin: 0 8px;
}

.status-hint {
  color: var(--text-muted);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.status-focus {
  color: #f59e0b;
  font-weight: 500;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.footer-btn:active {
  background: var(--border-secondary);
}

.footer-btn.active {
  color: #60a5fa;
}

.footer-divider {
  width: 1px;
  height: 16px;
  background: var(--border-primary);
  margin: 0 6px;
}

.zoom-display {
  min-width: 42px;
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  padding: 0 4px;
}

/* Main content area */
.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Canvas container */
.canvas-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: inherit;
}

/* Outline container */
.outline-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* View mode toggle */
.view-toggle {
  display: flex;
  background: var(--border-secondary);
  border-radius: 5px;
  padding: 2px;
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  border-radius: 3px;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.view-btn:hover {
  color: var(--text-secondary);
}

.view-btn.active {
  background: var(--border-primary);
  color: #60a5fa;
}

.focus-btn.active {
  color: #f59e0b;
}

/* Sidebar overlay */
.sidebar-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

/* Sidebar slide transition */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
}

/* Search wrapper */
.search-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  background: rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.dark .search-wrapper {
  background: rgba(0, 0, 0, 0.4);
}

:not(.dark) .search-wrapper {
  background: rgba(0, 0, 0, 0.2);
}

/* Search fade transition */
.search-fade-enter-active,
.search-fade-leave-active {
  transition: opacity 0.15s ease;
}

.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}
</style>
