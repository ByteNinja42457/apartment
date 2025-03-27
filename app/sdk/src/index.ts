import { SessionModule } from './session';
import { ServiceModule } from './service';
import { ContributorModule } from './contributor';
import { type Logging, ConsoleLogging } from './logging';
import { type Store, OfflineStore, OnlineStore, NoStore } from './store';
import { setLogin } from './net/setLogin';
import { clearLogin } from './net/clearLogin';
import { removeAccount } from './net/removeAccount';
import { setAccess } from './net/setAccess';
import { addAccount } from './net/addAccount';
import { setAdmin } from './net/setAdmin';
import { getAvailable } from './net/getAvailable';
import { getUsername } from './net/getUsername';
import type { Session, Service, Contributor } from './api';
import type { Params, SessionParams } from './types';
import type { Login } from './entities';
import type { Crypto } from './crypto';
import type { Staging } from './staging';
import type { WebStore, SqlStore } from './store';

export * from './api';
export * from './types';
export { WebStore, SqlStore } from './store';
export { Crypto } from './crypto';
export { Staging } from './staging';

export class DatabagSDK {
  private log: Logging;
  private crypto: Crypto | null;
  private staging: Staging | null;
  private store: Store;
  private params: Params;

  constructor(params: Params, crypto?: Crypto, staging?: Staging, log?: Logging) {
    this.store = new NoStore();
    this.params = params;
    this.crypto = crypto ? crypto : null;
    this.staging = staging ? staging : null;
    this.log = log ? log : new ConsoleLogging();
    this.log.info('databag sdk');
  }

  public async initOfflineStore(sql: SqlStore): Promise<Session | null> {
    let { channelTypes } = this.params;
    this.store = new OfflineStore(this.log, sql);
    await this.staging?.clear();
    let login = await this.store.init();
    return login ? new SessionModule(this.store, this.crypto, this.log, this.staging, login.guid, login.token, login.node, login.secure, login.timestamp, channelTypes) : null;
  }

  public async initOnlineStore(web: WebStore): Promise<Session | null> {
    let { channelTypes } = this.params;
    this.store = new OnlineStore(this.log, web);
    let login = await this.store.init();
    return login ? new SessionModule(this.store, this.crypto, this.log, this.staging, login.guid, login.token, login.node, login.secure, login.timestamp, channelTypes) : null;
  }

  public async available(node: string, secure: boolean): Promise<number> {
    return await getAvailable(node, secure);
  }

  public async username(name: string, token: string, node: string, secure: boolean): Promise<boolean> {
    return await getUsername(name, token, null, node, secure);
  }

  public async login(handle: string, password: string, node: string, secure: boolean, mfaCode: string | null, params: SessionParams): Promise<Session> {
    let { channelTypes } = this.params;
    let { appName, version, deviceId, deviceToken, pushType, notifications } = params;
    let { guid, appToken, created, pushSupported } = await setLogin(node, secure, handle, password, mfaCode, appName, version, deviceId, deviceToken, pushType, notifications);
    let login: Login = {
      guid,
      node,
      secure,
      token: appToken,
      timestamp: created,
      pushSupported,
    };
    await this.store.setLogin(login);
    return new SessionModule(this.store, this.crypto, this.log, this.staging, guid, appToken, node, secure, created, channelTypes);
  }

  public async access(node: string, secure: boolean, token: string, params: SessionParams): Promise<Session> {
    let { channelTypes } = this.params;
    let { appName, version, deviceId, deviceToken, pushType, notifications } = params;
    let { guid, appToken, created, pushSupported } = await setAccess(node, secure, token, appName, version, deviceId, deviceToken, pushType, notifications);
    let login: Login = {
      guid,
      node,
      secure,
      token: appToken,
      timestamp: created,
      pushSupported,
    };
    await this.store.setLogin(login);
    return new SessionModule(this.store, this.crypto, this.log, this.staging, guid, appToken, node, secure, created, channelTypes);
  }

  public async create(handle: string, password: string, node: string, secure: boolean, token: string | null, params: SessionParams): Promise<Session> {
    let { channelTypes } = this.params;
    await addAccount(node, secure, handle, password, token);
    let { appName, version, deviceId, deviceToken, pushType, notifications } = params;
    let { guid, appToken, created, pushSupported } = await setLogin(node, secure, handle, password, null, appName, version, deviceId, deviceToken, pushType, notifications);
    let login: Login = {
      guid,
      node,
      secure,
      token: appToken,
      timestamp: created,
      pushSupported,
    };
    await this.store.setLogin(login);
    return new SessionModule(this.store, this.crypto, this.log, this.staging, guid, appToken, node, secure, created, channelTypes);
  }

  public async remove(session: Session): Promise<void> {
    let sessionModule = session as SessionModule;
    let { node, secure, token } = sessionModule.getParams();
    await removeAccount(node, secure, token);
    await sessionModule.close();
    try {
      await this.store.clearLogin();
    } catch (err) {
      this.log.error(err);
    }
  }

  public async logout(session: Session, all: boolean): Promise<void> {
    let sessionModule = session as SessionModule;
    let { node, secure, token } = sessionModule.getParams();
    await sessionModule.close();
    try {
      await this.store.clearLogin();
    } catch (err) {
      this.log.error(err);
    }
    clearLogin(node, secure, token, all)
      .then(() => {})
      .catch((err) => {
        console.log(err);
      });
  }

  public async configure(node: string, secure: boolean, token: string, mfaCode: string | null): Promise<Service> {
    let access = await setAdmin(node, secure, token, mfaCode);
    return new ServiceModule(this.log, node, secure, access);
  }

  public async automate(node: string, secure: boolean, token: string): Promise<Contributor> {
    return new ContributorModule(this.log, this.crypto, node, secure, token);
  }
}
