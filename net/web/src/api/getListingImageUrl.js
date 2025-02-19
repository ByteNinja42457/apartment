export function getListingImageUrl(server, guid) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  return `${host}/account/listing/${guid}/image`
}


