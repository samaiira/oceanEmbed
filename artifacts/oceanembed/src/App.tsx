import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClerkProvider,
  Show,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, BookOpen, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Cloud, Database, Download, ExternalLink, Eye, FileText,
  FlaskConical, Gauge, Globe2, Layers3, LineChart, Menu, MoreHorizontal, Mountain,
  Network, Pause, Play, Plus, RotateCcw, Search, Settings2, SlidersHorizontal,
  Sparkles, Thermometer, TrendingUp, Waves, X, Zap
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#133458',
    colorForeground: '#133458',
    colorMutedForeground: '#536675',
    colorDanger: '#9a443d',
    colorBackground: '#FAF7BB',
    colorInput: '#fffdf0',
    colorInputForeground: '#133458',
    colorNeutral: '#D8D0B3',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '2px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FAF7BB] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#D8D0B3]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display !text-[#133458]',
    headerSubtitle: '!text-[#536675]',
    socialButtonsBlockButtonText: '!text-[#133458]',
    formFieldLabel: '!text-[#133458]',
    footerActionLink: '!text-[#838921]',
    footerActionText: '!text-[#536675]',
    dividerText: '!text-[#536675]',
    identityPreviewEditButton: '!text-[#838921]',
    formFieldSuccessText: '!text-[#838921]',
    alertText: '!text-[#133458]',
    logoBox: 'mb-4',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: '!border-[#D8D0B3] !bg-[#FAF7BB] hover:!bg-[#f1edc9]',
    formButtonPrimary: '!bg-[#133458] hover:!bg-[#838921] !text-[#FAF7BB]',
    formFieldInput: '!border-[#D8D0B3] !bg-[#fffdf0] !text-[#133458]',
    footerAction: '!bg-transparent',
    dividerLine: '!bg-[#D8D0B3]',
    alert: '!bg-[#f1edc9] !border-[#D8D0B3]',
    otpCodeFieldInput: '!border-[#D8D0B3] !bg-[#fffdf0] !text-[#133458]',
    formFieldRow: '',
    main: '!bg-transparent',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#133458] px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#133458] px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });

    return unsubscribe;
  }, [addListener]);

  return null;
}

function AuthSessionBridge() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    void fetch(`${basePath}/api/auth/session`, {
      credentials: 'include',
    }).catch(() => {
      // The Clerk client remains the source of truth for the browser session.
    });
  }, [isLoaded, isSignedIn]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingNio />
      </Show>
    </>
  );
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-[100dvh] bg-[#FAF7BB]" />;
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

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className="flex items-center gap-3" data-testid="link-home-logo">
    <span className={`grid h-9 w-9 place-items-center rounded-sm ${light ? 'bg-[#FAF7BB] text-[#133458]' : 'bg-[#133458] text-[#FAF7BB]'}`}>
      <Waves size={20} strokeWidth={1.7} />
    </span>
    <span className={`font-display text-[22px] tracking-[-.03em] ${light ? 'text-[#FAF7BB]' : 'text-[#133458]'}`}>OceanEmbed</span>
  </Link>;
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'Research lead';
  const initials = (user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0] || 'O').toUpperCase();
  return <>
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
            return <Link key={href} href={href} onClick={onClose} className={`group flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] transition-colors ${active ? 'bg-[#FAF7BB] text-[#133458]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <NavIcon size={16} strokeWidth={active ? 2 : 1.5} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D99B21]" />}
            </Link>;
          })}
        </nav>
        <div className="mb-3 mt-10 px-3 font-data text-[9px] uppercase tracking-[.2em] text-[#FAF7BB]/40">System</div>
        <Link href="/settings" onClick={onClose} className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] ${location === '/settings' ? 'bg-[#FAF7BB] text-[#133458]' : 'text-[#FAF7BB]/70 hover:bg-[#FAF7BB]/10 hover:text-[#FAF7BB]'}`} data-testid="link-nav-settings"><Settings2 size={16} strokeWidth={1.5} /><span>Settings</span></Link>
      </div>
         <div className="mt-auto rounded-sm border border-[#FAF7BB]/15 bg-[#FAF7BB]/[.06] p-4">
        <div className="flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-full bg-[#9CAF68]" /> Systems nominal</div>
         <div className="mt-2 font-data text-[9px] tracking-wide text-[#FAF7BB]/45">NORTH INDIAN OCEAN · JAN 2023 · 1 MONTH</div>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-[#FAF7BB]/15 pt-5">
         <div className="grid h-8 w-8 place-items-center rounded-full bg-[#D99B21] text-xs font-semibold text-[#133458]">{initials}</div>
         <div><div className="text-xs">{userName}</div><div className="font-data text-[9px] text-[#FAF7BB]/45">Research lead</div></div>
        <MoreHorizontal className="ml-auto text-[#FAF7BB]/50" size={16} />
      </div>
    </aside>
  </>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const title = location === '/dashboard' ? 'Ocean intelligence' : navItems.find((n) => n.href === location)?.label || 'Settings';
  const userName = user?.fullName || user?.firstName || 'Research lead';
  const initials = (user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress?.[0] || 'O').toUpperCase();
  return <div className="oe-shell">
    <Sidebar open={drawer} onClose={() => setDrawer(false)} />
    <main className="min-h-[100dvh] md:pl-[248px]">
      <header className="flex h-[72px] items-center justify-between border-b border-[#D8D0B3] bg-[#FAF7BB]/70 px-5 backdrop-blur md:px-10">
        <div className="flex items-center gap-3"><button onClick={() => setDrawer(true)} className="rounded-sm border border-[#D8D0B3] p-2 md:hidden" aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={18} /></button><div className="hidden text-[13px] text-[#536675] md:block">Workspace / <span className="text-[#133458]">{title}</span></div><div className="font-display text-xl md:hidden">OceanEmbed</div></div>
        <div className="flex items-center gap-3"><button className="relative rounded-sm p-2 text-[#536675] hover:bg-[#e8e2ba]" aria-label="Notifications" data-testid="button-notifications"><Bell size={17} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#D99B21]" /></button><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="hidden items-center gap-2 border-l border-[#D8D0B3] pl-3 text-left sm:flex" aria-label="Sign out" data-testid="button-user-menu"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#838921] text-[10px] font-semibold text-[#FAF7BB]">{initials}</span><span className="max-w-[130px] truncate text-xs text-[#133458]">{userName}</span><ChevronDown size={14} className="text-[#536675]" /></button></div>
       </header>{children}
    </main>
  </div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="oe-kicker mb-2">{eyebrow}</div><h1 className="font-display text-[clamp(32px,4vw,51px)] leading-[.98] tracking-[-.035em] text-[#133458]">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#536675]">{description}</p>}</div>{action}</div>;
}

function StatCard({ label, value, note, icon: StatIcon, accent = false }: { label: string; value: string; note: string; icon: Icon; accent?: boolean }) {
  return <div className={`oe-card relative overflow-hidden p-5 ${accent ? 'bg-[#133458] text-[#FAF7BB]' : ''}`}><div className={`flex items-center justify-between ${accent ? 'text-[#FAF7BB]/65' : 'text-[#536675]'}`}><span className="oe-label">{label}</span><StatIcon size={17} strokeWidth={1.5} /></div><div className={`mt-6 font-data text-[29px] tracking-[-.06em] ${accent ? 'text-[#FAF7BB]' : 'text-[#133458]'}`}>{value}</div><div className={`mt-2 flex items-center gap-1 text-[11px] ${accent ? 'text-[#FAF7BB]/55' : 'text-[#536675]'}`}><ArrowDownRight size={13} className="text-[#838921]" />{note}</div>{accent && <div className="absolute -bottom-12 -right-7 h-28 w-28 rounded-full border border-[#FAF7BB]/10" />}</div>;
}

function MiniSparkline({ warm = false }: { warm?: boolean }) {
  return <svg viewBox="0 0 150 34" className="h-9 w-full" preserveAspectRatio="none" aria-label="Trend chart"><path d="M0 26 C15 27 17 18 30 21 S43 10 53 17 S68 8 78 13 S92 4 101 10 S118 3 130 7 S140 2 150 4" fill="none" stroke={warm ? '#D99B21' : '#838921'} strokeWidth="2" /></svg>;
}

