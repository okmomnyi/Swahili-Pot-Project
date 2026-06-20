import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, Users, Star, Rocket, Lightbulb, Building2, Phone, ArrowRight, ArrowDown, CheckCircle2,
  Facebook, Twitter, Instagram, Linkedin, Mail, MapPin, Menu, X, Play, Sparkles,
  Cpu, Palette, Briefcase, HeartHandshake, Plane, GraduationCap, Quote, ShieldCheck,
} from 'lucide-react';
import { getSiteContent, mediaUrl } from '../api/site';
import Logo from '../components/ui/Logo';
import Spinner from '../components/ui/Spinner';
import ChatWidget from '../components/ui/ChatWidget';
import { LesoRibbon, LesoMedallion, LesoField, LesoHanging } from '../components/ui/LesoPattern';
import { SITE_FALLBACK } from '../lib/siteFallback';

const PROGRAM_GRADIENTS = [
  'from-[#1e40af] to-[#3b63d4]',
  'from-[#7c3aed] to-[#a855f7]',
  'from-[#0891b2] to-[#06b6d4]',
  'from-[#ea580c] to-[#f59e0b]',
  'from-[#db2777] to-[#fb7185]',
  'from-[#059669] to-[#34d399]',
];
const PROGRAM_ICONS = [Cpu, Palette, Briefcase, HeartHandshake, Plane, GraduationCap];

// Count-up that fires when scrolled into view (uses rAF timestamps).
function CountUp({ end = 0, duration = 1600, suffix = '+' }) {
  const ref = useRef(null);
  const started = useRef(false);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (typeof requestAnimationFrame === 'undefined') { setVal(end); return; }
      let startTs = null;
      const tick = (ts) => {
        if (startTs === null) startTs = ts;
        const p = Math.min((ts - startTs) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.floor(eased * end));
        if (p < 1) requestAnimationFrame(tick);
        else setVal(end);
      };
      requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') { setVal(end); return undefined; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) run(); }),
      { threshold: 0.3 }
    );
    io.observe(el);
    // Safety net so the figure is never stuck at 0.
    const t = setTimeout(run, 1400);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [end, duration]);

  return (
    <span ref={ref}>
      {val.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el); } }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    // Safety net: ensure content is never stuck hidden.
    const t = setTimeout(() => el.classList.add('in'), 1200);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, dark }) {
  return (
    <div
      className={`group rounded-2xl border p-5 text-center transition-all duration-300 hover:-translate-y-1 ${
        dark
          ? 'border-white/10 bg-white/5 hover:bg-white/10'
          : 'border-[#e2e8f0] bg-white shadow-sm hover:shadow-lg'
      }`}
    >
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${dark ? 'bg-white/10' : 'bg-[#eff4ff]'}`}>
        <Icon size={22} className={dark ? 'text-sea-300' : 'text-[#1e40af]'} />
      </div>
      <p className={`font-display text-3xl font-bold ${dark ? 'text-white' : 'text-[#1e40af]'}`}>
        <CountUp end={Number(value) || 0} />
      </p>
      <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-[#6b7280]'}`}>{label}</p>
    </div>
  );
}

