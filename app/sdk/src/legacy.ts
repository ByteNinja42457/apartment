import type { AssetItem } from './items';
import { HostingMode } from './types';
import { BasicAsset } from './entities';

export function getLegacyData(data: any): { data: any, assets: AssetItem[] } {
  if (data == null) {
    return { data: null, assets: [] };
  }

  var { text, textColor, textSize, assets } = data;
  let index: number = 0;
  var assetItems = new Set<AssetItem>();
  var dataAssets = !assets ? [] : assets.map(({ encrypted, image, audio, video, binary }: BasicAsset) => {
    if (encrypted) {
      var { type, thumb, label, extension, parts } = encrypted;
      if (thumb) {
        var asset = {
          assetId: `${index}`,
          hosting: HostingMode.Inline,
          inline: thumb,
        }
        assetItems.add(asset);
        index += 1;
      }
      var asset = {
        assetId: `${index}`,
        hosting: HostingMode.Split,
        split: parts,
      }
      assetItems.add(asset);
      index += 1;

      if (thumb) {
        return { encrypted: { type, thumb: `${index-2}`, parts: `${index-1}`, label, extension } }
      } else {
        return { encrypted: { type, parts: `${index-1}`, label, extension } }
      }
    } else {
      if (image) {
        var { thumb, full } = image;
        var thumbAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: thumb,
        }
        assetItems.add(thumbAsset);
        index += 1;
        var fullAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: full,
        }
        assetItems.add(fullAsset);
        index += 1;
        return { image: { thumb: `${index-2}`, full: `${index-1}` }};
      } else if (video) {
        var { thumb, hd, lq } = video;
        var thumbAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: thumb,
        }
        assetItems.add(thumbAsset);
        index += 1;
        var hdAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: hd,
        }
        assetItems.add(hdAsset);
        index += 1;
        var lqAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: lq,
        }
        assetItems.add(lqAsset);
        index += 1;
        return { video: { thumb: `${index-3}`, hd: `${index-2}`, lq: `${index-1}` }};
      } else if (audio) {
        var { label, full } = audio;
        var fullAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: full,
        }
        assetItems.add(fullAsset);
        index += 1;
        return { audio: { label, full: `${index-1}` }};
      } else if (binary) {
        var { label, extension, data } = binary;
        var dataAsset = {
          assetId: `${index}`,
          hosting: HostingMode.Basic,
          basic: data,
        }
        assetItems.add(dataAsset);
        index += 1;
        return { binary: { label, extension, data: `${index-1}` }};
      } else {
        return {};
      }
    }
  });
  return { data: { text, textColor, textSize, assets: dataAssets }, assets: Array.from(assetItems.values()) }; 
}

