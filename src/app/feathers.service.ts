import { Injectable } from '@angular/core';
import { feathers } from '@feathersjs/feathers';
import feathersSocketIOClient from '@feathersjs/socketio-client';
import io from 'socket.io-client'
import { rx } from 'feathers-reactive';

import auth, { AuthenticationClient } from '@feathersjs/authentication-client';
import { AuthenticationResult } from '@feathersjs/authentication/lib';

/**
 * Simple wrapper for feathers
 */
@Injectable()
export class Feathers {
  private _feathers = feathers();
  private _socket = io();

  constructor() {
    this._feathers
      .configure(
        feathersSocketIOClient(this._socket, {
          timeout: 10000,
        })
      )
      .configure(
        auth({
          Authentication: AuthenticationClient,
          storage: window.localStorage,
        })
      )
      .configure(
        rx({
          idField: '_id',
        })
      );
  }

  public addSocketListener(event: string, action: () => void) {
    this._socket.on(event, action);
  }

  // expose services
  public service(name: string): any {
    return this._feathers.service('api/' + name);
  }

  public get(name: string) {
    return this._feathers.get(name);
  }

  // expose authentication
  public authenticate(credentials?: any): Promise<AuthenticationResult> {
    return this._feathers.authenticate(credentials);
  }

  public reauthenticate(): Promise<AuthenticationResult> {
    return this._feathers.reAuthenticate();
  }

  // expose logout
  public logout() {
    return this._feathers.logout();
  }
}
