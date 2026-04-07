import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerOrg, checkSlugAvailable } from '../api/saas';
import apiClient from '../api/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an org name to a URL-safe slug candidate */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric (except spaces/hyphens)
    .replace(/[\s]+/g, '-')          // spaces → hyphens
    .replace(/-{2,}/g, '-')          // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')         // strip leading/trailing hyphens
    .slice(0, 30);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RegisterPage — 4-step wizard for SaaS org registration.
 *
 * Step 1: Org name + slug (auto-generated from name, async availability check)
 * Step 2: Admin email + password (min 8 chars)
 * Step 3: Optional cinema URL (skippable)
 * Step 4: Submit → POST /api/saas/orgs → redirect to /org/:slug/
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Shared state ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Step 1 ───────────────────────────────────────────────────────────────
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false); // user manually edited slug
  const [slugState, setSlugState] = useState<SlugState>('idle');
  const [step1Error, setStep1Error] = useState('');

  // ── Step 2 ───────────────────────────────────────────────────────────────
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [step2Error, setStep2Error] = useState('');

  // ── Step 3 ───────────────────────────────────────────────────────────────
  const [cinemaUrl, setCinemaUrl] = useState('');

  // ── Slug auto-generation from org name ──────────────────────────────────
  useEffect(() => {
    if (!slugEdited) {
      setSlug(nameToSlug(orgName));
    }
  }, [orgName, slugEdited]);

  // ── Async slug availability check (debounced 500 ms) ────────────────────
  const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

  const checkSlug = useCallback(
    (value: string) => {
      if (!value || !SLUG_PATTERN.test(value)) {
        setSlugState(value ? 'invalid' : 'idle');
        return;
      }
      setSlugState('checking');
      checkSlugAvailable(value)
        .then((available) => setSlugState(available ? 'available' : 'taken'))
        .catch(() => setSlugState('idle'));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!slug) {
      setSlugState('idle');
      return;
    }
    setSlugState('checking');
    const timer = setTimeout(() => checkSlug(slug), 500);
    return () => clearTimeout(timer);
  }, [slug, checkSlug]);

  // ── Step navigation ──────────────────────────────────────────────────────

  const handleStep1Next = () => {
    setStep1Error('');
    if (!orgName.trim() || orgName.trim().length < 2) {
      setStep1Error('Organisation name must be at least 2 characters.');
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setStep1Error('Slug must be 3–30 chars, lowercase letters, numbers and hyphens.');
      return;
    }
    if (slugState === 'taken') {
      setStep1Error('That slug is already taken. Please choose another.');
      return;
    }
    if (slugState === 'checking') {
      setStep1Error('Please wait — checking slug availability…');
      return;
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    setStep2Error('');
    if (!adminEmail || !adminEmail.includes('@')) {
      setStep2Error('Please enter a valid email address.');
      return;
    }
    if (!adminPassword || adminPassword.length < 8) {
      setStep2Error('Password must be at least 8 characters.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (skipCinema = false) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await registerOrg({
        orgName: orgName.trim(),
        slug,
        adminEmail,
        adminPassword,
      });

      // Store the org-scoped JWT
      localStorage.setItem('token', result.token);

      // Fire-and-forget: add cinema + trigger scrape if URL provided
      const url = skipCinema ? '' : cinemaUrl.trim();
      if (url) {
        apiClient
          .post(`/org/${slug}/cinemas`, { url })
          .then(() => apiClient.post(`/org/${slug}/scraper/trigger`))
          .catch(() => {
            // Non-blocking: ignore cinema setup errors here
          });
      }

      // Redirect to the org dashboard immediately
      navigate(`/org/${slug}/`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-8">

        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}
                data-testid={`step-indicator-${s}`}
              >
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Org name + slug ── */}
        {step === 1 && (
          <div data-testid="step-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create your organisation</h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="orgName">
                Organisation name
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Grand Cinéma Lyon"
                className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-org-name"
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="slug">
                URL slug
              </label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="grand-cinema-lyon"
                className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-slug"
              />
            </div>

            {/* Slug availability feedback */}
            <div className="mb-4 h-5 text-sm" data-testid="slug-feedback">
              {slugState === 'checking' && (
                <span className="text-gray-500">Checking availability…</span>
              )}
              {slugState === 'available' && (
                <span className="text-green-600">✓ Available</span>
              )}
              {slugState === 'taken' && (
                <span className="text-red-600">✗ Already taken</span>
              )}
              {slugState === 'invalid' && (
                <span className="text-red-600">Invalid format</span>
              )}
            </div>

            {step1Error && (
              <p className="text-red-600 text-sm mb-4" role="alert">{step1Error}</p>
            )}

            <button
              onClick={handleStep1Next}
              disabled={slugState === 'checking' || slugState === 'taken'}
              className="w-full bg-primary text-white font-semibold py-2 px-4 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
              data-testid="btn-step1-next"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Admin credentials ── */}
        {step === 2 && (
          <div data-testid="step-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Admin account</h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="adminEmail">
                Email address
              </label>
              <input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-admin-email"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="adminPassword">
                Password <span className="font-normal text-gray-500">(min 8 characters)</span>
              </label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-admin-password"
              />
            </div>

            {step2Error && (
              <p className="text-red-600 text-sm mb-4" role="alert">{step2Error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded hover:bg-gray-50 transition-colors"
                data-testid="btn-step2-back"
              >
                Back
              </button>
              <button
                onClick={handleStep2Next}
                className="flex-1 bg-primary text-white font-semibold py-2 px-4 rounded hover:opacity-90 transition-opacity"
                data-testid="btn-step2-next"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Optional cinema URL ── */}
        {step === 3 && (
          <div data-testid="step-3">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Add your first cinema</h2>
            <p className="text-gray-500 text-sm mb-6">
              Optional — you can add cinemas later from your dashboard.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="cinemaUrl">
                AlloCiné cinema URL
              </label>
              <input
                id="cinemaUrl"
                type="url"
                value={cinemaUrl}
                onChange={(e) => setCinemaUrl(e.target.value)}
                placeholder="https://www.allocine.fr/seance/salle_gen_csalle=C0028.html"
                className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-cinema-url"
              />
            </div>

            {submitError && (
              <p className="text-red-600 text-sm mb-4" role="alert">{submitError}</p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="w-full bg-primary text-white font-semibold py-2 px-4 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                data-testid="btn-submit"
              >
                {isSubmitting ? 'Creating your organisation…' : 'Create organisation'}
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="w-full border border-gray-300 text-gray-600 font-semibold py-2 px-4 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                data-testid="btn-skip-cinema"
              >
                Skip for now
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="text-sm text-gray-500 hover:underline"
                data-testid="btn-step3-back"
              >
                Back
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RegisterPage;
