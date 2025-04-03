import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fallback hardcoded version (will be updated by build process)
const FALLBACK_VERSION = '0.2.0';

// This will be replaced during build with actual version
export const PACKAGE_VERSION = '__VERSION__';

/**
 * Get the current package version
 */
export function getPackageVersion(): string {
  // Check if version was replaced during build
  if (PACKAGE_VERSION !== '__VERSION__') {
    return PACKAGE_VERSION;
  }
  
  try {
    // Get the current directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packagePath = path.resolve(__dirname, '../../package.json');
    
    // Read package.json using ES modules
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || FALLBACK_VERSION;
  } catch (error) {
    // Return fallback version if we can't read the package.json
    return FALLBACK_VERSION;
  }
}
