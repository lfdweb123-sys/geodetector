import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-950 to-slate-900 px-6 text-center text-white">
      <span className="badge mb-6 bg-white/10 text-brand-100">Multi-signal location verification</span>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">GeoLock</h1>
      <p className="mt-4 max-w-xl text-slate-300">
        GeoLock combine plusieurs signaux indépendants (GPS, IP, réseau, fuseau horaire, intégrité de
        l&apos;appareil) pour déterminer la localisation la plus crédible d&apos;un utilisateur et détecter les
        incohérences géographiques - avec un score de confiance et des preuves, jamais une certitude absolue.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">
          Créer un compte
        </Link>
        <Link href="/login" className="btn-secondary bg-transparent text-white hover:bg-white/10">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
