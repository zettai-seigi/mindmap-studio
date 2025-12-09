<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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
  { id: 'change-structure', label: 'Change Structure', icon: LayoutGrid, hasSubmenu: true },
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
      return; // Don't close menu
  }

  emit('close');
}

function handleStructureChange(layoutId: string) {
  store.setStructure(layoutId as StructureType);
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
        <!-- Item with submenu -->
        <div
          v-else-if="item.hasSubmenu"
          class="submenu-wrapper relative"
          @mouseenter="showStructureSubmenu = true"
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
</style>
