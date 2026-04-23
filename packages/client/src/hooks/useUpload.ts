import { useCallback, useRef } from 'react'
import SparkMD5 from 'spark-md5'
import { SharedItem, FileInfo } from '../types'

const CHUNK_SIZE = 2 * 1024 * 1024

export const useUpload = (
  baseUrl: string,
  clientId: string,
  setItems: React.Dispatch<React.SetStateAction<SharedItem[]>>,
  showToast: (m: string, t?: any) => void,
) => {
  const activeUploads = useRef<Record<string, boolean>>({})

  const calculateHash = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const spark = new SparkMD5.ArrayBuffer()
      const reader = new FileReader()
      const slice = file.slice(0, Math.min(file.size, 5 * 1024 * 1024))
      reader.readAsArrayBuffer(slice)
      reader.onload = (e) => {
        spark.append(e.target?.result as ArrayBuffer)
        resolve(SparkMD5.hash(spark.end() + file.name + file.size))
      }
    })
  }

  const uploadSingleFile = async (file: File, onProgress: (pct: number) => void, noRecord: boolean = false): Promise<FileInfo> => {
    const hash = await calculateHash(file)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    const checkRes = await fetch(`${baseUrl}/api/upload/check/${hash}`)
    const { uploaded } = await checkRes.json()
    const uploadedSet = new Set<number>(uploaded)

    let finishedChunks = uploadedSet.size
    onProgress(Math.round((finishedChunks / totalChunks) * 100))

    const pool = new Set<Promise<void>>()
    const MAX_CONCURRENT = 3

    for (let i = 0; i < totalChunks; i++) {
      if (uploadedSet.has(i)) continue

      const start = i * CHUNK_SIZE
      const end = Math.min(file.size, start + CHUNK_SIZE)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('hash', hash)
      formData.append('index', String(i))
      formData.append('fileName', file.name)
      formData.append('chunk', chunk)

      const task = (async () => {
        const res = await fetch(`${baseUrl}/api/upload/chunk`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error('Chunk upload failed')
        finishedChunks++
        onProgress(Math.round((finishedChunks / totalChunks) * 100))
      })()

      pool.add(task)
      task.finally(() => pool.delete(task))
      if (pool.size >= MAX_CONCURRENT) await Promise.race(pool)
    }
    await Promise.all(pool)

    const mergeRes = await fetch(`${baseUrl}/api/upload/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash,
        fileName: file.name,
        total: totalChunks,
        senderId: clientId,
        noRecord,
      }),
    })

    if (!mergeRes.ok) throw new Error('Merge failed')
    const result = await mergeRes.json()
    return {
      filename: result.filename,
      originalName: result.originalName,
      size: result.size,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
    }
  }

  const uploadFile = useCallback(
    async (file: File) => {
      if (!baseUrl) return
      const tempId = Date.now() + Math.random()
      setItems((p) => [
        ...p,
        {
          id: tempId,
          type: 'file',
          originalName: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          time: new Date().toLocaleTimeString(),
          fullTime: new Date().toISOString(),
          senderId: clientId,
          progress: 0,
        },
      ])

      try {
        await uploadSingleFile(file, (pct) => {
          setItems((p) => p.map((x) => (x.id === tempId ? { ...x, progress: pct } : x)))
        })
        showToast('发送成功')
        setItems((p) => p.filter((x) => x.id !== tempId))
      } catch (e) {
        console.error(e)
        showToast('上传失败', 'error')
        setItems((p) => p.filter((x) => x.id !== tempId))
      }
    },
    [baseUrl, clientId, setItems, showToast],
  )

  const uploadBatch = useCallback(
    async (files: File[]) => {
      if (!baseUrl || files.length === 0) return
      if (files.length === 1) return uploadFile(files[0])

      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const tempId = Date.now() + Math.random()

      setItems((p) => [
        ...p,
        {
          id: tempId,
          type: 'gallery',
          originalName: `批量发送 (${files.length}个文件)`,
          time: new Date().toLocaleTimeString(),
          fullTime: new Date().toISOString(),
          senderId: clientId,
          progress: 0,
        },
      ])

      const results: FileInfo[] = []

      // 持久化上传状态
      const saveBatchStatus = (completed: number) => {
          const status = {
              batchId,
              total: files.length,
              completed,
              timestamp: Date.now()
          };
          localStorage.setItem('last_upload_batch', JSON.stringify(status));
      };

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const info = await uploadSingleFile(
            file,
            (pct) => {
              const currentTotal = Math.round(((i + pct / 100) / files.length) * 100)
              setItems((p) => p.map((x) => (x.id === tempId ? { ...x, progress: currentTotal } : x)))
            },
            true,
          )
          results.push(info)
          saveBatchStatus(i + 1)
        }

        // 合并为 gallery 消息
        const res = await fetch(`${baseUrl}/api/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: results,
            senderId: clientId,
            type: 'gallery',
          }),
        })

        if (res.ok) {
          showToast(`成功发送 ${files.length} 个文件`)
          setItems((p) => p.filter((x) => x.id !== tempId))
          localStorage.removeItem('last_upload_batch')
        }
      } catch (e) {
        console.error(e)
        showToast('批量上传中断，已保存进度', 'error')
        setItems((p) => p.filter((x) => x.id !== tempId))
      }
    },
    [baseUrl, clientId, setItems, showToast, uploadFile],
  )

  return { uploadFile, uploadBatch }
}
