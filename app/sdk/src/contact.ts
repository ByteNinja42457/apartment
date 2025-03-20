import { EventEmitter } from 'eventemitter3';
import type { Contact, Focus, Link } from './api';
import { Logging } from './logging';
import { FocusModule } from './focus';
import { LinkModule } from './link';
import type { Card, Channel, Article, Topic, Asset, Tag, FocusDetail, Profile, Participant } from './types';
import { type CardEntity, avatar } from './entities';
import type { ArticleDetail, ChannelSummary, ChannelDetail, CardProfile, CardDetail, CardItem, ChannelItem, ArticleItem } from './items';
import { defaultCardItem, defaultChannelItem } from './items';
import { Store } from './store';
import { Crypto } from './crypto';
import { Staging } from './staging';
import { getCards } from './net/getCards';
import { getCardProfile } from './net/getCardProfile';
import { getCardDetail } from './net/getCardDetail';
import { setCardProfile } from './net/setCardProfile';
import { getContactProfile } from './net/getContactProfile';
import { getContactChannels } from './net/getContactChannels';
import { getContactChannelDetail } from './net/getContactChannelDetail';
import { getContactChannelSummary } from './net/getContactChannelSummary';
import { getCardImageUrl } from './net/getCardImageUrl';
import { addCard } from './net/addCard';
import { removeCard } from './net/removeCard';
import { getContactListing } from './net/getContactListing';
import { setCardConfirmed } from './net/setCardConfirmed';
import { setCardConnecting } from './net/setCardConnecting';
import { setCardConnected } from './net/setCardConnected';
import { removeContactChannel } from './net/removeContactChannel';
import { getContactChannelNotifications } from './net/getContactChannelNotifications';
import { setContactChannelNotifications } from './net/setContactChannelNotifications';
import { getRegistryImageUrl } from './net/getRegistryImageUrl';
import { getRegistryListing } from './net/getRegistryListing';
import { addFlag } from './net/addFlag';
import { getCardOpenMessage } from './net/getCardOpenMessage';
import { setCardOpenMessage } from './net/setCardOpenMessage';
import { getCardCloseMessage } from './net/getCardCloseMessage';
import { setCardCloseMessage } from './net/setCardCloseMessage';
import { getLegacyData } from './legacy';
import { removeContactCall } from './net/removeContactCall';

let CLOSE_POLL_MS = 100;
let RETRY_POLL_MS = 2000;

export class ContactModule implements Contact {
  private log: Logging;
  private guid: string;
  private token: string;
  private node: string;
  private secure: boolean;
  private loaded: boolean;
  private emitter: EventEmitter;
  private channelTypes: string[];
  private seal: { privateKey: string; publicKey: string } | null;
  private unsealAll: boolean;
  private focus: FocusModule | null;

  private crypto: Crypto | null;
  private staging: Staging | null;
  private store: Store;
  private revision: number;
  private nextRevision: number | null;
  private syncing: boolean;
  private closing: boolean;
  private hasSynced: boolean;

  // set of markers
  private offsyncProfileCard: Map<string, number>;
  private offsyncChannelCard: Map<string, number>;
  private offsyncArticleCard: Map<string, number>;
  private blockedCard: Set<string>;
  private blockedCardChannel: Set<string>;
  private read: Map<string, number>;

  // set of cards to resync
  private resync: Set<string>;

  // view of cards
  private cardEntries: Map<string, { item: CardItem; card: Card }>;

  // view of articles
  private articleEntries: Map<string, Map<string, { item: ArticleItem; article: Article }>>;

  // view of channels
  private channelEntries: Map<string, Map<string, { item: ChannelItem; channel: Channel }>>;

  constructor(log: Logging, store: Store, crypto: Crypto | null, staging: Staging | null, guid: string, token: string, node: string, secure: boolean, channelTypes: string[]) {
    this.guid = guid;
    this.token = token;
    this.node = node;
    this.secure = secure;
    this.log = log;
    this.store = store;
    this.crypto = crypto;
    this.staging = staging;
    this.emitter = new EventEmitter();
    this.channelTypes = channelTypes;
    this.unsealAll = false;
    this.loaded = false;
    this.focus = null;
    this.seal = null;

    this.cardEntries = new Map<string, { item: CardItem; card: Card }>();
    this.articleEntries = new Map<string, Map<string, { item: ArticleItem; article: Article }>>();
    this.channelEntries = new Map<string, Map<string, { item: ChannelItem; channel: Channel }>>();
    this.resync = new Set<string>();
    this.blockedCard = new Set<string>();
    this.blockedCardChannel = new Set<string>();
    this.read = new Map<string, number>();
    this.offsyncProfileCard = new Map<string, number>();
    this.offsyncArticleCard = new Map<string, number>();
    this.offsyncChannelCard = new Map<string, number>();

    this.revision = 0;
    this.syncing = true;
    this.closing = false;
    this.nextRevision = null;
    this.hasSynced = false;
    this.init();
  }

