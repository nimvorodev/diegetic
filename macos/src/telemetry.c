#include "telemetry.h"
#include <libproc.h>
#include <mach/mach_time.h>
#include <math.h>
#include <pthread.h>
#include <string.h>
#include <sys/proc_info.h>

bool g_diegetic_enabled = true;
enum diegetic_style g_diegetic_style = DIEGETIC_STYLE_ORGANIC;
float g_cobweb_after_seconds = 7200.0f; // 2 hours
float g_border_width = 14.0f;
enum diegetic_test_override g_test_override = TEST_OVERRIDE_NONE;

#define MAX_CACHED_PIDS 512

struct pid_sample {
  pid_t pid;
  uint64_t last_cpu_ns;
  uint64_t last_wall_ns;
  float cpu_pct;
  float ram_gb;
};

static struct pid_sample g_pid_cache[MAX_CACHED_PIDS];
static int g_pid_cache_count = 0;
static mach_timebase_info_data_t g_timebase = {1, 1};
static pthread_mutex_t g_pid_lock = PTHREAD_MUTEX_INITIALIZER;

void telemetry_init(void) {
  mach_timebase_info(&g_timebase);
}

static uint64_t mach_to_ns(uint64_t mach_ticks) {
  return (mach_ticks * g_timebase.numer) / g_timebase.denom;
}

static void query_pid_metrics(pid_t pid, float *out_cpu, float *out_ram_gb) {
  if (pid <= 0) {
    *out_cpu = 0.0f;
    *out_ram_gb = 0.0f;
    return;
  }

  struct proc_taskinfo pti;
  int ret = proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &pti, sizeof(pti));
  if (ret <= 0) {
    *out_cpu = 0.0f;
    *out_ram_gb = 0.0f;
    return;
  }

  uint64_t now_ns = clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
  uint64_t cpu_ns = mach_to_ns(pti.pti_total_user + pti.pti_total_system);
  float ram_gb = (float)pti.pti_resident_size / (1024.0f * 1024.0f * 1024.0f);

  pthread_mutex_lock(&g_pid_lock);
  struct pid_sample *slot = NULL;
  for (int i = 0; i < g_pid_cache_count; i++) {
    if (g_pid_cache[i].pid == pid) {
      slot = &g_pid_cache[i];
      break;
    }
  }
  if (!slot && g_pid_cache_count < MAX_CACHED_PIDS) {
    slot = &g_pid_cache[g_pid_cache_count++];
    memset(slot, 0, sizeof(*slot));
    slot->pid = pid;
    slot->last_cpu_ns = cpu_ns;
    slot->last_wall_ns = now_ns;
    slot->cpu_pct = 0.0f;
    slot->ram_gb = ram_gb;
  }

  if (slot) {
    uint64_t dt_wall = now_ns > slot->last_wall_ns ? (now_ns - slot->last_wall_ns) : 0;
    if (dt_wall >= 400000000ULL) { // update at most every 0.4s
      uint64_t dt_cpu = cpu_ns >= slot->last_cpu_ns ? (cpu_ns - slot->last_cpu_ns) : 0;
      float raw_pct = ((float)dt_cpu / (float)dt_wall) * 100.0f;
      if (raw_pct > 400.0f)
        raw_pct = 400.0f;
      // Smooth exponential moving average
      slot->cpu_pct = slot->cpu_pct * 0.45f + raw_pct * 0.55f;
      slot->last_cpu_ns = cpu_ns;
      slot->last_wall_ns = now_ns;
    }
    slot->ram_gb = ram_gb;
    *out_cpu = slot->cpu_pct;
    *out_ram_gb = slot->ram_gb;
  } else {
    *out_cpu = 0.0f;
    *out_ram_gb = ram_gb;
  }
  pthread_mutex_unlock(&g_pid_lock);
}

void telemetry_sample_processes(void) {
  pthread_mutex_lock(&g_pid_lock);
  for (int i = 0; i < g_pid_cache_count; i++) {
    pid_t pid = g_pid_cache[i].pid;
    struct proc_taskinfo pti;
    if (proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &pti, sizeof(pti)) <= 0) {
      g_pid_cache[i] = g_pid_cache[--g_pid_cache_count];
      i--;
    }
  }
  pthread_mutex_unlock(&g_pid_lock);
}

