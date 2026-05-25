import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Recycle, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/lang-context";

export function LoginForm() {
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = t.correoObligatorio;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t.correoInvalido;
    if (!password) e.password = t.contrasenaObligatoria;
    else if (password.length < 6) e.password = t.contrasenaMin;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    const result = login(email, password);
    if (!result.success) {
      const msg = result.error === "Usuario no encontrado" ? t.usuarioNoEncontrado
        : result.error === "Contraseña incorrecta" ? t.contrasenaIncorrecta
        : t.errorLogin;
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="gradient-hero hidden flex-1 items-center justify-center lg:flex">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-md px-12 text-center"
        >
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
            <Recycle size={40} className="text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground">
            FullCycle Predict
          </h1>
        </motion.div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Recycle size={22} className="text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">FullCycle</span>
            </div>
            <button
              onClick={() => setLang(lang === "es" ? "en" : "es")}
              className="ml-auto rounded-md border border-input px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
            >
              {lang === "es" ? "EN" : "ES"}
            </button>
          </div>

          <h2 className="text-2xl font-bold">{t.iniciarSesion}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.loginSub}</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">{t.correo}</Label>
              <Input
                id="email"
                type="email"
                placeholder="Correo"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <Label htmlFor="password">{t.contrasena}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full">{t.ingresar}</Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
