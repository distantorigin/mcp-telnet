import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get the version
const packagePath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version || '1.0.0';

console.log(`Updating version to ${version}`);

// Find the version.js file in the build directory
const versionFilePath = path.resolve(__dirname, '../dist/utils/version.js');

if (fs.existsSync(versionFilePath)) {
  // Read the file
  let content = fs.readFileSync(versionFilePath, 'utf8');
  
  // Replace the placeholder with the actual version
  content = content.replace(/'__VERSION__'/, `'${version}'`);
  
  // Write the updated file
  fs.writeFileSync(versionFilePath, content, 'utf8');
  
  console.log('Version updated successfully');
} else {
  console.error('Version file not found:', versionFilePath);
  process.exit(1);
}
