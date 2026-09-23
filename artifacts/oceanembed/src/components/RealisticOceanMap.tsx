import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Sparkles,
  MapPin,
  Compass,
  X,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
  Navigation,
  Activity,
  Wind,
  Waves,
} from 'lucide-react';
import earthDayUrl from '@/assets/earth_daymap.jpg';
import indianOceanReliefUrl from '@/assets/realistic_north_indian_ocean.webp';

// Geographic Extent of realistic_north_indian_ocean.webp
const RELIEF_BOUNDS = {
  lonMin: 50.35,
  lonMax: 106.79,
  latMin: 0.04,
  latMax: 26.21,
};

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

// -------------------------------------------------------------
// Oceanographic Physical Current Field Simulation (Windy style)
// -------------------------------------------------------------
interface Particle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  history: Array<{ lat: number; lon: number }>;
}

function getOceanCurrentVelocity(lat: number, lon: number): { u: number; v: number; speed: number } {
  // u = eastward velocity, v = northward velocity (m/s)
  let u = 0.0;
  let v = 0.0;

  // 1. Somali Current & Gulf of Aden Jet (Active SW monsoon & coastal boundary)
  if (lon >= 48.0 && lon <= 58.0 && lat >= 4.0 && lat <= 15.0) {
    const alongCoast = Math.sin(((lat - 4.0) / 11.0) * Math.PI);
    u += 0.9 * alongCoast + 0.3;
    v += 1.4 * alongCoast;
  }

  // 2. Arabian Sea Great Whirl / Central Basin Circulation (Anticyclonic eddy)
  if (lon >= 55.0 && lon <= 75.0 && lat >= 10.0 && lat <= 22.0) {
    const cx = 65.0;
    const cy = 16.0;
    const dx = lon - cx;
    const dy = lat - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10.0) {
      // Clockwise rotation
      const factor = (10.0 - dist) / 10.0;
      u += (dy / (dist + 0.5)) * 0.7 * factor;
      v += (-dx / (dist + 0.5)) * 0.7 * factor;
    }
  }

  // 3. Southwest Monsoon Drift across Equatorial Indian Ocean (Broad eastward flow)
  if (lat >= 3.0 && lat <= 9.0 && lon >= 50.0 && lon <= 95.0) {
    u += 0.85 + Math.sin(lon * 0.1) * 0.25;
    v += -0.15;
  }

  // 4. Bay of Bengal Circulation (Cyclonic eddy & East India Coastal Current)
  if (lon >= 80.0 && lon <= 96.0 && lat >= 8.0 && lat <= 22.0) {
    const cx = 88.0;
    const cy = 15.0;
    const dx = lon - cx;
    const dy = lat - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 9.0) {
      // Counter-clockwise cyclonic circulation
      const factor = (9.0 - dist) / 9.0;
      u += (-dy / (dist + 0.5)) * 0.65 * factor;
      v += (dx / (dist + 0.5)) * 0.65 * factor;
    }
    // Coastal boundary current along East India
    if (lon < 85.0 && lat > 12.0) {
      v += 0.45;
    }
  }

  // 5. Equatorial Counter Current / Wyrtki Jet (0° - 4°N)
  if (lat >= 0.0 && lat <= 4.0) {
    u += 1.1;
    v += Math.cos(lon * 0.15) * 0.1;
  }

  // Add subtle turbulence
  u += Math.sin(lat * 1.5 + lon * 0.8) * 0.1;
  v += Math.cos(lat * 1.2 - lon * 0.9) * 0.1;

  const speed = Math.sqrt(u * u + v * v);
  return { u, v, speed };
}

