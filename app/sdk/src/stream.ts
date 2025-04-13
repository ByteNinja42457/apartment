import { EventEmitter } from 'eventemitter3';
import type { Content, Focus } from './api';
import { Logging } from './logging';
import { FocusModule } from './focus';
import type { ChannelItem } from './items';
import type { Channel, Topic, Asset, Tag, Participant } from './types';
import { Store } from './store';
import { Crypto } from './crypto';
import { Staging } from './staging';
import { addChannel } from './net/addChannel';
import { removeChannel } from './net/removeChannel';
import { getChannels } from './net/getChannels';
import { getChannelDetail } from './net/getChannelDetail';
import { getChannelSummary } from './net/getChannelSummary';
import { defaultChannelItem } from './items';
import { setChannelSubject } from './net/setChannelSubject';
import { setChannelCard } from './net/setChannelCard';
import { clearChannelCard } from './net/clearChannelCard';
import { getChannelNotifications } from './net/getChannelNotifications';
import { setChannelNotifications } from './net/setChannelNotifications';
import { addFlag } from './net/addFlag';
import { getLegacyData } from './legacy';

let CLOSE_POLL_MS = 100;
let RETRY_POLL_MS = 2000;

export class StreamModule {
  private log: Logging;
  private store: Store;
  private crypto: Crypto | null;
  private staging: Staging | null;
  private guid: string;
  private token: string;
  private node: string;
  private secure: boolean;
  private emitter: EventEmitter;
  private focus: FocusModule | null;
  private revision: number;
  private syncing: boolean;
  private closing: boolean;
  private nextRevision: number | null;
  private seal: { privateKey: string; publicKey: string } | null;
  private unsealAll: boolean;
  private loaded: boolean;
  private blocked: Set<string>;
  private read: Map<string, number>
  private channelTypes: string[];
  private hasSynced: boolean;

  // view of channels
  private channelEntries: Map<string, { item: ChannelItem; channel: Channel }>;

  constructor(log: Logging, store: Store, crypto: Crypto | null, staging: Staging | null, guid: string, token: string, node: string, secure: boolean, channelTypes: string[]) {
    this.guid = guid;
    this.token = token;
    this.node = node;
    this.secure = secure;
    this.log = log;
    this.store = store;
    this.crypto = crypto;
    this.staging = staging;
    this.focus = null;
    this.seal = null;
    this.unsealAll = false;
    this.loaded = false;
    this.channelTypes = channelTypes;
    this.emitter = new EventEmitter();

    this.channelEntries = new Map<string, { item: ChannelItem; channel: Channel }>();
    this.read = new Map<string, number>();
    this.blocked = new Set<string>();

    this.revision = 0;
    this.syncing = true;
    this.closing = false;
    this.nextRevision = null;
    this.hasSynced = false;
    this.init();
  }

  private async init() {
    let { guid } = this;
    this.revision = await this.store.getContentRevision(guid);

    let blockedMarkers = await this.store.getMarkers(guid, 'blocked_channel');
    blockedMarkers.forEach((marker) => {
      this.blocked.add(marker.id);
    });
    let readMarkers = await this.store.getMarkers(guid, 'read_channel');
    readMarkers.forEach((marker) => {
      this.read.set(marker.id, parseInt(marker.value));
    });
    let hasSyncedMarkers = await this.store.getMarkers(guid, 'first_sync_complete');
    this.hasSynced = hasSyncedMarkers.filter((marker) => (marker.id === 'stream')).length !== 0;

    // load map of channels
    let channels = await this.store.getContentChannels(guid);
    channels.forEach(({ channelId, item }) => {
      let channel = this.setChannel(channelId, item);
      this.channelEntries.set(channelId, { item, channel });
    });
    this.emitChannels();

    this.unsealAll = true;
    this.syncing = false;
    await this.sync();
    this.emitLoaded();
  }

  private parse(data: string | null): any {
    if (data) {
      try {
        if (data == null) {
          return null;
        }
        return JSON.parse(data);
      } catch (err) {
        this.log.warn('invalid channel data');
      }
    }
    return {};
  }

