import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppButton } from '../components/AppButton';
import { RankBadge } from '../components/RankBadge';
import { StatusBanner } from '../components/StatusBanner';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

describe('AppButton', () => {
  it('render label sebagai tombol dengan hint alasan saat disabled', async () => {
    await render(
      <AppButton label="Mulai Permainan" disabled disabledReason="Pilih minimal 2 pemain." onPress={() => undefined} />,
    );
    const btn = screen.getByRole('button', { name: 'Mulai Permainan' });
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('menampilkan label proses dan state busy saat loading', async () => {
    await render(
      <AppButton label="Simpan" loading loadingLabel="Menyimpan…" onPress={() => undefined} />,
    );
    const btn = screen.getByRole('button', { name: 'Simpan' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(screen.getByText('Menyimpan…')).toBeTruthy();
  });
});

describe('StatusBanner', () => {
  it('menampilkan pesan dan aksi', async () => {
    const onAction = jest.fn();
    await render(
      <StatusBanner tone="offline" text="Mode offline" actionLabel="Coba Lagi" onAction={onAction} />,
    );

    expect(screen.getByText('Mode offline')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('RankBadge', () => {
  it('mengumumkan juara untuk peringkat 1', async () => {
    await render(<RankBadge rank={1} />);
    expect(screen.getByLabelText('Peringkat 1, juara')).toBeTruthy();
  });

  it('mengumumkan peringkat lain apa adanya', async () => {
    await render(<RankBadge rank={3} />);
    expect(screen.getByLabelText('Peringkat 3')).toBeTruthy();
  });
});
