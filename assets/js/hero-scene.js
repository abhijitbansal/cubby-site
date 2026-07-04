/* Cubby marketing hero — Three.js "rack wall" scene.
 *
 * Ported from design_handoff_website/source/Cubby Website.dc.html's
 * initThree()/tick()/updateTag() logic. The prototype drove its render loop
 * from a setInterval-based window.__cubbyTick hack because its authoring
 * runtime didn't emit scroll events or a real requestAnimationFrame — this
 * port intentionally does NOT carry that over. Instead:
 *   - the render loop is a normal requestAnimationFrame loop,
 *   - it is started/stopped by an IntersectionObserver watching the hero
 *     section (no GPU/battery spend while scrolled away),
 *   - prefers-reduced-motion freezes the idle bob/sway/particle-drift
 *     animations; a single frame is still rendered (drag-to-orbit still
 *     works, it just renders on demand instead of every tick).
 *
 * Geometry, materials, lighting and camera numbers are unchanged from the
 * design spec (README "3D hero spec" section).
 */
(function () {
  'use strict';

  var mount = document.getElementById('scene');
  var heroEl = document.getElementById('hero');
  var tagEl = document.querySelector('[data-hero-tag]');
  if (!mount || !heroEl || !window.THREE) return;

  var T = window.THREE;
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var state = {
    reduce: !!(reduceMQ && reduceMQ.matches),
    dragging: false,
    userRotY: 0,
    velY: 0,
    px: 0, py: 0, tpx: 0, tpy: 0,
    w: 0, h: 0
  };

  var scene, camera, renderer, world, clock;
  var goldGroup, goldMat, goldLight, goldBaseY, particles, pBot, pTop;
  var rackBottomY = 0, rackTotalW = 0, rackRows = 3, rackCellH = 0;

  function buildScene() {
    var w = mount.clientWidth || 800, h = mount.clientHeight || 600;
    state.w = w; state.h = h;

    scene = new T.Scene();
    scene.fog = new T.FogExp2(0x0a1424, 0.03);
    camera = new T.PerspectiveCamera(40, w / h, 0.1, 120);
    camera.position.set(0, 1.7, 12.8);

    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    if ('outputEncoding' in renderer) renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab';
    mount.appendChild(renderer.domElement);

    scene.add(new T.HemisphereLight(0x9fb8e0, 0x0a1220, 0.6));
    var key = new T.DirectionalLight(0xfff1d9, 1.15);
    key.position.set(7, 12, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 44;
    key.shadow.camera.left = -13;
    key.shadow.camera.right = 13;
    key.shadow.camera.top = 13;
    key.shadow.camera.bottom = -13;
    key.shadow.bias = -0.0006;
    scene.add(key);
    var rim = new T.DirectionalLight(0x2e5f9e, 0.85);
    rim.position.set(-9, 4, -7);
    scene.add(rim);
    var fill = new T.DirectionalLight(0x88a6cf, 0.32);
    fill.position.set(-4, 6, 11);
    scene.add(fill);

    world = new T.Group();
    world.position.set(0.5, -0.15, 0);
    scene.add(world);

    buildRack();
    buildParticles();

    camera.lookAt(0.5, 0.55, 0);
    clock = new T.Clock();
  }

  function buildRack() {
    var cols = 4, rows = 3, binW = 1.78, binH = 1.2, binD = 1.42, gx = 0.44, gyExtra = 0.6, shelfH = 0.1;
    var cellH = binH + shelfH + gyExtra;
    var totalW = cols * binW + (cols - 1) * gx;
    var x0 = -totalW / 2 + binW / 2;
    var bottomY = -((rows * cellH) / 2) + 0.25;
    var goldC = 2, goldR = 1;
    rackBottomY = bottomY;
    rackTotalW = totalW;
    rackRows = rows;
    rackCellH = cellH;

    var lidMat = new T.MeshStandardMaterial({ color: 0x7c93bb, transparent: true, opacity: 0.62, roughness: 0.32 });
    var labelMat = new T.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.6, emissive: 0x1a2a44, emissiveIntensity: 0.16 });
    var metalMat = new T.MeshStandardMaterial({ color: 0x223251, roughness: 0.42, metalness: 0.55 });
    var plankMat = new T.MeshStandardMaterial({ color: 0x18253c, roughness: 0.5, metalness: 0.35 });
    var tubMat = function () {
      return new T.MeshStandardMaterial({ color: 0x9db4d6, transparent: true, opacity: 0.4, roughness: 0.2, metalness: 0.0, depthWrite: false });
    };

    for (var r = 0; r <= rows; r++) {
      var y = bottomY + r * cellH - shelfH / 2;
      var plank = new T.Mesh(new T.BoxGeometry(totalW + 0.95, shelfH, binD + 0.5), plankMat);
      plank.position.set(0, y, 0);
      plank.receiveShadow = true;
      plank.castShadow = true;
      world.add(plank);
    }
    var postH = rows * cellH + 0.25;
    var postY = bottomY + (rows * cellH) / 2 - shelfH / 2;
    [-1, 1].forEach(function (s) {
      var post = new T.Mesh(new T.BoxGeometry(0.17, postH, binD + 0.5), metalMat);
      post.position.set(s * (totalW / 2 + 0.42), postY, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      world.add(post);
    });
    var back = new T.Mesh(
      new T.BoxGeometry(totalW + 0.95, postH, 0.08),
      new T.MeshStandardMaterial({ color: 0x0e1b31, roughness: 0.9, transparent: true, opacity: 0.55 })
    );
    back.position.set(0, postY, -(binD / 2 + 0.24));
    world.add(back);

    var goldColor = new T.Color('#D9A93F');
    for (var rr = 0; rr < rows; rr++) {
      for (var c = 0; c < cols; c++) {
        var isGold = (c === goldC && rr === goldR);
        var x = x0 + c * (binW + gx);
        var by = bottomY + rr * cellH + binH / 2;
        var g = new T.Group();
        g.position.set(x, by, 0.06);
        var body;
        if (isGold) {
          var gm = new T.MeshStandardMaterial({
            color: goldColor.clone(),
            emissive: goldColor.clone().multiplyScalar(0.62),
            emissiveIntensity: 0.9,
            roughness: 0.34,
            metalness: 0.28
          });
          goldMat = gm;
          body = new T.Mesh(new T.BoxGeometry(binW, binH, binD), gm);
          body.castShadow = true;
        } else {
          body = new T.Mesh(new T.BoxGeometry(binW, binH, binD), tubMat());
        }
        g.add(body);

        var lid = new T.Mesh(
          new T.BoxGeometry(binW + 0.06, 0.15, binD + 0.06),
          isGold ? new T.MeshStandardMaterial({ color: goldColor.clone().multiplyScalar(0.85), roughness: 0.4, metalness: 0.22 }) : lidMat
        );
        lid.position.y = binH / 2 + 0.045;
        if (isGold) lid.castShadow = true;
        g.add(lid);

        var label = new T.Mesh(
          new T.PlaneGeometry(binW * 0.42, binH * 0.46),
          isGold ? new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cf, emissiveIntensity: 0.55, roughness: 0.5 }) : labelMat
        );
        label.position.set(0, -0.02, binD / 2 + 0.012);
        g.add(label);

        var bar = new T.Mesh(new T.PlaneGeometry(binW * 0.3, 0.055), new T.MeshBasicMaterial({ color: isGold ? 0x8a6a12 : 0x9aa6bd }));
        bar.position.set(0, -0.15, binD / 2 + 0.014);
        g.add(bar);

        world.add(g);

        if (isGold) {
          goldGroup = g;
          goldBaseY = by;
          var pin = new T.Mesh(
            new T.ConeGeometry(0.14, 0.32, 22),
            new T.MeshStandardMaterial({ color: goldColor.clone(), emissive: goldColor.clone().multiplyScalar(0.5), emissiveIntensity: 0.7, roughness: 0.35 })
          );
          pin.rotation.x = Math.PI;
          pin.position.set(0, binH / 2 + 0.56, 0);
          g.add(pin);
          var ball = new T.Mesh(new T.SphereGeometry(0.085, 18, 18), new T.MeshBasicMaterial({ color: 0xfff0cf }));
          ball.position.set(0, binH / 2 + 0.74, 0);
          g.add(ball);
          goldLight = new T.PointLight(goldColor.getHex(), 2.0, 9, 2.2);
          goldLight.position.set(x, by + 0.2, binD / 2 + 1.0);
          world.add(goldLight);
        }
      }
    }

    var ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShadowMaterial({ opacity: 0.34 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = bottomY - 0.06;
    ground.receiveShadow = true;
    world.add(ground);
  }

  function buildParticles() {
    var N = 150;
    var geo = new T.BufferGeometry();
    var arr = new Float32Array(N * 3);
    pBot = rackBottomY - 1;
    pTop = rackBottomY + rackRows * rackCellH + 3.5;
    for (var i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * rackTotalW * 2.4;
      arr[i * 3 + 1] = pBot + Math.random() * (pTop - pBot);
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5 + Math.random() * 3;
    }
    geo.setAttribute('position', new T.BufferAttribute(arr, 3));
    particles = new T.Points(
      geo,
      new T.PointsMaterial({ color: 0xe7d6a6, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending })
    );
    world.add(particles);
  }

  function updateTag() {
    if (!tagEl || !goldGroup) return;
    var v = new T.Vector3();
    goldGroup.getWorldPosition(v);
    v.y += 0.98;
    v.project(camera);
    var x = (v.x * 0.5 + 0.5) * state.w;
    var y = (-v.y * 0.5 + 0.5) * state.h;
    var visible = v.z < 1 && x > -80 && x < state.w + 80;
    tagEl.style.opacity = visible ? '1' : '0';
    tagEl.style.transform = 'translate(-50%,-100%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }

  function renderFrame() {
    var t = clock.getElapsedTime();
    var reduce = state.reduce;

    state.px += (state.tpx - state.px) * 0.06;
    state.py += (state.tpy - state.py) * 0.06;
    var sway = reduce ? 0 : Math.sin(t * 0.16) * 0.22;
    if (!state.dragging) {
      state.userRotY += state.velY;
      state.velY *= 0.94;
      if (Math.abs(state.velY) < 0.00002) state.velY = 0;
    }
    if (state.userRotY > 0.7) state.userRotY = 0.7;
    if (state.userRotY < -0.7) state.userRotY = -0.7;

    world.rotation.y = sway + state.userRotY + state.px * 0.2;
    world.rotation.x = -0.03 + state.py * 0.09;

    if (goldGroup) goldGroup.position.y = goldBaseY + (reduce ? 0 : Math.sin(t * 1.5) * 0.06);
    if (goldMat) goldMat.emissiveIntensity = reduce ? 1.0 : (0.85 + Math.sin(t * 2.1) * 0.28);
    if (goldLight) goldLight.intensity = reduce ? 2.0 : (1.9 + Math.sin(t * 2.1) * 0.7);

    if (particles && !reduce) {
      var p = particles.geometry.attributes.position;
      for (var i = 1; i < p.count * 3; i += 3) {
        p.array[i] += 0.004;
        if (p.array[i] > pTop) p.array[i] = pBot;
      }
      p.needsUpdate = true;
      particles.rotation.y = t * 0.02;
    }

    updateTag();
    renderer.render(scene, camera);
  }

  // `loopScheduled` tracks only whether the rAF loop is actively ticking —
  // kept separate from `heroVisible`/`state.reduce` so toggling either one
  // (scroll, or a live prefers-reduced-motion change) can correctly start
  // or stop the loop without getting stuck on a stale "already running" flag.
  var rafId = 0;
  var loopScheduled = false;

  function loop() {
    renderFrame();
    if (heroVisible && !state.reduce) {
      rafId = requestAnimationFrame(loop);
    } else {
      loopScheduled = false;
      rafId = 0;
    }
  }

  // Called whenever visibility or the reduced-motion preference changes.
  function syncLoop() {
    if (heroVisible && !state.reduce) {
      if (!loopScheduled) {
        loopScheduled = true;
        rafId = requestAnimationFrame(loop);
      }
      return;
    }
    if (loopScheduled) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      loopScheduled = false;
    }
    if (heroVisible) renderFrame(); // reduced motion, but still on-screen: one static frame
  }

  function renderOnceIfIdle() {
    // Under reduced motion the continuous loop is off; re-render on demand
    // so drag-to-orbit and resize still visibly respond.
    if (state.reduce && heroVisible) renderFrame();
  }

  function onPointerDown(e) {
    state.dragging = true;
    state._lastX = e.clientX;
    state.velY = 0;
    renderer.domElement.style.cursor = 'grabbing';
  }
  function onPointerMove(e) {
    var r = heroEl.getBoundingClientRect();
    state.tpx = ((e.clientX - r.left) / r.width) * 2 - 1;
    state.tpy = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (state.dragging) {
      var dx = e.clientX - state._lastX;
      state._lastX = e.clientX;
      var d = dx * 0.005;
      state.userRotY += d;
      state.velY = d * 0.4;
    }
    renderOnceIfIdle();
  }
  function onPointerUp() {
    state.dragging = false;
    if (renderer) renderer.domElement.style.cursor = 'grab';
    renderOnceIfIdle();
  }

  function onResize() {
    var w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    state.w = w; state.h = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderOnceIfIdle();
  }

  function onReduceChange() {
    state.reduce = !!(reduceMQ && reduceMQ.matches);
    syncLoop();
  }

  var heroVisible = false;
  var io = new IntersectionObserver(function (entries) {
    heroVisible = entries[0].isIntersecting;
    syncLoop();
  }, { threshold: 0 });

  try {
    buildScene();
  } catch (e) {
    console.warn('Cubby hero: Three.js scene failed to initialize, falling back to CSS poster.', e);
    if (tagEl) tagEl.style.display = 'none';
    return;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('resize', onResize);
  if (reduceMQ && reduceMQ.addEventListener) reduceMQ.addEventListener('change', onReduceChange);

  io.observe(heroEl);
})();
