/**
 * Keycloak JS adapter — singleton instance shared across the entire app.
 *
 * Initialised once in main.jsx before React renders. All other files import
 * this instance directly to read keycloak.token or call keycloak.login() etc.
 */
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL      || 'http://localhost:8080',
  realm:    import.meta.env.VITE_KEYCLOAK_REALM    || 'campusone',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'campusone-frontend',
});

export default keycloak;
