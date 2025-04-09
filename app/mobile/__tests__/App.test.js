import React, { useState, useEffect, useContext } from 'react';
import { View, Text } from 'react-native';
import { useTestStoreContext } from 'context/useTestStoreContext.hook';
import {render, act, screen, waitFor, fireEvent} from '@testing-library/react-native'
import * as fetchUtil from 'api/fetchUtil';
import { UploadContextProvider } from 'context/UploadContext';
import { AppContext, AppContextProvider } from 'context/AppContext';
import { AccountContextProvider } from 'context/AccountContext';
import { ProfileContextProvider } from 'context/ProfileContext';
import { CardContextProvider } from 'context/CardContext';
import { RingContextProvider } from 'context/RingContext';
import { ChannelContextProvider } from 'context/ChannelContext';
import { StoreContext } from 'context/StoreContext';

function AppView() {
  var [renderCount, setRenderCount] = useState(0);
  var app = useContext(AppContext);

  useEffect(() => {
    setRenderCount(renderCount + 1);
  }, [app.state]);

  return (
    <View testID="app" app={app} renderCount={renderCount}>
      <Text testID="session">{ app.state.session }</Text>
      <Text testID="status">{ app.state.status }</Text>
    </View>
  );
}

function AppTestApp() {
  return (
    <UploadContextProvider>
      <CardContextProvider>
        <ChannelContextProvider>
          <AccountContextProvider>
            <ProfileContextProvider>
              <RingContextProvider>
                <AppContextProvider>
                  <AppView />
                </AppContextProvider>
              </RingContextProvider>
            </ProfileContextProvider>
          </AccountContextProvider>
        </ChannelContextProvider>
      </CardContextProvider>
    </UploadContextProvider>
  );
}

let mockWebsocket;
function MockWebsocket(url) {
  this.url = url;
  this.sent = false;
  this.send = (msg) => { this.sent = true };
};
jest.mock('@react-native-firebase/messaging', () => () => ({ getToken: async () => '##' }));

jest.mock('react-native-webrtc', () => {});

jest.mock('react-native-device-info', () => ({
  getVersion: () => '##',
  getApplicationName: () => '##',
  getDeviceId: () => '##',
}));

var realUseContext = React.useContext;
var realCreateWebsocket = fetchUtil.createWebsocket;
var realFetchWithTimeout = fetchUtil.fetchWithTimeout;
var realFetchWithCustomTimeout = fetchUtil.fetchWithCustomTimeout;
beforeEach(() => {
  var mockCreateWebsocket = jest.fn().mockImplementation((url) => {
    mockWebsocket = new MockWebsocket(url);
    return mockWebsocket;
  });

  var mockUseContext = jest.fn().mockImplementation((ctx) => {
    if (ctx === StoreContext) {
      return useTestStoreContext();
    }
    return realUseContext(ctx);
  });
  React.useContext = mockUseContext;

  var mockFetch = jest.fn().mockImplementation((url, options) => {
    if (url.startsWith('https://test.org/account/apps')) {
      return Promise.resolve({
        json: () => Promise.resolve({ guid: '123', appToken: 'abc' })
      });
    }
    return Promise.resolve({
      json: () => Promise.resolve([])
    });
  });
  fetchUtil.fetchWithTimeout = mockFetch;
  fetchUtil.fetchWithCustomTimeout = mockFetch;
  fetchUtil.createWebsocket = mockCreateWebsocket;
});

afterEach(() => {
  React.useContext = realUseContext;
  fetchUtil.fetchWithTimeout = realFetchWithTimeout;
  fetchUtil.fetchWithCustomTimeout = realFetchWithCustomTimeout;
  fetchUtil.createWebsocket = realCreateWebsocket;
});

test('testing', async () => {
  render(<AppTestApp />)

  await waitFor(async () => {
    expect(screen.getByTestId('session').props.children).toBe(false);
  });

  await act(async () => {
    var app = screen.getByTestId('app').props.app;
    app.actions.login('testlogin@test.org', 'testpassword');
  });

  await waitFor(async () => {
    expect(mockWebsocket).not.toBe(undefined);
    expect(mockWebsocket?.onopen).not.toBe(null);
    expect(mockWebsocket?.onmessage).not.toBe(null);
    expect(mockWebsocket?.onclose).not.toBe(null);
  });

  await act(async () => {
    mockWebsocket.onopen();
  });

  await waitFor(async () => {
    expect(mockWebsocket.sent).toBe(true);
  });

  await act(async () => {
    mockWebsocket.onmessage({ data: JSON.stringify({ account: 1, profile: 1, card: 1, channel: 1 }) });
  });

  await waitFor(async () => {
    expect(screen.getByTestId('status').props.children).toBe('connected');
  });

});

