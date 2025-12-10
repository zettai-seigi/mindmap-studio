// ============================================
// Layout Algorithms for Mind Map Structures
// ============================================

import type { MindMapNode, RenderedNode, StructureType } from '../types';

export interface LayoutConfig {
  // Fixed spacing measurements (in pixels)
  horizontalGap: number;    // Gap between parent edge and child edge (horizontal layouts)
  verticalGap: number;      // Gap between sibling nodes (vertical spacing)
  levelGap: number;         // Gap between levels (for vertical layouts like org chart)

  // Node dimensions
  nodeWidth: number;
  nodeHeight: number;
  rootNodeWidth: number;
  rootNodeHeight: number;

  // Canvas center
  centerX: number;
  centerY: number;

  // Starting level for theme styling (default 0 for root, 1 for floating topics)
  startLevel: number;
}

const defaultConfig: LayoutConfig = {
  // Fixed spacing - consistent gaps
  horizontalGap: 80,        // 80px gap between parent right edge and child left edge
  verticalGap: 20,          // 20px gap between sibling nodes
  levelGap: 60,             // 60px gap between levels (for org chart)

  // Node sizes
  nodeWidth: 140,
  nodeHeight: 36,
  rootNodeWidth: 180,
  rootNodeHeight: 48,

  centerX: 0,
  centerY: 0,

  startLevel: 0,
};

// ============================================
// Mind Map Layout (Balanced - XMind Style)
// ============================================
//
// XMind "Map" layout:
// - Root in center
// - First half of children go RIGHT (top to bottom: 1, 2, 3, 4)
// - Second half go LEFT in REVERSE order (top to bottom: 8, 7, 6, 5)
// - Both sides start from same Y position (vertically aligned)
//
// XMind "Map (Anti-Clockwise)" layout:
// - First half go LEFT (top to bottom)
// - Second half go RIGHT in REVERSE order (top to bottom)
//
// XMind "Balanced Map (Up to Down)" layout:
// - First half go RIGHT (top to bottom: 1, 2, 3, 4)
// - Second half go LEFT (top to bottom: 5, 6, 7, 8) - NOT reversed
// - Both sides start from same Y position

type MindMapDirection = 'clockwise' | 'anti-clockwise' | 'down';

export function layoutMindMap(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  direction: MindMapDirection = 'clockwise'
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  const baseLevel = cfg.startLevel;

  // Use manual position for root if set
  const rootX = root.position?.x ?? cfg.centerX;
  const rootY = root.position?.y ?? cfg.centerY;

  // For floating topics (startLevel >= 1), use branch node size instead of root size
  const isFloatingRoot = baseLevel >= 1;
  const rootWidth = isFloatingRoot ? cfg.nodeWidth : cfg.rootNodeWidth;
  const rootHeight = isFloatingRoot ? cfg.nodeHeight : cfg.rootNodeHeight;

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX - rootWidth / 2,
    y: rootY - rootHeight / 2,
    width: rootWidth,
    height: rootHeight,
    collapsed: root.collapsed || false,
    level: baseLevel,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Split children: first half and second half
  const half = Math.ceil(root.children.length / 2);
  const firstHalf = root.children.slice(0, half);
  const secondHalf = root.children.slice(half);

  // Determine which side each half goes to
  let rightChildren: MindMapNode[];
  let leftChildren: MindMapNode[];

  if (direction === 'clockwise') {
    // Map: first half RIGHT (1,2,3,4), second half LEFT reversed (8,7,6,5)
    rightChildren = firstHalf;
    leftChildren = [...secondHalf].reverse();
  } else if (direction === 'anti-clockwise') {
    // Map (Anti-Clockwise): first half LEFT (1,2,3,4), second half RIGHT reversed (8,7,6,5)
    leftChildren = firstHalf;
    rightChildren = [...secondHalf].reverse();
  } else {
    // Balanced Map (Up to Down): first half RIGHT, second half LEFT - both NOT reversed
    rightChildren = firstHalf;
    leftChildren = secondHalf;
  }

  // Calculate heights for each side
  const rightTotalHeight = calculateTotalHeight(rightChildren, cfg);
  const leftTotalHeight = calculateTotalHeight(leftChildren, cfg);

  // Use the MAX height so both sides are vertically aligned (start from same Y)
  const maxTotalHeight = Math.max(rightTotalHeight, leftTotalHeight);

  // Layout right side children
  let rightY = rootY - maxTotalHeight / 2;
  rightChildren.forEach((child) => {
    const subtreeHeight = calculateSubtreeHeight(child, cfg);
    const childX = rootX + rootWidth / 2 + cfg.horizontalGap;
    const childY = rightY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutBranch(child, childX, childY, 'right', baseLevel + 1, cfg, rootRendered);
    rootRendered.children.push(childRendered);
    rightY += subtreeHeight;
  });

  // Layout left side children (starts from same Y as right side)
  let leftY = rootY - maxTotalHeight / 2;
  leftChildren.forEach((child) => {
    const subtreeHeight = calculateSubtreeHeight(child, cfg);
    const childX = rootX - rootWidth / 2 - cfg.horizontalGap - cfg.nodeWidth;
    const childY = leftY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutBranch(child, childX, childY, 'left', baseLevel + 1, cfg, rootRendered);
    rootRendered.children.push(childRendered);
    leftY += subtreeHeight;
  });

  return rootRendered;
}

