import { useState, useEffect } from 'react';
import { checkSlugAvailability, registerOrg, RegisterOrgResult } from '../api/saas';

type Step = 'orgInfo' | 'adminAccount' | 'success';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('orgInfo');

  // Step 1 fields
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [orgNameError, setOrgNameError] = useState('');

  // Step 2 fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Success state
  const [result, setResult] = useState<RegisterOrgResult | null>(null);

  // Auto-generate slug from org name
  useEffect(() => {
    if (!slugManuallyEdited && orgName) {
      setSlug(slugify(orgName));
    }
  }, [orgName, slugManuallyEdited]);

  function handleStep1Next() {
    if (orgName.trim().length < 2) {
      setOrgNameError('Au moins 2 caractères requis.');
      return;
    }
    setOrgNameError('');
    setStep('adminAccount');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      // Pre-check slug availability
      const available = await checkSlugAvailability(slug);
      if (!available) {
        setSubmitError('Cet identifiant est déjà utilisé.');
        setIsSubmitting(false);
        return;
      }
      const res = await registerOrg({ orgName, slug, adminEmail, adminPassword });
      setResult(res);
      setStep('success');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <main className="register-page">
        <h1>Organisation créée !</h1>
        <p>Bienvenue, {result?.org.name}. Votre espace est prêt.</p>
      </main>
    );
  }

  if (step === 'adminAccount') {
    return (
      <main className="register-page">
        <h1>Compte administrateur</h1>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="adminEmail">Email</label>
            <input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="adminPassword">Mot de passe</label>
            <input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              required
            />
          </div>
          {submitError && <p className="error">{submitError}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Création...' : 'Créer mon organisation'}
          </button>
        </form>
      </main>
    );
  }

  // Step 1: org info
  return (
    <main className="register-page">
      <h1>Créer votre organisation</h1>
      <div>
        <label htmlFor="orgName">Nom de votre organisation</label>
        <input
          id="orgName"
          type="text"
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
        />
        {orgNameError && <p className="error">{orgNameError}</p>}
      </div>
      <div>
        <label htmlFor="slug">Identifiant (URL)</label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={e => {
            setSlugManuallyEdited(true);
            setSlug(e.target.value);
          }}
        />
      </div>
      <button type="button" onClick={handleStep1Next}>
        Suivant
      </button>
    </main>
  );
}
