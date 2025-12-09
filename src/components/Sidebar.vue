<script setup lang="ts">
import { computed } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { Palette, Tag, List, ChevronRight, ChevronDown } from 'lucide-vue-next';

const props = defineProps<{
  activeTab: 'format' | 'markers' | 'outline';
}>();

const emit = defineEmits<{
  'change-tab': ['format' | 'markers' | 'outline'];
}>();

const store = useMindMapStore();

const selectedNode = computed(() => {
  const id = store.canvasState.selectedNodeIds[0];
  return id ? store.findNodeById(id) : null;
});

// Flatten tree for outline view
function flattenTree(node: typeof store.root, level: number = 0): Array<{ node: typeof store.root; level: number }> {
  const result = [{ node, level }];
  if (!node.collapsed) {
    node.children.forEach(child => {
      result.push(...flattenTree(child, level + 1));
    });
  }
  return result;
}

const outlineNodes = computed(() => flattenTree(store.root));

const tabs = [
  { id: 'format', label: 'Format', icon: Palette },
  { id: 'markers', label: 'Markers', icon: Tag },
  { id: 'outline', label: 'Outline', icon: List },
] as const;

// Marker categories for the markers tab
const markerCategories = [
  {
    id: 'priority',
    label: 'Priority',
    options: [
      { id: 'priority-1', label: '1', color: '#ef4444' },
      { id: 'priority-2', label: '2', color: '#f97316' },
      { id: 'priority-3', label: '3', color: '#eab308' },
      { id: 'priority-4', label: '4', color: '#22c55e' },
      { id: 'priority-5', label: '5', color: '#3b82f6' },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    options: [
      { id: 'task-start', label: 'Not Started', color: '#94a3b8' },
      { id: 'task-half', label: 'Half', color: '#f59e0b' },
      { id: 'task-done', label: 'Done', color: '#22c55e' },
    ],
  },
  {
    id: 'flag',
    label: 'Flags',
    options: [
      { id: 'flag-red', label: 'Red', color: '#ef4444' },
      { id: 'flag-orange', label: 'Orange', color: '#f97316' },
      { id: 'flag-green', label: 'Green', color: '#22c55e' },
      { id: 'flag-blue', label: 'Blue', color: '#3b82f6' },
    ],
  },
];

function addMarkerToSelected(categoryId: string, optionId: string, color: string) {
  if (!selectedNode.value) return;
  store.addMarker(selectedNode.value.id, {
    id: optionId,
    category: categoryId as any,
    value: optionId,
    color,
  });
}
</script>

<template>
  <div class="w-72 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
    <!-- Tabs -->
    <div class="flex border-b border-slate-200 dark:border-slate-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'flex-1 py-2 px-3 text-xs font-medium transition-colors flex items-center justify-center gap-1',
          activeTab === tab.id
            ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        ]"
        @click="emit('change-tab', tab.id)"
      >
        <component :is="tab.icon" :size="14" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- Format Tab -->
      <div v-if="activeTab === 'format'" class="space-y-4">
        <div v-if="selectedNode">
          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Selected Node
          </h3>
          <div class="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
              {{ selectedNode.text }}
            </p>
          </div>

          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 mt-4">
            Node Style
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-600 dark:text-slate-400">Shape</span>
              <select class="text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1">
                <option>Rounded</option>
                <option>Rectangle</option>
                <option>Ellipse</option>
                <option>Cloud</option>
              </select>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-600 dark:text-slate-400">Background</span>
              <input type="color" class="w-8 h-6 rounded cursor-pointer" value="#3b82f6" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-600 dark:text-slate-400">Text Color</span>
              <input type="color" class="w-8 h-6 rounded cursor-pointer" value="#ffffff" />
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-sm text-slate-400 dark:text-slate-500">Select a node to format</p>
        </div>
      </div>

      <!-- Markers Tab -->
      <div v-if="activeTab === 'markers'" class="space-y-4">
        <div v-for="category in markerCategories" :key="category.id">
          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            {{ category.label }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in category.options"
              :key="option.id"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform"
              :style="{ backgroundColor: option.color }"
              :title="option.label"
              @click="addMarkerToSelected(category.id, option.id, option.color)"
            >
              {{ option.label.charAt(0) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Outline Tab -->
      <div v-if="activeTab === 'outline'" class="space-y-1">
        <div
          v-for="{ node, level } in outlineNodes"
          :key="node.id"
          :class="[
            'flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
            store.canvasState.selectedNodeIds.includes(node.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
          ]"
          :style="{ paddingLeft: `${level * 16 + 8}px` }"
          @click="store.selectNode(node.id)"
        >
          <button
            v-if="node.children.length > 0"
            class="w-4 h-4 flex items-center justify-center"
            @click.stop="store.toggleCollapse(node.id)"
          >
            <ChevronDown v-if="!node.collapsed" :size="12" />
            <ChevronRight v-else :size="12" />
          </button>
          <span v-else class="w-4" />
          <span class="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
            {{ node.text }}
          </span>
          <span
            v-if="node.markers.length > 0"
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: node.markers[0]?.color }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
