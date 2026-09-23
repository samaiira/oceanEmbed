import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  MapPin,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import indianOceanBathymetryUrl from '@/assets/indian_ocean_bathymetry.jpg';

export interface PinnedPoint {
  lat: number;
  lon: number;
  sst: number;
  region: string;
  depths?: number[];
}

export interface CastPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sst: number;
  rmse?: number;
  isActive?: boolean;
}

interface RealisticOceanMapProps {
  compact?: boolean;
  selectedLayer?: string;
  onSelect?: (name: string) => void;
  onDropPin?: (point: PinnedPoint) => void;
  onLaunchReconstruction?: (lat: number, lon: number, sst: number) => void;
}

// -----------------------------------------------------------------
// Geographic Calibration Polynomial Mapping for 1024 x 735 Bathymetry
// -----------------------------------------------------------------
function geoToImage(lon: number, lat: number): { x: number; y: number } {
  const x =
    -421.793096 +
    15.535836 * lon -
    0.528971 * lat -
    0.002856 * lon * lat -
    0.048492 * lon * lon -
    0.032343 * lat * lat;

  const y =
    104.044918 +
    6.204102 * lon -
    6.46902 * lat -
    0.029012 * lon * lat -
    0.047079 * lon * lon -
    0.013825 * lat * lat;

  return {
    x: Math.max(0, Math.min(1024, x)),
    y: Math.max(0, Math.min(735, y)),
  };
}

function imageToGeo(imgX: number, imgY: number): { lat: number; lon: number } {
  const lon =
    42.54139251 +
    0.04999321 * imgX -
    0.0536044 * imgY +
    0.00002676 * imgX * imgY +
    0.00007269 * imgX * imgX +
    0.00006535 * imgY * imgY;

  const lat =
    27.57291181 +
    0.04530258 * imgX -
    0.10841908 * imgY +
    0.00003239 * imgX * imgY -
    0.0000768 * imgX * imgX -
    0.0000424 * imgY * imgY;

  return {
    lat: Number(Math.max(-45.0, Math.min(32.0, lat)).toFixed(2)),
    lon: Number(Math.max(35.0, Math.min(125.0, lon)).toFixed(2)),
  };
}

// Sea Surface Temperature (°C) Estimation for Hover Readout
function estimateSST(lat: number, lon: number): number {
  let temp = 29.2 - (Math.abs(lat) / 30.0) * 4.2;

  // Upwelling cooling off Somalia / Oman
  if (lon < 62.0 && lat >= 10.0 && lat <= 22.0) {
    const upwelling = Math.max(0, 1.0 - Math.hypot(lon - 55.0, lat - 18.0) / 7.0);
    temp -= upwelling * 3.4;
  }

  // Northern Arabian Sea cooling
  if (lat > 20.0 && lon < 74.0) {
    temp -= ((lat - 20.0) / 10.0) * 2.5;
  }

  // Lakshadweep / Southeast Arabian Sea warm pool
  if (lon >= 68.0 && lon <= 76.0 && lat >= 6.0 && lat <= 14.0) {
    temp += 0.8;
  }

  // Bay of Bengal warm pool
  if (lon >= 83.0 && lon <= 96.0 && lat >= 8.0 && lat <= 20.0) {
    temp += 0.7;
  }

  return Number(Math.max(21.0, Math.min(31.5, temp)).toFixed(1));
}

// Bathymetric Depth Estimation (Meters)
function estimateDepth(lat: number, lon: number): { depth: number; feature: string } {
  // Shallow shelf
  if (
    (lon > 68 && lon < 73 && lat > 20 && lat < 24) ||
    (lon > 78 && lon < 82 && lat > 8 && lat < 11) ||
    (lon > 88 && lon < 92 && lat > 20.5)
  ) {
    return { depth: -85, feature: 'Continental Shelf' };
  }

  // Chagos-Laccadive Ridge
  if (lon >= 71.5 && lon <= 74.5 && lat >= 0 && lat <= 14) {
    return { depth: -1250, feature: 'Chagos-Laccadive Ridge' };
  }

  // Carlsberg Ridge
  const carlsbergDist = Math.abs((lat - 5.0) - (lon - 65.0) * -0.5);
  if (carlsbergDist < 2.0 && lon >= 55.0 && lon <= 70.0) {
    return { depth: -2100, feature: 'Carlsberg Mid-Ocean Ridge' };
  }

  // Ninety East Ridge
  if (Math.abs(lon - 90.0) < 1.5 && lat >= -25.0 && lat <= 17.0) {
    return { depth: -1850, feature: 'Ninety East Ridge' };
  }

  // Sunda Trench
  if (lon >= 94.0 && lon <= 104.0 && lat >= -8.0 && lat <= 8.0) {
    return { depth: -6200, feature: 'Sunda Trench (Java Deep)' };
  }

  // Central Basins
  if (lon < 75) {
    return { depth: -4100, feature: 'Arabian Abyssal Plain' };
  }
  return { depth: -3900, feature: 'Central Indian Basin' };
}

