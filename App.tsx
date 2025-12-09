import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Slide, DrawingData, ToolType, PenStyle, ShapeType } from './types';
import { CanvasLayer } from './components/CanvasLayer';
import { Toolbar } from './components/Toolbar';
import { SlideNavigator } from './components/SlideNavigator';
import { Timer } from './components/Timer';
import { AlertCircle } from 'lucide-react';

// Set worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs';

// Default Demo Slides
const DEMO_SLIDES: Slide[] = [
  { id: '1', imageUrl: 'https://picsum.photos/id/1/1920/1080', title: 'Introduction' },
  { id: '2', imageUrl: 'https://picsum.photos/id/20/1920/1080', title: 'Data Structures' },
  { id: '3', imageUrl: 'https://picsum.photos/id/180/1920/1080', title: 'Algorithms' },
];

// Transparent 1x1 pixel for blank slides
const BLANK_SLIDE_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface HistoryState {
  past: string[];
  future: string[];
}

const App: React.FC = () => {
  // State
  const [slides, setSlides] = useState<Slide[]>(DEMO_SLIDES);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.POINTER);
  const [activeShape, setActiveShape] = useState<ShapeType>('rectangle');
  const [penStyle, setPenStyle] = useState<PenStyle>({ color: '#ef4444', size: 4, effect: 'normal' });
  const [drawings, setDrawings] = useState<DrawingData[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // History State: Record<SlideID, HistoryState>
  const [history, setHistory] = useState<Record<string, HistoryState>>({});

  // Sidebar State
  const [isSlideNavOpen, setIsSlideNavOpen] = useState(false);

  // Gesture State
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const touchEndRef = useRef<{x: number, y: number} | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Resize Observer to handle responsive canvas
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setContainerSize({ width: clientWidth, height: clientHeight });
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync fullscreen state with browser events (e.g. user pressing ESC)
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        // Fallback to just state change if API fails
        setIsFullScreen(true);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleSlideSelect = (index: number) => {
    setCurrentSlideIndex(index);
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      imageUrl: BLANK_SLIDE_IMAGE,
      title: `Slide ${slides.length + 1}`
    };
    setSlides(prev => [...prev, newSlide]);
    // Automatically jump to the new slide
    setCurrentSlideIndex(slides.length);
  };

  const handleDeleteSlide = (id: string) => {
    if (slides.length <= 1) {
      setNotification({
        title: "Cannot Delete",
        message: "You must keep at least one slide in the deck."
      });
      return;
    }

    const indexToDelete = slides.findIndex(s => s.id === id);
    if (indexToDelete === -1) return;

    // Filter out the slide
    const newSlides = slides.filter(s => s.id !== id);
    setSlides(newSlides);

    // Adjust current index if necessary
    if (indexToDelete === currentSlideIndex) {
      // If we deleted the current slide, go to the previous one (or stay at 0)
      setCurrentSlideIndex(Math.max(0, indexToDelete - 1));
    } else if (indexToDelete < currentSlideIndex) {
      // If we deleted a slide before the current one, decrement index
      setCurrentSlideIndex(currentSlideIndex - 1);
    }

    // Cleanup drawings and history for this slide to free memory
    setDrawings(prev => prev.filter(d => d.slideId !== id));
    setHistory(prev => {
      const newHistory = { ...prev };
      delete newHistory[id];
      return newHistory;
    });
  };

  // Helper to update thumbnail based on current ink
  const updateSlideThumbnail = (slideId: string, dataUrl: string | null) => {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;

    if (!dataUrl) {
      // Revert to original if no drawing
      setSlides(prev => prev.map((s) => 
        s.id === slideId ? { ...s, thumbnailUrl: undefined } : s
      ));
      return;
    }

    const bgImg = new Image();
    bgImg.crossOrigin = "Anonymous";
    bgImg.src = slide.imageUrl;
    
    bgImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640; 
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      const inkImg = new Image();
      inkImg.src = dataUrl;
      inkImg.onload = () => {
        ctx.drawImage(inkImg, 0, 0, canvas.width, canvas.height);
        try {
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
          setSlides(prev => prev.map((s) => 
            s.id === slideId ? { ...s, thumbnailUrl: thumbUrl } : s
          ));
        } catch (e) {
          console.warn('CORS thumbnail error', e);
        }
      };
    };
  };

  const handleSaveDrawing = (newDataUrl: string) => {
    const currentSlideId = slides[currentSlideIndex].id;
    const previousDrawing = drawings.find(d => d.slideId === currentSlideId)?.dataUrl || null;

    // 1. Update History
    setHistory(prev => {
      const slideHistory = prev[currentSlideId] || { past: [], future: [] };
      // Push previous state to past
      // If previousDrawing is null, we store an empty string or null marker to represent blank state
      const newPast = [...slideHistory.past, previousDrawing || ''];
      
      // Limit history size to 20 to save memory
      if (newPast.length > 20) newPast.shift();

      return {
        ...prev,
        [currentSlideId]: {
          past: newPast,
          future: [] // Clear future on new action
        }
      };
    });

    // 2. Save Drawing Data
    setDrawings(prev => {
      const filtered = prev.filter(d => d.slideId !== currentSlideId);
      return [...filtered, { slideId: currentSlideId, dataUrl: newDataUrl }];
    });

    // 3. Update Thumbnail
    updateSlideThumbnail(currentSlideId, newDataUrl);
  };

  const handleUndo = () => {
    const currentSlideId = slides[currentSlideIndex].id;
    const slideHistory = history[currentSlideId];
    
    if (!slideHistory || slideHistory.past.length === 0) return;

    const previousState = slideHistory.past[slideHistory.past.length - 1];
    const currentState = drawings.find(d => d.slideId === currentSlideId)?.dataUrl || '';

    // Update History
    setHistory(prev => ({
      ...prev,
      [currentSlideId]: {
        past: slideHistory.past.slice(0, -1),
        future: [currentState, ...slideHistory.future]
      }
    }));

    // Update Drawing State
    setDrawings(prev => {
      const filtered = prev.filter(d => d.slideId !== currentSlideId);
      // If previousState is empty string, it means clear canvas
      if (!previousState) return filtered;
      return [...filtered, { slideId: currentSlideId, dataUrl: previousState }];
    });

    // Update Thumbnail
    updateSlideThumbnail(currentSlideId, previousState === '' ? null : previousState);
  };

  const handleRedo = () => {
    const currentSlideId = slides[currentSlideIndex].id;
    const slideHistory = history[currentSlideId];
    
    if (!slideHistory || slideHistory.future.length === 0) return;

    const nextState = slideHistory.future[0];
    const currentState = drawings.find(d => d.slideId === currentSlideId)?.dataUrl || '';

    // Update History
    setHistory(prev => ({
      ...prev,
      [currentSlideId]: {
        past: [...slideHistory.past, currentState],
        future: slideHistory.future.slice(1)
      }
    }));

    // Update Drawing State
    setDrawings(prev => {
      const filtered = prev.filter(d => d.slideId !== currentSlideId);
      if (!nextState) return filtered;
      return [...filtered, { slideId: currentSlideId, dataUrl: nextState }];
    });

    // Update Thumbnail
    updateSlideThumbnail(currentSlideId, nextState === '' ? null : nextState);
  };

  const handleClearSlide = () => {
    const currentSlideId = slides[currentSlideIndex].id;
    const currentDrawing = drawings.find(d => d.slideId === currentSlideId)?.dataUrl || '';
    
    if (!currentDrawing) return; // Nothing to clear

    // Push current state to history before clearing
    setHistory(prev => {
      const slideHistory = prev[currentSlideId] || { past: [], future: [] };
      return {
        ...prev,
        [currentSlideId]: {
          past: [...slideHistory.past, currentDrawing],
          future: []
        }
      };
    });

    setDrawings(prev => prev.filter(d => d.slideId !== currentSlideId));
    setSlides(prev => prev.map((s) => 
      s.id === currentSlideId ? { ...s, thumbnailUrl: undefined } : s
    ));
  };

  const handleDownloadSlide = () => {
    const currentSlideId = slides[currentSlideIndex].id;
    const slide = slides[currentSlideIndex];
    const drawingData = drawings.find(d => d.slideId === currentSlideId)?.dataUrl;

    const bgImg = new Image();
    bgImg.crossOrigin = "Anonymous";
    bgImg.src = slide.imageUrl;
    
    bgImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw Background
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      // Draw Ink
      if (drawingData) {
        const inkImg = new Image();
        inkImg.src = drawingData;
        inkImg.onload = () => {
          ctx.drawImage(inkImg, 0, 0, canvas.width, canvas.height);
          triggerDownload(canvas.toDataURL('image/png'));
        };
      } else {
        triggerDownload(canvas.toDataURL('image/png'));
      }
    };
  };

  const triggerDownload = (dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `slide-${currentSlideIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processPdf = async (file: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const newSlides: Slide[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          newSlides.push({
            id: `pdf-${Date.now()}-${i}`,
            imageUrl: canvas.toDataURL('image/jpeg', 0.9),
            title: `Slide ${i}`
          });
        }
      }
      
      setSlides(newSlides);
      setCurrentSlideIndex(0);
      setDrawings([]);
      setHistory({}); // Reset history for new file
    } catch (error) {
      console.error("Error processing PDF", error);
      alert("Failed to load PDF. Please check if the file is valid.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const isPpt = fileName.endsWith('.ppt') || fileName.endsWith('.pptx') || 
                  file.type === 'application/vnd.ms-powerpoint' || 
                  file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    if (isPpt) {
      setNotification({
        title: "PowerPoint Conversion Required",
        message: "To render slides with high fidelity (fonts, layout), please export your PowerPoint presentation as a PDF and upload the PDF file."
      });
      e.target.value = '';
      return;
    }

    if (isPdf) {
      processPdf(file);
    } else {
      const newSlides: Slide[] = (Array.from(files) as File[]).map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        imageUrl: URL.createObjectURL(file),
        title: file.name
      }));
      setSlides(newSlides);
      setCurrentSlideIndex(0);
      setDrawings([]);
      setHistory({});
    }
    e.target.value = '';
  };

  // Touch Handlers for Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    // Only allow swipe navigation if tool is POINTER (to avoid conflict with drawing)
    if (activeTool !== ToolType.POINTER) return;

    const distanceX = touchStartRef.current.x - touchEndRef.current.x;
    const distanceY = touchStartRef.current.y - touchEndRef.current.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    // Threshold of 75px
    if (isHorizontalSwipe && Math.abs(distanceX) > 75) {
      if (distanceX > 0) {
        handleNextSlide();
      } else {
        handlePrevSlide();
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const currentDrawing = drawings.find(d => d.slideId === slides[currentSlideIndex].id)?.dataUrl || null;
  const currentHistory = history[slides[currentSlideIndex].id];

  return (
    <div className="h-screen w-screen bg-[#121212] flex flex-col relative overflow-hidden">
      
      {/* Notification Modal */}
      {notification && (
        <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <AlertCircle className="text-yellow-500" size={24} />
              {notification.title}
            </h3>
            <p className="text-gray-300 mb-6 leading-relaxed">
              {notification.message}
            </p>
            <div className="flex justify-end">
              <button 
                onClick={() => setNotification(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium">Importing Slides...</p>
          <p className="text-gray-400 text-sm mt-2">Converting PDF pages for board usage</p>
        </div>
      )}

      {/* Timer Widget */}
      {isTimerOpen && <Timer onClose={() => setIsTimerOpen(false)} />}

      {/* Main Slide Area */}
      <div 
        className={`flex-1 flex items-center justify-center relative ${isFullScreen ? 'p-0' : 'p-4 md:p-8'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={containerRef}
          className={`relative w-full h-full bg-black overflow-hidden ${
            isFullScreen 
              ? 'rounded-none border-none' 
              : 'max-w-[1920px] max-h-[1080px] shadow-2xl rounded-lg border border-gray-800'
          }`}
        >
          {/* Background Image (Slide) */}
          <div 
            className="absolute inset-0 w-full h-full bg-contain bg-center bg-no-repeat transition-all duration-300"
            style={{ backgroundImage: `url(${slides[currentSlideIndex].imageUrl})` }}
          />
          
          {/* Grid Overlay */}
          {isGridVisible && (
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{ 
                backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }}
            />
          )}

          {/* Canvas Layer */}
          {containerSize.width > 0 && (
            <CanvasLayer 
              width={containerSize.width}
              height={containerSize.height}
              activeTool={activeTool}
              activeShape={activeShape}
              penStyle={penStyle}
              savedDrawing={currentDrawing}
              onSave={handleSaveDrawing}
            />
          )}
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar 
        currentSlideIndex={currentSlideIndex}
        totalSlides={slides.length}
        activeTool={activeTool}
        activeShape={activeShape}
        penStyle={penStyle}
        onToolChange={setActiveTool}
        onShapeChange={setActiveShape}
        onEffectChange={(effect) => setPenStyle(prev => ({ ...prev, effect }))}
        onColorChange={(color) => setPenStyle(prev => ({ ...prev, color }))}
        onSizeChange={(size) => setPenStyle(prev => ({ ...prev, size }))}
        onPrevSlide={handlePrevSlide}
        onNextSlide={handleNextSlide}
        onUpload={handleFileUpload}
        onClearSlide={handleClearSlide}
        toggleGrid={() => setIsGridVisible(!isGridVisible)}
        onSlideIndicatorClick={() => setIsSlideNavOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={!!currentHistory?.past.length}
        canRedo={!!currentHistory?.future.length}
        toggleTimer={() => setIsTimerOpen(prev => !prev)}
        onDownload={handleDownloadSlide}
        isFullscreen={isFullScreen}
        toggleFullscreen={handleToggleFullscreen}
      />

      {/* Slide Navigation Sidebar */}
      <SlideNavigator 
        isOpen={isSlideNavOpen}
        onClose={() => setIsSlideNavOpen(false)}
        slides={slides}
        currentIndex={currentSlideIndex}
        onSelectSlide={handleSlideSelect}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
      />
    </div>
  );
};

export default App;