#pragma once
#include <CoreFoundation/CoreFoundation.h>
#include <stdbool.h>
#include <stdint.h>
#include <sys/types.h>

enum diegetic_style {
  DIEGETIC_STYLE_ORGANIC = 0,
  DIEGETIC_STYLE_PIXEL = 1,
};

enum diegetic_test_override {
  TEST_OVERRIDE_NONE = 0,
  TEST_OVERRIDE_COBWEBS = 1,
  TEST_OVERRIDE_HEAT = 2,
  TEST_OVERRIDE_FROST = 3,
};

struct window_telemetry {
  bool focused;
  CFAbsoluteTime unfocused_since;
  CFAbsoluteTime idle_since;
  CFAbsoluteTime brush_until;
  float brushed_web_amount;

  float cpu_pct;
  float ram_gb;

  float cobweb_intensity; // 0..1 (>2h unfocused)
  float heat_intensity;   // 0..1 (high CPU/RAM -> red-hot cast iron)
  float frost_intensity;  // 0..1 (idle -> frosted edges)
};

extern bool g_diegetic_enabled;
extern enum diegetic_style g_diegetic_style;
extern float g_cobweb_after_seconds; // default 7200s (2 hours)
extern float g_border_width;         // default 14.0 pt
extern enum diegetic_test_override g_test_override;

void telemetry_init(void);
void telemetry_sample_processes(void);
void telemetry_on_focus_change(struct window_telemetry *wt, bool now_focused);
void telemetry_trigger_brush(struct window_telemetry *wt);
void telemetry_update_window(struct window_telemetry *wt, pid_t pid,
                             CFAbsoluteTime now);
bool telemetry_needs_animation(const struct window_telemetry *wt,
                               CFAbsoluteTime now);