  private async init() {
    let { guid } = this;
    this.revision = await this.store.getContactRevision(guid);

    let offsyncProfileCardMarkers = await this.store.getMarkers(guid, 'offsync_profile_card');
    offsyncProfileCardMarkers.forEach((marker) => {
      this.offsyncProfileCard.set(marker.id, parseInt(marker.value));
    });
    let offsyncChannelCardMarkers = await this.store.getMarkers(guid, 'offsync_channel_card');
    offsyncChannelCardMarkers.forEach((marker) => {
      this.offsyncChannelCard.set(marker.id, parseInt(marker.value));
    });
    let offsyncArticleCardMarkers = await this.store.getMarkers(guid, 'offsync_article_card');
    offsyncArticleCardMarkers.forEach((marker) => {
      this.offsyncArticleCard.set(marker.id, parseInt(marker.value));
    });
    let blockedCardMarkers = await this.store.getMarkers(guid, 'blocked_card');
    blockedCardMarkers.forEach((marker) => {
      this.blockedCard.add(marker.id);
    });
    let blockedCardChannelMarkers = await this.store.getMarkers(guid, 'blocked_card_channel');
    blockedCardChannelMarkers.forEach((marker) => {
      this.blockedCardChannel.add(marker.id);
    });
    let readMarkers = await this.store.getMarkers(guid, 'read_card_channel');
    readMarkers.forEach((marker) => {
      this.read.set(marker.id, parseInt(marker.value));
    });
    let hasSyncedMarkers = await this.store.getMarkers(guid, 'first_sync_complete');
    this.hasSynced = hasSyncedMarkers.filter((marker) => (marker.id === 'contact')).length !== 0;

    // load map of articles
    let articles = await this.store.getContactCardArticles(guid);
    articles.forEach(({ cardId, articleId, item }) => {
      let articles = this.articleEntries.get(cardId);
      let article = this.setArticle(cardId, articleId, item);
      if (!articles) {
        let entries = new Map<string, { item: ArticleItem; article: Article }>();
        this.articleEntries.set(cardId, entries);
        entries.set(articleId, { item, article });
      } else {
        articles.set(articleId, { item, article });
      }
    });

    // load map of channels
    let channels = await this.store.getContactCardChannels(guid);
    channels.forEach(({ cardId, channelId, item }) => {
      let channels = this.channelEntries.get(cardId);
      let channel = this.setChannel(cardId, channelId, item);
      if (!channels) {
        let entries = new Map<string, { item: ChannelItem; channel: Channel }>();
        this.channelEntries.set(cardId, entries);
        entries.set(channelId, { item, channel });
      } else {
        channels.set(channelId, { item, channel });
      }
    });

    // load map of cards
    let cards = await this.store.getContacts(guid);
    cards.forEach(({ cardId, item }) => {
      let card = this.setCard(cardId, item);
      this.cardEntries.set(cardId, { item, card });
      this.emitArticles(cardId);
      this.emitChannels(cardId);
    });
    this.emitCards();

    this.unsealAll = true;
    this.syncing = false;
    await this.sync();
    this.emitLoaded();
  }

  public async setRevision(rev: number): Promise<void> {
    this.nextRevision = rev;
    await this.sync();
  }

  public async close() {
    this.closing = true;
    if (this.focus) {
      await this.focus.close();
      this.focus = null;
    }
    while (this.syncing) {
      await new Promise((r) => setTimeout(r, CLOSE_POLL_MS));
    }
  }

  private isCardBlocked(cardId: string): boolean {
    return this.blockedCard.has(cardId);
  }

  private async setCardBlocked(cardId: string) {
    let entry = this.cardEntries.get(cardId);
    if (!entry) {
      throw new Error('card not found');
    }
    this.blockedCard.add(cardId);
    entry.card = this.setCard(cardId, entry.item);
    this.emitCards();
    let timestamp = Math.floor(Date.now() / 1000);
    await this.store.setMarker(this.guid, 'blocked_card', cardId, JSON.stringify({cardId, timestamp}));
  }
  
  private async clearCardBlocked(cardId: string) {
    let entry = this.cardEntries.get(cardId);
    if (!entry) {
      throw new Error('card not found');
    }
    this.blockedCard.delete(cardId);
    entry.card = this.setCard(cardId, entry.item);
    this.emitCards();
    await this.store.clearMarker(this.guid, 'blocked_card', cardId);
  }

  private isChannelBlocked(cardId: string, channelId: string): boolean {
    let id = `${cardId}:${channelId}`;
    return this.blockedCardChannel.has(id);
  }

  private async setChannelBlocked(cardId: string, channelId: string) {
    let channelsEntry = this.channelEntries.get(cardId);
    if (!channelsEntry) {
      throw new Error('card not found');
    }
    let channelEntry = channelsEntry.get(channelId);
    if (!channelEntry) {
      throw new Error('channel not found');
    }
    let id = `${cardId}:${channelId}`;
    this.blockedCardChannel.add(id);
    channelEntry.channel = this.setChannel(cardId, channelId, channelEntry.item); 
    this.emitChannels(cardId);
    let timestamp = Math.floor(Date.now() / 1000);
    await this.store.setMarker(this.guid, 'blocked_card_channel', id, JSON.stringify({ cardId, channelId, timestamp }));
  }

  private async clearChannelBlocked(cardId: string, channelId: string) {
    let channelsEntry = this.channelEntries.get(cardId);
    if (!channelsEntry) {
      throw new Error('card not found');
    }
    let channelEntry = channelsEntry.get(channelId);
    if (!channelEntry) {
      throw new Error('channel not found');
    }
    let id = `${cardId}:${channelId}`;
    this.blockedCardChannel.delete(id);
    channelEntry.channel = this.setChannel(cardId, channelId, channelEntry.item); 
    this.emitChannels(cardId);
    await this.store.clearMarker(this.guid, 'blocked_card_channel', id);
  }

  private isArticleBlocked(cardId: string, articleId: string): boolean {
    return false;
  }

  private async setArticleBlocked(cardId: string, articleId: string) {
  }

  private async clearArticleBlocked(cardId: string, articleId: string) {
  }

  private getCardProfileOffsync(cardId: string): number | null {
    let offsync = this.offsyncProfileCard.get(cardId);
    if (offsync) {
      return offsync;
    } else {
      return null;
    }
  }

  private async setCardProfileOffsync(cardId: string, revision: number) {
    this.offsyncProfileCard.set(cardId, revision);
    await this.store.setMarker(this.guid, 'offsync_profile_card', cardId, revision.toString());
  }

