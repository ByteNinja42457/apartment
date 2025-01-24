import { Call } from '../src/types';
import { RingModule } from '../src/ring';
import { MockLinkModule } from '../__mocks__/link';
import { waitFor } from '../__mocks__/waitFor';
import { ConsoleLogging } from '../src/logging';

jest.mock('../src/net/fetchUtil', () => {
  var fn = jest.fn().mockImplementation((url: string, options: { method: string, body: string }) => {
    console.log(url, options);
    return Promise.resolve({ state: 200, json: () => {} });
  });

  return {
    fetchWithTimeout: fn,
    checkResponse: () => {},
  }
});

var mockLink = new MockLinkModule();
jest.mock('../src/link', () => {
  return {
    Connection: jest.fn().mockImplementation(() => {
      return mockLink;
    })
  }
})

test('rings correctly', async () => {
  let calling = [] as { cardId: string, callId: string }[];
  var endContactCall = async (cardId: string, callId: string) => {
    console.log("ending");
  };
  var ringing = (calls: { cardId: string, callId: string }[]) => {
    calling = calls;
  };

  var log = new ConsoleLogging();
  var ringModule = new RingModule(log, endContactCall);

  ringModule.addRingingListener(ringing);
  ringModule.ring({ cardId: 'card1', callId: 'call1', calleeToken: 'token1', ice: [] });
  await waitFor(() => calling.length === 1);
  await waitFor(() => calling.length === 0, 10);
  ringModule.close();
}, 15000);
