export function getContactChannelTopicAssetUrl(server, token, channelId, topicId, assetId) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  return `${host}/content/channels/${channelId}/topics/${topicId}/assets/${assetId}?contact=${token}`
}

