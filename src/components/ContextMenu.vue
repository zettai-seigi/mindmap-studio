<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import type { StructureType } from '../types';
import {
  Plus, Copy, Trash2, Link, Box,
  Edit3, Clipboard, Scissors, FolderPlus, LayoutGrid, ChevronRight
} from 'lucide-vue-next';

const props = defineProps<{
  x: number;
  y: number;
  nodeId: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useMindMapStore();
const menuRef = ref<HTMLDivElement | null>(null);
const showStructureSubmenu = ref(false);

const layouts = [
  { id: 'mindmap', name: 'Mind Map', icon: '🧠' },
  { id: 'orgchart', name: 'Org Chart', icon: '🏢' },
  { id: 'tree', name: 'Tree Chart', icon: '🌳' },
  { id: 'logic', name: 'Logic Chart', icon: '➡️' },
  { id: 'fishbone', name: 'Fishbone', icon: '🐟' },
  { id: 'timeline', name: 'Timeline', icon: '📅' },
];

// Get the selected node for checking its structure
const selectedNode = computed(() => {
  return props.nodeId ? store.findNodeById(props.nodeId) : null;
});

// Check if node has a custom structure set
const nodeStructure = computed(() => selectedNode.value?.structure);

// Submenu states
const showNodeStructureSubmenu = ref(false);

const menuItems = [
  { id: 'add-child', label: 'Add Child Topic', icon: Plus, shortcut: 'Tab', requiresNode: true },
  { id: 'add-sibling', label: 'Add Sibling Topic', icon: FolderPlus, shortcut: 'Enter', requiresNode: true, notRoot: true },
  { id: 'divider1', type: 'divider' },
  { id: 'edit', label: 'Edit Text', icon: Edit3, shortcut: 'F2', requiresNode: true },
  { id: 'divider2', type: 'divider' },
  { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', requiresNode: true, notRoot: true },
  { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', requiresNode: true },
  { id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V', requiresNode: true },
  { id: 'divider3', type: 'divider' },
  { id: 'change-structure', label: 'Map Structure', icon: LayoutGrid, hasSubmenu: true, submenuType: 'global' },
  { id: 'set-node-structure', label: 'Children Structure', icon: LayoutGrid, hasSubmenu: true, submenuType: 'node', requiresNode: true },
  { id: 'add-relationship', label: 'Add Relationship', icon: Link, requiresNode: true },
  { id: 'add-boundary', label: 'Add Boundary', icon: Box, requiresNode: true },
  { id: 'reset-position', label: 'Reset All Positions', icon: LayoutGrid, requiresNode: false },
  { id: 'divider4', type: 'divider' },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', requiresNode: true, notRoot: true, danger: true },
];

function handleClick(itemId: string) {
  switch (itemId) {
    case 'add-child':
      if (!props.nodeId) return;
      const newChild = store.addChild(props.nodeId);
      if (newChild) store.selectNode(newChild.id);
      break;
    case 'add-sibling':
      if (!props.nodeId) return;
      const newSibling = store.addSibling(props.nodeId);
      if (newSibling) store.selectNode(newSibling.id);
      break;
    case 'edit':
      if (!props.nodeId) return;
      store.startEditing(props.nodeId);
      break;
    case 'delete':
      if (!props.nodeId) return;
      if (props.nodeId !== store.root.id) {
        store.deleteNode(props.nodeId);
      }
      break;
    case 'add-relationship':
      if (!props.nodeId) return;
      store.startLinkMode(props.nodeId);
      break;
    case 'add-boundary':
      if (!props.nodeId) return;
      store.addBoundary([props.nodeId]);
      break;
    case 'reset-position':
      store.clearAllPositions();
      break;
    case 'change-structure':
      showStructureSubmenu.value = !showStructureSubmenu.value;
      showNodeStructureSubmenu.value = false;
      return; // Don't close menu
    case 'set-node-structure':
      showNodeStructureSubmenu.value = !showNodeStructureSubmenu.value;
      showStructureSubmenu.value = false;
      return; // Don't close menu
  }

  emit('close');
}

// Change global map structure
function handleStructureChange(layoutId: string) {
  store.setStructure(layoutId as StructureType);
  emit('close');
}

// Set node-level structure (affects how this node's children are laid out)
function handleNodeStructureChange(layoutId: string | undefined) {
  if (!props.nodeId) return;
  store.setNodeStructure(props.nodeId, layoutId as StructureType | undefined);
  emit('close');
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close');
  }
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 0);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="context-menu fixed z-[9999] min-w-[220px] py-2 rounded-xl"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <template v-for="item in menuItems" :key="item.id">
        <!-- Divider -->
        <div
          v-if="item.type === 'divider'"
          class="divider h-px mx-3 my-2"
        />
        <!-- Global structure submenu -->
        <div
          v-else-if="item.hasSubmenu && item.submenuType === 'global'"
          class="submenu-wrapper relative"
          @mouseenter="showStructureSubmenu = true; showNodeStructureSubmenu = false"
          @mouseleave="showStructureSubmenu = false"
        >
          <button class="menu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]">
            <component :is="item.icon" :size="16" class="opacity-60 shrink-0" />
            <span class="flex-1 text-left">{{ item.label }}</span>
            <ChevronRight :size="14" class="opacity-40" />
          </button>
          <!-- Submenu -->
          <div
            v-show="showStructureSubmenu"
            class="submenu absolute min-w-[180px] py-2 rounded-xl"
            style="left: calc(100% - 4px); top: -8px;"
          >
            <button
              v-for="layout in layouts"
              :key="layout.id"
              class="submenu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]"
              :class="{ 'active': store.structure === layout.id }"
              @click="handleStructureChange(layout.id)"
            >
              <span class="text-base leading-none w-5 text-center">{{ layout.icon }}</span>
              <span class="flex-1 text-left">{{ layout.name }}</span>
              <span v-if="store.structure === layout.id" class="checkmark">✓</span>
            </button>
          </div>
        </div>
        <!-- Node-level structure submenu (Children Structure) -->
        <div
          v-else-if="item.hasSubmenu && item.submenuType === 'node' && nodeId"
          class="submenu-wrapper relative"
          @mouseenter="showNodeStructureSubmenu = true; showStructureSubmenu = false"
          @mouseleave="showNodeStructureSubmenu = false"
        >
          <button class="menu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]">
            <component :is="item.icon" :size="16" class="opacity-60 shrink-0" />
            <span class="flex-1 text-left">{{ item.label }}</span>
            <span v-if="nodeStructure" class="node-structure-badge">{{ nodeStructure }}</span>
            <ChevronRight :size="14" class="opacity-40" />
          </button>
          <!-- Submenu for node structure -->
          <div
            v-show="showNodeStructureSubmenu"
            class="submenu absolute min-w-[180px] py-2 rounded-xl"
            style="left: calc(100% - 4px); top: -8px;"
          >
            <!-- Inherit from parent option -->
            <button
              class="submenu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]"
              :class="{ 'active': !nodeStructure }"
              @click="handleNodeStructureChange(undefined)"
            >
              <span class="text-base leading-none w-5 text-center">↩️</span>
              <span class="flex-1 text-left">Inherit (Default)</span>
              <span v-if="!nodeStructure" class="checkmark">✓</span>
            </button>
            <div class="submenu-divider h-px mx-3 my-1 bg-white/10" />
            <button
              v-for="layout in layouts"
              :key="layout.id"
              class="submenu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]"
              :class="{ 'active': nodeStructure === layout.id }"
              @click="handleNodeStructureChange(layout.id)"
            >
              <span class="text-base leading-none w-5 text-center">{{ layout.icon }}</span>
              <span class="flex-1 text-left">{{ layout.name }}</span>
              <span v-if="nodeStructure === layout.id" class="checkmark">✓</span>
            </button>
          </div>
        </div>
        <!-- Regular items -->
        <button
          v-else-if="!item.requiresNode || nodeId"
          v-show="!(item.notRoot && nodeId === store.root.id)"
          class="menu-item w-full h-8 px-3 flex items-center gap-3 text-[13px]"
          :class="{ 'danger': item.danger }"
          @click="handleClick(item.id)"
        >
          <component
            :is="item.icon"
            :size="16"
            class="shrink-0"
            :class="item.danger ? 'text-red-400' : 'opacity-60'"
          />
          <span class="flex-1 text-left" :class="item.danger ? 'text-red-400' : ''">{{ item.label }}</span>
          <span v-if="item.shortcut" class="shortcut text-[11px] opacity-40">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.3);
  color: #e5e5e5;
}

.divider {
  background: rgba(255, 255, 255, 0.1);
}

.submenu-wrapper {
  padding-right: 8px;
  margin-right: -8px;
}

.submenu {
  background: rgba(40, 40, 40, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.3);
  color: #e5e5e5;
  z-index: 10000;
}

.menu-item {
  color: #e5e5e5;
  border-radius: 6px;
  margin: 0 6px;
  width: calc(100% - 12px);
  transition: background-color 0.1s ease;
}

.menu-item:hover {
  background: rgba(59, 130, 246, 0.8);
  color: white;
}

.menu-item:hover svg,
.menu-item:hover .opacity-60,
.menu-item:hover .opacity-40 {
  opacity: 1;
  color: white;
}

.menu-item.danger {
  color: #f87171;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.8);
  color: white;
}

.menu-item.danger:hover svg {
  color: white;
}

.submenu-item {
  color: #e5e5e5;
  border-radius: 6px;
  margin: 0 6px;
  width: calc(100% - 12px);
  transition: background-color 0.1s ease;
}

.submenu-item:hover {
  background: rgba(59, 130, 246, 0.8);
  color: white;
}

.submenu-item:hover svg,
.submenu-item:hover span {
  color: white;
}

.submenu-item.active {
  background: rgba(59, 130, 246, 0.2);
}

.shortcut {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.checkmark {
  color: #60a5fa;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.node-structure-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 4px;
}
</style>
