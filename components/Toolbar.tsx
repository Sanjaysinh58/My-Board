import React, { useState, useEffect } from 'react';
import { 
  Pencil, 
  Eraser, 
  MousePointer2, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  Trash2,
  Grid,
  Highlighter,
  Zap,
  PenLine,
  Shapes,
  Square,
  Circle,
  Minus,
  BoxSelect,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  Type,
  Timer as TimerIcon,
  Download,
  Target,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Menu,
  MoreHorizontal,
  X
} from 'lucide-react';
import { ToolType, PenStyle, PenEffect, ShapeType } from '../types';

interface ToolbarProps {
  currentSlideIndex: number;
  totalSlides: number;
  activeTool: ToolType;
  activeShape: ShapeType;
  penStyle: PenStyle;
  onToolChange: (tool: ToolType) => void;
  onShapeChange: (shape: ShapeType) => void;
  onColorChange: (color: string) => void;
  onEffectChange: (effect: PenEffect) => void;
  onSizeChange: (size: number) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSlide: () => void;
  toggleGrid: () => void;
  onSlideIndicatorClick: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  toggleTimer: () => void;
  onDownload: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentSlideIndex,
  totalSlides,
  activeTool,
  activeShape,
  penStyle,
  onToolChange,
  onShapeChange,
  onColorChange,
  onEffectChange,
  onSizeChange,
  onPrevSlide,
  onNextSlide,
  onUpload,
  onClearSlide,
  toggleGrid,
  onSlideIndicatorClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  toggleTimer,
  onDownload,
  isFullscreen,
  toggleFullscreen
}) => {
  const [minNav, setMinNav] = useState(false);
  const [minTools, setMinTools] = useState(false);
  const [minActions, setMinActions] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

  // Determine if settings are applicable for the current tool
  const hasSettings = activeTool === ToolType.PEN || activeTool === ToolType.SHAPE || activeTool === ToolType.TEXT;
  
  // Show settings if the dock is not minimized, the tool supports it, and the toggle is open
  const showSettings = !minTools && hasSettings && isSettingsOpen;

  const handleToolClick = (tool: ToolType) => {
    if (activeTool === tool) {
      // Toggle settings if clicking the already active tool (and it has settings)
      if (tool === ToolType.PEN || tool === ToolType.SHAPE || tool === ToolType.TEXT) {
        setIsSettingsOpen(!isSettingsOpen);
      }
    } else {
      // Switch tool and automatically open settings
      onToolChange(tool);
      setIsSettingsOpen(true);
    }
  };

  // Helper for button classes
  const btnClass = (isActive: boolean, colorClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30') => 
    `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
      isActive 
        ? colorClass 
        : 'text-gray-400 hover:text-white hover:bg-white/10'
    }`;

  // Common dock style
  const dockClass = "pointer-events-auto bg-[#0f0f0f]/95 backdrop-blur-2xl border border-white/10 text-white p-2 rounded-2xl shadow-2xl flex items-center gap-1 transition-all duration-300";

  return (
    <>
      {/* 1. NAVIGATION DOCK (Bottom Left) */}
      <div className={`fixed bottom-6 left-4 md:left-6 z-50 ${dockClass}`}>
        {/* Anchor Button */}
        <button 
          onClick={() => setMinNav(!minNav)}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${!minNav ? 'bg-white/10 text-white' : 'text-indigo-400 hover:text-white hover:bg-white/10'}`}
          title={minNav ? "Expand Navigation" : "Minimize Navigation"}
        >
          <LayoutGrid size={20} />
        </button>

        {/* Collapsible Content */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${!minNav ? 'max-w-[300px] opacity-100 ml-1' : 'max-w-0 opacity-0'}`}>
          <div className="flex items-center gap-1 min-w-max">
            <button onClick={onPrevSlide} disabled={currentSlideIndex === 0} className={btnClass(false, '')} title="Previous">
              <ChevronLeft size={20} />
            </button>
            
            <button 
              onClick={onSlideIndicatorClick}
              className="h-10 px-3 flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-medium min-w-[80px] justify-center border border-transparent hover:border-white/10"
              title="Slide Navigator"
            >
              <LayoutGrid size={16} className="text-indigo-400" />
              <span className="font-mono">{currentSlideIndex + 1}/{totalSlides}</span>
            </button>

            <button onClick={onNextSlide} disabled={currentSlideIndex === totalSlides - 1} className={btnClass(false, '')} title="Next">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOOLS DOCK (Bottom Center) */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
        {/* Settings Popup Menu (Floating Island) */}
        <div 
          className={`pointer-events-auto bg-[#121212]/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl flex flex-col gap-3 
            absolute bottom-full mb-3 min-w-[300px] origin-bottom transition-all duration-300 ease-out
            ${showSettings ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-8 pointer-events-none'}
          `}
        >
          {/* Header with Close Button */}
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {activeTool === ToolType.PEN ? 'Pen Settings' : 
               activeTool === ToolType.SHAPE ? 'Shape Settings' : 
               activeTool === ToolType.TEXT ? 'Text Settings' : 'Settings'}
            </span>
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Sub-tools Row */}
          <div className="flex justify-center w-full gap-2">
            {activeTool === ToolType.SHAPE && (
              <div className="flex bg-white/5 p-1 rounded-lg w-full gap-1">
                {[
                  { id: 'rectangle', icon: Square, label: 'Rectangle' },
                  { id: 'circle', icon: Circle, label: 'Circle' },
                  { id: 'line', icon: Minus, label: 'Line' }
                ].map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => onShapeChange(shape.id as ShapeType)}
                    className={`flex-1 py-2 rounded-md transition-all flex justify-center ${activeShape === shape.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    title={shape.label}
                  >
                    <shape.icon size={18} />
                  </button>
                ))}
              </div>
            )}

            {activeTool === ToolType.PEN && (
              <div className="flex bg-white/5 p-1 rounded-lg w-full gap-1">
                {[
                  { id: 'normal', icon: PenLine, label: 'Standard', activeClass: 'bg-indigo-600 text-white' },
                  { id: 'neon', icon: Zap, label: 'Neon', activeClass: 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' },
                  { id: 'highlighter', icon: Highlighter, label: 'Highlighter', activeClass: 'bg-yellow-500/80 text-white' }
                ].map((effect) => (
                  <button 
                    key={effect.id}
                    onClick={() => onEffectChange(effect.id as PenEffect)}
                    className={`flex-1 py-2 rounded-md transition-all flex justify-center ${penStyle.effect === effect.id ? effect.activeClass : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    title={effect.label}
                  >
                    <effect.icon size={18} />
                  </button>
                ))}
              </div>
            )}

            {activeTool === ToolType.TEXT && (
              <div className="w-full text-center py-1.5 px-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs font-medium">
                Tap anywhere on screen to type
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 w-full" />

          {/* Colors & Size Row */}
          <div className="flex flex-col gap-3">
            {/* Colors */}
            <div className="flex justify-between items-center px-1">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => onColorChange(color)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 relative ${penStyle.color === color ? 'ring-2 ring-offset-2 ring-offset-[#121212] ring-white scale-110' : ''}`}
                  style={{ backgroundColor: color, border: color === '#000000' ? '1px solid #333' : 'none' }}
                  title={color}
                />
              ))}
            </div>
            
            {/* Size Slider */}
            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              <input 
                type="range" 
                min="1" 
                max={activeTool === ToolType.TEXT ? 60 : 30} 
                value={penStyle.size} 
                onChange={(e) => onSizeChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
              />
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
              <span className="text-xs text-gray-400 font-mono w-6 text-right">{penStyle.size}</span>
            </div>
          </div>
        </div>

        <div className={`${dockClass}`}>
          {!minTools ? (
            <>
              <button onClick={() => handleToolClick(ToolType.POINTER)} className={btnClass(activeTool === ToolType.POINTER)} title="Cursor">
                <MousePointer2 size={20} />
              </button>
              <button onClick={() => handleToolClick(ToolType.LASER)} className={btnClass(activeTool === ToolType.LASER, 'bg-red-600 text-white shadow-lg shadow-red-500/30')} title="Laser">
                <Target size={20} />
              </button>
              <button onClick={() => handleToolClick(ToolType.SELECT)} className={btnClass(activeTool === ToolType.SELECT)} title="Select Area">
                <BoxSelect size={20} />
              </button>
              <button onClick={() => handleToolClick(ToolType.TEXT)} className={btnClass(activeTool === ToolType.TEXT)} title="Text">
                <Type size={20} />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              
              {/* Pen Button: Toggles Settings */}
              <button onClick={() => handleToolClick(ToolType.PEN)} className={btnClass(activeTool === ToolType.PEN)} title="Pen (Click to Toggle Settings)">
                <Pencil size={20} />
              </button>
              
              {/* Shape Button: Toggles Settings */}
              <button onClick={() => handleToolClick(ToolType.SHAPE)} className={btnClass(activeTool === ToolType.SHAPE)} title="Shapes (Click to Toggle Settings)">
                <Shapes size={20} />
              </button>
              
              <button onClick={() => handleToolClick(ToolType.ERASER)} className={btnClass(activeTool === ToolType.ERASER, 'bg-white/20 text-white')} title="Eraser">
                <Eraser size={20} />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              <button onClick={onUndo} disabled={!canUndo} className={btnClass(false) + ' disabled:opacity-30'} title="Undo">
                <Undo2 size={20} />
              </button>
              <button onClick={onRedo} disabled={!canRedo} className={btnClass(false) + ' disabled:opacity-30'} title="Redo">
                <Redo2 size={20} />
              </button>
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              <button 
                onClick={() => setMinTools(true)}
                className="w-6 h-10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </>
          ) : (
             <button 
              onClick={() => setMinTools(false)}
              className="w-10 h-10 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Expand Tools"
            >
              {activeTool === ToolType.PEN ? <Pencil size={20} /> :
               activeTool === ToolType.ERASER ? <Eraser size={20} /> :
               activeTool === ToolType.SHAPE ? <Shapes size={20} /> :
               activeTool === ToolType.TEXT ? <Type size={20} /> :
               activeTool === ToolType.SELECT ? <BoxSelect size={20} /> :
               activeTool === ToolType.LASER ? <Target size={20} /> :
               <MousePointer2 size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* 3. ACTIONS DOCK (Bottom Right) */}
      <div className={`fixed bottom-6 right-4 md:right-6 z-50 ${dockClass}`}>
        {!minActions ? (
          <>
            <label className={btnClass(false) + ' cursor-pointer'} title="Import File">
              <Upload size={20} />
              <input type="file" multiple accept="image/*,.pdf,.ppt,.pptx" onChange={onUpload} className="hidden" />
            </label>

            <button onClick={onDownload} className={btnClass(false)} title="Save Slide">
              <Download size={20} />
            </button>
            
            <button onClick={onClearSlide} className="w-10 h-10 flex items-center justify-center rounded-xl text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all active:scale-95" title="Clear Slide">
              <Trash2 size={20} />
            </button>
             <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button onClick={toggleGrid} className={btnClass(false)} title="Grid">
              <Grid size={20} />
            </button>

            <button onClick={toggleTimer} className={btnClass(false)} title="Timer">
              <TimerIcon size={20} />
            </button>
            
            <button onClick={toggleFullscreen} className={btnClass(isFullscreen, 'bg-white/10 text-white')} title="Fullscreen">
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <div className="w-px h-6 bg-white/10 mx-1"></div>
            
            <button 
              onClick={() => setMinActions(true)}
              className="w-6 h-10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
           <button 
              onClick={() => setMinActions(false)}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Expand Actions"
            >
              <Menu size={20} />
            </button>
        )}
      </div>

    </>
  );
};