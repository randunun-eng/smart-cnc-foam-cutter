import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useRef } from 'react';
import Visualizer from './Visualizer';
// Configuration (Props or Defaults)
const LUCKFOX_BASE_URL = "http://luckfox-ip:5000"; // Replace with actual IP
const WORKER_URL = "/api"; // Relative path for Pages Functions
const MACHINE_ID = "foam-cnc-01";
export default function App() {
    const [gcode, setGcode] = useState("");
    const [status, setStatus] = useState({});
    const [logs, setLogs] = useState([]);
    const [heat, setHeat] = useState(0);
    const [heatEnabled, setHeatEnabled] = useState(false);
    const [jogSpeed, setJogSpeed] = useState(1000);
    const [stepSizeXY, setStepSizeXY] = useState(10);
    const [stepSizeZ, setStepSizeZ] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [customUrl, setCustomUrl] = useState(localStorage.getItem('LUCKFOX_BASE_URL') || "https://foam-cnc.luckfox.com");
    // Override LUCKFOX_BASE_URL if set in localStorage
    const API_URL = customUrl;
    const [prompt, setPrompt] = useState(""); // This state is no longer used in the UI, but kept for now if generateGcode is modified
    const [isOnline, setIsOnline] = useState(false);
    // Auto Mode & PID State
    const [autoMode, setAutoMode] = useState(false);
    const [pidValues, setPidValues] = useState({ p: 1.0, i: 0.1, d: 0.05 });
    const [recommended, setRecommended] = useState({});
    const [viewMode, setViewMode] = useState('visualizer');
    const [isGenerating, setIsGenerating] = useState(false);
    const logsEndRef = useRef(null);
    const log = (msg) => {
        setLogs(prev => {
            const newLogs = [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`];
            return newLogs;
        });
    };
    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    // Polling Status (Luckfox)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/status`);
                const data = await res.json();
                setStatus(data);
            }
            catch (e) {
                // Silent fail
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [API_URL]);
    // Polling Watcher (Cloudflare)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${WORKER_URL}/machine_status?machineId=${MACHINE_ID}`);
                const data = await res.json();
                setIsOnline(data.online);
            }
            catch (e) {
                setIsOnline(false);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, []);
    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT')
                return;
            switch (e.key) {
                case 'ArrowUp':
                    sendJog('Y', stepSizeXY);
                    break;
                case 'ArrowDown':
                    sendJog('Y', -stepSizeXY);
                    break;
                case 'ArrowLeft':
                    sendJog('X', -stepSizeXY);
                    break;
                case 'ArrowRight':
                    sendJog('X', stepSizeXY);
                    break;
                case 'PageUp':
                case 'q':
                    sendJog('Z', stepSizeZ);
                    break;
                case 'PageDown':
                case 'e':
                    sendJog('Z', -stepSizeZ);
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [jogSpeed, stepSizeXY, stepSizeZ]);
    const sendJog = async (axis, dist) => {
        try {
            await fetch(`${API_URL}/jog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ axis, distance: dist, feed: jogSpeed })
            });
            log(`Jog ${axis} ${dist}`);
        }
        catch (e) {
            log(`Jog failed: ${e}`);
        }
    };
    const sendDiagonal = async (xDir, yDir) => {
        const xMove = xDir * stepSizeXY;
        const yMove = yDir * stepSizeXY;
        // G91 (Relative) G1 X... Y... F...
        const cmd = `G91 G1 X${xMove} Y${yMove} F${jogSpeed}`;
        try {
            await fetch(`${API_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cmd })
            });
            // Ensure we return to absolute mode if that's the default expectation, 
            // though usually sender handles state. GRBL stays in G91 until G90.
            // Let's send G90 to be safe for subsequent absolute moves.
            await fetch(`${API_URL}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cmd: 'G90' })
            });
            log(`Jog Diagonal X${xMove} Y${yMove}`);
        }
        catch (e) {
            log(`Diagonal Jog failed: ${e}`);
        }
    };
    const handleHeat = async (val) => {
        setHeat(val);
        if (heatEnabled && !autoMode) {
            await fetch(`${API_URL}/heat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duty: val })
            });
        }
    };
    const toggleHeat = async () => {
        const newState = !heatEnabled;
        setHeatEnabled(newState);
        // In Auto Mode, heat is controlled by the job/PID, but manual toggle can still kill it
        await fetch(`${API_URL}/heat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duty: newState ? heat : 0 })
        });
        log(`Heat ${newState ? 'ON' : 'OFF'}`);
    };
    const runJob = async () => {
        const blob = new Blob([gcode], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'editor_job.gcode');
        try {
            const upRes = await fetch(`${API_URL}/gcode/upload`, { method: 'POST', body: formData });
            const upData = await upRes.json();
            const payload = { filename: upData.path };
            if (autoMode) {
                payload.auto_mode = true;
                payload.feed_rate = recommended.feed || jogSpeed;
                payload.heat_duty = recommended.heat || heat;
                payload.pid_values = pidValues;
                log(`Starting AUTO Job: Heat ${payload.heat_duty}%, Feed ${payload.feed_rate}`);
            }
            else {
                log("Starting Manual Job");
            }
            await fetch(`${API_URL}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        catch (e) {
            log(`Start failed: ${e}`);
        }
    };
    // This function is no longer called from the UI, as the AI Slicer section was replaced.
    // Keeping it for reference or if text prompt functionality is re-added.
    const generateGcode = async () => {
        log("Generating G-code...");
        setIsGenerating(true);
        try {
            const res = await fetch(`${WORKER_URL}/slicer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            // Handle JSON response
            if (data.gcode) {
                setGcode(data.gcode);
                setRecommended({
                    heat: data.heat_duty,
                    feed: data.feed_rate,
                    material: data.material
                });
                if (autoMode) {
                    if (data.heat_duty)
                        setHeat(data.heat_duty);
                    if (data.feed_rate)
                        setJogSpeed(data.feed_rate);
                    log(`AI Recommends: Heat ${data.heat_duty}%, Feed ${data.feed_rate}`);
                }
                setViewMode('visualizer');
            }
            else {
                // Fallback for plain text
                const code = typeof data === 'string' ? data : (data.response || JSON.stringify(data));
                setGcode(code);
            }
            log("G-code generated");
        }
        catch (e) {
            log(`Generation failed: ${e}`);
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleFileUpload = async (file) => {
        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
        if (!isImage) {
            // Treat as G-code/Text file - Read locally
            log(`Reading ${file.name}...`);
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result;
                if (content) {
                    setGcode(content);
                    setViewMode('editor'); // Switch to editor to see the code
                    log(`Loaded ${file.name}`);
                }
            };
            reader.onerror = () => log("Failed to read file");
            reader.readAsText(file);
            return;
        }
        // It's an image - Send to AI Slicer
        setIsGenerating(true);
        log(`Uploading Image ${file.name}...`);
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', "Generate G-code for this shape."); // Default prompt context
        try {
            const res = await fetch(`${WORKER_URL}/slicer`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.gcode) {
                setGcode(data.gcode);
                setRecommended({
                    heat: data.heat_duty,
                    feed: data.feed_rate,
                    material: data.material
                });
                if (autoMode) {
                    if (data.heat_duty)
                        setHeat(data.heat_duty);
                    if (data.feed_rate)
                        setJogSpeed(data.feed_rate);
                }
                setViewMode('visualizer');
                log("G-code generated from Image");
            }
            else {
                // Fallback: If AI returned raw text/G-code without JSON structure
                const rawCode = typeof data === 'string' ? data : (data.response || JSON.stringify(data));
                if (rawCode && rawCode.length > 10) {
                    setGcode(rawCode);
                    setViewMode('editor');
                    log("Received raw response from AI");
                }
                else {
                    log("Failed to generate G-code");
                }
            }
        }
        catch (e) {
            log(`Upload failed: ${e}`);
        }
        finally {
            setIsGenerating(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-900 text-gray-100 font-sans p-4 selection:bg-blue-500 selection:text-white", children: [_jsxs("header", { className: "flex justify-between items-center mb-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700 backdrop-blur-sm shadow-lg", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${isOnline ? 'bg-neon-green shadow-[0_0_10px_#0f0]' : 'bg-red-500 animate-pulse'}` }), _jsxs("h1", { className: "text-2xl font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 uppercase", children: ["Smart Foam CNC ", _jsx("span", { className: "text-xs align-top opacity-50", children: "v2.0" })] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => setShowSettings(!showSettings), className: "text-gray-400 hover:text-white", children: "\u2699\uFE0F" }), _jsxs("div", { className: "flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-gray-700", children: [_jsx("span", { className: "text-xs font-bold text-gray-400", children: "MODE" }), _jsx("button", { onClick: () => setAutoMode(!autoMode), className: `text-xs font-bold px-2 py-0.5 rounded transition-colors ${autoMode ? 'bg-purple-600 text-white shadow-[0_0_10px_#9333ea]' : 'bg-gray-700 text-gray-500'}`, children: autoMode ? 'AUTO (AI)' : 'MANUAL' })] })] })] }), showSettings && (_jsx("div", { className: "fixed inset-0 bg-black/80 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-gray-800 p-6 rounded border border-gray-700 w-96", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Connection Settings" }), _jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "BACKEND URL" }), _jsx("input", { type: "text", value: customUrl, onChange: (e) => setCustomUrl(e.target.value), className: "w-full bg-black border border-gray-600 p-2 rounded mb-4 text-sm" }), _jsx("label", { className: "block text-xs text-gray-400 mb-1", children: "SERIAL PORT" }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx("select", { id: "port-select", className: "flex-1 bg-black border border-gray-600 p-2 rounded text-sm", children: _jsx("option", { value: "", children: "Auto-Detect" }) }), _jsx("button", { onClick: async () => {
                                        try {
                                            const res = await fetch(`${API_URL}/ports`);
                                            const data = await res.json();
                                            const select = document.getElementById('port-select');
                                            select.innerHTML = '<option value="">Auto-Detect</option>';
                                            data.ports.forEach((p) => {
                                                const opt = document.createElement('option');
                                                opt.value = p;
                                                opt.text = p;
                                                select.appendChild(opt);
                                            });
                                            log("Ports refreshed");
                                        }
                                        catch (e) {
                                            log("Failed to fetch ports");
                                        }
                                    }, className: "bg-gray-700 hover:bg-gray-600 px-3 rounded", children: "\u21BB" })] }), _jsx("button", { onClick: async () => {
                                const select = document.getElementById('port-select');
                                const port = select.value;
                                if (port) {
                                    try {
                                        await fetch(`${API_URL}/connect`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ port })
                                        });
                                        log(`Connecting to ${port}...`);
                                    }
                                    catch (e) {
                                        log("Connection failed");
                                    }
                                }
                            }, className: "w-full bg-green-700 hover:bg-green-600 py-2 rounded font-bold text-sm mb-4", children: "CONNECT TO PORT" }), _jsxs("div", { className: "flex justify-end gap-2 border-t border-gray-700 pt-4", children: [_jsx("button", { onClick: () => setShowSettings(false), className: "px-4 py-2 bg-gray-700 rounded hover:bg-gray-600", children: "Cancel" }), _jsx("button", { onClick: () => {
                                        localStorage.setItem('LUCKFOX_BASE_URL', customUrl);
                                        window.location.reload();
                                    }, className: "px-4 py-2 bg-blue-600 rounded hover:bg-blue-500", children: "Save URL & Reload" })] })] }) })), _jsxs("div", { className: "grid grid-cols-12 gap-4 flex-1", children: [_jsxs("div", { className: "col-span-4 flex flex-col gap-4", children: [_jsxs("div", { className: "relative bg-black rounded border border-gray-700 aspect-video flex items-center justify-center overflow-hidden shadow-lg shadow-blue-900/20", children: [_jsx("img", { src: `${API_URL}/video_feed`, alt: "Live Feed", className: "w-full h-full object-cover" }), _jsxs("div", { className: "absolute top-2 left-2 flex items-center gap-2 bg-black/50 px-2 py-1 rounded", children: [_jsx("div", { className: "w-3 h-3 bg-red-600 rounded-full animate-pulse" }), _jsx("span", { className: "text-xs text-red-500 font-bold tracking-widest", children: "REC" })] }), _jsxs("div", { className: "absolute bottom-2 right-2 text-neon-orange font-bold text-xl drop-shadow-md", children: [status.heat_duty || 0, "% HEAT"] })] }), _jsxs("div", { className: "bg-gray-800/50 p-2 rounded border border-gray-700 backdrop-blur-sm h-64", children: [_jsx("h2", { className: "text-blue-400 mb-1 font-bold text-xs uppercase tracking-wider", children: "Simulation" }), _jsx(Visualizer, { gcode: gcode, feedRate: autoMode && recommended.feed ? recommended.feed : jogSpeed })] }), _jsxs("div", { className: "bg-gray-800/50 p-4 rounded border border-gray-700 backdrop-blur-sm", children: [_jsx("h2", { className: "text-neon-orange mb-2 font-bold text-sm uppercase tracking-wider", children: "Wire Heat Control" }), _jsxs("div", { className: "flex items-center gap-4 mb-4", children: [_jsx("input", { type: "range", min: "0", max: "100", value: heat, onChange: (e) => handleHeat(parseInt(e.target.value)), className: "flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500", disabled: autoMode }), _jsxs("span", { className: "w-12 text-right font-bold text-orange-400", children: [heat, "%"] })] }), _jsx("button", { onClick: toggleHeat, className: `w-full py-3 rounded font-bold transition-all duration-200 ${heatEnabled ? 'bg-orange-600 hover:bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.5)]' : 'bg-gray-700 hover:bg-gray-600'}`, children: heatEnabled ? 'DISABLE HEAT' : 'ENABLE HEAT' }), autoMode && (_jsxs("div", { className: "mt-4 pt-4 border-t border-gray-700", children: [_jsx("h3", { className: "text-xs font-bold text-gray-400 mb-2", children: "PID CONFIGURATION" }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-gray-500", children: "P" }), _jsx("input", { type: "number", step: "0.1", value: pidValues.p, onChange: e => setPidValues({ ...pidValues, p: parseFloat(e.target.value) }), className: "w-full bg-gray-900 border border-gray-700 rounded px-1 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-gray-500", children: "I" }), _jsx("input", { type: "number", step: "0.01", value: pidValues.i, onChange: e => setPidValues({ ...pidValues, i: parseFloat(e.target.value) }), className: "w-full bg-gray-900 border border-gray-700 rounded px-1 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-gray-500", children: "D" }), _jsx("input", { type: "number", step: "0.01", value: pidValues.d, onChange: e => setPidValues({ ...pidValues, d: parseFloat(e.target.value) }), className: "w-full bg-gray-900 border border-gray-700 rounded px-1 text-sm" })] })] })] }))] })] }), _jsxs("div", { className: "col-span-5 flex flex-col gap-4", children: [_jsxs("div", { className: "bg-gray-800/50 p-4 rounded border border-gray-700 flex-1 flex flex-col backdrop-blur-sm", children: [_jsxs("div", { className: "flex justify-between mb-2 items-center", children: [_jsx("h2", { className: "text-blue-400 font-bold text-sm uppercase tracking-wider", children: "G-Code Editor" }), _jsxs("span", { className: "text-xs text-gray-500 font-mono", children: ["L:", status.current_line || 0, "/", status.total_lines || 0] })] }), _jsx("textarea", { value: gcode, onChange: (e) => setGcode(e.target.value), className: "flex-1 bg-gray-900/80 text-green-400 p-3 font-mono text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none rounded", placeholder: "; G-code ready..." }), _jsxs("div", { className: "grid grid-cols-4 gap-2 mt-3", children: [_jsxs("label", { className: "flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded cursor-pointer font-bold text-sm transition-colors", children: [_jsx("span", { className: "mr-2", children: "\uD83D\uDCC2" }), " UPLOAD", _jsx("input", { type: "file", onChange: (e) => {
                                                            const files = e.target.files;
                                                            if (files && files.length > 0) {
                                                                handleFileUpload(files[0]);
                                                            }
                                                        }, className: "hidden", accept: ".gcode,.nc,.txt,image/*" })] }), _jsx("button", { onClick: () => runJob(), className: "bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]", children: "START JOB" }), _jsx("button", { onClick: () => fetch(`${API_URL}/pause`, { method: 'POST' }), className: "bg-yellow-600 hover:bg-yellow-500 rounded font-bold text-sm", children: "PAUSE" }), _jsx("button", { onClick: () => fetch(`${API_URL}/stop`, { method: 'POST' }), className: "bg-red-600 hover:bg-red-500 rounded font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]", children: "STOP" })] }), _jsx("button", { onClick: async () => {
                                            await fetch(`${API_URL}/stop`, { method: 'POST' });
                                            await fetch(`${API_URL}/heat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duty: 0 }) });
                                            setHeatEnabled(false);
                                        }, className: "w-full mt-2 bg-red-700 hover:bg-red-600 py-4 rounded font-black text-xl tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse border-2 border-red-500", children: "EMERGENCY STOP" })] }), _jsxs("div", { className: "bg-gray-800/50 p-4 rounded border border-gray-700 backdrop-blur-sm", children: [_jsx("h2", { className: "text-purple-400 mb-2 font-bold text-sm uppercase tracking-wider", children: "AI Slicer (Image to Cut)" }), _jsxs("div", { className: "border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer relative", children: [_jsx("input", { type: "file", onChange: (e) => {
                                                    const files = e.target.files;
                                                    if (files && files.length > 0) {
                                                        handleFileUpload(files[0]);
                                                    }
                                                }, className: "absolute inset-0 opacity-0 cursor-pointer", accept: "image/*" }), _jsx("div", { className: "text-4xl mb-2", children: "\uD83D\uDDBC\uFE0F" }), _jsx("p", { className: "text-sm text-gray-400", children: "Drag & Drop Image or Click to Upload" }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "AI will analyze shape and generate G-code" })] }), recommended.material && (_jsxs("div", { className: "mt-2 text-xs text-gray-400 bg-black/30 p-2 rounded", children: [_jsx("span", { className: "text-purple-400 font-bold", children: "AI SUGGESTION:" }), " ", recommended.material, " | Feed: ", recommended.feed, " | Heat: ", recommended.heat, "%"] }))] })] }), _jsxs("div", { className: "col-span-3 flex flex-col gap-4", children: [_jsxs("div", { className: "bg-gray-800/50 p-4 rounded border border-gray-700 backdrop-blur-sm", children: [_jsx("h2", { className: "text-blue-400 mb-2 font-bold text-center text-sm uppercase tracking-wider", children: "Digital Read Out" }), _jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsxs("div", { className: "bg-black/50 rounded p-2 border border-gray-700 flex-1 flex justify-between items-center", children: [_jsx("div", { className: "text-xs text-gray-500 font-bold", children: "X" }), _jsx("div", { className: "text-neon-blue font-mono text-xl font-bold", children: status.mpos?.x || "0.000" })] }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: 'G10 P0 L20 X0' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-2 rounded text-xs font-bold w-16", children: "Zero X" })] }), _jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsxs("div", { className: "bg-black/50 rounded p-2 border border-gray-700 flex-1 flex justify-between items-center", children: [_jsx("div", { className: "text-xs text-gray-500 font-bold", children: "Y" }), _jsx("div", { className: "text-neon-blue font-mono text-xl font-bold", children: status.mpos?.y || "0.000" })] }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: 'G10 P0 L20 Y0' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-2 rounded text-xs font-bold w-16", children: "Zero Y" })] }), _jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsxs("div", { className: "bg-black/50 rounded p-2 border border-gray-700 flex-1 flex justify-between items-center", children: [_jsx("div", { className: "text-xs text-gray-500 font-bold", children: "Z" }), _jsx("div", { className: "text-neon-blue font-mono text-xl font-bold", children: status.mpos?.z || "0.000" })] }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: 'G10 P0 L20 Z0' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-2 rounded text-xs font-bold w-16", children: "Zero Z" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-4", children: [_jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: 'G10 P0 L20 X0 Y0 Z0' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold", children: "ZERO ALL" }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: '$H' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold", children: "HOME" }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: 'G28' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold", children: "GOTO ZERO" }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: '$X' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs font-bold", children: "UNLOCK" }), _jsx("button", { onClick: () => fetch(`${API_URL}/command`, { method: 'POST', body: JSON.stringify({ cmd: '\x18' }), headers: { 'Content-Type': 'application/json' } }), className: "bg-red-900/50 hover:bg-red-800 text-red-400 border border-red-800 px-2 py-1 rounded text-xs font-bold col-span-2", children: "SOFT RESET" })] }), _jsx("h2", { className: "text-blue-400 mb-4 font-bold text-center text-sm uppercase tracking-wider border-t border-gray-700 pt-4", children: "Manual Jog" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-gray-500 block mb-1", children: "STEP XY (mm)" }), _jsx("div", { className: "flex gap-1", children: [1, 10, 100].map(step => (_jsx("button", { onClick: () => setStepSizeXY(step), className: `flex-1 py-1 rounded text-[10px] font-bold ${stepSizeXY === step ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`, children: step }, step))) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] text-gray-500 block mb-1", children: "STEP Z (mm)" }), _jsx("div", { className: "flex gap-1", children: [0.1, 1, 10].map(step => (_jsx("button", { onClick: () => setStepSizeZ(step), className: `flex-1 py-1 rounded text-[10px] font-bold ${stepSizeZ === step ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`, children: step }, step))) })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-2 mb-4", children: [_jsx("button", { onClick: () => sendDiagonal(-1, 1), className: "bg-gray-800 hover:bg-blue-900 border border-gray-700 rounded text-xs text-gray-500", children: "\u2196" }), _jsx("button", { onClick: () => sendJog('Y', stepSizeXY), className: "bg-gray-700 hover:bg-blue-600 p-4 rounded transition-colors", children: "\u2191" }), _jsx("button", { onClick: () => sendDiagonal(1, 1), className: "bg-gray-800 hover:bg-blue-900 border border-gray-700 rounded text-xs text-gray-500", children: "\u2197" }), _jsx("button", { onClick: () => sendJog('X', -stepSizeXY), className: "bg-gray-700 hover:bg-blue-600 p-4 rounded transition-colors", children: "\u2190" }), _jsxs("div", { className: "flex flex-col items-center justify-center gap-1", children: [_jsx("button", { onClick: () => sendJog('Z', stepSizeZ), className: "bg-gray-700 hover:bg-blue-600 w-full h-6 rounded text-[10px]", children: "Z+" }), _jsx("button", { onClick: () => sendJog('Z', -stepSizeZ), className: "bg-gray-700 hover:bg-blue-600 w-full h-6 rounded text-[10px]", children: "Z-" })] }), _jsx("button", { onClick: () => sendJog('X', stepSizeXY), className: "bg-gray-700 hover:bg-blue-600 p-4 rounded transition-colors", children: "\u2192" }), _jsx("button", { onClick: () => sendDiagonal(-1, -1), className: "bg-gray-800 hover:bg-blue-900 border border-gray-700 rounded text-xs text-gray-500", children: "\u2199" }), _jsx("button", { onClick: () => sendJog('Y', -stepSizeXY), className: "bg-gray-700 hover:bg-blue-600 p-4 rounded transition-colors", children: "\u2193" }), _jsx("button", { onClick: () => sendDiagonal(1, -1), className: "bg-gray-800 hover:bg-blue-900 border border-gray-700 rounded text-xs text-gray-500", children: "\u2198" })] }), _jsxs("div", { className: "mb-2", children: [_jsxs("label", { className: "text-xs text-gray-400 flex justify-between mb-1", children: [_jsx("span", { children: "FEED RATE" }), _jsxs("span", { children: [jogSpeed, " mm/min"] })] }), _jsx("input", { type: "range", min: "100", max: "2000", step: "100", value: jogSpeed, onChange: (e) => setJogSpeed(parseInt(e.target.value)), className: "w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" })] })] }), _jsxs("div", { className: "bg-gray-800/50 p-4 rounded border border-gray-700 flex-1 flex flex-col backdrop-blur-sm", children: [_jsx("h2", { className: "text-gray-400 mb-2 font-bold text-xs uppercase tracking-wider", children: "Console" }), _jsxs("div", { className: "flex-1 bg-black p-2 font-mono text-xs text-green-500 overflow-y-auto h-32 rounded border border-gray-800 shadow-inner", children: [logs.map((l, i) => _jsx("div", { className: "border-b border-gray-900/50 pb-0.5 mb-0.5", children: l }, i)), _jsx("div", { ref: logsEndRef })] })] })] })] })] }));
}
//# sourceMappingURL=App.js.map