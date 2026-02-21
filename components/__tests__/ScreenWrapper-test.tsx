import * as React from 'react';
import renderer from 'react-test-renderer';
import { KeyboardAvoidingView, Text } from 'react-native';

import ScreenWrapper from '../ScreenWrapper';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');

  return {
    SafeAreaView: View,
  };
});

it('adds keyboard avoiding wrapper', () => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <ScreenWrapper>
        <Text>Content</Text>
      </ScreenWrapper>
    );
  });

  const keyboardAvoidingView = tree!.root.findByType(KeyboardAvoidingView);
  expect(keyboardAvoidingView).toBeTruthy();
});
