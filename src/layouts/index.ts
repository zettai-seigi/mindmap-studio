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
// Mind Map Layout (Radial - Left/Right)
// ============================================

export function layoutMindMap(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
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

  // Split children into right and left sides
  const half = Math.ceil(root.children.length / 2);
  const rightChildren = root.children.slice(0, half);
  const leftChildren = root.children.slice(half);

  // Calculate heights for each side
  const rightTotalHeight = calculateTotalHeight(rightChildren, cfg);
  const leftTotalHeight = calculateTotalHeight(leftChildren, cfg);

  // Layout right side children
  let rightY = rootY - rightTotalHeight / 2;
  rightChildren.forEach((child) => {
    const subtreeHeight = calculateSubtreeHeight(child, cfg);
    const childX = rootX + rootWidth / 2 + cfg.horizontalGap;
    const childY = rightY + subtreeHeight / 2 - cfg.nodeHeight / 2;

    const childRendered = layoutBranch(child, childX, childY, 'right', baseLevel + 1, cfg, rootRendered);
    rootRendered.children.push(childRendered);
    rightY += subtreeHeight;
  });

  // Layout left side children
  let leftY = rootY - leftTotalHeight / 2;
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
  const hDir = (direction === 'left' || direction === 'right') ? direction : 'right';
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
  const vDir: LayoutDirection = (direction === 'up') ? 'up' : 'down';
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

// Timeline layout: alternating above/below a horizontal line
function layoutChildrenTimeline(
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure?: StructureType
): void {
  const TIMELINE_SPACING = 120;
  const parentCenterX = parentRendered.x + parentRendered.width / 2;
  const parentCenterY = parentRendered.y + parentRendered.height / 2;

  node.children.forEach((child, index) => {
    const isAbove = index % 2 === 0;
    const childX = parentCenterX + (index + 1) * TIMELINE_SPACING - cfg.nodeWidth / 2;
    const childY = parentCenterY + (isAbove ? -cfg.levelGap - cfg.nodeHeight : cfg.levelGap);

    const childRendered = layoutBranch(child, childX, childY, direction, level + 1, cfg, parentRendered, inheritedStructure);
    parentRendered.children.push(childRendered);
  });
}

// Fishbone (Ishikawa) layout: diagonal ribs branching from a horizontal spine
// XMind style: rightHeaded = head on right, spine goes left
//              leftHeaded = head on left, spine goes right
// Main branches alternate above/below the spine at ~45° angles
function layoutChildrenFishbone(
  parentRendered: RenderedNode,
  node: MindMapNode,
  direction: LayoutDirection,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure?: StructureType
): void {
  // Fishbone spacing constants
  const RIB_HORIZONTAL = 100;  // Horizontal distance between ribs along spine
  const RIB_VERTICAL = 70;     // Vertical offset from spine (creates ~45° angle)
  const SUB_RIB_H = 50;        // Sub-rib horizontal spacing
  const SUB_RIB_V = 40;        // Sub-rib vertical spacing

  const headX = parentRendered.x + parentRendered.width / 2;
  const headY = parentRendered.y + parentRendered.height / 2;

  // Use node's explicit direction if set (from XMind import), otherwise use passed direction
  // rightHeaded (direction='right'): spine goes LEFT (xDir=-1)
  // leftHeaded (direction='left'): spine goes RIGHT (xDir=1)
  const nodeDirection = node.direction || direction;
  const xDir = (nodeDirection === 'left') ? 1 : -1;

  node.children.forEach((child, index) => {
    // Alternate above (even) and below (odd) the spine
    const isAbove = index % 2 === 0;
    const yDir = isAbove ? -1 : 1;

    // Position along spine - ribs are evenly spaced horizontally
    // Each rib is placed diagonally from a point on the spine
    const spineX = headX + xDir * (index + 1) * RIB_HORIZONTAL;
    const ribX = spineX + xDir * RIB_HORIZONTAL * 0.3;  // Slight diagonal offset
    const ribY = headY + yDir * RIB_VERTICAL;

    const childRendered: RenderedNode = {
      node: child,
      x: child.position?.x ?? (ribX - cfg.nodeWidth / 2),
      y: child.position?.y ?? (ribY - cfg.nodeHeight / 2),
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level: level + 1,
      parent: parentRendered,
      children: [],
    };

    // Layout sub-ribs (grandchildren) continuing diagonally
    if (!child.collapsed && child.children.length > 0) {
      const childEffectiveStructure = child.structure || inheritedStructure;
      if (childEffectiveStructure === 'fishbone') {
        layoutFishboneSubRibs(childRendered, child, level + 1, cfg, childEffectiveStructure, xDir, yDir, SUB_RIB_H, SUB_RIB_V);
      } else {
        layoutChildren(childRendered, child, direction, level + 1, cfg, childEffectiveStructure);
      }
    }

    parentRendered.children.push(childRendered);
  });
}

// Sub-ribs for fishbone: continue diagonal pattern from main ribs
function layoutFishboneSubRibs(
  parentRendered: RenderedNode,
  node: MindMapNode,
  level: number,
  cfg: LayoutConfig,
  inheritedStructure: StructureType,
  xDir: number,
  yDir: number,
  subH: number,
  subV: number
): void {
  const startX = parentRendered.x + parentRendered.width / 2;
  const startY = parentRendered.y + parentRendered.height / 2;

  node.children.forEach((child, index) => {
    const childEffectiveStructure = child.structure || inheritedStructure;

    // Continue diagonally in same direction as parent rib
    const subX = startX + xDir * (index + 1) * subH;
    const subY = startY + yDir * (index + 1) * subV;

    const subRendered: RenderedNode = {
      node: child,
      x: child.position?.x ?? (subX - cfg.nodeWidth * 0.425),
      y: child.position?.y ?? (subY - cfg.nodeHeight * 0.425),
      width: cfg.nodeWidth * 0.85,
      height: cfg.nodeHeight * 0.85,
      collapsed: child.collapsed || false,
      level: level + 1,
      parent: parentRendered,
      children: [],
    };

    // Continue pattern for deeper levels with smaller spacing
    if (!child.collapsed && child.children.length > 0) {
      if (childEffectiveStructure === 'fishbone') {
        layoutFishboneSubRibs(subRendered, child, level + 1, cfg, childEffectiveStructure, xDir, yDir, subH * 0.75, subV * 0.75);
      } else {
        const dir: LayoutDirection = xDir > 0 ? 'right' : 'left';
        layoutChildren(subRendered, child, dir, level + 1, cfg, childEffectiveStructure);
      }
    }

    parentRendered.children.push(subRendered);
  });
}

// Layout function registry - maps structure types to their layout functions
const layoutRegistry: Record<string, LayoutChildrenFn> = {
  fishbone: layoutChildrenFishbone,
  orgchart: layoutChildrenOrgChart,
  timeline: layoutChildrenTimeline,
  // These all use horizontal layout (differ only in connection style)
  mindmap: layoutChildrenHorizontal,
  tree: layoutChildrenHorizontal,
  logic: layoutChildrenHorizontal,
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

  // Fishbone nodes spread diagonally, so they need more vertical space
  if (effectiveStructure === 'fishbone') {
    const BONE_SPACING = 35;
    const childCount = node.children.length;
    // Calculate height based on alternating children
    const aboveCount = Math.ceil(childCount / 2);
    const belowCount = Math.floor(childCount / 2);
    return cfg.nodeHeight + Math.max(aboveCount, belowCount) * BONE_SPACING * 2 + cfg.verticalGap;
  }
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
// Org Chart Layout (Top-Down)
// ============================================

export function layoutOrgChart(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
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
    undefined
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
  parent?: RenderedNode
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

  node.children.forEach((child) => {
    const childWidth = widths.get(child.id) || cfg.nodeWidth;
    const childRendered = positionOrgChartNode(
      child,
      childX + childWidth / 2,
      y + nodeHeight + cfg.levelGap,
      level + 1,
      widths,
      cfg,
      rendered
    );
    rendered.children.push(childRendered);
    childX += childWidth;
  });

  return rendered;
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
// Fishbone Layout (Ishikawa Diagram)
// ============================================

export function layoutFishbone(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {}
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  const SPINE_SPACING = 150;  // Fixed spacing along the spine
  const BRANCH_OFFSET = 100;  // Fixed vertical offset for branches
  const SUB_BRANCH_X = 50;    // Fixed horizontal offset for sub-branches
  const SUB_BRANCH_Y = 40;    // Fixed vertical spacing for sub-branches

  const rootX = root.position?.x ?? (cfg.centerX + 250);
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

  root.children.forEach((child, index) => {
    const isAbove = index % 2 === 0;
    const xPos = rootX - (index + 1) * SPINE_SPACING;
    const yPos = rootY + (isAbove ? -BRANCH_OFFSET : BRANCH_OFFSET);

    const childRendered: RenderedNode = {
      node: child,
      x: child.position?.x ?? xPos,
      y: child.position?.y ?? (yPos - cfg.nodeHeight / 2),
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level: 1,
      parent: rootRendered,
      children: [],
    };

    // Layout sub-branches with fixed spacing
    if (!child.collapsed && child.children.length > 0) {
      const direction = isAbove ? -1 : 1;
      child.children.forEach((subChild, subIndex) => {
        const subRendered: RenderedNode = {
          node: subChild,
          x: subChild.position?.x ?? (xPos - (subIndex + 1) * SUB_BRANCH_X),
          y: subChild.position?.y ?? (yPos + direction * (subIndex + 1) * SUB_BRANCH_Y - cfg.nodeHeight / 2),
          width: cfg.nodeWidth * 0.85,
          height: cfg.nodeHeight * 0.85,
          collapsed: subChild.collapsed || false,
          level: 2,
          parent: childRendered,
          children: [],
        };
        childRendered.children.push(subRendered);
      });
    }

    rootRendered.children.push(childRendered);
  });

  return rootRendered;
}

// ============================================
// Timeline Layout
// ============================================

export function layoutTimeline(
  root: MindMapNode,
  config: Partial<LayoutConfig> = {},
  horizontal: boolean = true
): RenderedNode {
  const cfg = { ...defaultConfig, ...config };
  const TIMELINE_SPACING = 160;  // Fixed spacing between timeline items
  const BRANCH_OFFSET = 80;      // Fixed offset for alternating items
  const SUB_ITEM_SPACING = 45;   // Fixed spacing for sub-items

  const rootX = root.position?.x ?? (horizontal ? cfg.centerX - 350 : cfg.centerX);
  const rootY = root.position?.y ?? (horizontal ? cfg.centerY : cfg.centerY - 250);

  const rootRendered: RenderedNode = {
    node: root,
    x: rootX - cfg.rootNodeWidth / 2,
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

  root.children.forEach((child, index) => {
    const isAlternate = index % 2 === 0;

    const childX = horizontal
      ? rootX + (index + 1) * TIMELINE_SPACING
      : rootX;
    const childY = horizontal
      ? rootY + (isAlternate ? -BRANCH_OFFSET : BRANCH_OFFSET)
      : rootY + (index + 1) * TIMELINE_SPACING;

    const childRendered: RenderedNode = {
      node: child,
      x: child.position?.x ?? (childX - cfg.nodeWidth / 2),
      y: child.position?.y ?? (childY - cfg.nodeHeight / 2),
      width: cfg.nodeWidth,
      height: cfg.nodeHeight,
      collapsed: child.collapsed || false,
      level: 1,
      parent: rootRendered,
      children: [],
    };

    // Layout sub-items with fixed spacing
    if (!child.collapsed && child.children.length > 0) {
      const direction = horizontal ? (isAlternate ? -1 : 1) : 1;
      child.children.forEach((subChild, subIndex) => {
        const subX = horizontal
          ? childX
          : childX + (subIndex + 1) * SUB_ITEM_SPACING;
        const subY = horizontal
          ? childY + direction * (subIndex + 1) * SUB_ITEM_SPACING
          : childY;

        const subRendered: RenderedNode = {
          node: subChild,
          x: subChild.position?.x ?? (subX - cfg.nodeWidth * 0.4),
          y: subChild.position?.y ?? (subY - cfg.nodeHeight * 0.4),
          width: cfg.nodeWidth * 0.85,
          height: cfg.nodeHeight * 0.85,
          collapsed: subChild.collapsed || false,
          level: 2,
          parent: childRendered,
          children: [],
        };
        childRendered.children.push(subRendered);
      });
    }

    rootRendered.children.push(childRendered);
  });

  return rootRendered;
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
      return layoutMindMap(root, config);
    case 'orgchart':
      return layoutOrgChart(root, config);
    case 'tree':
      return layoutTreeChart(root, config);
    case 'logic':
      return layoutLogicChart(root, config);
    case 'fishbone':
      return layoutFishbone(root, config);
    case 'timeline':
      return layoutTimeline(root, config);
    default:
      return layoutMindMap(root, config);
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
