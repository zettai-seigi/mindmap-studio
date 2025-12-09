<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import {
  Plus, Copy, Trash2, Link, Box,
  Edit3, Clipboard, Scissors, FolderPlus, LayoutGrid
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
  { id: 'add-relationship', label: 'Add Relationship', icon: Link, requiresNode: true },
  { id: 'add-boundary', label: 'Add Boundary', icon: Box, requiresNode: true },
  { id: 'reset-position', label: 'Reset Position', icon: LayoutGrid, requiresNode: true },
  { id: 'divider4', type: 'divider' },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', requiresNode: true, notRoot: true, danger: true },
];

function handleClick(itemId: string) {
  if (!props.nodeId) return;

  switch (itemId) {
    case 'add-child':
      const newChild = store.addChild(props.nodeId);
      if (newChild) store.selectNode(newChild.id);
      break;
    case 'add-sibling':
      const newSibling = store.addSibling(props.nodeId);
      if (newSibling) store.selectNode(newSibling.id);
      break;
    case 'edit':
      store.startEditing(props.nodeId);
      break;
    case 'delete':
      if (props.nodeId !== store.root.id) {
        store.deleteNode(props.nodeId);
      }
      break;
    case 'add-relationship':
      store.startLinkMode(props.nodeId);
      break;
    case 'add-boundary':
      store.addBoundary([props.nodeId]);
      break;
    case 'reset-position':
      store.clearNodePosition(props.nodeId);
      break;
  }

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
  <div
    ref="menuRef"
    class="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[200px]"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <template v-for="item in menuItems" :key="item.id">
      <div
        v-if="item.type === 'divider'"
        class="h-px bg-slate-200 dark:bg-slate-700 my-1"
      />
      <button
        v-else-if="!item.requiresNode || nodeId"
        v-show="!(item.notRoot && nodeId === store.root.id)"
        class="w-full px-3 py-2 flex items-center gap-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        :class="item.danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-300'"
        @click="handleClick(item.id)"
      >
        <component :is="item.icon" :size="16" />
        <span class="flex-1 text-left">{{ item.label }}</span>
        <span v-if="item.shortcut" class="text-xs text-slate-400">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>