// -------------------------------------------------------------
// Scientific SST Field Calculation (January Study Period)
// -------------------------------------------------------------
function calculateSST(lat: number, lon: number): number {
  // Base equatorial gradient
  let temp = 29.2 - (lat / 30.0) * 4.2;

  // Cold upwelling wedge off Somalia & Oman
  if (lon < 60.0 && lat >= 12.0 && lat <= 22.0) {
    const upwellingEffect = Math.max(0, 1.0 - Math.hypot(lon - 55.0, lat - 18.0) / 7.0);
    temp -= upwellingEffect * 3.4;
  }

  // Northern Arabian Sea winter cooling (Gujarat / Pakistan coast)
  if (lat > 20.0 && lon < 74.0) {
    temp -= ((lat - 20.0) / 10.0) * 2.8;
  }

  // Southeastern Arabian Sea / Lakshadweep Warm Pool
  if (lon >= 68.0 && lon <= 76.0 && lat >= 7.0 && lat <= 14.0) {
    temp += 0.8;
  }

  // Bay of Bengal Warm Freshwater Lens (Northern BoB & Andaman)
  if (lon >= 83.0 && lon <= 96.0 && lat >= 10.0 && lat <= 20.0) {
    temp += 0.65 + Math.sin(lon * 0.1) * 0.3;
  }

  return Number(Math.max(21.5, Math.min(31.2, temp)).toFixed(1));
}

// -------------------------------------------------------------
// Bathymetric Depth Estimation (Meters)
// -------------------------------------------------------------
function estimateBathymetry(lat: number, lon: number): { depth: number; feature: string } {
  // Continental shelves & Shallow Gulfs (< 200m)
  if (
    (lon > 68 && lon < 73 && lat > 20 && lat < 24) || // Gulf of Khambhat / Kutch
    (lon > 78 && lon < 82 && lat > 8 && lat < 11) ||  // Palk Strait / Gulf of Mannar
    (lon > 88 && lon < 92 && lat > 20.5)              // Sundarbans Ganges delta
  ) {
    return { depth: -85, feature: 'Continental Shelf' };
  }

  // Chagos-Laccadive Ridge
  if (lon >= 71.5 && lon <= 74.5 && lat >= 0 && lat <= 14) {
    return { depth: -1250, feature: 'Chagos-Laccadive Ridge' };
  }

  // Carlsberg Ridge (NW-SE across Arabian Sea)
  const carlsbergDist = Math.abs((lat - 5.0) - (lon - 65.0) * -0.5);
  if (carlsbergDist < 2.0 && lon >= 55.0 && lon <= 70.0) {
    return { depth: -2100, feature: 'Carlsberg Mid-Ocean Ridge' };
  }

  // Ninety East Ridge (running North-South at 90°E)
  if (Math.abs(lon - 90.0) < 1.2 && lat >= 0.0 && lat <= 17.0) {
    return { depth: -1850, feature: 'Ninety East Ridge' };
  }

  // Sunda / Java Trench (Deep Subduction Zone > 6000m)
  if (lon >= 94.0 && lon <= 104.0 && lat >= 0.0 && lat <= 8.0) {
    return { depth: -6200, feature: 'Sunda Trench Subduction Zone' };
  }

  // Central Abyssal Basins
  if (lon < 75) {
    return { depth: -4100, feature: 'Arabian Abyssal Basin' };
  }
  return { depth: -3850, feature: 'Bay of Bengal Deep Basin' };
}

function resolveRegionName(lat: number, lon: number): string {
  if (lon < 60.0) {
    if (lat > 22.0) return 'Gulf of Oman / Strait of Hormuz';
    if (lat > 12.0) return 'Western Arabian Sea (Oman / Yemen Shelf)';
    return 'Gulf of Aden / Somali Upwelling Basin';
  } else if (lon < 77.5) {
    if (lat > 21.0) return 'Northern Arabian Sea (Gujarat Basin)';
    if (lat > 12.0) return 'Central Arabian Sea Basin';
    return 'South Arabian Sea / Lakshadweep Sea';
  } else if (lon < 91.0) {
    if (lat > 20.0) return 'Northern Bay of Bengal (Ganges Delta)';
    if (lat > 13.0) return 'Central Bay of Bengal';
    return 'South Bay of Bengal / Sri Lanka Basin';
  } else {
    if (lat > 13.0) return 'Andaman Sea Basin';
    return 'Malacca Strait / Nicobar Basin';
  }
}

