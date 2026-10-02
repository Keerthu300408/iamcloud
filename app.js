const ACCOUNT_KEY = 'iamcloud.account';
const PROJECTS_KEY = 'iamcloud.projects';
const DEMO_OTP = '123456';

const authScreen = document.querySelector('#auth-screen');
const authCard = document.querySelector('#auth-card');
const appScreen = document.querySelector('#app-screen');
const appContent = document.querySelector('#app-content');
const modalLayer = document.querySelector('#modal-layer');
const toastRegion = document.querySelector('#toast-region');

const state = {
  authMode: 'login',
  authIntent: 'signup',
  pendingAccount: null,
  user: null,
  projects: [],
  activeProjectId: null,
  activeFile: null,
  route: 'commerce',
  selectedTemplate: 'starter',
  savedCode: '',
  toastTimer: null,
  serverStorage: false
};

const templates = {
  starter: { title: 'Starter site', description: 'A clean responsive page to make your own.', badge: 'Good first project' },
  storefront: { title: 'Storefront', description: 'A product-led storefront starter for your shop.', badge: 'Commerce' },
  portfolio: { title: 'Portfolio', description: 'A polished home for your work and story.', badge: 'Personal' },
  launch: { title: 'Product launch', description: 'A focused landing page for a new idea.', badge: 'Business' },
  blank: { title: 'Blank project', description: 'Start with an empty HTML, CSS, and JS setup.', badge: 'From scratch' }
};

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast('This browser could not save the workspace locally.', true);
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#${name}"></use></svg>`;
}

function currentAccount() {
  return readStorage(ACCOUNT_KEY, null);
}

function renderAuth(mode = 'login', message = '', success = false) {
  state.authMode = mode;
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  const isOtp = mode === 'otp';
  const title = isSignup ? 'Create your account' : isReset ? 'Reset your password' : isOtp ? 'Check your phone' : 'Welcome back';
  const subtitle = isSignup
    ? 'Start a workspace for the things you want to build.'
    : isReset
      ? 'We’ll verify your phone before you choose a new password.'
      : isOtp
        ? `Enter the six-digit code for ${escapeHTML(state.pendingAccount?.phone || 'your phone')}.`
        : 'Sign in and pick up where your ideas left off.';

  let fields = '';
  if (isOtp) {
    fields = `<div class="field"><label for="otp-code">Verification code</label><input class="otp-input" id="otp-code" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>${state.authIntent === 'reset' ? '<div class="field"><label for="new-password">New password</label><input id="new-password" name="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div>' : ''}`;
  } else if (isReset) {
    fields = '<div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+1 555 000 0000" required></div>';
  } else {
    fields = `<div class="field"><label for="username">${isSignup ? 'Username' : 'Username or email'}</label><input id="username" name="username" autocomplete="username" placeholder="${isSignup ? 'Choose a username' : 'you@example.com'}" required></div>${isSignup ? '<div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+1 555 000 0000" required></div>' : ''}<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'At least 8 characters' : 'Enter your password'}" ${isSignup ? 'minlength="8"' : ''} required></div>${!isSignup ? '<div class="form-options"><label class="remember-choice"><input type="checkbox" name="remember"> Keep me signed in</label><button class="inline-link" type="button" data-action="forgot">Forgot password?</button></div>' : ''}`;
  }

  const submitLabel = isSignup ? 'Continue with phone' : isReset ? 'Send verification code' : isOtp ? (state.authIntent === 'reset' ? 'Update password' : 'Verify & create account') : 'Sign in';
  const providerButtons = !isOtp && !isReset
    ? `<div class="auth-divider">or continue with</div><div class="social-buttons"><button class="social-button" type="button" data-provider="Google">${icon('google')}Continue with Google</button><button class="social-button" type="button" data-provider="Apple">${icon('apple')}Continue with Apple</button></div>`
    : '';
  const switchArea = isOtp || isReset
    ? `<p class="auth-switch"><button type="button" class="inline-link" data-action="back">${isOtp ? 'Back' : 'Back to sign in'}</button></p>`
    : `<p class="auth-switch">${isSignup ? 'Already have an account?' : 'New to iamcloud?'} <button class="inline-link" type="button" data-action="${isSignup ? 'login' : 'signup'}">${isSignup ? 'Sign in' : 'Create an account'}</button></p>`;
  const demoNote = isOtp
    ? `Demo verification code: <strong>${DEMO_OTP}</strong>. No SMS is sent from this frontend.`
    : 'Client-side demo: account details are stored in this browser. Connect an authentication service before production use.';

  authCard.innerHTML = `<h2 class="auth-title">${title}</h2><p class="auth-description">${subtitle}</p><form class="auth-form" id="auth-form" novalidate>${fields}<button class="button-primary" type="submit">${submitLabel}${icon('check')}</button><p class="form-message ${success ? 'is-success' : ''}" role="status">${escapeHTML(message)}</p></form>${providerButtons}${switchArea}<p class="demo-callout">${demoNote}</p>`;
  authCard.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
  authCard.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAuthAction(button.dataset.action)));
  authCard.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => startSocialDemo(button.dataset.provider)));
}

