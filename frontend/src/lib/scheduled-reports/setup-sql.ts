// Imported straight from the actual migration file (repo root, outside this
// Vite project — see server.fs.allow in vite.config.ts) so the setup panel
// can never drift from what actually needs to run.
import migrationSql from "../../../../supabase/migrations/20260730120000_report_schedules.sql?raw";

export const REPORT_SCHEDULES_MIGRATION_SQL = migrationSql;

export interface RequiredEnvVar {
  name: string;
  description: string;
}

// The periodic trigger is Vercel Cron (see the `crons` entry in
// vercel.json), which calls /api/send-scheduled-reports on a schedule and
// authenticates with this same secret. Supabase only stores the data here —
// no pg_cron/pg_net/Vault setup is needed on the database side.
export const REQUIRED_VERCEL_ENV_VARS: RequiredEnvVar[] = [
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    description:
      "Painel do Supabase → Project Settings → API → service_role key. Precisa desse nível de acesso para ler todos os agendamentos e gravar o histórico, ignorando o RLS da anon key.",
  },
  {
    name: "GMAIL_USER",
    description:
      "O endereço Gmail que vai aparecer como remetente dos relatórios (ex.: seuemail@gmail.com). Precisa ter a Verificação em 2 etapas ativada na conta Google.",
  },
  {
    name: "GMAIL_APP_PASSWORD",
    description:
      "Senha de app gerada em myaccount.google.com/apppasswords para esse Gmail (16 caracteres, diferente da senha normal da conta). Usada só para autenticar o envio via SMTP.",
  },
  {
    name: "CRON_SECRET",
    description:
      "Qualquer string aleatória (16+ caracteres). O Vercel a envia automaticamente como Authorization: Bearer nas chamadas do cron, e a function rejeita qualquer chamada sem ela — protege o endpoint contra disparo por terceiros.",
  },
];
