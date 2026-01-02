
const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'pages', 'Converter.jsx');

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');

    // We want to remove lines 608 to 660 (1-based index from view_file)
    // Arrays are 0-based. So we remove index 607 to 659.
    // Line 608 in 1-based is index 607.
    // Line 660 in 1-based is index 659.

    // Safety check: print the lines we are about to remove to log
    console.log("Removing lines:");
    console.log(lines[607]); // Should be // DIRECT UPLOAD...
    console.log("...");
    console.log(lines[659]); // Should be };

    if (lines[607].trim().includes("DIRECT UPLOAD") && lines[659].trim() === "};") {
        lines.splice(607, 660 - 607 + 1);
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log("Successfully removed duplicate lines.");
    } else {
        console.error("Safety check failed. Lines do not match expectation.");
        console.log("Line 608:", lines[607]);
        console.log("Line 660:", lines[659]);
    }

} catch (err) {
    console.error("Error:", err);
}