function handleAuthAction(action) {
  if (action === 'forgot') {
    state.authIntent = 'reset';
    renderAuth('reset');
  } else if (action === 'back') {
    if (state.authMode === 'otp' && state.authIntent === 'reset') renderAuth('reset');
    else renderAuth('login');
  } else {
    renderAuth(action);
  }
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const value = key => String(formData.get(key) || '').trim();
  const fail = message => renderAuth(state.authMode, message);

  if (state.authMode === 'login') {
    const account = currentAccount();
    const identifier = value('username').toLowerCase();
    const matchesUser = account && [account.username.toLowerCase(), account.email.toLowerCase()].includes(identifier);
    if (!matchesUser || account.password !== value('password')) {
      fail('We couldn’t match those details to an account in this browser.');
      return;
    }
    enterWorkspace(account);
    return;
  }

  if (state.authMode === 'signup') {
    const username = value('username');
    const phone = value('phone');
    const password = value('password');
    if (username.length < 3) { fail('Choose a username with at least 3 characters.'); return; }
    if (phone.replace(/\D/g, '').length < 6) { fail('Enter a phone number with at least 6 digits.'); return; }
    if (password.length < 8) { fail('Use a password with at least 8 characters.'); return; }
    const existing = currentAccount();
    if (existing?.username.toLowerCase() === username.toLowerCase()) { fail('That username is already registered in this browser.'); return; }
    state.pendingAccount = { username, phone, password, email: `${username}@example.com` };
    state.authIntent = 'signup';
    renderAuth('otp');
    return;
  }

  if (state.authMode === 'reset') {
    const account = currentAccount();
    if (!account) { fail('No account exists in this browser yet. Create one first.'); return; }
    if (account.phone.replace(/\D/g, '') !== value('phone').replace(/\D/g, '')) { fail('That phone number does not match the saved account.'); return; }
    state.pendingAccount = { ...account };
    state.authIntent = 'reset';
    renderAuth('otp');
    return;
  }

  if (value('otp') !== DEMO_OTP) { fail(`That code is not correct. Use ${DEMO_OTP} in this demo.`); return; }
  if (state.authIntent === 'reset') {
    const password = value('newPassword');
    if (password.length < 8) { fail('Use a password with at least 8 characters.'); return; }
    state.pendingAccount.password = password;
    writeStorage(ACCOUNT_KEY, state.pendingAccount);
    state.pendingAccount = null;
    renderAuth('login', 'Password updated. Sign in with your new password.', true);
    return;
  }

  const account = state.pendingAccount;
  writeStorage(ACCOUNT_KEY, account);
  state.pendingAccount = null;
  enterWorkspace(account);
}

function startSocialDemo(provider) {
  const username = `${provider.toLowerCase()}-preview`;
  let account = currentAccount();
  if (!account) {
    account = { username, email: `${username}@example.com`, phone: '', password: '', provider };
    writeStorage(ACCOUNT_KEY, account);
  }
  enterWorkspace(account);
  showToast(`${provider} preview opened. Connect ${provider} OAuth for real sign-in.`);
}

async function enterWorkspace(account) {
  state.user = account;
  state.projects = readStorage(PROJECTS_KEY, []);
  state.route = 'commerce';
  state.activeProjectId = null;
  document.querySelector('#workspace-name').textContent = `${account.username}'s workspace`;
  document.querySelector('#workspace-avatar').textContent = account.username.slice(0, 1).toUpperCase();
  document.querySelector('#user-avatar').textContent = account.username.slice(0, 1).toUpperCase();
  document.querySelector('#topbar-avatar').textContent = account.username.slice(0, 1).toUpperCase();
  document.querySelector('#user-label').textContent = account.username;
  authScreen.classList.add('is-hidden');
  appScreen.classList.remove('is-hidden');
  renderRoute();
  await loadWorkspaceProjects();
  if (state.user === account) renderRoute();
}

