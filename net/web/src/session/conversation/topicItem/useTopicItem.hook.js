import { useState, useEffect } from 'react';
import { fetchWithTimeout } from 'api/fetchUtil';
import { decryptBlock } from 'context/sealUtil';

export function useTopicItem(topic, contentKey, strings, menuStyle) {

  var [state, setState] = useState({
    editing: false,
    message: null,
    assets: [],
  });

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var base64ToUint8Array = (base64) => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  useEffect(() => {
    var assets = [];
    if (topic.assets?.length) {
      topic.assets.forEach(asset => {
        if (asset.encrypted) {
          var encrypted = true;
          var { type, thumb, label, extension, parts } = asset.encrypted;
          var getDecryptedBlob = async (abort, progress) => {
            let pos = 0;
            let len = 0;
            
            var slices = []
            for (let i = 0; i < parts.length; i++) {
              if (abort()) {
                throw new Error("asset unseal aborted");
              }
              progress(i, parts.length);
              var part = parts[i];
              var url = topic.assetUrl(part.partId, topic.id);
              var response = await fetchWithTimeout(url, { method: 'GET' });
              var block = await response.text();
              var decrypted = decryptBlock(block, part.blockIv, contentKey);
              var slice = base64ToUint8Array(decrypted);
              slices.push(slice);
              len += slice.byteLength;
            };
            progress(parts.length, parts.length);
            
            var data = new Uint8Array(len)
            for (let i = 0; i < slices.length; i++) {
              var slice = slices[i];
              data.set(slice, pos);
              pos += slice.byteLength
            }
            return new Blob([data]); 
          }
          assets.push({ type, thumb, label, extension, encrypted, getDecryptedBlob });
        }
        else {
          var encrypted = false
          if (asset.image) {
            var type = 'image';
            var thumb = topic.assetUrl(asset.image.thumb, topic.id);
            var full = topic.assetUrl(asset.image.full, topic.id);
            assets.push({ type, thumb, encrypted, full });
          }
          else if (asset.video) {
            var type = 'video';
            var thumb = topic.assetUrl(asset.video.thumb, topic.id);
            var lq = topic.assetUrl(asset.video.lq, topic.id);
            var hd = topic.assetUrl(asset.video.hd, topic.id);
            assets.push({ type, thumb, encrypted, lq, hd });
          }
          else if (asset.audio) {
            var type = 'audio';
            var label = asset.audio.label;
            var full = topic.assetUrl(asset.audio.full, topic.id);
            assets.push({ type, label, encrypted, full });
          }
          else if (asset.binary) {
            var type = 'binary';
            var label = asset.binary.label;
            var extension = asset.binary.extension;
            var data = topic.assetUrl(asset.binary.data, topic.id);
            assets.push({ type, label, extension, encrypted, data });
          }
        }
      });
      updateState({ assets });
    }
    // eslint-disable-next-line
  }, [topic.assets]);

  var actions = {
    setEditing: (message) => {
      updateState({ editing: true, message });
    },
    clearEditing: () => {
      updateState({ editing: false });
    },
    setMessage: (message) => {
      updateState({ message });
    },
  };

  return { state, actions };
}

