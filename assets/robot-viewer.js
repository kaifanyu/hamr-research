/*
 * HAMR academic template — procedural COMPA caster comparison viewer.
 * Uses local Three.js r159 (MIT). No fetch, module loader, or build required.
 * Dimensions: hamr_control/hamr_ball_caster/urdf/compa_ball_caster.urdf.xacro
 * and hamr_swivel_caster/config/physical_properties.yaml. Units are metres.
 * The simplified turret and sensor electronics show intended placement only.
 * Replace buildRobot() with your mesh assembly to use a detailed CAD export.
 */
(function () {
  'use strict';
  document.querySelectorAll('.robot-viewer').forEach(initViewer);

  function initViewer(root) {
    const viewport = root.querySelector('.robot-viewer__scene');
    const canvas = root.querySelector('canvas');
    const title = root.querySelector('[data-viewer-title]');
    const description = root.querySelector('[data-viewer-description]');
    let variant = 'ball';
    let selected = 'caster';
    let render = function () {};
    let updateVariant = function () {};
    let highlight = function () {};
    const details = {
      camera: ['01', 'RGB-D camera', 'Color and depth feed visual odometry and the navigation map.'],
      compute: ['02', 'Raspberry Pi + ESP32', 'The Pi plans and controls; the ESP32 streams wheel encoders and IMU.'],
      drive: ['04', 'Differential drive', 'Two encoder-equipped drive wheels track the commanded wheel speeds.'],
      turret: ['05', 'Yaw-stabilized platform', 'The face marks a fixed platform heading while the drive chassis turns beneath it.']
    };
    function chooseComponent(key) {
      selected = key;
      const row = key === 'caster'
        ? (variant === 'ball'
          ? ['03', 'Ball caster support', 'Two split spherical supports on the front rocker rails.']
          : ['03', 'Wheelchair caster support', 'A swiveling fork and trailing wheel provide the comparison support.'])
        : details[key];
      if (!row) return;
      root.querySelector('.robot-viewer__readout-index').textContent = row[0];
      title.textContent = row[1];
      description.textContent = row[2];
      root.querySelectorAll('[data-component]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.component === key)));
      highlight(key);
      render();
    }
    root.querySelectorAll('[data-component]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      chooseComponent(button.dataset.component);
    }));
    root.querySelectorAll('[data-caster]').forEach(button => button.addEventListener('click', () => {
      variant = button.dataset.caster;
      root.querySelectorAll('[data-caster]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      updateVariant();
      chooseComponent('caster');
    }));
    chooseComponent('caster');
    if (!window.THREE) return;

    const T = window.THREE;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (error) {
      root.querySelectorAll('[data-view]').forEach(button => { button.disabled = true; });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(33, 1, .01, 20);
    const target = new T.Vector3(.02, .20, 0);
    const initial = { azimuth: .91, elevation: .42, distance: 1.85 };
    let azimuth = initial.azimuth, elevation = initial.elevation, distance = initial.distance;
    const robot = new T.Group();
    robot.name = 'hamr-platform-position';
    scene.add(robot);
    const lowerChassis = new T.Group();
    lowerChassis.name = 'hamr-drive-chassis';
    const upperPlatform = new T.Group();
    upperPlatform.name = 'hamr-heading-platform';
    robot.add(lowerChassis, upperPlatform);
    let assembly = lowerChassis;
    const driveWheels = [];
    const ballWheels = [];
    const swivelWheels = [];
    const clickable = [];
    const allMaterials = [];
    const driveToggle = root.querySelector('[data-drive-toggle]');
    const driveLabel = root.querySelector('[data-drive-label]');
    const drivePhase = root.querySelector('[data-drive-phase]');
    let playing = false, hasPlayed = false, inView = true, contextAvailable = true;
    let animationFrame = 0, lastTimestamp = null, motionTime = 0, chassisHeading = 0;
    let phaseText = '';

    const palette = { body: '#ddd0b7', plate: '#efe5ce', dark: '#363330', metal: '#c9bca4', shellPrimary: '#8b4940', shellSecondary: '#99582a', black: '#292724', board: '#675248', glass: '#52636b' };
    function mat(color, component, metalness) {
      const material = new T.MeshStandardMaterial({ color: color, roughness: .66, metalness: metalness || .12 });
      material.userData.component = component;
      allMaterials.push(material);
      return material;
    }
    function mesh(geometry, material, position, component, parent) {
      const object = new T.Mesh(geometry, material);
      object.position.set.apply(object.position, position || [0, 0, 0]);
      object.castShadow = true;
      object.receiveShadow = true;
      object.userData.component = component;
      (parent || assembly).add(object);
      if (component) clickable.push(object);
      return object;
    }
    function box(x, y, z, position, material, component, parent) { return mesh(new T.BoxGeometry(x, y, z), material, position, component, parent); }
    function cylinder(radius, height, position, material, component, parent, segments) { return mesh(new T.CylinderGeometry(radius, radius, height, segments || 48), material, position, component, parent); }
    function bolt(position, parent, radius) { return cylinder(radius || .0035, .003, position, mat('#bb9457', 'turret', .5), 'turret', parent, 6); }

    function buildRobot() {
      const chassisMaterial = mat(palette.body, 'turret');
      const railMaterial = mat(palette.metal, 'turret', .5);
      const topMaterial = mat(palette.plate, 'turret', .3);
      const driveMaterial = mat(palette.dark, 'drive');
      const treadMaterial = mat('#403b36', 'drive');
      const hubMaterial = mat('#d2c3aa', 'drive', .6);
      const motorMaterial = mat('#8a7964', 'drive', .4);
      // ROS (x, y, z) becomes Three.js (x, z, -y).
      box(.45, .042, .45, [0, .22, 0], chassisMaterial, 'turret');
      [-1, 1].forEach(side => {
        const rotating = [];
        box(.6658, .0254, .0254, [.0329, .2351, side * .257], railMaterial, 'turret');
        cylinder(.018, .025, [0, .2561, side * .240], motorMaterial, 'drive').rotation.x = Math.PI / 2;
        const wheel = cylinder(.1075, .083, [-.27114, .1119, side * .33072], driveMaterial, 'drive');
        wheel.rotation.x = Math.PI / 2;
        rotating.push(wheel);
        const hub = cylinder(.060, .008, [-.27114, .1119, side * .375], hubMaterial, 'drive');
        hub.rotation.x = Math.PI / 2;
        rotating.push(hub);
        const cap = cylinder(.019, .013, [-.27114, .1119, side * .381], motorMaterial, 'drive');
        cap.rotation.x = Math.PI / 2;
        rotating.push(cap);
        const axle = cylinder(.017, .12, [-.27114, .1119, side * .267], motorMaterial, 'drive');
        axle.rotation.x = Math.PI / 2;
        box(.046, .125, .03, [-.27114, .182, side * .257], railMaterial, 'drive');
        for (let index = 0; index < 30; index++) {
          const angle = index * Math.PI * 2 / 30;
          const tread = box(.021, .007, .081, [-.27114 + Math.sin(angle) * .106, .1119 + Math.cos(angle) * .106, side * .33072], treadMaterial, 'drive');
          tread.rotation.z = -angle;
          rotating.push(tread);
        }
        for (let index = 0; index < 6; index++) {
          const angle = index * Math.PI / 3;
          const screw = cylinder(.004, .009, [-.27114 + Math.cos(angle) * .040, .1119 + Math.sin(angle) * .040, side * .381], motorMaterial, 'drive', lowerChassis, 6);
          screw.rotation.x = Math.PI / 2;
          rotating.push(screw);
        }
        const spin = new T.Group();
        spin.name = side > 0 ? 'right-drive-wheel' : 'left-drive-wheel';
        spin.position.set(-.27114, .1119, side * .33072);
        lowerChassis.add(spin);
        rotating.forEach(part => spin.attach(part));
        driveWheels.push({ spin: spin, side: side });
      });
      cylinder(.137, .027, [-.0035, .267, 0], chassisMaterial, 'turret');
      assembly = upperPlatform;
      cylinder(.163, .009, [-.0035, .288, 0], railMaterial, 'turret');
      // Top platform simplified from the yaw_plate_link collision envelope.
      cylinder(.365, .018, [-.0035, .306, 0], mat('#aa9472', 'turret', .35), 'turret', upperPlatform, 96);
      cylinder(.365, .006, [-.0035, .318, 0], topMaterial, 'turret', upperPlatform, 96);
      for (let index = 0; index < 16; index++) {
        const angle = index * Math.PI / 8;
        bolt([-.0035 + Math.cos(angle) * .34, .324, Math.sin(angle) * .34]);
      }
      // A restrained etching on the deck suggests platform rotation.
      const circle = new T.TorusGeometry(.187, .0008, 3, 80);
      const ring = mesh(circle, mat('#c4ae87', 'turret'), [-.0035, .322, 0], 'turret');
      ring.rotation.x = Math.PI / 2;
      buildElectronics();
      buildFace();
    }
    function buildElectronics() {
      const component = 'compute';
      const baseMat = mat('#84705a', component, .4);
      const boardMat = mat(palette.board, component);
      const chipMat = mat('#342c27', component);
      const silverMat = mat('#c9bfae', component, .6);
      const pi = new T.Group(); upperPlatform.add(pi); pi.position.set(-.047, .338, -.025); pi.rotation.y = .14;
      box(.10, .009, .073, [0, -.01, 0], baseMat, component, pi);
      box(.086, .003, .056, [0, 0, 0], boardMat, component, pi);
      box(.020, .005, .020, [-.002, .004, .003], chipMat, component, pi);
      for (let i = 0; i < 6; i++) box(.0018, .010, .018, [-.009 + i * .003, .010, .002], silverMat, component, pi);
      box(.016, .015, .014, [.036, .009, -.014], silverMat, component, pi);
      box(.016, .015, .014, [.036, .009, .005], silverMat, component, pi);
      box(.014, .011, .015, [.035, .007, .023], silverMat, component, pi);
      box(.042, .005, .005, [-.008, .004, -.023], chipMat, component, pi);
      for (let i = 0; i < 12; i++) {
        const pin = cylinder(.0006, .007, [-.026 + i * .003, .006, -.023], silverMat, component, pi, 5);
        pin.castShadow = false;
      }
      const esp = new T.Group(); esp.position.set(-.17, .332, .105); esp.rotation.y = -.3; upperPlatform.add(esp);
      box(.049, .003, .028, [0, 0, 0], boardMat, component, esp);
      box(.019, .004, .017, [-.003, .004, 0], silverMat, component, esp);
      box(.008, .005, .008, [.021, .003, 0], silverMat, component, esp);
      for (let i = 0; i < 7; i++) box(.001, .001, .012, [-.022 + i * .0015, .003, 0], mat('#bb9457', component, .5), component, esp);
      box(.019, .003, .017, [-.15, .332, -.125], boardMat, component);
      box(.006, .003, .006, [-.15, .336, -.125], chipMat, component);
      // Cables drawn schematically: ESP and IMU feed the Pi.
      [[[-.15, .337, .09], [-.135, .347, .04], [-.10, .344, .012]], [[-.148, .338, -.125], [-.12, .345, -.084], [-.07, .343, -.05]]].forEach(points => {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        mesh(new T.TubeGeometry(curve, 20, .0015, 6, false), mat('#3d342d', component), [0, 0, 0], component);
      });
      const cameraMat = mat('#3b3732', 'camera');
      const cameraMetal = mat('#a08c6e', 'camera', .4);
      box(.033, .005, .045, [.235, .326, 0], cameraMetal, 'camera');
      box(.015, .061, .018, [.235, .355, 0], cameraMetal, 'camera');
      box(.028, .029, .153, [.235, .391, 0], cameraMat, 'camera');
      box(.003, .024, .144, [.251, .391, 0], mat('#282725', 'camera'), 'camera');
      [-.055, .008, .055].forEach((z, i) => {
        const bezel = cylinder(i === 1 ? .0045 : .008, .002, [.253, .391, z], mat('#8b9290', 'camera', .65), 'camera');
        bezel.rotation.z = Math.PI / 2;
        const lens = cylinder(i === 1 ? .003 : .006, .003, [.255, .391, z], mat(palette.glass, 'camera', .8), 'camera');
        lens.rotation.z = Math.PI / 2;
      });
    }
    function buildFace() {
      // An illustrative heading cue, attached only to the stabilized platform.
      // Rounded shapes are generated locally; no image or font assets are used.
      const face = new T.Group();
      face.name = 'hamr-fixed-heading-face';
      face.position.set(.09, .470, 0);
      upperPlatform.add(face);
      function panel(width, height, depth, radius, x, material) {
        const shape = new T.Shape();
        const left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2;
        shape.moveTo(left + radius, bottom);
        shape.lineTo(right - radius, bottom);
        shape.quadraticCurveTo(right, bottom, right, bottom + radius);
        shape.lineTo(right, top - radius);
        shape.quadraticCurveTo(right, top, right - radius, top);
        shape.lineTo(left + radius, top);
        shape.quadraticCurveTo(left, top, left, top - radius);
        shape.lineTo(left, bottom + radius);
        shape.quadraticCurveTo(left, bottom, left + radius, bottom);
        const geometry = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 10 });
        geometry.translate(0, 0, -depth / 2);
        const object = mesh(geometry, material, [x, 0, 0], 'turret', face);
        object.rotation.y = Math.PI / 2;
        return object;
      }
      // Behind and above the RGB-D camera, leaving its forward view clear.
      box(.025, .105, .038, [.09, .377, 0], mat('#cbbda5', 'turret', .4), 'turret', upperPlatform);
      panel(.176, .098, .032, .024, 0, mat('#fff4df', 'turret', .1));
      panel(.151, .075, .003, .018, .018, mat('#302b26', 'turret'));
      const amber = mat('#bb9457', 'turret');
      amber.emissive.set('#c8904c');
      amber.emissiveIntensity = 1.1;
      amber.userData.keepEmissive = true;
      const shine = mat('#ffe6a7', 'turret');
      shine.emissive.set('#ffe6a7');
      shine.emissiveIntensity = .7;
      shine.userData.keepEmissive = true;
      [-1, 1].forEach(side => {
        const eye = mesh(new T.SphereGeometry(1, 20, 12), amber, [.022, .013, side * .034], 'turret', face);
        eye.scale.set(.003, .012, .009);
        const glint = mesh(new T.SphereGeometry(.003, 12, 8), shine, [.025, .017, side * .034 - .002], 'turret', face);
        glint.scale.x = .4;
      });
      const smile = new T.CatmullRomCurve3([
        new T.Vector3(.022, -.010, -.023),
        new T.Vector3(.022, -.019, 0),
        new T.Vector3(.022, -.010, .023)
      ]);
      mesh(new T.TubeGeometry(smile, 20, .0018, 6, false), amber, [0, 0, 0], 'turret', face);
      const badge = cylinder(.004, .002, [.09, .521, 0], amber, 'turret', upperPlatform, 20);
      badge.castShadow = false;
    }
    const supports = { ball: new T.Group(), wheelchair: new T.Group() };
    function markedHemisphere(thetaStart, thetaLength, baseColor, stripeAngle, parent) {
      const geometry = new T.SphereGeometry(.100, 48, 24, 0, Math.PI * 2, thetaStart, thetaLength);
      const vertices = geometry.attributes.position;
      const colors = new Float32Array(vertices.count * 3);
      const shellColor = new T.Color(baseColor);
      const cream = new T.Color('#ffe6a7');
      const charcoal = new T.Color('#432818');
      // Paint an asymmetric meridian stripe and a short adjacent registration
      // tick into existing vertices. No overlay geometry, texture, or draw call.
      for (let i = 0; i < vertices.count; i++) {
        const longitude = Math.atan2(vertices.getZ(i), vertices.getX(i));
        const delta = Math.atan2(Math.sin(longitude - stripeAngle), Math.cos(longitude - stripeAngle));
        const latitude = Math.abs(vertices.getY(i)) / .100;
        let color = shellColor;
        if (Math.abs(delta) < .16 && latitude > .10 && latitude < .91) color = cream;
        else if (delta > .23 && delta < .49 && latitude > .38 && latitude < .58) color = charcoal;
        color.toArray(colors, i * 3);
      }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      const material = mat('#ffffff', 'caster');
      material.vertexColors = true;
      const shell = mesh(geometry, material, [0, 0, 0], 'caster', parent);
      shell.name = parent.name + '-shell';
      return shell;
    }
    function buildSupports() {
      lowerChassis.add(supports.ball, supports.wheelchair);
      [-1, 1].forEach(side => {
        const ballMount = new T.Group(); ballMount.position.set(.315, .10348, side * .257); supports.ball.add(ballMount);
        const steel = mat('#c5b69b', 'caster', .5);
        box(.052, .012, .088, [0, .121, 0], steel, 'caster', ballMount);
        [-1, 1].forEach(s => {
          box(.018, .097, .010, [0, .064, s * .107], steel, 'caster', ballMount);
          const fastener = cylinder(.014, .013, [0, .015, s * .106], mat('#8c7351', 'caster', .5), 'caster', ballMount);
          fastener.rotation.x = Math.PI / 2;
        });
        const ball = new T.Group(); ball.rotation.z = -.4786; ballMount.add(ball);
        ball.name = side > 0 ? 'right-ball-caster' : 'left-ball-caster';
        const h1 = new T.Group(), h2 = new T.Group();
        h1.name = (side > 0 ? 'right' : 'left') + '-ball-h1';
        h2.name = (side > 0 ? 'right' : 'left') + '-ball-h2';
        ball.add(h1, h2);
        ballWheels.push({ spin: ball, h1: h1, h2: h2, h1Rate: 0, h2Rate: 0, side: side });
        mesh(new T.SphereGeometry(.098, 40, 24), mat('#eadbc0', 'caster', .3), [0, 0, 0], 'caster', ball);
        markedHemisphere(.025, Math.PI / 2 - .047, palette.shellPrimary, 1.18, h1);
        markedHemisphere(Math.PI / 2 + .022, Math.PI / 2 - .047, palette.shellSecondary, .92, h2);
        [-1, 1].forEach(s => cylinder(.018, .014, [0, s * .091, 0], mat('#bb9457', 'caster'), 'caster', ball));
        // Wheelchair caster: nominal R=80 mm; 45 mm axis-to-axle trail.
        const wheelchair = new T.Group(); wheelchair.position.set(.315, .0044, side * .257); supports.wheelchair.add(wheelchair);
        box(.115, .005, .100, [0, .218, 0], steel, 'caster', wheelchair);
        box(.050, .022, .055, [0, .203, 0], steel, 'caster', wheelchair);
        cylinder(.031, .014, [0, .183, 0], mat('#a28b65', 'caster', .5), 'caster', wheelchair);
        const swivel = new T.Group();
        swivel.name = side > 0 ? 'right-swivel-fork' : 'left-swivel-fork';
        wheelchair.add(swivel);
        [-1, 1].forEach(s => {
          const fork = box(.022, .109, .006, [-.0225, .128, s * .033], steel, 'caster', swivel);
          fork.rotation.z = -.43;
        });
        const spin = new T.Group();
        spin.position.set(-.045, .080, 0);
        swivel.add(spin);
        const wheel = cylinder(.080, .050, [0, 0, 0], mat('#3c3833', 'caster'), 'caster', spin);
        wheel.rotation.x = Math.PI / 2;
        [-1, 1].forEach(s => {
          const wheelHub = cylinder(.037, .007, [0, 0, s * .027], mat('#c9b394', 'caster', .5), 'caster', spin);
          wheelHub.rotation.x = Math.PI / 2;
          const axle = cylinder(.010, .010, [0, 0, s * .034], steel, 'caster', spin);
          axle.rotation.x = Math.PI / 2;
          // A small contrasting hub marker makes rotation legible at this scale.
          const marker = cylinder(.004, .002, [0, .025, s * .032], mat('#6f1d1b', 'caster'), 'caster', spin, 12);
          marker.rotation.x = Math.PI / 2;
        });
        swivelWheels.push({ swivel: swivel, spin: spin, side: side });
      });
      supports.wheelchair.visible = false;
    }
    buildRobot();
    buildSupports();
    scene.add(new T.HemisphereLight('#ffffff', '#d9cbb5', 2.7));
    const keyLight = new T.DirectionalLight('#fffdf8', 3.0);
    keyLight.position.set(.7, 2.8, 1.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(keyLight.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: .1, far: 6 });
    keyLight.shadow.normalBias = .004;
    keyLight.shadow.bias = -.0001;
    keyLight.shadow.radius = 4;
    scene.add(keyLight, keyLight.target);
    const fillLight = new T.DirectionalLight('#eee2ce', .6); fillLight.position.set(-2, 1, -2); scene.add(fillLight);
    const ground = new T.Mesh(new T.PlaneGeometry(5, 5), new T.ShadowMaterial({ color: '#9b8266', opacity: .15 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.001; ground.receiveShadow = true; scene.add(ground);
    const grid = new T.GridHelper(4.8, 48, '#e8decb', '#e8decb'); grid.material.transparent = true; grid.material.opacity = .8; grid.position.y = -.002; scene.add(grid);

    const points = { camera: new T.Vector3(.235, .421, 0), compute: new T.Vector3(-.10, .365, -.09), caster: new T.Vector3(.34, .12, .357) };
    const projected = new T.Vector3();
    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    let width = 1, height = 1;
    // Illustrative offset-turret inverse kinematics from compa_controller.py.
    // This is a motion explanation, not a dynamics simulation or experiment.
    const kinematics = { offset: .274986, halfTrack: .331643, wheelRadius: .1075 };
    const travel = [[.16, 0], [0, -.14], [.16, 0], [0, .14]];
    const phaseNames = ['Forward', 'Sliding left', 'Forward', 'Sliding right'];
    const legSeconds = 3, blendSeconds = .7;
    function velocityAt(time) {
      const step = Math.floor(time / legSeconds);
      const phase = step % travel.length;
      const within = time - step * legSeconds;
      let blend = Math.max(0, Math.min(1, (within - legSeconds + blendSeconds) / blendSeconds));
      blend = blend * blend * (3 - 2 * blend);
      const next = (phase + 1) % travel.length;
      return {
        x: travel[phase][0] * (1 - blend) + travel[next][0] * blend,
        z: travel[phase][1] * (1 - blend) + travel[next][1] * blend,
        phase: phase
      };
    }
    function updatePhase() {
      const text = playing ? phaseNames[Math.floor(motionTime / legSeconds) % travel.length] : (hasPlayed ? 'Drive paused' : 'Ready to drive');
      if (drivePhase && text !== phaseText) { drivePhase.textContent = text; phaseText = text; }
    }
    function updateMotion(delta) {
      // Small integration steps keep caster/wheel motion smooth on slow frames.
      const count = Math.max(1, Math.ceil(delta / (1 / 120)));
      const dt = delta / count;
      for (let i = 0; i < count; i++) {
        const velocity = velocityAt(motionTime + dt / 2);
        const initialRate = (-Math.sin(chassisHeading) * velocity.x - Math.cos(chassisHeading) * velocity.z) / kinematics.offset;
        const middleHeading = chassisHeading + initialRate * dt / 2;
        const forward = Math.cos(middleHeading) * velocity.x - Math.sin(middleHeading) * velocity.z;
        const yawRate = (-Math.sin(middleHeading) * velocity.x - Math.cos(middleHeading) * velocity.z) / kinematics.offset;
        robot.position.x += velocity.x * dt;
        robot.position.z += velocity.z * dt;
        chassisHeading += yawRate * dt;
        lowerChassis.rotation.y = chassisHeading;
        // Upper platform is a sibling of the yawing base: its world yaw is zero.
        driveWheels.forEach(wheel => {
          wheel.spin.rotation.z -= (forward + wheel.side * kinematics.halfTrack * yawRate) * dt / kinematics.wheelRadius;
        });
        ballWheels.forEach(wheel => {
          const vx = forward + yawRate * wheel.side * .257;
          const vz = -yawRate * (kinematics.offset + .315);
          // CENTER/carrier rolls on its fixed transverse axle. H1 and H2 spin
          // independently about their shared local Y line, preserving the gap.
          // Rates are velocity-driven illustrations, not passive dynamics or
          // measured encoder replay; no arbitrary whole-ball tumble is applied.
          const carrierMiddle = wheel.spin.rotation.z - vx * dt / .2;
          wheel.spin.rotation.z -= vx * dt / .1;
          if (Math.hypot(vx, vz) < 1e-8) { wheel.h1Rate = 0; wheel.h2Rate = 0; return; }
          // Project residual lateral rolling onto the moving split axis.
          const projectedRate = -Math.sin(carrierMiddle) * vz / .1 - Math.cos(carrierMiddle) * yawRate;
          const contactBias = .65 * Math.cos(carrierMiddle);
          const response = 1 - Math.exp(-8 * dt);
          wheel.h1Rate += (projectedRate * (1 - contactBias) - wheel.h1Rate) * response;
          wheel.h2Rate += (projectedRate * (1 + contactBias) - wheel.h2Rate) * response;
          wheel.h1.rotation.y += wheel.h1Rate * dt;
          wheel.h2.rotation.y += wheel.h2Rate * dt;
        });
        swivelWheels.forEach(wheel => {
          const vx = forward + yawRate * wheel.side * .257;
          const vz = -yawRate * (kinematics.offset + .315);
          const desired = Math.atan2(-vz, vx);
          const difference = Math.atan2(Math.sin(desired - wheel.swivel.rotation.y), Math.cos(desired - wheel.swivel.rotation.y));
          // Passive swivel lag is illustrative; no calibrated caster dynamics.
          wheel.swivel.rotation.y += difference * (1 - Math.exp(-8 * dt));
          const rollingSpeed = Math.cos(wheel.swivel.rotation.y) * vx - Math.sin(wheel.swivel.rotation.y) * vz;
          wheel.spin.rotation.z -= rollingSpeed * dt / .080;
        });
        motionTime += dt;
      }
      updatePhase();
    }
    function canAnimate() { return playing && contextAvailable && inView && !document.hidden; }
    function tick(timestamp) {
      animationFrame = 0;
      if (!canAnimate()) { lastTimestamp = null; return; }
      const delta = lastTimestamp === null ? 0 : Math.min(.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastTimestamp = timestamp;
      if (delta) updateMotion(delta);
      render();
      animationFrame = requestAnimationFrame(tick);
    }
    function syncAnimation() {
      if (canAnimate()) {
        if (!animationFrame) { lastTimestamp = null; animationFrame = requestAnimationFrame(tick); }
      } else {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        lastTimestamp = null;
      }
    }
    render = function () {
      if (!contextAvailable) return;
      target.set(robot.position.x + .02, .20, robot.position.z);
      ground.position.x = robot.position.x;
      ground.position.z = robot.position.z;
      // Recenter by whole grid cells; identical lines keep the floor seamless.
      grid.position.x = Math.round(robot.position.x * 10) / 10;
      grid.position.z = Math.round(robot.position.z * 10) / 10;
      keyLight.position.set(robot.position.x + .7, 2.8, robot.position.z + 1.2);
      keyLight.target.position.set(robot.position.x, 0, robot.position.z);
      fillLight.position.set(robot.position.x - 2, 1, robot.position.z - 2);
      const h = distance * Math.cos(elevation);
      camera.position.set(target.x + Math.cos(azimuth) * h, target.y + distance * Math.sin(elevation), target.z + Math.sin(azimuth) * h);
      camera.lookAt(target);
      renderer.render(scene, camera);
      root.querySelectorAll('.robot-viewer__hotspot').forEach(button => {
        projected.copy(points[button.dataset.component]);
        const owner = button.dataset.component === 'caster' ? lowerChassis : upperPlatform;
        owner.localToWorld(projected);
        projected.project(camera);
        const x = (projected.x + 1) * .5 * width;
        const y = (1 - projected.y) * .5 * height;
        button.hidden = x < 20 || x > width - 30 || y < 20 || y > height - 35;
        button.style.transform = `translate(${x - 12}px, ${y - 12}px)`;
      });
    };
    function resize() {
      width = viewport.clientWidth; height = viewport.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      // Keep a comfortable fit on portrait mobile screens.
      camera.fov = width / height < 1.15 ? 41 : 33;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    }
    updateVariant = function () {
      supports.ball.visible = variant === 'ball';
      supports.wheelchair.visible = variant === 'wheelchair';
      points.caster.x = variant === 'ball' ? .34 : .30;
      render();
    };
    highlight = function (component) {
      allMaterials.forEach(material => {
        if (material.userData.keepEmissive) return;
        material.emissive.set(material.userData.component === component ? '#4b211b' : '#000000');
        material.emissiveIntensity = .09;
      });
    };
    function zoom(amount) { distance = Math.min(2.8, Math.max(1.05, distance * amount)); render(); }
    function reset() { azimuth = initial.azimuth; elevation = initial.elevation; distance = initial.distance; render(); }
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.view === 'reset') reset();
      else zoom(button.dataset.view === 'zoom-in' ? .87 : 1.15);
    }));
    const pointers = new Map();
    let dragged = false;
    let startX = 0, startY = 0;
    viewport.addEventListener('pointerdown', event => {
      if (event.target !== canvas) return;
      dragged = false; startX = event.clientX; startY = event.clientY;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      const previous = pointers.get(event.pointerId);
      const dx = event.clientX - previous[0], dy = event.clientY - previous[1];
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 4) dragged = true;
      if (pointers.size === 2) {
        const other = Array.from(pointers.entries()).find(entry => entry[0] !== event.pointerId)[1];
        const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
        const after = Math.hypot(event.clientX - other[0], event.clientY - other[1]);
        if (before && after) zoom(before / after);
      } else {
        azimuth += dx * .006;
        elevation = Math.max(.12, Math.min(1.25, elevation + dy * .004));
        render();
      }
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
    });
    viewport.addEventListener('pointerup', event => {
      const wasActive = pointers.has(event.pointerId);
      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (!wasActive || dragged || pointers.size) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const visible = clickable.filter(object => {
        let parent = object;
        while (parent) { if (!parent.visible) return false; parent = parent.parent; }
        return true;
      });
      const intersections = raycaster.intersectObjects(visible, false);
      if (intersections.length) chooseComponent(intersections[0].object.userData.component);
    });
    viewport.addEventListener('pointercancel', event => pointers.delete(event.pointerId));
    viewport.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(Math.min(100, Math.max(-100, event.deltaY)) * .0015)); }, { passive: false });
    viewport.addEventListener('keydown', event => {
      if (event.target !== viewport) return;
      if (event.key === 'ArrowLeft') azimuth -= .12;
      else if (event.key === 'ArrowRight') azimuth += .12;
      else if (event.key === 'ArrowUp') elevation = Math.max(.12, elevation - .08);
      else if (event.key === 'ArrowDown') elevation = Math.min(1.25, elevation + .08);
      else if (event.key === '+' || event.key === '=') zoom(.9);
      else if (event.key === '-') zoom(1.1);
      else if (event.key === 'Home') reset();
      else return;
      event.preventDefault(); render();
    });
    if (driveToggle) {
      driveToggle.disabled = false;
      driveToggle.setAttribute('aria-pressed', 'false');
      driveToggle.addEventListener('click', () => {
        playing = !playing;
        if (playing) hasPlayed = true;
        driveToggle.setAttribute('aria-pressed', String(playing));
        root.classList.toggle('robot-viewer--driving', playing);
        if (driveLabel) driveLabel.textContent = playing ? 'Pause drive' : 'Resume drive';
        updatePhase();
        syncAnimation();
      });
    }
    document.addEventListener('visibilitychange', syncAnimation);
    if (window.IntersectionObserver) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        syncAnimation();
      }, { threshold: .01 }).observe(root);
    }
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      contextAvailable = false;
      root.classList.remove('robot-viewer--ready');
      if (driveToggle) driveToggle.disabled = true;
      syncAnimation();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      contextAvailable = true;
      root.classList.add('robot-viewer--ready');
      if (driveToggle) driveToggle.disabled = false;
      render();
      syncAnimation();
    });
    root.classList.add('robot-viewer--ready');
    highlight(selected);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(viewport);
    else window.addEventListener('resize', resize);
    resize();
  }
})();