// Direction type for layouts - horizontal (left/right) or vertical (up/down)
type LayoutDirection = 'left' | 'right' | 'up' | 'down';

// Layout function signature for structure-specific layouts
type LayoutChildrenFn = (
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure?: StructureType
) => void;

// Helper to derive direction from structure type
function getDirectionFromStructure(structure?: StructureType, fallbackDirection?: LayoutDirection): LayoutDirection {
  if (structure?.endsWith('-left')) return 'left';
  if (structure?.endsWith('-right')) return 'right';
  if (structure?.endsWith('-up')) return 'up';
  if (structure?.endsWith('-down') || structure === 'orgchart') return 'down';
  return fallbackDirection || 'right';
}

// Horizontal layout: children arranged vertically, positioned left or right of parent
// Used by: mindmap, tree, logic (they differ only in connection drawing, not positioning)
function layoutChildrenHorizontal(
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure?: StructureType
): void {
  // Derive direction from structure if it specifies one, otherwise use passed direction
  const structureDir = getDirectionFromStructure(inheritedStructure, direction);
  const hDir = (structureDir === 'left' || structureDir === 'right') ? structureDir : 'right';

  const totalHeight = calculateTotalHeight(node.children, cfg, inheritedStructure);
  let childY = parentRendered.y + cfg.nodeHeight / 2 - totalHeight / 2;

  const childX = hDir === 'right'
    ? parentRendered.x + cfg.nodeWidth + cfg.horizontalGap
    : parentRendered.x - cfg.horizontalGap - cfg.nodeWidth;

  for (const child of node.children) {
    const childEffectiveStructure = child.structure || inheritedStructure;
    const subtreeHeight = calculateSubtreeHeight(child, cfg, childEffectiveStructure);
    const childCenterY = childY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutBranch(child, childX, childCenterY, hDir, level + 1, cfg, parentRendered, inheritedStructure);
    parentRendered.children.push(childRendered);
    childY += subtreeHeight;
  }
}

// Org Chart layout: children below parent (vertical, top-down)
function layoutChildrenOrgChart(
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure?: StructureType
): void {
  const parentCenterX = parentRendered.x + parentRendered.width / 2;
  // Derive direction from structure if it specifies one, otherwise use passed direction
  const structureDir = getDirectionFromStructure(inheritedStructure, direction);
  const vDir: LayoutDirection = (structureDir === 'up') ? 'up' : 'down';

  const childY = vDir === 'down'
    ? parentRendered.y + parentRendered.height + cfg.levelGap
    : parentRendered.y - cfg.levelGap - cfg.nodeHeight;

  const totalWidth = node.children.length * cfg.nodeWidth + (node.children.length - 1) * cfg.horizontalGap;
  let childX = parentCenterX - totalWidth / 2;

  for (const child of node.children) {
    const childRendered = layoutBranch(child, childX, childY, vDir, level + 1, cfg, parentRendered, inheritedStructure);
    parentRendered.children.push(childRendered);
    childX += cfg.nodeWidth + cfg.horizontalGap;
  }
}

