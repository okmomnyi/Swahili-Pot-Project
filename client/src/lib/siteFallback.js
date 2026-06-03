// Client-side fallback so the landing page still renders if the content
// API is briefly unreachable. The server is the source of truth.
export const SITE_FALLBACK = {
  hero: {
    badge: 'Empowering East African Youth',
    titleLead: 'Building a',
    titleHighlight: 'Brighter Future',
    titleTrail: 'For Our Youth',
    subtitle:
      'Swahilipot Hub Foundation nurtures youth talent through technology, arts, and entrepreneurship in the heart of East Africa.',
    primaryLabel: 'Discover Programs',
    primaryHref: '#programs',
    secondaryLabel: 'Our Story',
    secondaryHref: '#about',
  },
  metrics: {
    youthImpacted: 0,
    projectsLaunched: 0,
    startupsIncubated: 0,
    communityCenters: 0,
    yearsOfImpact: 0,
    youthEmpowered: 0,
    successStories: 0,
  },
  decade: {
    badge: 'A Decade of Excellence',
    headingLead: 'Celebrating',
    headingHighlight: '10 Years',
    headingTrail: 'of Transformation',
    body:
      'Since 2016, Swahilipot Hub Foundation has empowered thousands of young people across East Africa through technology, arts, and entrepreneurship.',
    quote: 'A decade in, we’re just getting started.',
    quoteBody:
      'Our commitment to nurturing the next generation of innovators, artists, and entrepreneurs remains stronger than ever.',
  },
  journey: [
    { year: '2016', title: 'Founded', body: 'Established with a vision to empower coastal youth.' },
    { year: '2026', title: '10 Years Strong', body: 'Celebrating a decade of transformation and growth.' },
  ],
  about: {
    eyebrow: 'About Swahilipot Hub Foundation',
    headingLead: 'Helping Each Other Can Make',
    headingHighlight: 'Youth Better',
    body:
      'Volunteering and collaboration offer opportunities to develop new skills and gain real-world experience.',
    points: [],
    bullets: ['Founded in 2016', 'Tech, Arts & Entrepreneurship'],
    phone: '+254 11 4602690',
    ctaLabel: 'More About Us',
  },
  programs: [
    { name: 'Tech', category: 'Resources, mentorship, and workspaces for tech startups.', status: 'Open recruitment' },
    { name: 'Sanaa', category: 'Creative expression through music, film, and the arts.', status: 'Open recruitment' },
    { name: 'Biashara', category: 'Business skills and entrepreneurship support.', status: 'Open recruitment' },
  ],
  newsletter: { heading: 'Stay Updated', body: 'Subscribe for news, events & impact stories.' },
  contact: {
    address: 'Swahili Cultural Centre, Sir Mbarak Hinawy Rd, Old Town, Mombasa, Kenya',
    email: 'info@swahilipothub.co.ke',
    phone: '+254 11 4602690',
    website: 'swahilipothub.co.ke',
  },
  partners: [],
};
