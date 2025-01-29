import CryptoJS from 'crypto-js';
import { RSA } from 'react-native-rsa-native';
import { JSEncrypt } from 'jsencrypt'

export function getChannelSeals(subject) {
  var { seals } = JSON.parse(subject);
  return seals;
}

export function isUnsealed(seals, sealKey) {
  for (let i = 0; i < seals?.length; i++) {
    if (seals[i].publicKey === sealKey?.public) {
      return sealKey?.private != null;
    }
  }
  return false;
}

export async function getContentKey(seals, sealKey) {
  for (let i = 0; i < seals?.length; i++) {
    if (seals[i].publicKey === sealKey.public) {
      var seal = seals[i];
      var begin = '-----BEGIN RSA PRIVATE KEY-----\n';
      var end = '\n-----END RSA PRIVATE KEY-----';
      var key = `${begin}${sealKey.private}${end}`;
      return await RSA.decrypt(seal.sealedKey, key);
    }
  }
  throw new Error("unsealKey not available");
}

export function encryptChannelSubject(subject, publicKeys) {
  var key = CryptoJS.lib.WordArray.random(256 / 8);
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var encrypted = CryptoJS.AES.encrypt(JSON.stringify({ subject }), key, { iv: iv });
  var subjectEncrypted = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  var subjectIv = iv.toString();
  var keyHex = key.toString();

  let seals = [];
  let crypto = new JSEncrypt();
  publicKeys.forEach(publicKey => {
    crypto.setPublicKey(publicKey);
    var sealedKey = crypto.encrypt(keyHex);
    seals.push({ publicKey, sealedKey });
  });

  return { subjectEncrypted, subjectIv, seals };
}

export function updateChannelSubject(subject, contentKey) {
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var encrypted = CryptoJS.AES.encrypt(JSON.stringify({ subject }), key, { iv: iv });
  var subjectEncrypted = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  var subjectIv = iv.toString();
  return { subjectEncrypted, subjectIv };
}

export function encryptBlock(block, contentKey) {
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var encrypted = CryptoJS.AES.encrypt(block, key, { iv: iv });
  var blockEncrypted = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  var blockIv = iv.toString();

  return { blockEncrypted, blockIv };
}

export function decryptBlock(blockEncrypted, blockIv, contentKey) {
  var iv = CryptoJS.enc.Hex.parse(blockIv);
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var enc = CryptoJS.enc.Base64.parse(blockEncrypted);
  var cipher = CryptoJS.lib.CipherParams.create({ ciphertext: enc, iv: iv });
  var dec = CryptoJS.AES.decrypt(cipher, key, { iv: iv });
  var block = dec.toString(CryptoJS.enc.Utf8);

  return block;
}

export function decryptChannelSubject(subject, contentKey) {
  var { subjectEncrypted, subjectIv } = JSON.parse(subject);
  var iv = CryptoJS.enc.Hex.parse(subjectIv);
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var enc = CryptoJS.enc.Base64.parse(subjectEncrypted);
  var cipher = CryptoJS.lib.CipherParams.create({ ciphertext: enc, iv: iv });
  var dec = CryptoJS.AES.decrypt(cipher, key, { iv: iv });
  var str = dec.toString(CryptoJS.enc.Utf8);
  if (!str) {
    return null;
  }
  return JSON.parse(str);
}

export function encryptTopicSubject(subject, contentKey) {
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var encrypted = CryptoJS.AES.encrypt(JSON.stringify(subject), key, { iv: iv });
  var messageEncrypted = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  var messageIv = iv.toString();
  return { messageEncrypted, messageIv };
}

export function decryptTopicSubject(subject, contentKey) {
  var { messageEncrypted, messageIv } = JSON.parse(subject);
  var iv = CryptoJS.enc.Hex.parse(messageIv);
  var key = CryptoJS.enc.Hex.parse(contentKey);
  var enc = CryptoJS.enc.Base64.parse(messageEncrypted);
  let cipher = CryptoJS.lib.CipherParams.create({ ciphertext: enc, iv: iv });
  var dec = CryptoJS.AES.decrypt(cipher, key, { iv: iv });
  return JSON.parse(dec.toString(CryptoJS.enc.Utf8));
}

function convertPem(pem) {
  var lines = pem.split('\n');
  var encoded = '';
  for(var i = 0;i < lines.length;i++){
    if (lines[i].trim().length > 0 &&
        lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-BEGIN PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-END PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-END RSA PUBLIC KEY-') < 0) {
      encoded += lines[i].trim();
    }
  }
  return encoded
};

export async function generateSeal(password) {

  // generate key to encrypt private key
  var salt = CryptoJS.lib.WordArray.random(128 / 8);
  var aes = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1024,
  });

  // generate rsa key for sealing channel, delay for activity indicators
  await new Promise(r => setTimeout(r, 1000));
  var crypto = new JSEncrypt({ default_key_size: 2048 });
  crypto.getKey();

  // encrypt private key
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var privateKey = convertPem(crypto.getPrivateKey());
  var enc = CryptoJS.AES.encrypt(privateKey, aes, { iv: iv });
  var publicKey = convertPem(crypto.getPublicKey());

  // update account
  var seal = {
    passwordSalt: salt.toString(),
    privateKeyIv: iv.toString(),
    privateKeyEncrypted: enc.ciphertext.toString(CryptoJS.enc.Base64),
    publicKey: publicKey,
  }
  var sealKey = {
    public: publicKey,
    private: privateKey,
  }

  return { seal, sealKey };
}

export function unlockSeal(seal, password) {

  // generate key to encrypt private key
  var salt = CryptoJS.enc.Hex.parse(seal.passwordSalt);
  var aes = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1024,
  });

  // decrypt private key
  var iv = CryptoJS.enc.Hex.parse(seal.privateKeyIv);
  var enc = CryptoJS.enc.Base64.parse(seal.privateKeyEncrypted)

  let cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: enc,
    iv: iv
  });
  var dec = CryptoJS.AES.decrypt(cipherParams, aes, { iv: iv });
  var privateKey = dec.toString(CryptoJS.enc.Utf8)

  // store ke
  var sealKey = {
    public: seal.publicKey,
    private: privateKey,
  }

  return sealKey;
}

export function updateSeal(seal, sealKey, password) {

  // generate key to encrypt private key
  var salt = CryptoJS.lib.WordArray.random(128 / 8);
  var aes = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 1024,
  });

  // encrypt private key
  var iv = CryptoJS.lib.WordArray.random(128 / 8);
  var enc = CryptoJS.AES.encrypt(sealKey.private, aes, { iv: iv });

  // update account
  var updated = {
    passwordSalt: salt.toString(),
    privateKeyIv: iv.toString(),
    privateKeyEncrypted: enc.ciphertext.toString(CryptoJS.enc.Base64),
    publicKey: seal.publicKey,
  }

  return { seal: updated, sealKey };
}