  private async clearCardProfileOffsync(cardId: string) {
    if (this.offsyncProfileCard.has(cardId)) {
      this.offsyncProfileCard.delete(cardId);
      await this.store.clearMarker(this.guid, 'offsync_profile_card', cardId);
    }
  }

  private getCardChannelOffsync(cardId: string): number | null {
    let offsync = this.offsyncChannelCard.get(cardId);
    if (offsync) {
      return offsync;
    } else {
      return null;
    }
  }

  private async setCardChannelOffsync(cardId: string, revision: number) {
    this.offsyncChannelCard.set(cardId, revision);
    await this.store.setMarker(this.guid, 'offsync_channel_card', cardId, revision.toString());
  }

  private async clearCardChannelOffsync(cardId: string) {
    if (this.offsyncChannelCard.has(cardId)) {
      this.offsyncChannelCard.delete(cardId);
      await this.store.clearMarker(this.guid, 'offsync_channel_card', cardId);
    }
  }

  private getCardArticleOffsync(cardId: string): number | null {
    let offsync = this.offsyncArticleCard.get(cardId);
    if (offsync) {
      return offsync;
    } else {
      return null;
    }
  }

  private async setCardArticleOffsync(cardId: string, revision: number) {
    this.offsyncArticleCard.set(cardId, revision);
    await this.store.setMarker(this.guid, 'offsync_article_card', cardId, revision.toString());
  }

  private async clearCardArticleOffsync(cardId: string) {
    if (this.offsyncArticleCard.has(cardId)) {
      this.offsyncArticleCard.delete(cardId);
      await this.store.clearMarker(this.guid, 'offsync_article_card', cardId);
    }
  }

  private isChannelUnread(cardId: string, channelId: string, revision: number): boolean {
    let id = `${cardId}:${channelId}`;
    if (this.read.has(id)) {
      let read = this.read.get(id);
      if (read && read >= revision) {
        return false;
      }
    }
    return true; 
  }

  private async markChannelUnread(cardId: string, channelId: string, revision: number) {
    let id = `${cardId}:${channelId}`;
    if (!this.read.has(id)) {
      let read = this.read.get(id);
      if (read && read < revision) {
        this.read.delete(id);
        await this.store.clearMarker(this.guid, 'read_card_channel', id);
      }
    } 
  }

  private async markChannelRead(cardId: string, channelId: string, revision: number) {
    let id = `${cardId}:${channelId}`;
    let read = this.read.get(id);
    if (!read || read < revision) {
      this.read.set(id, revision);
      await this.store.setMarker(this.guid, 'read_card_channel', id, revision.toString());
    }
  } 

  public async resyncCard(cardId: string): Promise<void> {
    this.resync.add(cardId);
    await this.sync();
  }

