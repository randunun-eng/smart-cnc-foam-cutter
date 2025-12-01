const gcode = `G21
G90
G0 F300 Z5
G1 X100 Y100 F300
G1 X150 Y100 F300
G1 X150 Y50 F300
G1 X100 Y50 F300
G1 X100 Y100 F300
G1 X50 Y100 F300
G1 X50 Y150 F300
G1 X100 Y150 F300
G1 X100 Y100 F300
G0 F300 Z0
G1 X50 Y50 F300
G1 X50 Y0 F300
G1 X100 Y0 F300
G1 X100 Y50 F300
G1 X50 Y50 F300
G0 F300 Z5
G1 X0 Y0 F300
G1 X0 Y50 F300
G1 X50 Y50 F300
G1 X50 Y100 F300
G1 X0 Y100 F300
G1 X0 Y150 F300
G1 X50 Y150 F300
G1 X50 Y200 F300`;

const lines = gcode.split('\n');
const newPath = [{ x: 0, y: 0 }];
let dist = 0;
let current = { x: 0, y: 0 };

console.log(`Parsing ${lines.length} lines...`);

lines.forEach((line, i) => {
    const l = line.trim().toUpperCase();
    if (l.startsWith('G0') || l.startsWith('G1')) {
        const xMatch = l.match(/X([\d.-]+)/);
        const yMatch = l.match(/Y([\d.-]+)/);

        let next = { ...current };
        let moved = false;

        if (xMatch && xMatch[1]) {
            next.x = parseFloat(xMatch[1]);
            moved = true;
        }
        if (yMatch && yMatch[1]) {
            next.y = parseFloat(yMatch[1]);
            moved = true;
        }

        if (moved) {
            // Calculate distance
            const d = Math.sqrt(Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2));
            dist += d;
            newPath.push(next);
            current = next;
            console.log(`Line ${i}: ${l} -> Move to X${next.x} Y${next.y} (Dist: ${d})`);
        } else {
            console.log(`Line ${i}: ${l} -> No XY movement (Z only?)`);
        }
    } else {
        console.log(`Line ${i}: ${l} -> Ignored`);
    }
});

console.log(`Total Points: ${newPath.length}`);
console.log(`Total Distance: ${dist}`);
