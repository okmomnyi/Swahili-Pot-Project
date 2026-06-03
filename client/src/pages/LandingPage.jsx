import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Users, Star, Rocket, Lightbulb, Building2, Phone, ArrowRight, CheckCircle2,
  Facebook, Twitter, Instagram, Linkedin, Mail, MapPin, Menu, X,
} from 'lucide-react';
import { getSiteContent } from '../api/site';
import Logo from '../components/ui/Logo';
import Spinner from '../components/ui/Spinner';
import { SITE_FALLBACK } from '../lib/siteFallback';

function fmt(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString('en-US')}+`;
}

function StatPill({ value, label }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl font-bold text-white sm:text-3xl">{fmt(value)}</p>
      <p className="mt-1 text-xs text-white/70 sm:text-sm">{label}</p>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#eff4ff]">
        <Icon size={20} className="text-[#1e40af]" />
      </div>
      <p className="font-display text-2xl font-bold text-[#1e40af]">{fmt(value)}</p>
      <p className="mt-1 text-sm text-[#6b7280]">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    getSiteContent()
      .then((res) => setC(res.data.content))
      .catch(() => setC(SITE_FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8faff]">
        <Spinner />
      </div>
    );
  }

  const content = c || SITE_FALLBACK;
  const { hero, metrics, decade, journey, about, programs, newsletter, contact, partners = [] } = content;

  const navLinks = [
    { href: '#programs', label: 'Programs' },
    { href: '#impact', label: 'Impact' },
    { href: '#about', label: 'About' },
    { href: '#partners', label: 'Partners' },
  ];

  return (
    <div className="min-h-screen bg-white text-[#374151]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#e2e8f0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo size={18} />
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-[#374151] hover:text-[#1e40af]">
                {l.label}
              </a>
            ))}
            <Link to="/login" className="rounded-lg bg-[#1e40af] px-4 py-2 text-sm font-medium text-white hover:bg-[#1730a0]">
              Staff Login
            </Link>
          </nav>
          <button className="md:hidden" onClick={() => setMenuOpen((m) => !m)} aria-label="Menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[#e2e8f0] bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-[#374151]">
                  {l.label}
                </a>
              ))}
              <Link to="/login" className="rounded-lg bg-[#1e40af] px-4 py-2 text-center text-sm font-medium text-white">
                Staff Login
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-20 text-white"
        style={{ background: 'linear-gradient(135deg, #0f1e6b 0%, #1730a0 55%, #1e40af 100%)' }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-wide text-white/90">
            {hero.badge}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            {hero.titleLead} <span className="text-[#7da2ff]">{hero.titleHighlight}</span> {hero.titleTrail}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={hero.primaryHref} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#1e40af] hover:bg-white/90">
              {hero.primaryLabel} <ArrowRight size={16} />
            </a>
            <a href={hero.secondaryHref} className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              {hero.secondaryLabel}
            </a>
          </div>
          <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-8">
            <StatPill value={metrics.youthImpacted} label="Youth Impacted" />
            <StatPill value={metrics.projectsLaunched} label="Projects Launched" />
            <StatPill value={metrics.startupsIncubated} label="Startups Incubated" />
          </div>
        </div>
      </section>

      {/* Decade */}
      <section className="bg-[#f8faff] px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <span className="inline-block rounded-full bg-[#eff4ff] px-3 py-1 text-xs font-medium text-[#1e40af]">
            {decade.badge}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-[#374151]">
            {decade.headingLead} <span className="text-[#1e40af]">{decade.headingHighlight}</span> {decade.headingTrail}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#6b7280]">{decade.body}</p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={Award} value={metrics.yearsOfImpact} label="Years of Impact" />
            <StatCard icon={Users} value={metrics.youthEmpowered} label="Youth Empowered" />
            <StatCard icon={Star} value={metrics.successStories} label="Success Stories" />
            <StatCard icon={Rocket} value={metrics.projectsLaunched} label="Projects Launched" />
          </div>

          <div className="mt-10 rounded-2xl bg-[#1e40af] px-6 py-8 text-center text-white">
            <p className="font-display text-xl font-semibold">&ldquo;{decade.quote}&rdquo;</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80">{decade.quoteBody}</p>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-2xl font-bold text-[#374151]">Our Journey</h2>
          <ol className="relative mt-10 border-l-2 border-[#e2e8f0] pl-8">
            {journey.map((j, i) => (
              <li key={i} className="relative mb-8 last:mb-0">
                <span className="absolute -left-[41px] flex h-7 w-7 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-xs font-medium text-[#1e40af]">{j.year}</p>
                <h3 className="font-display text-base font-semibold text-[#374151]">{j.title}</h3>
                <p className="mt-1 text-sm text-[#6b7280]">{j.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-[#f8faff] px-4 py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#3b63d4] p-10 text-center text-white shadow-sm">
            <Users size={48} className="mx-auto opacity-80" />
            <p className="mt-4 font-display text-lg font-semibold">Empowering coastal youth since 2016</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e40af]">{about.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#374151]">
              {about.headingLead} <span className="text-[#1e40af]">{about.headingHighlight}</span>
            </h2>
            <p className="mt-3 text-sm text-[#6b7280]">{about.body}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(about.points || []).map((p, i) => (
                <div key={i}>
                  <p className="font-display text-sm font-semibold text-[#374151]">{p.title}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{p.body}</p>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-2">
              {(about.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#16a34a]" /> {b}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a href="#programs" className="rounded-lg bg-[#1e40af] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1730a0]">
                {about.ctaLabel}
              </a>
              {about.phone && (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[#374151]">
                  <Phone size={16} className="text-[#1e40af]" /> {about.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-2xl font-bold text-[#374151]">Our Programs</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-[#6b7280]">
            Discover how Swahilipot Hub is nurturing the next generation of innovators, artists, and entrepreneurs.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#1e40af] to-[#3b63d4]">
                  <span className="font-display text-xl font-bold text-white">{p.name}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-[#6b7280]">{p.category}</p>
                  <span className="mt-3 inline-block rounded-full bg-[#eff4ff] px-2.5 py-0.5 text-xs font-medium text-[#1e40af]">
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="bg-[#f8faff] px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-2xl font-bold text-[#374151]">Our Impact</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#6b7280]">
            Since our founding, Swahilipot Hub has created measurable change in the lives of youth across East Africa.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={Users} value={metrics.youthImpacted} label="Youth Impacted" />
            <StatCard icon={Rocket} value={metrics.projectsLaunched} label="Projects Launched" />
            <StatCard icon={Lightbulb} value={metrics.startupsIncubated} label="Startups Incubated" />
            <StatCard icon={Building2} value={metrics.communityCenters} label="Community Centers" />
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-2xl font-bold text-[#374151]">Our Partners</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#6b7280]">
            We collaborate with organisations that share our vision for youth empowerment.
          </p>
          {partners.length === 0 ? (
            <p className="mt-8 text-sm text-[#9ca3af]">Partners coming soon.</p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {partners.map((p) => {
                const inner = p.logo ? (
                  <img src={p.logo} alt={p.name} className="max-h-12 max-w-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-sm font-medium text-[#6b7280]">{p.name}</span>
                );
                return (
                  <div key={p.id} className="flex h-24 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white p-4">
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noreferrer" title={p.name} className="flex h-full w-full items-center justify-center">
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-[#1e40af] px-4 py-12 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h3 className="font-display text-xl font-bold">{newsletter.heading}</h3>
            <p className="mt-1 text-sm text-white/80">{newsletter.body}</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}
            className="flex w-full max-w-md items-center gap-2"
          >
            <input
              type="email"
              required
              placeholder="Enter your email address"
              className="h-11 flex-1 rounded-lg border-0 px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button type="submit" className="h-11 shrink-0 rounded-lg bg-white px-5 text-sm font-semibold text-[#1e40af] hover:bg-white/90">
              {subscribed ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1e6b] px-4 py-12 text-white/80">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="rounded bg-white px-2 py-1.5 w-fit"><Logo size={16} /></div>
            <p className="mt-3 text-sm text-white/70">
              Empowering youth through technology, arts, and entrepreneurship across East Africa.
            </p>
            <div className="mt-4 flex gap-3">
              {contact.facebook && <a href={contact.facebook} aria-label="Facebook"><Facebook size={18} /></a>}
              {contact.twitter && <a href={contact.twitter} aria-label="Twitter"><Twitter size={18} /></a>}
              {contact.instagram && <a href={contact.instagram} aria-label="Instagram"><Instagram size={18} /></a>}
              {contact.linkedin && <a href={contact.linkedin} aria-label="LinkedIn"><Linkedin size={18} /></a>}
            </div>
          </div>
          <div>
            <p className="font-display font-semibold text-white">Programs</p>
            <ul className="mt-3 space-y-2 text-sm">
              {programs.slice(0, 5).map((p, i) => <li key={i}>{p.name}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-display font-semibold text-white">Quick Links</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white">About Us</a></li>
              <li><a href="#programs" className="hover:text-white">Programs</a></li>
              <li><a href="#impact" className="hover:text-white">Impact</a></li>
              <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-display font-semibold text-white">Contact Us</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0" /> {contact.address}</li>
              {contact.email && <li className="flex items-center gap-2"><Mail size={15} /> {contact.email}</li>}
              {contact.phone && <li className="flex items-center gap-2"><Phone size={15} /> {contact.phone}</li>}
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Swahilipot Hub Foundation. Empowering youth through technology, arts &amp; impact.
        </div>
      </footer>
    </div>
  );
}
