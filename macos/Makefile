CFILES = src/main.c src/hashtable.c src/telemetry.c src/diegetic_draw.c \
         src/border.c src/windows.c src/events.c

LIBS = -framework AppKit -framework Cocoa -framework CoreVideo \
       -framework ApplicationServices -framework QuartzCore \
       -F/System/Library/PrivateFrameworks/ -framework SkyLight

# Universal binary for Apple Silicon (arm64) and Intel (x86_64)
ARCHS = -arch arm64 -arch x86_64
DEPLOY = -mmacosx-version-min=13.0

.PHONY: all debug clean

all: | bin
	clang $(ARCHS) $(DEPLOY) -O3 -g -Isrc -fobjc-arc -c src/menubar.m -o bin/menubar.o
	clang $(ARCHS) $(DEPLOY) -std=c99 -O3 -g -Isrc $(CFILES) bin/menubar.o -o bin/cobwebs $(LIBS)

debug: | bin
	clang -O0 -g -Isrc -fobjc-arc -c src/menubar.m -o bin/menubar.o
	clang -std=c99 -O0 -g -DDEBUG -Isrc $(CFILES) bin/menubar.o -o bin/cobwebs-debug $(LIBS)

bin:
	mkdir -p bin

clean:
	rm -rf bin outputs
