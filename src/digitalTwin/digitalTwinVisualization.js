import * as THREE from 'three';

export class DigitalTwinVisualization {
  constructor(assembly, fluidSystem) {
    this.assembly = assembly;
    this.fluidSystem = fluidSystem;
    this.modelObjects = {
      tankA: assembly.group.getObjectByName('LeftTank'),
      tankB: assembly.group.getObjectByName('RightTank'),
      tankC: assembly.group.getObjectByName('CenterTank'),
      liquidA: fluidSystem.leftLiquidMesh,
      liquidB: fluidSystem.rightLiquidMesh,
      liquidC: fluidSystem.centerLiquidMesh,
      valveA: assembly.valveA,
      valveB: assembly.valveB,
      stirrer: assembly.stirrer,
      pipes: [assembly.leftPipeMesh, assembly.rightPipeMesh],
    };
    this.stage = 'IDLE';
    this.valveTargets = { A: false, B: false };
  }

  applyState(state) {
    this.fluidSystem.setTargetLevels(
      state.tanks.A.level / 100,
      state.tanks.B.level / 100,
      state.tanks.C.level / 100
    );
    this.valveTargets.A = state.equipment.valveA;
    this.valveTargets.B = state.equipment.valveB;
    this.assembly.valveA.isOpen = state.equipment.valveA;
    this.assembly.valveB.isOpen = state.equipment.valveB;
    this.stage = state.process.stage;
    this.fluidSystem.setProcessFlow(this.stage, state.equipment.valveA, state.equipment.valveB);
    this.fluidSystem.setVisible(true);
    this.updateProcessStage(this.stage);
  }

  updateProcessStage(stage) {
    const activeFlow = stage === 'DOSING_A' || stage === 'DOSING_B';
    this.fluidSystem.setFlowAnimationEnabled(activeFlow);
  }

  update(delta) {
    const smoothing = 1 - Math.exp(-6 * delta);
    this.fluidSystem.updateSmoothLevels(smoothing);
    [
      ['A', this.assembly.valveA],
      ['B', this.assembly.valveB],
    ].forEach(([key, valve]) => {
      const target = this.valveTargets[key];
      valve.handle.rotation.y = THREE.MathUtils.lerp(
        valve.handle.rotation.y,
        target ? 0 : Math.PI / 2,
        smoothing
      );
      valve.beacon.material.color.setHex(target ? 0x22c55e : 0x475569);
      valve.beacon.material.emissive.setHex(target ? 0x16a34a : 0x334155);
    });
    if (this.assembly.stirrer && this.currentStirrerActive) {
      this.assembly.stirrer.rotation.y += delta * 4.5;
    }
  }

  setStirrerActive(active) {
    this.currentStirrerActive = active;
  }
}