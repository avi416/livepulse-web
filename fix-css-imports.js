// Fix CSS import paths
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.join(__dirname, 'src', 'styles', 'components');

// Get all CSS files in the components directory
fs.readdir(componentsDir, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    const cssFiles = files.filter(file => file.endsWith('.css'));

    // Process each CSS file
    cssFiles.forEach(file => {
        const filePath = path.join(componentsDir, file);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file ${file}:`, err);
                return;
            }

            // Fix the import paths
            let newData = data
                .replace(/@import '\.\.\/\.\.\/styles\/tokens\.css';/g, "@import '../tokens.css';")
                .replace(/@import '\.\.\/\.\.\/styles\/tiktok\.css';/g, "@import '../tiktok.css';")
                .replace(/@import '\.\/tokens\.css';/g, "@import '../tokens.css';")
                .replace(/@import '\.\/tiktok\.css';/g, "@import '../tiktok.css';");

            // Write the file back
            fs.writeFile(filePath, newData, 'utf8', err => {
                if (err) {
                    console.error(`Error writing file ${file}:`, err);
                    return;
                }
                console.log(`Fixed import paths in ${file}`);
            });
        });
    });
});
