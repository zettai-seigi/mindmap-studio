<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import {
  FileText, Save, FolderOpen, Undo, Redo, Plus, Trash2, Link,
  Sparkles, PanelRight, LayoutGrid, ChevronDown, Sun, Moon, Monitor,
  Group, Square, Cloud, Waves, X, ArrowDownAZ, ClipboardPaste
} from 'lucide-vue-next';
import { useTheme } from '../composables/useTheme';
import {
  exportToJSON,
  importFromJSON,
  exportToXMind,
  importFromXMind,
  downloadFile,
  openFilePicker,
  readFileAsText,
  exportToSVG,
  exportToPDF,
  exportToMarkdown,
} from '../utils/fileUtils';

const props = defineProps<{
  canvasRef?: HTMLCanvasElement | null;
}>();

const emit = defineEmits<{
  'toggle-sidebar': [];
  'open-export-dialog': [];
}>();

const store = useMindMapStore();
const { themeMode, cycleTheme } = useTheme();

// Dropdown states
const showSaveMenu = ref(false);
const showOpenMenu = ref(false);
const showGroupMenu = ref(false);
const saveMenuPosition = ref({ top: 0, left: 0 });
const openMenuPosition = ref({ top: 0, left: 0 });
const groupMenuPosition = ref({ top: 0, left: 0 });

// Button refs
const saveButtonRef = ref<HTMLElement | null>(null);
const openButtonRef = ref<HTMLElement | null>(null);
const groupButtonRef = ref<HTMLElement | null>(null);

