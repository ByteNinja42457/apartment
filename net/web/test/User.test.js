import React, { useState, useEffect, useContext } from 'react';
import {render, act, screen, waitFor, fireEvent} from '@testing-library/react'
import { AppContextProvider } from 'context/AppContext';
import { AccountContextProvider } from 'context/AccountContext';
import { ProfileContext, ProfileContextProvider } from 'context/ProfileContext';
import { StoreContextProvider } from 'context/StoreContext';
import { SettingsContextProvider } from 'context/SettingsContext';
import { useProfile } from 'session/account/profile/useProfile.hook';
import * as fetchUtil from 'api/fetchUtil';

let profileHook;
let profileContext;
function ProfileView() {
  var { state, actions } = useProfile();

  var [name, setName] = useState();
  var [renderCount, setRenderCount] = useState(0);
  var profile = useContext(ProfileContext);
  profileContext = profile;
  profileHook = actions;

  useEffect(() => {
    var rendered = [];
    setName(state.name);
    setRenderCount(renderCount + 1);
  }, [state]);

  return (
    <div data-testid="name" count={renderCount}>{ name }</div>
  );
}

function ProfileTestApp() {
  return (
    <StoreContextProvider>
      <ProfileContextProvider>
        <AccountContextProvider>
          <SettingsContextProvider>
            <AppContextProvider>
              <ProfileView />
            </AppContextProvider>
          </SettingsContextProvider>
        </AccountContextProvider>
      </ProfileContextProvider>
    </StoreContextProvider>
  );
}

let updated;
var realFetchWithTimeout = fetchUtil.fetchWithTimeout;
var realFetchWithCustomTimeout = fetchUtil.fetchWithCustomTimeout;
beforeEach(() => {
  let updated = false; 
  var mockFetch = jest.fn().mockImplementation((url, options) => {
    if (options.method === 'PUT') {
      updated = true;
    }
    return Promise.resolve({
      json: () => Promise.resolve({ name: updated ? 'tested' : 'tester' })
    });
  });
  fetchUtil.fetchWithTimeout = mockFetch;
  fetchUtil.fetchWithCustomTimeout = mockFetch;
});

afterEach(() => {
  fetchUtil.fetchWithTimeout = realFetchWithTimeout;
  fetchUtil.fetchWithCustomTimeout = realFetchWithCustomTimeout;
});

test('update profile name', async () => {

  render(<ProfileTestApp />);

  await waitFor(async () => {
    expect(profileContext).not.toBe(null);
    expect(profileHook).not.toBe(null);
  });

  await act(async () => {
    profileContext.actions.setToken('abc123');
    profileContext.actions.setRevision(1);
  });

  await waitFor(async () => {
    expect(screen.getByTestId('name').textContent).toBe('tester');
  });

  await act(async () => {
    profileHook.setEditName('tested');
  });

  await act(async () => {
    await profileHook.setProfileDetails();
  });

  await act(async () => {
    profileContext.actions.setRevision(2);
  });

  await waitFor(async () => {
    expect(screen.getByTestId('name').textContent).toBe('tested');
  });

});

