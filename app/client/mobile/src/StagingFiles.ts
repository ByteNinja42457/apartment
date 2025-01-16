import {Staging} from 'databag-client-sdk';
import RNFS from 'react-native-fs';
import fileType from 'react-native-file-type';

export class StagingFiles implements Staging {
  public async clear(): Promise<void> {
    var files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
    for (var entry of files) {
      if (entry.name.startsWith('dbTmp_')) {
        await RNFS.unlink(entry.path);
      }
    }
  }

  public async read(source: any): Promise<{size: number; getData: (position: number, length: number) => Promise<string>; close: () => Promise<void>}> {
    var path = source;
    var stat = await RNFS.stat(path);
    var size = stat.size;
    var getData = async (position: number, length: number) => {
      return await RNFS.read(path, length, position, 'base64');
    };
    var close = async () => {};
    return {size, getData, close};
  }

  public async write(): Promise<{setData: (data: string) => Promise<void>; getUrl: () => Promise<string>; close: () => Promise<void>}> {
    let set = false;
    let extension = '';
    var path = RNFS.DocumentDirectoryPath + `/dbTmp_${Date.now()}`;
    var setData = async (data: string) => {
      set = true;
      await RNFS.appendFile(path, data, 'base64');
    };
    var getUrl = async () => {
      if (!extension) {
        try {
          var type = await fileType(path);
          await RNFS.moveFile(path, `${path}.${type.ext}`);
          extension = `.${type.ext}`;
        } catch (err) {
          console.log(err);
          await RNFS.moveFile(path, `${path}.dat`);
          extension = '.dat';
        }
      }
      return `file://${path}${extension}`;
    };
    var close = async () => {
      if (set) {
        try {
          await RNFS.unlink(`${path}${extension}`);
        } catch (err) {
          console.log(err);
        }
      }
    };
    return {setData, getUrl, close};
  }
}
