import Link from 'next/link';
import {
  MapPin,
  Wifi,
  Clock,
  Gauge,
  ShieldCheck,
  Webhook,
  SlidersHorizontal,
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';

const STEPS = [
  {
    icon: Smartphone,
    title: '1. Le SDK demande la localisation',
    description:
      "Consentement explicite affiché avant la demande de permission native du navigateur ou de l'OS. Aucune donnée collectée en silence.",
  },
  {
    icon: Wifi,
    title: '2. Collecte multi-signaux',
    description: 'GPS, précision, IP (VPN/proxy/Tor/datacenter), fuseau horaire, langue, intégrité de l’appareil.',
  },
  {
    icon: Gauge,
    title: '3. Moteur de scoring',
    description:
      'Chaque signal reçoit un poids et une fiabilité. Un VPN détecté qui explique un écart IP/GPS n’est pas pénalisé comme une fraude.',
  },
  {
    icon: ShieldCheck,
    title: '4. Décision explicable',
    description: 'VERIFIED / SUSPICIOUS / UNVERIFIED, avec confiance, preuves et raisons - jamais un simple booléen.',
  },
];

const FEATURES = [
  {
    icon: MapPin,
    title: 'GPS + reverse geocoding réel',
    description: 'Précision, fraîcheur et pays résolus via une vraie géolocalisation inversée, pas une estimation.',
  },
  {
    icon: Wifi,
    title: 'Détection VPN, proxy, Tor, datacenter',
    description: "Intelligence IP branchable (ip-api.com, ipinfo.io) + liste officielle des nœuds de sortie Tor.",
  },
  {
    icon: Clock,
    title: 'Cohérence fuseau horaire & langue',
    description: 'Signaux faibles par nature, pondérés en conséquence - jamais un motif de blocage à eux seuls.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Poids de scoring configurables',
    description: 'Ajustez les seuils et pondérations projet par projet, versionnés pour rester explicables.',
  },
  {
    icon: Webhook,
    title: 'Règles & webhooks',
    description: 'Règles JSON personnalisées (ALLOW/BLOCK/MANUAL_REVIEW) et notifications signées en temps réel.',
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité de bout en bout',
    description: 'Clés API hashées, signature HMAC, anti-rejeu, rate limiting, RBAC, journal d’audit.',
  },
];

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold text-brand-950">GeoLock</span>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-secondary text-sm">
            Se connecter
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Créer un compte
          </Link>
        </nav>
      </header>

      <section className="bg-gradient-to-b from-brand-950 to-slate-900 px-6 py-20 text-center text-white">
        <span className="badge mb-6 bg-white/10 text-brand-100">Vérification de localisation multi-signaux</span>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">GeoLock</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          GeoLock combine plusieurs signaux indépendants (GPS, IP, réseau, fuseau horaire, intégrité de
          l&apos;appareil) pour déterminer la localisation la plus crédible d&apos;un utilisateur et détecter les
          incohérences géographiques - avec un score de confiance et des preuves, jamais une certitude absolue.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary">
            Créer un compte
          </Link>
          <Link href="/login" className="btn-secondary bg-transparent text-white hover:bg-white/10">
            Se connecter
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold">Comment ça marche</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-500">
          Un pipeline de preuves, pas une liste de conditions en cascade.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <step.icon size={24} strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{step.description}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute -right-6 top-4 hidden text-slate-300 lg:block"
                  size={20}
                  strokeWidth={1.5}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold">Ce que la plateforme fait pour vous</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <feature.icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold">Un VPN n&apos;est pas automatiquement une fraude</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-slate-500">
          GeoLock explique les écarts avant de sanctionner. Deux exemples réels de sa logique de décision :
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <span className="text-sm font-semibold">VERIFIED · ACCEPT</span>
            </div>
            <dl className="mt-4 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><dt>GPS</dt><dd>Cotonou, Bénin (18m)</dd></div>
              <div className="flex justify-between"><dt>IP</dt><dd>Pays-Bas</dd></div>
              <div className="flex justify-between"><dt>VPN</dt><dd>Détecté</dd></div>
              <div className="flex justify-between"><dt>Mock GPS</dt><dd>Non détectée</dd></div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              L&apos;IP néerlandaise est expliquée par le VPN détecté - le GPS reste l&apos;autorité. Confiance
              élevée, accès autorisé.
            </p>
          </div>
          <div className="card border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle size={20} />
              <span className="text-sm font-semibold">UNVERIFIED · REJECT</span>
            </div>
            <dl className="mt-4 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><dt>GPS</dt><dd>Bénin (simulé)</dd></div>
              <div className="flex justify-between"><dt>IP</dt><dd>Allemagne</dd></div>
              <div className="flex justify-between"><dt>Fuseau horaire</dt><dd>États-Unis</dd></div>
              <div className="flex justify-between"><dt>Mock GPS</dt><dd>Détectée</dd></div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Localisation simulée + fuseau horaire incohérent + IP non expliquée : trois signaux indépendants se
              contredisent. Confiance quasi nulle, accès refusé.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
        <p>GeoLock - vérification de localisation multi-signaux, jamais une certitude absolue.</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/login" className="hover:text-slate-600">
            Se connecter
          </Link>
          <Link href="/register" className="hover:text-slate-600">
            Créer un compte
          </Link>
        </div>
      </footer>
    </main>
  );
}
