import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  Cloud,
  Eye,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Grid,
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
  expanded?: boolean;
  onToggleExpand?: () => void;
  activeCasts?: CastPoint[];
  onSelectCast?: (name: string) => void;
  onDropPin?: (point: PinnedPoint) => void;
  onLaunchReconstruction?: (lat: number, lon: number, sst: number) => void;
  initialPin?: { lat: number; lon: number } | null;
}

// Starfield particles for hyperrealistic deep space backdrop
interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  color: string;
}

// Major nocturnal city lights on dark hemisphere
const NIGHT_LIGHT_CLUSTERS: [number, number, number][] = [
  // [lat, lon, intensity]
  [18.97, 72.82, 1.0], // Mumbai
  [28.61, 77.20, 1.0], // New Delhi
  [13.08, 80.27, 0.9], // Chennai
  [22.57, 88.36, 0.9], // Kolkata
  [12.97, 77.59, 0.95], // Bengaluru
  [17.38, 78.48, 0.85], // Hyderabad
  [24.86, 67.00, 0.9], // Karachi
  [31.52, 74.35, 0.8], // Lahore
  [25.20, 55.27, 1.0], // Dubai
  [24.71, 46.67, 0.85], // Riyadh
  [23.58, 58.40, 0.75], // Muscat
  [6.92, 79.86, 0.75], // Colombo
  [23.81, 90.41, 0.85], // Dhaka
  [1.35, 103.81, 1.0], // Singapore
  [13.75, 100.50, 0.9], // Bangkok
  [30.04, 31.23, 0.9], // Cairo
  [-1.29, 36.82, 0.7], // Nairobi
  [-26.20, 28.04, 0.85], // Johannesburg
];

