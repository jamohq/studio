// Project scaffolds for Jamo Studio

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ts() {
  return new Date().toISOString();
}

interface ScaffoldFile {
  path: string;
  content: object;
}

interface ScaffoldBinaryFile {
  path: string;
  /** URL to fetch the binary content from (e.g. from public dir) */
  fetchUrl: string;
}

export interface ScaffoldResult {
  files: ScaffoldFile[];
  binaryFiles: ScaffoldBinaryFile[];
}

export function createPortfolioScaffold(): ScaffoldResult {
  const now = ts();

  return { files: [
    // -----------------------------------------------------------------------
    // Section: Main
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/_sections/main.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: "Jamolotl's Portfolio" }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'A personal portfolio website for Jamolotl, the friendly axolotl mascot of Jamo Studio. The site showcases projects, skills, and a way to get in touch. The vibe is playful yet professional \u2014 approachable and memorable. A mascot image is provided at assets/jamolotl.png \u2014 use it as the hero avatar and about page photo.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
            { type: 'bulletList', content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Introduce Jamolotl and their work in a memorable way' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Showcase projects with visuals and descriptions' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Provide an easy way for visitors to get in touch' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reflect a playful, creative personality through design' }] }] },
            ] },
          ],
        },
      },
    },

    // -----------------------------------------------------------------------
    // Section: Tech
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/_sections/tech.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Tech Stack' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Framework' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'React with TypeScript, built using Vite for fast development and builds.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Styling' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Tailwind CSS for utility-first styling. Custom color palette inspired by axolotl pink and ocean tones.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deployment' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Static site, deployable to Vercel, Netlify, or GitHub Pages.' }] },
          ],
        },
      },
    },

    // -----------------------------------------------------------------------
    // Section: Brand
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/_sections/brand.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Brand Guidelines' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Colors' }] },
            { type: 'bulletList', content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primary: #E8A0BF (axolotl pink)' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Secondary: #7EC8E3 (ocean blue)' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Accent: #C3F0CA (lily pad green)' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Background: #0F172A (deep ocean dark)' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text: #F1F5F9 (soft white)' }] }] },
            ] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Typography' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Headings: Inter or Nunito (rounded, friendly). Body: Inter. Monospace: JetBrains Mono for code snippets.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Personality' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Playful but clean. Rounded corners, gentle gradients, subtle animations. Think "friendly creature in a professional setting."' }] },
          ],
        },
      },
    },

    // -----------------------------------------------------------------------
    // Section: User Stories
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/_sections/user-stories.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'User Stories' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Visitor' }] },
            { type: 'bulletList', content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a visitor, I want to quickly understand who Jamolotl is and what they do' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a visitor, I want to browse projects with screenshots and descriptions' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a visitor, I want to see skills and technologies at a glance' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a visitor, I want to contact Jamolotl through a simple form or links' }] }] },
            ] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Recruiter / Collaborator' }] },
            { type: 'bulletList', content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a recruiter, I want to see a clear list of skills and past work' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'As a collaborator, I want to find links to GitHub, social profiles, and email' }] }] },
            ] },
          ],
        },
      },
    },

    // -----------------------------------------------------------------------
    // Section: Flow (Excalidraw navigation diagram)
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/_sections/flow.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        elements: [
          // Home page box
          { type: 'rectangle', id: 'flow-home', x: 100, y: 200, width: 160, height: 70, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, roundness: { type: 3 }, seed: 1 },
          { type: 'text', id: 'flow-home-label', x: 140, y: 222, width: 80, height: 26, text: 'Home', fontSize: 20, fontFamily: 6, textAlign: 'center', strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 2 },
          // Projects page box
          { type: 'rectangle', id: 'flow-projects', x: 400, y: 100, width: 160, height: 70, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, roundness: { type: 3 }, seed: 3 },
          { type: 'text', id: 'flow-projects-label', x: 430, y: 122, width: 100, height: 26, text: 'Projects', fontSize: 20, fontFamily: 6, textAlign: 'center', strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 4 },
          // About page box
          { type: 'rectangle', id: 'flow-about', x: 400, y: 300, width: 160, height: 70, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, roundness: { type: 3 }, seed: 5 },
          { type: 'text', id: 'flow-about-label', x: 443, y: 322, width: 80, height: 26, text: 'About', fontSize: 20, fontFamily: 6, textAlign: 'center', strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 6 },
          // Arrow: Home -> Projects
          { type: 'arrow', id: 'flow-arrow-1', x: 260, y: 220, width: 140, height: 85, points: [[0, 0], [140, -85]], strokeColor: '#7EC8E3', strokeWidth: 2, startBinding: { elementId: 'flow-home', focus: 0, gap: 1 }, endBinding: { elementId: 'flow-projects', focus: 0, gap: 1 }, seed: 7 },
          // Arrow: Home -> About
          { type: 'arrow', id: 'flow-arrow-2', x: 260, y: 250, width: 140, height: 85, points: [[0, 0], [140, 85]], strokeColor: '#7EC8E3', strokeWidth: 2, startBinding: { elementId: 'flow-home', focus: 0, gap: 1 }, endBinding: { elementId: 'flow-about', focus: 0, gap: 1 }, seed: 8 },
        ],
        appState: {},
      },
    },

    // -----------------------------------------------------------------------
    // Page: Home
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/home.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        elements: [
          // Nav bar
          { type: 'rectangle', id: 'home-nav', x: 50, y: 30, width: 700, height: 50, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 100 },
          { type: 'text', id: 'home-nav-logo', x: 70, y: 42, width: 100, height: 26, text: 'Jamolotl', fontSize: 18, fontFamily: 6, strokeColor: '#E8A0BF', backgroundColor: 'transparent', seed: 101 },
          { type: 'text', id: 'home-nav-links', x: 520, y: 44, width: 200, height: 22, text: 'Home  Projects  About', fontSize: 14, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 102 },

          // Hero section
          { type: 'rectangle', id: 'home-hero', x: 50, y: 110, width: 700, height: 280, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 103 },
          { type: 'text', id: 'home-hero-greeting', x: 100, y: 140, width: 300, height: 30, text: "Hi, I'm Jamolotl!", fontSize: 28, fontFamily: 6, strokeColor: '#E8A0BF', backgroundColor: 'transparent', seed: 104 },
          { type: 'text', id: 'home-hero-tagline', x: 100, y: 185, width: 400, height: 50, text: 'A creative axolotl who builds\ndelightful digital experiences.', fontSize: 18, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 105 },
          { type: 'text', id: 'home-hero-note', x: 100, y: 260, width: 350, height: 22, text: '[CTA button: "See my work" -> /projects]', fontSize: 13, fontFamily: 6, strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 106 },
          // Avatar — use jamolotl.png from assets/
          { type: 'ellipse', id: 'home-avatar', x: 560, y: 150, width: 150, height: 150, strokeColor: '#E8A0BF', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, seed: 107 },
          { type: 'text', id: 'home-avatar-label', x: 570, y: 210, width: 130, height: 22, text: '[assets/jamolotl.png]', fontSize: 13, fontFamily: 6, textAlign: 'center', strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 108 },

          // Skills section
          { type: 'rectangle', id: 'home-skills', x: 50, y: 420, width: 700, height: 160, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 109 },
          { type: 'text', id: 'home-skills-title', x: 100, y: 440, width: 120, height: 26, text: 'Skills', fontSize: 22, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 110 },
          { type: 'text', id: 'home-skills-list', x: 100, y: 480, width: 500, height: 80, text: '[Grid of skill badges: React, TypeScript,\nGo, Tailwind CSS, gRPC, Excalidraw]', fontSize: 14, fontFamily: 6, strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 111 },
        ],
        appState: {},
      },
    },

    // -----------------------------------------------------------------------
    // Page: Projects
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/projects.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        elements: [
          // Nav bar
          { type: 'rectangle', id: 'proj-nav', x: 50, y: 30, width: 700, height: 50, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 200 },
          { type: 'text', id: 'proj-nav-logo', x: 70, y: 42, width: 100, height: 26, text: 'Jamolotl', fontSize: 18, fontFamily: 6, strokeColor: '#E8A0BF', backgroundColor: 'transparent', seed: 201 },
          { type: 'text', id: 'proj-nav-links', x: 520, y: 44, width: 200, height: 22, text: 'Home  Projects  About', fontSize: 14, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 202 },

          // Page title
          { type: 'text', id: 'proj-title', x: 100, y: 110, width: 200, height: 30, text: 'Projects', fontSize: 28, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 203 },
          { type: 'text', id: 'proj-subtitle', x: 100, y: 148, width: 400, height: 22, text: 'Things I\'ve built, broken, and rebuilt.', fontSize: 15, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 204 },

          // Project card 1
          { type: 'rectangle', id: 'proj-card-1', x: 50, y: 195, width: 340, height: 200, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 205 },
          { type: 'rectangle', id: 'proj-card-1-img', x: 60, y: 205, width: 320, height: 100, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, seed: 206 },
          { type: 'text', id: 'proj-card-1-title', x: 70, y: 318, width: 150, height: 22, text: 'Jamo Studio', fontSize: 16, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 207 },
          { type: 'text', id: 'proj-card-1-desc', x: 70, y: 345, width: 300, height: 22, text: 'Visual-first code generation tool', fontSize: 13, fontFamily: 6, strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 208 },

          // Project card 2
          { type: 'rectangle', id: 'proj-card-2', x: 410, y: 195, width: 340, height: 200, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 209 },
          { type: 'rectangle', id: 'proj-card-2-img', x: 420, y: 205, width: 320, height: 100, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, seed: 210 },
          { type: 'text', id: 'proj-card-2-title', x: 430, y: 318, width: 180, height: 22, text: 'Coral Reef API', fontSize: 16, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 211 },
          { type: 'text', id: 'proj-card-2-desc', x: 430, y: 345, width: 300, height: 22, text: 'REST API for underwater data', fontSize: 13, fontFamily: 6, strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 212 },

          // Project card 3
          { type: 'rectangle', id: 'proj-card-3', x: 50, y: 420, width: 340, height: 200, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 213 },
          { type: 'rectangle', id: 'proj-card-3-img', x: 60, y: 430, width: 320, height: 100, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, seed: 214 },
          { type: 'text', id: 'proj-card-3-title', x: 70, y: 543, width: 180, height: 22, text: 'Bubble Chat', fontSize: 16, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 215 },
          { type: 'text', id: 'proj-card-3-desc', x: 70, y: 570, width: 300, height: 22, text: 'Real-time messaging with WebSockets', fontSize: 13, fontFamily: 6, strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 216 },

          // Annotation
          { type: 'text', id: 'proj-note', x: 100, y: 650, width: 400, height: 22, text: '[Each card links to project detail or GitHub repo]', fontSize: 13, fontFamily: 6, strokeColor: '#C3F0CA', backgroundColor: 'transparent', seed: 217 },
        ],
        appState: {},
      },
    },

    // -----------------------------------------------------------------------
    // Page: About
    // -----------------------------------------------------------------------
    {
      path: '.jamo/creator/about.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        elements: [
          // Nav bar
          { type: 'rectangle', id: 'about-nav', x: 50, y: 30, width: 700, height: 50, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 300 },
          { type: 'text', id: 'about-nav-logo', x: 70, y: 42, width: 100, height: 26, text: 'Jamolotl', fontSize: 18, fontFamily: 6, strokeColor: '#E8A0BF', backgroundColor: 'transparent', seed: 301 },
          { type: 'text', id: 'about-nav-links', x: 520, y: 44, width: 200, height: 22, text: 'Home  Projects  About', fontSize: 14, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 302 },

          // About section
          { type: 'rectangle', id: 'about-section', x: 50, y: 110, width: 700, height: 240, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 303 },
          { type: 'text', id: 'about-title', x: 100, y: 130, width: 200, height: 30, text: 'About Me', fontSize: 28, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 304 },
          { type: 'text', id: 'about-bio', x: 100, y: 175, width: 420, height: 80, text: "I'm Jamolotl, an axolotl who traded\nunderwater caves for code editors.\nI love building tools that make\ncreative work feel effortless.", fontSize: 15, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 305 },
          // Avatar — use jamolotl.png from assets/
          { type: 'ellipse', id: 'about-avatar', x: 580, y: 140, width: 130, height: 130, strokeColor: '#E8A0BF', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, seed: 306 },
          { type: 'text', id: 'about-avatar-label', x: 585, y: 192, width: 120, height: 22, text: '[assets/jamolotl.png]', fontSize: 13, fontFamily: 6, textAlign: 'center', strokeColor: '#7EC8E3', backgroundColor: 'transparent', seed: 307 },

          // Contact section
          { type: 'rectangle', id: 'about-contact', x: 50, y: 380, width: 700, height: 220, strokeColor: '#e0e0e0', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 308 },
          { type: 'text', id: 'about-contact-title', x: 100, y: 400, width: 200, height: 30, text: 'Get in Touch', fontSize: 22, fontFamily: 6, strokeColor: '#e0e0e0', backgroundColor: 'transparent', seed: 309 },
          // Form fields
          { type: 'rectangle', id: 'about-field-name', x: 100, y: 445, width: 280, height: 36, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 310 },
          { type: 'text', id: 'about-field-name-label', x: 112, y: 451, width: 60, height: 22, text: 'Name', fontSize: 13, fontFamily: 6, strokeColor: '#94a3b8', backgroundColor: 'transparent', seed: 311 },
          { type: 'rectangle', id: 'about-field-email', x: 400, y: 445, width: 280, height: 36, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 312 },
          { type: 'text', id: 'about-field-email-label', x: 412, y: 451, width: 60, height: 22, text: 'Email', fontSize: 13, fontFamily: 6, strokeColor: '#94a3b8', backgroundColor: 'transparent', seed: 313 },
          { type: 'rectangle', id: 'about-field-msg', x: 100, y: 495, width: 580, height: 70, strokeColor: '#e0e0e0', backgroundColor: '#1e293b', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 314 },
          { type: 'text', id: 'about-field-msg-label', x: 112, y: 501, width: 80, height: 22, text: 'Message', fontSize: 13, fontFamily: 6, strokeColor: '#94a3b8', backgroundColor: 'transparent', seed: 315 },
          // Submit button
          { type: 'rectangle', id: 'about-submit', x: 100, y: 575, width: 140, height: 40, strokeColor: '#E8A0BF', backgroundColor: '#E8A0BF', fillStyle: 'solid', strokeWidth: 1, roundness: { type: 3 }, seed: 316 },
          { type: 'text', id: 'about-submit-label', x: 133, y: 583, width: 80, height: 22, text: 'Send', fontSize: 16, fontFamily: 6, textAlign: 'center', strokeColor: '#0F172A', backgroundColor: 'transparent', seed: 317 },

          // Social links annotation
          { type: 'text', id: 'about-social', x: 100, y: 630, width: 400, height: 22, text: '[Social icons: GitHub, Twitter/X, LinkedIn, Email]', fontSize: 13, fontFamily: 6, strokeColor: '#C3F0CA', backgroundColor: 'transparent', seed: 318 },
        ],
        appState: {},
      },
    },
  ], binaryFiles: [
    { path: 'assets/jamolotl.png', fetchUrl: '/jamolotl.png' },
  ] };
}

export function createEmptyScaffold(): ScaffoldResult {
  const now = ts();

  return { files: [
    {
      path: '.jamo/creator/_sections/main.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Untitled Project' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Describe your project here.' }] },
          ],
        },
      },
    },
    {
      path: '.jamo/creator/home.json',
      content: {
        version: 1,
        id: uid(),
        createdAt: now,
        updatedAt: now,
        elements: [],
        appState: {},
      },
    },
  ], binaryFiles: [] };
}
