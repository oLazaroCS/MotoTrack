import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_IMAGE_EDGE = 1280;

export async function prepareImageForUpload(uri: string) {
  return manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_EDGE } }],
    { compress: 0.72, format: SaveFormat.JPEG },
  );
}
