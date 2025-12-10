<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMindMapStore } from '../stores/mindmap';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import TagsPanel from './TagsPanel.vue';
import RelationshipsPanel from './RelationshipsPanel.vue';
import BoundariesPanel from './BoundariesPanel.vue';
import SummariesPanel from './SummariesPanel.vue';
import ThemesPanel from './ThemesPanel.vue';

const store = useMindMapStore();

const selectedNode = computed(() => {
  const id = store.canvasState.selectedNodeIds[0];
  return id ? store.findNodeById(id) : null;
});

// Active tab
const activeTab = ref<'outline' | 'markers' | 'style' | 'clipart' | 'notes' | 'comments' | 'tasks' | 'tags' | 'relationships' | 'boundaries' | 'summaries' | 'themes'>('themes');

// Define emit for filter changes
const emit = defineEmits<{
  filterChange: [tags: string[]];
}>();

function handleTagFilterChange(tags: string[]) {
  emit('filterChange', tags);
}

// Sheet format from store
const sheetFormat = computed(() => store.sheetFormat);

function updateFormat(key: string, value: any) {
  store.updateSheetFormat({ [key]: value });
}

// Wallpaper options
const wallpaperOptions = [
  { id: '', label: 'Select Wallpaper...' },
  { id: 'grid', label: 'Grid Pattern' },
  { id: 'dots', label: 'Dot Pattern' },
  { id: 'lines', label: 'Line Pattern' },
  { id: 'paper', label: 'Paper Texture' },
];

// Collapsed sections for markers
const collapsedSections = ref<Set<string>>(new Set());

// Collapsed nodes in outline
const collapsedOutlineNodes = ref<Set<string>>(new Set());

function toggleSection(sectionId: string) {
  if (collapsedSections.value.has(sectionId)) {
    collapsedSections.value.delete(sectionId);
  } else {
    collapsedSections.value.add(sectionId);
  }
}

function toggleOutlineNode(nodeId: string) {
  const newSet = new Set(collapsedOutlineNodes.value);
  if (newSet.has(nodeId)) {
    newSet.delete(nodeId);
  } else {
    newSet.add(nodeId);
  }
  collapsedOutlineNodes.value = newSet;
}

function isNodeCollapsed(nodeId: string): boolean {
  return collapsedOutlineNodes.value.has(nodeId);
}

// Flatten tree for outline view
interface OutlineNode {
  node: ReturnType<typeof store.findNodeById>;
  level: number;
}

function flattenTree(node: NonNullable<ReturnType<typeof store.findNodeById>>, level: number = 0): OutlineNode[] {
  const result: OutlineNode[] = [{ node, level }];
  const collapsed = isNodeCollapsed(node.id);

  if (!collapsed && node.children) {
    node.children.forEach(child => {
      result.push(...flattenTree(child, level + 1));
    });
  }
  return result;
}

const outlineNodes = computed(() => {
  if (!store.root) return [];
  return flattenTree(store.root);
});

