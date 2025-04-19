import { useState, useRef } from 'react';
import axios from 'axios';
import { createThumbnail } from "react-native-create-thumbnail";
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';

var ENCRYPTED_BLOCK_SIZE = (256 * 1024);
var SCALE_SIZE = (128 * 1024);
var GIF_TYPE = 'image/gif';
var WEBP_TYPE = 'image/webp';

export function useUploadContext() {

  var [state, setState] = useState({
    progress: new Map(),
  });
  var channels = useRef(new Map());
  var index = useRef(0);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  };

  var updateComplete = (channel, topic) => {
    let topics = channels.current.get(channel);
    if (topics) {
      topics.delete(topic);
    }
    updateProgress();
  }

  var updateProgress = () => {
    let progress = new Map();
    channels.current.forEach((topics, channel) => {
      let assets = [];
      topics.forEach((entry, topic, map) => {
        let active = entry.active ? 1 : 0;
        assets.push({
          upload: entry.index,
          topicId: topic,
          active: entry.active,
          uploaded: entry.assets.length,
          index: entry.assets.length + active,
          count: entry.assets.length + entry.files.length + active,
          error: entry.error,
        });
      });
      if (assets.length) {
        progress.set(channel, assets.sort((a, b) => (a.upload < b.upload) ? 1 : -1));
      }
    });
    updateState({ progress });
  }

  var abort = (channelId, topicId) => {
    var channel = channels.current.get(channelId);
    if (channel) {
      var topic = channel.get(topicId);
      if (topic) {
        topic.cancel.abort();
        channel.delete(topicId);
        updateProgress();
      }
    }
  }

  var actions = {
    addTopic: (node, token, channelId, topicId, files, success, failure, cardId) => {
      var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(node);
      var protocol = insecure ? 'http' : 'https';
      var key = cardId ? `${cardId}:${channelId}` : `:${channelId}`; 
      var controller = new AbortController();
      var entry = {
        index: index.current,
        baseUrl: cardId ? `${protocol}://${node}/content/channels/${channelId}/topics/${topicId}/` : `${protocol}://${node}/content/channels/${channelId}/topics/${topicId}/`,
        urlParams: cardId ? `?contact=${token}` : `?agent=${token}`,
        files,
        assets: [],
        current: null,
        error: false,
        success,
        failure,
        cancel: controller,
      }
      index.current += 1;
      if (!channels.current.has(key)) {
        channels.current.set(key, new Map());
      }
      var topics = channels.current.get(key);
      topics.set(topicId, entry);

      upload(entry, updateProgress, () => { updateComplete(key, topicId) } );
    },
    cancelTopic: (channelId, topicId) => {
      abort(`:${channelId}`, topicId);
    },
    cancelContactTopic: (cardId, channelId, topicId) => {
      abort(`${cardId}:${channelId}`, topicId);
    },
    clearErrors: (cardId, channelId) => {
      var key = cardId ? `${cardId}:${channelId}` : `:${channelId}`;
      var topics = channels.current.get(key);
      if (topics) {
        topics.forEach((topic, topicId) => {
          if (topic.error) {
            topic.cancel.abort();
            topics.delete(topicId);
            updateProgress();
          }
        });
      }
    },
    clear: () => {
      channels.current.forEach((topics, channelId) => {
        topics.forEach((assets, topicId) => {
          assets.cancel.abort();
        });
      });
      channels.current.clear();
      updateProgress();
    }
  }

  return { state, actions }
}

async function getThumb(file, type, mime, size, position) {
  if (type === 'image') {
    if ((mime === GIF_TYPE || mime === WEBP_TYPE) && size < SCALE_SIZE) {
      var base = await RNFS.readFile(file, 'base64')
      return `data:image/jpeg;base64,${base}`;
    }
    else {
      var thumb = await ImageResizer.createResizedImage(file, 192, 192, "JPEG", 50, 0, null);
      var base = await RNFS.readFile(thumb.path, 'base64')
      return `data:image/jpeg;base64,${base}`;
    }
  }
  else if (type === 'video') {
    var shot = await createThumbnail({ url: file, timeStamp: position * 1000 })
    var thumb = await ImageResizer.createResizedImage('file://' + shot.path, 192, 192, "JPEG", 50, 0, null);
    var base = await RNFS.readFile(thumb.path, 'base64')
    return `data:image/jpeg;base64,${base}`;
  }
  else {
    return null
  }
}

