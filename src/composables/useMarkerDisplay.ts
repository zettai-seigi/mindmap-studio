/**
 * Marker display utilities for mind map nodes
 * Converts marker IDs to visual representations (icons, emojis, badges)
 */

export interface MarkerDisplayInfo {
  type: 'badge' | 'emoji' | 'icon' | 'circle';
  label?: string;
  emoji?: string;
  icon?: string;
  bg?: string;
  color?: string;
  textColor?: string;
}

// Priority marker colors
const priorityColors: Record<string, string> = {
  '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#22c55e',
  '5': '#3b82f6', '6': '#8b5cf6', '7': '#64748b', '8': '#374151', '9': '#78716c'
};

// Face emojis
const faceEmojis: Record<string, string> = {
  'face-happy': '😊', 'face-sad': '😢', 'face-angry': '😠', 'face-surprised': '😮',
  'face-laugh': '😄', 'face-love': '😍', 'face-think': '🤔', 'face-cool': '😎',
  'face-wink': '😉', 'face-cry': '😭', 'face-sweat': '😅', 'face-sleeping': '😴',
  'face-sick': '🤢', 'face-mind-blown': '🤯', 'face-party': '🥳', 'face-nerd': '🤓'
};

// Gesture emojis
const gestureEmojis: Record<string, string> = {
  'gest-thumbsup': '👍', 'gest-thumbsdown': '👎', 'gest-clap': '👏', 'gest-wave': '👋',
  'gest-ok': '👌', 'gest-point': '👉', 'gest-fist': '✊', 'gest-raised': '✋',
  'gest-muscle': '💪', 'gest-pray': '🙏', 'gest-writing': '✍️', 'gest-eyes': '👀'
};

// Object emojis
const objectEmojis: Record<string, string> = {
  'obj-lightbulb': '💡', 'obj-fire': '🔥', 'obj-star': '⭐', 'obj-heart': '❤️',
  'obj-rocket': '🚀', 'obj-target': '🎯', 'obj-trophy': '🏆', 'obj-medal': '🥇',
  'obj-gem': '💎', 'obj-bolt': '⚡', 'obj-magnet': '🧲', 'obj-gear': '⚙️',
  'obj-wrench': '🔧', 'obj-key': '🔑', 'obj-lock': '🔒', 'obj-bell': '🔔'
};

// Nature emojis
const natureEmojis: Record<string, string> = {
  'nat-sun': '☀️', 'nat-moon': '🌙', 'nat-cloud': '☁️', 'nat-rain': '🌧️',
  'nat-snow': '❄️', 'nat-rainbow': '🌈', 'nat-tree': '🌳', 'nat-flower': '🌸',
  'nat-leaf': '🍃', 'nat-seedling': '🌱', 'nat-earth': '🌍', 'nat-mountain': '⛰️'
};

// Tech emojis
const techEmojis: Record<string, string> = {
  'tech-laptop': '💻', 'tech-phone': '📱', 'tech-email': '📧', 'tech-folder': '📁',
  'tech-chart': '📊', 'tech-calendar': '📅', 'tech-clipboard': '📋', 'tech-pencil': '✏️',
  'tech-book': '📚', 'tech-money': '💰', 'tech-briefcase': '💼', 'tech-clock': '⏰'
};

// Progress markers
const progressIcons: Record<string, { icon: string; color: string }> = {
  'prog-0': { icon: '○', color: '#94a3b8' },
  'prog-25': { icon: '◔', color: '#f59e0b' },
  'prog-50': { icon: '◑', color: '#f59e0b' },
  'prog-75': { icon: '◕', color: '#22c55e' },
  'prog-100': { icon: '●', color: '#22c55e' },
  'prog-start': { icon: '▶', color: '#3b82f6' },
  'prog-pause': { icon: '⏸', color: '#f97316' },
  'prog-cancel': { icon: '✕', color: '#ef4444' }
};

// Flag marker colors
const flagColors: Record<string, string> = {
  'flag-red': '#ef4444', 'flag-orange': '#f97316', 'flag-yellow': '#eab308',
  'flag-green': '#22c55e', 'flag-blue': '#3b82f6', 'flag-purple': '#8b5cf6', 'flag-gray': '#64748b'
};

