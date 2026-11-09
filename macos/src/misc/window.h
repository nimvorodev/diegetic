#pragma once
#include "extern.h"
#include "helpers.h"

#define WINDOW_TAG_DOCUMENT      (1ULL << 0)
#define WINDOW_TAG_FLOATING      (1ULL << 1)
#define WINDOW_TAG_ATTACHED      (1ULL << 7)
#define WINDOW_TAG_STICKY        (1ULL << 11)
#define WINDOW_TAG_IGNORES_CYCLE (1ULL << 18)
#define WINDOW_TAG_MODAL         (1ULL << 31)

static inline uint64_t get_active_space_id(int cid) {
  CFStringRef uuid = SLSCopyActiveMenuBarDisplayIdentifier(cid);
  if (!uuid)
    return 0;
  uint64_t sid = SLSManagedDisplayGetCurrentSpace(cid, uuid);
  CFRelease(uuid);
  return sid;
}

static inline bool is_space_visible(int cid, uint64_t sid) {
  CFArrayRef displays = SLSCopyManagedDisplays(cid);
  if (!displays)
    return true;
  bool visible = false;
  CFIndex count = CFArrayGetCount(displays);
  for (CFIndex i = 0; i < count; i++) {
    CFStringRef uuid = CFArrayGetValueAtIndex(displays, i);
    if (SLSManagedDisplayGetCurrentSpace(cid, uuid) == sid) {
      visible = true;
      break;
    }
  }
  CFRelease(displays);
  return visible;
}

static inline bool window_suitable(CFTypeRef iterator) {
  uint64_t tags = SLSWindowIteratorGetTags(iterator);
  uint64_t attributes = SLSWindowIteratorGetAttributes(iterator);
  uint32_t parent_wid = SLSWindowIteratorGetParentID(iterator);
  if ((parent_wid == 0) &&
      ((attributes & 0x2) || (tags & 0x400000000000000)) &&
      !(tags & WINDOW_TAG_ATTACHED) &&
      !(tags & WINDOW_TAG_IGNORES_CYCLE) &&
      ((tags & WINDOW_TAG_DOCUMENT) ||
       ((tags & WINDOW_TAG_FLOATING) && (tags & WINDOW_TAG_MODAL)))) {
    return true;
  }
  return false;
}

static inline uint64_t window_tags(int cid, uint32_t wid) {
  uint64_t tags = 0;
  CFArrayRef window_ref =
      cfarray_of_cfnumbers(&wid, sizeof(uint32_t), 1, kCFNumberSInt32Type);
  CFTypeRef query = SLSWindowQueryWindows(cid, window_ref, 0x0);
  if (query) {
    CFTypeRef iterator = SLSWindowQueryResultCopyWindows(query);
    if (iterator && SLSWindowIteratorGetCount(iterator) > 0 &&
        SLSWindowIteratorAdvance(iterator)) {
      tags = SLSWindowIteratorGetTags(iterator);
    }
    if (iterator)
      CFRelease(iterator);
    CFRelease(query);
  }
  CFRelease(window_ref);
  return tags;
}

static inline uint32_t get_front_window(int cid) {
  uint32_t wid = 0;
  uint64_t active_sid = get_active_space_id(cid);

  ProcessSerialNumber psn = {0};
  if (_SLPSGetFrontProcess(&psn) != noErr)
    return 0;
  int target_cid = 0;
  SLSGetConnectionIDForPSN(cid, &psn, &target_cid);

  uint64_t set_tags = 1;
  uint64_t clear_tags = 0;
  CFArrayRef space_list_ref = cfarray_of_cfnumbers(
      &active_sid, sizeof(uint64_t), 1, kCFNumberSInt64Type);

  CFArrayRef window_list = SLSCopyWindowsWithOptionsAndTags(
      cid, target_cid, space_list_ref, 0x2, &set_tags, &clear_tags);
  if (window_list) {
    uint32_t window_count = (uint32_t)CFArrayGetCount(window_list);
    if (window_count > 0) {
      CFTypeRef query = SLSWindowQueryWindows(cid, window_list, 0x0);
      if (query) {
        CFTypeRef iterator = SLSWindowQueryResultCopyWindows(query);
        if (iterator && SLSWindowIteratorGetCount(iterator) > 0) {
          while (SLSWindowIteratorAdvance(iterator)) {
            if (window_suitable(iterator)) {
              wid = SLSWindowIteratorGetWindowID(iterator);
              break;
            }
          }
        }
        if (iterator)
          CFRelease(iterator);
        CFRelease(query);
      }
    }
    CFRelease(window_list);
  }
  CFRelease(space_list_ref);
  return wid;
}

