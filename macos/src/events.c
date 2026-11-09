#include "events.h"
#include "misc/extern.h"
#include "windows.h"
#include <dispatch/dispatch.h>

extern struct table g_windows;
extern pid_t g_pid;

static void schedule_order_check(void) {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
                   windows_reorder_all(&g_windows);
                 });
}

static void schedule_focus_check(int64_t delay_us) {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay_us * NSEC_PER_USEC),
                 dispatch_get_main_queue(), ^{
                   windows_determine_and_focus_active_window(&g_windows);
                 });
}

struct window_spawn_data {
  uint64_t sid;
  uint32_t wid;
};

static bool is_own_window(int cid, uint32_t wid) {
  int wid_cid = 0;
  SLSGetWindowOwner(cid, wid, &wid_cid);
  pid_t pid = 0;
  SLSConnectionGetPID(wid_cid, &pid);
  return pid == g_pid;
}

static void window_spawn_handler(uint32_t event, struct window_spawn_data *data,
                                 size_t length, int cid) {
  if (!data ||
      length < offsetof(struct window_spawn_data, wid) + sizeof(data->wid))
    return;
  uint32_t wid = data->wid;
  uint64_t sid = data->sid;
  if (!wid || is_own_window(cid, wid))
    return;

  dispatch_async(dispatch_get_main_queue(), ^{
    if (event == EVENT_WINDOW_CREATE) {
      if (!table_find(&g_windows, &wid) &&
          windows_window_create(&g_windows, wid, sid)) {
        windows_determine_and_focus_active_window(&g_windows);
      }
    } else if (event == EVENT_WINDOW_DESTROY) {
      windows_window_destroy(&g_windows, wid, sid);
      windows_determine_and_focus_active_window(&g_windows);
    }
    schedule_order_check();
  });
}

static void window_modify_handler(uint32_t event, uint32_t *window_id,
                                  size_t length, int cid) {
  if (!window_id || length < sizeof(*window_id))
    return;
  uint32_t wid = *window_id;
  if (!wid || is_own_window(cid, wid))
    return;

  dispatch_async(dispatch_get_main_queue(), ^{
    if (event == EVENT_WINDOW_MOVE) {
      windows_window_move(&g_windows, wid);
    } else if (event == EVENT_WINDOW_RESIZE) {
      windows_window_resize(&g_windows, wid);
    } else if (event == EVENT_WINDOW_REORDER) {
      windows_window_update(&g_windows, wid);
      schedule_focus_check(10000);
      schedule_order_check();
    } else if (event == EVENT_WINDOW_LEVEL) {
      windows_window_update(&g_windows, wid);
      schedule_order_check();
    } else if (event == EVENT_WINDOW_TITLE || event == EVENT_WINDOW_UPDATE) {
      schedule_focus_check(35000);
    } else if (event == EVENT_WINDOW_UNHIDE) {
      windows_window_unhide(&g_windows, wid);
      schedule_order_check();
    } else if (event == EVENT_WINDOW_HIDE) {
      windows_window_hide(&g_windows, wid);
      schedule_order_check();
    } else if (event == EVENT_WINDOW_CLOSE) {
      windows_window_destroy(&g_windows, wid, 0);
      schedule_order_check();
    }
  });
}

static void front_app_handler(uint32_t event, void *data, size_t len, int cid) {
  (void)event;
  (void)data;
  (void)len;
  (void)cid;
  dispatch_async(dispatch_get_main_queue(), ^{
    schedule_focus_check(35000);
    schedule_order_check();
  });
}

static void space_handler(uint32_t event, void *data, size_t len, int cid) {
  (void)event;
  (void)data;
  (void)len;
  (void)cid;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_MSEC),
                 dispatch_get_main_queue(), ^{
                   windows_draw_borders_on_current_spaces(&g_windows);
                 });
}

void events_register(int cid) {
  void *ctx = (void *)(intptr_t)cid;
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_CLOSE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_MOVE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_RESIZE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_LEVEL, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_UNHIDE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_HIDE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_TITLE, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_REORDER, ctx);
  SLSRegisterNotifyProc(window_modify_handler, EVENT_WINDOW_UPDATE, ctx);
  SLSRegisterNotifyProc(window_spawn_handler, EVENT_WINDOW_CREATE, ctx);
  SLSRegisterNotifyProc(window_spawn_handler, EVENT_WINDOW_DESTROY, ctx);
  SLSRegisterNotifyProc(space_handler, EVENT_SPACE_CHANGE, ctx);
  SLSRegisterNotifyProc(front_app_handler, EVENT_FRONT_CHANGE, ctx);
}
