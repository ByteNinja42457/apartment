import {useEffect, useState, useContext, useRef} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import {type Setup, KeyType, ICEService} from 'databag-client-sdk';

let DEBOUNCE_MS = 2000;
let DELAY_MS = 1000;

export function useSetup() {
  let updated = useRef(false);
  let loading = useRef(false);
  let debounce = useRef(setTimeout(() => {}, 0));
  let setup = useRef(null as null | Setup);
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    layout: '',
    strings: display.state.strings,
    loading: true,
    updating: false,
    error: false,
    accountStorage: '',
    setup: null as null | Setup,
    mfaEnabled: false,
    mfaCode: '',
    mfaMessage: '',
    confirmingMFAuth: false,
    confirmMFAuthText: '',
    confirmMFAuthImage: '',
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let sync = async () => {
    while (loading.current) {
      try {
        let service = app.state.service;
        let mfaEnabled = await service.checkMFAuth();
        setup.current = await service.getSetup();
        loading.current = false;
        let storage = Math.floor((setup.current?.accountStorage || 0) / 1073741824);
        updateState({setup: setup.current, mfaEnabled, accountStorage: storage.toString(), loading: false});
      } catch (err) {
        console.log(err);
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  };

  let save = () => {
    updated.current = true;
    updateState({updating: true});
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      updated.current = false;
      try {
        let service = app.state.service;
        await service.setSetup(setup.current);
        if (updated.current) {
          save();
        } else {
          updateState({updating: false});
        }
      } catch (err) {
        console.log(err);
        updateState({error: true});
      }
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  useEffect(() => {
    if (app.state.service) {
      loading.current = true;
      sync();
      return () => {
        loading.current = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.state.service]);

  let actions = {
    logout: app.actions.adminLogout,
    clearError: () => {
      updateState({error: false});
    },
    enableMFAuth: async () => {
      try {
        let service = app.state.service;
        let {text, image} = await service.enableMFAuth();
        updateState({confirmingMFAuth: true, mfaCode: '', mfaMessage: '', confirmMFAuthText: text, confirmMFAuthImage: image});
      } catch (err) {
        console.log(err);
        updateState({error: true});
      }
    },
    disableMFAuth: async () => {
      try {
        let service = app.state.service;
        await service.disableMFAuth();
        updateState({mfaEnabled: false});
      } catch (err) {
        console.log(err);
        updateState({error: true});
      }
    },
    confirmMFAuth: async () => {
      try {
        let service = app.state.service;
        await service.confirmMFAuth(state.mfaCode);
        updateState({confirmingMFAuth: false, mfaEnabled: true});
      } catch (err) {
        let {message} = err as {message: string};
        if (message === '401') {
          updateState({mfaMessage: state.strings.mfaError});
        } else if (message === '429') {
          updateState({mfaMessage: state.strings.mfaDisabled});
        } else {
          updateState({mfaMessage: state.strings.error});
        }
      }
    },
    cancelMFAuth: () => {
      updateState({confirmingMFAuth: false});
    },
    setMFAuthCode: (mfaCode: string) => {
      updateState({mfaCode});
    },
    setDomain: (domain: string) => {
      if (setup.current) {
        setup.current.domain = domain;
        updateState({setup: setup.current});
        save();
      }
    },
    setAccountStorage: (accountStorage: string) => {
      if (setup.current) {
        let storage = parseInt(accountStorage, 10) * 1073741824;
        if (storage >= 0) {
          setup.current.accountStorage = storage;
          updateState({setup: setup.current, accountStorage});
        } else {
          setup.current.accountStorage = 0;
          updateState({setup: setup.current, accountStorage: 0});
        }
        save();
      }
    },
    setKeyType: (type: string) => {
      let keyType = type === 'RSA2048' ? KeyType.RSA_2048 : KeyType.RSA_4096;
      if (setup.current) {
        setup.current.keyType = keyType;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableOpenAccess: (enableOpenAccess: boolean) => {
      if (setup.current) {
        setup.current.enableOpenAccess = enableOpenAccess;
        updateState({setup: setup.current});
        save();
      }
    },
    setOpenAccessLimit: (openAccessLimit: string) => {
      if (setup.current) {
        let limit = parseInt(openAccessLimit, 10);
        if (limit >= 0) {
          setup.current.openAccessLimit = limit;
          updateState({setup: setup.current, openAccessLimit});
        } else {
          setup.current.openAccessLimit = 0;
          updateState({setup: setup.current, openAccessLimit: 0});
        }
        save();
      }
    },
    setPushSupported: (pushSupported: boolean) => {
      if (setup.current) {
        setup.current.pushSupported = pushSupported;
        updateState({setup: setup.current});
        save();
      }
    },
    setAllowUnsealed: (allowUnsealed: boolean) => {
      if (setup.current) {
        setup.current.allowUnsealed = allowUnsealed;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableImage: (enableImage: boolean) => {
      if (setup.current) {
        setup.current.enableImage = enableImage;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableAudio: (enableAudio: boolean) => {
      if (setup.current) {
        setup.current.enableAudio = enableAudio;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableVideo: (enableVideo: boolean) => {
      if (setup.current) {
        setup.current.enableVideo = enableVideo;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableBinary: (enableBinary: boolean) => {
      if (setup.current) {
        setup.current.enableBinary = enableBinary;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableIce: (enableIce: boolean) => {
      if (setup.current) {
        setup.current.enableIce = enableIce;
        updateState({setup: setup.current});
        save();
      }
    },
    setEnableService: (iceService: boolean) => {
      if (setup.current) {
        let iceUrl = iceService ? 'https://rtc.live.cloudflare.com/v1/turn/keys/%%TURN_KEY_ID%%/credentials/generate' : '';
        setup.current.iceUrl = iceUrl;
        setup.current.iceService = iceService ? ICEService.Cloudflare : ICEService.Default;
        updateState({setup: setup.current});
        save();
      }
    },
    setIceUrl: (iceUrl: string) => {
      if (setup.current) {
        setup.current.iceUrl = iceUrl;
        updateState({setup: setup.current});
        save();
      }
    },
    setIceUsername: (iceUsername: string) => {
      if (setup.current) {
        setup.current.iceUsername = iceUsername;
        updateState({setup: setup.current});
        save();
      }
    },
    setIcePassword: (icePassword: string) => {
      if (setup.current) {
        setup.current.icePassword = icePassword;
        updateState({setup: setup.current});
        save();
      }
    },
  };

  return {state, actions};
}
