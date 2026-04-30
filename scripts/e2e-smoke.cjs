const { chromium } = require('playwright');

async function runSmoke(baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4300') {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(10000);

  const failures = [];
  const jsErrors = [];
  const apiFailures = [];

  page.on('pageerror', (error) => jsErrors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') jsErrors.push(`console: ${msg.text()}`);
  });
  page.on('response', (response) => {
    const req = response.request();
    if ((req.resourceType() === 'fetch' || req.resourceType() === 'xhr') && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${req.method()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      apiFailures.push(`FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`);
    }
  });

  async function step(name, fn) {
    try {
      await fn();
      console.log(`OK: ${name}`);
    } catch (error) {
      failures.push(`${name} -> ${error.message}`);
      console.log(`KO: ${name} -> ${error.message}`);
    }
  }

  await step('login admin', async () => {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@senclinic.sn');
    await page.fill('#mot_de_passe', 'admin123');
    await page.getByRole('button', { name: /Se connecter/i }).click();
    await page.waitForURL(/tableau-de-bord|patients|rendez-vous|consultations|medecins|utilisateurs/);
  });

  await step('dashboard interactions', async () => {
    await page.goto(`${baseUrl}/tableau-de-bord`, { waitUntil: 'networkidle' });
    const link = page.getByRole('link', { name: /Nouveau patient/i }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForURL(/patients/);
      await page.goto(`${baseUrl}/tableau-de-bord`, { waitUntil: 'networkidle' });
    }
    const toggle = page.getByRole('button', { name: /Tout effacer|Afficher/i }).first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }
  });

  await step('patients interactions', async () => {
    await page.goto(`${baseUrl}/patients`, { waitUntil: 'networkidle' });
    await page.locator('input[type="search"]').first().fill('Aminata');
    await page.locator('select').nth(0).selectOption('actif');
    await page.locator('select').nth(1).selectOption({ index: 0 });
    await page.getByRole('button', { name: /Nouveau patient/i }).click();
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    const editBtn = page.locator('button[title="Modifier"]').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.getByRole('button', { name: /Annuler/i }).first().click();
    }

    const page2 = page.locator('.pagination-controls button', { hasText: '2' }).first();
    if (await page2.isVisible().catch(() => false)) {
      await page2.click();
    }

    await page.getByRole('button', { name: /Exporter/i }).click();
  });

  await step('rendez-vous interactions', async () => {
    await page.goto(`${baseUrl}/rendez-vous`, { waitUntil: 'networkidle' });
    await page.locator('.view-switch button', { hasText: 'Calendrier' }).click();
    await page.locator('.view-switch button', { hasText: 'Liste' }).click();
    await page.getByRole('button', { name: /Nouveau RDV/i }).click();
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    const edit = page.getByRole('button', { name: /Modifier/i }).first();
    if (await edit.isVisible().catch(() => false)) {
      await edit.click();
      await page.getByRole('button', { name: /Annuler/i }).first().click();
    }

    const nextPage = page.locator('.pagination-controls .icon').last();
    if (await nextPage.isVisible().catch(() => false) && !(await nextPage.isDisabled())) {
      await nextPage.click();
    }

    await page.getByRole('button', { name: /Exporter/i }).click();
  });

  await step('consultations interactions', async () => {
    await page.goto(`${baseUrl}/consultations`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nouvelle consultation/i }).click();
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    const details = page.locator('button[title="Voir details"]').first();
    if (await details.isVisible().catch(() => false)) {
      await details.click();
      await page.getByRole('button', { name: /Fermer/i }).first().click();
    }

    const edit = page.locator('button[title="Modifier"]').first();
    if (await edit.isVisible().catch(() => false)) {
      await edit.click();
      await page.getByRole('button', { name: /Annuler/i }).first().click();
    }

    await page.getByRole('button', { name: /^Exporter$/i }).first().click();
  });

  await step('medecins interactions', async () => {
    await page.goto(`${baseUrl}/medecins`, { waitUntil: 'networkidle' });

    const listViewBtn = page.locator('button[title="Vue liste"]').first();
    const cardViewBtn = page.locator('button[title="Vue cartes"]').first();
    if (await listViewBtn.isVisible().catch(() => false)) {
      await listViewBtn.click();
      await cardViewBtn.click();
    }

    await page.getByRole('button', { name: /Nouveau médecin/i }).click();
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    const editGhost = page.getByRole('button', { name: /Modifier/i }).first();
    if (await editGhost.isVisible().catch(() => false)) {
      await editGhost.click();
      await page.getByRole('button', { name: /Annuler/i }).first().click();
    }

    const exportBtn = page.locator('button[title="Exporter"]').first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click();
    }
  });

  await step('utilisateurs interactions', async () => {
    await page.goto(`${baseUrl}/utilisateurs`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nouvel utilisateur/i }).first().click();
    await page.getByRole('button', { name: /Annuler/i }).first().click();

    const roleSelect = page.locator('select').nth(0);
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption('medecin');
    }

    const editBtn = page.locator('button[title="Modifier"]').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.getByRole('button', { name: /Annuler/i }).first().click();
    }

    const page2 = page.locator('.pagination-controls button', { hasText: '2' }).first();
    if (await page2.isVisible().catch(() => false)) {
      await page2.click();
    }
  });

  await step('profil interactions', async () => {
    await page.goto(`${baseUrl}/profil`, { waitUntil: 'networkidle' });
    await page.locator('.tabs button', { hasText: 'Paramètres' }).click();
    await page.getByRole('button', { name: /^Profil$/i }).click();
    await page.fill('#telephone', '+221771112233');
    await page.getByRole('button', { name: /Enregistrer le profil/i }).click();
  });

  await step('logout + login error + login success', async () => {
    await page.goto(`${baseUrl}/tableau-de-bord`, { waitUntil: 'networkidle' });
    await page.locator('.profile-trigger').click();
    await page.locator('.profile-menu-item.danger').click();
    await page.waitForURL(/\/login$/);

    await page.fill('#email', 'admin@senclinic.sn');
    await page.fill('#mot_de_passe', 'bad-pass');
    await page.getByRole('button', { name: /Se connecter/i }).click();
    await page.getByText(/Identifiants invalides|invalide|Connexion impossible/i).first().waitFor({ timeout: 12000 });

    await page.fill('#mot_de_passe', 'admin123');
    await page.getByRole('button', { name: /Se connecter/i }).click();
    await page.waitForURL(/tableau-de-bord|patients/);
  });

  await browser.close();

  if (failures.length || jsErrors.length || apiFailures.length) {
    console.log('\n=== QA REPORT (WITH ISSUES) ===');
    if (failures.length) {
      console.log('Functional failures:');
      failures.forEach((f) => console.log(` - ${f}`));
    }
    if (jsErrors.length) {
      console.log('JS/runtime errors:');
      jsErrors.forEach((e) => console.log(` - ${e}`));
    }
    if (apiFailures.length) {
      console.log('API failures:');
      [...new Set(apiFailures)].forEach((e) => console.log(` - ${e}`));
    }
    process.exit(1);
  }

  console.log('\n=== QA REPORT ===');
  console.log('All interaction checks passed. No functional, runtime, or API failures detected.');
}

runSmoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
