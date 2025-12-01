import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useRef, useState } from 'react';
export default function Visualizer({ gcode, feedRate }) {
    const canvasRef = useRef(null);
    const [progress, setProgress] = useState(100);
    const [path, setPath] = useState([]);
    const [totalDist, setTotalDist] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    // Parse G-code
    useEffect(() => {
        const lines = gcode.split('\n');
        const newPath = [{ x: 0, y: 0 }];
        let dist = 0;
        let current = { x: 0, y: 0 };
        lines.forEach(line => {
            const l = line.trim().toUpperCase();
            if (l.startsWith('G0') || l.startsWith('G1')) {
                const xMatch = l.match(/X([\d.-]+)/);
                const yMatch = l.match(/Y([\d.-]+)/);
                let next = { ...current };
                if (xMatch && xMatch[1])
                    next.x = parseFloat(xMatch[1]);
                if (yMatch && yMatch[1])
                    next.y = parseFloat(yMatch[1]);
                // Calculate distance
                const d = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
                dist += d;
                newPath.push(next);
                current = next;
            }
        });
        setPath(newPath);
        setTotalDist(dist);
        // Auto-play when new G-code is loaded
        if (newPath.length > 1) {
            setProgress(0);
            setIsPlaying(true);
        }
        else {
            setProgress(100);
            setIsPlaying(false);
        }
    }, [gcode]);
    // Animation Loop
    useEffect(() => {
        let animationFrame = 0; // Initialize to 0
        if (isPlaying) {
            const startTime = Date.now();
            const startProgress = progress >= 100 ? 0 : progress;
            const duration = (totalDist / (feedRate / 60)) * 1000; // ms
            const animate = () => {
                const now = Date.now();
                const elapsed = now - startTime;
                const newProgress = Math.min(100, startProgress + (elapsed / duration) * 100);
                setProgress(newProgress);
                if (newProgress < 100) {
                    animationFrame = requestAnimationFrame(animate);
                }
                else {
                    setIsPlaying(false);
                }
            };
            animationFrame = requestAnimationFrame(animate); // Start the animation
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, totalDist, feedRate, progress]); // Added progress to dependencies
    // Render
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (path.length === 0)
            return;
        // Auto-scale
        const padding = 20;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        path.forEach(p => {
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
        });
        // Ensure aspect ratio
        const width = maxX - minX || 100;
        const height = maxY - minY || 100;
        const scaleX = (canvas.width - padding * 2) / width;
        const scaleY = (canvas.height - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = padding - minX * scale + (canvas.width - padding * 2 - width * scale) / 2;
        const offsetY = canvas.height - (padding - minY * scale + (canvas.height - padding * 2 - height * scale) / 2); // Flip Y
        // Draw Grid (Metric)
        const gridSize = 10; // 10mm grid
        // World bounds visible
        const worldMinX = (0 - offsetX) / scale;
        const worldMaxX = (canvas.width - offsetX) / scale;
        const worldMinY = (offsetY - canvas.height) / scale; // Y is flipped
        const worldMaxY = (offsetY) / scale;
        // Draw Vertical (X)
        for (let x = Math.floor(worldMinX / gridSize) * gridSize; x <= worldMaxX; x += gridSize) {
            const sx = x * scale + offsetX;
            ctx.strokeStyle = x === 0 ? '#00ff00' : (x % 100 === 0 ? '#555' : '#333'); // Major lines every 100mm
            ctx.lineWidth = x === 0 ? 1.5 : 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, canvas.height);
            ctx.stroke();
        }
        // Draw Horizontal (Y)
        for (let y = Math.floor(worldMinY / gridSize) * gridSize; y <= worldMaxY; y += gridSize) {
            const sy = canvas.height - (y * scale) - (offsetY - canvas.height);
            ctx.strokeStyle = y === 0 ? '#ff0000' : (y % 100 === 0 ? '#555' : '#333'); // Red for X-axis (Y=0)
            ctx.lineWidth = y === 0 ? 1.5 : 0.5;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(canvas.width, sy);
            ctx.stroke();
        }
        // Draw Path
        ctx.strokeStyle = '#00f3ff'; // Neon Blue
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const totalPoints = path.length;
        const drawUntil = Math.floor((progress / 100) * totalPoints);
        path.forEach((p, i) => {
            const sx = p.x * scale + offsetX;
            const sy = canvas.height - (p.y * scale) - (offsetY - canvas.height); // Correct Y flip
            if (i === 0)
                ctx.moveTo(sx, sy);
            else if (i <= drawUntil)
                ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        // Draw "Wire" Position
        if (path.length > 0 && drawUntil < path.length) {
            const last = path[drawUntil];
            if (last) { // Ensure 'last' is not undefined
                const lx = last.x * scale + offsetX;
                const ly = canvas.height - (last.y * scale) - (offsetY - canvas.height);
                ctx.fillStyle = '#ff5e00'; // Neon Orange
                ctx.shadowColor = '#ff5e00';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(lx, ly, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }, [path, progress]);
    const estimatedSeconds = (totalDist / (feedRate / 60));
    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    return (_jsxs("div", { className: "flex flex-col gap-2 h-full", children: [_jsxs("div", { className: "flex-1 bg-gray-900 rounded border border-gray-700 relative overflow-hidden", children: [_jsx("canvas", { ref: canvasRef, width: 400, height: 300, className: "w-full h-full object-contain" }), _jsxs("div", { className: "absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-gray-400 font-mono", children: ["EST: ", formatTime(estimatedSeconds)] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setIsPlaying(!isPlaying), className: "text-neon-blue hover:text-white transition-colors", children: isPlaying ? '⏸' : '▶' }), _jsx("input", { type: "range", min: "0", max: "100", value: progress, onChange: (e) => {
                            setIsPlaying(false);
                            setProgress(parseFloat(e.target.value));
                        }, className: "flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-blue" }), _jsxs("span", { className: "text-xs text-gray-500 w-8 text-right", children: [Math.round(progress), "%"] })] })] }));
}
//# sourceMappingURL=Visualizer.js.map