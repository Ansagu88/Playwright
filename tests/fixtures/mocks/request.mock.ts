export type RequestMock = {
  unidad: string;
  area: string;
  sociedad: string;
  tipoServicios: string;
  descripcion: string;
  fecha: string; // ISO date yyyy-mm-dd
};

/**
 * Returns an ISO date string `daysAhead` days in the future (no time part).
 */
function futureDateISO(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Simplified deterministic mock generator. Returns a fixed set of values
 * that match the fields on the modal UI. This removes randomness so we can
 * test selection strategies one by one.
 */
export function createRequestMock(opts?: Partial<RequestMock>): RequestMock {
  return {
    unidad: opts?.unidad ?? 'Lima',
    area: opts?.area ?? 'Planta',
    sociedad: opts?.sociedad ?? 'Volcan',
    tipoServicios: opts?.tipoServicios ?? 'Sin destaque - Gabinete',
    descripcion: opts?.descripcion ?? 'Descripción de prueba - creación automática',
    fecha: opts?.fecha ?? futureDateISO(7),
  };
}

export const requestMock = createRequestMock();

export default requestMock;