// Marker categories matching XMind style
const markerCategories = [
  {
    id: 'priority',
    label: 'Task Priority',
    markers: [
      { id: 'p1', label: '1', bg: '#ef4444', text: 'white' },
      { id: 'p2', label: '2', bg: '#f97316', text: 'white' },
      { id: 'p3', label: '3', bg: '#eab308', text: 'white' },
      { id: 'p4', label: '4', bg: '#22c55e', text: 'white' },
      { id: 'p5', label: '5', bg: '#3b82f6', text: 'white' },
      { id: 'p6', label: '6', bg: '#8b5cf6', text: 'white' },
      { id: 'p7', label: '7', bg: '#64748b', text: 'white' },
      { id: 'p8', label: '8', bg: '#374151', text: 'white' },
      { id: 'p9', label: '9', bg: '#78716c', text: 'white' },
    ],
  },
  {
    id: 'faces',
    label: 'Faces & Emotions',
    markers: [
      { id: 'face-happy', emoji: '😊' },
      { id: 'face-sad', emoji: '😢' },
      { id: 'face-angry', emoji: '😠' },
      { id: 'face-surprised', emoji: '😮' },
      { id: 'face-laugh', emoji: '😄' },
      { id: 'face-love', emoji: '😍' },
      { id: 'face-think', emoji: '🤔' },
      { id: 'face-cool', emoji: '😎' },
      { id: 'face-wink', emoji: '😉' },
      { id: 'face-cry', emoji: '😭' },
      { id: 'face-sweat', emoji: '😅' },
      { id: 'face-sleeping', emoji: '😴' },
      { id: 'face-sick', emoji: '🤢' },
      { id: 'face-mind-blown', emoji: '🤯' },
      { id: 'face-party', emoji: '🥳' },
      { id: 'face-nerd', emoji: '🤓' },
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    markers: [
      { id: 'gest-thumbsup', emoji: '👍' },
      { id: 'gest-thumbsdown', emoji: '👎' },
      { id: 'gest-clap', emoji: '👏' },
      { id: 'gest-wave', emoji: '👋' },
      { id: 'gest-ok', emoji: '👌' },
      { id: 'gest-point', emoji: '👉' },
      { id: 'gest-fist', emoji: '✊' },
      { id: 'gest-raised', emoji: '✋' },
      { id: 'gest-muscle', emoji: '💪' },
      { id: 'gest-pray', emoji: '🙏' },
      { id: 'gest-writing', emoji: '✍️' },
      { id: 'gest-eyes', emoji: '👀' },
    ],
  },
  {
    id: 'objects',
    label: 'Objects & Tools',
    markers: [
      { id: 'obj-lightbulb', emoji: '💡' },
      { id: 'obj-fire', emoji: '🔥' },
      { id: 'obj-star', emoji: '⭐' },
      { id: 'obj-heart', emoji: '❤️' },
      { id: 'obj-rocket', emoji: '🚀' },
      { id: 'obj-target', emoji: '🎯' },
      { id: 'obj-trophy', emoji: '🏆' },
      { id: 'obj-medal', emoji: '🥇' },
      { id: 'obj-gem', emoji: '💎' },
      { id: 'obj-bolt', emoji: '⚡' },
      { id: 'obj-magnet', emoji: '🧲' },
      { id: 'obj-gear', emoji: '⚙️' },
      { id: 'obj-wrench', emoji: '🔧' },
      { id: 'obj-key', emoji: '🔑' },
      { id: 'obj-lock', emoji: '🔒' },
      { id: 'obj-bell', emoji: '🔔' },
    ],
  },
  {
    id: 'nature',
    label: 'Nature & Weather',
    markers: [
      { id: 'nat-sun', emoji: '☀️' },
      { id: 'nat-moon', emoji: '🌙' },
      { id: 'nat-cloud', emoji: '☁️' },
      { id: 'nat-rain', emoji: '🌧️' },
      { id: 'nat-snow', emoji: '❄️' },
      { id: 'nat-rainbow', emoji: '🌈' },
      { id: 'nat-tree', emoji: '🌳' },
      { id: 'nat-flower', emoji: '🌸' },
      { id: 'nat-leaf', emoji: '🍃' },
      { id: 'nat-seedling', emoji: '🌱' },
      { id: 'nat-earth', emoji: '🌍' },
      { id: 'nat-mountain', emoji: '⛰️' },
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Work',
    markers: [
      { id: 'tech-laptop', emoji: '💻' },
      { id: 'tech-phone', emoji: '📱' },
      { id: 'tech-email', emoji: '📧' },
      { id: 'tech-folder', emoji: '📁' },
      { id: 'tech-chart', emoji: '📊' },
      { id: 'tech-calendar', emoji: '📅' },
      { id: 'tech-clipboard', emoji: '📋' },
      { id: 'tech-pencil', emoji: '✏️' },
      { id: 'tech-book', emoji: '📚' },
      { id: 'tech-money', emoji: '💰' },
      { id: 'tech-briefcase', emoji: '💼' },
      { id: 'tech-clock', emoji: '⏰' },
    ],
  },
  {
    id: 'progress',
    label: 'Task Progress',
    markers: [
      { id: 'prog-0', icon: '○', color: '#94a3b8' },
      { id: 'prog-25', icon: '◔', color: '#f59e0b' },
      { id: 'prog-50', icon: '◑', color: '#f59e0b' },
      { id: 'prog-75', icon: '◕', color: '#22c55e' },
      { id: 'prog-100', icon: '●', color: '#22c55e' },
      { id: 'prog-start', icon: '▶', color: '#3b82f6' },
      { id: 'prog-pause', icon: '⏸', color: '#f97316' },
      { id: 'prog-cancel', icon: '✕', color: '#ef4444' },
    ],
  },
  {
    id: 'flags',
    label: 'Flags',
    markers: [
      { id: 'flag-red', icon: '🚩', color: '#ef4444' },
      { id: 'flag-orange', icon: '🚩', color: '#f97316' },
      { id: 'flag-yellow', icon: '🚩', color: '#eab308' },
      { id: 'flag-green', icon: '🚩', color: '#22c55e' },
      { id: 'flag-blue', icon: '🚩', color: '#3b82f6' },
      { id: 'flag-purple', icon: '🚩', color: '#8b5cf6' },
      { id: 'flag-gray', icon: '🚩', color: '#64748b' },
    ],
  },
  {
    id: 'stars',
    label: 'Stars',
    markers: [
      { id: 'star-red', icon: '★', color: '#ef4444' },
      { id: 'star-orange', icon: '★', color: '#f97316' },
      { id: 'star-yellow', icon: '★', color: '#eab308' },
      { id: 'star-green', icon: '★', color: '#22c55e' },
      { id: 'star-blue', icon: '★', color: '#3b82f6' },
      { id: 'star-purple', icon: '★', color: '#8b5cf6' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    markers: [
      { id: 'person-red', icon: '👤', color: '#ef4444' },
      { id: 'person-orange', icon: '👤', color: '#f97316' },
      { id: 'person-yellow', icon: '👤', color: '#eab308' },
      { id: 'person-green', icon: '👤', color: '#22c55e' },
      { id: 'person-blue', icon: '👤', color: '#3b82f6' },
      { id: 'person-purple', icon: '👤', color: '#8b5cf6' },
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    markers: [
      { id: 'arrow-up', icon: '↑', color: '#22c55e' },
      { id: 'arrow-up-right', icon: '↗', color: '#22c55e' },
      { id: 'arrow-right', icon: '→', color: '#3b82f6' },
      { id: 'arrow-down-right', icon: '↘', color: '#f97316' },
      { id: 'arrow-down', icon: '↓', color: '#ef4444' },
      { id: 'arrow-down-left', icon: '↙', color: '#ef4444' },
      { id: 'arrow-left', icon: '←', color: '#64748b' },
      { id: 'arrow-up-left', icon: '↖', color: '#22c55e' },
      { id: 'arrow-refresh', icon: '↻', color: '#3b82f6' },
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    markers: [
      { id: 'sym-plus', icon: '+', bg: '#22c55e', color: 'white' },
      { id: 'sym-minus', icon: '−', bg: '#ef4444', color: 'white' },
      { id: 'sym-question', icon: '?', bg: '#3b82f6', color: 'white' },
      { id: 'sym-info', icon: 'i', bg: '#3b82f6', color: 'white' },
      { id: 'sym-warning', icon: '!', bg: '#f59e0b', color: 'white' },
      { id: 'sym-error', icon: '✕', bg: '#ef4444', color: 'white' },
      { id: 'sym-check', icon: '✓', bg: '#22c55e', color: 'white' },
      { id: 'sym-stop', icon: '⏹', bg: '#ef4444', color: 'white' },
    ],
  },
  {
    id: 'month',
    label: 'Month',
    markers: [
      { id: 'month-1', label: '1', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-2', label: '2', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-3', label: '3', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-4', label: '4', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-5', label: '5', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-6', label: '6', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-7', label: '7', bg: '#e5e7eb', text: '#374151' },
      { id: 'month-8', label: '8', bg: '#e5e7eb', text: '#374151' },
    ],
  },
];

// Tab definitions with icons (matching XMind's right sidebar)
const tabs = [
  { id: 'themes', icon: '🎭', label: 'Themes' },
  { id: 'outline', icon: '📋', label: 'Outline' },
  { id: 'markers', icon: '🏷️', label: 'Markers' },
  { id: 'tags', icon: '🔖', label: 'Tags' },
  { id: 'style', icon: '🎨', label: 'Sheet Format' },
  { id: 'relationships', icon: '🔗', label: 'Relationships' },
  { id: 'boundaries', icon: '⬜', label: 'Boundaries' },
  { id: 'summaries', icon: '⌐', label: 'Summaries' },
  { id: 'clipart', icon: '🖼️', label: 'Clipart' },
  { id: 'notes', icon: '📝', label: 'Notes' },
  { id: 'comments', icon: '💬', label: 'Comments' },
  { id: 'tasks', icon: '☑️', label: 'Tasks' },
] as const;

// Clipart categories with emoji icons (like XMind)
const clipartCategories = [
  {
    id: 'education',
    label: 'Education',
    items: [
      { id: 'edu-book', icon: '📚', label: 'Books' },
      { id: 'edu-graduation', icon: '🎓', label: 'Graduation' },
      { id: 'edu-pencil', icon: '✏️', label: 'Pencil' },
      { id: 'edu-school', icon: '🏫', label: 'School' },
      { id: 'edu-microscope', icon: '🔬', label: 'Microscope' },
      { id: 'edu-globe', icon: '🌍', label: 'Globe' },
      { id: 'edu-calculator', icon: '🧮', label: 'Calculator' },
      { id: 'edu-notebook', icon: '📓', label: 'Notebook' },
      { id: 'edu-ruler', icon: '📏', label: 'Ruler' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    items: [
      { id: 'biz-chart', icon: '📊', label: 'Chart' },
      { id: 'biz-briefcase', icon: '💼', label: 'Briefcase' },
      { id: 'biz-money', icon: '💰', label: 'Money' },
      { id: 'biz-handshake', icon: '🤝', label: 'Handshake' },
      { id: 'biz-building', icon: '🏢', label: 'Building' },
      { id: 'biz-target', icon: '🎯', label: 'Target' },
      { id: 'biz-trophy', icon: '🏆', label: 'Trophy' },
      { id: 'biz-lightbulb', icon: '💡', label: 'Idea' },
      { id: 'biz-rocket', icon: '🚀', label: 'Launch' },
    ],
  },
  {
    id: 'festival',
    label: 'Festival',
    items: [
      { id: 'fest-party', icon: '🎉', label: 'Party' },
      { id: 'fest-gift', icon: '🎁', label: 'Gift' },
      { id: 'fest-balloon', icon: '🎈', label: 'Balloon' },
      { id: 'fest-cake', icon: '🎂', label: 'Cake' },
      { id: 'fest-fireworks', icon: '🎆', label: 'Fireworks' },
      { id: 'fest-christmas', icon: '🎄', label: 'Christmas' },
      { id: 'fest-pumpkin', icon: '🎃', label: 'Halloween' },
      { id: 'fest-heart', icon: '❤️', label: 'Love' },
    ],
  },
  {
    id: 'health',
    label: 'Health',
    items: [
      { id: 'health-hospital', icon: '🏥', label: 'Hospital' },
      { id: 'health-pill', icon: '💊', label: 'Medicine' },
      { id: 'health-heart', icon: '❤️‍🩹', label: 'Health' },
      { id: 'health-syringe', icon: '💉', label: 'Vaccine' },
      { id: 'health-stethoscope', icon: '🩺', label: 'Doctor' },
      { id: 'health-ambulance', icon: '🚑', label: 'Emergency' },
      { id: 'health-dna', icon: '🧬', label: 'DNA' },
      { id: 'health-fitness', icon: '💪', label: 'Fitness' },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    items: [
      { id: 'sport-soccer', icon: '⚽', label: 'Soccer' },
      { id: 'sport-basketball', icon: '🏀', label: 'Basketball' },
      { id: 'sport-tennis', icon: '🎾', label: 'Tennis' },
      { id: 'sport-golf', icon: '⛳', label: 'Golf' },
      { id: 'sport-swimming', icon: '🏊', label: 'Swimming' },
      { id: 'sport-cycling', icon: '🚴', label: 'Cycling' },
      { id: 'sport-medal', icon: '🥇', label: 'Medal' },
      { id: 'sport-gym', icon: '🏋️', label: 'Gym' },
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    items: [
      { id: 'travel-plane', icon: '✈️', label: 'Airplane' },
      { id: 'travel-car', icon: '🚗', label: 'Car' },
      { id: 'travel-train', icon: '🚄', label: 'Train' },
      { id: 'travel-ship', icon: '🚢', label: 'Ship' },
      { id: 'travel-map', icon: '🗺️', label: 'Map' },
      { id: 'travel-luggage', icon: '🧳', label: 'Luggage' },
      { id: 'travel-compass', icon: '🧭', label: 'Compass' },
      { id: 'travel-beach', icon: '🏖️', label: 'Beach' },
    ],
  },
  {
    id: 'weather',
    label: 'Weather',
    items: [
      { id: 'weather-sun', icon: '☀️', label: 'Sunny' },
      { id: 'weather-cloud', icon: '☁️', label: 'Cloudy' },
      { id: 'weather-rain', icon: '🌧️', label: 'Rainy' },
      { id: 'weather-snow', icon: '❄️', label: 'Snow' },
      { id: 'weather-thunder', icon: '⛈️', label: 'Storm' },
      { id: 'weather-rainbow', icon: '🌈', label: 'Rainbow' },
      { id: 'weather-wind', icon: '💨', label: 'Wind' },
      { id: 'weather-moon', icon: '🌙', label: 'Night' },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    items: [
      { id: 'other-cube', icon: '📦', label: 'Box' },
      { id: 'other-cloud', icon: '☁️', label: 'Cloud' },
      { id: 'other-stack', icon: '📚', label: 'Stack' },
      { id: 'other-folder', icon: '📁', label: 'Folder' },
      { id: 'other-phone', icon: '📱', label: 'Phone' },
      { id: 'other-person', icon: '🧑', label: 'Person' },
      { id: 'other-lock', icon: '🔒', label: 'Lock' },
      { id: 'other-gear', icon: '⚙️', label: 'Settings' },
      { id: 'other-computer', icon: '🖥️', label: 'Computer' },
      { id: 'other-tools', icon: '🛠️', label: 'Tools' },
      { id: 'other-key', icon: '🔑', label: 'Key' },
      { id: 'other-bell', icon: '🔔', label: 'Bell' },
    ],
  },
];

// Collapsed clipart categories
const collapsedClipartCategories = ref<Set<string>>(new Set());

function toggleClipartCategory(categoryId: string) {
  const newSet = new Set(collapsedClipartCategories.value);
  if (newSet.has(categoryId)) {
    newSet.delete(categoryId);
  } else {
    newSet.add(categoryId);
  }
  collapsedClipartCategories.value = newSet;
}

function isClipartCategoryCollapsed(categoryId: string): boolean {
  return collapsedClipartCategories.value.has(categoryId);
}

// Drag and drop for clipart
function handleClipartDragStart(e: DragEvent, clipart: { id: string; icon: string; label: string }) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'clipart',
      ...clipart,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }
}

function addMarkerToNode(markerId: string, markerData: any) {
  if (!selectedNode.value) return;

  store.addMarker(selectedNode.value.id, {
    id: markerId,
    category: markerData.category || 'custom',
    value: markerId,
    color: markerData.bg || markerData.color || '#3b82f6',
  });
}

// Notes editor state
const notesFont = ref('system-ui');
const notesFontSize = ref('14');
const notesBold = ref(false);
const notesItalic = ref(false);
const notesUnderline = ref(false);
const notesTextColor = ref('#e5e5e5');
const notesHighlightColor = ref('#ffff00');

// Current node notes (computed with getter/setter for reactivity)
const currentNodeNotes = computed({
  get: () => selectedNode.value?.notes || '',
  set: (value: string) => {
    if (selectedNode.value) {
      store.updateNodeNotes(selectedNode.value.id, value);
    }
  }
});

function updateNodeNotes(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  if (selectedNode.value) {
    store.updateNodeNotes(selectedNode.value.id, target.value);
  }
}

function insertBulletList() {
  if (selectedNode.value) {
    const currentNotes = selectedNode.value.notes || '';
    const newNotes = currentNotes + (currentNotes ? '\n' : '') + '• ';
    store.updateNodeNotes(selectedNode.value.id, newNotes);
  }
}

// Comments
const newCommentText = ref('');
const currentUser = ref('User'); // In a real app, this would come from auth

function submitComment() {
  if (!selectedNode.value || !newCommentText.value.trim()) return;
  store.addComment(selectedNode.value.id, currentUser.value, newCommentText.value.trim());
  newCommentText.value = '';
}

function deleteCommentFromNode(commentId: string) {
  if (!selectedNode.value) return;
  store.deleteComment(selectedNode.value.id, commentId);
}

function focusCommentInput() {
  // Focus the comment input textarea
  const input = document.querySelector('.comment-input') as HTMLTextAreaElement;
  if (input) {
    input.focus();
  }
}

function formatCommentTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Tasks
function updateTask(field: string, value: any) {
  if (!selectedNode.value) return;
  store.updateTaskInfo(selectedNode.value.id, { [field]: value });
}

function clearTask() {
  if (!selectedNode.value) return;
  store.clearTaskInfo(selectedNode.value.id);
}

function formatDateTimeLocal(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  // Format as YYYY-MM-DDTHH:MM
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocal(value: string): number | null {
  if (!value) return null;
  return new Date(value).getTime();
}

function formatEndDate(timestamp?: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function editEndDateDirectly() {
  // For now, just show an alert - could be expanded to a modal
  alert('To change the end date, adjust the Start date or Duration.');
}

function selectNode(nodeId: string) {
  store.selectNode(nodeId);
}

// Expose method to set active tab from parent (for keyboard shortcuts)
function setActiveTab(tabId: typeof activeTab.value) {
  activeTab.value = tabId;
}

// Expose for parent component
defineExpose({
  setActiveTab,
});

function resetStyle() {
  store.resetSheetFormat();
}

// Node shape options
const shapeOptions = [
  { id: 'rounded', label: 'Rounded', icon: '▢' },
  { id: 'rectangle', label: 'Rectangle', icon: '▬' },
  { id: 'ellipse', label: 'Ellipse', icon: '⬭' },
  { id: 'diamond', label: 'Diamond', icon: '◇' },
  { id: 'capsule', label: 'Capsule', icon: '⬬' },
  { id: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { id: 'parallelogram', label: 'Parallelogram', icon: '▱' },
  { id: 'cloud', label: 'Cloud', icon: '☁' },
  { id: 'underline', label: 'Underline', icon: '＿' },
  { id: 'none', label: 'None', icon: '○' },
];

function updateNodeShape(shape: string) {
  if (!selectedNode.value) return;
  store.updateNodeStyle(selectedNode.value.id, { shape });
}

function updateNodeColor(color: string) {
  if (!selectedNode.value) return;
  store.updateNodeStyle(selectedNode.value.id, { backgroundColor: color });
}

// Get header title
const headerTitle = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.label || 'Outline';
});
</script>

<template>
  <div class="sidebar-container">
    <!-- Main Content Panel -->
    <div class="sidebar-panel">
      <!-- Header -->
      <div class="sidebar-header">
        <span class="header-title">{{ headerTitle }}</span>
        <div class="header-actions">
          <button class="header-btn" title="View options">
            <span>☰</span>
          </button>
          <select class="header-select" v-if="activeTab === 'outline'">
            <option>None</option>
            <option>By Priority</option>
            <option>By Progress</option>
          </select>
        </div>
      </div>

      <!-- Themes Content -->
      <div v-if="activeTab === 'themes'" class="sidebar-content themes-content">
        <ThemesPanel />
      </div>

      <!-- Outline Content -->
      <div v-else-if="activeTab === 'outline'" class="sidebar-content outline-content">
        <div class="outline-tree">
          <template v-for="{ node, level } in outlineNodes" :key="node?.id">
            <div
              v-if="node"
              :class="['outline-item', { selected: store.canvasState.selectedNodeIds.includes(node.id) }]"
              :style="{ paddingLeft: `${level * 16 + 8}px` }"
              @click="selectNode(node.id)"
            >
              <button
                v-if="node.children && node.children.length > 0"
                class="outline-toggle"
                @click.stop="toggleOutlineNode(node.id)"
              >
                <ChevronDown v-if="!isNodeCollapsed(node.id)" :size="12" />
                <ChevronRight v-else :size="12" />
              </button>
              <span v-else class="outline-toggle-placeholder"></span>
              <span class="outline-text">{{ node.text }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Style/Sheet Format Content -->
      <div v-else-if="activeTab === 'style'" class="sidebar-content style-content">
        <!-- Node Shape Section (only when node is selected) -->
        <div v-if="selectedNode" class="format-section node-style-section">
          <div class="format-section-title">Node Style</div>

          <!-- Shape Selection -->
          <div class="shape-label">Shape</div>
          <div class="shape-grid">
            <button
              v-for="shape in shapeOptions"
              :key="shape.id"
              class="shape-option"
              :class="{ active: selectedNode.style?.shape === shape.id || (!selectedNode.style?.shape && shape.id === 'rounded') }"
              :title="shape.label"
              @click="updateNodeShape(shape.id)"
            >
              <span class="shape-icon">{{ shape.icon }}</span>
            </button>
          </div>

          <!-- Node Background Color -->
          <div class="format-row" style="margin-top: 12px;">
            <span class="format-label">Node Color:</span>
            <div class="node-color-picker">
              <button
                v-for="color in ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']"
                :key="color"
                class="node-color-option"
                :class="{ active: selectedNode.style?.backgroundColor === color }"
                :style="{ backgroundColor: color }"
                @click="updateNodeColor(color)"
              />
              <div class="color-picker-wrapper custom-color">
                <div
                  class="node-color-option custom"
                  :style="{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }"
                  title="Custom color"
                />
                <input
                  type="color"
                  :value="selectedNode.style?.backgroundColor || '#3b82f6'"
                  @input="updateNodeColor(($event.target as HTMLInputElement).value)"
                  class="color-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Background Section -->
        <div class="format-section">
          <div class="format-section-title">Background</div>
          <div class="format-row">
            <span class="format-label">Background Color:</span>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: sheetFormat.backgroundColor }"></div>
              <input type="color" :value="sheetFormat.backgroundColor" @input="updateFormat('backgroundColor', ($event.target as HTMLInputElement).value)" class="color-input" />
            </div>
          </div>
        </div>

        <!-- Wallpaper Section -->
        <div class="format-section">
          <div class="format-section-title">Wallpaper</div>
          <div class="format-row">
            <span class="wallpaper-icon">🖼️</span>
            <select :value="sheetFormat.wallpaper" @change="updateFormat('wallpaper', ($event.target as HTMLSelectElement).value)" class="format-select flex-1">
              <option v-for="opt in wallpaperOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="format-row">
            <span class="wallpaper-icon">🖼️</span>
            <span class="format-value">{{ sheetFormat.wallpaperOpacity }}</span>
            <span class="format-unit">%</span>
            <input
              type="range"
              :value="sheetFormat.wallpaperOpacity"
              @input="updateFormat('wallpaperOpacity', Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="100"
              class="format-slider"
            />
          </div>
        </div>

        <!-- Legend Section -->
        <div class="format-section">
          <div class="format-section-title">Legend</div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showLegend" @change="updateFormat('showLegend', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Legend</span>
            </label>
          </div>
          <div class="format-row indent">
            <span class="format-label">Background Color:</span>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: sheetFormat.legendBackgroundColor }"></div>
              <input type="color" :value="sheetFormat.legendBackgroundColor" @input="updateFormat('legendBackgroundColor', ($event.target as HTMLInputElement).value)" class="color-input" />
            </div>
          </div>
        </div>

        <!-- Advanced Section -->
        <div class="format-section">
          <div class="format-section-title">Advanced</div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.taperedLines" @change="updateFormat('taperedLines', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Tapered Lines</span>
            </label>
          </div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.gradientColor" @change="updateFormat('gradientColor', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Gradient Color</span>
            </label>
          </div>
        </div>

        <!-- Multi Branch Colors Section -->
        <div class="format-section">
          <div class="format-section-title">Multi Branch Colors</div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.multiBranchColor" @change="updateFormat('multiBranchColor', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Multi Branch Color</span>
            </label>
          </div>
        </div>

        <!-- Information Card Section -->
        <div class="format-section">
          <div class="format-section-title">Information Card</div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showLabel" @change="updateFormat('showLabel', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Label</span>
            </label>
          </div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showNotes" @change="updateFormat('showNotes', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Notes</span>
            </label>
          </div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showHyperlink" @change="updateFormat('showHyperlink', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Hyperlink</span>
            </label>
          </div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showAudioNotes" @change="updateFormat('showAudioNotes', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Audio Notes</span>
            </label>
          </div>
          <div class="format-row">
            <label class="checkbox-wrapper">
              <input type="checkbox" :checked="sheetFormat.showTaskInfo" @change="updateFormat('showTaskInfo', ($event.target as HTMLInputElement).checked)" />
              <span class="checkbox-label">Show Task Info</span>
            </label>
          </div>
          <div class="format-row indent">
            <span class="format-label">Background Color:</span>
            <div class="color-picker-wrapper">
              <div class="color-preview" :style="{ backgroundColor: sheetFormat.infoCardBackgroundColor }"></div>
              <input type="color" :value="sheetFormat.infoCardBackgroundColor" @input="updateFormat('infoCardBackgroundColor', ($event.target as HTMLInputElement).value)" class="color-input" />
            </div>
          </div>
        </div>

        <!-- Reset Style Link -->
        <div class="reset-style">
          <button class="reset-link" @click="resetStyle">Reset Style</button>
        </div>
      </div>

      <!-- Tags Content -->
      <div v-else-if="activeTab === 'tags'" class="sidebar-content tags-content">
        <TagsPanel @filter-change="handleTagFilterChange" />
      </div>

      <!-- Markers Content -->
      <div v-else-if="activeTab === 'markers'" class="sidebar-content">
        <div
          v-for="category in markerCategories"
          :key="category.id"
          class="marker-section"
        >
          <button
            class="section-header"
            @click="toggleSection(category.id)"
          >
            <component
              :is="collapsedSections.has(category.id) ? ChevronRight : ChevronDown"
              :size="14"
              class="section-chevron"
            />
            <span class="section-label">{{ category.label }}</span>
          </button>
          <div v-show="!collapsedSections.has(category.id)" class="section-content">
            <div class="markers-grid">
              <button
                v-for="marker in category.markers"
                :key="marker.id"
                class="marker-item"
                :title="(marker as any).label || marker.id"
                @click="addMarkerToNode(marker.id, { ...marker, category: category.id })"
              >
                <template v-if="(marker as any).label && (marker as any).bg">
                  <span
                    class="marker-badge"
                    :style="{ backgroundColor: (marker as any).bg, color: (marker as any).text || 'white' }"
                  >
                    {{ (marker as any).label }}
                  </span>
                </template>
                <template v-else-if="(marker as any).emoji">
                  <span class="marker-emoji">{{ (marker as any).emoji }}</span>
                </template>
                <template v-else-if="(marker as any).icon">
                  <span
                    class="marker-icon"
                    :style="{
                      color: (marker as any).bg ? 'white' : (marker as any).color,
                      backgroundColor: (marker as any).bg || 'transparent'
                    }"
                  >
                    {{ (marker as any).icon }}
                  </span>
                </template>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Relationships Content -->
      <div v-else-if="activeTab === 'relationships'" class="sidebar-content relationships-content">
        <RelationshipsPanel />
      </div>

      <!-- Boundaries Content -->
      <div v-else-if="activeTab === 'boundaries'" class="sidebar-content boundaries-content">
        <BoundariesPanel />
      </div>

      <!-- Summaries Content -->
      <div v-else-if="activeTab === 'summaries'" class="sidebar-content summaries-content">
        <SummariesPanel />
      </div>

      <!-- Clipart Content -->
      <div v-else-if="activeTab === 'clipart'" class="sidebar-content clipart-content">
        <div
          v-for="category in clipartCategories"
          :key="category.id"
          class="clipart-section"
        >
          <button
            class="clipart-section-header"
            @click="toggleClipartCategory(category.id)"
          >
            <ChevronRight
              v-if="isClipartCategoryCollapsed(category.id)"
              :size="14"
              class="section-chevron"
            />
            <ChevronDown
              v-else
              :size="14"
              class="section-chevron"
            />
            <span class="clipart-section-label">{{ category.label }}</span>
          </button>
          <div v-show="!isClipartCategoryCollapsed(category.id)" class="clipart-grid">
            <div
              v-for="item in category.items"
              :key="item.id"
              class="clipart-item"
              :title="item.label"
              draggable="true"
              @dragstart="handleClipartDragStart($event, item)"
            >
              <span class="clipart-icon">{{ item.icon }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes Content -->
      <div v-else-if="activeTab === 'notes'" class="sidebar-content notes-content">
        <template v-if="selectedNode">
          <!-- Notes Toolbar -->
          <div class="notes-toolbar">
            <select v-model="notesFont" class="notes-font-select">
              <option value="system-ui">System Font</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
            <select v-model="notesFontSize" class="notes-size-select">
              <option value="11">11</option>
              <option value="12">12</option>
              <option value="13">13</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="24">24</option>
            </select>
            <div class="notes-toolbar-divider"></div>
            <button
              :class="['notes-toolbar-btn', { active: notesBold }]"
              @click="notesBold = !notesBold"
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              :class="['notes-toolbar-btn', { active: notesItalic }]"
              @click="notesItalic = !notesItalic"
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              :class="['notes-toolbar-btn', { active: notesUnderline }]"
              @click="notesUnderline = !notesUnderline"
              title="Underline"
            >
              <span style="text-decoration: underline">U</span>
            </button>
            <div class="notes-toolbar-divider"></div>
            <div class="notes-color-picker">
              <button class="notes-toolbar-btn" title="Text Color">
                <span class="color-icon">A</span>
                <span class="color-bar" :style="{ backgroundColor: notesTextColor }"></span>
              </button>
              <input type="color" v-model="notesTextColor" class="color-input-hidden" />
            </div>
            <div class="notes-color-picker">
              <button class="notes-toolbar-btn" title="Highlight">
                <span class="highlight-icon" :style="{ backgroundColor: notesHighlightColor }">A</span>
              </button>
              <input type="color" v-model="notesHighlightColor" class="color-input-hidden" />
            </div>
            <div class="notes-toolbar-divider"></div>
            <button class="notes-toolbar-btn" title="Bullet List" @click="insertBulletList">
              <span>•</span>
            </button>
          </div>
          <!-- Notes Editor -->
          <div class="notes-editor-wrapper">
            <textarea
              v-model="currentNodeNotes"
              class="notes-editor"
              placeholder="Add notes for this topic..."
              :style="{
                fontFamily: notesFont,
                fontSize: notesFontSize + 'px',
                fontWeight: notesBold ? 'bold' : 'normal',
                fontStyle: notesItalic ? 'italic' : 'normal',
                textDecoration: notesUnderline ? 'underline' : 'none',
                color: notesTextColor,
              }"
              @input="updateNodeNotes"
            ></textarea>
          </div>
        </template>
        <div v-else class="empty-tab-message">
          <span class="empty-icon">📝</span>
          <p>Select a node to add notes</p>
        </div>
      </div>

      <!-- Comments Content -->
      <div v-else-if="activeTab === 'comments'" class="sidebar-content comments-content">
        <template v-if="selectedNode">
          <!-- Comments Header -->
          <div class="comments-header">
            <span class="comments-topic-label">TOPIC: {{ selectedNode.text }}</span>
          </div>

          <!-- Comment Input -->
          <div class="comment-input-area">
            <textarea
              v-model="newCommentText"
              class="comment-input"
              placeholder="Add a comment..."
              rows="3"
            ></textarea>
            <div class="comment-input-actions">
              <button class="comment-cancel-btn" @click="newCommentText = ''">Cancel</button>
              <button
                class="comment-save-btn"
                :disabled="!newCommentText.trim()"
                @click="submitComment"
              >Save</button>
            </div>
          </div>

          <button class="insert-comment-link" @click="focusCommentInput">
            Insert Comment
          </button>

          <!-- Comments List -->
          <div class="comments-list">
            <template v-if="selectedNode.comments && selectedNode.comments.length > 0">
              <div
                v-for="comment in selectedNode.comments"
                :key="comment.id"
                class="comment-item"
              >
                <div class="comment-header">
                  <span class="comment-author">{{ comment.author }}</span>
                  <span class="comment-time">{{ formatCommentTime(comment.createdAt) }}</span>
                  <button
                    class="comment-delete-btn"
                    @click="deleteCommentFromNode(comment.id)"
                    title="Delete comment"
                  >×</button>
                </div>
                <p class="comment-text">{{ comment.text }}</p>
              </div>
            </template>
            <div v-else class="comments-empty">
              <span class="comments-empty-icon">💬</span>
              <p>Be the first to insert a comment.</p>
            </div>
          </div>
        </template>
        <div v-else class="empty-tab-message">
          <span class="empty-icon">💬</span>
          <p>Select a node to view comments</p>
        </div>
      </div>

      <!-- Tasks Content -->
      <div v-else-if="activeTab === 'tasks'" class="sidebar-content tasks-content">
        <template v-if="selectedNode">
          <!-- Task Header -->
          <div class="task-header">
            <span class="task-title">Task Info</span>
          </div>
          <div class="task-topic-name">Task: {{ selectedNode.text }}</div>

          <!-- Task Form -->
          <div class="task-form">
            <!-- Assigned To -->
            <div class="task-row">
              <label class="task-label">Assigned To:</label>
              <input
                type="text"
                class="task-input"
                placeholder="<Enter Assignee>"
                :value="selectedNode.task?.assignee || ''"
                @change="updateTask('assignee', ($event.target as HTMLInputElement).value)"
              />
            </div>

            <!-- Priority -->
            <div class="task-row">
              <label class="task-label">Priority:</label>
              <select
                class="task-select"
                :value="selectedNode.task?.priority || 0"
                @change="updateTask('priority', Number(($event.target as HTMLSelectElement).value))"
              >
                <option value="0">No Priority</option>
                <option value="1">1 - Highest</option>
                <option value="2">2 - Priority 2</option>
                <option value="3">3 - Priority 3</option>
                <option value="4">4 - Priority 4</option>
                <option value="5">5 - Medium</option>
                <option value="6">6 - Priority 6</option>
                <option value="7">7 - Priority 7</option>
                <option value="8">8 - Priority 8</option>
                <option value="9">9 - Lowest</option>
              </select>
            </div>

            <!-- Start Date -->
            <div class="task-row">
              <label class="task-label">Start:</label>
              <input
                type="datetime-local"
                class="task-input datetime-input"
                :value="formatDateTimeLocal(selectedNode.task?.startDate)"
                @change="updateTask('startDate', parseDateTimeLocal(($event.target as HTMLInputElement).value))"
              />
            </div>

            <!-- Duration -->
            <div class="task-row">
              <label class="task-label">Duration:</label>
              <select
                class="task-select"
                :value="selectedNode.task?.duration || 1"
                @change="updateTask('duration', Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="d in [1,2,3,4,5,6,7,14,21,30,60,90]" :key="d" :value="d">
                  {{ d }} day{{ d > 1 ? 's' : '' }}
                </option>
              </select>
            </div>

            <!-- End Date (calculated) -->
            <div class="task-row">
              <label class="task-label">End:</label>
              <span class="task-calculated">
                {{ formatEndDate(selectedNode.task?.endDate) }}
                <button
                  v-if="selectedNode.task?.endDate"
                  class="task-edit-link"
                  @click="editEndDateDirectly"
                >(Edit)</button>
              </span>
            </div>

            <!-- Progress -->
            <div class="task-row">
              <label class="task-label">Progress:</label>
              <select
                class="task-select"
                :value="selectedNode.task?.progress || 0"
                @change="updateTask('progress', Number(($event.target as HTMLSelectElement).value))"
              >
                <option value="0">&lt;Enter Progress&gt;</option>
                <option value="0">0%</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>

            <!-- Progress Bar -->
            <div class="task-row">
              <label class="task-label"></label>
              <div class="progress-bar-container">
                <div
                  class="progress-bar-fill"
                  :style="{ width: (selectedNode.task?.progress || 0) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Checkpoint -->
            <div class="task-row">
              <label class="task-label"></label>
              <label class="task-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedNode.task?.isCheckpoint || false"
                  @change="updateTask('isCheckpoint', ($event.target as HTMLInputElement).checked)"
                />
                <span>Check Point</span>
              </label>
            </div>

            <!-- Predecessors -->
            <div class="task-row">
              <label class="task-label">Predecessors:</label>
              <div class="task-predecessors">
                <span class="predecessors-value">
                  {{ selectedNode.task?.dependencies?.length ? selectedNode.task.dependencies.length + ' task(s)' : 'None' }}
                </span>
                <button class="task-add-btn" title="Add predecessor">+</button>
                <button class="task-remove-btn" title="Remove predecessor">−</button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="task-actions">
            <button class="task-clear-link" @click="clearTask">Clear Task Info</button>
            <button class="task-gantt-link">Show Gantt Chart</button>
          </div>
        </template>
        <div v-else class="empty-tab-message">
          <span class="empty-icon">☑️</span>
          <p>Select a node to add task info</p>
        </div>
      </div>
    </div>

    <!-- Book-style Tabs on Right Edge -->
    <div class="sidebar-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['sidebar-tab', activeTab === tab.id ? 'active' : '']"
        :title="tab.label"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  height: 100%;
  background: var(--bg-sidebar);
}

.sidebar-panel {
  width: 260px;
  background: var(--bg-sidebar);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--border-secondary);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-tertiary);
  font-size: 14px;
}

.header-btn:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.header-select {
  padding: 4px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

/* Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

/* Style/Format Content */
.style-content {
  padding: 12px;
}

.format-section {
  margin-bottom: 16px;
}

.format-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 10px;
}

.format-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  min-height: 28px;
}

.format-row.indent {
  padding-left: 24px;
}

.format-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.format-value {
  font-size: 13px;
  color: var(--text-primary);
  min-width: 24px;
}

.format-unit {
  font-size: 13px;
  color: var(--text-muted);
}

/* Color Picker */
.color-picker-wrapper {
  position: relative;
  width: 24px;
  height: 24px;
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border-primary);
  cursor: pointer;
}

.color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

/* Select */
.format-select {
  padding: 6px 10px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  cursor: pointer;
}

.format-select:hover {
  border-color: var(--accent-primary);
}

.format-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* Slider */
.format-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-primary);
  border-radius: 2px;
  cursor: pointer;
}

.format-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

/* Checkbox */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-wrapper input[type="checkbox"] {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--border-primary);
  cursor: pointer;
  accent-color: #3b82f6;
  background: var(--bg-tertiary);
}

.checkbox-label {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Wallpaper Icon */
.wallpaper-icon {
  font-size: 16px;
  opacity: 0.6;
}

/* Reset Style */
.reset-style {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-primary);
}

.reset-link {
  font-size: 13px;
  color: #60a5fa;
  cursor: pointer;
}

.reset-link:hover {
  text-decoration: underline;
  color: #93c5fd;
}

/* Outline Tree */
.outline-content {
  padding: 0;
}

.outline-tree {
  padding: 4px 0;
}

.outline-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  cursor: pointer;
  transition: background-color 0.1s;
  min-height: 28px;
}

.outline-item:hover {
  background: var(--border-secondary);
}

.outline-item.selected {
  background: rgba(59, 130, 246, 0.2);
}

.outline-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
  border-radius: 3px;
}

.outline-toggle:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.outline-toggle-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.outline-text {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Marker Sections */
.marker-section {
  margin-bottom: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  transition: background-color 0.1s;
}

.section-header:hover {
  background: var(--border-secondary);
}

.section-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.section-content {
  padding: 8px 12px 12px;
}

/* Markers Grid */
.markers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.marker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
}

.marker-item:hover {
  transform: scale(1.15);
}

.marker-item:active {
  transform: scale(1.05);
}

.marker-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.marker-emoji {
  font-size: 22px;
  line-height: 1;
}

.marker-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

/* Empty Tab State */
.empty-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
  height: 100%;
}

/* Clipart Content */
.clipart-content {
  padding: 0;
}

.clipart-section {
  margin-bottom: 2px;
}

.clipart-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 0.1s;
  border-bottom: 1px solid var(--border-secondary);
}

.clipart-section-header:hover {
  background: var(--border-secondary);
}

.clipart-section-label {
  font-size: 13px;
  font-weight: 500;
  color: #60a5fa;
}

.clipart-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px;
  background: var(--border-secondary);
}

.clipart-item {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-secondary);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s ease;
  border: 1px solid var(--border-primary);
}

.clipart-item:hover {
  background: var(--border-primary);
  border-color: rgba(59, 130, 246, 0.5);
  transform: scale(1.05);
}

.clipart-item:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.clipart-icon {
  font-size: 28px;
  line-height: 1;
}

/* Book-style Tabs */
.sidebar-tabs {
  display: flex;
  flex-direction: column;
  background: var(--bg-tertiary);
  padding: 8px 0;
  gap: 2px;
}

.sidebar-tab {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-secondary);
  border-radius: 0 6px 6px 0;
  margin-right: -1px;
  transition: all 0.15s ease;
  position: relative;
}

.sidebar-tab::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  border-radius: 0 2px 2px 0;
  transition: background-color 0.15s;
}

