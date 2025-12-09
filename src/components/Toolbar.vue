<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import {
  FileText, Save, FolderOpen, Undo, Redo, Plus, Trash2, Link,
  Sparkles, PanelRight, LayoutGrid, ChevronDown
} from 'lucide-vue-next';
import {
  exportToJSON,
  importFromJSON,
  exportToXMind,
  importFromXMind,
  downloadFile,
  openFilePicker,
  readFileAsText,
} from '../utils/fileUtils';

const emit = defineEmits<{
  'toggle-sidebar': [];
}>();

const store = useMindMapStore();

// Dropdown states
const showSaveMenu = ref(false);
const showOpenMenu = ref(false);
const saveMenuPosition = ref({ top: 0, left: 0 });
const openMenuPosition = ref({ top: 0, left: 0 });

// Button refs
const saveButtonRef = ref<HTMLElement | null>(null);
const openButtonRef = ref<HTMLElement | null>(null);

// Toggle dropdowns with position calculation
async function toggleSaveMenu() {
  showOpenMenu.value = false;
  showSaveMenu.value = !showSaveMenu.value;
  if (showSaveMenu.value && saveButtonRef.value) {
    await nextTick();
    const rect = saveButtonRef.value.getBoundingClientRect();
    saveMenuPosition.value = {
      top: rect.bottom + 4,
      left: rect.left
    };
  }
}

async function toggleOpenMenu() {
  showSaveMenu.value = false;
  showOpenMenu.value = !showOpenMenu.value;
  if (showOpenMenu.value && openButtonRef.value) {
    await nextTick();
    const rect = openButtonRef.value.getBoundingClientRect();
    openMenuPosition.value = {
      top: rect.bottom + 4,
      left: rect.left
    };
  }
}

// Close dropdowns when clicking outside
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.dropdown-container') && !target.closest('.dropdown-menu-fixed')) {
    showSaveMenu.value = false;
    showOpenMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function handleAddChild() {
  const selectedId = store.canvasState.selectedNodeIds[0];
  if (selectedId) {
    store.addChild(selectedId);
  }
}

function handleDelete() {
  const selectedId = store.canvasState.selectedNodeIds[0];
  if (selectedId && selectedId !== store.root.id) {
    store.deleteNode(selectedId);
  }
}

function handleCreateRelationship() {
  const selectedId = store.canvasState.selectedNodeIds[0];
  if (selectedId) {
    store.startLinkMode(selectedId);
  }
}

function handleResetLayout() {
  store.clearAllPositions();
}

// Save functions
async function saveAsJSON() {
  console.log('saveAsJSON called');
  showSaveMenu.value = false;
  const mapData = store.getMapData();
  const json = exportToJSON(mapData);
  const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  console.log('Downloading:', filename);
  downloadFile(json, filename, 'application/json');
}