// Turbo / Scientific Colormap for Sea Surface Temperature
function getSSTColor(temp: number): { r: number; g: number; b: number; hex: string } {
  // Normalized 22°C -> 31°C
  const t = Math.max(0, Math.min(1, (temp - 22.0) / 9.0));

  let r = 0;
  let g = 0;
  let b = 0;

  if (t < 0.25) {
    // 22°C - 24.25°C: Deep Navy Blue to Cyan-Teal
    const f = t / 0.25;
    r = Math.round(20 + f * 10);
    g = Math.round(60 + f * 120);
    b = Math.round(180 + f * 60);
  } else if (t < 0.5) {
    // 24.25°C - 26.5°C: Cyan to Vivid Emerald
    const f = (t - 0.25) / 0.25;
    r = Math.round(30 + f * 90);
    g = Math.round(180 + f * 50);
    b = Math.round(240 - f * 140);
  } else if (t < 0.75) {
    // 26.5°C - 28.75°C: Emerald to Golden Amber
    const f = (t - 0.5) / 0.25;
    r = Math.round(120 + f * 125);
    g = Math.round(230 - f * 40);
    b = Math.round(100 - f * 80);
  } else {
    // 28.75°C - 31°C: Golden Amber to Coral Crimson
    const f = (t - 0.75) / 0.25;
    r = Math.round(245 + f * 10);
    g = Math.round(190 - f * 130);
    b = Math.round(20 - f * 5);
  }

  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  return { r, g, b, hex };
}

