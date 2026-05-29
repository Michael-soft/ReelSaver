import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { api } from '../api/client'
import type { DownloadProgress } from '../api/client'

export interface QueueItem {
  taskId: string
  title: string
  thumbnail?: string
  status: 'downloading' | 'completed' | 'failed' | 'cancelled' | string
  percent: number
  speed?: string
  eta?: string
  filename?: string
  error?: string
}

interface DownloadQueueContextValue {
  downloads: QueueItem[]
  addDownload: (taskId: string, title: string, thumbnail?: string) => void
  removeDownload: (taskId: string) => void
  clearCompleted: () => void
  activeCount: number
}

const DownloadQueueContext = createContext<DownloadQueueContextValue>({
  downloads: [],
  addDownload: () => {},
  removeDownload: () => {},
  clearCompleted: () => {},
  activeCount: 0,
})

export function DownloadQueueProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<QueueItem[]>([])
  const unsubsRef = useRef<Map<string, () => void>>(new Map())

  const addDownload = useCallback((taskId: string, title: string, thumbnail?: string) => {
    setDownloads(prev => {
      if (prev.find(d => d.taskId === taskId)) return prev
      return [...prev, { taskId, title, thumbnail, status: 'downloading', percent: 0 }]
    })

    const unsub = api.subscribeProgress(taskId, (data: DownloadProgress & { error?: string }) => {
      setDownloads(prev => prev.map(d =>
        d.taskId === taskId
          ? {
              ...d,
              status: data.status,
              percent: data.percent,
              speed: data.speed,
              eta: data.eta,
              filename: data.filename,
              error: (data as any).error,
            }
          : d
      ))
    })
    unsubsRef.current.set(taskId, unsub)
  }, [])

  const removeDownload = useCallback((taskId: string) => {
    const unsub = unsubsRef.current.get(taskId)
    if (unsub) { unsub(); unsubsRef.current.delete(taskId) }
    setDownloads(prev => prev.filter(d => d.taskId !== taskId))
  }, [])

  const clearCompleted = useCallback(() => {
    setDownloads(prev => {
      const removed = prev.filter(d => d.status !== 'downloading')
      removed.forEach(d => {
        const unsub = unsubsRef.current.get(d.taskId)
        if (unsub) { unsub(); unsubsRef.current.delete(d.taskId) }
      })
      return prev.filter(d => d.status === 'downloading')
    })
  }, [])

  const activeCount = downloads.filter(d => d.status === 'downloading').length

  return (
    <DownloadQueueContext.Provider value={{ downloads, addDownload, removeDownload, clearCompleted, activeCount }}>
      {children}
    </DownloadQueueContext.Provider>
  )
}

export const useDownloadQueue = () => useContext(DownloadQueueContext)
