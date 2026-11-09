import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bug,
  Flame,
  Snowflake,
  Brush,
  Check,
  ChevronRight,
  Globe,
  FileText,
  Music,
  Container,
  Play,
  Pause,
  X,
  FastForward,
  Sparkles,
} from 'lucide-react';
import {
  AppId,
  ChromeTab,
  DockerContainer,
  RenderStyle,
  computePhysicalState,
  formatDuration,
} from '../types/desktop';
import { WindowAuraCanvas } from './WindowAuraCanvas';
import { soundEngine } from '../utils/soundEffects';

interface PreviewWindow {
  id: AppId;
  appName: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  enabled: boolean;
  cpu: number;
  ramGb: number;
  unfocusedSec: number;
  idleSec: number;
  frostLevel: number;
  brushingUntil: number;
  brushedAmount: number;
}

const INITIAL_TABS: ChromeTab[] = [
  { id: 'c1', title: 'Three.js Volumetric Cloud Shader', domain: 'shaders.dev', cpu: 44, ramMb: 2900 },
  { id: 'c2', title: '4K60 Fireplace — YouTube', domain: 'youtube.com', cpu: 24, ramMb: 1600 },
  { id: 'c3', title: '18x StackOverflow Tabs', domain: 'stackoverflow.com', cpu: 23, ramMb: 2100 },
];

const INITIAL_CONTAINERS: DockerContainer[] = [
  { id: 'd1', name: 'postgres-16', image: 'postgres:16-alpine', running: true, cpu: 2.4, ramGb: 0.4 },
  { id: 'd2', name: 'ollama-llama3-70b', image: 'ollama/ollama', running: false, cpu: 64.0, ramGb: 7.2 },
  { id: 'd3', name: 'elasticsearch-8', image: 'elasticsearch:8.12', running: false, cpu: 24.0, ramGb: 2.1 },
];

function initialPreviewWindows(): PreviewWindow[] {
  return [
    {
      id: 'chrome',
      appName: 'Google Chrome',
      title: 'Google Chrome — 48 Tabs',
      x: 26,
      y: 44,
      w: 365,
      h: 242,
      z: 5,
      enabled: true,
      cpu: 91,
      ramGb: 6.6,
      unfocusedSec: 320,
      idleSec: 0,
      frostLevel: 0,
      brushingUntil: 0,
      brushedAmount: 0,
    },
    {
      id: 'notion',
      appName: 'Notion',
      title: 'Notion — Q3 Roadmap.md',
      x: 432,
      y: 40,
      w: 356,
      h: 232,
      z: 3,
      enabled: true,
      cpu: 0.4,
      ramGb: 0.3,
      unfocusedSec: 13800, // 3h 50m -> Cobwebs + dangling spider!
      idleSec: 13800,
      frostLevel: 0.18,
      brushingUntil: 0,
      brushedAmount: 0,
    },
    {
      id: 'spotify',
      appName: 'Spotify',
      title: 'Spotify — Subzero Lo-Fi',
      x: 54,
      y: 264,
      w: 336,
      h: 196,
      z: 4,
      enabled: true,
      cpu: 0.2,
      ramGb: 0.2,
      unfocusedSec: 3100,
      idleSec: 3100,
      frostLevel: 0.9, // Frosted edges!
      brushingUntil: 0,
      brushedAmount: 0,
    },
    {
      id: 'docker',
      appName: 'Docker Desktop',
      title: 'Docker Desktop — Containers',
      x: 416,
      y: 252,
      w: 368,
      h: 208,
      z: 1,
      enabled: true,
      cpu: 2.4,
      ramGb: 0.4,
      unfocusedSec: 8100, // 2h 15m -> Fresh cobwebs!
      idleSec: 8100,
      frostLevel: 0.25,
      brushingUntil: 0,
      brushedAmount: 0,
    },
  ];
}