.sidebar-tab:hover {
  background: var(--border-primary);
}

.sidebar-tab.active {
  background: var(--bg-sidebar);
  box-shadow: -2px 0 4px var(--shadow-sm);
}

.sidebar-tab.active::before {
  background: #3b82f6;
}

.tab-icon {
  font-size: 16px;
  line-height: 1;
}

/* Notes Content */
.notes-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.notes-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-primary);
  flex-wrap: wrap;
}

.notes-font-select {
  padding: 4px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  max-width: 100px;
}

.notes-size-select {
  padding: 4px 6px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  width: 48px;
}

.notes-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 4px;
}

.notes-toolbar-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.15s ease;
}

.notes-toolbar-btn:hover {
  background: var(--border-primary);
  color: var(--text-primary);
}

.notes-toolbar-btn.active {
  background: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.notes-color-picker {
  position: relative;
}

.color-icon {
  font-weight: bold;
}

.color-bar {
  position: absolute;
  bottom: 4px;
  left: 6px;
  right: 6px;
  height: 3px;
  border-radius: 1px;
}

.highlight-icon {
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: bold;
  color: #1f2937;
}

.color-input-hidden {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.notes-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  min-height: 0;
}

.notes-editor {
  flex: 1;
  width: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.notes-editor::placeholder {
  color: var(--text-muted);
}

.empty-tab-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}

.empty-tab-message p {
  font-size: 13px;
}

/* Comments Content */
.comments-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.comments-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}

