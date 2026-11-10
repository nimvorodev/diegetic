export type AppId = 'chrome' | 'notion' | 'spotify' | 'docker';

export type RenderStyle = 'organic' | 'pixel';
export type BorderThickness = 'thin' | 'medium' | 'thick';
export type SnarkLevel = 'gentle' | 'passive' | 'merciless';
export type WallpaperTheme = 'linen' | 'slate' | 'midnight';

export interface ChromeTab {
  id: string;
  title: string;
  domain: string;
  cpu: number;
  ramMb: number;
  heavy?: boolean;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  running: boolean;
  cpu: number;
  ramGb: number;
}

export interface NotionTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface DesktopWindowData {
  id: AppId;
  appName: string;
  windowTitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  borderEnabled: boolean;

  // Live telemetry & timing
  cpu: number; // 0 - 100
  ramGb: number; // e.g. 0.2 - 12.0
  unfocusedSeconds: number; // seconds sitting unfocused in background
  idleSeconds: number; // seconds sitting low-CPU / inactive
  frostLevel: number; // 0.0 - 1.0 (accumulates when idle & low CPU, thaws on focus/activity)

  // Brush-away animation state
  brushingUntil: number; // timestamp ms when brush animation ends
  brushedWebAmount: number; // intensity of cobwebs that were just brushed away
}

export interface ToastMessage {
  id: string;
  appId: AppId;
  kind: 'cobweb' | 'brush' | 'heat' | 'frost' | 'info';
  title: string;
  body: string;
  timestamp: number;
}

export interface ComputedPhysicalState {
  cobwebIntensity: number; // 0 - 1 (forms after > cobwebThresholdSeconds unfocused)
  heatIntensity: number; // 0 - 1 (glowing red-hot cast iron when high CPU/RAM)
  frostIntensity: number; // 0 - 1 (frosts over at edges when idle)
  primaryState: 'overheating' | 'cobwebbed' | 'frosted' | 'active' | 'idle';
  hasSpider: boolean;
}

// Combined thermal load: CPU% * 0.78 + (RAM_GB * 4.5), igniting at >= 54
export const HEAT_IGNITION_LOAD = 54;
export function effectiveLoad(cpu: number, ramGb: number): number {
  return cpu * 0.78 + ramGb * 4.5;
}

export function computePhysicalState(
  win: DesktopWindowData,
  isFocused: boolean,
  cobwebThresholdSeconds: number,
  masterEnabled: boolean
): ComputedPhysicalState {
  if (!masterEnabled || !win.borderEnabled) {
    return {
      cobwebIntensity: 0,
      heatIntensity: 0,
      frostIntensity: 0,
      primaryState: isFocused ? 'active' : 'idle',
      hasSpider: false,
    };
  }

  // 1. Heat calculation: High CPU or high RAM causes red-hot cast iron
  const load = effectiveLoad(win.cpu, win.ramGb);
  let heatIntensity = 0;
  if (load >= HEAT_IGNITION_LOAD) {
    heatIntensity = Math.min(1, (load - HEAT_IGNITION_LOAD) / 42);
  }

  // 2. Cobwebs calculation: Forms when unfocused > cobwebThresholdSeconds (default 2 hours = 7200s)
  let cobwebIntensity = 0;
  if (!isFocused && win.unfocusedSeconds > cobwebThresholdSeconds) {
    const overtime = win.unfocusedSeconds - cobwebThresholdSeconds;
    // Ramps from 0.18 right at 2h00m up to 1.0 at +3 hours past threshold (5h total)
    cobwebIntensity = Math.min(1, 0.18 + (overtime / (3 * 3600)) * 0.82);
  }

  // 3. Frost calculation: Idle apps slowly frost over at the edges (suppressed if hot!)
  const frostIntensity = heatIntensity > 0.15 ? 0 : Math.min(1, Math.max(0, win.frostLevel));

  // Determine primary state badge
  let primaryState: ComputedPhysicalState['primaryState'] = isFocused ? 'active' : 'idle';
  if (heatIntensity >= 0.2) {
    primaryState = 'overheating';
  } else if (cobwebIntensity >= 0.18) {
    primaryState = 'cobwebbed';
  } else if (frostIntensity >= 0.22) {
    primaryState = 'frosted';
  }

  const hasSpider = cobwebIntensity >= 0.22;

  return {
    cobwebIntensity,
    heatIntensity,
    frostIntensity,
    primaryState,
    hasSpider,
  };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${secs}s`;
}
