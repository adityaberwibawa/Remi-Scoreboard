import { Image, StyleSheet, Text, View } from 'react-native';
import { AvatarTint, Colors, FontFamily } from '../theme';
import { initialsOf } from '../scoring';
import type { Avatar } from '../types';

interface Props {
  name: string;
  avatar: Avatar;
  size?: number;
}

/** Avatar lingkaran: foto atau inisial 2 huruf dengan tint. */
export function PlayerAvatar({ name, avatar, size = 44 }: Props) {
  if (avatar.type === 'photo' && avatar.photoUri) {
    return (
      <Image
        source={{ uri: avatar.photoUri }}
        accessibilityRole="image"
        accessibilityLabel={`Foto profil ${name}`}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  const tint = avatar.type === 'initials' ? AvatarTint[avatar.colorStyle] : AvatarTint.slate;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${name}`}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint.bg,
          borderColor: tint.border,
        },
      ]}>
      <Text style={[styles.initials, { color: tint.fg, fontSize: size * 0.36 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { fontFamily: FontFamily.display },
});
