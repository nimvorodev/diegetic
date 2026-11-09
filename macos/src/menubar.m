#import <Cocoa/Cocoa.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#include "border.h"
#include "telemetry.h"
#include "windows.h"

extern struct table g_windows;
extern void cobweb_on_config_changed(void);

static NSMutableSet<NSString *> *g_app_exceptions = nil;
static BOOL g_apps_on_by_default = YES;

bool cobweb_pid_hidden(pid_t pid) {
  @autoreleasepool {
    NSRunningApplication *app =
        [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    NSString *bid = app.bundleIdentifier;
    if (!bid.length)
      return !g_apps_on_by_default;
    BOOL inSet = [g_app_exceptions containsObject:bid];
    return g_apps_on_by_default ? inSet : !inSet;
  }
}

static NSImage *cobweb_status_icon(void) {
  NSImage *img = [NSImage
      imageWithSize:NSMakeSize(18, 18)
            flipped:NO
     drawingHandler:^BOOL(NSRect dstRect) {
       (void)dstRect;
       [[NSColor blackColor] setStroke];
       [[NSColor blackColor] setFill];

       NSBezierPath *frame =
           [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(2, 2.5, 14, 13)
                                           xRadius:2.5
                                           yRadius:2.5];
       frame.lineWidth = 1.4;
       [frame stroke];

       // Corner cobweb spokes & arc inside menu bar icon
       NSBezierPath *web = [NSBezierPath bezierPath];
       web.lineWidth = 1.05;
       web.lineCapStyle = NSLineCapStyleRound;
       [web moveToPoint:NSMakePoint(2.5, 15.0)];
       [web lineToPoint:NSMakePoint(11.5, 15.0)];
       [web moveToPoint:NSMakePoint(2.5, 15.0)];
       [web lineToPoint:NSMakePoint(9.5, 8.0)];
       [web moveToPoint:NSMakePoint(2.5, 15.0)];
       [web lineToPoint:NSMakePoint(2.5, 6.0)];

       [web moveToPoint:NSMakePoint(6.8, 15.0)];
       [web curveToPoint:NSMakePoint(2.5, 10.7)
           controlPoint1:NSMakePoint(6.2, 12.6)
           controlPoint2:NSMakePoint(4.8, 11.2)];
       [web moveToPoint:NSMakePoint(10.2, 15.0)];
       [web curveToPoint:NSMakePoint(2.5, 7.3)
           controlPoint1:NSMakePoint(9.2, 11.2)
           controlPoint2:NSMakePoint(6.2, 8.2)];
       [web stroke];

       // Tiny hanging spider dot
       NSBezierPath *spider =
           [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(10.5, 6.5, 3.0, 3.0)];
       [spider fill];
       return YES;
     }];
  [img setTemplate:YES];
  return img;
}

static void cobweb_save_prefs(void) {
  NSUserDefaults *d = NSUserDefaults.standardUserDefaults;
  [d setBool:g_diegetic_enabled forKey:@"enabled"];
  [d setInteger:(NSInteger)g_diegetic_style forKey:@"style"];
  [d setFloat:g_cobweb_after_seconds forKey:@"cobwebAfterSeconds"];
  [d setFloat:g_border_width forKey:@"borderWidth"];
  [d setBool:g_apps_on_by_default forKey:@"appsOnByDefault"];
  [d setObject:g_app_exceptions.allObjects ?: @[] forKey:@"appExceptions"];
}

static void cobweb_load_prefs(void) {
  NSUserDefaults *d = NSUserDefaults.standardUserDefaults;
  [d registerDefaults:@{
    @"enabled" : @YES,
    @"style" : @(DIEGETIC_STYLE_ORGANIC),
    @"cobwebAfterSeconds" : @7200.0f,
    @"borderWidth" : @14.0f,
    @"appsOnByDefault" : @YES,
    @"appExceptions" : @[]
  }];

  g_diegetic_enabled = [d boolForKey:@"enabled"];
  NSInteger st = [d integerForKey:@"style"];
  g_diegetic_style = (st == DIEGETIC_STYLE_PIXEL) ? DIEGETIC_STYLE_PIXEL
                                                  : DIEGETIC_STYLE_ORGANIC;
  float delay = [d floatForKey:@"cobwebAfterSeconds"];
  if (delay >= 60.0f && delay <= 86400.0f)
    g_cobweb_after_seconds = delay;
  float bw = [d floatForKey:@"borderWidth"];
  if (bw >= 6.0f && bw <= 32.0f)
    g_border_width = bw;

  g_apps_on_by_default = [d boolForKey:@"appsOnByDefault"];
  g_app_exceptions = [NSMutableSet set];
  NSArray *saved = [d arrayForKey:@"appExceptions"];
  for (id item in saved) {
    if ([item isKindOfClass:NSString.class])
      [g_app_exceptions addObject:item];
  }
}

@interface CobwebMenu : NSObject <NSMenuDelegate>
@property(strong) NSStatusItem *item;
@property(strong) id activity;
@end

@implementation CobwebMenu

- (void)updateStatus {
  if (g_diegetic_enabled && !self.activity) {
    self.activity = [NSProcessInfo.processInfo
        beginActivityWithOptions:NSActivityUserInitiatedAllowingIdleSystemSleep
                          reason:@"Keep Diegetic window states synchronized"];
  } else if (!g_diegetic_enabled && self.activity) {
    [NSProcessInfo.processInfo endActivity:self.activity];
    self.activity = nil;
  }
  self.item.button.alphaValue = g_diegetic_enabled ? 1.0 : 0.45;
  self.item.button.toolTip =
      g_diegetic_enabled ? @"Diegetic — active"
                         : @"Diegetic — paused";
}

- (void)toggleEnabled:(id)sender {
  (void)sender;
  g_diegetic_enabled = !g_diegetic_enabled;
  cobweb_save_prefs();
  [self updateStatus];
  cobweb_on_config_changed();
}

- (void)selectStyle:(NSMenuItem *)sender {
  g_diegetic_style = (enum diegetic_style)[sender.representedObject intValue];
  cobweb_save_prefs();
  cobweb_on_config_changed();
}

- (void)selectDelay:(NSMenuItem *)sender {
  g_cobweb_after_seconds = [sender.representedObject floatValue];
  cobweb_save_prefs();
  cobweb_on_config_changed();
}

- (void)selectWidth:(NSMenuItem *)sender {
  g_border_width = [sender.representedObject floatValue];
  cobweb_save_prefs();
  cobweb_on_config_changed();
}

- (void)selectPreview:(NSMenuItem *)sender {
  g_test_override =
      (enum diegetic_test_override)[sender.representedObject intValue];
  cobweb_on_config_changed();
}

- (void)brushAllNow:(id)sender {
  (void)sender;
  g_test_override = TEST_OVERRIDE_NONE;
  for (uint32_t i = 0; i < g_windows.capacity; i++) {
    for (struct bucket *b = g_windows.buckets[i]; b; b = b->next) {
      struct border *border = b->value;
      if (border) {
        telemetry_trigger_brush(&border->telemetry);
        border->needs_redraw = true;
      }
    }
  }
  cobweb_on_config_changed();
}

- (void)toggleApp:(NSMenuItem *)sender {
  NSString *bid = sender.representedObject;
  if (!bid.length)
    return;
  if ([g_app_exceptions containsObject:bid])
    [g_app_exceptions removeObject:bid];
  else
    [g_app_exceptions addObject:bid];
  cobweb_save_prefs();
  windows_apply_app_filter(&g_windows);
}

- (void)setAllApps:(NSMenuItem *)sender {
  g_apps_on_by_default = [sender.representedObject boolValue];
  [g_app_exceptions removeAllObjects];
  cobweb_save_prefs();
  windows_apply_app_filter(&g_windows);
}

- (void)quitApp:(id)sender {
  (void)sender;
  [NSApp terminate:nil];
}

- (NSMenuItem *)addItem:(NSMenu *)menu
                  title:(NSString *)title
                 action:(SEL)action
                    obj:(id)obj
                checked:(BOOL)checked {
  NSMenuItem *mi = [[NSMenuItem alloc] initWithTitle:title
                                              action:action
                                       keyEquivalent:@""];
  mi.target = self;
  mi.representedObject = obj;
  mi.state = checked ? NSControlStateValueOn : NSControlStateValueOff;
  mi.enabled = YES;
  [menu addItem:mi];
  return mi;
}

- (NSMenu *)addSubmenu:(NSMenu *)menu title:(NSString *)title {
  NSMenu *sub = [[NSMenu alloc] initWithTitle:title];
  sub.autoenablesItems = NO;
  NSMenuItem *mi = [[NSMenuItem alloc] initWithTitle:title
                                              action:nil
                                       keyEquivalent:@""];
  mi.submenu = sub;
  mi.enabled = YES;
  [menu addItem:mi];
  return sub;
}

- (void)buildAppsMenu:(NSMenu *)menu {
  int pids[512];
  int ownerCount = windows_eligible_owners(pids, 512);
  NSMutableSet<NSNumber *> *ownerSet = [NSMutableSet set];
  for (int i = 0; i < ownerCount; i++)
    [ownerSet addObject:@(pids[i])];

  pid_t selfPid = NSProcessInfo.processInfo.processIdentifier;
  NSMutableArray<NSRunningApplication *> *apps = [NSMutableArray array];
  NSMutableSet<NSString *> *seen = [NSMutableSet set];

  for (NSRunningApplication *app in NSWorkspace.sharedWorkspace.runningApplications) {
    if (app.processIdentifier == selfPid || !app.bundleIdentifier.length)
      continue;
    if ([seen containsObject:app.bundleIdentifier])
      continue;
    BOOL regular =
        (app.activationPolicy == NSApplicationActivationPolicyRegular);
    BOOL hasWin = [ownerSet containsObject:@(app.processIdentifier)];
    if (!regular && !hasWin)
      continue;
    [seen addObject:app.bundleIdentifier];
    [apps addObject:app];
  }

  [apps sortUsingComparator:^NSComparisonResult(NSRunningApplication *a,
                                                NSRunningApplication *b) {
    NSString *na = a.localizedName ?: a.bundleIdentifier;
    NSString *nb = b.localizedName ?: b.bundleIdentifier;
    return [na localizedStandardCompare:nb];
  }];

  for (NSRunningApplication *app in apps) {
    NSString *title = app.localizedName ?: app.bundleIdentifier;
    BOOL hidden = cobweb_pid_hidden(app.processIdentifier);
    NSMenuItem *mi = [self addItem:menu
                             title:title
                            action:@selector(toggleApp:)
                               obj:app.bundleIdentifier
                           checked:!hidden];
    if (app.icon) {
      NSImage *small = [app.icon copy];
      small.size = NSMakeSize(16, 16);
      mi.image = small;
    }
  }

  [menu addItem:[NSMenuItem separatorItem]];
  [self addItem:menu
          title:@"Turn On for All Apps"
         action:@selector(setAllApps:)
            obj:@YES
        checked:NO];
  [self addItem:menu
          title:@"Turn Off for All Apps"
         action:@selector(setAllApps:)
            obj:@NO
        checked:NO];
}

- (void)rebuild:(NSMenu *)menu {
  [menu removeAllItems];
  [self addItem:menu
          title:@"Show Cobwebs & Frost"
         action:@selector(toggleEnabled:)
            obj:nil
        checked:g_diegetic_enabled];

  [self buildAppsMenu:[self addSubmenu:menu title:@"Apps"]];

  NSMenu *styleMenu = [self addSubmenu:menu title:@"Style"];
  [self addItem:styleMenu
          title:@"Organic Procedural (Silk & Cast Iron)"
         action:@selector(selectStyle:)
            obj:@(DIEGETIC_STYLE_ORGANIC)
        checked:g_diegetic_style == DIEGETIC_STYLE_ORGANIC];
  [self addItem:styleMenu
          title:@"8-Bit Pixel Art (Retro Webs & Rime)"
         action:@selector(selectStyle:)
            obj:@(DIEGETIC_STYLE_PIXEL)
        checked:g_diegetic_style == DIEGETIC_STYLE_PIXEL];

  NSMenu *delayMenu = [self addSubmenu:menu title:@"Cobweb Delay"];
  [self addItem:delayMenu
          title:@"30 Minutes Unfocused"
         action:@selector(selectDelay:)
            obj:@1800.0f
        checked:fabsf(g_cobweb_after_seconds - 1800.0f) < 10.0f];
  [self addItem:delayMenu
          title:@"2 Hours Unfocused (Default)"
         action:@selector(selectDelay:)
            obj:@7200.0f
        checked:fabsf(g_cobweb_after_seconds - 7200.0f) < 10.0f];
  [self addItem:delayMenu
          title:@"4 Hours Unfocused"
         action:@selector(selectDelay:)
            obj:@14400.0f
        checked:fabsf(g_cobweb_after_seconds - 14400.0f) < 10.0f];

  NSMenu *widthMenu = [self addSubmenu:menu title:@"Border Width"];
  [self addItem:widthMenu
          title:@"Thin · 10 pt"
         action:@selector(selectWidth:)
            obj:@10.0f
        checked:fabsf(g_border_width - 10.0f) < 0.5f];
  [self addItem:widthMenu
          title:@"Medium · 14 pt"
         action:@selector(selectWidth:)
            obj:@14.0f
        checked:fabsf(g_border_width - 14.0f) < 0.5f];
  [self addItem:widthMenu
          title:@"Thick · 20 pt"
         action:@selector(selectWidth:)
            obj:@20.0f
        checked:fabsf(g_border_width - 20.0f) < 0.5f];

  NSMenu *previewMenu = [self addSubmenu:menu title:@"Preview Effects"];
  [self addItem:previewMenu
          title:@"Live System Telemetry (Default)"
         action:@selector(selectPreview:)
            obj:@(TEST_OVERRIDE_NONE)
        checked:g_test_override == TEST_OVERRIDE_NONE];
  [self addItem:previewMenu
          title:@"Simulate: Cobwebs (>2h Unfocused)"
         action:@selector(selectPreview:)
            obj:@(TEST_OVERRIDE_COBWEBS)
        checked:g_test_override == TEST_OVERRIDE_COBWEBS];
  [self addItem:previewMenu
          title:@"Simulate: Red-Hot Cast Iron"
         action:@selector(selectPreview:)
            obj:@(TEST_OVERRIDE_HEAT)
        checked:g_test_override == TEST_OVERRIDE_HEAT];
  [self addItem:previewMenu
          title:@"Simulate: Frosted Idle Edges"
         action:@selector(selectPreview:)
            obj:@(TEST_OVERRIDE_FROST)
        checked:g_test_override == TEST_OVERRIDE_FROST];
  [previewMenu addItem:[NSMenuItem separatorItem]];
  [self addItem:previewMenu
          title:@"Brush All Cobwebs Now"
         action:@selector(brushAllNow:)
            obj:nil
        checked:NO];

  [menu addItem:[NSMenuItem separatorItem]];
  NSMenuItem *quit = [[NSMenuItem alloc] initWithTitle:@"Quit Diegetic"
                                                action:@selector(quitApp:)
                                         keyEquivalent:@"q"];
  quit.target = self;
  quit.enabled = YES;
  [menu addItem:quit];
}

- (void)menuNeedsUpdate:(NSMenu *)menu {
  [self updateStatus];
  [self rebuild:menu];
}

@end

static CobwebMenu *g_menu = nil;

@interface CobwebAppDelegate : NSObject <NSApplicationDelegate>
@end

@implementation CobwebAppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)note {
  (void)note;
  g_menu.item = [[NSStatusBar systemStatusBar]
      statusItemWithLength:NSSquareStatusItemLength];
  g_menu.item.button.image = cobweb_status_icon();
  [g_menu.item.button setAccessibilityLabel:@"Diegetic"];

  NSMenu *menu = [[NSMenu alloc] initWithTitle:@"Diegetic"];
  menu.autoenablesItems = NO;
  [g_menu rebuild:menu];
  menu.delegate = g_menu;
  g_menu.item.menu = menu;
  [g_menu updateStatus];
}
@end

static CobwebAppDelegate *g_delegate = nil;

void cobweb_menubar_init(void) {
  @autoreleasepool {
    [NSApplication.sharedApplication
        setActivationPolicy:NSApplicationActivationPolicyAccessory];
    cobweb_load_prefs();
  }
}

void cobweb_menubar_run(void) {
  @autoreleasepool {
    NSApplication *app = NSApplication.sharedApplication;
    g_menu = [[CobwebMenu alloc] init];
    g_delegate = [[CobwebAppDelegate alloc] init];
    app.delegate = g_delegate;
    [app setActivationPolicy:NSApplicationActivationPolicyAccessory];
    [app run];
  }
}