void telemetry_trigger_brush(struct window_telemetry *wt) {
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  float amount = wt->cobweb_intensity > 0.15f ? wt->cobweb_intensity : 0.75f;
  wt->brushed_web_amount = amount;
  wt->brush_until = now + 0.58;
  wt->cobweb_intensity = 0.0f;
  wt->unfocused_since = now;
}

void telemetry_on_focus_change(struct window_telemetry *wt, bool now_focused) {
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  if (now_focused && !wt->focused) {
    if (wt->cobweb_intensity > 0.05f) {
      telemetry_trigger_brush(wt);
    }
    wt->unfocused_since = now;
    wt->idle_since = now;
  } else if (!now_focused && wt->focused) {
    wt->unfocused_since = now;
    wt->idle_since = now;
  }
  wt->focused = now_focused;
}

void telemetry_update_window(struct window_telemetry *wt, pid_t pid,
                             CFAbsoluteTime now) {
  if (!g_diegetic_enabled) {
    wt->cobweb_intensity = 0.0f;
    wt->heat_intensity = 0.0f;
    wt->frost_intensity = 0.0f;
    return;
  }

  if (wt->unfocused_since <= 0.0)
    wt->unfocused_since = now;
  if (wt->idle_since <= 0.0)
    wt->idle_since = now;

  query_pid_metrics(pid, &wt->cpu_pct, &wt->ram_gb);

  if (g_test_override == TEST_OVERRIDE_COBWEBS) {
    wt->cobweb_intensity = wt->focused ? 0.0f : 0.88f;
    wt->heat_intensity = 0.0f;
    wt->frost_intensity = 0.0f;
    return;
  }
  if (g_test_override == TEST_OVERRIDE_HEAT) {
    wt->cobweb_intensity = 0.0f;
    wt->heat_intensity = 0.92f;
    wt->frost_intensity = 0.0f;
    return;
  }
  if (g_test_override == TEST_OVERRIDE_FROST) {
    wt->cobweb_intensity = 0.0f;
    wt->heat_intensity = 0.0f;
    wt->frost_intensity = 0.88f;
    return;
  }

  // 1. Cast-iron heat from CPU% + RAM footprint
  float effective_load = wt->cpu_pct * 0.78f + wt->ram_gb * 4.5f;
  float target_heat = 0.0f;
  if (effective_load >= 54.0f) {
    target_heat = fminf(1.0f, (effective_load - 54.0f) / 42.0f);
  }
  wt->heat_intensity = wt->heat_intensity * 0.80f + target_heat * 0.20f;
  if (wt->heat_intensity < 0.01f)
    wt->heat_intensity = 0.0f;

  // 2. Cobwebs if sitting unfocused > cobweb_after_seconds (default 2 hours)
  if (wt->focused) {
    wt->unfocused_since = now;
    wt->cobweb_intensity = 0.0f;
  } else {
    double unfocused_sec = now - wt->unfocused_since;
    if (unfocused_sec > g_cobweb_after_seconds) {
      double overtime = unfocused_sec - g_cobweb_after_seconds;
      wt->cobweb_intensity =
          (float)fmin(1.0, 0.20 + (overtime / (3.0 * 3600.0)) * 0.80);
    } else {
      wt->cobweb_intensity = 0.0f;
    }
  }

  // 3. Frost if idle & low CPU (suppressed if hot or focused)
  if (wt->heat_intensity > 0.15f || wt->focused || wt->cpu_pct >= 12.0f) {
    wt->idle_since = now;
    wt->frost_intensity = fmaxf(0.0f, wt->frost_intensity - 0.06f);
  } else {
    double idle_sec = now - wt->idle_since;
    // Begins frosting after 10 minutes idle, full rime by 60 minutes
    float target_frost =
        idle_sec > 600.0 ? (float)fmin(0.95, (idle_sec - 600.0) / 3000.0) : 0.0f;
    wt->frost_intensity = wt->frost_intensity * 0.92f + target_frost * 0.08f;
  }
}

bool telemetry_needs_animation(const struct window_telemetry *wt,
                               CFAbsoluteTime now) {
  if (!g_diegetic_enabled)
    return false;
  if (now < wt->brush_until)
    return true;
  if (wt->heat_intensity > 0.02f)
    return true;
  if (wt->cobweb_intensity > 0.02f)
    return true;
  if (wt->frost_intensity > 0.02f)
    return true;
  return false;
}
