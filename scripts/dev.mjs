import { spawn } from 'node:child_process';
import { join } from 'node:path';

const binary = (name) => join('node_modules', '.bin', name);

const processes = [spawn(binary('tsx'), ['watch', 'src/main.ts'], { stdio: 'inherit' }), spawn(binary('vite'), [], { stdio: 'inherit' })];

const stopAll = (signal) => {
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
};

for (const child of processes) {
  child.on('exit', (code) => {
    stopAll('SIGTERM');
    process.exitCode = code ?? 0;
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stopAll(signal));
}
