<script setup lang="ts">
import { useMindMapStore } from '../stores/mindmap';
import {
  FileText, Save, FolderOpen, Undo, Redo, Plus, Trash2, Link,
  Sparkles, PanelRight, Moon, Sun
} from 'lucide-vue-next';
import { ref } from 'vue';

const emit = defineEmits<{
  'toggle-sidebar': [];
}>();

const store = useMindMapStore();
const isDark = ref(false);

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
}

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
</script>

<template>
  <div class="h-12 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-1">
    <!-- Logo -->
    <div class="flex items-center gap-2 mr-4">
      <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
        <span class="text-white font-bold text-sm">M</span>
      </div>
      <span class="font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline">MindMap Studio</span>
    </div>

    <!-- Divider -->
    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

    <!-- File operations -->
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="New Map"
      @click="store.newMap()"
    >
      <FileText :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Open"
    >
      <FolderOpen :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Save"
    >
      <Save :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

    <!-- History -->
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
      title="Undo (Ctrl+Z)"
      :disabled="!store.canUndo"
      @click="store.undo()"
    >
      <Undo :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
      title="Redo (Ctrl+Shift+Z)"
      :disabled="!store.canRedo"
      @click="store.redo()"
    >
      <Redo :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

    <!-- Node operations -->
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Add Child (Tab)"
      @click="handleAddChild"
    >
      <Plus :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Delete (Del)"
      @click="handleDelete"
    >
      <Trash2 :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Create Relationship"
      @click="handleCreateRelationship"
    >
      <Link :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

    <!-- AI -->
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
      title="AI Assistant"
    >
      <Sparkles :size="18" class="text-purple-500" />
      <span class="text-sm text-slate-600 dark:text-slate-400 hidden md:inline">AI</span>
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- View options -->
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Toggle Theme"
      @click="toggleTheme"
    >
      <Sun v-if="isDark" :size="18" class="text-slate-600 dark:text-slate-400" />
      <Moon v-else :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
    <button
      class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title="Toggle Sidebar"
      @click="emit('toggle-sidebar')"
    >
      <PanelRight :size="18" class="text-slate-600 dark:text-slate-400" />
    </button>
  </div>
</template>
