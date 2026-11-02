/*
================================================================================
ADMIN DASHBOARD + LOG AKTIVITAS + EDIT / HAPUS PENDAFTAR
Catatan: Seluruh fungsi dan trigger database resmi dikelola melalui file migrasi:
  supabase/migrations/20261020000000_runtime_security_functions.sql
================================================================================

Yang berubah di panel admin
  - Tab baru "Log Aktivitas" (siapa mengubah / menghapus / mengekspor apa, kapan).
  - Tombol Edit (ikon pensil) untuk mengubah data pendaftar.
  - Hapus pendaftar kini memakai dialog konfirmasi (ketik HAPUS) dan memanggil
    deleteStudent dengan format yang benar ({ user_id, nik }).
  - Berkas dibuka lewat signed URL (bucket dokumen-ppdb bersifat privat).

-- BAGIAN 0: PERBAIKAN TRIGGER PROTEKSI (PENTING) ------------------------------
-- Trigger lama memakai current_user. Di dalam fungsi SECURITY DEFINER nilainya
-- selalu pemilik fungsi (postgres), sehingga pengecekan selalu lolos dan siswa
-- tetap bisa mengubah status / kolom terproteksi lewat API. Diganti session_user
-- dan auth.role().

CREATE OR REPLACE FUNCTION public.protect_students_update()
RETURNS TRIGGER AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.nik IS DISTINCT FROM OLD.nik THEN
    RAISE EXCEPTION 'Akses ditolak: NIK pendaftar tidak dapat diubah.';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Akses ditolak: user_id tidak dapat dipindahtangankan.';
  END IF;
  IF NEW.nomor_pendaftaran IS DISTINCT FROM OLD.nomor_pendaftaran THEN
    RAISE EXCEPTION 'Akses ditolak: Nomor pendaftaran tidak dapat diubah.';
  END IF;
  IF NEW.catatan_admin IS DISTINCT FROM OLD.catatan_admin THEN
    RAISE EXCEPTION 'Akses ditolak: Catatan admin hanya dapat diubah oleh administrator.';
  END IF;
  IF NEW.status_pendaftaran IS DISTINCT FROM OLD.status_pendaftaran THEN
    IF NOT (OLD.status_pendaftaran IN ('Belum Lengkap', 'Berkas Fisik')
            AND NEW.status_pendaftaran = 'Menunggu Verifikasi') THEN
      RAISE EXCEPTION 'Akses ditolak: Siswa hanya dapat mengubah status menjadi Menunggu Verifikasi saat melengkapi berkas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_profiles_update()
RETURNS TRIGGER AS $$
BEGIN
  IF session_user IN ('postgres', 'supabase_admin')
     OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah hak akses role.';
  END IF;
  IF NEW.nik IS DISTINCT FROM OLD.nik THEN
    RAISE EXCEPTION 'Akses ditolak: NIK profil tidak dapat diubah.';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Akses ditolak: ID profil tidak dapat diubah.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- BAGIAN 1: TABEL LOG AKTIVITAS ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  actor_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name        text NOT NULL DEFAULT 'Sistem',
  action            text NOT NULL,
  target_student_id uuid,
  target_nik        text,
  target_nama       text,
  target_nomor      text,
  detail            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created_at
  ON public.activity_logs (action, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_select_admin ON public.activity_logs;
CREATE POLICY activity_logs_select_admin ON public.activity_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS activity_logs_insert_admin ON public.activity_logs;
CREATE POLICY activity_logs_insert_admin ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND actor_id = (SELECT auth.uid()));

-- Log bersifat append-only: tidak ada policy UPDATE / DELETE untuk siapa pun.
REVOKE ALL ON public.activity_logs FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.activity_logs FROM authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;

-- Aktor dan waktu dikunci di server agar tidak bisa dipalsukan dari browser.
CREATE OR REPLACE FUNCTION public.activity_logs_set_actor()
RETURNS TRIGGER AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
    NEW.actor_id   := v_uid;
    NEW.actor_name := COALESCE(NULLIF(v_name, ''), 'Administrator');
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_activity_logs_set_actor ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_set_actor
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.activity_logs_set_actor();

-- BAGIAN 2: LOG OTOMATIS EDIT / UBAH STATUS OLEH ADMIN -------------------------
-- Dicatat di database sehingga tetap tercatat walau perubahan dibuat lewat
-- cara lain (bukan hanya lewat tombol di panel ini).

CREATE OR REPLACE FUNCTION public.jsonb_changes(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k   text;
  sk  text;
  o   jsonb;
  n   jsonb;
  res jsonb := '{}'::jsonb;
BEGIN
  FOR k IN SELECT jsonb_object_keys(new_row) LOOP
    IF k = 'updated_at' THEN CONTINUE; END IF;
    o := old_row -> k;
    n := new_row -> k;
    IF o IS NOT DISTINCT FROM n THEN CONTINUE; END IF;

    IF jsonb_typeof(o) = 'object' AND jsonb_typeof(n) = 'object' THEN
      FOR sk IN SELECT jsonb_object_keys(o || n) LOOP
        IF (o -> sk) IS DISTINCT FROM (n -> sk) THEN
          res := res || jsonb_build_object(
            k || '.' || sk,
            jsonb_build_object('dari', o -> sk, 'ke', n -> sk)
          );
        END IF;
      END LOOP;
    ELSE
      res := res || jsonb_build_object(
        k, jsonb_build_object('dari', o, 'ke', n)
      );
    END IF;
  END LOOP;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_student_admin_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_changes := public.jsonb_changes(to_jsonb(OLD), to_jsonb(NEW));
  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_logs
    (actor_id, action, target_student_id, target_nik, target_nama, target_nomor, detail)
  VALUES (
    auth.uid(),
    CASE WHEN v_changes ? 'status_pendaftaran' THEN 'UBAH_STATUS' ELSE 'EDIT_DATA' END,
    NEW.id, NEW.nik, NEW.nama_lengkap, NEW.nomor_pendaftaran,
    jsonb_build_object('perubahan', v_changes)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_student_admin_changes ON public.students;
CREATE TRIGGER trg_log_student_admin_changes
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_admin_changes();

-- SELESAI. Hapus pendaftar dan ekspor data dicatat oleh panel ini (client),
-- karena penghapusan berjalan lewat endpoint server (service role).
-- ================================================================================
*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Save,
  LogOut,
  Pencil,
  KeyRound,
  History,
  RefreshCw,
  ChevronDown,
  Users,
  Clock,
  CheckCircle2,
  GraduationCap,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Student, User, StatusPendaftaran, JurusanType, BerkasItem } from '../types/database';
import { motion, useReducedMotion } from 'motion/react';
import { useHistorySync } from './ui/navigation';
import { Hero, Stagger, StatCard, StatusTile, PanelTitle, SegTabs, CountUp, ViewTransition, LOGO_URL, itemVariants } from './ui/kit';
import { dbService } from '../services/supabase';
const AdminResetPasswordModal = React.lazy(() =>
  import('./AdminResetPasswordModal').then((m) => ({ default: m.AdminResetPasswordModal }))
);

// ============================================================================
// KONSTANTA & TIPE
// ============================================================================

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onNavigateHome: () => void;
}

type LogAction =
  | 'UBAH_STATUS'
  | 'EDIT_DATA'
  | 'HAPUS_PENDAFTAR'
  | 'EKSPOR_DATA'
  | 'RESET_PASSWORD'
  | 'RESET_PASSWORD_GAGAL';

interface ActivityLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_student_id: string | null;
  target_nik: string | null;
  target_nama: string | null;
  target_nomor: string | null;
  detail: Record<string, any> | null;
}

interface LogTarget {
  id?: string;
  nik?: string;
  nama?: string;
  nomor?: string;
}

type FieldType = 'text' | 'number' | 'date' | 'select';

interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  maxLength?: number;
}

interface EditForm {
  nama_lengkap: string;
  jurusan_pilihan: JurusanType;
  no_wa: string;
  status_pendaftaran: StatusPendaftaran;
  catatan_admin: string;
  data_diri: Record<string, string>;
  data_alamat: Record<string, string>;
  data_orang_tua: Record<string, string>;
}

const ALL_STATUS: StatusPendaftaran[] = [
  'Belum Lengkap',
  'Berkas Fisik',
  'Menunggu Verifikasi',
  'Terverifikasi',
  'Diterima',
  'Cadangan',
];

const JURUSAN_OPTIONS: { value: JurusanType; label: string }[] = [
  { value: 'TO', label: 'Teknik Otomotif (TO)' },
  { value: 'TJKT', label: 'TJKT' },
  { value: 'AKL', label: 'AKL' },
];

const DIRI_FIELDS: FieldDef[] = [
  { key: 'nisn', label: 'NISN', maxLength: 20 },
  { key: 'no_kk', label: 'No. Kartu Keluarga', maxLength: 20 },
  { key: 'tempat_lahir', label: 'Tempat lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal lahir', type: 'date' },
  { key: 'jenis_kelamin', label: 'Jenis kelamin', type: 'select', options: ['Laki-laki', 'Perempuan'] },
  { key: 'agama', label: 'Agama', type: 'select', options: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'] },
  { key: 'asal_sekolah', label: 'Asal sekolah (SMP/MTs)' },
  { key: 'anak_ke', label: 'Anak ke', type: 'number' },
  { key: 'jumlah_saudara', label: 'Jumlah saudara', type: 'number' },
  { key: 'tinggi_badan', label: 'Tinggi badan (cm)', type: 'number' },
  { key: 'berat_badan', label: 'Berat badan (kg)', type: 'number' },
  { key: 'ukuran_baju', label: 'Ukuran baju', type: 'select', options: ['S', 'M', 'L', 'XL', 'XXL'] },
  { key: 'kode_referal', label: 'Kode referal' },
];

const ALAMAT_FIELDS: FieldDef[] = [
  { key: 'dukuh', label: 'Dukuh / Jalan' },
  { key: 'rt', label: 'RT', maxLength: 5 },
  { key: 'rw', label: 'RW', maxLength: 5 },
  { key: 'desa', label: 'Desa / Kelurahan' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'kabupaten', label: 'Kabupaten / Kota' },
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kode_pos', label: 'Kode pos', maxLength: 10 },
  { key: 'tinggal_bersama', label: 'Tinggal bersama' },
  { key: 'transportasi', label: 'Transportasi ke sekolah' },
];

const ORTU_FIELDS: FieldDef[] = [
  { key: 'nama_ayah', label: 'Nama ayah' },
  { key: 'nik_ayah', label: 'NIK ayah', maxLength: 16 },
  { key: 'tanggal_lahir_ayah', label: 'Tanggal lahir ayah', type: 'date' },
  { key: 'pendidikan_ayah', label: 'Pendidikan ayah' },
  { key: 'pekerjaan_ayah', label: 'Pekerjaan ayah' },
  { key: 'no_hp_ayah', label: 'No. HP ayah', maxLength: 20 },
  { key: 'nama_ibu', label: 'Nama ibu' },
  { key: 'nik_ibu', label: 'NIK ibu', maxLength: 16 },
  { key: 'tanggal_lahir_ibu', label: 'Tanggal lahir ibu', type: 'date' },
  { key: 'pendidikan_ibu', label: 'Pendidikan ibu' },
  { key: 'pekerjaan_ibu', label: 'Pekerjaan ibu' },
  { key: 'no_hp_ibu', label: 'No. HP ibu', maxLength: 20 },
  { key: 'nama_wali', label: 'Nama wali' },
  { key: 'pekerjaan_wali', label: 'Pekerjaan wali' },
  { key: 'no_hp_wali', label: 'No. HP wali', maxLength: 20 },
];

const SECTION_META: Record<string, { title: string; defs: FieldDef[] }> = {
  data_diri: { title: 'Data diri', defs: DIRI_FIELDS },
  data_alamat: { title: 'Alamat', defs: ALAMAT_FIELDS },
  data_orang_tua: { title: 'Orang tua / wali', defs: ORTU_FIELDS },
};

const TOP_LABELS: Record<string, string> = {
  nama_lengkap: 'Nama lengkap',
  jurusan_pilihan: 'Jurusan',
  no_wa: 'No. WhatsApp',
  status_pendaftaran: 'Status pendaftaran',
  catatan_admin: 'Catatan admin',
  data_berkas: 'Berkas',
  nik: 'NIK',
  nomor_pendaftaran: 'Nomor pendaftaran',
};

const ACTION_META: Record<string, { label: string; badge: string }> = {
  UBAH_STATUS: { label: 'Ubah status', badge: 'bg-purple-100 text-purple-800' },
  EDIT_DATA: { label: 'Edit data', badge: 'bg-blue-100 text-blue-800' },
  HAPUS_PENDAFTAR: { label: 'Hapus pendaftar', badge: 'bg-rose-100 text-rose-800' },
  EKSPOR_DATA: { label: 'Ekspor data', badge: 'bg-amber-100 text-amber-800' },
  RESET_PASSWORD: { label: 'Reset password', badge: 'bg-slate-200 text-slate-700' },
  RESET_PASSWORD_GAGAL: { label: 'Reset password gagal', badge: 'bg-red-100 text-red-800' },
};

const LOG_PAGE_SIZE = 30;

const INPUT_CLASS =
  'w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

// ============================================================================
// HELPER
// ============================================================================

const formatWib = (iso: string): string => {
  try {
    return (
      new Date(iso).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    );
  } catch {
    return iso;
  }
};

const displayValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '(kosong)';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
};

const fieldLabel = (key: string): string => {
  if (TOP_LABELS[key]) return TOP_LABELS[key];
  const [section, sub] = key.split('.');
  const meta = SECTION_META[section];
  if (meta && sub) {
    const def = meta.defs.find((d) => d.key === sub);
    return `${meta.title}: ${def?.label ?? sub.replace(/_/g, ' ')}`;
  }
  return key.replace(/[._]/g, ' ');
};

const stable = (v: any): any => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((o: Record<string, any>, k) => {
        o[k] = stable(v[k]);
        return o;
      }, {});
  }
  return v;
};

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(stable(a ?? {})) === JSON.stringify(stable(b ?? {}));

const toStringMap = (obj: Record<string, any> | undefined, defs: FieldDef[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = obj?.[d.key];
    out[d.key] = v === undefined || v === null ? '' : String(v);
  }
  return out;
};

// Menimpa hanya field yang berubah; field lain (mis. foto_profil_url) tetap utuh.
const buildSection = (
  base: Record<string, any> | undefined,
  defs: FieldDef[],
  values: Record<string, string>
): Record<string, any> => {
  const out: Record<string, any> = { ...(base || {}) };
  for (const d of defs) {
    const raw = (values[d.key] ?? '').trim();
    if (String(out[d.key] ?? '') === raw) continue;
    if (raw === '') delete out[d.key];
    else out[d.key] = d.type === 'number' ? Number(raw) : raw;
  }
  return out;
};

// Simpan nomor dalam format lokal (08xxx) agar tautan WhatsApp di tabel tetap benar.
const normalizeWa = (raw: string): string => {
  const s = raw.replace(/[\s-]/g, '');
  if (s.startsWith('+62')) return '0' + s.slice(3);
  if (s.startsWith('62')) return '0' + s.slice(2);
  return s;
};

const validateEdit = (f: EditForm): string | null => {
  const nama = f.nama_lengkap.trim();
  if (!nama) return 'Nama lengkap wajib diisi.';
  if (nama.length > 100) return 'Nama lengkap maksimal 100 karakter.';
  if (!/^\+?\d{9,15}$/.test(f.no_wa.replace(/[\s-]/g, ''))) {
    return 'No. WhatsApp harus berupa angka 9 sampai 15 digit.';
  }
  const sections: [FieldDef[], Record<string, string>][] = [
    [DIRI_FIELDS, f.data_diri],
    [ALAMAT_FIELDS, f.data_alamat],
    [ORTU_FIELDS, f.data_orang_tua],
  ];
  for (const [defs, values] of sections) {
    for (const d of defs) {
      const raw = (values[d.key] ?? '').trim();
      if (d.type === 'number' && raw !== '') {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return `${d.label} harus berupa angka yang valid.`;
      }
    }
  }
  return null;
};

const isMissingTable = (err: { code?: string; message?: string }): boolean =>
  err.code === '42P01' ||
  err.code === 'PGRST205' ||
  (/activity_logs/.test(err.message || '') && /(does not exist|schema cache)/i.test(err.message || ''));

const summarizeLog = (log: ActivityLog): string => {
  const d = log.detail || {};
  switch (log.action) {
    case 'UBAH_STATUS': {
      const st = d.perubahan?.status_pendaftaran;
      return st ? `${displayValue(st.dari)} \u2192 ${displayValue(st.ke)}` : 'Status diperbarui';
    }
    case 'EDIT_DATA': {
      const keys = Object.keys(d.perubahan || {});
      if (keys.length === 0) return 'Data diperbarui';
      const names = keys.slice(0, 3).map((k) => fieldLabel(k).replace(/^[^:]+: /, ''));
      return `${keys.length} kolom: ${names.join(', ')}${keys.length > 3 ? ', ...' : ''}`;
    }
    case 'HAPUS_PENDAFTAR':
      return 'Pendaftar, akun login, dan berkas dihapus permanen';
    case 'EKSPOR_DATA':
      return `${d.format || 'Data'} \u00b7 ${d.jumlah_baris ?? '?'} baris`;
    case 'RESET_PASSWORD':
      return d.sesi_dicabut === false
        ? 'Password sementara diterbitkan (sesi lama belum dicabut)'
        : 'Password sementara diterbitkan, sesi lama dicabut';
    case 'RESET_PASSWORD_GAGAL':
      return 'Verifikasi pemohon tidak cocok';
    default:
      return '-';
  }
};

// ============================================================================
// KOMPONEN KECIL
// ============================================================================

const FieldInput: React.FC<{
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
}> = ({ def, value, onChange }) => {
  const options = def.options || [];
  const selectOptions = value && !options.includes(value) ? [...options, value] : options;
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-600 mb-1">{def.label}</span>
      {def.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
          <option value="">-</option>
          {selectOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
          min={def.type === 'number' ? 0 : undefined}
          maxLength={def.type === 'number' || def.type === 'date' ? undefined : def.maxLength ?? 150}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
        />
      )}
    </label>
  );
};

const BerkasRow: React.FC<{
  label: string;
  item?: BerkasItem;
  onOpen: (item?: BerkasItem) => void;
}> = ({ label, item, onOpen }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-slate-500 shrink-0">{label}:</span>
    <span className="font-medium text-slate-800 text-right truncate">
      {item && item.path ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="text-blue-600 hover:text-blue-800 underline font-semibold inline-flex items-center gap-1 justify-end cursor-pointer"
          title="Klik untuk membuka berkas"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="truncate max-w-[200px]">{item.nama_file}</span>
        </button>
      ) : (
        item?.nama_file || <span className="text-slate-400 italic">Belum upload</span>
      )}
    </span>
  </div>
);

// ============================================================================
// PANEL LOG AKTIVITAS
// ============================================================================

const LogPanel: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(
    async (offset: number, replace: boolean) => {
      const client = dbService.getClient();
      if (!client) {
        setError('Koneksi Supabase belum tersedia.');
        return;
      }
      const myRequest = ++requestId.current;
      setLoading(true);
      setError(null);

      let query = client
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + LOG_PAGE_SIZE - 1);

      if (actionFilter !== 'ALL') query = query.eq('action', actionFilter);

      const term = debouncedSearch.replace(/[,()%*\\"]/g, ' ').trim();
      if (term) {
        query = query.or(
          `target_nama.ilike.%${term}%,target_nik.ilike.%${term}%,actor_name.ilike.%${term}%`
        );
      }

      const { data, error: err } = await query;
      if (myRequest !== requestId.current) return; // hasil lama, abaikan
      setLoading(false);

      if (err) {
        if (isMissingTable(err)) setSetupNeeded(true);
        else setError(err.message || 'Gagal memuat log aktivitas.');
        return;
      }

      setSetupNeeded(false);
      const rows = (data || []) as ActivityLog[];
      setLogs((prev) => (replace ? rows : [...prev, ...rows]));
      setHasMore(rows.length === LOG_PAGE_SIZE);
    },
    [actionFilter, debouncedSearch]
  );

  useEffect(() => {
    fetchLogs(0, true);
  }, [fetchLogs, refreshKey]);

  const renderDetail = (log: ActivityLog) => {
    const d = log.detail || {};
    const changes: Record<string, { dari: unknown; ke: unknown }> | undefined = d.perubahan;

    if (changes && Object.keys(changes).length > 0) {
      return (
        <ul className="space-y-1.5">
          {Object.entries(changes).map(([key, val]) => (
            <li key={key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-semibold text-slate-700 min-w-[160px]">{fieldLabel(key)}</span>
              <span className="text-rose-600 line-through break-all">{displayValue(val?.dari)}</span>
              <span className="text-slate-400">{'\u2192'}</span>
              <span className="text-emerald-700 font-semibold break-all">{displayValue(val?.ke)}</span>
            </li>
          ))}
        </ul>
      );
    }

    const entries = Object.entries(d);
    if (entries.length === 0) return <span className="text-slate-400 italic">Tidak ada rincian.</span>;
    return (
      <ul className="space-y-1">
        {entries.map(([key, val]) => (
          <li key={key} className="flex flex-wrap gap-x-2">
            <span className="font-semibold text-slate-700 min-w-[160px]">{key.replace(/_/g, ' ')}</span>
            <span className="text-slate-600 break-all">{displayValue(val)}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-5">
      {setupNeeded && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-1">
            <p className="font-bold">Tabel log aktivitas belum dibuat.</p>
            <p>
              Jalankan SQL yang ada di bagian paling atas berkas <span className="font-mono">AdminDashboard.tsx</span>{' '}
              pada Supabase SQL Editor, lalu klik Muat ulang.
            </p>
          </div>
        </div>
      )}

      <div className="ui-panel ui-form p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pendaftar, NIK, atau admin..."
            className="w-full pl-11 pr-4"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Aktivitas:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 font-semibold text-slate-700"
            >
              <option value="ALL">Semua aktivitas</option>
              {(Object.keys(ACTION_META) as LogAction[]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_META[a].label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchLogs(0, true)}
            disabled={loading}
            className="h-11 px-5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat ulang</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-3xl flex items-start gap-2.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="ui-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-indigo-50/70 text-indigo-900/70 font-semibold text-xs">
              <tr>
                <th className="px-4 py-3.5 whitespace-nowrap">Waktu</th>
                <th className="px-4 py-3.5">Admin</th>
                <th className="px-4 py-3.5">Aktivitas</th>
                <th className="px-4 py-3.5">Pendaftar</th>
                <th className="px-4 py-3.5">Ringkasan</th>
                <th className="px-4 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {setupNeeded ? 'Menunggu tabel log dibuat.' : 'Belum ada aktivitas yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const meta = ACTION_META[log.action] || {
                    label: log.action,
                    badge: 'bg-slate-200 text-slate-700',
                  };
                  const open = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(open ? null : log.id)}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 tabular-nums">
                          {formatWib(log.created_at)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">{log.actor_name}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {log.target_nama ? (
                            <div>
                              <div className="font-bold text-slate-900">{log.target_nama}</div>
                              <div className="font-mono text-[10px] text-slate-500">
                                {log.target_nomor || '-'} {'\u2022'} {log.target_nik || '-'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{summarizeLog(log)}</td>
                        <td className="px-4 py-3.5 text-slate-400">
                          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={6} className="px-4 py-4">
                            {renderDetail(log)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>{logs.length} aktivitas ditampilkan</span>
          {hasMore && (
            <button
              type="button"
              onClick={() => fetchLogs(logs.length, false)}
              disabled={loading}
              className="h-10 px-4 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 rounded-full text-sm font-semibold text-indigo-700 transition-all active:scale-95"
            >
              Muat lebih banyak
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// KOMPONEN UTAMA
// ============================================================================

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigateHome,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const PAGE_SIZE = 25;
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, to: 0, tjkt: 0, akl: 0, lolos: 0 });
  const loadReqId = useRef(0);
  const lastAutoRefresh = useRef(0);
  const debouncedRef = useRef('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'pendaftar' | 'log'>('pendaftar');
  // Geser/tombol kembali: tab aktif tersimpan di riwayat browser
  useHistorySync('ad', activeTab, (v: 'pendaftar' | 'log') => setActiveTab(v));
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  // Detail / verifikasi
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalStatus, setModalStatus] = useState<StatusPendaftaran>('Berkas Fisik');
  const [adminNotes, setAdminNotes] = useState('');

  // Edit
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Hapus
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password
  const [resetTarget, setResetTarget] = useState<Student | null>(null);

  // Toast
  const [notification, setNotification] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setNotification({ msg, kind });
    toastTimer.current = window.setTimeout(() => setNotification(null), kind === 'error' ? 5000 : 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const loadStats = async () => {
    try {
      setStats(await dbService.getStudentStats());
    } catch (err: any) {
      console.error('Error loading stats:', err);
    }
  };

  const loadStudents = async () => {
    const reqId = ++loadReqId.current;
    setIsLoadingList(true);
    try {
      const res = await dbService.getStudentsPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        jurusan: filterJurusan,
        status: filterStatus,
      });
      if (reqId !== loadReqId.current) return; // abaikan respons usang
      setStudents(res.students);
      setTotalCount(res.totalCount);
      const maxPage = Math.max(1, Math.ceil(res.totalCount / PAGE_SIZE));
      if (page > maxPage) setPage(maxPage);
    } catch (err: any) {
      if (reqId !== loadReqId.current) return;
      console.error('Error loading students:', err);
      showToast(err.message || 'Gagal memuat data pendaftar dari server', 'error');
    } finally {
      if (reqId === loadReqId.current) setIsLoadingList(false);
    }
  };

  const refreshAll = () => {
    lastAutoRefresh.current = Date.now();
    void loadStudents();
    void loadStats();
  };

  // Debounce pencarian (hemat query) dan kembali ke halaman 1
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchQuery.trim();
      if (next !== debouncedRef.current) {
        debouncedRef.current = next;
        setPage(1);
        setDebouncedSearch(next);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Muat halaman saat halaman / filter berubah
  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, filterJurusan, filterStatus]);

  // Statistik: sekali saat dibuka, lalu saat tab kembali aktif (maks. 1x / 60 detik).
  // Tidak memakai realtime agar tidak mengunduh ulang data setiap ada siswa menyimpan.
  useEffect(() => {
    void loadStats();
    lastAutoRefresh.current = Date.now();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAutoRefresh.current > 60_000) {
        refreshAll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape menutup dialog paling atas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (resetTarget) return; // dialog reset menutup dirinya sendiri
      if (deleteTarget) {
        if (!isDeleting) setDeleteTarget(null);
      } else if (editStudent) {
        if (!isSaving) closeEdit();
      } else if (selectedStudent) {
        setSelectedStudent(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTarget, deleteTarget, editStudent, selectedStudent, isDeleting, isSaving]);

  // --------------------------------------------------------------------------
  // Pencatatan log (hapus & ekspor dicatat dari sini; edit/status oleh trigger DB)
  // --------------------------------------------------------------------------
  const writeLog = async (
    action: LogAction,
    target: LogTarget | null,
    detail: Record<string, any>
  ): Promise<boolean> => {
    const client = dbService.getClient();
    if (!client) return false;
    const { error } = await client.from('activity_logs').insert({
      actor_id: currentUser.id,
      actor_name: currentUser.full_name || 'Administrator',
      action,
      target_student_id: target?.id ?? null,
      target_nik: target?.nik ?? null,
      target_nama: target?.nama ?? null,
      target_nomor: target?.nomor ?? null,
      detail,
    });
    if (error) {
      console.warn('[Log Aktivitas] Gagal menyimpan log:', error.message);
      return false;
    }
    setLogRefreshKey((k) => k + 1);
    return true;
  };

  // --------------------------------------------------------------------------
  // Filter tabel
  // --------------------------------------------------------------------------
  // Data sudah difilter & dipaginasi di server (lihat loadStudents)
  const filteredStudents = students;

  // --------------------------------------------------------------------------
  // Detail & status
  // --------------------------------------------------------------------------
  const handleOpenDetail = (std: Student) => {
    setSelectedStudent(std);
    setModalStatus(std.status_pendaftaran);
    setAdminNotes(std.catatan_admin || '');
  };

  const handleUpdateStatus = async () => {
    if (!selectedStudent) return;
    try {
      const updated = await dbService.updateStudentStatus(selectedStudent.nik, modalStatus, adminNotes);
      setSelectedStudent(updated);
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      void loadStats();
      setLogRefreshKey((k) => k + 1);
      showToast(`Status pendaftaran ${updated.nama_lengkap} berhasil diperbarui menjadi ${modalStatus}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  const openBerkas = async (item?: BerkasItem) => {
    if (!selectedStudent) {
      showToast('Pendaftar belum dipilih.', 'error');
      return;
    }
    const rawPath = item?.path;
    if (!rawPath || typeof rawPath !== 'string') {
      showToast('Path berkas tidak ditemukan atau belum diunggah.', 'error');
      return;
    }

    // Hanya terima path berawalan {user_id}/ untuk mencegah open redirect & phishing
    const expectedPrefix = `${selectedStudent.user_id}/`;
    if (!rawPath.startsWith(expectedPrefix)) {
      showToast('Akses ditolak: Berkas bukan milik pendaftar ini atau format path tidak aman.', 'error');
      return;
    }

    // Jendela dibuka sinkron (saat klik) agar tidak diblokir pop-up blocker.
    const win = window.open('about:blank', '_blank');
    if (!win) {
      showToast('Pop-up diblokir browser. Izinkan pop-up untuk membuka berkas.', 'error');
      return;
    }
    try {
      const signedUrl = await dbService.getSignedFileUrl(rawPath, 300, selectedStudent.user_id);
      win.opener = null;
      win.location.href = signedUrl;
    } catch (err: any) {
      win.close();
      showToast(err.message || 'Gagal membuka berkas.', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // Edit
  // --------------------------------------------------------------------------
  const openEdit = (std: Student) => {
    setEditStudent(std);
    setEditError(null);
    setEditForm({
      nama_lengkap: std.nama_lengkap || '',
      jurusan_pilihan: std.jurusan_pilihan,
      no_wa: std.no_wa || '',
      status_pendaftaran: std.status_pendaftaran,
      catatan_admin: std.catatan_admin || '',
      data_diri: toStringMap(std.data_diri as Record<string, any>, DIRI_FIELDS),
      data_alamat: toStringMap(std.data_alamat as Record<string, any>, ALAMAT_FIELDS),
      data_orang_tua: toStringMap(std.data_orang_tua as Record<string, any>, ORTU_FIELDS),
    });
  };

  function closeEdit() {
    setEditStudent(null);
    setEditForm(null);
    setEditError(null);
  }

  const setTopField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setEditForm((f) => (f ? { ...f, [key]: value } : f));

  const setSectionField = (
    section: 'data_diri' | 'data_alamat' | 'data_orang_tua',
    key: string,
    value: string
  ) => setEditForm((f) => (f ? { ...f, [section]: { ...f[section], [key]: value } } : f));

  const handleSaveEdit = async () => {
    if (!editStudent || !editForm) return;

    const validationError = validateEdit(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    const client = dbService.getClient();
    if (!client) {
      setEditError('Koneksi Supabase belum tersedia.');
      return;
    }

    const nama = editForm.nama_lengkap.trim();
    const wa = normalizeWa(editForm.no_wa);
    const catatan = editForm.catatan_admin.trim();

    const payload: Record<string, any> = {};
    if (nama !== editStudent.nama_lengkap) payload.nama_lengkap = nama;
    if (editForm.jurusan_pilihan !== editStudent.jurusan_pilihan) payload.jurusan_pilihan = editForm.jurusan_pilihan;
    if (wa !== editStudent.no_wa) payload.no_wa = wa;
    if (editForm.status_pendaftaran !== editStudent.status_pendaftaran) {
      payload.status_pendaftaran = editForm.status_pendaftaran;
    }
    if (catatan !== (editStudent.catatan_admin || '')) payload.catatan_admin = catatan === '' ? null : catatan;

    const diri = buildSection(editStudent.data_diri as Record<string, any>, DIRI_FIELDS, editForm.data_diri);
    if (nama !== editStudent.nama_lengkap) diri.nama_lengkap = nama; // jaga sinkron dengan kolom utama
    if (wa !== editStudent.no_wa) diri.no_hp = wa;
    if (!sameJson(diri, editStudent.data_diri)) payload.data_diri = diri;

    const alamat = buildSection(editStudent.data_alamat as Record<string, any>, ALAMAT_FIELDS, editForm.data_alamat);
    if (!sameJson(alamat, editStudent.data_alamat)) payload.data_alamat = alamat;

    const ortu = buildSection(editStudent.data_orang_tua as Record<string, any>, ORTU_FIELDS, editForm.data_orang_tua);
    if (!sameJson(ortu, editStudent.data_orang_tua)) payload.data_orang_tua = ortu;

    if (Object.keys(payload).length === 0) {
      setEditError('Tidak ada perubahan untuk disimpan.');
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      let query = client.from('students').update(payload).eq('id', editStudent.id);
      // Kunci optimistis: tolak simpan jika data berubah sejak dibuka (mis. siswa sedang mengedit).
      if (editStudent.updated_at) query = query.eq('updated_at', editStudent.updated_at);
      const { data, error } = await query.select().maybeSingle();

      if (error) {
        if (error.code === '42501') {
          setEditError('Akses ditolak: akun ini tidak memiliki izin mengubah data pendaftar.');
        } else {
          setEditError(`Gagal menyimpan perubahan: ${error.message}`);
        }
        return;
      }
      if (!data) {
        setEditError(
          'Perubahan tidak tersimpan: data sudah diubah pihak lain sejak dibuka, atau akses ditolak. Tutup dialog, muat ulang, lalu coba lagi.'
        );
        loadStudents();
        return;
      }

      const updated = data as Student;
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      void loadStats();
      if (selectedStudent?.id === updated.id) {
        setSelectedStudent(updated);
        setModalStatus(updated.status_pendaftaran);
        setAdminNotes(updated.catatan_admin || '');
      }

      // Nama di profil dipakai untuk tampilan akun; sinkronkan (best effort).
      if (payload.nama_lengkap) {
        const { error: profErr } = await client
          .from('profiles')
          .update({ full_name: nama })
          .eq('id', updated.user_id);
        if (profErr) console.warn('[Edit] Gagal sinkron nama ke profil:', profErr.message);
      }

      setLogRefreshKey((k) => k + 1);
      closeEdit();
      showToast(`Data pendaftar ${updated.nama_lengkap} berhasil diperbarui.`);
    } catch (err: any) {
      setEditError(err?.message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Hapus
  // --------------------------------------------------------------------------
  const openDelete = (std: Student) => {
    setDeleteTarget(std);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText.trim() !== 'HAPUS') return;
    const target = deleteTarget;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await dbService.deleteStudent({ user_id: target.user_id, nik: target.nik });

      const berkasCount = Object.values(target.data_berkas || {}).filter(Boolean).length;
      const logged = await writeLog(
        'HAPUS_PENDAFTAR',
        { id: target.id, nik: target.nik, nama: target.nama_lengkap, nomor: target.nomor_pendaftaran },
        {
          jurusan: target.jurusan_pilihan,
          status_terakhir: target.status_pendaftaran,
          jumlah_berkas: berkasCount,
        }
      );

      setStudents((prev) => prev.filter((s) => s.id !== target.id));
      void loadStats();
      void loadStudents();
      if (selectedStudent?.id === target.id) setSelectedStudent(null);
      if (editStudent?.id === target.id) closeEdit();
      setDeleteTarget(null);
      showToast(
        logged
          ? `Data pendaftar ${target.nama_lengkap} berhasil dihapus.`
          : `Data ${target.nama_lengkap} terhapus, tetapi log aktivitas gagal disimpan.`,
        logged ? 'ok' : 'error'
      );
    } catch (err: any) {
      setDeleteError(err?.message || 'Gagal menghapus data pendaftar.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Ekspor
  // --------------------------------------------------------------------------
  const exportFilterInfo = () => ({
    jurusan: filterJurusan,
    status: filterStatus,
    cari: searchQuery.trim() || null,
  });

  const fetchExportRows = async (): Promise<Student[] | null> => {
    try {
      showToast('Menyiapkan data ekspor...');
      return await dbService.getStudentsForExport({
        search: searchQuery.trim(),
        jurusan: filterJurusan,
        status: filterStatus,
      });
    } catch (err: any) {
      showToast(err.message || 'Gagal menyiapkan data ekspor.', 'error');
      return null;
    }
  };

  const handleExportCSV = async () => {
    const exportRows = await fetchExportRows();
    if (!exportRows) return;
    const headers = [
      'No Pendaftaran',
      'NIK',
      'Nama Lengkap',
      'Jurusan',
      'No WA',
      'Asal Sekolah',
      'Status Pendaftaran',
      'Tanggal Daftar',
      'Ukuran Baju',
      'Dukuh / Alamat',
      'Kecamatan',
      'Nama Ayah',
      'Nama Ibu',
    ];

    const escapeCsvCell = (val: any): string => {
      let str = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headerRow = headers.map((h) => escapeCsvCell(h)).join(',');

    const rows = exportRows.map((s) =>
      [
        escapeCsvCell(s.nomor_pendaftaran),
        escapeCsvCell(s.nik),
        escapeCsvCell(s.nama_lengkap),
        escapeCsvCell(s.jurusan_pilihan),
        escapeCsvCell(s.no_wa),
        escapeCsvCell(s.data_diri?.asal_sekolah || '-'),
        escapeCsvCell(s.status_pendaftaran),
        escapeCsvCell(s.tanggal_daftar),
        escapeCsvCell(s.data_diri?.ukuran_baju || '-'),
        escapeCsvCell(s.data_alamat?.dukuh || '-'),
        escapeCsvCell(s.data_alamat?.kecamatan || '-'),
        escapeCsvCell(s.data_orang_tua?.nama_ayah || '-'),
        escapeCsvCell(s.data_orang_tua?.nama_ibu || '-'),
      ].join(',')
    );

    // BOM UTF-8 agar Excel membaca karakter dengan benar
    const bom = '\uFEFF';
    const csvContent = bom + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DATA_PPDB_SMK_MUHIBA_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    void writeLog('EKSPOR_DATA', null, {
      format: 'CSV',
      jumlah_baris: exportRows.length,
      filter: exportFilterInfo(),
    });
  };

  const handleExportJSON = async () => {
    const exportRows = await fetchExportRows();
    if (!exportRows) return;
    const jsonContent =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportRows, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `DATA_PPDB_SMK_MUHIBA_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Berhasil mengunduh ${exportRows.length} data pendaftar dalam format JSON.`);

    void writeLog('EKSPOR_DATA', null, {
      format: 'JSON',
      jumlah_baris: exportRows.length,
      filter: exportFilterInfo(),
    });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  const waHref = (std: Student) =>
    `https://wa.me/62${(std.no_wa || '').replace(/^0/, '')}?text=${encodeURIComponent(
      `Assalamu'alaikum Warahmatullahi Wabarakatuh. Yth. Saudara/i ${std.nama_lengkap} (No. Pendaftaran: ${std.nomor_pendaftaran}), kami dari Panitia PPDB SMK Muhammadiyah Bawang ingin mengonfirmasikan status pendaftaran Anda (${std.status_pendaftaran}). Terima kasih.`
    )}`;

  const jurusanBadge = (j: string) =>
    j === 'TO' ? 'bg-amber-100 text-amber-800' : j === 'TJKT' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';

  const statusBadge = (st: string) =>
    st === 'Diterima'
      ? 'bg-emerald-100 text-emerald-800'
      : st === 'Terverifikasi'
      ? 'bg-blue-100 text-blue-800'
      : st === 'Menunggu Verifikasi'
      ? 'bg-purple-100 text-purple-800'
      : st === 'Cadangan'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-200 text-slate-700';

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="ui-scope ui-page flex flex-col">
      {/* Toast */}
      {notification && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-[80] flex w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_24px_40px_-16px_rgba(15,23,42,.6)] animate-in fade-in slide-in-from-top-4 duration-200 ${
            notification.kind === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {notification.kind === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <Check className="h-5 w-5 shrink-0 rounded-full bg-emerald-700 p-0.5" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Admin */}
      <header className="ui-header">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={LOGO_URL} alt="Logo SMK Muhammadiyah Bawang" className="h-10 w-10 shrink-0 object-contain drop-shadow-md" referrerPolicy="no-referrer" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">SPMB Muhiba</p>
              <p className="hidden truncate text-xs text-indigo-100 sm:block">SMK Muhammadiyah Bawang</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="ui-hbtn"
              title="Buka Halaman Utama PPDB"
              aria-label="Lihat Tampilan Web"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden md:inline">Lihat Tampilan Web</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-semibold">Admin PPDB</p>
                <p className="text-[0.65rem] font-medium tracking-wider text-indigo-100">ADMINISTRATOR</p>
              </div>
              <span className="ui-avatar" aria-hidden>A</span>
            </div>

            <span className="hidden h-7 w-px bg-white/25 sm:block" aria-hidden />

            <button type="button" onClick={onLogout} className="ui-hbtn !px-0 w-10" title="Keluar dari Panel Admin" aria-label="Logout">
              <LogOut className="h-[1.1rem] w-[1.1rem]" />
            </button>
          </div>
        </div>
      </header>

      {/* Viewport Admin */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 sm:px-6 sm:py-8">
        <SegTabs
          id="admin"
          ariaLabel="Menu panel admin"
          active={activeTab}
          onChange={(k) => setActiveTab(k as 'pendaftar' | 'log')}
          items={[
            { key: 'pendaftar', label: 'Data Pendaftar', icon: Users },
            { key: 'log', label: 'Log Aktivitas', icon: History },
          ]}
        />

        <ViewTransition viewKey={activeTab} className="space-y-5">
          {activeTab === 'log' && <LogPanel refreshKey={logRefreshKey} />}

          {activeTab === 'pendaftar' && (
            <>
              {/* HERO */}
              <Hero
                chip="Panel Kontrol SPMB"
                title="Dashboard Operasional SPMB"
                subtitle="SMK Muhammadiyah Bawang • Rekapitulasi Data & Verifikasi Real-Time"
                actions={
                  <>
                    <motion.button
                      type="button"
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                      onClick={handleExportCSV}
                      className="ui-cta ui-shine"
                      title="Unduh data pendaftar format CSV"
                    >
                      <Download className="h-5 w-5 text-indigo-600" />
                      <span>Download Rekap CSV</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                      onClick={handleExportJSON}
                      className="ui-cta ui-cta--ghost"
                      title="Unduh berkas cadangan format JSON"
                    >
                      <Download className="h-5 w-5" />
                      <span>Backup JSON</span>
                    </motion.button>
                  </>
                }
              />

              {/* KARTU STATISTIK */}
              <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard
                  tone="blue"
                  index={0}
                  label="Total Pendaftar"
                  icon={Users}
                  value={<CountUp value={stats.total} />}
                  unit="siswa"
                  caption="Terdaftar di sistem"
                />
                <StatCard
                  tone="amber"
                  index={1}
                  label="Menunggu Verifikasi"
                  icon={Clock}
                  value={<CountUp value={Math.max(0, stats.total - stats.lolos)} />}
                  unit="perlu dicek"
                  action={{
                    label: 'Periksa berkas',
                    onClick: () => {
                      setFilterStatus('Menunggu Verifikasi');
                      setPage(1);
                    },
                  }}
                />
                <StatCard
                  tone="green"
                  index={2}
                  label="Diterima / Lolos"
                  icon={CheckCircle2}
                  value={<CountUp value={stats.lolos} />}
                  unit="siswa"
                  caption="Lolos administrasi"
                />
                <StatCard
                  tone="rose"
                  index={3}
                  label="Pilihan Jurusan"
                  icon={GraduationCap}
                  value={
                    <span className="flex items-end gap-3 text-[1.9rem] sm:text-4xl">
                      {([['TO', stats.to], ['TJKT', stats.tjkt], ['AKL', stats.akl]] as [string, number][]).map(([k, v]) => (
                        <span key={k} className="flex flex-col leading-none">
                          <CountUp value={v} />
                          <span className="mt-1.5 text-[0.7rem] font-semibold opacity-80">{k}</span>
                        </span>
                      ))}
                    </span>
                  }
                  caption="Distribusi pilihan keahlian"
                />
              </Stagger>

              {/* STATUS & KUOTA */}
              <section className="ui-panel space-y-5 p-5 sm:p-7">
                <PanelTitle
                  title="Status Pendaftaran & Kuota Jurusan"
                  live
                  right={
                    <span className="text-sm text-slate-500">
                      Total <span className="font-bold text-slate-800">{totalCount}</span> pendaftar tersaring
                    </span>
                  }
                />

                <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <StatusTile tone="blue" label="Total Masuk" value={<CountUp value={stats.total} />} />
                  <StatusTile tone="amber" label="Teknik Otomotif" value={<CountUp value={stats.to} />} />
                  <StatusTile tone="violet" label="TJKT" value={<CountUp value={stats.tjkt} />} />
                  <StatusTile tone="green" label="AKL" value={<CountUp value={stats.akl} />} />
                  <StatusTile tone="cyan" className="col-span-2 sm:col-span-1" label="Diterima" value={<CountUp value={stats.lolos} />} />
                </Stagger>

                <div className="ui-note">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span>Semua data pendaftaran aktif tersinkronisasi secara real-time dengan server cloud.</span>
                </div>
              </section>

              {/* FILTER */}
              <section className="ui-panel ui-form p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1.6fr)_1fr_1fr_auto] lg:items-end">
                  <div className="relative col-span-2 lg:col-span-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari NIK, Nama, No. Daftar, SMP..."
                      aria-label="Cari pendaftar"
                      className="w-full pl-11 pr-4"
                    />
                  </div>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Jurusan</span>
                    <select
                      value={filterJurusan}
                      onChange={(e) => { setFilterJurusan(e.target.value); setPage(1); }}
                      className="w-full px-3 font-semibold text-slate-700"
                    >
                      <option value="ALL">Semua Jurusan</option>
                      <option value="TO">Teknik Otomotif (TO)</option>
                      <option value="TJKT">TJKT</option>
                      <option value="AKL">AKL</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
                    <span>Status</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                      className="w-full px-3 font-semibold text-slate-700"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Berkas Fisik">Berkas Fisik</option>
                      <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                      <option value="Terverifikasi">Terverifikasi</option>
                      <option value="Diterima">Diterima</option>
                      <option value="Cadangan">Cadangan</option>
                    </select>
                  </label>

                  <motion.button
                    type="button"
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                    onClick={refreshAll}
                    disabled={isLoadingList}
                    className="col-span-2 flex h-[2.9rem] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 lg:col-span-1 lg:h-[2.6rem]"
                    title="Muat ulang data pendaftar"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
                    <span>{isLoadingList ? 'Memuat...' : 'Muat Ulang'}</span>
                  </motion.button>
                </div>
              </section>

              {/* DAFTAR PENDAFTAR */}
              <section className="ui-panel overflow-hidden">
                {/* Tabel (tablet & desktop) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-indigo-50/70 text-xs font-semibold text-indigo-900/70">
                      <tr>
                        <th className="px-4 py-4">No. Pendaftaran</th>
                        <th className="px-4 py-4">NIK Siswa</th>
                        <th className="px-4 py-4">Nama Lengkap</th>
                        <th className="px-4 py-4">Jurusan</th>
                        <th className="px-4 py-4">Asal Sekolah</th>
                        <th className="px-4 py-4">No. WhatsApp</th>
                        <th className="px-4 py-4">Status Pendaftaran</th>
                        <th className="px-4 py-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 && isLoadingList ? (
                        [0, 1, 2, 3, 4].map((i) => (
                          <tr key={`sk-${i}`} aria-hidden>
                            {[7, 9, 8, 4, 7, 6, 6].map((w, c) => (
                              <td key={c} className="px-4 py-4">
                                <div className="ui-skel h-4 !rounded-full" style={{ width: `${w * 10 + 20}%`, maxWidth: '12rem' }} />
                              </td>
                            ))}
                            <td className="px-4 py-4">
                              <div className="ui-skel mx-auto h-8 w-28 !rounded-xl" />
                            </td>
                          </tr>
                        ))
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                            Tidak ada data pendaftar yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((std) => (
                          <tr key={std.id} className="transition-colors hover:bg-indigo-50/50">
                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">{std.nomor_pendaftaran}</td>
                            <td className="px-4 py-3.5 font-mono text-slate-700">{std.nik}</td>
                            <td className="px-4 py-3.5 font-bold text-slate-900">{std.nama_lengkap}</td>
                            <td className="px-4 py-3.5">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${jurusanBadge(std.jurusan_pilihan)}`}>
                                {std.jurusan_pilihan}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">{std.data_diri?.asal_sekolah || '-'}</td>
                            <td className="px-4 py-3.5">
                              <a
                                href={waHref(std)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-emerald-600 hover:underline"
                                title="Hubungi Siswa via WhatsApp Formal"
                              >
                                {std.no_wa}
                              </a>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${statusBadge(std.status_pendaftaran)}`}>
                                {std.status_pendaftaran}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenDetail(std)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-blue-600 transition-all hover:bg-blue-100 active:scale-90"
                                  title="Lihat Detail & Verifikasi"
                                  aria-label="Lihat detail dan verifikasi"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openEdit(std)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition-all hover:bg-amber-100 active:scale-90"
                                  title="Edit Data Pendaftar"
                                  aria-label="Edit data pendaftar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setResetTarget(std)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-slate-200 active:scale-90"
                                  title="Reset Password"
                                  aria-label="Reset password"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openDelete(std)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-rose-100 active:scale-90"
                                  title="Hapus Data"
                                  aria-label="Hapus data"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Kartu (ponsel) */}
                <div className="space-y-3 p-3 md:hidden">
                  {filteredStudents.length === 0 ? (
                    isLoadingList ? (
                      [0, 1, 2].map((i) => (
                        <div key={i} className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/60 p-4" aria-hidden>
                          <div className="ui-skel h-4 w-2/3 !rounded-full" />
                          <div className="ui-skel h-3 w-1/2 !rounded-full" />
                          <div className="ui-skel h-12 !rounded-2xl" />
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-10 text-center text-sm text-slate-400">
                        Tidak ada data pendaftar yang cocok dengan filter.
                      </p>
                    )
                  ) : (
                    <Stagger className="space-y-3">
                      {filteredStudents.map((std) => (
                        <motion.article
                          key={std.id}
                          variants={itemVariants}
                          className="space-y-3 rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-[0_16px_28px_-24px_rgba(67,56,202,.55)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-bold text-slate-900">{std.nama_lengkap}</h3>
                              <p className="font-mono text-xs font-bold text-indigo-700">{std.nomor_pendaftaran}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${jurusanBadge(std.jurusan_pilihan)}`}>
                              {std.jurusan_pilihan}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(std.status_pendaftaran)}`}>
                              {std.status_pendaftaran}
                            </span>
                            <a
                              href={waHref(std)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs font-semibold text-emerald-700"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {std.no_wa}
                            </a>
                          </div>

                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                            <dt className="text-slate-400">NIK</dt>
                            <dd className="truncate font-mono text-slate-700">{std.nik}</dd>
                            <dt className="text-slate-400">Asal</dt>
                            <dd className="truncate text-slate-700">{std.data_diri?.asal_sekolah || '-'}</dd>
                          </dl>

                          <div className="grid grid-cols-4 gap-2 pt-1">
                            <button onClick={() => handleOpenDetail(std)} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-blue-50 text-[0.7rem] font-semibold text-blue-700 transition-transform active:scale-90">
                              <Eye className="h-4 w-4" />Detail
                            </button>
                            <button onClick={() => openEdit(std)} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-amber-50 text-[0.7rem] font-semibold text-amber-700 transition-transform active:scale-90">
                              <Pencil className="h-4 w-4" />Edit
                            </button>
                            <button onClick={() => setResetTarget(std)} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-slate-100 text-[0.7rem] font-semibold text-slate-700 transition-transform active:scale-90">
                              <KeyRound className="h-4 w-4" />Reset
                            </button>
                            <button onClick={() => openDelete(std)} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-rose-50 text-[0.7rem] font-semibold text-rose-600 transition-transform active:scale-90">
                              <Trash2 className="h-4 w-4" />Hapus
                            </button>
                          </div>
                        </motion.article>
                      ))}
                    </Stagger>
                  )}
                </div>

                {/* Paginasi */}
                <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-600 sm:flex-row">
                  <span className="text-center sm:text-left">
                    {totalCount === 0
                      ? 'Tidak ada data'
                      : `Menampilkan ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} dari ${totalCount} pendaftar`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isLoadingList}
                      className="flex h-10 items-center gap-1 rounded-full bg-indigo-50 pl-3 pr-4 font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Sebelumnya
                    </button>
                    <span className="min-w-[4.5rem] text-center font-semibold tabular-nums text-slate-700">
                      Hal {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= Math.ceil(totalCount / PAGE_SIZE) || isLoadingList}
                      className="flex h-10 items-center gap-1 rounded-full bg-indigo-50 pl-4 pr-3 font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95 disabled:opacity-40"
                    >
                      Berikutnya
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </ViewTransition>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:px-6">
        <span>Copyright © 2026 SPMB SMK MUHIBA | by @hndx07</span>
        <a
          href="https://www.smkmuhiba.sch.id"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 hover:underline"
        >
          Website Resmi: www.smkmuhiba.sch.id
        </a>
      </footer>

      {/* ===================================================================== */}
      {/* MODAL DETAIL SISWA & VERIFIKASI                                        */}
      {/* ===================================================================== */}
      {selectedStudent && (
        <div
          role="dialog"
          aria-modal="true"
          className="ui-scope ui-form fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(30,27,75,.65)] max-w-3xl w-full p-5 sm:p-8 relative my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-300 space-y-6">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Detail Calon Peserta Didik
                </span>
                <h3 className="text-lg font-black text-slate-900">{selectedStudent.nama_lengkap}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  No. Pendaftaran: {selectedStudent.nomor_pendaftaran} • NIK: {selectedStudent.nik}
                </p>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-all active:scale-90"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Data Diri */}
              <div className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Diri</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">NISN:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.nisn || '-'}</span>

                  <span className="text-slate-500">TTL:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_diri?.tempat_lahir || '-'}, {selectedStudent.data_diri?.tanggal_lahir || '-'}
                  </span>

                  <span className="text-slate-500">Jenis Kelamin:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.jenis_kelamin || '-'}</span>

                  <span className="text-slate-500">Asal SMP:</span>
                  <span className="font-semibold text-blue-700">{selectedStudent.data_diri?.asal_sekolah || '-'}</span>

                  <span className="text-slate-500">Ukuran Baju:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.ukuran_baju || '-'}</span>

                  <span className="text-slate-500">Kode Referal:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_diri?.kode_referal || '-'}</span>
                </div>
              </div>

              {/* Data Alamat */}
              <div className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Alamat</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">Dukuh/Jalan:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.dukuh || '-'}</span>

                  <span className="text-slate-500">RT / RW:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_alamat?.rt || '-'}/{selectedStudent.data_alamat?.rw || '-'}
                  </span>

                  <span className="text-slate-500">Kecamatan:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.kecamatan || '-'}</span>

                  <span className="text-slate-500">Kabupaten:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.kabupaten || '-'}</span>

                  <span className="text-slate-500">Transportasi:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_alamat?.transportasi || '-'}</span>
                </div>
              </div>

              {/* Data Orang Tua */}
              <div className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Data Orang Tua</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-slate-500">Nama Ayah:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.nama_ayah || '-'}</span>

                  <span className="text-slate-500">Pekerjaan Ayah:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_orang_tua?.pekerjaan_ayah || '-'}
                  </span>

                  <span className="text-slate-500">Nama Ibu:</span>
                  <span className="font-medium text-slate-800">{selectedStudent.data_orang_tua?.nama_ibu || '-'}</span>

                  <span className="text-slate-500">Pekerjaan Ibu:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_orang_tua?.pekerjaan_ibu || '-'}
                  </span>

                  <span className="text-slate-500">No HP Ortu:</span>
                  <span className="font-medium text-slate-800">
                    {selectedStudent.data_orang_tua?.no_hp_ayah || selectedStudent.data_orang_tua?.no_hp_ibu || '-'}
                  </span>
                </div>
              </div>

              {/* Berkas */}
              <div className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b">Berkas Terunggah</h4>
                <div className="space-y-2 text-xs">
                  <BerkasRow label="Kartu Keluarga" item={selectedStudent.data_berkas?.kartu_keluarga} onOpen={openBerkas} />
                  <BerkasRow label="Ijazah / SKL" item={selectedStudent.data_berkas?.ijazah_skl} onOpen={openBerkas} />
                  <BerkasRow label="Akta Lahir" item={selectedStudent.data_berkas?.akta_kelahiran} onOpen={openBerkas} />
                  {selectedStudent.data_berkas?.kartu_kip && (
                    <BerkasRow label="Kartu KIP" item={selectedStudent.data_berkas.kartu_kip} onOpen={openBerkas} />
                  )}
                  {selectedStudent.data_berkas?.pas_foto && (
                    <BerkasRow label="Pas Foto" item={selectedStudent.data_berkas.pas_foto} onOpen={openBerkas} />
                  )}
                </div>
              </div>
            </div>

            {/* Verifikasi Status */}
            <div className="p-5 rounded-3xl bg-indigo-50/70 border border-indigo-100 space-y-4">
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Verifikasi Status Pendaftaran
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ubah Status:</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as StatusPendaftaran)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-bold text-slate-800"
                  >
                    <option value="Berkas Fisik">Berkas Fisik</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Terverifikasi">Terverifikasi</option>
                    <option value="Diterima">Diterima di SMK Muhiba</option>
                    <option value="Cadangan">Cadangan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Panitia / Verifikator:
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Contoh: Berkas asli sudah dicek di loket"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="ui-shine h-12 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white font-bold text-sm rounded-2xl shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Status</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(selectedStudent)}
                    className="h-11 px-4 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-2xl inline-flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetTarget(selectedStudent)}
                    className="h-11 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl inline-flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL EDIT DATA PENDAFTAR                                              */}
      {/* ===================================================================== */}
      {editStudent && editForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit data pendaftar"
          className="ui-scope ui-form fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(30,27,75,.65)] max-w-3xl w-full p-5 sm:p-8 relative my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-300 space-y-5">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                  Edit Data Pendaftar
                </span>
                <h3 className="text-lg font-black text-slate-900">{editStudent.nama_lengkap}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  No. Pendaftaran: {editStudent.nomor_pendaftaran} • NIK: {editStudent.nik}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  NIK dan nomor pendaftaran terkait akun login sehingga tidak dapat diubah dari sini.
                </p>
              </div>
              <button
                onClick={() => !isSaving && closeEdit()}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-all active:scale-90"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Identitas & status */}
            <div className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-800 uppercase pb-1 border-b text-xs">Identitas &amp; Status</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Nama lengkap</span>
                  <input
                    type="text"
                    maxLength={100}
                    value={editForm.nama_lengkap}
                    onChange={(e) => setTopField('nama_lengkap', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Jurusan pilihan</span>
                  <select
                    value={editForm.jurusan_pilihan}
                    onChange={(e) => setTopField('jurusan_pilihan', e.target.value as JurusanType)}
                    className={INPUT_CLASS}
                  >
                    {JURUSAN_OPTIONS.map((j) => (
                      <option key={j.value} value={j.value}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">No. WhatsApp</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={20}
                    value={editForm.no_wa}
                    onChange={(e) => setTopField('no_wa', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Status pendaftaran</span>
                  <select
                    value={editForm.status_pendaftaran}
                    onChange={(e) => setTopField('status_pendaftaran', e.target.value as StatusPendaftaran)}
                    className={INPUT_CLASS}
                  >
                    {ALL_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Catatan panitia</span>
                  <input
                    type="text"
                    maxLength={300}
                    value={editForm.catatan_admin}
                    onChange={(e) => setTopField('catatan_admin', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </div>

            {/* Seksi data JSON */}
            {(['data_diri', 'data_alamat', 'data_orang_tua'] as const).map((section) => (
              <div key={section} className="p-4 rounded-3xl bg-slate-50/80 border border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase pb-1 border-b text-xs">
                  {SECTION_META[section].title}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SECTION_META[section].defs.map((def) => (
                    <FieldInput
                      key={def.key}
                      def={def}
                      value={editForm[section][def.key] ?? ''}
                      onChange={(v) => setSectionField(section, def.key, v)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeEdit}
                disabled={isSaving}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="ui-shine h-12 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 disabled:opacity-60 text-white font-bold text-sm rounded-2xl shadow-[0_18px_30px_-16px_rgba(91,61,240,.9)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOG KONFIRMASI HAPUS                                                */}
      {/* ===================================================================== */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus pendaftar"
          className="ui-scope fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-4"
        >
          <div className="bg-white rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(30,27,75,.65)] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Hapus pendaftar ini?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-bold">{deleteTarget.nama_lengkap}</span>
                  <br />
                  <span className="font-mono text-[11px] text-slate-500">
                    {deleteTarget.nomor_pendaftaran} • {deleteTarget.nik}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
              <p className="font-bold">Tindakan ini permanen dan tidak bisa dibatalkan.</p>
              <p>Data pendaftaran, akun login, dan semua berkas yang diunggah akan dihapus.</p>
            </div>

            {deleteError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Ketik <span className="font-mono font-black">HAPUS</span> untuk melanjutkan
              </span>
              <input
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmText.trim() !== 'HAPUS'}
                className="h-12 px-5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-[0_18px_30px_-16px_rgba(225,29,72,.9)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'Menghapus...' : 'Hapus permanen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOG RESET PASSWORD                                                  */}
      {/* ===================================================================== */}
      {resetTarget && (
        <React.Suspense fallback={null}>
          <AdminResetPasswordModal
            student={resetTarget}
            onClose={() => setResetTarget(null)}
            onDone={() => setLogRefreshKey((k) => k + 1)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
