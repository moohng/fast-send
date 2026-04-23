import { useCallback } from 'react'
import SparkMD5 from 'spark-md5'
import { SharedItem } from '../types'

const CHUNK_SIZE = 2 * 1024 * 1024

export const useUpload = (
  baseUrl: string,
  clientId: string,
  setItems: React.Dispatch<React.SetStateAction<SharedItem[]>>,
  showToast: (m: string, t?: any) => void,
) => {
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

  const uploadFile = useCallback(
    async (file: File) => {
      if (!baseUrl) return
      const tempId = Date.now() + Math.random()
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

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
        const hash = await calculateHash(file)
        const checkRes = await fetch(`${baseUrl}/api/upload/check/${hash}`)
        const { uploaded } = await checkRes.json()
        const uploadedSet = new Set<number>(uploaded)

        let finishedChunks = uploadedSet.size
        const initialPct = Math.round((finishedChunks / totalChunks) * 100)
        setItems((p) => p.map((x) => (x.id === tempId ? { ...x, progress: initialPct } : x)))

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
            const pct = Math.round((finishedChunks / totalChunks) * 100)
            setItems((prev) => prev.map((x) => (x.id === tempId ? { ...x, progress: pct } : x)))
          })()

          pool.add(task)
          task.finally(() => pool.delete(task))

          if (pool.size >= MAX_CONCURRENT) {
            await Promise.race(pool)
          }
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
          }),
        })

        if (mergeRes.ok) {
          showToast('发送成功')
          setItems((p) => p.filter((x) => x.id !== tempId))
        } else throw new Error('Merge failed')
      } catch (e) {
        console.error(e)
        showToast('上传失败', 'error')
        setItems((p) => p.filter((x) => x.id !== tempId))
      }
    },
    [baseUrl, clientId, setItems, showToast],
  )

  return { uploadFile }
}