// Turn a pasted video URL into something embeddable: a YouTube/Vimeo iframe, or
// a direct video file (.mp4/.webm/.ogg). Anything else is tried as an iframe.
function toEmbed(url) {
  const u = (url || '').trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { type: 'iframe', src: `https://www.youtube.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { type: 'file', src: u };
  return { type: 'iframe', src: u };
}

function VideoEmbed({ url }) {
  const e = toEmbed(url);
  if (!e) return null;
  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '16 / 9' }}>
      {e.type === 'file' ? (
        <video src={e.src} controls className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <iframe
          src={e.src}
          title="Video"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}
    </div>
  );
}

// A single wave period is 1440 wide; the path repeats twice (2880) so an
// animated translateX of -50% loops seamlessly. Shared by the hero waves.
const WAVE_PATH =
  'M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 C1680,80 1920,0 2160,40 C2400,80 2640,0 2880,40 L2880,120 L0,120 Z';

// Layered Indian-Ocean waves rolling along the foot of the hero.
function HeroWaves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 overflow-hidden">
      <svg className="wave-3 absolute bottom-0 left-0 h-24 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#0e7490" opacity="0.35" />
      </svg>
      <svg className="wave-2 absolute bottom-0 left-0 h-20 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#0891b2" opacity="0.4" />
      </svg>
      <svg className="wave-1 absolute bottom-0 left-0 h-14 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#22d3ee" opacity="0.5" />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [verifyId, setVerifyId] = useState('');

  useEffect(() => {
    getSiteContent()
      .then((res) => setC(res.data.content))
      .catch(() => setC(SITE_FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f8fb]">
        <Spinner />
      </div>
    );
  }

  const content = c || SITE_FALLBACK;
  const { hero, metrics, decade, journey, about, programs, newsletter, contact, partners = [], media = {} } = content;
  const heroImg = media.hero ? mediaUrl('hero') : null;
  const aboutImg = media.about ? mediaUrl('about') : null;

  const navLinks = [
    { href: '#programs', label: 'Programs' },
    { href: '#impact', label: 'Impact' },
    { href: '#about', label: 'About' },
    { href: '#partners', label: 'Partners' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#374151]">
      {/* Kanga (leso) edge — a Swahili-coast welcome ribbon */}
      <LesoRibbon palette="warm" height={10} />

      {/* Nav — the bar itself rests on a leso cloth (field + pindo hem) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md">
        <LesoField palette="warm" tile={52} className="pointer-events-none absolute inset-0 opacity-[0.13]" />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo size={18} to="/" />
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-[#374151] transition-colors hover:text-[#1e40af]">
                {l.label}
              </a>
            ))}
            <Link to="/login" className="rounded-lg bg-lagoon px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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
              <Link to="/login" className="rounded-lg bg-lagoon px-4 py-2 text-center text-sm font-medium text-white">
                Staff Login
              </Link>
            </div>
          </div>
        )}
        {/* Pindo hem — the edge of the cloth */}
        <LesoRibbon palette="warm" height={6} className="absolute inset-x-0 bottom-0" />
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden px-4 pb-28 pt-20 text-white">
        {/* Background — deep ocean sliding into lagoon teal */}
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #0a1654 0%, #11357a 42%, #0e7490 100%)' }} />
        {heroImg && (
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-30 mix-blend-luminosity"
            style={{ backgroundImage: `url(${heroImg})` }}
          />
        )}
        <div className="hero-grid absolute inset-0 -z-10 opacity-60" />
        {/* Floating blobs — teal swell + coral sunset glow */}
        <div className="animate-blob animate-float absolute -left-16 top-10 -z-10 h-72 w-72 bg-[#22d3ee]/25 blur-3xl" />
        <div className="animate-blob animate-float-slow absolute -right-10 bottom-10 -z-10 h-80 w-80 bg-[#f8572b]/20 blur-3xl" />
        {/* Rolling waves at the shoreline */}
        <HeroWaves />
        {/* Leso cloth motifs — a drifting medallion and a hanging kanga */}
        <LesoMedallion palette="cool" size={170} className="animate-float-slow absolute -left-12 top-24 z-0 opacity-40" />
        <LesoHanging palette="cool" width={120} height={300} className="animate-sway absolute right-8 top-0 z-0 hidden opacity-60 lg:block" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sea-300/30 bg-sea-400/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-sea-100 backdrop-blur">
            <Sparkles size={13} /> {hero.badge}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] sm:text-6xl">
            {hero.titleLead}{' '}
            <span className="bg-gradient-to-r from-[#67e8f9] via-[#a5c0ff] to-[#e9c766] bg-clip-text text-transparent">
              {hero.titleHighlight}
            </span>{' '}
            {hero.titleTrail}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">{hero.subtitle}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={hero.primaryHref} className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1e40af] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl">
              {hero.primaryLabel}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a href={hero.secondaryHref} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/15">
              {hero.secondaryLabel}
            </a>
          </div>

          {hero.videoUrl && (
            <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-white/20 shadow-2xl ring-1 ring-white/10">
              <VideoEmbed url={hero.videoUrl} />
            </div>
          )}

          <div className="mx-auto mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[
              [metrics.youthImpacted, 'Youth Impacted'],
              [metrics.projectsLaunched, 'Projects Launched'],
              [metrics.startupsIncubated, 'Startups Incubated'],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="font-display text-2xl font-bold text-white sm:text-4xl">
                  <CountUp end={Number(v) || 0} />
                </p>
                <p className="mt-1 text-xs text-white/70 sm:text-sm">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <a href="#decade" className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-white/70 hover:text-white" aria-label="Scroll down">
          <ArrowDown size={22} className="animate-float" />
        </a>
      </section>

      {/* Decade */}
      <section id="decade" className="bg-[#f8faff] px-4 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <span className="inline-block rounded-full bg-[#eff4ff] px-3 py-1 text-xs font-semibold text-[#1e40af]">
              {decade.badge}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-[#374151] sm:text-4xl">
              {decade.headingLead} <span className="text-[#1e40af]">{decade.headingHighlight}</span> {decade.headingTrail}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[#6b7280] sm:text-base">{decade.body}</p>
          </Reveal>

          <Reveal className="mt-12" delay={100}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={Award} value={metrics.yearsOfImpact} label="Years of Impact" />
              <StatCard icon={Users} value={metrics.youthEmpowered} label="Youth Empowered" />
              <StatCard icon={Star} value={metrics.successStories} label="Success Stories" />
              <StatCard icon={Rocket} value={metrics.projectsLaunched} label="Projects Launched" />
            </div>
          </Reveal>

          <Reveal className="mt-12" delay={150}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1730a0] via-[#1e40af] to-[#0e7490] px-6 py-10 text-center text-white shadow-xl">
              <div className="swahili-weave pointer-events-none absolute inset-0 opacity-30" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-sun-brass" />
              <Quote size={120} className="absolute -left-4 -top-4 text-white/10" />
              <p className="relative font-display text-xl font-semibold sm:text-2xl">{decade.quote}</p>
              <p className="relative mx-auto mt-3 max-w-2xl text-sm text-white/80">{decade.quoteBody}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Journey */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold text-[#374151]">Our Journey</h2>
            <p className="mt-2 text-center text-sm text-[#6b7280]">A decade of milestones on the coast of Kenya.</p>
          </Reveal>
          <ol className="relative mt-12 border-l-2 border-[#dbe4ff] pl-8">
            {journey.map((j, i) => (
              <Reveal key={i} delay={i * 80}>
                <li className="relative mb-9 last:mb-0">
                  <span className="absolute -left-[41px] flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1e40af] to-[#3b63d4] text-xs font-bold text-white shadow-md ring-4 ring-white">
                    {i + 1}
                  </span>
                  <span className="inline-block rounded-full bg-[#eff4ff] px-2 py-0.5 text-xs font-semibold text-[#1e40af]">{j.year}</span>
                  <h3 className="mt-1.5 font-display text-lg font-semibold text-[#374151]">{j.title}</h3>
                  <p className="mt-1 text-sm text-[#6b7280]">{j.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Kanga border divider */}
      <LesoRibbon palette="warm" height={20} className="opacity-90" />

      {/* About */}
      <section id="about" className="relative isolate overflow-hidden bg-[#f8faff] px-4 py-20">
        {/* Leso watermark */}
        <LesoMedallion palette="warm" size={360} className="absolute -right-24 -top-16 -z-10 opacity-[0.07]" />
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div className="relative">
              <div className="overflow-hidden rounded-3xl shadow-xl">
                {about.videoUrl ? (
                  <VideoEmbed url={about.videoUrl} />
                ) : (
                  <>
                    {aboutImg ? (
                      <img src={aboutImg} alt="Swahilipot youth" className="h-72 w-full object-cover" />
                    ) : (
                      <div className="flex h-72 w-full items-center justify-center bg-gradient-to-br from-[#1e40af] to-[#3b63d4]">
                        <Users size={64} className="text-white/80" />
                      </div>
                    )}
                    <button className="pulse-ring absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1e40af] shadow-lg transition-transform hover:scale-105">
                      <Play size={22} className="ml-1" fill="currentColor" />
                    </button>
                  </>
                )}
              </div>
              {/* floating stat badge */}
              <div className="absolute -bottom-6 -right-4 rounded-2xl bg-white px-5 py-3 shadow-lg ring-1 ring-[#e2e8f0]">
                <p className="font-display text-2xl font-bold text-[#1e40af]">
                  <CountUp end={Number(metrics.yearsOfImpact) || 10} />
                </p>
                <p className="text-xs text-[#6b7280]">Years strong</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e40af]">{about.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[#374151]">
              {about.headingLead} <span className="text-[#1e40af]">{about.headingHighlight}</span>
            </h2>
            <p className="mt-3 text-sm text-[#6b7280] sm:text-base">{about.body}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(about.points || []).map((p, i) => (
                <div key={i} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#eff4ff] text-sm font-bold text-[#1e40af]">{i + 1}</div>
                  <p className="font-display text-sm font-semibold text-[#374151]">{p.title}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{p.body}</p>
                </div>
              ))}
            </div>

            <ul className="mt-6 space-y-2">
              {(about.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#16a34a]" /> {b}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#programs" className="rounded-xl bg-[#1e40af] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#1730a0] hover:shadow-md">
                {about.ctaLabel}
              </a>
              {about.phone && (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[#374151]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff4ff]"><Phone size={15} className="text-[#1e40af]" /></span>
                  {about.phone}
                </span>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="relative isolate overflow-hidden px-4 py-20">
        {/* Leso watermark */}
        <LesoMedallion palette="sand" size={300} className="absolute -left-20 bottom-0 -z-10 opacity-[0.08]" />
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-bold text-[#374151] sm:text-4xl">Our Programs</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-[#6b7280] sm:text-base">
              Discover how Swahilipot Hub is nurturing the next generation of innovators, artists, and entrepreneurs.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p, i) => {
              const Icon = PROGRAM_ICONS[i % PROGRAM_ICONS.length];
              const grad = PROGRAM_GRADIENTS[i % PROGRAM_GRADIENTS.length];
              return (
                <Reveal key={i} delay={(i % 3) * 90}>
                  <div className="group h-full overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                    <div className={`relative flex h-28 items-center justify-between overflow-hidden bg-gradient-to-br px-5 ${grad}`}>
                      <span className="font-display text-2xl font-bold text-white">{p.name}</span>
                      <Icon size={40} className="text-white/40 transition-transform duration-300 group-hover:scale-125 group-hover:text-white/60" />
                      <div className="hero-grid absolute inset-0 opacity-40" />
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-[#6b7280]">{p.category}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="inline-block rounded-full bg-[#eff4ff] px-2.5 py-0.5 text-xs font-semibold text-[#1e40af]">{p.status}</span>
                        <ArrowRight size={16} className="text-[#1e40af] transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kanga border divider into the dark band */}
      <LesoRibbon palette="cool" height={20} />

      {/* Impact — dark band */}
      <section id="impact" className="relative isolate overflow-hidden px-4 py-20 text-white">
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #0a1654 0%, #134e6b 60%, #0e7490 100%)' }} />
        <div className="swahili-weave absolute inset-0 -z-10 opacity-25" />
        <div className="animate-blob animate-float-slow absolute -right-16 top-0 -z-10 h-72 w-72 bg-[#22d3ee]/25 blur-3xl" />
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Our Impact</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
              Since our founding, Swahilipot Hub has created measurable change in the lives of youth across East Africa.
            </p>
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard dark icon={Users} value={metrics.youthImpacted} label="Youth Impacted" />
              <StatCard dark icon={Rocket} value={metrics.projectsLaunched} label="Projects Launched" />
              <StatCard dark icon={Lightbulb} value={metrics.startupsIncubated} label="Startups Incubated" />
              <StatCard dark icon={Building2} value={metrics.communityCenters} label="Community Centers" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Partners — marquee */}
      <section id="partners" className="px-4 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-[#374151]">Our Partners</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[#6b7280]">
              We collaborate with organisations that share our vision for youth empowerment.
            </p>
          </Reveal>
          {partners.length === 0 ? (
            <p className="mt-10 text-sm text-[#9ca3af]">Partners coming soon.</p>
          ) : partners.length >= 5 ? (
            <div className="relative mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
              <div className="flex w-max animate-marquee gap-4">
                {[...partners, ...partners].map((p, idx) => (
                  <PartnerCard key={idx} p={p} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {partners.map((p) => <PartnerCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* Verify a document */}
      <section id="verify" className="px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eff4ff]">
            <ShieldCheck className="h-6 w-6 text-[#1e40af]" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#374151]">Verify a Document</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6b7280]">
            Have you received a document from Swahilipot Hub Foundation? Enter the Document ID from its footer
            to confirm it is authentic.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (verifyId.trim()) navigate(`/verify/${verifyId.trim()}`);
            }}
            className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value)}
              placeholder="e.g. SPH-2026-ATT-A7F3K9"
              className="flex-1 rounded-lg border border-[#d1d5db] px-3 py-2.5 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#1e40af] px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-[#1730a0]"
            >
              Verify <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Newsletter */}
      <section className="relative isolate overflow-hidden px-4 py-14 text-white">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1730a0] via-[#155e75] to-[#0e7490]" />
        <div className="swahili-weave absolute inset-0 -z-10 opacity-20" />
        <div className="animate-blob absolute -left-10 -top-10 -z-10 h-48 w-48 bg-[#22d3ee]/20 blur-2xl" />
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-5 md:flex-row">
          <div>
            <h3 className="font-display text-2xl font-bold">{newsletter.heading}</h3>
            <p className="mt-1 text-sm text-white/80">{newsletter.body}</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex w-full max-w-md items-center gap-2">
            <input
              type="email"
              required
              placeholder="Enter your email address"
              className="h-12 flex-1 rounded-xl border-0 px-4 text-sm text-[#374151] shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
            />
            <button type="submit" className="h-12 shrink-0 rounded-xl bg-white px-6 text-sm font-semibold text-[#1e40af] shadow-sm transition-all hover:-translate-y-0.5">
              {subscribed ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>

      {/* Kanga ribbon closing the page */}
      <LesoRibbon palette="warm" height={16} />

      {/* Footer */}
      <footer className="relative bg-[#0a1654] px-4 py-14 text-white/80">
        <div className="swahili-weave pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link to="/" aria-label="SwahiliPot Hub Foundation — home" className="inline-block w-fit rounded-lg bg-white px-2.5 py-2 transition-transform hover:scale-[1.03]"><Logo size={16} /></Link>
            <p className="mt-4 text-sm text-white/70">
              Empowering youth through technology, arts, and entrepreneurship across East Africa.
            </p>
            <div className="mt-5 flex gap-2">
              {[['facebook', Facebook], ['twitter', Twitter], ['instagram', Instagram], ['linkedin', Linkedin]].map(([k, Ic]) =>
                contact[k] ? (
                  <a key={k} href={contact[k]} aria-label={k} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                    <Ic size={16} />
                  </a>
                ) : null
              )}
            </div>
          </div>
          <FooterCol title="Programs" items={programs.slice(0, 5).map((p) => p.name)} />
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
        <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Swahilipot Hub Foundation. Empowering youth through technology, arts &amp; impact.
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}

function PartnerCard({ p }) {
  const inner = p.logo ? (
    <img src={p.logo} alt={p.name} className="max-h-12 max-w-full object-contain grayscale transition-all duration-300 group-hover:grayscale-0" loading="lazy" />
  ) : (
    <span className="text-sm font-medium text-[#6b7280]">{p.name}</span>
  );
  return (
    <div className="group flex h-24 w-44 shrink-0 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white p-4 transition-all hover:-translate-y-1 hover:shadow-md">
      {p.website ? (
        <a href={p.website} target="_blank" rel="noreferrer" title={p.name} className="flex h-full w-full items-center justify-center">{inner}</a>
      ) : (
        inner
      )}
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="font-display font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it, i) => <li key={i} className="hover:text-white">{it}</li>)}
      </ul>
    </div>
  );
}
