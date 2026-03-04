'use client'

import { useEffect } from 'react'

/**
 * Client component that auto-refreshes the preview iframe
 * when Payload CMS sends a postMessage after an autosave or manual save.
 *
 * Payload v3 Live Preview sends messages of shape:
 *   { type: 'payload-live-preview', data: { ... } }
 *
 * We listen for those and reload the page so the server re-fetches
 * the latest draft content from the database.
 */
export function PreviewRefreshScript() {
    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout>

        function handleMessage(event: MessageEvent) {
            // Payload Live Preview sends structured messages
            if (
                event.data &&
                typeof event.data === 'object' &&
                (event.data.type === 'payload-live-preview' ||
                    event.data.type === 'payload-update')
            ) {
                // Debounce refreshes to avoid rapid reloads during autosave
                clearTimeout(debounceTimer)
                debounceTimer = setTimeout(() => {
                    window.location.reload()
                }, 1000)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => {
            window.removeEventListener('message', handleMessage)
            clearTimeout(debounceTimer)
        }
    }, [])

    return null
}
