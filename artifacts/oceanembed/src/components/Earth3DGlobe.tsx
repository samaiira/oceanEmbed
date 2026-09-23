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
  Grid,
} from 'lucide-react';

import earthDayUrl from '@/assets/earth_daymap.jpg';
import earthCloudsUrl from '@/assets/earth_clouds.png';
import earthLightsUrl from '@/assets/earth_lights.png';
import sstTextureUrl from '@/assets/sst_north_indian_ocean.jpg';

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

// Helper to estimate realistic ocean temperature (°C)
function estimateSST(lat: number, lon: number): number {
  if (lat >= 5 && lat <= 30 && lon >= 45 && lon <= 105) {
    if (lon < 77.5) {
      if (lat > 22) return 24.8;
      if (lat > 16) return 26.5;
      if (lat > 10) return 28.2;
      return 29.0;
    } else {
      if (lat > 18) return 27.8;
      if (lat > 12) return 28.6;
      return 29.4;
    }
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

// -------------------------------------------------------------
// WebGL Shader Source Codes
// -------------------------------------------------------------
const VS_SOURCE = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FS_SOURCE = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_lambda0; // Longitude rotation (radians)
uniform float u_phi0;    // Latitude tilt (radians)
uniform vec3 u_sun_dir;  // Normalized sun direction in world coords
uniform float u_cloud_offset;

uniform sampler2D u_day_tex;
uniform sampler2D u_night_tex;
uniform sampler2D u_clouds_tex;
uniform sampler2D u_sst_tex;

uniform float u_show_sst;
uniform float u_show_clouds;
uniform float u_show_lights;
uniform float u_show_grid;

#define PI 3.141592653589793

// Takes view-space unit vector (x, y, z) -> world-space vector
vec3 viewToWorld(vec3 v) {
  // Rotate around X-axis by +phi0
  float cP = cos(u_phi0);
  float sP = sin(u_phi0);
  vec3 p1 = vec3(v.x, v.y * cP + v.z * sP, -v.y * sP + v.z * cP);
  
  // Rotate around Y-axis by +lambda0
  float cL = cos(u_lambda0);
  float sL = sin(u_lambda0);
  return vec3(p1.x * cL + p1.z * sL, p1.y, -p1.x * sL + p1.z * cL);
}

// Takes world-space vector -> view-space vector
vec3 worldToView(vec3 w) {
  float cL = cos(-u_lambda0);
  float sL = sin(-u_lambda0);
  vec3 p1 = vec3(w.x * cL - w.z * sL, w.y, w.x * sL + w.z * cL);
  
  float cP = cos(-u_phi0);
  float sP = sin(-u_phi0);
  return vec3(p1.x, p1.y * cP - p1.z * sP, p1.y * sP + p1.z * cP);
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  vec2 d = (pixel - u_center) / u_radius;
  float r2 = dot(d, d);
  float r = sqrt(r2);

  // Beyond Globe Radius: Deep space & atmospheric halo
  if (r > 1.0) {
    float dist = r - 1.0;
    // Outer Rayleigh atmospheric scattering glow
    float halo = exp(-dist * 18.0) * 0.45;
    
    vec3 sunView = worldToView(u_sun_dir);
    float sunFacing = max(0.0, dot(normalize(vec3(d, 0.2)), sunView));
    float haloIntensity = halo * (0.35 + 0.65 * pow(sunFacing, 1.5));
    vec3 haloCol = vec3(0.2, 0.55, 0.98) * haloIntensity;

    // Distant Stars
    vec2 starSeed = floor(pixel * 0.75);
    float starRnd = fract(sin(dot(starSeed, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 starCol = vec3(0.0);
    if (starRnd > 0.9982) {
      float bright = fract(starRnd * 89.1) * 0.7 + 0.3;
      starCol = vec3(bright * 0.9, bright * 0.95, bright);
    }

    gl_FragColor = vec4(haloCol + starCol, 1.0);
    return;
  }

  // Inside Globe: Photorealistic 3D Earth
  float z = sqrt(max(0.0, 1.0 - r2));
  vec3 normView = vec3(d.x, d.y, z);
  vec3 normWorld = viewToWorld(normView);

  // Lat / Lon
  float lat = asin(clamp(normWorld.y, -1.0, 1.0));
  float lon = atan(normWorld.x, normWorld.z);

  // UV mapping
  float u = lon / (2.0 * PI) + 0.5;
  float v = 0.5 - lat / PI;

  // 1. Day texture (NASA Blue Marble)
  vec4 dayTex = texture2D(u_day_tex, vec2(fract(u), clamp(v, 0.001, 0.999)));

  // Ocean mask: oceans are darker with strong blue dominance
  float oceanMask = clamp((dayTex.b - dayTex.r * 1.05) * 4.0, 0.0, 1.0);
  if (lat > 1.25 || lat < -1.15) oceanMask = 0.0; // Polar ice

  // 2. Solar Illumination & Day-Night Terminator
  float NdotL = dot(normWorld, u_sun_dir);
  float sunIllum = smoothstep(-0.15, 0.20, NdotL);
  float nightIllum = 1.0 - smoothstep(-0.25, 0.08, NdotL);

  // 3. Night City Lights
  vec3 nightLightCol = vec3(0.0);
  if (u_show_lights > 0.5 && nightIllum > 0.01) {
    vec4 nightTex = texture2D(u_night_tex, vec2(fract(u), clamp(v, 0.001, 0.999)));
    nightLightCol = nightTex.rgb * 1.8 * nightIllum;
  }

  // 4. Cloud Layer
  vec4 cloudCol = vec4(0.0);
  if (u_show_clouds > 0.5) {
    float cloudU = fract(u + u_cloud_offset);
    vec4 cloudTex = texture2D(u_clouds_tex, vec2(cloudU, clamp(v, 0.001, 0.999)));
    cloudCol = cloudTex * 0.75;
  }

  // 5. SST Heatmap Overlay (North Indian Ocean Domain: 5-30°N, 45-105°E)
  vec4 sstCol = vec4(0.0);
  if (u_show_sst > 0.5 && oceanMask > 0.15) {
    float latDeg = lat * 180.0 / PI;
    float lonDeg = lon * 180.0 / PI;
    if (latDeg >= 5.0 && latDeg <= 30.0 && lonDeg >= 45.0 && lonDeg <= 105.0) {
      float uSst = (lonDeg - 45.0) / (105.0 - 45.0);
      float vSst = (30.0 - latDeg) / (30.0 - 5.0);
      vec4 sstSample = texture2D(u_sst_tex, vec2(clamp(uSst, 0.0, 1.0), clamp(vSst, 0.0, 1.0)));
      
      // Fluid Rainbow Thermal Colormap
      float estSst = 28.5 - abs(latDeg - 12.0) * 0.35 + sin(lonDeg * 0.1) * 0.6;
      float norm = clamp((estSst - 22.0) / 8.0, 0.0, 1.0);
      vec3 procHeat = vec3(
        clamp(1.5 - abs(norm * 4.0 - 3.0), 0.0, 1.0),
        clamp(1.5 - abs(norm * 4.0 - 2.0), 0.0, 1.0),
        clamp(1.5 - abs(norm * 4.0 - 1.0), 0.0, 1.0)
      );
      vec3 finalHeat = (sstSample.a > 0.1 && (sstSample.r + sstSample.g + sstSample.b) > 0.1)
        ? sstSample.rgb
        : procHeat;
      sstCol = vec4(finalHeat, 0.62 * oceanMask);
    }
  }

  // 6. Specular Solar Glint on Oceans
  vec3 sunView = worldToView(u_sun_dir);
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfVec = normalize(sunView + viewDir);
  float spec = pow(max(0.0, dot(normView, halfVec)), 28.0) * oceanMask * sunIllum * (1.0 - cloudCol.a * 0.8);
  vec3 specCol = vec3(1.0, 0.95, 0.85) * spec * 0.65;

  // 7. Graticule Lines (Equator, Tropics, Grid)
  vec3 gridCol = vec3(0.0);
  if (u_show_grid > 0.5) {
    float latDeg = lat * 180.0 / PI;
    float lonDeg = lon * 180.0 / PI;
    float latMod = abs(mod(latDeg + 90.0, 15.0));
    float lonMod = abs(mod(lonDeg + 180.0, 15.0));
    float isEquator = 1.0 - smoothstep(0.0, 0.55, abs(latDeg));
    float isTropic = 1.0 - smoothstep(0.0, 0.45, abs(abs(latDeg) - 23.5));
    float gridLine = max(1.0 - smoothstep(0.0, 0.35, min(latMod, 15.0 - latMod)),
                         1.0 - smoothstep(0.0, 0.35, min(lonMod, 15.0 - lonMod)));
    if (isEquator > 0.1) {
      gridCol = vec3(0.85, 0.61, 0.13) * isEquator * 0.75;
    } else if (isTropic > 0.1) {
      gridCol = vec3(0.85, 0.61, 0.13) * isTropic * 0.45;
    } else if (gridLine > 0.1) {
      gridCol = vec3(0.6, 0.8, 1.0) * gridLine * 0.22;
    }
  }

  // 8. Surface Composite
  vec3 surfColor = dayTex.rgb * (0.10 + 0.90 * sunIllum);

  if (sstCol.a > 0.0) {
    surfColor = mix(surfColor, sstCol.rgb, sstCol.a);
  }
  surfColor += specCol;
  surfColor += nightLightCol;

  if (cloudCol.a > 0.0) {
    vec3 litCloud = cloudCol.rgb * (0.10 + 0.90 * sunIllum);
    surfColor = mix(surfColor, litCloud, cloudCol.a * (0.45 + 0.55 * sunIllum));
  }

  surfColor += gridCol;

  // 9. Atmospheric Fresnel Rim Glow
  float fresnel = pow(1.0 - z, 3.2);
  vec3 atmoCol = vec3(0.3, 0.65, 1.0) * fresnel * (0.25 + 0.75 * sunIllum) * 0.85;
  surfColor += atmoCol;

  gl_FragColor = vec4(surfColor, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function loadTexture(gl: WebGLRenderingContext, url: string): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Temporary 1x1 placeholder pixel while image loads
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([15, 35, 60, 255])
  );

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  img.src = url;
  return texture;
}

// -------------------------------------------------------------
// Component
// -------------------------------------------------------------
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

  // Default focus: North Indian Ocean / Arabian Sea (15°N, 68°E)
  const [lambda0, setLambda0] = useState<number>((68 * Math.PI) / 180);
  const [phi0, setPhi0] = useState<number>((15 * Math.PI) / 180);
  const [scale, setScale] = useState<number>(compact && !expanded ? 1.05 : 1.35);

  // USER REQUIREMENT: Stop revolving the Earth by default!
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Layer Toggles
  const [showSst, setShowSst] = useState<boolean>(true);
  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [showNightLights, setShowNightLights] = useState<boolean>(true);
  const [showGraticules, setShowGraticules] = useState<boolean>(true);

  // Fixed daylight sun vector (shining from ~Southeast to light up Indian Ocean)
  const sunDir = useMemo<[number, number, number]>(() => {
    const latSun = (12 * Math.PI) / 180;
    const lonSun = (75 * Math.PI) / 180;
    return [
      Math.cos(latSun) * Math.sin(lonSun),
      Math.sin(latSun),
      Math.cos(latSun) * Math.cos(lonSun),
    ];
  }, []);

  // Interaction State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; lambda: number; phi: number }>({
    x: 0,
    y: 0,
    lambda: 0,
    phi: 0,
  });

  // Coordinates
  const [hoverCoord, setHoverCoord] = useState<{
    lat: number;
    lon: number;
    x: number;
    y: number;
    sst: number;
    region: string;
  } | null>(null);

  const [pinnedPoint, setPinnedPoint] = useState<PinnedPoint | null>(() => {
    if (initialPin) {
      return {
        lat: initialPin.lat,
        lon: initialPin.lon,
        sst: estimateSST(initialPin.lat, initialPin.lon),
        region: resolveOceanRegion(initialPin.lat, initialPin.lon),
        depths: [0, 10, 20, 50, 100, 200, 500, 1000],
      };
    }
    return null;
  });

  const [copied, setCopied] = useState<boolean>(false);

  // WebGL State Refs
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const texturesRef = useRef<{
    day: WebGLTexture | null;
    night: WebGLTexture | null;
    clouds: WebGLTexture | null;
    sst: WebGLTexture | null;
  }>({
    day: null,
    night: null,
    clouds: null,
    sst: null,
  });

  // Project (lat, lon) in degrees to 2D screen coordinates
  const project = useCallback(
    (latDeg: number, lonDeg: number, cx: number, cy: number, radius: number) => {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180;

      // World vector
      const wx = Math.cos(lat) * Math.sin(lon);
      const wy = Math.sin(lat);
      const wz = Math.cos(lat) * Math.cos(lon);

      // Rotate around Y by -lambda0
      const cL = Math.cos(-lambda0);
      const sL = Math.sin(-lambda0);
      const p1x = wx * cL - wz * sL;
      const p1y = wy;
      const p1z = wx * sL + wz * cL;

      // Rotate around X by -phi0
      const cP = Math.cos(-phi0);
      const sP = Math.sin(-phi0);
      const vx = p1x;
      const vy = p1y * cP - p1z * sP;
      const vz = p1y * sP + p1z * cP;

      const visible = vz > 0;
      const x = cx + vx * radius;
      const y = cy - vy * radius;

      return { x, y, visible, z: vz };
    },
    [lambda0, phi0]
  );

  // Raycast screen pixel (x, y) to spherical (lat, lon)
  const unproject = useCallback(
    (pixelX: number, pixelY: number, cx: number, cy: number, radius: number) => {
      const nx = (pixelX - cx) / radius;
      const ny = -(pixelY - cy) / radius;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1.0) return null;

      const nz = Math.sqrt(Math.max(0, 1.0 - r2));

      // Rotate around X by +phi0
      const cP = Math.cos(phi0);
      const sP = Math.sin(phi0);
      const p1x = nx;
      const p1y = ny * cP + nz * sP;
      const p1z = -ny * sP + nz * cP;

      // Rotate around Y by +lambda0
      const cL = Math.cos(lambda0);
      const sL = Math.sin(lambda0);
      const wx = p1x * cL + p1z * sL;
      const wy = p1y;
      const wz = -p1x * sL + p1z * cL;

      const latRad = Math.asin(Math.max(-1, Math.min(1, wy)));
      const lonRad = Math.atan2(wx, wz);

      const lat = Number(((latRad * 180) / Math.PI).toFixed(2));
      const lon = Number(((lonRad * 180) / Math.PI).toFixed(2));

      return { lat, lon };
    },
    [lambda0, phi0]
  );

  // -------------------------------------------------------------
  // WebGL Initialization & Render Loop
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', { antialias: true, alpha: false }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      console.warn('WebGL not supported on this device');
      return;
    }
    glRef.current = gl;

    const program = createProgram(gl, VS_SOURCE, FS_SOURCE);
    if (!program) return;
    programRef.current = program;

    // Fullscreen quad buffer
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    // Load Photorealistic Textures
    texturesRef.current = {
      day: loadTexture(gl, earthDayUrl),
      night: loadTexture(gl, earthLightsUrl),
      clouds: loadTexture(gl, earthCloudsUrl),
      sst: loadTexture(gl, sstTextureUrl),
    };

    let animationFrameId: number;
    let cloudOffset = 0;

    const render = () => {
      if (!canvas || !gl || !programRef.current) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.05, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(programRef.current);

      // Bind quad vertices
      const posLoc = gl.getAttribLocation(programRef.current, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const cx = (width * dpr) / 2;
      const cy = (height * dpr) / 2;
      const radius = (Math.min(width, height) / 2) * 0.76 * scale * dpr;

      // Set Uniforms
      gl.uniform2f(gl.getUniformLocation(programRef.current, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(programRef.current, 'u_center'), cx, cy);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_radius'), radius);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_lambda0'), lambda0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_phi0'), phi0);
      gl.uniform3f(gl.getUniformLocation(programRef.current, 'u_sun_dir'), sunDir[0], sunDir[1], sunDir[2]);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_cloud_offset'), cloudOffset);

      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_show_sst'), showSst ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_show_clouds'), showClouds ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_show_lights'), showNightLights ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(programRef.current, 'u_show_grid'), showGraticules ? 1.0 : 0.0);

      // Textures
      const texs = texturesRef.current;
      if (texs.day) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texs.day);
        gl.uniform1i(gl.getUniformLocation(programRef.current, 'u_day_tex'), 0);
      }
      if (texs.night) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texs.night);
        gl.uniform1i(gl.getUniformLocation(programRef.current, 'u_night_tex'), 1);
      }
      if (texs.clouds) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texs.clouds);
        gl.uniform1i(gl.getUniformLocation(programRef.current, 'u_clouds_tex'), 2);
      }
      if (texs.sst) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, texs.sst);
        gl.uniform1i(gl.getUniformLocation(programRef.current, 'u_sst_tex'), 3);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Very subtle cloud drift without revolving the earth
      if (showClouds) {
        cloudOffset = (cloudOffset + 0.00004) % 1.0;
      }

      // If user explicitly enabled auto-rotate
      if (autoRotate && !isDragging) {
        setLambda0((prev) => (prev + 0.002) % (Math.PI * 2));
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    lambda0,
    phi0,
    scale,
    autoRotate,
    isDragging,
    showSst,
    showClouds,
    showNightLights,
    showGraticules,
    sunDir,
  ]);

  // -------------------------------------------------------------
  // Mouse & Touch Controls
  // -------------------------------------------------------------
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

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const sens = 0.0045 / scale;

      let nextLambda = dragStartRef.current.lambda + dx * sens;
      while (nextLambda > Math.PI) nextLambda -= Math.PI * 2;
      while (nextLambda < -Math.PI) nextLambda += Math.PI * 2;

      let nextPhi = dragStartRef.current.phi - dy * sens;
      nextPhi = Math.max(-1.4, Math.min(1.4, nextPhi));

      setLambda0(nextLambda);
      setPhi0(nextPhi);
    } else {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const radius = (Math.min(canvas.clientWidth, canvas.clientHeight) / 2) * 0.76 * scale;

      const hit = unproject(mouseX, mouseY, cx, cy, radius);
      if (hit) {
        setHoverCoord({
          lat: hit.lat,
          lon: hit.lon,
          x: mouseX,
          y: mouseY,
          sst: estimateSST(hit.lat, hit.lon),
          region: resolveOceanRegion(hit.lat, hit.lon),
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
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const radius = (Math.min(canvas.clientWidth, canvas.clientHeight) / 2) * 0.76 * scale;

    const hit = unproject(mouseX, mouseY, cx, cy, radius);
    if (hit) {
      const sst = estimateSST(hit.lat, hit.lon);
      const region = resolveOceanRegion(hit.lat, hit.lon);
      const point: PinnedPoint = {
        lat: hit.lat,
        lon: hit.lon,
        sst,
        region,
        depths: [0, 10, 20, 50, 100, 200, 500, 1000],
      };
      setPinnedPoint(point);
      onDropPin?.(point);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.65, Math.min(3.2, prev - e.deltaY * 0.0012)));
  };

  const resetToNorthIndianOcean = () => {
    setLambda0((68 * Math.PI) / 180);
    setPhi0((15 * Math.PI) / 180);
    setScale(compact && !expanded ? 1.05 : 1.35);
  };

  const copyCoords = () => {
    if (!pinnedPoint) return;
    navigator.clipboard.writeText(`${pinnedPoint.lat}, ${pinnedPoint.lon}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dimensions for overlay pin calculations
  const canvas = canvasRef.current;
  const width = canvas ? canvas.clientWidth : 800;
  const height = canvas ? canvas.clientHeight : 500;
  const cx = width / 2;
  const cy = height / 2;
  const radius = (Math.min(width, height) / 2) * 0.76 * scale;

  // Screen positions for overlay elements
  const pinnedScreen = pinnedPoint ? project(pinnedPoint.lat, pinnedPoint.lon, cx, cy, radius) : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-[#294966] bg-[#030a14] select-none transition-all duration-300 ${
        expanded
          ? 'h-[640px] sm:h-[720px]'
          : compact
          ? 'h-[480px] sm:h-[550px]'
          : 'h-[560px] sm:h-[650px]'
      }`}
    >
      {/* 1. Photorealistic WebGL 3D Earth Canvas */}
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

      {/* 2. Interactive SVG Pin Overlay (Active Runs & Pinned Coordinates) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden">
        {/* Active Cast Markers */}
        {activeCasts.map((cast) => {
          const pt = project(cast.lat, cast.lon, cx, cy, radius);
          if (!pt.visible) return null;
          return (
            <g
              key={cast.id}
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelectCast?.(cast.name)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={cast.isActive ? 7 : 4.5}
                fill={cast.isActive ? '#D99B21' : '#20a39e'}
                stroke="#FAF7BB"
                strokeWidth={1.5}
              />
              {cast.isActive && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={14}
                  fill="none"
                  stroke="#D99B21"
                  strokeWidth={1.5}
                  className="animate-ping"
                  opacity={0.7}
                />
              )}
            </g>
          );
        })}

        {/* Selected / Pinned Location Marker */}
        {pinnedScreen && pinnedScreen.visible && (
          <g className="pointer-events-none">
            {/* Pulsing Target Radar Rings */}
            <circle
              cx={pinnedScreen.x}
              cy={pinnedScreen.y}
              r={18}
              fill="none"
              stroke="#D99B21"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              className="animate-spin"
              style={{ animationDuration: '6s' }}
            />
            <circle
              cx={pinnedScreen.x}
              cy={pinnedScreen.y}
              r={28}
              fill="none"
              stroke="#D99B21"
              strokeWidth={1}
              opacity={0.4}
              className="animate-pulse"
            />
            {/* Crosshairs */}
            <line
              x1={pinnedScreen.x - 12}
              y1={pinnedScreen.y}
              x2={pinnedScreen.x + 12}
              y2={pinnedScreen.y}
              stroke="#FAF7BB"
              strokeWidth={1.5}
            />
            <line
              x1={pinnedScreen.x}
              y1={pinnedScreen.y - 12}
              x2={pinnedScreen.x}
              y2={pinnedScreen.y + 12}
              stroke="#FAF7BB"
              strokeWidth={1.5}
            />
            {/* Core Pin */}
            <circle
              cx={pinnedScreen.x}
              cy={pinnedScreen.y}
              r={4}
              fill="#D99B21"
              stroke="#FAF7BB"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* 3. Top Banner: Mission Kicker & Domain */}
      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 border border-[#FAF7BB]/15 bg-[#0a1d33]/85 px-3 py-1.5 text-[10px] text-[#FAF7BB]/90 backdrop-blur rounded-sm shadow-md">
        <span className="h-2 w-2 rounded-full bg-[#20a39e]" />
        <span className="font-semibold tracking-wider uppercase font-data">Satellite Photorealistic 3D Earth</span>
        <span className="font-data text-[#FAF7BB]/45 hidden sm:inline">· North Indian Ocean (5–30°N, 45–105°E)</span>
      </div>

      {/* 4. Top-Right: Photorealistic Layer Toggles */}
      <div className="absolute right-4 top-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowSst((prev) => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-sm border transition-all ${
            showSst
              ? 'border-[#D99B21] bg-[#D99B21]/20 text-[#FAF7BB] shadow-sm'
              : 'border-[#FAF7BB]/20 bg-[#0a1d33]/80 text-[#FAF7BB]/60 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Satellite Sea Surface Temperature Thermal Overlay"
        >
          <Flame size={12} className={showSst ? 'text-[#D99B21]' : ''} />
          <span>SST Heat</span>
        </button>

        <button
          type="button"
          onClick={() => setShowClouds((prev) => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-sm border transition-all ${
            showClouds
              ? 'border-[#38bdf8] bg-[#38bdf8]/20 text-[#FAF7BB] shadow-sm'
              : 'border-[#FAF7BB]/20 bg-[#0a1d33]/80 text-[#FAF7BB]/60 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Dynamic Atmospheric Clouds"
        >
          <Cloud size={12} className={showClouds ? 'text-[#38bdf8]' : ''} />
          <span>Clouds</span>
        </button>

        <button
          type="button"
          onClick={() => setShowNightLights((prev) => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-sm border transition-all ${
            showNightLights
              ? 'border-[#fbbf24] bg-[#fbbf24]/20 text-[#FAF7BB] shadow-sm'
              : 'border-[#FAF7BB]/20 bg-[#0a1d33]/80 text-[#FAF7BB]/60 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Nocturnal City Lights"
        >
          <Sun size={12} className={showNightLights ? 'text-[#fbbf24]' : ''} />
          <span>City Lights</span>
        </button>

        <button
          type="button"
          onClick={() => setShowGraticules((prev) => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-sm border transition-all ${
            showGraticules
              ? 'border-[#20a39e] bg-[#20a39e]/20 text-[#FAF7BB] shadow-sm'
              : 'border-[#FAF7BB]/20 bg-[#0a1d33]/80 text-[#FAF7BB]/60 hover:text-[#FAF7BB]'
          }`}
          title="Toggle Graticule Grid"
        >
          <Grid size={12} className={showGraticules ? 'text-[#20a39e]' : ''} />
          <span>Grid</span>
        </button>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-sm border border-[#FAF7BB]/20 bg-[#0a1d33]/80 text-[#FAF7BB]/80 hover:text-[#FAF7BB] transition-all ml-1"
            title={expanded ? 'Minimize view' : 'Maximize full-width'}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>

      {/* 5. Left Floating HUD: Live Lat/Lon Raycast Info */}
      <div className="absolute left-4 bottom-4 flex flex-col gap-2 max-w-[280px]">
        {hoverCoord && (
          <div className="border border-[#FAF7BB]/20 bg-[#0a1d33]/90 p-2 text-xs text-[#FAF7BB] backdrop-blur rounded-sm shadow-lg pointer-events-none animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 font-data text-[10px] text-[#20a39e]">
              <Crosshair size={11} className="animate-spin" style={{ animationDuration: '4s' }} />
              <span>LIVE RAYCAST</span>
            </div>
            <div className="mt-1 font-bold text-sm font-data text-[#FAF7BB]">
              {hoverCoord.lat > 0 ? `${hoverCoord.lat}°N` : `${Math.abs(hoverCoord.lat)}°S`},{' '}
              {hoverCoord.lon > 0 ? `${hoverCoord.lon}°E` : `${Math.abs(hoverCoord.lon)}°W`}
            </div>
            <div className="mt-0.5 text-[11px] text-[#FAF7BB]/70 font-medium truncate">
              {hoverCoord.region}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-data text-[#FAF7BB]/60 border-t border-[#FAF7BB]/10 pt-1">
              <span>EST. SST: <strong className="text-[#D99B21]">{hoverCoord.sst}°C</strong></span>
              <span className="text-[#FAF7BB]/40">Click to pin</span>
            </div>
          </div>
        )}

        {/* SST Thermal Legend Bar */}
        {showSst && (
          <div className="border border-[#FAF7BB]/15 bg-[#0a1d33]/85 p-2 rounded-sm backdrop-blur text-[10px] text-[#FAF7BB]/80 shadow-md">
            <div className="flex items-center justify-between font-data font-semibold text-[9px] mb-1">
              <span className="text-[#38bdf8]">22°C (Min)</span>
              <span className="text-[#FAF7BB]/60">SST Gradient</span>
              <span className="text-[#ef4444]">30°C (Max)</span>
            </div>
            <div
              className="h-2 w-full rounded-sm shadow-inner"
              style={{
                background:
                  'linear-gradient(to right, #001080 0%, #0088ff 25%, #00ff88 50%, #ffee00 75%, #ff2200 100%)',
              }}
            />
          </div>
        )}
      </div>

      {/* 6. Right Floating Panel: Pinned Coordinates Card */}
      {pinnedPoint && (
        <div className="absolute right-4 bottom-4 w-72 sm:w-80 border border-[#D99B21]/50 bg-[#0a1d33]/95 p-3.5 text-xs text-[#FAF7BB] backdrop-blur rounded-sm shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-[#FAF7BB]/15 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-[#D99B21]">
              <MapPin size={14} />
              <span className="text-xs uppercase tracking-wide">Target Selected</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={copyCoords}
                className="p-1 rounded hover:bg-[#FAF7BB]/10 text-[#FAF7BB]/70 hover:text-[#FAF7BB]"
                title="Copy coordinates"
              >
                {copied ? <Check size={13} className="text-[#20a39e]" /> : <Copy size={13} />}
              </button>
              <button
                type="button"
                onClick={() => setPinnedPoint(null)}
                className="p-1 rounded hover:bg-[#FAF7BB]/10 text-[#FAF7BB]/70 hover:text-[#FAF7BB]"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="mt-2.5">
            <div className="font-data text-lg font-bold text-[#FAF7BB]">
              {pinnedPoint.lat > 0 ? `${pinnedPoint.lat}°N` : `${Math.abs(pinnedPoint.lat)}°S`},{' '}
              {pinnedPoint.lon > 0 ? `${pinnedPoint.lon}°E` : `${Math.abs(pinnedPoint.lon)}°W`}
            </div>
            <p className="mt-0.5 text-xs text-[#20a39e] font-medium">{pinnedPoint.region}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-y border-[#FAF7BB]/10 py-2 font-data text-[11px]">
            <div>
              <span className="text-[#FAF7BB]/60 block text-[9px] uppercase">Sea Surface Temp</span>
              <strong className="text-sm font-bold text-[#D99B21]">{pinnedPoint.sst}°C</strong>
            </div>
            <div>
              <span className="text-[#FAF7BB]/60 block text-[9px] uppercase">Domain Coverage</span>
              <strong className="text-sm font-bold text-[#FAF7BB]">
                {pinnedPoint.lat >= 5 &&
                pinnedPoint.lat <= 30 &&
                pinnedPoint.lon >= 45 &&
                pinnedPoint.lon <= 105
                  ? 'In Domain'
                  : 'Outer'}
              </strong>
            </div>
          </div>

          {/* Depth Levels */}
          <div className="mt-2.5">
            <div className="text-[10px] text-[#FAF7BB]/60 uppercase font-data mb-1">
              Target Depth Levels (8 levels to 1000m)
            </div>
            <div className="flex flex-wrap gap-1 font-data text-[9px]">
              {pinnedPoint.depths?.map((d) => (
                <span key={d} className="bg-[#FAF7BB]/10 px-1.5 py-0.5 rounded text-[#FAF7BB]/90">
                  {d}m
                </span>
              ))}
            </div>
          </div>

          {/* Action Button: Reconstruct Here */}
          <button
            type="button"
            onClick={() => onLaunchReconstruction?.(pinnedPoint.lat, pinnedPoint.lon, pinnedPoint.sst)}
            className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-sm bg-[#D99B21] py-2 px-3 text-xs font-bold text-[#133458] hover:bg-[#e8aa2a] transition-all shadow-md active:scale-[0.98]"
          >
            <Sparkles size={14} /> Reconstruct Here
          </button>
        </div>
      )}

      {/* 7. Bottom Navigation & Orientation Controls */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(3.2, s * 1.2))}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#FAF7BB]/20 bg-[#0a1d33]/90 text-[#FAF7BB] hover:bg-[#0a1d33] transition-colors shadow-md"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.65, s / 1.2))}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#FAF7BB]/20 bg-[#0a1d33]/90 text-[#FAF7BB] hover:bg-[#0a1d33] transition-colors shadow-md"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={resetToNorthIndianOcean}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#FAF7BB]/20 bg-[#0a1d33]/90 text-[#FAF7BB] hover:bg-[#0a1d33] transition-colors shadow-md"
          title="Reset to North Indian Ocean"
        >
          <Compass size={14} />
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((r) => !r)}
          className={`flex h-7 w-7 items-center justify-center rounded-sm border transition-colors shadow-md ${
            autoRotate
              ? 'border-[#D99B21] bg-[#D99B21]/30 text-[#FAF7BB]'
              : 'border-[#FAF7BB]/20 bg-[#0a1d33]/90 text-[#FAF7BB]/70 hover:text-[#FAF7BB]'
          }`}
          title={autoRotate ? 'Pause Earth Revolution' : 'Start Earth Revolution'}
        >
          {autoRotate ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>

      {/* Center Drag Hint if idle */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-[#FAF7BB]/40 font-data hidden sm:block">
        Click & drag to rotate · Scroll to zoom · Click to drop pin
      </div>
    </div>
  );
}
