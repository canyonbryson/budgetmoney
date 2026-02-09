import * as React from 'react';
import renderer from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';

import ScreenScrollView from '../ScreenScrollView';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');

  return {
    SafeAreaView: View,
  };
});

it('constrains the scroll view height for scrolling', () => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <ScreenScrollView>
        <Text>Content</Text>
      </ScreenScrollView>
    );
  });

  const scrollView = tree!.root.findByType(ScrollView);
  const scrollStyle = StyleSheet.flatten(scrollView.props.style);

  expect(scrollStyle?.flex).toBe(1);
});

it('removes flex from content container styles', () => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <ScreenScrollView contentContainerStyle={{ flex: 1, padding: 10 }}>
        <Text>Content</Text>
      </ScreenScrollView>
    );
  });

  const scrollView = tree!.root.findByType(ScrollView);
  const contentStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);

  expect(contentStyle?.flex).toBeUndefined();
  expect(contentStyle?.padding).toBe(10);
});
