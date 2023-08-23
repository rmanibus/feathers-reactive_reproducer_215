import { Injectable } from '@angular/core';
import { Application, feathers, Params, Service } from '@feathersjs/feathers';
import { rx } from 'feathers-reactive';
import feathersSocketIOClient from '@feathersjs/socketio-client';
import io from 'socket.io-client';

import { CoverBoxService } from './cover-box.service';

import auth, { AuthenticationClient } from '@feathersjs/authentication-client';
import {
  AuthenticationRequest,
  AuthenticationResult,
} from '@feathersjs/authentication/lib';

class RefreshableAuthenticationClient extends AuthenticationClient {
  refresh?: Promise<AuthenticationResult> = undefined;

  reAuthenticate(
    force = false,
    strategy?: string
  ): Promise<AuthenticationResult> {
    if (this.isExpired()) {
      if (!this.refresh) {
        this.refresh = this.authenticate({
          strategy: 'refreshToken',
          refreshToken: localStorage.getItem('refresh-token'),
        }).then((result) => {
          this.refresh = undefined;
          return result;
        });
      }
      return this.refresh;
    }
    return super.reAuthenticate(force, strategy);
  }

  isExpired(): boolean {
    const exp = localStorage.getItem('exp');
    if (!exp) {
      return false;
    }
    return Date.now() >= (parseInt(exp) - 1) * 1000;
  }

  authenticate(
    authentication?: AuthenticationRequest,
    params?: Params
  ): Promise<AuthenticationResult> {
    return super
      .authenticate(
        authentication && {
          ...authentication,
          deviceId: localStorage.getItem('device-id'),
        },
        params
      )
      .then(({ refreshToken, deviceId, authentication, ...rest }) => {
        const exp = authentication.payload.exp;
        exp && localStorage.setItem('exp', exp);
        refreshToken && localStorage.setItem('refresh-token', refreshToken);
        deviceId && localStorage.setItem('device-id', deviceId);
        return { authentication, ...rest };
      });
  }

  removeAccessToken() {
    return super.removeAccessToken().then((value: any) => {
      localStorage.removeItem('exp');
      localStorage.removeItem('refresh-token');
      return value;
    });
  }
}

/**
 * Simple wrapper for feathers
 */
@Injectable()
export class Feathers {
  private _feathers = feathers();
  private _socket = io();

  constructor(private coverBox: CoverBoxService) {
    this.coverBox.show('Connecting ...');

    this._feathers
      .configure(
        feathersSocketIOClient(this._socket, {
          timeout: 10000,
        })
      )
      .configure(
        auth({
          Authentication: RefreshableAuthenticationClient,
          storage: window.localStorage,
        })
      )
      .configure(
        rx({
          idField: '_id',
        })
      );

    this._socket.on('connect', () => {
      console.log('connected');
      this.coverBox.hide();
      document.title = 'TTKweb';
    });

    this._socket.on('reconnecting', (delay: any, attempt: any) => {
      this.coverBox.show('Disconnected ... trying to reconnect.');
    });

    this._socket.on('reconnect', () => {
      console.log('reconnected');
      this.coverBox.hide();
    });
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
