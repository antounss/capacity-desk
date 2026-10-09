// Runs the Android Gradle wrapper with the given tasks, on Windows, macOS or Linux.
//   node scripts/gradle.mjs bundleRelease

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(wrapper, process.argv.slice(2), { cwd: androidDir, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
