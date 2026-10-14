/* ============================================================
   RISO DOT TRAIL — portal-only cursor effect
   ============================================================

   A soft trail of risograph-style dots that follows the pointer
   and fades out. Every dot is stamped twice, the second print a
   hair out of register in another ink, like a cheap two-colour
   riso print.

   - Theme-aware. It reads <html data-theme="light|dark"> (the
     same attribute the portal toggle sets), so the inks switch
     the moment the theme changes, dots already on screen included.
   - Mid-tone inks at moderate opacity: clearly visible on the
     pale paper, the near-black dark theme and the dark sign-in
     slab, without ever looking heavy or washed out.
   - Pure decoration: pointer-events none, aria-hidden, never
     touches any other element, and is skipped entirely when the
     visitor prefers reduced motion.
   - Idle-friendly: the animation loop only runs while there are
     dots on screen.

   TO TUNE: edit the SETTINGS block just below.
   TO REMOVE: delete the one <script src="riso-trail.js"> line
   from index.html.
   ============================================================ */

(function () {
  "use strict";

  if (window.__risoTrail) return;
  window.__risoTrail = true;

  /* ---- SETTINGS you can safely edit ------------------------ */
  var SETTINGS = {
    spacing:   15,     // px of pointer travel between stamps (bigger = sparser)
    life:      950,    // ms a dot stays on screen
    minR:      3.2,    // dot radius range, px
    maxR:      5.6,
    maxDots:   140,    // hard cap, keeps it light on slow machines
    offset:    2.4,    // misregistration of the second print, px
    z:         2147482000   // just below the Mirage widget (2147483000)
  };

  /* Inks per theme. rgb + peak alpha. "Not too dark, not too light":
     mid-luminance colours at ~0.4-0.5 opacity. Light theme uses
     deeper, saturated inks (they have to read on pale paper); dark
     theme uses brighter tints (they have to read on near-black). */
  var INKS = {
    light: [
      { rgb: "233,67,128",  a: 0.46 },   // riso pink
      { rgb: "36,112,205",  a: 0.44 },   // riso blue
      { rgb: "240,132,38",  a: 0.46 }    // riso orange
    ],
    dark: [
      { rgb: "255,122,184", a: 0.50 },   // pink
      { rgb: "70,214,204",  a: 0.46 },   // aqua
      { rgb: "255,201,77",  a: 0.48 }    // sun yellow
    ]
  };
  /* ---------------------------------------------------------- */

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce && reduce.matches) return;

  var root = document.documentElement;
  var canvas, ctx, dpr = 1, w = 0, h = 0;
  var dots = [];
  var running = false;
  var lastX = null, lastY = null, carry = 0;

  function theme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function build() {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.id = "riso-trail";
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:" + SETTINGS.z + ";";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* one stamp = a main dot + a slightly off-register second ink */
  function stamp(x, y, now) {
    var n = INKS.light.length;
    var i = Math.floor(Math.random() * n);
    var j = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    var r = rand(SETTINGS.minR, SETTINGS.maxR);
    var ang = Math.random() * Math.PI * 2;
    dots.push({
      x: x + rand(-2, 2), y: y + rand(-2, 2), r: r,
      ink: i, ink2: j,
      dx: Math.cos(ang) * SETTINGS.offset,
      dy: Math.sin(ang) * SETTINGS.offset,
      t0: now
    });
    if (dots.length > SETTINGS.maxDots) dots.splice(0, dots.length - SETTINGS.maxDots);
  }

  function onMove(e) {
    var x = e.clientX, y = e.clientY;
    var now = performance.now();
    if (lastX === null) {
      lastX = x; lastY = y; carry = SETTINGS.spacing;
    }
    var dx = x - lastX, dy = y - lastY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      /* walk along the segment so fast flicks still leave an even dotted line */
      var d = SETTINGS.spacing - carry;
      while (d <= dist) {
        var k = d / dist;
        stamp(lastX + dx * k, lastY + dy * k, now);
        d += SETTINGS.spacing;
      }
      carry = dist - (d - SETTINGS.spacing);
    }
    lastX = x; lastY = y;
    start();
  }

  function onLeave() { lastX = null; lastY = null; carry = 0; }

  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    var palette = INKS[theme()];
    var alive = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var p = (now - d.t0) / SETTINGS.life;
      if (p >= 1) continue;
      alive.push(d);

      /* quick fade-in, long soft fade-out; dot shrinks a little as it goes */
      var fade = p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88;
      fade = fade * fade * (3 - 2 * fade);
      var r = d.r * (1 - 0.35 * p);

      var a = palette[d.ink % palette.length];
      ctx.fillStyle = "rgba(" + a.rgb + "," + (a.a * fade).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, 6.2832);
      ctx.fill();

      var b = palette[d.ink2 % palette.length];
      ctx.fillStyle = "rgba(" + b.rgb + "," + (b.a * 0.7 * fade).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(d.x + d.dx, d.y + d.dy, r * 0.82, 0, 6.2832);
      ctx.fill();
    }
    dots = alive;
    if (dots.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function init() {
    build();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { dots = []; onLeave(); }
    });
    if (reduce && reduce.addEventListener) {
      reduce.addEventListener("change", function () {
        if (reduce.matches) { dots = []; if (ctx) ctx.clearRect(0, 0, w, h); }
      });
    }
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
