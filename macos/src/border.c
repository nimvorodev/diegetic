#include "border.h"
#include <math.h>
#include <string.h>

static void border_destroy_window(struct border *border) {
  if (border->context)
    CGContextRelease(border->context);
  if (border->wid)
    SLSReleaseWindow(border->cid, border->wid);
  border->wid = 0;
  border->context = NULL;
}

static bool border_check_too_small(CGRect window_frame) {
  return window_frame.size.width < 60.0f || window_frame.size.height < 60.0f;
}

static bool border_calculate_bounds(struct border *border, CGRect *frame,
                                    const CGRect *observed_bounds) {
  CGRect window_frame = CGRectZero;
  if (observed_bounds)
    window_frame = *observed_bounds;
  else if (SLSGetWindowBounds(border->cid, border->target_wid, &window_frame) !=
           kCGErrorSuccess) {
    border_hide(border);
    return false;
  }

  if (!isfinite(window_frame.origin.x) || !isfinite(window_frame.origin.y) ||
      !isfinite(window_frame.size.width) ||
      !isfinite(window_frame.size.height) || window_frame.size.width <= 0 ||
      window_frame.size.height <= 0) {
    border_hide(border);
    return false;
  }

  border->target_bounds = window_frame;
  border->too_small = border_check_too_small(window_frame);
  if (border->too_small) {
    border_hide(border);
    return false;
  }

  float offset = -g_border_width - DIEGETIC_PADDING;
  *frame = CGRectInset(window_frame, offset, offset);
  border->origin = frame->origin;
  frame->origin = CGPointZero;
  window_frame.origin = (CGPoint){-offset, -offset};
  border->drawing_bounds = window_frame;
  return true;
}

static void border_draw(struct border *border, CGRect frame) {
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  border->needs_redraw = false;

  diegetic_draw_window(border->context, frame, border->drawing_bounds,
                       border->radius, &border->telemetry, now,
                       border->target_wid);
  SLSFlushWindowContentRegion(border->cid, border->wid, NULL);
  SLSWindowThaw(border->cid, border->wid);
}

static void border_create_window(struct border *border, CGRect frame) {
  pthread_mutex_lock(&border->mutex);
  int cid = border->cid;
  border->wid = window_create_overlay(cid, frame, true);
  border->frame = frame;
  border->needs_redraw = true;
  border->context = SLWindowContextCreate(cid, border->wid, NULL);
  if (!border->context) {
    border_destroy_window(border);
  }
  if (!border->sid)
    border->sid = window_space_id(cid, border->target_wid);
  if (border->wid && border->sid)
    window_send_to_space(cid, border->wid, border->sid);
  pthread_mutex_unlock(&border->mutex);
}

static bool border_suppress_live_resize(struct border *border, CGRect bounds) {
  if (!g_diegetic_enabled)
    return false;
  if (!border->resize_suppressed &&
      (!border->visible ||
       CGSizeEqualToSize(bounds.size, border->drawing_bounds.size)))
    return false;

  bool held = CGEventSourceButtonState(kCGEventSourceStateCombinedSessionState,
                                       kCGMouseButtonLeft);
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  if (!border->resize_suppressed || held ||
      !CGSizeEqualToSize(bounds.size, border->resize_observed_size)) {
    border->resize_observed_size = bounds.size;
    border->resize_settle_after = now + 0.06;
  }
  if (!held && now >= border->resize_settle_after) {
    border->resize_suppressed = false;
    return false;
  }
  border->resize_suppressed = true;
  if (border->visible)
    border_hide(border);
  return true;
}