.comments-topic-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.comment-input-area {
  padding: 12px;
  border-bottom: 1px solid var(--border-primary);
}

.comment-input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.comment-input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.comment-input::placeholder {
  color: var(--text-muted);
}

.comment-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.comment-cancel-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #60a5fa;
  background: transparent;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.comment-cancel-btn:hover {
  background: var(--border-secondary);
}

.comment-save-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--accent-primary);
  background: transparent;
  border-radius: 4px;
  transition: all 0.15s;
}

.comment-save-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
}

.comment-save-btn:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.insert-comment-link {
  padding: 12px;
  font-size: 13px;
  color: var(--accent-primary);
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
  transition: background-color 0.15s;
}

.insert-comment-link:hover {
  background: var(--border-secondary);
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.comment-item {
  padding: 12px;
  background: var(--border-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.comment-author {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.comment-time {
  font-size: 11px;
  color: var(--text-muted);
}

.comment-delete-btn {
  margin-left: auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 16px;
  opacity: 0;
  transition: all 0.15s;
}

.comment-item:hover .comment-delete-btn {
  opacity: 1;
}

.comment-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.comment-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
}

.comments-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.comments-empty-icon {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 12px;
}

.comments-empty p {
  font-size: 13px;
  color: var(--text-muted);
}

/* Tasks Content */
.tasks-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.task-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.task-topic-name {
  padding: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-primary);
}

.task-form {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  min-height: 32px;
}

.task-label {
  width: 90px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: right;
}

.task-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.task-input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.task-input::placeholder {
  color: var(--text-muted);
}

.datetime-input {
  color-scheme: light;
}

.dark .datetime-input {
  color-scheme: dark;
}

.task-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.task-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.task-calculated {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-edit-link {
  color: #60a5fa;
  font-size: 12px;
}

.task-edit-link:hover {
  text-decoration: underline;
}

.progress-bar-container {
  flex: 1;
  height: 6px;
  background: var(--border-primary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.task-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
}

.task-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.task-predecessors {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.predecessors-value {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
}

.task-add-btn,
.task-remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 16px;
  transition: all 0.15s;
}

.task-add-btn:hover {
  background: rgba(59, 130, 246, 0.3);
}

.task-remove-btn {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.task-remove-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.task-actions {
  padding: 12px;
  border-top: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-clear-link,
.task-gantt-link {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--accent-primary);
  text-align: left;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.task-clear-link:hover,
.task-gantt-link:hover {
  background: var(--border-secondary);
}

/* Tags Content */
.tags-content {
  padding: 0;
}

/* Relationships Content */
.relationships-content {
  padding: 0;
}

.boundaries-content {
  padding: 0;
}

/* Node Style Section */
.node-style-section {
  background: rgba(59, 130, 246, 0.05);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(59, 130, 246, 0.15);
}

.shape-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.shape-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.shape-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shape-option:hover {
  background: var(--border-primary);
  border-color: var(--text-muted);
}

.shape-option.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

.shape-icon {
  font-size: 18px;
  color: var(--text-secondary);
}

.shape-option.active .shape-icon {
  color: #60a5fa;
}

/* Node Color Picker */
.node-color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.node-color-option {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}

.node-color-option:hover {
  transform: scale(1.1);
}

.node-color-option.active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.custom-color {
  position: relative;
  width: 22px;
  height: 22px;
}

.custom-color .node-color-option {
  width: 100%;
  height: 100%;
}

/* Themes Content */
.themes-content {
  padding: 0;
}
</style>