async function loadWorkspaceProjects() {
  const localProjects = readStorage(PROJECTS_KEY, []);
  if (location.protocol === 'file:') return;
  try {
    const response = await fetch(`/api/projects?workspace=${encodeURIComponent(state.user.username)}`);
    if (!response.ok) throw new Error('Project server returned an error.');
    const payload = await response.json();
    state.serverStorage = true;
    if (payload.projects.length) state.projects = payload.projects;
    else if (localProjects.length) {
      state.projects = localProjects;
      await persistProjects();
    } else state.projects = [];
    writeStorage(PROJECTS_KEY, state.projects);
  } catch {
    state.serverStorage = false;
    state.projects = localProjects;
    showToast('Project server unavailable. Projects will stay in this browser until it reconnects.', true);
  }
}

async function persistProjects() {
  writeStorage(PROJECTS_KEY, state.projects);
  if (!state.user || location.protocol === 'file:') return false;
  try {
    const response = await fetch(`/api/projects?workspace=${encodeURIComponent(state.user.username)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.projects)
    });
    if (!response.ok) throw new Error('Project server rejected the save.');
    state.serverStorage = true;
    return true;
  } catch {
    state.serverStorage = false;
    showToast('Could not reach the project server. Changes are saved in this browser only.', true);
    return false;
  }
}

function renderRoute() {
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('is-active', button.dataset.route === state.route));
  const routeLabels = { commerce: 'Commerce', availability: 'Availability', projects: 'Projects', deployments: 'Deployments', settings: 'Settings', editor: 'Project editor' };
  document.querySelector('#breadcrumb-current').textContent = routeLabels[state.route] || 'Workspace';
  document.querySelector('#sidebar').classList.remove('is-open');
  if (state.route === 'editor') renderEditor();
  else if (state.route === 'commerce') renderCommerce();
  else if (state.route === 'availability') renderAvailability();
  else if (state.route === 'deployments') renderDeployments();
  else if (state.route === 'settings') renderSettings();
  else renderProjects();
}

const availabilityFeatures = [
  { icon: 'globe', title: 'Multi-zone redundancy', detail: 'Run stateless application replicas across independent availability zones so one zone can fail without taking the storefront offline.' },
  { icon: 'settings', title: 'Load balancing & autoscaling', detail: 'Distribute requests across healthy instances and add capacity automatically when shopping traffic spikes.' },
  { icon: 'check', title: 'Health checks & failover', detail: 'Probe storefront, catalog, and checkout health; route around unhealthy instances and regions.' },
  { icon: 'cloud', title: 'Replicated data & recovery', detail: 'Use database replicas, encrypted backups, point-in-time recovery, and tested restore procedures.' },
  { icon: 'globe', title: 'Edge delivery & protection', detail: 'Cache static assets close to shoppers and place TLS, WAF rules, and rate limits at the edge.' },
  { icon: 'rocket', title: 'Monitoring & operations', detail: 'Track service-level objectives, alert on checkout failures, and rehearse incident response.' }
];

function renderCommerce() {
  appContent.innerHTML = `<section class="commerce-page"><header class="page-heading"><div><p class="eyebrow commerce-eyebrow">STORE OPERATIONS</p><h1>Commerce overview</h1><p>Storefront, catalog, and checkout in one resilient cloud workspace.</p></div><button class="button-primary" data-action="new-store">${icon('plus')}Create a storefront</button></header><section class="commerce-notice"><span class="commerce-health-mark">${icon('check')}</span><div><strong>High availability, by design</strong><p>Reference architecture · Example targets only · No live cloud resources are connected</p></div><button class="inline-link" data-route="availability">Explore availability</button></section><section class="commerce-stat-grid" aria-label="Example store metrics"><article class="commerce-stat"><span>Orders today</span><strong>1,284</strong><small>Sample commerce data</small></article><article class="commerce-stat"><span>Checkout success</span><strong>99.96%</strong><small>Illustrative service objective</small></article><article class="commerce-stat"><span>Availability objective</span><strong>99.99%</strong><small>Example target, not a measured SLA</small></article></section><div class="commerce-section-head"><div><p class="eyebrow commerce-eyebrow">RESILIENCE LAYERS</p><h2>What high availability includes</h2></div><button class="inline-link" data-route="availability">View architecture details</button></div><section class="ha-feature-grid">${availabilityFeatures.map(feature => `<article class="ha-feature"><span class="ha-icon">${icon(feature.icon)}</span><h3>${feature.title}</h3><p>${feature.detail}</p></article>`).join('')}</section><footer class="commerce-footnote">This frontend shows a reference design. Uptime figures are examples, not live monitoring or a service guarantee.</footer></section>`;
  appContent.querySelector('[data-action="new-store"]').addEventListener('click', () => openProjectDialog('storefront'));
  appContent.querySelectorAll('[data-route="availability"]').forEach(button => button.addEventListener('click', () => { state.route = 'availability'; renderRoute(); }));
}

function renderAvailability() {
  const layers = [
    ['01', 'Edge & protection', 'CDN caching, TLS termination, WAF rules, and rate limits absorb common traffic spikes and abusive requests.'],
    ['02', 'Regional traffic routing', 'Health-aware DNS and load balancers send shoppers only to healthy application pools.'],
    ['03', 'Resilient commerce services', 'Keep storefront and catalog services stateless; queue order and notification work so a slow dependency does not block checkout.'],
    ['04', 'Durable data', 'Replicate transactional data across zones, isolate backups, and regularly test point-in-time restore and regional recovery.'],
    ['05', 'Operations & recovery', 'Define service objectives, monitor real user checkout paths, alert responders, and practice failover runbooks.']
  ];
  appContent.innerHTML = `<section class="availability-page"><header class="page-heading"><div><p class="eyebrow commerce-eyebrow">REFERENCE ARCHITECTURE</p><h1>Availability, layer by layer</h1><p>High availability comes from removing single points of failure and rehearsing recovery.</p></div><span class="reference-badge">DEMO DESIGN</span></header><section class="availability-callout"><span class="commerce-health-mark">${icon('check')}</span><div><strong>Designed for a 99.99% availability objective</strong><p>This is an example target for planning, not a live measurement or provider SLA.</p></div></section><div class="architecture-list">${layers.map(([number, title, detail]) => `<article class="architecture-row"><span class="architecture-number">${number}</span><div><h2>${title}</h2><p>${detail}</p></div></article>`).join('')}</div><div class="commerce-section-head availability-feature-heading"><div><p class="eyebrow commerce-eyebrow">CORE CAPABILITIES</p><h2>What the platform needs</h2></div></div><section class="ha-feature-grid">${availabilityFeatures.map(feature => `<article class="ha-feature"><span class="ha-icon">${icon(feature.icon)}</span><h3>${feature.title}</h3><p>${feature.detail}</p></article>`).join('')}</section><footer class="commerce-footnote">Production availability requires multi-zone cloud resources, alerting, backup policies, and operational ownership. This client-only demo does not provision them.</footer><button class="button-secondary back-commerce" data-route="commerce">Back to commerce overview</button></section>`;
  appContent.querySelector('[data-route="commerce"]').addEventListener('click', () => { state.route = 'commerce'; renderRoute(); });
}

function renderProjects() {
  const projectsMarkup = state.projects.length
    ? `<div class="project-grid">${state.projects.map(project => `<article class="project-card"><div class="project-card-top"><span class="project-monogram">${escapeHTML(project.name.slice(0, 1).toUpperCase())}</span><span class="project-status ${project.status === 'Live' ? 'is-live' : ''}"><i></i>${escapeHTML(project.status)}</span></div><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.domain)}</p><div class="project-card-footer"><span>${escapeHTML(project.updated || 'Created just now')}</span><button data-open-project="${escapeHTML(project.id)}">Open project ${icon('check')}</button></div></article>`).join('')}</div>`
    : `<section class="project-empty"><div class="empty-inner"><span class="empty-flower"><svg><use href="#flower"></use></svg></span><h2>Your cloud is ready</h2><p>Create a project, start with a template, and shape it in your own code workspace.</p><button class="button-primary" data-action="new-project">${icon('plus')}Create your first project</button></div></section>`;
  appContent.innerHTML = `<section class="page-heading"><div><h1>Your projects</h1><p>A little room for every idea you want to put online.</p></div><button class="button-primary" data-action="new-project">${icon('plus')}New project</button></section>${state.projects.length ? '<h2 class="section-title">Recent projects</h2>' : ''}${projectsMarkup}`;
  appContent.querySelectorAll('[data-action="new-project"]').forEach(button => button.addEventListener('click', openProjectDialog));
  appContent.querySelectorAll('[data-open-project]').forEach(button => button.addEventListener('click', () => openProject(button.dataset.openProject)));
}

function openProjectDialog(defaultTemplate = 'starter') {
  state.selectedTemplate = defaultTemplate;
  modalLayer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-heading"><div><h2 id="dialog-title">Create a project</h2><p>Choose a starting point. You can change every file in the editor.</p></div><button class="dialog-close" data-close aria-label="Close">${icon('close')}</button></div><form id="project-form"><div class="field"><label for="project-name">Project name</label><input id="project-name" name="name" maxlength="42" placeholder="my-bright-idea" required></div><div class="template-grid">${Object.entries(templates).map(([id, template]) => `<button class="template-choice ${id === state.selectedTemplate ? 'is-selected' : ''}" type="button" data-template="${id}"><span class="template-choice-top"><span class="template-icon">${icon('file')}</span><strong>${template.title}</strong></span><small>${template.description}</small></button>`).join('')}</div><p class="form-message" id="project-message" role="status"></p><div class="dialog-actions"><button type="button" class="button-secondary" data-close>Cancel</button><button type="submit" class="button-primary">Create workspace ${icon('check')}</button></div></form></section>`;
  modalLayer.classList.remove('is-hidden');
  modalLayer.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeDialog));
  modalLayer.querySelectorAll('[data-template]').forEach(button => button.addEventListener('click', () => {
    state.selectedTemplate = button.dataset.template;
    modalLayer.querySelectorAll('[data-template]').forEach(choice => choice.classList.toggle('is-selected', choice === button));
  }));
  modalLayer.querySelector('#project-form').addEventListener('submit', createProject);
  modalLayer.querySelector('#project-name').focus();
}