// Rich, detailed continental outlines & major islands (lat, lon degrees)
const CONTINENT_POLYGONS: {
  coords: [number, number][];
  type: 'land' | 'island' | 'desert' | 'snow';
  name?: string;
}[] = [
  // Indian Subcontinent Mainmass
  {
    type: 'land',
    name: 'India',
    coords: [
      [23.5, 68.0], [22.8, 69.2], [22.3, 70.0], [20.8, 70.8], [21.5, 72.2],
      [20.5, 72.8], [19.0, 72.8], [16.0, 73.5], [14.0, 74.5], [11.0, 75.8],
      [8.1, 77.5], [8.5, 78.2], [9.3, 79.1], [10.5, 79.8], [12.0, 80.0],
      [13.1, 80.3], [16.0, 81.5], [17.7, 83.3], [19.5, 85.0], [21.5, 87.5],
      [22.5, 89.0], [24.0, 90.0], [26.0, 89.0], [27.0, 85.0], [28.5, 80.0],
      [31.0, 77.0], [33.0, 75.0], [31.5, 71.0], [27.0, 68.0], [25.0, 67.0],
      [23.5, 68.0],
    ],
  },
  // Thar Desert & Indus Basin (warm desert tones)
  {
    type: 'desert',
    name: 'Thar',
    coords: [
      [28.0, 70.0], [28.5, 73.0], [26.0, 74.0], [24.0, 71.5], [25.5, 69.5],
      [28.0, 70.0],
    ],
  },
  // Himalayas & Tibetan Plateau Snowcaps
  {
    type: 'snow',
    name: 'Himalayas',
    coords: [
      [29.5, 78.0], [31.0, 80.0], [30.5, 84.0], [28.5, 87.0], [28.0, 90.0],
      [29.5, 93.0], [33.0, 88.0], [34.0, 82.0], [33.5, 76.0], [31.5, 76.5],
      [29.5, 78.0],
    ],
  },
  // Sri Lanka
  {
    type: 'island',
    name: 'Sri Lanka',
    coords: [
      [9.8, 80.2], [9.0, 80.8], [8.0, 81.6], [6.5, 81.8], [5.9, 80.5],
      [6.9, 79.8], [8.5, 79.7], [9.8, 80.2],
    ],
  },
  // Arabian Peninsula (Desert & Mountains)
  {
    type: 'desert',
    name: 'Arabia',
    coords: [
      [12.8, 43.3], [14.0, 48.0], [17.0, 54.0], [22.5, 59.8], [24.0, 57.5],
      [26.2, 56.5], [25.5, 55.0], [24.5, 54.0], [24.0, 52.5], [26.0, 50.5],
      [29.0, 48.5], [30.0, 48.0], [28.0, 43.0], [28.0, 36.0], [22.0, 39.0],
      [16.0, 42.5], [12.8, 43.3],
    ],
  },
  // East Africa, Horn of Africa & Sahara
  {
    type: 'land',
    name: 'Africa',
    coords: [
      [30.0, 32.5], [25.0, 35.0], [20.0, 37.5], [15.5, 39.5], [12.0, 43.0],
      [11.8, 51.2], [8.0, 50.0], [3.0, 46.0], [-1.0, 42.0], [-5.0, 39.0],
      [-11.0, 40.5], [-16.0, 40.0], [-20.0, 35.5], [-26.0, 33.0], [-34.0, 26.0],
      [-34.8, 20.0], [-30.0, 17.5], [-22.0, 14.5], [-15.0, 12.0], [-5.0, 12.0],
      [4.0, 9.0], [6.0, 2.0], [4.5, -7.5], [11.0, -15.0], [15.0, -17.0],
      [21.0, -17.0], [28.0, -13.0], [35.0, -6.0], [36.0, 0.0], [37.0, 10.0],
      [31.5, 31.5], [30.0, 32.5],
    ],
  },
  // Madagascar
  {
    type: 'island',
    name: 'Madagascar',
    coords: [
      [-12.0, 49.3], [-15.5, 50.5], [-20.0, 48.5], [-25.5, 47.0], [-25.2, 44.5],
      [-20.0, 44.0], [-16.0, 44.5], [-12.0, 49.3],
    ],
  },
  // Southeast Asia (Myanmar, Thailand, Malaysia, Indochina)
  {
    type: 'land',
    name: 'SE Asia',
    coords: [
      [22.0, 91.5], [20.5, 93.0], [16.0, 94.5], [16.0, 97.0], [12.0, 98.6],
      [8.0, 98.3], [4.0, 100.5], [1.3, 103.8], [3.0, 103.5], [6.0, 102.0],
      [10.0, 99.5], [13.0, 100.5], [13.5, 101.0], [10.5, 107.5], [15.0, 109.0],
      [21.0, 108.0], [22.0, 105.0], [22.0, 91.5],
    ],
  },
  // Sumatra & Java
  {
    type: 'island',
    name: 'Sumatra',
    coords: [
      [5.5, 95.3], [3.0, 98.5], [-0.5, 101.5], [-4.5, 105.5], [-5.8, 106.0],
      [-5.0, 103.0], [-2.0, 100.5], [1.5, 97.5], [5.5, 95.3],
    ],
  },
  {
    type: 'island',
    name: 'Java',
    coords: [
      [-6.0, 106.0], [-6.5, 109.0], [-7.2, 112.5], [-8.2, 114.5], [-8.7, 111.0],
      [-7.8, 108.5], [-6.8, 105.5], [-6.0, 106.0],
    ],
  },
  // Andaman & Nicobar Archipelago
  {
    type: 'island',
    name: 'Andaman',
    coords: [
      [13.5, 93.0], [12.0, 92.8], [11.5, 92.7], [10.5, 92.6],
      [9.0, 92.8], [7.0, 93.8], [6.8, 93.8], [8.0, 93.5],
      [11.5, 93.0], [13.5, 93.0],
    ],
  },
  // Maldives & Lakshadweep Atoll Chain
  {
    type: 'island',
    name: 'Lakshadweep-Maldives',
    coords: [
      [11.5, 72.8], [10.5, 72.6], [8.5, 73.0], [6.0, 73.2], [3.0, 73.4],
      [0.5, 73.2], [-0.5, 73.2], [1.5, 73.6], [4.5, 73.5], [7.5, 73.0],
      [11.5, 72.8],
    ],
  },
  // Australia
  {
    type: 'land',
    name: 'Australia',
    coords: [
      [-12.0, 131.0], [-15.0, 136.0], [-12.0, 142.0], [-18.0, 146.0], [-24.0, 151.0],
      [-32.0, 153.0], [-38.0, 147.0], [-38.0, 141.0], [-35.0, 137.0], [-32.0, 132.0],
      [-32.0, 125.0], [-35.0, 116.0], [-28.0, 114.0], [-22.0, 114.0], [-18.0, 122.0],
      [-14.0, 126.0], [-12.0, 131.0],
    ],
  },
  // Eurasia / Mediterranean / North Asia
  {
    type: 'land',
    name: 'Eurasia',
    coords: [
      [36.0, -5.5], [43.0, -9.0], [48.0, -4.5], [51.0, 2.0], [54.0, 9.0],
      [58.0, 11.0], [60.0, 25.0], [65.0, 25.0], [70.0, 30.0], [70.0, 60.0],
      [70.0, 100.0], [60.0, 120.0], [45.0, 125.0], [35.0, 120.0], [25.0, 118.0],
      [22.0, 114.0], [30.0, 105.0], [35.0, 90.0], [40.0, 70.0], [42.0, 50.0],
      [40.0, 30.0], [36.0, 25.0], [40.0, 15.0], [38.0, 0.0], [36.0, -5.5],
    ],
  },
];

