export interface Slide {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  title?: string;
}

export interface DrawingData {
  slideId: string;
  dataUrl: string; // The saved canvas state as an image data URL
}

export enum ToolType {
  PEN = 'PEN',
  ERASER = 'ERASER',
  POINTER = 'POINTER', // Standard cursor
  LASER = 'LASER',     // Fading trail
  SHAPE = 'SHAPE',
  SELECT = 'SELECT',
  TEXT = 'TEXT'
}

export type PenEffect = 'normal' | 'neon' | 'highlighter';
export type ShapeType = 'rectangle' | 'circle' | 'line';

export interface PenStyle {
  color: string;
  size: number;
  effect: PenEffect;
}

export interface AIResponse {
  summary: string;
  questions: string[];
}