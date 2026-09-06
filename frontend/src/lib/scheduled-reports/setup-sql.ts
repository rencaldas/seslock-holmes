// Imported straight from the actual migration files (repo root, outside this
// Vite project — see server.fs.allow in vite.config.ts) so the setup panel
// can never drift from what actually needs to run.
import reportSchedulesMigrationSql from "../../../../supabase/migrations/20260730120000_report_schedules.sql?raw";
import lockDefaultSchedulesMigrationSql from "../../../../supabase/migrations/20260730140000_lock_default_report_schedules.sql?raw";

// Portable: copy-paste this into ANY Supabase project used with this app —
// this deployment's own project, or a visitor's own.
export const REPORT_SCHEDULES_MIGRATION_SQL = reportSchedulesMigrationSql;

// NOT portable: run once, only on the Supabase project THIS deployment's own
// Vercel points at. Denies the anon role on report_schedules — a visitor
// running this app against their own project must NOT run it. See
// docs/ARCHITECTURE.md#fluxo-de-dados-postgres-como-fonte-da-verdade.
export const LOCK_DEFAULT_SCHEDULES_MIGRATION_SQL = lockDefaultSchedulesMigrationSql;

export interface RequiredEnvVar {
  name: string;
  description: string;
}

// Periodic trigger is GitHub Actions (every 15 min) backed by Vercel Cron
// (once daily, failsafe) — no pg_cron/pg_net/Vault needed on the database
// side. See docs/ARCHITECTURE.md#relatórios-agendados.
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
];
