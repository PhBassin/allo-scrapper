import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSlugAvailability, registerOrg, type RegisterOrgResult } from '../api/saas';

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
  const navigate = useNavigate();
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
      setSubmitError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">Organisation créée !</h2>
          <p className="text-gray-600 mb-6">
            Bienvenue, <strong>{result?.org.name}</strong>. Votre espace est prêt.
          </p>
          <button
            onClick={() => navigate(`/org/${result?.org.slug}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors"
          >
            Accéder à mon espace
          </button>
        </div>
      </div>
    );
  }

  if (step === 'adminAccount') {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <button
            onClick={() => setStep('orgInfo')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            ← Retour
          </button>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">Compte administrateur</h2>
          <p className="text-sm text-gray-500 mb-6">
            Organisation : <strong>{orgName}</strong> — identifiant : <code className="bg-gray-100 px-1 rounded">{slug}</code>
          </p>

          {submitError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm" role="alert">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="adminEmail">
                Email
              </label>
              <input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@mon-cinema.com"
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="adminPassword">
                Mot de passe
              </label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
                disabled={isSubmitting}
                minLength={8}
                className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="8 caractères minimum"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Création en cours...' : 'Créer mon organisation'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Step 1: org info
  return (
    <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Créer votre organisation</h2>
        <p className="text-sm text-gray-500 mb-6">Votre espace cinéma multi-tenant, prêt en quelques secondes.</p>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="orgName">
            Nom de votre organisation
          </label>
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mon Cinéma"
          />
          {orgNameError && (
            <p className="mt-1 text-red-600 text-sm">{orgNameError}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="slug">
            Identifiant (URL)
          </label>
          <div className="flex items-center border rounded overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
            <span className="bg-gray-100 px-3 py-2 text-gray-500 text-sm border-r whitespace-nowrap">/org/</span>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={e => {
                setSlugManuallyEdited(true);
                setSlug(e.target.value);
              }}
              className="flex-1 py-2 px-3 text-gray-700 leading-tight focus:outline-none"
              placeholder="mon-cinema"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">Lowercase, tirets autorisés, 3–30 caractères.</p>
        </div>

        <button
          type="button"
          onClick={handleStep1Next}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full transition-colors"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
