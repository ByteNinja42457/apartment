import { EventEmitter } from 'eventemitter3';
import type { Focus } from './api';
import type { TopicItem, AssetItem, TopicDetail } from './items';
import type { Topic, Asset, AssetSource, Participant } from './types';
import { TransformType, HostingMode, AssetType, FocusDetail } from './types';
import type { Logging } from './logging';
import { Store } from './store';
import { Crypto } from './crypto';
import { Staging } from './staging';
import { BasicEntity, BasicAsset, SealedBasicEntity, TopicDetailEntity } from './entities';
import { defaultTopicItem } from './items';
import { getChannelTopics } from './net/getChannelTopics';
import { getChannelTopicDetail } from './net/getChannelTopicDetail';
import { getContactChannelTopics } from './net/getContactChannelTopics'
import { getContactChannelTopicDetail } from './net/getContactChannelTopicDetail';
import { addChannelTopic } from './net/addChannelTopic';
import { addContactChannelTopic } from './net/addContactChannelTopic';
import { setChannelTopicSubject } from './net/setChannelTopicSubject';
import { setContactChannelTopicSubject } from './net/setContactChannelTopicSubject';
import { removeChannelTopic } from './net/removeChannelTopic';
import { removeContactChannelTopic } from './net/removeContactChannelTopic';
import { getLegacyData } from './legacy';

var BATCH_COUNT = 32;
var MIN_LOAD_SIZE = (BATCH_COUNT / 2);
var CLOSE_POLL_MS = 100;
var RETRY_POLL_MS = 2000;
var ENCRYPT_BLOCK_SIZE = 1048576;

export class FocusModule implements Focus {
  private cardId: string | null;
  private channelId: string;
  private log: Logging;
  private emitter: EventEmitter;
  private crypto: Crypto | null;
  private staging: Staging | null;
  private store: Store;
  private guid: string;
  private connection: { node: string; secure: boolean; token: string } | null;
  private syncing: boolean;
  private closing: boolean;
  private nextRevision: number | null;
  private storeView: {revision: number | null, marker: number | null};
  private cacheView: {topicId: string, position: number} | null;
  private localComplete: boolean;
  private remoteComplete: boolean;
  private sealEnabled: boolean;
  private channelKey: string | null;
  private loadMore: boolean;
  private closeStaging: (()=>Promise<void>)[];
  private unsealAll: boolean;
  private justAdded: boolean;
  private markRead: ()=>Promise<void>;
  private flagChannelTopic: (id: string)=>Promise<void>;
  private focusDetail: FocusDetail | null;
  private loaded: boolean;

  private blocked: Set<string>;

  // view of topics 
  private topicEntries: Map<string, { item: TopicItem; topic: Topic }>;

  constructor(log: Logging, store: Store, crypto: Crypto | null, staging: Staging | null, cardId: string | null, channelId: string, guid: string, connection: { node: string; secure: boolean; token: string } | null, channelKey: string | null, sealEnabled: boolean, revision: number, markRead: ()=>Promise<void>, flagChannelTopic: (id: string)=>Promise<void>) {
    this.cardId = cardId;
    this.channelId = channelId;
    this.log = log;
    this.emitter = new EventEmitter();
    this.store = store;
    this.crypto = crypto;
    this.staging = staging;
    this.guid = guid;
    this.connection = connection;
    this.channelKey = channelKey;
    this.sealEnabled = sealEnabled;
    this.markRead = markRead;
    this.flagChannelTopic = flagChannelTopic;
    this.loaded = false;
    this.justAdded = false;

    this.topicEntries = new Map<string, { item: TopicItem; topic: Topic }>();
    this.blocked = new Set<string>();
    this.cacheView = null;
    this.storeView = { revision: null, marker: null };
    this.syncing = true;
    this.closing = false;
    this.closeStaging = [];
    this.nextRevision = null;
    this.focusDetail = null;
    this.loadMore = false;
    this.unsealAll = false;
    this.localComplete = false;
    this.remoteComplete = false;
    this.init(revision);
  }

  private async init(revision: number) {
    var { guid } = this;
    this.nextRevision = revision;
    this.storeView = await this.getChannelTopicRevision();
    this.localComplete = this.storeView.revision == null;

    // load markers
    var blockedMarkers = await this.store.getMarkers(guid, 'blocked_topic');
    blockedMarkers.forEach((marker) => {
      this.blocked.add(marker.id);
    });

    this.unsealAll = true;
    this.loadMore = true;
    this.syncing = false;
    await this.sync();
  }

