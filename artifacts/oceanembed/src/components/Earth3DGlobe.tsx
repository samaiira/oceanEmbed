import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Compass,
  Play,
  Pause,
  MapPin,
  Sparkles,
  Copy,
  Check,
  X,
  Crosshair,
  Flame,
} from 'lucide-react';

export interface PinnedPoint {
  lat: number;
  lon: number;
  sst: number;
  region: string;
  depths?: number[];
}

interface CastPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sst: number;
  rmse?: number;
  isActive?: boolean;
}

interface Earth3DGlobeProps {
  compact?: boolean;
  activeCasts?: CastPoint[];
  onSelectCast?: (name: string) => void;
  onDropPin?: (point: PinnedPoint) => void;
  onLaunchReconstruction?: (lat: number, lon: number, sst: number) => void;
  initialPin?: { lat: number; lon: number } | null;
}

// Geographic polygons for world landmasses and detailed Indian Ocean rim
// Coordinates in [lat, lon] degrees
const LAND_POLYGONS: [number, number][][] = [
  // Indian Subcontinent & Sri Lanka
  [
    [23.5, 68.0], [22.8, 69.2], [22.3, 70.0], [20.8, 70.8], [21.5, 72.2],
    [20.5, 72.8], [19.0, 72.8], [16.0, 73.5], [14.0, 74.5], [11.0, 75.8],
    [8.1, 77.5], [8.5, 78.2], [9.3, 79.1], [10.5, 79.8], [12.0, 80.0],
    [13.1, 80.3], [16.0, 81.5], [17.7, 83.3], [19.5, 85.0], [21.5, 87.5],
    [22.5, 89.0], [24.0, 90.0], [26.0, 89.0], [27.0, 85.0], [28.5, 80.0],
    [31.0, 77.0], [33.0, 75.0], [31.5, 71.0], [27.0, 68.0], [25.0, 67.0],
    [23.5, 68.0],
  ],
  // Sri Lanka
  [
    [9.8, 80.2], [9.0, 80.8], [8.0, 81.6], [6.5, 81.8], [5.9, 80.5],
    [6.9, 79.8], [8.5, 79.7], [9.8, 80.2],
  ],
  // Arabian Peninsula & Persian Gulf
  [
    [12.8, 43.3], [14.0, 48.0], [17.0, 54.0], [22.5, 59.8], [24.0, 57.5],
    [26.2, 56.5], [25.5, 55.0], [24.5, 54.0], [24.0, 52.5], [26.0, 50.5],
    [29.0, 48.5], [30.0, 48.0], [28.0, 43.0], [28.0, 36.0], [22.0, 39.0],
    [16.0, 42.5], [12.8, 43.3],
  ],
  // East Africa & Horn of Africa
  [
    [30.0, 32.5], [25.0, 35.0], [20.0, 37.5], [15.5, 39.5], [12.0, 43.0],
    [11.8, 51.2], [8.0, 50.0], [3.0, 46.0], [-1.0, 42.0], [-5.0, 39.0],
    [-11.0, 40.5], [-16.0, 40.0], [-20.0, 35.5], [-26.0, 33.0], [-34.0, 26.0],
    [-34.8, 20.0], [-30.0, 17.5], [-22.0, 14.5], [-15.0, 12.0], [-5.0, 12.0],
    [4.0, 9.0], [6.0, 2.0], [4.5, -7.5], [11.0, -15.0], [15.0, -17.0],
    [21.0, -17.0], [28.0, -13.0], [35.0, -6.0], [36.0, 0.0], [37.0, 10.0],
    [31.5, 31.5], [30.0, 32.5],
  ],
  // Madagascar
  [
    [-12.0, 49.3], [-15.5, 50.5], [-20.0, 48.5], [-25.5, 47.0], [-25.2, 44.5],
    [-20.0, 44.0], [-16.0, 44.5], [-12.0, 49.3],
  ],
  // Southeast Asia, Myanmar, Thailand, Malaysia
  [
    [22.0, 91.5], [20.5, 93.0], [16.0, 94.5], [16.0, 97.0], [12.0, 98.6],
    [8.0, 98.3], [4.0, 100.5], [1.3, 103.8], [3.0, 103.5], [6.0, 102.0],
    [10.0, 99.5], [13.0, 100.5], [13.5, 101.0], [10.5, 107.5], [15.0, 109.0],
    [21.0, 108.0], [22.0, 105.0], [22.0, 91.5],
  ],
  // Sumatra & Java
  [
    [5.5, 95.3], [3.0, 98.5], [-0.5, 101.5], [-4.5, 105.5], [-5.8, 106.0],
    [-5.0, 103.0], [-2.0, 100.5], [1.5, 97.5], [5.5, 95.3],
  ],
  [
    [-6.0, 106.0], [-6.5, 109.0], [-7.2, 112.5], [-8.2, 114.5], [-8.7, 111.0],
    [-7.8, 108.5], [-6.8, 105.5], [-6.0, 106.0],
  ],
  // Australia
  [
    [-12.0, 131.0], [-15.0, 136.0], [-12.0, 142.0], [-18.0, 146.0], [-24.0, 151.0],
    [-32.0, 153.0], [-38.0, 147.0], [-38.0, 141.0], [-35.0, 137.0], [-32.0, 132.0],
    [-32.0, 125.0], [-35.0, 116.0], [-28.0, 114.0], [-22.0, 114.0], [-18.0, 122.0],
    [-14.0, 126.0], [-12.0, 131.0],
  ],
  // Eurasia / North Europe / Mediterranean rim
  [
    [36.0, -5.5], [43.0, -9.0], [48.0, -4.5], [51.0, 2.0], [54.0, 9.0],
    [58.0, 11.0], [60.0, 25.0], [65.0, 25.0], [70.0, 30.0], [70.0, 60.0],
    [70.0, 100.0], [60.0, 120.0], [45.0, 125.0], [35.0, 120.0], [25.0, 118.0],
    [22.0, 114.0], [30.0, 105.0], [35.0, 90.0], [40.0, 70.0], [42.0, 50.0],
    [40.0, 30.0], [36.0, 25.0], [40.0, 15.0], [38.0, 0.0], [36.0, -5.5],
  ],
];

