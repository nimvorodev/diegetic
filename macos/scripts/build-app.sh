#!/bin/zsh
# Package the Diegetic daemon as a native macOS menu-bar app bundle.
# LSUIElement keeps it out of the Dock. Ad-hoc signing verifies the local bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/outputs/Diegetic.app"
STAGE="$(mktemp -d /tmp/diegetic-build.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

make -C "$ROOT" >/dev/null

STAGED="$STAGE/Diegetic.app/Contents"
mkdir -p "$STAGED/MacOS" "$STAGED/Resources" "$STAGE/AppIcon.iconset"

cp -f "$ROOT/bin/cobwebs" "$STAGED/MacOS/Diegetic"
cp -f "$ROOT/AppInfo.plist" "$STAGED/Info.plist"
chmod +x "$STAGED/MacOS/Diegetic"

# Generate procedural app icon (cobweb + cast-iron ember + frost crystal)
cat > "$STAGE/build_icon.m" << 'EOF'
#import <Cocoa/Cocoa.h>

static void writeIcon(NSString *dir, int px, NSString *name) {
  NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
      initWithBitmapDataPlanes:NULL
                    pixelsWide:px
                    pixelsHigh:px
                 bitsPerSample:8
               samplesPerPixel:4
                      hasAlpha:YES
                      isPlanar:NO
                colorSpaceName:NSCalibratedRGBColorSpace
                   bytesPerRow:0
                  bitsPerPixel:0];
  rep.size = NSMakeSize(px, px);
  [NSGraphicsContext saveGraphicsState];
  [NSGraphicsContext setCurrentContext:[NSGraphicsContext graphicsContextWithBitmapImageRep:rep]];
  CGContextRef ctx = [[NSGraphicsContext currentContext] CGContext];

  CGRect r = CGRectMake(px * 0.08, px * 0.08, px * 0.84, px * 0.84);
  CGFloat rad = px * 0.18;
  CGPathRef bg = CGPathCreateWithRoundedRect(r, rad, rad, NULL);
  CGContextAddPath(ctx, bg);
  CGContextClip(ctx);

  // Dark cast-iron background gradient
  CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
  CGFloat locs[] = {0.0, 0.55, 1.0};
  CGFloat cols[] = {
    0.10, 0.11, 0.14, 1.0,
    0.16, 0.12, 0.12, 1.0,
    0.28, 0.11, 0.06, 1.0
  };
  CGGradientRef grad = CGGradientCreateWithColorComponents(cs, cols, locs, 3);
  CGContextDrawLinearGradient(ctx, grad, CGPointMake(0, px), CGPointMake(px, 0), 0);
  CGGradientRelease(grad);
  CGColorSpaceRelease(cs);

  // Glowing cast-iron border
  CGContextSetRGBStrokeColor(ctx, 1.0, 0.42, 0.10, 0.95);
  CGContextSetLineWidth(ctx, MAX(2.0, px * 0.045));
  CGContextAddPath(ctx, bg);
  CGContextStrokePath(ctx);
  CGPathRelease(bg);

  // Top-left corner cobweb
  CGContextSetRGBStrokeColor(ctx, 0.96, 0.98, 1.0, 0.88);
  CGContextSetLineWidth(ctx, MAX(1.0, px * 0.015));
  CGFloat ox = CGRectGetMinX(r) + px * 0.03;
  CGFloat oy = CGRectGetMaxY(r) - px * 0.03;
  CGFloat webLen = px * 0.56;
  for (int i = 0; i < 6; i++) {
    CGFloat a = (i / 5.0) * M_PI_2;
    CGContextMoveToPoint(ctx, ox, oy);
    CGContextAddLineToPoint(ctx, ox + cos(a) * webLen, oy - sin(a) * webLen);
  }
  for (int ring = 1; ring <= 4; ring++) {
    CGFloat radRing = (ring / 4.0) * webLen * 0.88;
    for (int i = 0; i < 5; i++) {
      CGFloat a1 = (i / 5.0) * M_PI_2;
      CGFloat a2 = ((i + 1) / 5.0) * M_PI_2;
      CGContextMoveToPoint(ctx, ox + cos(a1) * radRing, oy - sin(a1) * radRing);
      CGContextAddLineToPoint(ctx, ox + cos(a2) * radRing, oy - sin(a2) * radRing);
    }
  }
  CGContextStrokePath(ctx);

  // Bottom-right frost crystal
  CGContextSetRGBStrokeColor(ctx, 0.55, 0.86, 1.0, 0.92);
  CGContextSetLineWidth(ctx, MAX(1.2, px * 0.02));
  CGFloat fx = CGRectGetMaxX(r) - px * 0.24;
  CGFloat fy = CGRectGetMinY(r) + px * 0.24;
  CGFloat flen = px * 0.14;
  for (int k = 0; k < 6; k++) {
    CGFloat a = k * (M_PI / 3.0);
    CGContextMoveToPoint(ctx, fx, fy);
    CGContextAddLineToPoint(ctx, fx + cos(a) * flen, fy + sin(a) * flen);
  }
  CGContextStrokePath(ctx);

  [NSGraphicsContext restoreGraphicsState];
  NSData *png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  [png writeToFile:[dir stringByAppendingPathComponent:name] atomically:YES];
}

int main(int argc, char **argv) {
  @autoreleasepool {
    NSString *dir = [NSString stringWithUTF8String:argv[1]];
    writeIcon(dir, 16, @"icon_16x16.png");
    writeIcon(dir, 32, @"icon_16x16@2x.png");
    writeIcon(dir, 32, @"icon_32x32.png");
    writeIcon(dir, 64, @"icon_32x32@2x.png");
    writeIcon(dir, 128, @"icon_128x128.png");
    writeIcon(dir, 256, @"icon_128x128@2x.png");
    writeIcon(dir, 256, @"icon_256x256.png");
    writeIcon(dir, 512, @"icon_256x256@2x.png");
    writeIcon(dir, 512, @"icon_512x512.png");
    writeIcon(dir, 1024, @"icon_512x512@2x.png");
  }
  return 0;
}
EOF

clang -O2 -fobjc-arc "$STAGE/build_icon.m" -framework Cocoa -o "$STAGE/build_icon"
"$STAGE/build_icon" "$STAGE/AppIcon.iconset"
iconutil -c icns "$STAGE/AppIcon.iconset" -o "$STAGED/Resources/AppIcon.icns"

xattr -cr "$STAGE/Diegetic.app"
codesign --force --deep --sign - "$STAGE/Diegetic.app"
codesign --verify --deep --strict "$STAGE/Diegetic.app"

mkdir -p "$ROOT/outputs"
rm -rf "$APP"
ditto "$STAGE/Diegetic.app" "$APP"
echo "Built: $APP"