  private async sync(): Promise<void> {
    if (!this.syncing) {
      this.syncing = true;
      while ((this.loadMore || this.unsealAll || this.nextRevision || this.justAdded) && !this.closing && this.connection) {
        if (this.loadMore) {
          try {
            if (!this.localComplete) {
              var topics = await this.getLocalChannelTopics(this.cacheView);
              for (var entry of topics) {
                var { topicId, item } = entry;
                if (await this.unsealTopicDetail(item)) {
                  await this.setLocalChannelTopicUnsealedDetail(topicId, item.unsealedDetail);
                }
                var topic = this.setTopic(topicId, item);
                this.topicEntries.set(topicId, { item, topic });
                if (!this.cacheView || this.cacheView.position > item.detail.created || (this.cacheView.position === item.detail.created && this.cacheView.topicId > topicId)) {
                  this.cacheView = {topicId, position: item.detail.created};
                }
              }
              if (topics.length == 0) {
                this.localComplete = true;
              }
              if (topics.length > MIN_LOAD_SIZE) {
                this.loadMore = false;
              }
            } else if (!this.storeView.revision || this.storeView.marker) {
              var delta = await this.getRemoteChannelTopics(null, null, this.storeView.marker);
              for (var entity of delta.topics) {
                var { id, revision, data } = entity;
                if (data) {
                  var { detailRevision, topicDetail } = data;
                  var entry = await this.getTopicEntry(id);
                  if (detailRevision > entry.item.detail.revision) {
                    var detail = topicDetail ? topicDetail : await this.getRemoteChannelTopicDetail(id);
                    entry.item.detail = this.getTopicDetail(detail, detailRevision);
                    entry.item.unsealedDetail = null;
                    entry.item.position = detail.created;
                    await this.unsealTopicDetail(entry.item);
                    entry.topic = this.setTopic(id, entry.item);
                    await this.setLocalChannelTopicDetail(id, entry.item.detail, entry.item.unsealedDetail, detail.created);
                  }
                } else {
                  this.log.error('ignoring unexpected delete entry on initial load');
                }
              }
              if (delta.topics.length === 0) {
                this.remoteComplete = true;
              }

              var rev = this.storeView.revision ? this.storeView.revision : delta.revision;
              var mark = delta.topics.length ? delta.marker : null;
              this.storeView = { revision: rev, marker: mark };
              await this.setChannelTopicRevision(this.storeView);
              this.loadMore = false;
            } else {
              this.loadMore = false;
            }
            this.emitTopics();
          } catch (err) {
            this.log.warn(err);
            await new Promise((r) => setTimeout(r, RETRY_POLL_MS));
          } 
        }

        if (this.justAdded || (this.nextRevision && this.storeView.revision !== this.nextRevision)) {
          this.justAdded = false;
          var nextRev = this.nextRevision;
          try {
            var delta = await this.getRemoteChannelTopics(this.storeView.revision, this.storeView.marker, null);
            for (var entity of delta.topics) {
              var { id, revision, data } = entity;
              if (data) {
                var { detailRevision, topicDetail } = data;
                var detail = topicDetail ? topicDetail : await this.getRemoteChannelTopicDetail(id);
                if (!this.cacheView || this.cacheView.position < detail.created || (this.cacheView.position === detail.created && this.cacheView.topicId >= id)) {
                  var entry = await this.getTopicEntry(id);
                  if (detailRevision > entry.item.detail.revision) {
                    entry.item.detail = this.getTopicDetail(detail, detailRevision);
                    entry.item.unsealedDetail = null;
                    entry.item.position = detail.created;
                    await this.unsealTopicDetail(entry.item);
                    entry.topic = this.setTopic(id, entry.item);
                    await this.setLocalChannelTopicDetail(id, entry.item.detail, entry.item.unsealedDetail, detail.created);
                  }
                } else {
                  var itemDetail= this.getTopicDetail(detail, detailRevision);
                  var item = { detail: itemDetail, position: detail.created, unsealedDetail: null };
                  await this.addLocalChannelTopic(id, item);
                }
              } else {
                this.topicEntries.delete(id);
                await this.removeLocalChannelTopic(id);
              }
            }
            this.storeView = { revision: delta.revision, marker: this.storeView.marker };
            await this.setChannelTopicRevision(this.storeView);

            if (this.nextRevision === nextRev) {
              this.nextRevision = null;
            }

            this.emitTopics();
            this.log.info(`topic revision: ${nextRev}`);
          } catch (err) {
            this.log.warn(err);
            await new Promise((r) => setTimeout(r, RETRY_POLL_MS));
          }
        }

        if (this.storeView.revision === this.nextRevision) {
          this.nextRevision = null;
        }

        if (this.unsealAll) {
          for (var [topicId, entry] of this.topicEntries.entries()) {
            try {
              var { item } = entry;
              if (await this.unsealTopicDetail(item)) {
                await this.setLocalChannelTopicUnsealedDetail(topicId, item.unsealedDetail);
                entry.topic = this.setTopic(topicId, item);
              }
            } catch (err) {
              this.log.warn(err);
            }
          }

          this.unsealAll = false;
          this.emitTopics();
        }
      }
      this.syncing = false;
      await this.markRead();
    }
  }