// Helper to estimate Sea Surface Temperature matching North Indian Ocean satellite data
function estimateSST(lat: number, lon: number): number {
  // Center of study area
  if (lat >= 5 && lat <= 30 && lon >= 45 && lon <= 105) {
    // Equatorial warm pool (5-10°N): 29-30°C
    // Central basin (12-18°N): 27-28.5°C
    // Northern Arabian Sea / Persian Gulf (22-26°N): cooler winter waters 22.5-25°C
    const latFactor = (30 - lat) / 25; // 0 at 30°N, 1 at 5°N
    const base = 22.5 + latFactor * 7.2;
    // Regional variation (Bay of Bengal slightly warmer surface, Arabian Sea strong upwelling gradient)
    const lonShift = lon < 77.5 ? -0.3 : 0.4;
    return Number((base + lonShift).toFixed(1));
  }
  // Global approximation for other oceans
  const absLat = Math.abs(lat);
  if (absLat > 70) return 0.5;
  if (absLat > 50) return 6.0;
  if (absLat > 30) return 18.0;
  return Number((28.5 - absLat * 0.3).toFixed(1));
}

function resolveOceanRegion(lat: number, lon: number): string {
  if (lat >= 5 && lat <= 30 && lon >= 45 && lon <= 105) {
    if (lon < 77.5) {
      if (lat > 22.0) return 'Northern Arabian Sea / Gulf of Oman';
      if (lat > 14.0) return 'Central Arabian Sea Basin';
      return 'South Arabian Sea / Lakshadweep Sea';
    } else {
      if (lat > 18.0) return 'Northern Bay of Bengal';
      if (lat > 12.0) return 'Central Bay of Bengal';
      return 'Andaman Sea / Equatorial Indian Ocean';
    }
  }
  if (lat > 0 && lon > 20 && lon < 120) return 'North Indian Ocean (Outer)';
  if (lat <= 0 && lon > 20 && lon < 120) return 'South Indian Ocean';
  if (lon >= -70 && lon <= 20) return 'Atlantic Ocean Basin';
  return 'Pacific / World Ocean';
}