function OceanMap({ compact = false, selectedLayer = 'Sea surface temperature', onSelect }: { compact?: boolean; selectedLayer?: string; onSelect?: (name: string) => void }) {
  const spots = [{ x: 39, y: 39, n: 'Arabian Sea' }, { x: 67, y: 39, n: 'Bay of Bengal' }];
  return <div className={`relative overflow-hidden border border-[#294966] bg-[#133458] ${compact ? 'h-[300px]' : 'h-[490px]'}`}>
    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#8da9a930 1px, transparent 1px),linear-gradient(90deg,#8da9a930 1px,transparent 1px)', backgroundSize: '42px 42px' }} />
    <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full" aria-label="Ocean data map">
      <path d="M0 0H1000V500H0z" fill="#133458" />
      <path d="M0 82C53 64 67 99 105 90c36-9 26-64 66-58 30 5 41 45 70 40 31-5 27-40 65-27 34 12 11 57 43 65 31 8 39-25 65-21 35 5 17 60 53 72 34 11 43-44 77-40 32 4 29 52 63 56 33 4 51-24 72-13 28 15 7 61 48 70 30 7 42-33 70-24 32 10 14 48 51 52 37 4 42-37 72-25 31 13 18 64 50 72 28 7 51-16 72-8v78H0z" fill="#567068" opacity=".9" />
      <path d="M0 235c37-27 55-5 82-16 35-14 21-63 57-57 35 6 31 47 69 51 35 4 41-28 72-17 30 11 12 61 46 68 39 8 50-30 78-18 31 14 11 67 47 75 37 8 45-30 77-20 32 10 16 60 51 68 42 10 49-31 78-23 36 10 15 63 53 72 38 9 39-38 70-26 32 12 20 65 56 73 39 9 44-31 76-24 33 8 24 42 58 53l42 8v-94c-30-5-47-27-77-21-33 6-33 40-68 31-36-10-19-67-56-76-34-8-41 43-76 34-34-9-22-62-57-73-32-10-46 32-77 22-35-11-21-65-55-74-38-11-45 29-75 20-33-10-17-66-53-76-33-9-42 31-77 19-39-13-21-62-55-71-38-9-43 32-77 22-36-11-30-47-63-54-34-7-33 18-69 26-32 7-45-14-82 11z" fill="#567068" opacity=".55" transform="translate(0 150)" />
      <path d="M20 442c120-24 174 12 274-13s166-4 261 7 204-29 425 12" stroke="#D99B21" strokeWidth="1.2" strokeDasharray="5 7" fill="none" opacity=".7" />
      {spots.map((s) => <g key={s.n} transform={`translate(${s.x * 10},${s.y * 10})`} onClick={() => onSelect?.(s.n)} className="cursor-pointer"><circle r="11" fill="#D99B21" opacity=".16"><animate attributeName="r" values="8;14;8" dur="3s" repeatCount="indefinite" /></circle><circle r="3.5" fill="#D99B21" stroke="#FAF7BB" strokeWidth="1" /><text x="9" y="3" fill="#FAF7BB" fontSize="11" fontFamily="Space Mono">{s.n}</text></g>)}
    </svg>
     <div className="absolute left-4 top-4 flex items-center gap-2 border border-[#FAF7BB]/15 bg-[#133458]/75 px-3 py-2 text-[10px] text-[#FAF7BB]/75 backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-[#D99B21]" /> NORTH INDIAN OCEAN <span className="font-data text-[#FAF7BB]/45">· {studyBounds}</span></div>
     <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between"><div className="text-[10px] text-[#FAF7BB]/55"><div className="mb-1 font-data text-[#FAF7BB]/80">30°N</div><div>20°N</div><div>10°N</div><div>5°N</div></div><div className="w-40"><div className="mb-1 flex justify-between font-data text-[9px] text-[#FAF7BB]/65"><span>45°E</span><span>{selectedLayer}</span><span>105°E</span></div><div className="h-1.5 bg-gradient-to-r from-[#2c6478] via-[#9caf68] to-[#d99b21]" /></div></div>
  </div>;
}

function Chart({ variant = 'line' }: { variant?: 'line' | 'bars' | 'depth' }) {
  const points = variant === 'depth' ? '8,22 50,35 92,51 134,66 176,76 218,87 260,98 302,106' : '8,84 43,72 79,77 114,55 150,62 185,38 220,48 255,24 302,31';
  return <svg viewBox="0 0 310 125" className="h-full w-full" preserveAspectRatio="none" aria-label={`${variant} research chart`}><g stroke="#d8d0b3" strokeWidth="1"><path d="M8 12H302M8 42H302M8 72H302M8 105H302" /><path d="M8 12V105M78 12V105M150 12V105M220 12V105M302 12V105" /></g>{variant === 'bars' ? <g fill="#838921">{[42,68,53,79,61,88,74,95].map((h, i) => <rect key={i} x={12 + i * 37} y={105 - h} width="21" height={h} opacity={i === 7 ? 1 : .7} />)}</g> : <><polyline points={points} fill="none" stroke={variant === 'depth' ? '#D99B21' : '#133458'} strokeWidth="2.5" /><polyline points={variant === 'depth' ? '8,31 50,43 92,58 134,70 176,83 218,91 260,102 302,112' : '8,91 43,83 79,86 114,73 150,75 185,53 220,58 255,44 302,47'} fill="none" stroke="#9caf68" strokeWidth="1.5" strokeDasharray="4 4" /></>}<g fill="#536675" fontFamily="Space Mono" fontSize="8"><text x="8" y="120">JAN</text><text x="145" y="120">JUN</text><text x="270" y="120">DEC</text></g></svg>;
}

function PerformanceGraphs() {
  const maxRmse = 0.9;
  const maxIterativeRmse = 1.6;
  return <div className="mt-5 grid gap-5 lg:grid-cols-2">
    <section className="oe-card bg-[#133458] p-5 text-[#FAF7BB]">
       <div className="oe-kicker !text-[#000000]">A. RMSE by depth band</div>
      <h2 className="mt-1 font-display text-2xl">North Indian Ocean test results</h2>
      <div className="mt-5 h-56">
        <svg viewBox="0 0 620 250" className="h-full w-full" role="img" aria-label="RMSE by depth band in degrees Celsius">
          <g stroke="#FAF7BB" strokeOpacity=".14" strokeWidth="1">
            {[0, .3, .6, .9].map((value) => <line key={value} x1="46" x2="600" y1={210 - (value / maxRmse) * 170} y2={210 - (value / maxRmse) * 170} />)}
          </g>
          <g fill="#000000" fillOpacity=".65" fontFamily="Space Mono" fontSize="10">
            <text x="11" y="214">0.0</text><text x="11" y="157">0.3</text><text x="11" y="100">0.6</text><text x="11" y="44">0.9</text>
          </g>
          {depthValues.map((row, index) => {
            const value = Number(row.rmse);
            const height = (value / maxRmse) * 170;
            const x = 78 + index * 130;
            return <g key={row.depth}>
              <rect x={x} y={210 - height} width="58" height={height} fill="#2F78D0" />
              <text x={x + 29} y={200 - height} textAnchor="middle" fill="#000000" fontFamily="Space Mono" fontSize="10">{row.rmse}</text>
              <text x={x + 29} y="230" textAnchor="middle" fill="#000000" fillOpacity=".72" fontFamily="Space Mono" fontSize="9">{row.depth.split(' ')[0]}</text>
            </g>;
          })}
          <text x="310" y="248" textAnchor="middle" fill="#000000" fillOpacity=".48" fontFamily="Space Mono" fontSize="9">DEPTH BAND · RMSE (°C)</text>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-[1.4fr_1fr] border-t border-[#FAF7BB]/15 pt-3 font-data text-[10px] text-[#000000]/65"><span>Depth band</span><span>RMSE (°C) · # measurements</span></div>
      <div className="mt-2 space-y-2 font-data text-[10px] text-[#000000]">{depthValues.map((row) => <div key={row.depth} className="grid grid-cols-[1.4fr_1fr]"><span>{row.depth}</span><span>{row.rmse} · {row.measurements}</span></div>)}<div className="grid grid-cols-[1.4fr_1fr] border-t border-[#FAF7BB]/15 pt-2 text-[#000000]"><span>Overall Test RMSE</span><span>0.554°C · —</span></div></div>
    </section>
    <section className="oe-card bg-[#133458] p-5 text-[#FAF7BB]">
       <div className="oe-kicker !text-[#D99B21]">B. Iterative improvement</div>
      <h2 className="mt-1 font-display text-2xl">SST → +SSHa → +SSHa+SSS</h2>
      <div className="mt-5 flex items-center gap-4 text-[10px] text-[#FAF7BB]/70"><span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#F26A38]" /> SST only</span><span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#F4B51D]" /> + SSha</span><span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#19A83A]" /> + SSS</span></div>
      <div className="mt-3 h-56">
        <svg viewBox="0 0 620 250" className="h-full w-full" role="img" aria-label="Iterative improvement from SST to sea surface height anomaly to sea surface salinity">
          <g stroke="#FAF7BB" strokeOpacity=".14" strokeWidth="1">{[0, .4, .8, 1.2, 1.6].map((value) => <line key={value} x1="46" x2="600" y1={210 - (value / maxIterativeRmse) * 170} y2={210 - (value / maxIterativeRmse) * 170} />)}</g>
          <g fill="#FAF7BB" fillOpacity=".65" fontFamily="Space Mono" fontSize="10"><text x="18" y="214">0</text><text x="11" y="171">0.4</text><text x="11" y="129">0.8</text><text x="11" y="87">1.2</text><text x="11" y="44">1.6</text></g>
          {iterativeImprovement.map((row, index) => {
            const x = 78 + index * 130;
            return <g key={row.band}>{row.values.map((value, series) => {
              const height = (value / maxIterativeRmse) * 170;
              return <rect key={series} x={x + series * 22} y={210 - height} width="17" height={height} fill={['#F26A38', '#F4B51D', '#19A83A'][series]} />;
            })}<text x={x + 22} y="230" textAnchor="middle" fill="#FAF7BB" fillOpacity=".72" fontFamily="Space Mono" fontSize="9">{row.band}</text></g>;
          })}
          <text x="310" y="248" textAnchor="middle" fill="#FAF7BB" fillOpacity=".48" fontFamily="Space Mono" fontSize="9">DEPTH BAND · RMSE (°C)</text>
        </svg>
      </div>
    </section>
  </div>;
}

function Dashboard() {
  const [selected, setSelected] = useState('Arabian Sea');
  return <AppShell><div className="oe-page oe-grid"><SectionHeading eyebrow="Mission control · January 2023" title="Ocean intelligence" description="A North Indian Ocean research view built from surface observations and subsurface temperature profiles." action={<button className="oe-control oe-primary flex items-center gap-2" data-testid="button-new-reconstruction"><Plus size={15} /> New reconstruction</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Overall Test RMSE" value="0.554°C" note="North Indian Ocean test set" icon={Activity} accent /><StatCard label="Total Floats" value="228" note="183 train · 45 test" icon={Layers3} /><StatCard label="Measurements" value="141,433" note="January 2023 study period" icon={Database} /><StatCard label="Train / Test Floats" value="183 / 45" note="80/20 by float" icon={Sparkles} /><StatCard label="Study Region" value="North Indian Ocean" note={studyBounds} icon={Globe2} /></div>
     <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]"><section className="oe-card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><div className="oe-kicker mb-1">Surface field</div><h2 className="font-display text-2xl text-[#133458]">Where the model is looking</h2></div><Link href="/map" className="flex items-center gap-1 text-xs font-semibold text-[#838921] hover:text-[#133458]" data-testid="link-open-full-map">Open full map <ArrowRight size={14} /></Link></div><OceanMap compact onSelect={setSelected} /><div className="mt-3 flex items-center justify-between text-xs text-[#536675]"><span>Selected region: <strong className="text-[#133458]">{selected}</strong></span><span className="font-data text-[10px]">{studyBounds}</span></div></section><section className="oe-card p-5"><div className="oe-kicker mb-1">At a glance</div><h2 className="font-display text-2xl text-[#133458]">Field notes</h2><div className="mt-6 space-y-5">{[['Arabian Sea', 'North Indian Ocean profile field', 'Study region'], ['Bay of Bengal', 'North Indian Ocean profile field', 'Study region']].map(([name, copy, time], i) => <div className="flex gap-3" key={name}><div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-[#D99B21]' : 'bg-[#838921]'}`} /><div className="min-w-0"><div className="flex items-baseline justify-between gap-2"><div className="text-[13px] font-semibold text-[#133458]">{name}</div><div className="font-data text-[9px] text-[#8a927f]">{time}</div></div><p className="mt-1 text-xs leading-5 text-[#536675]">{copy}</p></div></div>)}</div><Link href="/reconstructions" className="mt-7 flex w-full items-center justify-center gap-2 border-t border-[#D8D0B3] pt-5 text-xs font-semibold text-[#838921]" data-testid="link-view-reconstructions">View reconstruction queue <ArrowRight size={14} /></Link></section></div>
     <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><section className="oe-card p-5"><div className="mb-5 flex items-start justify-between"><div><div className="oe-kicker mb-1">Test signal</div><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean RMSE</h2></div><div className="flex items-center gap-2 text-[10px] text-[#536675]"><span className="h-2 w-2 rounded-full bg-[#133458]" /> Predicted <span className="ml-2 h-2 w-2 rounded-full bg-[#9caf68]" /> Observed</div></div><div className="h-44"><Chart variant="depth" /></div><div className="mt-1 flex justify-between font-data text-[9px] text-[#8a927f]"><span>0.242°C</span><span>Overall Test RMSE 0.554°C</span><span>0.856°C</span></div></section><section className="oe-card p-5"><div className="mb-5 flex items-start justify-between"><div><div className="oe-kicker mb-1">Study field</div><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean</h2></div><Link href="/performance" className="text-xs text-[#838921]" data-testid="link-view-performance">View detail</Link></div><div className="h-44"><Chart variant="bars" /></div><div className="mt-2 flex justify-between text-[10px] text-[#536675]"><span>Arabian Sea</span><span>North Indian Ocean</span><span>Bay of Bengal</span></div></section></div>
  </div></AppShell>;
}

function MapPage() {
  const [layer, setLayer] = useState('Sea surface temperature');
  const [depth, setDepth] = useState(300);
  const [selected, setSelected] = useState('Arabian Sea');
  const layers = ['Sea surface temperature', 'Subsurface reconstruction', 'Model confidence'];
  return <AppShell><div className="oe-page"><SectionHeading eyebrow="Spatial explorer · North Indian Ocean" title="Ocean map" description={`North Indian Ocean study field, bounded by ${studyBounds}. Select a subregion to inspect its observation history.`} action={<div className="flex gap-2"><button className="oe-control flex items-center gap-2" data-testid="button-map-download"><Download size={15} /> Export view</button><button className="oe-control p-2" aria-label="Map settings" data-testid="button-map-settings"><SlidersHorizontal size={16} /></button></div>} /><div className="grid gap-5 xl:grid-cols-[1fr_292px]"><section><OceanMap selectedLayer={layer} onSelect={setSelected} /><div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#536675]"><span className="font-data text-[10px]">{studyRegion} · {studyBounds} · January 2023</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#D99B21]" /> click a region to inspect</span></div></section><aside className="oe-card p-5"><div className="oe-kicker mb-2">Map controls</div><h2 className="font-display text-2xl text-[#133458]">Field layers</h2><div className="mt-5 space-y-2">{layers.map((name) => <button key={name} onClick={() => setLayer(name)} className={`flex w-full items-center gap-3 px-3 py-3 text-left text-xs transition-colors ${layer === name ? 'bg-[#133458] text-[#FAF7BB]' : 'bg-[#f1edc9] text-[#536675] hover:bg-[#e8e2ba]'}`} data-testid={`button-layer-${name.toLowerCase().replaceAll(' ', '-')}`}><span className={`h-2.5 w-2.5 rounded-full border ${layer === name ? 'border-[#D99B21] bg-[#D99B21]' : 'border-[#838921]'}`} />{name}{layer === name && <Check size={14} className="ml-auto text-[#D99B21]" />}</button>)}</div><div className="mt-8 border-t border-[#D8D0B3] pt-6"><div className="flex justify-between"><span className="oe-label">Depth slice</span><span className="font-data text-xs text-[#133458]">{depth} m</span></div><input type="range" min="0" max="2000" step="50" value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="mt-4 w-full accent-[#838921]" data-testid="slider-map-depth" /><div className="mt-1 flex justify-between font-data text-[9px] text-[#8a927f]"><span>0 m</span><span>2,000 m</span></div></div><div className="mt-7 bg-[#133458] p-4 text-[#FAF7BB]"><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#FAF7BB]/55"><CircleHelp size={13} /> Selected subregion</div><div className="mt-3 font-display text-xl">{selected}</div><div className="mt-3 grid grid-cols-2 gap-y-3 font-data text-[10px]"><span className="text-[#FAF7BB]/45">STUDY REGION</span><span className="text-right">{studyRegion}</span><span className="text-[#FAF7BB]/45">BOUNDS</span><span className="text-right">{studyBounds}</span><span className="text-[#FAF7BB]/45">PERIOD</span><span className="text-right text-[#D99B21]">January 2023</span></div><Link href="/reconstructions" className="mt-4 flex items-center gap-1 text-xs text-[#D99B21]" data-testid="link-inspect-region">Inspect region <ArrowRight size={13} /></Link></div></aside></div></div></AppShell>;
}

function MapNio() {
  const [layer, setLayer] = useState('Sea surface temperature');
  const [selected, setSelected] = useState('Arabian Sea');
  const layers = ['Sea surface temperature', 'Subsurface reconstruction', 'Model confidence'];
  return <AppShell><div className="oe-page"><SectionHeading eyebrow="Spatial explorer · North Indian Ocean" title="Ocean map" description={`North Indian Ocean study field, bounded by ${studyBounds}. Select a subregion to inspect its observation history.`} action={<div className="flex gap-2"><button className="oe-control flex items-center gap-2" data-testid="button-map-download"><Download size={15} /> Export view</button><button className="oe-control p-2" aria-label="Map settings" data-testid="button-map-settings"><SlidersHorizontal size={16} /></button></div>} /><div className="grid gap-5 xl:grid-cols-[1fr_292px]"><section><OceanMap selectedLayer={layer} onSelect={setSelected} /><div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#536675]"><span className="font-data text-[10px]">{studyRegion} · {studyBounds} · January 2023</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#D99B21]" /> click a region to inspect</span></div></section><aside className="oe-card p-5"><div className="oe-kicker mb-2">Map controls</div><h2 className="font-display text-2xl text-[#133458]">Field layers</h2><div className="mt-5 space-y-2">{layers.map((name) => <button key={name} onClick={() => setLayer(name)} className={`flex w-full items-center gap-3 px-3 py-3 text-left text-xs transition-colors ${layer === name ? 'bg-[#133458] text-[#FAF7BB]' : 'bg-[#f1edc9] text-[#536675] hover:bg-[#e8e2ba]'}`} data-testid={`button-layer-${name.toLowerCase().replaceAll(' ', '-')}`}><span className={`h-2.5 w-2.5 rounded-full border ${layer === name ? 'border-[#D99B21] bg-[#D99B21]' : 'border-[#838921]'}`} />{name}{layer === name && <Check size={14} className="ml-auto text-[#D99B21]" />}</button>)}</div><div className="mt-8 border-t border-[#D8D0B3] pt-6"><div className="flex justify-between"><span className="oe-label">Study bounds</span><span className="font-data text-xs text-[#133458]">{studyBounds}</span></div><div className="mt-4 flex justify-between"><span className="oe-label">Subregions</span><span className="font-data text-right text-xs text-[#133458]">Arabian Sea · Bay of Bengal</span></div><div className="mt-4 flex justify-between"><span className="oe-label">Test period</span><span className="font-data text-xs text-[#133458]">January 2023</span></div></div><div className="mt-7 bg-[#133458] p-4 text-[#FAF7BB]"><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#FAF7BB]/55"><CircleHelp size={13} /> Selected subregion</div><div className="mt-3 font-display text-xl">{selected}</div><div className="mt-3 grid grid-cols-2 gap-y-3 font-data text-[10px]"><span className="text-[#FAF7BB]/45">STUDY REGION</span><span className="text-right">{studyRegion}</span><span className="text-[#FAF7BB]/45">BOUNDS</span><span className="text-right">{studyBounds}</span><span className="text-[#FAF7BB]/45">PERIOD</span><span className="text-right text-[#D99B21]">January 2023</span></div><Link href="/reconstructions" className="mt-4 flex items-center gap-1 text-xs text-[#D99B21]" data-testid="link-inspect-region">Inspect region <ArrowRight size={13} /></Link></div></aside></div></div></AppShell>;
}

function Reconstructions() {
  const [active, setActive] = useState('Arabian Sea');
  const [depth, setDepth] = useState(300);
  const runs = ['Arabian Sea', 'Bay of Bengal'];
  return <AppShell><div className="oe-page"><SectionHeading eyebrow={`Inference studio · ${studyRegion}`} title="Reconstructions" description="Inspect predicted and observed temperature profiles from the North Indian Ocean study field." action={<button className="oe-control oe-primary flex items-center gap-2" data-testid="button-start-run"><Play size={14} /> Run reconstruction</button>} /><div className="grid gap-5 xl:grid-cols-[230px_1fr]"><aside className="oe-card h-fit p-4"><div className="mb-3 flex items-center justify-between"><span className="oe-label">Study subregions</span><button className="text-[#838921]" aria-label="Add reconstruction" data-testid="button-add-reconstruction"><Plus size={16} /></button></div><div className="space-y-1">{runs.map((run, i) => <button onClick={() => setActive(run)} key={run} className={`w-full border-l-2 px-3 py-3 text-left ${active === run ? 'border-[#D99B21] bg-[#f1edc9]' : 'border-transparent hover:bg-[#f5f1d6]'}`} data-testid={`button-run-${i}`}><div className="text-xs font-semibold text-[#133458]">{run}</div><div className="mt-1 font-data text-[9px] text-[#8a927f]">{studyRegion}</div><div className="mt-2 flex items-center gap-1 text-[9px] text-[#838921]"><Check size={10} /> Complete</div></button>)}</div><button className="mt-4 flex w-full items-center justify-center gap-2 border-t border-[#D8D0B3] pt-4 text-xs text-[#536675]" data-testid="button-load-more-runs">Load archive <ChevronDown size={13} /></button></aside><section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="oe-kicker mb-1">Selected reconstruction</div><h2 className="font-display text-2xl text-[#133458]">{active}</h2></div><div className="flex items-center gap-2"><span className="flex items-center gap-1.5 bg-[#e5ebd3] px-3 py-2 text-[10px] text-[#536b35]"><span className="h-1.5 w-1.5 rounded-full bg-[#838921]" /> COMPLETE</span><button className="oe-control p-2" aria-label="More reconstruction actions" data-testid="button-reconstruction-more"><MoreHorizontal size={16} /></button></div></div><div className="oe-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8D0B3] bg-[#f1edc9]/60 px-5 py-4"><div className="flex items-center gap-5 text-xs"><span className="font-semibold text-[#133458]">Profile view</span><span className="text-[#8a927f]">Source evidence</span><span className="text-[#8a927f]">Diagnostics</span></div><div className="flex items-center gap-2 text-[10px] text-[#536675]"><span className="h-2 w-2 rounded-full bg-[#133458]" /> Predicted Temperature <span className="ml-2 h-2 w-2 rounded-full bg-[#D99B21]" /> Observed Temperature</div></div><div className="grid gap-6 p-5 lg:grid-cols-[1fr_250px]"><div className="relative h-[390px] border-l border-b border-[#D8D0B3]"><div className="absolute left-[-2px] top-0 h-full border-l-2 border-[#838921]" /><div className="absolute inset-0 flex flex-col justify-between py-1 font-data text-[9px] text-[#8a927f]"><span>0 m</span><span>500 m</span><span>1,000 m</span><span>1,500 m</span><span>2,000 m</span></div><svg viewBox="0 0 450 400" className="absolute inset-y-0 left-10 h-full w-[calc(100%-40px)]" preserveAspectRatio="none" aria-label="North Indian Ocean predicted and observed temperature profile"><path d="M0 22 C80 35 100 58 138 85 S190 143 230 175 S276 220 305 259 S340 320 382 373" fill="none" stroke="#133458" strokeWidth="4" /><path d="M0 27 C70 38 110 67 145 94 S187 139 225 183 S278 232 310 269 S350 328 389 379" fill="none" stroke="#D99B21" strokeWidth="2.5" strokeDasharray="6 5" /><path d="M0 48 C70 57 102 86 144 116 S193 156 230 204 S280 255 310 286 S347 347 395 394" fill="none" stroke="#838921" strokeWidth="1.5" opacity=".5" /></svg><div className="absolute bottom-[-25px] left-10 right-0 flex justify-between font-data text-[9px] text-[#8a927f]"><span>Temperature (°C)</span><span>Depth (m)</span></div></div><div><div className="oe-label">Profile labels</div><div className="mt-5 space-y-4 border-t border-[#D8D0B3] pt-5"><div className="flex items-center gap-2 text-xs text-[#133458]"><span className="h-2 w-5 bg-[#133458]" /> Predicted Temperature</div><div className="flex items-center gap-2 text-xs text-[#133458]"><span className="h-2 w-5 bg-[#D99B21]" /> Observed Temperature</div><div className="font-data text-[10px] text-[#536675]">Depth (m)</div><div className="font-data text-[10px] text-[#536675]">Temperature (°C)</div></div></div></div></div></section></div></div></AppShell>;
}

function ReconstructionsNio() {
  const [active, setActive] = useState('Arabian Sea');
  const runs = ['Arabian Sea', 'Bay of Bengal'];
  return <AppShell><div className="oe-page"><SectionHeading eyebrow={`Inference studio · ${studyRegion}`} title="Reconstructions" description="Inspect predicted and observed temperature profiles from the North Indian Ocean study field." action={<button className="oe-control oe-primary flex items-center gap-2" data-testid="button-start-run"><Play size={14} /> Run reconstruction</button>} /><div className="grid gap-5 xl:grid-cols-[230px_1fr]"><aside className="oe-card h-fit p-4"><div className="mb-3 flex items-center justify-between"><span className="oe-label">Study subregions</span><button className="text-[#838921]" aria-label="Add reconstruction" data-testid="button-add-reconstruction"><Plus size={16} /></button></div><div className="space-y-1">{runs.map((run, i) => <button onClick={() => setActive(run)} key={run} className={`w-full border-l-2 px-3 py-3 text-left ${active === run ? 'border-[#D99B21] bg-[#f1edc9]' : 'border-transparent hover:bg-[#f5f1d6]'}`} data-testid={`button-run-${i}`}><div className="text-xs font-semibold text-[#133458]">{run}</div><div className="mt-1 font-data text-[9px] text-[#8a927f]">{studyRegion}</div><div className="mt-2 flex items-center gap-1 text-[9px] text-[#838921]"><Check size={10} /> Complete</div></button>)}</div><button className="mt-4 flex w-full items-center justify-center gap-2 border-t border-[#D8D0B3] pt-4 text-xs text-[#536675]" data-testid="button-load-more-runs">Load archive <ChevronDown size={13} /></button></aside><section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="oe-kicker mb-1">Selected reconstruction</div><h2 className="font-display text-2xl text-[#133458]">{active}</h2></div><div className="flex items-center gap-2"><span className="flex items-center gap-1.5 bg-[#e5ebd3] px-3 py-2 text-[10px] text-[#536b35]"><span className="h-1.5 w-1.5 rounded-full bg-[#838921]" /> COMPLETE</span><button className="oe-control p-2" aria-label="More reconstruction actions" data-testid="button-reconstruction-more"><MoreHorizontal size={16} /></button></div></div><div className="oe-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D8D0B3] bg-[#f1edc9]/60 px-5 py-4"><div className="flex items-center gap-5 text-xs"><span className="font-semibold text-[#133458]">Profile view</span><span className="text-[#8a927f]">Source evidence</span><span className="text-[#8a927f]">Diagnostics</span></div><div className="flex items-center gap-2 text-[10px] text-[#536675]"><span className="h-2 w-2 rounded-full bg-[#133458]" /> Predicted Temperature <span className="ml-2 h-2 w-2 rounded-full bg-[#D99B21]" /> Observed Temperature</div></div><div className="grid gap-6 p-5 lg:grid-cols-[1fr_250px]"><div className="relative h-[390px] border-l border-b border-[#D8D0B3]"><div className="absolute left-[-2px] top-0 h-full border-l-2 border-[#838921]" /><svg viewBox="0 0 450 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-label="North Indian Ocean predicted and observed temperature profile"><path d="M0 22 C80 35 100 58 138 85 S190 143 230 175 S276 220 305 259 S340 320 382 373" fill="none" stroke="#133458" strokeWidth="4" /><path d="M0 27 C70 38 110 67 145 94 S187 139 225 183 S278 232 310 269 S350 328 389 379" fill="none" stroke="#D99B21" strokeWidth="2.5" strokeDasharray="6 5" /><path d="M0 48 C70 57 102 86 144 116 S193 156 230 204 S280 255 310 286 S347 347 395 394" fill="none" stroke="#838921" strokeWidth="1.5" opacity=".5" /></svg><div className="absolute bottom-[-25px] left-0 right-0 flex justify-between font-data text-[9px] text-[#8a927f]"><span>Temperature (°C)</span><span>Depth (m)</span></div></div><div><div className="oe-label">Profile labels</div><div className="mt-5 space-y-4 border-t border-[#D8D0B3] pt-5"><div className="flex items-center gap-2 text-xs text-[#133458]"><span className="h-2 w-5 bg-[#133458]" /> Predicted Temperature</div><div className="flex items-center gap-2 text-xs text-[#133458]"><span className="h-2 w-5 bg-[#D99B21]" /> Observed Temperature</div><div className="font-data text-[10px] text-[#536675]">Depth (m)</div><div className="font-data text-[10px] text-[#536675]">Temperature (°C)</div></div></div></div></div></section></div></div></AppShell>;
}

function Temperature() {
  const [metric, setMetric] = useState('Temperature');
  const [period, setPeriod] = useState('January 2023');
  return <AppShell><div className="oe-page oe-grid"><SectionHeading eyebrow={`Thermal analytics · ${studyRegion}`} title="Temperature" description="Compare surface and subsurface temperature visualizations from the North Indian Ocean study field." action={<button className="oe-control flex items-center gap-2" data-testid="button-export-temperature"><Download size={15} /> Export CSV</button>} /><div className="mb-5 flex flex-wrap gap-2">{['Temperature', 'Anomaly', 'RMSE'].map((m) => <button key={m} onClick={() => setMetric(m)} className={`oe-control ${metric === m ? 'oe-primary' : ''}`} data-testid={`button-temperature-metric-${m.toLowerCase()}`}>{m}</button>)}<div className="ml-auto flex gap-2"><button className="oe-control flex items-center gap-2" data-testid="button-period"><RotateCcw size={14} /> {period}</button><button onClick={() => setPeriod('January 2023')} className="oe-control p-2" aria-label="Keep study period" data-testid="button-change-period"><ChevronDown size={15} /></button></div></div><section className="oe-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="oe-kicker mb-1">{studyRegion} · {metric}</div><h2 className="font-display text-2xl text-[#133458]">Surface and subsurface temperature</h2></div><div className="flex gap-5 text-[10px] text-[#536675]"><span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#133458]" /> Observed</span><span className="flex items-center gap-2"><i className="h-2 w-5 bg-[#D99B21]" /> Predicted</span></div></div><div className="mt-6 h-[300px]"><Chart variant={metric === 'RMSE' ? 'bars' : 'line'} /></div></section><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><section className="oe-card p-5"><div className="oe-kicker mb-1">Depth profile</div><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean RMSE by depth</h2><div className="mt-5 space-y-3">{depthValues.map((row) => <div key={row.depth} className="grid grid-cols-[105px_1fr_55px] items-center gap-3 text-xs"><span className="font-data text-[10px] text-[#536675]">{row.depth}</span><div className="h-2 bg-[#e8e2ba]"><div className="h-full bg-[#838921]" style={{ width: `${(Number(row.rmse) / 0.9) * 100}%` }} /></div><span className="font-data text-right text-[#133458]">{row.rmse}°</span></div>)}</div></section><section className="oe-card p-5"><div className="oe-kicker mb-1">Study summary</div><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean</h2><div className="mt-5 divide-y divide-[#D8D0B3]">{[['Study region', studyBounds, 'Arabian Sea and Bay of Bengal'], ['Test period', 'January 2023', '1 month'], ['Overall Test RMSE', '0.554°C', 'North Indian Ocean test set']].map(([a,b,c]) => <div key={a} className="flex items-center justify-between gap-4 py-3"><div><div className="text-xs font-semibold text-[#133458]">{a}</div><div className="mt-1 text-[11px] text-[#536675]">{c}</div></div><div className="font-data text-right text-sm text-[#D99B21]">{b}</div></div>)}</div></section></div></div></AppShell>;
}

function Performance() {
  const [tab, setTab] = useState('By depth');
  return <AppShell><div className="oe-page"><SectionHeading eyebrow={`Validation lab · ${studyRegion}`} title="Performance" description="Measure the Convolutional Encoder + MLP (Fully Connected) Decoder on the North Indian Ocean test set." action={<Link href="/performance/architecture" className="oe-control flex items-center gap-2" data-testid="link-model-architecture"><Network size={15} /> Model architecture</Link>} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Overall Test RMSE" value="0.554°C" note="North Indian Ocean test set" icon={Activity} accent /><StatCard label="Total Floats" value="228" note="183 train · 45 test" icon={Layers3} /><StatCard label="Measurements" value="141,433" note="January 2023" icon={Database} /><StatCard label="Train / Test Floats" value="183 / 45" note="80/20 by float" icon={Check} /></div><section className="oe-card mt-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="oe-kicker mb-1">Model quality</div><h2 className="font-display text-2xl text-[#133458]">RMSE by depth band</h2></div><div className="flex gap-1 bg-[#f1edc9] p-1">{['By depth', 'By subregion'].map((x) => <button onClick={() => setTab(x)} key={x} className={`px-3 py-2 text-[11px] ${tab === x ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675]'}`} data-testid={`button-performance-tab-${x.toLowerCase().replace(' ', '-')}`}>{x}</button>)}</div></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[590px] border-collapse text-left"><thead><tr className="border-b border-[#D8D0B3] font-data text-[9px] uppercase tracking-wider text-[#8a927f]"><th className="pb-3">Depth band</th><th className="pb-3"># Measurements</th><th className="pb-3">RMSE (°C)</th></tr></thead><tbody>{depthValues.map((row) => <tr key={row.depth} className="border-b border-[#D8D0B3]/60 text-xs"><td className="py-4 font-semibold text-[#133458]">{tab === 'By depth' ? row.depth : studyRegion}</td><td className="py-4 font-data text-[#536675]">{row.measurements}</td><td className="py-4 font-data text-[#133458]">{row.rmse}</td></tr>)}</tbody></table></div></section><PerformanceGraphs /><section className="oe-card mt-5 p-5"><div className="oe-kicker mb-1">Test set summary</div><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean validation</h2><span className="font-data text-[9px] text-[#8a927f]">JANUARY 2023 · 1 MONTH</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[530px] text-left"><thead><tr className="border-b border-[#D8D0B3] font-data text-[9px] uppercase tracking-wider text-[#8a927f]"><th className="pb-3">Metric</th><th className="pb-3">Value</th><th className="pb-3">Scope</th></tr></thead><tbody>{[['Overall Test RMSE', '0.554°C', studyRegion], ['Total Floats', '228', '183 train / 45 test'], ['Total Measurements', '141,433', studyBounds], ['Model', 'CNN + MLP', 'Convolutional Encoder + MLP (Fully Connected) Decoder']].map(([a,b,c]) => <tr key={a} className="border-b border-[#D8D0B3]/60 text-xs"><td className="py-4 font-semibold text-[#133458]">{a}</td><td className="py-4 font-data">{b}</td><td className="py-4 font-data text-[#536675]">{c}</td></tr>)}</tbody></table></div></section></div></AppShell>;
}

function Dataset() {
  const [query, setQuery] = useState('');
  const sources = useMemo(() => [['NOAA OISST', 'Sea Surface Temperature', 'January 2023', 'Input feature', studyRegion], ['Copernicus SSHA', 'Sea Surface Height Anomaly', 'January 2023', 'Input feature', studyRegion], ['Copernicus SSS', 'Sea Surface Salinity', 'January 2023', 'Input feature', studyRegion], ['Copernicus Surface currents', 'Surface currents', 'January 2023', 'Input feature', studyRegion], ['Argovis / Argo', 'Subsurface Temperature Profiles', 'January 2023', 'Target profiles', studyRegion]].filter((s) => s.join(' ').toLowerCase().includes(query.toLowerCase())), [query]);
  return <AppShell><div className="oe-page"><SectionHeading eyebrow={`Source registry · ${studyRegion}`} title="Dataset" description="The five data sources used for the North Indian Ocean study and its subsurface temperature profiles." action={<button className="oe-control oe-primary flex items-center gap-2" data-testid="button-add-source"><Plus size={15} /> Add source</button>} /><div className="grid gap-5 lg:grid-cols-[1fr_285px]"><section className="oe-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-[#8a927f]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sources" className="h-9 w-64 border border-[#D8D0B3] bg-[#FAF7BB] pl-9 pr-3 text-xs outline-none focus:border-[#838921]" data-testid="input-search-dataset" /></div><button className="oe-control flex items-center gap-2" data-testid="button-filter-dataset"><SlidersHorizontal size={14} /> Filters</button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[#D8D0B3] font-data text-[9px] uppercase tracking-wider text-[#8a927f]"><th className="pb-3">Source</th><th className="pb-3">Coverage</th><th className="pb-3">Period</th><th className="pb-3">Role</th><th className="pb-3">Status</th></tr></thead><tbody>{sources.map((s) => <tr key={s[0]} className="border-b border-[#D8D0B3]/60 text-xs"><td className="py-4"><div className="font-semibold text-[#133458]">{s[0]}</div><div className="mt-1 text-[10px] text-[#536675]">{s[1]}</div></td><td className="py-4 text-[#536675]">{s[4]}</td><td className="py-4 font-data text-[10px]">{s[2]}</td><td className="py-4 font-data text-[10px]">{s[3]}</td><td className="py-4"><span className="flex items-center gap-1.5 text-[#536b35]"><span className="h-1.5 w-1.5 rounded-full bg-[#838921]" /> Included</span></td></tr>)}</tbody></table>{sources.length === 0 && <div className="py-14 text-center text-sm text-[#536675]">No sources match “{query}”.</div>}</div></section><aside className="space-y-5"><div className="oe-card bg-[#133458] p-5 text-[#FAF7BB]"><div className="oe-kicker !text-[#D99B21]">Study region</div><div className="mt-4 font-data text-2xl">North Indian Ocean</div><p className="mt-2 text-xs leading-5 text-[#FAF7BB]/60">{studyBounds}. Subregions: Arabian Sea and Bay of Bengal.</p><div className="mt-5 h-1 bg-[#FAF7BB]/15"><div className="h-full w-full bg-[#D99B21]" /></div></div><div className="oe-card p-5"><div className="oe-kicker mb-1">Dataset summary</div><h2 className="font-display text-2xl text-[#133458]">January 2023</h2><div className="mt-5 flex items-center gap-3"><Cloud size={20} className="text-[#838921]" /><div><div className="font-data text-sm text-[#133458]">1 month</div><div className="mt-1 text-[11px] text-[#536675]">228 floats · 141,433 measurements</div></div></div><button className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#838921]" data-testid="button-refresh-dataset"><RotateCcw size={13} /> Check for updates</button></div></aside></div></div></AppShell>;
}

function Architecture() {
  const nodes: Array<{ n: string; title: string; sub: string; icon: Icon }> = [
    { n: '01', title: 'Surface inputs', sub: 'SST · SSHA · SSS', icon: Globe2 },
    { n: '02', title: 'Convolutional encoder', sub: 'Spatial features', icon: Network },
    { n: '03', title: 'Latent representation', sub: 'Ocean feature vector', icon: Waves },
    { n: '04', title: 'MLP decoder', sub: 'Fully connected output', icon: Mountain },
  ];
  return <AppShell><div className="oe-page oe-grid"><SectionHeading eyebrow={`Model card · ${studyRegion}`} title="Architecture" description="Convolutional Encoder + MLP (Fully Connected) Decoder for North Indian Ocean subsurface temperature reconstruction." action={<button className="oe-control flex items-center gap-2" data-testid="button-download-model-card"><Download size={15} /> Download model card</button>} /><div className="oe-card overflow-hidden"><div className="border-b border-[#D8D0B3] bg-[#133458] px-5 py-4 text-[#FAF7BB]"><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-data text-[10px] tracking-[.1em]">OCEANEMBED / CONVOLUTIONAL ENCODER + MLP DECODER</div><span className="flex items-center gap-2 text-[10px] text-[#FAF7BB]/60"><span className="h-1.5 w-1.5 rounded-full bg-[#D99B21]" /> study model</span></div></div><div className="overflow-x-auto p-8"><div className="flex min-w-[850px] items-center justify-center gap-3">{nodes.map(({ n, title, sub, icon: ArchitectureIcon }, i) => <div className="flex items-center gap-3" key={title}><div className="w-[172px] border border-[#D8D0B3] bg-[#f5f1d6] p-4"><div className="flex items-center justify-between"><span className="font-data text-[10px] text-[#D99B21]">{n}</span><ArchitectureIcon size={17} className="text-[#838921]" /></div><div className="mt-8 text-xs font-semibold text-[#133458]">{title}</div><div className="mt-1 font-data text-[9px] text-[#536675]">{sub}</div><div className="mt-4 flex gap-1">{[1,2,3,4,5].map((x) => <span key={x} className={`h-1.5 flex-1 ${x <= i + 2 ? 'bg-[#838921]' : 'bg-[#D8D0B3]'}`} />)}</div></div>{i < 3 && <ArrowRight className="shrink-0 text-[#D99B21]" size={18} />}</div>)}</div></div><div className="grid gap-0 border-t border-[#D8D0B3] sm:grid-cols-3"><div className="border-b border-[#D8D0B3] p-5 sm:border-b-0 sm:border-r"><div className="oe-label">Model</div><div className="mt-2 font-data text-sm leading-5 text-[#133458]">Convolutional Encoder + MLP</div></div><div className="border-b border-[#D8D0B3] p-5 sm:border-b-0 sm:border-r"><div className="oe-label">Study region</div><div className="mt-2 font-data text-xl text-[#133458]">North Indian Ocean</div></div><div className="p-5"><div className="oe-label">Test period</div><div className="mt-2 font-data text-xl text-[#133458]">January 2023</div></div></div></div></div></AppShell>;
}

function Settings() {
  const [dark, setDark] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('Appearance');
  const [toggles, setToggles] = useState({ grid: true, notifications: true, animation: true, telemetry: false });
  const toggle = (key: keyof typeof toggles) => setToggles((old) => ({ ...old, [key]: !old[key] }));
  const Toggle = ({ name, value, onChange }: { name: keyof typeof toggles; value: boolean; onChange?: () => void }) => <button onClick={() => onChange ? onChange() : toggle(name)} className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-[#838921]' : 'bg-[#c9c3a7]'}`} aria-label={`Toggle ${name}`} data-testid={`toggle-${name}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-[#FAF7BB] transition-transform ${value ? 'left-5' : 'left-1'}`} /></button>;
  return <AppShell><div className="oe-page"><SectionHeading eyebrow="Lab preferences" title="Settings" description="Tune the workspace to your reading habits. These preferences stay local to this research environment." action={<button onClick={() => setSaved(true)} className="oe-control oe-primary flex items-center gap-2" data-testid="button-save-settings"><Check size={15} /> {saved ? 'Saved' : 'Save changes'}</button>} /><div className="grid gap-5 lg:grid-cols-[205px_1fr]"><nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">{['Appearance', 'Data & privacy', 'Map defaults', 'Model behavior', 'Notifications', 'About OceanEmbed'].map((x, i) => <button key={x} className={`whitespace-nowrap px-3 py-2 text-left text-xs ${i === 0 ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:bg-[#f1edc9]'}`} data-testid={`button-settings-section-${i}`}>{x}</button>)}</nav><div className="space-y-5"><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Appearance</div><h2 className="font-display text-2xl text-[#133458]">Reading environment</h2><div className="mt-6 divide-y divide-[#D8D0B3]"><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Dark field mode</div><div className="mt-1 text-xs text-[#536675]">Use a low-light palette for overnight analysis sessions.</div></div><Toggle name="grid" value={dark} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Show coordinate grid</div><div className="mt-1 text-xs text-[#536675]">Keep latitude and longitude guides visible on maps.</div></div><Toggle name="grid" value={toggles.grid} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Motion and transitions</div><div className="mt-1 text-xs text-[#536675]">Subtle movement helps indicate live field updates.</div></div><Toggle name="animation" value={toggles.animation} /></div></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Map defaults</div><h2 className="font-display text-2xl text-[#133458]">Start each session here</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-[#536675]">Default layer<select className="oe-control mt-2 w-full" data-testid="select-default-layer"><option>Sea surface temperature</option><option>Subsurface reconstruction</option><option>Model confidence</option></select></label><label className="text-xs text-[#536675]">Default basin<select className="oe-control mt-2 w-full" data-testid="select-default-basin"><option>Global ocean</option><option>Arabian Sea</option><option>North Atlantic</option></select></label></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Notifications</div><h2 className="font-display text-2xl text-[#133458]">Research signals</h2><div className="mt-5 flex items-center justify-between gap-4"><div><div className="text-sm font-semibold text-[#133458]">New profile clusters</div><div className="mt-1 text-xs text-[#536675]">Notify when a region receives enough new evidence to rerun.</div></div><Toggle name="notifications" value={toggles.notifications} /></div></section><section className="oe-card bg-[#133458] p-5 text-[#FAF7BB] sm:p-6"><div className="flex items-center gap-3"><Waves size={19} className="text-[#D99B21]" /><div className="font-display text-xl">OceanEmbed</div></div><p className="mt-3 max-w-xl text-xs leading-5 text-[#FAF7BB]/60">A research instrument for reading what satellites cannot see alone. Built for oceanographers, climate scientists, and the people who act on their findings.</p><div className="mt-5 font-data text-[9px] tracking-wider text-[#FAF7BB]/40">VERSION 2.4.1 · DATA POLICY · LICENSES</div></section></div></div></div></AppShell>;
  return <AppShell><div className="oe-page"><SectionHeading eyebrow="Lab preferences" title="Settings" description="Tune the workspace to your reading habits. These preferences stay local to this research environment." action={<button onClick={() => setSaved(true)} className="oe-control oe-primary flex items-center gap-2" data-testid="button-save-settings"><Check size={15} /> {saved ? 'Saved' : 'Save changes'}</button>} /><div className="grid gap-5 lg:grid-cols-[205px_1fr]"><nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">{['Appearance', 'Data & privacy', 'Map defaults', 'Model behavior', 'Notifications', 'About OceanEmbed'].map((x, i) => <button key={x} onClick={() => setActiveSection(x)} className={`whitespace-nowrap px-3 py-2 text-left text-xs ${activeSection === x ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:bg-[#f1edc9]'}`} data-testid={`button-settings-section-${i}`}>{x}</button>)}</nav><div className="space-y-5"><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">{activeSection}</div><h2 className="font-display text-2xl text-[#133458]">Reading environment</h2><div className="mt-6 divide-y divide-[#D8D0B3]"><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Dark field mode</div><div className="mt-1 text-xs text-[#536675]">Use a low-light palette for overnight analysis sessions.</div></div><Toggle name="grid" value={dark} onChange={() => { setDark(!dark); document.documentElement.classList.toggle('dark', !dark); }} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Show coordinate grid</div><div className="mt-1 text-xs text-[#536675]">Keep latitude and longitude guides visible on maps.</div></div><Toggle name="grid" value={toggles.grid} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Motion and transitions</div><div className="mt-1 text-xs text-[#536675]">Subtle movement helps indicate live field updates.</div></div><Toggle name="animation" value={toggles.animation} /></div></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Map defaults</div><h2 className="font-display text-2xl text-[#133458]">Start each session here</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-[#536675]">Default layer<select className="oe-control mt-2 w-full" data-testid="select-default-layer"><option>Sea surface temperature</option><option>Subsurface reconstruction</option><option>Model confidence</option></select></label><label className="text-xs text-[#536675]">Default basin<select className="oe-control mt-2 w-full" data-testid="select-default-basin"><option>Global ocean</option><option>Arabian Sea</option><option>North Atlantic</option></select></label></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Notifications</div><h2 className="font-display text-2xl text-[#133458]">Research signals</h2><div className="mt-5 flex items-center justify-between gap-4"><div><div className="text-sm font-semibold text-[#133458]">New profile clusters</div><div className="mt-1 text-xs text-[#536675]">Notify when a region receives enough new evidence to rerun.</div></div><Toggle name="notifications" value={toggles.notifications} /></div></section><section className="oe-card bg-[#133458] p-5 text-[#FAF7BB] sm:p-6"><div className="flex items-center gap-3"><Waves size={19} className="text-[#D99B21]" /><div className="font-display text-xl">OceanEmbed</div></div><p className="mt-3 max-w-xl text-xs leading-5 text-[#FAF7BB]/60">A research instrument for reading what satellites cannot see alone. Built for oceanographers, climate scientists, and the people who act on their findings.</p><div className="mt-5 font-data text-[9px] tracking-wider text-[#FAF7BB]/40">VERSION 2.4.1 · DATA POLICY · LICENSES</div></section></div></div></div></AppShell>;
}

function SettingsNio() {
  const [dark, setDark] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('Appearance');
  const [toggles, setToggles] = useState({ grid: true, notifications: true, animation: true, telemetry: false });
  const toggle = (key: keyof typeof toggles) => setToggles((old) => ({ ...old, [key]: !old[key] }));
  const Toggle = ({ name, value, onChange }: { name: keyof typeof toggles; value: boolean; onChange?: () => void }) => <button onClick={() => onChange ? onChange() : toggle(name)} className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-[#838921]' : 'bg-[#c9c3a7]'}`} aria-label={`Toggle ${name}`} data-testid={`toggle-${name}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-[#FAF7BB] transition-transform ${value ? 'left-5' : 'left-1'}`} /></button>;
  return <AppShell><div className="oe-page"><SectionHeading eyebrow={`Lab preferences · ${studyRegion}`} title="Settings" description="Keep the OceanEmbed workspace aligned to the North Indian Ocean study context." action={<button onClick={() => setSaved(true)} className="oe-control oe-primary flex items-center gap-2" data-testid="button-save-settings"><Check size={15} /> {saved ? 'Saved' : 'Save changes'}</button>} /><div className="grid gap-5 lg:grid-cols-[205px_1fr]"><nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">{['Appearance', 'Data & privacy', 'Map defaults', 'Model behavior', 'Notifications', 'About OceanEmbed'].map((x) => <button key={x} onClick={() => setActiveSection(x)} className={`whitespace-nowrap px-3 py-2 text-left text-xs ${activeSection === x ? 'bg-[#133458] text-[#FAF7BB]' : 'text-[#536675] hover:bg-[#f1edc9]'}`} data-testid={`button-settings-section-${x.toLowerCase().replaceAll(' ', '-')}`}>{x}</button>)}</nav><div className="space-y-5"><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">{activeSection}</div><h2 className="font-display text-2xl text-[#133458]">Reading environment</h2><div className="mt-6 divide-y divide-[#D8D0B3]"><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Dark field mode</div><div className="mt-1 text-xs text-[#536675]">Use a low-light palette for overnight analysis sessions.</div></div><Toggle name="grid" value={dark} onChange={() => { setDark(!dark); document.documentElement.classList.toggle('dark', !dark); }} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Show coordinate grid</div><div className="mt-1 text-xs text-[#536675]">Keep latitude and longitude guides visible within {studyBounds}.</div></div><Toggle name="grid" value={toggles.grid} /></div><div className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-semibold text-[#133458]">Motion and transitions</div><div className="mt-1 text-xs text-[#536675]">Subtle movement helps indicate study-field updates.</div></div><Toggle name="animation" value={toggles.animation} /></div></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Map defaults</div><h2 className="font-display text-2xl text-[#133458]">Start each session here</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-[#536675]">Default layer<select className="oe-control mt-2 w-full" data-testid="select-default-layer"><option>Sea surface temperature</option><option>Subsurface reconstruction</option><option>Model confidence</option></select></label><label className="text-xs text-[#536675]">Default basin<select className="oe-control mt-2 w-full" data-testid="select-default-basin"><option>North Indian Ocean</option><option>Arabian Sea</option><option>Bay of Bengal</option></select></label></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Study context</div><h2 className="font-display text-2xl text-[#133458]">North Indian Ocean</h2><div className="mt-5 divide-y divide-[#D8D0B3]"><div className="flex items-center justify-between gap-4 py-3"><span className="text-xs text-[#536675]">Study bounds</span><span className="font-data text-xs text-[#133458]">{studyBounds}</span></div><div className="flex items-center justify-between gap-4 py-3"><span className="text-xs text-[#536675]">Subregions</span><span className="font-data text-xs text-[#133458]">Arabian Sea · Bay of Bengal</span></div><div className="flex items-center justify-between gap-4 py-3"><span className="text-xs text-[#536675]">Test period</span><span className="font-data text-xs text-[#133458]">January 2023 · 1 month</span></div></div></section><section className="oe-card p-5 sm:p-6"><div className="oe-kicker mb-1">Notifications</div><h2 className="font-display text-2xl text-[#133458]">Research signals</h2><div className="mt-5 flex items-center justify-between gap-4"><div><div className="text-sm font-semibold text-[#133458]">New profile clusters</div><div className="mt-1 text-xs text-[#536675]">Notify when a North Indian Ocean region receives new evidence.</div></div><Toggle name="notifications" value={toggles.notifications} /></div></section><section className="oe-card bg-[#133458] p-5 text-[#FAF7BB] sm:p-6"><div className="flex items-center gap-3"><Waves size={19} className="text-[#D99B21]" /><div className="font-display text-xl">OceanEmbed</div></div><p className="mt-3 max-w-xl text-xs leading-5 text-[#FAF7BB]/60">A research instrument for reading the North Indian Ocean below the surface. Built for oceanographers, climate scientists, and the people who act on their findings.</p><div className="mt-5 font-data text-[9px] tracking-wider text-[#FAF7BB]/40">NORTH INDIAN OCEAN · JANUARY 2023 · MODEL CONTEXT</div></section></div></div></div></AppShell>;
}

function LandingNio() {
  return <div className="min-h-[100dvh] bg-[#FAF7BB] text-[#133458]"><header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-6 md:px-12"><Logo /><div className="hidden items-center gap-8 text-xs text-[#133458]/65 md:flex"><a href="#instrument" data-testid="link-landing-instrument">The instrument</a><a href="#method" data-testid="link-landing-method">Method</a><a href="#field" data-testid="link-landing-field">Field notes</a></div><Link href="/dashboard" className="flex items-center gap-2 border border-[#133458]/25 px-4 py-2.5 text-xs font-semibold hover:bg-[#133458] hover:text-[#FAF7BB]" data-testid="link-enter-workspace">Enter workspace <ArrowRight size={14} /></Link></header><section className="relative min-h-[760px] overflow-hidden bg-[#133458] px-6 pb-20 pt-40 text-[#FAF7BB] md:px-16 md:pt-48"><div className="absolute right-[-8%] top-[7%] h-[620px] w-[620px] rounded-full border border-[#FAF7BB]/10 md:h-[800px] md:w-[800px]" /><div className="absolute right-[7%] top-[23%] h-[420px] w-[420px] rounded-full border border-[#D99B21]/25 md:h-[590px] md:w-[590px]" /><div className="relative z-10 max-w-3xl animate-rise"><div className="mb-6 flex items-center gap-3 font-data text-[10px] uppercase tracking-[.22em] text-[#D99B21]"><span className="h-px w-9 bg-[#D99B21]" /> North Indian Ocean · January 2023</div><h1 className="max-w-4xl font-display text-[clamp(60px,9vw,138px)] leading-[.86] tracking-[-.05em]">See beneath<br /><i className="text-[#D99B21]">the surface.</i></h1><p className="mt-9 max-w-lg text-base leading-7 text-[#FAF7BB]/65 md:text-lg">OceanEmbed reconstructs subsurface temperature in the North Indian Ocean from surface observations, covering the Arabian Sea and Bay of Bengal.</p><div className="mt-10 flex flex-wrap items-center gap-4"><Link href="/dashboard" className="flex items-center gap-3 bg-[#D99B21] px-5 py-3.5 text-xs font-bold text-[#133458] hover:bg-[#FAF7BB]" data-testid="link-hero-start">Open the instrument <ArrowRight size={15} /></Link><a href="#instrument" className="flex items-center gap-2 px-3 py-3.5 text-xs text-[#FAF7BB]/65 hover:text-[#FAF7BB]" data-testid="link-hero-learn">Read the field notes <ChevronRight size={14} /></a></div></div><div className="absolute bottom-10 right-10 hidden w-60 md:block"><div className="mb-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45"><span>NORTH INDIAN OCEAN</span><span>JANUARY 2023</span></div><svg viewBox="0 0 240 72" className="w-full"><path d="M0 46c20-32 30 24 52-3s31 15 51-8 29 24 49-1 31 18 44-5 25-9 44-20" fill="none" stroke="#D99B21" strokeWidth="1.5" /><path d="M0 62c30-20 42 5 69-11s35 4 61-12 42 5 61-5 27-3 49-15" fill="none" stroke="#9caf68" strokeWidth="1" /></svg><div className="mt-2 font-data text-[9px] text-[#FAF7BB]/45">SUBSURFACE TEMPERATURE / {studyBounds}</div></div></section><section id="instrument" className="px-6 py-24 md:px-16 md:py-32"><div className="grid gap-14 md:grid-cols-[.75fr_1.25fr] md:items-end"><div><div className="oe-kicker mb-4">The instrument</div><h2 className="font-display text-[clamp(38px,5vw,71px)] leading-[.95] tracking-[-.04em]">A clearer read<br />on the North Indian Ocean.</h2></div><p className="max-w-xl text-sm leading-7 text-[#536675]">OceanEmbed combines NOAA OISST, Copernicus SSHA, Copernicus SSS, Copernicus Surface currents, and Argovis / Argo subsurface temperature profiles for one focused study field.</p></div><div className="mt-16 grid gap-4 md:grid-cols-3"><div className="border-t-2 border-[#D99B21] pt-5"><div className="font-data text-4xl">228</div><div className="mt-2 text-xs text-[#536675]">total floats in the study</div></div><div className="border-t-2 border-[#838921] pt-5"><div className="font-data text-4xl">141,433</div><div className="mt-2 text-xs text-[#536675]">total measurements</div></div><div className="border-t-2 border-[#133458] pt-5"><div className="font-data text-4xl">0.554°C</div><div className="mt-2 text-xs text-[#536675]">overall test RMSE</div></div></div></section><section id="method" className="bg-[#e8e2ba] px-6 py-24 md:px-16 md:py-32"><div className="grid gap-12 md:grid-cols-[.7fr_1.3fr]"><div><div className="oe-kicker mb-4">Model / Convolutional Encoder + MLP</div><h2 className="font-display text-[clamp(39px,5vw,67px)] leading-[.95]">From surface<br />to depth.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#536675]">A Convolutional Encoder + MLP (Fully Connected) Decoder maps North Indian Ocean surface signals to subsurface temperature profiles.</p><Link href="/performance/architecture" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-[#838921]" data-testid="link-landing-architecture">Explore model architecture <ArrowRight size={14} /></Link></div><div className="grid gap-3 md:grid-cols-2"><div className="bg-[#FAF7BB] p-6"><div className="font-data text-xs text-[#D99B21]">01 / OBSERVE</div><h3 className="mt-12 font-display text-2xl">Read the field</h3><p className="mt-3 text-xs leading-5 text-[#536675]">Surface temperature, height anomaly, salinity, and currents define the North Indian Ocean input field.</p></div><div className="mt-8 bg-[#133458] p-6 text-[#FAF7BB] md:mt-0"><div className="font-data text-xs text-[#D99B21]">02 / ENCODE</div><h3 className="mt-12 font-display text-2xl">Learn spatial structure</h3><p className="mt-3 text-xs leading-5 text-[#FAF7BB]/60">Convolutional layers turn the surface inputs into a compact ocean feature representation.</p></div><div className="bg-[#838921] p-6 text-[#FAF7BB] md:col-span-2"><div className="font-data text-xs text-[#FAF7BB]/60">03 / DECODE</div><h3 className="mt-12 font-display text-2xl">Resolve the unseen</h3><p className="mt-3 max-w-md text-xs leading-5 text-[#FAF7BB]/70">A fully connected MLP decoder maps the representation to predicted subsurface temperature across depth.</p></div></div></div></section><section id="field" className="bg-[#133458] px-6 py-24 text-[#FAF7BB] md:px-16 md:py-32"><div className="grid gap-12 md:grid-cols-[1fr_1fr] md:items-center"><div><div className="oe-kicker !text-[#D99B21]">Field notes / North Indian Ocean</div><h2 className="mt-4 font-display text-[clamp(40px,5vw,70px)] leading-[.95]">“The signal is<br /><i className="text-[#D99B21]">in the gradient.”</i></h2><p className="mt-7 max-w-md text-sm leading-7 text-[#FAF7BB]/60">The Arabian Sea and Bay of Bengal are the two subregions in the January 2023 study field. OceanEmbed keeps their subsurface temperature structure in view.</p><Link href="/map" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-[#D99B21]" data-testid="link-landing-map">Open the study field <ArrowRight size={14} /></Link></div><div className="border border-[#FAF7BB]/15 p-4"><OceanMap compact selectedLayer="Subsurface reconstruction" /><div className="mt-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45"><span>{studyBounds}</span><span>JANUARY 2023</span></div></div></div></section><footer className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF7BB] px-6 py-8 text-xs md:px-16"><Logo /><span className="text-[#536675]">A research instrument for the North Indian Ocean.</span><Link href="/dashboard" className="font-semibold text-[#838921]" data-testid="link-footer-workspace">Enter workspace <ArrowRight size={13} className="ml-1 inline" /></Link></footer></div>;
}

function Landing() {
  return <div className="min-h-[100dvh] bg-[#FAF7BB] text-[#133458]"><header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-6 md:px-12"><Logo /><div className="hidden items-center gap-8 text-xs text-[#133458]/65 md:flex"><a href="#instrument" data-testid="link-landing-instrument">The instrument</a><a href="#method" data-testid="link-landing-method">Method</a><a href="#field" data-testid="link-landing-field">Field notes</a></div><Link href="/dashboard" className="flex items-center gap-2 border border-[#133458]/25 px-4 py-2.5 text-xs font-semibold hover:bg-[#133458] hover:text-[#FAF7BB]" data-testid="link-enter-workspace">Enter workspace <ArrowRight size={14} /></Link></header><section className="relative min-h-[760px] overflow-hidden bg-[#133458] px-6 pb-20 pt-40 text-[#FAF7BB] md:px-16 md:pt-48"><div className="absolute right-[-8%] top-[7%] h-[620px] w-[620px] rounded-full border border-[#FAF7BB]/10 md:h-[800px] md:w-[800px]" /><div className="absolute right-[7%] top-[23%] h-[420px] w-[420px] rounded-full border border-[#D99B21]/25 md:h-[590px] md:w-[590px]" /><div className="relative z-10 max-w-3xl animate-rise"><div className="mb-6 flex items-center gap-3 font-data text-[10px] uppercase tracking-[.22em] text-[#D99B21]"><span className="h-px w-9 bg-[#D99B21]" /> Ocean intelligence · v2.4</div><h1 className="max-w-4xl font-display text-[clamp(60px,9vw,138px)] leading-[.86] tracking-[-.05em]">See beneath<br /><i className="text-[#D99B21]">the surface.</i></h1><p className="mt-9 max-w-lg text-base leading-7 text-[#FAF7BB]/65 md:text-lg">OceanEmbed turns satellite observations into a coherent view of subsurface temperature — down to 2,000 metres, across the living ocean.</p><div className="mt-10 flex flex-wrap items-center gap-4"><Link href="/dashboard" className="flex items-center gap-3 bg-[#D99B21] px-5 py-3.5 text-xs font-bold text-[#133458] hover:bg-[#FAF7BB]" data-testid="link-hero-start">Open the instrument <ArrowRight size={15} /></Link><a href="#instrument" className="flex items-center gap-2 px-3 py-3.5 text-xs text-[#FAF7BB]/65 hover:text-[#FAF7BB]" data-testid="link-hero-learn">Read the field notes <ChevronRight size={14} /></a></div></div><div className="absolute bottom-10 right-10 hidden w-60 md:block"><div className="mb-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45"><span>LIVE OCEAN STATE</span><span>03.06.24</span></div><svg viewBox="0 0 240 72" className="w-full"><path d="M0 46c20-32 30 24 52-3s31 15 51-8 29 24 49-1 31 18 44-5 25-9 44-20" fill="none" stroke="#D99B21" strokeWidth="1.5" /><path d="M0 62c30-20 42 5 69-11s35 4 61-12 42 5 61-5 27-3 49-15" fill="none" stroke="#9caf68" strokeWidth="1" /></svg><div className="mt-2 font-data text-[9px] text-[#FAF7BB]/45">SUBSURFACE THERMAL SIGNAL / 12°N 55°E</div></div></section><section id="instrument" className="px-6 py-24 md:px-16 md:py-32"><div className="grid gap-14 md:grid-cols-[.75fr_1.25fr] md:items-end"><div><div className="oe-kicker mb-4">The instrument</div><h2 className="font-display text-[clamp(38px,5vw,71px)] leading-[.95] tracking-[-.04em]">A clearer read<br />on a hidden ocean.</h2></div><p className="max-w-xl text-sm leading-7 text-[#536675]">Every day, the surface of the ocean is measured thousands of times. The layers below are not. OceanEmbed learns the relationship between those signals, reconstructing thermal profiles where direct measurements are scarce.</p></div><div className="mt-16 grid gap-4 md:grid-cols-3"><div className="border-t-2 border-[#D99B21] pt-5"><div className="font-data text-4xl">24,892</div><div className="mt-2 text-xs text-[#536675]">reconstructed profiles in the current field</div></div><div className="border-t-2 border-[#838921] pt-5"><div className="font-data text-4xl">2,000 m</div><div className="mt-2 text-xs text-[#536675]">depth resolution from surface to abyssal edge</div></div><div className="border-t-2 border-[#133458] pt-5"><div className="font-data text-4xl">128</div><div className="mt-2 text-xs text-[#536675]">regions actively monitored</div></div></div></section><section id="method" className="bg-[#e8e2ba] px-6 py-24 md:px-16 md:py-32"><div className="grid gap-12 md:grid-cols-[.7fr_1.3fr]"><div><div className="oe-kicker mb-4">Method / 03</div><h2 className="font-display text-[clamp(39px,5vw,67px)] leading-[.95]">From pixels<br />to pressure.</h2><p className="mt-6 max-w-sm text-sm leading-6 text-[#536675]">A model that respects ocean structure: fronts, thermoclines, eddies, and the slow movement of deep water.</p><Link href="/performance/architecture" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-[#838921]" data-testid="link-landing-architecture">Explore model architecture <ArrowRight size={14} /></Link></div><div className="grid gap-3 md:grid-cols-2"><div className="bg-[#FAF7BB] p-6"><div className="font-data text-xs text-[#D99B21]">01 / OBSERVE</div><h3 className="mt-12 font-display text-2xl">Read the field</h3><p className="mt-3 text-xs leading-5 text-[#536675]">Satellite temperature, ocean color, wind, and altimetry become a shared surface language.</p></div><div className="mt-8 bg-[#133458] p-6 text-[#FAF7BB] md:mt-0"><div className="font-data text-xs text-[#D99B21]">02 / EMBED</div><h3 className="mt-12 font-display text-2xl">Find the context</h3><p className="mt-3 text-xs leading-5 text-[#FAF7BB]/60">A vision transformer learns which surface patterns precede the water below.</p></div><div className="bg-[#838921] p-6 text-[#FAF7BB] md:col-span-2"><div className="font-data text-xs text-[#FAF7BB]/60">03 / RECONSTRUCT</div><h3 className="mt-12 font-display text-2xl">Resolve the unseen</h3><p className="mt-3 max-w-md text-xs leading-5 text-[#FAF7BB]/70">Depth-aware decoders turn the embedding into a calibrated temperature profile, with uncertainty at every metre.</p></div></div></div></section><section id="field" className="bg-[#133458] px-6 py-24 text-[#FAF7BB] md:px-16 md:py-32"><div className="grid gap-12 md:grid-cols-[1fr_1fr] md:items-center"><div><div className="oe-kicker !text-[#D99B21]">Field notes / Arabian Sea</div><h2 className="mt-4 font-display text-[clamp(40px,5vw,70px)] leading-[.95]">“The signal is<br /><i className="text-[#D99B21]">in the gradient.”</i></h2><p className="mt-7 max-w-md text-sm leading-7 text-[#FAF7BB]/60">At 300 metres, a thin thermal boundary tells a different story than the surface. OceanEmbed makes that story legible before the next ship arrives.</p><Link href="/map" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-[#D99B21]" data-testid="link-landing-map">Open the live field <ArrowRight size={14} /></Link></div><div className="border border-[#FAF7BB]/15 p-4"><OceanMap compact selectedLayer="Subsurface reconstruction" /><div className="mt-3 flex justify-between font-data text-[9px] text-[#FAF7BB]/45"><span>12.4°N / 54.8°E</span><span>CONFIDENCE 96.2%</span></div></div></div></section><footer className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF7BB] px-6 py-8 text-xs md:px-16"><Logo /><span className="text-[#536675]">A research instrument for the living ocean.</span><Link href="/dashboard" className="font-semibold text-[#838921]" data-testid="link-footer-workspace">Enter workspace <ArrowRight size={13} className="ml-1 inline" /></Link></footer></div>;
}

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/dashboard"><ProtectedPage><Dashboard /></ProtectedPage></Route>
    <Route path="/map"><ProtectedPage><MapNio /></ProtectedPage></Route>
    <Route path="/reconstructions"><ProtectedPage><ReconstructionsNio /></ProtectedPage></Route>
    <Route path="/temperature"><ProtectedPage><Temperature /></ProtectedPage></Route>
    <Route path="/performance/architecture"><ProtectedPage><Architecture /></ProtectedPage></Route>
    <Route path="/performance"><ProtectedPage><Performance /></ProtectedPage></Route>
    <Route path="/dataset"><ProtectedPage><Dataset /></ProtectedPage></Route>
    <Route path="/settings"><ProtectedPage><SettingsNio /></ProtectedPage></Route>
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: {
        start: {
          title: 'Welcome back',
          subtitle: 'Sign in to continue to your ocean intelligence workspace',
        },
      },
      signUp: {
        start: {
          title: 'Create your research account',
          subtitle: 'Join the OceanEmbed research workspace',
        },
      },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <AuthSessionBridge />
      <TooltipProvider><Router /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;