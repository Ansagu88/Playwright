import fs from 'fs';
import path from 'path';

/**
 * Devuelve la ruta absoluta a un archivo aleatorio dentro de `tests/fixtures/files`.
 * Lanza error si no hay archivos.
 */
export function getRandomFixtureFilePath(): string {
    // Asumimos que este archivo queda en tests/config, por eso subimos un nivel
    const filesDir = path.resolve(__dirname, '..', 'fixtures', 'files');

    if (!fs.existsSync(filesDir)) {
        throw new Error(`El directorio de fixtures no existe: ${filesDir}`);
    }

    const entries = fs.readdirSync(filesDir).filter(f => {
        const full = path.join(filesDir, f);
        return fs.statSync(full).isFile();
    });

    if (entries.length === 0) {
        throw new Error(`No hay archivos en ${filesDir}`);
    }

    const random = entries[Math.floor(Math.random() * entries.length)];
    return path.join(filesDir, random);
}

/**
 * Devuelve sólo el nombre de archivo (útil para asserts o logs).
 */
export function getRandomFixtureFileName(): string {
    return getRandomFixtureFilePath().split(/[\\/]/).pop() || '';
}
