#!/usr/bin/env node

/**
 * Script to clear Vite cache and node_modules/.vite directory
 */
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

function clearViteCache() {
  const viteCacheDir = join(process.cwd(), '.vite');

  if (existsSync(viteCacheDir)) {
    console.log('Clearing Vite cache directory...');
    rmSync(viteCacheDir, { recursive: true, force: true });
    console.log('✓ Vite cache cleared');
  } else {
    console.log('No Vite cache found to clear');
  }
}

// Run the cache clearing
clearViteCache();

console.log('Cache clearing complete. You can now restart your development server.');