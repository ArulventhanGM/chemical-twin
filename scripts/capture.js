import fs from 'fs';

async function main() {
  const listRes = await fetch('http://localhost:9222/json');
  const tabs = await listRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:5173'));
  if (!pageTab) {
    console.error('Page tab not found!');
    process.exit(1);
  }

  console.log('Connecting to:', pageTab.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onopen = async () => {
    console.log('WebSocket connected');
    try {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      console.log('Navigating to http://localhost:5173/ ...');
      await send('Page.navigate', { url: 'http://localhost:5173/' });

      // Wait 3 seconds for load and Three.js initialization
      await new Promise(r => setTimeout(r, 3000));

      // 1. Capture Image 1 initial mode
      const snap1 = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('d:/Projects/Three.js Tanks/cad_wireframe_image1.png', Buffer.from(snap1.result.data, 'base64'));
      console.log('Saved cad_wireframe_image1.png');

      // 2. Switch to Solid CAD mode (Image 2) and Front View
      await send('Runtime.evaluate', {
        expression: `
          document.querySelector('button[data-theme="solidCad"]').click();
          document.querySelector('button[data-preset="image2"]').click();
        `
      });

      await new Promise(r => setTimeout(r, 1500));

      const snap2 = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('d:/Projects/Three.js Tanks/solid_cad_image2.png', Buffer.from(snap2.result.data, 'base64'));
      console.log('Saved solid_cad_image2.png');

      // 3. Switch on 3D dimensions
      await send('Runtime.evaluate', {
        expression: `
          document.getElementById('chk-dimensions').click();
          document.querySelector('button[data-preset="image1"]').click();
        `
      });

      await new Promise(r => setTimeout(r, 1200));

      const snap3 = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('d:/Projects/Three.js Tanks/cad_dimensions.png', Buffer.from(snap3.result.data, 'base64'));
      console.log('Saved cad_dimensions.png');

      // 4. Capture Fluid Flow Inspection Mode
      await send('Runtime.evaluate', {
        expression: `
          document.getElementById('chk-dimensions').click(); // turn off dimensions
          document.querySelector('button[data-theme="fluidSim"]').click();
        `
      });
      await new Promise(r => setTimeout(r, 1500));
      const snap4 = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('d:/Projects/Three.js Tanks/fluid_flow_mode.png', Buffer.from(snap4.result.data, 'base64'));
      console.log('Saved fluid_flow_mode.png');

      // 5. Capture Exploded View Mode
      await send('Runtime.evaluate', {
        expression: `
          const slider = document.getElementById('slider-explode');
          slider.value = 0.85;
          slider.dispatchEvent(new Event('input'));
          document.querySelector('button[data-theme="solidCad"]').click();
        `
      });
      await new Promise(r => setTimeout(r, 1500));
      const snap5 = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('d:/Projects/Three.js Tanks/exploded_view.png', Buffer.from(snap5.result.data, 'base64'));
      console.log('Saved exploded_view.png');

      console.log('All screenshots captured successfully!');
      ws.close();
      process.exit(0);
    } catch (err) {
      console.error('Error during capture:', err);
      ws.close();
      process.exit(1);
    }
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data);
      }
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
    }
  };

  ws.onerror = (err) => {
    console.error('WS Error:', err);
  };
}

main();
