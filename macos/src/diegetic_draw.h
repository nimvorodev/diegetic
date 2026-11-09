#pragma once
#include "telemetry.h"
#include <CoreGraphics/CoreGraphics.h>

// Padding around the target window so heat waves, icicles, and cast-iron rims
// have plenty of headroom without clipping.
#define DIEGETIC_PADDING 48.0f

void diegetic_draw_window(CGContextRef ctx, CGRect canvas_bounds,
                          CGRect target_rect, float corner_radius,
                          const struct window_telemetry *wt,
                          CFAbsoluteTime now, uint32_t wid_seed);