// Layout function registry - maps structure types to their layout functions
const layoutRegistry: Record<string, LayoutChildrenFn> = {
  // Org chart variants (vertical layouts)
  'orgchart': layoutChildrenOrgChart,
  'orgchart-up': layoutChildrenOrgChart,
  'orgchart-right': layoutChildrenHorizontal,
  'orgchart-left': layoutChildrenHorizontal,
  // Mind map variants (horizontal layouts)
  'mindmap': layoutChildrenHorizontal,
  'mindmap-anti': layoutChildrenHorizontal,
  'mindmap-down': layoutChildrenHorizontal,
  'mindmap-clockwise': layoutChildrenHorizontal,
  // Tree variants (horizontal layouts)
  'tree': layoutChildrenHorizontal,
  'tree-right': layoutChildrenHorizontal,
  'tree-left': layoutChildrenHorizontal,
  // Logic variants (horizontal layouts)
  'logic': layoutChildrenHorizontal,
  'logic-right': layoutChildrenHorizontal,
  'logic-left': layoutChildrenHorizontal,
};

// Dispatch to appropriate layout function based on structure
function layoutChildren(
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  effectiveStructure?: StructureType
): void {
  const layoutFn = (effectiveStructure && layoutRegistry[effectiveStructure]) || layoutChildrenHorizontal;
  layoutFn(parentRendered, node, direction, level, cfg, effectiveStructure);
}

function layoutBranch(
  node: MindMapNode,
  x: number,
  y: number,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  parent: RenderedNode,
  inheritedStructure?: StructureType
): RenderedNode {
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;
  const effectiveStructure = node.structure || inheritedStructure;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (!node.collapsed && node.children.length > 0) {
    layoutChildren(rendered, node, direction, level, cfg, effectiveStructure);
  }

  return rendered;
}

function calculateSubtreeHeight(node: MindMapNode, cfg: LayoutConfig, inheritedStructure?: StructureType): number {
  if (node.collapsed || node.children.length === 0) {
    return cfg.nodeHeight + cfg.verticalGap;
  }

  // Determine effective structure for this node
  const effectiveStructure = node.structure || inheritedStructure;

  return calculateTotalHeight(node.children, cfg, effectiveStructure);
}

function calculateTotalHeight(children: MindMapNode[], cfg: LayoutConfig, inheritedStructure?: StructureType): number {
  if (children.length === 0) return 0;
  return children.reduce((sum, child) => {
    const childEffectiveStructure = child.structure || inheritedStructure;
    return sum + calculateSubtreeHeight(child, cfg, childEffectiveStructure);
  }, 0);
}

// ============================================
// Org Chart Layout (Top-Down or Bottom-Up)
// ============================================

export function layoutOrgChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  direction: 'down' | 'up' = 'down'
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  // First pass: calculate subtree widths
  const widths = new Map<string, number>();
  calculateSubtreeWidths(root, widths, cfg);

  // Second pass: position nodes
  const rootX = root.position?.x ?? cfg.centerX;
  const rootY = root.position?.y ?? cfg.centerY;

  const rootRendered = positionOrgChartNode(
    root,
    rootX,
    rootY,
    0,
    widths,
    cfg,
    undefined,
    direction
  );

  return rootRendered;
}

function calculateSubtreeWidths(
  node: MindMapNode,
  widths: Map<string, number>,
  cfg: LayoutConfig
): number {
  if (node.collapsed || node.children.length === 0) {
    const width = cfg.nodeWidth + cfg.verticalGap;
    widths.set(node.id, width);
    return width;
  }

  const childrenWidth = node.children.reduce(
    (sum, child) => sum + calculateSubtreeWidths(child, widths, cfg),
    0
  );
  const width = Math.max(cfg.nodeWidth + cfg.verticalGap, childrenWidth);
  widths.set(node.id, width);
  return width;
}

