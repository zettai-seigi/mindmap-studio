<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MindMapCanvas from './components/MindMapCanvas.vue';
import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import { useMindMapStore } from './stores/mindmap';

const store = useMindMapStore();

const showSidebar = ref(true);

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
  <div class="h-screen w-screen flex flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden">
    <!-- Toolbar -->
    <Toolbar @toggle-sidebar="showSidebar = !showSidebar" />

    <!-- Main content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Canvas -->
      <div class="flex-1 relative">
        <MindMapCanvas />

        <!-- Zoom controls -->
        <div class="zoom-controls absolute bottom-4 right-4 flex items-center gap-1 rounded-lg p-1">
          <button
            @click="store.setZoom(store.viewState.zoom * 0.9)"
            class="zoom-btn"
            title="Zoom Out"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="zoom-level text-[12px] font-medium px-2 min-w-[50px] text-center">
            {{ Math.round(store.viewState.zoom * 100) }}%
          </span>
          <button
            @click="store.setZoom(store.viewState.zoom * 1.1)"
            class="zoom-btn"
            title="Zoom In"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div class="zoom-divider" />
          <button
            @click="store.resetView()"
            class="zoom-btn px-2 text-[11px]"
            title="Reset View"
          >
            Fit
          </button>
        </div>

      </div>

      <!-- Sidebar -->
      <Sidebar v-if="showSidebar" />
    </div>

    <!-- Status bar -->
    <div class="status-bar h-6 flex items-center px-4 text-[11px]">
      <span class="status-item">{{ store.currentMap.name }}</span>
      <span class="status-dot">·</span>
      <span class="status-item">{{ store.canvasState.selectedNodeIds.length }} selected</span>
      <span class="status-dot">·</span>
      <span class="status-item capitalize">{{ store.structure }}</span>
      <span class="flex-1" />
      <span v-if="store.canUndo" class="status-hint">⌘Z to undo</span>
    </div>
  </div>
</template>

<style scoped>
/* Zoom Controls */
.zoom-controls {
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(0, 0, 0, 0.1);
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.15s ease;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.zoom-btn:active {
  background: rgba(255, 255, 255, 0.15);
}

.zoom-level {
  color: rgba(255, 255, 255, 0.8);
}

.zoom-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

/* Status Bar */
.status-bar {
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.status-item {
  color: rgba(255, 255, 255, 0.6);
}

.status-dot {
  color: rgba(255, 255, 255, 0.3);
  margin: 0 8px;
}

.status-hint {
  color: rgba(255, 255, 255, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
</style>
