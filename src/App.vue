<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import MindMapCanvas from './components/MindMapCanvas.vue';
import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import Minimap from './components/Minimap.vue';
import { useMindMapStore } from './stores/mindmap';
import { Eye, EyeOff, Minus, Plus, Equal, SlidersHorizontal } from 'lucide-vue-next';

const store = useMindMapStore();

// Canvas ref to get dimensions
const canvasRef = ref<InstanceType<typeof MindMapCanvas> | null>(null);

// Computed canvas dimensions
const canvasWidth = computed(() => canvasRef.value?.canvasWidth || window.innerWidth);
const canvasHeight = computed(() => canvasRef.value?.canvasHeight || window.innerHeight);

// Minimap visibility
const showMinimap = ref(true);

function toggleMinimap() {
  showMinimap.value = !showMinimap.value;
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

function openFilter() {
  console.log('Filter clicked - functionality coming soon');
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
  // Initialize with a sample mind map
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
});
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-slate-800 overflow-hidden">
    <!-- Toolbar -->
    <Toolbar @toggle-sidebar="toggleSidebar" />

    <!-- Main content -->
    <div class="main-content">
      <!-- Canvas -->
      <div class="canvas-container">
        <MindMapCanvas ref="canvasRef" />

        <!-- Minimap Navigator -->
        <Minimap
          :canvas-width="canvasWidth"
          :canvas-height="canvasHeight"
          :visible="showMinimap"
          @navigate="handleMinimapNavigate"
        />
      </div>

      <!-- Sidebar (overlays canvas) -->
      <Transition name="sidebar-slide">
        <div v-if="showSidebar" class="sidebar-wrapper">
          <Sidebar />
        </div>
      </Transition>
    </div>

    <!-- Footer bar with status and minimap controls -->
    <div class="footer-bar">
      <!-- Left: Map tab -->
      <div class="footer-left">
        <div class="map-tab">
          <span class="map-tab-name">{{ store.currentMap.name }}</span>
        </div>
      </div>

      <!-- Center: Status info -->
      <div class="footer-center">
        <span class="status-item">{{ store.canvasState.selectedNodeIds.length }} selected</span>
        <span class="status-dot">·</span>
        <span class="status-item capitalize">{{ store.structure }}</span>
        <span v-if="store.canUndo" class="status-dot">·</span>
        <span v-if="store.canUndo" class="status-hint">⌘Z to undo</span>
      </div>

      <!-- Right: Minimap controls -->
      <div class="footer-right">
        <!-- Toggle Minimap -->
        <button
          class="footer-btn"
          :class="{ active: showMinimap }"
          :title="showMinimap ? 'Hide Navigator' : 'Show Navigator'"
          @click="toggleMinimap"
        >
          <Eye v-if="showMinimap" :size="14" />
          <EyeOff v-else :size="14" />
        </button>

        <div class="footer-divider" />

        <!-- Zoom Out -->
        <button class="footer-btn" title="Zoom Out" @click="zoomOut">
          <Minus :size="14" />
        </button>

        <!-- Zoom Display -->
        <span class="zoom-display">{{ Math.round(store.viewState.zoom * 100) }}%</span>

        <!-- Zoom In -->
        <button class="footer-btn" title="Zoom In" @click="zoomIn">
          <Plus :size="14" />
        </button>

        <!-- Reset Zoom -->
        <button class="footer-btn" title="Reset to 100%" @click="resetZoom">
          <Equal :size="12" />
        </button>

        <div class="footer-divider" />

        <!-- Filter -->
        <button class="footer-btn" title="Filter" @click="openFilter">
          <SlidersHorizontal :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Footer Bar */
.footer-bar {
  height: 32px;
  display: flex;
  align-items: center;
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 8px;
}

.footer-left {
  display: flex;
  align-items: center;
}

.map-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  margin-right: 12px;
}

.map-tab-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
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
  color: rgba(255, 255, 255, 0.5);
}

.status-dot {
  color: rgba(255, 255, 255, 0.25);
  margin: 0 8px;
}

.status-hint {
  color: rgba(255, 255, 255, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.footer-btn:active {
  background: rgba(255, 255, 255, 0.15);
}

.footer-btn.active {
  color: #60a5fa;
}

.footer-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 6px;
}

.zoom-display {
  min-width: 42px;
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
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
</style>
