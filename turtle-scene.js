// 3D Land Turtle scene built with vanilla Three.js primitives (no external models).
(function () {
  'use strict';

  var container = document.getElementById('scene-container');

  var scene = new THREE.Scene();

  // ---- Sky gradient background ----
  function makeSkyTexture() {
    var c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#bfe3ff');
    g.addColorStop(0.55, '#eaf6e0');
    g.addColorStop(1, '#dff0c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xeaf6e0, 14, 34);

  var camera = new THREE.PerspectiveCamera(
    42, container.clientWidth / container.clientHeight, 0.1, 100
  );
  camera.position.set(6.2, 4.4, 7.2);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3.5;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  // ---- Lighting ----
  var hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b8f4e, 0.7);
  scene.add(hemi);

  var sun = new THREE.DirectionalLight(0xfff3d6, 1.15);
  sun.position.set(6, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  var fill = new THREE.DirectionalLight(0xcfe8ff, 0.25);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  // ---- Ground ----
  function makeGrassTexture() {
    var size = 512;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#7fae4d';
    ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < 9000; i++) {
      var x = Math.random() * size;
      var y = Math.random() * size;
      var shade = 90 + Math.random() * 70;
      var g = 140 + Math.random() * 60;
      ctx.fillStyle = 'rgba(' + Math.floor(shade * 0.6) + ',' + Math.floor(g) + ',' + Math.floor(shade * 0.55) + ',0.5)';
      var len = 3 + Math.random() * 5;
      ctx.fillRect(x, y, 1.2, len);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var groundGeo = new THREE.CircleGeometry(16, 64);
  var groundMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // small decorative pebbles & tufts
  var pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.9 });
  for (var p = 0; p < 10; p++) {
    var pg = new THREE.SphereGeometry(0.05 + Math.random() * 0.09, 8, 8);
    var pebble = new THREE.Mesh(pg, pebbleMat);
    var ang = Math.random() * Math.PI * 2;
    var rad = 2.4 + Math.random() * 6;
    pebble.position.set(Math.cos(ang) * rad, 0.04, Math.sin(ang) * rad);
    pebble.scale.y = 0.6;
    pebble.castShadow = true;
    pebble.receiveShadow = true;
    scene.add(pebble);
  }

  var bladeMat = new THREE.MeshStandardMaterial({ color: 0x5f9a3a, roughness: 0.9, side: THREE.DoubleSide });
  for (var t = 0; t < 26; t++) {
    var tuftAng = Math.random() * Math.PI * 2;
    var tuftRad = 2.6 + Math.random() * 7;
    var tuft = new THREE.Group();
    tuft.position.set(Math.cos(tuftAng) * tuftRad, 0, Math.sin(tuftAng) * tuftRad);
    for (var b = 0; b < 4; b++) {
      var bg = new THREE.ConeGeometry(0.03, 0.28 + Math.random() * 0.18, 4);
      var blade = new THREE.Mesh(bg, bladeMat);
      blade.position.set((Math.random() - 0.5) * 0.15, 0.14, (Math.random() - 0.5) * 0.15);
      blade.rotation.z = (Math.random() - 0.5) * 0.5;
      blade.castShadow = true;
      tuft.add(blade);
    }
    scene.add(tuft);
  }

  // ---- Turtle shell scute texture ----
  function makeShellTexture() {
    var size = 512;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#5b7a35';
    ctx.fillRect(0, 0, size, size);

    var hexR = 46;
    var hexW = hexR * Math.sqrt(3);
    var hexH = hexR * 1.5;

    function hexPath(cx, cy, r) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        var x = cx + r * Math.cos(a);
        var y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    var row = 0;
    for (var y = -hexH; y < size + hexH; y += hexH) {
      var offsetX = (row % 2 === 0) ? 0 : hexW / 2;
      for (var x = -hexW; x < size + hexW; x += hexW) {
        var tone = 0.75 + Math.random() * 0.5;
        var rr = Math.floor(70 * tone + 30);
        var gg = Math.floor(105 * tone + 35);
        var bb = Math.floor(55 * tone + 15);
        ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
        hexPath(x + offsetX, y, hexR * 0.92);
        ctx.fill();
        ctx.strokeStyle = 'rgba(35,45,20,0.55)';
        ctx.lineWidth = 3;
        hexPath(x + offsetX, y, hexR * 0.92);
        ctx.stroke();
      }
      row++;
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeSkinTexture(base) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.06) + ')';
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var skinTex = makeSkinTexture('#9cb154');
  var skinMat = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.75, color: 0xffffff });
  var shellTopMat = new THREE.MeshStandardMaterial({ map: makeShellTexture(), roughness: 0.55 });
  var plastronMat = new THREE.MeshStandardMaterial({ color: 0xe4c98f, roughness: 0.7 });
  var clawMat = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.4 });
  var eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.3 });

  // ---- Turtle assembly ----
  var turtle = new THREE.Group();
  scene.add(turtle);

  var shellHeight = 0.95;

  // Shell top (dome)
  var shellTopGeo = new THREE.SphereGeometry(1.35, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  var shellTop = new THREE.Mesh(shellTopGeo, shellTopMat);
  shellTop.scale.set(1, 0.72, 1.28);
  shellTop.position.y = shellHeight;
  shellTop.castShadow = true;
  shellTop.receiveShadow = true;
  turtle.add(shellTop);

  // Plastron (belly plate)
  var plastronGeo = new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.6);
  var plastron = new THREE.Mesh(plastronGeo, plastronMat);
  plastron.scale.set(0.98, 0.4, 1.24);
  plastron.position.y = shellHeight - 0.02;
  plastron.receiveShadow = true;
  turtle.add(plastron);

  // Shell rim
  var rimGeo = new THREE.TorusGeometry(1.28, 0.07, 10, 40);
  var rimMat = new THREE.MeshStandardMaterial({ color: 0xcbb27a, roughness: 0.7 });
  var rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.26, 1);
  rim.position.y = shellHeight - 0.06;
  rim.castShadow = true;
  turtle.add(rim);

  // Head group (neck pivot for animation)
  var neckPivot = new THREE.Group();
  neckPivot.position.set(0, shellHeight - 0.15, 1.55);
  turtle.add(neckPivot);

  var neckGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.5, 16);
  var neck = new THREE.Mesh(neckGeo, skinMat);
  neck.rotation.x = Math.PI / 2.4;
  neck.position.set(0, 0.05, 0.05);
  neck.castShadow = true;
  neckPivot.add(neck);

  var headGeo = new THREE.SphereGeometry(0.34, 24, 20);
  var head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.28, 0.42);
  head.scale.set(0.9, 0.85, 1.15);
  head.castShadow = true;
  neckPivot.add(head);

  var snoutGeo = new THREE.SphereGeometry(0.16, 16, 14);
  var snout = new THREE.Mesh(snoutGeo, skinMat);
  snout.position.set(0, 0.24, 0.74);
  snout.scale.set(0.75, 0.6, 0.8);
  snout.castShadow = true;
  neckPivot.add(snout);

  var eyeGeo = new THREE.SphereGeometry(0.045, 10, 10);
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.24, 0.36, 0.58);
  neckPivot.add(eyeL);
  var eyeR = eyeL.clone();
  eyeR.position.x = -0.24;
  neckPivot.add(eyeR);

  // Tail
  var tailGeo = new THREE.ConeGeometry(0.14, 0.5, 12);
  var tail = new THREE.Mesh(tailGeo, skinMat);
  tail.position.set(0, shellHeight - 0.35, -1.55);
  tail.rotation.x = -Math.PI / 2.15;
  tail.castShadow = true;
  turtle.add(tail);

  // Legs (front + back), each is a group we can animate
  function makeLeg(isFront) {
    var group = new THREE.Group();

    var upperGeo = new THREE.CylinderGeometry(0.22, 0.19, 0.5, 14);
    var upper = new THREE.Mesh(upperGeo, skinMat);
    upper.position.y = -0.2;
    upper.rotation.z = isFront ? 0.35 : 0.22;
    upper.castShadow = true;
    group.add(upper);

    var footGeo = new THREE.SphereGeometry(0.24, 16, 12);
    var foot = new THREE.Mesh(footGeo, skinMat);
    foot.scale.set(1.05, 0.55, 1.15);
    foot.position.set(isFront ? 0.16 : 0.1, -0.46, isFront ? 0.08 : 0);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);

    for (var i = 0; i < 4; i++) {
      var clawGeo = new THREE.ConeGeometry(0.035, 0.14, 8);
      var claw = new THREE.Mesh(clawGeo, clawMat);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(
        (isFront ? 0.16 : 0.1) + (i - 1.5) * 0.09,
        -0.5,
        (isFront ? 0.08 : 0) + 0.18
      );
      claw.castShadow = true;
      group.add(claw);
    }

    return group;
  }

  var legFL = makeLeg(true);
  legFL.position.set(0.95, shellHeight - 0.35, 0.95);
  legFL.rotation.y = 0.5;
  turtle.add(legFL);

  var legFR = makeLeg(true);
  legFR.position.set(-0.95, shellHeight - 0.35, 0.95);
  legFR.rotation.y = -0.5;
  legFR.scale.x = -1;
  turtle.add(legFR);

  var legBL = makeLeg(false);
  legBL.position.set(0.92, shellHeight - 0.35, -0.95);
  legBL.rotation.y = 2.6;
  turtle.add(legBL);

  var legBR = makeLeg(false);
  legBR.position.set(-0.92, shellHeight - 0.35, -0.95);
  legBR.rotation.y = -2.6;
  legBR.scale.x = -1;
  turtle.add(legBR);

  turtle.position.y = 0.02;

  // ---- Animation loop: gentle idle motion + slow auto-rotate ----
  var clock = new THREE.Clock();
  var autoRotate = true;

  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    if (autoRotate) {
      turtle.rotation.y += 0.0022;
    }

    // breathing / bob
    turtle.position.y = 0.02 + Math.sin(t * 1.2) * 0.015;

    // head sway
    neckPivot.rotation.y = Math.sin(t * 0.6) * 0.18;
    neckPivot.rotation.x = Math.sin(t * 0.9) * 0.05;

    // tail wag
    tail.rotation.y = Math.sin(t * 1.5) * 0.15;

    // legs subtle walking-in-place motion
    var s = 0.12;
    legFL.rotation.x = Math.sin(t * 1.4) * s;
    legBR.rotation.x = Math.sin(t * 1.4) * s;
    legFR.rotation.x = Math.sin(t * 1.4 + Math.PI) * s;
    legBL.rotation.x = Math.sin(t * 1.4 + Math.PI) * s;

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ---- UI: rotate toggle ----
  var toggleBtn = document.getElementById('toggle-rotate');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      autoRotate = !autoRotate;
      toggleBtn.textContent = autoRotate ? '⏸ 회전 멈추기' : '▶ 회전 시작';
      toggleBtn.classList.toggle('active', autoRotate);
    });
  }

  // ---- Resize ----
  function onResize() {
    var w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  var loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
})();
