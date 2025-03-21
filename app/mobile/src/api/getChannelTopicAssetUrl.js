export function getChannelTopicAssetUrl(server, token, channelId, topicId, assetId) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';
  return `${protocol}://${server}/content/channels/${channelId}/topics/${topicId}/assets/${assetId}?agent=${token}`
}

