import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowUpRight, BarChart3, Check, ChevronDown, CircleAlert, ClipboardCheck,
  Filter, Flag, HandHeart, Link as LinkIcon, Loader2, MapPin,
  LogOut, Menu, MessageCircle, Navigation, Phone, Search, Send, ShieldCheck,
  Target, Users, X, XCircle,
} from 'lucide-react';
import {
  ChurchStatus,
  getGetChurchQueryKey, getGetMobilizationSummaryQueryKey, getListChurchesQueryKey,
  getListCoordinationFlyerReportsQueryKey, getListRegionsQueryKey,
  useCreateChurchIssueReport, useCreateFlyerReport, useGetChurch,
  useGetMobilizationSummary, useListChurches, useListCoordinationFlyerReports,
  useListRegions, useUpdateChurchCoordination, useUpdateFlyerReportStatus,
  type Church, type FlyerReport,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${compact ? '' : 'group'}`} data-testid="link-campaign-mark">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary shadow-[4px_4px_0_hsl(var(--primary))]">
        <span className="font-mono text-xl font-bold leading-none">11</span>
        <span className="absolute bottom-1 right-1 font-mono text-[10px] font-bold leading-none">133</span>
      </span>
      <span className="leading-none">
        <span className="block text-[10px] font-bold uppercase tracking-[.22em] text-accent">Vote</span>
        <span className={`mt-1 block font-semibold tracking-tight ${compact ? 'text-[#2f5eae]' : 'text-[#78a8ff]'}`}>Pastor Daniel <em className="not-italic">de Castro</em></span>
        {!compact && <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">Deputado distrital · DF</span>}
      </span>
    </Link>
  );
}

function Header({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-7">
        <div className="flex items-center gap-3">
          {onMenu && <button onClick={onMenu} className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden" aria-label="Abrir menu" data-testid="button-open-menu"><Menu size={21} /></button>}
          <div className="md:hidden"><Mark compact /></div>
          <span className="hidden font-mono text-[11px] font-bold uppercase tracking-[.2em] text-muted-foreground md:block">Sala de mobilização <span className="mx-2 text-accent">/</span> Distrito Federal</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/coordination" className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:bg-secondary sm:flex" data-testid="link-coordination-header">
            <ShieldCheck size={15} className="text-accent-foreground" /> Coordenação
          </Link>
          {clerkPubKey ? <HeaderAuthActions /> : <Link href="/sign-in" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="link-sign-in-header">Entrar</Link>}
        </div>
      </div>
    </header>
  );
}

function HeaderAuthActions() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  if (!isLoaded) return <span className="h-8 w-20 rounded-lg bg-muted shimmer" aria-label="Carregando sessão" />;
  if (!isSignedIn) return <Link href="/sign-in" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="link-sign-in-header">Entrar</Link>;
  const displayName = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Coordenação';
  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
  };
  return <div className="flex items-center gap-2" data-testid="header-authenticated">
    <span className="hidden max-w-[150px] truncate rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary sm:block" title={displayName}>Olá, {displayName}</span>
    <button onClick={handleSignOut} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-primary transition hover:border-primary hover:bg-secondary" data-testid="button-sign-out"><LogOut size={14} /> Sair</button>
  </div>;
}

function SideRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-primary/35 md:hidden" onClick={onClose} aria-label="Fechar menu" data-testid="button-close-menu-overlay" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-300 md:static md:z-auto md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between"><Mark /><button onClick={onClose} className="rounded-lg p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent md:hidden" aria-label="Fechar menu" data-testid="button-close-menu"><X size={18} /></button></div>
        <div className="mt-10 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Ao vivo</div>
          <p className="mt-3 text-sm font-medium leading-relaxed text-sidebar-foreground/80">Cada igreja conectada aproxima uma vizinhança da mudança.</p>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Navegação principal">
          <Link href="/" onClick={onClose} className="flex items-center gap-3 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-accent-foreground" data-testid="link-map-nav"><MapPin size={17} /> Mapa de mobilização</Link>
          <Link href="/coordination" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-coordination-nav"><ClipboardCheck size={17} /> Fila de coordenação</Link>
        </nav>
        <div className="mt-auto border-t border-sidebar-border pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground/75"><HandHeart size={15} className="text-accent" /> Mobilização com propósito</div>
          <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/45">Informação local. Ação coletiva. Um DF presente.</p>
        </div>
      </aside>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-background"><div className="flex min-h-[100dvh]"><SideRail open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="min-w-0 flex-1"><Header onMenu={() => setMenuOpen(true)} />{children}</div></div></div>;
}

function StatTile({ label, value, icon: Icon, accent = false }: { label: string; value: number | string; icon: typeof Users; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-center justify-between"><span className={`text-[10px] font-bold uppercase tracking-[.16em] ${accent ? 'text-accent' : 'text-muted-foreground'}`}>{label}</span><Icon size={16} className={accent ? 'text-accent' : 'text-muted-foreground'} /></div><div className="mt-3 font-mono text-2xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</div></div>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={`shimmer rounded-xl ${className}`} />; }
function ErrorState({ onRetry, message = 'Não foi possível atualizar os dados.' }: { onRetry: () => void; message?: string }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center"><CircleAlert size={26} className="text-destructive" /><p className="mt-3 text-sm font-semibold">{message}</p><button onClick={onRetry} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-secondary" data-testid="button-retry">Tentar novamente</button></div>; }

function FallbackMap({ churches, selectedId, onSelect }: { churches: Church[]; selectedId?: number; onSelect: (church: Church) => void }) {
  const points = useMemo(() => churches.map((church) => ({
    church,
    left: `${Math.max(4, Math.min(96, ((church.longitude + 48.7) / 1.5) * 100))}%`,
    top: `${Math.max(6, Math.min(94, ((-15.2 - church.latitude) / 1) * 100))}%`,
  })), [churches]);
  return <div className="map-grid absolute inset-0 overflow-hidden">
    <div className="map-water" /><div className="map-road map-road-main" /><div className="map-road map-road-secondary" /><div className="map-road map-road-vertical" />
    <div className="absolute left-5 top-5 z-10 rounded-xl border border-white/70 bg-card/90 px-3 py-2 shadow-sm backdrop-blur"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="h-2 w-2 rounded-full bg-accent" /> Distrito Federal</div><div className="mt-1 text-[11px] text-muted-foreground">Pins reais · visualização compatível</div></div>
    {points.map(({ church, left, top }) => <button key={church.id} style={{ left, top }} onClick={() => onSelect(church)} className={`absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card transition hover:z-20 hover:scale-150 ${selectedId === church.id ? 'h-6 w-6 bg-primary ring-4 ring-accent/40' : church.status === ChurchStatus.action_done ? 'bg-primary' : church.status === ChurchStatus.group_ready ? 'bg-accent' : 'bg-card ring-1 ring-primary'}`} aria-label={`Ver ${church.name}`} data-testid={`map-marker-${church.id}`} />)}
  </div>;
}

function MapCanvas({ churches, selectedId, onSelect }: { churches: Church[]; selectedId?: number; onSelect: (church: Church) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [token, setToken] = useState('');
  const [mapMode, setMapMode] = useState<'loading' | 'mapbox' | 'fallback' | 'error'>('loading');
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: churches.map((church) => ({
      type: 'Feature' as const,
      properties: { id: church.id, status: church.status },
      geometry: { type: 'Point' as const, coordinates: [church.longitude, church.latitude] },
    })),
  }), [churches]);

  useEffect(() => {
    fetch('/api/map-config')
      .then((response) => {
        if (!response.ok) throw new Error('Map configuration unavailable');
        return response.json();
      })
      .then((data: { token?: string }) => {
        if (data.token) setToken(data.token);
        else setMapMode('error');
      })
      .catch(() => setMapMode('error'));
  }, []);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || mapMode === 'fallback') return;
    if (!mapboxgl.supported()) {
      setMapMode('fallback');
      return;
    }
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map | null = null;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-47.9292, -15.78],
        zoom: 9.5,
        minZoom: 8,
        maxZoom: 17,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('error', () => {
        map?.remove();
        mapRef.current = null;
        setMapMode('fallback');
      });
      map.on('load', () => {
        if (!map) return;
        map.addSource('churches', { type: 'geojson', data: geojson, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
        map.addLayer({ id: 'church-clusters', type: 'circle', source: 'churches', filter: ['has', 'point_count'], paint: { 'circle-color': '#182950', 'circle-radius': ['step', ['get', 'point_count'], 19, 50, 25, 150, 31], 'circle-stroke-width': 3, 'circle-stroke-color': '#f8d23b' } });
        map.addLayer({ id: 'church-cluster-count', type: 'symbol', source: 'churches', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }, paint: { 'text-color': '#f8d23b' } });
        map.addLayer({ id: 'church-points', type: 'circle', source: 'churches', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['match', ['get', 'status'], 'action_done', '#182950', 'group_ready', '#f8d23b', '#fffef9'], 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#182950' } });
        map.addLayer({ id: 'church-points-selected', type: 'circle', source: 'churches', filter: ['==', ['get', 'id'], -1], paint: { 'circle-color': '#182950', 'circle-radius': 11, 'circle-stroke-width': 3, 'circle-stroke-color': '#f8d23b' } });
        map.on('click', 'church-clusters', (event) => {
          const feature = event.features?.[0] as unknown as { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: [number, number] } } | undefined;
          if (!feature) return;
          const clusterId = Number(feature.properties?.cluster_id);
          if (!Number.isFinite(clusterId)) return;
          const source = map?.getSource('churches') as mapboxgl.GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error || zoom == null || feature.geometry?.type !== 'Point') return;
            map?.easeTo({ center: feature.geometry.coordinates, zoom });
          });
        });
        map.on('click', 'church-points', (event) => {
          const feature = event.features?.[0] as unknown as { properties?: Record<string, unknown> } | undefined;
          const id = Number(feature?.properties?.id);
          const church = churches.find((item) => item.id === id);
          if (church) onSelect(church);
        });
        map.on('mouseenter', 'church-clusters', () => { map?.getCanvas().style && (map.getCanvas().style.cursor = 'pointer'); });
        map.on('mouseenter', 'church-points', () => { map?.getCanvas().style && (map.getCanvas().style.cursor = 'pointer'); });
        map.on('mouseleave', 'church-clusters', () => { map?.getCanvas().style && (map.getCanvas().style.cursor = ''); });
        map.on('mouseleave', 'church-points', () => { map?.getCanvas().style && (map.getCanvas().style.cursor = ''); });
        setMapMode('mapbox');
      });
      mapRef.current = map;
    } catch {
      map?.remove();
      mapRef.current = null;
      setMapMode('fallback');
    }
    return () => { map?.remove(); mapRef.current = null; };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('churches') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(geojson);
    if (map.getLayer('church-points-selected')) {
      map.setFilter('church-points-selected', ['==', ['get', 'id'], selectedId ?? -1]);
    }
  }, [geojson, selectedId]);

  return <div className="mapbox-shell relative min-h-[460px] overflow-hidden rounded-[1.5rem] border border-border shadow-sm sm:min-h-[620px]" data-testid="map-canvas">
    <div ref={containerRef} className={`absolute inset-0 ${mapMode === 'mapbox' ? '' : 'hidden'}`} />
    {mapMode === 'fallback' && <FallbackMap churches={churches} selectedId={selectedId} onSelect={onSelect} />}
    {(mapMode === 'error' || mapMode === 'loading') && <div className="absolute inset-0 grid place-items-center bg-[#e8e4d8]"><div className="rounded-2xl border border-dashed border-primary/20 bg-card/90 px-6 py-5 text-center backdrop-blur">{mapMode === 'error' ? <CircleAlert size={24} className="mx-auto text-destructive" /> : <Loader2 size={24} className="mx-auto animate-spin text-primary" />}<p className="mt-2 text-sm font-semibold">{mapMode === 'error' ? 'Mapa indisponível' : 'Carregando mapa do Distrito Federal'}</p><p className="mt-1 max-w-xs text-muted-foreground text-xs">{mapMode === 'error' ? 'A configuração do mapa ainda não está disponível. Tente atualizar a página.' : 'Preparando pontos de mobilização...'}</p></div></div>}
    <div className="absolute left-5 top-5 z-10 rounded-xl border border-white/70 bg-card/90 px-3 py-2 shadow-sm backdrop-blur"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="h-2 w-2 rounded-full bg-accent" /> Distrito Federal</div><div className="mt-1 text-[11px] text-muted-foreground">{churches.length.toLocaleString('pt-BR')} pontos de mobilização</div></div>
    {churches.length === 0 && <div className="absolute inset-0 grid place-items-center"><div className="rounded-2xl border border-dashed border-primary/20 bg-card/85 px-6 py-5 text-center backdrop-blur"><MapPin size={24} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Nenhuma igreja encontrada</p><p className="mt-1 text-xs text-muted-foreground">Tente limpar os filtros para ampliar a busca.</p></div></div>}
    <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2 rounded-xl border border-white/80 bg-card/90 p-2 text-[10px] font-semibold shadow-sm backdrop-blur"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-card ring-1 ring-primary" /> Sem grupo</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-accent" /> Grupo ativo</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-primary" /> Ação registrada</span></div>
  </div>;
}

function ChurchDetail({ church, onClose, onReport }: { church: Church; onClose: () => void; onReport: () => void }) {
  const detailQuery = useGetChurch(church.id, { query: { enabled: true, queryKey: getGetChurchQueryKey(church.id) } });
  const detail = detailQuery.data ?? church;
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueType, setIssueType] = useState('wrong_data');
  const [note, setNote] = useState('');
  const issue = useCreateChurchIssueReport();
  const submitIssue = (event: FormEvent) => { event.preventDefault(); issue.mutate({ churchId: church.id, data: { issueType: issueType as 'closed' | 'wrong_data' | 'duplicate' | 'other', note } }, { onSuccess: () => { setIssueOpen(false); setNote(''); } }); };
  const progress = detail.flyerGoal > 0 ? Math.min(100, Math.round((detail.flyersConfirmed / detail.flyerGoal) * 100)) : 0;
  return <div className="absolute inset-x-3 bottom-3 z-20 max-h-[calc(100%-24px)] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_18px_50px_hsl(var(--primary)/.18)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[370px]" data-testid={`church-detail-${detail.id}`}>
    <div className="flex items-start justify-between border-b border-border p-5"><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${detail.status === ChurchStatus.action_done ? 'bg-primary' : 'bg-accent'}`} /><span className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">{detail.regionName}</span></div><h2 className="mt-2 max-w-[280px] text-lg font-bold leading-tight">{detail.name}</h2><p className="mt-1 text-xs text-muted-foreground">{detail.address || detail.locality || 'Endereço não informado'}</p></div><button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fechar detalhes" data-testid="button-close-church-detail"><X size={18} /></button></div>
    <div className="space-y-4 p-5">
      <div><div className="mb-2 flex items-end justify-between"><span className="text-xs font-semibold">Meta de flyers</span><span className="font-mono text-xs font-bold text-primary">{detail.flyersConfirmed.toLocaleString('pt-BR')} <span className="text-muted-foreground">/ {detail.flyerGoal.toLocaleString('pt-BR')}</span></span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div></div>
      {detailQuery.isLoading ? <div className="h-11 rounded-xl shimmer" /> : detail.whatsappUrl ? <a href={detail.whatsappUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c7c62] px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5" data-testid={`link-whatsapp-${detail.id}`}><MessageCircle size={17} /> Entrar no grupo da igreja <ArrowUpRight size={15} /></a> : <div className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">Grupo de WhatsApp ainda não cadastrado</div>}
      <div className="grid grid-cols-2 gap-2"><a href={detail.mapsUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-bold hover:bg-secondary" data-testid={`link-maps-${detail.id}`}><Navigation size={14} /> Como chegar</a>{detail.phone ? <a href={`tel:${detail.phone}`} className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-bold hover:bg-secondary" data-testid={`link-phone-${detail.id}`}><Phone size={14} /> Ligar</a> : <button className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground" disabled><Phone size={14} /> Sem telefone</button>}</div>
      <button onClick={onReport} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-4 py-3 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground" data-testid={`button-report-flyers-${detail.id}`}><Target size={16} /> Registrar flyers distribuídos</button>
      <div className="border-t border-border pt-3">{issueOpen ? <form onSubmit={submitIssue} className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-bold">Sinalizar informação</span><button type="button" onClick={() => setIssueOpen(false)} className="text-muted-foreground" data-testid="button-close-issue"><X size={14} /></button></div><select value={issueType} onChange={e => setIssueType(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs" data-testid="select-issue-type"><option value="wrong_data">Dados incorretos</option><option value="closed">Igreja fechada</option><option value="duplicate">Cadastro duplicado</option><option value="other">Outro</option></select><textarea required minLength={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Conte o que precisa ser revisado" className="min-h-16 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs" data-testid="textarea-issue-note" /><button disabled={issue.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-submit-issue">{issue.isPending && <Loader2 size={13} className="animate-spin" />} Enviar sinalização</button></form> : <button onClick={() => setIssueOpen(true)} className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-primary" data-testid={`button-report-issue-${church.id}`}><Flag size={13} /> Sinalizar dado incorreto</button>}</div>
    </div>
  </div>;
}

function FlyerDialog({ church, onClose }: { church: Church; onClose: () => void }) {
  const create = useCreateFlyerReport();
  const [form, setForm] = useState({ actionDate: new Date().toISOString().slice(0, 10), flyerCount: '', volunteerName: '', volunteerPhone: '', note: '' });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ churchId: church.id, data: { actionDate: form.actionDate, flyerCount: Number(form.flyerCount), volunteerName: form.volunteerName, volunteerPhone: form.volunteerPhone, note: form.note || null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetMobilizationSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetChurchQueryKey(church.id) }); queryClient.invalidateQueries({ queryKey: getListChurchesQueryKey() }); onClose(); } }); };
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-primary/45 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl fade-up" role="dialog" aria-modal="true" data-testid="dialog-flyer-report"><div className="flex items-start justify-between border-b border-border p-5"><div><div className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-accent-foreground">Registro de campo</div><h2 className="mt-1 text-lg font-bold">Flyers distribuídos</h2><p className="mt-1 text-xs text-muted-foreground">{church.name}</p></div><button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fechar formulário" data-testid="button-close-flyer-dialog"><X size={18} /></button></div><form onSubmit={submit} className="space-y-3 p-5"><div className="grid grid-cols-2 gap-3"><label className="space-y-1.5 text-xs font-semibold">Data<input type="date" required value={form.actionDate} onChange={e => setForm({ ...form, actionDate: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal" data-testid="input-action-date" /></label><label className="space-y-1.5 text-xs font-semibold">Quantidade<input type="number" min="1" required placeholder="Ex.: 80" value={form.flyerCount} onChange={e => setForm({ ...form, flyerCount: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal" data-testid="input-flyer-count" /></label></div><label className="block space-y-1.5 text-xs font-semibold">Seu nome<input required minLength={2} value={form.volunteerName} onChange={e => setForm({ ...form, volunteerName: e.target.value })} placeholder="Como podemos identificar você?" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal" data-testid="input-volunteer-name" /></label><label className="block space-y-1.5 text-xs font-semibold">Celular<input required minLength={8} value={form.volunteerPhone} onChange={e => setForm({ ...form, volunteerPhone: e.target.value })} placeholder="(61) 9 0000-0000" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal" data-testid="input-volunteer-phone" /></label><label className="block space-y-1.5 text-xs font-semibold">Observação <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ex.: ação na saída do culto" className="mt-1 min-h-16 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal" data-testid="textarea-flyer-note" /></label>{create.isError && <p className="text-xs font-semibold text-destructive">Não foi possível enviar. Confira os dados e tente novamente.</p>}<button disabled={create.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="button-submit-flyer-report">{create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar registro para aprovação</button><p className="text-center text-[10px] text-muted-foreground">O registro será revisado pela coordenação antes de entrar no total confirmado.</p></form></div></div>;
}

function Home() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState<'all' | 'no_group' | 'group_ready' | 'action_done'>('all');
  const [selected, setSelected] = useState<Church>();
  const [reportChurch, setReportChurch] = useState<Church>();
  const summary = useGetMobilizationSummary({ query: { queryKey: getGetMobilizationSummaryQueryKey() } });
  const regions = useListRegions({ query: { queryKey: getListRegionsQueryKey() } });
  const churches = useListChurches({ ra: region || undefined, search: search || undefined, status: status === 'all' ? undefined : status, limit: 2500 }, { query: { queryKey: getListChurchesQueryKey({ ra: region || undefined, search: search || undefined, status: status === 'all' ? undefined : status, limit: 2500 }) } });
  const regionOptions = regions.data || [];
  const churchData = churches.data || [];
  return <Shell><main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">
    <section className="campaign-grid relative overflow-hidden rounded-[1.5rem] border border-border bg-card px-5 py-7 sm:px-9 sm:py-9"><div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/25 blur-3xl" /><div className="relative max-w-2xl"><div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-accent" /> Operação 11.133 <span className="text-border">•</span> Brasília e entorno</div><h1 className="mt-4 max-w-xl text-3xl font-bold leading-[1.02] tracking-[-.04em] text-primary sm:text-5xl">A força da mudança começa <span className="text-accent-foreground underline decoration-accent decoration-8 underline-offset-2">perto.</span></h1><p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">Encontre uma igreja, entre no grupo de mobilização e transforme presença em ação no seu bairro.</p></div><div className="relative mt-7 flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-accent">Pastor Daniel de Castro</span><span className="rounded-full border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Deputado distrital</span></div></section>
    <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{summary.isLoading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24" />) : summary.isError ? <div className="col-span-full"><ErrorState onRetry={() => summary.refetch()} /></div> : <><StatTile label="Igrejas no mapa" value={summary.data?.churches ?? 0} icon={MapPin} /><StatTile label="Regiões ativas" value={summary.data?.regions ?? 0} icon={BarChart3} /><StatTile label="Grupos no WhatsApp" value={summary.data?.churchesWithGroups ?? 0} icon={MessageCircle} accent /><StatTile label="Flyers confirmados" value={summary.data?.confirmedFlyers ?? 0} icon={Target} /></>}</section>
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"><div className="min-w-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Radar de campo</div><h2 className="mt-1 text-2xl font-bold tracking-tight">Igrejas próximas da ação</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 font-mono text-[10px] font-bold text-muted-foreground">{churches.isLoading ? '…' : `${churchData.length} pontos`}</span></div><div className="relative">{churches.isLoading ? <Skeleton className="min-h-[460px] sm:min-h-[620px]" /> : churches.isError ? <ErrorState onRetry={() => churches.refetch()} /> : <MapCanvas churches={churchData} selectedId={selected?.id} onSelect={setSelected} />}{selected && <ChurchDetail church={selected} onClose={() => setSelected(undefined)} onReport={() => setReportChurch(selected)} />}</div></div>
      <aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Encontrar mobilização</h2><Filter size={17} className="text-muted-foreground" /></div><label className="relative mt-4 block"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar igreja ou localidade" className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent transition focus:ring-2" data-testid="input-search-churches" /></label><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><select value={region} onChange={e => setRegion(e.target.value)} className="min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-xs font-semibold outline-none" data-testid="select-region"><option value="">Todas as regiões</option>{regionOptions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select><select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="rounded-xl border border-input bg-background px-2 py-2.5 text-xs font-semibold outline-none" aria-label="Filtrar status" data-testid="select-status"><option value="all">Todos</option><option value="no_group">Sem grupo</option><option value="group_ready">Grupo ativo</option><option value="action_done">Com ação</option></select></div></div>
        <div className="rounded-2xl border border-border bg-primary p-5 text-primary-foreground"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">Pulso regional</span><BarChart3 size={17} className="text-accent" /></div><div className="mt-5 space-y-3">{summary.data?.topRegions?.length ? summary.data.topRegions.slice(0, 4).map((item, index) => <div key={item.code}><div className="flex justify-between text-xs"><span className="font-semibold">{index + 1}. {item.name}</span><span className="font-mono text-accent">{item.confirmedFlyers.toLocaleString('pt-BR')}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(9, Math.min(100, (item.confirmedFlyers / Math.max(...summary.data.topRegions.map(regionItem => regionItem.confirmedFlyers), 1)) * 100))}%` }} /></div></div>) : <p className="text-xs text-primary-foreground/65">Os dados regionais aparecerão quando a mobilização começar.</p>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-primary"><HandHeart size={16} /></div><div><h3 className="text-sm font-bold">Você esteve em uma ação?</h3><p className="text-[11px] text-muted-foreground">Registre seu resultado em poucos segundos.</p></div></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Selecione uma igreja no mapa para enviar flyers, alcance e observações.</p></div>
      </aside></section>
  </main>{reportChurch && <FlyerDialog church={reportChurch} onClose={() => setReportChurch(undefined)} />}</Shell>;
}

function Coordination() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [editing, setEditing] = useState<Church>();
  const reports = useListCoordinationFlyerReports(filter === 'all' ? undefined : { status: filter }, { query: { queryKey: getListCoordinationFlyerReportsQueryKey(filter === 'all' ? undefined : { status: filter }) } });
  const summary = useGetMobilizationSummary({ query: { queryKey: getGetMobilizationSummaryQueryKey() } });
  const updateStatus = useUpdateFlyerReportStatus();
  const approve = (report: FlyerReport, next: 'approved' | 'rejected') => updateStatus.mutate({ reportId: report.id, data: { status: next } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCoordinationFlyerReportsQueryKey(filter === 'all' ? undefined : { status: filter }) }); queryClient.invalidateQueries({ queryKey: getGetMobilizationSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getListChurchesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetChurchQueryKey(report.churchId) }); } });
  return <Shell><main className="mx-auto max-w-[1250px] px-4 py-6 sm:px-7 sm:py-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Área reservada · Operação 11.133</div><h1 className="mt-2 text-3xl font-bold tracking-tight">Coordenação</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Aprove registros de campo e mantenha os grupos de cada igreja prontos para a próxima ação.</p></div><Link href="/" className="flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-secondary" data-testid="link-back-map"><MapPin size={14} /> Voltar ao mapa</Link></div>
    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><StatTile label="Igrejas" value={summary.data?.churches ?? '—'} icon={MapPin} /><StatTile label="Pendentes" value={summary.data?.pendingReports ?? '—'} icon={ClipboardCheck} accent /><StatTile label="Ações" value={summary.data?.churchesWithActions ?? '—'} icon={Target} /><StatTile label="Grupos ativos" value={summary.data?.churchesWithGroups ?? '—'} icon={MessageCircle} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-2xl border border-border bg-card"><div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Registros de flyers</h2><p className="mt-1 text-xs text-muted-foreground">Revise os lançamentos feitos pelos voluntários.</p></div><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold" data-testid="select-report-filter"><option value="pending">Pendentes</option><option value="approved">Aprovados</option><option value="rejected">Recusados</option><option value="all">Todos</option></select></div>{reports.isLoading ? <div className="space-y-3 p-5">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div> : reports.isError ? <div className="p-5"><ErrorState onRetry={() => reports.refetch()} /></div> : reports.data?.length ? <div className="divide-y divide-border">{reports.data.map(report => <div key={report.id} className="p-5" data-testid={`report-row-${report.id}`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase ${report.status === 'pending' ? 'bg-accent text-primary' : report.status === 'approved' ? 'bg-primary text-accent' : 'bg-destructive/10 text-destructive'}`}>{report.status === 'pending' ? 'Pendente' : report.status === 'approved' ? 'Aprovado' : 'Recusado'}</span><span className="font-mono text-[10px] text-muted-foreground">{new Date(report.actionDate).toLocaleDateString('pt-BR')}</span></div><h3 className="mt-2 text-sm font-bold">{report.churchName}</h3><p className="mt-1 text-xs text-muted-foreground">{report.volunteerName} · {report.volunteerPhone}</p>{report.note && <p className="mt-2 border-l-2 border-accent pl-2 text-xs italic text-muted-foreground">“{report.note}”</p>}</div><div className="flex items-center justify-between gap-4 sm:block sm:text-right"><div className="font-mono text-2xl font-bold text-primary">{report.flyerCount.toLocaleString('pt-BR')}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">flyers</div></div></div>{report.status === 'pending' && <div className="mt-4 flex gap-2 border-t border-border pt-3"><button disabled={updateStatus.isPending} onClick={() => approve(report, 'approved')} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid={`button-approve-report-${report.id}`}><Check size={14} /> Aprovar</button><button disabled={updateStatus.isPending} onClick={() => approve(report, 'rejected')} className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5" data-testid={`button-reject-report-${report.id}`}><XCircle size={14} /> Recusar</button></div>}</div>)}</div> : <div className="p-10 text-center"><ClipboardCheck size={28} className="mx-auto text-muted-foreground" /><h3 className="mt-3 text-sm font-bold">Fila limpa por aqui</h3><p className="mt-1 text-xs text-muted-foreground">Nenhum registro corresponde a este filtro.</p></div>}</section>
      <ChurchCoordinationPanel church={editing} onSelect={setEditing} /></div>
  </main></Shell>;
}

function ProtectedCoordination() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Shell><main className="mx-auto max-w-[1250px] px-4 py-10 sm:px-7"><Skeleton className="h-32" /><div className="mt-5 grid gap-5 md:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></main></Shell>;
  if (!isSignedIn) return <Shell><main className="mx-auto flex min-h-[70vh] max-w-[560px] flex-col items-center justify-center px-5 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary"><ShieldCheck size={26} /></div><h1 className="mt-5 text-2xl font-bold">A coordenação é uma área reservada</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Entre com sua conta de mobilização para aprovar registros e editar as metas das igrejas.</p><Link href="/sign-in" className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-sign-in-coordination">Entrar na coordenação</Link></main></Shell>;
  return <Coordination />;
}

function ChurchCoordinationPanel({ church, onSelect }: { church?: Church; onSelect: (church?: Church) => void }) {
  const [search, setSearch] = useState('');
  const list = useListChurches({ search: search || undefined, limit: 30 }, { query: { queryKey: getListChurchesQueryKey({ search: search || undefined, limit: 30 }) } });
  const update = useUpdateChurchCoordination();
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [flyerGoal, setFlyerGoal] = useState('');
  const choose = (item: Church) => { onSelect(item); setWhatsappUrl(item.whatsappUrl || ''); setFlyerGoal(String(item.flyerGoal)); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (!church) return; update.mutate({ churchId: church.id, data: { whatsappUrl: whatsappUrl || null, flyerGoal: Number(flyerGoal) } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChurchesQueryKey({ search: search || undefined, limit: 30 }) }); onSelect(undefined); } }); };
  return <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between"><div><h2 className="font-bold">Ajustes das igrejas</h2><p className="mt-1 text-xs text-muted-foreground">Atualize grupo e meta de flyers.</p></div><LinkIcon size={17} className="text-accent-foreground" /></div>{church ? <form onSubmit={submit} className="mt-5 space-y-3"><button type="button" onClick={() => onSelect(undefined)} className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary" data-testid="button-back-church-list">← Escolher outra igreja</button><div className="rounded-xl bg-secondary p-3"><p className="text-xs font-bold">{church.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{church.regionName}</p></div><label className="block text-xs font-semibold">Link do WhatsApp<input type="url" value={whatsappUrl} onChange={e => setWhatsappUrl(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-xs font-normal" data-testid="input-coordination-whatsapp" /></label><label className="block text-xs font-semibold">Meta de flyers<input type="number" min="0" required value={flyerGoal} onChange={e => setFlyerGoal(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-xs font-normal" data-testid="input-coordination-goal" /></label><button disabled={update.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-save-coordination">{update.isPending && <Loader2 size={14} className="animate-spin" />} Salvar alterações</button></form> : <><label className="relative mt-5 block"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar igreja..." className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-xs" data-testid="input-search-coordination-churches" /></label><div className="mt-3 max-h-[430px] space-y-1 overflow-y-auto">{list.isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-12" />) : list.data?.length ? list.data.map(item => <button key={item.id} onClick={() => choose(item)} className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-secondary" data-testid={`button-edit-church-${item.id}`}><span className="min-w-0"><span className="block truncate text-xs font-semibold">{item.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.regionName}</span></span><ChevronDown size={14} className="-rotate-90 text-muted-foreground" /></button>) : <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma igreja encontrada.</p>}</div></>}</section>;
}

function AuthFallback({ signUp = false }: { signUp?: boolean }) {
  const [, setLocation] = useLocation();
  return <div className="min-h-[100dvh] bg-primary"><div className="grid min-h-[100dvh] lg:grid-cols-[1fr_480px]"><section className="campaign-grid hidden flex-col justify-between p-10 text-primary-foreground lg:flex"><Mark /><div className="max-w-xl pb-10"><div className="font-mono text-xs font-bold uppercase tracking-[.2em] text-accent">Acesso da mobilização</div><h1 className="mt-4 text-6xl font-bold leading-[.95] tracking-[-.05em]">O DF se move quando a gente se move junto.</h1><p className="mt-6 max-w-md text-base leading-relaxed text-primary-foreground/65">Entre na sala de coordenação para cuidar dos detalhes que fazem uma ação local chegar mais longe.</p></div><div className="font-mono text-[10px] uppercase tracking-[.14em] text-primary-foreground/40">11.133 · Pastor Daniel de Castro</div></section><section className="flex items-center justify-center bg-background p-5 sm:p-10"><div className="w-full max-w-[390px]"><div className="mb-10 lg:hidden"><Mark /></div><div className="mb-8"><div className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-accent-foreground">Acesso seguro</div><h1 className="mt-2 text-3xl font-bold tracking-tight">{signUp ? 'Criar conta' : 'Bem-vindo de volta'}</h1><p className="mt-2 text-sm text-muted-foreground">{signUp ? 'Faça parte da coordenação da campanha.' : 'Entre para acompanhar a operação.'}</p></div><div className="rounded-2xl border border-border bg-card p-5"><div className="rounded-xl border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">O provedor de autenticação Clerk ainda não está disponível neste ambiente. Quando conectado, este endereço exibirá o acesso seguro da coordenação.</div><button onClick={() => setLocation('/')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-back-home"><ArrowUpRight size={14} className="-rotate-135" /> Voltar ao mapa público</button></div></div></section></div></div>;
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
    colorPrimary: '#182950',
    colorForeground: '#182950',
    colorMutedForeground: '#667085',
    colorDanger: '#b53a32',
    colorBackground: '#fbfaf4',
    colorInput: '#fffef9',
    colorInputForeground: '#182950',
    colorNeutral: '#d9d2bd',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf4] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d9d2bd]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#182950] font-bold',
    headerSubtitle: 'text-[#667085]',
    formFieldLabel: 'text-[#182950] font-semibold',
    footerActionLink: 'text-[#182950] font-bold',
    footerActionText: 'text-[#667085]',
    dividerText: 'text-[#667085]',
    formButtonPrimary: 'bg-[#182950] text-[#f8d23b] hover:bg-[#243969]',
    formFieldInput: 'bg-[#fffef9] border-[#d9d2bd] text-[#182950]',
    main: 'bg-transparent',
  },
};

function SignInPage() {
  return clerkPubKey ? <div className="flex min-h-[100dvh] items-center justify-center bg-primary p-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div> : <AuthFallback />;
}

function SignUpPage() {
  return clerkPubKey ? <div className="flex min-h-[100dvh] items-center justify-center bg-primary p-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div> : <AuthFallback signUp />;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/coordination" component={clerkPubKey ? ProtectedCoordination : Coordination} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={NotFound} /></Switch>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey!} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })} localization={{ signIn: { start: { title: 'Bem-vindo de volta', subtitle: 'Entre para acessar a coordenação' } }, signUp: { start: { title: 'Faça parte da mobilização', subtitle: 'Crie sua conta de coordenação' } } }}><Router /></ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ErrorBoundary>{clerkPubKey ? <ClerkRoutes /> : <Router />}</ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;