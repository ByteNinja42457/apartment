import React, { useState, useEffect, useContext } from 'react';
import { View, Text } from 'react-native';
import {render, act, screen, waitFor, fireEvent} from '@testing-library/react-native'
import { AppContext, AppContextProvider } from 'context/AppContext';
import { AccountContextProvider } from 'context/AccountContext';
import { ProfileContextProvider } from 'context/ProfileContext';
import { ChannelContextProvider } from 'context/ChannelContext';
import { CardContextProvider } from 'context/CardContext';
import { RingContextProvider } from 'context/RingContext';
import { StoreContext } from 'context/StoreContext';
import { useTestStoreContext } from 'context/useTestStoreContext.hook';
import { useLogin } from 'src/access/login/useLogin.hook';
import { useCreate } from 'src/access/create/useCreate.hook';
import * as fetchUtil from 'api/fetchUtil';

let navPath;
jest.mock('react-router-dom', () => ({
   ...jest.requireActual('react-router-dom'),
  useNavigate: () => { return (path) => { navPath = path } },
  useLocation: () => { return 'path' },
}));

function AccessView({ mode }) {
  var { state, actions } = (mode === 'login') ? useLogin() : useCreate();
  var app = useContext(AppContext);
  var [session, setSession] = useState();
  
  useEffect(() => {
    setSession(app.state.session);
  }, [app.state]);

  return (
    <View key="access" testID="access" app={app}>
      <Text testID="session">{ session }</Text>
    </View>
  );
}

function AccessTestApp({ mode }) {
  return (
    <AccountContextProvider>
      <ProfileContextProvider>
        <ChannelContextProvider>
          <CardContextProvider>
            <RingContextProvider>
              <AppContextProvider>
                <AccessView mode={mode} />
              </AppContextProvider>
            </RingContextProvider>
          </CardContextProvider>
        </ChannelContextProvider>
      </ProfileContextProvider>
    </AccountContextProvider>
  );
}

let mockWebsocket;
function MockWebsocket(url) {
  this.url = url;
  this.sent = false;
  this.send = (msg) => { this.sent = true };
  this.close = () => {};
};

jest.mock('@react-native-firebase/messaging', () => () => ({ 
  deleteToken: async () => {}, 
  getToken: async () => '##'
}));

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
    return Promise.resolve({
      json: () => Promise.resolve({
        guid: '123',
        appToken: 'aacc',
        created: 2,
        pushSupported: false,
      })
    });
  });
  fetchUtil.createWebsocket = mockCreateWebsocket;
  fetchUtil.fetchWithTimeout = mockFetch;
  fetchUtil.fetchWithCustomTimeout = mockFetch;
});

afterEach(() => {
  React.useContext = realUseContext;
  fetchUtil.createWebsocket = realCreateWebsocket;
  fetchUtil.fetchWithTimeout = realFetchWithTimeout;
  fetchUtil.fetchWithCustomTimeout = realFetchWithCustomTimeout;
});

test('nav to session after create', async () => {
    render(<AccessTestApp mode="create" />);

    await waitFor(async () => {
      expect(screen.getByTestId('session').props.children).toBe(false);
    });

    await act(async () => {
      var app = screen.getByTestId('access').props.app;
      await app.actions.create('test.org', 'testusername', 'testpassword', 'secret');
    });

    await waitFor(async () => {
      expect(navPath).toBe('/session');
    });

    await waitFor(async () => {
      expect(screen.getByTestId('session').props.children).toBe(true);
    });

});

test('nav to session after login', async () => {
    render(<AccessTestApp mode="login" />);

    await waitFor(async () => {
      expect(screen.getByTestId('session').props.children).toBe(false);
    });

    await act(async () => {
      var app = screen.getByTestId('access').props.app;
      await app.actions.login('testusername', 'testpassword');
    });

    await waitFor(async () => {
      expect(navPath).toBe('/session');
    });

    await waitFor(async () => {
      expect(screen.getByTestId('session').props.children).toBe(true);
    });

});

