#include "windows.h"
#include "misc/ax.h"
#include "misc/window.h"
#include <libproc.h>
#include <string.h>

extern pid_t g_pid;
extern bool cobweb_pid_hidden(pid_t pid);

static bool app_allowed(pid_t pid) {
  if (pid <= 0 || pid == g_pid)
    return false;
  if (cobweb_pid_hidden(pid))
    return false;
  return true;
}

static void windows_update_notifications(struct table *windows) {
  int count = 0;
  uint32_t empty = 0;
  uint32_t *list =
      windows->count ? malloc(sizeof(*list) * windows->count) : NULL;
  if (windows->count && !list)
    return;

  for (uint32_t i = 0; i < windows->capacity; ++i) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      if (b->value)
        list[count++] = *(uint32_t *)b->key;
    }
  }
  int cid = SLSMainConnectionID();
  SLSRequestNotificationsForWindows(cid, count ? list : &empty, count);
  free(list);
}

bool windows_window_create(struct table *windows, uint32_t wid, uint64_t sid) {
  bool created = false;
  int cid = SLSMainConnectionID();
  int wid_cid = 0;
  SLSGetWindowOwner(cid, wid, &wid_cid);
  pid_t pid = 0;
  SLSConnectionGetPID(wid_cid, &pid);

  char name_buf[PROC_PIDPATHINFO_MAXSIZE] = {0};
  if (proc_name(pid, name_buf, sizeof(name_buf)) <= 0)
    return false;
  if (!app_allowed(pid))
    return false;

  CFArrayRef target_ref =
      cfarray_of_cfnumbers(&wid, sizeof(uint32_t), 1, kCFNumberSInt32Type);
  if (!target_ref)
    return false;

  CFTypeRef query = SLSWindowQueryWindows(cid, target_ref, 0x0);
  if (query) {
    CFTypeRef iterator = SLSWindowQueryResultCopyWindows(query);
    if (iterator && SLSWindowIteratorGetCount(iterator) > 0 &&
        SLSWindowIteratorAdvance(iterator)) {
      if (window_suitable(iterator)) {
        struct border *border = table_find(windows, &wid);
        if (!border) {
          border = border_create();
          bool added = false;
          if (border) {
            // Key the table on the border's own heap field — &wid (this
            // function's stack parameter) would dangle after return and
            // corrupt every later lookup/remove.
            border->target_wid = wid;
            added = table_add(windows, &border->target_wid, border);
          }
          if (!added) {
            if (border)
              border_destroy(border);
            CFRelease(iterator);
            CFRelease(query);
            CFRelease(target_ref);
            return false;
          }
          created = true;
        }
        border->radius = 10.0f;
        border->target_wid = wid;
        border->owner_pid = pid;
        snprintf(border->app, sizeof(border->app), "%s", name_buf);
        border->sid = sid ? sid : window_space_id(cid, wid);
        border->metadata_dirty = true;
        border_update(border);
        windows_update_notifications(windows);
      }
    }
    if (iterator)
      CFRelease(iterator);
    CFRelease(query);
  }
  CFRelease(target_ref);
  return created;
}

bool windows_window_destroy(struct table *windows, uint32_t wid, uint64_t sid) {
  struct border *border = table_find(windows, &wid);
  if (border && (border->sid == sid || border->sticky || sid == 0)) {
    table_remove(windows, &wid);
    border_destroy(border);
    windows_update_notifications(windows);
    return true;
  }
  return false;
}

void windows_window_move(struct table *windows, uint32_t wid) {
  struct border *border = table_find(windows, &wid);
  if (border)
    border_update_geometry(border);
}

void windows_window_resize(struct table *windows, uint32_t wid) {
  struct border *border = table_find(windows, &wid);
  if (border)
    border_update_geometry(border);
}

void windows_window_update(struct table *windows, uint32_t wid) {
  struct border *border = table_find(windows, &wid);
  if (border) {
    border->metadata_dirty = true;
    border->needs_redraw = true;
    border_update(border);
  }
}

void windows_window_hide(struct table *windows, uint32_t wid) {
  struct border *border = table_find(windows, &wid);
  if (border)
    border_hide(border);
}

void windows_window_unhide(struct table *windows, uint32_t wid) {
  struct border *border = table_find(windows, &wid);
  if (border) {
    border->metadata_dirty = true;
    border_update(border);
  }
}

