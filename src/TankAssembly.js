import * as THREE from 'three';

/**
 * Creates the complete 3D Industrial Tank Assembly matching reference CAD drawings.
 * Features:
 * - Left & Right Elevated Tanks with 4 slender support legs each
 * - Center Primary Tank with 4 base feet
 * - Upper Connecting Pipes with 90° smooth elbow joints & sleeve couplings
 * - Lower Side Discharge Pipes with hollow open rims
 * - Dual-layer rendering: Solid CAD materials + authentic CAD silhouette line segments
 * - Exploded view transform support
 */

export class TankAssembly {
  constructor(options = {}) {
    this.options = Object.assign({
      // Dimensions matching CAD references
      centerRadius: 1.25,
      centerInnerRadius: 1.17,
      centerHeight: 3.0,
      centerBaseY: 0.5,
      centerFeetCount: 4,
      centerFeetRadius: 0.08,
      centerFeetHeight: 0.5,

      sideRadius: 0.98,
      sideInnerRadius: 0.91,
      sideHeight: 2.2,
      sideBaseY: 3.8,
      sideDistanceX: 4.0,
      sideLegRadius: 0.06,

      pipeRadius: 0.10,
      pipeThickness: 0.018,
      collarRadius: 0.145,
      collarLength: 0.32,
      lowerPipeLength: 1.35,
      lowerPipeY: 1.1,
      inletY: 2.8,
      bendRadius: 0.35,

      theme: 'cadOutline', // 'cadOutline', 'solidCad', 'stainless', 'fluidSim', 'blueprint'
    }, options);

    this.group = new THREE.Group();
    this.group.name = 'TankAssemblyRoot';

    this.solidMeshes = [];
    this.edgeLines = [];
    this.cadLinesGroup = new THREE.Group();
    this.cadLinesGroup.name = 'CAD_Silhouette_Lines';
    this.group.add(this.cadLinesGroup);

    this.explodedParts = [];
    this.currentTheme = this.options.theme;
    this.explodedFactor = 0;

    this.initMaterials();
    this.buildAssembly();
    this.applyTheme(this.currentTheme);
  }

