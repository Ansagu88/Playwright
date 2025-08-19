import { faker } from "@faker-js/faker"
// Mock generator for a request used in tests
// Fields:
// - unidad: one of three options
// - area: selected from a list
// - sociedad: selected from a list
// - tipoServicios: selected from a list
// - descripcion: string that includes a test counter
// - fecha: future date (ISO string)
// - attachments: array of relative file paths inside tests/fixtures/files

export type RequestMock = {
  unidad: string;
  area: string;
  sociedad: string;
  tipoServicios: string;
  descripcion: string;
  fecha: string; // ISO date
};

const UNIDAD_OPTIONS = [
  'Andaychagua',
  'Chungar',
  'Lima',
];

const AREA_OPTIONS = [
  'Geologia',
  'Planta',
  'TICA',
];

const SOCIEDAD_OPTIONS = [
  'Cerro de Pasco',
  'Chungar',
  'Volcan',
];

const TIPO_SERVICIOS_OPTIONS = [
  'Con destaque - Con trabajos en interior mina',
  'Con destaque - Con trabajos solo en superficie',
  'Sin destaque - Gabinete',
];



/**
 * Returns an ISO date string `daysAhead` days in the future (no time part).
 */
function futureDateISO(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // keep only date part (yyyy-mm-dd)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create a deterministic but unique-ish counter when none provided.
 */
function defaultCounter(): number {
  // Use epoch seconds modulo a large number so tests show different values each run
  return Math.floor(Date.now() / 1000) % 1000000;
}

/**
 * Generate a request mock object.
 * @param opts optional overrides
 */
export function createRequestMock(opts?: Partial<RequestMock> & { counter?: number }): RequestMock {
  const counter = opts?.counter ?? defaultCounter();

  const unidad = opts?.unidad ?? UNIDAD_OPTIONS[counter % UNIDAD_OPTIONS.length];
  const area = opts?.area ?? AREA_OPTIONS[(counter + 1) % AREA_OPTIONS.length];
  const sociedad = opts?.sociedad ?? SOCIEDAD_OPTIONS[(counter + 2) % SOCIEDAD_OPTIONS.length];
  const tipoServicios = opts?.tipoServicios ?? TIPO_SERVICIOS_OPTIONS[(counter + 3) % TIPO_SERVICIOS_OPTIONS.length];

  const descripcion = opts?.descripcion ?? `${faker.lorem.sentence()} - Test automático - contador #${counter}`;

  const fecha = opts?.fecha ?? futureDateISO(7 + (counter % 10)); // between 7 and 16 days ahead



  return {
    unidad,
    area,
    sociedad,
    tipoServicios,
    descripcion,
    fecha,
  };
}

// Export a ready-to-use mock instance
export const requestMock = createRequestMock();

export default requestMock;