function positionOrgChartNode(
  node: MindMapNode,
  x: number,
  y: number,
  level: number,
  widths: Map<string, number>,
  cfg: LayoutConfig,
  parent?: RenderedNode,
  direction: 'down' | 'up' = 'down'
): RenderedNode {
  // Use manual position if set
  const finalX = node.position?.x ?? (x - cfg.nodeWidth / 2);
  const finalY = node.position?.y ?? y;

  const nodeWidth = level === 0 ? cfg.rootNodeWidth : cfg.nodeWidth;
  const nodeHeight = level === 0 ? cfg.rootNodeHeight : cfg.nodeHeight;

  const rendered: RenderedNode = {
    node,
    x: level === 0 ? finalX - cfg.rootNodeWidth / 2 + cfg.nodeWidth / 2 : finalX,
    y: finalY,
    width: nodeWidth,
    height: nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  const totalWidth = node.children.reduce(
    (sum, child) => sum + (widths.get(child.id) || 0),
    0
  );
  let childX = x - totalWidth / 2;

  // Calculate child Y based on direction
  const childY = direction === 'down'
    ? y + nodeHeight + cfg.levelGap
    : y - cfg.levelGap - cfg.nodeHeight;

  node.children.forEach((child) => {
    const childWidth = widths.get(child.id) || cfg.nodeWidth;
    const childRendered = positionOrgChartNode(
      child,
      childX + childWidth / 2,
      childY,
      level + 1,
      widths,
      cfg,
      rendered,
      direction
    );
    rendered.children.push(childRendered);
    childX += childWidth;
  });

  return rendered;
}

// ============================================
// Tree Chart Layout (XMind Style)
// ============================================
// Vertical spine from root, children branch horizontally
// - Tree Chart (Right): spine goes down, children branch right
// - Tree Chart (Left): spine goes down, children branch left
//
// Structure:
//   Root
//     |
//     +-- Child 1
//     |     +-- Subtopic 1
//     |           +-- Subtopic 1
//     +-- Child 2
//     |     +-- Subtopic 1
//     ...

export function layoutTreeChartDirectional(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  direction: 'left' | 'right' = 'right'
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  const baseLevel = cfg.startLevel;

  const rootX = root.position?.x ?? cfg.centerX;
  const rootY = root.position?.y ?? cfg.centerY;

  const isFloatingRoot = baseLevel >= 1;
  const rootWidth = isFloatingRoot ? cfg.nodeWidth : cfg.rootNodeWidth;
  const rootHeight = isFloatingRoot ? cfg.nodeHeight : cfg.rootNodeHeight;

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX - rootWidth / 2,
    y: rootY - rootHeight / 2,
    width: rootWidth,
    height: rootHeight,
    collapsed: root.collapsed || false,
    level: baseLevel,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Spine is at the CENTER of the root node (bottom-center)
  const spineX = rootX;  // rootX is already the center
  let currentY = rootY + rootHeight / 2 + cfg.levelGap;

  root.children.forEach((child) => {
    const subtreeHeight = calculateTreeChartSubtreeHeight(child, cfg, direction);

    // Child node positioned to the side of the spine (which is at root center)
    const childX = direction === 'right'
      ? spineX + cfg.horizontalGap * 0.5
      : spineX - cfg.horizontalGap * 0.5 - cfg.nodeWidth;

    const childRendered = layoutTreeChartBranch(
      child,
      childX,
      currentY,
      direction,
      baseLevel + 1,
      cfg,
      rootRendered,
      spineX
    );
    rootRendered.children.push(childRendered);

    currentY += subtreeHeight;
  });

  return rootRendered;
}

function layoutTreeChartBranch(
  node: MindMapNode,
  x: number,
  y: number,
  direction: 'left' | 'right',
  level: number,
  cfg: LayoutConfig,
  parent: RenderedNode,
  _spineX: number  // X position of the vertical spine (used for positioning context)
): RenderedNode {
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  // Children's vertical spine is at the CENTER of this node
  const childSpineX = finalX + cfg.nodeWidth / 2;

  // Children are positioned below this node
  let currentY = finalY + cfg.nodeHeight + cfg.verticalGap;

  node.children.forEach((child) => {
    const subtreeHeight = calculateTreeChartSubtreeHeight(child, cfg, direction);

    // Child node positioned to the side of ITS parent's center spine
    const childX = direction === 'right'
      ? childSpineX + cfg.horizontalGap * 0.5
      : childSpineX - cfg.horizontalGap * 0.5 - cfg.nodeWidth;

    const childRendered = layoutTreeChartBranch(
      child,
      childX,
      currentY,
      direction,
      level + 1,
      cfg,
      rendered,
      childSpineX
    );
    rendered.children.push(childRendered);

    currentY += subtreeHeight;
  });

  return rendered;
}

function calculateTreeChartSubtreeHeight(
  node: MindMapNode,
  cfg: LayoutConfig,
  direction: 'left' | 'right'
): number {
  if (node.collapsed || node.children.length === 0) {
    return cfg.nodeHeight + cfg.verticalGap;
  }

  // Height is this node plus all children heights
  const childrenHeight = node.children.reduce((sum, child) => {
    return sum + calculateTreeChartSubtreeHeight(child, cfg, direction);
  }, 0);

  return cfg.nodeHeight + cfg.verticalGap + childrenHeight;
}


// ============================================
// Tree Chart Layout
// ============================================

export function layoutTreeChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  return layoutOrgChart(root, config);
}

