/**
 * Task 01 — Data Modeling / DTO (Week 4).
 *
 * Pola dari PPT (slide "DATA MODELING / DTO"):
 *   SERVER DATA (lengkap, snake_case) → DTO (field terpilih) → APPLICATION DATA → UI.
 *
 * Analogi PPT: resource `Program` { id, name, description, image, status, created_at, updated_at }
 * Adaptasi PentungScore: resource `SessionTemplate` dengan bentuk yang sama, dipakai sebagai
 * template sesi remi dari server. Player & GameSession inti tetap offline-first (SQLite).
 *
 * Contoh JSON server (response.json):
 * {
 *   "id": 1,
 *   "name": "Remi Santai",
 *   "description": "Template sesi santai 4 pemain.",
 *   "image": "",
 *   "status": "active",
 *   "created_at": "2024-01-01",
 *   "updated_at": "2024-01-10"
 * }
 */

/** Status template yang dikenal aplikasi. */
export type TemplateStatus = 'active' | 'inactive';

/** Bentuk mentah satu item dari API (snake_case, ada field ekstra). */
export interface ServerTemplateJson {
  id: number;
  name: string;
  description: string;
  image: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

/** Data model aplikasi: hanya field yang dibutuhkan UI (camelCase). */
export interface SessionTemplate {
  id: number;
  title: string;
  description: string;
  image: string;
  status: TemplateStatus;
}

function normalizeStatus(value: unknown): TemplateStatus | null {
  return value === 'active' || value === 'inactive' ? value : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

/**
 * Mapping satu item server → data model aplikasi.
 * - `name` → `title` (seperti contoh PPT `item.name` → `title`)
 * - `created_at` / `updated_at` sengaja dibuang (tidak dibutuhkan UI)
 * - Kembalikan `null` bila item tidak valid agar bisa difilter.
 */
export function mapServerTemplateToTemplate(
  item: ServerTemplateJson,
): SessionTemplate | null {
  if (typeof item !== 'object' || item === null) return null;
  if (typeof item.id !== 'number' || !Number.isFinite(item.id)) return null;
  const title = toNonEmptyString(item.name);
  const status = normalizeStatus(item.status);
  if (!title || !status) return null;
  return {
    id: item.id,
    title,
    description: typeof item.description === 'string' ? item.description : '',
    image: typeof item.image === 'string' ? item.image : '',
    status,
  };
}

/** Mapping array response API → array data model (item invalid dibuang). */
export function mapServerTemplateList(data: unknown): SessionTemplate[] {
  if (!Array.isArray(data)) return [];
  const out: SessionTemplate[] = [];
  for (const item of data) {
    const mapped = mapServerTemplateToTemplate(item as ServerTemplateJson);
    if (mapped) out.push(mapped);
  }
  return out;
}
