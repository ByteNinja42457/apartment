import { EventEmitter } from 'eventemitter3';
import type { Settings } from './api';
import type { Config, PushParams } from './types';
import { Store } from './store';
import { Crypto } from './crypto';
import { Logging } from './logging';
import { defaultConfigEntity, ConfigEntity } from './entities';
import { getAccountStatus } from './net/getAccountStatus';
import { addAccountMFAuth } from './net/addAccountMFAuth';
import { setAccountMFAuth } from './net/setAccountMFAuth';
import { removeAccountMFAuth } from './net/removeAccountMFAuth';
import { setAccountLogin } from './net/setAccountLogin';
import { setAccountNotifications } from './net/setAccountNotifications';
import { setAccountSearchable } from './net/setAccountSearchable';
import { setAccountSeal } from './net/setAccountSeal';
import { clearAccountSeal } from './net/clearAccountSeal';
import { getUsername } from './net/getUsername';

let CLOSE_POLL_MS = 100;
let RETRY_POLL_MS = 2000;

export class SettingsModule implements Settings {
  private emitter: EventEmitter;
  private guid: string;
  private token: string;
  private node: string;
  private secure: boolean;
  private log: Logging;
  private store: Store;
  private crypto: Crypto | null;
  private syncing: boolean;
  private closing: boolean;
  private revision: number;
  private nextRevision: number | null;
  private config: ConfigEntity;
  private seal: { privateKey: string; publicKey: string } | null;

  constructor(log: Logging, store: Store, crypto: Crypto | null, guid: string, token: string, node: string, secure: boolean) {
    this.log = log;
    this.store = store;
    this.crypto = crypto;
    this.emitter = new EventEmitter();
    this.guid = guid;
    this.token = token;
    this.node = node;
    this.seal = null;
    this.secure = secure;
    this.revision = 0;
    this.config = defaultConfigEntity;
    this.syncing = true;
    this.closing = false;
    this.nextRevision = null;
    this.init();
  }

  private getSeal() {
    if (this.seal?.publicKey && this.config.seal?.publicKey) {
      return this.seal;
    }
    return null;
  }

  private async init() {
    this.revision = await this.store.getSettingsRevision(this.guid);
    this.config = await this.store.getSettingsData(this.guid);
    this.seal = await this.store.getSeal(this.guid);
    this.emitter.emit('seal', this.getSeal());
    this.emitter.emit('config', this.getConfig());
    this.syncing = false;
    await this.sync();
  }

  private async sync(): Promise<void> {
    if (!this.syncing) {
      this.syncing = true;
      while (this.nextRevision && !this.closing) {
        if (this.revision == this.nextRevision) {
          this.nextRevision = null;
        } else {
          let nextRev = this.nextRevision;
          try {
            let { guid, node, secure, token } = this;
            let config = await getAccountStatus(node, secure, token);
            await this.store.setSettingsData(guid, config);
            await this.store.setSettingsRevision(guid, nextRev);
            this.config = config;
            this.emitter.emit('config', this.getConfig());
            this.emitter.emit('seal', this.getSeal());
            this.revision = nextRev;
            if (this.nextRevision === nextRev) {
              this.nextRevision = null;
            }
            this.log.info(`account revision: ${nextRev}`);
          } catch (err) {
            this.log.warn(err);
            await new Promise((r) => setTimeout(r, RETRY_POLL_MS));
          }
        }
      }
      this.syncing = false;
    }
  }

  public getConfig() {
    let { storageUsed, storageAvailable, forwardingAddress, searchable, allowUnsealed, pushEnabled, sealable, seal, enableIce, mfaEnabled, webPushKey } = this.config;
    let { passwordSalt, privateKeyIv, privateKeyEncrypted, publicKey } = seal || {};
    let sealSet = Boolean(passwordSalt && privateKeyIv && privateKeyEncrypted && publicKey);
    let sealUnlocked = Boolean(sealSet && this.seal?.privateKey && this.seal?.publicKey == publicKey);
    return {
      storageUsed,
      storageAvailable,
      forwardingAddress,
      searchable,
      allowUnsealed,
      pushEnabled,
      sealable,
      sealSet,
      sealUnlocked,
      enableIce,
      mfaEnabled,
      webPushKey,
    };
  }

  public addConfigListener(ev: (config: Config) => void): void {
    this.emitter.on('config', ev);
    this.emitter.emit('config', this.getConfig());
  }

  public removeConfigListener(ev: (config: Config) => void): void {
    this.emitter.off('config', ev);
  }

  public addSealListener(ev: (seal: { privateKey: string; publicKey: string } | null) => void): void {
    this.emitter.on('seal', ev);
    ev(this.seal);
  }

  public removeSealListener(ev: (seal: { privateKey: string; publicKey: string } | null) => void): void {
    this.emitter.off('seal', ev);
  }

  public async close(): Promise<void> {
    this.closing = true;
    while (this.syncing) {
      await new Promise((r) => setTimeout(r, CLOSE_POLL_MS));
    }
  }

  public async setRevision(rev: number): Promise<void> {
    this.nextRevision = rev;
    await this.sync();
  }

  public async enableNotifications(params?: PushParams): Promise<void> {
    let { node, secure, token } = this;
    await setAccountNotifications(node, secure, token, true, params);
  }

  public async disableNotifications(): Promise<void> {
    let { node, secure, token } = this;
    await setAccountNotifications(node, secure, token, false);
  }

  public async enableRegistry(): Promise<void> {
    let { node, secure, token } = this;
    await setAccountSearchable(node, secure, token, true);
  }