async function upload(entry, update, complete) {
  if (!entry.files?.length) {
    try {
      await entry.success(entry.assets);
      complete();
    }
    catch (err) {
      console.log(err);
      entry.failure();
      entry.error = true;
      update();
    }
  }
  else {
    var file = entry.files.shift();
    entry.active = {};
    try {
      if (file.encrypted) {
        var { data, type, mime, size, getEncryptedBlock, position, label, extension } = file;
        var thumb = await getThumb(data, type, mime, size, position);
        var parts = [];
        for (let pos = 0; pos < size; pos += ENCRYPTED_BLOCK_SIZE) {
          var len = pos + ENCRYPTED_BLOCK_SIZE > size ? size - pos : ENCRYPTED_BLOCK_SIZE;
          var { blockEncrypted, blockIv } = await getEncryptedBlock(pos, len);
          var part = await axios.post(`${entry.baseUrl}blocks${entry.urlParams}`, blockEncrypted, {
            headers: {'Content-Type': 'text/plain'},
            signal: entry.cancel.signal,
            onUploadProgress: (ev) => {
              var { loaded, total } = ev;
              var partLoaded = pos + Math.floor(len * loaded / total);
              entry.active = { loaded: partLoaded, total: size }
              update();
            }
          });
          parts.push({ blockIv, partId: part.data.assetId });
        }
        entry.assets.push({
          encrypted: { type, label, extension, thumb, parts }
        });
      }
      else if (file.type === 'image') {
        var formData = new FormData();
        var uri = file.data.startsWith('file:') ? file.data : `file://${file.data}`;
        formData.append("asset", {uri: uri, name: 'asset', type: 'application/octent-stream'});
        let transform = encodeURIComponent(JSON.stringify(["ithumb;photo", "ilg;photo"]));
        let asset = await axios.post(`${entry.baseUrl}assets${entry.urlParams}&transforms=${transform}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: entry.cancel.signal,
          onUploadProgress: (ev) => {
            var { loaded, total } = ev;
            entry.active = { loaded, total }
            update();
          },
        });
        entry.assets.push({
          image: {
            thumb: asset.data.find(item => item.transform === 'ithumb;photo').assetId,
            full: asset.data.find(item => item.transform === 'ilg;photo').assetId, 
          }
        });
      }
      else if (file.type === 'video') {
        var formData = new FormData();
        var uri = file.data.startsWith('file:') ? file.data : `file://${file.data}`;
        formData.append("asset", {uri: uri, name: 'asset', type: 'application/octent-stream'});
        let thumb = 'vthumb;video;' + file.position;
        let transform = encodeURIComponent(JSON.stringify(["vlq;video", "vhd;video", thumb]));
        let asset = await axios.post(`${entry.baseUrl}assets${entry.urlParams}&transforms=${transform}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: entry.cancel.signal,
          onUploadProgress: (ev) => {
            var { loaded, total } = ev;
            entry.active = { loaded, total }
            update();
          },
        });
        entry.assets.push({
          video: {
            thumb: asset.data.find(item => item.transform === thumb).assetId,
            lq: asset.data.find(item => item.transform === 'vlq;video').assetId,
            hd: asset.data.find(item => item.transform === 'vhd;video').assetId,
          }
        });
      }
      else if (file.type === 'audio') {
        var formData = new FormData();
        var uri = file.data.startsWith('file:') ? file.data : `file://${file.data}`;
        formData.append("asset", {uri: uri, name: 'asset', type: 'application/octent-stream'});
        let transform = encodeURIComponent(JSON.stringify(["acopy;audio"]));
        let asset = await axios.post(`${entry.baseUrl}assets${entry.urlParams}&transforms=${transform}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: entry.cancel.signal,
          onUploadProgress: (ev) => {
            var { loaded, total } = ev;
            entry.active = { loaded, total }
            update();
          },
        });
        entry.assets.push({
          audio: {
            label: file.label,
            full: asset.data.find(item => item.transform === 'acopy;audio').assetId,
          }
        });
      }
      else if (file.type === 'binary') {
        var formData = new FormData();
        var uri = file.data.startsWith('file:') ? file.data : `file://${file.data}`;
        formData.append("asset", {uri: uri, name: 'asset', type: 'application/octent-stream'});
        let asset = await axios.post(`${entry.baseUrl}blocks${entry.urlParams}&body=multipart`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: entry.cancel.signal,
          onUploadProgress: (ev) => {
            var { loaded, total } = ev;
            entry.active = { loaded, total }
            update();
          },
        });
        entry.assets.push({
          binary: {
            label: file.label,
            extension: file.extension,
            data: asset.data.assetId,
          }
        });
      }
      entry.active = null;
      upload(entry, update, complete);
    }
    catch (err) {
      console.log(err);
      entry.failure();
      entry.error = true;
      update();
    }
  }
}