function starterFiles(template, name) {
  const headline = template === 'portfolio' ? 'A little about me.' : template === 'launch' ? 'A bright idea starts here.' : 'Your next idea starts here.';
  const body = template === 'blank'
    ? '<main></main>'
    : template === 'storefront'
      ? `<header class="shop-header"><a class="shop-brand" href="#">${escapeHTML(name)}<span>GOODS</span></a><nav><a href="#products">Shop</a><a href="#story">Our story</a></nav><button class="shop-bag">Bag <span>0</span></button></header><main><section class="shop-hero"><p class="shop-kicker">MADE FOR EVERY DAY</p><h1>Good things,<br>made to last.</h1><p>Thoughtful favorites for the everyday rituals worth keeping.</p><a class="shop-cta" href="#products">Shop new arrivals</a></section><section class="shop-products" id="products"><div class="shop-section-title"><div><p class="shop-kicker">THE COLLECTION</p><h2>Considered essentials</h2></div><span>03 pieces</span></div><div class="shop-grid"><article class="shop-item"><div class="shop-art art-rose"><span>01</span></div><h3>Soft form vase</h3><p>$38.00</p></article><article class="shop-item"><div class="shop-art art-citrus"><span>02</span></div><h3>Sunday candle</h3><p>$24.00</p></article><article class="shop-item"><div class="shop-art art-leaf"><span>03</span></div><h3>Everyday tote</h3><p>$32.00</p></article></div></section><section class="shop-story" id="story"><p class="shop-kicker">A SMALLER FOOTPRINT</p><h2>Made thoughtfully.<br>Kept for a long time.</h2></section></main>`
      : `<main class="hero"><p class="eyebrow">${escapeHTML(name)}</p><h1>${headline}</h1><p>Built with care, hosted with iamcloud.</p><a href="#about">Explore the project</a></main>`;
  const css = template === 'blank'
    ? '/* Add your styles here */\n'
    : template === 'storefront'
      ? `:root { font-family: Arial, sans-serif; color: #292422; background: #fffdfa; }\n* { box-sizing: border-box; }\nbody { margin: 0; }\na { color: inherit; text-decoration: none; }\n.shop-header { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 6vw; border-bottom: 1px solid #ece5df; }\n.shop-brand { font-size: 15px; font-weight: 700; }\n.shop-brand span { display: block; margin-top: 3px; color: #a34c42; font-size: 8px; letter-spacing: 2px; }\n.shop-header nav { display: flex; gap: 25px; color: #68615d; font-size: 12px; }\n.shop-bag { padding: 8px 12px; border: 1px solid #ded5cf; background: transparent; font-size: 11px; }\n.shop-bag span { margin-left: 8px; color: #a34c42; }\n.shop-hero { min-height: 365px; display: grid; align-content: center; padding: 48px 10vw; background: #f4e8e1; }\n.shop-kicker { margin: 0 0 14px; color: #a34c42; font-size: 9px; letter-spacing: 1.6px; }\n.shop-hero h1 { max-width: 580px; margin: 0; font: 500 clamp(44px, 7vw, 76px)/1.02 Georgia, serif; }\n.shop-hero > p:not(.shop-kicker) { color: #6f6761; font-size: 13px; line-height: 1.7; }\n.shop-cta { width: fit-content; margin-top: 12px; padding: 12px 16px; background: #a9453e; color: white; font-size: 10px; }\n.shop-products { max-width: 1060px; margin: 0 auto; padding: 50px 24px; }\n.shop-section-title { display: flex; align-items: end; justify-content: space-between; margin-bottom: 18px; }\n.shop-section-title h2, .shop-story h2 { margin: 0; font: 500 27px Georgia, serif; }\n.shop-section-title > span { color: #827a73; font-size: 10px; }\n.shop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }\n.shop-art { height: 190px; display: grid; place-items: center; }\n.shop-art span { width: 75px; height: 95px; display: grid; place-items: center; border-radius: 40% 40% 8px 8px; background: rgb(255 255 255 / 55%); color: #77625b; font: 13px Georgia, serif; }\n.art-rose { background: #ead5d0; }\n.art-citrus { background: #efe2bf; }\n.art-leaf { background: #dce4d7; }\n.shop-item h3 { margin: 11px 0 4px; font-size: 11px; }\n.shop-item p { margin: 0; color: #756e69; font-size: 10px; }\n.shop-story { padding: 42px 10vw; background: #f4e8e1; }\n.shop-story h2 { font-size: 31px; line-height: 1.3; }`
      : `:root { color-scheme: light; font-family: Arial, sans-serif; color: #292422; background: #fffaf6; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; }\n.hero { max-width: 760px; margin: 18vh auto; padding: 32px; }\n.eyebrow { color: #b8293c; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; }\nh1 { max-width: 620px; font-family: Georgia, serif; font-size: clamp(42px, 8vw, 76px); line-height: 1.04; }\n.hero > p:not(.eyebrow) { color: #716965; line-height: 1.7; }\na { display: inline-block; margin-top: 14px; padding: 12px 16px; background: #b8293c; color: white; text-decoration: none; }`;
  const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeHTML(name)}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`;
  return {
    'index.html': html,
    'styles.css': css,
    'README.md': `# ${name}\n\nA static website project built in iamcloud.\n\nEdit index.html and styles.css, preview your work, then deploy when it is ready.\n`
  };
}