  private async sync(): Promise<void> {
    if (!this.syncing) {
      this.syncing = true;
      let { guid, node, secure, token, channelTypes } = this;
      while ((this.unsealAll || this.nextRevision) && !this.closing) {
        if (this.nextRevision && this.revision !== this.nextRevision) {
          let nextRev = this.nextRevision;
          try {
            let delta = await getChannels(node, secure, token, this.revision, channelTypes);
            for (let entity of delta) {
              let { id, revision, data } = entity;
              if (data) {
                let { detailRevision, topicRevision, channelSummary, channelDetail } = data;
                let entry = await this.getChannelEntry(id);

                if (detailRevision !== entry.item.detail.revision) {
                  let detail = channelDetail ? channelDetail : await getChannelDetail(node, secure, token, id);
                  entry.item.detail = {
                    revision: detailRevision,
                    sealed: detail.dataType === 'sealed',
                    dataType: detail.dataType,
                    data: detail.data,
                    created: detail.created,
                    updated: detail.updated,
                    enableImage: detail.enableImage,
                    enableAudio: detail.enableAudio,
                    enableVideo: detail.enableVideo,
                    enableBinary: detail.enableBinary,
                    contacts: detail.contacts,
                    members: detail.members,
                  };
                  entry.item.unsealedDetail = null;
                  await this.unsealChannelDetail(id, entry.item);
                  entry.channel = this.setChannel(id, entry.item);
                  if (this.focus) {
                    let { dataType, data, enableImage, enableAudio, enableVideo, enableBinary, members, created } = detail;
                    let sealed = dataType === 'sealed';
                    let channelData = sealed ? entry.item.unsealedDetail : data;
                    let focusDetail = { 
                      sealed,
                      locked: sealed && (!this.seal || !entry.item.channelKey),
                      dataType,
                      data: this.parse(channelData),
                      enableImage,
                      enableAudio, 
                      enableVideo, 
                      enableBinary,
                      created,
                      members: members.map(guid => ({ guid })),
                    }
                    this.focus.setDetail(null, id, focusDetail);
                  }
                  await this.store.setContentChannelDetail(guid, id, entry.item.detail, entry.item.unsealedDetail);
                }

                if (topicRevision !== entry.item.summary.revision) {
                  let summary = channelSummary ? channelSummary : await getChannelSummary(node, secure, token, id);
                  entry.item.summary = {
                    revision: topicRevision,
                    sealed: summary.lastTopic.dataType === 'sealedtopic',
                    guid: summary.lastTopic.guid,
                    dataType: summary.lastTopic.dataType,
                    data: summary.lastTopic.data,
                    created: summary.lastTopic.created,
                    updated: summary.lastTopic.updated,
                    status: summary.lastTopic.status,
                    transform: summary.lastTopic.transform,
                  };
                  entry.item.unsealedSummary = null;
                  await this.unsealChannelSummary(id, entry.item);
                  if (this.hasSynced) {
                    await this.markChannelUnread(id, topicRevision);
                  } else {
                    await this.markChannelRead(id, topicRevision);
                  }
                  entry.channel = this.setChannel(id, entry.item);
                  await this.store.setContentChannelSummary(guid, id, entry.item.summary, entry.item.unsealedSummary);
                }

                if (this.focus) {
                  await this.focus.setRevision(null, id, topicRevision);
                }
              } else {
                this.channelEntries.delete(id);
                if (this.focus) {
                  this.focus.disconnect(null, id);
                }
                await this.store.removeContentChannel(guid, id);
              }
            }

            this.emitChannels();
            await this.store.setContentRevision(guid, nextRev);
            this.revision = nextRev;
            this.emitLoaded();
            if (this.nextRevision === nextRev) {
              this.nextRevision = null;
            }
            this.log.info(`content revision: ${nextRev}`);
          } catch (err) {
            this.log.warn(err);
            await new Promise((r) => setTimeout(r, RETRY_POLL_MS));
          }
        }

        if (this.revision === this.nextRevision) {
          this.nextRevision = null;
        }

        if (this.unsealAll) {
          for (let [channelId, entry] of this.channelEntries.entries()) {
            try {
              let { item } = entry;
              if (await this.unsealChannelDetail(channelId, item)) {
                await this.store.setContentChannelUnsealedDetail(guid, channelId, item.unsealedDetail);
              }
              if (await this.unsealChannelSummary(channelId, item)) {
                await this.store.setContentChannelUnsealedSummary(guid, channelId, item.unsealedSummary);
              }
              entry.channel = this.setChannel(channelId, item);
            } catch (err) {
              this.log.warn(err);
            }
          }
          this.unsealAll = false;
          this.emitChannels();
        }
      }

      if (this.revision && !this.hasSynced) {
        this.hasSynced = true;
        await this.store.setMarker(this.guid, 'first_sync_complete', 'stream', '');
      }
      this.syncing = false;
    }
  }

