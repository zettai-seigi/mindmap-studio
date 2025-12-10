/**
 * Theme composable for dark/light/system mode
 */

import { ref, computed, watch, onMounted } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mindmap-studio-theme';

// Global state (shared across all components)
const themeMode = ref<ThemeMode>('system');
const systemPrefersDark = ref(false);

// Computed actual theme (resolved from system preference if needed)
const resolvedTheme = computed(() => {
  if (themeMode.value === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light';
  }
  return themeMode.value;
});

const isDark = computed(() => resolvedTheme.value === 'dark');

// Canvas background color based on theme
const canvasBackground = computed(() => isDark.value ? '#1e293b' : '#f1f5f9');

// Initialize from localStorage and system preference
function initTheme() {
  // Load saved preference
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    themeMode.value = saved;
  }

  // Detect system preference
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.value = mediaQuery.matches;

    // Listen for system preference changes
    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
    });
  }
}

// Apply theme to document
function applyTheme() {
  const root = document.documentElement;

  if (isDark.value) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

// Set theme mode
function setTheme(mode: ThemeMode) {
  themeMode.value = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

// Cycle through themes: system -> light -> dark -> system
function cycleTheme() {
  const modes: ThemeMode[] = ['system', 'light', 'dark'];
  const currentIndex = modes.indexOf(themeMode.value);
  const nextIndex = (currentIndex + 1) % modes.length;
  setTheme(modes[nextIndex] as ThemeMode);
}

export function useTheme() {
  // Watch for theme changes and apply
  watch(isDark, applyTheme, { immediate: true });

  onMounted(() => {
    initTheme();
    applyTheme();
  });

  return {
    themeMode,
    resolvedTheme,
    isDark,
    canvasBackground,
    setTheme,
    cycleTheme,
  };
}

// Initialize immediately for SSR/hydration
if (typeof window !== 'undefined') {
  initTheme();
  applyTheme();
}