export function Earth3DGlobe({
  compact = false,
  activeCasts = [],
  onSelectCast,
  onDropPin,
  onLaunchReconstruction,
  initialPin = null,
}: Earth3DGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rotation angles (radians)
  // Center initially on North Indian Ocean: ~15°N, ~68°E
  const [lambda0, setLambda0] = useState<number>((68 * Math.PI) / 180);
  const [phi0, setPhi0] = useState<number>((15 * Math.PI) / 180);
  const [scale, setScale] = useState<number>(compact ? 1.05 : 1.25);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Interaction State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; lambda: number; phi: number }>({
    x: 0,
    y: 0,
    lambda: 0,
    phi: 0,
  });

  // Hover & Pinned Point Coordinates
  const [hoverCoord, setHoverCoord] = useState<{
    lat: number;
    lon: number;
    x: number;
    y: number;
    sst: number;
    region: string;
  } | null>(null);

  const [pinnedPoint, setPinnedPoint] = useState<PinnedPoint | null>(
    initialPin
      ? {
          lat: initialPin.lat,
          lon: initialPin.lon,
          sst: estimateSST(initialPin.lat, initialPin.lon),
          region: resolveOceanRegion(initialPin.lat, initialPin.lon),
        }
      : {
          lat: 15.5,
          lon: 65.0,
          sst: 27.8,
          region: 'Central Arabian Sea Basin',
        }
  );

  const [copied, setCopied] = useState<boolean>(false);
  const [textureLoaded, setTextureLoaded] = useState<boolean>(false);
  const sstImageRef = useRef<HTMLImageElement | null>(null);

  // Preload North Indian Ocean satellite SST thermal texture
  useEffect(() => {
    const img = new Image();
    img.src = '/sst_north_indian_ocean.jpg';
    img.onload = () => {
      sstImageRef.current = img;
      setTextureLoaded(true);
    };
  }, []);

  // 3D Spherical Orthographic Projection: (lat, lon) -> screen (x, y, visible)
  const project = useCallback(
    (latDeg: number, lonDeg: number, cx: number, cy: number, radius: number) => {
      const phi = (latDeg * Math.PI) / 180;
      const lambda = (lonDeg * Math.PI) / 180;
      const deltaLambda = lambda - lambda0;

      // Cosine of angular distance from center of view
      const cosC =
        Math.sin(phi0) * Math.sin(phi) +
        Math.cos(phi0) * Math.cos(phi) * Math.cos(deltaLambda);

      const isVisible = cosC >= 0;

      const x = radius * Math.cos(phi) * Math.sin(deltaLambda);
      const y = -radius * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(deltaLambda));

      return {
        x: cx + x,
        y: cy + y,
        visible: isVisible,
        depth: cosC, // 0 at edge, 1 at center
      };
    },
    [lambda0, phi0]
  );

  // Inverse Spherical Orthographic: screen (px, py) -> (lat, lon)
  const unproject = useCallback(
    (px: number, py: number, cx: number, cy: number, radius: number): { lat: number; lon: number } | null => {
      const x = px - cx;
      const y = -(py - cy);
      const rho = Math.sqrt(x * x + y * y);

      if (rho > radius) return null; // Outside sphere

      const c = Math.asin(rho / radius);
      const sinC = Math.sin(c);
      const cosC = Math.cos(c);

      let phi = phi0;
      let lambda = lambda0;

      if (rho > 0.0001) {
        phi = Math.asin(cosC * Math.sin(phi0) + (y * sinC * Math.cos(phi0)) / rho);
        const numerator = x * sinC;
        const denominator = rho * Math.cos(phi0) * cosC - y * Math.sin(phi0) * sinC;
        const deltaLambda = Math.atan2(numerator, denominator);
        lambda = lambda0 + deltaLambda;
      }

      // Normalize longitude to [-180, 180]
      let lonDeg = (lambda * 180) / Math.PI;
      lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
      const latDeg = (phi * 180) / Math.PI;

      return {
        lat: Number(latDeg.toFixed(2)),
        lon: Number(lonDeg.toFixed(2)),
      };
    },
    [lambda0, phi0]
  );

  // Auto-rotation animation loop
  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setLambda0((prev) => {
        let next = prev + 0.0018;
        if (next > Math.PI) next -= 2 * Math.PI;
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.42;
    const radius = baseRadius * scale;

    ctx.clearRect(0, 0, width, height);

    // 1. Atmosphere Horizon Glow (Outer halo)
    const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.96, cx, cy, radius * 1.15);
    haloGrad.addColorStop(0, 'rgba(44, 100, 150, 0.45)');
    haloGrad.addColorStop(0.5, 'rgba(30, 80, 130, 0.2)');
    haloGrad.addColorStop(1, 'rgba(19, 52, 88, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // 2. Earth Globe Sphere Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 2a. Ocean Base Shading (Deep Marine Blue with 3D spherical lighting)
    const oceanGrad = ctx.createRadialGradient(
      cx - radius * 0.32,
      cy - radius * 0.32,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    oceanGrad.addColorStop(0, '#1c4974');
    oceanGrad.addColorStop(0.65, '#113354');
    oceanGrad.addColorStop(1, '#091c30');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // 2b. Latitude Parallels & Longitude Meridians (Graticules)
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(160, 200, 225, 0.18)';

    // Latitude rings (-75 to 75 every 15°)
    for (let lat = -75; lat <= 75; lat += 15) {
      ctx.beginPath();
      let hasStarted = false;
      const isEquator = lat === 0;
      const isTropic = Math.abs(lat) === 23.5;

      for (let lon = -180; lon <= 180; lon += 3) {
        const pt = project(lat, lon, cx, cy, radius);
        if (pt.visible) {
          if (!hasStarted) {
            ctx.moveTo(pt.x, pt.y);
            hasStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          hasStarted = false;
        }
      }
      ctx.strokeStyle = isEquator
        ? 'rgba(217, 155, 33, 0.65)'
        : isTropic
        ? 'rgba(217, 155, 33, 0.35)'
        : 'rgba(160, 200, 225, 0.16)';
      ctx.lineWidth = isEquator ? 1.2 : 0.75;
      if (isTropic) ctx.setLineDash([3, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Longitude meridians (-180 to 180 every 15°)
    for (let lon = -180; lon <= 180; lon += 15) {
      ctx.beginPath();
      let hasStarted = false;
      const isPrime = lon === 0 || lon === 70; // 70°E passes central Arabian Sea
      for (let lat = -85; lat <= 85; lat += 2) {
        const pt = project(lat, lon, cx, cy, radius);
        if (pt.visible) {
          if (!hasStarted) {
            ctx.moveTo(pt.x, pt.y);
            hasStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          hasStarted = false;
        }
      }
      ctx.strokeStyle = isPrime ? 'rgba(217, 155, 33, 0.45)' : 'rgba(160, 200, 225, 0.14)';
      ctx.lineWidth = isPrime ? 1.0 : 0.6;
      ctx.stroke();
    }

    // 2c. Satellite Sea Surface Temperature (SST) Thermal Heat Map in North Indian Ocean (5-30°N, 42-100°E)
    // Renders the vibrant rainbow SST colormap matching media_1790144942227.jpg
    const sstLatSteps = 16;
    const sstLonSteps = 24;
    for (let i = 0; i < sstLatSteps; i++) {
      const lat1 = 5 + (i * (30 - 5)) / sstLatSteps;
      const lat2 = 5 + ((i + 1) * (30 - 5)) / sstLatSteps;
      for (let j = 0; j < sstLonSteps; j++) {
        const lon1 = 43 + (j * (100 - 43)) / sstLonSteps;
        const lon2 = 43 + ((j + 1) * (100 - 43)) / sstLonSteps;

        const p1 = project(lat1, lon1, cx, cy, radius);
        const p2 = project(lat1, lon2, cx, cy, radius);
        const p3 = project(lat2, lon2, cx, cy, radius);
        const p4 = project(lat2, lon1, cx, cy, radius);

        if (p1.visible && p2.visible && p3.visible && p4.visible) {
          const midLat = (lat1 + lat2) / 2;
          const midLon = (lon1 + lon2) / 2;
          const sstVal = estimateSST(midLat, midLon);

          // Color scale: 22°C (Blue) -> 25°C (Cyan) -> 27°C (Green/Yellow) -> 29°C (Orange) -> 30°C (Deep Red)
          const norm = Math.max(0, Math.min(1, (sstVal - 22.0) / 8.0));
          let r = 0,
            g = 0,
            b = 0;
          if (norm < 0.25) {
            // Blue to Cyan
            const t = norm / 0.25;
            r = Math.round(15 + 10 * t);
            g = Math.round(40 + 170 * t);
            b = Math.round(200 + 40 * t);
          } else if (norm < 0.5) {
            // Cyan to Green
            const t = (norm - 0.25) / 0.25;
            r = Math.round(25 + 90 * t);
            g = Math.round(210 + 25 * t);
            b = Math.round(240 - 180 * t);
          } else if (norm < 0.75) {
            // Green to Yellow/Orange
            const t = (norm - 0.5) / 0.25;
            r = Math.round(115 + 130 * t);
            g = Math.round(235 - 35 * t);
            b = Math.round(60 - 45 * t);
          } else {
            // Yellow/Orange to Deep Red
            const t = (norm - 0.75) / 0.25;
            r = Math.round(245 + 10 * t);
            g = Math.round(200 - 170 * t);
            b = Math.round(15 + 10 * t);
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.58)`;
          ctx.fill();
        }
      }
    }

    // 2d. Render Continents & Landmass Polygons
    ctx.fillStyle = '#3f564a';
    ctx.strokeStyle = '#628574';
    ctx.lineWidth = 1.0;

    LAND_POLYGONS.forEach((poly) => {
      ctx.beginPath();
      let started = false;
      poly.forEach(([lat, lon]) => {
        const pt = project(lat, lon, cx, cy, radius);
        if (pt.visible) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      });
      if (started) {
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });

    // 2e. Specular Highlight & Depth Rim Shadow (Inner glow on spherical surface)
    const sphereShader = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.35,
      radius * 0.05,
      cx,
      cy,
      radius
    );
    sphereShader.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    sphereShader.addColorStop(0.4, 'rgba(255, 255, 255, 0.02)');
    sphereShader.addColorStop(0.85, 'rgba(0, 0, 0, 0.2)');
    sphereShader.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = sphereShader;
    ctx.fillRect(0, 0, width, height);

    // 2f. Study Region Boundary Box (North Indian Ocean: 5-30°N, 45-105°E)
    ctx.strokeStyle = '#D99B21';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const bCorners = [
      [5, 45],
      [30, 45],
      [30, 105],
      [5, 105],
      [5, 45],
    ];
    let bStarted = false;
    for (let c = 0; c < bCorners.length - 1; c++) {
      const [l1, o1] = bCorners[c];
      const [l2, o2] = bCorners[c + 1];
      for (let s = 0; s <= 10; s++) {
        const clat = l1 + ((l2 - l1) * s) / 10;
        const clon = o1 + ((o2 - o1) * s) / 10;
        const pt = project(clat, clon, cx, cy, radius);
        if (pt.visible) {
          if (!bStarted) {
            ctx.moveTo(pt.x, pt.y);
            bStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2g. Active Cast Indicators (Argo & Reconstructions)
    activeCasts.forEach((cast) => {
      const pt = project(cast.lat, cast.lon, cx, cy, radius);
      if (!pt.visible) return;

      const isCastActive = cast.isActive;
      // Pulsing outer beacon circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isCastActive ? 14 : 9, 0, Math.PI * 2);
      ctx.fillStyle = isCastActive ? 'rgba(217, 155, 33, 0.35)' : 'rgba(131, 137, 33, 0.25)';
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isCastActive ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isCastActive ? '#D99B21' : '#FAF7BB';
      ctx.strokeStyle = '#133458';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Label Tag
      ctx.font = isCastActive ? 'bold 11px "Space Mono"' : '10px "Space Mono"';
      ctx.fillStyle = isCastActive ? '#FAF7BB' : 'rgba(250, 247, 187, 0.75)';
      ctx.fillText(cast.name.split('(')[0].trim(), pt.x + 8, pt.y - 4);
    });

    // 2h. Pinned Custom Point (The point selected by user!)
    if (pinnedPoint) {
      const pt = project(pinnedPoint.lat, pinnedPoint.lon, cx, cy, radius);
      if (pt.visible) {
        // Multi-ring radar pulse
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(217, 155, 33, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target crosshair
        ctx.beginPath();
        ctx.moveTo(pt.x - 9, pt.y);
        ctx.lineTo(pt.x + 9, pt.y);
        ctx.moveTo(pt.x, pt.y - 9);
        ctx.lineTo(pt.x, pt.y + 9);
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pin center marker
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FAF7BB';
        ctx.strokeStyle = '#133458';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Floating Coordinate Tag attached to the 3D pin
        const tagText = `${pinnedPoint.lat}°N, ${pinnedPoint.lon}°E`;
        ctx.font = 'bold 11px "Space Mono"';
        const textWidth = ctx.measureText(tagText).width;

        // Background pill
        ctx.fillStyle = '#133458';
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if ('roundRect' in ctx) {
          (ctx as any).roundRect(pt.x + 10, pt.y - 20, textWidth + 14, 22, 3);
        } else {
          ctx.rect(pt.x + 10, pt.y - 20, textWidth + 14, 22);
        }
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#FAF7BB';
        ctx.fillText(tagText, pt.x + 17, pt.y - 5);
      }
    }

    ctx.restore(); // End sphere clip
  }, [lambda0, phi0, scale, project, activeCasts, pinnedPoint, textureLoaded]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      lambda: lambda0,
      phi: phi0,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.42 * scale;

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const sensitivity = 0.005 / scale;
      let newLambda = dragStartRef.current.lambda - dx * sensitivity;
      let newPhi = dragStartRef.current.phi + dy * sensitivity;

      // Clamp latitude to [-80°, 80°] to prevent flipping
      newPhi = Math.max((-80 * Math.PI) / 180, Math.min((80 * Math.PI) / 180, newPhi));

      setLambda0(newLambda);
      setPhi0(newPhi);
    } else {
      // Hover coordinate calculation
      const coords = unproject(px, py, cx, cy, radius);
      if (coords) {
        setHoverCoord({
          lat: coords.lat,
          lon: coords.lon,
          x: px,
          y: py,
          sst: estimateSST(coords.lat, coords.lon),
          region: resolveOceanRegion(coords.lat, coords.lon),
        });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.42 * scale;

    const coords = unproject(px, py, cx, cy, radius);
    if (coords) {
      const sst = estimateSST(coords.lat, coords.lon);
      const region = resolveOceanRegion(coords.lat, coords.lon);
      const newPin: PinnedPoint = {
        lat: coords.lat,
        lon: coords.lon,
        sst,
        region,
      };
      setPinnedPoint(newPin);
      onDropPin?.(newPin);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setScale((prev) => {
      const next = prev - e.deltaY * 0.001;
      return Math.max(0.75, Math.min(2.4, next));
    });
  };

  const resetView = () => {
    setLambda0((68 * Math.PI) / 180);
    setPhi0((15 * Math.PI) / 180);
    setScale(compact ? 1.05 : 1.25);
  };

  const copyCoordinates = () => {
    if (!pinnedPoint) return;
    navigator.clipboard.writeText(`${pinnedPoint.lat}, ${pinnedPoint.lon}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-[#294966] bg-[#133458] select-none ${
        compact ? 'h-[360px]' : 'h-[500px]'
      }`}
    >
      {/* 3D WebGL / Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoverCoord(null);
        }}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Top Banner: Domain Info */}
      <div className="absolute left-4 top-4 flex items-center gap-2 border border-[#FAF7BB]/15 bg-[#133458]/80 px-3 py-1.5 text-[10px] text-[#FAF7BB]/85 backdrop-blur rounded-sm">
        <span className="h-2 w-2 rounded-full bg-[#D99B21] animate-pulse" />
        <span className="font-semibold tracking-wider uppercase font-data">3D Earth · North Indian Ocean</span>
        <span className="font-data text-[#FAF7BB]/45 hidden sm:inline">· 5–30°N, 45–105°E</span>
      </div>

      {/* Floating Control Toolbar */}
      <div className="absolute right-4 top-4 flex flex-col gap-1.5 border border-[#FAF7BB]/15 bg-[#133458]/85 p-1 backdrop-blur rounded-sm shadow-lg">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.4, s + 0.15))}
          title="Zoom In"
          className="p-1.5 text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/15 hover:text-[#FAF7BB] transition-colors rounded-sm"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
          title="Zoom Out"
          className="p-1.5 text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/15 hover:text-[#FAF7BB] transition-colors rounded-sm"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Center North Indian Ocean (15°N, 68°E)"
          className="p-1.5 text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/15 hover:text-[#FAF7BB] transition-colors rounded-sm"
        >
          <Compass size={15} />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((r) => !r)}
          title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
          className={`p-1.5 transition-colors rounded-sm ${
            autoRotate ? 'text-[#D99B21] bg-[#FAF7BB]/10' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/15 hover:text-[#FAF7BB]'
          }`}
        >
          {autoRotate ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>

      {/* Live Coordinate Cursor Hover HUD */}
      {hoverCoord && !isDragging && (
        <div className="pointer-events-none absolute left-4 bottom-14 flex items-center gap-2 border border-[#D99B21]/40 bg-[#133458]/90 px-3 py-1.5 text-xs text-[#FAF7BB] backdrop-blur rounded-sm shadow-xl font-data">
          <Crosshair size={13} className="text-[#D99B21]" />
          <span>
            Lat: <strong className="text-[#FAF7BB]">{hoverCoord.lat}°N</strong>, Lon:{' '}
            <strong className="text-[#FAF7BB]">{hoverCoord.lon}°E</strong>
          </span>
          <span className="text-[#FAF7BB]/40">·</span>
          <span className="text-[#FAF7BB]/80 truncate max-w-[140px]">{hoverCoord.region}</span>
          <span className="text-[#FAF7BB]/40">·</span>
          <span className="text-[#D99B21] font-bold">~{hoverCoord.sst}°C</span>
        </div>
      )}

      {/* Interactive Pinned Point Details Popover Card */}
      {pinnedPoint && (
        <div className="absolute right-4 bottom-4 z-20 w-72 rounded-sm border border-[#D99B21]/50 bg-[#133458]/95 p-3.5 text-[#FAF7BB] shadow-2xl backdrop-blur animate-rise">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#FAF7BB]/15">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D99B21]">
              <MapPin size={14} />
              <span>Selected Point Location</span>
            </div>
            <button
              type="button"
              onClick={() => setPinnedPoint(null)}
              className="text-[#FAF7BB]/50 hover:text-[#FAF7BB] transition-colors"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 font-data">
            <div className="rounded bg-[#FAF7BB]/10 p-2">
              <span className="block text-[9px] uppercase tracking-wider text-[#FAF7BB]/60">Latitude</span>
              <span className="text-sm font-bold text-[#FAF7BB]">{pinnedPoint.lat}°N</span>
            </div>
            <div className="rounded bg-[#FAF7BB]/10 p-2">
              <span className="block text-[9px] uppercase tracking-wider text-[#FAF7BB]/60">Longitude</span>
              <span className="text-sm font-bold text-[#FAF7BB]">{pinnedPoint.lon}°E</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex justify-between text-[#FAF7BB]/80">
              <span>Basin:</span>
              <strong className="text-[#FAF7BB] truncate max-w-[160px] text-right font-medium">
                {pinnedPoint.region}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#FAF7BB]/80">
              <span className="flex items-center gap-1">
                <Flame size={12} className="text-[#D99B21]" /> Est. Surface Temp:
              </span>
              <strong className="text-[#D99B21] font-data font-bold">{pinnedPoint.sst}°C</strong>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onLaunchReconstruction?.(pinnedPoint.lat, pinnedPoint.lon, pinnedPoint.sst)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-sm bg-[#D99B21] hover:bg-[#b88015] px-2.5 py-1.5 text-xs font-semibold text-[#133458] transition-colors"
            >
              <Sparkles size={13} /> Reconstruct Here
            </button>
            <button
              type="button"
              onClick={copyCoordinates}
              className="rounded-sm border border-[#FAF7BB]/20 px-2 py-1.5 text-xs text-[#FAF7BB] hover:bg-[#FAF7BB]/10 transition-colors"
              title="Copy coordinates"
            >
              {copied ? <Check size={14} className="text-[#838921]" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Bar: Instructions & Colorbar Scale */}
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between pointer-events-none">
        <div className="text-[10px] text-[#FAF7BB]/60 hidden sm:block pointer-events-auto">
          <div>• Drag to rotate in 3D · Scroll to zoom</div>
          <div>• Click anywhere on Earth to drop point & read Lat/Lon</div>
        </div>

        {/* Satellite SST Colorbar Legend (22°C to 30°C) matching media_1790144942227.jpg */}
        <div className="w-52 pointer-events-auto bg-[#133458]/70 p-2 rounded-sm border border-[#FAF7BB]/10 backdrop-blur">
          <div className="mb-1 flex justify-between font-data text-[9px] text-[#FAF7BB]/75">
            <span>22°C</span>
            <span>Sea Surface Temp (SST)</span>
            <span>30°C</span>
          </div>
          <div className="h-2 rounded-sm bg-gradient-to-r from-[#1940ff] via-[#00e1ff] via-[#4dff00] via-[#ffff00] via-[#ff7700] to-[#e60000]" />
        </div>
      </div>
    </div>
  );
}