// ============================================
// Logic Chart Layout (Left to Right)
// ============================================

export function layoutLogicChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };

  const rootX = root.position?.x ?? (cfg.centerX - 300);
  const rootY = root.position?.y ?? cfg.centerY;

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX,
    y: rootY - cfg.rootNodeHeight / 2,
    width: cfg.rootNodeWidth,
    height: cfg.rootNodeHeight,
    collapsed: root.collapsed || false,
    level: 0,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Calculate total height
  const totalHeight = calculateTotalHeight(root.children, cfg);
  let childY = rootY - totalHeight / 2;

  root.children.forEach((child) => {
    const subtreeHeight = calculateSubtreeHeight(child, cfg);
    const childX = rootX + cfg.rootNodeWidth + cfg.horizontalGap;
    const childCenterY = childY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutLogicBranch(child, childX, childCenterY, 1, cfg, rootRendered);
    rootRendered.children.push(childRendered);
    childY += subtreeHeight;
  });

  return rootRendered;
}

function layoutLogicBranch(
  node: MindMapNode,
  x: number,
  y: number,
  level: number,
  cfg: LayoutConfig,
  parent: RenderedNode
): RenderedNode {
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  const totalHeight = calculateTotalHeight(node.children, cfg);
  let childY = finalY + cfg.nodeHeight / 2 - totalHeight / 2;

  node.children.forEach((child) => {
    const subtreeHeight = calculateSubtreeHeight(child, cfg);
    const childX = finalX + cfg.nodeWidth + cfg.horizontalGap;
    const childCenterY = childY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutLogicBranch(child, childX, childCenterY, level + 1, cfg, rendered);
    rendered.children.push(childRendered);
    childY += subtreeHeight;
  });

  return rendered;
}

// ============================================
// Logic Chart Directional (XMind Style)
// ============================================
// Vertical bracket from parent edge, children branch horizontally
// - Logic Chart (Right): bracket on right of parent, children go right
// - Logic Chart (Left): bracket on left of parent, children go left

export function layoutLogicChartDirectional(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  direction: 'left' | 'right' = 'right'
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  const baseLevel = cfg.startLevel;

  const rootX = root.position?.x ?? cfg.centerX;
  const rootY = root.position?.y ?? cfg.centerY;

  const isFloatingRoot = baseLevel >= 1;
  const rootWidth = isFloatingRoot ? cfg.nodeWidth : cfg.rootNodeWidth;
  const rootHeight = isFloatingRoot ? cfg.nodeHeight : cfg.rootNodeHeight;

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX - rootWidth / 2,
    y: rootY - rootHeight / 2,
    width: rootWidth,
    height: rootHeight,
    collapsed: root.collapsed || false,
    level: baseLevel,
    children: [],
  };

  if (root.collapsed || root.children.length === 0) {
    return rootRendered;
  }

  // Calculate total height for all children
  const totalHeight = calculateLogicChartHeight(root.children, cfg, direction);

  // Bracket starts from the middle-right (or middle-left) of root
  const bracketX = direction === 'right'
    ? rootX + rootWidth / 2
    : rootX - rootWidth / 2;

  // Children are centered vertically around the root
  let currentY = rootY - totalHeight / 2 + cfg.nodeHeight / 2;

  root.children.forEach((child) => {
    const subtreeHeight = calculateLogicChartSubtreeHeight(child, cfg, direction);

    // Child positioned to the side of the bracket
    const childX = direction === 'right'
      ? bracketX + cfg.horizontalGap
      : bracketX - cfg.horizontalGap - cfg.nodeWidth;

    const childRendered = layoutLogicChartBranch(
      child,
      childX,
      currentY,
      direction,
      baseLevel + 1,
      cfg,
      rootRendered
    );
    rootRendered.children.push(childRendered);

    currentY += subtreeHeight;
  });

  return rootRendered;
}

