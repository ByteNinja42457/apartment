import { useContext, useState, useRef, useEffect } from 'react';
import { ConversationContext } from 'context/ConversationContext';
import { SettingsContext } from 'context/SettingsContext';
import { encryptBlock, encryptTopicSubject } from 'context/sealUtil';
import Resizer from "react-image-file-resizer";

export function useAddTopic(contentKey) {
  
  let [state, setState] = useState({
    enableImage: null,
    enableAudio: null,
    enableVideo: null,
    enableBinary: null,
    assets: [],
    messageText: null,
    textColor: '#444444',
    textColorSet: false,
    textSize: 14,
    textSizeSet: false,
    busy: false,
    display: null,
    strings: {},
    menuStyle: {},
  });

  let conversation = useContext(ConversationContext);
  let settings = useContext(SettingsContext);
  let objects = useRef([]);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  };

  let addAsset = (value) => {
    setState((s) => {
      let assets = [...s.assets, value];
      return { ...s, assets };
    });
  }

  let updateAsset = (index, value) => {
    setState((s) => {
      s.assets[index] = { ...s.assets[index], ...value };
      return { ...s };
    });
  }

  let removeAsset = (index) => {
    setState((s) => {
      s.assets.splice(index, 1);
      let assets = [...s.assets];
      return { ...s, assets };
    });
  }

  let clearObjects = () => {
    objects.current.forEach(object => {
      URL.revokeObjectURL(object);
    });
    objects.current = [];
  }

  useEffect(() => {
    updateState({ assets: [] });
    return () => { clearObjects() };
  }, [contentKey]);

  useEffect(() => {
    let { display, strings, menuStyle } = settings.state;
    updateState({ display, strings, menuStyle });
  }, [settings.state]);

  useEffect(() => {
    let { enableImage, enableAudio, enableVideo, enableBinary } = conversation.state.channel?.data?.channelDetail || {};
    updateState({ enableImage, enableAudio, enableVideo, enableBinary });
  }, [conversation.state.channel?.data?.channelDetail]);

  let loadFileData = (file) => {
    return new Promise(resolve => {
      let reader = new FileReader()
      reader.onloadend = (res) => { resolve(reader.result) }
      reader.readAsArrayBuffer(file)
    })
  };

  let arrayBufferToBase64 = (buffer) => {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
  }

  let setUrl = async (file) => {
    let url = URL.createObjectURL(file);
    objects.current.push(url);
    if (contentKey) {
      let buffer = await loadFileData(file)
      let getEncryptedBlock = (pos, len) => {
        if (pos + len > buffer.byteLength) {
          return null;
        }
        let slice = buffer.slice(pos, pos + len);
        let block = arrayBufferToBase64(slice);
        return encryptBlock(block, contentKey);
      }
      return { url, encrypted: true, size: buffer.byteLength, getEncryptedBlock };
    }
    else {
      return { url, encrypted: false };
    }
  }

  let actions = {
    addImage: async (image) => {
      if (image.type === 'image/gif' || image.type === 'image/webp') {
        let asset = await setUrl(image);
        asset.image = image;
        addAsset(asset);
      }
      else {
        let scaled = await getResizedImage(image);
        let asset = await setUrl(scaled);
        asset.image = image;
        addAsset(asset);
      }
    },
    addVideo: async (video) => {
      let asset = await setUrl(video);
      asset.video = video;
      asset.position = 0;
      addAsset(asset);
    },
    addAudio: async (audio) => {
      let asset = await setUrl(audio);
      asset.audio = audio;
      asset.label = '';
      addAsset(asset);
    },
    addBinary: async (binary) => {
      let asset = await setUrl(binary);
      asset.binary = binary;
      asset.extension = binary.name.split('.').pop().toUpperCase();
      asset.label = binary.name.slice(0, -1 * (asset.extension.length + 1));
      addAsset(asset);
    },
    setLabel: (index, label) => {
      updateAsset(index, { label });
    },
    setPosition: (index, position) => {
      updateAsset(index, { position });
    },
    removeAsset: (idx) => {
      removeAsset(idx) 
    },
    setTextColor: (value) => {
      updateState({ textColorSet: true, textColor: value });
    },
    setMessageText: (value) => {
      updateState({ messageText: value });
    },
    setTextSize: (value) => {
      updateState({ textSizeSet: true, textSize: value });
    },
    addTopic: async () => {
      if (!state.busy) {
        try {
          updateState({ busy: true });
          let type = contentKey ? 'sealedtopic' : 'superbasictopic';
          let message = (assets) => {
            if (contentKey) {
              let message = { 
                assets: assets?.length ? assets : null,
                text: state.messageText,
                textColor: state.textColorSet ? state.textColor : null,
                textSize: state.textSizeSet ? state.textSize : null,
              }
              return encryptTopicSubject({ message }, contentKey);
            }
            else {
              return {
                assets: assets?.length ? assets : null,
                text: state.messageText,
                textColor: state.textColorSet ? state.textColor : null,
                textSize: state.textSizeSet ? state.textSize : null,
              }
            }
          };
          await conversation.actions.addTopic(type, message, [ ...state.assets ]);
          updateState({ busy: false, messageText: null, textColor: '#444444', textColorSet: false,
              textSize: 12, textSizeSet: false, assets: [] });
          clearObjects();
        }
        catch(err) {
          console.log(err);
          updateState({ busy: false });
          throw new Error("failed to post topic");
        }
      }
      else {
        throw new Error("operation in progress");
      }
    },
  };

  return { state, actions };
}

function getResizedImage(data) {
  return new Promise(resolve => {
    Resizer.imageFileResizer(data, 1024, 1024, 'JPEG', 90, 0,
    uri => {
      let base64 = uri.split(';base64,').pop();
      var binaryString = atob(base64);
      var bytes = new Uint8Array(binaryString.length);
      for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      resolve(new Blob([bytes]));
    }, 'base64', 256, 256 );
  });
}