static inline uint64_t window_space_id(int cid, uint32_t wid) {
  uint64_t sid = 0;
  CFArrayRef window_list_ref =
      cfarray_of_cfnumbers(&wid, sizeof(uint32_t), 1, kCFNumberSInt32Type);
  CFArrayRef space_list_ref =
      SLSCopySpacesForWindows(cid, 0x7, window_list_ref);
  if (space_list_ref) {
    if (CFArrayGetCount(space_list_ref) > 0) {
      CFNumberRef id_ref =
          (CFNumberRef)CFArrayGetValueAtIndex(space_list_ref, 0);
      CFNumberGetValue(id_ref, CFNumberGetType(id_ref), &sid);
    }
    CFRelease(space_list_ref);
  }
  CFRelease(window_list_ref);
  if (sid)
    return sid;

  CFStringRef uuid = SLSCopyManagedDisplayForWindow(cid, wid);
  if (uuid) {
    sid = SLSManagedDisplayGetCurrentSpace(cid, uuid);
    CFRelease(uuid);
    return sid;
  }
  return 0;
}

static inline int window_level(int cid, uint32_t wid) {
  CFArrayRef target_ref =
      cfarray_of_cfnumbers(&wid, sizeof(uint32_t), 1, kCFNumberSInt32Type);
  CFTypeRef query = SLSWindowQueryWindows(cid, target_ref, 0x0);
  CFTypeRef iterator = query ? SLSWindowQueryResultCopyWindows(query) : NULL;
  int level = 0;
  if (iterator && SLSWindowIteratorAdvance(iterator)) {
    level = SLSWindowIteratorGetLevel(iterator);
  }
  if (iterator)
    CFRelease(iterator);
  if (query)
    CFRelease(query);
  CFRelease(target_ref);
  return level;
}

static inline void window_send_to_space(int cid, uint32_t wid, uint64_t sid) {
  CFArrayRef window_list =
      cfarray_of_cfnumbers(&wid, sizeof(uint32_t), 1, kCFNumberSInt32Type);
  SLSMoveWindowsToManagedSpace(cid, window_list, sid);
  CFRelease(window_list);
}

// Creates a transparent, click-through SkyLight overlay window using an empty
// opaque region so mouse clicks & scrolling pass directly to the app below.
static inline uint32_t window_create_overlay(int cid, CGRect frame, bool hidpi) {
  uint32_t id = 0;
  CFTypeRef frame_region = NULL;
  CGSNewRegionWithRect(&frame, &frame_region);
  CFTypeRef empty_region = CGRegionCreateEmptyRegion();

  uint64_t set_tags = (1ULL << 1) | (1ULL << 9) | WINDOW_TAG_IGNORES_CYCLE;
  uint64_t clear_tags = 0;

  SLSNewWindowWithOpaqueShapeAndContext(cid, 2, frame_region, empty_region, 13,
                                        &set_tags, 0, 0, 64, &id, NULL);
  if (id) {
    SLSClearWindowTags(cid, id, &clear_tags, 64);
    SLSSetWindowOpacity(cid, id, false);
    SLSSetWindowResolution(cid, id, hidpi ? 2.0 : 1.0);
  }
  if (frame_region)
    CFRelease(frame_region);
  if (empty_region)
    CFRelease(empty_region);
  return id;
}
