import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/use-i18n";
import { signInWithPassword } from "@/lib/supabase/auth";
import { useSupabase } from "@/lib/supabase/context";
import overviewLogo from "@/assets/overview-logo.png";
import overviewLogoBlack from "@/assets/overview-logo-black.png";

// Tela exibida quando uma consulta é recusada por permissão e ainda não há
// sessão. Não é a porta de entrada do app: quem usa um Supabase com a RLS
// aberta nunca chega aqui (ver o comentário de topo em lib/supabase/auth.ts).
//
// Não existe link de "criar conta" de propósito. O cadastro público fica
// desabilitado no painel do Supabase — com ele aberto, exigir o papel
// `authenticated` não protegeria nada, já que qualquer pessoa criaria uma
// conta e voltaria a ler tudo. As contas são criadas por um administrador.
export function LoginState() {
  const t = useI18n();
  const { client } = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await signInWithPassword(client, email, password);
      if (signInError) {
        // A mensagem do Supabase não é traduzida e costuma ser genérica
        // ("Invalid login credentials"), então mostramos a nossa. Distinguir
        // "e-mail não existe" de "senha errada" seria pior: entregaria quais
        // endereços têm conta.
        setError(t.login.invalidCredentials);
      }
      // Em caso de sucesso não há o que fazer aqui: onAuthStateChange no
      // SupabaseProvider recebe a sessão, baixa authRequired e a árvore volta
      // a renderizar o dashboard.
    } catch {
      setError(t.login.unexpectedError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-10">
      <div className="flex flex-col items-center gap-2">
        <img src={overviewLogoBlack} alt="" className="h-20 w-20 object-contain dark:hidden" />
        <img src={overviewLogo} alt="" className="hidden h-20 w-20 object-contain dark:block" />
        <span className="text-lg font-bold text-ink">{t.app.subtitle}</span>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">{t.login.emailLabel}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t.login.passwordLabel}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn className="mr-2 h-4 w-4" />
              {isSubmitting ? t.login.submitting : t.login.submit}
            </Button>

            <p className="text-xs leading-5 text-ink-muted">{t.login.noSignupHint}</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