async function createProject(event) {
  event.preventDefault();
  const input = modalLayer.querySelector('#project-name');
  const name = input.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const error = modalLayer.querySelector('#project-message');
  if (!name) { error.textContent = 'Use letters or numbers for your project name.'; return; }
  if (state.projects.some(project => project.name === name)) { error.textContent = 'That project name already exists.'; return; }
  const project = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    template: state.selectedTemplate,
    files: starterFiles(state.selectedTemplate, name),
    status: 'Draft',
    domain: `${name}.iamcloud.app`,
    updated: 'Created just now'
  };
  state.projects.unshift(project);
  const serverStored = await persistProjects();
  state.activeProjectId = project.id;
  state.activeFile = 'index.html';
  closeDialog();
  state.route = 'editor';
  renderRoute();
  showToast(serverStored ? `${name} is saved on the iamcloud server.` : `${name} is ready in this browser.`);
}

function activeProject() {
  return state.projects.find(project => project.id === state.activeProjectId);
}

function openProject(id) {
  state.activeProjectId = id;
  const project = activeProject();
  if (!project) return;
  state.activeFile = Object.keys(project.files)[0] || null;
  state.route = 'editor';
  renderRoute();
}

function renderEditor() {
  const project = activeProject();
  if (!project) { state.route = 'projects'; renderProjects(); return; }
  const fileNames = Object.keys(project.files);
  if (!fileNames.includes(state.activeFile)) state.activeFile = fileNames[0] || null;
  const storageLabel = state.serverStorage ? 'Stored on this server' : 'Saved in this browser';
  const liveSiteLink = project.status === 'Live' && state.serverStorage && location.protocol !== 'file:'
    ? `<a class="button-secondary" href="${escapeHTML(project.runtimeUrl || `/sites/${encodeURIComponent(project.id)}/`)}" target="_blank" rel="noopener noreferrer">Open live site ${icon('globe')}</a>`
    : '';
  const saveHint = state.serverStorage
    ? 'Project files are stored in the local SQLite database. Published sites are served from this server.'
    : 'Edits are saved in this browser. Start the iamcloud server to persist and publish project files.';
  const fileRows = fileNames.map(fileName => `<button class="file-row ${fileName === state.activeFile ? 'is-selected' : ''}" data-file="${escapeHTML(fileName)}">${icon('file')}<span>${escapeHTML(fileName)}</span></button>`).join('');
  appContent.innerHTML = `<section class="editor-page"><div class="editor-heading"><div class="editor-title"><h1>${escapeHTML(project.name)}</h1><p>${escapeHTML(project.domain)} · ${escapeHTML(project.status)} · ${storageLabel}</p></div><div class="editor-actions">${liveSiteLink}<button class="button-secondary" data-action="new-file">${icon('plus')}New file</button><button class="button-secondary" data-action="save">${icon('save')}Save</button><button class="button-primary" data-action="deploy">${icon('cloud')}Deploy</button></div></div><div class="editor-layout"><aside class="file-panel"><div class="file-panel-head"><span>Files</span><button data-action="new-file" aria-label="New file">${icon('plus')}</button></div><div class="file-tree">${fileRows}</div></aside><section class="code-panel"><div class="code-toolbar"><span class="current-file">${icon('file')}${escapeHTML(state.activeFile || 'No file')}</span><span class="saved-indicator" id="save-state">Saved</span></div><label class="visually-hidden" for="code-editor">Edit file code</label><textarea class="code-editor" id="code-editor" spellcheck="false" ${state.activeFile ? '' : 'disabled'}>${escapeHTML(project.files[state.activeFile] || '')}</textarea></section><section class="preview-panel"><div class="preview-toolbar"><strong>Live preview</strong><span class="preview-url">${escapeHTML(project.domain)}</span></div><iframe class="preview-frame" id="preview-frame" title="Website preview" sandbox="allow-scripts"></iframe></section></div><p class="drop-hint">${saveHint}</p></section>`;
  appContent.querySelectorAll('[data-file]').forEach(button => button.addEventListener('click', () => selectFile(button.dataset.file)));
  appContent.querySelectorAll('[data-action="new-file"]').forEach(button => button.addEventListener('click', openFileDialog));
  appContent.querySelector('[data-action="save"]').addEventListener('click', () => saveActiveFile(true));
  appContent.querySelector('[data-action="deploy"]').addEventListener('click', deployProject);
  const editor = appContent.querySelector('#code-editor');
  editor?.addEventListener('input', () => {
    document.querySelector('#save-state').textContent = 'Unsaved changes';
    updatePreview();
  });
  updatePreview();
}

