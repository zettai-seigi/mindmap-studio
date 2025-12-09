/**
 * Canvas coordinate transformation utilities
 * Handles conversion between screen coordinates and world coordinates
 */

import type { Ref } from 'vue';
import type { Position } from '../types';

export interface CanvasCoordinatesConfig {
  canvasRef: Ref<HTMLCanvasElement | null>;
  canvasWidth: Ref<number>;
  canvasHeight: Ref<number>;
  zoom: () => number;
  panX: () => number;
  panY: () => number;
}

export function useCanvasCoordinates(config: CanvasCoordinatesConfig) {
  const { canvasRef, canvasWidth, canvasHeight, zoom, panX, panY } = config;

  /**
   * Convert screen (mouse event) coordinates to world coordinates
   */
  function screenToWorld(e: MouseEvent): Position {
    const canvas = canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const cssWidth = canvasWidth.value;
    const cssHeight = canvasHeight.value;

    const x = (e.clientX - rect.left - cssWidth / 2) / zoom()
      + cssWidth / 2 - panX();
    const y = (e.clientY - rect.top - cssHeight / 2) / zoom()
      + cssHeight / 2 - panY();

    return { x, y };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  function worldToScreen(worldX: number, worldY: number): Position {
    const canvas = canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const cssWidth = canvasWidth.value;
    const cssHeight = canvasHeight.value;

    const screenX = (worldX - cssWidth / 2 + panX()) * zoom() + cssWidth / 2 + rect.left;
    const screenY = (worldY - cssHeight / 2 + panY()) * zoom() + cssHeight / 2 + rect.top;

    return { x: screenX, y: screenY };
  }

  /**
   * Get the edge point of a node's bounding box where a line from center to target intersects
   */
  function getNodeEdgePoint(
    node: { x: number; y: number; width: number; height: number },
    targetX: number,
    targetY: number
  ): Position {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;

    const dx = targetX - centerX;
    const dy = targetY - centerY;

    if (dx === 0 && dy === 0) {
      return { x: centerX, y: centerY };
    }

    const halfWidth = node.width / 2 + 4; // Add small padding
    const halfHeight = node.height / 2 + 4;

    // Calculate intersection with rectangle edges
    let t = 1;

    if (dx !== 0) {
      const tLeft = -halfWidth / dx;
      const tRight = halfWidth / dx;
      if (tLeft > 0) t = Math.min(t, tLeft);
      if (tRight > 0) t = Math.min(t, tRight);
    }

    if (dy !== 0) {
      const tTop = -halfHeight / dy;
      const tBottom = halfHeight / dy;
      if (tTop > 0) t = Math.min(t, tTop);
      if (tBottom > 0) t = Math.min(t, tBottom);
    }

    return {
      x: centerX + dx * t,
      y: centerY + dy * t
    };
  }

  return {
    screenToWorld,
    worldToScreen,
    getNodeEdgePoint
  };
}