static void border_update_internal(struct border *border,
                                   const CGRect *observed_bounds) {
  if (!g_diegetic_enabled) {
    // Paused: hide instead of drawing — otherwise the last frame stays
    // frozen on screen and later reorders would pop it back in.
    border_hide(border);
    return;
  }
  if (border->resize_suppressed)
    return;
  border->geometry_valid = false;
  int cid = border->cid;
  CGRect frame;
  if (!border_calculate_bounds(border, &frame, observed_bounds))
    return;

  if (border->metadata_dirty) {
    uint64_t tags = window_tags(cid, border->target_wid);
    border->sticky = (tags & WINDOW_TAG_STICKY) != 0;
    border->level = window_level(cid, border->target_wid);
    uint64_t sid = window_space_id(cid, border->target_wid);
    if (sid && sid != border->sid) {
      border->sid = sid;
      if (border->wid)
        window_send_to_space(cid, border->wid, sid);
    }
    border->metadata_dirty = false;
  }

  if (!border->sticky && !is_space_visible(cid, border->sid))
    return;

  bool shown = false;
  SLSWindowIsOrderedIn(cid, border->target_wid, &shown);
  if (!shown) {
    border_hide(border);
    return;
  }

  if (!border->wid) {
    border_create_window(border, frame);
  }
  if (!border->wid || !border->context)
    return;

  // Sticky (all-spaces) targets need the overlay itself tagged sticky,
  // otherwise it stays on one space while the target shows on all of them.
  uint64_t sticky_tag = WINDOW_TAG_STICKY;
  if (border->sticky)
    SLSSetWindowTags(cid, border->wid, &sticky_tag, 64);
  else
    SLSClearWindowTags(cid, border->wid, &sticky_tag, 64);

  if (!CGRectEqualToRect(frame, border->frame))
    border->needs_redraw = true;

  CFTypeRef transaction = SLSTransactionCreate(cid);
  if (!transaction)
    return;

  bool disabled_update = false;
  if (!CGRectEqualToRect(frame, border->frame)) {
    CFTypeRef frame_region = NULL;
    CGSNewRegionWithRect(&frame, &frame_region);
    if (!frame_region) {
      CFRelease(transaction);
      return;
    }
    disabled_update = true;
    SLSDisableUpdate(cid);
    SLSWindowFreezeWithOptions(border->cid, border->wid, NULL);
    CGError shape_err = SLSSetWindowShape(
        border->cid, border->wid, border->origin.x, border->origin.y, frame_region);
    CFRelease(frame_region);
    if (shape_err != kCGErrorSuccess) {
      SLSWindowThaw(border->cid, border->wid);
      SLSReenableUpdate(cid);
      CFRelease(transaction);
      return;
    }
    CGContextRef resized_ctx = SLWindowContextCreate(cid, border->wid, NULL);
    if (!resized_ctx) {
      SLSWindowThaw(border->cid, border->wid);
      SLSReenableUpdate(cid);
      CFRelease(transaction);
      return;
    }
    CGContextRelease(border->context);
    border->context = resized_ctx;
    border->needs_redraw = true;
    border->frame = frame;
  }

  if (border->needs_redraw)
    border_draw(border, frame);

  SLSTransactionMoveWindowWithGroup(transaction, border->wid, border->origin);
  CGAffineTransform transform = CGAffineTransformIdentity;
  transform.tx = -border->origin.x;
  transform.ty = -border->origin.y;
  SLSTransactionSetWindowTransform(transaction, border->wid, 0, 0, transform);
  SLSTransactionSetWindowLevel(transaction, border->wid, border->level);
  // Order ABOVE target_wid so cobwebs drape over corners and heat waves rise cleanly
  SLSTransactionOrderWindow(transaction, border->wid, BORDER_ORDER_ABOVE,
                            border->target_wid);
  SLSTransactionCommit(transaction, 0);
  CFRelease(transaction);

  if (disabled_update)
    SLSReenableUpdate(cid);

  border->geometry_valid = true;
  border->visible = true;
}

struct border *border_create(void) {
  struct border *border = calloc(1, sizeof(struct border));
  if (!border)
    return NULL;
  pthread_mutexattr_t mattr;
  pthread_mutexattr_init(&mattr);
  pthread_mutexattr_settype(&mattr, PTHREAD_MUTEX_RECURSIVE);
  pthread_mutex_init(&border->mutex, &mattr);
  pthread_mutexattr_destroy(&mattr);

  int cid = 0;
  SLSNewConnection(0, &cid);
  border->cid = cid ? cid : SLSMainConnectionID();
  border->metadata_dirty = true;
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  border->telemetry.unfocused_since = now;
  border->telemetry.idle_since = now;
  return border;
}

void border_destroy(struct border *border) {
  border_hide(border);
  dispatch_async(dispatch_get_main_queue(), ^{
    pthread_mutex_lock(&border->mutex);
    border_destroy_window(border);
    if (border->cid != SLSMainConnectionID())
      SLSReleaseConnection(border->cid);
    pthread_mutex_unlock(&border->mutex);
    pthread_mutex_destroy(&border->mutex);
    free(border);
  });
}

