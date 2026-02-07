import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms'
import { environment } from '../environments/environment'
import { routes } from './app.routes';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app'
import { provideAuth, getAuth } from '@angular/fire/auth'


export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    importProvidersFrom(ReactiveFormsModule),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth())
  ]
};
