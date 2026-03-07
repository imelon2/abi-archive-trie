import * as path from 'path';

const archivePath = path.join(__dirname, `../archive`);
export const functionPath = path.join(archivePath, 'function');
export const errorPath = path.join(archivePath, 'error');
export const eventPath = path.join(archivePath, 'event');

export const solFile = '+([a-zA-Z0-9_-]).sol';
export const abiFile = '+([a-zA-Z0-9_]).json';
export const ignore = ['**/*.t.sol/**', '**/*.s.sol/**', '**/build-info/**'];