void windows_reorder_all(struct table *windows) {
  for (uint32_t i = 0; i < windows->capacity; i++) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      if (b->value)
        border_reorder(b->value);
    }
  }
}

void windows_update_all(struct table *windows) {
  for (uint32_t i = 0; i < windows->capacity; i++) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      struct border *border = b->value;
      if (border) {
        border->needs_redraw = true;
        border_update(border);
      }
    }
  }
}

void windows_tick_animations(struct table *windows) {
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  for (uint32_t i = 0; i < windows->capacity; i++) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      struct border *border = b->value;
      if (!border || !border->visible)
        continue;
      telemetry_update_window(&border->telemetry, border->owner_pid, now);
      if (telemetry_needs_animation(&border->telemetry, now)) {
        border->needs_redraw = true;
        border_update(border);
      }
    }
  }
}

static bool windows_window_focus(struct table *windows, uint32_t wid) {
  bool found = false;
  for (uint32_t i = 0; i < windows->capacity; ++i) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      struct border *border = b->value;
      if (!border)
        continue;
      if (border->focused && border->target_wid != wid) {
        border->focused = false;
        telemetry_on_focus_change(&border->telemetry, false);
        border->needs_redraw = true;
        border_update(border);
      }
      if (!border->focused && border->target_wid == wid) {
        border->focused = true;
        telemetry_on_focus_change(&border->telemetry, true);
        border->needs_redraw = true;
        border_update(border);
      }
      if (border->target_wid == wid)
        found = true;
    }
  }
  return found;
}

void windows_determine_and_focus_active_window(struct table *windows) {
  int cid = SLSMainConnectionID();
  uint32_t front_wid = ax_get_front_window(cid);
  if (!front_wid)
    front_wid = get_front_window(cid);
  if (!windows_window_focus(windows, front_wid)) {
    if (front_wid &&
        windows_window_create(windows, front_wid, window_space_id(cid, front_wid))) {
      windows_window_focus(windows, front_wid);
    }
  }
}

static int windows_copy_suitable(int cid, uint32_t **out) {
  *out = NULL;
  int found = 0;
  uint64_t *space_list = NULL;
  int space_count = 0;

  CFArrayRef display_spaces_ref = SLSCopyManagedDisplaySpaces(cid);
  if (display_spaces_ref) {
    int display_count = (int)CFArrayGetCount(display_spaces_ref);
    for (int i = 0; i < display_count; ++i) {
      CFDictionaryRef display_ref =
          CFArrayGetValueAtIndex(display_spaces_ref, i);
      CFArrayRef spaces_ref = CFDictionaryGetValue(display_ref, CFSTR("Spaces"));
      int sc = (int)CFArrayGetCount(spaces_ref);
      uint64_t *grown =
          realloc(space_list, sizeof(uint64_t) * (space_count + sc));
      if (!grown) {
        free(space_list);
        CFRelease(display_spaces_ref);
        return 0;
      }
      space_list = grown;
      for (int j = 0; j < sc; ++j) {
        CFDictionaryRef space_ref = CFArrayGetValueAtIndex(spaces_ref, j);
        CFNumberRef sid_ref = CFDictionaryGetValue(space_ref, CFSTR("id64"));
        CFNumberGetValue(sid_ref, CFNumberGetType(sid_ref),
                         space_list + space_count + j);
      }
      space_count += sc;
    }
    CFRelease(display_spaces_ref);
  }

  if (space_count == 0)
    return 0;

  uint64_t set_tags = 1;
  uint64_t clear_tags = 0;
  CFArrayRef space_list_ref = cfarray_of_cfnumbers(
      space_list, sizeof(uint64_t), space_count, kCFNumberSInt64Type);
  CFArrayRef window_list_ref = SLSCopyWindowsWithOptionsAndTags(
      cid, 0, space_list_ref, 0x2, &set_tags, &clear_tags);

  if (window_list_ref) {
    int count = (int)CFArrayGetCount(window_list_ref);
    if (count > 0 && (*out = malloc(sizeof(**out) * (size_t)count))) {
      CFTypeRef query = SLSWindowQueryWindows(cid, window_list_ref, 0x0);
      CFTypeRef iterator = query ? SLSWindowQueryResultCopyWindows(query) : NULL;
      while (iterator && SLSWindowIteratorAdvance(iterator) && found < count) {
        if (window_suitable(iterator))
          (*out)[found++] = SLSWindowIteratorGetWindowID(iterator);
      }
      if (iterator)
        CFRelease(iterator);
      if (query)
        CFRelease(query);
    }
    CFRelease(window_list_ref);
  }
  CFRelease(space_list_ref);
  free(space_list);
  return found;
}

