import './auth.css';
import { iniciarInterfaz } from './auth-ui';
import { showAppLoadingError } from './loading';

// Una restauración del navegador debe consultar de nuevo qué intentos siguen abiertos.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

void iniciarInterfaz().catch(showAppLoadingError);
