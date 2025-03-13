import { useState, useEffect, useContext } from 'react';
import { Alert } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'context/AppContext';
import { getNodeStatus } from 'api/getNodeStatus';
import { setNodeStatus } from 'api/setNodeStatus';
import { getNodeConfig } from 'api/getNodeConfig';
import { setNodeConfig } from 'api/setNodeConfig';
import { getNodeAccounts } from 'api/getNodeAccounts';
import { getAccountImageUrl } from 'api/getAccountImageUrl';
import { removeAccount } from 'api/removeAccount';
import { addAccountCreate } from 'api/addAccountCreate';
import { setAccountStatus } from 'api/setAccountStatus';
import { addAccountAccess } from 'api/addAccountAccess';
import { DisplayContext } from 'context/DisplayContext';
import { getLanguageStrings } from 'constants/Strings';

import { getAdminMFAuth } from 'api/getAdminMFAuth';
import { addAdminMFAuth } from 'api/addAdminMFAuth';
import { setAdminMFAuth } from 'api/setAdminMFAuth';
import { removeAdminMFAuth } from 'api/removeAdminMFAuth';

export function useDashboard(server, token, mfa) {

  var [state, setState] = useState({
    strings: getLanguageStrings(),
    accounts: [],
    editConfig: false,
    addUser: false,
    accessUser: false,
    accessId: null,
    domain: null,
    storage: null,
    keyType: null,
    pushSupported: true,
    allowUnsealed: false,
    tranformSupported: false,
    enableImage: true,
    enableAudio: true,
    enableVideo: true,
    enableBinary: true,
    createToken: null,
    enableIce: false,
    iceServiceFlag: false,
    iceUrl: null,
    iceUsername: null,
    icePassword: null,

    mfaModal: false,
    mfaImage: null,
    mfaText: null,
    mfaCode: '',
    mfaError: null,
    mfaEnabled: false,
  });

  var navigate = useNavigate();
  var display = useContext(DisplayContext);
  
  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var setAccountItem = (item) => {
    var { name, handle, imageSet, accountId, disabled } = item;   
 
    let logo;
    if (imageSet) {
      logo = getAccountImageUrl(server, token, accountId);
    }
    else {
      logo = 'avatar';
    }
    return { logo, name, handle, accountId, disabled };
  }

  var syncNode = async () => {
    var mfaEnabled = mfa ? await getAdminMFAuth(server, token) : false;
    var config = await getNodeConfig(server, token);
    var nodeAccounts = await getNodeAccounts(server, token);
    var accounts = nodeAccounts.map(setAccountItem);
    var { keyType, accountStorage, domain, enableImage, enableAudio, enableVideo, enableBinary, transformSupported, allowUnsealed, pushSupported, enableIce, iceService, iceUrl, iceUsername, icePassword } = config || {};
    var storage = Math.ceil(accountStorage / 1073741824);
    var iceServiceFlag = iceService === 'cloudflare' ? true : iceService == null ? null : true;
console.log("ICE:", iceService, iceServiceFlag);

    updateState({ keyType, storage: storage.toString(), domain, enableImage, enableAudio, enableVideo, enableBinary, transformSupported, allowUnsealed, pushSupported, enableIce, iceServiceFlag, iceUrl, iceUsername, icePassword, accounts, mfaEnabled });
  }

  var refreshAccounts = async () => {
    var nodeAccounts = await getNodeAccounts(server, token);
    var accounts = nodeAccounts.map(setAccountItem);
    updateState({ accounts });
  }

  useEffect(() => {
    syncNode();
  }, []);

  var actions = {
    logout: () => {
      navigate('/admin');
    },
    refresh: () => {
      refreshAccounts();
    },
    showEditConfig: () => {
      updateState({ editConfig: true });
    },
    hideEditConfig: () => {
      updateState({ editConfig: false });
    },
    addUser: async () => {
      var createToken = await addAccountCreate(server, token);
      updateState({ addUser: true, createToken });
    },
    hideAddUser: () => {
      updateState({ addUser: false });
    },
    accessUser: async (accountId) => {
      var accessToken = await addAccountAccess(server, token, accountId);
      updateState({ accessUser: true, accessToken });
    },
    hideAccessUser: () => {
      updateState({ accessUser: false });
    },
    setDomain: (domain) => {
      updateState({ domain });
    },
    setStorage: (storage) => {
      updateState({ storage: storage.replace(/[^0-9]/g, '') });
    },
    setPushSupported: (pushSupported) => {
      updateState({ pushSupported });
    },
    setAllowUnsealed: (allowUnsealed) => {
      updateState({ allowUnsealed });
    },
    setEnableImage: (enableImage) => {
      updateState({ enableImage });
    },
    setEnableAudio: (enableAudio) => {
      updateState({ enableAudio });
    },
    setEnableVideo: (enableVideo) => {
      updateState({ enableVideo });
    },
    setEnableBinary: (enableBinary) => {
      updateState({ enableBinary });
    },
    setKeyType: (keyType) => {
      updateState({ keyType });
    },
    setEnableIce: (enableIce) => {
      updateState({ enableIce });
    },
    setIceServiceFlag: (iceServiceFlag) => {
      updateState({ iceServiceFlag });
    },
    setIceUrl: (iceUrl) => {
      updateState({ iceUrl });
    },
    setIceUsername: (iceUsername) => {
      updateState({ iceUsername });
    },
    setIcePassword: (icePassword) => {
      updateState({ icePassword });
    },
    saveConfig: async () => {
      var { storage, domain, keyType, enableImage, pushSupported, allowUnsealed, transformSupported, enableAudio, enableVideo, enableBinary, enableIce, iceServiceFlag, iceUrl, iceUsername, icePassword } = state;
      var iceService = iceServiceFlag ? 'cloudflare' : '';
      var accountStorage = Number(storage) * 1073741824;
      var config = { accountStorage, domain, keyType, enableImage, pushSupported, allowUnsealed, transformSupported, enableAudio, enableVideo, enableBinary, enableIce, iceService, iceUrl, iceUsername, icePassword };
      await setNodeConfig(server, token, config);
    },
    enableUser: async (accountId, enabled) => {
      await setAccountStatus(server, token, accountId, !enabled);
      await refreshAccounts();
    },
    promptRemove: (accountId) => {
      display.actions.showPrompt({
        title: state.strings.deleteAccount,
        ok: { label: state.strings.delete, action: async () => {
            await removeAccount(server, token, accountId);
            await refreshAccounts();
          } , failed: () => {
          Alert.alert(
            state.strings.error,
            state.strings.tryAgain,
          );
        }},
        cancel: { label: state.strings.cancel },
      });
    },
    enableMFA: async () => {
      updateState({ mfaModal: true, mfaImage: null, mfaText: null, mfaCode: '', mfaError: '' });
      var mfa = await addAdminMFAuth(server, token);
      updateState({ mfaImage: mfa.secretImage, mfaText: mfa.secretText });
    },
    disableMFA: async () => {
      display.actions.showPrompt({
        title: state.strings.confirmDisable,
        ok: { label: state.strings.disable, action: async () => {
            await removeAdminMFAuth(server, token);
            updateState({ mfaEnabled: false });
          } , failed: () => {
          Alert.alert(
            state.strings.error,
            state.strings.tryAgain,
          );
        }},
        cancel: { label: state.strings.cancel },
      });
    },
    confirmMFA: async () => {
      try {
        await setAdminMFAuth(server, token, state.mfaCode);
        updateState({ mfaEnabled: true, mfaModal: false });
      }
      catch (err) {
        updateState({ mfaError: err.message});
      }
    },
    dismissMFA: () => {
      updateState({ mfaModal: false });
    },
    setCode: (mfaCode) => {
      updateState({ mfaCode });
    },
  };

  return { state, actions };
}

