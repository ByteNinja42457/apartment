import React, { useState, useEffect, useContext } from 'react';
import { View, Text } from 'react-native';
import {render, act, screen, waitFor, fireEvent} from '@testing-library/react-native'
import { UploadContextProvider, UploadContext } from 'context/UploadContext';
import axios from 'axios';

function UploadView() {
  var [renderCount, setRenderCount] = useState(0);
  var [total, setTotal] = useState(0);
  var [channel, setChannel] = useState(0);
  var upload = useContext(UploadContext);

  useEffect(() => {
    setRenderCount(renderCount + 1);

    upload.state.progress.forEach((value, key) => {
      value.forEach(topic => {
        if (topic.active?.total > total) {
          setTotal(topic.active?.total);
        };
      });
      setChannel(key);
    });

  }, [upload.state]);

  return (
    <View testID="upload" upload={upload} renderCount={renderCount}>
      <Text testID="channel">{ channel }</Text>
      <Text testID="total">{ total }</Text>
    </View>
  );
}

function UploadTestApp() {
  return (
    <UploadContextProvider>
      <UploadView />
    </UploadContextProvider>
  )
}

var realPost = axios.post;
let asset;
beforeEach(() => {
  asset = {};

  var mockPost = jest.fn().mockImplementation(async (url, data, options) => {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 10));
      options.onUploadProgress({ loaded: i * 11, total: 111 });
    }

    return Promise.resolve({ data: asset });
  });
  axios.post = mockPost;
});

afterEach(() => {
  axios.post = realPost;
});

test('testing', async () => {
  render(<UploadTestApp />)

  asset = [ { assetId: '3', transform: 'acopy;audio', status: 'pending' } ];

  setComplete = false;
  await act(async () => {
    var upload = screen.getByTestId('upload').props.upload;
    upload.actions.addTopic('test.org', 'asdf', '123', '1', [{ type: 'audio', data: 'asdf'}], ()=>{setComplete=true}, ()=>{});
  });

  await waitFor(async () => {
    expect(setComplete).toBe(true);
    expect(screen.getByTestId('total').props.children).toBe(111);
    expect(screen.getByTestId('channel').props.children).toBe(':123');
  });

  setComplete = false;
  await act(async () => {
    var upload = screen.getByTestId('upload').props.upload;
    upload.actions.addTopic('test.org', 'asdf', '123', '1', [{ type: 'audio', data: 'asdf'}], ()=>{setComplete=true}, ()=>{}, '96');
  });

  await waitFor(async () => {
    expect(setComplete).toBe(true);
    expect(screen.getByTestId('channel').props.children).toBe('96:123');
  });

});



