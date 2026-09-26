// Supabase Edge Function: auth-nik
// Deploy with: supabase functions deploy auth-nik --no-verify-jwt
// Serves: POST /register and POST /login (or action: 'register' | 'login')

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Edge Function configuration missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        return new Response(
          JSON.stringify({ success: false, error: "Request body is not valid JSON." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const isRegister = pathname.endsWith("/register") || body?.action === "register";
    const isLogin = pathname.endsWith("/login") || body?.action === "login";

    // 1. REGISTER: NIK + Password
    if (isRegister && req.method === "POST") {
      const { nik, nama_lengkap, jurusan_pilihan, no_wa, password } = body;

      const cleanNik = String(nik || "").trim().replace(/\D/g, "");
      const cleanNama = String(nama_lengkap || "").trim();
      const cleanNoWa = String(no_wa || "").trim();
      const cleanPassword = String(password || "").trim();

      if (!/^\d{16}$/.test(cleanNik)) {
        return new Response(
          JSON.stringify({ success: false, error: "NIK harus terdiri dari 16 digit angka." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!cleanNama) {
        return new Response(
          JSON.stringify({ success: false, error: "Nama lengkap wajib diisi." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!["TO", "TJKT", "AKL"].includes(jurusan_pilihan)) {
        return new Response(
          JSON.stringify({ success: false, error: "Jurusan pilihan tidak valid." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cleanPassword.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: "Password minimal 6 karakter." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check duplicate in students
      const { data: existing } = await supabaseAdmin
        .from("students")
        .select("nik")
        .eq("nik", cleanNik)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `NIK ${cleanNik} sudah terdaftar di sistem SPMB. Silakan login.`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;

      // Provision user with email_confirm: true (bypass MX check)
      const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: { nik: cleanNik, full_name: cleanNama, role: "student" },
      });

      if (createAuthErr || !authCreated?.user) {
        if (createAuthErr?.message?.includes("already been registered") || createAuthErr?.message?.includes("exists")) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Akun Auth untuk NIK ${cleanNik} sudah ada. Silakan langsung login.`,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: createAuthErr?.message || "Gagal membuat akun autentikasi.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = authCreated.user.id;

      // Consecutive registration number
      const { count } = await supabaseAdmin.from("students").select("*", { count: "exact", head: true });
      const nextSeq = (count || 0) + 1;
      const nomorPendaftaran = (2026470 + nextSeq).toString();

      const now = new Date();
      const dateFormatted = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      try {
        // Upsert profile
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          nik: cleanNik,
          full_name: cleanNama,
          role: "student",
        });

        // Insert student record
        const { data: student, error: stdErr } = await supabaseAdmin
          .from("students")
          .insert({
            user_id: userId,
            nik: cleanNik,
            nama_lengkap: cleanNama,
            jurusan_pilihan,
            no_wa: cleanNoWa,
            status_pendaftaran: "Berkas Fisik",
            nomor_pendaftaran: nomorPendaftaran,
            tanggal_daftar: dateFormatted,
            data_diri: { nik: cleanNik, nama_lengkap: cleanNama, no_hp: cleanNoWa },
            data_alamat: {},
            data_orang_tua: {},
            data_berkas: {},
          })
          .select()
          .single();

        if (stdErr) throw stdErr;

        // Sign in to return JWT session
        const { data: sessionData } = await supabaseAnon.auth.signInWithPassword({
          email: internalEmail,
          password: cleanPassword,
        });

        return new Response(
          JSON.stringify({
            success: true,
            session: sessionData?.session || null,
            user: {
              id: userId,
              nik: cleanNik,
              full_name: cleanNama,
              role: "student",
              email: internalEmail,
            },
            student,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (insertErr: any) {
        // Atomic Rollback: delete auth user if DB insert fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({
            success: false,
            error: insertErr?.message || "Gagal menyimpan data pendaftaran ke database.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. LOGIN: NIK or Admin + Password
    if (isLogin && req.method === "POST") {
      const { identifier, password } = body;
      const cleanIdentifier = String(identifier || "").trim();
      const cleanPassword = String(password || "").trim();

      if (!cleanIdentifier || !cleanPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Username / NIK dan password wajib diisi." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        return new Response(
          JSON.stringify({
            success: false,
            error: isNik
              ? "NIK atau password salah. Pastikan 16 digit NIK dan password sesuai saat pendaftaran."
              : "Username atau password admin salah.",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check role strictly from database profiles table
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const userRole = profile?.role === "admin" ? "admin" : "student";
      if (isAdmin && userRole !== "admin") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Akses ditolak: Akun ini tidak memiliki hak akses administrator.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      return new Response(
        JSON.stringify({
          success: true,
          session: signInData.session,
          user: {
            id: signInData.user.id,
            nik: profile?.nik || (isNik ? cleanIdentifier : ""),
            role: userRole,
            full_name: profile?.full_name || (isAdmin ? "Administrator" : "Siswa"),
            email: signInData.user.email || authEmail,
          },
          student,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `Endpoint '${pathname}' tidak ditemukan pada Edge Function auth-nik.`,
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error in Edge Function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