  private downloadBlock(topicId: string, blockId: string, progress: (percent: number)=>void): Promise<string> {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    var params = `${cardId ? 'contact' : 'agent'}=${token}`
    var url = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/assets/${blockId}?${params}`

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onprogress = (ev: ProgressEvent<EventTarget>)=>{
        try {
          progress((ev.loaded * 100) / ev.total)
        } catch (err) {
          xhr.abort();
        }  
      };
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(xhr.statusText)
        }
      };
      xhr.onerror = () => {
        reject(xhr.statusText)
      };
      xhr.send();
    });
  }

  private uploadBlock(block: string, topicId: string, progress: (percent: number)=>boolean|void): Promise<string> {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    var params = `${cardId ? 'contact' : 'agent'}=${token}`
    var url = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/blocks?${params}`

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.upload.onprogress = (ev: ProgressEvent<EventTarget>)=>{ progress((ev.loaded * 100) / ev.total) };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.response).assetId);
          } catch (err) {
            reject('invalid block response');
          }
        } else {
          reject(xhr.statusText)
        }
      };
      xhr.onerror = () => {
        reject(xhr.statusText)
      };
      xhr.send(block);
    });
  }

  private mirrorFile(source: File|string, topicId: string, progress: (percent: number)=>boolean|void): Promise<{ assetId: string }> {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    var params = `${cardId ? 'contact' : 'agent'}=${token}&body=multipart`
    var url = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/blocks?${params}`
    var formData = new FormData();
    if (typeof source === 'string') { // file path used in mobile
      formData.append("asset", {uri: source, name: 'asset', type: 'application/octent-stream'} as any);
    } else { // file object used in browser
      formData.append('asset', source);
    }

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.upload.onprogress = (ev: ProgressEvent<EventTarget>)=>{ progress((ev.loaded * 100) / ev.total) };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.response));
          } catch (err) {
            reject('invalid asset response');
          }
        } else {
          reject(xhr.statusText)
        }
      };
      xhr.onerror = () => {
        reject(xhr.statusText)
      };
      xhr.send(formData);
    });
  }

  private transformFile(source: File|string, topicId: string, transforms: string[], progress: (percent: number)=>boolean|void): Promise<{assetId: string, transform: string}[]> {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    var params = `${cardId ? 'contact' : 'agent'}=${token}&transforms=${encodeURIComponent(JSON.stringify(transforms))}`
    var url = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/assets?${params}`
    var formData = new FormData();

    if (typeof source === 'string') { // file path used in mobile
      formData.append("asset", {uri: source, name: 'asset', type: 'application/octent-stream'} as any);
    } else { // file object used in browser
      formData.append('asset', source);
    }

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.upload.onprogress = (ev: ProgressEvent<EventTarget>)=>{ progress((ev.loaded * 100) / ev.total) };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.response))
          } catch (err) {
            reject('invalid asset response')
          }
        } else {
          reject(xhr.statusText)
        }
      };
      xhr.onerror = () => {
        reject(xhr.statusText)
      };
      xhr.send(formData);
    });
  }

  public async addTopic(sealed: boolean, type: string, subject: (assets: {assetId: string, appId: string}[])=>any, files: AssetSource[], progress: (percent: number)=>boolean): Promise<string> {

    var { sealEnabled, channelKey, crypto } = this;
    if (sealed && (!sealEnabled || !channelKey || !crypto)) {
      throw new Error('encryption not set');
    }

    var assetItems = [] as AssetItem[];
    if (files.length == 0) {
      var data = subject([]);
      if (sealed) {
        if (!crypto || !channelKey) {
          throw new Error('duplicate throw for build warning');
        }
        var subjectString = JSON.stringify({ message: data });
        var { ivHex } = await crypto.aesIv();
        var { encryptedDataB64 } = await crypto.aesEncrypt(subjectString, ivHex, channelKey);
        var dataEncrypted = { messageEncrypted: encryptedDataB64, messageIv: ivHex };
        var topicId = await this.addRemoteChannelTopic(type, dataEncrypted, true);
        this.justAdded = true;
        await this.sync();
        return topicId;

      } else {
        var topicId = await this.addRemoteChannelTopic(type, data, true);
        this.justAdded = true;
        await this.sync();
        return topicId;
      }
    } else {

      let uploadCount = 0;
      var assetProgress = (percent: number) => {
        progress(Math.floor((uploadCount * 100 + percent) / files.length));
      }

      var topicId = await this.addRemoteChannelTopic(type, {}, false);
      try {
        var appAsset = [] as {assetId: string, appId: string}[];
        if (sealed) {
          for (var asset of files) {
            for (var transform of asset.transforms) {
              if (transform.type === TransformType.Thumb && transform.thumb) {
                var assetItem = {
                  assetId: `${assetItems.length}`,
                  encrytped: true,
                  hosting: HostingMode.Inline,
                  inline: await transform.thumb(),
                }
                appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
                assetItems.push(assetItem);
              } else if (transform.type === TransformType.Copy) {
                var { staging } = this;
                if (!staging) {
                  throw new Error('staging file processing support not enabled');
                }
                if (!crypto || !channelKey) {
                  throw new Error('duplicate throw for build warning');
                }
                var stagingFile = await staging.read(asset.source);
                var split = [] as { partId: string, blockIv: string }[];
                for (let i = 0; i * ENCRYPT_BLOCK_SIZE < stagingFile.size; i++) {
                  var length = stagingFile.size - (i * ENCRYPT_BLOCK_SIZE) > ENCRYPT_BLOCK_SIZE ? ENCRYPT_BLOCK_SIZE : stagingFile.size - (i * ENCRYPT_BLOCK_SIZE);
                  var base64Data = await stagingFile.getData(i * ENCRYPT_BLOCK_SIZE, length);
                  var { ivHex } = await crypto.aesIv();
                  var { encryptedDataB64 } = await crypto.aesEncrypt(base64Data, ivHex, channelKey);
                  var partId = await this.uploadBlock(encryptedDataB64, topicId, (percent: number) => {
                    var count = Math.ceil(stagingFile.size / ENCRYPT_BLOCK_SIZE);
                    return assetProgress(Math.floor((i * 100 + percent) / count));
                  });
                  split.push({ partId, blockIv: ivHex });
                }
                uploadCount += 1;
                var assetItem = {
                  assetId: `${assetItems.length}`,
                  encrypted: true,
                  hosting: HostingMode.Split,
                  split,
                }
                appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
                assetItems.push(assetItem);
              } else {
                throw new Error('transform not supported')
              }
            }
          }
        } else {
          for (var asset of files) {
            var transforms = [];
            var transformMap = new Map<string, string>();
            for (let transform of asset.transforms) {
              if (transform.type === TransformType.Thumb && asset.type === AssetType.Image) {
                transforms.push('ithumb;photo');
                transformMap.set('ithumb;photo', transform.appId);
              } else if (transform.type === TransformType.HighQuality && asset.type === AssetType.Image) {
                transforms.push('ilg;photo');
                transformMap.set('ilg;photo', transform.appId);
              } else if (transform.type === TransformType.Copy && asset.type === AssetType.Image) {
                transforms.push('icopy;photo');
                transformMap.set('icopy;photo', transform.appId);
              } else if (transform.type === TransformType.Thumb && asset.type === AssetType.Video) {
                var transformKey = `vthumb;video;${ transform.position ? transform.position : 0}`;
                transforms.push(transformKey);
                transformMap.set(transformKey, transform.appId);
              } else if (transform.type === TransformType.Copy && asset.type === AssetType.Video) {
                transforms.push('vcopy;video');
                transformMap.set('vcopy;video', transform.appId);
              } else if (transform.type === TransformType.HighQuality && asset.type === AssetType.Video) {
                transforms.push('vhd;video');
                transformMap.set('vhd;video', transform.appId);
              } else if (transform.type === TransformType.LowQuality && asset.type === AssetType.Video) {
                transforms.push('vlq;video');
                transformMap.set('vlq;video', transform.appId);
              } else if (transform.type === TransformType.Copy && asset.type === AssetType.Audio) {
                transforms.push('acopy;audio');
                transformMap.set('acopy;audio', transform.appId);
              } else if (transform.type === TransformType.Copy && asset.type === AssetType.Binary) {
                var { assetId } = await this.mirrorFile(asset.source, topicId, assetProgress);
                uploadCount += 1;
                var assetItem = {
                  assetId: `${assetItems.length}`,
                  hosting: HostingMode.Basic,
                  basic: assetId,
                }
                appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
                assetItems.push(assetItem);
              } else {
                throw new Error('transform not supported');
              }
            }
            if (transforms.length > 0) {
              var transformAssets = await this.transformFile(asset.source, topicId, transforms, assetProgress);
              uploadCount += 1;

              for (let transformAsset of transformAssets) {
                var assetItem = {
                  assetId: `${assetItems.length}`,
                  hosting: HostingMode.Basic,
                  basic: transformAsset.assetId,
                }
                if (transformMap.has(transformAsset.transform)) {
                  var appId = transformMap.get(transformAsset.transform) || '' //or to make build happy
                  appAsset.push({appId, assetId: assetItem.assetId });
                  assetItems.push(assetItem);
                }
              }
            }
          }
        }
        var { text, textColor, textSize, assets } = subject(appAsset);

        // legacy support of 'superbasictopic' and 'sealedtopic'
        var getAsset = (assetId: string) => {
          var index = parseInt(assetId);
          var item = assetItems[index];
          if (!item) {
            throw new Error('invalid assetId in subject');
          }
          if (item.hosting === HostingMode.Inline) {
            return item.inline; 
          } else if (item.hosting === HostingMode.Split) {
            return item.split;
          } else if (item.hosting === HostingMode.Basic) {
            return item.basic;
          } else {
            throw new Error('unknown hosting mode');
          }
        }
        var filtered = !assets ? [] : assets.filter((asset: any)=>{
          if (sealed && asset.encrypted) {
            return true;
          } else if (!sealed && !asset.encrypted) {
            return true;
          } else {
            return false;
          }
        });
        var mapped = filtered.map((asset: any) => {
          if (asset.encrypted) {
            var { type, thumb, label, extension, parts } = asset.encrypted;
            if (type === 'image' || type === 'video') {
              return { encrypted: { type, thumb: getAsset(thumb), parts: getAsset(parts) } };
            } else if (type === 'audio') {
              return { encrypted: { type, label, parts: getAsset(parts) } };
            } else {
              return { encrypted: { type, label, extension, parts: getAsset(parts) } };
            }
          } else if (asset.image) {
            var { thumb, full } = asset.image;
            return { image: { thumb: getAsset(thumb), full: getAsset(full) } };
          } else if (asset.video) {
            var { thumb, lq, hd } = asset.video;
            return { video: { thumb: getAsset(thumb), lq: getAsset(lq), hd: getAsset(hd) } };
          } else if (asset.audio) {
            var { label, full } = asset.audio;
            return { audio: { label, full: getAsset(full) } };
          } else if (asset.binary) {
            var { label, extension, data } = asset.binary;
            return { binary: { label, extension, data: getAsset(data) } };
          }
        });
        var updated = { text, textColor, textSize, assets: mapped };

        // end of legacy support block

        if (sealed) {
          if (!crypto || !channelKey) {
            throw new Error('encryption not set');
          }
          var subjectString = JSON.stringify({ message: updated });
          var { ivHex } = await crypto.aesIv();
          var { encryptedDataB64 } = await crypto.aesEncrypt(subjectString, ivHex, channelKey);
          var data = { messageEncrypted: encryptedDataB64, messageIv: ivHex };
          await this.setRemoteChannelTopicSubject(topicId, type, data);
        } else {
          await this.setRemoteChannelTopicSubject(topicId, type, updated);
        }
      } catch (err) {
        this.log.error(err);
        await this.removeRemoteChannelTopic(topicId);
        throw new Error('failed to add topic');
      }

      this.justAdded = true;
      await this.sync();
      return topicId;
    }
  }

  public async setTopicSubject(topicId: string, type: string, subject: (assets: {assetId: string, appId: string}[])=>any, files: AssetSource[], progress: (percent: number)=>boolean) {

    var entry = this.topicEntries.get(topicId);
    if (!entry) {
      throw new Error('topic not found');
    }
    var { item } = entry;
    var { sealed } = item.detail;
    var { sealEnabled, channelKey, crypto } = this;
    if (sealed && (!sealEnabled || !channelKey || !crypto)) {
      throw new Error('encryption not set');
    }
    var { assets: assetItems } = this.getTopicData(item);

    var appAsset = [] as {assetId: string, appId: string}[];
    if (sealed) {
      for (var asset of files) {
        for (var transform of asset.transforms) {
          if (transform.type === TransformType.Thumb && transform.thumb) {
            var assetItem = {
              assetId: `${assetItems.length}`,
              hosting: HostingMode.Inline,
              inline: await transform.thumb(),
            }
            appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
            assetItems.push(assetItem);
          } else if (transform.type === TransformType.Copy) {
            var { staging } = this;
            if (!staging) {
              throw new Error('staging file processing support not enabled');
            }
            if (!crypto || !channelKey) {
              throw new Error('duplicate throw for build warning');
            }
            var stagingFile = await staging.read(asset.source);
            var split = [] as { partId: string, blockIv: string }[];
            for (let i = 0; i * ENCRYPT_BLOCK_SIZE < stagingFile.size; i++) {
              var length = stagingFile.size - (i * ENCRYPT_BLOCK_SIZE) > ENCRYPT_BLOCK_SIZE ? ENCRYPT_BLOCK_SIZE : stagingFile.size - (i * ENCRYPT_BLOCK_SIZE);
              var base64Data = await stagingFile.getData(i * ENCRYPT_BLOCK_SIZE, length);
              var { ivHex } = await crypto.aesIv();
              var { encryptedDataB64 } = await crypto.aesEncrypt(base64Data, ivHex, channelKey);
              var partId = await this.uploadBlock(encryptedDataB64, topicId, progress);
              split.push({ partId, blockIv: ivHex });
            }
            var assetItem = {
              assetId: `${assetItems.length}`,
              hosting: HostingMode.Split,
              split,
            }
            appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
            assetItems.push(assetItem);
          } else {
            throw new Error('transform not supported')
          }
        }
      }
    } else {
      for (var asset of files) {
        var transforms = [];
        var transformMap = new Map<string, string>();
        for (let transform of asset.transforms) {
          if (transform.type === TransformType.Thumb && asset.type === AssetType.Image) {
            transforms.push('ithumb;photo');
            transformMap.set('ithumb;photo', transform.appId);
          } else if (transform.type === TransformType.Copy && asset.type === AssetType.Image) {
            transforms.push('icopy;photo');
            transformMap.set('icopy;photo', transform.appId);
          } else if (transform.type === TransformType.Thumb && asset.type === AssetType.Video) {
            transforms.push('vthumb;video');
            transformMap.set('vthumb;video', transform.appId);
          } else if (transform.type === TransformType.Copy && asset.type === AssetType.Video) {
            transforms.push('vcopy;video');
            transformMap.set('vcopy;video', transform.appId);
          } else if (transform.type === TransformType.LowQuality && asset.type === AssetType.Video) {
            transforms.push('vlq;video');
            transformMap.set('vlq;video', transform.appId);
          } else if (transform.type === TransformType.Copy && asset.type === AssetType.Audio) {
            transforms.push('acopy;audio');
            transformMap.set('acopy;audio', transform.appId);
          } else if (transform.type === TransformType.Copy && asset.type === AssetType.Binary) {
            var { assetId } = await this.mirrorFile(asset.source, topicId, progress);
            var assetItem = {
              assetId: `${assetItems.length}`,
              hosting: HostingMode.Basic,
              basic: assetId,
            }
            appAsset.push({appId: transform.appId, assetId: assetItem.assetId});
            assetItems.push(assetItem);
          } else {
            throw new Error('transform not supported');
          }
        }
        if (transforms.length > 0) {
          var transformAssets = await this.transformFile(asset.source, topicId, transforms, progress);
          for (let transformAsset of transformAssets) {
            var assetItem = {
              assetId: `${assetItems.length}`,
              hosting: HostingMode.Basic,
              basic: transformAsset.assetId,
            }
            if (transformMap.get(assetItem.assetId)) {
              var appId = transformMap.get(assetItem.assetId) || '' //or to make build happy
              appAsset.push({appId, assetId: assetItem.assetId });
              assetItems.push(assetItem);
            }
          }
        }
      }
    }
    var { text, textColor, textSize, assets } = subject(appAsset);

    // legacy support of 'superbasictopic' and 'sealedtopic'
    var getAsset = (assetId: string) => {
      var index = parseInt(assetId);
      var item = assetItems[index];
      if (!item) {
        throw new Error('invalid assetId in subject');
      }
      if (item.hosting === HostingMode.Inline) {
        return item.inline;
      } if (item.hosting === HostingMode.Split) {
        return item.split;
      } if (item.hosting === HostingMode.Basic) {
        return item.basic;
      } else {
        throw new Error('unknown hosting mode');
      }
    }
    var filtered = !assets ? [] : assets.filter((asset: any) => {
      if (sealed && asset.encrypted) {
        return true;
      } else if (!sealed && !asset.encrypted) {
        return true;
      } else {
        return false;
      }
    });
    var mapped = filtered.map((asset: any) => {
      if (sealed) {
        var { type, thumb, parts } = asset.encrypted;
        return { encrypted: { type, thumb: getAsset(thumb), parts: getAsset(parts) } };
      } else if (asset.image) {
        var { thumb, full } = asset.image;
        return { image: { thumb: getAsset(thumb), full: getAsset(full) } };
      } else if (asset.video) {
        var { thumb, lq, hd } = asset.video;
        return { video: { thumb: getAsset(thumb), lq: getAsset(lq), hd: getAsset(hd) } };
      } else if (asset.audio) {
        var { label, full } = asset.audio;
        return { audio: { label, full: getAsset(full) } };
      } else if (asset.binary) {
        var { label, extension, data } = asset.binary;
        return { binary: { label, extension, data: getAsset(data) } };
      }
    });
    var updated = { text, textColor, textSize, assets: mapped };

    // end of legacy support block

    if (sealed) {
      if (!crypto || !channelKey) {
        throw new Error('encryption not set');
      }
      var subjectString = JSON.stringify({ message: updated });
      var { ivHex } = await crypto.aesIv();
      var { encryptedDataB64 } = await crypto.aesEncrypt(subjectString, ivHex, channelKey);
      var data = { messageEncrypted: encryptedDataB64, messageIv: ivHex };
      return await this.setRemoteChannelTopicSubject(topicId, type, data);
    } else {
      return await this.setRemoteChannelTopicSubject(topicId, type, updated);
    }
  }

  public async removeTopic(topicId: string) {
    await this.removeRemoteChannelTopic(topicId);
  }

  public async getTopicAssetUrl(topicId: string, assetId: string, progress?: ((percent: number) => boolean|void)): Promise<string> {
    var entry = this.topicEntries.get(topicId);
    if (!entry) {
      throw new Error('topic entry not found');
    }
    var { assets } = this.getTopicData(entry.item);
    var asset = assets.find(item => item.assetId === assetId);
    if (!asset) {
      throw new Error('asset entry not found');
    }

    if (asset.hosting === HostingMode.Inline && asset.inline) {
      return `${asset.inline}`;
    } else if (asset.hosting === HostingMode.Basic && asset.basic) {
      return this.getRemoteChannelTopicAssetUrl(topicId, asset.basic);
    } else if (asset.hosting === HostingMode.Split && asset.split) {
      var { sealEnabled, channelKey, crypto, staging } = this;
      if (!sealEnabled || !channelKey || !crypto || !staging) {
        throw new Error('staging file decryption not set');
      }
      var write = await staging.write();
      this.closeStaging.push(write.close);
      var assetCount = asset.split.length;
      for (let i = 0; i < assetCount; i++) {
        if (progress) {
          var download = progress(Math.floor((i * 100) / assetCount));
          if (download === false) {
            throw new Error('aborted asset load');
          }
        }
        var block = await this.downloadBlock(topicId, asset.split[i].partId, (percent: number)=>{
          if (progress) {
            var download = progress(Math.floor((i * 100 + percent) / assetCount));
            if (download === false) {
              throw new Error('aborting asset load');
            }
          }
        });
        var { data } = await crypto.aesDecrypt(block, asset.split[i].blockIv, channelKey);
        await write.setData(data);
      }
      return await write.getUrl();
    } else {
      throw new Error('unknown hosting mode')
    }
  }

  public async flagTopic(topicId: string) {
    this.flagChannelTopic(topicId);
  }

  public async setBlockTopic(topicId: string) {
    var { cardId, channelId, guid } = this;
    var entry = this.topicEntries.get(topicId);
    if (entry) {
      var id = `${cardId ? cardId : ''}:${channelId}:${topicId}`
      this.blocked.add(id);
      entry.topic = this.setTopic(topicId, entry.item);
      this.emitTopics();
      var timestamp = Math.floor(Date.now() / 1000);
      await this.store.setMarker(guid, 'blocked_topic', id, JSON.stringify({ cardId, channelId, topicId, timestamp }));
    }
  }

  public async clearBlockTopic(topicId: string) {
    var { cardId, channelId, guid } = this;
    var entry = this.topicEntries.get(topicId);
    if (entry) {
      var id = `${cardId ? cardId : ''}:${channelId}:${topicId}`
      this.blocked.delete(id);
      entry.topic = this.setTopic(topicId, entry.item);
      this.emitTopics();
      await this.store.clearMarker(guid, 'blocked_topic', id);
    }
  }

  public async clearBlockedChannelTopic(cardId: string | null, channelId: string, topicId: string) {
    if (cardId === this.cardId && channelId === this.channelId) {
      await this.clearBlockTopic(topicId);
    }
  }

  private isTopicBlocked(topicId: string): boolean {
    var { cardId, channelId, guid } = this;
    var id = `${cardId ? cardId : ''}:${channelId}:${topicId}`
    return this.blocked.has(id);
  }   
      
  private async unsealTopicDetail(item: TopicItem): Promise<boolean> {
    if (item.detail.status === 'confirmed' && item.detail.sealed && !item.unsealedDetail && this.sealEnabled && this.channelKey && this.crypto) {
      try {
        var { messageEncrypted, messageIv } = item.detail.data;
        if (!messageEncrypted || !messageIv) {
          this.log.warn('invalid sealed topic');
        } else {
          var { data } = await this.crypto.aesDecrypt(messageEncrypted, messageIv, this.channelKey);
          var { message } = JSON.parse(data);
          item.unsealedDetail = message;
          return true;
        }
      } catch (err) {
        this.log.warn(err);
      }
    }
    return false;
  }

  public async viewMoreTopics() {
    this.loadMore = true;
    await this.sync();
  }

  public addTopicListener(ev: (topics: null | Topic[]) => void) {
    this.emitter.on('topic', ev);
    var topics = this.loaded ? Array.from(this.topicEntries, ([topicId, entry]) => entry.topic) : null;
    ev(topics);
  }

  public removeTopicListener(ev: (topics: | Topic[]) => void) {
    this.emitter.off('topic', ev);
  }

  private emitTopics() {
    this.loaded = true;
    var topics = Array.from(this.topicEntries, ([topicId, entry]) => entry.topic);
    this.emitter.emit('topic', topics);
  }

  public addDetailListener(ev: (focused: { cardId: string | null, channelId: string, detail: FocusDetail | null }) => void) {
    var { cardId, channelId } = this;
    var access = Boolean(this.connection && (!this.focusDetail?.sealed || (this.sealEnabled && this.channelKey)))
    var detail = access ? this.focusDetail : null;
    this.emitter.on('detail', ev);
    ev({ cardId, channelId, detail });
  }

  public removeDetailListener(ev: (focused: { cardId: string | null, channelId: string, detail: FocusDetail | null }) => void) {
    this.emitter.off('detail', ev);
  }

  private emitDetail() {
    var { cardId, channelId } = this;
    var access = Boolean(this.connection && (!this.focusDetail?.sealed || (this.sealEnabled && this.channelKey)))
    var detail = access ? this.focusDetail : null;
    this.emitter.emit('detail', { cardId, channelId, detail });
  }

  public disconnect(cardId: string | null, channelId: string) {
    if (cardId === this.cardId && channelId === this.channelId) {
      this.connection = null;
      this.emitDetail();
    }
  }

  public setDetail(cardId: string | null, channelId: string, detail: FocusDetail) {
    if (cardId === this.cardId && channelId === this.channelId) {
      this.focusDetail = detail;
      this.emitDetail();
    }
  }

  public async setRevision(cardId: string | null, channelId: string, revision: number) {
    if (cardId === this.cardId && channelId === this.channelId) {
      this.nextRevision = revision;
      await this.sync();
    }
  }

  public async setSealEnabled(enable: boolean) {
    this.sealEnabled = enable;
    this.unsealAll = true;
    this.emitDetail();
    await this.sync();
  }

  public async setChannelKey(cardId: string | null, channelId: string, channelKey: string | null) {
    if (cardId === this.cardId && channelId === this.channelId) {
      this.channelKey = channelKey;
      this.unsealAll = true;
      this.emitDetail();
      await this.sync();
    }
  }

  public async close() {
    this.closing = true;
    while (this.syncing) {
      await new Promise((r) => setTimeout(r, CLOSE_POLL_MS));
    }
    this.closeStaging.forEach(item => {
      item();
    });
  }

  public getFocused() {
    var { cardId, channelId } = this;
    return { cardId, channelId };
  }

  private getTopicData(item: TopicItem): { data: any, assets: AssetItem[] } {
    var topicDetail = item.detail.sealed ? item.unsealedDetail : item.detail.data;
    return getLegacyData(topicDetail);
  }

  private setTopic(topicId: string, item: TopicItem): Topic {
    var { data, assets } = this.getTopicData(item);
    return {
      topicId,
      data,
      guid: item.detail.guid,
      blocked: this.isTopicBlocked(topicId),
      sealed: item.detail.sealed,
      locked: item.detail.sealed && (!this.sealEnabled || !this.channelKey),
      dataType: item.detail.dataType,
      created: item.detail.created,
      updated: item.detail.updated,
      status: item.detail.status,
      transform: item.detail.transform,
      assets: assets.map(asset => {
        var { assetId, hosting } = asset;
        return { assetId, hosting };
      }),
    }
  }   

  private getTopicDetail(entity: TopicDetailEntity, revision: number): TopicDetail {
    var { guid, dataType, data, created, updated, status, transform } = entity;
    return {
      revision,
      guid,
      sealed: dataType == 'sealedtopic',
      data: this.parse(data),
      dataType,
      created,
      updated,
      status,
      transform,
    }
  }

  private async getTopicEntry(topicId: string) {
    var { cardId, channelId, guid } = this;
    var entry = this.topicEntries.get(topicId);
    if (entry) {
      return entry;
    }     
    var item = JSON.parse(JSON.stringify(defaultTopicItem));
    var topic = this.setTopic(topicId, item);
    var topicEntry = { item, topic };
    this.topicEntries.set(topicId, topicEntry);
    await this.addLocalChannelTopic(topicId, item);
    return topicEntry;
  } 

  private async getChannelTopicRevision() {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      return await this.store.getContactCardChannelTopicRevision(guid, cardId, channelId);
    } else {
      return await this.store.getContentChannelTopicRevision(guid, channelId);
    }
  }

  private async setChannelTopicRevision(sync: { revision: number | null, marker: number | null}) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      await this.store.setContactCardChannelTopicRevision(guid, cardId, channelId, sync);
    }
    else {
      await this.store.setContentChannelTopicRevision(guid, channelId, sync);
    }
  }

  private async getLocalChannelTopics(offset: {topicId: string, position: number} | null) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      return await this.store.getContactCardChannelTopics(guid, cardId, channelId, BATCH_COUNT, offset);  
    } else {
      return await this.store.getContentChannelTopics(guid, channelId, BATCH_COUNT, offset);
    }
  }

  private async addLocalChannelTopic(topicId: string, item: TopicItem) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      await this.store.addContactCardChannelTopic(guid, cardId, channelId, topicId, item);
    } else {
      await this.store.addContentChannelTopic(guid, channelId, topicId, item);
    }
  }
  
  private async removeLocalChannelTopic(topicId: string) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      await this.store.removeContactCardChannelTopic(guid, cardId, channelId, topicId);
    } else {
      await this.store.removeContentChannelTopic(guid, channelId, topicId);
    }
  }

  private async setLocalChannelTopicDetail(topicId: string, detail: TopicDetail, unsealedDetail: any, position: number) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      await this.store.setContactCardChannelTopicDetail(guid, cardId, channelId, topicId, detail, unsealedDetail, position);
    } else {
      await this.store.setContentChannelTopicDetail(guid, channelId, topicId, detail, unsealedDetail, position);
    }
  }

  private async setLocalChannelTopicUnsealedDetail(topicId: string, unsealedDetail: any) {
    var { guid, cardId, channelId } = this;
    if (cardId) {
      await this.store.setContactCardChannelTopicUnsealedDetail(guid, cardId, channelId, topicId, unsealedDetail);
    } else {
      await this.store.setContentChannelTopicUnsealedDetail(guid, channelId, topicId, unsealedDetail);
    }
  }

  private getRemoteChannelTopicAssetUrl(topicId: string, assetId: string): string {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected channel');
    }
    var { node, secure, token } = connection;
    return `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/assets/${assetId}?${cardId ? 'contact' : 'agent'}=${token}`
  }

  private async getRemoteChannelTopics(revision: number | null, begin: number | null, end: number | null) {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected channel');
    }
    var { node, secure, token } = connection
    if (cardId) {
      return await getContactChannelTopics(node, secure, token, channelId, revision, (end || !revision) ? BATCH_COUNT : null, begin, end);
    } else {
      return await getChannelTopics(node, secure, token, channelId, revision, (end || !revision) ? BATCH_COUNT : null, begin, end);
    }
  }

  private async getRemoteChannelTopicDetail(topicId: string) {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected channel');
    }
    var { node, secure, token } = connection
    if (cardId) {
      return await getContactChannelTopicDetail(node, secure, token, channelId, topicId);
    } else {
      return await getChannelTopicDetail(node, secure, token, channelId, topicId);
    }
  } 

  private async addRemoteChannelTopic(dataType: string, data: any, confirm: boolean) {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected channel');
    }
    var { node, secure, token } = connection;
    if (cardId) {
      return await addContactChannelTopic(node, secure, token, channelId, dataType, data, confirm);
    } else {
      return await addChannelTopic(node, secure, token, channelId, dataType, data, confirm);
    }
  }

  private async setRemoteChannelTopicSubject(topicId: string, dataType: string, data: any) {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    if (cardId) {
      return await setContactChannelTopicSubject(node, secure, token, channelId, topicId, dataType, data);
    } else {
      return await setChannelTopicSubject(node, secure, token, channelId, topicId, dataType, data);
    }
  }

  private async removeRemoteChannelTopic(topicId: string) {
    var { cardId, channelId, connection } = this;
    if (!connection) {
      throw new Error('disconnected from channel');
    }
    var { node, secure, token } = connection;
    if (cardId) {
      return await removeContactChannelTopic(node, secure, token, channelId, topicId);
    } else {
      return await removeChannelTopic(node, secure, token, channelId, topicId);
    }
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
}
