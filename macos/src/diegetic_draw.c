#include "diegetic_draw.h"
#include <math.h>

static const uint8_t PIXEL_SPIDER[9][11] = {
    {0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0},
    {1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1},
    {0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0},
    {0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0},
    {1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1},
    {0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0},
    {0, 1, 0, 0, 1, 2, 1, 0, 0, 1, 0},
    {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
};

static void draw_pixel_rect(CGContextRef ctx, float x, float y, float w,
                            float h, float px) {
  float sx = roundf(x / px) * px;
  float sy = roundf(y / px) * px;
  float sw = fmaxf(px, roundf(w / px) * px);
  float sh = fmaxf(px, roundf(h / px) * px);
  CGContextFillRect(ctx, CGRectMake(sx, sy, sw, sh));
}

static void draw_pixel_line(CGContextRef ctx, float x0, float y0, float x1,
                            float y1, float px) {
  int ix0 = (int)llroundf(x0 / px);
  int iy0 = (int)llroundf(y0 / px);
  int ix1 = (int)llroundf(x1 / px);
  int iy1 = (int)llroundf(y1 / px);
  int dx = abs(ix1 - ix0);
  int dy = abs(iy1 - iy0);
  int sx = ix0 < ix1 ? 1 : -1;
  int sy = iy0 < iy1 ? 1 : -1;
  int err = dx - dy;

  for (;;) {
    CGContextFillRect(ctx, CGRectMake(ix0 * px, iy0 * px, px, px));
    if (ix0 == ix1 && iy0 == iy1)
      break;
    int e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

static void draw_ice_fern(CGContextRef ctx, float ox, float oy, float angle,
                          float len, float alpha) {
  float ex = ox + cosf(angle) * len;
  float ey = oy + sinf(angle) * len;

  CGContextSetRGBStrokeColor(ctx, 1.0f, 1.0f, 1.0f, alpha);
  CGContextSetLineWidth(ctx, 1.3f);
  CGContextMoveToPoint(ctx, ox, oy);
  CGContextAddLineToPoint(ctx, ex, ey);
  CGContextStrokePath(ctx);

  CGContextSetRGBStrokeColor(ctx, 0.73f, 0.90f, 0.99f, alpha * 0.9f);
  CGContextSetLineWidth(ctx, 1.0f);
  for (int b = 1; b <= 3; b++) {
    float frac = b / 4.0f;
    float bx = ox + cosf(angle) * len * frac;
    float by = oy + sinf(angle) * len * frac;
    float blen = len * 0.42f * (1.0f - frac * 0.5f);
    CGContextMoveToPoint(ctx, bx, by);
    CGContextAddLineToPoint(ctx, bx + cosf(angle + 0.65f) * blen,
                            by + sinf(angle + 0.65f) * blen);
    CGContextMoveToPoint(ctx, bx, by);
    CGContextAddLineToPoint(ctx, bx + cosf(angle - 0.65f) * blen,
                            by + sinf(angle - 0.65f) * blen);
    CGContextStrokePath(ctx);
  }
}

void diegetic_draw_window(CGContextRef ctx, CGRect canvas_bounds,
                          CGRect win, float corner_radius,
                          const struct window_telemetry *wt,
                          CFAbsoluteTime now, uint32_t wid_seed) {
  if (!ctx)
    return;

  CGContextSaveGState(ctx);
  CGContextClearRect(ctx, canvas_bounds);

  bool is_brushing = now < wt->brush_until;
  float brush_progress =
      is_brushing
          ? fminf(1.0f, fmaxf(0.0f, 1.0f - (float)(wt->brush_until - now) / 0.58f))
          : 1.0f;
  float active_cobweb =
      is_brushing ? wt->brushed_web_amount * fmaxf(0.0f, 1.0f - brush_progress * 1.55f)
                  : wt->cobweb_intensity;

  float t = (float)fmod(now, 10000.0) + (float)(wid_seed % 97) * 0.37f;
  float thick_mult = fmaxf(0.65f, g_border_width / 14.0f);
  bool pixel_mode = (g_diegetic_style == DIEGETIC_STYLE_PIXEL);

  float minX = CGRectGetMinX(win);
  float maxX = CGRectGetMaxX(win);
  float minY = CGRectGetMinY(win);
  float maxY = CGRectGetMaxY(win);
  float w = CGRectGetWidth(win);
  float h = CGRectGetHeight(win);

  // =========================================================================
  // 1. CAST-IRON HEAT + RISING HEAT WAVES (High CPU/RAM)
  // =========================================================================
  if (wt->heat_intensity > 0.01f) {
    float heat = wt->heat_intensity;
    float bw = (8.0f + heat * 8.0f) * thick_mult;
    float pulse = 0.86f + sinf(t * 3.4f) * 0.14f;
    float glow = heat * pulse;

    if (pixel_mode) {
      float px = 4.0f;
      CGContextSetRGBFillColor(ctx, 0.11f, 0.08f, 0.07f, 0.90f);
      draw_pixel_rect(ctx, minX - bw, maxY, w + bw * 2, bw, px);
      draw_pixel_rect(ctx, minX - bw, minY - bw, w + bw * 2, bw, px);
      draw_pixel_rect(ctx, minX - bw, minY, bw, h, px);
      draw_pixel_rect(ctx, maxX, minY, bw, h, px);

      for (float x = minX - bw; x < maxX + bw; x += px * 2) {
        float wt_top = sinf(x * 0.07f + t * 5.2f);
        float wt_bot = cosf(x * 0.06f - t * 4.7f);
        if (wt_top > -0.35f) {
          if (wt_top > 0.55f && glow > 0.65f)
            CGContextSetRGBFillColor(ctx, 0.99f, 0.94f, 0.54f, glow);
          else if (wt_top > 0.15f)
            CGContextSetRGBFillColor(ctx, 0.98f, 0.45f, 0.09f, glow);
          else
            CGContextSetRGBFillColor(ctx, 0.86f, 0.15f, 0.15f, glow);
          draw_pixel_rect(ctx, x, maxY + px, px, bw - px, px);
        }
        if (wt_bot > -0.35f) {
          CGContextSetRGBFillColor(ctx, 0.95f, 0.35f, 0.08f, glow);
          draw_pixel_rect(ctx, x, minY - bw, px, bw - px, px);
        }
      }

      // Rising pixel heat blocks above top edge (maxY + bw)
      int puffs = (int)(14 * heat);
      for (int i = 0; i < puffs; i++) {
        int seed = (i * 73 + (int)wid_seed) % 100;
        float cycle = fmodf(t * (0.85f + (seed % 5) * 0.15f) + seed * 0.13f, 1.0f);
        float pxX = minX + ((seed / 100.0f) * w) + sinf(cycle * 6.0f + i) * 8.0f;
        float pxY = maxY + bw + cycle * 36.0f;
        float alpha = (1.0f - cycle) * 0.75f * heat;
        CGContextSetRGBFillColor(ctx, 0.99f, cycle < 0.4f ? 0.90f : 0.42f, 0.12f,
                                 alpha);
        draw_pixel_rect(ctx, pxX, pxY, px * 1.5f, px * 1.5f, px);
      }
    } else {
      CGContextSaveGState(ctx);
      CGColorRef shadowCol =
          CGColorCreateGenericRGB(1.0, 0.27, 0.0, 0.85 * glow);
      CGContextSetShadowWithColor(ctx, CGSizeZero, 18.0f * heat, shadowCol);
      CGColorRelease(shadowCol);

      CGRect outerIron = CGRectInset(win, -bw * 0.42f, -bw * 0.42f);
      CGPathRef ironPath = CGPathCreateWithRoundedRect(
          outerIron, corner_radius + bw * 0.4f, corner_radius + bw * 0.4f, NULL);
      CGContextSetRGBStrokeColor(ctx, 0.13f, 0.09f, 0.08f, 0.93f);
      CGContextSetLineWidth(ctx, bw);
      CGContextAddPath(ctx, ironPath);
      CGContextStrokePath(ctx);

      // Molten glowing red-hot core
      CGContextSetRGBStrokeColor(ctx, 1.0f, 0.36f + 0.18f * pulse, 0.04f,
                                 0.94f * glow);
      CGContextSetLineWidth(ctx, bw * 0.52f);
      CGContextAddPath(ctx, ironPath);
      CGContextStrokePath(ctx);
      CGPathRelease(ironPath);

      CGContextSetShadowWithColor(ctx, CGSizeZero, 0, NULL);

      // Rising wavy heat ribbons above top edge (maxY)
      int ribbons = (int)fmaxf(6.0f, roundf(14.0f * heat));
      CGContextSetLineCap(ctx, kCGLineCapRound);
      for (int i = 0; i < ribbons; i++) {
        float frac = (i + 0.5f) / ribbons;
        float baseX = minX + 16.0f + frac * fmaxf(20.0f, w - 32.0f);
        float phase = t * 4.2f + i * 1.37f;
        float waveH = (22.0f + (i % 3) * 8.0f) * heat;

        CGContextSetRGBStrokeColor(ctx, 1.0f, 0.48f, 0.12f, 0.48f * glow);
        CGContextSetLineWidth(ctx, 2.2f);
        CGContextMoveToPoint(ctx, baseX, maxY + bw * 0.6f);
        for (float dy = 3.0f; dy <= waveH; dy += 3.0f) {
          float p = dy / waveH;
          float wx = baseX + sinf(p * 5.5f - phase) * (4.5f * p + 1.5f);
          float wy = maxY + bw * 0.6f + dy;
          CGContextAddLineToPoint(ctx, wx, wy);
        }
        CGContextStrokePath(ctx);
      }

      // Rising ember motes
      int embers = (int)roundf(10.0f * heat);
      for (int i = 0; i < embers; i++) {
        float cycle = fmodf(t * 0.75f + i * 0.29f, 1.0f);
        float ex = minX + fmodf(i * 97.0f, fmaxf(20.0f, w)) + sinf(cycle * 7.0f + i) * 7.0f;
        float ey = maxY + bw * 0.6f + cycle * 40.0f;
        float alpha = (1.0f - cycle) * 0.85f * glow;
        CGContextSetRGBFillColor(ctx, 1.0f, cycle < 0.4f ? 0.92f : 0.38f, 0.08f, alpha);
        CGContextFillEllipseInRect(ctx, CGRectMake(ex - 2.0f, ey - 2.0f, 4.0f, 4.0f));
      }
      CGContextRestoreGState(ctx);
    }
  }

  // =========================================================================
  // 2. FROSTED EDGES (Idle Apps)
  // =========================================================================
  if (wt->frost_intensity > 0.01f) {
    float frost = wt->frost_intensity;
    float rimW = (7.0f + frost * 11.0f) * thick_mult;

    if (pixel_mode) {
      float px = 4.0f;
      CGContextSetRGBFillColor(ctx, 0.88f, 0.95f, 1.0f, 0.75f * frost);
      draw_pixel_rect(ctx, minX - px * 2, maxY, w + px * 4, px * 2, px);
      draw_pixel_rect(ctx, minX - px * 2, minY - px * 2, w + px * 4, px * 2, px);
      draw_pixel_rect(ctx, minX - px * 2, minY, px * 2, h, px);
      draw_pixel_rect(ctx, maxX, minY, px * 2, h, px);

      for (float x = minX; x < maxX; x += px * 3) {
        int ix = (int)x;
        float hTop = roundf((1.0f + (ix * 7 % 3)) * frost) * px;
        float hBot = roundf((2.0f + (ix * 13 % 4)) * frost) * px;
        CGContextSetRGBFillColor(ctx, 0.73f, 0.90f, 0.99f, 0.85f * frost);
        draw_pixel_rect(ctx, x, maxY - hTop, px * 2, hTop, px);
        // Hanging pixel icicles below bottom edge (minY)
        CGContextSetRGBFillColor(ctx, 0.49f, 0.83f, 0.99f, 0.88f * frost);
        draw_pixel_rect(ctx, x, minY - px - hBot, px, hBot, px);
      }
    } else {
      CGContextSaveGState(ctx);
      CGColorRef frostGlow =
          CGColorCreateGenericRGB(0.49, 0.83, 0.99, 0.75 * frost);
      CGContextSetShadowWithColor(ctx, CGSizeZero, 14.0f * frost, frostGlow);
      CGColorRelease(frostGlow);

      CGRect rimeRect = CGRectInset(win, -2.0f, -2.0f);
      CGPathRef rimePath = CGPathCreateWithRoundedRect(
          rimeRect, corner_radius + 2.0f, corner_radius + 2.0f, NULL);
      CGContextSetRGBStrokeColor(ctx, 0.82f, 0.94f, 1.0f, 0.82f * frost);
      CGContextSetLineWidth(ctx, rimW * 0.72f);
      CGContextAddPath(ctx, rimePath);
      CGContextStrokePath(ctx);
      CGPathRelease(rimePath);

      CGContextSetShadowWithColor(ctx, CGSizeZero, 0, NULL);

      // Dendritic ice ferns growing inward from top & bottom edges
      int countTop = (int)fmaxf(4.0f, floorf(w / 28.0f));
      CGContextSetLineCap(ctx, kCGLineCapRound);
      for (int i = 0; i <= countTop; i++) {
        float x = minX + ((float)i / countTop) * w;
        float pseudo = fabsf(sinf(i * 12.9898f + wid_seed));
        float len = (8.0f + pseudo * 17.0f) * frost * thick_mult;
        float tilt = (pseudo - 0.5f) * 0.55f;
        draw_ice_fern(ctx, x, maxY, -M_PI_2 + tilt, len, 0.82f * frost);
        draw_ice_fern(ctx, x, minY, M_PI_2 - tilt, len * 0.9f, 0.78f * frost);
      }

      int countSide = (int)fmaxf(3.0f, floorf(h / 30.0f));
      for (int i = 1; i < countSide; i++) {
        float y = minY + ((float)i / countSide) * h;
        float pseudo = fabsf(cosf(i * 7.23f + wid_seed));
        float len = (7.0f + pseudo * 15.0f) * frost * thick_mult;
        draw_ice_fern(ctx, minX, y, (pseudo - 0.5f) * 0.5f, len, 0.76f * frost);
        draw_ice_fern(ctx, maxX, y, M_PI + (pseudo - 0.5f) * 0.5f, len,
                      0.76f * frost);
      }
      CGContextRestoreGState(ctx);
    }
  }

  // =========================================================================
  // 3. COBWEBS (> 2 HOURS UNFOCUSED) + TINY SPIDER + BRUSH-AWAY PARTICLES
  // =========================================================================
  if (active_cobweb > 0.01f) {
    float webScale = (0.55f + active_cobweb * 0.65f) * thick_mult;
    float webAlpha = fminf(0.95f, 0.40f + active_cobweb * 0.60f);

    struct {
      float x, y, dx, dy, size;
      bool active;
    } corners[4] = {
        {minX, maxY, 1.0f, -1.0f, 76.0f * webScale, true},  // Top-Left
        {maxX, maxY, -1.0f, -1.0f, 84.0f * webScale, true}, // Top-Right
        {minX, minY, 1.0f, 1.0f, 60.0f * webScale,
         active_cobweb > 0.34f}, // Bottom-Left
        {maxX, minY, -1.0f, 1.0f, 64.0f * webScale,
         active_cobweb > 0.48f}, // Bottom-Right
    };

    if (pixel_mode) {
      float px = 3.0f;
      for (int c = 0; c < 4; c++) {
        if (!corners[c].active)
          continue;
        int spokes = 5;
        int rings = (int)fmaxf(3.0f, roundf(3.0f + active_cobweb * 3.0f));

        // Shadow pass
        CGContextSetRGBFillColor(ctx, 0.06f, 0.09f, 0.16f, webAlpha * 0.40f);
        for (int s = 0; s < spokes; s++) {
          float ang = ((float)s / (spokes - 1)) * M_PI_2;
          float ex = corners[c].x + corners[c].dx * cosf(ang) * corners[c].size;
          float ey = corners[c].y + corners[c].dy * sinf(ang) * corners[c].size;
          draw_pixel_line(ctx, corners[c].x + px, corners[c].y - px, ex + px,
                          ey - px, px);
        }

        // Silk white pass
        CGContextSetRGBFillColor(ctx, 0.98f, 0.99f, 1.0f, webAlpha);
        for (int s = 0; s < spokes; s++) {
          float ang = ((float)s / (spokes - 1)) * M_PI_2;
          float ex = corners[c].x + corners[c].dx * cosf(ang) * corners[c].size;
          float ey = corners[c].y + corners[c].dy * sinf(ang) * corners[c].size;
          draw_pixel_line(ctx, corners[c].x, corners[c].y, ex, ey, px);
        }

        for (int r = 1; r <= rings; r++) {
          float rad = ((float)r / rings) * corners[c].size * 0.88f;
          for (int s = 0; s < spokes - 1; s++) {
            float a1 = ((float)s / (spokes - 1)) * M_PI_2;
            float a2 = ((float)(s + 1) / (spokes - 1)) * M_PI_2;
            float x1 = corners[c].x + corners[c].dx * cosf(a1) * rad;
            float y1 = corners[c].y + corners[c].dy * sinf(a1) * rad;
            float x2 = corners[c].x + corners[c].dx * cosf(a2) * rad;
            float y2 = corners[c].y + corners[c].dy * sinf(a2) * rad;
            draw_pixel_line(ctx, x1, y1, x2, y2, px);
          }
        }
      }

      // Pixel-art spider in top-right corner
      if (active_cobweb >= 0.22f && (!is_brushing || brush_progress < 0.65f)) {
        float sx = maxX - 38.0f;
        float threadLen = is_brushing ? fmaxf(0.0f, (1.0f - brush_progress * 1.6f) * 32.0f)
                                      : 24.0f + sinf(t * 2.3f) * 4.0f;
        float sy = maxY - 6.0f - threadLen;

        CGContextSetRGBFillColor(ctx, 0.98f, 0.99f, 1.0f, webAlpha);
        draw_pixel_line(ctx, sx + 15.0f, maxY, sx + 15.0f, sy, px);

        for (int row = 0; row < 9; row++) {
          for (int col = 0; col < 11; col++) {
            uint8_t cell = PIXEL_SPIDER[row][col];
            if (cell == 0)
              continue;
            if (cell == 2)
              CGContextSetRGBFillColor(ctx, 0.98f, 0.99f, 1.0f, 1.0f);
            else
              CGContextSetRGBFillColor(ctx, 0.09f, 0.09f, 0.11f, 1.0f);
            CGContextFillRect(ctx,
                              CGRectMake(sx + col * px, sy - row * px, px, px));
          }
        }
      }
    } else {
      CGContextSaveGState(ctx);
      CGContextSetLineCap(ctx, kCGLineCapRound);

      for (int c = 0; c < 4; c++) {
        if (!corners[c].active)
          continue;
        int spokes = 6;
        int rings = (int)fmaxf(4.0f, roundf(4.0f + active_cobweb * 4.0f));

        // Radial anchor threads
        for (int s = 0; s < spokes; s++) {
          float ang = ((float)s / (spokes - 1)) * M_PI_2;
          float len =
              corners[c].size * (s == 0 || s == spokes - 1 ? 1.08f : 0.94f);
          float ex = corners[c].x + corners[c].dx * cosf(ang) * len;
          float ey = corners[c].y + corners[c].dy * sinf(ang) * len;

          CGContextSetRGBStrokeColor(ctx, 0.06f, 0.09f, 0.16f, webAlpha * 0.28f);
          CGContextSetLineWidth(ctx, 2.0f);
          CGContextMoveToPoint(ctx, corners[c].x, corners[c].y);
          CGContextAddLineToPoint(ctx, ex, ey);
          CGContextStrokePath(ctx);

          CGContextSetRGBStrokeColor(ctx, 1.0f, 1.0f, 1.0f, webAlpha * 0.92f);
          CGContextSetLineWidth(ctx, 1.15f);
          CGContextMoveToPoint(ctx, corners[c].x, corners[c].y);
          CGContextAddLineToPoint(ctx, ex, ey);
          CGContextStrokePath(ctx);
        }

        // Sagging catenary spiral rings
        for (int r = 1; r <= rings; r++) {
          float rad = ((float)r / rings) * corners[c].size * 0.88f;
          CGMutablePathRef ringPath = CGPathCreateMutable();
          for (int s = 0; s < spokes - 1; s++) {
            float a1 = ((float)s / (spokes - 1)) * M_PI_2;
            float a2 = ((float)(s + 1) / (spokes - 1)) * M_PI_2;
            float x1 = corners[c].x + corners[c].dx * cosf(a1) * rad;
            float y1 = corners[c].y + corners[c].dy * sinf(a1) * rad;
            float x2 = corners[c].x + corners[c].dx * cosf(a2) * rad;
            float y2 = corners[c].y + corners[c].dy * sinf(a2) * rad;
            float midX = (x1 + x2) * 0.5f - corners[c].dx * (rad * 0.08f);
            float midY = (y1 + y2) * 0.5f - corners[c].dy * (rad * 0.08f);
            if (s == 0)
              CGPathMoveToPoint(ringPath, NULL, x1, y1);
            CGPathAddQuadCurveToPoint(ringPath, NULL, midX, midY, x2, y2);
          }

          CGContextSetRGBStrokeColor(ctx, 0.06f, 0.09f, 0.16f, webAlpha * 0.24f);
          CGContextSetLineWidth(ctx, 1.8f);
          CGContextAddPath(ctx, ringPath);
          CGContextStrokePath(ctx);

          CGContextSetRGBStrokeColor(ctx, 1.0f, 1.0f, 1.0f,
                                     webAlpha * (0.90f - r * 0.035f));
          CGContextSetLineWidth(ctx, 1.0f);
          CGContextAddPath(ctx, ringPath);
          CGContextStrokePath(ctx);
          CGPathRelease(ringPath);
        }
      }

      // Tiny 8-legged dangling spider in top-right corner
      if (active_cobweb >= 0.22f && (!is_brushing || brush_progress < 0.65f)) {
        float sx = maxX - 34.0f;
        float threadLen =
            is_brushing ? fmaxf(0.0f, (1.0f - brush_progress * 1.7f) * 32.0f)
                        : 24.0f + sinf(t * 2.2f) * 4.5f;
        float sy = maxY - 8.0f - threadLen;

        CGContextSetRGBStrokeColor(ctx, 1.0f, 1.0f, 1.0f, webAlpha * 0.85f);
        CGContextSetLineWidth(ctx, 1.0f);
        CGContextMoveToPoint(ctx, sx, maxY);
        CGContextAddLineToPoint(ctx, sx, sy);
        CGContextStrokePath(ctx);

        float wiggle = sinf(t * 7.5f) * 0.14f;
        CGContextSetRGBStrokeColor(ctx, 0.09f, 0.09f, 0.11f, 1.0f);
        CGContextSetLineWidth(ctx, 1.25f);
        for (int side = -1; side <= 1; side += 2) {
          for (int leg = 0; leg < 4; leg++) {
            float baseAngle =
                (leg - 1.5f) * 0.36f + (leg % 2 == 0 ? wiggle : -wiggle);
            float kx = sx + side * cosf(baseAngle) * 5.2f;
            float ky = sy - sinf(baseAngle) * 4.5f + 1.2f;
            float fx = sx + side * cosf(baseAngle) * 8.4f;
            float fy = sy - sinf(baseAngle) * 7.2f - 2.1f;
            CGContextMoveToPoint(ctx, sx, sy);
            CGContextAddLineToPoint(ctx, kx, ky);
            CGContextAddLineToPoint(ctx, fx, fy);
            CGContextStrokePath(ctx);
          }
        }

        CGContextSetRGBFillColor(ctx, 0.09f, 0.09f, 0.11f, 1.0f);
        CGContextFillEllipseInRect(ctx,
                                   CGRectMake(sx - 3.3f, sy - 1.5f, 6.6f, 8.2f));
        CGContextFillEllipseInRect(ctx,
                                   CGRectMake(sx - 2.3f, sy - 4.5f, 4.6f, 4.6f));
      }
      CGContextRestoreGState(ctx);
    }
  }

  // =========================================================================
  // 4. BRUSH-AWAY SILK PARTICLES WHEN WINDOW IS FOCUSED
  // =========================================================================
  if (is_brushing) {
    float alpha = (1.0f - brush_progress) * 0.92f;
    CGContextSetRGBStrokeColor(ctx, 1.0f, 1.0f, 1.0f, alpha);
    CGContextSetLineWidth(ctx, 1.3f);
    for (int i = 0; i < 18; i++) {
      float ang = (i / 18.0f) * M_PI * 2.0f + (wid_seed % 17) * 0.2f;
      float dist = brush_progress * (45.0f + (i % 5) * 14.0f);
      float ox = (i % 2 == 0) ? minX + 24.0f : maxX - 24.0f;
      float oy = maxY - 22.0f;
      float px = ox + cosf(ang) * dist;
      float py = oy + sinf(ang) * dist - brush_progress * 18.0f;
      CGContextMoveToPoint(ctx, px - 3.5f, py);
      CGContextAddLineToPoint(ctx, px + 3.5f, py + 2.0f);
      CGContextStrokePath(ctx);
    }
  }

  CGContextFlush(ctx);
  CGContextRestoreGState(ctx);
}