async function selectFile(fileName) {
  await saveActiveFile(false);
  state.activeFile = fileName;
  renderEditor();
}

async function saveActiveFile(showNotice) {
  const project = activeProject();
  const editor = document.querySelector('#code-editor');
  if (!project || !editor || !state.activeFile) return false;
  project.files[state.activeFile] = editor.value;
  project.updated = 'Saved just now';
  const serverStored = await persistProjects();
  const indicator = document.querySelector('#save-state');
  if (indicator) indicator.textContent = 'Saved';
  updatePreview();
  if (showNotice) showToast(serverStored ? 'Your changes are stored on the iamcloud server.' : 'Your changes are saved in this browser.');
  return serverStored;
}

function updatePreview() {
  const project = activeProject();
  const frame = document.querySelector('#preview-frame');
  if (!project || !frame) return;
  const editor = document.querySelector('#code-editor');
  const html = state.activeFile === 'index.html' && editor ? editor.value : project.files['index.html'] || '';
  const css = state.activeFile === 'styles.css' && editor ? editor.value : project.files['styles.css'] || '';
  const inlineCss = css.replace(/<\/style/gi, '<\\/style');
  const preview = html.replace(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?>/i, `<style>${inlineCss}</style>`);
  frame.srcdoc = preview;
}

function openFileDialog() {
  modalLayer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-heading"><div><h2 id="dialog-title">Add a file</h2><p>Create a file in this project workspace.</p></div><button class="dialog-close" data-close aria-label="Close">${icon('close')}</button></div><form id="file-form"><div class="field"><label for="file-name">File name</label><input id="file-name" name="fileName" placeholder="script.js" required></div><div class="dialog-actions"><button class="button-secondary" type="button" data-close>Cancel</button><button class="button-primary" type="submit">Create file ${icon('check')}</button></div></form></section>`;
  modalLayer.classList.remove('is-hidden');
  modalLayer.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeDialog));
  modalLayer.querySelector('#file-form').addEventListener('submit', async event => {
    event.preventDefault();
    const name = modalLayer.querySelector('#file-name').value.trim().replace(/[\\/]/g, '');
    const project = activeProject();
    if (!name || !project) return;
    if (project.files[name] !== undefined) { showToast('A file with that name already exists.', true); return; }
    await saveActiveFile(false);
    project.files[name] = name.endsWith('.html') ? `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${escapeHTML(name)}</title>\n</head>\n<body>\n</body>\n</html>\n` : '';
    state.activeFile = name;
    await persistProjects();
    closeDialog();
    renderEditor();
    showToast(`${name} added to the project.`);
  });
  modalLayer.querySelector('#file-name').focus();
}

