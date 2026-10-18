import { render, screen } from '@testing-library/react-native';

import Index from '@/app/index';

describe('<Index />', () => {
  test('renders the start screen', async () => {
    await render(<Index />);

    screen.getByText('Edit src/app/index.tsx to edit this screen.');
  });
});
