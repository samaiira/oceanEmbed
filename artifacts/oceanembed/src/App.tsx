import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, Check, ChevronDown,
  CircleHelp, Cloud, Database, Download, FileText,
  Gauge, Globe, Globe2, Layers3, Map, Maximize2, Menu, Minimize2, MoreHorizontal, Mountain,
  Network, Play, Plus, RotateCcw, Search, Settings2, SlidersHorizontal,
  Sparkles, Thermometer, TrendingUp, Waves, X
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/lib/supabase-auth-context';
import { AuthCard } from '@/components/auth-card';
import { NewReconstructionDialog, type ReconstructionResult } from '@/components/new-reconstruction-dialog';
import { Earth3DGlobe, type PinnedPoint } from '@/components/Earth3DGlobe';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function SignInPage() {
  return <AuthCard initialMode="sign-in" />;
}

function SignUpPage() {
  return <AuthCard initialMode="sign-up" />;
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useSupabaseAuth();
  if (isLoaded && isSignedIn) {
    return <Redirect to="/dashboard" />;
  }
  return <LandingNio />;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useSupabaseAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#133458] text-[#FAF7BB]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#D99B21] border-t-transparent" />
          <span className="font-data text-xs uppercase tracking-widest text-[#FAF7BB]/70">
            Verifying Session...
          </span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}

type Icon = typeof Activity;
type NavItem = { label: string; href: string; icon: Icon };

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: Gauge },
  { label: 'Ocean map', href: '/map', icon: Globe2 },
  { label: 'Reconstructions', href: '/reconstructions', icon: Layers3 },
  { label: 'Temperature', href: '/temperature', icon: Thermometer },
  { label: 'Performance', href: '/performance', icon: TrendingUp },
  { label: 'Dataset', href: '/dataset', icon: Database },
];

const studyRegion = 'North Indian Ocean';
const studyBounds = '5–30°N, 45–105°E';
const depthValues = [
  { depth: 'Shallow (0–50 m)', rmse: '0.609', measurements: '1,535' },
  { depth: 'Thermocline (50–200 m)', rmse: '0.856', measurements: '4,706' },
  { depth: 'Mid (200–1000 m)', rmse: '0.524', measurements: '14,117' },
  { depth: 'Deep (1000 m+)', rmse: '0.242', measurements: '6,674' },
];
const iterativeImprovement = [
  { band: 'Shallow', values: [0.48, 1.24, 0.54] },
  { band: 'Thermocline', values: [1.46, 1.05, 0.86] },
  { band: 'Mid', values: [0.92, 0.61, 0.56] },
  { band: 'Deep', values: [0.31, 0.22, 0.26] },
];

const defaultReconstructions: ReconstructionResult[] = [
  {
    id: 'run-arabian',
    name: 'Arabian Sea Cast',
    subregion: 'Arabian Sea',
    latitude: 15.5,
    longitude: 65.0,
    date: '2023-01-15',
    depths: [0, 50, 100, 200, 500, 1000, 1500, 2000],
    temperatures: [28.2, 22.1, 17.0, 11.4, 6.0, 4.1, 3.4, 3.1],
    sst: 28.2,
    ssha: 0.04,
    sss: 36.2,
    rmse: 0.536,
    z20: 118,
    createdAt: '2023-01-15T00:00:00Z',
  },
  {
    id: 'run-bengal',
    name: 'Bay of Bengal Cast',
    subregion: 'Bay of Bengal',
    latitude: 14.2,
    longitude: 88.5,
    date: '2023-01-18',
    depths: [0, 50, 100, 200, 500, 1000, 1500, 2000],
    temperatures: [28.6, 23.0, 17.8, 11.9, 6.2, 4.2, 3.5, 3.2],
    sst: 28.6,
    ssha: 0.08,
    sss: 33.1,
    rmse: 0.552,
    z20: 126,
    createdAt: '2023-01-18T00:00:00Z',
  },
];

interface ReconstructionsContextType {
  runs: ReconstructionResult[];
  activeRun: ReconstructionResult;
  setActiveRun: (run: ReconstructionResult) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  addRun: (newRun: ReconstructionResult) => void;
  updateRun: (updatedRun: ReconstructionResult) => void;
  targetCoords: { lat: number; lon: number; sst?: number } | null;
  openWithCoordinates: (lat: number, lon: number, sst?: number) => void;
}

const ReconstructionsContext = createContext<ReconstructionsContextType | null>(null);

function useReconstructions() {
  const ctx = useContext(ReconstructionsContext);
  if (!ctx) {
    throw new Error('useReconstructions must be used within ReconstructionsProvider');
  }
  return ctx;
}

function ReconstructionsProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<ReconstructionResult[]>(defaultReconstructions);
  const [activeRun, setActiveRun] = useState<ReconstructionResult>(defaultReconstructions[0]);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lon: number; sst?: number } | null>(null);

  const addRun = (newRun: ReconstructionResult) => {
    setRuns((prev) => [newRun, ...prev]);
    setActiveRun(newRun);
  };

  const updateRun = (updatedRun: ReconstructionResult) => {
    setRuns((prev) => prev.map((r) => (r.id === updatedRun.id ? updatedRun : r)));
    setActiveRun(updatedRun);
  };

  const openWithCoordinates = (lat: number, lon: number, sst?: number) => {
    setTargetCoords({ lat, lon, sst });
    setDialogOpen(true);
  };

  return (
    <ReconstructionsContext.Provider
      value={{
        runs,
        activeRun,
        setActiveRun,
        dialogOpen,
        setDialogOpen,
        addRun,
        updateRun,
        targetCoords,
        openWithCoordinates,
      }}
    >
      {children}
      <NewReconstructionDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => {
          setDialogOpen(isOpen);
          if (!isOpen) setTargetCoords(null);
        }}
        initialLat={targetCoords?.lat}
        initialLon={targetCoords?.lon}
        initialSst={targetCoords?.sst}
        onRunComplete={(newRun) => {
          addRun(newRun);
        }}
      />
    </ReconstructionsContext.Provider>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-home-logo">
      <span className={`grid h-9 w-9 place-items-center rounded-sm ${light ? 'bg-[#FAF7BB] text-[#133458]' : 'bg-[#133458] text-[#FAF7BB]'}`}>
        <Waves size={20} strokeWidth={1.7} />
      </span>
      <span className={`font-display text-[22px] tracking-[-.03em] ${light ? 'text-[#FAF7BB]' : 'text-[#133458]'}`}>
        OceanEmbed
      </span>
    </Link>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { user, profile, userId, signOut } = useSupabaseAuth();
  const userName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Research lead');
  const initials = (userName?.[0] || 'O').toUpperCase();

  return (
    <>
      {open && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-[#133458]/35 md:hidden" data-testid="button-close-overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[#133458] px-5 py-6 text-[#FAF7BB] transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <Logo light />
          <button onClick={onClose} className="rounded-sm p-1 text-[#FAF7BB]/60 hover:text-[#FAF7BB] md:hidden" aria-label="Close navigation" data-testid="button-close-navigation"><X size={18} /></button>
        </div>
        <div className="mt-12">
          <div className="mb-3 px-3 font-data text-[9px] uppercase tracking-[.2em] text-[#FAF7BB]/40">Workspace</div>
          <nav className="space-y-1">
            {navItems.map(({ label, href, icon: NavIcon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] transition-colors ${active ? 'bg-[#FAF7BB] text-[#133458]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'}`}
                  data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <NavIcon size={16} strokeWidth={active ? 2 : 1.5} />
                  <span>{label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D99B21]" />}
                </Link>
              );
            })}
          </nav>
          <div className="mb-3 mt-10 px-3 font-data text-[9px] uppercase tracking-[.2em] text-[#FAF7BB]/40">System</div>
          <Link
            href="/settings"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] ${location === '/settings' ? 'bg-[#FAF7BB] text-[#133458]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'}`}
            data-testid="link-nav-settings"
          >
            <Settings2 size={16} strokeWidth={1.5} />
            <span>Settings</span>
          </Link>
        </div>
        <div className="mt-auto rounded-sm border border-[#FAF7BB]/15 bg-[#FAF7BB]/[.06] p-4">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-[#9CAF68]" /> Supabase Connected
          </div>
          <div className="mt-2 font-data text-[9px] tracking-wide text-[#FAF7BB]/45 truncate" title="PostgreSQL: ysryoqotuyngtplyujqx">
            DB: YSRYOQOTUYN... · LIVE
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-[#FAF7BB]/15 pt-5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#D99B21] text-xs font-semibold text-[#133458]">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs truncate font-semibold">{userName}</div>
            <div className="font-data text-[9px] text-[#FAF7BB]/50 truncate font-mono" title={userId || ''}>
              {userId ? `UID: ${userId.slice(0, 8)}...` : 'Research lead'}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="text-[#FAF7BB]/50 hover:text-[#FAF7BB] transition-colors p-1"
            title="Sign out"
            aria-label="Sign out"
            data-testid="button-sidebar-signout"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [location] = useLocation();
  const { user, profile, userId, signOut } = useSupabaseAuth();
  const title = location === '/dashboard' ? 'Ocean intelligence' : navItems.find((n) => n.href === location)?.label || 'Settings';
  const userName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Research lead');
  const initials = (userName?.[0] || 'O').toUpperCase();

  return (
    <div className="oe-shell">
      <Sidebar open={drawer} onClose={() => setDrawer(false)} />
      <main className="min-h-[100dvh] md:pl-[248px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#D8D0B3] bg-[#FAF7BB]/70 px-5 backdrop-blur md:px-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawer(true)}
              className="rounded-sm border border-[#D8D0B3] p-2 md:hidden"
              aria-label="Open navigation"
              data-testid="button-open-navigation"
            >
              <Menu size={18} />
            </button>
            <div className="hidden text-[13px] text-[#536675] md:block">
              Workspace / <span className="text-[#133458]">{title}</span>
            </div>
            <div className="font-display text-xl md:hidden">OceanEmbed</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative rounded-sm p-2 text-[#536675] hover:bg-[#e8e2ba]"
              aria-label="Notifications"
              data-testid="button-notifications"
            >
              <Bell size={17} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#D99B21]" />
            </button>
            <button
              onClick={() => signOut()}
              className="hidden items-center gap-2 border-l border-[#D8D0B3] pl-3 text-left sm:flex group"
              aria-label="Sign out"
              data-testid="button-user-menu"
              title="Click to sign out"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#838921] text-[10px] font-semibold text-[#FAF7BB]">
                {initials}
              </span>
              <div className="flex flex-col">
                <span className="max-w-[130px] truncate text-xs font-semibold text-[#133458] group-hover:text-[#838921]">
                  {userName}
                </span>
                <span className="font-mono text-[9px] text-[#536675] truncate max-w-[130px]">
                  {userId ? `UID: ${userId.slice(0, 8)}...` : ''}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#536675]" />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="oe-kicker mb-2">{eyebrow}</div>
        <h1 className="font-display text-[clamp(32px,4vw,51px)] leading-[.98] tracking-[-.035em] text-[#133458]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#536675]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, note, icon: StatIcon, accent = false }: { label: string; value: string; note: string; icon: Icon; accent?: boolean }) {
  return (
    <div className={`oe-card relative overflow-hidden p-5 ${accent ? 'border-[#133458] ring-1 ring-[#133458]/30 shadow-sm' : ''}`}>
      <div className="flex items-center justify-between text-[#24384d]">
        <span className="oe-label font-bold text-[#133458]">{label}</span>
        <StatIcon size={17} strokeWidth={1.8} className={accent ? 'text-[#838921]' : 'text-[#133458]'} />
      </div>
      <div className="mt-6 font-data text-[29px] font-bold tracking-[-.06em] text-[#133458]">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#24384d]">
        <ArrowDownRight size={13} className="text-[#838921]" />{note}
      </div>
      {accent && <div className="absolute -bottom-12 -right-7 h-28 w-28 rounded-full border border-[#133458]/10" />}
    </div>
  );
}

function OceanMap({ compact = false, selectedLayer = 'Sea surface temperature', onSelect }: { compact?: boolean; selectedLayer?: string; onSelect?: (name: string) => void }) {
  const { runs, activeRun, setActiveRun } = useReconstructions();

  const getCoordinates = (lat: number, lon: number) => {
    const clampedLon = Math.max(45, Math.min(105, lon));
    const clampedLat = Math.max(5, Math.min(30, lat));
    const x = ((clampedLon - 45) / 60) * 900 + 50;
    const y = ((30 - clampedLat) / 25) * 420 + 40;
    return { x, y };
  };

  return (
    <div className={`relative overflow-hidden border border-[#294966] bg-[#133458] ${compact ? 'h-[300px]' : 'h-[490px]'}`}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#8da9a930 1px, transparent 1px),linear-gradient(90deg,#8da9a930 1px,transparent 1px)', backgroundSize: '42px 42px' }} />
      <svg id="ocean-map-svg" viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full" aria-label="Ocean data map">
        <path d="M0 0H1000V500H0z" fill="#133458" />
        <path d="M0 82C53 64 67 99 105 90c36-9 26-64 66-58 30 5 41 45 70 40 31-5 27-40 65-27 34 12 11 57 43 65 31 8 39-25 65-21 35 5 17 60 53 72 34 11 43-44 77-40 32 4 29 52 63 56 33 4 51-24 72-13 28 15 7 61 48 70 30 7 42-33 70-24 32 10 14 48 51 52 37 4 42-37 72-25 31 13 18 64 50 72 28 7 51-16 72-8v78H0z" fill="#567068" opacity=".9" />
        <path d="M0 235c37-27 55-5 82-16 35-14 21-63 57-57 35 6 31 47 69 51 35 4 41-28 72-17 30 11 12 61 46 68 39 8 50-30 78-18 31 14 11 67 47 75 37 8 45-30 77-20 32 10 16 60 51 68 42 10 49-31 78-23 36 10 15 63 53 72 38 9 39-38 70-26 32 12 20 65 56 73 39 9 44-31 76-24 33 8 24 42 58 53l42 8v-94c-30-5-47-27-77-21-33 6-33 40-68 31-36-10-19-67-56-76-34-8-41 43-76 34-34-9-22-62-57-73-32-10-46 32-77 22-35-11-21-65-55-74-38-11-45 29-75 20-33-10-17-66-53-76-33-9-42 31-77 19-39-13-21-62-55-71-38-9-43 32-77 22-36-11-30-47-63-54-34-7-33 18-69 26-32 7-45-14-82 11z" fill="#567068" opacity=".55" transform="translate(0 150)" />
        <path d="M20 442c120-24 174 12 274-13s166-4 261 7 204-29 425 12" stroke="#D99B21" strokeWidth="1.2" strokeDasharray="5 7" fill="none" opacity=".7" />
        {runs.map((run) => {
          const { x, y } = getCoordinates(run.latitude, run.longitude);
          const isActive = activeRun?.id === run.id;
          return (
            <g
              key={run.id}
              transform={`translate(${x},${y})`}
              onClick={() => {
                setActiveRun(run);
                onSelect?.(run.name);
              }}
              className="cursor-pointer"
            >
              <circle r={isActive ? 16 : 11} fill="#D99B21" opacity={isActive ? 0.35 : 0.16}>
                <animate attributeName="r" values={isActive ? '12;20;12' : '8;14;8'} dur={isActive ? '2s' : '3s'} repeatCount="indefinite" />
              </circle>
              <circle r={isActive ? 5 : 3.5} fill={isActive ? '#D99B21' : '#FAF7BB'} stroke="#133458" strokeWidth="1.5" />
              <text x="10" y="3" fill={isActive ? '#D99B21' : '#FAF7BB'} fontSize={isActive ? '12' : '11'} fontWeight={isActive ? 'bold' : 'normal'} fontFamily="Space Mono">
                {run.name.split('(')[0].trim()}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute left-4 top-4 flex items-center gap-2 border border-[#FAF7BB]/15 bg-[#133458]/75 px-3 py-2 text-[10px] text-[#FAF7BB]/75 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D99B21]" /> NORTH INDIAN OCEAN <span className="font-data text-[#FAF7BB]/45">· {studyBounds} · {runs.length} ACTIVE CASTS</span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
        <div className="text-[10px] text-[#FAF7BB]/55">
          <div className="mb-1 font-data text-[#FAF7BB]/80">30°N</div>
          <div>20°N</div>
          <div>10°N</div>
          <div>5°N</div>
        </div>
        <div className="w-40">
          <div className="mb-1 flex justify-between font-data text-[9px] text-[#FAF7BB]/65">
            <span>45°E</span><span>{selectedLayer}</span><span>105°E</span>
          </div>
          <div className="h-1.5 bg-gradient-to-r from-[#2c6478] via-[#9caf68] to-[#d99b21]" />
        </div>
      </div>
    </div>
  );
}

function Chart({ variant = 'line' }: { variant?: 'line' | 'bars' | 'depth' }) {
  const points = variant === 'depth' ? '8,22 50,35 92,51 134,66 176,76 218,87 260,98 302,106' : '8,84 43,72 79,77 114,55 150,62 185,38 220,48 255,24 302,31';
  return (
    <svg viewBox="0 0 310 125" className="h-full w-full" preserveAspectRatio="none" aria-label={`${variant} research chart`}>
      <g stroke="#d8d0b3" strokeWidth="1">
        <path d="M8 12H302M8 42H302M8 72H302M8 105H302" />
        <path d="M8 12V105M78 12V105M150 12V105M220 12V105M302 12V105" />
      </g>
      {variant === 'bars' ? (
        <g fill="#838921">
          {[42,68,53,79,61,88,74,95].map((h, i) => (
            <rect key={i} x={12 + i * 37} y={105 - h} width="21" height={h} opacity={i === 7 ? 1 : .7} />
          ))}
        </g>
      ) : (
        <>
          <polyline points={points} fill="none" stroke={variant === 'depth' ? '#D99B21' : '#133458'} strokeWidth="2.5" />
          <polyline points={variant === 'depth' ? '8,31 50,43 92,58 134,70 176,83 218,91 260,102 302,112' : '8,91 43,83 79,86 114,73 150,75 185,53 220,58 255,44 302,47'} fill="none" stroke="#9caf68" strokeWidth="1.5" strokeDasharray="4 4" />
        </>
      )}
      <g fill="#536675" fontFamily="Space Mono" fontSize="8">
        <text x="8" y="120">JAN</text>
        <text x="145" y="120">JUN</text>
        <text x="270" y="120">DEC</text>
      </g>
    </svg>
  );
}

function PerformanceGraphs() {
  const maxRmse = 0.9;
  const maxIterativeRmse = 1.6;
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="oe-card p-5">
        <div className="oe-kicker text-[#133458] font-bold">A. RMSE by depth band</div>
        <h2 className="mt-1 font-display text-2xl text-[#133458]">North Indian Ocean test results</h2>
        <div className="mt-5 h-56">
          <svg viewBox="0 0 620 250" className="h-full w-full" role="img" aria-label="RMSE by depth band in degrees Celsius">
            <g stroke="#D8D0B3" strokeWidth="1">
              {[0, .3, .6, .9].map((value) => <line key={value} x1="46" x2="600" y1={210 - (value / maxRmse) * 170} y2={210 - (value / maxRmse) * 170} />)}
            </g>
            <g fill="#133458" fontFamily="Space Mono" fontSize="10" fontWeight="700">
              <text x="11" y="214">0.0</text><text x="11" y="157">0.3</text><text x="11" y="100">0.6</text><text x="11" y="44">0.9</text>
            </g>
            {depthValues.map((row, index) => {
              const value = Number(row.rmse);
              const height = (value / maxRmse) * 170;
              const x = 78 + index * 130;
              return (
                <g key={row.depth}>
                  <rect x={x} y={210 - height} width="58" height={height} fill="#2F78D0" rx="1" />
                  <text x={x + 29} y={200 - height} textAnchor="middle" fill="#133458" fontFamily="Space Mono" fontSize="11" fontWeight="700">{row.rmse}</text>
                  <text x={x + 29} y="230" textAnchor="middle" fill="#133458" fontFamily="Space Mono" fontSize="10" fontWeight="700">{row.depth.split(' ')[0]}</text>
                </g>
              );
            })}
            <text x="310" y="248" textAnchor="middle" fill="#24384d" fontFamily="Space Mono" fontSize="9" fontWeight="700">DEPTH BAND · RMSE (°C)</text>
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] border-t border-[#D8D0B3] pt-3 font-data text-[10px] text-[#133458] font-bold">
          <span>Depth band</span>
          <span>RMSE (°C) · # measurements</span>
        </div>
        <div className="mt-2 space-y-2 font-data text-[10px] text-[#133458]">
          {depthValues.map((row) => (
            <div key={row.depth} className="grid grid-cols-[1.4fr_1fr]">
              <span className="font-bold">{row.depth}</span>
              <span className="font-semibold text-[#24384d]">{row.rmse} · {row.measurements}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1.4fr_1fr] border-t border-[#D8D0B3] pt-2 text-[#133458] font-bold">
            <span>Overall Test RMSE</span>
            <span className="text-[#838921]">0.554°C · —</span>
          </div>
        </div>
      </section>
      <section className="oe-card p-5">
        <div className="oe-kicker text-[#133458] font-bold">B. Iterative improvement</div>
        <h2 className="mt-1 font-display text-2xl text-[#133458]">SST → +SSHa → +SSHa+SSS</h2>
        <div className="mt-5 flex items-center gap-4 text-[11px] text-[#133458] font-bold">
          <span className="flex items-center gap-2"><i className="h-2.5 w-5 bg-[#F26A38] rounded-xs" /> SST only</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-5 bg-[#F4B51D] rounded-xs" /> + SSHa</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-5 bg-[#19A83A] rounded-xs" /> + SSS</span>
        </div>
        <div className="mt-3 h-56">
          <svg viewBox="0 0 620 250" className="h-full w-full" role="img" aria-label="Iterative improvement from SST to sea surface height anomaly to sea surface salinity">
            <g stroke="#D8D0B3" strokeWidth="1">
              {[0, .4, .8, 1.2, 1.6].map((value) => <line key={value} x1="46" x2="600" y1={210 - (value / maxIterativeRmse) * 170} y2={210 - (value / maxIterativeRmse) * 170} />)}
            </g>
            <g fill="#133458" fontFamily="Space Mono" fontSize="10" fontWeight="700">
              <text x="18" y="214">0</text><text x="11" y="171">0.4</text><text x="11" y="129">0.8</text><text x="11" y="87">1.2</text><text x="11" y="44">1.6</text>
            </g>
            {iterativeImprovement.map((row, index) => {
              const x = 78 + index * 130;
              return (
                <g key={row.band}>
                  {row.values.map((value, series) => {
                    const height = (value / maxIterativeRmse) * 170;
                    return <rect key={series} x={x + series * 22} y={210 - height} width="17" height={height} fill={['#F26A38', '#F4B51D', '#19A83A'][series]} rx="1" />;
                  })}
                  <text x={x + 22} y="230" textAnchor="middle" fill="#133458" fontFamily="Space Mono" fontSize="10" fontWeight="700">{row.band}</text>
                </g>
              );
            })}
            <text x="310" y="248" textAnchor="middle" fill="#24384d" fontFamily="Space Mono" fontSize="9" fontWeight="700">DEPTH BAND · RMSE (°C)</text>
          </svg>
        </div>
        <div className="mt-3 grid grid-cols-4 border-t border-[#D8D0B3] pt-3 font-data text-[10px] text-[#133458] font-bold">
          <span>Depth Band</span>
          <span className="text-[#F26A38]">SST</span>
          <span className="text-[#d4990e]">+ SSHa</span>
          <span className="text-[#19A83A]">+ SSS</span>
        </div>
        <div className="mt-2 space-y-2 font-data text-[10px] text-[#133458]">
          {iterativeImprovement.map((row) => (
            <div key={row.band} className="grid grid-cols-4">
              <span className="font-bold">{row.band}</span>
              <span className="font-semibold text-[#F26A38]">{row.values[0]}°C</span>
              <span className="font-semibold text-[#d4990e]">{row.values[1]}°C</span>
              <span className="font-semibold text-[#19A83A]">{row.values[2]}°C</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard() {
  const { runs, activeRun, setActiveRun, setDialogOpen, openWithCoordinates } = useReconstructions();
  const [selected, setSelected] = useState(activeRun?.name || 'Arabian Sea');
  const [mapMode, setMapMode] = useState<'3d' | '2d'>('3d');
  const [pickedPoint, setPickedPoint] = useState<PinnedPoint | null>(null);
  const { user, profile, userId } = useSupabaseAuth();
  const [copied, setCopied] = useState(false);

  const userName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Research Lead');
  const userEmail = profile?.email || user?.email || 'research@oceanembed.internal';

  const copyUserId = () => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AppShell>
      <div className="oe-page oe-grid">
        {/* Supabase Authenticated Session Banner */}
        <div className="mb-6 rounded-xl border border-[#D8D0B3] bg-[#FAF7BB] p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4" data-testid="auth-status-banner">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#133458] text-[#FAF7BB]">
              <Waves size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#133458]">{userName}</span>
                <span className="rounded-full bg-[#e5ebd3] px-2.5 py-0.5 text-[10px] font-semibold text-[#536b35] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#838921]" /> Supabase Active
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px] text-[#536675]">
                <span>Email: <strong className="text-[#133458]">{userEmail}</strong></span>
                <span className="hidden sm:inline">·</span>
                <span className="flex items-center gap-1.5">
                  User ID: <code className="bg-[#e8e2ba] px-2 py-0.5 rounded text-[#133458] font-bold font-mono text-[11px]">{userId || 'local-researcher'}</code>
                  {userId && (
                    <button
                      onClick={copyUserId}
                      title="Copy User ID"
                      className="text-[#838921] hover:text-[#133458] transition-colors p-0.5"
                    >
                      {copied ? <Check size={13} /> : <FileText size={13} />}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto text-[10px] font-data text-[#536675] bg-[#fffdf0] border border-[#D8D0B3] px-3 py-1.5 rounded-sm">
            <Database size={13} className="text-[#838921]" />
            <span>Database Table: <strong className="text-[#133458]">public.profiles</strong> (Synchronized)</span>
          </div>
        </div>

        <SectionHeading
          eyebrow="Mission control · January 2023"
          title="Ocean intelligence"
          description="A North Indian Ocean research view built from surface observations and subsurface temperature profiles."
          action={
            <button
              onClick={() => setDialogOpen(true)}
              className="oe-control oe-primary flex items-center gap-2"
              data-testid="button-new-reconstruction"
            >
              <Plus size={15} /> New reconstruction
            </button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Overall Test RMSE" value={`${activeRun ? activeRun.rmse : '0.554'}°C`} note={`Active: ${activeRun.name}`} icon={Activity} accent />
          <StatCard label="Active Reconstructions" value={`${runs.length}`} note="User casts & benchmark runs" icon={Layers3} />
          <StatCard label="Measurements" value="141,433" note="January 2023 study period" icon={Database} />
          <StatCard label="Total Floats" value="228" note="183 train · 45 test (80/20)" icon={Sparkles} />
        </div>
        {/* Full Screen 3D Earth Section (Permanent Full-Width Hero) */}
        <section className="oe-card p-4 sm:p-5 mt-5 w-full shadow-lg border border-[#294966]/40">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="oe-kicker mb-1">Surface field</div>
              <h2 className="font-display text-2xl text-[#133458]">Where the model is looking</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* 3D Earth vs 2D Map Toggle */}
              <div className="flex rounded-sm border border-[#D8D0B3] bg-[#FAF7BB] p-0.5 text-xs font-semibold text-[#133458]">
                <button
                  type="button"
                  onClick={() => setMapMode('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-all ${
                    mapMode === '3d'
                      ? 'bg-[#133458] text-[#FAF7BB] shadow-sm'
                      : 'text-[#536675] hover:text-[#133458]'
                  }`}
                >
                  <Globe size={13} /> 3D Earth
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('2d')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-all ${
                    mapMode === '2d'
                      ? 'bg-[#133458] text-[#FAF7BB] shadow-sm'
                      : 'text-[#536675] hover:text-[#133458]'
                  }`}
                >
                  <Map size={13} /> 2D Map
                </button>
              </div>

              <Link href="/map" className="flex items-center gap-1 text-xs font-semibold text-[#838921] hover:text-[#133458]" data-testid="link-open-full-map">
                Open full map <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {mapMode === '3d' ? (
            <Earth3DGlobe
              expanded={true}
              activeCasts={runs.map((r) => ({
                id: r.id,
                name: r.name,
                lat: r.latitude,
                lon: r.longitude,
                sst: r.sst,
                rmse: r.rmse,
                isActive: r.id === activeRun?.id,
              }))}
              onSelectCast={(name) => {
                const found = runs.find((r) => r.name === name);
                if (found) {
                  setActiveRun(found);
                  setSelected(found.name);
                }
              }}
              onDropPin={(point) => {
                setPickedPoint(point);
              }}
              onLaunchReconstruction={(lat, lon, sst) => {
                openWithCoordinates(lat, lon, sst);
              }}
            />
          ) : (
            <OceanMap onSelect={setSelected} />
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#536675]">
            <span>
              {pickedPoint ? (
                <>
                  Point selected: <strong className="text-[#133458] font-data font-bold">{pickedPoint.lat}°N, {pickedPoint.lon}°E</strong> ({pickedPoint.region} · Est. SST {pickedPoint.sst}°C)
                </>
              ) : (
                <>
                  Active cast: <strong className="text-[#133458]">{activeRun.name}</strong> ({activeRun.latitude}°N, {activeRun.longitude}°E)
                </>
              )}
            </span>
            <span className="font-data text-[10px]">{studyBounds}</span>
          </div>
        </section>

        {/* Analytics & Field Notes Row (3-Column Row directly below 3D Earth) */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr]">
          <section className="oe-card p-5">
            <div className="oe-kicker mb-1">At a glance</div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-[#133458]">Field notes</h2>
              <span className="font-data text-[10px] text-[#838921]">{runs.length} runs available</span>
            </div>
            <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {runs.map((run, i) => (
                <div
                  className={`flex gap-3 p-2.5 rounded-sm cursor-pointer transition-colors border ${activeRun.id === run.id ? 'border-[#D99B21] bg-[#f1edc9]' : 'border-transparent hover:bg-[#f5f1d6]'}`}
                  key={run.id}
                  onClick={() => {
                    setActiveRun(run);
                    setSelected(run.name);
                  }}
                >
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-[#D99B21]' : 'bg-[#838921]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-semibold text-[#133458] truncate">{run.name}</div>
                      <div className="font-data text-[10px] font-bold text-[#133458] shrink-0">{run.date}</div>
                    </div>
                    <p className="mt-0.5 text-xs text-[#24384d] font-medium truncate">
                      {run.latitude}°N, {run.longitude}°E · SST {run.sst}°C · {run.depths.length} depths
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/reconstructions" className="mt-4 flex w-full items-center justify-center gap-2 border-t border-[#D8D0B3] pt-4 text-xs font-semibold text-[#838921]" data-testid="link-view-reconstructions">
              View full reconstruction studio <ArrowRight size={14} />
            </Link>
          </section>

          <section className="oe-card p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="oe-kicker mb-1">Test signal</div>
                <h2 className="font-display text-2xl text-[#133458]">North Indian Ocean RMSE</h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#24384d]">
                <span className="h-2 w-2 rounded-full bg-[#133458]" /> Predicted
                <span className="ml-2 h-2 w-2 rounded-full bg-[#9caf68]" /> Observed
              </div>
            </div>
            <div className="h-44"><Chart variant="depth" /></div>
            <div className="mt-1 flex justify-between font-data text-[10px] font-bold text-[#133458]">
              <span>0.242°C</span><span>Overall Test RMSE 0.554°C</span><span>0.856°C</span>
            </div>
          </section>

          <section className="oe-card p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="oe-kicker mb-1">Study field</div>
                <h2 className="font-display text-2xl text-[#133458]">North Indian Ocean</h2>
              </div>
              <Link href="/performance" className="text-xs text-[#838921]" data-testid="link-view-performance">View detail</Link>
            </div>
            <div className="h-44"><Chart variant="bars" /></div>
            <div className="mt-2 flex justify-between text-[10px] text-[#536675]">
              <span>Arabian Sea</span><span>North Indian Ocean</span><span>Bay of Bengal</span>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function MapNio() {
  const { runs, activeRun, setActiveRun, setDialogOpen, openWithCoordinates } = useReconstructions();
  const [layer, setLayer] = useState('Sea surface temperature');
  const [selected, setSelected] = useState(activeRun?.name || 'Arabian Sea');
  const [mapMode, setMapMode] = useState<'3d' | '2d'>('3d');
  const [pickedPoint, setPickedPoint] = useState<PinnedPoint | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const layers = ['Sea surface temperature', 'Subsurface reconstruction', 'Model confidence'];

  const handleExportView = () => {
    const svgElement = document.getElementById('ocean-map-svg') as SVGSVGElement | null;
    if (!svgElement) return;

    setIsExporting(true);

    try {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      if (!svgString.includes('xmlns=')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Deep ocean background
          ctx.fillStyle = '#133458';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw map SVG
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          // Overlay metadata banner
          ctx.fillStyle = 'rgba(19, 52, 88, 0.90)';
          ctx.fillRect(40, 30, 840, 84);
          ctx.strokeStyle = '#D8D0B3';
          ctx.lineWidth = 2;
          ctx.strokeRect(40, 30, 840, 84);

          ctx.fillStyle = '#D99B21';
          ctx.font = 'bold 20px "Space Mono", monospace';
          ctx.fillText('OCEANEMBED · NORTH INDIAN OCEAN', 65, 65);

          ctx.fillStyle = '#FAF7BB';
          ctx.font = '15px "Space Mono", monospace';
          ctx.fillText(`Field Layer: ${layer} · ${runs.length} Active Casts · Bounds: 5°–30°N, 45°–105°E`, 65, 93);

          // Footer stamp
          ctx.fillStyle = 'rgba(250, 247, 187, 0.75)';
          ctx.font = '13px "Space Mono", monospace';
          ctx.fillText(`Exported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · OceanEmbed Research Lab`, 40, 970);

          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const downloadLink = document.createElement('a');
              downloadLink.href = pngUrl;
              downloadLink.download = `oceanembed-nio-map-${layer.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
              setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
            }
            setIsExporting(false);
          }, 'image/png');
        } else {
          setIsExporting(false);
        }
        URL.revokeObjectURL(blobURL);
      };

      image.onerror = () => {
        // Fallback: direct SVG download
        const downloadLink = document.createElement('a');
        downloadLink.href = blobURL;
        downloadLink.download = `oceanembed-nio-map-${layer.toLowerCase().replace(/\s+/g, '-')}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setIsExporting(false);
      };

      image.src = blobURL;
    } catch (err) {
      console.error('Failed to export map image:', err);
      setIsExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="oe-page">
        <SectionHeading
          eyebrow="Spatial explorer · North Indian Ocean"
          title="Ocean map"
          description={`North Indian Ocean study field, bounded by ${studyBounds}. Explore the 3D Earth, or click any location to read Latitude & Longitude.`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* 3D Earth vs 2D Map Toggle */}
              <div className="flex rounded-sm border border-[#D8D0B3] bg-[#FAF7BB] p-0.5 text-xs font-semibold text-[#133458]">
                <button
                  type="button"
                  onClick={() => setMapMode('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-all ${
                    mapMode === '3d'
                      ? 'bg-[#133458] text-[#FAF7BB] shadow-sm'
                      : 'text-[#536675] hover:text-[#133458]'
                  }`}
                >
                  <Globe size={13} /> 3D Earth
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('2d')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-all ${
                    mapMode === '2d'
                      ? 'bg-[#133458] text-[#FAF7BB] shadow-sm'
                      : 'text-[#536675] hover:text-[#133458]'
                  }`}
                >
                  <Map size={13} /> 2D Map
                </button>
              </div>

              <button
                onClick={() => setDialogOpen(true)}
                className="oe-control oe-primary flex items-center gap-2"
                data-testid="button-map-new-reconstruction"
              >
                <Plus size={15} /> New reconstruction
              </button>
              <button
                onClick={handleExportView}
                disabled={isExporting}
                className="oe-control flex items-center gap-2 font-semibold disabled:opacity-60"
                data-testid="button-map-download"
                title="Download high-resolution image of the ocean map"
              >
                {isExporting ? (
                  <>
                    <RotateCcw size={15} className="animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Export view</span>
                  </>
                )}
              </button>
            </div>
          }
        />
        <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
          <section>
            {mapMode === '3d' ? (
              <Earth3DGlobe
                activeCasts={runs.map((r) => ({
                  id: r.id,
                  name: r.name,
                  lat: r.latitude,
                  lon: r.longitude,
                  sst: r.sst,
                  rmse: r.rmse,
                  isActive: r.id === activeRun?.id,
                }))}
                onSelectCast={(name) => {
                  const found = runs.find((r) => r.name === name);
                  if (found) {
                    setActiveRun(found);
                    setSelected(found.name);
                  }
                }}
                onDropPin={(point) => {
                  setPickedPoint(point);
                }}
                onLaunchReconstruction={(lat, lon, sst) => {
                  openWithCoordinates(lat, lon, sst);
                }}
              />
            ) : (
              <OceanMap selectedLayer={layer} onSelect={setSelected} />
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#24384d] font-semibold">
              <span className="font-data text-[10px] text-[#133458] font-bold">
                {pickedPoint ? (
                  <>Selected Point: {pickedPoint.lat}°N, {pickedPoint.lon}°E ({pickedPoint.region} · Est. SST {pickedPoint.sst}°C)</>
                ) : (
                  <>{studyRegion} · {studyBounds} · {runs.length} Active Casts</>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D99B21]" /> Click anywhere on the 3D globe to inspect Latitude & Longitude
              </span>
            </div>
          </section>
          <aside className="oe-card p-5">
            <div className="oe-kicker mb-2">Map controls</div>
            <h2 className="font-display text-2xl text-[#133458]">Field layers</h2>
            <div className="mt-4 space-y-2">
              {layers.map((name) => (
                <button
                  key={name}
                  onClick={() => setLayer(name)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs transition-colors ${layer === name ? 'bg-[#133458] text-[#FAF7BB]' : 'bg-[#f1edc9] text-[#536675] hover:bg-[#e8e2ba]'}`}
                  data-testid={`button-layer-${name.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full border ${layer === name ? 'border-[#D99B21] bg-[#D99B21]' : 'border-[#838921]'}`} />
                  {name}
                  {layer === name && <Check size={14} className="ml-auto text-[#D99B21]" />}
                </button>
              ))}
            </div>
            <div className="mt-6 border-t border-[#D8D0B3] pt-4">
              <div className="flex justify-between">
                <span className="oe-label">Study bounds</span>
                <span className="font-data text-xs text-[#133458]">{studyBounds}</span>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="oe-label">Active Casts</span>
                <span className="font-data text-right text-xs text-[#133458] font-bold">{runs.length} Reconstructions</span>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="oe-label">Test period</span>
                <span className="font-data text-xs text-[#133458]">January 2023</span>
              </div>
            </div>
            <div className="mt-6 bg-[#133458] p-4 text-[#FAF7BB] rounded-sm">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#FAF7BB]/55">
                <CircleHelp size={13} /> Selected Cast Details
              </div>
              <div className="mt-2 font-display text-xl text-[#D99B21] truncate">{activeRun.name}</div>
              <div className="mt-3 space-y-2 font-data text-[10px]">
                <div className="flex justify-between border-b border-[#FAF7BB]/10 pb-1.5">
                  <span className="text-[#FAF7BB]/50">COORDINATES</span>
                  <span>{activeRun.latitude}°N, {activeRun.longitude}°E</span>
                </div>
                <div className="flex justify-between border-b border-[#FAF7BB]/10 pb-1.5">
                  <span className="text-[#FAF7BB]/50">DATE</span>
                  <span>{activeRun.date}</span>
                </div>
                <div className="flex justify-between border-b border-[#FAF7BB]/10 pb-1.5">
                  <span className="text-[#FAF7BB]/50">SURFACE SST</span>
                  <span className="text-[#FAF7BB] font-bold">{activeRun.sst}°C</span>
                </div>
                <div className="flex justify-between border-b border-[#FAF7BB]/10 pb-1.5">
                  <span className="text-[#FAF7BB]/50">SSHA / SALINITY</span>
                  <span>{activeRun.ssha}m · {activeRun.sss}psu</span>
                </div>
                <div className="flex justify-between border-b border-[#FAF7BB]/10 pb-1.5">
                  <span className="text-[#FAF7BB]/50">THERMOCLINE (Z20)</span>
                  <span className="text-[#D99B21] font-bold">{activeRun.z20} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FAF7BB]/50">EST. RMSE</span>
                  <span className="text-[#838921] font-bold">{activeRun.rmse}°C</span>
                </div>
              </div>
              <Link href="/reconstructions" className="mt-4 flex items-center justify-between text-xs text-[#D99B21] hover:underline pt-2 border-t border-[#FAF7BB]/15" data-testid="link-inspect-region">
                <span>Inspect full profile</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ScientificProfileChart({ run }: { run?: ReconstructionResult }) {
  const xTicks = [5, 10, 15, 20, 25];
  const yTicks = [0, 500, 1000, 1500, 2000];
  const xPosition = (temperature: number) => 70 + (temperature / 27) * 570;
  const yPosition = (depth: number) => 43 + (depth / 2100) * 340;

  const observedPath = 'M608 43 C600 47 594 53 585 59 S557 74 537 83 S495 96 462 108 S422 124 392 138 S353 160 332 183 S302 216 277 243 S242 278 217 307 S188 340 166 365 S145 379 133 383';
  
  const predictedPath = run && run.depths.length > 0
    ? run.depths.map((d, i) => {
        const x = Math.min(640, Math.max(70, xPosition(run.temperatures[i])));
        const y = Math.min(383, Math.max(43, yPosition(d)));
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : 'M613 43 C606 47 597 53 587 60 S558 77 531 87 S492 102 457 113 S421 131 390 145 S352 166 330 187 S297 220 273 248 S240 283 214 312 S185 345 164 368 S143 381 132 384';

  return (
    <section className="oe-card overflow-hidden" data-testid="reconstruction-profile-chart">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D8D0B3] bg-[#f1edc9]/60 px-5 py-4">
        <div>
          <div className="oe-kicker mb-1">{run ? `${run.name} · ${run.date}` : 'Scientific profile'}</div>
          <h2 className="font-display text-2xl text-[#133458]">
            {run ? `${run.name} Temperature Profile` : 'Predicted vs. Observed Temperature Profile'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#536675]">
          <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#133458]" /> Actual (Argo measured)</span>
          <span className="flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed border-[#D99B21]" /> Predicted (OceanEmbed)</span>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <svg viewBox="0 0 680 460" className="h-auto w-full" role="img" aria-label="Predicted versus observed temperature profile with temperature on the horizontal axis and depth increasing downward">
          <rect x="70" y="43" width="570" height="340" fill="#FAF7BB" />
          <g stroke="#D8D0B3" strokeWidth="1">
            <line x1="70" y1="43" x2="640" y2="43" />
            <line x1="70" y1="124" x2="640" y2="124" />
            <line x1="70" y1="205" x2="640" y2="205" />
            <line x1="70" y1="286" x2="640" y2="286" />
            <line x1="70" y1="383" x2="640" y2="383" />
            {xTicks.map((tick) => <line key={tick} x1={xPosition(tick)} y1="43" x2={xPosition(tick)} y2="383" />)}
          </g>
          <g stroke="#133458" strokeWidth="1.5">
            <line x1="70" y1="43" x2="70" y2="383" />
            <line x1="70" y1="383" x2="640" y2="383" />
          </g>
          <g fill="#133458" fontFamily="Space Mono" fontSize="11" textAnchor="end">
            {yTicks.map((tick) => <text key={tick} x="59" y={yPosition(tick) + 4}>{tick}</text>)}
          </g>
          <g fill="#133458" fontFamily="Space Mono" fontSize="11" textAnchor="middle">
            {xTicks.map((tick) => <text key={tick} x={xPosition(tick)} y="401">{tick}</text>)}
          </g>
          <path d={observedPath} fill="none" stroke="#133458" strokeWidth="3.5" strokeLinecap="round" />
          <path d={predictedPath} fill="none" stroke="#D99B21" strokeWidth="2.75" strokeDasharray="7 5" strokeLinecap="round" />
          {run && run.depths.map((d, idx) => {
            const x = Math.min(640, Math.max(70, xPosition(run.temperatures[idx])));
            const y = Math.min(383, Math.max(43, yPosition(d)));
            return (
              <circle
                key={d}
                cx={x}
                cy={y}
                r="3.5"
                fill="#D99B21"
                stroke="#133458"
                strokeWidth="1.5"
              />
            );
          })}
          <text x="355" y="431" textAnchor="middle" fill="#133458" fontFamily="Space Mono" fontSize="11">Temperature (°C)</text>
          <text x="18" y="215" textAnchor="middle" fill="#133458" fontFamily="Space Mono" fontSize="11" transform="rotate(-90 18 215)">Depth (m)</text>
        </svg>
        {run && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D8D0B3] pt-3 font-data text-[11px] text-[#536675]">
            <span>Coordinates: <strong className="text-[#133458]">{run.latitude}°N, {run.longitude}°E</strong></span>
            <span>Surface Temp: <strong className="text-[#133458]">{run.sst}°C</strong></span>
            <span>SSHa: <strong className="text-[#133458]">{run.ssha}m</strong></span>
            <span>Thermocline (Z20): <strong className="text-[#D99B21]">{run.z20}m</strong></span>
            <span>Est. RMSE: <strong className="text-[#838921]">{run.rmse}°C</strong></span>
          </div>
        )}
      </div>
    </section>
  );
}

function ReconstructionsScientific() {
  const { runs, activeRun, setActiveRun, setDialogOpen } = useReconstructions();

  return (
    <AppShell>
      <div className="oe-page">
        <SectionHeading
          eyebrow={`Inference studio · ${studyRegion}`}
          title="Reconstructions"
          description="Inspect predicted and observed temperature profiles from the North Indian Ocean study field."
        />
        <div className="grid gap-5 xl:grid-cols-[230px_1fr]">
          <aside className="oe-card h-fit p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="oe-label">Study subregions</span>
              <button
                onClick={() => setDialogOpen(true)}
                className="text-[#838921] hover:text-[#133458] transition-colors p-1"
                aria-label="Add reconstruction"
                data-testid="button-add-reconstruction"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-1">
              {runs.map((run, i) => (
                <button
                  onClick={() => setActiveRun(run)}
                  key={run.id}
                  className={`w-full border-l-2 px-3 py-3 text-left transition-colors ${activeRun.id === run.id ? 'border-[#D99B21] bg-[#f1edc9]' : 'border-transparent hover:bg-[#f5f1d6]'}`}
                  data-testid={`button-run-${i}`}
                >
                  <div className="text-xs font-semibold text-[#133458] truncate">{run.name}</div>
                  <div className="mt-1 font-data text-[10px] font-semibold text-[#24384d] truncate">
                    {run.latitude}°N, {run.longitude}°E
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-[#556b2f] font-semibold"><Check size={11} /> Complete</span>
                    <span className="font-data font-bold text-[#133458]">{run.sst}°C</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 border-t border-[#D8D0B3] pt-4 text-xs font-semibold text-[#838921] hover:underline"
              data-testid="button-load-more-runs"
            >
              <Plus size={13} /> New reconstruction
            </button>
          </aside>
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="oe-kicker mb-1">Selected reconstruction</div>
                <h2 className="font-display text-2xl text-[#133458]">{activeRun.name}</h2>
                <div className="mt-1 font-data text-xs text-[#24384d] font-semibold">
                  {activeRun.subregion} · {activeRun.latitude}°N, {activeRun.longitude}°E · Date: {activeRun.date}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-[#e5ebd3] px-3 py-2 text-[10px] font-bold text-[#536b35]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#838921]" />
                  COMPLETE
                </span>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="oe-control flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#133458]"
                  data-testid="button-reconstruction-more"
                  title="Configure new cast with custom location, date & depths"
                >
                  <Plus size={13} /> Configure New
                </button>
              </div>
            </div>
            <ScientificProfileChart run={activeRun} />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Temperature() {
  const { runs, activeRun, setActiveRun, setDialogOpen } = useReconstructions();
  const [metric, setMetric] = useState('Temperature');
  const [period, setPeriod] = useState('January 2023');

  return (
    <AppShell>
      <div className="oe-page oe-grid">
        <SectionHeading
          eyebrow={`Thermal analytics · ${studyRegion}`}
          title="Temperature"
          description="Compare surface and subsurface temperature visualizations from the North Indian Ocean study field."
          action={
            <button className="oe-control flex items-center gap-2" data-testid="button-export-temperature">
              <Download size={15} /> Export CSV
            </button>
          }
        />
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {['Temperature', 'Anomaly', 'RMSE'].map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`oe-control ${metric === m ? 'oe-primary' : ''}`} data-testid={`button-temperature-metric-${m.toLowerCase()}`}>
              {m}
            </button>
          ))}
          <div className="flex items-center gap-1.5 sm:ml-2 sm:border-l sm:border-[#D8D0B3] sm:pl-3">
            <span className="text-[10px] uppercase font-data text-[#536675]">Cast:</span>
            <select
              value={activeRun.id}
              onChange={(e) => {
                const found = runs.find((r) => r.id === e.target.value);
                if (found) setActiveRun(found);
              }}
              className="oe-control text-xs py-1"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.sst}°C)
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setDialogOpen(true)}
              className="oe-control oe-primary flex items-center gap-1.5 text-xs"
            >
              <Plus size={14} /> New reconstruction
            </button>
            <button className="oe-control flex items-center gap-2" data-testid="button-period">
              <RotateCcw size={14} /> {period}
            </button>
          </div>
        </div>
        <section className="oe-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="oe-kicker mb-1">{studyRegion} · {metric} · {activeRun.name}</div>
              <h2 className="font-display text-2xl text-[#133458]">Surface and subsurface thermal field</h2>
            </div>
            <div className="flex gap-5 text-[10px] text-[#536675]">
              <span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#133458]" /> Observed baseline</span>
              <span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#D99B21]" /> Reconstructed profile</span>
            </div>
          </div>
          <div className="mt-6 h-[300px]"><Chart variant={metric === 'RMSE' ? 'bars' : 'line'} /></div>
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="oe-card p-5">
            <div className="oe-kicker mb-1">Active Cast: {activeRun.name}</div>
            <h2 className="font-display text-2xl text-[#133458]">Temperatures across depths</h2>
            <div className="mt-5 space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
              {activeRun.depths.map((d, idx) => (
                <div key={d} className="grid grid-cols-[85px_1fr_60px] items-center gap-3 text-xs">
                  <span className="font-data text-[10px] text-[#536675]">{d} m</span>
                  <div className="h-2 bg-[#e8e2ba] rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-[#838921]"
                      style={{ width: `${Math.min(100, Math.max(8, (activeRun.temperatures[idx] / 30) * 100))}%` }}
                    />
                  </div>
                  <span className="font-data text-right font-bold text-[#133458]">{activeRun.temperatures[idx]}°C</span>
                </div>
              ))}
            </div>
          </section>
          <section className="oe-card p-5">
            <div className="oe-kicker mb-1">Profile overview</div>
            <h2 className="font-display text-2xl text-[#133458]">{activeRun.name}</h2>
            <div className="mt-5 divide-y divide-[#D8D0B3]">
              {[
                ['Coordinates', `${activeRun.latitude}°N, ${activeRun.longitude}°E`, 'Observation coordinates'],
                ['Observation date', activeRun.date, 'Cast date'],
                ['Surface SST', `${activeRun.sst}°C`, 'NOAA OISST surface input'],
                ['Sea surface height', `${activeRun.ssha} m`, 'Copernicus SSHa input'],
                ['Salinity', `${activeRun.sss} psu`, 'Copernicus SSS input'],
                ['Thermocline depth (Z20)', `${activeRun.z20} m`, 'Estimated 20°C isotherm'],
                ['Profile Test RMSE', `${activeRun.rmse}°C`, 'Held-out float benchmark']
              ].map(([a,b,c]) => (
                <div key={a} className="flex items-center justify-between gap-4 py-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[#133458]">{a}</div>
                    <div className="mt-0.5 text-[10px] text-[#536675]">{c}</div>
                  </div>
                  <div className="font-data text-right text-xs text-[#D99B21] font-semibold">{b}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Performance() {
  const [tab, setTab] = useState('By depth');
  const { runs, setDialogOpen, setActiveRun } = useReconstructions();
  const [, setLocation] = useLocation();

  const avgRmse = useMemo(() => {
    if (!runs.length) return '0.554';
    const sum = runs.reduce((acc, r) => acc + (typeof r.rmse === 'number' ? r.rmse : parseFloat(String(r.rmse)) || 0.55), 0);
    return (sum / runs.length).toFixed(3);
  }, [runs]);

  return (
    <AppShell>
      <div className="oe-page">
        <SectionHeading
          eyebrow={`Validation lab · ${studyRegion}`}
          title="Performance"
          description="Measure the Convolutional Encoder + MLP (Fully Connected) Decoder on the North Indian Ocean test set."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDialogOpen(true)}
                className="oe-control oe-primary flex items-center gap-1.5"
                data-testid="performance-new-reconstruction"
              >
                <Plus size={15} /> New reconstruction
              </button>
              <Link href="/performance/architecture" className="oe-control flex items-center gap-2" data-testid="link-model-architecture">
                <Network size={15} /> Model architecture
              </Link>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Overall Test RMSE" value={`${avgRmse}°C`} note={`${runs.length} reconstructions evaluated`} icon={Activity} accent />
          <StatCard label="Active Reconstructions" value={String(runs.length)} note="User & calibrated casts" icon={Layers3} />
          <StatCard label="Measurements" value="141,433" note="January 2023 · NIO test set" icon={Database} />
        </div>

        <section className="oe-card mt-5 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="oe-kicker mb-1">Inference Benchmarks</div>
              <h2 className="font-display text-2xl text-[#133458]">Active Reconstruction Profiles</h2>
            </div>
            <span className="font-data text-[10px] font-bold text-[#133458] uppercase">{runs.length} PROFILES IN MEMORY</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-[#D8D0B3] font-data text-[10px] font-bold uppercase tracking-wider text-[#133458]">
                  <th className="pb-3">Profile Name</th>
                  <th className="pb-3">Coordinates</th>
                  <th className="pb-3">Observation Date</th>
                  <th className="pb-3">Depths</th>
                  <th className="pb-3">SST</th>
                  <th className="pb-3">z20</th>
                  <th className="pb-3">RMSE</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-[#D8D0B3]/60 text-xs hover:bg-[#FAF7BB]/40 transition-colors">
                    <td className="py-3 font-semibold text-[#133458]">
                      <div>{r.name}</div>
                      <div className="font-mono text-[9px] font-semibold text-[#24384d]">{r.subregion}</div>
                    </td>
                    <td className="py-3 font-mono text-[#24384d] font-medium">{r.latitude.toFixed(2)}°N, {r.longitude.toFixed(2)}°E</td>
                    <td className="py-3 font-data text-[#24384d] font-medium">{r.date}</td>
                    <td className="py-3 font-data text-[#133458] font-semibold">{r.depths.length} levels</td>
                    <td className="py-3 font-data text-[#133458] font-semibold">{r.sst.toFixed(1)}°C</td>
                    <td className="py-3 font-data text-[#838921] font-bold">{r.z20}m</td>
                    <td className="py-3 font-data text-[#133458] font-bold">±{r.rmse}°C</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => {
                          setActiveRun(r);
                          setLocation('/reconstructions');
                        }}
                        className="text-[11px] font-bold text-[#838921] hover:underline"
                      >
                        Inspect profile →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="oe-card mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="oe-kicker mb-1">Model quality</div>
              <h2 className="font-display text-2xl text-[#133458]">RMSE by depth band</h2>
            </div>
            <div className="flex gap-1 bg-[#f1edc9] p-1">
              {['By depth', 'By subregion'].map((x) => (
                <button
                  onClick={() => setTab(x)}
                  key={x}
                  className={`px-3 py-2 text-[11px] font-bold ${tab === x ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#24384d]'}`}
                  data-testid={`button-performance-tab-${x.toLowerCase().replace(' ', '-')}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[590px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#D8D0B3] font-data text-[10px] font-bold uppercase tracking-wider text-[#133458]">
                  <th className="pb-3">Depth band</th>
                  <th className="pb-3"># Measurements</th>
                  <th className="pb-3">RMSE (°C)</th>
                </tr>
              </thead>
              <tbody>
                {depthValues.map((row) => (
                  <tr key={row.depth} className="border-b border-[#D8D0B3]/60 text-xs">
                    <td className="py-4 font-semibold text-[#133458]">{tab === 'By depth' ? row.depth : studyRegion}</td>
                    <td className="py-4 font-data text-[#24384d] font-semibold">{row.measurements}</td>
                    <td className="py-4 font-data text-[#133458] font-bold">{row.rmse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <PerformanceGraphs />
        <section className="oe-card mt-5 p-5">
          <div className="oe-kicker mb-1">Test set summary</div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl text-[#133458]">North Indian Ocean validation</h2>
            <span className="font-data text-[10px] font-bold text-[#133458]">JANUARY 2023 · 1 MONTH</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[530px] text-left">
              <thead>
                <tr className="border-b border-[#D8D0B3] font-data text-[10px] font-bold uppercase tracking-wider text-[#133458]">
                  <th className="pb-3">Metric</th>
                  <th className="pb-3">Value</th>
                  <th className="pb-3">Scope</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Overall Test RMSE', `${avgRmse}°C`, studyRegion],
                  ['Total Floats', '228', '183 train / 45 test'],
                  ['Total Measurements', '141,433', studyBounds],
                  ['Active Reconstruction Profiles', `${runs.length} profiles`, 'Dynamic memory store'],
                  ['Model', 'CNN + MLP', 'Convolutional Encoder + MLP Decoder']
                ].map(([a,b,c]) => (
                  <tr key={a} className="border-b border-[#D8D0B3]/60 text-xs">
                    <td className="py-4 font-semibold text-[#133458]">{a}</td>
                    <td className="py-4 font-data font-bold text-[#133458]">{b}</td>
                    <td className="py-4 font-data text-[#24384d] font-semibold">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Dataset() {
  const [query, setQuery] = useState('');
  const { runs, setDialogOpen, setActiveRun } = useReconstructions();
  const [, setLocation] = useLocation();

  const sources = useMemo(() => [
    ['NOAA OISST', 'Sea Surface Temperature', 'January 2023', 'Input feature', studyRegion],
    ['Copernicus SSHA', 'Sea Surface Height Anomaly', 'January 2023', 'Input feature', studyRegion],
    ['Copernicus SSS', 'Sea Surface Salinity', 'January 2023', 'Input feature', studyRegion],
    ['Copernicus Surface currents', 'Surface currents', 'January 2023', 'Input feature', studyRegion],
    ['Argovis / Argo', 'Subsurface Temperature Profiles', 'January 2023', 'Target profiles', studyRegion],
    ['OceanEmbed Reconstructions', `${runs.length} User & Calibrated Casts`, 'Jan 2023 / Real-time', 'Inferred profiles', studyRegion]
  ].filter((s) => s.join(' ').toLowerCase().includes(query.toLowerCase())), [query, runs]);

  return (
    <AppShell>
      <div className="oe-page">
        <SectionHeading
          eyebrow={`Source registry · ${studyRegion}`}
          title="Dataset"
          description="The data sources used for the North Indian Ocean study and its subsurface temperature profiles."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDialogOpen(true)}
                className="oe-control oe-primary flex items-center gap-2"
                data-testid="button-new-reconstruction-dataset"
              >
                <Plus size={15} /> New reconstruction
              </button>
              <button className="oe-control flex items-center gap-2" data-testid="button-add-source">
                <Plus size={15} /> Add source
              </button>
            </div>
          }
        />
        <div className="grid gap-5 lg:grid-cols-[1fr_285px]">
          <section className="oe-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-[#133458]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sources"
                  className="h-9 w-64 border border-[#D8D0B3] bg-[#FAF7BB] pl-9 pr-3 text-xs text-[#133458] font-semibold outline-none focus:border-[#838921]"
                  data-testid="input-search-dataset"
                />
              </div>
              <button className="oe-control flex items-center gap-2 font-semibold" data-testid="button-filter-dataset">
                <SlidersHorizontal size={14} /> Filters
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="border-b border-[#D8D0B3] font-data text-[10px] font-bold uppercase tracking-wider text-[#133458]">
                    <th className="pb-3">Source</th>
                    <th className="pb-3">Coverage</th>
                    <th className="pb-3">Period</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s[0]} className="border-b border-[#D8D0B3]/60 text-xs">
                      <td className="py-4">
                        <div className="font-semibold text-[#133458]">{s[0]}</div>
                        <div className="mt-1 text-[10px] text-[#24384d] font-medium">{s[1]}</div>
                      </td>
                      <td className="py-4 text-[#24384d] font-semibold">{s[4]}</td>
                      <td className="py-4 font-data text-[10px] text-[#133458] font-bold">{s[2]}</td>
                      <td className="py-4 font-data text-[10px] text-[#24384d] font-semibold">{s[3]}</td>
                      <td className="py-4">
                        <span className="flex items-center gap-1.5 text-[#536b35]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#838921]" /> Included
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sources.length === 0 && <div className="py-14 text-center text-sm text-[#536675]">No sources match “{query}”.</div>}
            </div>

            <div className="mt-8 border-t border-[#D8D0B3] pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="oe-kicker mb-1">Local Registry Profiles</div>
                  <h3 className="font-display text-lg text-[#133458]">Active Reconstructed Profiles</h3>
                </div>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="text-xs font-semibold text-[#838921] hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add reconstruction
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {runs.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setActiveRun(r);
                      setLocation('/reconstructions');
                    }}
                    className="border border-[#D8D0B3] bg-[#FAF7BB]/50 p-3 hover:border-[#838921] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[#133458]">{r.name}</span>
                      <span className="font-mono text-[9px] text-[#838921] font-bold">±{r.rmse}°C</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[#24384d] font-medium">{r.latitude.toFixed(2)}°N, {r.longitude.toFixed(2)}°E · {r.date}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#24384d] font-semibold">
                      <span>{r.depths.length} levels ({r.depths[0]}m-{r.depths[r.depths.length - 1]}m)</span>
                      <span className="text-[#838921] font-bold">View →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <aside className="space-y-5">
            <div className="rounded-sm border border-[#294966] bg-[#133458] p-5 text-[#FAF7BB]">
              <div className="oe-kicker !text-[#D99B21]">Study region</div>
              <div className="mt-4 font-data text-2xl font-bold text-white">North Indian Ocean</div>
              <p className="mt-2 text-xs leading-5 text-white/85 font-medium">{studyBounds}. Subregions: Arabian Sea and Bay of Bengal.</p>
              <div className="mt-5 h-1 bg-[#FAF7BB]/25"><div className="h-full w-full bg-[#D99B21]" /></div>
            </div>
            <div className="oe-card p-5">
              <div className="oe-kicker mb-1">Dataset summary</div>
              <h2 className="font-display text-2xl text-[#133458]">January 2023</h2>
              <div className="mt-5 flex items-center gap-3">
                <Cloud size={20} className="text-[#838921]" />
                <div>
                  <div className="font-data text-sm font-bold text-[#133458]">1 month · {runs.length} Profiles</div>
                  <div className="mt-1 text-[11px] font-semibold text-[#24384d]">228 floats · 141,433 measurements · {runs.length} active reconstructions</div>
                </div>
              </div>
              <button className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#838921]" data-testid="button-refresh-dataset">
                <RotateCcw size={13} /> Check for updates
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Architecture() {
  const nodes: Array<{ n: string; title: string; sub: string; icon: Icon }> = [
    { n: '01', title: 'Surface inputs', sub: 'SST · SSHA · SSS', icon: Globe2 },
    { n: '02', title: 'Convolutional encoder', sub: 'Spatial features', icon: Network },
    { n: '03', title: 'Latent representation', sub: 'Ocean feature vector', icon: Waves },
    { n: '04', title: 'MLP decoder', sub: 'Fully connected output', icon: Mountain },
  ];

  return (
    <AppShell>
      <div className="oe-page oe-grid">
        <SectionHeading
          eyebrow={`Model card · ${studyRegion}`}
          title="Architecture"
          description="Convolutional Encoder + MLP (Fully Connected) Decoder for North Indian Ocean subsurface temperature reconstruction."
          action={
            <button className="oe-control flex items-center gap-2" data-testid="button-download-model-card">
              <Download size={15} /> Download model card
            </button>
          }
        />
        <div className="oe-card overflow-hidden">
          <div className="border-b border-[#D8D0B3] bg-[#133458] px-5 py-4 text-[#FAF7BB]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-data text-[10px] tracking-[.1em]">OCEANEMBED / CONVOLUTIONAL ENCODER + MLP DECODER</div>
              <span className="flex items-center gap-2 text-[10px] text-[#FAF7BB]/60">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D99B21]" /> study model
              </span>
            </div>
          </div>
          <div className="overflow-x-auto p-8">
            <div className="flex min-w-[850px] items-center justify-center gap-3">
              {nodes.map(({ n, title, sub, icon: ArchitectureIcon }, i) => (
                <div className="flex items-center gap-3" key={title}>
                  <div className="w-[172px] border border-[#D8D0B3] bg-[#f5f1d6] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-data text-[10px] text-[#D99B21]">{n}</span>
                      <ArchitectureIcon size={17} className="text-[#838921]" />
                    </div>
                    <div className="mt-8 text-xs font-semibold text-[#133458]">{title}</div>
                    <div className="mt-1 font-data text-[9px] text-[#536675]">{sub}</div>
                    <div className="mt-4 flex gap-1">
                      {[1,2,3,4,5].map((x) => (
                        <span key={x} className={`h-1.5 flex-1 ${x <= i + 2 ? 'bg-[#838921]' : 'bg-[#D8D0B3]'}`} />
                      ))}
                    </div>
                  </div>
                  {i < 3 && <ArrowRight className="shrink-0 text-[#D99B21]" size={18} />}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-0 border-t border-[#D8D0B3] sm:grid-cols-3">
            <div className="border-b border-[#D8D0B3] p-5 sm:border-b-0 sm:border-r">
              <div className="oe-label">Model</div>
              <div className="mt-2 font-data text-sm leading-5 text-[#133458]">Convolutional Encoder + MLP</div>
            </div>
            <div className="border-b border-[#D8D0B3] p-5 sm:border-b-0 sm:border-r">
              <div className="oe-label">Study region</div>
              <div className="mt-2 font-data text-xl text-[#133458]">North Indian Ocean</div>
            </div>
            <div className="p-5">
              <div className="oe-label">Test period</div>
              <div className="mt-2 font-data text-xl text-[#133458]">January 2023</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SettingsNio() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('oe_theme') === 'dark';
    }
    return false;
  });
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('Appearance');
  const [toggles, setToggles] = useState({ grid: true, notifications: true, animation: true, telemetry: false });
  const toggle = (key: keyof typeof toggles) => setToggles((old) => ({ ...old, [key]: !old[key] }));
  const Toggle = ({ name, value, onChange }: { name: keyof typeof toggles; value: boolean; onChange?: () => void }) => (
    <button onClick={() => onChange ? onChange() : toggle(name)} className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-[#838921]' : 'bg-[#c9c3a7]'}`} aria-label={`Toggle ${name}`} data-testid={`toggle-${name}`}>
      <span className={`absolute top-1 h-3 w-3 rounded-full bg-[#FAF7BB] transition-transform ${value ? 'left-5' : 'left-1'}`} />
    </button>
  );

  const handleDarkToggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('oe_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('oe_theme', 'light');
    }
  };

  return (
    <AppShell>
      <div className="oe-page">
        <SectionHeading
          eyebrow={`Lab preferences · ${studyRegion}`}
          title="Settings"
          description="Keep the OceanEmbed workspace aligned to the North Indian Ocean study context."
          action={
            <button onClick={() => setSaved(true)} className="oe-control oe-primary flex items-center gap-2" data-testid="button-save-settings">
              <Check size={15} /> {saved ? 'Saved' : 'Save changes'}
            </button>
          }
        />
        <div className="grid gap-5 lg:grid-cols-[205px_1fr]">
          <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {['Appearance', 'Data & privacy', 'Map defaults', 'Model behavior', 'Notifications', 'About OceanEmbed'].map((x) => (
              <button
                key={x}
                onClick={() => setActiveSection(x)}
                className={`whitespace-nowrap px-3 py-2 text-left text-xs ${activeSection === x ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:bg-[#f1edc9]'}`}
                data-testid={`button-settings-section-${x.toLowerCase().replaceAll(' ', '-')}`}
              >
                {x}
              </button>
            ))}
          </nav>
          <div className="space-y-5">
            <section className="oe-card p-5 sm:p-6">
              <div className="oe-kicker mb-1">{activeSection}</div>
              <h2 className="font-display text-2xl text-[#133458]">Reading environment</h2>
              <div className="mt-6 divide-y divide-[#D8D0B3]">
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="text-sm font-semibold text-[#133458]">Dark field mode</div>
                    <div className="mt-1 text-xs text-[#536675]">Use a low-light palette for overnight analysis sessions.</div>
                  </div>
                  <Toggle name="grid" value={dark} onChange={handleDarkToggle} />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="text-sm font-semibold text-[#133458]">Show coordinate grid</div>
                    <div className="mt-1 text-xs text-[#536675]">Keep latitude and longitude guides visible within {studyBounds}.</div>
                  </div>
                  <Toggle name="grid" value={toggles.grid} />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <div className="text-sm font-semibold text-[#133458]">Motion and transitions</div>
                    <div className="mt-1 text-xs text-[#536675]">Subtle movement helps indicate study-field updates.</div>
                  </div>
                  <Toggle name="animation" value={toggles.animation} />
                </div>
              </div>
            </section>
            <section className="oe-card p-5 sm:p-6">
              <div className="oe-kicker mb-1">Map defaults</div>
              <h2 className="font-display text-2xl text-[#133458]">Start each session here</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-[#536675]">
                  Default layer
                  <select className="oe-control mt-2 w-full" data-testid="select-default-layer">
                    <option>Sea surface temperature</option>
                    <option>Subsurface reconstruction</option>
                    <option>Model confidence</option>
                  </select>
                </label>
                <label className="text-xs text-[#536675]">
                  Default basin
                  <select className="oe-control mt-2 w-full" data-testid="select-default-basin">
                    <option>North Indian Ocean</option>
                    <option>Arabian Sea</option>
                    <option>Bay of Bengal</option>
                  </select>
                </label>
              </div>
            </section>
            <section className="oe-card p-5 sm:p-6">
              <div className="oe-kicker mb-1">Study context</div>
              <h2 className="font-display text-2xl text-[#133458]">North Indian Ocean</h2>
              <div className="mt-5 divide-y divide-[#D8D0B3]">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-xs text-[#536675]">Study bounds</span>
                  <span className="font-data text-xs text-[#133458]">{studyBounds}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-xs text-[#536675]">Subregions</span>
                  <span className="font-data text-xs text-[#133458]">Arabian Sea · Bay of Bengal</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-xs text-[#536675]">Test period</span>
                  <span className="font-data text-xs text-[#133458]">January 2023 · 1 month</span>
                </div>
              </div>
            </section>
            <section className="oe-card p-5 sm:p-6">
              <div className="oe-kicker mb-1">Notifications</div>
              <h2 className="font-display text-2xl text-[#133458]">Research signals</h2>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#133458]">New profile clusters</div>
                  <div className="mt-1 text-xs text-[#536675]">Notify when a North Indian Ocean region receives new evidence.</div>
                </div>
                <Toggle name="notifications" value={toggles.notifications} />
              </div>
            </section>
            <section className="oe-card bg-[#133458] p-5 text-[#FAF7BB] sm:p-6">
              <div className="flex items-center gap-3">
                <Waves size={19} className="text-[#D99B21]" />
                <div className="font-display text-xl">OceanEmbed</div>
              </div>
              <p className="mt-3 max-w-xl text-xs leading-5 text-[#FAF7BB]/60">
                A research instrument for reading the North Indian Ocean below the surface. Connected with Supabase PostgreSQL for persistence and authentication.
              </p>
              <div className="mt-5 font-data text-[9px] tracking-wider text-[#FAF7BB]/40">
                NORTH INDIAN OCEAN · JANUARY 2023 · MODEL CONTEXT
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LandingNio() {
  const { isSignedIn } = useSupabaseAuth();
  const authTarget = isSignedIn ? '/dashboard' : '/sign-in';

  return (
    <div className="min-h-[100dvh] bg-[#FAF7BB] text-[#133458]">
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-6 md:px-12">
        <Logo />
        <div className="hidden items-center gap-8 text-xs text-[#133458]/65 md:flex">
          <a href="#instrument" data-testid="link-landing-instrument">The instrument</a>
          <a href="#method" data-testid="link-landing-method">Method</a>
          <a href="#field" data-testid="link-landing-field">Field notes</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={authTarget}
            className="flex items-center gap-2 border border-[#133458]/25 px-4 py-2.5 text-xs font-semibold hover:bg-[#133458] hover:text-[#FAF7BB] transition-colors"
            data-testid="link-enter-workspace"
          >
            {isSignedIn ? 'Enter workspace' : 'Sign In'} <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <section className="relative min-h-[760px] overflow-hidden bg-[#133458] px-6 pb-20 pt-40 text-[#FAF7BB] md:px-16 md:pt-48">
        <div className="absolute right-[-8%] top-[7%] h-[620px] w-[620px] rounded-full border border-[#FAF7BB]/10 md:h-[800px] md:w-[800px]" />
        <div className="absolute right-[7%] top-[23%] h-[420px] w-[420px] rounded-full border border-[#D99B21]/25 md:h-[590px] md:w-[590px]" />
        <div className="relative z-10 max-w-3xl animate-rise">
          <div className="mb-6 flex items-center gap-3 font-data text-[10px] uppercase tracking-[.22em] text-[#D99B21]">
            <span className="h-px w-9 bg-[#D99B21]" /> North Indian Ocean · January 2023
          </div>
          <h1 className="max-w-4xl font-display text-[clamp(60px,9vw,138px)] leading-[.86] tracking-[-.05em]">
            See beneath<br /><i className="text-[#D99B21]">the surface.</i>
          </h1>
          <p className="mt-9 max-w-lg text-base leading-7 text-[#FAF7BB]/65 md:text-lg">
            OceanEmbed reconstructs subsurface temperature in the North Indian Ocean from surface observations, covering the Arabian Sea and Bay of Bengal.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={authTarget}
              className="flex items-center gap-3 bg-[#D99B21] px-5 py-3.5 text-xs font-bold text-[#133458] hover:bg-[#FAF7BB] transition-colors"
              data-testid="link-hero-start"
            >
              Open the instrument <ArrowRight size={15} />
            </Link>
            <a href="#instrument" className="flex items-center gap-2 px-3 py-3.5 text-xs text-[#FAF7BB]/65 hover:text-[#FAF7BB]" data-testid="link-hero-learn">
              Read the field notes <ChevronDown size={14} />
            </a>
          </div>
        </div>
        <div className="absolute bottom-10 right-10 hidden w-60 md:block">
          <div className="mb-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45">
            <span>NORTH INDIAN OCEAN</span><span>JANUARY 2023</span>
          </div>
          <svg viewBox="0 0 240 72" className="w-full">
            <path d="M0 46c20-32 30 24 52-3s31 15 51-8 29 24 49-1 31 18 44-5 25-9 44-20" fill="none" stroke="#D99B21" strokeWidth="1.5" />
            <path d="M0 62c30-20 42 5 69-11s35 4 61-12 42 5 61-5 27-3 49-15" fill="none" stroke="#9caf68" strokeWidth="1" />
          </svg>
          <div className="mt-2 font-data text-[9px] text-[#FAF7BB]/45">SUBSURFACE TEMPERATURE / {studyBounds}</div>
        </div>
      </section>
      <section id="instrument" className="px-6 py-24 md:px-16 md:py-32">
        <div className="grid gap-14 md:grid-cols-[.75fr_1.25fr] md:items-end">
          <div>
            <div className="oe-kicker mb-4">The instrument</div>
            <h2 className="font-display text-[clamp(38px,5vw,71px)] leading-[.95] tracking-[-.04em]">
              A clearer read<br />on the North Indian Ocean.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#536675]">
            OceanEmbed combines NOAA OISST, Copernicus SSHA, Copernicus SSS, Copernicus Surface currents, and Argovis / Argo subsurface temperature profiles for one focused study field.
          </p>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <div className="border-t-2 border-[#D99B21] pt-5">
            <div className="font-data text-4xl">228</div>
            <div className="mt-2 text-xs text-[#536675]">total floats in the study</div>
          </div>
          <div className="border-t-2 border-[#838921] pt-5">
            <div className="font-data text-4xl">141,433</div>
            <div className="mt-2 text-xs text-[#536675]">total measurements</div>
          </div>
          <div className="border-t-2 border-[#133458] pt-5">
            <div className="font-data text-4xl">0.554°C</div>
            <div className="mt-2 text-xs text-[#536675]">overall test RMSE</div>
          </div>
        </div>
      </section>
      <section id="method" className="bg-[#e8e2ba] px-6 py-24 md:px-16 md:py-32">
        <div className="grid gap-12 md:grid-cols-[.7fr_1.3fr]">
          <div>
            <div className="oe-kicker mb-4">Model / Convolutional Encoder + MLP</div>
            <h2 className="font-display text-[clamp(39px,5vw,67px)] leading-[.95]">From surface<br />to depth.</h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-[#536675]">
              A Convolutional Encoder + MLP (Fully Connected) Decoder maps North Indian Ocean surface signals to subsurface temperature profiles.
            </p>
            <Link href="/performance/architecture" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-[#838921]" data-testid="link-landing-architecture">
              Explore model architecture <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-[#FAF7BB] p-6">
              <div className="font-data text-xs text-[#D99B21]">01 / OBSERVE</div>
              <h3 className="mt-12 font-display text-2xl">Read the field</h3>
              <p className="mt-3 text-xs leading-5 text-[#536675]">Surface temperature, height anomaly, salinity, and currents define the North Indian Ocean input field.</p>
            </div>
            <div className="mt-8 bg-[#133458] p-6 text-[#FAF7BB] md:mt-0">
              <div className="font-data text-xs text-[#D99B21]">02 / ENCODE</div>
              <h3 className="mt-12 font-display text-2xl">Learn spatial structure</h3>
              <p className="mt-3 text-xs leading-5 text-[#FAF7BB]/60">Convolutional layers turn the surface inputs into a compact ocean feature representation.</p>
            </div>
            <div className="bg-[#838921] p-6 text-[#FAF7BB] md:col-span-2">
              <div className="font-data text-xs text-[#FAF7BB]/60">03 / DECODE</div>
              <h3 className="mt-12 font-display text-2xl">Resolve the unseen</h3>
              <p className="mt-3 max-w-md text-xs leading-5 text-[#FAF7BB]/70">A fully connected MLP decoder maps the representation to predicted subsurface temperature across depth.</p>
            </div>
          </div>
        </div>
      </section>
      <section id="field" className="bg-[#133458] px-6 py-24 text-[#FAF7BB] md:px-16 md:py-32">
        <div className="grid gap-12 md:grid-cols-[1fr_1fr] md:items-center">
          <div>
            <div className="oe-kicker !text-[#D99B21]">Field notes / North Indian Ocean</div>
            <h2 className="mt-4 font-display text-[clamp(40px,5vw,70px)] leading-[.95]">
              “The signal is<br /><i className="text-[#D99B21]">in the gradient.”</i>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-7 text-[#FAF7BB]/60">
              The Arabian Sea and Bay of Bengal are the two subregions in the January 2023 study field. OceanEmbed keeps their subsurface temperature structure in view.
            </p>
            <Link href="/map" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-[#D99B21]" data-testid="link-landing-map">
              Open the study field <ArrowRight size={14} />
            </Link>
          </div>
          <div className="border border-[#FAF7BB]/15 p-4">
            <OceanMap compact selectedLayer="Subsurface reconstruction" />
            <div className="mt-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45">
              <span>{studyBounds}</span><span>JANUARY 2023</span>
            </div>
          </div>
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF7BB] px-6 py-8 text-xs md:px-16">
        <Logo />
        <span className="text-[#536675]">A research instrument for the North Indian Ocean.</span>
        <Link href={authTarget} className="font-semibold text-[#838921]" data-testid="link-footer-workspace">
          {isSignedIn ? 'Enter workspace' : 'Open the instrument'} <ArrowRight size={13} className="ml-1 inline" />
        </Link>
      </footer>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><ProtectedPage><Dashboard /></ProtectedPage></Route>
        <Route path="/map"><ProtectedPage><MapNio /></ProtectedPage></Route>
        <Route path="/reconstructions"><ProtectedPage><ReconstructionsScientific /></ProtectedPage></Route>
        <Route path="/temperature"><ProtectedPage><Temperature /></ProtectedPage></Route>
        <Route path="/performance/architecture"><ProtectedPage><Architecture /></ProtectedPage></Route>
        <Route path="/performance"><ProtectedPage><Performance /></ProtectedPage></Route>
        <Route path="/dataset"><ProtectedPage><Dataset /></ProtectedPage></Route>
        <Route path="/settings"><ProtectedPage><SettingsNio /></ProtectedPage></Route>
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem('oe_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <WouterRouter base={basePath}>
      <SupabaseAuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ReconstructionsProvider>
              <Router />
              <Toaster />
            </ReconstructionsProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </SupabaseAuthProvider>
    </WouterRouter>
  );
}

export default App;