  private async sync(): Promise<void> {
    if (!this.syncing) {
      this.syncing = true;
      let { guid, node, secure, token } = this;
      while ((this.unsealAll || this.nextRevision || this.resync.size) && !this.closing) {
        if (this.resync.size) {
          let entries = Array.from(this.cardEntries, ([key, value]) => ({ key, value }));
          for (let entry of entries) {
            let { key, value } = entry;
            if (this.resync.has(key)) {
              let offsyncProfile = this.getCardProfileOffsync(key);
              if (offsyncProfile) {
                try {
                  let { profile, detail, profileRevision } = value.item;
                  await this.syncProfile(key, profile.node, profile.guid, detail.token, profileRevision);
                  value.item.profileRevision = offsyncProfile;
                  await this.store.setContactCardProfileRevision(guid, key, profileRevision);
                  await this.clearCardProfileOffsync(key);
                  entry.value.card = this.setCard(key, entry.value.item);
                  this.emitCards();
                } catch (err) {
                  this.log.warn(err);
                }
              }
              let offsyncArticle = this.getCardArticleOffsync(key);
              if (offsyncArticle) {
                try {
                  let { profile, detail, articleRevision } = value.item;
                  await this.syncArticles(key, profile.node, profile.guid, detail.token, articleRevision);
                  value.item.articleRevision = offsyncArticle;
                  await this.store.setContactCardArticleRevision(guid, key, articleRevision);
                  await this.clearCardArticleOffsync(key);
                  entry.value.card = this.setCard(key, entry.value.item);
                  this.emitCards();
                } catch (err) {
                  this.log.warn(err);
                }
              }
              let offsyncChannel = this.getCardChannelOffsync(key);
              if (offsyncChannel) {
                try {
                  let { profile, detail, channelRevision } = value.item;
                  await this.syncChannels(key, { guid: profile.guid, node: profile.node, token: detail.token }, channelRevision);
                  value.item.channelRevision = offsyncChannel;
                  await this.store.setContactCardChannelRevision(guid, key, value.item.channelRevision);
                  await this.clearCardChannelOffsync(key);
                  entry.value.card = this.setCard(key, entry.value.item);
                  this.emitCards();
                } catch (err) {
                  this.log.warn(err);
                }
              }
            }
          }
          this.resync.clear();
        }

        if (this.nextRevision && this.revision !== this.nextRevision) {
          let nextRev = this.nextRevision;
          try {
            let delta = await getCards(node, secure, token, this.revision);
            for (let entity of delta) {
              let { id, revision, data } = entity;
              if (data) {
                let entry = await this.getCardEntry(id);

                if (data.detailRevision !== entry.item.detail.revison) {
                  let detail = data.cardDetail ? data.cardDetail : await getCardDetail(node, secure, token, id);
                  let { status, statusUpdated, token: cardToken } = detail;
                  entry.item.detail = {
                    revision: data.detailRevision,
                    status,
                    statusUpdated,
                    token: cardToken,
                  };
                  entry.card = this.setCard(id, entry.item);
                  await this.store.setContactCardDetail(guid, id, entry.item.detail);
                }

                if (data.profileRevision !== entry.item.profile.revision) {
                  let profile = data.cardProfile ? data.cardProfile : await getCardProfile(node, secure, token, id);
                  entry.item.profile = {
                    revision: data.profileRevision,
                    handle: profile.handle,
                    guid: profile.guid,
                    name: profile.name,
                    description: profile.description,
                    location: profile.location,
                    imageSet: profile.imageSet,
                    node: profile.node,
                    seal: profile.seal,
                  };
                  entry.card = this.setCard(id, entry.item);
                  await this.store.setContactCardProfile(guid, id, entry.item.profile);
                }

                let { profileRevision, articleRevision, channelRevision } = entry.item;

                if (data.notifiedProfile > entry.item.profile.revision && data.notifiedProfile !== profileRevision) {
                  let offsyncProfile = this.getCardProfileOffsync(id);
                  if (offsyncProfile) {
                    await this.setCardProfileOffsync(id, data.notifiedProfile);
                    entry.card = this.setCard(id, entry.item);
                  } else {
                    try {
                      await this.syncProfile(id, entry.item.profile.node, entry.item.profile.guid, entry.item.detail.token, entry.item.profileRevision);
                      entry.item.profileRevision = data.notifiedProfile;
                      await this.store.setContactCardProfileRevision(guid, id, data.notifiedProfile);
                    } catch (err) {
                      this.log.warn(err);
                      await this.setCardProfileOffsync(id, data.notifiedProfile);
                      entry.card = this.setCard(id, entry.item);
                    }
                  }
                }

                if (data.notifiedArticle !== articleRevision) {
                  let offsyncArticle = this.getCardArticleOffsync(id);
                  if (offsyncArticle) {
                    await this.setCardArticleOffsync(id, data.notifiedArticle);
                    entry.card = this.setCard(id, entry.item);
                  } else {
                    try {
                      await this.syncArticles(id, entry.item.profile.node, entry.item.profile.guid, entry.item.detail.token, entry.item.articleRevision);
                      entry.item.articleRevision = data.notifiedArticle;
                      await this.store.setContactCardArticleRevision(guid, id, data.notifiedArticle);
                      this.emitArticles(id);
                    } catch (err) {
                      this.log.warn(err);
                      await this.setCardArticleOffsync(id, data.notifiedArticle);
                      entry.card = this.setCard(id, entry.item);
                    }
                  }
                }

                if (data.notifiedChannel !== channelRevision) {
                  let offsyncChannel = this.getCardChannelOffsync(id);
                  if (offsyncChannel) {
                    await this.setCardChannelOffsync(id, data.notifiedChannel);
                    entry.card = this.setCard(id, entry.item);
                  } else {
                    try {
                      let { profile, detail } = entry.item;
                      await this.syncChannels(id, { guid: profile.guid, node: profile.node, token: detail.token }, entry.item.channelRevision);
                      entry.item.channelRevision = data.notifiedChannel;
                      await this.store.setContactCardChannelRevision(guid, id, data.notifiedChannel);
                      this.emitChannels(id);
                    } catch (err) {
                      this.log.warn(err);
                      await this.setCardChannelOffsync(id, data.notifiedChannel);
                      entry.card = this.setCard(id, entry.item);
                    }
                  }
                }
              } else {
                this.cardEntries.delete(id);
                await this.store.removeContactCard(guid, id);
                this.channelEntries.delete(id);
                this.emitChannels(id);
                this.articleEntries.delete(id);
                this.emitArticles(id);
              }
            }

            this.emitCards();
            await this.store.setContactRevision(guid, nextRev);
            this.revision = nextRev;
            this.emitLoaded();
            if (this.nextRevision === nextRev) {
              this.nextRevision = null;
            }
            this.log.info(`card revision: ${nextRev}`);
          } catch (err) {
            this.log.warn(err);
            await new Promise((r) => setTimeout(r, RETRY_POLL_MS));
          }
        }

        if (this.revision === this.nextRevision) {
          this.nextRevision = null;
        }

        if (this.unsealAll) {
          for (let [cardId, channels] of this.channelEntries.entries()) {
            for (let [channelId, entry] of channels.entries()) {
              try {
                let { item } = entry;
                if (await this.unsealChannelDetail(cardId, channelId, item)) {
                  await this.store.setContactCardChannelUnsealedDetail(guid, cardId, channelId, item.unsealedDetail);
                }
                if (await this.unsealChannelSummary(cardId, channelId, item)) {
                  await this.store.setContactCardChannelUnsealedSummary(guid, cardId, channelId, item.unsealedSummary);
                }
                entry.channel = this.setChannel(cardId, channelId, item);
              } catch (err) {
                this.log.warn(err);
              }
            }
            this.emitChannels(cardId);
          }
          this.unsealAll = false;
        }
      }

      if (this.revision && !this.hasSynced) {
        this.hasSynced = true;
        await this.store.setMarker(this.guid, 'first_sync_complete', 'contact', '');
      }
      this.syncing = false;
    }
  }

  private async syncProfile(cardId: string, cardNode: string, cardGuid: string, cardToken: string, revision: number): Promise<void> {
    let { node, secure, token } = this;
    let server = cardNode ? cardNode : node;
    let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
    let message = await getContactProfile(server, !insecure, cardGuid, cardToken);
    await setCardProfile(node, secure, token, cardId, message);
  }

  private async syncArticles(cardId: string, cardNode: string, cardGuid: string, cardToken: string, revision: number): Promise<void> {
    let { node, secure, token } = this;
    let server = cardNode ? cardNode : node;
    let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  }

