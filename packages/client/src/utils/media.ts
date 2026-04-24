import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';
import { FileInfo } from '../types';

export async function saveToAlbum(url: string, fileName: string, showToast: (m: string, t?: any) => void) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    showToast('正在保存到相册...', 'info');

    // 1. 下载到临时目录
    const downloadResult = await Filesystem.downloadFile({
      url,
      path: `temp_${Date.now()}_${fileName}`,
      directory: Directory.Cache,
    });

    if (!downloadResult.path) {
      throw new Error('下载失败');
    }

    // 2. 保存到相册
    const isVideo = fileName.match(/\.(mp4|mov|webm)$/i);
    let albumIdentifier: string | undefined;

    if (Capacitor.getPlatform() === 'android') {
      try {
        // 在 Android 上，我们希望保存到公共 DCIM 目录，以便相册软件能立即发现
        // Directory.ExternalStorage 通常指向 /storage/emulated/0
        const targetDir = 'DCIM/FastSend';

        // 1. 确保目录存在
        try {
          await Filesystem.mkdir({
            path: targetDir,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
        } catch (e) {
          // 目录可能已存在
        }

        // 2. 获取该目录的完整 URI/路径作为标识符
        const uriResult = await Filesystem.getUri({
          path: targetDir,
          directory: Directory.ExternalStorage,
        });

        // 去掉 'file://' 前缀，插件通常需要原始路径
        albumIdentifier = uriResult.uri.replace('file://', '');
      } catch (e) {
        console.warn('[Media] Create DCIM directory failed:', e);
      }
    } else {
      albumIdentifier = 'FastSend';
    }

    if (isVideo) {
      await Media.saveVideo({
        path: downloadResult.path,
        albumIdentifier,
      });
    } else {
      await Media.savePhoto({
        path: downloadResult.path,
        albumIdentifier,
      });
    }

    // 3. 清理临时文件
    await Filesystem.deleteFile({
      path: downloadResult.path,
      directory: Directory.Cache,
    }).catch(err => console.warn('Cleanup temp file failed:', err));

    showToast('已成功保存到相册');
  } catch (e: any) {
    console.error('[Media] Save to album failed:', e);
    showToast(`保存失败: ${e.message}`, 'error');
  }
}

/**
 * 将任意文件保存到本地文件目录（Documents/FastSend）
 */
export async function saveFileToLocal(url: string, fileName: string, showToast: (m: string, t?: any) => void) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    showToast('正在保存文件...', 'info');

    const targetDir = 'FastSend';
    const directory = Directory.Documents;

    // 确保目录存在
    try {
      await Filesystem.mkdir({
        path: targetDir,
        directory,
        recursive: true,
      });
    } catch (e) {
      // 目录可能已存在
    }

    // 下载文件到目标目录
    await Filesystem.downloadFile({
      url,
      path: `${targetDir}/${fileName}`,
      directory,
    });

    showToast(`已保存到 Documents/FastSend/${fileName}`);
  } catch (e: any) {
    console.error('[Media] Save file to local failed:', e);
    showToast(`保存失败: ${e.message}`, 'error');
  }
}

/**
 * 保存 gallery 消息中的所有文件：
 * - 图片/视频 → 相册
 * - 其他文件 → Documents/FastSend
 */
export async function saveAllMediaFromGallery(
  files: FileInfo[],
  baseUrl: string,
  showToast: (m: string, t?: any) => void,
) {
  if (!Capacitor.isNativePlatform()) return;

  const mediaFiles = files.filter((f) => f.type === 'image' || f.type === 'video');
  const otherFiles = files.filter((f) => f.type === 'file');

  const total = files.length;
  let saved = 0;

  showToast(`正在保存 ${total} 个文件...`, 'info');

  // 保存媒体文件到相册
  for (const file of mediaFiles) {
    const url = `${baseUrl}/download/${file.filename}`;
    try {
      const downloadResult = await Filesystem.downloadFile({
        url,
        path: `temp_${Date.now()}_${file.originalName}`,
        directory: Directory.Cache,
      });

      if (!downloadResult.path) throw new Error('下载失败');

      const isVideo = file.originalName.match(/\.(mp4|mov|webm)$/i);
      let albumIdentifier: string | undefined;

      if (Capacitor.getPlatform() === 'android') {
        try {
          const targetDir = 'DCIM/FastSend';
          try {
            await Filesystem.mkdir({
              path: targetDir,
              directory: Directory.ExternalStorage,
              recursive: true,
            });
          } catch (e) { /* 已存在 */ }
          const uriResult = await Filesystem.getUri({
            path: targetDir,
            directory: Directory.ExternalStorage,
          });
          albumIdentifier = uriResult.uri.replace('file://', '');
        } catch (e) {
          console.warn('[Media] Create DCIM directory failed:', e);
        }
      } else {
        albumIdentifier = 'FastSend';
      }

      if (isVideo) {
        await Media.saveVideo({ path: downloadResult.path, albumIdentifier });
      } else {
        await Media.savePhoto({ path: downloadResult.path, albumIdentifier });
      }

      // 清理临时文件
      await Filesystem.deleteFile({
        path: downloadResult.path,
        directory: Directory.Cache,
      }).catch((err) => console.warn('Cleanup temp file failed:', err));

      saved++;
    } catch (e: any) {
      console.error(`[Media] Failed to save ${file.originalName}:`, e);
    }
  }

  // 保存其他文件到 Documents/FastSend
  for (const file of otherFiles) {
    const url = `${baseUrl}/download/${file.filename}`;
    try {
      const targetDir = 'FastSend';
      const directory = Directory.Documents;
      try {
        await Filesystem.mkdir({ path: targetDir, directory, recursive: true });
      } catch (e) { /* 已存在 */ }
      await Filesystem.downloadFile({
        url,
        path: `${targetDir}/${file.originalName}`,
        directory,
      });
      saved++;
    } catch (e: any) {
      console.error(`[Media] Failed to save file ${file.originalName}:`, e);
    }
  }

  if (saved === total) {
    showToast(`已保存全部 ${total} 个文件`);
  } else {
    showToast(`已保存 ${saved}/${total} 个文件`, saved > 0 ? 'info' : 'error');
  }
}
