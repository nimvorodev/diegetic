#pragma once
#include "extern.h"
#include <ApplicationServices/ApplicationServices.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

static inline void debug_log(const char *message, ...) {
#ifdef DEBUG
  va_list va;
  va_start(va, message);
  vprintf(message, va);
  va_end(va);
#else
  (void)message;
#endif
}

static inline CFArrayRef cfarray_of_cfnumbers(void *values, size_t size,
                                              int count, CFNumberType type) {
  CFNumberRef temp[count];
  for (int i = 0; i < count; ++i) {
    temp[i] = CFNumberCreate(NULL, type, ((char *)values) + (size * i));
  }
  CFArrayRef result =
      CFArrayCreate(NULL, (const void **)temp, count, &kCFTypeArrayCallBacks);
  for (int i = 0; i < count; ++i)
    CFRelease(temp[i]);
  return result;
}
