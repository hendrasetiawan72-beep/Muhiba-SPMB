// Supabase Edge Function: auth-nik
// Deploy with: supabase functions deploy auth-nik --no-verify-jwt
// Serves: /register and /login using NIK + Password

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/$/, "");

    // 1. REGISTER: NIK + Password
    if (pathname.endsWith("/register") && req.method === "POST") {
      const body = await req.json();
      const { nik, nama_lengkap, jurusan_pilihan, no_wa, password } = body;

      const cleanNik = String(nik || "").trim().replace(/\D/g, "");
      const cleanNama = String(nama_lengkap || "").trim();
      const cleanNoWa = String(no_wa || "").trim();
      const cleanPassword = String(password || "").trim();

      if (!/^\d{16}$/.test(cleanNik)) {
        return new Response(
          JSON.stringify({ error: "NIK harus terdiri dari 16 digit angka." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check duplicate
      const { data: existing } = await supabaseAdmin
        .from("students")
        .select("nik")
        .eq("nik", cleanNik)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: `NIK ${cleanNik} sudah terdaftar.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const internalEmail = `nik_${cleanNik}@auth.smkmuhiba.sch.id`;

      // Provision user with email_confirm: true (no SMTP verification needed)
      const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: { nik: cleanNik, full_name: cleanNama, role: "student" },
      });

      if (createAuthErr || !authCreated?.user) {
        return new Response(
          JSON.stringify({ error: createAuthErr?.message || "Gagal membuat akun auth." }),
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

        // Insert student
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
            user: { id: userId, nik: cleanNik, full_name: cleanNama, role: "student" },
            student,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (insertErr: any) {
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: insertErr.message || "Gagal menyimpan data pendaftaran." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. LOGIN: NIK or Admin + Password
    if (pathname.endsWith("/login") && req.method === "POST") {
      const { identifier, password } = await req.json();
      const cleanIdentifier = String(identifier || "").trim();
      const cleanPassword = String(password || "").trim();

      const isNik = /^\d{10,16}$/.test(cleanIdentifier);
      const authEmail = isNik
        ? `nik_${cleanIdentifier}@auth.smkmuhiba.sch.id`
        : cleanIdentifier.includes("@")
        ? cleanIdentifier
        : "admin@smkmuhiba.sch.id";

      const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: authEmail,
        password: cleanPassword,
      });

      if (signInErr || !signInData?.user) {
        return new Response(
          JSON.stringify({ error: "Login gagal: NIK / Username atau password salah." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check role from profiles
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const userRole = profile?.role || "student";
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
            nik: profile?.nik || cleanIdentifier,
            role: userRole,
            full_name: profile?.full_name || "Pengguna",
          },
          student,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Endpoint tidak ditemukan." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