  initMaterials() {
    // 1. Solid CAD Material (Image 2 style: light satin aluminum / CAD steel)
    this.matSolidCad = new THREE.MeshStandardMaterial({
      color: 0xb5c3d4,
      roughness: 0.32,
      metalness: 0.45,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    // 2. CAD Outline Body Material (Image 1 style: translucent technical CAD acrylic)
    this.matCadOutlineBody = new THREE.MeshPhysicalMaterial({
      color: 0xd8e4f0,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.85,
      thickness: 0.4,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 3. Stainless Steel Material
    this.matStainless = new THREE.MeshStandardMaterial({
      color: 0xe6eef7,
      roughness: 0.16,
      metalness: 0.88,
      side: THREE.DoubleSide,
    });

    // 4. Fluid Sim Translucent Acrylic Material
    this.matFluidGlass = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      roughness: 0.08,
      metalness: 0.02,
      transmission: 0.92,
      thickness: 0.5,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 5. Blueprint Tech Material
    this.matBlueprintBody = new THREE.MeshBasicMaterial({
      color: 0x0c2540,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Pipe Materials
    this.matPipeSolid = new THREE.MeshStandardMaterial({
      color: 0xa8b8ca,
      roughness: 0.28,
      metalness: 0.52,
      side: THREE.DoubleSide,
    });

    this.matPipeCadOutline = new THREE.MeshStandardMaterial({
      color: 0xb8c8d8,
      roughness: 0.28,
      metalness: 0.40,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });

    this.matCollarSolid = new THREE.MeshStandardMaterial({
      color: 0x92a4b6,
      roughness: 0.25,
      metalness: 0.55,
    });

    // CAD Silhouette Line Materials
    // A. Crisp Black/Charcoal line (Image 1 style)
    this.matLineCad = new THREE.LineBasicMaterial({
      color: 0x111827,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });

    // B. Subtle slate line for Solid CAD (Image 2 style)
    this.matLineSolid = new THREE.LineBasicMaterial({
      color: 0x475569,
      linewidth: 1,
      transparent: true,
      opacity: 0.45,
    });

    // C. Glowing cyan line for Blueprint Tech
    this.matLineBlueprint = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.95,
    });
  }

  /**
   * Generates a watertight hollow cylindrical tank with bottom plate & chamfered base
   */
  createHollowTankGeometry(outerR, innerR, height, bottomThick = 0.08, fillet = 0.06, segments = 56) {
    const points = [];
    points.push(new THREE.Vector2(0, bottomThick));
    points.push(new THREE.Vector2(innerR, bottomThick));
    points.push(new THREE.Vector2(innerR, height));
    points.push(new THREE.Vector2(outerR, height));
    points.push(new THREE.Vector2(outerR, fillet));
    points.push(new THREE.Vector2(outerR - fillet * 0.3, fillet * 0.3));
    points.push(new THREE.Vector2(outerR - fillet, 0));
    points.push(new THREE.Vector2(0, 0));

    const geom = new THREE.LatheGeometry(points, segments);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * Generates a hollow pipe tube with open ends and thickness
   */
  createHollowPipeGeometry(outerR, innerR, length, segments = 36) {
    const points = [
      new THREE.Vector2(innerR, 0),
      new THREE.Vector2(outerR, 0),
      new THREE.Vector2(outerR, length),
      new THREE.Vector2(innerR, length),
      new THREE.Vector2(innerR, 0),
    ];
    const geom = new THREE.LatheGeometry(points, segments);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * Helper to create a circle line loop in 3D
   */
  createCircleLine(radius, yPos = 0, axis = 'y', segments = 48) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const c = Math.cos(theta) * radius;
      const s = Math.sin(theta) * radius;
      if (axis === 'y') {
        points.push(new THREE.Vector3(c, yPos, s));
      } else if (axis === 'x') {
        points.push(new THREE.Vector3(yPos, c, s));
      } else {
        points.push(new THREE.Vector3(c, s, yPos));
      }
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, this.matLineCad);
    this.edgeLines.push(line);
    return line;
  }

  /**
   * Helper to create line segments from an array of point pairs
   */
  createLineSegments(pairs) {
    const geom = new THREE.BufferGeometry().setFromPoints(pairs);
    const line = new THREE.LineSegments(geom, this.matLineCad);
    this.edgeLines.push(line);
    return line;
  }

  /**
   * Registers a solid mesh and attaches companion EdgesGeometry
   */
  registerPart(mesh, name, explodeVec = new THREE.Vector3(), edgeThreshold = 20) {
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, edgeThreshold);
    const edgesLine = new THREE.LineSegments(edgesGeom, this.matLineCad);
    edgesLine.name = `${name}_Edges`;
    mesh.add(edgesLine);

    this.solidMeshes.push(mesh);
    this.edgeLines.push(edgesLine);

    const partData = {
      object: mesh,
      initialPos: mesh.position.clone(),
      explodeVector: explodeVec.clone(),
    };
    this.explodedParts.push(partData);

    return mesh;
  }

  buildAssembly() {
    const opt = this.options;

    // ==========================================
    // 1. CENTER PRIMARY TANK
    // ==========================================
    const centerTankGroup = new THREE.Group();
    centerTankGroup.name = 'CenterTankGroup';
    centerTankGroup.position.set(0, opt.centerBaseY, 0);

    const centerGeom = this.createHollowTankGeometry(
      opt.centerRadius,
      opt.centerInnerRadius,
      opt.centerHeight,
      0.1,
      0.08,
      64
    );
    const centerMesh = new THREE.Mesh(centerGeom, this.matSolidCad);
    this.registerPart(centerMesh, 'CenterTank', new THREE.Vector3(0, 0, 0), 20);

    // Add CAD silhouette vertical lines for Center Tank
    const cSilPairs = [];
    // Outer vertical profile lines
    cSilPairs.push(new THREE.Vector3(-opt.centerRadius, 0, 0), new THREE.Vector3(-opt.centerRadius, opt.centerHeight, 0));
    cSilPairs.push(new THREE.Vector3(opt.centerRadius, 0, 0), new THREE.Vector3(opt.centerRadius, opt.centerHeight, 0));
    // Inner vertical profile lines
    cSilPairs.push(new THREE.Vector3(-opt.centerInnerRadius, 0.1, 0), new THREE.Vector3(-opt.centerInnerRadius, opt.centerHeight, 0));
    cSilPairs.push(new THREE.Vector3(opt.centerInnerRadius, 0.1, 0), new THREE.Vector3(opt.centerInnerRadius, opt.centerHeight, 0));
    const centerSilLines = this.createLineSegments(cSilPairs);
    centerMesh.add(centerSilLines);

    centerTankGroup.add(centerMesh);

    // 4 Feet under center tank (front, back, left, right)
    const feetGroup = new THREE.Group();
    feetGroup.name = 'CenterFeetGroup';
    const feetRadiusOffset = opt.centerRadius * 0.72;
    const feetAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

    const footGeom = new THREE.CylinderGeometry(
      opt.centerFeetRadius,
      opt.centerFeetRadius,
      opt.centerFeetHeight,
      24
    );
    footGeom.translate(0, -opt.centerFeetHeight / 2, 0);

    feetAngles.forEach((angle, idx) => {
      const footMesh = new THREE.Mesh(footGeom, this.matPipeSolid);
      const fx = Math.cos(angle) * feetRadiusOffset;
      const fz = Math.sin(angle) * feetRadiusOffset;
      footMesh.position.set(fx, 0, fz);
      this.registerPart(footMesh, `CenterFoot_${idx}`, new THREE.Vector3(0, -0.5, 0), 20);

      // Foot silhouette vertical lines
      const fPairs = [
        new THREE.Vector3(-opt.centerFeetRadius, 0, 0), new THREE.Vector3(-opt.centerFeetRadius, -opt.centerFeetHeight, 0),
        new THREE.Vector3(opt.centerFeetRadius, 0, 0), new THREE.Vector3(opt.centerFeetRadius, -opt.centerFeetHeight, 0),
      ];
      footMesh.add(this.createLineSegments(fPairs));
      feetGroup.add(footMesh);
    });
    centerTankGroup.add(feetGroup);

    // Lower Side Outlet Pipes on Center Tank (Left and Right)
    const lowerPipeGeom = this.createHollowPipeGeometry(
      opt.pipeRadius,
      opt.pipeRadius - opt.pipeThickness,
      opt.lowerPipeLength,
      32
    );
    lowerPipeGeom.rotateZ(-Math.PI / 2);

    // Left lower outlet pipe
    const lowerPipeLeft = new THREE.Mesh(lowerPipeGeom, this.matPipeSolid);
    lowerPipeLeft.position.set(-opt.centerRadius, opt.lowerPipeY - opt.centerBaseY, 0);
    lowerPipeLeft.rotation.y = Math.PI;
    this.registerPart(lowerPipeLeft, 'LowerPipe_Left', new THREE.Vector3(-0.9, 0, 0), 20);

    // Silhouette lines for lower left pipe
    const lPipePairs = [
      new THREE.Vector3(0, opt.pipeRadius, 0), new THREE.Vector3(opt.lowerPipeLength, opt.pipeRadius, 0),
      new THREE.Vector3(0, -opt.pipeRadius, 0), new THREE.Vector3(opt.lowerPipeLength, -opt.pipeRadius, 0),
    ];
    lowerPipeLeft.add(this.createLineSegments(lPipePairs));
    centerTankGroup.add(lowerPipeLeft);

    // Right lower outlet pipe
    const lowerPipeRight = new THREE.Mesh(lowerPipeGeom, this.matPipeSolid);
    lowerPipeRight.position.set(opt.centerRadius, opt.lowerPipeY - opt.centerBaseY, 0);
    this.registerPart(lowerPipeRight, 'LowerPipe_Right', new THREE.Vector3(0.9, 0, 0), 20);

    lowerPipeRight.add(this.createLineSegments(lPipePairs));
    centerTankGroup.add(lowerPipeRight);

    this.group.add(centerTankGroup);
    this.centerTankGroup = centerTankGroup;

    // ==========================================
    // 2. ELEVATED SIDE TANKS (LEFT & RIGHT)
    // ==========================================
    const sideGeom = this.createHollowTankGeometry(
      opt.sideRadius,
      opt.sideInnerRadius,
      opt.sideHeight,
      0.08,
      0.05,
      56
    );

    const legGeom = new THREE.CylinderGeometry(
      opt.sideLegRadius,
      opt.sideLegRadius,
      opt.sideBaseY,
      24
    );
    legGeom.translate(0, -opt.sideBaseY / 2, 0);

    const legSpreadR = opt.sideRadius * 0.74;
    const legAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      Math.PI * 1.25,
      Math.PI * 1.75,
    ];

    // Left Elevated Tank System
    const leftTankGroup = new THREE.Group();
    leftTankGroup.name = 'LeftTankGroup';
    leftTankGroup.position.set(-opt.sideDistanceX, opt.sideBaseY, 0);

    const leftTankMesh = new THREE.Mesh(sideGeom, this.matSolidCad);
    this.registerPart(leftTankMesh, 'LeftTank', new THREE.Vector3(-1.8, 0.8, 0), 20);

    // Elevated tank silhouette lines
    const sSilPairs = [
      new THREE.Vector3(-opt.sideRadius, 0, 0), new THREE.Vector3(-opt.sideRadius, opt.sideHeight, 0),
      new THREE.Vector3(opt.sideRadius, 0, 0), new THREE.Vector3(opt.sideRadius, opt.sideHeight, 0),
      new THREE.Vector3(-opt.sideInnerRadius, 0.08, 0), new THREE.Vector3(-opt.sideInnerRadius, opt.sideHeight, 0),
      new THREE.Vector3(opt.sideInnerRadius, 0.08, 0), new THREE.Vector3(opt.sideInnerRadius, opt.sideHeight, 0),
    ];
    leftTankMesh.add(this.createLineSegments(sSilPairs));
    leftTankGroup.add(leftTankMesh);

    // Left Legs
    const leftLegsGroup = new THREE.Group();
    leftLegsGroup.name = 'LeftLegsGroup';
    legAngles.forEach((angle, idx) => {
      const legMesh = new THREE.Mesh(legGeom, this.matPipeSolid);
      const lx = Math.cos(angle) * legSpreadR;
      const lz = Math.sin(angle) * legSpreadR;
      legMesh.position.set(lx, 0, lz);
      this.registerPart(legMesh, `LeftLeg_${idx}`, new THREE.Vector3(-1.8, -0.4, 0), 20);

      // Leg vertical silhouette lines
      const legPairs = [
        new THREE.Vector3(-opt.sideLegRadius, 0, 0), new THREE.Vector3(-opt.sideLegRadius, -opt.sideBaseY, 0),
        new THREE.Vector3(opt.sideLegRadius, 0, 0), new THREE.Vector3(opt.sideLegRadius, -opt.sideBaseY, 0),
      ];
      legMesh.add(this.createLineSegments(legPairs));
      leftLegsGroup.add(legMesh);
    });
    leftTankGroup.add(leftLegsGroup);
    this.group.add(leftTankGroup);
    this.leftTankGroup = leftTankGroup;

    // Right Elevated Tank System
    const rightTankGroup = new THREE.Group();
    rightTankGroup.name = 'RightTankGroup';
    rightTankGroup.position.set(opt.sideDistanceX, opt.sideBaseY, 0);

    const rightTankMesh = new THREE.Mesh(sideGeom, this.matSolidCad);
    this.registerPart(rightTankMesh, 'RightTank', new THREE.Vector3(1.8, 0.8, 0), 20);
    rightTankMesh.add(this.createLineSegments(sSilPairs));
    rightTankGroup.add(rightTankMesh);

    // Right Legs
    const rightLegsGroup = new THREE.Group();
    rightLegsGroup.name = 'RightLegsGroup';
    legAngles.forEach((angle, idx) => {
      const legMesh = new THREE.Mesh(legGeom, this.matPipeSolid);
      const lx = Math.cos(angle) * legSpreadR;
      const lz = Math.sin(angle) * legSpreadR;
      legMesh.position.set(lx, 0, lz);
      this.registerPart(legMesh, `RightLeg_${idx}`, new THREE.Vector3(1.8, -0.4, 0), 20);

      const legPairs = [
        new THREE.Vector3(-opt.sideLegRadius, 0, 0), new THREE.Vector3(-opt.sideLegRadius, -opt.sideBaseY, 0),
        new THREE.Vector3(opt.sideLegRadius, 0, 0), new THREE.Vector3(opt.sideLegRadius, -opt.sideBaseY, 0),
      ];
      legMesh.add(this.createLineSegments(legPairs));
      rightLegsGroup.add(legMesh);
    });
    rightTankGroup.add(rightLegsGroup);
    this.group.add(rightTankGroup);
    this.rightTankGroup = rightTankGroup;

    // ==========================================
    // 3. UPPER CONNECTING PIPES & SLEEVES
    // ==========================================
    this.buildConnectingPipe('left');
    this.buildConnectingPipe('right');

    // ==========================================
    // 4. MIXER / STIRRER ASSEMBLY (ON CENTER TANK)
    // ==========================================
    this.buildStirrer();
  }

  buildStirrer() {
    const opt = this.options;
    const stirrerRoot = new THREE.Group();
    stirrerRoot.name = 'StirrerRoot';

    // Mounting cross bridge across top rim of Center Tank
    const bridgeGeom = new THREE.BoxGeometry(opt.centerRadius * 2.05, 0.08, 0.38);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, this.matPipeSolid);
    bridgeMesh.position.set(0, opt.centerBaseY + opt.centerHeight + 0.04, 0);
    this.registerPart(bridgeMesh, 'StirrerMountBridge', new THREE.Vector3(0, 1.2, 0), 20);
    stirrerRoot.add(bridgeMesh);

    // Motor & Gearbox housing
    const motorGeom = new THREE.CylinderGeometry(0.24, 0.28, 0.44, 24);
    const motorMesh = new THREE.Mesh(motorGeom, this.matCollarSolid);
    motorMesh.position.set(0, opt.centerBaseY + opt.centerHeight + 0.30, 0);
    this.registerPart(motorMesh, 'StirrerMotor', new THREE.Vector3(0, 1.5, 0), 20);
    stirrerRoot.add(motorMesh);

    // Motor silhouette lines
    const motorPairs = [
      new THREE.Vector3(-0.24, opt.centerBaseY + opt.centerHeight + 0.08, 0),
      new THREE.Vector3(-0.24, opt.centerBaseY + opt.centerHeight + 0.52, 0),
      new THREE.Vector3(0.24, opt.centerBaseY + opt.centerHeight + 0.08, 0),
      new THREE.Vector3(0.24, opt.centerBaseY + opt.centerHeight + 0.52, 0)
    ];
    motorMesh.add(this.createLineSegments(motorPairs));

    // Rotating impeller assembly (shaft + blades)
    const rotatingAssembly = new THREE.Group();
    rotatingAssembly.name = 'StirrerRotatingAssembly';
    rotatingAssembly.position.set(0, opt.centerBaseY + opt.centerHeight, 0);

    // Stainless steel central drive shaft
    const shaftLength = opt.centerHeight * 0.78; // ~2.34
    const shaftGeom = new THREE.CylinderGeometry(0.038, 0.038, shaftLength, 20);
    shaftGeom.translate(0, -shaftLength / 2, 0);
    const shaftMesh = new THREE.Mesh(shaftGeom, this.matStainless);
    shaftMesh.name = 'StirrerShaft';
    rotatingAssembly.add(shaftMesh);

    // Bottom Impeller Hub
    const impellerY = -shaftLength + 0.16;
    const hubGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16);
    const hubMesh = new THREE.Mesh(hubGeom, this.matCollarSolid);
    hubMesh.position.set(0, impellerY, 0);
    rotatingAssembly.add(hubMesh);

    // 4 Pitched Impeller Blades
    const bladeCount = 4;
    const bladeLength = opt.centerInnerRadius * 0.52;
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      const bladeGeom = new THREE.BoxGeometry(bladeLength, 0.028, 0.14);
      bladeGeom.translate(bladeLength / 2, 0, 0);
      bladeGeom.rotateX(0.35); // 20 deg hydrofoil pitch
      const bladeMesh = new THREE.Mesh(bladeGeom, this.matStainless);
      bladeMesh.name = `StirrerBlade_${i}`;
      bladeMesh.position.set(0, impellerY, 0);
      bladeMesh.rotation.y = angle;
      rotatingAssembly.add(bladeMesh);
    }