async function deployProject() {
  await saveActiveFile(false);
  const project = activeProject();
  if (!project) return;
  project.status = 'Live';
  project.updated = 'Deployed just now';
  project.deployedAt = new Date().toISOString();
  project.runtimeUrl = `/sites/${encodeURIComponent(project.id)}/`;
  const serverStored = await persistProjects();
  renderEditor();
  showToast(serverStored ? `${project.name} is live at ${project.runtimeUrl}.` : `${project.name} is marked live in this browser.`);
}

function renderDeployments() {
  const liveProjects = state.projects.filter(project => project.status === 'Live');
  appContent.innerHTML = `<section class="page-heading"><div><h1>Deployments</h1><p>Check what you’ve sent out into the world.</p></div></section>${liveProjects.length ? `<div class="deployment-list">${liveProjects.map(project => `<article class="deployment-row"><div><strong>${escapeHTML(project.name)}</strong><small>Published ${escapeHTML(project.updated || 'recently')}</small></div>${state.serverStorage ? `<a href="${escapeHTML(project.runtimeUrl || `/sites/${encodeURIComponent(project.id)}/`)}" target="_blank" rel="noopener noreferrer">Open live site ${icon('globe')}</a>` : `<a href="#" data-open-project="${escapeHTML(project.id)}">Open project</a>`}</article>`).join('')}</div>` : '<section class="project-empty"><div class="empty-inner"><span class="empty-flower">' + icon('cloud') + '</span><h2>No deployments yet</h2><p>Open a project and select Deploy when your first page is ready.</p><button class="button-primary" data-route-projects>View projects</button></div></section>'}`;
  appContent.querySelector('[data-route-projects]')?.addEventListener('click', () => { state.route = 'projects'; renderRoute(); });
  appContent.querySelectorAll('[data-open-project]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openProject(link.dataset.openProject); }));
}

function renderSettings() {
  appContent.innerHTML = `<section class="page-heading"><div><h1>Workspace settings</h1><p>Your account and local workspace details.</p></div></section><section class="settings-panel"><h2>${escapeHTML(state.user.username)}’s workspace</h2><p>Sign-in details remain in this browser. ${state.serverStorage ? 'Project files are stored in the local SQLite database, and deployed static sites are served by this server.' : 'Project files are saved in this browser until you start the iamcloud server.'} Phone verification and Google/Apple sign-in still need provider services before production use.</p><p><strong>Account:</strong> ${escapeHTML(state.user.email)}</p><p><strong>Projects:</strong> ${state.projects.length}</p></section>`;
}

function closeDialog() {
  modalLayer.classList.add('is-hidden');
  modalLayer.innerHTML = '';
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' is-error' : ''}`;
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => {
  state.route = button.dataset.route;
  renderRoute();
}));

document.querySelector('#sign-out').addEventListener('click', () => {
  state.user = null;
  appScreen.classList.add('is-hidden');
  authScreen.classList.remove('is-hidden');
  renderAuth('login');
});

document.querySelector('#mobile-nav-toggle').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('is-open'));
modalLayer.addEventListener('click', event => { if (event.target === modalLayer) closeDialog(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDialog(); });

const savedAccount = currentAccount();
if (savedAccount) enterWorkspace(savedAccount);
else renderAuth('login');