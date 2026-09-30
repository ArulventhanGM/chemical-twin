import * as THREE from 'three';

/**
 * Creates technical 3D CAD dimension annotations, leader lines,
 * tick markers, and text callouts for engineering inspection.
 */
export class DimensionsAnnotation {
  constructor(assembly) {
    this.assembly = assembly;
    this.opt = assembly.options;
    this.group = new THREE.Group();
    this.group.name = 'CAD_Dimensions_Annotation';
    this.visible = false;
    this.group.visible = false;

    this.lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    this.buildDimensions();
    this.assembly.group.add(this.group);
  }

  createTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 60, 12);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.4, 0.45, 1);
    return sprite;
  }

  addDimensionLine(p1, p2, labelText, offsetText = new THREE.Vector3(0, 0.25, 0)) {
    const points = [p1, p2];

    // Main dimension line
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, this.lineMat);
    this.group.add(line);

    // End tick marks
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.12);

    const tick1Geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().addVectors(p1, perp),
      new THREE.Vector3().subVectors(p1, perp),
    ]);
    this.group.add(new THREE.Line(tick1Geom, this.lineMat));

    const tick2Geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().addVectors(p2, perp),
      new THREE.Vector3().subVectors(p2, perp),
    ]);
    this.group.add(new THREE.Line(tick2Geom, this.lineMat));

    // Label Sprite
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).add(offsetText);
    const sprite = this.createTextSprite(labelText);
    sprite.position.copy(mid);
    this.group.add(sprite);
  }

  buildDimensions() {
    const opt = this.opt;

    // 1. Center Tank Height (H 3200 mm)
    const cX = opt.centerRadius + 0.4;
    this.addDimensionLine(
      new THREE.Vector3(cX, opt.centerBaseY, 0),
      new THREE.Vector3(cX, opt.centerBaseY + opt.centerHeight, 0),
      'H: 3200mm',
      new THREE.Vector3(0.5, 0, 0)
    );

    // 2. Center Tank Diameter (Ø 2500 mm)
    const cTopY = opt.centerBaseY + opt.centerHeight + 0.35;
    this.addDimensionLine(
      new THREE.Vector3(-opt.centerRadius, cTopY, 0),
      new THREE.Vector3(opt.centerRadius, cTopY, 0),
      'Ø 2500mm',
      new THREE.Vector3(0, 0.28, 0)
    );

    // 3. Center Tank Base Clearance (600 mm)
    this.addDimensionLine(
      new THREE.Vector3(-opt.centerRadius - 0.3, 0, 0),
      new THREE.Vector3(-opt.centerRadius - 0.3, opt.centerBaseY, 0),
      '600mm',
      new THREE.Vector3(-0.4, 0, 0)
    );

    // 4. Elevated Left Tank Height (H 2200 mm)
    const lX = -opt.sideDistanceX - opt.sideRadius - 0.35;
    this.addDimensionLine(
      new THREE.Vector3(lX, opt.sideBaseY, 0),
      new THREE.Vector3(lX, opt.sideBaseY + opt.sideHeight, 0),
      'H: 2200mm',
      new THREE.Vector3(-0.55, 0, 0)
    );

    // 5. Elevated Left Tank Diameter (Ø 2000 mm)
    const lTopY = opt.sideBaseY + opt.sideHeight + 0.35;
    this.addDimensionLine(
      new THREE.Vector3(-opt.sideDistanceX - opt.sideRadius, lTopY, 0),
      new THREE.Vector3(-opt.sideDistanceX + opt.sideRadius, lTopY, 0),
      'Ø 2000mm',
      new THREE.Vector3(0, 0.28, 0)
    );

    // 6. Elevated Legs Height (3000 mm)
    const legX = -opt.sideDistanceX - opt.sideRadius - 0.85;
    this.addDimensionLine(
      new THREE.Vector3(legX, 0, 0),
      new THREE.Vector3(legX, opt.sideBaseY, 0),
      'Legs: 3000mm',
      new THREE.Vector3(-0.6, 0, 0)
    );

    // 7. Overall Width Span (8600 mm)
    const bottomY = -0.55;
    this.addDimensionLine(
      new THREE.Vector3(-opt.sideDistanceX - opt.sideRadius, bottomY, 0),
      new THREE.Vector3(opt.sideDistanceX + opt.sideRadius, bottomY, 0),
      'Span: 9600mm',
      new THREE.Vector3(0, -0.32, 0)
    );
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
  }
}
