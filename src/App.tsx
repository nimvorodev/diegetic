import { useState } from 'react';
import {
  Download,
  Terminal,
  Copy,
  Check,
  Bug,
  Flame,
  Snowflake,
  Cpu,
  Layers,
  ShieldCheck,
  Code2,
  FileCode,
  Sparkles,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { MacosDesktopPreview } from './components/MacosDesktopPreview';
import {
  MACOS_FILES,
  MacosSourceFile,
  buildSelfExtractingInstallerScript,
} from './macosBundle';

export function App() {
  const [installTab, setInstallTab] = useState<'installer' | 'source' | 'agent'>('installer');
  const [selectedFile, setSelectedFile] = useState<MacosSourceFile>(MACOS_FILES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadedInstaller, setDownloadedInstaller] = useState(false);

  const copyText = (id: string, text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
  };

  const handleDownloadInstaller = () => {
    const script = buildSelfExtractingInstallerScript();
    const blob = new Blob([script], { type: 'text/x-shellscript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'install-diegetic.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Deferred: Safari/Firefox can abort the blob fetch if revoked immediately
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setDownloadedInstaller(true);
  };

  const handleDownloadSingleFile = (file: MacosSourceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Deferred: Safari/Firefox can abort the blob fetch if revoked immediately
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const buildFromSourceCmd = `cd macos
./scripts/build-app.sh
python3 scripts/install-local.py`;

  const runDownloadedCmd = `bash ~/Downloads/install-diegetic.sh`;

  const agentPrompt = `Build and install the native macOS menu-bar app in the ./macos directory of this project:
cd macos && ./scripts/build-app.sh && python3 scripts/install-local.py
Then open ~/Applications/Diegetic.app and guide me through enabling Accessibility permission in System Settings.`;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900">
      {/* Subtle Top Bar */}
      <nav className="sticky top-0 z-30 bg-[#FAF8F5]/85 backdrop-blur-xl border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-300 flex items-center justify-center shadow-2xs">
              <Bug className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-stone-900">
              Diegetic
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono-telemetry px-2 py-0.5 rounded-full bg-stone-200/75 text-stone-700">
              macOS 13+ · Native C / Obj-C
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#source-explorer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/60 transition"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Source (macos/)</span>
            </a>
            <button
              onClick={handleDownloadInstaller}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get for macOS</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-10 space-y-14">
        {/* Hero Section */}
        <section className="space-y-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-300/80 text-amber-950 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>
                Built with SkyLight, CoreGraphics &amp; AppKit
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-950 leading-[1.15]">
              Give your macOS windows physical states based on how you use your Mac.
            </h1>

            <p className="text-base text-stone-600 leading-relaxed">
              A lightweight, native macOS menu-bar daemon (<code className="font-mono-telemetry text-xs bg-stone-200/70 px-1.5 py-0.5 rounded">LSUIElement</code>) that watches your real macOS windows via <code className="font-mono-telemetry text-xs bg-stone-200/70 px-1.5 py-0.5 rounded">SkyLight</code>, <code className="font-mono-telemetry text-xs bg-stone-200/70 px-1.5 py-0.5 rounded">AXUIElement</code>, and <code className="font-mono-telemetry text-xs bg-stone-200/70 px-1.5 py-0.5 rounded">proc_pidinfo</code>—growing corner cobwebs on neglected windows, glowing red-hot like cast iron on CPU/RAM hogs, and frosting over idle apps.
            </p>
          </div>

          {/* 3 Core Diegetic Mechanics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <span className="w-7 h-7 rounded-lg bg-zinc-900 text-amber-300 flex items-center justify-center">
                  <Bug className="w-4 h-4" />
                </span>
                <span>Cobwebs (&gt; 2h Unfocused)</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Leave any macOS window unfocused in the background for over 2 hours and procedural (or 8-bit pixel) cobwebs form in its corners with a tiny dangling spider. Focusing the window brushes them away.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <span className="w-7 h-7 rounded-lg bg-orange-600 text-yellow-100 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </span>
                <span>Cast-Iron Heat (CPU / RAM)</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                When Chrome, Docker, or a runaway build burns heavy CPU or physical RAM, its window frame edges glow red-hot like forged cast iron with rising heat waves.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <span className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center">
                  <Snowflake className="w-4 h-4" />
                </span>
                <span>Frosted Edges (Idle Apps)</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Low-CPU apps left sitting idle slowly frost over along their window edges with icy rime and dendritic crystals until you wake them up.
              </p>
            </div>
          </div>

          {/* Interactive Live macOS Desktop & Menu-Bar Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Interactive macOS Menu-Bar &amp; Window Preview
              </span>
              <span>Click cobwebbed windows to brush · Click 🕸 Cobwebs in the top-right menu bar</span>
            </div>
            <MacosDesktopPreview />
          </div>
        </section>

        {/* Get It on Your Mac Section */}
        <section id="get-it" className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-stone-950">
              Install on Your Mac
            </h2>
            <p className="text-sm text-stone-600">
              Builds a native Universal binary (<code className="font-mono-telemetry text-xs">arm64 + x86_64</code>) for macOS 13 Ventura or later using Apple’s Command Line Tools—no Xcode IDE required.
            </p>
          </div>

          {/* Method Tabs */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
            <div className="flex border-b border-stone-200 bg-stone-50/80 px-2 pt-2 gap-1">
              {[
                { id: 'installer', label: '1. One-Click Mac Installer (.sh)' },
                { id: 'source', label: '2. Build from macos/ Folder' },
                { id: 'agent', label: '3. Ask Your Coding Agent' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInstallTab(t.id as typeof installTab)}
                  className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold transition cursor-pointer ${
                    installTab === t.id
                      ? 'bg-white text-stone-950 border-t border-x border-stone-200 -mb-px'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {installTab === 'installer' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-stone-900">
                        Download Self-Extracting Native macOS Installer
                      </h3>
                      <p className="text-xs text-stone-600">
                        Bundles all 23 C, Objective-C, SkyLight, and build scripts into a single script that compiles <code className="font-mono-telemetry">Diegetic.app</code>, signs it, and launches it into your menu bar.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadInstaller}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download install-diegetic.sh</span>
                    </button>
                  </div>

                  {downloadedInstaller && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Downloaded <strong>install-diegetic.sh</strong>! Run the command below in your macOS Terminal:
                      </span>
                    </div>
                  )}

                  <div className="relative rounded-xl bg-zinc-950 text-zinc-100 p-3.5 font-mono-telemetry text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-x-auto">
                      <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                      <code>{runDownloadedCmd}</code>
                    </div>
                    <button
                      onClick={() => copyText('dl-cmd', runDownloadedCmd)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-200 shrink-0 transition cursor-pointer"
                    >
                      {copiedId === 'dl-cmd' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {installTab === 'source' && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-600">
                    The full native macOS project lives in the <code className="font-mono-telemetry bg-stone-100 px-1.5 py-0.5 rounded">macos/</code> directory of this repository. Build <code className="font-mono-telemetry">outputs/Diegetic.app</code> and install it into <code className="font-mono-telemetry">~/Applications</code>:
                  </p>
                  <div className="relative rounded-xl bg-zinc-950 text-zinc-100 p-4 font-mono-telemetry text-xs">
                    <pre className="overflow-x-auto leading-relaxed">{buildFromSourceCmd}</pre>
                    <button
                      onClick={() => copyText('src-cmd', buildFromSourceCmd)}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-200 transition cursor-pointer"
                    >
                      {copiedId === 'src-cmd' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {installTab === 'agent' && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-600">
                    You can hand this repository directly to your local macOS coding agent:
                  </p>
                  <div className="relative rounded-xl bg-zinc-950 text-zinc-100 p-4 font-mono-telemetry text-xs">
                    <pre className="whitespace-pre-wrap leading-relaxed pr-20">{agentPrompt}</pre>
                    <button
                      onClick={() => copyText('agent-cmd', agentPrompt)}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-200 transition cursor-pointer"
                    >
                      {copiedId === 'agent-cmd' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* How It Integrates Into macOS */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-stone-950">
              How It Integrates Into macOS
            </h2>
            <p className="text-sm text-stone-600">
              Built directly on the macOS WindowServer architecture, extended with live kernel process telemetry and focus timers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Click-Through SkyLight Overlays</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                <code className="font-mono-telemetry text-[11px] bg-stone-100 px-1 rounded">src/border.c</code> creates transparent WindowServer overlay windows via <code className="font-mono-telemetry text-[11px]">SLSNewWindowWithOpaqueShapeAndContext</code> with an empty hit-test region (<code className="font-mono-telemetry text-[11px]">CGRegionCreateEmptyRegion</code>) ordered above each target <code className="font-mono-telemetry text-[11px]">CGWindowID</code>, so mouse clicks pass straight through into your apps.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>AXUIElement Focus &amp; Brush-Away</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                <code className="font-mono-telemetry text-[11px] bg-stone-100 px-1 rounded">src/misc/ax.h</code> and <code className="font-mono-telemetry text-[11px] bg-stone-100 px-1 rounded">src/windows.c</code> listen to <code className="font-mono-telemetry text-[11px]">EVENT_FRONT_CHANGE</code> and <code className="font-mono-telemetry text-[11px]">kAXFocusedWindowAttribute</code>. When a window unfocused for &gt;2h gains focus, <code className="font-mono-telemetry text-[11px]">telemetry_on_focus_change</code> triggers a 580ms silk particle brush-away animation.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <Cpu className="w-4 h-4 text-orange-600" />
                <span>Kernel CPU &amp; RAM Sampling</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                <code className="font-mono-telemetry text-[11px] bg-stone-100 px-1 rounded">src/telemetry.c</code> queries <code className="font-mono-telemetry text-[11px]">proc_pidinfo(pid, PROC_PIDTASKINFO, ...)</code> to compute real-time CPU% and physical RAM (<code className="font-mono-telemetry text-[11px]">pti_resident_size</code>), igniting red-hot cast-iron borders on heavy apps and frosting idle ones.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-stone-900">
                <FolderOpen className="w-4 h-4 text-sky-600" />
                <span>Menu-Bar Extra &amp; Per-App Toggles</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                <code className="font-mono-telemetry text-[11px] bg-stone-100 px-1 rounded">src/menubar.m</code> builds a native <code className="font-mono-telemetry text-[11px]">NSStatusItem</code> menu with an <strong>Apps</strong> submenu listing every open macOS app’s real icon and checkmark, Organic vs. 8-Bit Pixel Art styles, cobweb delay presets, and live preview modes.
              </p>
            </div>
          </div>
        </section>

        {/* Native macOS Source Explorer */}
        <section id="source-explorer" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-stone-950">
                Native macOS Source Code (<code className="font-mono-telemetry text-xl">macos/</code>)
              </h2>
              <p className="text-sm text-stone-600">
                Inspect every C, Objective-C, Makefile, Info.plist, and build script included in this project.
              </p>
            </div>
            <span className="text-xs font-mono-telemetry text-stone-500">
              {MACOS_FILES.length} native files · Universal arm64 + x86_64
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
            {/* File Tree Sidebar */}
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900/60 p-2.5 max-h-[260px] md:max-h-[540px] overflow-y-auto window-scroll space-y-0.5">
              {MACOS_FILES.map((file) => {
                const active = selectedFile.path === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-mono-telemetry text-[11px] transition cursor-pointer ${
                      active
                        ? 'bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/30'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{file.path}</span>
                  </button>
                );
              })}
            </div>

            {/* Code Viewer */}
            <div className="md:col-span-8 flex flex-col min-w-0 max-h-[540px]">
              <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono-telemetry text-xs font-bold text-white truncate">
                    macos/{selectedFile.path}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {selectedFile.summary}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDownloadSingleFile(selectedFile)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-[11px] text-zinc-200 transition cursor-pointer"
                    title="Download file"
                  >
                    <Download className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => copyText(selectedFile.path, selectedFile.content)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-100 transition cursor-pointer"
                  >
                    {copiedId === selectedFile.path ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="flex-1 p-4 overflow-auto window-scroll font-mono-telemetry text-[11.5px] leading-relaxed text-zinc-200 select-text">
                <code>{selectedFile.content}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Permissions & Taking It Off */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-200">
          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 space-y-2">
            <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>macOS Permissions &amp; Gatekeeper</span>
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              • <strong>Accessibility:</strong> Enable <em>Diegetic</em> in <strong>System Settings → Privacy &amp; Security → Accessibility</strong> so it can follow which window is focused and brush cobwebs off immediately on click.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              • <strong>Ad-hoc local signing:</strong> <code className="font-mono-telemetry text-[11px]">build-app.sh</code> signs the bundle locally with <code className="font-mono-telemetry text-[11px]">codesign --sign -</code>. If macOS prompts on first launch, click <strong>Open Anyway</strong> in <strong>Privacy &amp; Security</strong>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/90 space-y-2">
            <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-stone-600" />
              <span>Taking It Off</span>
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              1. Click the spiderweb icon in your macOS menu bar and select <strong>Quit Diegetic</strong>.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              2. Drag <code className="font-mono-telemetry text-[11px]">~/Applications/Diegetic.app</code> to the Trash and delete <code className="font-mono-telemetry text-[11px]">~/Library/Preferences/local.diegetic.app.plist</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
