const gcode = `G21
G90
G1 F300 G1 X10 Y0
G1 F300 G1 X10 Y12
G1 F300 G1 X0 Y12
G1 F300 G1 X0 Y0
G1 F300 G1 X2 Y2
G1 F300 G1 X2 Y10
G1 F300 G1 X8 Y10
G1 F300 G1 X8 Y2
G1 F300 G1 X2 Y2
G1 F300 G1 X10 Y12
G1 F300 G1 X10 Y0
G1 F300 G1 X0 Y0
G1 F300 G1 X0 Y12
G1 F300 G1 X0 Y12
G1 F300 G1 X2 Y2
G1 F300 G1 X2 Y10
G1 F300 G1 X8 Y10
G1 F300 G1 X8 Y2
G1 F300 G1 X10 Y10
G1 F300 G1 X10 Y8
G1 F300 G1 X2 Y8
G1 F300 G1 X2 Y6
G`;

const lines = gcode.split('\n');
const newPath = [{ x: 0, y: 0 }];
let dist = 0;
let current = { x: 0, y: 0 };

lines.forEach((line, i) => {
    const l = line.trim().toUpperCase();
    if (l.startsWith('G0') || l.startsWith('G1')) {
        const xMatch = l.match(/X([\d.-]+)/);
        const yMatch = l.match(/Y([\d.-]+)/);

        let next = { ...current };
        if (xMatch && xMatch[1]) next.x = parseFloat(xMatch[1]);
        if (yMatch && yMatch[1]) next.y = parseFloat(yMatch[1]);

        // Calculate distance
        const d = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
        dist += d;

        newPath.push(next);
        current = next;

        console.log(`Line ${i}: ${line.trim()} -> X:${next.x} Y:${next.y} (Dist: ${d})`);
    } else {
        console.log(`Line ${i}: ${line.trim()} -> IGNORED`);
    }
});

console.log(`Total Points: ${newPath.length}`);
console.log(`Total Distance: ${dist}`);
