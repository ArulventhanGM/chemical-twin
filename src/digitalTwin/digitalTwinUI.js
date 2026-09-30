export function updateDigitalTwinUI(state) {
  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  set('dt-level-a', `${Math.round(state.tanks.A.level)} %`);
  set('dt-level-b', `${Math.round(state.tanks.B.level)} %`);
  set('dt-level-c', `${Math.round(state.tanks.C.level)} %`);
  set('dt-dispensed-a', `${state.tanks.A.dispensed} mL`);
  set('dt-dispensed-b', `${state.tanks.B.dispensed} mL`);
  set('dt-valve-a', state.equipment.valveA ? 'OPEN' : 'CLOSED');
  set('dt-valve-b', state.equipment.valveB ? 'OPEN' : 'CLOSED');
  set('dt-stirrer', state.equipment.stirrer ? 'ON' : 'OFF');
  set('dt-stage', state.process.stage);
  set('dt-target', `${state.process.targetVolume} mL`);
  set('dt-mixing-time', `${state.process.mixingTime} seconds`);

  const panel = document.getElementById('digital-twin-status');
  const error = document.getElementById('dt-error');
  if (panel) panel.dataset.stage = state.process.stage;
  if (error) {
    error.hidden = !state.error.active;
    error.textContent = state.error.active ? `ERROR: ${state.error.message}` : '';
  }
}