export interface TempCredential {
  nik: string;
  password: string;
  nama: string;
  nomor_pendaftaran: string;
  tanggal_daftar?: string;
  jurusan_pilihan?: string;
}

// In-memory credential storage for session banner & proof PDF without persisting passwords to localStorage/sessionStorage
let memoryCredentials: TempCredential | null = null;

export const credentialStore = {
  set(creds: TempCredential): void {
    memoryCredentials = { ...creds };
  },
  get(): TempCredential | null {
    return memoryCredentials;
  },
  clear(): void {
    memoryCredentials = null;
  },
};
