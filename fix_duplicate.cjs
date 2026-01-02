
const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'pages', 'Converter.jsx');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');

    // We want to remove lines 608 to 660 (1-based index from view_file)
    // Arrays are 0-based. So we remove index 607 to 659.

    console.log("Total lines before:", lines.length);

    // Safety check: print the lines we are about to remove to log
    console.log("Checking start line (607):", lines[607]);
    console.log("Checking end line (659):", lines[659]);

    // Loose check to avoid whitespace issues
    if (lines[607] && lines[607].includes("DIRECT UPLOAD") && lines[659] && lines[659].includes("};")) {
        console.log("Pattern matched. Deleting...");
        lines.splice(607, 660 - 607 + 1);
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log("Successfully removed duplicate lines.");
    } else {
        console.error("Safety check failed. Lines do not match expectation.");
        // Print a window around 608 to see where it shifted
        for (let i = 600; i < 620; i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    }

} catch (err) {
    console.error("Error:", err);
}
