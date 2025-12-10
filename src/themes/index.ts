import type { MapTheme } from '../types';

// ============================================
// Font Presets
// ============================================
const defaultFonts = {
  root: 'system-ui, -apple-system, sans-serif',
  rootSize: 18,
  rootWeight: 700,
  branch: 'system-ui, -apple-system, sans-serif',
  branchSize: 14,
  branchWeight: 600,
  subTopic: 'system-ui, -apple-system, sans-serif',
  subTopicSize: 13,
  subTopicWeight: 400,
};

const serifFonts = {
  root: 'Georgia, "Times New Roman", serif',
  rootSize: 20,
  rootWeight: 700,
  branch: 'Georgia, "Times New Roman", serif',
  branchSize: 15,
  branchWeight: 600,
  subTopic: 'Georgia, "Times New Roman", serif',
  subTopicSize: 14,
  subTopicWeight: 400,
};

const modernFonts = {
  root: '"SF Pro Display", "Segoe UI", Roboto, sans-serif',
  rootSize: 18,
  rootWeight: 700,
  branch: '"SF Pro Display", "Segoe UI", Roboto, sans-serif',
  branchSize: 14,
  branchWeight: 500,
  subTopic: '"SF Pro Text", "Segoe UI", Roboto, sans-serif',
  subTopicSize: 13,
  subTopicWeight: 400,
};

const handwrittenFonts = {
  root: '"Comic Sans MS", "Marker Felt", cursive',
  rootSize: 20,
  rootWeight: 700,
  branch: '"Comic Sans MS", "Marker Felt", cursive',
  branchSize: 15,
  branchWeight: 600,
  subTopic: '"Comic Sans MS", "Marker Felt", cursive',
  subTopicSize: 14,
  subTopicWeight: 400,
};

const monoFonts = {
  root: '"SF Mono", "Fira Code", "Consolas", monospace',
  rootSize: 16,
  rootWeight: 700,
  branch: '"SF Mono", "Fira Code", "Consolas", monospace',
  branchSize: 13,
  branchWeight: 500,
  subTopic: '"SF Mono", "Fira Code", "Consolas", monospace',
  subTopicSize: 12,
  subTopicWeight: 400,
};

// ============================================
// Predefined Themes
// ============================================