// Star marker colors
const starColors: Record<string, string> = {
  'star-red': '#ef4444', 'star-orange': '#f97316', 'star-yellow': '#eab308',
  'star-green': '#22c55e', 'star-blue': '#3b82f6', 'star-purple': '#8b5cf6'
};

// Person marker colors
const personColors: Record<string, string> = {
  'person-red': '#ef4444', 'person-orange': '#f97316', 'person-yellow': '#eab308',
  'person-green': '#22c55e', 'person-blue': '#3b82f6', 'person-purple': '#8b5cf6'
};

// Arrow markers
const arrowIcons: Record<string, { icon: string; color: string }> = {
  'arrow-up': { icon: '↑', color: '#22c55e' },
  'arrow-up-right': { icon: '↗', color: '#22c55e' },
  'arrow-right': { icon: '→', color: '#3b82f6' },
  'arrow-down-right': { icon: '↘', color: '#f97316' },
  'arrow-down': { icon: '↓', color: '#ef4444' },
  'arrow-down-left': { icon: '↙', color: '#ef4444' },
  'arrow-left': { icon: '←', color: '#64748b' },
  'arrow-up-left': { icon: '↖', color: '#22c55e' },
  'arrow-refresh': { icon: '↻', color: '#3b82f6' }
};

// Symbol markers
const symbolIcons: Record<string, { icon: string; bg: string }> = {
  'sym-plus': { icon: '+', bg: '#22c55e' },
  'sym-minus': { icon: '−', bg: '#ef4444' },
  'sym-question': { icon: '?', bg: '#3b82f6' },
  'sym-info': { icon: 'i', bg: '#3b82f6' },
  'sym-warning': { icon: '!', bg: '#f59e0b' },
  'sym-error': { icon: '✕', bg: '#ef4444' },
  'sym-check': { icon: '✓', bg: '#22c55e' },
  'sym-stop': { icon: '⏹', bg: '#ef4444' }
};

/**
 * Get display information for a marker based on its ID
 */
export function getMarkerDisplay(markerId: string, defaultColor?: string): MarkerDisplayInfo {
  // Priority markers (p1-p9)
  const priorityMatch = markerId.match(/^p(\d)$/);
  if (priorityMatch && priorityMatch[1]) {
    const num = priorityMatch[1];
    return { type: 'badge', label: num, bg: priorityColors[num] || '#3b82f6', textColor: 'white' };
  }

  // Month markers
  const monthMatch = markerId.match(/^month-(\d+)$/);
  if (monthMatch && monthMatch[1]) {
    return { type: 'badge', label: monthMatch[1], bg: '#e5e7eb', textColor: '#374151' };
  }

  // Face emojis
  if (faceEmojis[markerId]) {
    return { type: 'emoji', emoji: faceEmojis[markerId] };
  }

  // Gesture emojis
  if (gestureEmojis[markerId]) {
    return { type: 'emoji', emoji: gestureEmojis[markerId] };
  }

  // Object emojis
  if (objectEmojis[markerId]) {
    return { type: 'emoji', emoji: objectEmojis[markerId] };
  }

  // Nature emojis
  if (natureEmojis[markerId]) {
    return { type: 'emoji', emoji: natureEmojis[markerId] };
  }

  // Tech emojis
  if (techEmojis[markerId]) {
    return { type: 'emoji', emoji: techEmojis[markerId] };
  }

  // Progress markers
  if (progressIcons[markerId]) {
    return { type: 'icon', ...progressIcons[markerId] };
  }

  // Flag markers
  if (markerId.startsWith('flag-')) {
    return { type: 'icon', icon: '⚑', color: flagColors[markerId] || defaultColor };
  }

  // Star markers
  if (markerId.startsWith('star-')) {
    return { type: 'icon', icon: '★', color: starColors[markerId] || defaultColor };
  }

  // Person markers
  if (markerId.startsWith('person-')) {
    return { type: 'icon', icon: '👤', color: personColors[markerId] || defaultColor };
  }

  // Arrow markers
  if (arrowIcons[markerId]) {
    return { type: 'icon', ...arrowIcons[markerId] };
  }

  // Symbol markers
  if (symbolIcons[markerId]) {
    return { type: 'icon', ...symbolIcons[markerId] };
  }

  // Default fallback
  return { type: 'circle', color: defaultColor };
}