  public addChannelListener(ev: (arg: { channels: Channel[]; cardId: string | null }) => void): void {
    this.emitter.on('channel', ev);
    let channels = Array.from(this.channelEntries, ([channelId, entry]) => entry.channel);
    ev({ channels, cardId: null });
  }

  public removeChannelListener(ev: (arg: { channels: Channel[]; cardId: string | null }) => void): void {
    this.emitter.off('channel', ev);
  }

  private emitChannels() {
    let channels = Array.from(this.channelEntries, ([channelId, entry]) => entry.channel);
    this.emitter.emit('channel', { channels, cardId: null });
  }

  public addLoadedListener(ev: (loaded: boolean) => void): void {
    this.emitter.on('loaded', ev);
    ev(this.loaded);
  }

  public removeLoadedListener(ev: (loaded: boolean) => void): void {
    this.emitter.off('loaded', ev);
  }

  private emitLoaded() {
    if (!this.loaded) {
      this.loaded = Boolean(this.revision);
      this.emitter.emit('loaded', this.loaded);
    }
  }

  public async close(): Promise<void> {
    this.closing = true;
    if (this.focus) {
      await this.focus.close();
      this.focus = null;
    }
    while (this.syncing) {
      await new Promise((r) => setTimeout(r, CLOSE_POLL_MS));
    }
  }

  public async setRevision(rev: number): Promise<void> {
    this.nextRevision = rev;
    await this.sync();
    this.emitLoaded();
  }

  public async addSealedChannel(type: string, subject: any, cardIds: string[], aesKeyHex: string, seals: { publicKey: string; sealedKey: string }[]): Promise<string> {
    let { node, secure, token, crypto, seal } = this;
    if (!crypto) {
      throw new Error('crypto not set');
    }
    if (!seal) {
      throw new Error('seal not set');
    }
    let sealKey = await crypto.rsaEncrypt(aesKeyHex, seal.publicKey);
    let hostSeal = { publicKey: seal.publicKey, sealedKey: sealKey.encryptedDataB64 };
    let { ivHex } = await crypto.aesIv();
    let subjectData = JSON.stringify(subject);
    let { encryptedDataB64 } = await crypto.aesEncrypt(subjectData, ivHex, aesKeyHex);
    let sealedSubject = { subjectEncrypted: encryptedDataB64, subjectIv: ivHex, seals: [...seals, hostSeal] };
    return await addChannel(node, secure, token, type, sealedSubject, cardIds);
  }

  public async addUnsealedChannel(type: string, subject: any, cardIds: string[]): Promise<string> {
    let { node, secure, token } = this;
    return await addChannel(node, secure, token, type, subject, cardIds);
  }

  public async removeChannel(channelId: string): Promise<void> {
    let { node, secure, token } = this;
    return await removeChannel(node, secure, token, channelId);
  }

  public async setChannelSubject(channelId: string, type: string, subject: any): Promise<void> {
    let channel = this.channelEntries.get(channelId);
    if (!channel) {
      throw new Error('channel not found');
    }
    let { item } = channel;
    let { node, secure, token, crypto, seal } = this;
    if (item.detail.sealed) {
      if (!crypto) {
        throw new Error('crypto not set');
      }
      if (!seal) {
        throw new Error('seal not set');
      }
      let { subjectIv, seals } = JSON.parse(item.detail.data);
      if (!item.channelKey) {
        item.channelKey = await this.getChannelKey(seals);
      }
      if (!item.channelKey) {
        throw new Error('channel key not available');
      }
      let subjectData = JSON.stringify(subject);
      let { encryptedDataB64 } = await crypto.aesEncrypt(subjectData, subjectIv, item.channelKey);
      let sealedSubject = { subjectEncrypted: encryptedDataB64, subjectIv, seals };
      await setChannelSubject(node, secure, token, channelId, type, sealedSubject);
    } else {
      await setChannelSubject(node, secure, token, channelId, type, subject);
    }
  }

