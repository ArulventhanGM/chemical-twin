import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8080);
const server = new WebSocketServer({ port });

const scenarios = [
  {
    tanks: { A: { level: 75, dispensed: 120 }, B: { level: 50, dispensed: 100 }, C: { level: 30, dispensed: 0 } },
    equipment: { valveA: false, valveB: false, stirrer: false },
    process: { stage: 'IDLE', mixingTime: 0, targetVolume: 200 },
    error: { active: false, message: '' },
  },
  {
    tanks: { A: { level: 60, dispensed: 140 }, B: { level: 40, dispensed: 100 }, C: { level: 20, dispensed: 0 } },
    equipment: { valveA: true, valveB: false, stirrer: false },
    process: { stage: 'DOSING_A', mixingTime: 12, targetVolume: 200 },
    error: { active: false, message: '' },
  },
  {
    tanks: { A: { level: 40, dispensed: 160 }, B: { level: 60, dispensed: 140 }, C: { level: 70, dispensed: 0 } },
    equipment: { valveA: false, valveB: false, stirrer: true },
    process: { stage: 'MIXING', mixingTime: 60, targetVolume: 200 },
    error: { active: false, message: '' },
  },
  {
    tanks: { A: { level: 20, dispensed: 180 }, B: { level: 20, dispensed: 180 }, C: { level: 90, dispensed: 0 } },
    equipment: { valveA: false, valveB: false, stirrer: false },
    process: { stage: 'ERROR_STATE', mixingTime: 0, targetVolume: 200 },
    error: { active: true, message: 'Ultrasonic sensor failure' },
  },
];

let scenarioIndex = 0;

function createState() {
  return {
    timestamp: new Date().toISOString(),
    ...scenarios[scenarioIndex],
  };
}

function broadcast() {
  const message = JSON.stringify(createState());
  server.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
  console.log(`Broadcast ${scenarios[scenarioIndex].process.stage} to ${server.clients.size} client(s)`);
  scenarioIndex = (scenarioIndex + 1) % scenarios.length;
}

server.on('listening', () => {
  console.log(`Fake digital-twin WebSocket server listening on ws://localhost:${port}`);
  broadcast();
});

server.on('connection', (socket) => {
  socket.send(JSON.stringify(createState()));
  console.log('Frontend connected to fake digital-twin server');
});

setInterval(broadcast, 5000);