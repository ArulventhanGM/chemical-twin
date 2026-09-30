import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { TankAssembly } from './TankAssembly.js';
import { FluidSystem } from './FluidSystem.js';
import { DimensionsAnnotation } from './DimensionsAnnotation.js';
import {
  connectDigitalTwinWebSocket,
  loadLocalDigitalTwinData,
} from './digitalTwin/digitalTwinState.js';
import { DigitalTwinVisualization } from './digitalTwin/digitalTwinVisualization.js';
import { updateDigitalTwinUI } from './digitalTwin/digitalTwinUI.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.cameraTargets = {
      // Image 1: Axonometric isometric angle
      image1: { pos: new THREE.Vector3(7.2, 7.0, 13.5), target: new THREE.Vector3(-0.4, 2.2, 0) },
      // Image 2: Front elevation view
      image2: { pos: new THREE.Vector3(-0.4, 3.4, 15.0), target: new THREE.Vector3(-0.4, 2.2, 0) },
      // Top plan view
      top: { pos: new THREE.Vector3(-0.4, 16.5, 0.01), target: new THREE.Vector3(-0.4, 2.2, 0) },
      // Side profile view
      side: { pos: new THREE.Vector3(14.5, 2.8, 0), target: new THREE.Vector3(-0.4, 2.2, 0) },
      // Isometric technical
      iso: { pos: new THREE.Vector3(9.5, 8.5, 9.5), target: new THREE.Vector3(-0.4, 2.2, 0) },
    };

    this.animatingCamera = false;
    this.autoRotate = false;
    this.isCutaway = false;

    this.initScene();
    this.initLighting();
    this.initAssembly();
    this.digitalTwinVisualization = new DigitalTwinVisualization(this.assembly, this.fluidSystem);
    this.initControls();
    this.initUI();
    this.initDigitalTwin();

    // Default view matches Image 1
    this.setCameraPreset('image1', false);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Create authentic CAD background gradient texture
    this.updateBackgroundTheme('cad');

    // Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);

    // Renderer with high visual fidelity & ACES tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.localClippingEnabled = true;

    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08; // Allow viewing slightly from below floor
    this.controls.minDistance = 3;
    this.controls.maxDistance = 35;
  }

  updateBackgroundTheme(theme) {
    if (theme === 'blueprint') {
      this.scene.background = new THREE.Color(0x07111e);
      document.body.classList.add('blueprint-theme');
      return;
    }

    document.body.classList.remove('blueprint-theme');

    // CAD Studio Gradient matching Images 1 & 2
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (theme === 'solid' || theme === 'cad') {
      // Matches the soft metallic blue-grey CAD background in the user's images
      grad.addColorStop(0, '#8696a7');
      grad.addColorStop(0.5, '#99a9bc');
      grad.addColorStop(1, '#b6c4d4');
    } else {
      // Studio clean light
      grad.addColorStop(0, '#e2e8f0');
      grad.addColorStop(1, '#cbd5e1');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    const bgTex = new THREE.CanvasTexture(canvas);
    this.scene.background = bgTex;
  }

  initLighting() {
    // Ambient light: cool tint for industrial metallic shading
    this.ambientLight = new THREE.AmbientLight(0xd9e5f3, 0.75);
    this.scene.add(this.ambientLight);

    // Key Directional Light: casts realistic soft shadows
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    this.keyLight.position.set(9, 14, 11);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 40;
    this.keyLight.shadow.camera.left = -9;
    this.keyLight.shadow.camera.right = 9;
    this.keyLight.shadow.camera.top = 9;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.0003;
    this.scene.add(this.keyLight);

    // Fill Light: soft cyan-blue fill from opposite side
    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    this.fillLight.position.set(-10, 8, -6);
    this.scene.add(this.fillLight);

    // Rim Light: subtle highlight along top rim silhouettes
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    this.rimLight.position.set(0, 12, -10);
    this.scene.add(this.rimLight);

    // Soft Shadow Floor Plane
    const planeGeom = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    this.groundPlane = new THREE.Mesh(planeGeom, planeMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.002;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    // Engineering grid helper (subtle)
    this.gridHelper = new THREE.GridHelper(24, 24, 0x64748b, 0x94a3b8);
    this.gridHelper.position.y = -0.001;
    this.gridHelper.material.opacity = 0.22;
    this.gridHelper.material.transparent = true;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);
  }

  initAssembly() {
    // 3D Tanks Assembly (Defaults to 'cadOutline' matching Image 1)
    this.assembly = new TankAssembly({
      theme: 'cadOutline',
    });
    this.scene.add(this.assembly.group);

    // Fluid simulation system
    this.fluidSystem = new FluidSystem(this.assembly, this.scene);

    // 3D CAD Dimensions annotation
    this.dimensions = new DimensionsAnnotation(this.assembly);
  }

  initControls() {
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setCameraPreset('image1');
      if (e.key === '2') this.setCameraPreset('image2');
      if (e.key === '3') this.setCameraPreset('top');
      if (e.key === '4') this.setCameraPreset('side');
      if (e.key === 'e' || e.key === 'E') this.toggleEdges();
      if (e.key === 'd' || e.key === 'D') this.toggleDimensions();
      if (e.key === 'r' || e.key === 'R') this.toggleAutoRotate();
      if (e.key === 'c' || e.key === 'C') this.toggleCutaway();
    });
  }

  initDigitalTwin() {
    window.addEventListener('digital-twin-state', (event) => {
      const state = event.detail;
      this.digitalTwinVisualization.applyState(state);
      this.digitalTwinVisualization.setStirrerActive(state.equipment.stirrer);
      updateDigitalTwinUI(state);
      this.updateDigitalTwinSliders(state);
    });
    loadLocalDigitalTwinData();
    connectDigitalTwinWebSocket();
  }

  updateDigitalTwinSliders(state) {
    const values = [
      ['slider-left-tank', 'val-left-tank', state.tanks.A.level],
      ['slider-right-tank', 'val-right-tank', state.tanks.B.level],
      ['slider-center-tank', 'val-center-tank', state.tanks.C.level],
    ];
    values.forEach(([sliderId, valueId, level]) => {
      const slider = document.getElementById(sliderId);
      const value = document.getElementById(valueId);
      if (slider) slider.value = level / 100;
      if (value) value.textContent = `${Math.round(level)}%`;
    });
  }

  setCameraPreset(presetName, animate = true) {
    const p = this.cameraTargets[presetName];
    if (!p) return;

    // Highlight active preset button
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });

    if (!animate) {
      this.camera.position.copy(p.pos);
      this.controls.target.copy(p.target);
      this.controls.update();
      return;
    }

    this.animatingCamera = true;
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 750; // ms
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, p.pos, ease);
      this.controls.target.lerpVectors(startTarget, p.target, ease);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.animatingCamera = false;
      }
    };
    requestAnimationFrame(step);
  }

  toggleEdges(forced) {
    const chk = document.getElementById('chk-edges');
    const newState = forced !== undefined ? forced : !chk.checked;
    chk.checked = newState;
    this.assembly.setEdgesVisible(newState);
  }

  toggleDimensions(forced) {
    const chk = document.getElementById('chk-dimensions');
    const newState = forced !== undefined ? forced : !chk.checked;
    chk.checked = newState;
    this.dimensions.setVisible(newState);
  }

  toggleAutoRotate(forced) {
    const chk = document.getElementById('chk-rotate');
    this.autoRotate = forced !== undefined ? forced : !this.autoRotate;
    if (chk) chk.checked = this.autoRotate;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.2;
  }

  toggleCutaway() {
    this.isCutaway = !this.isCutaway;
    const btn = document.getElementById('btn-cutaway');
    if (btn) btn.classList.toggle('active', this.isCutaway);
    this.assembly.setClipping(this.isCutaway, new THREE.Vector3(0, 0, -1), 0);
  }

  initUI() {
    // 1. Theme Buttons
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        themeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;

        this.assembly.applyTheme(theme);
        this.updateBackgroundTheme(theme === 'blueprint' ? 'blueprint' : 'cad');

        if (theme === 'blueprint') {
          this.gridHelper.visible = true;
        } else {
          this.gridHelper.visible = false;
        }

        if (theme === 'fluidSim') {
          this.fluidSystem.setVisible(true);
          const chkFluid = document.getElementById('chk-fluid');
          if (chkFluid) chkFluid.checked = true;
        } else {
          this.fluidSystem.setVisible(false);
          const chkFluid = document.getElementById('chk-fluid');
          if (chkFluid) chkFluid.checked = false;
        }

        if (theme === 'cadOutline') {
          this.groundPlane.material.opacity = 0.04;
        } else if (theme === 'solidCad') {
          this.groundPlane.material.opacity = 0.14;
        }
      });
    });

    // 2. Camera View Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setCameraPreset(btn.dataset.preset);
      });
    });

    // 3. Exploded View Slider
    const explodeSlider = document.getElementById('slider-explode');
    const explodeValue = document.getElementById('val-explode');
    if (explodeSlider) {
      explodeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        explodeValue.textContent = `${Math.round(val * 100)}%`;
        this.assembly.setExploded(val);
      });
    }

    // 4. Liquid Level Sliders
    // 5. Flow Simulation Toggle
    const chkFluid = document.getElementById('chk-fluid');
    if (chkFluid) {
      chkFluid.addEventListener('change', (e) => {
        this.fluidSystem.setVisible(e.target.checked);
      });
    }

    const btnFlowPause = document.getElementById('btn-flow-pause');
    if (btnFlowPause) {
      btnFlowPause.addEventListener('click', () => {
        this.fluidSystem.isFlowing = !this.fluidSystem.isFlowing;
        btnFlowPause.textContent = this.fluidSystem.isFlowing ? '⏸️ Pause Flow' : '▶️ Resume Flow';
      });
    }

    // 6. Engineering Checkboxes
    const chkEdges = document.getElementById('chk-edges');
    if (chkEdges) {
      chkEdges.addEventListener('change', (e) => {
        this.assembly.setEdgesVisible(e.target.checked);
      });
    }

    const chkDimensions = document.getElementById('chk-dimensions');
    if (chkDimensions) {
      chkDimensions.addEventListener('change', (e) => {
        this.dimensions.setVisible(e.target.checked);
      });
    }

    const chkRotate = document.getElementById('chk-rotate');
    if (chkRotate) {
      chkRotate.addEventListener('change', (e) => {
        this.toggleAutoRotate(e.target.checked);
      });
    }

    const chkGrid = document.getElementById('chk-grid');
    if (chkGrid) {
      chkGrid.addEventListener('change', (e) => {
        this.gridHelper.visible = e.target.checked;
      });
    }

    const btnCutaway = document.getElementById('btn-cutaway');
    if (btnCutaway) {
      btnCutaway.addEventListener('click', () => {
        this.toggleCutaway();
      });
    }

    // 7. Screenshot Capture
    const btnScreenshot = document.getElementById('btn-screenshot');
    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', () => this.captureScreenshot());
    }

    // 8. GLTF Export
    const btnExportGLTF = document.getElementById('btn-export-gltf');
    if (btnExportGLTF) {
      btnExportGLTF.addEventListener('click', () => this.exportGLTF());
    }

    // 9. View Code Modal
    const btnViewCode = document.getElementById('btn-view-code');
    const modalCode = document.getElementById('modal-code');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCopyCode = document.getElementById('btn-copy-code');

    if (btnViewCode && modalCode) {
      btnViewCode.addEventListener('click', () => {
        modalCode.classList.remove('hidden');
      });
    }
    if (btnCloseModal && modalCode) {
      btnCloseModal.addEventListener('click', () => {
        modalCode.classList.add('hidden');
      });
    }
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const codeEl = document.getElementById('code-snippet-pre');
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.innerText).then(() => {
            btnCopyCode.textContent = '✅ Copied to Clipboard!';
            setTimeout(() => {
              btnCopyCode.textContent = '📋 Copy Three.js Code';
            }, 2500);
          });
        }
      });
    }

    // Collapsible Dock
    const btnToggleDock = document.getElementById('btn-toggle-dock');
    const sideDock = document.getElementById('side-dock');
    if (btnToggleDock && sideDock) {
      btnToggleDock.addEventListener('click', () => {
        sideDock.classList.toggle('collapsed');
      });
    }
  }

  captureScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `ThreeJS_Tank_Assembly_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  }

  exportGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(
      this.assembly.group,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'industrial_tank_assembly.gltf';
        link.click();
      },
      (error) => {
        console.error('An error happened during GLTF export:', error);
      },
      { binary: false }
    );
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.controls.update();

    if (this.digitalTwinVisualization) {
      this.digitalTwinVisualization.update(delta);
    }

    if (this.fluidSystem) {
      this.fluidSystem.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