    // Mid-level secondary dispersing turbine blades
    const midY = impellerY + shaftLength * 0.44;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bladeGeom = new THREE.BoxGeometry(bladeLength * 0.65, 0.022, 0.1);
      bladeGeom.translate((bladeLength * 0.65) / 2, 0, 0);
      bladeGeom.rotateX(-0.3);
      const bladeMesh = new THREE.Mesh(bladeGeom, this.matStainless);
      bladeMesh.name = `StirrerMidBlade_${i}`;
      bladeMesh.position.set(0, midY, 0);
      bladeMesh.rotation.y = angle;
      rotatingAssembly.add(bladeMesh);
    }

    this.registerPart(rotatingAssembly, 'StirrerImpeller', new THREE.Vector3(0, 1.8, 0), 20);
    stirrerRoot.add(rotatingAssembly);

    this.group.add(stirrerRoot);
    this.stirrer = rotatingAssembly;
    this.stirrerRoot = stirrerRoot;
  }

  buildConnectingPipe(side = 'left') {
    const opt = this.options;
    const isLeft = side === 'left';
    const sign = isLeft ? -1 : 1;

    // Drop position: under elevated tank, offset towards center tank
    const dropX = sign * (opt.sideDistanceX - 0.70);
    const dropYStart = opt.sideBaseY;
    const inletY = opt.inletY;
    const bendR = opt.bendRadius;
    const targetX = sign * opt.centerRadius;

    // 1. Construct continuous smooth tube for solid mesh & fluid particles
    const path = new THREE.CurvePath();
    const pStart = new THREE.Vector3(dropX, dropYStart, 0);
    const pBendTop = new THREE.Vector3(dropX, inletY + bendR, 0);
    path.add(new THREE.LineCurve3(pStart, pBendTop));

    const pBendControl = new THREE.Vector3(dropX, inletY, 0);
    const pBendEnd = new THREE.Vector3(dropX - sign * bendR, inletY, 0);
    path.add(new THREE.QuadraticBezierCurve3(pBendTop, pBendControl, pBendEnd));

    const pTarget = new THREE.Vector3(targetX, inletY, 0);
    path.add(new THREE.LineCurve3(pBendEnd, pTarget));

    const pipeGeom = new THREE.TubeGeometry(path, 64, opt.pipeRadius, 24, false);
    const pipeMesh = new THREE.Mesh(pipeGeom, this.matPipeSolid);

    const explodeVec = new THREE.Vector3(sign * 1.0, 0.5, 0);
    this.registerPart(pipeMesh, `UpperPipe_${side}`, explodeVec, 20);

    if (isLeft) {
      this.leftPipeMesh = pipeMesh;
    } else {
      this.rightPipeMesh = pipeMesh;
    }

    // 2. Attach authentic CAD silhouette lines for the pipe:
    const pipeSilPairs = [];
    // A. Vertical drop lines
    pipeSilPairs.push(
      new THREE.Vector3(dropX - opt.pipeRadius, dropYStart, 0),
      new THREE.Vector3(dropX - opt.pipeRadius, inletY + bendR, 0)
    );
    pipeSilPairs.push(
      new THREE.Vector3(dropX + opt.pipeRadius, dropYStart, 0),
      new THREE.Vector3(dropX + opt.pipeRadius, inletY + bendR, 0)
    );

    // B. Horizontal run lines (from elbow end to tank wall)
    const elbowEndX = dropX + (isLeft ? bendR : -bendR);
    pipeSilPairs.push(
      new THREE.Vector3(elbowEndX, inletY + opt.pipeRadius, 0),
      new THREE.Vector3(targetX, inletY + opt.pipeRadius, 0)
    );
    pipeSilPairs.push(
      new THREE.Vector3(elbowEndX, inletY - opt.pipeRadius, 0),
      new THREE.Vector3(targetX, inletY - opt.pipeRadius, 0)
    );

    // C. 90-degree outer and inner bend arcs
    const arcSegments = 20;
    const cx = elbowEndX;
    const cy = inletY + bendR;

    for (let i = 0; i < arcSegments; i++) {
      const t1 = i / arcSegments;
      const t2 = (i + 1) / arcSegments;

      const angle1 = isLeft
        ? Math.PI + t1 * 0.5 * Math.PI
        : -t1 * 0.5 * Math.PI;
      const angle2 = isLeft
        ? Math.PI + t2 * 0.5 * Math.PI
        : -t2 * 0.5 * Math.PI;

      // Outer arc
      const rOut = bendR + opt.pipeRadius;
      pipeSilPairs.push(
        new THREE.Vector3(cx + Math.cos(angle1) * rOut, cy + Math.sin(angle1) * rOut, 0),
        new THREE.Vector3(cx + Math.cos(angle2) * rOut, cy + Math.sin(angle2) * rOut, 0)
      );

      // Inner arc
      const rIn = bendR - opt.pipeRadius;
      pipeSilPairs.push(
        new THREE.Vector3(cx + Math.cos(angle1) * rIn, cy + Math.sin(angle1) * rIn, 0),
        new THREE.Vector3(cx + Math.cos(angle2) * rIn, cy + Math.sin(angle2) * rIn, 0)
      );
    }

    // D. Circular seam rings at elbow start and elbow end
    const ringDrop = this.createCircleLine(opt.pipeRadius, 0, 'y');
    ringDrop.position.set(dropX, inletY + bendR, 0);
    pipeMesh.add(ringDrop);

    const ringHoriz = this.createCircleLine(opt.pipeRadius, 0, 'x');
    ringHoriz.position.set(elbowEndX, inletY, 0);
    pipeMesh.add(ringHoriz);

    pipeMesh.add(this.createLineSegments(pipeSilPairs));
    this.group.add(pipeMesh);

    // 3. Sleeve / Collar Coupling on horizontal pipe
    const collarX = sign * (opt.centerRadius + Math.abs(dropX - targetX) * 0.42);
    const collarGeom = new THREE.CylinderGeometry(
      opt.collarRadius,
      opt.collarRadius,
      opt.collarLength,
      28
    );
    collarGeom.rotateZ(Math.PI / 2);

    const collarMesh = new THREE.Mesh(collarGeom, this.matCollarSolid);
    collarMesh.position.set(collarX, inletY, 0);

    // Collar silhouette lines (top line and bottom line)
    const collarPairs = [
      new THREE.Vector3(-opt.collarLength / 2, opt.collarRadius, 0),
      new THREE.Vector3(opt.collarLength / 2, opt.collarRadius, 0),
      new THREE.Vector3(-opt.collarLength / 2, -opt.collarRadius, 0),
      new THREE.Vector3(opt.collarLength / 2, -opt.collarRadius, 0),
    ];
    collarMesh.add(this.createLineSegments(collarPairs));

    const collarExplode = new THREE.Vector3(sign * 0.6, 0.4, 0);
    this.registerPart(collarMesh, `PipeCollar_${side}`, collarExplode, 20);
    this.group.add(collarMesh);

    // 4. Valve Actuator & Rotary Handle mounted right at collar
    const valveGroup = new THREE.Group();
    valveGroup.name = `Valve_${isLeft ? 'A' : 'B'}`;
    valveGroup.position.set(collarX, inletY, 0);

    // Actuator body rising above the pipe
    const actuatorBodyGeom = new THREE.CylinderGeometry(0.075, 0.085, 0.16, 16);
    const actuatorBody = new THREE.Mesh(actuatorBodyGeom, this.matCollarSolid);
    actuatorBody.position.set(0, opt.collarRadius + 0.08, 0);
    this.registerPart(actuatorBody, `ValveActuator_${isLeft ? 'A' : 'B'}`, collarExplode, 20);
    valveGroup.add(actuatorBody);

    // Valve Indicator LED Beacon
    const beaconGeom = new THREE.SphereGeometry(0.042, 16, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      emissive: 0x334155,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.2,
    });
    const beaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
    beaconMesh.name = `ValveIndicator_${isLeft ? 'A' : 'B'}`;
    beaconMesh.position.set(0, opt.collarRadius + 0.20, 0);
    valveGroup.add(beaconMesh);

    // Valve Rotary Handle / Lever (rotates around Y axis: 0 = OPEN aligned with pipe, PI/2 = CLOSED perpendicular)
    const handleGroup = new THREE.Group();
    handleGroup.name = `ValveHandle_${isLeft ? 'A' : 'B'}`;
    handleGroup.position.set(0, opt.collarRadius + 0.24, 0);

    const handleStemGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.06, 12);
    const handleStem = new THREE.Mesh(handleStemGeom, this.matPipeSolid);
    handleGroup.add(handleStem);

    // Butterfly lever bar
    const handleBarGeom = new THREE.BoxGeometry(0.28, 0.024, 0.045);
    const handleBar = new THREE.Mesh(handleBarGeom, this.matPipeSolid);
    handleBar.position.set(0, 0.03, 0);
    handleGroup.add(handleBar);

    // Initial closed state: perpendicular (Math.PI / 2)
    handleGroup.rotation.y = Math.PI / 2;
    valveGroup.add(handleGroup);

    this.registerPart(valveGroup, `ValveAssembly_${isLeft ? 'A' : 'B'}`, collarExplode, 20);
    this.group.add(valveGroup);

    const valveData = {
      group: valveGroup,
      handle: handleGroup,
      beacon: beaconMesh,
      beaconMat: beaconMat,
      isOpen: false,
    };

    if (isLeft) {
      this.valveA = valveData;
      this.leftPipeCurve = path;
    } else {
      this.valveB = valveData;
      this.rightPipeCurve = path;
    }
  }

  applyTheme(theme) {
    this.currentTheme = theme;

    let tankMaterial;
    let pipeMaterial;
    let collarMaterial;
    let edgeLineMaterial;
    let showEdges = true;

    switch (theme) {
      case 'cadOutline': // Matches Image 1
        tankMaterial = this.matCadOutlineBody;
        pipeMaterial = this.matPipeCadOutline;
        collarMaterial = this.matPipeCadOutline;
        edgeLineMaterial = this.matLineCad;
        showEdges = true;
        break;

      case 'solidCad': // Matches Image 2
        tankMaterial = this.matSolidCad;
        pipeMaterial = this.matPipeSolid;
        collarMaterial = this.matCollarSolid;
        edgeLineMaterial = this.matLineSolid;
        showEdges = true;
        break;

      case 'stainless':
        tankMaterial = this.matStainless;
        pipeMaterial = this.matStainless;
        collarMaterial = this.matStainless;
        edgeLineMaterial = this.matLineSolid;
        showEdges = false;
        break;

      case 'fluidSim':
        tankMaterial = this.matFluidGlass;
        pipeMaterial = this.matFluidGlass;
        collarMaterial = this.matCollarSolid;
        edgeLineMaterial = this.matLineCad;
        showEdges = true;
        break;

      case 'blueprint':
        tankMaterial = this.matBlueprintBody;
        pipeMaterial = this.matBlueprintBody;
        collarMaterial = this.matBlueprintBody;
        edgeLineMaterial = this.matLineBlueprint;
        showEdges = true;
        break;

      default:
        tankMaterial = this.matSolidCad;
        pipeMaterial = this.matPipeSolid;
        collarMaterial = this.matCollarSolid;
        edgeLineMaterial = this.matLineSolid;
        showEdges = true;
    }

    this.solidMeshes.forEach((mesh) => {
      if (mesh.name && mesh.name.includes('ValveIndicator')) {
        // Keep beacon emissive material intact
        return;
      } else if (mesh.name && (mesh.name.includes('PipeCollar') || mesh.name.includes('ValveActuator') || mesh.name.includes('StirrerMotor'))) {
        mesh.material = collarMaterial;
      } else if (mesh.name && (mesh.name.includes('StirrerShaft') || mesh.name.includes('StirrerBlade') || mesh.name.includes('StirrerImpeller'))) {
        mesh.material = (theme === 'blueprint') ? this.matBlueprintBody : this.matStainless;
      } else if (mesh.name && (mesh.name.includes('Pipe') || mesh.name.includes('Leg') || mesh.name.includes('Foot') || mesh.name.includes('Bridge') || mesh.name.includes('Valve'))) {
        mesh.material = pipeMaterial;
      } else {
        mesh.material = tankMaterial;
      }
    });

    this.edgeLines.forEach((line) => {
      line.material = edgeLineMaterial;
      line.visible = showEdges;
    });
  }

  setEdgesVisible(visible) {
    this.edgeLines.forEach((line) => {
      line.visible = visible;
    });
  }

  setExploded(factor) {
    this.explodedFactor = Math.max(0, Math.min(1, factor));
    this.explodedParts.forEach((part) => {
      part.object.position.copy(part.initialPos).addScaledVector(part.explodeVector, this.explodedFactor);
    });
  }

  setClipping(enableClipping, planeNormal = new THREE.Vector3(0, 0, -1), constant = 0) {
    const clippingPlanes = enableClipping ? [new THREE.Plane(planeNormal, constant)] : [];
    [
      this.matSolidCad,
      this.matCadOutlineBody,
      this.matStainless,
      this.matFluidGlass,
      this.matBlueprintBody,
      this.matPipeSolid,
      this.matCollarSolid,
    ].forEach((mat) => {
      mat.clippingPlanes = clippingPlanes;
      mat.clipShadows = true;
      mat.needsUpdate = true;
    });
  }
}