  public async disableRegistry(): Promise<void> {
    let { node, secure, token } = this;
    await setAccountSearchable(node, secure, token, false);
  }

  public async enableMFA(): Promise<{
    secretImage: string;
    secretText: string;
  }> {
    let { node, secure, token } = this;
    let { secretImage, secretText } = await addAccountMFAuth(node, secure, token);
    return { secretImage, secretText };
  }

  public async disableMFA(): Promise<void> {
    let { node, secure, token } = this;
    await removeAccountMFAuth(node, secure, token);
  }

  public async confirmMFA(code: string): Promise<void> {
    let { node, secure, token } = this;
    await setAccountMFAuth(node, secure, token, code);
  }

  public async setSeal(password: string): Promise<void> {
    let { crypto, guid, node, secure, token } = this;
    if (!crypto) {
      throw new Error('crypto not enabled');
    }
    let { saltHex } = await crypto.pbkdfSalt();
    let { aesKeyHex } = await crypto.pbkdfKey(saltHex, password);
    let { publicKeyB64, privateKeyB64 } = await crypto.rsaKey();
    let { ivHex } = await crypto.aesIv();
    let { encryptedDataB64 } = await crypto.aesEncrypt(privateKeyB64, ivHex, aesKeyHex);
    let seal = {
      passwordSalt: saltHex,
      privateKeyIv: ivHex,
      privateKeyEncrypted: encryptedDataB64,
      publicKey: publicKeyB64,
    };
    await setAccountSeal(node, secure, token, seal);
    this.seal = { publicKey: publicKeyB64, privateKey: privateKeyB64 };
    this.store.setSeal(guid, this.seal);
    this.emitter.emit('config', this.getConfig());
    this.emitter.emit('seal', this.getSeal());
  }

  public async updateSeal(password: string): Promise<void> {
    let { crypto, config, node, secure, token } = this;
    if (!crypto) {
      throw new Error('crypto not enabled');
    }
    if (!this.seal || this.seal.publicKey !== config.seal.publicKey) {
      throw new Error('seal not unlocked');
    }
    let { saltHex } = await crypto.pbkdfSalt();
    let { aesKeyHex } = await crypto.pbkdfKey(saltHex, password);
    let { ivHex } = await crypto.aesIv();
    let { encryptedDataB64 } = await crypto.aesEncrypt(this.seal.privateKey, ivHex, aesKeyHex);
    let seal = {
      passwordSalt: saltHex,
      privateKeyIv: ivHex,
      privateKeyEncrypted: encryptedDataB64,
      publicKey: config.seal.publicKey,
    };
    await setAccountSeal(node, secure, token, seal);
  }

  public async clearSeal(): Promise<void> {
    let { guid, node, secure, token } = this;
    await clearAccountSeal(node, secure, token);
    await this.store.clearSeal(guid);
    this.seal = null;
    this.emitter.emit('config', this.getConfig());
    this.emitter.emit('seal', this.getSeal());
  }

  public async unlockSeal(password: string): Promise<void> {
    let { guid, config, crypto } = this;
    let { passwordSalt, privateKeyIv, privateKeyEncrypted, publicKey } = config.seal;
    if (!passwordSalt || !privateKeyIv || !privateKeyEncrypted || !publicKey) {
      throw new Error('account seal not set');
    }
    if (!crypto) {
      throw new Error('crypto not set');
    }
    let { aesKeyHex } = await crypto.pbkdfKey(passwordSalt, password);
    let { data } = await crypto.aesDecrypt(privateKeyEncrypted, privateKeyIv, aesKeyHex);
    let seal = { publicKey: publicKey, privateKey: data };
    this.store.setSeal(guid, seal);
    this.seal = seal;
    this.emitter.emit('config', this.getConfig());
    this.emitter.emit('seal', this.getSeal());
  }

  public async forgetSeal(): Promise<void> {
    let { guid } = this;
    await this.store.clearSeal(guid);
    this.seal = null;
    this.emitter.emit('config', this.getConfig());
    this.emitter.emit('seal', this.getSeal());
  }

  public async getUsernameStatus(username: string): Promise<boolean> {
    let { node, secure, token } = this;
    return await getUsername(username, null, token, node, secure);
  }

  public async setLogin(username: string, password: string): Promise<void> {
    let { node, secure, token } = this;
    await setAccountLogin(node, secure, token, username, password);
  }

  public async getBlockedCards(): Promise<{cardId: string, timestamp: number}[]> {
    let { guid } = this;
    let blockedContacts = await this.store.getMarkers(guid, 'blocked_card');
    return blockedContacts.map(marker => {
      try {
        return JSON.parse(marker.value);
      } catch (err) {
        return {};
      }
    });
  }

  public async getBlockedChannels(): Promise<{cardId: string | null, channelId: string, timestamp: number}[]> {
    let { guid } = this;
    let blockedChannels = await this.store.getMarkers(guid, 'blocked_channel');
    let blockedCardChannels = await this.store.getMarkers(guid, 'blocked_card_channel');
    return blockedChannels.concat(blockedCardChannels).map(marker => {
      try {
        return JSON.parse(marker.value);
      } catch (err) {
        return {};
      }
    });
  }

  public async getBlockedTopics(): Promise<{cardId: string | null, channelId: string, topicId: string, timestamp: number}[]> {
    let { guid } = this;
    let blockedTopics = await this.store.getMarkers(guid, 'blocked_topic');
    return blockedTopics.map(marker => {
      try {
        return JSON.parse(marker.value);
      } catch (err) {
        return {};
      }
    });
  }
}