export function RealisticOceanMap({
  compact = false,
  selectedLayer = 'Sea surface temperature',
  onSelect,
  onDropPin,
  onLaunchReconstruction,
}: RealisticOceanMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Satellite texture image object
  const satelliteImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Viewport State: Center Lat/Lon and Scale
  // Default bounds perfectly frame the North Indian Ocean relief map: 0°N to 26.2°N, 50.3°E to 106.8°E
  const [viewState, setViewState] = useState({
    centerLat: 13.5,
    centerLon: 78.5,
    zoom: 1.0, // 1.0 frames entire North Indian Ocean
  });

  // Layer Toggles
  const [showSatellite, setShowSatellite] = useState(true);
  const [showSST, setShowSST] = useState(true);
  const [sstOpacity, setSstOpacity] = useState(0.60);
  const [showCurrents, setShowCurrents] = useState(true);
  const [showBathymetry, setShowBathymetry] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showFloats, setShowFloats] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // User Interaction State
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; centerLat: number; centerLon: number } | null>(null);
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

  // Pre-configured Argo Floats / Active Casts in the North Indian Ocean
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

  // Ocean Current Animated Particles
  const particlesRef = useRef<Particle[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize Particles across North Indian Ocean
  useEffect(() => {
    const NUM_PARTICLES = 260;
    const particles: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const lat = 2.0 + Math.random() * 25.0;
      const lon = 45.0 + Math.random() * 55.0;
      particles.push({
        lat,
        lon,
        age: Math.floor(Math.random() * 120),
        maxAge: 90 + Math.floor(Math.random() * 90),
        history: [],
      });
    }
    particlesRef.current = particles;
  }, []);

  // Load satellite image & user-provided high-res relief map
  const reliefImageRef = useRef<HTMLImageElement | null>(null);
  const [reliefLoaded, setReliefLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = earthDayUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      satelliteImageRef.current = img;
      setImageLoaded(true);
    };

    const reliefImg = new Image();
    reliefImg.src = indianOceanReliefUrl;
    reliefImg.onload = () => {
      reliefImageRef.current = reliefImg;
      setReliefLoaded(true);
    };
  }, []);

  // Coordinate Projection: Lat/Lon <-> Logical Screen Pixels
  const project = useCallback(
    (lat: number, lon: number, width: number, height: number) => {
      // Equirectangular projection centered at viewState
      // Span ~58 degrees longitude across canvas width at zoom = 1.0 to frame the relief map
      const degWidth = 58.0 / viewState.zoom;
      const scaleX = width / degWidth;
      const cosLat = Math.cos((viewState.centerLat * Math.PI) / 180.0);
      const scaleY = scaleX / cosLat;

      const px = width / 2 + (lon - viewState.centerLon) * scaleX;
      const py = height / 2 - (lat - viewState.centerLat) * scaleY;
      return { px, py };
    },
    [viewState]
  );

  const unproject = useCallback(
    (px: number, py: number, width: number, height: number) => {
      const degWidth = 58.0 / viewState.zoom;
      const scaleX = width / degWidth;
      const cosLat = Math.cos((viewState.centerLat * Math.PI) / 180.0);
      const scaleY = scaleX / cosLat;

      const lon = viewState.centerLon + (px - width / 2) / scaleX;
      const lat = viewState.centerLat - (py - height / 2) / scaleY;
      return {
        lat: Number(lat.toFixed(2)),
        lon: Number(lon.toFixed(2)),
      };
    },
    [viewState]
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

      // Sync canvas pixel buffer with retina DPI while drawing in CSS logical pixels
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

      // 1. Draw Satellite & Hyper-Realistic Relief Map Layer
      if (showSatellite) {
        // A. Global satellite surround backdrop
        if (satelliteImageRef.current && imageLoaded) {
          const img = satelliteImageRef.current;
          const topLeft = unproject(0, 0, width, height);
          const bottomRight = unproject(width, height, width, height);

          const lonMin = Math.max(-180, topLeft.lon);
          const lonMax = Math.min(180, bottomRight.lon);
          const latMax = Math.min(90, topLeft.lat);
          const latMin = Math.max(-90, bottomRight.lat);

          const sx = ((lonMin + 180.0) / 360.0) * img.width;
          const sy = ((90.0 - latMax) / 180.0) * img.height;
          const sw = ((lonMax - lonMin) / 360.0) * img.width;
          const sh = ((latMax - latMin) / 180.0) * img.height;

          try {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
          } catch (e) {}
        } else {
          ctx.fillStyle = '#06172e';
          ctx.fillRect(0, 0, width, height);
        }

        // B. Hyper-Realistic Relief Map (User provided pixel-perfect satellite map)
        if (reliefImageRef.current && reliefLoaded) {
          const tl = project(RELIEF_BOUNDS.latMax, RELIEF_BOUNDS.lonMin, width, height);
          const br = project(RELIEF_BOUNDS.latMin, RELIEF_BOUNDS.lonMax, width, height);
          const destX = tl.px;
          const destY = tl.py;
          const destW = br.px - tl.px;
          const destH = br.py - tl.py;

          try {
            ctx.drawImage(reliefImageRef.current, destX, destY, destW, destH);
          } catch (e) {}
        }
      } else {
        // Deep oceanic base fill
        ctx.fillStyle = '#06172e';
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Realistic Ocean Water & Bathymetric Relief Layer
      if (showBathymetry) {
        // Enhance deep ocean waters with deep rich marine blue & turquoise shallows
        const bathyGradient = ctx.createLinearGradient(0, 0, width, height);
        bathyGradient.addColorStop(0, 'rgba(8, 28, 56, 0.45)');
        bathyGradient.addColorStop(0.5, 'rgba(12, 42, 78, 0.35)');
        bathyGradient.addColorStop(1, 'rgba(10, 32, 64, 0.50)');

        ctx.fillStyle = bathyGradient;
        ctx.fillRect(0, 0, width, height);

        // Underwater Ridges (Subtle luminous bathymetric paths)
        // Carlsberg Ridge
        ctx.save();
        ctx.beginPath();
        const cr1 = project(12.0, 56.0, width, height);
        const cr2 = project(6.0, 63.0, width, height);
        const cr3 = project(1.0, 68.0, width, height);
        ctx.moveTo(cr1.px, cr1.py);
        ctx.bezierCurveTo(cr2.px - 20, cr2.py, cr2.px + 20, cr2.py, cr3.px, cr3.py);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 14 * viewState.zoom;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Carlsberg Ridge label
        if (viewState.zoom >= 1.1) {
          ctx.font = '9px "Space Mono", monospace';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.fillText('CARLSBERG RIDGE (-2100m)', cr2.px - 35, cr2.py - 10);
        }

        // Ninety East Ridge
        const nr1 = project(16.0, 90.0, width, height);
        const nr2 = project(2.0, 90.0, width, height);
        ctx.beginPath();
        ctx.moveTo(nr1.px, nr1.py);
        ctx.lineTo(nr2.px, nr2.py);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
        ctx.lineWidth = 10 * viewState.zoom;
        ctx.stroke();

        if (viewState.zoom >= 1.1) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.fillText('NINETY EAST RIDGE (-1850m)', nr1.px + 12, (nr1.py + nr2.py) / 2);
        }

        // Chagos-Laccadive Ridge
        const ch1 = project(13.0, 72.5, width, height);
        const ch2 = project(1.0, 73.0, width, height);
        ctx.beginPath();
        ctx.moveTo(ch1.px, ch1.py);
        ctx.lineTo(ch2.px, ch2.py);
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.22)';
        ctx.lineWidth = 12 * viewState.zoom;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Sea Surface Temperature (SST) Thermal Heatmap Layer
      if (showSST) {
        ctx.save();
        ctx.globalAlpha = sstOpacity;

        // Render high-precision SST thermal field using adaptive grid cells with smooth edge feathering
        const step = 16;
        for (let py = 0; py < height; py += step) {
          for (let px = 0; px < width; px += step) {
            const geo = unproject(px + step / 2, py + step / 2, width, height);
            // Smooth edge feathering around Indian Ocean domain
            if (geo.lat >= -2.0 && geo.lat <= 30.5 && geo.lon >= 40.0 && geo.lon <= 104.0) {
              const fadeLon = Math.min(
                Math.max(0, (geo.lon - 40.0) / 4.0),
                Math.max(0, (104.0 - geo.lon) / 4.0),
                1.0
              );
              const fadeLat = Math.min(
                Math.max(0, (geo.lat - -2.0) / 3.0),
                Math.max(0, (30.5 - geo.lat) / 3.0),
                1.0
              );
              const edgeAlpha = fadeLon * fadeLat;
              if (edgeAlpha > 0.02) {
                const temp = calculateSST(geo.lat, geo.lon);
                const color = getSSTColor(temp);
                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.52 * edgeAlpha})`;
                ctx.fillRect(px, py, step, step);
              }
            }
          }
        }

        // Draw Isotherms (Lines of equal temperature)
        ctx.lineWidth = 1.2;
        ctx.font = '10px "Space Mono", monospace';

        // 28°C Isotherm across Arabian Sea & Bay of Bengal
        const isoPoints = [
          project(14.5, 62.0, width, height),
          project(15.2, 68.0, width, height),
          project(14.0, 74.0, width, height),
          project(13.5, 82.0, width, height),
          project(16.0, 89.0, width, height),
          project(14.0, 94.0, width, height),
        ];

        ctx.beginPath();
        ctx.moveTo(isoPoints[0].px, isoPoints[0].py);
        for (let i = 1; i < isoPoints.length; i++) {
          ctx.lineTo(isoPoints[i].px, isoPoints[i].py);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on isotherm
        ctx.fillStyle = '#ffffff';
        ctx.fillText('28°C Isotherm', isoPoints[1].px + 8, isoPoints[1].py - 6);

        // 26°C Isotherm in Northern Arabian Sea
        const iso26 = [
          project(21.5, 60.0, width, height),
          project(20.0, 66.0, width, height),
          project(19.2, 70.0, width, height),
        ];
        ctx.beginPath();
        ctx.moveTo(iso26[0].px, iso26[0].py);
        ctx.lineTo(iso26[1].px, iso26[1].py);
        ctx.lineTo(iso26[2].px, iso26[2].py);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('26°C Isotherm', iso26[1].px + 6, iso26[1].py - 6);

        ctx.restore();
      }

      // 4. Animated Ocean Surface Current Streamlines (Live Vector Particles)
      if (showCurrents) {
        ctx.save();
        const particles = particlesRef.current;
        const speedMultiplier = 0.045 * (1.0 / Math.max(0.5, viewState.zoom));

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const vel = getOceanCurrentVelocity(p.lat, p.lon);

          // Update position
          p.lon += vel.u * speedMultiplier;
          p.lat += vel.v * speedMultiplier;
          p.age += 1;

          const screenPos = project(p.lat, p.lon, width, height);

          // Record history for tail
          p.history.push({ lat: p.lat, lon: p.lon });
          if (p.history.length > 7) {
            p.history.shift();
          }

          // Respawn particle if expired or out of bounds
          if (
            p.age >= p.maxAge ||
            p.lat < 0.0 ||
            p.lat > 31.0 ||
            p.lon < 44.0 ||
            p.lon > 103.0
          ) {
            p.lat = 2.0 + Math.random() * 25.0;
            p.lon = 46.0 + Math.random() * 54.0;
            p.age = 0;
            p.history = [];
            continue;
          }

          // Draw streamline tail
          if (p.history.length > 1) {
            ctx.beginPath();
            const first = project(p.history[0].lat, p.history[0].lon, width, height);
            ctx.moveTo(first.px, first.py);

            for (let j = 1; j < p.history.length; j++) {
              const h = project(p.history[j].lat, p.history[j].lon, width, height);
              ctx.lineTo(h.px, h.py);
            }

            // Alpha fades at beginning and end of life
            const lifeProgress = p.age / p.maxAge;
            const alpha = Math.sin(lifeProgress * Math.PI) * 0.75;

            // Faster currents glow gold, calmer currents glow cyan
            if (vel.speed > 1.2) {
              ctx.strokeStyle = `rgba(217, 155, 33, ${alpha})`;
            } else {
              ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            }

            ctx.lineWidth = Math.min(2.5, 1.2 * viewState.zoom);
            ctx.lineCap = 'round';
            ctx.stroke();

            // Head glow dot
            ctx.beginPath();
            ctx.arc(screenPos.px, screenPos.py, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 5. Geographic Coordinate Graticule Grid (5° intervals)
      if (showGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 247, 187, 0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.font = '9px "Space Mono", monospace';
        ctx.fillStyle = 'rgba(250, 247, 187, 0.65)';

        // Longitude lines: 45°E to 105°E
        for (let lon = 45; lon <= 105; lon += 5) {
          const top = project(32, lon, width, height);
          const bottom = project(0, lon, width, height);
          ctx.beginPath();
          ctx.moveTo(top.px, top.py);
          ctx.lineTo(bottom.px, bottom.py);
          ctx.stroke();

          // Label
          if (top.px >= 30 && top.px <= width - 30) {
            ctx.fillText(`${lon}°E`, top.px + 4, 18);
          }
        }

        // Latitude lines: 0°N to 30°N
        for (let lat = 0; lat <= 30; lat += 5) {
          const left = project(lat, 42, width, height);
          const right = project(lat, 105, width, height);
          ctx.beginPath();
          ctx.moveTo(left.px, left.py);
          ctx.lineTo(right.px, right.py);
          ctx.stroke();

          // Label
          if (left.py >= 25 && left.py <= height - 25) {
            ctx.fillText(`${lat}°N`, 12, left.py - 4);
          }
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 6. Draw Active Argo Floats & Oceanographic Stations
      if (showFloats) {
        activeFloats.forEach((f) => {
          const pos = project(f.lat, f.lon, width, height);
          const isSelected = activeFloatHover?.id === f.id;
          const now = Date.now() / 1000;

          ctx.save();
          // Animated sonar pulse ring
          const pulseRadius = 8 + ((now * 15) % 18);
          const pulseAlpha = Math.max(0, 1.0 - pulseRadius / 26);
          ctx.beginPath();
          ctx.arc(pos.px, pos.py, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(217, 155, 33, ${pulseAlpha * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Outer beacon ring
          ctx.beginPath();
          ctx.arc(pos.px, pos.py, isSelected ? 8 : 6, 0, Math.PI * 2);
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

          // Name label with glassmorphic backing
          ctx.font = 'bold 11px "Space Mono", monospace';
          const text = f.name;
          const metrics = ctx.measureText(text);

          ctx.fillStyle = 'rgba(19, 52, 88, 0.85)';
          ctx.fillRect(pos.px + 10, pos.py - 11, metrics.width + 12, 18);
          ctx.strokeStyle = 'rgba(217, 155, 33, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pos.px + 10, pos.py - 11, metrics.width + 12, 18);

          ctx.fillStyle = '#FAF7BB';
          ctx.fillText(text, pos.px + 16, pos.py + 2);

          ctx.restore();
        });
      }

      // 7. Draw Selected / Pinned Target Reticle
      if (pinnedPoint) {
        const pinPos = project(pinnedPoint.lat, pinnedPoint.lon, width, height);
        const now = Date.now() / 1000;

        ctx.save();
        // Rotating compass reticle
        ctx.translate(pinPos.px, pinPos.py);
        ctx.rotate(now * 0.6);

        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outer pulse circle
        const outerPulse = 20 + ((now * 20) % 20);
        ctx.beginPath();
        ctx.arc(0, 0, outerPulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 155, 33, ${Math.max(0, 1.0 - outerPulse / 40)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.rotate(-now * 0.6);

        // Center target crosshairs
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

      // 8. Hover Crosshair & Coordinate Indicator
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

      ctx.restore(); // Restore outer render transform
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
    showSatellite,
    imageLoaded,
    showSST,
    sstOpacity,
    showCurrents,
    showBathymetry,
    showGrid,
    showFloats,
    pinnedPoint,
    hoverInfo,
    activeFloatHover,
    project,
    unproject,
    activeFloats,
  ]);

  // Handle Resize & Retina DPI
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

  // Mouse / Drag Handlers (Pan Navigation)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      centerLat: viewState.centerLat,
      centerLon: viewState.centerLon,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. Pan if dragging
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const degWidth = 58.0 / viewState.zoom;
      const scaleX = rect.width / degWidth;
      const cosLat = Math.cos((dragStartRef.current.centerLat * Math.PI) / 180.0);
      const scaleY = scaleX / cosLat;

      const newLon = dragStartRef.current.centerLon - dx / scaleX;
      const newLat = dragStartRef.current.centerLat + dy / scaleY;

      // Clamping to Indian Ocean exploration envelope
      setViewState((prev) => ({
        ...prev,
        centerLon: Math.max(38.0, Math.min(108.0, newLon)),
        centerLat: Math.max(-5.0, Math.min(35.0, newLat)),
      }));
      return;
    }

    // 2. Compute Hover Coordinates & Ocean Features
    const geo = unproject(mouseX, mouseY, rect.width, rect.height);
    const sst = calculateSST(geo.lat, geo.lon);
    const { depth, feature } = estimateBathymetry(geo.lat, geo.lon);
    const region = resolveRegionName(geo.lat, geo.lon);

    setHoverInfo({
      x: mouseX,
      y: mouseY,
      lat: geo.lat,
      lon: geo.lon,
      sst,
      depth,
      feature,
      region,
    });

    // Check hover over Argo Floats
    const floatHit = activeFloats.find((f) => {
      const p = project(f.lat, f.lon, rect.width, rect.height);
      return Math.hypot(p.px - mouseX, p.py - mouseY) < 18;
    });
    setActiveFloatHover(floatHit || null);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  // Wheel Zoom Handler (Scroll to Zoom Centered on Cursor)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Coordinates before zoom
    const beforeGeo = unproject(mouseX, mouseY, rect.width, rect.height);

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(0.65, Math.min(5.5, viewState.zoom * zoomFactor));

    setViewState((prev) => {
      // Keep mouse position pinned to the same lat/lon
      const degWidth = 58.0 / nextZoom;
      const scaleX = rect.width / degWidth;
      const cosLat = Math.cos((prev.centerLat * Math.PI) / 180.0);
      const scaleY = scaleX / cosLat;

      const newCenterLon = beforeGeo.lon - (mouseX - rect.width / 2) / scaleX;
      const newCenterLat = beforeGeo.lat + (mouseY - rect.height / 2) / scaleY;

      return {
        zoom: nextZoom,
        centerLon: Math.max(38.0, Math.min(108.0, newCenterLon)),
        centerLat: Math.max(-5.0, Math.min(35.0, newCenterLat)),
      };
    });
  };

  // Click Handler (Drop Target Pin or Select Float)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
    setViewState((prev) => ({ ...prev, zoom: Math.min(5.5, prev.zoom * 1.3) }));
  };

  const handleZoomOut = () => {
    setViewState((prev) => ({ ...prev, zoom: Math.max(0.65, prev.zoom / 1.3) }));
  };

  const handleReset = () => {
    setViewState({
      centerLat: 13.5,
      centerLon: 78.5,
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
            Hyper-Realistic 2D Ocean Lab
          </span>
          <span className="font-data text-[10px] text-[#536675] hidden md:inline">
            · True Satellite + Hydrodynamic Simulation
          </span>
        </div>

        {/* Layer Switches */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-2xl p-1 shadow-lg text-xs font-semibold text-[#133458] pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowSatellite(!showSatellite)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              showSatellite
                ? 'bg-[#133458] text-[#FAF7BB] shadow-sm'
                : 'text-[#536675] hover:text-[#133458] hover:bg-white/60'
            }`}
            title="Toggle True-Color Satellite Texture"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">Satellite</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSST(!showSST)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              showSST
                ? 'bg-[#D99B21] text-[#133458] font-bold shadow-sm'
                : 'text-[#536675] hover:text-[#133458] hover:bg-white/60'
            }`}
            title="Toggle Thermal SST Heatmap"
          >
            <Activity size={12} />
            <span className="hidden sm:inline">SST Thermal</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCurrents(!showCurrents)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              showCurrents
                ? 'bg-[#16658a] text-white shadow-sm'
                : 'text-[#536675] hover:text-[#133458] hover:bg-white/60'
            }`}
            title="Toggle Live Ocean Currents (Streamlines)"
          >
            <Waves size={12} />
            <span className="hidden sm:inline">Currents</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBathymetry(!showBathymetry)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
              showBathymetry
                ? 'bg-white text-[#133458] shadow-xs'
                : 'text-[#536675] hover:text-[#133458]'
            }`}
            title="Toggle Underwater Ridges & Bathymetry"
          >
            <Compass size={12} />
            <span>Ridges</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center justify-center h-7 w-7 rounded-xl text-[#536675] hover:text-[#133458] hover:bg-white/60 transition-colors ml-1"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Ocean Lab'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
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

      {/* 4. Thermal SST Colorbar on Right Edge */}
      {showSST && (
        <div className="absolute right-4 bottom-6 flex flex-col items-center gap-1.5 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-2xl p-2.5 shadow-xl text-[#133458] pointer-events-auto z-10">
          <span className="font-data text-[9px] font-bold uppercase tracking-wider text-[#133458]">SST (°C)</span>
          <div className="relative h-36 w-3.5 rounded-full overflow-hidden shadow-inner border border-white/80 bg-linear-to-b from-[#f43f5e] via-[#fbbf24] via-45% to-[#0284c7]" />
          <div className="flex flex-col justify-between h-36 text-[9px] font-data text-[#133458] font-bold absolute right-7 top-7">
            <span>31°</span>
            <span>28°</span>
            <span>26°</span>
            <span>22°</span>
          </div>
        </div>
      )}

      {/* 5. Live HUD Telemetry Readout (Bottom Left) */}
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

      {/* 6. Selected Target Pin Popover with "Reconstruct Here" Action */}
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

      {/* 7. Hover Popover for Argo Floats */}
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
