#include "border.h"
#include "events.h"
#include "hashtable.h"
#include "misc/ax.h"
#include "misc/extern.h"
#include "telemetry.h"
#include "windows.h"
#include <dispatch/dispatch.h>
#include <mach/mach.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define VERSION_STR "1.0.0"

pid_t g_pid;
struct table g_windows;

extern void cobweb_menubar_init(void);
extern void cobweb_menubar_run(void);

static TABLE_HASH_FUNC(hash_windows) { return *(uint32_t *)key; }
static TABLE_COMPARE_FUNC(cmp_windows) {
  return *(uint32_t *)key_a == *(uint32_t *)key_b;
}

void cobweb_on_config_changed(void) { windows_update_all(&g_windows); }

int main(int argc, char **argv) {
  bool no_menu = false;
  bool cli_pixel = false;
  float cli_minutes = 0.0f;
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--version") == 0 || strcmp(argv[i], "-v") == 0) {
      printf("Diegetic %s\n", VERSION_STR);
      return 0;
    }
    if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      printf("Diegetic — physical window states for macOS.\n"
             "Usage: Diegetic [--pixel] [--cobweb-minutes=N] [--no-menu]\n");
      return 0;
    }
    if (strcmp(argv[i], "--pixel") == 0) {
      cli_pixel = true;
    } else if (strcmp(argv[i], "--no-menu") == 0) {
      no_menu = true;
    } else if (strncmp(argv[i], "--cobweb-minutes=", 17) == 0) {
      float mins = strtof(argv[i] + 17, NULL);
      if (mins > 0.0f)
        cli_minutes = mins;
    }
  }

  ax_check_trust(true);
  telemetry_init();

  if (!no_menu)
    cobweb_menubar_init();

  // Explicit CLI flags win over saved menu-bar preferences: cobweb_load_prefs
  // runs inside cobweb_menubar_init and would otherwise clobber them.
  if (cli_pixel)
    g_diegetic_style = DIEGETIC_STYLE_PIXEL;
  if (cli_minutes > 0.0f)
    g_cobweb_after_seconds = cli_minutes * 60.0f;

  pid_for_task(mach_task_self(), &g_pid);
  table_init(&g_windows, 1024, hash_windows, cmp_windows);

  int cid = SLSMainConnectionID();
  events_register(cid);

  windows_add_existing_windows(&g_windows);
  windows_determine_and_focus_active_window(&g_windows);

  // 20 Hz animation & telemetry loop for rising heat waves, dangling spider,
  // frost accumulation, and focus brush-away sweeps.
  dispatch_source_t timer = dispatch_source_create(
      DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
  dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, 0),
                            50 * NSEC_PER_MSEC, 10 * NSEC_PER_MSEC);
  dispatch_source_set_event_handler(timer, ^{
    telemetry_sample_processes();
    windows_tick_animations(&g_windows);
  });
  dispatch_resume(timer);

  if (no_menu) {
    CFRunLoopRun();
  } else {
    cobweb_menubar_run();
  }
  return 0;
}
