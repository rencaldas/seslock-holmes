// Imported straight from the actual migration files (repo root, outside this
// Vite project — see server.fs.allow in vite.config.ts) so the setup panel
// can never drift from what actually needs to run.
import reportSchedulesMigrationSql from "../../../../supabase/migrations/20260730120000_report_schedules.sql?raw";
import reportConnectionsMigrationSql from "../../../../supabase/migrations/20260730130000_report_connections.sql?raw";
import lockDefaultSchedulesMigrationSql from "../../../../supabase/migrations/20260730140000_lock_default_report_schedules.sql?raw";

// Portable: copy-paste this into ANY Supabase project used with this app —
// this deployment's own default project, or a visitor's own project
// registered as a "connection" for automatic delivery.
export const REPORT_SCHEDULES_MIGRATION_SQL = reportSchedulesMigrationSql;

// NOT portable: only ever run once, on the single Supabase project THIS
// deployment's own Vercel points at (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
// — it's the registry other visitors' connections live in, and the lockdown
// that closes the "anonymous visitor writes into my project" hole. A
// visitor bringing their own separate Supabase project never runs these.
export const HUB_ONLY_MIGRATIONS_SQL = [reportConnectionsMigrationSql, lockDefaultSchedulesMigrationSql].join(
  "\n\n",
);

export interface RequiredEnvVar {
  name: string;
  description: string;
}

// The periodic trigger is a GitHub Actions workflow (runs every 15 minutes,
// see .github/workflows/scheduled-reports-trigger.yml), backed by Vercel
// Cron (see the `crons` entry in vercel.json) as a once-daily failsafe.
// Both call /api/send-scheduled-reports and authenticate with CRON_SECRET.
// Supabase only stores the data — no pg_cron/pg_net/Vault setup is needed
// on the database side.
export const REQUIRED_VERCEL_ENV_VARS: RequiredEnvVar[] = [
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    description:
      "Painel do Supabase → Project Settings → API → service_role key. Precisa desse nível de acesso para ler todos os agendamentos e gravar o histórico, ignorando o RLS da anon key.",
  },
  {
    name: "GMAIL_USER",
    description:
      "O endereço Gmail que vai aparecer como remetente dos relatórios do SEU projeto padrão (ex.: seuemail@gmail.com). Precisa ter a Verificação em 2 etapas ativada na conta Google.",
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
  {
    name: "ADMIN_API_TOKEN",
    description:
      "Qualquer string aleatória (16+ caracteres) só sua. Depois de rodar a migration de trava abaixo, é o que permite VOCÊ (e só você) gerenciar os agendamentos do projeto padrão pela tela do app — cole o mesmo valor em Configurações, no seu próprio navegador.",
  },
  {
    name: "CONNECTIONS_ENCRYPTION_KEY",
    description:
      "Qualquer string aleatória longa (32+ caracteres). Usada para criptografar, em repouso, as credenciais que OUTRAS pessoas registram ao conectar o próprio Supabase/Gmail para entrega automática — nunca fica em texto puro no banco.",
  },
];