function resolveRegion(lat: number, lon: number): string {
  if (lon < 60.0) {
    if (lat > 22.0) return 'Gulf of Oman / Strait of Hormuz';
    if (lat > 12.0) return 'Western Arabian Sea (Oman / Yemen Shelf)';
    if (lat > 0) return 'Gulf of Aden / Somali Upwelling Basin';
    return 'Western Indian Ocean / Madagascar Basin';
  } else if (lon < 77.5) {
    if (lat > 21.0) return 'Northern Arabian Sea (Gujarat Basin)';
    if (lat > 12.0) return 'Central Arabian Sea Basin';
    if (lat > 0) return 'South Arabian Sea / Lakshadweep Sea';
    return 'South Central Indian Ocean Basin';
  } else if (lon < 92.0) {
    if (lat > 20.0) return 'Northern Bay of Bengal (Ganges Delta)';
    if (lat > 12.0) return 'Central Bay of Bengal';
    if (lat > 0) return 'South Bay of Bengal / Sri Lanka Basin';
    return 'Ninety East Ridge Basin';
  } else {
    if (lat > 13.0) return 'Andaman Sea Basin';
    if (lat > 0) return 'Malacca Strait / Nicobar Basin';
    return 'Wharton Basin / West Australia Coast';
  }
}

