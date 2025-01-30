import { DatabagSDK } from 'databag-client-sdk';

let run = async () => {
  let sdk = new DatabagSDK(null);
  let bot = await sdk.automate();
  console.log(bot);
}

run();
