/** Salinan mock dalam TS agar bisa dipakai tanpa import JSON (Expo Go + Jest aman). */
import type { ServerTemplateJson } from './dto';

export const MOCK_SERVER_TEMPLATES: ServerTemplateJson[] = [
  {
    id: 1,
    name: 'Remi Santai',
    description: 'Template sesi santai 4 pemain, cocok untuk mabar keluarga.',
    image: '',
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-10',
  },
  {
    id: 2,
    name: 'Remi Serius',
    description: 'Template sesi 6 pemain dengan target skor 500.',
    image: '',
    status: 'active',
    created_at: '2024-02-01',
    updated_at: '2024-02-05',
  },
  {
    id: 3,
    name: 'Turnamen Mingguan',
    description: 'Template turnamen multi-ronde untuk komunitas.',
    image: '',
    status: 'active',
    created_at: '2024-03-01',
    updated_at: '2024-03-02',
  },
  {
    id: 4,
    name: 'Arsip 2023 (Nonaktif)',
    description: 'Template lama yang sudah tidak dipakai.',
    image: '',
    status: 'inactive',
    created_at: '2023-01-01',
    updated_at: '2023-06-01',
  },
];