// Toggle dropdowns with position calculation
async function toggleSaveMenu() {
  showOpenMenu.value = false;
  showGroupMenu.value = false;
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
  showGroupMenu.value = false;
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

async function toggleGroupMenu() {
  showSaveMenu.value = false;
  showOpenMenu.value = false;
  showGroupMenu.value = !showGroupMenu.value;
  if (showGroupMenu.value && groupButtonRef.value) {
    await nextTick();
    const rect = groupButtonRef.value.getBoundingClientRect();
    groupMenuPosition.value = {
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
    showGroupMenu.value = false;
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

function handleToggleSidebar() {
  emit('toggle-sidebar');
}

// Save functions
async function saveAsJSON() {
  showSaveMenu.value = false;
  const mapData = store.getMapData();
  const json = exportToJSON(mapData);
  const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.json`;
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

function openExportDialog() {
  showSaveMenu.value = false;
  emit('open-export-dialog');
}

function saveAsSVG() {
  showSaveMenu.value = false;
  if (!props.canvasRef) {
    alert('Canvas not available for export');
    return;
  }
  const mapData = store.getMapData();
  const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.svg`;
  exportToSVG(props.canvasRef, filename);
}

async function saveAsPDF() {
  showSaveMenu.value = false;
  if (!props.canvasRef) {
    alert('Canvas not available for export');
    return;
  }
  try {
    const mapData = store.getMapData();
    const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    await exportToPDF(props.canvasRef, filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export PDF: ' + (error as Error).message);
  }
}

function saveAsMarkdown() {
  showSaveMenu.value = false;
  const mapData = store.getMapData();
  const markdown = exportToMarkdown(mapData);
  const filename = `${mapData.name.replace(/[^a-z0-9]/gi, '_')}.md`;
  downloadFile(markdown, filename, 'text/markdown');
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

// Group/Boundary functions
type BoundaryShape = 'rectangle' | 'rounded' | 'cloud' | 'wave';

function addBoundary(shape: BoundaryShape) {
  showGroupMenu.value = false;
  const selectedIds = store.canvasState.selectedNodeIds;
  if (selectedIds.length === 0) {
    alert('Please select one or more nodes to group');
    return;
  }
  store.addBoundary(selectedIds, '', shape);
}

function removeBoundaryFromSelected() {
  showGroupMenu.value = false;
  const selectedIds = store.canvasState.selectedNodeIds;
  if (selectedIds.length === 0) return;

  // Find boundaries that contain any of the selected nodes
  const boundaries = store.boundaries;
  boundaries.forEach(boundary => {
    if (selectedIds.some(id => boundary.nodeIds.includes(id))) {
      store.removeBoundary(boundary.id);
    }
  });
}

// Check if selected nodes have a boundary
function hasSelectedBoundary(): boolean {
  const selectedIds = store.canvasState.selectedNodeIds;
  if (selectedIds.length === 0) return false;
  return store.boundaries.some(b => selectedIds.some(id => b.nodeIds.includes(id)));
}

// Sort children alphabetically
function handleSortAlphabetically() {
  const selectedId = store.canvasState.selectedNodeIds[0];
  if (selectedId) {
    store.sortChildrenAlphabetically(selectedId);
  }
}

// Check if selected node has children to sort
function canSortChildren(): boolean {
  const selectedId = store.canvasState.selectedNodeIds[0];
  if (!selectedId) return false;
  const node = store.findNodeById(selectedId);
  return node !== null && node.children.length >= 2;
}

// New map from clipboard
async function newFromClipboard() {
  showOpenMenu.value = false;
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) {
      store.importFromClipboardText(text);
    } else {
      alert('Clipboard is empty');
    }
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    alert('Failed to read clipboard. Please make sure you have granted clipboard permissions.');
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
      <span class="logo-text text-[13px] font-medium hidden sm:inline">MindMap Studio</span>
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
        <div class="dropdown-divider" />
        <button class="dropdown-item" @click="newFromClipboard">
          <ClipboardPaste :size="14" class="dropdown-icon-svg" />
          <span>New from Clipboard</span>
          <span class="dropdown-shortcut">⌘⇧V</span>
        </button>
      </div>

      <div
        v-if="showSaveMenu"
        class="dropdown-menu-fixed"
        :style="{ top: saveMenuPosition.top + 'px', left: saveMenuPosition.left + 'px' }"
        @click.stop
      >
        <div class="dropdown-section">Document</div>
        <button class="dropdown-item" @click="saveAsJSON">
          <span class="dropdown-icon">{ }</span>
          <span>Save as JSON (.json)</span>
        </button>
        <button class="dropdown-item" @click="saveAsXMind">
          <span class="dropdown-icon">X</span>
          <span>Save as XMind (.xmind)</span>
        </button>
        <div class="dropdown-divider" />
        <div class="dropdown-section">Export Image</div>
        <button class="dropdown-item" @click="openExportDialog">
          <span class="dropdown-icon img">IMG</span>
          <span>Export as Image...</span>
        </button>
        <button class="dropdown-item" @click="saveAsSVG">
          <span class="dropdown-icon img">SVG</span>
          <span>Export as SVG</span>
        </button>
        <button class="dropdown-item" @click="saveAsPDF">
          <span class="dropdown-icon img">PDF</span>
          <span>Export as PDF</span>
        </button>
        <div class="dropdown-divider" />
        <div class="dropdown-section">Export Text</div>
        <button class="dropdown-item" @click="saveAsMarkdown">
          <span class="dropdown-icon">MD</span>
          <span>Export as Markdown</span>
        </button>
      </div>

      <!-- Group Menu -->
      <div
        v-if="showGroupMenu"
        class="dropdown-menu-fixed"
        :style="{ top: groupMenuPosition.top + 'px', left: groupMenuPosition.left + 'px' }"
        @click.stop
      >
        <div class="dropdown-section">Add Boundary</div>
        <button class="dropdown-item" @click="addBoundary('rounded')">
          <Square :size="14" class="dropdown-icon-svg" style="border-radius: 3px;" />
          <span>Rounded Rectangle</span>
          <span class="dropdown-shortcut">⌘G</span>
        </button>
        <button class="dropdown-item" @click="addBoundary('rectangle')">
          <Square :size="14" class="dropdown-icon-svg" />
          <span>Rectangle</span>
        </button>
        <button class="dropdown-item" @click="addBoundary('cloud')">
          <Cloud :size="14" class="dropdown-icon-svg" />
          <span>Cloud</span>
        </button>
        <button class="dropdown-item" @click="addBoundary('wave')">
          <Waves :size="14" class="dropdown-icon-svg" />
          <span>Wave</span>
        </button>
        <div class="dropdown-divider" />
        <button
          class="dropdown-item"
          :disabled="!hasSelectedBoundary()"
          @click="removeBoundaryFromSelected"
        >
          <X :size="14" class="dropdown-icon-svg" />
          <span>Remove Boundary</span>
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
      <button
        class="toolbar-btn"
        title="Sort Children A-Z"
        :disabled="!canSortChildren()"
        @click="handleSortAlphabetically"
      >
        <ArrowDownAZ :size="16" />
      </button>
      <button class="toolbar-btn" title="Reset Layout" @click="handleResetLayout">
        <LayoutGrid :size="16" />
      </button>
    </div>

    <!-- Divider -->
    <div class="divider" />

    <!-- Group/Boundary -->
    <div class="btn-group">
      <div class="dropdown-container">
        <button
          ref="groupButtonRef"
          class="toolbar-btn dropdown-trigger"
          title="Group (⌘G)"
          @click.stop="toggleGroupMenu"
        >
          <Group :size="16" />
          <ChevronDown :size="10" class="dropdown-arrow" />
        </button>
      </div>
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
      <!-- Theme Toggle -->
      <button
        class="toolbar-btn theme-btn"
        :title="`Theme: ${themeMode} (click to change)`"
        @click="cycleTheme"
      >
        <Sun v-if="themeMode === 'light'" :size="16" />
        <Moon v-else-if="themeMode === 'dark'" :size="16" />
        <Monitor v-else :size="16" />
      </button>

      <button
        class="toolbar-btn"
        title="Toggle Sidebar"
        @click="handleToggleSidebar"
      >
        <PanelRight :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  background: var(--bg-toolbar);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-primary);
  position: relative;
  z-index: 100;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 8px;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--border-secondary);
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
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--border-primary);
  color: var(--text-primary);
}

.toolbar-btn:active:not(:disabled) {
  background: var(--border-primary);
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

.theme-btn {
  color: var(--text-tertiary);
}

.theme-btn:hover {
  color: #f59e0b;
}

.logo-text {
  color: var(--text-primary);
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
  background: var(--bg-panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 4px;
  box-shadow: var(--shadow-lg);
  z-index: 10000;
}

.dropdown-menu-fixed .dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  transition: all 0.15s ease;
}

.dropdown-menu-fixed .dropdown-item:hover {
  background: var(--border-primary);
  color: var(--text-primary);
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

.dropdown-menu-fixed .dropdown-icon.img {
  font-size: 8px;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
}

.dropdown-menu-fixed .dropdown-section {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 12px 4px;
}

.dropdown-menu-fixed .dropdown-divider {
  height: 1px;
  background: var(--border-primary);
  margin: 4px 8px;
}

.dropdown-menu-fixed .dropdown-icon-svg {
  width: 20px;
  flex-shrink: 0;
  color: #60a5fa;
}

.dropdown-menu-fixed .dropdown-shortcut {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.dropdown-menu-fixed .dropdown-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dropdown-menu-fixed .dropdown-item:disabled:hover {
  background: transparent;
}
</style>
