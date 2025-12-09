import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, PenStyle, ShapeType } from '../types';
import { Trash2, Copy, Scissors, Palette, X, Move } from 'lucide-react';

interface CanvasLayerProps {
  width: number;
  height: number;
  activeTool: ToolType;
  activeShape: ShapeType;
  penStyle: PenStyle;
  savedDrawing: string | null;
  onSave: (dataUrl: string) => void;
}

const HANDLE_RADIUS = 5;
const HIT_TOLERANCE = 10;

export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  width,
  height,
  activeTool,
  activeShape,
  penStyle,
  savedDrawing,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  
  // Smoothing and Dynamics
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const lastDrawTimeRef = useRef<number>(0);

  // Laser State
  const laserPointsRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const laserReqRef = useRef<number>(0);
  
  // Selection Tool Refs
  const selectionRef = useRef<{ canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number } | null>(null);
  const bgSnapshotRef = useRef<ImageData | null>(null); // Canvas state with the "hole" where selection was lifted
  const resizingHandleRef = useRef<string | null>(null); // 'nw', 'ne', 'se', 'sw'

  // Internal Clipboard
  const clipboardRef = useRef<{ canvas: HTMLCanvasElement, w: number, h: number } | null>(null);

  // Selection Menu State
  const [selectionMenu, setSelectionMenu] = useState<{ x: number, y: number, w: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Text Tool State
  const [textInput, setTextInput] = useState<{ x: number, y: number, text: string, visible: boolean }>({ 
    x: 0, y: 0, text: '', visible: false 
  });

  // Ref to track if the current update was initiated by this component
  const skipNextRedraw = useRef(false);

  // Helper to detect if point is over a handle
  const getHandleAtPosition = (x: number, y: number, rect: { x: number, y: number, w: number, h: number }) => {
    const handles = [
      { id: 'nw', cx: rect.x, cy: rect.y },
      { id: 'ne', cx: rect.x + rect.w, cy: rect.y },
      { id: 'se', cx: rect.x + rect.w, cy: rect.y + rect.h },
      { id: 'sw', cx: rect.x, cy: rect.y + rect.h }
    ];
    return handles.find(h => 
      Math.abs(x - h.cx) <= HIT_TOLERANCE && Math.abs(y - h.cy) <= HIT_TOLERANCE
    );
  };

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      contextRef.current = ctx;
    }

    // Init Laser Canvas
    const laserCanvas = laserCanvasRef.current;
    if (laserCanvas) {
      laserCanvas.width = width * dpr;
      laserCanvas.height = height * dpr;
      laserCanvas.style.width = `${width}px`;
      laserCanvas.style.height = `${height}px`;
      const lCtx = laserCanvas.getContext('2d');
      if (lCtx) lCtx.scale(dpr, dpr);
    }
  }, [width, height]);

  // Load saved drawing when slide changes
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx || !canvasRef.current) return;

    // If we initiated the update (by drawing), skip the redraw to prevent blinking
    if (skipNextRedraw.current) {
      skipNextRedraw.current = false;
      return;
    }

    // Reset selection and points when slide changes
    selectionRef.current = null;
    bgSnapshotRef.current = null;
    resizingHandleRef.current = null;
    pointsRef.current = [];
    setSelectionMenu(null);
    setTextInput({ x: 0, y: 0, text: '', visible: false });

    // Clear current canvas first
    ctx.clearRect(0, 0, width, height);

    if (savedDrawing) {
      const img = new Image();
      img.src = savedDrawing;
      img.onload = () => {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      };
    }
  }, [savedDrawing, width, height]);

  // Force redraw of the scene (Background + Selection)
  const redrawScene = () => {
    const ctx = contextRef.current;
    if (!ctx || !bgSnapshotRef.current) return;

    // 1. Put the background (with hole)
    ctx.putImageData(bgSnapshotRef.current, 0, 0);

    // 2. Draw selection if exists
    if (selectionRef.current) {
      const { canvas, x, y, w, h } = selectionRef.current;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      // Draw image scaled to current w/h
      ctx.drawImage(canvas, x, y, w, h);
      
      // Draw dashed border
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x, y, w, h);
      
      // Draw resize handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1;
      
      const handles = [
        { x: x, y: y },           // nw
        { x: x + w, y: y },       // ne
        { x: x + w, y: y + h },   // se
        { x: x, y: y + h }        // sw
      ];
      
      handles.forEach(h => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }
  };

  // Helper to commit current selection to canvas
  const commitSelection = () => {
    const ctx = contextRef.current;
    if (!ctx || !selectionRef.current) return;

    // If we have a background snapshot (normal selection flow), use it
    if (bgSnapshotRef.current) {
      ctx.putImageData(bgSnapshotRef.current, 0, 0);
    }

    const { canvas, x, y, w, h } = selectionRef.current;
    ctx.save();
    ctx.shadowBlur = 0;
    // Draw using current dimensions (applies resize)
    ctx.drawImage(canvas, x, y, w, h);
    ctx.restore();

    selectionRef.current = null;
    bgSnapshotRef.current = null;
    resizingHandleRef.current = null;
    setSelectionMenu(null);
    setShowColorPicker(false);
    
    if (canvasRef.current) {
      skipNextRedraw.current = true;
      onSave(canvasRef.current.toDataURL());
    }
  };

  const commitText = () => {
    if (!textInput.visible || !textInput.text.trim()) {
      setTextInput(prev => ({ ...prev, visible: false }));
      return;
    }

    const ctx = contextRef.current;
    if (ctx && canvasRef.current) {
      ctx.save();
      ctx.font = `${penStyle.size * 2}px sans-serif`;
      ctx.fillStyle = penStyle.color;
      ctx.textBaseline = 'top';
      
      // Handle multi-line
      const lines = textInput.text.split('\n');
      const lineHeight = penStyle.size * 2.4;
      
      lines.forEach((line, i) => {
        ctx.fillText(line, textInput.x, textInput.y + (i * lineHeight));
      });
      
      ctx.restore();
      
      skipNextRedraw.current = true;
      onSave(canvasRef.current.toDataURL());
    }
    
    setTextInput(prev => ({ ...prev, visible: false, text: '' }));
  };

  // Commit selection when tool changes
  useEffect(() => {
    if (activeTool !== ToolType.SELECT && selectionRef.current) {
      commitSelection();
    }
    if (activeTool !== ToolType.TEXT && textInput.visible) {
      commitText();
    }
  }, [activeTool]);

  // Laser Loop
  useEffect(() => {
    const renderLaser = () => {
      const canvas = laserCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();
      
      // Filter old points (older than 300ms)
      laserPointsRef.current = laserPointsRef.current.filter(p => now - p.time < 300);

      if (laserPointsRef.current.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Red laser
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        
        // Draw path with fading opacity
        for (let i = 0; i < laserPointsRef.current.length - 1; i++) {
          const p1 = laserPointsRef.current[i];
          const p2 = laserPointsRef.current[i + 1];
          const age = now - p1.time;
          const opacity = Math.max(0, 1 - age / 300);
          
          ctx.globalAlpha = opacity;
          ctx.lineWidth = 4 * opacity + 2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        
        // Draw "head" dot
        const last = laserPointsRef.current[laserPointsRef.current.length - 1];
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      if (activeTool === ToolType.LASER) {
        laserReqRef.current = requestAnimationFrame(renderLaser);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    if (activeTool === ToolType.LASER) {
      laserReqRef.current = requestAnimationFrame(renderLaser);
    }

    return () => cancelAnimationFrame(laserReqRef.current);
  }, [activeTool]);


  const applyContextStyles = (ctx: CanvasRenderingContext2D, isShapePreview = false) => {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === ToolType.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 30;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penStyle.color;

      if (penStyle.effect === 'neon') {
        ctx.lineWidth = penStyle.size;
        ctx.shadowBlur = 15;
        ctx.shadowColor = penStyle.color;
      } else if (penStyle.effect === 'highlighter') {
        ctx.lineWidth = penStyle.size * 5;
        ctx.globalAlpha = 0.4;
      } else {
        ctx.lineWidth = penStyle.size;
      }
    }
  };

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Critical: Do not start drawing if clicking on the selection menu
    if ((e.target as HTMLElement).closest('.selection-menu')) return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

    // Commit Text if clicked outside
    if (activeTool !== ToolType.TEXT && textInput.visible) {
      commitText();
    }

    const coords = getCoordinates(e);

    if (activeTool === ToolType.TEXT) {
      if (textInput.visible) {
        commitText();
      } else {
        setTextInput({ x: coords.x, y: coords.y, text: '', visible: true });
      }
      return;
    }

    if (activeTool === ToolType.POINTER) return;
    
    // Laser logic handled in mouse move, but we track interaction state here
    if (activeTool === ToolType.LASER) {
      laserPointsRef.current = [];
      setIsDrawing(true);
      return;
    }
    
    const ctx = contextRef.current;
    if (!ctx || !canvasRef.current) return;

    if (activeTool === ToolType.SELECT) {
      if (selectionRef.current) {
        // Check for handle clicks first
        const handle = getHandleAtPosition(coords.x, coords.y, selectionRef.current);
        if (handle) {
          setIsDrawing(true);
          resizingHandleRef.current = handle.id;
          lastPos.current = coords;
          setSelectionMenu(null);
          return;
        }

        const { x, y, w, h } = selectionRef.current;
        // Check if clicking inside selection to move it
        if (coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h) {
          setIsDrawing(true);
          resizingHandleRef.current = null;
          lastPos.current = coords;
          setSelectionMenu(null); // Hide menu while dragging
          return;
        } else {
          // Clicked outside selection -> Commit
          commitSelection();
        }
      }
      // Start new selection
      setIsDrawing(true);
      startPos.current = coords;
      const dpr = window.devicePixelRatio || 1;
      snapshotRef.current = ctx.getImageData(0, 0, width * dpr, height * dpr);
      return;
    }

    setIsDrawing(true);
    lastPos.current = coords;
    startPos.current = coords;
    
    // Initialize points for smoothing
    pointsRef.current = [coords];
    lastDrawTimeRef.current = Date.now();

    if (activeTool === ToolType.SHAPE) {
      const dpr = window.devicePixelRatio || 1;
      snapshotRef.current = ctx.getImageData(0, 0, width * dpr, height * dpr);
    } else {
      // For PEN/ERASER, we prepare context but don't draw yet (wait for movement)
      applyContextStyles(ctx);
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCoordinates(e);

    // Update cursor for selection tool
    if (activeTool === ToolType.SELECT && selectionRef.current && !isDrawing) {
      const handle = getHandleAtPosition(x, y, selectionRef.current);
      if (handle) {
        if (handle.id === 'nw' || handle.id === 'se') canvasRef.current!.style.cursor = 'nwse-resize';
        else if (handle.id === 'ne' || handle.id === 'sw') canvasRef.current!.style.cursor = 'nesw-resize';
      } else {
        const { x: sx, y: sy, w, h } = selectionRef.current;
        if (x >= sx && x <= sx + w && y >= sy && y <= sy + h) {
          canvasRef.current!.style.cursor = 'move';
        } else {
          canvasRef.current!.style.cursor = 'crosshair';
        }
      }
    } else if (activeTool === ToolType.SELECT && !selectionRef.current) {
      if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
    }

    if (activeTool === ToolType.LASER) {
      laserPointsRef.current.push({ x, y, time: Date.now() });
      return;
    }

    if (!isDrawing || activeTool === ToolType.POINTER || activeTool === ToolType.TEXT || !contextRef.current) return;

    const ctx = contextRef.current;

    if (activeTool === ToolType.SELECT) {
      if (selectionRef.current) {
        if (!bgSnapshotRef.current || !lastPos.current) return;
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;

        if (resizingHandleRef.current) {
          // Resize Logic
          const handle = resizingHandleRef.current;
          const sel = selectionRef.current;
          
          if (handle.includes('e')) sel.w += dx;
          if (handle.includes('w')) {
            sel.x += dx;
            sel.w -= dx;
          }
          if (handle.includes('s')) sel.h += dy;
          if (handle.includes('n')) {
            sel.y += dy;
            sel.h -= dy;
          }

          // Enforce minimum size to avoid flipping issues
          if (sel.w < 10) sel.w = 10;
          if (sel.h < 10) sel.h = 10;

        } else {
          // Move Logic
          selectionRef.current.x += dx;
          selectionRef.current.y += dy;
        }

        lastPos.current = { x, y };
        redrawScene();
      } else {
        // Creating new selection box
        if (!startPos.current || !snapshotRef.current) return;
        ctx.putImageData(snapshotRef.current, 0, 0);
        const startX = startPos.current.x;
        const startY = startPos.current.y;
        const w = x - startX;
        const h = y - startY;
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startX, startY, w, h);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.fillRect(startX, startY, w, h);
        ctx.restore();
      }
      return;
    }

    if (activeTool === ToolType.SHAPE) {
      if (!startPos.current || !snapshotRef.current) return;
      ctx.putImageData(snapshotRef.current, 0, 0);
      applyContextStyles(ctx, true);
      ctx.beginPath();
      const startX = startPos.current.x;
      const startY = startPos.current.y;
      
      if (activeShape === 'rectangle') {
        ctx.rect(startX, startY, x - startX, y - startY);
      } else if (activeShape === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      } else if (activeShape === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    } 
    
    // --- PEN / ERASER LOGIC ---
    if (activeTool === ToolType.PEN || activeTool === ToolType.ERASER) {
      
      // 1. Point Filtering (Smoothing)
      // Check distance from last saved point to avoid jitter/crowding
      const lastPoint = pointsRef.current.length > 0 ? pointsRef.current[pointsRef.current.length - 1] : null;
      if (lastPoint) {
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        // Minimum distance of 4px for smoothing
        if (dist < 4) return;
      }

      // Add point
      pointsRef.current.push({ x, y });
      const points = pointsRef.current;
      
      // Need at least 3 points to start a curve (p1, p2, p3)
      if (points.length < 3) return;

      const p1 = points[points.length - 3];
      const p2 = points[points.length - 2];
      const p3 = points[points.length - 1];

      applyContextStyles(ctx);

      // Dynamic Width Calculation
      if (activeTool === ToolType.PEN && penStyle.effect === 'normal') {
        const now = Date.now();
        const dt = now - lastDrawTimeRef.current;
        // Distance between p2 and p3 (current segment being processed approx)
        const dist = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        const velocity = dist / (dt || 1);
        lastDrawTimeRef.current = now;
        
        // Simple inverse speed mapping: faster = thinner
        const speedFactor = Math.max(0, Math.min(1, velocity * 0.15));
        const dynamicWidth = penStyle.size * (1.2 - speedFactor * 0.6);
        ctx.lineWidth = dynamicWidth;
      }

      ctx.beginPath();
      
      // Bezier Smoothing Logic
      if (points.length === 3) {
        // Special case for the start of the stroke
        // Draw from p1 to the midpoint of p2-p3
        ctx.moveTo(p1.x, p1.y);
        const mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
        ctx.quadraticCurveTo(p2.x, p2.y, mid.x, mid.y);
      } else {
        // Standard case: Continue from previous midpoint
        // Midpoint 1: between p1 and p2 (where we left off)
        const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        // Midpoint 2: between p2 and p3 (new destination)
        const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
        
        ctx.moveTo(mid1.x, mid1.y);
        ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
      }
      
      ctx.stroke();

      // Neon Effect Particles
      if (activeTool === ToolType.PEN && penStyle.effect === 'neon' && Math.random() > 0.85) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = penStyle.color;
        ctx.shadowBlur = 10;
        ctx.globalCompositeOperation = 'source-over';
        const rx = p2.x + (Math.random() - 0.5) * penStyle.size * 2;
        const ry = p2.y + (Math.random() - 0.5) * penStyle.size * 2;
        const size = Math.random() * (penStyle.size / 3);
        ctx.beginPath();
        ctx.arc(rx, ry, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      lastPos.current = { x, y };
    }
  };

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    
    // Laser doesn't draw to main canvas
    if (activeTool === ToolType.LASER) return;

    if (!isDrawing && activeTool !== ToolType.SELECT) return;
    
    const ctx = contextRef.current;
    
    // Finish the stroke for Pen/Eraser
    if ((activeTool === ToolType.PEN || activeTool === ToolType.ERASER) && ctx && pointsRef.current.length > 0) {
       const points = pointsRef.current;
       applyContextStyles(ctx);
       
       ctx.beginPath();
       if (points.length === 1) {
         // Draw a dot if only one point
         ctx.fillStyle = ctx.strokeStyle; 
         ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
         ctx.fill();
       } else if (points.length === 2) {
         // Draw a simple line if only two points
         ctx.moveTo(points[0].x, points[0].y);
         ctx.lineTo(points[1].x, points[1].y);
         ctx.stroke();
       } else {
         const pLast = points[points.length - 1];
         const pPrev = points[points.length - 2];
         const mid = { x: (pPrev.x + pLast.x) / 2, y: (pPrev.y + pLast.y) / 2 };
         
         ctx.moveTo(mid.x, mid.y);
         ctx.lineTo(pLast.x, pLast.y);
         ctx.stroke();
       }
    }
    
    pointsRef.current = [];

    if (activeTool === ToolType.SELECT && ctx && canvasRef.current) {
      if (selectionRef.current) {
        // Just finished moving or resizing
        setSelectionMenu({ 
          x: selectionRef.current.x, 
          y: selectionRef.current.y,
          w: selectionRef.current.w
        });
        resizingHandleRef.current = null;
        return; 
      }
      
      if (startPos.current && lastPos.current && snapshotRef.current) {
        const dpr = window.devicePixelRatio || 1;
        ctx.putImageData(snapshotRef.current, 0, 0);
        
        const startX = startPos.current.x;
        const startY = startPos.current.y;
        const endX = lastPos.current.x;
        const endY = lastPos.current.y;
        
        let x = Math.min(startX, endX);
        let y = Math.min(startY, endY);
        let w = Math.abs(endX - startX);
        let h = Math.abs(endY - startY);
        
        if (w < 5 || h < 5) {
          snapshotRef.current = null;
          return;
        }

        const imageData = ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr);
        ctx.clearRect(x, y, w, h);
        bgSnapshotRef.current = ctx.getImageData(0, 0, width * dpr, height * dpr);
        
        const tempC = document.createElement('canvas');
        tempC.width = w * dpr;
        tempC.height = h * dpr;
        const tempCtx = tempC.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(imageData, 0, 0);
        }
        selectionRef.current = { canvas: tempC, x, y, w, h };
        setSelectionMenu({ x, y, w });
        redrawScene();
      }
      startPos.current = null;
      lastPos.current = null;
      snapshotRef.current = null;
      return;
    }

    lastPos.current = null;
    startPos.current = null;
    snapshotRef.current = null;
    resizingHandleRef.current = null;
    
    if (activeTool !== ToolType.TEXT && canvasRef.current) {
      skipNextRedraw.current = true;
      onSave(canvasRef.current.toDataURL());
    }
  }, [isDrawing, onSave, activeTool, width, height]);

  // --- SELECTION ACTIONS ---

  const copySelection = () => {
    if (!selectionRef.current) return;
    const { canvas, w, h } = selectionRef.current;
    
    // Create a new canvas that respects the current visual size (w, h)
    const copyC = document.createElement('canvas');
    copyC.width = w;
    copyC.height = h;
    const ctx = copyC.getContext('2d');
    if (ctx) {
      // Draw the original content scaled to the new dimensions
      ctx.drawImage(canvas, 0, 0, w, h);
    }
    clipboardRef.current = { canvas: copyC, w, h };
  };

  const pasteSelection = () => {
    if (!clipboardRef.current || !contextRef.current) return;
    const ctx = contextRef.current;
    
    // 1. Commit existing selection if any
    if (selectionRef.current) {
      commitSelection();
    }

    const { canvas: clipCanvas, w, h } = clipboardRef.current;
    const centerX = width / 2 - w / 2;
    const centerY = height / 2 - h / 2;
    const dpr = window.devicePixelRatio || 1;

    // 2. Snapshot current canvas to be the background for the new selection
    bgSnapshotRef.current = ctx.getImageData(0, 0, width * dpr, height * dpr);

    // 3. Create new selection
    // Note: clipCanvas is already sized correctly from copy
    const pasteC = document.createElement('canvas');
    pasteC.width = w;
    pasteC.height = h;
    pasteC.getContext('2d')?.drawImage(clipCanvas, 0, 0);

    selectionRef.current = { canvas: pasteC, x: centerX, y: centerY, w, h };
    setSelectionMenu({ x: centerX, y: centerY, w });
    redrawScene();
  };

  const deleteSelection = () => {
    const ctx = contextRef.current;
    if (!ctx || !bgSnapshotRef.current) return;
    ctx.putImageData(bgSnapshotRef.current, 0, 0);
    selectionRef.current = null;
    bgSnapshotRef.current = null;
    setSelectionMenu(null);
    setShowColorPicker(false);
    if (canvasRef.current) {
      skipNextRedraw.current = true;
      onSave(canvasRef.current.toDataURL());
    }
  };

  const duplicateSelection = () => {
    const ctx = contextRef.current;
    if (!ctx || !selectionRef.current || !bgSnapshotRef.current) return;
    
    const dpr = window.devicePixelRatio || 1;

    // 1. Restore background (with hole)
    ctx.putImageData(bgSnapshotRef.current, 0, 0);
    
    // 2. Stamp current selection into background
    // Must use current w/h to stamp the resized version
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.drawImage(selectionRef.current.canvas, selectionRef.current.x, selectionRef.current.y, selectionRef.current.w, selectionRef.current.h);
    ctx.restore();

    // 3. Update snapshot to include the stamp
    bgSnapshotRef.current = ctx.getImageData(0, 0, width * dpr, height * dpr);

    // 4. Offset current selection
    selectionRef.current.x += 20;
    selectionRef.current.y += 20;
    
    // 5. Update Menu
    setSelectionMenu({ 
      x: selectionRef.current.x, 
      y: selectionRef.current.y,
      w: selectionRef.current.w
    });
    
    redrawScene();
  };

  const cutSelection = () => {
    copySelection();
    deleteSelection();
  };

  const changeSelectionColor = (color: string) => {
    if (!selectionRef.current) return;
    const { canvas } = selectionRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    setShowColorPicker(false);
    redrawScene();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy: Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectionRef.current) {
          e.preventDefault();
          copySelection();
        }
      }
      // Cut: Ctrl+X
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (selectionRef.current) {
          e.preventDefault();
          cutSelection();
        }
      }
      // Paste: Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteSelection();
      }
      // Delete: Backspace/Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectionRef.current) {
          e.preventDefault();
          deleteSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [width, height]); // Re-bind if dimensions change to ensure Paste center calc is correct

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className={`absolute top-0 left-0 w-full h-full touch-none 
          ${activeTool === ToolType.POINTER ? 'pointer-events-none' : 
            activeTool === ToolType.SELECT ? '' : // Cursor handled in logic 
            activeTool === ToolType.LASER ? 'cursor-none' :
            activeTool === ToolType.TEXT ? 'cursor-text' : 
            'cursor-crosshair'}`}
        style={{ zIndex: 10 }}
      />
      
      {/* Laser Layer */}
      <canvas 
        ref={laserCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 11 }}
      />

      {/* Text Input Overlay */}
      {textInput.visible && (
        <textarea
          autoFocus
          value={textInput.text}
          onChange={(e) => setTextInput(prev => ({ ...prev, text: e.target.value }))}
          onBlur={commitText}
          onKeyDown={(e) => {
             if (e.key === 'Enter' && !e.shiftKey) {
               e.preventDefault();
               commitText();
             }
          }}
          className="absolute z-20 bg-transparent border-2 border-dashed border-indigo-400 outline-none resize-none overflow-hidden"
          style={{
            left: textInput.x,
            top: textInput.y,
            color: penStyle.color,
            fontSize: `${penStyle.size * 2}px`,
            fontFamily: 'sans-serif',
            minWidth: '100px',
            minHeight: '1.5em',
            lineHeight: 1.2
          }}
          placeholder="Type..."
        />
      )}
      
      {/* Selection Context Menu */}
      {selectionMenu && (
        <div 
          className="absolute z-50 flex flex-col gap-2 selection-menu animate-in fade-in zoom-in duration-200 select-none"
          style={{
            left: Math.max(10, Math.min(width - 320, selectionMenu.x)), // Keep on screen
            top: Math.max(10, selectionMenu.y - 70) // Show above selection
          }}
          // CRITICAL: Stop propagation to prevent canvas from capturing these clicks
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center bg-[#121212]/95 text-white rounded-xl shadow-2xl border border-white/10 p-1 backdrop-blur-md">
             <div className="px-2 py-1 text-xs text-indigo-300 font-medium border-r border-white/10 flex items-center gap-1 cursor-grab active:cursor-grabbing" title="Drag selection to move">
                <Move size={12} />
                <span>Move</span>
             </div>
            <button onClick={duplicateSelection} className="p-2 hover:bg-white/10 text-indigo-200 hover:text-white rounded-lg transition-colors" title="Copy / Duplicate (Ctrl+C)">
              <Copy size={18} />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={cutSelection} className="p-2 hover:bg-white/10 text-indigo-200 hover:text-white rounded-lg transition-colors" title="Cut (Ctrl+X)">
              <Scissors size={18} />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)} 
              className={`p-2 rounded-lg transition-colors ${showColorPicker ? 'bg-indigo-600 text-white' : 'hover:bg-white/10 text-gray-300 hover:text-white'}`} 
              title="Change Color"
            >
              <Palette size={18} />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={deleteSelection} className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-200 rounded-lg transition-colors" title="Delete (Del)">
              <Trash2 size={18} />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={commitSelection} className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors" title="Done">
              <X size={18} />
            </button>
          </div>

          {/* Color Picker Sub-Menu */}
          {showColorPicker && (
            <div className="bg-[#121212]/95 p-2 rounded-xl shadow-2xl border border-white/10 flex gap-2 animate-in slide-in-from-top-2">
              {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'].map(color => (
                <button
                  key={color}
                  onClick={() => changeSelectionColor(color)}
                  className="w-6 h-6 rounded-full border border-white/20 hover:scale-125 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};