export const themes: MapTheme[] = [
  // ============================================
  // DEFAULT THEMES
  // ============================================
  {
    id: 'professional',
    name: 'Professional',
    category: 'default',
    colors: {
      background: '#f8fafc',
      rootNode: '#1e40af',
      rootNodeText: '#ffffff',
      branches: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
      branchText: '#ffffff',
      lines: '#94a3b8',
      subTopicBg: '#f1f5f9',
      subTopicText: '#334155',
    },
    fonts: defaultFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: true,
  },
  {
    id: 'classic',
    name: 'Classic',
    category: 'default',
    colors: {
      background: '#ffffff',
      rootNode: '#2563eb',
      rootNodeText: '#ffffff',
      branches: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'],
      branchText: '#1e3a8a',
      lines: '#3b82f6',
      subTopicBg: '#eff6ff',
      subTopicText: '#1e3a8a',
    },
    fonts: serifFonts,
    rootShape: 'ellipse',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },

  // ============================================
  // BUSINESS THEMES
  // ============================================
  {
    id: 'business-1',
    name: 'Business I',
    category: 'business',
    colors: {
      background: '#f5f5f4',
      rootNode: '#0f172a',
      rootNodeText: '#ffffff',
      branches: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'],
      branchText: '#0f172a',
      lines: '#64748b',
      subTopicBg: '#ffffff',
      subTopicText: '#1e293b',
    },
    fonts: modernFonts,
    rootShape: 'rectangle',
    branchShape: 'rectangle',
    subTopicShape: 'rectangle',
    lineStyle: 'angular',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'business-2',
    name: 'Business II',
    category: 'business',
    colors: {
      background: '#fafaf9',
      rootNode: '#0369a1',
      rootNodeText: '#ffffff',
      branches: ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'],
      branchText: '#0c4a6e',
      lines: '#0284c7',
      subTopicBg: '#f0f9ff',
      subTopicText: '#0c4a6e',
    },
    fonts: modernFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'business-3',
    name: 'Business III',
    category: 'business',
    colors: {
      background: '#fefce8',
      rootNode: '#854d0e',
      rootNodeText: '#ffffff',
      branches: ['#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a'],
      branchText: '#713f12',
      lines: '#ca8a04',
      subTopicBg: '#fef9c3',
      subTopicText: '#713f12',
    },
    fonts: serifFonts,
    rootShape: 'rounded',
    branchShape: 'underline',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'business-4',
    name: 'Business IV',
    category: 'business',
    colors: {
      background: '#f0fdf4',
      rootNode: '#166534',
      rootNodeText: '#ffffff',
      branches: ['#15803d', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'],
      branchText: '#14532d',
      lines: '#22c55e',
      subTopicBg: '#dcfce7',
      subTopicText: '#14532d',
    },
    fonts: defaultFonts,
    rootShape: 'ellipse',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },

  // ============================================
  // COLORFUL THEMES
  // ============================================
  {
    id: 'rainbow',
    name: 'Rainbow',
    category: 'colorful',
    colors: {
      background: '#fefefe',
      rootNode: '#7c3aed',
      rootNodeText: '#ffffff',
      branches: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'],
      branchText: '#ffffff',
      lines: '#a78bfa',
      subTopicBg: '#faf5ff',
      subTopicText: '#4c1d95',
    },
    fonts: defaultFonts,
    rootShape: 'ellipse',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 3,
    handDrawn: false,
    rainbowBranches: true,
  },
  {
    id: 'candy',
    name: 'Candy',
    category: 'colorful',
    colors: {
      background: '#fdf2f8',
      rootNode: '#db2777',
      rootNodeText: '#ffffff',
      branches: ['#f472b6', '#fb7185', '#fda4af', '#fdba74', '#fcd34d', '#a3e635'],
      branchText: '#ffffff',
      lines: '#f9a8d4',
      subTopicBg: '#fce7f3',
      subTopicText: '#9d174d',
    },
    fonts: defaultFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 3,
    handDrawn: false,
    rainbowBranches: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    category: 'colorful',
    colors: {
      background: '#ecfeff',
      rootNode: '#0891b2',
      rootNodeText: '#ffffff',
      branches: ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe', '#14b8a6'],
      branchText: '#164e63',
      lines: '#22d3ee',
      subTopicBg: '#cffafe',
      subTopicText: '#164e63',
    },
    fonts: modernFonts,
    rootShape: 'ellipse',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'colorful',
    colors: {
      background: '#fff7ed',
      rootNode: '#c2410c',
      rootNodeText: '#ffffff',
      branches: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
      branchText: '#7c2d12',
      lines: '#f97316',
      subTopicBg: '#ffedd5',
      subTopicText: '#7c2d12',
    },
    fonts: defaultFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },

  // ============================================
  // MINIMAL THEMES
  // ============================================
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    category: 'minimal',
    colors: {
      background: '#ffffff',
      rootNode: '#18181b',
      rootNodeText: '#ffffff',
      branches: ['#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'],
      branchText: '#18181b',
      lines: '#d4d4d8',
      subTopicBg: '#fafafa',
      subTopicText: '#18181b',
    },
    fonts: modernFonts,
    rootShape: 'rectangle',
    branchShape: 'underline',
    subTopicShape: 'underline',
    lineStyle: 'straight',
    lineWidth: 1,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'minimal-blue',
    name: 'Minimal Blue',
    category: 'minimal',
    colors: {
      background: '#f8fafc',
      rootNode: '#1d4ed8',
      rootNodeText: '#ffffff',
      branches: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
      branchText: '#1e40af',
      lines: '#bfdbfe',
      subTopicBg: '#ffffff',
      subTopicText: '#1e3a8a',
    },
    fonts: modernFonts,
    rootShape: 'rounded',
    branchShape: 'none',
    subTopicShape: 'none',
    lineStyle: 'straight',
    lineWidth: 1,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'sketch',
    name: 'Sketch',
    category: 'minimal',
    colors: {
      background: '#fffbeb',
      rootNode: '#292524',
      rootNodeText: '#fef3c7',
      branches: ['#44403c', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#e7e5e4'],
      branchText: '#1c1917',
      lines: '#78716c',
      subTopicBg: '#fef3c7',
      subTopicText: '#1c1917',
    },
    fonts: handwrittenFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: true,
    rainbowBranches: false,
  },

  // ============================================
  // DARK THEMES
  // ============================================
  {
    id: 'dark-default',
    name: 'Dark',
    category: 'dark',
    colors: {
      background: '#18181b',
      rootNode: '#3b82f6',
      rootNodeText: '#ffffff',
      branches: ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
      branchText: '#ffffff',
      lines: '#3f3f46',
      subTopicBg: '#27272a',
      subTopicText: '#e4e4e7',
    },
    fonts: defaultFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: true,
  },
  {
    id: 'dark-blue',
    name: 'Dark Blue',
    category: 'dark',
    colors: {
      background: '#0f172a',
      rootNode: '#2563eb',
      rootNodeText: '#ffffff',
      branches: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'],
      branchText: '#e0f2fe',
      lines: '#1e3a8a',
      subTopicBg: '#1e293b',
      subTopicText: '#bfdbfe',
    },
    fonts: modernFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    category: 'dark',
    colors: {
      background: '#1e1b4b',
      rootNode: '#7c3aed',
      rootNodeText: '#ffffff',
      branches: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff'],
      branchText: '#f5f3ff',
      lines: '#4c1d95',
      subTopicBg: '#312e81',
      subTopicText: '#e9d5ff',
    },
    fonts: modernFonts,
    rootShape: 'ellipse',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    category: 'dark',
    colors: {
      background: '#020617',
      rootNode: '#0ea5e9',
      rootNodeText: '#ffffff',
      branches: ['#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff', '#22d3ee'],
      branchText: '#e0f2fe',
      lines: '#0c4a6e',
      subTopicBg: '#0f172a',
      subTopicText: '#bae6fd',
    },
    fonts: monoFonts,
    rootShape: 'rounded',
    branchShape: 'rounded',
    lineStyle: 'curved',
    lineWidth: 2,
    handDrawn: false,
    rainbowBranches: false,
  },
];

// Get themes by category
export function getThemesByCategory(category: MapTheme['category']): MapTheme[] {
  return themes.filter(t => t.category === category);
}

// Get theme by ID
export function getThemeById(id: string): MapTheme | undefined {
  return themes.find(t => t.id === id);
}

// Get default theme
export function getDefaultTheme(): MapTheme {
  return themes[0]!; // First theme is always 'professional'
}

// Get all categories
export function getCategories(): { id: MapTheme['category']; name: string }[] {
  return [
    { id: 'default', name: 'Default' },
    { id: 'business', name: 'Business' },
    { id: 'colorful', name: 'Colorful' },
    { id: 'minimal', name: 'Minimal' },
    { id: 'dark', name: 'Dark' },
  ];
}
