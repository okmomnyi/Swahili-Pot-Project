'use strict';

// Default landing-page content. Each key maps to a section the admin can edit.
// Numbers default to 0 (the design shows "0+"); the admin sets real values.
const SITE_DEFAULTS = {
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

  // The numbers the admin manages. Reused across the page.
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
      'Since 2016, Swahilipot Hub Foundation has been a beacon of hope and opportunity, empowering thousands of young people across East Africa through technology, arts, and entrepreneurship.',
    quote: 'A decade in, we’re just getting started.',
    quoteBody:
      'Our commitment to nurturing the next generation of innovators, artists, and entrepreneurs remains stronger than ever. Together, we’re building a brighter future for East Africa.',
  },

  journey: [
    { year: '2016', title: 'Founded', body: 'Swahilipot Hub Foundation established with a vision to empower coastal youth.' },
    { year: '2018', title: 'First 1,000 Youth Reached', body: 'Expanded programs across multiple departments and communities.' },
    { year: '2020', title: 'Regional Expansion', body: 'Extended impact beyond Mombasa to neighbouring regions.' },
    { year: '2021', title: 'Digital Transformation', body: 'Adapted programs to online platforms during global challenges.' },
    { year: '2026', title: '10 Years Strong', body: 'Celebrating a decade of transformation and continued growth.' },
  ],

  about: {
    eyebrow: 'About Swahilipot Hub Foundation',
    headingLead: 'Helping Each Other Can Make',
    headingHighlight: 'Youth Better',
    body:
      'Volunteering and collaboration offer opportunities to develop new skills and gain real-world experience. Our work includes leadership, communication, project management, and teamwork skills that shape the next generation.',
    points: [
      { title: 'Start Helping Them', body: 'Pairing volunteers about the youth empowerment mission and cause.' },
      { title: 'Build Communities', body: 'Pairing passionate about the charity’s mission and broader cause.' },
    ],
    bullets: [
      'Founded in 2016 — over 6 years of community impact',
      'Empowering youth through Tech, Arts & Entrepreneurship',
      'Supporting companies develop Corporate Social Responsibility',
    ],
    phone: '+254 11 4602690',
    ctaLabel: 'More About Us',
  },

  programs: [
    { name: 'Tech', category: 'Providing resources, mentorship, and workspaces for tech startups and innovators across the Kenyan coast.', status: 'Open recruitment' },
    { name: 'Sanaa', category: 'Promoting creative expression through music, film, dance, and visual arts programs.', status: 'Open recruitment' },
    { name: 'Biashara', category: 'Developing business skills and connecting youth entrepreneurs with funding and market opportunities.', status: 'Open recruitment' },
    { name: 'Case Management', category: 'Supporting youth with personalised guidance and resources to navigate challenges and achieve their goals.', status: 'Ongoing' },
    { name: 'Tourism Innovation Lab', category: 'Developing innovative solutions to transform Mombasa’s tourism sector and create new youth opportunities.', status: 'Ongoing' },
    { name: 'Campus Ambassador', category: 'Connecting university students with Swahilipot Hub to lead initiatives and build company impact.', status: 'Year-long' },
  ],

  newsletter: {
    heading: 'Stay Updated',
    body: 'Subscribe to our newsletter for news, events & impact stories.',
  },

  contact: {
    address: 'Swahili Cultural Centre, Sir Mbarak Hinawy Rd, Old Town, Mombasa, Kenya',
    email: 'info@swahilipothub.co.ke',
    phone: '+254 11 4602690',
    website: 'swahilipothub.co.ke',
    facebook: 'https://facebook.com/swahilipot',
    twitter: 'https://twitter.com/swahilipot',
    instagram: 'https://instagram.com/swahilipot',
    linkedin: 'https://linkedin.com/company/swahilipot',
  },
};

module.exports = { SITE_DEFAULTS };
