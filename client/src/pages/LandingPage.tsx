import React from 'react';
import { Link } from 'react-router-dom';

/**
 * LandingPage
 *
 * Public marketing/welcome page rendered at "/" when SAAS_ENABLED=true.
 * Provides CTAs to register a new organisation or log in to an existing one.
 */
const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Cinema Showtimes, Made Easy
        </h1>
        <p className="text-xl text-gray-600 mb-10">
          Aggregate and manage movie screening schedules for your cinema network.
          Get started in minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="inline-block bg-primary text-white font-semibold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            data-testid="cta-register"
          >
            Get started — it's free
          </Link>

          <Link
            to="/login"
            className="inline-block bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-8 rounded-lg text-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            data-testid="cta-login"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
