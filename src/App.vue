<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MindMapCanvas from './components/MindMapCanvas.vue';
import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import { useMindMapStore } from './stores/mindmap';

const store = useMindMapStore();

const showSidebar = ref(true);
const sidebarTab = ref<'format' | 'markers' | 'outline'>('format');

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
        <div class="absolute bottom-4 right-4 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2">
          <button
            @click="store.setZoom(store.viewState.zoom * 0.9)"
            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="text-sm font-medium px-2 min-w-[60px] text-center">
            {{ Math.round(store.viewState.zoom * 100) }}%
          </span>
          <button
            @click="store.setZoom(store.viewState.zoom * 1.1)"
            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            @click="store.resetView()"
            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs"
          >
            Reset
          </button>
        </div>

        <!-- Structure selector -->
        <div class="absolute top-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2">
          <select
            :value="store.structure"
            @change="store.setStructure(($event.target as HTMLSelectElement).value as any)"
            class="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
          >
            <option value="mindmap">Mind Map</option>
            <option value="orgchart">Org Chart</option>
            <option value="tree">Tree Chart</option>
            <option value="logic">Logic Chart</option>
            <option value="fishbone">Fishbone</option>
            <option value="timeline">Timeline</option>
          </select>
        </div>
      </div>

      <!-- Sidebar -->
      <Sidebar v-if="showSidebar" :active-tab="sidebarTab" @change-tab="sidebarTab = $event" />
    </div>

    <!-- Status bar -->
    <div class="h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center px-4 text-xs text-slate-500">
      <span>{{ store.currentMap.name }}</span>
      <span class="mx-2">·</span>
      <span>{{ store.canvasState.selectedNodeIds.length }} selected</span>
      <span class="mx-2">·</span>
      <span>{{ store.structure }}</span>
      <span class="flex-1" />
      <span v-if="store.canUndo">Ctrl+Z to undo</span>
    </div>
  </div>
</template>
