#pragma once
#include "border.h"
#include "hashtable.h"
#include <stdbool.h>
#include <stdint.h>

bool windows_window_create(struct table *windows, uint32_t wid, uint64_t sid);
bool windows_window_destroy(struct table *windows, uint32_t wid, uint64_t sid);
void windows_window_move(struct table *windows, uint32_t wid);
void windows_window_resize(struct table *windows, uint32_t wid);
void windows_window_update(struct table *windows, uint32_t wid);
void windows_window_hide(struct table *windows, uint32_t wid);
void windows_window_unhide(struct table *windows, uint32_t wid);
void windows_reorder_all(struct table *windows);
void windows_update_all(struct table *windows);
void windows_tick_animations(struct table *windows);
void windows_determine_and_focus_active_window(struct table *windows);
void windows_add_existing_windows(struct table *windows);
void windows_draw_borders_on_current_spaces(struct table *windows);
void windows_apply_app_filter(struct table *windows);
int windows_eligible_owners(int *pids, int capacity);