async function saveAsXMind() {
  showSaveMenu.value = false;
  try {
    const mapData = store.getMapData();
    const blob = await exportToXMind(mapData);
    const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.xmind`;
    downloadFile(blob, filename, 'application/vnd.xmind.workbook');
  } catch (error) {
    console.error('Error exporting XMind:', error);
    alert('Failed to export XMind file: ' + (error as Error).message);
  }
}

// Open functions
async function openJSON() {
  showOpenMenu.value = false;
  try {
    const file = await openFilePicker('.json');
    if (!file) return;

    const content = await readFileAsText(file);
    const map = importFromJSON(content);
    store.loadMap(map);
  } catch (error) {
    console.error('Error importing JSON:', error);
    alert('Failed to import JSON file: ' + (error as Error).message);
  }
}

async function openXMind() {
  showOpenMenu.value = false;
  try {
    const file = await openFilePicker('.xmind');
    if (!file) return;

    const map = await importFromXMind(file);
    store.loadMap(map);
  } catch (error) {
    console.error('Error importing XMind:', error);
    alert('Failed to import XMind file: ' + (error as Error).message);
  }
}

</script>

<template>
  <div class="toolbar h-11 flex items-center px-3 gap-0.5">
    <!-- Window Controls Space (macOS style) -->
    <div class="w-16 shrink-0" />

    <!-- Logo -->
    <div class="flex items-center gap-2 mr-3">
      <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
        <span class="text-white font-bold text-xs">M</span>
      </div>
      <span class="text-[13px] font-medium text-white/90 hidden sm:inline">MindMap Studio</span>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- File operations -->
    <div class="btn-group">
      <button class="toolbar-btn" title="New Map" @click="store.newMap()">
        <FileText :size="16" />
      </button>

      <!-- Open Dropdown -->
      <div class="dropdown-container">
        <button
          ref="openButtonRef"
          class="toolbar-btn dropdown-trigger"
          title="Open"
          @click.stop="toggleOpenMenu"
        >
          <FolderOpen :size="16" />
          <ChevronDown :size="10" class="dropdown-arrow" />
        </button>
      </div>

      <!-- Save Dropdown -->
      <div class="dropdown-container">
        <button
          ref="saveButtonRef"
          class="toolbar-btn dropdown-trigger"
          title="Save"
          @click.stop="toggleSaveMenu"
        >
          <Save :size="16" />
          <ChevronDown :size="10" class="dropdown-arrow" />
        </button>
      </div>
    </div>

    <!-- Teleported dropdown menus to escape overflow constraints -->
    <Teleport to="body">
      <div
        v-if="showOpenMenu"
        class="dropdown-menu-fixed"
        :style="{ top: openMenuPosition.top + 'px', left: openMenuPosition.left + 'px' }"
        @click.stop
      >
        <button class="dropdown-item" @click="openJSON">
          <span class="dropdown-icon">{ }</span>
          <span>Open JSON (.json)</span>
        </button>
        <button class="dropdown-item" @click="openXMind">
          <span class="dropdown-icon">X</span>
          <span>Open XMind (.xmind)</span>
        </button>
      </div>

      <div
        v-if="showSaveMenu"
        class="dropdown-menu-fixed"
        :style="{ top: saveMenuPosition.top + 'px', left: saveMenuPosition.left + 'px' }"
        @click.stop
      >
        <button class="dropdown-item" @click="saveAsJSON">
          <span class="dropdown-icon">{ }</span>
          <span>Save as JSON (.json)</span>
        </button>
        <button class="dropdown-item" @click="saveAsXMind">
          <span class="dropdown-icon">X</span>
          <span>Save as XMind (.xmind)</span>
        </button>
      </div>
    </Teleport>

    <!-- Divider -->
    <div class="divider" />

    <!-- History -->
    <div class="btn-group">
      <button
        class="toolbar-btn"
        title="Undo (⌘Z)"
        :disabled="!store.canUndo"
        @click="store.undo()"
      >
        <Undo :size="16" />
      </button>
      <button
        class="toolbar-btn"
        title="Redo (⌘⇧Z)"
        :disabled="!store.canRedo"
        @click="store.redo()"
      >
        <Redo :size="16" />
      </button>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Node operations -->
    <div class="btn-group">
      <button class="toolbar-btn" title="Add Child (Tab)" @click="handleAddChild">
        <Plus :size="16" />
      </button>
      <button class="toolbar-btn" title="Delete (⌫)" @click="handleDelete">
        <Trash2 :size="16" />
      </button>
      <button class="toolbar-btn" title="Create Relationship" @click="handleCreateRelationship">
        <Link :size="16" />
      </button>
      <button class="toolbar-btn" title="Reset Layout" @click="handleResetLayout">
        <LayoutGrid :size="16" />
      </button>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- AI -->
    <button class="toolbar-btn ai-btn" title="AI Assistant">
      <Sparkles :size="16" />
      <span class="text-[12px] hidden md:inline">AI</span>
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Right side controls -->
    <div class="btn-group">
      <button
        class="toolbar-btn"
        title="Toggle Sidebar"
        @click="emit('toggle-sidebar')"
      >
        <PanelRight :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.15s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.toolbar-btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ai-btn {
  width: auto;
  padding: 0 10px;
  background: rgba(147, 51, 234, 0.2);
  color: #c084fc;
}

.ai-btn:hover {
  background: rgba(147, 51, 234, 0.3);
  color: #d8b4fe;
}

/* Dropdown */
.dropdown-container {
  position: relative;
}

.dropdown-trigger {
  width: auto !important;
  padding: 0 8px;
  gap: 2px;
}

.dropdown-arrow {
  opacity: 0.5;
}


.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  text-align: left;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.dropdown-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 4px;
}
</style>

<style>
/* Global styles for teleported dropdown menus */
.dropdown-menu-fixed {
  position: fixed;
  min-width: 180px;
  background: rgba(40, 40, 40, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 10000;
}

.dropdown-menu-fixed .dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  text-align: left;
  transition: all 0.15s ease;
}

.dropdown-menu-fixed .dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.dropdown-menu-fixed .dropdown-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 4px;
}
</style>
