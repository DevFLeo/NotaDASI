import React from 'react';
import renderer, { act } from 'react-test-renderer';
import App from '../App';

test('renderiza sem falhar', async () => {
  await act(async () => {
    renderer.create(<App />);
  });
});
