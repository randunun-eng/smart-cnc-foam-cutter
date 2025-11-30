import React, { useState, useEffect } from 'react';

// Configuration (can be props or env vars)
const LUCKFOX_BASE_URL = "http://luckfox-ip:5000"; // Replace with actual IP
const SLICER_API_URL = "https://ai-slicer.your-worker.workers.dev/slicer";
const WATCHER_API_URL = "https://watcher.your-worker.workers.dev/machine_status";
const MACHINE_ID = "foam-cnc-01";

export default function App() {
    const [gcode, setGcode] = useState("");
    const [status, setStatus] = useState<any>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [heat, setHeat] = useState(0);
    const [heatEnabled, setHeatEnabled] = useState(false);
    const [jogSpeed, setJogSpeed] = useState(1000);
    const [prompt, setPrompt] = useState("");
    const [isOnline, setIsOnline] = useState(false);

    const log = (msg: string) => setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Polling Status
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${LUCKFOX_BASE_URL}/status`);
                const data = await res.json();
                setStatus(data);
            } catch (e) {
                // Silent fail or log connection error
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Polling Watcher
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${WATCHER_API_URL}?machineId=${MACHINE_ID}`);
                const data = await res.json();
                setIsOnline(data.online);
            } catch (e) {
                setIsOnline(false);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const sendJog = async (axis: string, dist: number) => {
        try {
            await fetch(`${LUCKFOX_BASE_URL}/jog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ axis, distance: dist, feed: jogSpeed })
            });
            log(`Jog ${axis} ${dist}`);
        } catch (e) {
            log(`Jog failed: ${e}`);
        }
    };

    const handleHeat = async (val: number) => {
        setHeat(val);
        if (heatEnabled) {
            await fetch(`${LUCKFOX_BASE_URL}/heat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duty: val })
            });
        }
    };

    const toggleHeat = async () => {
        const newState = !heatEnabled;
        setHeatEnabled(newState);
        await fetch(`${LUCKFOX_BASE_URL}/heat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duty: newState ? heat : 0 })
        });
        log(`Heat ${newState ? 'ON' : 'OFF'}`);
    };

    const runJob = async () => {
        // For simplicity, we'll upload the current text as a file first
        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'editor_job.gcode');

        try {
            const upRes = await fetch(`${LUCKFOX_BASE_URL}/gcode/upload`, { method: 'POST', body: formData });
            const upData = await upRes.json();

            await fetch(`${LUCKFOX_BASE_URL}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: upData.path })
            });
            log("Job started");
        } catch (e) {
            log(`Start failed: ${e}`);
        }
    };

    const generateGcode = async () => {
        log("Generating G-code...");
        try {
            const res = await fetch(SLICER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            // Adjust based on actual worker response format
            const code = typeof data === 'string' ? data : (data.response || JSON.stringify(data));
            setGcode(code);
            log("G-code generated");
        } catch (e) {
            log(`Generation failed: ${e}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-mono flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <h1 className="text-2xl font-bold text-neon-blue">SMART CNC FOAM CUTTER</h1>
                <div className={`px-3 py-1 rounded ${isOnline ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1">
                {/* Left: Video & Heat */}
                <div className="col-span-4 flex flex-col gap-4">
                    <div className="relative bg-black rounded border border-gray-700 aspect-video flex items-center justify-center overflow-hidden">
                        <img src={`${LUCKFOX_BASE_URL}/video_feed`} alt="Live Feed" className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                            <span className="text-xs text-red-500 font-bold">REC</span>
                        </div>
                        <div className="absolute bottom-2 right-2 text-neon-orange font-bold text-xl">
                            {status.heat_duty || 0}% HEAT
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                        <h2 className="text-neon-orange mb-2 font-bold">WIRE HEAT CONTROL</h2>
                        <div className="flex items-center gap-4">
                            <input
                                type="range" min="0" max="100"
                                value={heat}
                                onChange={(e) => handleHeat(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <span className="w-12 text-right">{heat}%</span>
                        </div>
                        <button
                            onClick={toggleHeat}
                            className={`mt-4 w-full py-2 rounded font-bold ${heatEnabled ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            {heatEnabled ? 'DISABLE HEAT' : 'ENABLE HEAT'}
                        </button>
                    </div>
                </div>

                {/* Center: Editor & AI */}
                <div className="col-span-5 flex flex-col gap-4">
                    <div className="bg-gray-800 p-4 rounded border border-gray-700 flex-1 flex flex-col">
                        <div className="flex justify-between mb-2">
                            <h2 className="text-blue-400 font-bold">G-CODE EDITOR</h2>
                            <span className="text-xs text-gray-500">Line: {status.current_line || 0} / {status.total_lines || 0}</span>
                        </div>
                        <textarea
                            value={gcode}
                            onChange={(e) => setGcode(e.target.value)}
                            className="flex-1 bg-gray-900 text-green-400 p-2 font-mono text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none"
                            placeholder="G-code goes here..."
                        />
                        <div className="flex gap-2 mt-2">
                            <button onClick={runJob} className="flex-1 bg-green-700 hover:bg-green-600 py-2 rounded font-bold">RUN JOB</button>
                            <button onClick={() => fetch(`${LUCKFOX_BASE_URL}/pause`, { method: 'POST' })} className="flex-1 bg-yellow-700 hover:bg-yellow-600 py-2 rounded font-bold">PAUSE</button>
                            <button onClick={() => fetch(`${LUCKFOX_BASE_URL}/stop`, { method: 'POST' })} className="flex-1 bg-red-700 hover:bg-red-600 py-2 rounded font-bold">STOP</button>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                        <h2 className="text-purple-400 mb-2 font-bold">AI SLICER</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. Cut a 100mm star"
                                className="flex-1 bg-gray-900 border border-gray-700 p-2 rounded text-white"
                            />
                            <button onClick={generateGcode} className="bg-purple-700 hover:bg-purple-600 px-4 rounded font-bold">GENERATE</button>
                        </div>
                    </div>
                </div>

                {/* Right: Jog & Status */}
                <div className="col-span-3 flex flex-col gap-4">
                    <div className="bg-gray-800 p-4 rounded border border-gray-700">
                        <h2 className="text-blue-400 mb-4 font-bold text-center">MANUAL JOG</h2>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div></div>
                            <button onClick={() => sendJog('Y', 10)} className="bg-gray-700 hover:bg-blue-600 p-4 rounded">Y+</button>
                            <div></div>
                            <button onClick={() => sendJog('X', -10)} className="bg-gray-700 hover:bg-blue-600 p-4 rounded">X-</button>
                            <div className="flex items-center justify-center text-gray-500">HOME</div>
                            <button onClick={() => sendJog('X', 10)} className="bg-gray-700 hover:bg-blue-600 p-4 rounded">X+</button>
                            <div></div>
                            <button onClick={() => sendJog('Y', -10)} className="bg-gray-700 hover:bg-blue-600 p-4 rounded">Y-</button>
                            <div></div>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs text-gray-400">Jog Speed: {jogSpeed}</label>
                            <input
                                type="range" min="100" max="2000" step="100"
                                value={jogSpeed}
                                onChange={(e) => setJogSpeed(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded border border-gray-700 flex-1 flex flex-col">
                        <h2 className="text-gray-400 mb-2 font-bold text-xs uppercase">System Log</h2>
                        <div className="flex-1 bg-black p-2 font-mono text-xs text-green-500 overflow-y-auto h-32">
                            {logs.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
