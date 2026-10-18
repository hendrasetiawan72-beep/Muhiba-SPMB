import { uploadBerkasFile as uploadBerkas } from './uploadBerkas';
import type { BerkasJenis } from '../Utils/uploadConfig';

// di dalam class dbService:
public async uploadBerkasFile(userId: string, jenis: BerkasJenis, file: File, oldPath?: string) {
  if (!this.supabase) throw new Error('Supabase client belum terhubung.');
  return uploadBerkas(this.supabase, userId, jenis, file, oldPath);
}