export function RealisticOceanMap({
  compact = false,
  onSelect,
  onDropPin,
  onLaunchReconstruction,
}: RealisticOceanMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Bathymetric map image
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Viewport State: Center in Image Space (1024 x 735) and Zoom scale
  // Default centers on the North Indian Ocean / India (x: 480, y: 240)
  const [viewState, setViewState] = useState({
    viewImgX: 485,
    viewImgY: 255,
    zoom: 1.0,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // User Interaction State
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; viewImgX: number; viewImgY: number } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
    sst: number;
    depth: number;
    feature: string;
    region: string;
  } | null>(null);

  const [pinnedPoint, setPinnedPoint] = useState<PinnedPoint | null>(null);
  const [activeFloatHover, setActiveFloatHover] = useState<CastPoint | null>(null);

  // Active Argo Floats & Oceanographic Stations in North Indian Ocean
  const activeFloats: CastPoint[] = useMemo(
    () => [
      {
        id: 'cast-as-1',
        name: 'Arabian Sea Cast',
        lat: 16.5,
        lon: 67.2,
        sst: 26.8,
        rmse: 0.512,
        isActive: true,
      },
      {
        id: 'cast-bob-1',
        name: 'Bay of Bengal Cast',
        lat: 14.8,
        lon: 88.5,
        sst: 28.9,
        rmse: 0.548,
        isActive: false,
      },
      {
        id: 'cast-som-1',
        name: 'Somali Upwelling Buoy',
        lat: 11.2,
        lon: 53.4,
        sst: 24.2,
        rmse: 0.589,
        isActive: false,
      },
      {
        id: 'cast-and-1',
        name: 'Andaman Basin Float',
        lat: 12.6,
        lon: 93.8,
        sst: 29.4,
        rmse: 0.526,
        isActive: false,
      },
    ],
    []
  );

  // Load bathymetric satellite image
  useEffect(() => {
    const img = new Image();
    img.src = indianOceanBathymetryUrl;
    img.onload = () => {
      mapImageRef.current = img;
      setImageLoaded(true);
    };
  }, []);

  // Screen <-> Image Space Transformations
  const getScale = useCallback(
    (width: number) => {
      // Base scale: 1 image pixel ≈ (width / 880) * zoom
      return (width / 880) * viewState.zoom;
    },
    [viewState.zoom]
  );

  const imageToScreen = useCallback(
    (imgX: number, imgY: number, width: number, height: number) => {
      const s = getScale(width);
      const px = width / 2 + (imgX - viewState.viewImgX) * s;
      const py = height / 2 + (imgY - viewState.viewImgY) * s;
      return { px, py };
    },
    [viewState.viewImgX, viewState.viewImgY, getScale]
  );

  const screenToImage = useCallback(
    (px: number, py: number, width: number, height: number) => {
      const s = getScale(width);
      const imgX = viewState.viewImgX + (px - width / 2) / s;
      const imgY = viewState.viewImgY + (py - height / 2) / s;
      return {
        imgX: Math.max(0, Math.min(1024, imgX)),
        imgY: Math.max(0, Math.min(735, imgY)),
      };
    },
    [viewState.viewImgX, viewState.viewImgY, getScale]
  );

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth || 900;
      const height = container.clientHeight || 550;

      // Maintain high DPI buffer
      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Photorealistic Bathymetric Satellite Map
      if (mapImageRef.current && imageLoaded) {
        const img = mapImageRef.current;
        const s = getScale(width);

        const destX = width / 2 - viewState.viewImgX * s;
        const destY = height / 2 - viewState.viewImgY * s;
        const destW = 1024 * s;
        const destH = 735 * s;

        ctx.drawImage(img, destX, destY, destW, destH);
      } else {
        ctx.fillStyle = '#06172e';
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Active Argo Floats & Oceanographic Stations
      activeFloats.forEach((f) => {
        const imgCoord = geoToImage(f.lon, f.lat);
        const pos = imageToScreen(imgCoord.x, imgCoord.y, width, height);
        const isHovered = activeFloatHover?.id === f.id;
        const now = Date.now() / 1000;

        ctx.save();
        // Pulsing sonar beacon
        const pulseRadius = 8 + ((now * 16) % 20);
        const pulseAlpha = Math.max(0, 1.0 - pulseRadius / 28);
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 155, 33, ${pulseAlpha * 0.9})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Outer beacon shell
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, isHovered ? 8 : 6.5, 0, Math.PI * 2);
        ctx.fillStyle = f.isActive ? '#D99B21' : '#FAF7BB';
        ctx.strokeStyle = '#133458';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Core dot
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = f.isActive ? '#133458' : '#838921';
        ctx.fill();

        // Glassmorphic Name Label
        ctx.font = 'bold 11px "Space Mono", monospace';
        const text = f.name;
        const metrics = ctx.measureText(text);

        ctx.fillStyle = 'rgba(19, 52, 88, 0.88)';
        ctx.fillRect(pos.px + 11, pos.py - 11, metrics.width + 12, 19);
        ctx.strokeStyle = 'rgba(217, 155, 33, 0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.px + 11, pos.py - 11, metrics.width + 12, 19);

        ctx.fillStyle = '#FAF7BB';
        ctx.fillText(text, pos.px + 17, pos.py + 3);

        ctx.restore();
      });

      // 3. Draw Selected / Pinned Target Reticle
      if (pinnedPoint) {
        const imgCoord = geoToImage(pinnedPoint.lon, pinnedPoint.lat);
        const pinPos = imageToScreen(imgCoord.x, imgCoord.y, width, height);
        const now = Date.now() / 1000;

        ctx.save();
        ctx.translate(pinPos.px, pinPos.py);
        ctx.rotate(now * 0.6);

        // Concentric rotating ring
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulse wave
        const outerPulse = 20 + ((now * 20) % 20);
        ctx.beginPath();
        ctx.arc(0, 0, outerPulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 155, 33, ${Math.max(0, 1.0 - outerPulse / 40)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.rotate(-now * 0.6);

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#D99B21';
        ctx.fill();

        ctx.restore();
      }

      // 4. Hover Crosshair & Coordinate Indicator
      if (hoverInfo) {
        ctx.save();
        ctx.strokeStyle = 'rgba(217, 155, 33, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(0, hoverInfo.y);
        ctx.lineTo(width, hoverInfo.y);
        ctx.moveTo(hoverInfo.x, 0);
        ctx.lineTo(hoverInfo.x, height);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(hoverInfo.x, hoverInfo.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#D99B21';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore(); // Restore outer DPI transform
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    viewState,
    imageLoaded,
    pinnedPoint,
    hoverInfo,
    activeFloatHover,
    activeFloats,
    getScale,
    imageToScreen,
  ]);

  // Window Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [compact, isFullscreen]);

  // Mouse Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      viewImgX: viewState.viewImgX,
      viewImgY: viewState.viewImgY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Pan when dragging
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const s = getScale(rect.width);

      const nextX = dragStartRef.current.viewImgX - dx / s;
      const nextY = dragStartRef.current.viewImgY - dy / s;

      setViewState((prev) => ({
        ...prev,
        viewImgX: Math.max(50, Math.min(974, nextX)),
        viewImgY: Math.max(50, Math.min(685, nextY)),
      }));
      return;
    }

    // Compute geographic coordinate at cursor
    const { imgX, imgY } = screenToImage(mouseX, mouseY, rect.width, rect.height);
    const { lat, lon } = imageToGeo(imgX, imgY);
    const sst = estimateSST(lat, lon);
    const { depth, feature } = estimateDepth(lat, lon);
    const region = resolveRegion(lat, lon);

    setHoverInfo({
      x: mouseX,
      y: mouseY,
      lat,
      lon,
      sst,
      depth,
      feature,
      region,
    });

    // Check hover over Argo Floats
    const floatHit = activeFloats.find((f) => {
      const c = geoToImage(f.lon, f.lat);
      const p = imageToScreen(c.x, c.y, rect.width, rect.height);
      return Math.hypot(p.px - mouseX, p.py - mouseY) < 18;
    });
    setActiveFloatHover(floatHit || null);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  // Wheel Zoom Handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Image coordinates before zoom
    const before = screenToImage(mouseX, mouseY, rect.width, rect.height);

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(0.65, Math.min(5.0, viewState.zoom * zoomFactor));

    setViewState((prev) => {
      const nextScale = (rect.width / 880) * nextZoom;
      const nextViewX = before.imgX - (mouseX - rect.width / 2) / nextScale;
      const nextViewY = before.imgY - (mouseY - rect.height / 2) / nextScale;

      return {
        zoom: nextZoom,
        viewImgX: Math.max(50, Math.min(974, nextViewX)),
        viewImgY: Math.max(50, Math.min(685, nextViewY)),
      };
    });
  };

  // Click Handler (Drop Target Pin or Select Float)
  const handleClick = () => {
    if (activeFloatHover) {
      onSelect?.(activeFloatHover.name);
      return;
    }

    if (hoverInfo) {
      const point: PinnedPoint = {
        lat: hoverInfo.lat,
        lon: hoverInfo.lon,
        sst: hoverInfo.sst,
        region: hoverInfo.region,
        depths: [0, 10, 20, 50, 100, 200, 500, 1000, 2000],
      };
      setPinnedPoint(point);
      onDropPin?.(point);
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setViewState((prev) => ({ ...prev, zoom: Math.min(5.0, prev.zoom * 1.3) }));
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({ ...prev, zoom: Math.max(0.65, prev.zoom / 1.3) }));
  };

  const handleReset = () => {
    setViewState({
      viewImgX: 485,
      viewImgY: 255,
      zoom: 1.0,
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoverInfo(null);
      }}
      onWheel={handleWheel}
      onClick={handleClick}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/80 bg-[#06172e] shadow-2xl select-none transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]'
          : compact
          ? 'h-[360px] sm:h-[440px]'
          : 'h-[540px] sm:h-[640px] lg:h-[720px]'
      }`}
      style={{ cursor: isDraggingRef.current ? 'grabbing' : 'crosshair' }}
    >
      {/* 1. Hardware Accelerated Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />

      {/* 2. Apple Liquid Glass Header Toolbar */}
      <div className="absolute left-4 top-4 right-4 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none z-10">
        <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-2xl px-3.5 py-1.5 shadow-lg text-[#133458] pointer-events-auto">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D99B21] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D99B21]" />
          </span>
          <span className="font-data text-[11px] font-bold uppercase tracking-wider text-[#133458]">
            Indian Ocean Bathymetric Map
          </span>
          <span className="font-data text-[10px] text-[#536675] hidden md:inline">
            · Seafloor Relief & Subsurface Exploration
          </span>
        </div>

        {/* Clean Controls (Fullscreen only, Ridges/SST/Currents permanently removed) */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-2xl p-1 shadow-lg text-xs font-semibold text-[#133458] pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#133458] hover:bg-white/80 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="text-xs font-semibold">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* 3. Navigation Controls (Zoom & Reset) */}
      <div className="absolute right-4 top-20 flex flex-col gap-1.5 pointer-events-auto z-10">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/75 backdrop-blur-xl text-[#133458] shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
          title="Zoom In (or scroll up)"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/75 backdrop-blur-xl text-[#133458] shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
          title="Zoom Out (or scroll down)"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/75 backdrop-blur-xl text-[#133458] shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all"
          title="Reset View Extent"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* 4. Live HUD Telemetry Readout (Bottom Left) */}
      {hoverInfo && (
        <div className="absolute left-4 bottom-4 rounded-2xl border border-white/70 bg-white/80 backdrop-blur-2xl px-4 py-3 shadow-xl pointer-events-none z-10 animate-in fade-in duration-100 max-w-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="font-data text-sm font-bold text-[#133458]">
              {hoverInfo.lat}°N, {hoverInfo.lon}°E
            </span>
            <span className="rounded-full bg-[#D99B21]/20 border border-[#D99B21]/40 px-2 py-0.5 font-data text-[10px] font-bold text-[#133458]">
              {hoverInfo.sst}°C
            </span>
          </div>
          <div className="text-[11px] font-semibold text-[#838921] truncate mt-0.5">
            {hoverInfo.region}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-[#133458]/10 flex items-center justify-between text-[10px] font-data text-[#536675]">
            <span>Depth: <strong className="text-[#133458]">{hoverInfo.depth}m</strong> ({hoverInfo.feature})</span>
            <span className="text-[#D99B21] font-semibold">Click to Pin</span>
          </div>
        </div>
      )}

      {/* 5. Selected Target Pin Popover with "Reconstruct Here" Action */}
      {pinnedPoint && (
        <div className="absolute right-4 bottom-24 w-80 rounded-2xl border border-white/80 bg-white/85 backdrop-blur-2xl p-4 text-[#133458] shadow-[0_20px_50px_rgba(19,52,88,0.3)] animate-in slide-in-from-bottom-2 duration-200 pointer-events-auto z-20">
          <div className="flex items-center justify-between border-b border-[#133458]/10 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#133458]">
              <MapPin size={14} className="text-[#D99B21]" />
              <span>Target Coordinates Locked</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPinnedPoint(null);
              }}
              className="rounded-full p-1 text-[#536675] hover:text-[#133458] hover:bg-white/60 transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          <div className="mt-2.5 font-data text-lg font-bold text-[#133458]">
            {pinnedPoint.lat}°N, {pinnedPoint.lon}°E
          </div>
          <div className="text-xs text-[#838921] font-medium mt-0.5">
            {pinnedPoint.region}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-data">
            <div className="rounded-xl border border-white/80 bg-white/60 p-2">
              <span className="text-[#536675] block text-[9px] uppercase">Est. SST</span>
              <strong className="text-sm text-[#133458]">{pinnedPoint.sst}°C</strong>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/60 p-2">
              <span className="text-[#536675] block text-[9px] uppercase">Domain</span>
              <strong className="text-sm text-[#838921]">North Indian</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLaunchReconstruction?.(pinnedPoint.lat, pinnedPoint.lon, pinnedPoint.sst);
            }}
            className="mt-3.5 w-full rounded-xl flex items-center justify-center gap-2 bg-[#133458] py-2.5 px-4 text-xs font-bold text-[#FAF7BB] hover:bg-[#1f4874] transition-all shadow-md shadow-[#133458]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            <Sparkles size={14} className="text-[#D99B21]" />
            <span>Run Reconstruction Here</span>
          </button>
        </div>
      )}

      {/* 6. Hover Popover for Argo Floats */}
      {activeFloatHover && !pinnedPoint && (
        <div className="absolute right-4 bottom-24 w-72 rounded-2xl border border-white/80 bg-white/85 backdrop-blur-2xl p-4 text-[#133458] shadow-xl pointer-events-auto z-20">
          <div className="flex items-center gap-2 text-xs font-bold text-[#133458]">
            <span className="h-2 w-2 rounded-full bg-[#D99B21] animate-ping" />
            <span>Argo Float Station</span>
          </div>
          <div className="mt-1 font-display text-lg font-bold text-[#133458]">
            {activeFloatHover.name}
          </div>
          <div className="font-data text-xs text-[#536675]">
            {activeFloatHover.lat}°N, {activeFloatHover.lon}°E
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#133458]/10 pt-2 text-xs font-data">
            <span>Surface SST: <strong className="text-[#D99B21]">{activeFloatHover.sst}°C</strong></span>
            {activeFloatHover.rmse && (
              <span>RMSE: <strong className="text-[#838921]">{activeFloatHover.rmse}°C</strong></span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect?.(activeFloatHover.name)}
            className="mt-3 w-full rounded-xl bg-[#838921] py-1.5 text-xs font-bold text-[#FAF7BB] hover:bg-[#6c711a] transition-all shadow-sm"
          >
            Inspect Cast Profile
          </button>
        </div>
      )}
    </div>
  );
}