export const MacosDesktopPreview: React.FC = () => {
  const [windows, setWindows] = useState<PreviewWindow[]>(initialPreviewWindows);
  const [focusedId, setFocusedId] = useState<AppId | null>('chrome');
  const [enabled, setEnabled] = useState(true);
  const [style, setStyle] = useState<RenderStyle>('organic');
  const [cobwebDelaySec, setCobwebDelaySec] = useState(7200);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'apps' | 'style' | 'delay' | 'preview' | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Click Notion or Docker (cobwebbed >2h) to brush webs away, or click the 🕸 menu-bar icon.'
  );

  const [tabs, setTabs] = useState<ChromeTab[]>(INITIAL_TABS);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [containers, setContainers] = useState<DockerContainer[]>(INITIAL_CONTAINERS);

  const zRef = useRef(10);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: AppId; sx: number; sy: number; ox: number; oy: number } | null>(
    null
  );

  // Fixed 800px design space, scaled down on narrow viewports so all four
  // windows stay visible and clickable on phone screens.
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageScale(Math.min(1, el.clientWidth / 800));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-render once the 560ms brush window expires so the 'Brushed!' chip unmounts
  // and its CSS animation can restart on the next brush.
  const [, setBrushTick] = useState(0);
  useEffect(() => {
    const until = Math.max(0, ...windows.map((w) => w.brushingUntil));
    if (until <= Date.now()) return;
    const id = setTimeout(() => setBrushTick((t) => t + 1), until - Date.now() + 30);
    return () => clearTimeout(id);
  }, [windows]);

  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Normalize z so unbounded zRef growth can never exceed the menu bar (z-40)
  const minZ = Math.min(...windows.map((w) => w.z));

  const physicalMap = useMemo(() => {
    const out = {} as Record<AppId, ReturnType<typeof computePhysicalState>>;
    for (const w of windows) {
      out[w.id] = computePhysicalState(
        {
          id: w.id,
          appName: w.appName,
          windowTitle: w.title,
          x: w.x,
          y: w.y,
          width: w.w,
          height: w.h,
          zIndex: w.z,
          minimized: false,
          borderEnabled: w.enabled,
          cpu: w.cpu,
          ramGb: w.ramGb,
          unfocusedSeconds: w.unfocusedSec,
          idleSeconds: w.idleSec,
          frostLevel: w.frostLevel,
          brushingUntil: w.brushingUntil,
          brushedWebAmount: w.brushedAmount,
        },
        focusedId === w.id,
        cobwebDelaySec,
        enabled
      );
    }
    return out;
  }, [windows, focusedId, cobwebDelaySec, enabled]);

  const handleFocus = useCallback(
    (id: AppId) => {
      const target = windows.find((w) => w.id === id);
      if (!target) return;
      const phys = physicalMap[id];
      const hadWebs = phys.cobwebIntensity > 0.05;
      const neglectedFor = formatDuration(target.unfocusedSec);

      zRef.current += 1;
      const nextZ = zRef.current;
      setFocusedId(id);

      if (hadWebs) {
        soundEngine.playBrushAway();
        setStatusBanner(
          `🧹 Brushed ${neglectedFor} of cobwebs off ${target.appName} on focus!`
        );
      } else {
        soundEngine.playTick();
      }

      setWindows((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                z: nextZ,
                unfocusedSec: 0,
                idleSec: 0,
                frostLevel: 0,
                brushingUntil: hadWebs ? Date.now() + 560 : w.brushingUntil,
                brushedAmount: hadWebs ? phys.cobwebIntensity : w.brushedAmount,
              }
            : w
        )
      );
    },
    [windows, physicalMap]
  );

  const handleTimeWarp2h = () => {
    soundEngine.playTick();
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id === focusedId) return w;
        const isHot = w.cpu * 0.78 + w.ramGb * 4.5 >= 54;
        return {
          ...w,
          unfocusedSec: w.unfocusedSec + 7200,
          idleSec: isHot ? 0 : w.idleSec + 7200,
          frostLevel: isHot ? 0 : Math.min(0.95, w.frostLevel + 0.65),
        };
      })
    );
    setStatusBanner('⏩ Fast-forwarded +2h: background windows grew corner cobwebs & edge frost.');
  };

  const handleBrushAll = () => {
    soundEngine.playBrushAway();
    setWindows((prev) =>
      prev.map((w) => ({
        ...w,
        unfocusedSec: 0,
        idleSec: 0,
        frostLevel: 0,
        brushingUntil: Date.now() + 560,
        brushedAmount: Math.max(0.4, physicalMap[w.id].cobwebIntensity),
      }))
    );
    setStatusBanner('🧹 Brushed all cobwebs and thawed edge frost across all windows.');
  };

  const handleCloseTab = (tabId: string) => {
    soundEngine.playTick();
    const next = tabs.filter((t) => t.id !== tabId);
    setTabs(next);
    const cpu = Math.max(4, next.reduce((s, t) => s + t.cpu, 2));
    const ramGb = Number(Math.max(0.3, next.reduce((s, t) => s + t.ramMb, 200) / 1000).toFixed(1));
    setWindows((prev) => prev.map((w) => (w.id === 'chrome' ? { ...w, cpu, ramGb } : w)));
    if (cpu < 55) {
      setStatusBanner('🧊 Chrome CPU/RAM dropped — cast-iron edges cooled down.');
    }
  };

  const handleReopenTabs = () => {
    soundEngine.playHeatSpike();
    setTabs(INITIAL_TABS);
    setWindows((prev) =>
      prev.map((w) => (w.id === 'chrome' ? { ...w, cpu: 91, ramGb: 6.6, frostLevel: 0 } : w))
    );
    setStatusBanner('🔥 Chrome spiked to 91% CPU · 6.6 GB RAM — frame glowing red-hot cast iron!');
  };

  const handleToggleContainer = (cid: string) => {
    const next = containers.map((c) => (c.id === cid ? { ...c, running: !c.running } : c));
    setContainers(next);
    const running = next.filter((c) => c.running);
    const cpu = Math.min(98, Math.max(2.0, running.reduce((s, c) => s + c.cpu, 1.5)));
    const ramGb = Number(Math.max(0.4, running.reduce((s, c) => s + c.ramGb, 0.3)).toFixed(1));
    if (cpu >= 55) {
      soundEngine.playHeatSpike();
      setStatusBanner(
        `🔥 Docker Engine hit ${Math.round(cpu)}% CPU · ${ramGb} GB RAM — cast-iron frame ignited!`
      );
    } else {
      soundEngine.playTick();
    }
    setWindows((prev) =>
      prev.map((w) =>
        w.id === 'docker'
          ? {
              ...w,
              cpu,
              ramGb,
              unfocusedSec: 0,
              frostLevel: cpu >= 40 ? 0 : w.frostLevel,
            }
          : w
      )
    );
  };

  return (
    <div className="space-y-3">
      {/* macOS Screen Frame */}
      <div
        ref={stageRef}
        onClick={() => {
          if (menuOpen) {
            setMenuOpen(false);
            setActiveSubmenu(null);
          }
        }}
        style={{
          backgroundColor: '#E3DDD2',
          height: 500 * stageScale,
          backgroundImage:
            'radial-gradient(circle at 22% 18%, rgba(255,252,246,0.8) 0%, transparent 55%), radial-gradient(circle at 82% 85%, rgba(190,178,160,0.48) 0%, transparent 60%)',
        }}
        className="relative w-full rounded-2xl border border-stone-300/90 shadow-[0_24px_65px_rgba(28,25,23,0.13)] overflow-hidden select-none"
      >
        <div
          ref={layerRef}
          style={{
            width: 800,
            height: 500,
            transform: `scale(${stageScale})`,
            transformOrigin: 'top left',
          }}
          className="relative"
        >
        {/* Authentic macOS Top Menu Bar */}
        <div className="relative z-40 h-7 px-3 bg-white/75 backdrop-blur-xl border-b border-black/8 flex items-center justify-between text-[11px] text-stone-900">
          <div className="flex items-center gap-3.5">
            <span className="font-bold text-xs"></span>
            <span className="font-bold">Finder</span>
            <span className="hidden sm:inline opacity-80">File</span>
            <span className="hidden sm:inline opacity-80">Edit</span>
            <span className="hidden sm:inline opacity-80">View</span>
            <span className="hidden sm:inline opacity-80">Window</span>
            <span className="hidden sm:inline opacity-80">Help</span>
          </div>

          {/* Right Status Area — Native NSStatusBar Item */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline text-[10px] font-mono-telemetry text-stone-500">
              {style === 'pixel' ? '8-Bit Pixel' : 'Organic'} · &gt;{Math.round(cobwebDelaySec / 60)}m
            </span>

            {/* Spiderweb NSStatusItem Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                soundEngine.playTick();
                setMenuOpen((o) => !o);
                setActiveSubmenu(null);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer ${
                menuOpen ? 'bg-blue-600 text-white' : 'hover:bg-black/8 text-stone-900'
              }`}
              title="Diegetic Menu Bar Extra"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold">Cobwebs</span>
            </button>

            <span className="text-[11px] font-medium opacity-80">Tue 9:41 AM</span>
          </div>
        </div>

        {/* Native macOS NSMenu Dropdown (Mirrors macos/src/menubar.m) */}
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-8 right-3 z-50 w-60 rounded-xl bg-white/92 backdrop-blur-2xl border border-black/12 shadow-[0_18px_48px_rgba(0,0,0,0.22)] py-1.5 text-[12px] text-stone-900"
          >
            <button
              onClick={() => {
                soundEngine.playTick();
                setEnabled((v) => !v);
              }}
              className="w-full px-3 py-1 flex items-center gap-2 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
            >
              <span className="w-3.5 flex justify-center">
                {enabled && <Check className="w-3.5 h-3.5" />}
              </span>
              <span>Show Cobwebs &amp; Frost</span>
            </button>

            {/* Apps Submenu Trigger */}
            <div
              onMouseEnter={() => setActiveSubmenu('apps')}
              className="relative"
            >
              <button
                onClick={() => setActiveSubmenu(activeSubmenu === 'apps' ? null : 'apps')}
                className="w-full px-3 py-1 flex items-center justify-between hover:bg-blue-600 hover:text-white text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3.5" />
                  <span>Apps</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeSubmenu === 'apps' && (
                <div className="absolute right-full top-0 mr-1 w-52 rounded-xl bg-white/95 backdrop-blur-2xl border border-black/12 shadow-xl py-1.5 text-stone-900">
                  {windows.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        soundEngine.playTick();
                        setWindows((prev) =>
                          prev.map((item) =>
                            item.id === w.id ? { ...item, enabled: !item.enabled } : item
                          )
                        );
                      }}
                      className="w-full px-3 py-1 flex items-center gap-2 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                    >
                      <span className="w-3.5 flex justify-center">
                        {w.enabled && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="truncate">{w.appName}</span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-black/8" />
                  <button
                    onClick={() => {
                      soundEngine.playTick();
                      setWindows((prev) => prev.map((w) => ({ ...w, enabled: true })));
                    }}
                    className="w-full px-3 py-1 pl-8 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                  >
                    Turn On for All Apps
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playTick();
                      setWindows((prev) => prev.map((w) => ({ ...w, enabled: false })));
                    }}
                    className="w-full px-3 py-1 pl-8 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                  >
                    Turn Off for All Apps
                  </button>
                </div>
              )}
            </div>

            {/* Style Submenu Trigger */}
            <div
              onMouseEnter={() => setActiveSubmenu('style')}
              className="relative"
            >
              <button
                onClick={() => setActiveSubmenu(activeSubmenu === 'style' ? null : 'style')}
                className="w-full px-3 py-1 flex items-center justify-between hover:bg-blue-600 hover:text-white text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3.5" />
                  <span>Style</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeSubmenu === 'style' && (
                <div className="absolute right-full top-0 mr-1 w-56 rounded-xl bg-white/95 backdrop-blur-2xl border border-black/12 shadow-xl py-1.5 text-stone-900">
                  <button
                    onClick={() => {
                      soundEngine.playTick();
                      setStyle('organic');
                    }}
                    className="w-full px-3 py-1 flex items-center gap-2 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                  >
                    <span className="w-3.5 flex justify-center">
                      {style === 'organic' && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span>Organic Procedural</span>
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playTick();
                      setStyle('pixel');
                    }}
                    className="w-full px-3 py-1 flex items-center gap-2 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                  >
                    <span className="w-3.5 flex justify-center">
                      {style === 'pixel' && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span>8-Bit Pixel Art</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cobweb Delay Submenu */}
            <div
              onMouseEnter={() => setActiveSubmenu('delay')}
              className="relative"
            >
              <button
                onClick={() => setActiveSubmenu(activeSubmenu === 'delay' ? null : 'delay')}
                className="w-full px-3 py-1 flex items-center justify-between hover:bg-blue-600 hover:text-white text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3.5" />
                  <span>Cobweb Delay</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeSubmenu === 'delay' && (
                <div className="absolute right-full top-0 mr-1 w-48 rounded-xl bg-white/95 backdrop-blur-2xl border border-black/12 shadow-xl py-1.5 text-stone-900">
                  {[
                    { label: '30 Minutes Unfocused', val: 1800 },
                    { label: '2 Hours Unfocused', val: 7200 },
                    { label: '4 Hours Unfocused', val: 14400 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        soundEngine.playTick();
                        setCobwebDelaySec(opt.val);
                      }}
                      className="w-full px-3 py-1 flex items-center gap-2 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
                    >
                      <span className="w-3.5 flex justify-center">
                        {cobwebDelaySec === opt.val && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="my-1 border-t border-black/8" />

            <button
              onClick={() => {
                handleTimeWarp2h();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1 pl-8 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
            >
              Simulate +2h Unfocused
            </button>
            <button
              onClick={() => {
                handleBrushAll();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1 pl-8 hover:bg-blue-600 hover:text-white text-left cursor-pointer"
            >
              Brush All Cobwebs Now
            </button>
          </div>
        )}

        {/* Overlapping macOS Windows */}
        {windows.map((w) => {
          const phys = physicalMap[w.id];
          const isFocused = focusedId === w.id;
          const isDark = w.id === 'spotify' || w.id === 'docker';
          const isBrushing = Date.now() < w.brushingUntil;

          return (
            <div
              key={w.id}
              onMouseDown={() => handleFocus(w.id)}
              style={{
                position: 'absolute',
                left: w.x,
                top: w.y,
                width: w.w,
                height: w.h,
                zIndex: w.z - minZ + 1,
              }}
              className={
                phys.heatIntensity > 0.2
                  ? 'animate-heat-aura'
                  : phys.frostIntensity > 0.22
                  ? 'animate-frost-aura'
                  : ''
              }
            >
              {/* Diegetic Physical Border & Particle Canvas */}
              <WindowAuraCanvas
                width={w.w}
                height={w.h}
                cobwebIntensity={phys.cobwebIntensity}
                heatIntensity={phys.heatIntensity}
                frostIntensity={phys.frostIntensity}
                hasSpider={phys.hasSpider}
                renderStyle={style}
                thickness="medium"
                brushingUntil={w.brushingUntil}
                brushedWebAmount={w.brushedAmount}
                seedOffset={w.z * 1.7}
              />

              {/* Window Chrome */}
              <div
                className={`relative w-full h-full rounded-xl overflow-hidden flex flex-col border transition-shadow ${
                  phys.heatIntensity > 0.2
                    ? 'border-orange-500/80 shadow-[0_14px_38px_rgba(234,88,12,0.35)]'
                    : phys.frostIntensity > 0.22
                    ? 'border-sky-200/90 shadow-[0_14px_34px_rgba(56,189,248,0.28)]'
                    : isFocused
                    ? 'border-black/20 shadow-[0_20px_50px_rgba(15,23,42,0.26)]'
                    : 'border-black/15 shadow-[0_10px_26px_rgba(15,23,42,0.16)]'
                }`}
              >
                {/* Inner Frost Rim */}
                {phys.frostIntensity > 0.08 && (
                  <div
                    style={{
                      opacity: phys.frostIntensity * 0.62,
                      boxShadow: 'inset 0 0 22px rgba(186, 230, 253, 0.92), inset 0 0 6px #fff',
                    }}
                    className="pointer-events-none absolute inset-0 z-20 rounded-xl"
                  />
                )}

                {/* Brush Sweep Visual */}
                {isBrushing && (
                  <div className="pointer-events-none absolute inset-0 z-30">
                    <div className="animate-brush-sweep inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 shadow text-[11px] font-semibold">
                      <Brush className="w-3.5 h-3.5 text-amber-700" />
                      <span>Brushed!</span>
                    </div>
                  </div>
                )}

                {/* Draggable macOS Titlebar */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = {
                      id: w.id,
                      sx: e.clientX,
                      sy: e.clientY,
                      ox: w.x,
                      oy: w.y,
                    };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragRef.current || dragRef.current.id !== w.id || e.buttons === 0)
                      return;
                    const maxW = layerRef.current ? layerRef.current.clientWidth - w.w - 12 : 420;
                    const maxH = layerRef.current ? layerRef.current.clientHeight - w.h - 12 : 240;
                    const nx = Math.max(12, Math.min(maxW, dragRef.current.ox + (e.clientX - dragRef.current.sx)));
                    const ny = Math.max(34, Math.min(maxH, dragRef.current.oy + (e.clientY - dragRef.current.sy)));
                    setWindows((prev) =>
                      prev.map((item) => (item.id === w.id ? { ...item, x: nx, y: ny } : item))
                    );
                  }}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={`h-8 px-2.5 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing touch-none border-b ${
                    isDark
                      ? 'bg-zinc-900/95 text-zinc-100 border-white/10'
                      : 'bg-stone-100/95 text-stone-800 border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                    </div>
                    <span
                      className={`text-[11px] font-semibold truncate ${
                        style === 'pixel' ? 'font-pixel text-[9px]' : ''
                      }`}
                    >
                      {w.title}
                    </span>
                  </div>

                  {/* Diegetic State Badge */}
                  <div className="shrink-0 ml-1.5">
                    {phys.primaryState === 'overheating' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono-telemetry font-bold bg-gradient-to-r from-red-600 to-orange-500 text-white">
                        <Flame className="w-2.5 h-2.5 fill-yellow-200" />
                        {Math.round(w.cpu)}% · {w.ramGb}G
                      </span>
                    )}
                    {phys.primaryState === 'cobwebbed' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono-telemetry font-semibold bg-zinc-800 text-amber-200 border border-zinc-600">
                        <Bug className="w-2.5 h-2.5" />
                        {formatDuration(w.unfocusedSec)}
                      </span>
                    )}
                    {phys.primaryState === 'frosted' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono-telemetry font-semibold bg-sky-100 text-sky-900 border border-sky-300">
                        <Snowflake className="w-2.5 h-2.5 text-sky-600" />
                        Idle
                      </span>
                    )}
                    {(phys.primaryState === 'active' || phys.primaryState === 'idle') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono-telemetry opacity-70">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                        {Math.round(w.cpu)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Window Content */}
                <div className="flex-1 min-h-0 overflow-hidden text-[11px]">
                  {w.id === 'chrome' && (
                    <div className="h-full bg-white text-slate-800 p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                          Heavy Renderers
                        </span>
                        {tabs.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTab(tabs[0].id);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium cursor-pointer"
                          >
                            Close Top Tab
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReopenTabs();
                            }}
                            className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium cursor-pointer"
                          >
                            Reopen Heavy Tabs
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 my-auto">
                        {tabs.length === 0 ? (
                          <div className="text-center py-4 text-slate-400">
                            All heavy tabs closed — cast-iron frame cooled down.
                          </div>
                        ) : (
                          tabs.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-200/80"
                            >
                              <span className="truncate font-medium pr-2">{t.title}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono-telemetry text-[10px] text-orange-700 font-semibold">
                                  {t.cpu}%
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseTab(t.id);
                                  }}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono-telemetry flex justify-between">
                        <span>
                          {phys.heatIntensity > 0.2
                            ? '🔥 Cast-iron edges glowing'
                            : '✓ Thermal load normal'}
                        </span>
                        <span>
                          {Math.round(w.cpu)}% CPU · {w.ramGb} GB
                        </span>
                      </div>
                    </div>
                  )}

                  {w.id === 'notion' && (
                    <div className="h-full bg-[#FFFEFC] text-stone-800 p-3 flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-700" />
                          <span>Q3 Architecture Notes</span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                          {phys.cobwebIntensity > 0.1
                            ? `Sitting unfocused for ${formatDuration(
                                w.unfocusedSec
                              )}. Click anywhere on this window to brush the cobwebs & spider away!`
                            : 'Freshly brushed! Leave unfocused > 2 hours for cobwebs to return.'}
                        </p>
                      </div>

                      <div className="space-y-1 text-[11px] text-stone-600 bg-stone-100/80 p-2 rounded-lg border border-stone-200/70">
                        <div>• AXUIElement focus listener active</div>
                        <div>• SkyLight click-through overlay window</div>
                      </div>
                    </div>
                  )}

                  {w.id === 'spotify' && (
                    <div className="h-full bg-gradient-to-b from-slate-900 to-black text-white p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-300 to-blue-700 flex items-center justify-center">
                            <Music className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs">Subzero Lo-Fi</div>
                            <div className="text-[10px] text-zinc-400">
                              {spotifyPlaying ? 'Playing — frost melted' : 'Paused & idle — frosted edges'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = !spotifyPlaying;
                            setSpotifyPlaying(next);
                            if (next) soundEngine.playTick();
                            else soundEngine.playFrostChime();
                            setWindows((prev) =>
                              prev.map((item) =>
                                item.id === 'spotify'
                                  ? {
                                      ...item,
                                      cpu: next ? 12 : 0.2,
                                      frostLevel: next ? 0 : 0.9,
                                      idleSec: next ? 0 : 3200,
                                    }
                                  : item
                              )
                            );
                          }}
                          className="px-2.5 py-1 rounded-full bg-white text-black font-semibold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          {spotifyPlaying ? (
                            <>
                              <Pause className="w-3 h-3 fill-black" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-black" /> Play
                            </>
                          )}
                        </button>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            spotifyPlaying ? 'w-3/4 bg-emerald-400' : 'w-1/3 bg-sky-300'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {w.id === 'docker' && (
                    <div className="h-full bg-slate-950 text-slate-100 p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Container className="w-3.5 h-3.5 text-sky-400" />
                          Containers
                        </span>
                        <span className="font-mono-telemetry text-[10px] text-slate-400">
                          {Math.round(w.cpu)}% CPU · {w.ramGb} GB
                        </span>
                      </div>

                      <div className="space-y-1">
                        {containers.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800"
                          >
                            <span className="truncate font-mono-telemetry text-[10px]">
                              {c.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleContainer(c.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                                c.running
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {c.running ? 'Stop' : 'Start'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Interactive Controls Bar right beneath the macOS stage */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-stone-200/90 text-xs shadow-2xs">
        <span className="text-stone-600 font-medium">{statusBanner}</span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              soundEngine.playTick();
              setStyle((s) => (s === 'organic' ? 'pixel' : 'organic'));
            }}
            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium text-[11px] transition cursor-pointer"
          >
            Style: {style === 'organic' ? 'Organic Silk' : '8-Bit Pixel'}
          </button>

          <button
            onClick={handleTimeWarp2h}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200/80 text-amber-950 font-semibold text-[11px] transition cursor-pointer"
          >
            <FastForward className="w-3 h-3" />
            +2h Unfocused
          </button>

          <button
            onClick={handleBrushAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-[11px] transition cursor-pointer"
          >
            <Brush className="w-3 h-3" />
            Brush All
          </button>
        </div>
      </div>
    </div>
  );
};
