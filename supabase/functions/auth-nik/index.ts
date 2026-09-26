// Supabase Edge Function: auth-nik
// Deploy command: supabase functions deploy auth-nik --no-verify-jwt
// Handled actions: "register" | "login"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function jsonResponse(data: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(
        {
          success: false,
          error: "Edge Function configuration missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/$/, "");

    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error: "Format request body tidak valid (harus JSON).",
          },
          400
        );
      }
    }

    const isRegister =
      pathname.endsWith("/register") ||
      body?.action === "register" ||
      (!pathname.endsWith("/login") && body?.action !== "login" && (body?.nama || body?.nama_lengkap));

    const isLogin =
      pathname.endsWith("/login") ||
      body?.action === "login" ||
      (!isRegister && (body?.identifier || body?.nik) && body?.password);

    // =========================================================================
    // ACTION: REGISTER
    // =========================================================================
    if (isRegister) {
      const rawNik = body?.nik ?? "";
      const rawNama = body?.nama ?? body?.nama_lengkap ?? "";
      const rawJurusan = body?.jurusan ?? body?.jurusan_pilihan ?? "";
      const rawWa = body?.whatsapp ?? body?.no_wa ?? "";
      const rawPassword = body?.password ?? "";

      const cleanNik = String(rawNik).trim().replace(/\D/g, "");
      const cleanNama = String(rawNama).trim();
      const cleanJurusan = String(rawJurusan).trim().toUpperCase();
      const cleanWa = String(rawWa).trim();
      const cleanPassword = String(rawPassword).trim();

      // Validasi 1: NIK wajib 16 digit
      if (!/^\d{16}$/.test(cleanNik)) {
        return jsonResponse(
          {
            success: false,
            error: "NIK wajib terdiri dari 16 digit angka sesuai KTP / Kartu Keluarga.",
          },
          400
        );
      }

      // Validasi 2: Nama wajib
      if (!cleanNama) {
        return jsonResponse(
          {
            success: false,
            error: "Nama lengkap calon siswa wajib diisi.",
          },
          400
        );
      }

      // Validasi 3: Jurusan wajib & valid
      if (!["TO", "TJKT", "AKL"].includes(cleanJurusan)) {
        return jsonResponse(
          {
            success: false,
            error: "Pilihan jurusan tidak valid. Pilihan yang tersedia: TO, TJKT, AKL.",
          },
          400
        );
      }

      // Validasi 4: WhatsApp wajib
      if (!cleanWa) {
        return jsonResponse(
          {
            success: false,
            error: "Nomor WhatsApp aktif wajib diisi.",
          },
          400
        );
      }

      // Validasi 5: Password minimal 6 karakter
      if (cleanPassword.length < 6) {
        return jsonResponse(
          {
            success: false,
            error: "Password minimal 6 karakter untuk menjaga keamanan akun siswa.",
          },
          400
        );
      }

      // Validasi 6: NIK tidak boleh sudah terdaftar di public.students
      const { data: existingStudent, error: checkErr } = await supabaseAdmin
        .from("students")
        .select("nik")
        .eq("nik", cleanNik)
        .maybeSingle();

      if (checkErr && checkErr.code !== "PGRST116") {
        console.error("Database check error:", checkErr);
      }

      if (existingStudent) {
        return jsonResponse(
          {
            success: false,
            error: `NIK ${cleanNik} sudah terdaftar di sistem SPMB SMK Muhammadiyah 1 Baturetno. Silakan langsung login menggunakan NIK dan password Anda.`,
          },
          409
        );
      }

      // Identifier Auth: Menggunakan domain internal aman di server
      // Bukan NIK@siswa.smkmuhiba.sch.id
      const authEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;

      // Provision user via Supabase Auth Admin API dengan email_confirm: true
      // Menghindari email rejection / MX check GoTrue
      const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          nik: cleanNik,
          full_name: cleanNama,
          role: "student",
        },
      });

      if (createAuthErr || !authCreated?.user) {
        const errMsg = createAuthErr?.message || "";
        if (errMsg.includes("already been registered") || errMsg.includes("exists")) {
          return jsonResponse(
            {
              success: false,
              error: `Akun autentikasi untuk NIK ${cleanNik} sudah dibuat sebelumnya. Silakan langsung login.`,
            },
            409
          );
        }
        return jsonResponse(
          {
            success: false,
            error: `Gagal membuat akun autentikasi: ${errMsg}`,
          },
          500
        );
      }

      const userId = authCreated.user.id;

      // Nomor Pendaftaran Berurutan
      const { count } = await supabaseAdmin.from("students").select("*", { count: "exact", head: true });
      const nextSeq = (count || 0) + 1;
      const nomorPendaftaran = (2026470 + nextSeq).toString();

      const now = new Date();
      const dateFormatted = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      try {
        // Upsert ke public.profiles
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          nik: cleanNik,
          full_name: cleanNama,
          role: "student",
        });

        // Insert ke public.students dengan kolom JSONB
        const { data: student, error: stdErr } = await supabaseAdmin
          .from("students")
          .insert({
            user_id: userId,
            nik: cleanNik,
            nama_lengkap: cleanNama,
            jurusan_pilihan: cleanJurusan,
            no_wa: cleanWa,
            status_pendaftaran: "Berkas Fisik",
            nomor_pendaftaran: nomorPendaftaran,
            tanggal_daftar: dateFormatted,
            data_diri: {
              nik: cleanNik,
              nama_lengkap: cleanNama,
              no_hp: cleanWa,
            },
            data_alamat: {},
            data_orang_tua: {},
            data_berkas: {},
          })
          .select()
          .single();

        if (stdErr) {
          throw stdErr;
        }

        // Login kembali untuk menerbitkan session JWT ke client
        const { data: sessionData } = await supabaseAnon.auth.signInWithPassword({
          email: authEmail,
          password: cleanPassword,
        });

        return jsonResponse(
          {
            success: true,
            message: "Pendaftaran berhasil disimpan.",
            user_id: userId,
            session: sessionData?.session || null,
            user: {
              id: userId,
              nik: cleanNik,
              full_name: cleanNama,
              role: "student",
              email: authEmail,
            },
            student,
          },
          201
        );
      } catch (insertErr: any) {
        console.error("Transaction failed, rolling back auth user:", insertErr);
        // ATOMIC CLEANUP: Hapus auth user jika database gagal untuk mencegah orphan user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return jsonResponse(
          {
            success: false,
            error: insertErr?.message || "Gagal menyimpan data siswa ke database.",
          },
          500
        );
      }
    }

    // =========================================================================
    // ACTION: LOGIN
    // =========================================================================
    if (isLogin) {
      const rawIdentifier = body?.identifier ?? body?.nik ?? body?.username ?? "";
      const rawPassword = body?.password ?? "";

      const cleanIdentifier = String(rawIdentifier).trim();
      const cleanPassword = String(rawPassword).trim();

      if (!cleanIdentifier || !cleanPassword) {
        return jsonResponse(
          {
            success: false,
            error: "Username / NIK dan password wajib diisi.",
          },
          400
        );
      }

      const isNik = /^\d{16}$/.test(cleanIdentifier);
      const isAdmin = cleanIdentifier.toLowerCase() === "admin";
      let authEmail = cleanIdentifier;

      if (isNik) {
        authEmail = `nik_${cleanIdentifier}@auth.smkmuhiba.sch.id`;
      } else if (isAdmin) {
        authEmail = "admin@smkmuhiba.sch.id";
      }

      const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: authEmail,
        password: cleanPassword,
      });

      if (signInErr || !signInData?.user) {
        return jsonResponse(
          {
            success: false,
            error: isNik
              ? "NIK atau password salah. Pastikan 16 digit NIK dan password sudah sesuai."
              : "Username atau password admin salah.",
          },
          401
        );
      }

      // Verifikasi role langsung dari database profiles
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const userRole = profile?.role === "admin" ? "admin" : "student";
      if (isAdmin && userRole !== "admin") {
        return jsonResponse(
          {
            success: false,
            error: "Akses ditolak: Akun ini tidak memiliki hak akses administrator di database.",
          },
          403
        );
      }

      let student = null;
      if (userRole === "student") {
        const { data: std } = await supabaseAdmin
          .from("students")
          .select("*")
          .eq("user_id", signInData.user.id)
          .maybeSingle();
        student = std;
      }

      return jsonResponse(
        {
          success: true,
          message: "Login berhasil.",
          user_id: signInData.user.id,
          session: signInData.session,
          user: {
            id: signInData.user.id,
            nik: profile?.nik || (isNik ? cleanIdentifier : ""),
            role: userRole,
            full_name: profile?.full_name || (isAdmin ? "Administrator" : "Siswa"),
            email: signInData.user.email || authEmail,
          },
          student,
        },
        200
      );
    }

    return jsonResponse(
      {
        success: false,
        error: `Action tidak dikenal pada Edge Function auth-nik: '${body?.action || pathname}'`,
      },
      404
    );
  } catch (err: any) {
    console.error("Unhandled error in auth-nik function:", err);
    return jsonResponse(
      {
        success: false,
        error: err?.message || "Internal server error in Edge Function auth-nik.",
      },
      500
    );
  }
});
