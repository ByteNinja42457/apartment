import { FocusModule } from '../src/focus';
import { NoStore } from '../src/store';
import { ConsoleLogging } from '../src/logging';
import { Topic } from '../src/types';
import { waitFor } from '../__mocks__/waitFor';

function getTopic(id: number) {
  return {
    id: `topicId-${id}`,
    revision: id,
    data: {
      detailRevision: id,
      tagRevision: id,
      topicDetail: {
        guid: `guid-${id}`,
        dataType: 'superbasictopic',
        data: JSON.stringify({ text: `message-${id}` }),
        created: 1,
        updated: 2,
        status: 'confirmed',
        transform: 'ready',
      }
    }
  }
}

function initialTopics() {
  var topics = [];
  for (let i = 0; i < 32; i++) {
    topics.push(getTopic(i));
  }
  return topics;
}

function nextTopics() {
  var topics = [];
  for (let i = 0; i < 4; i++) {
    topics.push(getTopic(i + 32));
  }
  return topics;
}

jest.mock('../src/net/fetchUtil', () => {
  var fn = jest.fn().mockImplementation((url: string, options: { method: string, body: string }) => {
    if (url === 'http://test_node/content/channels/test_channel_id/topics?agent=test_token&count=32') {
      return Promise.resolve({ status: 200, json: () => (initialTopics()), headers: { get: (key: string) => key === 'topic-marker' ? 300 : 400 }});
    } else if (url === 'http://test_node/content/channels/test_channel_id/topics?agent=test_token&count=32&end=300') {
      return Promise.resolve({ status: 200, json: () => (nextTopics()), headers: { get: (key: string) => key === 'topic-marker' ? 200 : 400 }});
    } else {
      console.log(url, options);
      return Promise.resolve({ status: 200, json: () => [], headers: { get: (key: string) => key === 'topic-marker' ? 300 : 400 }});
    }
  });

  return {
    fetchWithTimeout: fn,
    checkResponse: () => {},
  }
});
  
class TestStore extends NoStore {
}

test('focus module works', async () => {
  let focusTopics = null as null | Topic[];
  var setTopics = (topics: null | Topic[]) => {
    focusTopics = topics;
  }
  var log = new ConsoleLogging();
  var store = new TestStore();
  var connection = { node: 'test_node', secure: false, token: 'test_token' };
  var markRead = async () => {};
  var flagTopic = async (id: string) => {};
  var focus = new FocusModule(log, store, null, null, null, 'test_channel_id', 'my_guid', connection, null, false, 1, markRead, flagTopic);
  focus.addTopicListener(setTopics);
  await waitFor(() => focusTopics?.length == 32);
  focus.viewMoreTopics();
  await waitFor(() => focusTopics?.length == 36);
  await focus.close();
});