  public async setChannelCard(channelId: string, cardId: string, getSeal: (aesKey: string)=>Promise<{publicKey: string; sealedKey: string}>): Promise<void> {
    let { node, secure, token } = this;
    let channel = this.channelEntries.get(channelId);
    if (!channel) {
      throw new Error('channel not found');
    }
    if (channel.item.detail.sealed) {
      let channelKey = channel.item.channelKey;
      if (!channelKey) {
        throw new Error('cannot add members to locked channels');
      }
      let seal = await getSeal(channelKey);
      let data = JSON.parse(channel.item.detail.data);
      let seals = [...data.seals, seal];
      let subject = { ...data, seals };
      await setChannelSubject(node, secure, token, channelId, channel.item.detail.dataType, subject); 
    }
    await setChannelCard(node, secure, token, channelId, cardId);
  }

  public async clearChannelCard(channelId: string, cardId: string): Promise<void> {
    let { node, secure, token } = this;
    let channel = this.channelEntries.get(channelId);
    if (!channel) {
      throw new Error('channel not found');
    }
    await clearChannelCard(node, secure, token, channelId, cardId);
  }

  public async getBlockedChannels(): Promise<Channel[]> {
    let channels = [] as Channel[];
    this.channelEntries.forEach((entry, channelId) => {
      if (this.isChannelBlocked(channelId)) {
        channels.push(entry.channel);
      }
    });
    return channels;
  }

  public async setBlockedChannel(channelId: string, blocked: boolean): Promise<void> {
    let entry = this.channelEntries.get(channelId);
    if (entry) {
      if (blocked) {
        await this.setChannelBlocked(channelId);
      } else {
        await this.clearChannelBlocked(channelId);
      }
      entry.channel = this.setChannel(channelId, entry.item);
      this.emitChannels();
    }
  }

  public async clearBlockedChannelTopic(channelId: string, topicId: string) {
    let { guid } = this;
    let id = `'':${channelId}:${topicId}`
    await this.store.clearMarker(guid, 'blocked_topic', id);
    if (this.focus) {
      await this.focus.clearBlockedChannelTopic(null, channelId, topicId);
    }
  }

  public async flagChannel(channelId: string): Promise<void> {
    let { node, secure, guid } = this;
    await addFlag(node, secure, guid, { channelId });
  }

  public async getChannelNotifications(channelId: string): Promise<boolean> {
    let { node, secure, token } = this;
    return await getChannelNotifications(node, secure, token, channelId);
  }

  public async setChannelNotifications(channelId: string, enabled: boolean): Promise<void> {
    let { node, secure, token } = this;
    await setChannelNotifications(node, secure, token, channelId, enabled);
  }

  public async setUnreadChannel(channelId: string, unread: boolean): Promise<void> {
    let entry = this.channelEntries.get(channelId);
    if (!entry) {
      throw new Error('channel not found');
    }
    if (unread) {
      this.read.delete(channelId);
      entry.channel = this.setChannel(channelId, entry.item);
      this.emitChannels();
      await this.store.clearMarker(this.guid, 'read_channel', channelId);
    } else {
      let revision = entry.item.summary.revision;
      this.read.set(channelId, revision);
      entry.channel = this.setChannel(channelId, entry.item);
      this.emitChannels();
      await this.store.setMarker(this.guid, 'read_channel', channelId, revision.toString());
    }
  }