void border_update_geometry(struct border *border) {
  CGRect bounds;
  if (SLSGetWindowBounds(border->cid, border->target_wid, &bounds) !=
      kCGErrorSuccess) {
    border_hide(border);
    return;
  }
  if (border_suppress_live_resize(border, bounds))
    return;

  pthread_mutex_lock(&border->mutex);
  if (!border->geometry_valid || !border->wid || !border->context ||
      border->needs_redraw || border->too_small || border->metadata_dirty ||
      !CGSizeEqualToSize(bounds.size, border->drawing_bounds.size)) {
    border_update_internal(border, &bounds);
    pthread_mutex_unlock(&border->mutex);
    return;
  }

  if (CGRectEqualToRect(bounds, border->target_bounds)) {
    pthread_mutex_unlock(&border->mutex);
    return;
  }

  float offset = -g_border_width - DIEGETIC_PADDING;
  CGPoint origin = {bounds.origin.x + offset, bounds.origin.y + offset};
  CFTypeRef transaction = SLSTransactionCreate(border->cid);
  if (transaction) {
    SLSTransactionMoveWindowWithGroup(transaction, border->wid, origin);
    SLSTransactionOrderWindow(transaction, border->wid, BORDER_ORDER_ABOVE,
                              border->target_wid);
    SLSTransactionCommit(transaction, 0);
    CFRelease(transaction);
    border->target_bounds = bounds;
    border->origin = origin;
  }
  pthread_mutex_unlock(&border->mutex);
}

void border_update(struct border *border) {
  pthread_mutex_lock(&border->mutex);
  CGRect bounds;
  if (SLSGetWindowBounds(border->cid, border->target_wid, &bounds) ==
          kCGErrorSuccess &&
      !border_suppress_live_resize(border, bounds)) {
    border_update_internal(border, &bounds);
  } else {
    border_hide(border);
  }
  pthread_mutex_unlock(&border->mutex);
}

void border_reorder(struct border *border) {
  pthread_mutex_lock(&border->mutex);
  if (!g_diegetic_enabled || border->resize_suppressed || !border->wid ||
      !border->context || border->too_small ||
      (!border->sticky && !is_space_visible(border->cid, border->sid))) {
    pthread_mutex_unlock(&border->mutex);
    return;
  }
  bool shown = false;
  if (SLSWindowIsOrderedIn(border->cid, border->target_wid, &shown) !=
          kCGErrorSuccess ||
      !shown) {
    border_hide(border);
    pthread_mutex_unlock(&border->mutex);
    return;
  }
  int level = window_level(border->cid, border->target_wid);
  CFTypeRef transaction = SLSTransactionCreate(border->cid);
  if (transaction) {
    SLSTransactionSetWindowLevel(transaction, border->wid, level);
    SLSTransactionOrderWindow(transaction, border->wid, BORDER_ORDER_ABOVE,
                              border->target_wid);
    SLSTransactionCommit(transaction, 0);
    border->level = level;
    CFRelease(transaction);
  }
  pthread_mutex_unlock(&border->mutex);
}

void border_hide(struct border *border) {
  pthread_mutex_lock(&border->mutex);
  border->geometry_valid = false;
  border->visible = false;
  if (border->wid) {
    CFTypeRef transaction = SLSTransactionCreate(border->cid);
    if (transaction) {
      SLSTransactionOrderWindow(transaction, border->wid, 0,
                                border->target_wid);
      SLSTransactionCommit(transaction, 0);
      CFRelease(transaction);
    }
  }
  pthread_mutex_unlock(&border->mutex);
}

void border_unhide(struct border *border) {
  pthread_mutex_lock(&border->mutex);
  if (!g_diegetic_enabled || border->resize_suppressed || border->too_small ||
      (!border->sticky && !is_space_visible(border->cid, border->sid))) {
    pthread_mutex_unlock(&border->mutex);
    return;
  }
  if (border->wid) {
    CFTypeRef transaction = SLSTransactionCreate(border->cid);
    if (transaction) {
      SLSTransactionOrderWindow(transaction, border->wid, BORDER_ORDER_ABOVE,
                                border->target_wid);
      SLSTransactionCommit(transaction, 0);
      CFRelease(transaction);
      border->visible = true;
    }
  }
  pthread_mutex_unlock(&border->mutex);
}