// Helper to estimate Sea Surface Temperature matching North Indian Ocean satellite data
function estimateSST(lat: number, lon: number): number {
  if (lat >= 5 && lat <= 30 && lon >= 45 && lon <= 105) {
    const latFactor = (30 - lat) / 25; // 0 at 30°N, 1 at 5°N
    const base = 22.5 + latFactor * 7.2;
    const lonShift = lon < 77.5 ? -0.3 : 0.4;
    return Number((base + lonShift).toFixed(1));
  }
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
  expanded = false,
  onToggleExpand,
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
  const [scale, setScale] = useState<number>(compact && !expanded ? 1.05 : 1.35);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Photorealistic Layer Toggles
  const [showSst, setShowSst] = useState<boolean>(true);
  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [showNightLights, setShowNightLights] = useState<boolean>(true);
  const [showGraticules, setShowGraticules] = useState<boolean>(true);

  // Sunlight / Day-Night Phase Angle (slowly rotates around the planet)
  const [sunAngle, setSunAngle] = useState<number>(0.65); // angle in radians

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
  const [cloudOffset, setCloudOffset] = useState<number>(0);

  // Pre-generate deep space starfield
  const stars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    const colors = ['#ffffff', '#e0f2fe', '#bae6fd', '#fef3c7', '#fed7aa'];
    for (let i = 0; i < 180; i++) {
      list.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.75 + 0.25,
        twinkleSpeed: Math.random() * 0.03 + 0.008,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return list;
  }, []);

  // Update scale when expanded changes
  useEffect(() => {
    if (expanded) {
      setScale(1.55);
    } else {
      setScale(compact ? 1.08 : 1.35);
    }
  }, [expanded, compact]);

  // 3D Spherical Orthographic Projection: (lat, lon) -> screen (x, y, visible, depth)
  const project = useCallback(
    (latDeg: number, lonDeg: number, cx: number, cy: number, radius: number) => {
      const phi = (latDeg * Math.PI) / 180;
      const lambda = (lonDeg * Math.PI) / 180;
      const deltaLambda = lambda - lambda0;

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
        depth: cosC, // 0 at horizon, 1 at center
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

      if (rho > radius) return null; // Outside globe sphere

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

  // Auto-rotation & cloud drift animation loop
  useEffect(() => {
    let animId: number;
    const tick = () => {
      if (autoRotate && !isDragging) {
        setLambda0((prev) => {
          let next = prev + 0.0016;
          if (next > Math.PI) next -= 2 * Math.PI;
          return next;
        });
      }
      setCloudOffset((prev) => prev + 0.0008);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [autoRotate, isDragging]);

  // Main Hyperrealistic Canvas Rendering Loop
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
    const baseRadius = Math.min(width, height) * 0.44;
    const radius = baseRadius * scale;

    ctx.clearRect(0, 0, width, height);

    // 1. Deep Space Cosmic Background with Twinkling Stars
    const spaceGrad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, width * 0.8);
    spaceGrad.addColorStop(0, '#0a1626');
    spaceGrad.addColorStop(0.5, '#06101e');
    spaceGrad.addColorStop(1, '#020710');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Render distant starfield
    stars.forEach((star) => {
      const sx = star.x * width;
      const sy = star.y * height;
      // Skip stars directly behind the opaque globe center
      const distFromCenter = Math.hypot(sx - cx, sy - cy);
      if (distFromCenter < radius * 0.98) return;

      const twinkle = Math.sin(Date.now() * star.twinkleSpeed) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.opacity * twinkle;
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 2. Multi-layer Atmospheric Rayleigh Scattering (Outer Blue/Cyan Glow Halo)
    const haloOuter = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.22);
    haloOuter.addColorStop(0, 'rgba(56, 189, 248, 0.45)'); // Electric cyan
    haloOuter.addColorStop(0.3, 'rgba(30, 90, 180, 0.25)'); // Sapphire blue
    haloOuter.addColorStop(0.7, 'rgba(15, 40, 110, 0.1)');
    haloOuter.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloOuter;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // 3. Earth Globe Sphere Clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 3a. Photorealistic Ocean Base & Bathymetric Gradient
    // Simulated directional sunlight source at (cx - radius * 0.45, cy - radius * 0.4)
    const sunX = cx - radius * 0.45 * Math.cos(sunAngle);
    const sunY = cy - radius * 0.45 * Math.sin(sunAngle);

    const oceanGrad = ctx.createRadialGradient(
      sunX,
      sunY,
      radius * 0.1,
      cx,
      cy,
      radius * 1.05
    );
    oceanGrad.addColorStop(0, '#1c5585'); // Illuminated tropical ocean
    oceanGrad.addColorStop(0.35, '#10375c'); // Deep azure
    oceanGrad.addColorStop(0.75, '#09213d'); // Abyssal navy
    oceanGrad.addColorStop(1, '#030c17'); // Dark limb
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // 3b. Continental Shelf Shallow Reef Glow (Turquoise fringing waters around coasts)
    CONTINENT_POLYGONS.forEach((poly) => {
      ctx.beginPath();
      let started = false;
      poly.coords.forEach(([lat, lon]) => {
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
        ctx.strokeStyle = 'rgba(32, 163, 158, 0.35)'; // Turquoise reef shelf
        ctx.lineWidth = 9;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });

    // 3c. Graticules (Latitude & Longitude grid lines)
    if (showGraticules) {
      ctx.lineWidth = 0.75;
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
          ? 'rgba(217, 155, 33, 0.75)'
          : isTropic
          ? 'rgba(217, 155, 33, 0.4)'
          : 'rgba(180, 220, 255, 0.16)';
        ctx.lineWidth = isEquator ? 1.4 : 0.75;
        if (isTropic) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (let lon = -180; lon <= 180; lon += 15) {
        ctx.beginPath();
        let hasStarted = false;
        const isPrime = lon === 0 || lon === 70;
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
        ctx.strokeStyle = isPrime ? 'rgba(217, 155, 33, 0.55)' : 'rgba(180, 220, 255, 0.14)';
        ctx.lineWidth = isPrime ? 1.1 : 0.6;
        ctx.stroke();
      }
    }

    // 3d. Satellite Sea Surface Temperature (SST) Thermal Heat Map
    // High-resolution smooth fluid thermal gradient across North Indian Ocean (5-30°N, 42-100°E)
    if (showSst) {
      const sstLatSteps = 22;
      const sstLonSteps = 32;
      for (let i = 0; i < sstLatSteps; i++) {
        const lat1 = 5 + (i * 25) / sstLatSteps;
        const lat2 = 5 + ((i + 1) * 25) / sstLatSteps;
        for (let j = 0; j < sstLonSteps; j++) {
          const lon1 = 43 + (j * 57) / sstLonSteps;
          const lon2 = 43 + ((j + 1) * 57) / sstLonSteps;

          const p1 = project(lat1, lon1, cx, cy, radius);
          const p2 = project(lat1, lon2, cx, cy, radius);
          const p3 = project(lat2, lon2, cx, cy, radius);
          const p4 = project(lat2, lon1, cx, cy, radius);

          if (p1.visible && p2.visible && p3.visible && p4.visible) {
            const midLat = (lat1 + lat2) / 2;
            const midLon = (lon1 + lon2) / 2;
            const sstVal = estimateSST(midLat, midLon);

            // Rainbow Colormap: 22°C (Deep Blue) -> 25°C (Cyan) -> 27°C (Lime/Yellow) -> 29°C (Orange) -> 30°C (Crimson)
            const norm = Math.max(0, Math.min(1, (sstVal - 22.0) / 8.0));
            let r = 0, g = 0, b = 0;
            if (norm < 0.25) {
              const t = norm / 0.25;
              r = Math.round(15 + 10 * t);
              g = Math.round(40 + 175 * t);
              b = Math.round(210 + 40 * t);
            } else if (norm < 0.5) {
              const t = (norm - 0.25) / 0.25;
              r = Math.round(25 + 90 * t);
              g = Math.round(215 + 25 * t);
              b = Math.round(250 - 190 * t);
            } else if (norm < 0.75) {
              const t = (norm - 0.5) / 0.25;
              r = Math.round(115 + 135 * t);
              g = Math.round(240 - 45 * t);
              b = Math.round(60 - 50 * t);
            } else {
              const t = (norm - 0.75) / 0.25;
              r = Math.round(250 + 5 * t);
              g = Math.round(195 - 180 * t);
              b = Math.round(10 + 10 * t);
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.62)`;
            ctx.fill();
          }
        }
      }
    }

    // 3e. Photorealistic Continents & Biomes (Deserts, Forests, Mountains, Coastlines)
    CONTINENT_POLYGONS.forEach((poly) => {
      ctx.beginPath();
      let started = false;
      poly.coords.forEach(([lat, lon]) => {
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
        if (poly.type === 'desert') {
          // Warm desert dunes (Rub' al Khali / Thar)
          ctx.fillStyle = '#8f7754';
          ctx.strokeStyle = '#a88f6b';
        } else if (poly.type === 'snow') {
          // Glacial snowcaps (Himalayas)
          ctx.fillStyle = '#e8f1f5';
          ctx.strokeStyle = '#ffffff';
        } else if (poly.type === 'island') {
          // Tropical emerald islands
          ctx.fillStyle = '#2f6946';
          ctx.strokeStyle = '#489466';
        } else {
          // Lush continental vegetation
          ctx.fillStyle = '#31543e';
          ctx.strokeStyle = '#4e7e60';
        }
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();
      }
    });

    // 3f. Night Lights on Dark Hemisphere
    if (showNightLights) {
      NIGHT_LIGHT_CLUSTERS.forEach(([lat, lon, intensity]) => {
        const pt = project(lat, lon, cx, cy, radius);
        if (pt.visible) {
          // Only show on unlit/dusk side
          const sunDist = Math.hypot(pt.x - sunX, pt.y - sunY);
          if (sunDist > radius * 0.75) {
            const darkness = Math.min(1.0, (sunDist - radius * 0.75) / (radius * 0.4));
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.2 * intensity, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 214, 102, ${0.85 * darkness * intensity})`;
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      });
    }

    // 3g. Hyperrealistic Swirling Clouds & Intertropical Convergence Bands (ITCZ)
    if (showClouds) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      // Monsoonal cloud swirls over Indian Ocean
      for (let c = 0; c < 16; c++) {
        const cloudLat = 2 + Math.sin(c * 0.8 + cloudOffset * 2) * 9;
        const cloudLon = 40 + ((c * 18 + cloudOffset * 90) % 140);
        const pt = project(cloudLat, cloudLon, cx, cy, radius);
        if (pt.visible) {
          const cloudGrad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, radius * 0.18);
          cloudGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
          cloudGrad.addColorStop(0.5, 'rgba(235, 245, 255, 0.35)');
          cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = cloudGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 3h. Specular Solar Glint (Brilliant sun reflection on water surface)
    const glintPt = project(15, 68, cx, cy, radius);
    if (glintPt.visible) {
      const glintGrad = ctx.createRadialGradient(
        sunX + radius * 0.1,
        sunY + radius * 0.1,
        0,
        sunX + radius * 0.1,
        sunY + radius * 0.1,
        radius * 0.45
      );
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      glintGrad.addColorStop(0.3, 'rgba(200, 235, 255, 0.12)');
      glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glintGrad;
      ctx.beginPath();
      ctx.arc(sunX + radius * 0.1, sunY + radius * 0.1, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3i. Atmospheric Limb Fresnel Darkening (Smooth edge shading on the 3D sphere)
    const sphereRim = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.72,
      cx,
      cy,
      radius
    );
    sphereRim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    sphereRim.addColorStop(0.7, 'rgba(0, 15, 35, 0.2)');
    sphereRim.addColorStop(0.95, 'rgba(4, 18, 42, 0.65)');
    sphereRim.addColorStop(1, 'rgba(40, 120, 200, 0.55)'); // Bright inner limb scattering
    ctx.fillStyle = sphereRim;
    ctx.fillRect(0, 0, width, height);

    // 3j. Study Region Boundary Box (North Indian Ocean: 5-30°N, 45-105°E)
    ctx.strokeStyle = '#D99B21';
    ctx.lineWidth = 1.6;
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
      for (let s = 0; s <= 12; s++) {
        const clat = l1 + ((l2 - l1) * s) / 12;
        const clon = o1 + ((o2 - o1) * s) / 12;
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

    // 3k. Active Cast Indicators (Argo Floats & Reconstructions)
    activeCasts.forEach((cast) => {
      const pt = project(cast.lat, cast.lon, cx, cy, radius);
      if (!pt.visible) return;

      const isCastActive = cast.isActive;
      // Pulsing outer beacon circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isCastActive ? 16 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isCastActive ? 'rgba(217, 155, 33, 0.4)' : 'rgba(131, 137, 33, 0.3)';
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isCastActive ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isCastActive ? '#D99B21' : '#FAF7BB';
      ctx.strokeStyle = '#0a1d33';
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();

      // Label Tag
      ctx.font = isCastActive ? 'bold 11px "Space Mono"' : '10px "Space Mono"';
      ctx.fillStyle = isCastActive ? '#FAF7BB' : 'rgba(250, 247, 187, 0.85)';
      ctx.fillText(cast.name.split('(')[0].trim(), pt.x + 9, pt.y - 4);
    });

    // 3l. Pinned Custom Point (User dropped target beacon)
    if (pinnedPoint) {
      const pt = project(pinnedPoint.lat, pinnedPoint.lon, cx, cy, radius);
      if (pt.visible) {
        // Multi-ring radar pulse
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(217, 155, 33, 0.6)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target crosshair
        ctx.beginPath();
        ctx.moveTo(pt.x - 11, pt.y);
        ctx.lineTo(pt.x + 11, pt.y);
        ctx.moveTo(pt.x, pt.y - 11);
        ctx.lineTo(pt.x, pt.y + 11);
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Pin center marker
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FAF7BB';
        ctx.strokeStyle = '#0a1d33';
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        // Floating Coordinate Tag attached to the 3D pin
        const tagText = `${pinnedPoint.lat}°N, ${pinnedPoint.lon}°E`;
        ctx.font = 'bold 11px "Space Mono"';
        const textWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = '#0a1d33';
        ctx.strokeStyle = '#D99B21';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if ('roundRect' in ctx) {
          (ctx as any).roundRect(pt.x + 12, pt.y - 22, textWidth + 16, 24, 4);
        } else {
          ctx.rect(pt.x + 12, pt.y - 22, textWidth + 16, 24);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FAF7BB';
        ctx.fillText(tagText, pt.x + 20, pt.y - 6);
      }
    }

    ctx.restore(); // End sphere clip
  }, [
    lambda0,
    phi0,
    scale,
    project,
    activeCasts,
    pinnedPoint,
    showSst,
    showClouds,
    showNightLights,
    showGraticules,
    cloudOffset,
    sunAngle,
    stars,
  ]);

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
    const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.44 * scale;

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const sensitivity = 0.005 / scale;
      let newLambda = dragStartRef.current.lambda - dx * sensitivity;
      let newPhi = dragStartRef.current.phi + dy * sensitivity;

      newPhi = Math.max((-82 * Math.PI) / 180, Math.min((82 * Math.PI) / 180, newPhi));

      setLambda0(newLambda);
      setPhi0(newPhi);
    } else {
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
    const radius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.44 * scale;

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
      return Math.max(0.8, Math.min(2.8, next));
    });
  };

  const resetView = () => {
    setLambda0((68 * Math.PI) / 180);
    setPhi0((15 * Math.PI) / 180);
    setScale(expanded ? 1.55 : compact ? 1.08 : 1.35);
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
      className={`relative w-full overflow-hidden border border-[#294966] bg-[#050d1a] select-none transition-all duration-300 ${
        expanded
          ? 'h-[640px] sm:h-[720px]'
          : compact
          ? 'h-[460px] sm:h-[540px]'
          : 'h-[540px] sm:h-[640px]'
      }`}
    >
      {/* 3D Canvas Viewport */}
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

      {/* Top Banner: Domain Info & Mission Kicker */}
      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 border border-[#FAF7BB]/15 bg-[#0a1d33]/85 px-3 py-1.5 text-[10px] text-[#FAF7BB]/90 backdrop-blur rounded-sm shadow-md">
        <span className="h-2 w-2 rounded-full bg-[#D99B21] animate-pulse" />
        <span className="font-semibold tracking-wider uppercase font-data">Hyperrealistic 3D Earth</span>
        <span className="font-data text-[#FAF7BB]/45 hidden sm:inline">· North Indian Ocean (5–30°N, 45–105°E)</span>
      </div>

      {/* Top Layer Toggles (SST, Clouds, Night Lights, Graticule) */}
      <div className="absolute left-4 top-13 flex flex-wrap items-center gap-1.5 border border-[#FAF7BB]/10 bg-[#0a1d33]/75 p-1 backdrop-blur rounded-sm shadow-md">
        <button
          type="button"
          onClick={() => setShowSst((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold font-data rounded-xs transition-colors ${
            showSst ? 'bg-[#D99B21] text-[#0a1d33]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Sea Surface Temperature Heatmap"
        >
          <Flame size={11} /> SST
        </button>
        <button
          type="button"
          onClick={() => setShowClouds((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold font-data rounded-xs transition-colors ${
            showClouds ? 'bg-[#38bdf8] text-[#0a1d33]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Dynamic Weather Clouds"
        >
          <Cloud size={11} /> Clouds
        </button>
        <button
          type="button"
          onClick={() => setShowNightLights((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold font-data rounded-xs transition-colors ${
            showNightLights ? 'bg-[#fef08a] text-[#0a1d33]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'
          }`}
          title="Toggle City Night Lights"
        >
          <Moon size={11} /> Lights
        </button>
        <button
          type="button"
          onClick={() => setShowGraticules((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold font-data rounded-xs transition-colors ${
            showGraticules ? 'bg-[#FAF7BB]/20 text-[#FAF7BB]' : 'text-[#FAF7BB]/60 hover:bg-[#FAF7BB]/10'
          }`}
          title="Toggle Coordinate Graticule Grid"
        >
          <Grid size={11} /> Grid
        </button>
      </div>

      {/* Floating Control Toolbar */}
      <div className="absolute right-4 top-4 flex flex-col gap-1.5 border border-[#FAF7BB]/15 bg-[#0a1d33]/85 p-1 backdrop-blur rounded-sm shadow-xl">
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            title={expanded ? 'Compress View' : 'Expand Globe to Full Width'}
            className="p-1.5 text-[#D99B21] hover:bg-[#FAF7BB]/15 transition-colors rounded-sm"
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.8, s + 0.18))}
          title="Zoom In"
          className="p-1.5 text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/15 hover:text-[#FAF7BB] transition-colors rounded-sm"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.8, s - 0.18))}
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
        <div className="pointer-events-none absolute left-4 bottom-14 flex items-center gap-2 border border-[#D99B21]/50 bg-[#0a1d33]/92 px-3.5 py-1.5 text-xs text-[#FAF7BB] backdrop-blur rounded-sm shadow-2xl font-data">
          <Crosshair size={13} className="text-[#D99B21]" />
          <span>
            Lat: <strong className="text-[#FAF7BB]">{hoverCoord.lat}°N</strong>, Lon:{' '}
            <strong className="text-[#FAF7BB]">{hoverCoord.lon}°E</strong>
          </span>
          <span className="text-[#FAF7BB]/40">·</span>
          <span className="text-[#FAF7BB]/80 truncate max-w-[150px]">{hoverCoord.region}</span>
          <span className="text-[#FAF7BB]/40">·</span>
          <span className="text-[#D99B21] font-bold">~{hoverCoord.sst}°C</span>
        </div>
      )}

      {/* Interactive Pinned Point Details Popover Card */}
      {pinnedPoint && (
        <div className="absolute right-4 bottom-4 z-20 w-80 rounded-sm border border-[#D99B21]/60 bg-[#0a1d33]/96 p-4 text-[#FAF7BB] shadow-2xl backdrop-blur animate-rise">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#FAF7BB]/15">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D99B21]">
              <MapPin size={15} />
              <span>Target Point Coordinates</span>
            </div>
            <button
              type="button"
              onClick={() => setPinnedPoint(null)}
              className="text-[#FAF7BB]/50 hover:text-[#FAF7BB] transition-colors p-0.5"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 font-data">
            <div className="rounded bg-[#FAF7BB]/10 p-2.5">
              <span className="block text-[9px] uppercase tracking-wider text-[#FAF7BB]/60">Latitude</span>
              <span className="text-base font-bold text-[#FAF7BB]">{pinnedPoint.lat}°N</span>
            </div>
            <div className="rounded bg-[#FAF7BB]/10 p-2.5">
              <span className="block text-[9px] uppercase tracking-wider text-[#FAF7BB]/60">Longitude</span>
              <span className="text-base font-bold text-[#FAF7BB]">{pinnedPoint.lon}°E</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs mb-3.5">
            <div className="flex justify-between text-[#FAF7BB]/80">
              <span>Basin / Sector:</span>
              <strong className="text-[#FAF7BB] truncate max-w-[180px] text-right font-medium">
                {pinnedPoint.region}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#FAF7BB]/80">
              <span className="flex items-center gap-1">
                <Flame size={13} className="text-[#D99B21]" /> Satellite Surface Temp:
              </span>
              <strong className="text-[#D99B21] font-data font-bold text-sm">{pinnedPoint.sst}°C</strong>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onLaunchReconstruction?.(pinnedPoint.lat, pinnedPoint.lon, pinnedPoint.sst)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-sm bg-[#D99B21] hover:bg-[#b88015] px-3 py-2 text-xs font-bold text-[#0a1d33] transition-colors shadow-sm"
            >
              <Sparkles size={14} /> Reconstruct Here
            </button>
            <button
              type="button"
              onClick={copyCoordinates}
              className="rounded-sm border border-[#FAF7BB]/25 px-2.5 py-2 text-xs text-[#FAF7BB] hover:bg-[#FAF7BB]/15 transition-colors"
              title="Copy coordinates"
            >
              {copied ? <Check size={15} className="text-[#838921]" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Bar: Instructions & Colorbar Scale */}
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between pointer-events-none">
        <div className="text-[10px] text-[#FAF7BB]/65 hidden sm:block pointer-events-auto bg-[#0a1d33]/70 px-3 py-1.5 rounded-sm border border-[#FAF7BB]/10 backdrop-blur">
          <div>• Drag to rotate 360° · Scroll wheel to zoom</div>
          <div>• Click anywhere on 3D Earth to drop pin & inspect Lat/Lon</div>
        </div>

        {/* Satellite SST Colorbar Legend (22°C to 30°C) matching media_1790144942227.jpg */}
        {showSst && (
          <div className="w-56 pointer-events-auto bg-[#0a1d33]/85 p-2 rounded-sm border border-[#FAF7BB]/15 backdrop-blur shadow-lg">
            <div className="mb-1 flex justify-between font-data text-[9px] text-[#FAF7BB]/85 font-semibold">
              <span>22°C (Upwelling)</span>
              <span>SST Colormap</span>
              <span>30°C (Warm Pool)</span>
            </div>
            <div className="h-2.5 rounded-sm bg-gradient-to-r from-[#1940ff] via-[#00e1ff] via-[#4dff00] via-[#ffff00] via-[#ff7700] to-[#e60000]" />
          </div>
        )}
      </div>
    </div>
  );
}
