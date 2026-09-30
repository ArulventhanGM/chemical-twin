import * as THREE from 'three';

/**
 * Handles liquid levels inside tanks and fluid particle flow animation
 * through connecting and outlet pipes.
 */
export class FluidSystem {
  constructor(assembly, scene) {
    this.assembly = assembly;
    this.scene = scene;
    this.opt = assembly.options;

    this.group = new THREE.Group();
    this.group.name = 'FluidSystemRoot';

    this.leftLevel = 0.75;
    this.rightLevel = 0.65;
    this.centerLevel = 0.5;
    this.targetLeftLevel = this.leftLevel;
    this.targetRightLevel = this.rightLevel;
    this.targetCenterLevel = this.centerLevel;
    this.flowSpeed = 1.0;
    this.isFlowing = true;
    this.visible = false;

    this.initFluidMaterials();
    this.createTankLiquids();
    this.createFlowParticles();

    this.group.visible = false;
    this.assembly.group.add(this.group);
  }

  initFluidMaterials() {
    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      transmission: 0.75,
      opacity: 0.8,
      transparent: true,
      roughness: 0.1,
      metalness: 0.05,
      ior: 1.333,
      depthWrite: false,
    });

    this.particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.085,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
  }

  createTankLiquids() {
    const opt = this.opt;

    // 1. Center Tank Liquid
    const centerFluidR = opt.centerInnerRadius - 0.015;
    const centerMaxH = opt.centerHeight - 0.15;
    this.centerMaxH = centerMaxH;

    this.centerLiquidGeom = new THREE.CylinderGeometry(centerFluidR, centerFluidR, 1, 36);
    this.centerLiquidGeom.translate(0, 0.5, 0); // Origin at bottom of cylinder
    this.centerLiquidMesh = new THREE.Mesh(this.centerLiquidGeom, this.waterMat);
    this.centerLiquidMesh.position.set(0, opt.centerBaseY + 0.1, 0);
    this.group.add(this.centerLiquidMesh);

    // 2. Left Tank Liquid
    const sideFluidR = opt.sideInnerRadius - 0.015;
    const sideMaxH = opt.sideHeight - 0.12;
    this.sideMaxH = sideMaxH;

    this.sideLiquidGeom = new THREE.CylinderGeometry(sideFluidR, sideFluidR, 1, 32);
    this.sideLiquidGeom.translate(0, 0.5, 0);

    this.leftLiquidMesh = new THREE.Mesh(this.sideLiquidGeom, this.waterMat);
    this.leftLiquidMesh.position.set(-opt.sideDistanceX, opt.sideBaseY + 0.08, 0);
    this.group.add(this.leftLiquidMesh);

    // 3. Right Tank Liquid
    this.rightLiquidMesh = new THREE.Mesh(this.sideLiquidGeom, this.waterMat);
    this.rightLiquidMesh.position.set(opt.sideDistanceX, opt.sideBaseY + 0.08, 0);
    this.group.add(this.rightLiquidMesh);

    this.updateLevels();
  }

  updateLevels(left = this.leftLevel, right = this.rightLevel, center = this.centerLevel) {
    this.leftLevel = Math.max(0.01, Math.min(1, left));
    this.rightLevel = Math.max(0.01, Math.min(1, right));
    this.centerLevel = Math.max(0.01, Math.min(1, center));
    this.targetLeftLevel = this.leftLevel;
    this.targetRightLevel = this.rightLevel;
    this.targetCenterLevel = this.centerLevel;

    this.leftLiquidMesh.scale.y = this.sideMaxH * this.leftLevel;
    this.rightLiquidMesh.scale.y = this.sideMaxH * this.rightLevel;
    this.centerLiquidMesh.scale.y = this.centerMaxH * this.centerLevel;
  }

  setTargetLevels(left, right, center) {
    this.targetLeftLevel = Math.max(0, Math.min(1, left));
    this.targetRightLevel = Math.max(0, Math.min(1, right));
    this.targetCenterLevel = Math.max(0, Math.min(1, center));
  }

  updateSmoothLevels(smoothing = 0.1) {
    this.leftLevel = THREE.MathUtils.lerp(this.leftLevel, this.targetLeftLevel, smoothing);
    this.rightLevel = THREE.MathUtils.lerp(this.rightLevel, this.targetRightLevel, smoothing);
    this.centerLevel = THREE.MathUtils.lerp(this.centerLevel, this.targetCenterLevel, smoothing);
    this.leftLiquidMesh.scale.y = this.sideMaxH * this.leftLevel;
    this.rightLiquidMesh.scale.y = this.sideMaxH * this.rightLevel;
    this.centerLiquidMesh.scale.y = this.centerMaxH * this.centerLevel;
  }

  createFlowParticles() {
    // We create particles that travel along:
    // A. Left transfer pipe curve
    // B. Right transfer pipe curve
    // C. Left lower discharge pipe
    // D. Right lower discharge pipe

    this.particleStreams = [];
    const countPerPipe = 70;

    // Helper to generate particle stream along curve or line
    const createStream = (curve, count) => {
      const positions = new Float32Array(count * 3);
      const progresses = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        progresses[i] = i / count;
        const pt = curve.getPointAt(progresses[i]);
        positions[i * 3] = pt.x;
        positions[i * 3 + 1] = pt.y;
        positions[i * 3 + 2] = pt.z;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geom, this.particleMat);
      this.group.add(points);

      return {
        points,
        geom,
        curve,
        count,
        progresses,
        active: false,
      };
    };

    if (this.assembly.leftPipeCurve) {
      this.particleStreams.push(createStream(this.assembly.leftPipeCurve, countPerPipe));
    }
    if (this.assembly.rightPipeCurve) {
      this.particleStreams.push(createStream(this.assembly.rightPipeCurve, countPerPipe));
    }

    // Lower Discharge Streams
    const opt = this.opt;
    const lowerY = opt.lowerPipeY;

    // Left lower outlet line: from -centerRadius to -centerRadius - lowerPipeLength
    const leftLowerCurve = new THREE.LineCurve3(
      new THREE.Vector3(-opt.centerRadius, lowerY, 0),
      new THREE.Vector3(-opt.centerRadius - opt.lowerPipeLength - 0.5, lowerY, 0)
    );
    this.particleStreams.push(createStream(leftLowerCurve, 40));

    // Right lower outlet line
    const rightLowerCurve = new THREE.LineCurve3(
      new THREE.Vector3(opt.centerRadius, lowerY, 0),
      new THREE.Vector3(opt.centerRadius + opt.lowerPipeLength + 0.5, lowerY, 0)
    );
    this.particleStreams.push(createStream(rightLowerCurve, 40));
  }

  setProcessFlow(stage, valveA, valveB) {
    if (this.particleStreams.length < 2) return;
    this.particleStreams[0].active = stage === 'DOSING_A' && valveA;
    this.particleStreams[1].active = stage === 'DOSING_B' && valveB;
    this.particleStreams.slice(2).forEach((stream) => { stream.active = false; });
    this.particleStreams.forEach((stream) => { stream.points.visible = stream.active; });
  }

  setFlowAnimationEnabled(enabled) {
    this.particleStreams.forEach((stream) => {
      stream.points.visible = enabled && stream.active;
    });
  }

  update(delta = 0.016) {
    if (!this.visible || !this.isFlowing) return;

    const speed = 0.35 * this.flowSpeed * delta;

    this.particleStreams.forEach((stream) => {
      if (!stream.active) return;
      const posAttr = stream.geom.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < stream.count; i++) {
        stream.progresses[i] = (stream.progresses[i] + speed) % 1.0;
        const pt = stream.curve.getPointAt(stream.progresses[i]);
        // slight jitter inside pipe radius
        arr[i * 3] = pt.x;
        arr[i * 3 + 1] = pt.y;
        arr[i * 3 + 2] = pt.z;
      }
      posAttr.needsUpdate = true;
    });
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }
}
