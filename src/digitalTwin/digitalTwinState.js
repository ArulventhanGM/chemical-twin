import mqtt from 'mqtt';

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
const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'water/arul';

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
    deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
    uptimeMs: numberOrDefault(data.uptimeMs),
    sensors: {
      A: typeof data.sensors?.A === 'boolean' ? data.sensors.A : null,
      B: typeof data.sensors?.B === 'boolean' ? data.sensors.B : null,
      C: typeof data.sensors?.C === 'boolean' ? data.sensors.C : null,
    },
    tanks: {},
    equipment: {
      valveA: equipment.valveA === true,
      valveB: equipment.valveB === true,
      stirrer: equipment.stirrer === true,
    },
    process: {
      stage: PROCESS_STAGES.has(process.stage) ? process.stage : 'STOPPED',
      running: process.running === true,
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

function mapHardwarePayload(payload) {
  const stage = payload.cycle_status === 'READY' ? 'IDLE' : payload.cycle_status;

  return {
    deviceId: payload.device_id,
    uptimeMs: payload.uptime_ms,
    sensors: {
      A: payload.tank_a_sensor_ok,
      B: payload.tank_b_sensor_ok,
      C: payload.tank_c_sensor_ok,
    },
    tanks: {
      A: { level: payload.tank_a_level_pct, dispensed: payload.dispensed_a_ml },
      B: { level: payload.tank_b_level_pct, dispensed: payload.dispensed_b_ml },
      C: { level: payload.tank_c_level_pct, dispensed: 0 },
    },
    equipment: {
      valveA: payload.valve_a_on,
      valveB: payload.valve_b_on,
      stirrer: payload.stirrer_on,
    },
    process: {
      stage,
      running: payload.cycle_running,
      mixingTime: payload.mixing_time_s,
      targetVolume: payload.target_volume_ml,
    },
    error: {
      active: typeof payload.error === 'string' && payload.error.length > 0,
      message: typeof payload.error === 'string' ? payload.error : '',
    },
  };
}

function dispatchMqttStatus(status) {
  window.dispatchEvent(new CustomEvent('digital-twin-connection', { detail: status }));
}

export function connectDigitalTwinMqtt() {
  const client = mqtt.connect(MQTT_URL, {
    clientId: `chemical-twin-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 10000,
    keepalive: 30,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    dispatchMqttStatus('SUBSCRIBING');
    client.subscribe(MQTT_TOPIC, (error) => {
      if (error) {
        console.error(`Unable to subscribe to ${MQTT_TOPIC}:`, error);
        dispatchMqttStatus('ERROR');
        return;
      }
      console.info(`Subscribed to MQTT topic: ${MQTT_TOPIC}`);
      dispatchMqttStatus('CONNECTED');
    });
  });
  client.on('reconnect', () => dispatchMqttStatus('RECONNECTING'));
  client.on('offline', () => dispatchMqttStatus('OFFLINE'));
  client.on('error', (error) => {
    console.warn('Digital-twin MQTT connection error:', error);
    dispatchMqttStatus('ERROR');
  });
  client.on('message', (topic, message) => {
    if (topic !== MQTT_TOPIC) return;
    try {
      const payload = JSON.parse(message.toString());
      if (payload.cycle_status === 'OFFLINE' && payload.tank_a_level_pct === undefined) return;
      updateDigitalTwin(mapHardwarePayload(payload));
    } catch (error) {
      console.error('Invalid digital-twin MQTT message:', error);
    }
  });

  return client;
}

export { PROCESS_STAGES };