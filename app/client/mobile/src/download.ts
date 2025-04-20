import {Platform, Share} from 'react-native';
import fileType from 'react-native-file-type';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'rn-fetch-blob';

export async function Download(uri: string, name: string, extension?: string) {
  if (Platform.OS === 'ios') {
    let options = {fileCache: true, filename: name};
    let download = await RNFetchBlob.config(options).fetch('GET', uri);
    let downloadPath = download.path();

    let type = extension ? extension : (await fileType(downloadPath))?.ext;

    let sharePath = `${RNFS.DocumentDirectoryPath}/${name}.${type}`;
    if (await RNFS.exists(sharePath)) {
      await RNFS.unlink(sharePath);
    }
    await RNFS.moveFile(downloadPath, sharePath);

    await Share.share({url: sharePath});
    await RNFS.unlink(sharePath);
  } else {
    if (uri.startsWith('file:')) {
      let type = extension ? extension : (await fileType(uri))?.ext;
      let sharePath = `${RNFS.DownloadDirectoryPath}/${name}.${type}`;
      if (await RNFS.exists(sharePath)) {
        await RNFS.unlink(sharePath);
      }
      await RNFS.copyFile(uri, sharePath);
      await RNFS.scanFile(sharePath);
    } else {
      let options = {fileCache: true, filename: name};
      let download = await RNFetchBlob.config(options).fetch('GET', uri);
      let downloadPath = download.path();

      let type = extension ? extension : (await fileType(downloadPath))?.ext;
      let sharePath = `${RNFS.DownloadDirectoryPath}/${name}.${type}`;
      if (await RNFS.exists(sharePath)) {
        await RNFS.unlink(sharePath);
      }
      await RNFS.moveFile(downloadPath, sharePath);
      await RNFS.scanFile(sharePath);
    }
  }
}
