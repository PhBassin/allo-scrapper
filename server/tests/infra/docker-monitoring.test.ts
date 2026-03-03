/**
 * Infrastructure tests for the Docker monitoring stack.
 *
 * These tests validate that docker-compose.yml and the Traefik config file
 * contain the correct structure to support the monitoring profile with
 * Traefik as a reverse proxy and a healthy Loki instance.
 *
 * Tests are intentionally written against raw file content (string matching)
 * rather than a full YAML parser to avoid adding a new dependency.
 *
 * RED phase: all tests fail until Traefik is added and Loki is fixed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../');

function readFile(relPath: string): string {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) {
    throw new Error(`File not found: ${relPath}`);
  }
  return readFileSync(abs, 'utf8');
}

// ---------------------------------------------------------------------------
// Traefik static config
// ---------------------------------------------------------------------------

describe('docker/traefik/traefik.yml', () => {
  it('exists', () => {
    expect(existsSync(resolve(ROOT, 'docker/traefik/traefik.yml'))).toBe(true);
  });

  it('defines an HTTP entrypoint on port 80', () => {
    const content = readFile('docker/traefik/traefik.yml');
    expect(content).toContain('entryPoints');
    expect(content).toContain(':80');
  });

  it('enables the Docker provider', () => {
    const content = readFile('docker/traefik/traefik.yml');
    expect(content).toContain('docker');
  });

  it('sets exposedByDefault: false for security', () => {
    const content = readFile('docker/traefik/traefik.yml');
    expect(content).toContain('exposedByDefault: false');
  });

  it('enables the API/dashboard', () => {
    const content = readFile('docker/traefik/traefik.yml');
    expect(content).toContain('api:');
    expect(content).toContain('dashboard: true');
  });

  it('does not hardcode a network name in the Docker provider (avoids compose project prefix mismatch)', () => {
    const content = readFile('docker/traefik/traefik.yml');
    // "network: <name>" in the Docker provider causes Traefik to fail
    // silently when Docker Compose prefixes the network name (e.g.
    // ics-network → allo-scrapper_ics-network). Leave it unset so Traefik
    // auto-selects the first available network for each container.
    expect(content).not.toMatch(/^\s*network:\s*\S/m);
  });
});

// ---------------------------------------------------------------------------
// docker-compose.yml – Traefik service
// ---------------------------------------------------------------------------

describe('docker-compose.yml – ics-traefik service', () => {
  it('defines an ics-traefik service', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('ics-traefik:');
  });

  it('uses the traefik:v3 image', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toMatch(/image:\s*traefik:v3/);
  });

  it('exposes port 80 (HTTP entrypoint)', () => {
    const content = readFile('docker-compose.yml');
    // Must contain port 80 mapping in proximity to ics-traefik
    expect(content).toContain('"80:80"');
  });

  it('exposes port 8080 (Traefik dashboard)', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('"8080:8080"');
  });

  it('mounts the Docker socket read-only', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('/var/run/docker.sock:/var/run/docker.sock:ro');
  });

  it('mounts the traefik.yml config file', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('docker/traefik/traefik.yml');
  });

  it('is part of the monitoring profile', () => {
    const content = readFile('docker-compose.yml');
    // The traefik service block must include the monitoring profile
    expect(content).toContain('ics-traefik:');
    // Basic check: monitoring profile appears in the file near traefik config
    expect(content).toMatch(/ics-traefik[\s\S]{0,500}monitoring/);
  });
});

// ---------------------------------------------------------------------------
// docker-compose.yml – Traefik labels on services
// ---------------------------------------------------------------------------

describe('docker-compose.yml – Traefik routing labels', () => {
  it('ics-web has traefik.enable=true', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('traefik.enable=true');
  });

  it('ics-grafana routes /grafana prefix', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toMatch(/PathPrefix\(`\/grafana`\)/);
  });

  it('ics-prometheus routes /prometheus prefix with strip-prefix middleware', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toMatch(/PathPrefix\(`\/prometheus`\)/);
    expect(content).toContain('prometheus-stripprefix');
  });

  it('ics-loki routes /loki prefix with strip-prefix middleware', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toMatch(/PathPrefix\(`\/loki`\)/);
    expect(content).toContain('loki-stripprefix');
  });
});

// ---------------------------------------------------------------------------
// docker-compose.yml – Loki permissions fix
// ---------------------------------------------------------------------------

describe('docker-compose.yml – ics-loki permissions', () => {
  it('runs ics-loki as root (user: "0") to avoid macOS volume permission errors', () => {
    const content = readFile('docker-compose.yml');
    // The user: "0" directive must appear in the loki service block
    expect(content).toMatch(/ics-loki:[\s\S]{0,300}user:\s*["']?0["']?/);
  });
});

// ---------------------------------------------------------------------------
// docker-compose.yml – Prometheus external-url flag
// ---------------------------------------------------------------------------

describe('docker-compose.yml – ics-prometheus reverse proxy flags', () => {
  it('sets --web.external-url=/prometheus/ for correct asset paths behind Traefik', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('--web.external-url=/prometheus/');
  });

  it('sets --web.route-prefix=/ so internal routing is unaffected', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('--web.route-prefix=/');
  });
});
