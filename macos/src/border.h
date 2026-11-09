#pragma once
#include "diegetic_draw.h"
#include "hashtable.h"
#include "misc/window.h"
#include "telemetry.h"
#include <pthread.h>

#define BORDER_ORDER_ABOVE 1
#define BORDER_ORDER_BELOW -1

struct border {
  pthread_mutex_t mutex;
  int cid;
  bool focused;
  bool needs_redraw;
  bool too_small;
  bool sticky;
  bool metadata_dirty;
  bool geometry_valid;
  bool visible;
  bool resize_suppressed;
  CGSize resize_observed_size;
  CFAbsoluteTime resize_settle_after;
  bool resize_followup_pending;
  uint64_t resize_followup_id;
  uint64_t resize_followup_deadline;

  int level;
  uint64_t sid;
  uint32_t wid;
  uint32_t target_wid;
  pid_t owner_pid;
  char app[64];
  char bundle_id[128];

  float radius;
  CGPoint origin;
  CGRect frame;
  CGRect target_bounds;
  CGRect drawing_bounds;
  CGContextRef context;

  struct window_telemetry telemetry;
};

struct border *border_create(void);
void border_destroy(struct border *border);
void border_update_geometry(struct border *border);
void border_update(struct border *border);
void border_reorder(struct border *border);
void border_hide(struct border *border);
void border_unhide(struct border *border);
