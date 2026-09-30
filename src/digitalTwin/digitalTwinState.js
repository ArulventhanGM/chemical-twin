const PROCESS_STAGES = new Set([
  'IDLE',
  'DOSING_A',
  'DOSING_B',
  'MIXING',
  'COMPLETE',
  'STOPPED',
  'ERROR_STATE',
]);

let digitalTwinState = null;

function numberOrDefault(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function validateDigitalTwinData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['State must be a JSON object.'], data: null };
  }

  const tanks = data.tanks || {};
  const equipment = data.equipment || {};
  const process = data.process || {};
  const error = data.error || {};

  ['A', 'B', 'C'].forEach((tank) => {
    if (typeof tanks[tank]?.level !== 'number' || !Number.isFinite(tanks[tank].level)) {
      errors.push(`tanks.${tank}.level must be a finite number.`);
    }
  });
  ['valveA', 'valveB', 'stirrer'].forEach((key) => {
    if (typeof equipment[key] !== 'boolean') errors.push(`equipment.${key} must be boolean.`);
  });
  if (!PROCESS_STAGES.has(process.stage)) {
    errors.push(`process.stage must be one of: ${Array.from(PROCESS_STAGES).join(', ')}.`);
  }

  const normalized = {
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    tanks: {},
    equipment: {
      valveA: equipment.valveA === true,
      valveB: equipment.valveB === true,
      stirrer: equipment.stirrer === true,
    },
    process: {
      stage: PROCESS_STAGES.has(process.stage) ? process.stage : 'STOPPED',
      mixingTime: numberOrDefault(process.mixingTime),
      targetVolume: numberOrDefault(process.targetVolume),
    },
    error: {
      active: error.active === true,
      message: typeof error.message === 'string' ? error.message : '',
    },
  };

  ['A', 'B', 'C'].forEach((tank) => {
    normalized.tanks[tank] = {
      level: Math.max(0, Math.min(100, numberOrDefault(tanks[tank]?.level))),
      dispensed: numberOrDefault(tanks[tank]?.dispensed),
    };
  });

  return { valid: errors.length === 0, errors, data: normalized };
}

export function updateDigitalTwin(data) {
  const result = validateDigitalTwinData(data);
  if (!result.valid) {
    console.error('Rejected digital-twin state:', result.errors.join(' '));
    return false;
  }
  digitalTwinState = result.data;
  window.dispatchEvent(new CustomEvent('digital-twin-state', { detail: digitalTwinState }));
  return true;
}

export function getDigitalTwinState() {
  return digitalTwinState;
}

export async function loadLocalDigitalTwinData(url = './data/digitalTwinState.json') {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    updateDigitalTwin(data);
  } catch (error) {
    console.error('Unable to load local digital-twin state:', error);
  }
}

export function connectDigitalTwinWebSocket(url = 'ws://localhost:8080') {
  let socket;
  try {
    socket = new WebSocket(url);
  } catch (error) {
    console.error('Unable to connect to digital-twin WebSocket:', error);
    return null;
  }
  socket.addEventListener('open', () => console.info(`Digital-twin WebSocket connected: ${url}`));
  socket.addEventListener('error', () => console.warn(`Digital-twin WebSocket unavailable: ${url}`));
  socket.addEventListener('message', (event) => {
    try {
      updateDigitalTwin(JSON.parse(event.data));
    } catch (error) {
      console.error('Invalid digital-twin WebSocket message:', error);
    }
  });
  return socket;
}

export { PROCESS_STAGES };