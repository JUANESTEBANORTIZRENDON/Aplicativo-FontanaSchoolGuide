import './auth.css';
import { iniciarInterfaz } from './auth-ui';
import { showAppLoadingError } from './loading';

void iniciarInterfaz().catch(showAppLoadingError);