void windows_add_existing_windows(struct table *windows) {
  int cid = SLSMainConnectionID();
  uint32_t *suitable = NULL;
  int count = windows_copy_suitable(cid, &suitable);
  for (int i = 0; i < count; i++) {
    uint32_t wid = suitable[i];
    if (!table_find(windows, &wid))
      windows_window_create(windows, wid, window_space_id(cid, wid));
  }
  if (count)
    windows_update_notifications(windows);
  free(suitable);
}

void windows_draw_borders_on_current_spaces(struct table *windows) {
  int cid = SLSMainConnectionID();
  CFArrayRef displays = SLSCopyManagedDisplays(cid);
  if (!displays)
    return;
  uint32_t space_count = (uint32_t)CFArrayGetCount(displays);
  uint64_t space_list[space_count];
  for (uint32_t i = 0; i < space_count; i++) {
    space_list[i] =
        SLSManagedDisplayGetCurrentSpace(cid, CFArrayGetValueAtIndex(displays, i));
  }
  CFRelease(displays);

  CFArrayRef space_list_ref = cfarray_of_cfnumbers(
      space_list, sizeof(uint64_t), space_count, kCFNumberSInt64Type);
  uint64_t set_tags = 1;
  uint64_t clear_tags = 0;
  CFArrayRef window_list = SLSCopyWindowsWithOptionsAndTags(
      cid, 0, space_list_ref, 0x2, &set_tags, &clear_tags);

  if (window_list) {
    CFTypeRef query = SLSWindowQueryWindows(cid, window_list, 0x0);
    if (query) {
      CFTypeRef iterator = SLSWindowQueryResultCopyWindows(query);
      if (iterator) {
        while (SLSWindowIteratorAdvance(iterator)) {
          if (window_suitable(iterator)) {
            uint32_t wid = SLSWindowIteratorGetWindowID(iterator);
            struct border *border = table_find(windows, &wid);
            if (border) {
              border->metadata_dirty = true;
              border->needs_redraw = true;
              border_update(border);
            } else {
              windows_window_create(windows, wid, window_space_id(cid, wid));
            }
          }
        }
        CFRelease(iterator);
      }
      CFRelease(query);
    }
    CFRelease(window_list);
  }
  CFRelease(space_list_ref);
}

void windows_apply_app_filter(struct table *windows) {
  uint32_t *removed =
      windows->count ? malloc(sizeof(*removed) * windows->count) : NULL;
  if (windows->count && !removed)
    return;
  int count = 0;
  for (uint32_t i = 0; i < windows->capacity; ++i) {
    for (struct bucket *b = windows->buckets[i]; b; b = b->next) {
      struct border *border = b->value;
      if (border && !app_allowed(border->owner_pid))
        removed[count++] = *(uint32_t *)b->key;
    }
  }
  for (int i = 0; i < count; i++)
    windows_window_destroy(windows, removed[i], 0);
  free(removed);
  windows_add_existing_windows(windows);
  windows_determine_and_focus_active_window(windows);
}

int windows_eligible_owners(int *pids, int capacity) {
  int cid = SLSMainConnectionID();
  uint32_t *suitable = NULL;
  int count = windows_copy_suitable(cid, &suitable);
  int owners = 0;
  for (int i = 0; i < count; i++) {
    int owner_cid = 0;
    pid_t pid = 0;
    SLSGetWindowOwner(cid, suitable[i], &owner_cid);
    SLSConnectionGetPID(owner_cid, &pid);
    if (pid <= 0 || pid == g_pid)
      continue;
    int seen = 0;
    while (seen < owners && pids[seen] != pid)
      seen++;
    if (seen == owners && owners < capacity)
      pids[owners++] = pid;
  }
  free(suitable);
  return owners;
}