  public async setFocus(channelId: string): Promise<Focus> {
    let { node, secure, token, focus } = this;
    if (focus) {
      focus.close();
    }

    let markRead = async () => {
      try {
        await this.setUnreadChannel(channelId, false);
      } catch (err) {
        this.log.error(err);
      }
    }

    let flagTopic = async (topicId: string) => {
      let { node, secure, guid } = this;
      await addFlag(node, secure, guid, { channelId, topicId }); 
    }
      
    let entry = this.channelEntries.get(channelId);
    let channelKey = entry ? await this.setChannelKey(entry.item) : null;
    let revision = entry ? entry.item.summary.revision : 0;
    let sealEnabled = Boolean(this.seal);
    this.focus = new FocusModule(this.log, this.store, this.crypto, this.staging, null, channelId, this.guid, { node, secure, token }, channelKey, sealEnabled, revision, markRead, flagTopic);

    if (entry) {
      let { dataType, data, enableImage, enableAudio, enableVideo, enableBinary, members, created } = entry.item.detail;
      let sealed = dataType === 'sealed';
      let channelData = sealed ? entry.item.unsealedDetail : data;
      let focusDetail = { 
        sealed,
        locked: sealed && (!this.seal || !entry.item.channelKey),
        dataType,
        data: this.parse(channelData),
        enableImage,
        enableAudio, 
        enableVideo, 
        enableBinary,
        created,
        members: members.map(guid => ({ guid })),
      }
      this.focus.setDetail(null, channelId, focusDetail);
    }

    return this.focus;
  }

  public clearFocus() {
    if (this.focus) {
      this.focus.close();
      this.focus = null;
    }
  }

  public async setSeal(seal: { privateKey: string; publicKey: string } | null) {
    this.seal = seal;
    if (this.focus) {
      await this.focus.setSealEnabled(Boolean(this.seal));
    }
    this.unsealAll = true;
    await this.sync();
  }

  private async getChannelKey(seals: [{ publicKey: string; sealedKey: string }]): Promise<string | null> {
    let seal = seals.find(({ publicKey }) => this.seal && publicKey === this.seal.publicKey);
    if (seal && this.crypto && this.seal) {
      let key = await this.crypto.rsaDecrypt(seal.sealedKey, this.seal.privateKey);
      return key.data;
    }
    return null;
  }

  private isChannelBlocked(channelId: string): boolean {
    return this.blocked.has(channelId);
  }

  private async setChannelBlocked(channelId: string) {
    let entry = this.channelEntries.get(channelId);
    if (!entry) {
      throw new Error('channel not found');
    }
    this.blocked.add(channelId);
    entry.channel = this.setChannel(channelId, entry.item);
    this.emitChannels();
    let timestamp = Math.floor(Date.now() / 1000);
    await this.store.setMarker(this.guid, 'blocked_channel', channelId, JSON.stringify({ cardId: null, channelId, timestamp }));
  }

  private async clearChannelBlocked(channelId: string) {
    let entry = this.channelEntries.get(channelId);
    if (!entry) {
      throw new Error('channel not found');
    }
    this.blocked.delete(channelId);
    entry.channel = this.setChannel(channelId, entry.item);
    this.emitChannels();
    await this.store.clearMarker(this.guid, 'blocked_channel', channelId);
  }

  private isChannelUnread(channelId: string, revision: number): boolean {
    if (this.read.has(channelId)) {
      let read = this.read.get(channelId);
      if (read && read >= revision) {
        return false;
      }
    }
    return true;
  }

  private async markChannelUnread(channelId: string, revision: number) {
    if (!this.read.has(channelId)) {
      let read = this.read.get(channelId);
      if (read && read < revision) {
        this.read.delete(channelId);
        await this.store.clearMarker(this.guid, 'read_channel', channelId);
      }
    }
  }

  private async markChannelRead(channelId: string, revision: number) {
    let read = this.read.get(channelId);
    if (!read || read < revision) {
      this.read.set(channelId, revision);
      await this.store.setMarker(this.guid, 'read_channel', channelId, revision.toString());
    } 
  }