function layoutLogicChartBranch(
  node: MindMapNode,
  x: number,
  y: number,
  direction: 'left' | 'right',
  level: number,
  cfg: LayoutConfig,
  parent: RenderedNode
): RenderedNode {
  const finalX = node.position?.x ?? x;
  const finalY = node.position?.y ?? y;

  const rendered: RenderedNode = {
    node,
    x: finalX,
    y: finalY,
    width: cfg.nodeWidth,
    height: cfg.nodeHeight,
    collapsed: node.collapsed || false,
    level,
    parent,
    children: [],
  };

  if (node.collapsed || node.children.length === 0) {
    return rendered;
  }

  // Calculate total height for children
  const totalHeight = calculateLogicChartHeight(node.children, cfg, direction);

  // Children centered vertically around this node
  let currentY = finalY + cfg.nodeHeight / 2 - totalHeight / 2 + cfg.nodeHeight / 2;

  // Bracket is at the edge of this node
  const bracketX = direction === 'right'
    ? finalX + cfg.nodeWidth
    : finalX;

  node.children.forEach((child) => {
    const subtreeHeight = calculateLogicChartSubtreeHeight(child, cfg, direction);

    const childX = direction === 'right'
      ? bracketX + cfg.horizontalGap
      : bracketX - cfg.horizontalGap - cfg.nodeWidth;

    const childRendered = layoutLogicChartBranch(
      child,
      childX,
      currentY,
      direction,
      level + 1,
      cfg,
      rendered
    );
    rendered.children.push(childRendered);

    currentY += subtreeHeight;
  });

  return rendered;
}

function calculateLogicChartSubtreeHeight(
  node: MindMapNode,
  cfg: LayoutConfig,
  direction: 'left' | 'right'
): number {
  if (node.collapsed || node.children.length === 0) {
    return cfg.nodeHeight + cfg.verticalGap;
  }

  const childrenHeight = node.children.reduce((sum, child) => {
    return sum + calculateLogicChartSubtreeHeight(child, cfg, direction);
  }, 0);

  return Math.max(cfg.nodeHeight + cfg.verticalGap, childrenHeight);
}

function calculateLogicChartHeight(
  children: MindMapNode[],
  cfg: LayoutConfig,
  direction: 'left' | 'right'
): number {
  return children.reduce((sum, child) => {
    return sum + calculateLogicChartSubtreeHeight(child, cfg, direction);
  }, 0);
}

// ============================================
// Main Layout Function
// ============================================

export function layoutNodes(
  root: MindMapNode,
  structure: StructureType,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  switch (structure) {
    case 'mindmap':
      return layoutMindMap(root, config, 'clockwise');
    case 'mindmap-anti':
      return layoutMindMap(root, config, 'anti-clockwise');
    case 'mindmap-down':
      return layoutMindMap(root, config, 'down');
    case 'mindmap-clockwise':
      return layoutMindMap(root, config, 'clockwise');
    case 'orgchart':
      return layoutOrgChart(root, config, 'down');
    case 'orgchart-up':
      return layoutOrgChart(root, config, 'up');
    case 'orgchart-right':
      return layoutTreeChartDirectional(root, config, 'right');
    case 'orgchart-left':
      return layoutTreeChartDirectional(root, config, 'left');
    case 'tree':
      return layoutTreeChart(root, config);
    case 'tree-right':
      return layoutTreeChartDirectional(root, config, 'right');
    case 'tree-left':
      return layoutTreeChartDirectional(root, config, 'left');
    case 'logic':
      return layoutLogicChart(root, config);
    case 'logic-right':
      return layoutLogicChartDirectional(root, config, 'right');
    case 'logic-left':
      return layoutLogicChartDirectional(root, config, 'left');
    default:
      return layoutMindMap(root, config, 'clockwise');
  }
}

// ============================================
// Utility Functions
// ============================================

export function getAllRenderedNodes(root: RenderedNode): RenderedNode[] {
  const nodes: RenderedNode[] = [root];
  root.children.forEach(child => {
    nodes.push(...getAllRenderedNodes(child));
  });
  return nodes;
}

export function findRenderedNodeById(
  root: RenderedNode,
  id: string
): RenderedNode | null {
  if (root.node.id === id) return root;
  for (const child of root.children) {
    const found = findRenderedNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function getBoundingBox(
  nodes: RenderedNode[]
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  });

  return { minX, minY, maxX, maxY };
}