  private async syncChannels(cardId: string, card: { guid: string; node: string; token: string }, revision: number): Promise<void> {
    let { guid, node, secure, token, channelTypes } = this;
    let server = card.node ? card.node : node;
    let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
    let delta = await getContactChannels(server, !insecure, card.guid, card.token, revision, channelTypes);

    for (let entity of delta) {
      let { id, revision, data } = entity;
      if (data) {
        let { detailRevision, topicRevision, channelSummary, channelDetail } = data;
        let entries = this.getChannelEntries(cardId);
        let entry = await this.getChannelEntry(entries, cardId, id);

        if (detailRevision !== entry.item.detail.revision) {
          let detail = channelDetail ? channelDetail : await getContactChannelDetail(server, !insecure, card.guid, card.token, id);
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
          await this.unsealChannelDetail(cardId, id, entry.item);
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
              members: members.map(guid => ({ guid }))
            }
            this.focus.setDetail(cardId, id, focusDetail); 
          }
          entry.channel = this.setChannel(cardId, id, entry.item);
          await this.store.setContactCardChannelDetail(guid, cardId, id, entry.item.detail, entry.item.unsealedDetail);
        }

        if (topicRevision !== entry.item.summary.revision) {
          let summary = channelSummary ? channelSummary : await getContactChannelSummary(server, !insecure, card.guid, card.token, id);
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
          await this.unsealChannelSummary(cardId, id, entry.item);
          if (this.hasSynced) {
            await this.markChannelUnread(cardId, id, topicRevision);
          } else {
            await this.markChannelRead(cardId, id, topicRevision);
          }
          entry.channel = this.setChannel(cardId, id, entry.item);
          await this.store.setContactCardChannelSummary(guid, cardId, id, entry.item.summary, entry.item.unsealedSummary);
          if (this.focus) {
            await this.focus.setRevision(cardId, id, topicRevision);
          }
        }
      } else {
        let channels = this.getChannelEntries(cardId);
        channels.delete(id);
        if (this.focus) {
          this.focus.disconnect(cardId, id);
        }
        await this.store.removeContactCardChannel(guid, cardId, id);
      }
    }
  }

  public addCardListener(ev: (cards: Card[]) => void): void {
    this.emitter.on('card', ev);
    let cards = Array.from(this.cardEntries, ([cardId, entry]) => entry.card);
    ev(cards);
  }

  public removeCardListener(ev: (cards: Card[]) => void): void {
    this.emitter.off('card', ev);
  }

  private emitCards() {
    let cards = Array.from(this.cardEntries, ([cardId, entry]) => entry.card);
    this.emitter.emit('card', cards);
  }

  public addArticleListener(id: string | null, ev: (arg: { cardId: string; articles: Article[] }) => void): void {
    if (id) {
      let cardId = id as string;
      this.emitter.on(`article::${cardId}`, ev);
      let entries = this.articleEntries.get(cardId);
      let articles = entries ? Array.from(entries, ([articleId, entry]) => entry.article) : [];
      ev({ cardId, articles });
    } else {
      this.emitter.on('article', ev);
      this.articleEntries.forEach((entries, cardId) => {
        let articles = Array.from(entries, ([articleId, entry]) => entry.article);
        ev({ cardId, articles });
      });
    }
  }

  public removeArticleListener(id: string | null, ev: (arg: { cardId: string; articles: Article[] }) => void): void {
    if (id) {
      let cardId = id as string;
      this.emitter.off(`article::${cardId}`, ev);
    } else {
      this.emitter.off('article', ev);
    }
  }

  private emitArticles(cardId: string) {
    let entries = this.articleEntries.get(cardId);
    let articles = entries ? Array.from(entries, ([articleId, entry]) => entry.article) : [];
    this.emitter.emit('article', { cardId, articles });
    this.emitter.emit(`article::${cardId}`, { cardId, articles });
  }

  public addChannelListener(ev: (arg: { cardId: string; channels: Channel[] }) => void): void {
    this.emitter.on('channel', ev);
    this.channelEntries.forEach((entries, cardId) => {
      let channels = Array.from(entries, ([channelId, entry]) => entry.channel);
      ev({ cardId, channels });
    });
  }

  public removeChannelListener(ev: (arg: { cardId: string; channels: Channel[] }) => void): void {
    this.emitter.off('channel', ev);
  }

  private emitChannels(cardId: string) {
    let entries = this.channelEntries.get(cardId);
    let channels = entries ? Array.from(entries, ([channelId, entry]) => entry.channel) : [];
    this.emitter.emit('channel', { cardId, channels });
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

  public async setFocus(cardId: string, channelId: string): Promise<Focus> {
    if (this.focus) {
      this.focus.close();
    }

    let markRead = async () => {
      try {
        await this.setUnreadChannel(cardId, channelId, false);
      } catch (err) {
        this.log.error(err);
      }
    }

    let flagTopic = async (topicId: string) => {
      let entry = this.cardEntries.get(cardId);
      if (entry) {
        let server = entry.item.profile.node ? entry.item.profile.node : this.node;
        let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
        await addFlag(server, !insecure, entry.item.profile.guid, { channelId, topicId });
      }
    }

    let cardEntry = this.cardEntries.get(cardId);
    let channelsEntry = this.channelEntries.get(cardId);
    let channelEntry = channelsEntry?.get(channelId);
    if (cardEntry && channelEntry) {
      // allocate focus
      let node = cardEntry.item.profile.node;
      let guid = cardEntry.item.profile.guid;
      let token = cardEntry.item.detail.token;
      let revision = channelEntry.item.summary.revision;
      let channelKey = await this.setChannelKey(channelEntry.item);
      let sealEnabled = Boolean(this.seal);
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(node);
      this.focus = new FocusModule(this.log, this.store, this.crypto, this.staging, cardId, channelId, this.guid, { node, secure: !insecure, token: `${guid}.${token}` }, channelKey, sealEnabled, revision, markRead, flagTopic);

      // set current detail
      let { dataType, data, enableImage, enableAudio, enableVideo, enableBinary, members, created } = channelEntry.item.detail;
      let sealed = dataType === 'sealed';
      let channelData = sealed ? channelEntry.item.unsealedDetail : data;
      let focusDetail = {
        sealed,
        locked: sealed && (!this.seal || !channelEntry.item.channelKey),
        dataType,
        data: this.parse(channelData),
        enableImage,
        enableAudio,
        enableVideo,
        enableBinary,
        created,
        members: members.map(guid => ({ guid })),
      }
      this.focus.setDetail(cardId, channelId, focusDetail);
    } else {
      this.focus = new FocusModule(this.log, this.store, this.crypto, this.staging, cardId, channelId, this.guid, null, null, false, 0, markRead, flagTopic);
    }
    return this.focus;
  }

  public clearFocus() {
    if (this.focus) {
      this.focus.close();
      this.focus = null;
    }
  }

  public async addCard(server: string | null, guid: string): Promise<string> {
    let { node, secure, token } = this;
    let insecure = server ? /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server) : false;
    let message = server ? await getContactListing(server, !insecure, guid) : await getContactListing(node, secure, guid);
    let added = await addCard(node, secure, token, message);
    return added.id;
  }

  public async removeCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    await removeCard(node, secure, token, cardId);
  }

  public async confirmCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    await setCardConfirmed(node, secure, token, cardId);
  }

  public async connectCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    await setCardConnecting(node, secure, token, cardId);
    try {
      let message = await getCardOpenMessage(node, secure, token, cardId);
      let entry = this.cardEntries.get(cardId);
      if (entry) {
        let server = entry.item.profile.node ? entry.item.profile.node : node;
        let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
        let contact = await setCardOpenMessage(server, !insecure, message);
        if (contact.status === 'connected') {
          let { token: contactToken, articleRevision, channelRevision, profileRevision } = contact;
          await setCardConnected(node, secure, token, cardId, contactToken, articleRevision, channelRevision, profileRevision);
        }
      }
    } catch (err) {
      this.log.error('failed to deliver open message');
    }
  }

  public async addAndConnectCard(server: string | null, guid: string): Promise<void> {
    let { node, secure, token } = this;
    let insecure = server ? /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server) : false;
    let message = server ? await getContactListing(server, !insecure, guid) : await getContactListing(node, secure, guid);
    let added = await addCard(node, secure, token, message);
    await setCardConnecting(node, secure, token, added.id);
    try {
      let message = await getCardOpenMessage(node, secure, token, added.id);
      let server = added.data.cardProfile.node ? added.data.cardProfile.node : node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      let contact = await setCardOpenMessage(server, !insecure, message);
      if (contact.status === 'connected') {
        let { token: contactToken, articleRevision, channelRevision, profileRevision } = contact;
        await setCardConnected(node, secure, token, added.id, contactToken, articleRevision, channelRevision, profileRevision);
      }
    } catch (err) {
      this.log.error('failed to deliver open message');
    }
  }

  public async disconnectCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    await setCardConfirmed(node, secure, token, cardId);
    try {
      let message = await getCardCloseMessage(node, secure, token, cardId);
      let entry = this.cardEntries.get(cardId);
      if (entry) {
        let server = entry.item.profile.node ? entry.item.profile.node : node;
        let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
        await setCardCloseMessage(server, !insecure, message);
      }
    } catch (err) {
      this.log.warn('failed to deliver close message');
    }
  }

  public async denyCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      try {
        let message = await getCardCloseMessage(node, secure, token, cardId);
        let server = entry.item.profile.node ? entry.item.profile.node : node;
        let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
        await setCardCloseMessage(server, !insecure, message);
      } catch (err) {
        this.log.warn('failed to deliver close message');
      }
      if (entry.item.detail.status === 'pending') {
        await removeCard(node, secure, token, cardId);
      } else {
        await setCardConfirmed(node, secure, token, cardId);
      }
    }
  }

  public async ignoreCard(cardId: string): Promise<void> {
    let { node, secure, token } = this;
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      if (entry.item.detail.status === 'pending') {
        await removeCard(node, secure, token, cardId);
      } else {
        await setCardConfirmed(node, secure, token, cardId);
      }
    }
  }

  public async removeArticle(cardId: string, articleId: string): Promise<void> {}

  public async leaveChannel(cardId: string, channelId: string): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      await removeContactChannel(server, !insecure, entry.item.profile.guid, entry.item.detail.token, channelId);
    }
  }

  public async callCard(cardId: string): Promise<Link> {
    let { node, secure, token } = this;
    let entry = this.cardEntries.get(cardId);
    if (!entry || entry.item.detail.status !== 'connected') {
      throw new Error('invalid card for call');
    }
    let { profile, detail } = entry.item;
    let link = new LinkModule(this.log);
    let server = profile.node ? profile.node : this.node;
    let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
    await link.call(node, secure, token, cardId, server, !insecure, profile.guid, detail.token);
    return link;
  }

  // added to allow ring to end call (deprecate)
  public async endCall(cardId: string, callId: string): Promise<void> {
    let { node, secure, token } = this;
    let entry = this.cardEntries.get(cardId);
    if (!entry || entry.item.detail.status !== 'connected') {
      throw new Error('invalid card for call');
    }
    let { profile, detail } = entry.item;
    let server = profile.node ? profile.node : this.node;
    let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
    await removeContactCall(server, !insecure, profile.guid, detail.token, callId);
  }

  public getCardToken(cardId: string): string {
    let entry = this.cardEntries.get(cardId);
    if (!entry || entry.item.detail.status !== 'connected') {
      throw new Error('invalid card for call');
    }
    let { profile, detail } = entry.item;
    return detail.token;
  }

  public async setBlockedCard(cardId: string, blocked: boolean): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      if (blocked) {
        await this.setCardBlocked(cardId);
      } else {
        await this.clearCardBlocked(cardId);
      }
      entry.card = this.setCard(cardId, entry.item);
      this.emitCards();
    }
  }

  public async setBlockedChannel(cardId: string, channelId: string, blocked: boolean): Promise<void> {
    let entries = this.channelEntries.get(cardId);
    if (entries) {
      let entry = entries.get(channelId);
      if (entry) {
        if (blocked) {
          await this.setChannelBlocked(cardId, channelId);
        } else {
          await this.clearChannelBlocked(cardId, channelId);
        }
        entry.channel = this.setChannel(cardId, channelId, entry.item);
        this.emitChannels(cardId);
      }
    }
  }

  public async getBlockedChannels(): Promise<Channel[]> {
    let channels = [] as Channel[];
    this.channelEntries.forEach((card, cardId) => {
      card.forEach((entry, channelId) => {
        if (this.isChannelBlocked(cardId, channelId)) {
          channels.push(entry.channel);
        }
      });
    });
    return channels;
  }

  public async clearBlockedChannelTopic(cardId: string, channelId: string, topicId: string) {
    let { guid } = this;
    let id = `${cardId}:${channelId}:${topicId}`
    await this.store.clearMarker(guid, 'blocked_topic', id);
    if (this.focus) {
      await this.focus.clearBlockedChannelTopic(cardId, channelId, topicId);
    }
  }

  public async setBlockedArticle(cardId: string, articleId: string, blocked: boolean): Promise<void> {
    let entries = this.articleEntries.get(cardId);
    if (entries) {
      let entry = entries.get(articleId);
      if (entry) {
        if (blocked) {
          await this.setArticleBlocked(cardId, articleId);
        } else {
          await this.clearArticleBlocked(cardId, articleId);
        }
        entry.article = this.setArticle(cardId, articleId, entry.item);
        this.emitArticles(cardId);
      }
    }
  }

  public async flagCard(cardId: string): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      await addFlag(server, !insecure, entry.item.profile.guid, {});
    }
  }

  public async flagArticle(cardId: string, articleId: string): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      await addFlag(server, !insecure, entry.item.profile.guid, { articleId });
    }
  }

  public async flagChannel(cardId: string, channelId: string): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      await addFlag(server, !insecure, entry.item.profile.guid, { channelId });
    }
  }

  public async setUnreadChannel(cardId: string, channelId: string, unread: boolean): Promise<void> {
    let channelsEntry = this.channelEntries.get(cardId);
    if (!channelsEntry) {
      throw new Error('card not found');
    }
    let channelEntry = channelsEntry.get(channelId);
    if (!channelEntry) {
      throw new Error('channel not found');
    } 
    let id = `${cardId}:${channelId}`;
    if (unread) {
      this.read.delete(id);
      channelEntry.channel = this.setChannel(cardId, channelId, channelEntry.item);
      this.emitChannels(cardId);
      await this.store.clearMarker(this.guid, 'read_card_channel', id);
    } else {
      let revision = channelEntry.item.summary.revision;
      this.read.set(id, revision);
      channelEntry.channel = this.setChannel(cardId, channelId, channelEntry.item);
      this.emitChannels(cardId);
      await this.store.setMarker(this.guid, 'read_card_channel', id, revision.toString());
    }
  }

  public async getChannelNotifications(cardId: string, channelId: string): Promise<boolean> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      return await getContactChannelNotifications(server, !insecure, entry.item.profile.guid, entry.item.detail.token, channelId);
    }
    return false;
  }

  public async setChannelNotifications(cardId: string, channelId: string, enabled: boolean): Promise<void> {
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      let server = entry.item.profile.node ? entry.item.profile.node : this.node;
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
      await setContactChannelNotifications(server, !insecure, entry.item.profile.guid, entry.item.detail.token, channelId, enabled);
    }
  }

  public async getRegistry(handle: string | null, server: string | null): Promise<Profile[]> {
    let { node, secure } = this;
    let insecure = server ? /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server) : false;
    let listing = server ? await getRegistryListing(handle, server, !insecure) : await getRegistryListing(handle, node, secure);
    return listing.map((entity) => {
      return {
        guid: entity.guid,
        handle: entity.handle,
        name: entity.name,
        description: entity.description,
        location: entity.location,
        node: entity.node,
        version: entity.version,
        sealSet: Boolean(entity.seal),
        imageUrl: entity.imageSet ? (server ? getRegistryImageUrl(server, true, entity.guid) : getRegistryImageUrl(node, secure, entity.guid)) : avatar,
        imageSet: entity.imageSet,
      };
    });
  }

  private setCard(cardId: string, item: CardItem): Card {
    let { node, secure, token } = this;
    let { profile, detail } = item;
    let offsyncProfile = this.getCardProfileOffsync(cardId);
    let offsyncArticle = this.getCardArticleOffsync(cardId);
    let offsyncChannel = this.getCardChannelOffsync(cardId);
    return {
      cardId,
      offsync: Boolean(offsyncProfile || offsyncChannel || offsyncArticle),
      blocked: this.isCardBlocked(cardId),
      sealable: Boolean(item.profile.seal),
      status: detail.status,
      statusUpdated: detail.statusUpdated,
      guid: profile.guid,
      handle: profile.handle,
      name: profile.name,
      description: profile.description,
      location: profile.location,
      imageUrl: profile.imageSet ? getCardImageUrl(node, secure, token, cardId, item.profile.revision) : avatar,
      imageSet: profile.imageSet,
      node: profile.node,
      version: profile.version,
    };
  }

  private setArticle(cardId: string, articleId: string, item: ArticleItem): Article {
    let { detail } = item;
    let articleData = detail.sealed ? item.unsealedDetail : detail.data;
    return {
      cardId,
      articleId,
      sealed: detail.sealed,
      blocked: this.isArticleBlocked(cardId, articleId),
      dataType: detail.dataType,
      data: articleData,
      created: detail.created,
      updated: detail.updated,
    };
  }

  private setChannel(cardId: string, channelId: string, item: ChannelItem): Channel {
    let { summary, detail } = item;
    let channelData = detail.sealed ? item.unsealedDetail : detail.data || '{}';
    let topicData = summary.sealed ? item.unsealedSummary : summary.data || '{}';
    let parsed = this.parse(topicData);
    let data = summary.sealed ? parsed?.message : parsed;

    return {
      channelId,
      cardId,
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
      blocked: this.isChannelBlocked(cardId, channelId),
      unread: this.isChannelUnread(cardId, channelId, summary.revision),
      sealed: detail.sealed,
      locked: detail.sealed && (!this.seal || !item.channelKey),
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

  public async setSeal(seal: { privateKey: string; publicKey: string } | null) {
    this.seal = seal;
    if (this.focus) {
      await this.focus.setSealEnabled(Boolean(this.seal));
    }
    this.unsealAll = true;
    await this.sync();
  }

  public async getSeal(cardId: string, keyData: string): Promise<{ publicKey: string; sealedKey: string }> {
    if (!this.crypto) {
      throw new Error('crypto not set');
    }
    let card = this.cardEntries.get(cardId);
    if (!card) {
      throw new Error('specified card not found');
    }
    let publicKey = card.item.profile.seal;
    if (!publicKey) {
      throw new Error('seal key not set for card');
    }
    let sealed = await this.crypto.rsaEncrypt(keyData, publicKey);
    let sealedKey = sealed.encryptedDataB64;
    return { publicKey, sealedKey };
  }

  private async getChannelKey(seals: [{ publicKey: string; sealedKey: string }]): Promise<string | null> {
    let seal = seals.find(({ publicKey }) => this.seal && publicKey === this.seal.publicKey);
    if (seal && this.crypto && this.seal) {
      let key = await this.crypto.rsaDecrypt(seal.sealedKey, this.seal.privateKey);
      return key.data;
    }
    return null;
  }

  private async setChannelKey(item: ChannelItem) {
    if (!item.channelKey && item.detail.dataType === 'sealed' && this.seal && this.crypto) {
      try {
        let { seals } = JSON.parse(item.detail.data);
        item.channelKey = await this.getChannelKey(seals);
      } catch (err) {
        this.log.warn(err);
      }
    }
    return item.channelKey;
  }

  private async unsealChannelDetail(cardId: string, channelId: string, item: ChannelItem): Promise<boolean> {
    if (item.unsealedDetail == null && item.detail.dataType === 'sealed' && this.seal && this.crypto) {
      try {
        let { subjectEncrypted, subjectIv, seals } = JSON.parse(item.detail.data);
        if (!item.channelKey) {
          item.channelKey = await this.getChannelKey(seals);
          if (this.focus) {
            try {
              await this.focus.setChannelKey(cardId, channelId, item.channelKey);
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
            this.focus.setDetail(cardId, channelId, focusDetail);
          }
          return true;
        }
      } catch (err) {
        this.log.warn(err);
      }
    }
    return false;
  }

  private async unsealChannelSummary(cardId: string, channelId: string, item: ChannelItem): Promise<boolean> {
    if (item.unsealedSummary == null && item.summary.dataType === 'sealedtopic' && this.seal && this.crypto) {
      try {
        if (!item.channelKey) {
          let { seals } = JSON.parse(item.detail.data);
          item.channelKey = await this.getChannelKey(seals);
          if (this.focus) {
            try {
              await this.focus.setChannelKey(cardId, channelId, item.channelKey);
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

  private async getCardEntry(cardId: string) {
    let { guid } = this;
    let entry = this.cardEntries.get(cardId);
    if (entry) {
      return entry;
    }
    let item = JSON.parse(JSON.stringify(defaultCardItem));
    let card = this.setCard(cardId, item);
    let cardEntry = { item, card };
    this.cardEntries.set(cardId, cardEntry);
    await this.store.addContactCard(guid, cardId, item);
    return cardEntry;
  }

  private getChannelEntries(cardId: string) {
    let entries = this.channelEntries.get(cardId);
    if (entries) {
      return entries;
    }
    let channels = new Map<string, { item: ChannelItem; channel: Channel }>();
    this.channelEntries.set(cardId, channels);
    return channels;
  }

  private async getChannelEntry(channels: Map<string, { item: ChannelItem; channel: Channel }>, cardId: string, channelId: string) {
    let { guid } = this;
    let entry = channels.get(channelId);
    if (entry) {
      return entry;
    }
    let item = JSON.parse(JSON.stringify(defaultChannelItem));
    let channel = this.setChannel(cardId, channelId, item);
    let channelEntry = { item, channel };
    channels.set(channelId, channelEntry);
    await this.store.addContactCardChannel(guid, cardId, channelId, item);
    return channelEntry;
  }

  private parse(data: string | null): any {
    if (data) {
      try {
        if (data == null) {
          return null;
        }
        return JSON.parse(data);
      } catch (err) {
        this.log.error('invalid contact data');
      }
    }
    return {};
  }
}