  private setChannel(channelId: string, item: ChannelItem): Channel {
    let { summary, detail, channelKey } = item;
    let channelData = detail.sealed ? item.unsealedDetail : detail.data || '{}';
    let topicData = summary.sealed ? item.unsealedSummary : summary.data || '{}';
    let parsed = this.parse(topicData);
    let data = summary.sealed ? parsed?.message : parsed;

    return {
      channelId,
      cardId: null,
      lastTopic: {
        guid: summary.guid,
        sealed: summary.sealed,
        dataType: summary.dataType,
        data: getLegacyData(data).data,
        created: summary.created,
        updated: summary.updated,
        status: summary.status,
        transform: summary.transform,
      },
      blocked: this.isChannelBlocked(channelId),
      unread: this.isChannelUnread(channelId, summary.revision),
      sealed: detail.sealed,
      locked: detail.sealed && (!this.seal || !channelKey),
      dataType: detail.dataType,
      data: this.parse(channelData),
      created: detail.created,
      updated: detail.updated,
      enableImage: detail.enableImage,
      enableAudio: detail.enableAudio,
      enableVideo: detail.enableVideo,
      enableBinary: detail.enableBinary,
      members: detail.members.map((guid) => ({ guid })),
    };
  }

  private async getChannelEntry(channelId: string) {
    let { guid } = this;
    let entry = this.channelEntries.get(channelId);
    if (entry) {
      return entry;
    }
    let item = JSON.parse(JSON.stringify(defaultChannelItem));
    let channel = this.setChannel(channelId, item);
    let channelEntry = { item, channel };
    this.channelEntries.set(channelId, channelEntry);
    await this.store.addContentChannel(guid, channelId, item);
    return channelEntry;
  }

  private async setChannelKey(item: ChannelItem) {
    if (!item.channelKey && item.detail.dataType === 'sealed' && this.seal && this.crypto) {
      try {
        let { seals } = JSON.parse(item.detail.data);
        item.channelKey = await this.getChannelKey(seals);
      } catch (err) {
        console.log(err);
      }
    }
    return item.channelKey;
  }

  private async unsealChannelDetail(channelId: string, item: ChannelItem): Promise<boolean> {
    if (item.unsealedDetail == null && item.detail.dataType === 'sealed' && this.seal && this.crypto) {
      try {
        let { subjectEncrypted, subjectIv, seals } = JSON.parse(item.detail.data);
        if (!item.channelKey) {
          item.channelKey = await this.getChannelKey(seals);
          if (this.focus) {
            try {
              await this.focus.setChannelKey(null, channelId, item.channelKey);
            } catch (err) {
              this.log.warn(err);
            }
          }
        }
        if (item.channelKey) {
          let { data } = await this.crypto.aesDecrypt(subjectEncrypted, subjectIv, item.channelKey);
          item.unsealedDetail = data;
          if (this.focus) {
            let { dataType, enableImage, enableAudio, enableVideo, enableBinary, members, created } = item.detail;
            let focusDetail = { 
              sealed: true,
              locked: false,
              dataType,
              data: this.parse(data),
              enableImage,
              enableAudio, 
              enableVideo, 
              enableBinary, 
              created,
              members: members.map(guid => ({ guid })),
            }
            this.focus.setDetail(null, channelId, focusDetail);
          }
          return true;
        }
      } catch (err) {
        this.log.warn(err);
      }
    }
    return false;
  }

  private async unsealChannelSummary(channelId: string, item: ChannelItem): Promise<boolean> {
    if (item.unsealedSummary == null && item.summary.status === 'confirmed' && item.summary.dataType === 'sealedtopic' && this.seal && this.crypto) {
      try {
        if (!item.channelKey) {
          let { seals } = JSON.parse(item.detail.data);
          item.channelKey = await this.getChannelKey(seals);
          if (this.focus) {
            try {
              await this.focus.setChannelKey(null, channelId, item.channelKey);
            } catch (err) {
              this.log.warn(err);
            }
          }
        }
        if (item.channelKey) {
          let { messageEncrypted, messageIv } = JSON.parse(item.summary.data);
          if (!messageEncrypted || !messageIv) {
            this.log.warn('invalid sealed summary');
          } else {
            let { data } = await this.crypto.aesDecrypt(messageEncrypted, messageIv, item.channelKey);
            item.unsealedSummary = data;
            return true;
          }
        }
      } catch (err) {
        this.log.warn(err);
      }
    }
    return false;
  }
}
