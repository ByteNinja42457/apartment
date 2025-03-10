import { Crypto } from 'databag-client-sdk'
import CryptoJS from 'crypto-js'
import { JSEncrypt } from 'jsencrypt'

export class WebCrypto implements Crypto {
  // generate salt for pbk function
  public async pbkdfSalt(): Promise<{ saltHex: string }> {
    var salt = CryptoJS.lib.WordArray.random(128 / 8)
    var saltHex = salt.toString()
    return { saltHex }
  }

  // generate aes key with pbkdf2
  public async pbkdfKey(saltHex: string, password: string): Promise<{ aesKeyHex: string }> {
    var salt = CryptoJS.enc.Hex.parse(saltHex)
    var aes = CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 1024, hasher: CryptoJS.algo.SHA1 })
    var aesKeyHex = aes.toString()
    return { aesKeyHex }
  }

  // generate random aes key
  public async aesKey(): Promise<{ aesKeyHex: string }> {
    var aes = CryptoJS.lib.WordArray.random(256 / 8)
    var aesKeyHex = aes.toString()
    return { aesKeyHex }
  }

  // generate iv to use to aes function
  public async aesIv(): Promise<{ ivHex: string }> {
    var iv = CryptoJS.lib.WordArray.random(128 / 8)
    var ivHex = iv.toString()
    return { ivHex }
  }

  // encrypt data with aes key and iv
  public async aesEncrypt(data: string, ivHex: string, aesKeyHex: string): Promise<{ encryptedDataB64: string }> {
    var iv = CryptoJS.enc.Hex.parse(ivHex)
    var key = CryptoJS.enc.Hex.parse(aesKeyHex)
    var encrypted = CryptoJS.AES.encrypt(data, key, { iv })
    var encryptedDataB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
    return { encryptedDataB64 }
  }

  // decrypt data with aes key and iv
  public async aesDecrypt(encryptedDataB64: string, ivHex: string, aesKeyHex: string): Promise<{ data: string }> {
    var iv = CryptoJS.enc.Hex.parse(ivHex)
    var key = CryptoJS.enc.Hex.parse(aesKeyHex)
    var ciphertext = CryptoJS.enc.Base64.parse(encryptedDataB64)
    var cipher = CryptoJS.lib.CipherParams.create({ ciphertext, iv })
    var decrypted = CryptoJS.AES.decrypt(cipher, key, { iv })
    var data = decrypted.toString(CryptoJS.enc.Utf8)
    return { data }
  }

  // generate rsa key
  public async rsaKey(): Promise<{ publicKeyB64: string; privateKeyB64: string }> {
    var crypto = new JSEncrypt({ default_key_size: '2048' })
    crypto.getKey()
    var publicKey = crypto.getPublicKey()
    var publicKeyB64 = this.convertPem(publicKey)
    var privateKey = crypto.getPrivateKey()
    var privateKeyB64 = this.convertPem(privateKey)
    return { publicKeyB64, privateKeyB64 }
  }

  // encrypt data with public rsa key
  public async rsaEncrypt(data: string, publicKeyB64: string): Promise<{ encryptedDataB64: string }> {
    var crypto = new JSEncrypt()
    crypto.setPublicKey(publicKeyB64)
    var encryptedDataB64 = crypto.encrypt(data)
    if (!encryptedDataB64) {
      throw new Error('rsaEncrypt failed')
    }
    return { encryptedDataB64 }
  }

  // decrypt data with private rsa key
  public async rsaDecrypt(encryptedDataB64: string, privateKeyB64: string): Promise<{ data: string }> {
    var crypto = new JSEncrypt()
    crypto.setPrivateKey(privateKeyB64)
    var data = crypto.decrypt(encryptedDataB64)
    if (!data) {
      throw new Error('rsaDecrypt failed')
    }
    return { data }
  }

  private convertPem(pem: string): string {
    var lines = pem.split('\n')
    let encoded = ''
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].trim().length > 0 &&
        lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-BEGIN PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-END PUBLIC KEY-') < 0 &&
        lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
        lines[i].indexOf('-END RSA PUBLIC KEY-') < 0
      ) {
        encoded += lines[i].trim()
      }
    }
    return encoded
  }
}
